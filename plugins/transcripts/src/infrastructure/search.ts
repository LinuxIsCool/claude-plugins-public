/**
 * Transcript Search Index
 *
 * SQLite FTS5-based full-text search for transcript utterances.
 * Provides fast keyword search with relevance ranking and speaker/temporal filtering.
 *
 * Pattern: Two-table design (FTS5 for text search + metadata for filtering)
 */

import { Database } from "bun:sqlite";
import { dirname } from "path";
import { existsSync, mkdirSync } from "fs";
import type { Transcript, TID } from "../domain/entities/transcript.js";
import { getClaudePath } from "../../../../lib/paths.js";

/**
 * Get the transcript search database path (anchored to repo root)
 */
function getDefaultDbPath(): string {
  return getClaudePath("transcripts/search/index.db");
}

/**
 * Search result for a single utterance match
 */
export interface UtteranceSearchResult {
  transcript_id: TID;
  utterance_id: string;
  speaker_id: string;
  speaker_name: string;
  text: string;
  start_ms: number;
  end_ms: number;
  score: number;
}

/**
 * Search result grouped by transcript
 */
export interface TranscriptSearchResult {
  transcript_id: TID;
  title?: string;
  matches: UtteranceSearchResult[];
  total_score: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  speakers?: string[];       // Filter by speaker IDs
  transcripts?: TID[];       // Filter by transcript IDs
  since?: number;            // Filter by utterance start time (ms)
  until?: number;            // Filter by utterance end time (ms)
  createdAfter?: number;     // Filter by transcript creation (unix timestamp)
  createdBefore?: number;    // Filter by transcript creation (unix timestamp)
}

/**
 * Transcript Search Index using SQLite FTS5
 */
export class TranscriptSearchIndex {
  private db: Database;

