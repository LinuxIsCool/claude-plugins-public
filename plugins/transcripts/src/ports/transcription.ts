/**
 * Transcription Port
 *
 * Interface for transcription backends. Any transcription service
 * (Whisper, AssemblyAI, AWS Transcribe, etc.) implements this port.
 */

import type { AudioInput } from "../domain/values/media-source.js";
import type { Utterance, UtteranceInput } from "../domain/entities/utterance.js";

/**
 * Backend capabilities
 */
export interface TranscriptionCapabilities {
  // Language support
  languages: string[];          // Supported language codes
  auto_detect_language: boolean;

  // Features
  word_timestamps: boolean;     // Can provide word-level timing
  speaker_diarization: boolean; // Built-in speaker separation
  punctuation: boolean;         // Adds punctuation
  profanity_filter: boolean;

  // Input modes
  supports_streaming: boolean;  // Real-time transcription
  supports_files: boolean;      // File-based transcription
  supports_urls: boolean;       // URL-based transcription

  // Formats
  audio_formats: string[];      // Supported audio formats
  max_duration_ms?: number;     // Maximum audio duration

  // Quality
  models: string[];             // Available model variants
  default_model: string;
}

/**
 * Transcription options
 */
export interface TranscriptionOptions {
  // Language
  language?: string;            // Force language (ISO 639-1 code)

  // Model selection
  model?: string;               // Specific model to use

  // Features
  word_timestamps?: boolean;    // Request word-level timing
  speaker_diarization?: boolean; // Request speaker separation

  // Quality vs speed
  beam_size?: number;           // Beam search width (higher = more accurate, slower)
  temperature?: number;         // Sampling temperature

  // Filtering
  initial_prompt?: string;      // Context prompt for better accuracy
  suppress_tokens?: number[];   // Token IDs to suppress

  // Streaming
  partial_results?: boolean;    // Emit partial results during streaming
}

/**
 * Transcription result (batch mode)
 */
export interface TranscriptionResult {
  utterances: Utterance[];
  language: string;
  language_confidence?: number;
  duration_ms: number;
  processing_time_ms: number;
  model: string;
}

/**
 * Streaming transcription event
 */
export type StreamingEvent =
  | { type: "started"; session_id: string }
  | { type: "partial"; utterance: UtteranceInput }
  | { type: "final"; utterance: Utterance }
  | { type: "speaker_change"; speaker_id: string }
  | { type: "language_detected"; language: string; confidence: number }
  | { type: "error"; error: Error }
  | { type: "completed"; result: TranscriptionResult };

/**
 * Progress callback for long transcriptions
 */
export type TranscriptionProgressCallback = (progress: {
  percent: number;
  current_time_ms: number;
  total_time_ms: number;
  utterances_processed: number;
}) => void;

/**
 * Transcription Port Interface
 *
 * All transcription backends implement this interface.
 */
export interface TranscriptionPort {
  /**
   * Get backend capabilities
   */
  capabilities(): TranscriptionCapabilities;

  /**
   * Get backend name/identifier
   */
  name(): string;

  /**
   * Check if backend is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Transcribe audio (batch mode)
   *
   * @param input Audio source
   * @param options Transcription options
   * @param onProgress Optional progress callback
   * @returns Transcription result
   */
  transcribe(
    input: AudioInput,
    options?: TranscriptionOptions,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult>;

  /**
   * Transcribe audio (streaming mode)
   *
   * @param input Audio stream
   * @param options Transcription options
   * @yields Streaming events
   */
  transcribeStream?(
    input: AudioInput,
    options?: TranscriptionOptions
  ): AsyncGenerator<StreamingEvent>;
}

/**
 * Factory for creating transcription backends
 */
export interface TranscriptionBackendFactory {
  /**
   * Create a backend by name
   */
  create(name: string, config?: Record<string, unknown>): TranscriptionPort;

  /**
   * List available backends
   */
  list(): string[];

  /**
   * Get default backend
   */
  default(): TranscriptionPort;
}
