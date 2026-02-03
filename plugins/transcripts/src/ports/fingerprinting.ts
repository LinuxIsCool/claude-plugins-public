/**
 * Voice Fingerprinting Port
 *
 * Interface for voice embedding and speaker identification services.
 * Enables cross-transcript speaker recognition.
 */

import type { AudioSegment } from "../domain/values/media-source.js";
import type { VoiceEmbedding, SpeakerMatchResult, SpeakerID } from "../domain/entities/speaker.js";

/**
 * Fingerprinting capabilities
 */
export interface FingerprintingCapabilities {
  // Model info
  model_name: string;
  embedding_dimension: number;  // Vector size (e.g., 192, 512)

  // Features
  supports_batching: boolean;   // Can process multiple segments at once
  supports_streaming: boolean;  // Can fingerprint live audio

  // Quality
  min_segment_duration_ms: number;  // Minimum audio for reliable embedding
  optimal_segment_duration_ms: number;

  // Performance
  avg_processing_time_ms?: number;  // Typical processing time per segment
}

/**
 * Fingerprinting result
 */
export interface FingerprintResult {
  embedding: VoiceEmbedding;
  quality_score: number;        // 0-1, how reliable is this embedding
  duration_ms: number;          // Audio duration used
  processing_time_ms: number;
}

/**
 * Speaker match candidate
 */
export interface MatchCandidate {
  speaker_id: SpeakerID;
  embedding: VoiceEmbedding;
  name?: string;
}

/**
 * Distance metrics for embedding comparison
 */
export type DistanceMetric = "cosine" | "euclidean" | "dot_product";

/**
 * Match options
 */
export interface MatchOptions {
  threshold?: number;           // Minimum similarity for a match (0-1)
  max_results?: number;         // Maximum matches to return
  metric?: DistanceMetric;      // Distance metric to use
}

/**
 * Voice Fingerprinting Port Interface
 */
export interface FingerprintingPort {
  /**
   * Get backend capabilities
   */
  capabilities(): FingerprintingCapabilities;

  /**
   * Get backend name
   */
  name(): string;

  /**
   * Check availability
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate voice embedding from audio segment
   *
   * @param segment Audio segment to fingerprint
   * @returns Fingerprint result with embedding
   */
  fingerprint(segment: AudioSegment): Promise<FingerprintResult>;

  /**
   * Generate embeddings for multiple segments (batch)
   *
   * @param segments Audio segments
   * @returns Array of fingerprint results
   */
  fingerprintBatch?(segments: AudioSegment[]): Promise<FingerprintResult[]>;

  /**
   * Match an embedding against known speakers
   *
   * @param embedding Voice embedding to match
   * @param candidates Known speaker embeddings
   * @param options Match options
   * @returns Ranked match results
   */
  match(
    embedding: VoiceEmbedding,
    candidates: MatchCandidate[],
    options?: MatchOptions
  ): Promise<SpeakerMatchResult[]>;

  /**
   * Compute distance between two embeddings
   *
   * @param a First embedding
   * @param b Second embedding
   * @param metric Distance metric
   * @returns Distance value (interpretation depends on metric)
   */
  distance(
    a: VoiceEmbedding,
    b: VoiceEmbedding,
    metric?: DistanceMetric
  ): number;

  /**
   * Compute similarity between two embeddings (0-1)
   */
  similarity(a: VoiceEmbedding, b: VoiceEmbedding): number;
}

/**
 * Factory for fingerprinting backends
 */
export interface FingerprintingBackendFactory {
  create(name: string, config?: Record<string, unknown>): FingerprintingPort;
  list(): string[];
  default(): FingerprintingPort;
}
