/**
 * Entity Extraction Port
 *
 * Interface for extracting named entities, topics, and relationships
 * from transcript text.
 */

import type { EntityType } from "../domain/entities/entity.js";

/**
 * Extraction capabilities
 */
export interface ExtractionCapabilities {
  // Entity types supported
  entity_types: EntityType[];

  // Features
  relationship_extraction: boolean;
  topic_extraction: boolean;
  sentiment_analysis: boolean;
  summarization: boolean;

  // Language support
  languages: string[];

  // Model info
  model_name?: string;
}

/**
 * Raw entity extraction (before normalization)
 */
export interface ExtractedEntity {
  text: string;                 // The mention text
  type: EntityType;
  start_offset: number;         // Character offset in source text
  end_offset: number;
  confidence: number;
  normalized_name?: string;     // Canonical form
}

/**
 * Extracted relationship
 */
export interface ExtractedRelationship {
  subject: ExtractedEntity;
  predicate: string;            // Relationship type
  object: ExtractedEntity;
  confidence: number;
  evidence?: string;            // Supporting text
}

/**
 * Extracted topic
 */
export interface ExtractedTopic {
  name: string;
  confidence: number;
  keywords: string[];
  representative_sentences?: string[];
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  topics: ExtractedTopic[];
  summary?: string;
  sentiment?: {
    score: number;              // -1 to 1
    label: "positive" | "negative" | "neutral";
  };
  processing_time_ms: number;
}

/**
 * Extraction options
 */
export interface ExtractionOptions {
  // What to extract
  extract_entities?: boolean;
  extract_relationships?: boolean;
  extract_topics?: boolean;
  extract_summary?: boolean;
  extract_sentiment?: boolean;

  // Entity filtering
  entity_types?: EntityType[];  // Only extract these types
  min_confidence?: number;      // Minimum confidence threshold

  // Topic extraction
  max_topics?: number;

  // Summary
  max_summary_length?: number;

  // Language
  language?: string;
}

/**
 * Context for extraction (improves accuracy)
 */
export interface ExtractionContext {
  speaker_names?: string[];     // Known speaker names
  known_entities?: string[];    // Known entity names
  domain?: string;              // Domain hint (e.g., "technology", "medicine")
  previous_text?: string;       // Previous context for better extraction
}

/**
 * Entity Extraction Port Interface
 */
export interface ExtractionPort {
  /**
   * Get capabilities
   */
  capabilities(): ExtractionCapabilities;

  /**
   * Get backend name
   */
  name(): string;

  /**
   * Check availability
   */
  isAvailable(): Promise<boolean>;

  /**
   * Extract entities, relationships, and topics from text
   *
   * @param text Text to analyze
   * @param options Extraction options
   * @param context Additional context
   * @returns Extraction result
   */
  extract(
    text: string,
    options?: ExtractionOptions,
    context?: ExtractionContext
  ): Promise<ExtractionResult>;

  /**
   * Extract from multiple texts (batch)
   */
  extractBatch?(
    texts: string[],
    options?: ExtractionOptions,
    context?: ExtractionContext
  ): Promise<ExtractionResult[]>;

  /**
   * Normalize entity name to canonical form
   */
  normalizeEntity?(text: string, type: EntityType): Promise<string>;

  /**
   * Link entity to external knowledge bases
   */
  linkEntity?(entity: ExtractedEntity): Promise<{
    wikidata?: string;
    wikipedia?: string;
    [key: string]: string | undefined;
  } | null>;
}

/**
 * Factory for extraction backends
 */
export interface ExtractionBackendFactory {
  create(name: string, config?: Record<string, unknown>): ExtractionPort;
  list(): string[];
  default(): ExtractionPort;
}
