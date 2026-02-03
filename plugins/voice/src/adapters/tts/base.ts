/**
 * Base TTS Adapter
 *
 * Shared utilities and base implementation for TTS adapters.
 * Supports both legacy temp-file playback and new AudioBufferManager streaming.
 */

import { spawn, execSync } from "child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { TTSPort, TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";
import type { AudioBufferManager } from "../audio/manager.js";
import type { PlaybackStream } from "../../ports/audio-buffer.js";

/**
 * Generate silence buffer (MP3 format)
 * Creates a short silence to prevent audio clipping at start
 */
function generateSilencePadding(durationMs: number = 100): Buffer {
  // For MP3, we prepend a very short silence using ffmpeg if available
  // This is a minimal valid MP3 frame (silence)
  // Alternatively, we handle this in the playback command
  return Buffer.alloc(0); // We'll handle padding via playback options instead
}

/**
 * Get temp file path for audio
 */
function getTempAudioPath(format: string): string {
  const tempDir = join(tmpdir(), "claude-voice");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  return join(tempDir, `audio-${Date.now()}.${format}`);
}

/**
 * Global audio lock file to prevent overlapping playback across all Claude instances
 */
const AUDIO_LOCK_FILE = "/tmp/claude-voice-audio.lock";

/**
 * Kill any currently playing audio to prevent overlap
 */
async function killCurrentAudio(): Promise<void> {
  try {
    // Kill any running mpv/ffplay processes playing our temp audio files
    // The temp files are in /tmp/claude-voice/audio-*.mp3
    execSync("pkill -f 'mpv.*/tmp/claude-voice/audio-' 2>/dev/null || true", { stdio: "ignore" });
    execSync("pkill -f 'ffplay.*/tmp/claude-voice/audio-' 2>/dev/null || true", { stdio: "ignore" });
    execSync("pkill -f 'paplay.*/tmp/claude-voice/audio-' 2>/dev/null || true", { stdio: "ignore" });
  } catch {
    // Ignore errors - processes may not exist
  }
}

/**
 * Acquire global audio playback lock
 * Returns true if lock acquired (and previous audio killed), false if should skip
 */
async function acquireAudioLock(): Promise<boolean> {
  try {
    // Check if lock exists and is recent
    if (existsSync(AUDIO_LOCK_FILE)) {
      const stat = await import("fs").then(fs => fs.statSync(AUDIO_LOCK_FILE));
      const ageMs = Date.now() - stat.mtimeMs;

      if (ageMs < 60000) {
        // Lock is recent - kill current audio and take over
        await killCurrentAudio();
      }
      // Remove stale lock
      unlinkSync(AUDIO_LOCK_FILE);
    }

    // Create new lock with our PID
    writeFileSync(AUDIO_LOCK_FILE, `${process.pid}\n${Date.now()}`);
    return true;
  } catch {
    return true; // Proceed anyway on error
  }
}

/**
 * Release global audio playback lock
 */
function releaseAudioLock(): void {
  try {
    unlinkSync(AUDIO_LOCK_FILE);
  } catch {
    // Ignore - file may not exist
  }
}

// ============================================================================
// AudioBufferManager Integration
// ============================================================================

/**
 * Singleton AudioBufferManager instance.
 * Lazy-initialized on first use.
 */
let audioManager: AudioBufferManager | null = null;
let audioManagerInitPromise: Promise<AudioBufferManager> | null = null;

/**
 * Audio playback mode configuration.
 */
export type PlaybackMode = "auto" | "stream" | "legacy";

/**
 * Current playback mode.
 * - "auto": Try stream first, fall back to legacy
 * - "stream": Use AudioBufferManager streaming only
 * - "legacy": Use temp file + subprocess only
 */
// Default to legacy mode - streaming doesn't handle encoded formats (mp3/wav) properly yet
// The subprocess adapter pipes encoded data to pw-play which expects raw PCM
let currentPlaybackMode: PlaybackMode = "legacy";

/**
 * Set the playback mode.
 */
export function setPlaybackMode(mode: PlaybackMode): void {
  currentPlaybackMode = mode;
}

/**
 * Get the current playback mode.
 */
export function getPlaybackMode(): PlaybackMode {
  return currentPlaybackMode;
}

/**
 * Get or initialize the AudioBufferManager singleton.
 */
async function getAudioManager(): Promise<AudioBufferManager | null> {
  if (audioManager) {
    return audioManager;
  }

  if (audioManagerInitPromise) {
    return audioManagerInitPromise;
  }

  audioManagerInitPromise = (async () => {
    try {
      // Dynamic import to avoid circular dependencies
      const { getAudioBufferManager } = await import("../audio/manager.js");
      audioManager = await getAudioBufferManager();
      return audioManager;
    } catch (err) {
      console.warn("[base.ts] AudioBufferManager not available:", err);
      return null;
    }
  })();

  return audioManagerInitPromise;
}

/**
 * Active playback stream for current audio.
 * Used to stop/interrupt when new audio starts.
 */
let activePlaybackStream: PlaybackStream | null = null;

/**
 * Play audio using AudioBufferManager streaming.
 * Returns true if successful, false if streaming not available.
 */
