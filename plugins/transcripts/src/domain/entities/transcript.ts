/**
 * Transcript Entity
 *
 * The aggregate root for a transcription. Contains utterances (speech segments)
 * with speaker attribution and temporal metadata.
 *
 * Design: Event-sourced entity with content-addressed ID (TID).
 */

import type { Utterance } from "./utterance.js";
import type { MediaSource } from "../values/media-source.js";

/**
 * Transcript Identifier
 * Format: "tx_" + base58(sha256(source_hash + created_at))
 */
export type TID = string;

/**
 * Transcript status in the processing pipeline
 */
export type TranscriptStatus =
  | "pending"      // Queued for processing
  | "transcribing" // Audio being transcribed
  | "diarizing"    // Speaker diarization in progress
  | "extracting"   // Entity extraction in progress
  | "complete"     // All processing finished
  | "failed";      // Processing failed

/**
 * Processing metadata
 */
export interface ProcessingInfo {
  backend: string;              // Which transcription backend was used
  model?: string;               // Model identifier (e.g., "whisper-large-v3")
  language?: string;            // Detected or specified language
  duration_ms: number;          // Processing time
  confidence?: number;          // Overall confidence score (0-1)
}

/**
 * Transcript aggregate root
 */
export interface Transcript {
  // === Identity ===
  id: TID;                      // Content-addressed identifier

  // === Source ===
  source: MediaSource;          // Audio/video source metadata
  title?: string;               // Optional human-readable title

  // === Content ===
  utterances: Utterance[];      // Speech segments with speaker attribution
  full_text?: string;           // Concatenated text (computed)

  // === Status ===
  status: TranscriptStatus;
  error?: string;               // Error message if failed

  // === Processing ===
  processing: ProcessingInfo;

  // === Temporal ===
  created_at: number;           // Unix timestamp of creation
  updated_at: number;           // Last modification
  source_created_at?: number;   // When the source media was created

  // === Metadata ===
  tags?: [string, string][];    // Key-value metadata
}

/**
 * Input for creating a new transcript
 */
export type TranscriptInput = Omit<Transcript, "id" | "created_at" | "updated_at" | "status"> & {
  status?: TranscriptStatus;
};

/**
 * Transcript summary for listings
 */
export interface TranscriptSummary {
  id: TID;
  title?: string;
  source: {
    filename?: string;
    platform?: string;
    duration_ms?: number;
  };
  speaker_count: number;
  utterance_count: number;
  status: TranscriptStatus;
  created_at: number;
}
