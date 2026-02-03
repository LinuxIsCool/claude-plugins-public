/**
 * YouTube Ingestion Adapter
 *
 * Uses yt-dlp to ingest YouTube content:
 * - Video metadata extraction
 * - Caption/subtitle download (auto-generated or manual)
 * - Audio download for Whisper transcription
 * - Channel and playlist enumeration
 */

import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

// ============================================================================
// Types
// ============================================================================

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  channel: string;
  channel_id: string;
  description: string;
  duration_seconds: number;
  upload_date: string;  // YYYYMMDD format
  view_count: number;
  thumbnail: string;
  url: string;
  has_captions: boolean;
  caption_languages: string[];
}

export interface YouTubeCaption {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface YouTubeTranscript {
  video: YouTubeVideoInfo;
  captions: YouTubeCaption[];
  source: "auto" | "manual" | "whisper";
  language: string;
}

export interface ChannelVideo {
  id: string;
  title: string;
  upload_date: string;
  duration_seconds: number;
  view_count: number;
}

export interface IngestOptions {
  mode: "captions" | "whisper" | "auto";  // auto tries captions first, falls back to whisper
  language?: string;                       // Preferred language code (default: en)
  whisper_model?: string;                  // Whisper model if using whisper mode
  cache_dir?: string;                      // Directory for caching downloads
  force?: boolean;                         // Force re-download even if cached
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the cache directory for YouTube downloads
 */
function getCacheDir(custom?: string): string {
  const dir = custom || join(homedir(), ".claude", "transcripts", "youtube-cache");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/  // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract channel ID/handle from URL
 */
export function extractChannelId(url: string): { type: "id" | "handle" | "user"; value: string } | null {
  const patterns: Array<{ pattern: RegExp; type: "id" | "handle" | "user" }> = [
    { pattern: /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/, type: "id" },
    { pattern: /youtube\.com\/@([a-zA-Z0-9_-]+)/, type: "handle" },
    { pattern: /youtube\.com\/user\/([a-zA-Z0-9_-]+)/, type: "user" },
    { pattern: /youtube\.com\/c\/([a-zA-Z0-9_-]+)/, type: "handle" },
  ];

  for (const { pattern, type } of patterns) {
    const match = url.match(pattern);
    if (match) return { type, value: match[1] };
  }
  return null;
}

/**
 * Run yt-dlp command and return stdout
 */
async function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, {
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

/**
 * Parse VTT caption file into structured captions
 */
function parseVTT(content: string): YouTubeCaption[] {
  const captions: YouTubeCaption[] = [];
  const lines = content.split("\n");

  let i = 0;
  while (i < lines.length) {
    // Skip WEBVTT header and empty lines
    if (lines[i].startsWith("WEBVTT") || lines[i].startsWith("Kind:") ||
        lines[i].startsWith("Language:") || lines[i].trim() === "") {
      i++;
      continue;
    }

    // Look for timestamp line: 00:00:00.000 --> 00:00:00.000
    const timestampMatch = lines[i].match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );

    if (timestampMatch) {
      const startMs =
        parseInt(timestampMatch[1]) * 3600000 +
        parseInt(timestampMatch[2]) * 60000 +
        parseInt(timestampMatch[3]) * 1000 +
        parseInt(timestampMatch[4]);

      const endMs =
        parseInt(timestampMatch[5]) * 3600000 +
        parseInt(timestampMatch[6]) * 60000 +
        parseInt(timestampMatch[7]) * 1000 +
        parseInt(timestampMatch[8]);

      i++;

      // Collect text lines until empty line
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        // Remove VTT formatting tags like <c> and position markers
        const cleanLine = lines[i]
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .trim();
        if (cleanLine) {
          textLines.push(cleanLine);
        }
        i++;
      }

      if (textLines.length > 0) {
        captions.push({
          start_ms: startMs,
          end_ms: endMs,
          text: textLines.join(" "),
        });
      }
    } else {
      i++;
    }
  }

  // Merge adjacent captions with same text (common in auto-generated captions)
  const merged: YouTubeCaption[] = [];
  for (const caption of captions) {
    const last = merged[merged.length - 1];
    if (last && last.text === caption.text) {
      // Extend previous caption
      last.end_ms = caption.end_ms;
    } else {
      merged.push({ ...caption });
    }
  }

  return merged;
}

/**
 * Parse SRT caption file into structured captions
 */
function parseSRT(content: string): YouTubeCaption[] {
  const captions: YouTubeCaption[] = [];
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // Find timestamp line
    const timestampLine = lines.find(l => l.includes("-->"));
    if (!timestampLine) continue;

    const match = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (match) {
      const startMs =
        parseInt(match[1]) * 3600000 +
        parseInt(match[2]) * 60000 +
        parseInt(match[3]) * 1000 +
        parseInt(match[4]);

      const endMs =
        parseInt(match[5]) * 3600000 +
        parseInt(match[6]) * 60000 +
        parseInt(match[7]) * 1000 +
        parseInt(match[8]);

      // Get text (everything after timestamp line)
      const textIdx = lines.indexOf(timestampLine);
      const textLines = lines.slice(textIdx + 1).map(l => l.trim()).filter(l => l);

      if (textLines.length > 0) {
        captions.push({
          start_ms: startMs,
          end_ms: endMs,
          text: textLines.join(" "),
        });
      }
    }
  }

