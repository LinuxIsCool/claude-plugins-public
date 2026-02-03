/**
 * Entity Types
 *
 * Type definitions for entity extraction from messages.
 * Designed for priority scoring and inbox management.
 */

/**
 * Entity categories for extraction
 */
export type EntityType =
  | "person" // Names of people mentioned
  | "date" // Dates, deadlines, temporal references
  | "question" // Questions asked (action items)
  | "keyword" // Important topics/concepts
  | "organization" // Companies, teams, groups
  | "product"; // Tools, libraries, frameworks

/**
 * Normalized entity with canonical ID
 */
export interface Entity {
  id: string; // entity_<type>_<normalized_name_hash>
  type: EntityType;
  normalized_name: string; // Canonical form ("Claude", "React", "Bob")
  first_seen: number; // Unix timestamp
  last_seen: number; // Unix timestamp
  mention_count: number; // Total occurrences
  confidence_avg: number; // Average confidence across mentions
}

/**
 * Entity occurrence within a specific message
 */
export interface EntityMention {
  entity_id: string; // FK to Entity
  message_id: string; // CID of message
  text: string; // Original text as extracted
  confidence: number; // 0.0-1.0
  context?: string; // Surrounding text snippet
  extracted_at: number; // When extraction ran
}

/**
 * Result from entity extraction
 */
export interface ExtractionResult {
  message_id: string;
  entities: ExtractedEntity[];
  processing_time_ms: number;
}

/**
 * Single extracted entity before normalization
 */
export interface ExtractedEntity {
  text: string; // Raw text as extracted
  type: EntityType;
  confidence: number; // 0.0-1.0
}

/**
 * Progress tracking for extraction state
 */
export interface ExtractionProgress {
  message_id: string;
  extracted_at: number;
  extractor: string; // "headless-claude-haiku"
  entity_count: number;
  processing_time_ms: number;
}

/**
 * Statistics for entity store
 */
export interface EntityStats {
  total_entities: number;
  total_mentions: number;
  by_type: Record<EntityType, number>;
  processed_messages: number;
  pending_messages: number;
}

/**
 * Options for batch extraction
 */
export interface BatchExtractionOptions {
  limit?: number; // Max messages to process
  batch_size?: number; // Messages per Claude call (default: 10)
  extractor?: "haiku" | "sonnet"; // Model to use
}

/**
 * Progress update during batch extraction
 */
export interface BatchProgress {
  processed: number;
  total: number;
  entities_extracted: number;
  current_message_id: string;
}
