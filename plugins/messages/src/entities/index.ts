/**
 * Entity Extraction Module
 *
 * Extracts people, dates, questions, and keywords from messages
 * for priority scoring and inbox management.
 */

export { EntityStore, createEntityStore } from "./store";
export { EntityExtractor, createExtractor } from "./extractor";
export type {
  Entity,
  EntityMention,
  EntityType,
  ExtractionResult,
  ExtractedEntity,
  ExtractionProgress,
  EntityStats,
  BatchExtractionOptions,
  BatchProgress,
} from "./types";
