/**
 * Speaker Entity
 *
 * Represents a voice identity that can be recognized across transcripts.
 * Follows the Account pattern from the messages plugin for interoperability.
 *
 * Key concepts:
 * - Voice fingerprint: Embedding vector that uniquely identifies a voice
 * - Speaker profile: Accumulated metadata about a recognized speaker
 * - Cross-transcript recognition: Same speaker identified in multiple recordings
 */

/**
 * Speaker identifier
 * Format: "spk_" + base58(short_hash)
 */
export type SpeakerID = string;

/**
 * Voice embedding vector
 * Typically 192-512 dimensional float array from voice fingerprinting models
 */
export type VoiceEmbedding = Float32Array;

/**
 * Reference to a speaker (used in utterances)
 */
export interface SpeakerRef {
  id: SpeakerID;
  name?: string;                // Display name at time of reference
  confidence?: number;          // How confident in this attribution (0-1)
}

/**
 * Voice fingerprint metadata
 */
export interface VoiceFingerprint {
  embedding: VoiceEmbedding;    // The actual voice embedding
  model: string;                // Model that generated it (e.g., "pyannote-embedding")
  created_at: number;           // When this fingerprint was created
  sample_duration_ms: number;   // How much audio was used
  quality_score?: number;       // Quality of the embedding (0-1)
}

/**
 * Link to an external identity (for messages plugin interop)
 */
export interface SpeakerIdentity {
  platform: string;             // Platform name (messages, telegram, etc.)
  external_id: string;          // ID in that platform
  handle?: string;              // Display handle in that platform
  verified?: boolean;           // Is this link verified?
  linked_at: number;            // When the link was established
}

/**
 * Facts known about a speaker
 */
export interface SpeakerFact {
  key: string;                  // Fact type (e.g., "occupation", "organization")
  value: string;                // Fact value
  source_transcript_id?: string; // Where this fact was learned
  confidence?: number;          // How confident in this fact
  created_at: number;
}

/**
 * Speaker statistics
 */
export interface SpeakerStats {
  transcript_count: number;     // Number of transcripts featuring this speaker
  utterance_count: number;      // Total utterances attributed
  total_speaking_time_ms: number; // Total speaking duration
  first_appearance?: number;    // Timestamp of first transcript
  last_appearance?: number;     // Timestamp of most recent transcript
}

/**
 * Full speaker profile
 */
export interface Speaker {
  // === Identity ===
  id: SpeakerID;

  // === Display ===
  name: string;                 // Primary display name
  aliases?: string[];           // Alternative names
  avatar?: string;              // Emoji or image path

  // === Voice Identity ===
  fingerprints: VoiceFingerprint[];  // Voice embeddings (may have multiple)
  primary_fingerprint_index?: number; // Which fingerprint to use for matching

  // === External Links ===
  identities: SpeakerIdentity[]; // Links to other platforms
  messages_account_id?: string;  // Direct link to messages plugin account

  // === Knowledge ===
  facts: SpeakerFact[];         // Known facts about this speaker
  description?: string;         // Free-form description

  // === Statistics ===
  stats: SpeakerStats;

  // === Temporal ===
  created_at: number;
  updated_at: number;

  // === Metadata ===
  tags?: [string, string][];
}

/**
 * Input for creating a speaker
 */
export type SpeakerInput = Omit<Speaker, "id" | "created_at" | "updated_at" | "stats"> & {
  stats?: Partial<SpeakerStats>;
};

/**
 * Speaker summary for listings
 */
export interface SpeakerSummary {
  id: SpeakerID;
  name: string;
  avatar?: string;
  transcript_count: number;
  has_fingerprint: boolean;
  linked_platforms: string[];
}

/**
 * Result of speaker matching
 */
export interface SpeakerMatchResult {
  speaker_id: SpeakerID;
  confidence: number;           // Match confidence (0-1)
  distance?: number;            // Embedding distance
  method: "fingerprint" | "name" | "manual";
}
