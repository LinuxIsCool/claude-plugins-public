/**
 * Voice Activity Detection Port
 *
 * Interface for VAD backends. Detects speech presence in audio streams.
 */

import type { AudioChunk } from "./stt.js";

/**
 * Backend capabilities
 */
export interface VADCapabilities {
  streaming: boolean;           // Real-time processing
  minSpeechMs: number;          // Minimum speech duration
  minSilenceMs: number;         // Minimum silence for end of speech
  local: boolean;               // Runs locally
  models: string[];             // Available models
  defaultModel: string;
}

/**
 * VAD options
 */
export interface VADOptions {
  threshold?: number;           // 0.0 - 1.0 (speech probability threshold)
  minSpeechDurationMs?: number; // Minimum speech duration to trigger
  minSilenceDurationMs?: number; // Minimum silence to end speech
  speechPadMs?: number;         // Padding around speech segments
  model?: string;               // Model to use
}

/**
 * VAD result for a single chunk
 */
export interface VADResult {
  isSpeech: boolean;
  probability: number;          // 0.0 - 1.0
  timestampMs: number;
}

/**
 * Speech segment detected by VAD
 */
export interface SpeechSegment {
  startMs: number;
  endMs: number;
  durationMs: number;
  averageProbability: number;
}

/**
 * VAD streaming event
 */
export type VADStreamEvent =
  | { type: "speech_start"; timestampMs: number; probability: number }
  | { type: "speech_end"; segment: SpeechSegment }
  | { type: "probability"; isSpeech: boolean; probability: number; timestampMs: number }
  | { type: "error"; error: Error };

/**
 * VAD Port Interface
 *
 * All VAD backends implement this interface.
 */
export interface VADPort {
  /**
   * Get backend name/identifier
   */
  name(): string;

  /**
   * Get backend capabilities
   */
  capabilities(): VADCapabilities;

  /**
   * Check if backend is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize the VAD model
   */
  initialize(): Promise<void>;

  /**
   * Process a single audio chunk
   *
   * @param audio Audio chunk
   * @param options VAD options
   * @returns VAD result
   */
  process(audio: AudioChunk, options?: VADOptions): VADResult;

  /**
   * Process audio stream and detect speech segments
   *
   * @param audioStream Stream of audio chunks
   * @param options VAD options
   * @yields VAD events
   */
  processStream(
    audioStream: AsyncIterable<AudioChunk>,
    options?: VADOptions
  ): AsyncGenerator<VADStreamEvent>;

  /**
   * Reset internal state (for new audio stream)
   */
  reset(): void;

  /**
   * Release resources
   */
  dispose(): void;
}

/**
 * Default VAD options
 */
export const DEFAULT_VAD_OPTIONS: VADOptions = {
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 1000,
  speechPadMs: 300,
};

/**
 * Factory for creating VAD backends
 */
export interface VADBackendFactory {
  /**
   * Create a backend by name
   */
  create(name: string, config?: Record<string, unknown>): VADPort;

  /**
   * List available backends
   */
  list(): string[];

  /**
   * Get first available backend
   */
  getAvailable(): Promise<VADPort | null>;
}
