/**
 * Utterance Entity
 *
 * A segment of speech within a transcript, attributed to a speaker
 * with precise temporal boundaries.
 */

import type { SpeakerRef } from "./speaker.js";

/**
 * Utterance identifier
 * Format: "ut_" + incrementing index within transcript
 */
export type UtteranceID = string;

/**
 * Confidence level for various utterance attributes
 */
export interface ConfidenceScores {
  transcription?: number;  // How confident in the text (0-1)
  speaker?: number;        // How confident in speaker attribution (0-1)
  timing?: number;         // How confident in start/end times (0-1)
}

/**
 * Word-level timing information (optional, for detailed alignment)
 */
export interface WordTiming {
  word: string;
  start_ms: number;
  end_ms: number;
  confidence?: number;
}

/**
 * A single speech segment
 */
export interface Utterance {
  // === Identity ===
  id: UtteranceID;              // Unique within transcript
  index: number;                // Sequential order

  // === Speaker ===
  speaker: SpeakerRef;          // Who said this

  // === Content ===
  text: string;                 // Transcribed text
  words?: WordTiming[];         // Word-level alignment (if available)

  // === Temporal ===
  start_ms: number;             // Start time in milliseconds
  end_ms: number;               // End time in milliseconds
  duration_ms: number;          // Computed: end - start

  // === Quality ===
  confidence: ConfidenceScores;

  // === Metadata ===
  language?: string;            // Language of this segment
  is_partial?: boolean;         // True if this is a streaming partial result
}

/**
 * Input for creating an utterance
 */
export type UtteranceInput = Omit<Utterance, "id" | "duration_ms"> & {
  id?: UtteranceID;
};