async function playAudioBufferStream(audio: Buffer, format: string): Promise<boolean> {
  const manager = await getAudioManager();
  if (!manager) {
    return false;
  }

  try {
    // Stop any currently playing audio
    if (activePlaybackStream) {
      try {
        await activePlaybackStream.stop();
        await activePlaybackStream.close();
      } catch {
        // Ignore errors stopping previous stream
      }
      activePlaybackStream = null;
    }

    // Create a new playback stream with prebuffering
    const stream = await manager.createPlaybackStream({
      name: "tts-playback",
      prebufferMs: 50,  // Prevent first-syllable clipping
      priority: 80,    // High priority for TTS
    });

    activePlaybackStream = stream;

    // For encoded formats, we need to decode to PCM first
    // The subprocess adapter handles this via ffmpeg piping
    if (format === "mp3" || format === "wav" || format === "ogg") {
      // Write encoded data - the stream handles conversion
      await stream.prebuffer(audio);
      await stream.start();
      await stream.drain();
    } else {
      // Raw PCM - write directly
      await stream.prebuffer(audio);
      await stream.start();
      await stream.drain();
    }

    await stream.close();
    activePlaybackStream = null;

    return true;
  } catch (err) {
    console.warn("[base.ts] Streaming playback failed:", err);
    return false;
  }
}

/**
 * Play audio using system audio player.
 *
 * Playback modes:
 * - "auto" (default): Try AudioBufferManager streaming first, fall back to legacy
 * - "stream": Use AudioBufferManager streaming only (fails if unavailable)
 * - "legacy": Use temp file + subprocess only (original behavior)
 *
 * @param audio - Audio buffer to play
 * @param format - Audio format (mp3, wav, pcm, etc.)
 */
export async function playAudioBuffer(audio: Buffer, format: string = "mp3"): Promise<void> {
  const mode = currentPlaybackMode;

  // Try streaming first if mode allows
  if (mode === "auto" || mode === "stream") {
    const streamSuccess = await playAudioBufferStream(audio, format);
    if (streamSuccess) {
      return;
    }
    if (mode === "stream") {
      throw new Error("Streaming playback not available and mode is 'stream'");
    }
    // Fall through to legacy mode
  }

  // Legacy temp-file based playback
  await playAudioBufferLegacy(audio, format);
}

/**
 * Legacy playback using temp file + subprocess.
 * Uses temp file approach for reliable playback without clipping.
 * Works on Linux with mpv/ffplay, macOS with afplay.
 * Includes global lock to prevent overlapping audio across Claude instances.
 */
async function playAudioBufferLegacy(audio: Buffer, format: string): Promise<void> {
  // Acquire global audio lock (kills any current playback)
  await acquireAudioLock();

  // Write to temp file to avoid stdin buffering issues that cause clipping
  const tempPath = getTempAudioPath(format);

  try {
    writeFileSync(tempPath, audio);

    return new Promise((resolve, reject) => {
      // Players with options optimized for smooth playback
      // mpv: --audio-buffer for pre-buffering, --demuxer-readahead-secs for read-ahead
      const players = process.platform === "darwin"
        ? [
            ["afplay", [tempPath]],
          ]
        : [
            // mpv with audio buffer to prevent clipping
            ["mpv", [
              "--no-terminal",
              "--no-video",
              "--audio-buffer=0.2",           // 200ms audio buffer
              "--demuxer-readahead-secs=0.5", // Read ahead
              "--hr-seek=no",                 // Disable seeking overhead
              tempPath
            ]],
            // ffplay with buffer options
            ["ffplay", [
              "-nodisp",
              "-autoexit",
              "-infbuf",                      // Infinite buffer (read all before playing)
              "-probesize", "32",             // Faster probe
              tempPath
            ]],
            // paplay for raw PCM (won't work for MP3)
            ["paplay", [tempPath]],
          ];

      const tryPlayer = (index: number) => {
        if (index >= players.length) {
          // Clean up and reject
          try { unlinkSync(tempPath); } catch {}
          releaseAudioLock();
          reject(new Error("No audio player available"));
          return;
        }

        const [cmd, args] = players[index];
        const proc = spawn(cmd, args as string[], { stdio: ["ignore", "ignore", "ignore"] });

        proc.on("error", () => {
          tryPlayer(index + 1);
        });

        proc.on("close", (code) => {
          // Clean up temp file and release lock
          try { unlinkSync(tempPath); } catch {}
          releaseAudioLock();

          if (code === 0) {
            resolve();
          } else {
            tryPlayer(index + 1);
          }
        });
      };

      tryPlayer(0);
    });
  } catch (err) {
    // Clean up on error
    try { unlinkSync(tempPath); } catch {}
    releaseAudioLock();
    throw err;
  }
}

/**
 * Get API key from environment
 */
export function getEnvVar(name: string): string | undefined {
  return process.env[name];
}

/**
 * Base TTS adapter with common functionality
 */
export abstract class BaseTTSAdapter implements TTSPort {
  protected config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  abstract name(): string;
  abstract capabilities(): TTSCapabilities;
  abstract isAvailable(): Promise<boolean>;
  abstract synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  abstract listVoices(): Promise<VoiceInfo[]>;

  async play(audio: Buffer): Promise<void> {
    const caps = this.capabilities();
    const format = caps.supportedFormats[0] || "mp3";
    await playAudioBuffer(audio, format);
  }

  /**
   * Speak text using this adapter (convenience method)
   */
  async speak(text: string, options: TTSOptions): Promise<void> {
    const result = await this.synthesize(text, options);
    await this.play(result.audio);
  }
}