  constructor(dbPath?: string) {
    const effectivePath = dbPath ?? getDefaultDbPath();
    // Ensure parent directory exists
    const dir = dirname(effectivePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(effectivePath);
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // FTS5 table for full-text search on utterances
    // tokenize='porter unicode61' enables stemming and unicode normalization
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS utterances_fts USING fts5(
        id UNINDEXED,
        transcript_id UNINDEXED,
        speaker_id UNINDEXED,
        speaker_name,
        text,
        tokenize='porter unicode61'
      )
    `);

    // Metadata table for filtering and retrieval
    this.db.run(`
      CREATE TABLE IF NOT EXISTS utterances_meta (
        id TEXT PRIMARY KEY,
        transcript_id TEXT NOT NULL,
        speaker_id TEXT NOT NULL,
        speaker_name TEXT NOT NULL,
        text TEXT NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Transcript metadata for grouping
    this.db.run(`
      CREATE TABLE IF NOT EXISTS transcripts_meta (
        id TEXT PRIMARY KEY,
        title TEXT,
        source_filename TEXT,
        speaker_count INTEGER NOT NULL,
        utterance_count INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Indexes for common filters
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_utt_transcript ON utterances_meta(transcript_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_utt_speaker ON utterances_meta(speaker_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_utt_start ON utterances_meta(start_ms)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_utt_created ON utterances_meta(created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tx_created ON transcripts_meta(created_at)`);
  }

  /**
   * Index a transcript and all its utterances
   */
  index(transcript: Transcript): void {
    const insertFts = this.db.prepare(
      `INSERT OR REPLACE INTO utterances_fts (id, transcript_id, speaker_id, speaker_name, text)
       VALUES (?, ?, ?, ?, ?)`
    );

    const insertMeta = this.db.prepare(
      `INSERT OR REPLACE INTO utterances_meta
       (id, transcript_id, speaker_id, speaker_name, text, start_ms, end_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertTxMeta = this.db.prepare(
      `INSERT OR REPLACE INTO transcripts_meta
       (id, title, source_filename, speaker_count, utterance_count, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction(() => {
      // Index transcript metadata
      const uniqueSpeakers = new Set(transcript.utterances.map((u) => u.speaker.id));
      insertTxMeta.run(
        transcript.id,
        transcript.title || null,
        transcript.source.filename || null,
        uniqueSpeakers.size,
        transcript.utterances.length,
        transcript.source.audio.duration_ms || 0,
        transcript.created_at
      );

      // Index each utterance
      for (const utterance of transcript.utterances) {
        const globalId = `${transcript.id}:${utterance.id}`;

        insertFts.run(
          globalId,
          transcript.id,
          utterance.speaker.id,
          utterance.speaker.name || utterance.speaker.id,
          utterance.text
        );

        insertMeta.run(
          globalId,
          transcript.id,
          utterance.speaker.id,
          utterance.speaker.name || utterance.speaker.id,
          utterance.text,
          utterance.start_ms,
          utterance.end_ms,
          transcript.created_at
        );
      }
    });

    transaction();
  }

  /**
   * Index multiple transcripts in a batch
   */
  indexBatch(transcripts: Transcript[]): void {
    for (const transcript of transcripts) {
      this.index(transcript);
    }
  }

  /**
   * Search utterances with full-text query
   *
   * @param query FTS5 query (supports AND, OR, NOT, "phrase", prefix*)
   * @param options Search options
   */
  search(query: string, options: SearchOptions = {}): UtteranceSearchResult[] {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Build WHERE clause for metadata filters
    const conditions: string[] = [];
    const params: (string | number | null)[] = [query];

    if (options.speakers?.length) {
      conditions.push(`m.speaker_id IN (${options.speakers.map(() => "?").join(",")})`);
      params.push(...options.speakers);
    }

    if (options.transcripts?.length) {
      conditions.push(`m.transcript_id IN (${options.transcripts.map(() => "?").join(",")})`);
      params.push(...options.transcripts);
    }

    if (options.since !== undefined) {
      conditions.push("m.start_ms >= ?");
      params.push(options.since);
    }

    if (options.until !== undefined) {
      conditions.push("m.end_ms <= ?");
      params.push(options.until);
    }

    if (options.createdAfter !== undefined) {
      conditions.push("m.created_at >= ?");
      params.push(options.createdAfter);
    }

    if (options.createdBefore !== undefined) {
      conditions.push("m.created_at <= ?");
      params.push(options.createdBefore);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    params.push(limit, offset);

    const sql = `
      SELECT
        m.transcript_id,
        m.id as utterance_id,
        m.speaker_id,
        m.speaker_name,
        m.text,
        m.start_ms,
        m.end_ms,
        bm25(utterances_fts) as score
      FROM utterances_fts f
      JOIN utterances_meta m ON f.id = m.id
      WHERE utterances_fts MATCH ?
      ${whereClause}
      ORDER BY bm25(utterances_fts)
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.query(sql).all(...params) as {
      transcript_id: string;
      utterance_id: string;
      speaker_id: string;
      speaker_name: string;
      text: string;
      start_ms: number;
      end_ms: number;
      score: number;
    }[];

    return rows.map((row) => ({
      ...row,
      score: -row.score, // BM25 returns negative scores, lower is better
    }));
  }

  /**
   * Search and group results by transcript
   */
  searchGrouped(query: string, options: SearchOptions = {}): TranscriptSearchResult[] {
    const results = this.search(query, { ...options, limit: (options.limit ?? 50) * 10 });

    // Group by transcript
    const grouped = new Map<string, TranscriptSearchResult>();

    for (const result of results) {
      let group = grouped.get(result.transcript_id);
      if (!group) {
        const txMeta = this.getTranscriptMeta(result.transcript_id);
        group = {
          transcript_id: result.transcript_id,
          title: txMeta?.title,
          matches: [],
          total_score: 0,
        };
        grouped.set(result.transcript_id, group);
      }
      group.matches.push(result);
      group.total_score += result.score;
    }

    // Sort by total score and limit
    const sorted = Array.from(grouped.values())
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, options.limit ?? 50);

    return sorted;
  }

  /**
   * Search with highlighted snippets
   */
  searchWithHighlights(
    query: string,
    options: SearchOptions = {}
  ): (UtteranceSearchResult & { highlight: string })[] {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const sql = `
      SELECT
        m.transcript_id,
        m.id as utterance_id,
        m.speaker_id,
        m.speaker_name,
        m.text,
        m.start_ms,
        m.end_ms,
        bm25(utterances_fts) as score,
        snippet(utterances_fts, 4, '**', '**', '...', 64) as highlight
      FROM utterances_fts f
      JOIN utterances_meta m ON f.id = m.id
      WHERE utterances_fts MATCH ?
      ORDER BY bm25(utterances_fts)
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.query(sql).all(query, limit, offset) as {
      transcript_id: string;
      utterance_id: string;
      speaker_id: string;
      speaker_name: string;
      text: string;
      start_ms: number;
      end_ms: number;
      score: number;
      highlight: string;
    }[];

    return rows.map((row) => ({
      ...row,
      score: -row.score,
    }));
  }

  /**
   * Get transcript metadata
   */
  private getTranscriptMeta(
    transcriptId: TID
  ): { title?: string; filename?: string } | null {
    const row = this.db
      .query("SELECT title, source_filename FROM transcripts_meta WHERE id = ?")
      .get(transcriptId) as { title: string | null; source_filename: string | null } | null;

    if (!row) return null;
    return { title: row.title || undefined, filename: row.source_filename || undefined };
  }

  /**
   * Get all utterances for a transcript
   */
  getTranscriptUtterances(transcriptId: TID): UtteranceSearchResult[] {
    const rows = this.db
      .query(
        `SELECT transcript_id, id as utterance_id, speaker_id, speaker_name, text, start_ms, end_ms, 0 as score
         FROM utterances_meta
         WHERE transcript_id = ?
         ORDER BY start_ms`
      )
      .all(transcriptId) as UtteranceSearchResult[];

    return rows;
  }

  /**
   * Get utterances by speaker across all transcripts
   */
  getSpeakerUtterances(speakerId: string, limit = 100): UtteranceSearchResult[] {
    const rows = this.db
      .query(
        `SELECT transcript_id, id as utterance_id, speaker_id, speaker_name, text, start_ms, end_ms, 0 as score
         FROM utterances_meta
         WHERE speaker_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(speakerId, limit) as UtteranceSearchResult[];

    return rows;
  }

  /**
   * Get indexed transcript count
   */
  transcriptCount(): number {
    const row = this.db.query("SELECT COUNT(*) as count FROM transcripts_meta").get() as {
      count: number;
    };
    return row.count;
  }

  /**
   * Get indexed utterance count
   */
  utteranceCount(): number {
    const row = this.db.query("SELECT COUNT(*) as count FROM utterances_meta").get() as {
      count: number;
    };
    return row.count;
  }

  /**
   * Get index statistics
   */
  stats(): {
    transcripts: number;
    utterances: number;
    speakers: number;
    dateRange: { first: number; last: number } | null;
  } {
    const transcripts = this.transcriptCount();
    const utterances = this.utteranceCount();

    const speakerRow = this.db
      .query("SELECT COUNT(DISTINCT speaker_id) as count FROM utterances_meta")
      .get() as { count: number };

    const rangeRow = this.db
      .query(
        `SELECT MIN(created_at) as first, MAX(created_at) as last
         FROM transcripts_meta`
      )
      .get() as { first: number | null; last: number | null };

    const dateRange =
      rangeRow.first !== null && rangeRow.last !== null
        ? { first: rangeRow.first, last: rangeRow.last }
        : null;

    return {
      transcripts,
      utterances,
      speakers: speakerRow.count,
      dateRange,
    };
  }

  /**
   * Check if a transcript is already indexed
   */
  isIndexed(transcriptId: TID): boolean {
    const row = this.db
      .query("SELECT 1 FROM transcripts_meta WHERE id = ? LIMIT 1")
      .get(transcriptId);
    return row !== null;
  }

  /**
   * Remove a transcript and its utterances from the index
   */
  removeTranscript(transcriptId: TID): void {
    this.db.run("DELETE FROM utterances_fts WHERE transcript_id = ?", [transcriptId]);
    this.db.run("DELETE FROM utterances_meta WHERE transcript_id = ?", [transcriptId]);
    this.db.run("DELETE FROM transcripts_meta WHERE id = ?", [transcriptId]);
  }

  /**
   * Clear all indexed data
   */
  clear(): void {
    this.db.run("DELETE FROM utterances_fts");
    this.db.run("DELETE FROM utterances_meta");
    this.db.run("DELETE FROM transcripts_meta");
  }

  /**
   * Rebuild index from scratch
   * Returns the number of transcripts processed
   */
  rebuild(transcripts: Transcript[]): number {
    this.clear();
    this.indexBatch(transcripts);
    return transcripts.length;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create a transcript search index instance
 */
export function createTranscriptSearchIndex(dbPath?: string): TranscriptSearchIndex {
  return new TranscriptSearchIndex(dbPath);
}
