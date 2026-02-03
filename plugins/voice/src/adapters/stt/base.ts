/**
 * Base STT Adapter
 *
 * Shared utilities and base implementation for STT adapters.
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type {
  STTPort,
  STTCapabilities,
  STTOptions,
  STTResult,
  AudioInput,
  StreamingSTTEvent,
  STTProgressCallback,
} from "../../ports/stt.js";

/**
 * Get temp directory for STT audio files
 */
function ensureTempDir(): string {
  const tempDir = join(tmpdir(), "claude-voice", "stt");
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Get temp file path for audio
 */
export function getTempAudioPath(format: string = "wav"): string {
  const tempDir = ensureTempDir();
  return join(tempDir, `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${format}`);
}

/**
 * Clean up a temp file (non-blocking)
 */
export function cleanupTempFile(path: string): void {
  try {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // Ignore cleanup errors - file may already be deleted
  }
}

/**
 * Write buffer to temp file
 */
export function writeToTempFile(data: Buffer, format: string = "wav"): string {
  const tempPath = getTempAudioPath(format);
  writeFileSync(tempPath, data);
  return tempPath;
}

/**
 * Download audio from URL to temp file
 */
export async function downloadToTempFile(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Detect format from Content-Type or URL
  const contentType = response.headers.get("content-type") || "";
  let format = "wav";
  if (contentType.includes("mp3") || url.endsWith(".mp3")) {
    format = "mp3";
  } else if (contentType.includes("ogg") || url.endsWith(".ogg")) {
    format = "ogg";
  } else if (contentType.includes("flac") || url.endsWith(".flac")) {
    format = "flac";
  }

  return writeToTempFile(buffer, format);
}

/**
 * Accumulate async stream to buffer, then write to temp file
 */
export async function streamToTempFile(
  stream: AsyncIterable<Buffer>,
  format: string = "wav"
): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  return writeToTempFile(buffer, format);
}

/**
 * Convert AudioInput to a file path (creates temp file if needed)
 * Returns [path, needsCleanup] - cleanup true if temp file was created
 *
 * Note: For buffer and stream inputs, the audio data is written directly
 * to a temp file. Whisper can handle many audio formats (WAV, MP3, FLAC, etc.)
 * but the file extension is used for format detection. For best results,
 * provide audio in WAV format or use file/URL inputs for other formats.
 */
export async function audioInputToFile(input: AudioInput): Promise<[string, boolean]> {
  switch (input.type) {
    case "file":
      // Use file directly - no cleanup needed
      if (!existsSync(input.path)) {
        throw new Error(`Audio file not found: ${input.path}`);
      }
      return [input.path, false];

    case "buffer":
      // Write buffer to temp file
      // Use provided format or default to wav
      const bufferPath = writeToTempFile(input.data, input.format);
      return [bufferPath, true];

    case "url":
      // Download to temp file (format detected from content-type/URL)
      const urlPath = await downloadToTempFile(input.url);
      return [urlPath, true];

    case "stream":
      // Accumulate stream to temp file (assumes WAV format)
      // For other formats, use buffer input with explicit format
      const streamPath = await streamToTempFile(input.stream);
      return [streamPath, true];

    default:
      throw new Error(`Unsupported audio input type: ${(input as { type: string }).type || "unknown"}`);
  }
}

/**
 * Base STT adapter with common functionality
 */
export abstract class BaseSTTAdapter implements STTPort {
  protected config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  abstract name(): string;
  abstract capabilities(): STTCapabilities;
  abstract isAvailable(): Promise<boolean>;
  abstract transcribe(
    input: AudioInput,
    options?: STTOptions,
    onProgress?: STTProgressCallback
  ): Promise<STTResult>;

  /**
   * Streaming transcription (optional - override in subclass)
   */
  transcribeStream?(
    input: AudioInput,
    options?: STTOptions
  ): AsyncGenerator<StreamingSTTEvent>;
}
