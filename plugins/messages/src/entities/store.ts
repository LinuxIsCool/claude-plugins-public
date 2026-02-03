/**
 * Entity Store
 *
 * SQLite-based storage for extracted entities.
 * Follows the pattern from search/index.ts.
 */

import { Database } from "bun:sqlite";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { getEntitiesDbPath } from "../config";
import type {
  Entity,
  EntityMention,
  EntityType,
  ExtractionProgress,
  EntityStats,
} from "./types";

/**
 * Generate entity ID from type and normalized name
 */
function generateEntityId(type: EntityType, normalizedName: string): string {
  const input = `${type}:${normalizedName.toLowerCase()}`;
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 12);
  return `entity_${type}_${hash}`;
}

/**
 * Entity Store - SQLite database for extracted entities
 */
export class EntityStore {
  private db: Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? getEntitiesDbPath();

    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Open database with cleanup on failure
    this.db = new Database(dbPath);
    try {
      this.db.exec("PRAGMA journal_mode = WAL");
      this.db.exec("PRAGMA foreign_keys = ON");

      // Initialize schema
      this.initSchema();
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  private initSchema(): void {
    // Entities table (normalized, deduplicated)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        mention_count INTEGER DEFAULT 1,
        confidence_avg REAL DEFAULT 0.7
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)`);
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(normalized_name)`
    );

