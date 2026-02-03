/**
 * Speaker Diarization Port
 *
 * Interface for speaker diarization services - separating audio
 * into segments by speaker ("who spoke when").
 */

import type { AudioInput } from "../domain/values/media-source.js";

/**
 * Diarization capabilities
 */
export interface DiarizationCapabilities {
  // Speaker limits
  max_speakers?: number;        // Maximum speakers it can detect
  min_speakers?: number;        // Minimum (usually 1)

  // Features
  overlapping_speech: boolean;  // Can detect overlapping speech
  speaker_embedding: boolean;   // Provides speaker embeddings

  // Quality
  min_segment_duration_ms: number;

  // Performance
  supports_streaming: boolean;
  supports_batching: boolean;
}

/**
 * A diarization segment - who spoke when
 */
export interface DiarizationSegment {
  speaker_label: string;        // "SPEAKER_00", "SPEAKER_01", etc.
  start_ms: number;
  end_ms: number;
  confidence?: number;
}

/**
 * Diarization result
 */
export interface DiarizationResult {
  segments: DiarizationSegment[];
  speaker_count: number;
  speaker_labels: string[];     // All unique speaker labels
  duration_ms: number;
  processing_time_ms: number;

  /**
   * Speaker embeddings (256-dimensional vectors from pyannote).
   * Used for voice fingerprinting and cross-meeting speaker identification.
   * Key: speaker label (e.g., "SPEAKER_00"), Value: embedding vector
   */
  embeddings?: Record<string, Float32Array>;
}

/**
 * Diarization options
 */
export interface DiarizationOptions {
  num_speakers?: number;        // Known number of speakers (improves accuracy)
  min_speakers?: number;        // Minimum expected speakers
  max_speakers?: number;        // Maximum expected speakers
  min_segment_duration_ms?: number;
}

/**
 * Streaming diarization event
 */
export type DiarizationStreamEvent =
  | { type: "segment"; segment: DiarizationSegment }
  | { type: "speaker_detected"; speaker_label: string }
  | { type: "completed"; result: DiarizationResult }
  | { type: "error"; error: Error };

/**
 * Speaker Diarization Port Interface
 */
export interface DiarizationPort {
  /**
   * Get capabilities
   */
  capabilities(): DiarizationCapabilities;

  /**
   * Get backend name
   */
  name(): string;

  /**
   * Check availability
   */
  isAvailable(): Promise<boolean>;

  /**
   * Perform speaker diarization
   *
   * @param input Audio source
   * @param options Diarization options
   * @returns Diarization result with speaker segments
   */
  diarize(
    input: AudioInput,
    options?: DiarizationOptions
  ): Promise<DiarizationResult>;

  /**
   * Stream diarization events
   */
  diarizeStream?(
    input: AudioInput,
    options?: DiarizationOptions
  ): AsyncGenerator<DiarizationStreamEvent>;
}

/**
 * Factory for diarization backends
 */
export interface DiarizationBackendFactory {
  create(name: string, config?: Record<string, unknown>): DiarizationPort;
  list(): string[];
  default(): DiarizationPort;
}
