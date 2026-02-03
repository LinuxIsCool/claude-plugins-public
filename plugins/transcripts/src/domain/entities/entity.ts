/**
 * Entity - Named entities extracted from transcripts
 *
 * Represents people, organizations, locations, dates, and other
 * named entities mentioned in transcripts. Designed for knowledge
 * graph integration.
 */

/**
 * Entity identifier
 * Format: "ent_" + base58(hash(type + normalized_name))
 */
export type EntityID = string;

/**
 * Standard entity types (extensible)
 */
export type EntityType =
  | "person"
  | "organization"
  | "location"
  | "date"
  | "time"
  | "money"
  | "product"
  | "event"
  | "concept"
  | "topic"
  | "custom";

/**
 * Reference to where an entity was mentioned
 */
export interface EntityMention {
  transcript_id: string;
  utterance_id: string;
  speaker_id?: string;          // Who mentioned it
  text: string;                 // The actual mention text
  start_offset: number;         // Character offset in utterance
  end_offset: number;
  confidence: number;
  created_at: number;
}

/**
 * Relationship between entities
 */
export interface EntityRelationship {
  id: string;
  source_entity_id: EntityID;
  target_entity_id: EntityID;
  relationship_type: string;    // e.g., "works_at", "located_in", "knows"
  confidence: number;
  source_transcript_id?: string; // Where this relationship was learned
  created_at: number;
}

/**
 * Entity aggregate
 */
export interface Entity {
  // === Identity ===
  id: EntityID;
  type: EntityType;

  // === Content ===
  name: string;                 // Canonical/normalized name
  aliases?: string[];           // Alternative names
  description?: string;

  // === Mentions ===
  mentions: EntityMention[];    // Where this entity appears
  mention_count: number;        // Total mentions across all transcripts

  // === Relationships ===
  relationships: EntityRelationship[];

  // === Speaker Link ===
  speaker_id?: string;          // If this entity is a speaker

  // === External Links ===
  external_ids?: {
    wikidata?: string;
    wikipedia?: string;
    dbpedia?: string;
    [key: string]: string | undefined;
  };

  // === Temporal ===
  created_at: number;
  updated_at: number;

  // === Metadata ===
  tags?: [string, string][];
}

/**
 * Input for creating an entity
 */
export type EntityInput = Omit<Entity, "id" | "created_at" | "updated_at" | "mentions" | "relationships" | "mention_count"> & {
  mentions?: EntityMention[];
  relationships?: EntityRelationship[];
};

/**
 * Topic extracted from transcript
 */
export interface Topic {
  id: string;
  name: string;
  confidence: number;
  keywords: string[];
  transcript_ids: string[];
  created_at: number;
}
