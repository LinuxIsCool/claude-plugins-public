/**
 * Media Source Value Object
 *
 * Describes the source of audio/video for transcription.
 * Immutable value object containing all source metadata.
 */

/**
 * Supported media types
 */
export type MediaType = "audio" | "video";

/**
 * Supported audio formats
 */
export type AudioFormat =
  | "wav"
  | "mp3"
  | "m4a"
  | "flac"
  | "ogg"
  | "webm"
  | "aac"
  | "wma"
  | "unknown";

/**
 * Input mode - file or stream
 */
export type InputMode = "file" | "stream" | "url";

/**
 * Audio metadata
 */
export interface AudioMetadata {
  format: AudioFormat;
  sample_rate?: number;         // Hz
  channels?: number;            // 1 = mono, 2 = stereo
  bit_depth?: number;           // 16, 24, 32
  bitrate?: number;             // kbps for compressed formats
  duration_ms: number;          // Total duration
  file_size_bytes?: number;
}

/**
 * Source platform information
 */
export interface SourcePlatform {
  name: string;                 // Platform name (youtube, zoom, podcast, etc.)
  url?: string;                 // Original URL if applicable
  platform_id?: string;         // ID in the source platform
  channel?: string;             // Channel/account name
  episode?: string;             // Episode number/title for podcasts
}

/**
 * Media source value object
 */
export interface MediaSource {
  // === Input ===
  mode: InputMode;
  path?: string;                // File path for file mode
  url?: string;                 // URL for url/stream mode
  stream_id?: string;           // Stream identifier for live streams

  // === File Info ===
  filename?: string;            // Original filename
  checksum?: string;            // SHA-256 of source file

  // === Media Metadata ===
  type: MediaType;
  audio: AudioMetadata;

  // === Platform ===
  platform?: SourcePlatform;

  // === Temporal ===
  recorded_at?: number;         // When the media was recorded
  uploaded_at?: number;         // When uploaded (for URLs)
}

/**
 * Input for creating a media source
 */
export interface MediaSourceInput {
  mode: InputMode;
  path?: string;
  url?: string;
  filename?: string;
  type?: MediaType;
  platform?: SourcePlatform;
  recorded_at?: number;
}

/**
 * Audio input for transcription - either file path or raw buffer
 */
export type AudioInput =
  | { type: "file"; path: string }
  | { type: "buffer"; buffer: ArrayBuffer; format: AudioFormat }
  | { type: "url"; url: string }
  | { type: "stream"; stream: ReadableStream<Uint8Array> };

/**
 * Audio segment for fingerprinting
 */
export interface AudioSegment {
  input: AudioInput;
  start_ms: number;
  end_ms: number;
}
