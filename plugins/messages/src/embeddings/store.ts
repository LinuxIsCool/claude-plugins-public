/**
 * Embedding Storage
 *
 * SQLite-based storage for message embeddings.
 * Stores embeddings as Float32Array BLOBs with model tracking.
 */

import { Database } from "bun:sqlite";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { getEmbeddingsDbPath } from "../config";

export interface StoredEmbedding {
  id: string;
  embedding: Float32Array;
  model: string;
  createdAt: number;
}

export interface SimilarityResult {
  id: string;
  score: number;
  embedding: Float32Array;
}

export interface EmbeddingStats {
  total: number;
  byModel: Record<string, number>;
  dimensions: number | null;
  sizeBytes: number;
}

/**
 * SQLite-based embedding storage
 */
export class EmbeddingStore {
  private db: Database;
  private dimensions: number;

  constructor(dbPath?: string, dimensions = 768) {
    const resolvedPath = dbPath ?? getEmbeddingsDbPath();
    // Ensure directory exists
    const dir = join(resolvedPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    // Enable WAL mode for better concurrent access
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA busy_timeout = 5000");
    this.dimensions = dimensions;
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS message_embeddings (
        id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_emb_model ON message_embeddings(model)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_emb_created ON message_embeddings(created_at)`);
  }

  /**
   * Store an embedding
   */
  store(id: string, embedding: Float32Array, model: string): void {
    const blob = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);

    this.db.run(
      `INSERT OR REPLACE INTO message_embeddings (id, embedding, model, created_at)
       VALUES (?, ?, ?, ?)`,
      [id, blob, model, Date.now()]
    );
  }

  /**
   * Store multiple embeddings in a transaction
   */
  storeBatch(embeddings: Array<{ id: string; embedding: Float32Array; model: string }>): void {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO message_embeddings (id, embedding, model, created_at)
       VALUES (?, ?, ?, ?)`
    );

    const now = Date.now();

    const transaction = this.db.transaction(() => {
      for (const { id, embedding, model } of embeddings) {
        const blob = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
        stmt.run(id, blob, model, now);
      }
    });

    transaction();
  }

  /**
   * Get an embedding by ID
   */
  get(id: string): StoredEmbedding | null {
    const row = this.db.query(`SELECT * FROM message_embeddings WHERE id = ?`).get(id) as {
      id: string;
      embedding: Buffer;
      model: string;
      created_at: number;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      embedding: new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4),
      model: row.model,
      createdAt: row.created_at,
    };
  }

  /**
   * Get multiple embeddings by IDs
   */
  getMany(ids: string[]): Map<string, StoredEmbedding> {
    const result = new Map<string, StoredEmbedding>();
    if (ids.length === 0) return result;

    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const placeholders = batch.map(() => "?").join(",");

      const rows = this.db
        .query(`SELECT * FROM message_embeddings WHERE id IN (${placeholders})`)
        .all(...batch) as Array<{
        id: string;
        embedding: Buffer;
        model: string;
        created_at: number;
      }>;

      for (const row of rows) {
        result.set(row.id, {
          id: row.id,
          embedding: new Float32Array(
            row.embedding.buffer,
            row.embedding.byteOffset,
            row.embedding.byteLength / 4
          ),
          model: row.model,
          createdAt: row.created_at,
        });
      }
    }

    return result;
  }

  /**
   * Check if an embedding exists
   */
  has(id: string): boolean {
    const row = this.db
      .query(`SELECT 1 FROM message_embeddings WHERE id = ?`)
      .get(id);
    return row !== null;
  }

  /**
   * Get IDs of messages that don't have embeddings
   */
  getUnembeddedIds(allIds: string[]): string[] {
    if (allIds.length === 0) return [];

    const embeddedIds = new Set<string>();
    const batchSize = 500;

    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);
      const placeholders = batch.map(() => "?").join(",");

      const rows = this.db
        .query(`SELECT id FROM message_embeddings WHERE id IN (${placeholders})`)
        .all(...batch) as Array<{ id: string }>;

      for (const row of rows) {
        embeddedIds.add(row.id);
      }
    }

    return allIds.filter((id) => !embeddedIds.has(id));
  }

  /**
   * Find most similar embeddings using cosine similarity
   * Since embeddings are L2-normalized, this is equivalent to dot product
   */
  cosineSimilarity(queryEmbedding: Float32Array, limit = 50): SimilarityResult[] {
    // Load all embeddings (brute force for now)
    const rows = this.db
      .query(`SELECT id, embedding FROM message_embeddings`)
      .all() as Array<{ id: string; embedding: Buffer }>;

    const results: SimilarityResult[] = [];

    for (const row of rows) {
      const stored = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4
      );

      // Dot product (cosine similarity for normalized vectors)
      let score = 0;
      for (let i = 0; i < queryEmbedding.length && i < stored.length; i++) {
        score += queryEmbedding[i] * stored[i];
      }

      results.push({ id: row.id, score, embedding: stored });
    }

    // Sort by score descending and take top-k
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Find similar embeddings with ID filter
   */
  cosineSimilarityFiltered(
    queryEmbedding: Float32Array,
    candidateIds: string[],
    limit = 50
  ): SimilarityResult[] {
    if (candidateIds.length === 0) return [];

    const embeddings = this.getMany(candidateIds);
    const results: SimilarityResult[] = [];

    for (const [id, stored] of embeddings) {
      let score = 0;
      for (let i = 0; i < queryEmbedding.length && i < stored.embedding.length; i++) {
        score += queryEmbedding[i] * stored.embedding[i];
      }

      results.push({ id, score, embedding: stored.embedding });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Delete an embedding
   */
  delete(id: string): void {
    this.db.run(`DELETE FROM message_embeddings WHERE id = ?`, [id]);
  }

  /**
   * Delete embeddings by model (useful when re-embedding with new model)
   */
  deleteByModel(model: string): number {
    const result = this.db.run(`DELETE FROM message_embeddings WHERE model = ?`, [model]);
    return result.changes;
  }

  /**
   * Get count of embeddings
   */
  count(): number {
    const row = this.db.query(`SELECT COUNT(*) as count FROM message_embeddings`).get() as {
      count: number;
    };
    return row.count;
  }

  /**
   * Get statistics
   */
  stats(): EmbeddingStats {
    const total = this.count();

    // By model
    const modelRows = this.db
      .query(`SELECT model, COUNT(*) as count FROM message_embeddings GROUP BY model`)
      .all() as Array<{ model: string; count: number }>;

    const byModel: Record<string, number> = {};
    for (const row of modelRows) {
      byModel[row.model] = row.count;
    }

    // Get dimensions from first embedding
    let dimensions: number | null = null;
    const firstRow = this.db
      .query(`SELECT embedding FROM message_embeddings LIMIT 1`)
      .get() as { embedding: Buffer } | null;

    if (firstRow) {
      dimensions = firstRow.embedding.byteLength / 4;
    }

    // Calculate storage size
    const sizeRow = this.db
      .query(`SELECT SUM(LENGTH(embedding)) as size FROM message_embeddings`)
      .get() as { size: number | null };

    return {
      total,
      byModel,
      dimensions,
      sizeBytes: sizeRow.size ?? 0,
    };
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.db.run(`DELETE FROM message_embeddings`);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create an embedding store instance
 */
export function createEmbeddingStore(dbPath?: string, dimensions?: number): EmbeddingStore {
  return new EmbeddingStore(dbPath, dimensions);
}
