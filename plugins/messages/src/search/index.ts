/**
 * Search Index
 *
 * SQLite FTS5-based full-text search for messages.
 * Provides fast keyword search with relevance ranking.
 */

import { Database } from "bun:sqlite";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { Message, SearchResult } from "../types";
import { kindName } from "../types";
import { createEmbeddingStore, createOllamaEmbedder, type EmbeddingStore, type OllamaEmbedder } from "../embeddings";
import { getSearchDbPath } from "../config";

/**
 * Search Index using SQLite FTS5
 */
export class SearchIndex {
  private db: Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? getSearchDbPath();
    // Ensure directory exists
    const dir = join(resolvedPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    // Enable WAL mode for better concurrent access
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA busy_timeout = 5000");
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // FTS5 table for full-text search
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id UNINDEXED,
        content,
        title,
        author_name,
        platform,
        tags,
        tokenize='porter unicode61'
      )
    `);

    // Metadata table for filtering
    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages_meta (
        id TEXT PRIMARY KEY,
        kind INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        thread_id TEXT,
        platform TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        imported_at INTEGER NOT NULL,
        direction TEXT,
        data TEXT NOT NULL
      )
    `);

    // Add direction column if missing (migration for existing DBs)
    try {
      this.db.run(`ALTER TABLE messages_meta ADD COLUMN direction TEXT`);
    } catch {
      // Column already exists
    }

    // Threads table for thread metadata (names, types, state)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        platform TEXT NOT NULL,
        is_group INTEGER DEFAULT 0,
        participant_count INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    // Migration for existing DBs - add archived/muted columns
    try {
      this.db.run(`ALTER TABLE threads ADD COLUMN is_archived INTEGER DEFAULT 0`);
    } catch {
      // Column already exists
    }
    try {
      this.db.run(`ALTER TABLE threads ADD COLUMN is_muted INTEGER DEFAULT 0`);
    } catch {
      // Column already exists
    }

    // Indexes for common filters
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_kind ON messages_meta(kind)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_platform ON messages_meta(platform)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_account ON messages_meta(account_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_thread ON messages_meta(thread_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_created ON messages_meta(created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_direction ON messages_meta(direction)`);

    // Indexes for threads table
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_threads_platform ON threads(platform)`);
    // Composite index covers archived-only queries (leftmost prefix), but need separate for muted-only
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_threads_state ON threads(is_archived, is_muted)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_threads_muted ON threads(is_muted)`);
  }

  /**
   * Insert or update thread metadata
   */
  upsertThread(thread: {
    id: string;
    title?: string;
    type?: string;
    platform: string;
    isGroup?: boolean;
    participantCount?: number;
  }): void {
    const now = Date.now();
    this.db.run(
      `INSERT INTO threads (id, title, type, platform, is_group, participant_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = COALESCE(excluded.title, threads.title),
         type = COALESCE(excluded.type, threads.type),
         is_group = COALESCE(excluded.is_group, threads.is_group),
         participant_count = COALESCE(excluded.participant_count, threads.participant_count),
         updated_at = excluded.updated_at`,
      [
        thread.id,
        thread.title || null,
        thread.type || null,
        thread.platform,
        thread.isGroup ? 1 : 0,
        thread.participantCount || 0,
        now,
        now,
      ]
    );
  }

  /**
   * Batch upsert thread metadata
   */
  upsertThreads(threads: Array<{
    id: string;
    title?: string;
    type?: string;
    platform: string;
    isGroup?: boolean;
    participantCount?: number;
  }>): number {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO threads (id, title, type, platform, is_group, participant_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = COALESCE(excluded.title, threads.title),
         type = COALESCE(excluded.type, threads.type),
         is_group = COALESCE(excluded.is_group, threads.is_group),
         participant_count = COALESCE(excluded.participant_count, threads.participant_count),
         updated_at = excluded.updated_at`
    );

    let count = 0;
    const batch = this.db.transaction(() => {
      for (const thread of threads) {
        stmt.run(
          thread.id,
          thread.title || null,
          thread.type || null,
          thread.platform,
          thread.isGroup ? 1 : 0,
          thread.participantCount || 0,
          now,
          now
        );
        count++;
      }
    });

    batch();
    return count;
  }

  /**
   * Get thread by ID
   */
  getThread(id: string): { id: string; title: string | null; type: string | null; platform: string; isGroup: boolean } | null {
    const row = this.db.query(`SELECT id, title, type, platform, is_group FROM threads WHERE id = ?`).get(id) as {
      id: string;
      title: string | null;
      type: string | null;
      platform: string;
      is_group: number;
    } | null;

    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      platform: row.platform,
      isGroup: row.is_group === 1,
    };
  }

  /**
   * Update thread archived/muted state
   */
  setThreadState(threadId: string, state: { archived?: boolean; muted?: boolean }): void {
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (state.archived !== undefined) {
      updates.push("is_archived = ?");
      params.push(state.archived ? 1 : 0);
    }

    if (state.muted !== undefined) {
      updates.push("is_muted = ?");
      params.push(state.muted ? 1 : 0);
    }

    if (updates.length === 0) return;

    updates.push("updated_at = ?");
    params.push(Date.now());
    params.push(threadId);

    this.db.run(
      `UPDATE threads SET ${updates.join(", ")} WHERE id = ?`,
      params
    );
  }

  /**
   * Get thread state (archived/muted)
   */
  getThreadState(threadId: string): { archived: boolean; muted: boolean } | null {
    const row = this.db.query(
      `SELECT is_archived, is_muted FROM threads WHERE id = ?`
    ).get(threadId) as { is_archived: number; is_muted: number } | null;

    if (!row) return null;

    return {
      archived: row.is_archived === 1,
      muted: row.is_muted === 1,
    };
  }

  /**
   * Archive a thread (excludes from priority scoring)
   */
  archiveThread(threadId: string): void {
    this.setThreadState(threadId, { archived: true });
  }

  /**
   * Unarchive a thread
   */
  unarchiveThread(threadId: string): void {
    this.setThreadState(threadId, { archived: false });
  }

  /**
   * Mute a thread (excludes from priority scoring)
   */
  muteThread(threadId: string): void {
    this.setThreadState(threadId, { muted: true });
  }

  /**
   * Unmute a thread
   */
  unmuteThread(threadId: string): void {
    this.setThreadState(threadId, { muted: false });
  }

  /**
   * Extract direction from message tags
   * Returns 'outgoing', 'incoming', or null if not specified
   */
  private extractDirection(message: Message): string | null {
    const dirTag = message.tags?.find(([k]) => k === "direction");
    return dirTag ? dirTag[1] : null;
  }

  /**
   * Index a message for search
   */
  index(message: Message): void {
    // Format tags for search
    const tagsText = message.tags?.map(([k, v]) => `${k}:${v}`).join(" ") || "";
    const direction = this.extractDirection(message);

    // Insert/update FTS
    this.db.run(
      `INSERT OR REPLACE INTO messages_fts (id, content, title, author_name, platform, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.content,
        message.title || "",
        message.author.name || "",
        message.source.platform,
        tagsText,
      ]
    );

    // Insert/update metadata
    this.db.run(
      `INSERT OR REPLACE INTO messages_meta
       (id, kind, account_id, thread_id, platform, created_at, imported_at, direction, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.kind,
        message.account_id,
        message.refs.thread_id || null,
        message.source.platform,
        message.created_at instanceof Date ? message.created_at.toISOString() : message.created_at,
        message.imported_at instanceof Date ? message.imported_at.toISOString() : message.imported_at,
        direction,
        JSON.stringify(message),
      ]
    );
  }

  /**
   * Index multiple messages in a batch
   */
  indexBatch(messages: Message[]): void {
    const insertFts = this.db.prepare(
      `INSERT OR REPLACE INTO messages_fts (id, content, title, author_name, platform, tags)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertMeta = this.db.prepare(
      `INSERT OR REPLACE INTO messages_meta
       (id, kind, account_id, thread_id, platform, created_at, imported_at, direction, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction(() => {
      for (const message of messages) {
        const tagsText = message.tags?.map(([k, v]) => `${k}:${v}`).join(" ") || "";
        const direction = this.extractDirection(message);

        insertFts.run(
          message.id,
          message.content,
          message.title || "",
          message.author.name || "",
          message.source.platform,
          tagsText
        );

        insertMeta.run(
          message.id,
          message.kind,
          message.account_id,
          message.refs.thread_id || null,
          message.source.platform,
          message.created_at,
          message.imported_at,
          direction,
          JSON.stringify(message)
        );
      }
    });

    transaction();
  }

  /**
   * Search messages
   *
   * @param query Search query (supports FTS5 syntax)
   * @param options Search options
   */
  search(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      kinds?: number[];
      platforms?: string[];
      accounts?: string[];
      threads?: string[];
      since?: number;
      until?: number;
    } = {}
  ): SearchResult[] {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Build WHERE clause for metadata filters
    const conditions: string[] = [];
    const params: (string | number | null)[] = [query];

    if (options.kinds?.length) {
      conditions.push(`m.kind IN (${options.kinds.map(() => "?").join(",")})`);
      params.push(...options.kinds);
    }

    if (options.platforms?.length) {
      conditions.push(`m.platform IN (${options.platforms.map(() => "?").join(",")})`);
      params.push(...options.platforms);
    }

    if (options.accounts?.length) {
      conditions.push(`m.account_id IN (${options.accounts.map(() => "?").join(",")})`);
      params.push(...options.accounts);
    }

    if (options.threads?.length) {
      conditions.push(`m.thread_id IN (${options.threads.map(() => "?").join(",")})`);
      params.push(...options.threads);
    }

    if (options.since !== undefined) {
      conditions.push("m.created_at >= ?");
      params.push(options.since);
    }

    if (options.until !== undefined) {
      conditions.push("m.created_at <= ?");
      params.push(options.until);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    params.push(limit, offset);

    const sql = `
      SELECT
        m.data,
        bm25(messages_fts) as score
      FROM messages_fts f
      JOIN messages_meta m ON f.id = m.id
      WHERE messages_fts MATCH ?
      ${whereClause}
      ORDER BY bm25(messages_fts)
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.query(sql).all(...params) as { data: string; score: number }[];

    return rows.map((row) => ({
      message: JSON.parse(row.data) as Message,
      score: -row.score, // BM25 returns negative scores, lower is better
    }));
  }

  /**
   * Search with highlighted snippets
   */
  searchWithHighlights(
    query: string,
    options: Parameters<SearchIndex["search"]>[1] = {}
  ): (SearchResult & { highlights: string[] })[] {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const sql = `
      SELECT
        m.data,
        bm25(messages_fts) as score,
        snippet(messages_fts, 1, '**', '**', '...', 64) as content_snippet
      FROM messages_fts f
      JOIN messages_meta m ON f.id = m.id
      WHERE messages_fts MATCH ?
      ORDER BY bm25(messages_fts)
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.query(sql).all(query, limit, offset) as {
      data: string;
      score: number;
      content_snippet: string;
    }[];

    return rows.map((row) => ({
      message: JSON.parse(row.data) as Message,
      score: -row.score,
      highlights: [row.content_snippet],
    }));
  }

  /**
   * Get message by ID
   */
  getById(id: string): Message | null {
    const row = this.db
      .query(`SELECT data FROM messages_meta WHERE id = ?`)
      .get(id) as { data: string } | null;

    return row ? (JSON.parse(row.data) as Message) : null;
  }

  /**
   * Get multiple messages by IDs
   */
  getByIds(ids: string[]): Message[] {
    if (ids.length === 0) return [];

    // SQLite has a limit on compound SELECT, so batch
    const messages: Message[] = [];
    const batchSize = 500;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const placeholders = batch.map(() => "?").join(",");

      const rows = this.db
        .query(`SELECT data FROM messages_meta WHERE id IN (${placeholders})`)
        .all(...batch) as { data: string }[];

      messages.push(...rows.map((row) => JSON.parse(row.data) as Message));
    }

    return messages;
  }

  /**
   * Get recent messages
   */
  recent(limit = 50): Message[] {
    const rows = this.db
      .query(
        `SELECT data FROM messages_meta
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(limit) as { data: string }[];

    return rows.map((row) => JSON.parse(row.data) as Message);
  }

  /**
   * Get messages by thread
   */
  getThreadMessages(threadId: string, limit = 100): Message[] {
    const rows = this.db
      .query(
        `SELECT data FROM messages_meta
         WHERE thread_id = ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(threadId, limit) as { data: string }[];

    return rows.map((row) => JSON.parse(row.data) as Message);
  }

  /**
   * Get messages by account
   */
  getAccountMessages(accountId: string, limit = 100): Message[] {
    const rows = this.db
      .query(
        `SELECT data FROM messages_meta
         WHERE account_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(accountId, limit) as { data: string }[];

    return rows.map((row) => JSON.parse(row.data) as Message);
  }

  /**
   * Get message count
   */
  count(): number {
    const row = this.db.query("SELECT COUNT(*) as count FROM messages_meta").get() as {
      count: number;
    };
    return row.count;
  }

  /**
   * Get statistics
   */
  stats(): {
    total: number;
    byKind: Record<string, number>;
    byPlatform: Record<string, number>;
    dateRange: { first: number; last: number } | null;
  } {
    const total = this.count();

    // By kind
    const kindRows = this.db
      .query(
        `SELECT kind, COUNT(*) as count FROM messages_meta
         GROUP BY kind`
      )
      .all() as { kind: number; count: number }[];

    const byKind: Record<string, number> = {};
    for (const row of kindRows) {
      byKind[kindName(row.kind)] = row.count;
    }

    // By platform
    const platformRows = this.db
      .query(
        `SELECT platform, COUNT(*) as count FROM messages_meta
         GROUP BY platform`
      )
      .all() as { platform: string; count: number }[];

    const byPlatform: Record<string, number> = {};
    for (const row of platformRows) {
      byPlatform[row.platform] = row.count;
    }

    // Date range
    const rangeRow = this.db
      .query(
        `SELECT MIN(created_at) as first, MAX(created_at) as last
         FROM messages_meta`
      )
      .get() as { first: number | null; last: number | null };

    const dateRange =
      rangeRow.first !== null && rangeRow.last !== null
        ? { first: rangeRow.first, last: rangeRow.last }
        : null;

    return { total, byKind, byPlatform, dateRange };
  }

  /**
   * Delete a message from the index
   */
  delete(id: string): void {
    this.db.run("DELETE FROM messages_fts WHERE id = ?", [id]);
    this.db.run("DELETE FROM messages_meta WHERE id = ?", [id]);
  }

  /**
   * Clear all indexed data
   */
  clear(): void {
    this.db.run("DELETE FROM messages_fts");
    this.db.run("DELETE FROM messages_meta");
  }

  /**
   * Semantic search using vector embeddings
   *
   * Requires Ollama running with nomic-embed-text model.
   * Embeddings must be generated first with the embed command.
   *
   * @param query Search query (natural language)
   * @param options Search options
   */
  async semanticSearch(
    query: string,
    options: {
      limit?: number;
      kinds?: number[];
      platforms?: string[];
      accounts?: string[];
      threads?: string[];
      since?: number;
      until?: number;
      embeddingDbPath?: string;
    } = {}
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 50;

    // Initialize embedder and store
    const embedder = createOllamaEmbedder();
    const store = createEmbeddingStore(options.embeddingDbPath);

    try {
      // Check if Ollama is available
      const status = await embedder.isAvailable();
      if (!status.available) {
        throw new Error(`Ollama not available: ${status.error || "unknown error"}`);
      }
      if (!status.modelLoaded) {
        throw new Error(`Model ${embedder.getModel()} not loaded in Ollama`);
      }

      // Embed the query
      const queryResult = await embedder.embed(query);

      // Get candidate IDs if we have filters
      let candidateIds: string[] | null = null;
      if (
        options.kinds?.length ||
        options.platforms?.length ||
        options.accounts?.length ||
        options.threads?.length ||
        options.since !== undefined ||
        options.until !== undefined
      ) {
        candidateIds = this.getFilteredIds(options);
      }

      // Find similar embeddings
      const similar = candidateIds
        ? store.cosineSimilarityFiltered(queryResult.embedding, candidateIds, limit)
        : store.cosineSimilarity(queryResult.embedding, limit);

      // Get full messages
      const messages = this.getByIds(similar.map((s) => s.id));
      const messageMap = new Map(messages.map((m) => [m.id, m]));

      // Build results with scores
      const results: SearchResult[] = [];
      for (const s of similar) {
        const message = messageMap.get(s.id);
        if (message) {
          results.push({
            message,
            score: s.score,
          });
        }
      }

      return results;
    } finally {
      store.close();
    }
  }

  /**
   * Get message IDs matching filter criteria
   */
  private getFilteredIds(options: {
    kinds?: number[];
    platforms?: string[];
    accounts?: string[];
    threads?: string[];
    since?: number;
    until?: number;
  }): string[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.kinds?.length) {
      conditions.push(`kind IN (${options.kinds.map(() => "?").join(",")})`);
      params.push(...options.kinds);
    }

    if (options.platforms?.length) {
      conditions.push(`platform IN (${options.platforms.map(() => "?").join(",")})`);
      params.push(...options.platforms);
    }

    if (options.accounts?.length) {
      conditions.push(`account_id IN (${options.accounts.map(() => "?").join(",")})`);
      params.push(...options.accounts);
    }

    if (options.threads?.length) {
      conditions.push(`thread_id IN (${options.threads.map(() => "?").join(",")})`);
      params.push(...options.threads);
    }

    if (options.since !== undefined) {
      conditions.push("created_at >= ?");
      params.push(options.since);
    }

    if (options.until !== undefined) {
      conditions.push("created_at <= ?");
      params.push(options.until);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = this.db
      .query(`SELECT id FROM messages_meta ${whereClause}`)
      .all(...params) as { id: string }[];

    return rows.map((r) => r.id);
  }

  /**
   * Get all message IDs (for embedding generation)
   */
  getAllIds(): string[] {
    const rows = this.db.query(`SELECT id FROM messages_meta`).all() as { id: string }[];
    return rows.map((r) => r.id);
  }

  /**
   * Get messages by IDs in batches (for embedding text extraction)
   */
  getMessagesForEmbedding(ids: string[]): Array<{ id: string; text: string }> {
    const messages = this.getByIds(ids);
    return messages.map((m) => ({
      id: m.id,
      // Combine content and author name for embedding
      text: `${m.author.name || "Unknown"}: ${m.content}`,
    }));
  }

  /**
   * Repair email direction tagging
   *
   * Sets direction based on whether sender matches user's email addresses.
   * - From user's email → "outgoing"
   * - From any other email → "incoming"
   *
   * @param myEmails Array of user's email addresses (case-insensitive)
   * @returns Statistics about repaired messages
   */
  repairEmailDirection(myEmails: string[]): { fixed: number; outgoing: number; incoming: number } {
    let fixed = 0;
    let outgoing = 0;
    let incoming = 0;

    // Normalize emails to lowercase for comparison
    const myEmailsLower = new Set(myEmails.map(e => e.toLowerCase()));

    // Get all email messages
    const rows = this.db.query(`
      SELECT id, direction, data FROM messages_meta
      WHERE platform = 'email'
    `).all() as Array<{ id: string; direction: string | null; data: string }>;

    const updateMeta = this.db.prepare(`
      UPDATE messages_meta SET direction = ?, data = ? WHERE id = ?
    `);
    const updateFts = this.db.prepare(`
      UPDATE messages_fts SET tags = ? WHERE id = ?
    `);

    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        const data = JSON.parse(row.data) as Message;
        const senderEmail = (data.author?.handle || "").toLowerCase();
        const isFromMe = myEmailsLower.has(senderEmail);
        const correctDirection = isFromMe ? "outgoing" : "incoming";

        if (isFromMe) outgoing++;
        else incoming++;

        if (row.direction === correctDirection) continue;

        // Update the data JSON with correct direction tag
        const newTags: Array<[string, string]> = (data.tags || [])
          .filter(([k]) => k !== "direction");
        newTags.push(["direction", correctDirection]);
        data.tags = newTags;

        // Update metadata and FTS
        updateMeta.run(correctDirection, JSON.stringify(data), row.id);
        const tagsText = newTags.map(([k, v]) => `${k}:${v}`).join(" ");
        updateFts.run(tagsText, row.id);

        fixed++;
      }
    });

    transaction();

    return { fixed, outgoing, incoming };
  }

  /**
   * Repair Signal direction tagging
   *
   * Fixes messages where direction doesn't match author.name:
   * - author.name === "Me" should be "outgoing"
   * - author.name !== "Me" should be "incoming"
   *
   * @returns Statistics about repaired messages
   */
  repairSignalDirection(): { fixed: number; alreadyCorrect: number } {
    let fixed = 0;
    let alreadyCorrect = 0;

    // Get all Signal messages
    const rows = this.db.query(`
      SELECT id, direction, data FROM messages_meta
      WHERE platform = 'signal'
    `).all() as Array<{ id: string; direction: string | null; data: string }>;

    const updateMeta = this.db.prepare(`
      UPDATE messages_meta SET direction = ?, data = ? WHERE id = ?
    `);
    const updateFts = this.db.prepare(`
      UPDATE messages_fts SET tags = ? WHERE id = ?
    `);

    const transaction = this.db.transaction(() => {
      for (const row of rows) {
        const data = JSON.parse(row.data) as Message;
        const authorName = data.author?.name || "";
        const isFromMe = authorName === "Me";
        const correctDirection = isFromMe ? "outgoing" : "incoming";

        if (row.direction === correctDirection) {
          alreadyCorrect++;
          continue;
        }

        // Update the data JSON with correct direction tag
        const newTags: Array<[string, string]> = (data.tags || [])
          .filter(([k]) => k !== "direction");
        newTags.push(["direction", correctDirection]);
        data.tags = newTags;

        // Update metadata and FTS
        updateMeta.run(correctDirection, JSON.stringify(data), row.id);

        // Update FTS tags column
        const tagsText = newTags.map(([k, v]) => `${k}:${v}`).join(" ");
        updateFts.run(tagsText, row.id);

        fixed++;
      }
    });

    transaction();

    return { fixed, alreadyCorrect };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create a search index instance
 */
export function createSearchIndex(dbPath?: string): SearchIndex {
  return new SearchIndex(dbPath);
}