  return captions;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Check if yt-dlp is available
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await runYtDlp(["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get video metadata without downloading
 */
export async function getVideoInfo(urlOrId: string): Promise<YouTubeVideoInfo> {
  const videoId = extractVideoId(urlOrId) || urlOrId;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const output = await runYtDlp([
    "--dump-json",
    "--no-download",
    url,
  ]);

  const info = JSON.parse(output);

  // Get available subtitle languages
  const subtitles = info.subtitles || {};
  const automaticCaptions = info.automatic_captions || {};
  const allCaptions = { ...subtitles, ...automaticCaptions };

  return {
    id: info.id,
    title: info.title,
    channel: info.channel || info.uploader,
    channel_id: info.channel_id || info.uploader_id,
    description: info.description || "",
    duration_seconds: info.duration || 0,
    upload_date: info.upload_date || "",
    view_count: info.view_count || 0,
    thumbnail: info.thumbnail || "",
    url: info.webpage_url || url,
    has_captions: Object.keys(allCaptions).length > 0,
    caption_languages: Object.keys(allCaptions),
  };
}

/**
 * Download captions for a video
 */
export async function downloadCaptions(
  urlOrId: string,
  options: { language?: string; cache_dir?: string; force?: boolean } = {}
): Promise<{ captions: YouTubeCaption[]; source: "auto" | "manual"; language: string } | null> {
  const videoId = extractVideoId(urlOrId) || urlOrId;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const cacheDir = getCacheDir(options.cache_dir);
  const lang = options.language || "en";

  // Check cache
  const cacheFile = join(cacheDir, `${videoId}.${lang}.json`);
  if (!options.force && existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
    return cached;
  }

  // Create temp directory for downloads
  const tempDir = join(cacheDir, "temp", videoId);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Try to download manual subtitles first, then auto-generated
    const subtitleFile = join(tempDir, `${videoId}.${lang}`);

    // First attempt: manual subtitles
    try {
      await runYtDlp([
        "--write-sub",
        "--sub-lang", lang,
        "--sub-format", "vtt",
        "--skip-download",
        "-o", join(tempDir, "%(id)s"),
        url,
      ]);
    } catch {
      // Manual subs might not exist, that's ok
    }

    // Check if we got manual subs
    let captionFile: string | null = null;
    let source: "auto" | "manual" = "manual";

    const files = readdirSync(tempDir);
    const manualSub = files.find(f => f.endsWith(`.${lang}.vtt`) && !f.includes(".auto."));

    if (manualSub) {
      captionFile = join(tempDir, manualSub);
    } else {
      // Try auto-generated captions
      try {
        await runYtDlp([
          "--write-auto-sub",
          "--sub-lang", lang,
          "--sub-format", "vtt",
          "--skip-download",
          "-o", join(tempDir, "%(id)s"),
          url,
        ]);

        const filesAfter = readdirSync(tempDir);
        const autoSub = filesAfter.find(f => f.endsWith(`.vtt`));
        if (autoSub) {
          captionFile = join(tempDir, autoSub);
          source = "auto";
        }
      } catch {
        // No captions available
      }
    }

    if (!captionFile || !existsSync(captionFile)) {
      return null;
    }

    // Parse the VTT file
    const content = readFileSync(captionFile, "utf-8");
    const captions = parseVTT(content);

    const result = { captions, source, language: lang };

    // Cache the result
    writeFileSync(cacheFile, JSON.stringify(result, null, 2));

    // Clean up temp files
    for (const f of readdirSync(tempDir)) {
      unlinkSync(join(tempDir, f));
    }

    return result;
  } catch (error) {
    // Clean up on error
    try {
      for (const f of readdirSync(tempDir)) {
        unlinkSync(join(tempDir, f));
      }
    } catch {}

    throw error;
  }
}

/**
 * Download audio for Whisper transcription
 */
export async function downloadAudio(
  urlOrId: string,
  options: { cache_dir?: string; force?: boolean } = {}
): Promise<string> {
  const videoId = extractVideoId(urlOrId) || urlOrId;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const cacheDir = getCacheDir(options.cache_dir);

  const audioFile = join(cacheDir, `${videoId}.mp3`);

  // Check cache
  if (!options.force && existsSync(audioFile)) {
    return audioFile;
  }

  // Download audio
  await runYtDlp([
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "-o", join(cacheDir, "%(id)s.%(ext)s"),
    url,
  ]);

  if (!existsSync(audioFile)) {
    throw new Error(`Failed to download audio for ${videoId}`);
  }

  return audioFile;
}

/**
 * Full ingestion: get video info + transcript (captions or whisper)
 */
export async function ingestVideo(
  urlOrId: string,
  options: IngestOptions = { mode: "auto" }
): Promise<YouTubeTranscript> {
  const videoId = extractVideoId(urlOrId) || urlOrId;
  const lang = options.language || "en";

  // Get video info
  const video = await getVideoInfo(videoId);

  // Try captions first if mode is auto or captions
  if (options.mode === "auto" || options.mode === "captions") {
    const captionResult = await downloadCaptions(videoId, {
      language: lang,
      cache_dir: options.cache_dir,
      force: options.force,
    });

    if (captionResult && captionResult.captions.length > 0) {
      return {
        video,
        captions: captionResult.captions,
        source: captionResult.source,
        language: captionResult.language,
      };
    }

    if (options.mode === "captions") {
      throw new Error(`No captions available for video ${videoId}`);
    }
  }

  // Fall back to or use Whisper
  if (options.mode === "auto" || options.mode === "whisper") {
    // Download audio
    const audioPath = await downloadAudio(videoId, {
      cache_dir: options.cache_dir,
      force: options.force,
    });

    // Import the transcription factory dynamically to avoid circular deps
    const { transcriptionFactory } = await import("../transcription/index.js");
    const backend = transcriptionFactory.create("whisper");

    const available = await backend.isAvailable();
    if (!available) {
      throw new Error("Whisper backend not available");
    }

    const result = await backend.transcribe(
      { type: "file", path: audioPath },
      { language: lang, model: options.whisper_model || "base" }
    );

    return {
      video,
      captions: result.utterances.map(u => ({
        start_ms: u.start_ms,
        end_ms: u.end_ms,
        text: u.text,
      })),
      source: "whisper",
      language: result.language || lang,
    };
  }

  throw new Error(`Unsupported mode: ${options.mode}`);
}

/**
 * List videos from a channel
 */
export async function listChannelVideos(
  channelUrlOrHandle: string,
  options: { limit?: number; sort?: "date" | "views" } = {}
): Promise<ChannelVideo[]> {
  const limit = options.limit || 50;

  // Normalize channel URL
  let channelUrl = channelUrlOrHandle;
  if (!channelUrl.startsWith("http")) {
    // Assume it's a handle
    channelUrl = `https://www.youtube.com/@${channelUrl.replace("@", "")}`;
  }

  // Use playlist URL for channel videos (more reliable)
  const channelInfo = extractChannelId(channelUrl);
  if (!channelInfo) {
    // Try as-is
    channelUrl = channelUrl + "/videos";
  }

  const output = await runYtDlp([
    "--flat-playlist",
    "--dump-json",
    "--playlist-end", String(limit),
    channelUrl + "/videos",
  ]);

  const videos: ChannelVideo[] = [];

  for (const line of output.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const info = JSON.parse(line);
      videos.push({
        id: info.id,
        title: info.title,
        upload_date: info.upload_date || "",
        duration_seconds: info.duration || 0,
        view_count: info.view_count || 0,
      });
    } catch {
      // Skip malformed lines
    }
  }

  return videos;
}

/**
 * List videos from a playlist
 */
export async function listPlaylistVideos(
  playlistUrl: string,
  options: { limit?: number } = {}
): Promise<ChannelVideo[]> {
  const limit = options.limit || 100;

  const output = await runYtDlp([
    "--flat-playlist",
    "--dump-json",
    "--playlist-end", String(limit),
    playlistUrl,
  ]);

  const videos: ChannelVideo[] = [];

  for (const line of output.trim().split("\n")) {
    if (!line.trim()) continue;
    try {
      const info = JSON.parse(line);
      videos.push({
        id: info.id,
        title: info.title,
        upload_date: info.upload_date || "",
        duration_seconds: info.duration || 0,
        view_count: info.view_count || 0,
      });
    } catch {
      // Skip malformed lines
    }
  }

  return videos;
}

/**
 * Batch ingest multiple videos
 */
export async function* batchIngest(
  videoIds: string[],
  options: IngestOptions = { mode: "auto" }
): AsyncGenerator<{ id: string; result?: YouTubeTranscript; error?: string }> {
  for (const id of videoIds) {
    try {
      const result = await ingestVideo(id, options);
      yield { id, result };
    } catch (error) {
      yield {
        id,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Get cached transcript if available
 */
export function getCachedTranscript(
  videoId: string,
  options: { cache_dir?: string; language?: string } = {}
): YouTubeCaption[] | null {
  const cacheDir = getCacheDir(options.cache_dir);
  const lang = options.language || "en";
  const cacheFile = join(cacheDir, `${videoId}.${lang}.json`);

  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
      return cached.captions;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Clear cache for a video or all videos
 */
export function clearCache(videoId?: string, options: { cache_dir?: string } = {}): number {
  const cacheDir = getCacheDir(options.cache_dir);
  let cleared = 0;

  if (videoId) {
    // Clear specific video
    const files = readdirSync(cacheDir);
    for (const f of files) {
      if (f.startsWith(videoId)) {
        unlinkSync(join(cacheDir, f));
        cleared++;
      }
    }
  } else {
    // Clear all
    const files = readdirSync(cacheDir);
    for (const f of files) {
      if (f.endsWith(".json") || f.endsWith(".mp3")) {
        unlinkSync(join(cacheDir, f));
        cleared++;
      }
    }
  }

  return cleared;
}