    // Entity mentions (link table with context)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_mentions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        text TEXT NOT NULL,
        confidence REAL DEFAULT 0.7,
        context TEXT,
        extracted_at INTEGER NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES entities(id)
      )
    `);

    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_mentions_entity ON entity_mentions(entity_id)`
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_mentions_message ON entity_mentions(message_id)`
    );

    // Extraction progress tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS extraction_progress (
        message_id TEXT PRIMARY KEY,
        extracted_at INTEGER NOT NULL,
        extractor TEXT NOT NULL,
        entity_count INTEGER DEFAULT 0,
        processing_time_ms INTEGER
      )
    `);
  }

  /**
   * Upsert an entity (insert or update)
   */
  upsertEntity(
    type: EntityType,
    normalizedName: string,
    confidence: number,
    timestamp: number
  ): string {
    const id = generateEntityId(type, normalizedName);

    const existing = this.db
      .query("SELECT * FROM entities WHERE id = ?")
      .get(id) as Entity | null;

    if (existing) {
      // Update existing entity
      const newCount = existing.mention_count + 1;
      const newAvg =
        (existing.confidence_avg * existing.mention_count + confidence) / newCount;

      this.db.run(
        `UPDATE entities
         SET last_seen = ?, mention_count = ?, confidence_avg = ?
         WHERE id = ?`,
        [timestamp, newCount, newAvg, id]
      );
    } else {
      // Insert new entity
      this.db.run(
        `INSERT INTO entities (id, type, normalized_name, first_seen, last_seen, mention_count, confidence_avg)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [id, type, normalizedName, timestamp, timestamp, confidence]
      );
    }

    return id;
  }

  /**
   * Add entity mention linking entity to message
   */
  addMention(mention: Omit<EntityMention, "extracted_at"> & { extracted_at?: number }): void {
    const extractedAt = mention.extracted_at || Date.now();

    this.db.run(
      `INSERT INTO entity_mentions (entity_id, message_id, text, confidence, context, extracted_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        mention.entity_id,
        mention.message_id,
        mention.text,
        mention.confidence,
        mention.context || null,
        extractedAt,
      ]
    );
  }

  /**
   * Mark message as extracted
   */
  markExtracted(progress: ExtractionProgress): void {
    this.db.run(
      `INSERT OR REPLACE INTO extraction_progress
       (message_id, extracted_at, extractor, entity_count, processing_time_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [
        progress.message_id,
        progress.extracted_at,
        progress.extractor,
        progress.entity_count,
        progress.processing_time_ms,
      ]
    );
  }

  /**
   * Check if message has been extracted
   */
  isExtracted(messageId: string): boolean {
    const row = this.db
      .query("SELECT 1 FROM extraction_progress WHERE message_id = ?")
      .get(messageId);
    return !!row;
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | null {
    return this.db.query("SELECT * FROM entities WHERE id = ?").get(id) as Entity | null;
  }

  /**
   * Get all entities by type
   */
  getEntitiesByType(type: EntityType, limit?: number): Entity[] {
    const sql = limit
      ? `SELECT * FROM entities WHERE type = ? ORDER BY mention_count DESC LIMIT ?`
      : `SELECT * FROM entities WHERE type = ? ORDER BY mention_count DESC`;

    return (limit
      ? this.db.query(sql).all(type, limit)
      : this.db.query(sql).all(type)) as Entity[];
  }

  /**
   * Get entities for a message
   */
  getMessageEntities(messageId: string): Array<Entity & { text: string; confidence: number }> {
    const sql = `
      SELECT e.*, em.text, em.confidence
      FROM entities e
      JOIN entity_mentions em ON e.id = em.entity_id
      WHERE em.message_id = ?
      ORDER BY e.type, e.normalized_name
    `;
    return this.db.query(sql).all(messageId) as Array<Entity & { text: string; confidence: number }>;
  }

  /**
   * Get messages containing an entity
   */
  getEntityMessages(entityId: string, limit?: number): string[] {
    const sql = limit
      ? `SELECT DISTINCT message_id FROM entity_mentions WHERE entity_id = ? LIMIT ?`
      : `SELECT DISTINCT message_id FROM entity_mentions WHERE entity_id = ?`;

    const rows = (limit
      ? this.db.query(sql).all(entityId, limit)
      : this.db.query(sql).all(entityId)) as Array<{ message_id: string }>;

    return rows.map((r) => r.message_id);
  }

  /**
   * Search entities by name (partial match)
   */
  searchEntities(query: string, type?: EntityType, limit = 50): Entity[] {
    const pattern = `%${query.toLowerCase()}%`;

    if (type) {
      return this.db
        .query(
          `SELECT * FROM entities
           WHERE type = ? AND LOWER(normalized_name) LIKE ?
           ORDER BY mention_count DESC LIMIT ?`
        )
        .all(type, pattern, limit) as Entity[];
    }

    return this.db
      .query(
        `SELECT * FROM entities
         WHERE LOWER(normalized_name) LIKE ?
         ORDER BY mention_count DESC LIMIT ?`
      )
      .all(pattern, limit) as Entity[];
  }

  /**
   * Get statistics
   */
  getStats(): EntityStats {
    const totalEntities = (
      this.db.query("SELECT COUNT(*) as count FROM entities").get() as { count: number }
    ).count;

    const totalMentions = (
      this.db.query("SELECT COUNT(*) as count FROM entity_mentions").get() as { count: number }
    ).count;

    const processedMessages = (
      this.db.query("SELECT COUNT(*) as count FROM extraction_progress").get() as { count: number }
    ).count;

    // Count by type
    const byTypeRows = this.db
      .query("SELECT type, COUNT(*) as count FROM entities GROUP BY type")
      .all() as Array<{ type: EntityType; count: number }>;

    const by_type: Record<EntityType, number> = {
      person: 0,
      date: 0,
      question: 0,
      keyword: 0,
      organization: 0,
      product: 0,
    };

    for (const row of byTypeRows) {
      by_type[row.type] = row.count;
    }

    return {
      total_entities: totalEntities,
      total_mentions: totalMentions,
      by_type,
      processed_messages: processedMessages,
      pending_messages: 0, // Will be calculated by caller with message count
    };
  }

  /**
   * Get unextracted message IDs
   * Requires a list of all message IDs to compare against
   */
  getUnextractedFromList(messageIds: string[]): string[] {
    if (messageIds.length === 0) return [];

    // Create temp table for efficient comparison
    this.db.exec("CREATE TEMP TABLE IF NOT EXISTS temp_message_ids (id TEXT PRIMARY KEY)");
    this.db.exec("DELETE FROM temp_message_ids");

    const insert = this.db.prepare("INSERT INTO temp_message_ids (id) VALUES (?)");
    const insertMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        insert.run(id);
      }
    });
    insertMany(messageIds);

    const rows = this.db
      .query(
        `SELECT t.id FROM temp_message_ids t
         LEFT JOIN extraction_progress e ON t.id = e.message_id
         WHERE e.message_id IS NULL`
      )
      .all() as Array<{ id: string }>;

    return rows.map((r) => r.id);
  }

  /**
   * Transaction wrapper for batch operations
   */
  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create entity store instance
 */
export function createEntityStore(dbPath?: string): EntityStore {
  return new EntityStore(dbPath);
}
