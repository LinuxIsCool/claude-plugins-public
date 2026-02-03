/**
 * Skills Database for Observatory Plugin
 *
 * SQLite database with FTS5 full-text search for cataloging
 * individual skills from external GitHub repositories.
 */

import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type {
  SkillEntry,
  SkillRecord,
  SkillSearchOptions,
  SkillCatalogStats,
} from "./schema.js";
import { getSkillsDbPath } from "../paths.js";

/**
 * Skills catalog database
 */
export class SkillsDatabase {
  private db: Database;
  private insertStmt: ReturnType<Database["prepare"]>;
  private searchStmt: ReturnType<Database["prepare"]>;

  constructor(dbPath?: string) {
    const path = dbPath ?? getSkillsDbPath();

    // Ensure directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(path, { create: true });

    // Enable WAL mode for better concurrent access
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA synchronous = NORMAL");

    this.initializeSchema();
    this.insertStmt = this.prepareInsert();
    this.searchStmt = this.prepareSearch();
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    // Main skills table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        plugin_name TEXT NOT NULL,
        skill_name TEXT NOT NULL,
        skill_path TEXT NOT NULL,
        description TEXT,
        allowed_tools TEXT,
        subskills TEXT,
        git_sha TEXT NOT NULL,
        last_indexed TEXT NOT NULL,
        capabilities TEXT
      )
    `);

    // FTS5 virtual table for full-text search
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        skill_name,
        description,
        content='skills',
        content_rowid='rowid',
        tokenize='porter unicode61'
      )
    `);

    // Triggers to keep FTS in sync
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
        INSERT INTO skills_fts(rowid, skill_name, description)
        VALUES (new.rowid, new.skill_name, new.description);
      END
    `);

    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, skill_name, description)
        VALUES ('delete', old.rowid, old.skill_name, old.description);
      END
    `);

    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, skill_name, description)
        VALUES ('delete', old.rowid, old.skill_name, old.description);
        INSERT INTO skills_fts(rowid, skill_name, description)
        VALUES (new.rowid, new.skill_name, new.description);
      END
    `);

    // Indexing metadata
    this.db.run(`
      CREATE TABLE IF NOT EXISTS indexing_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Indexes for common queries
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_skills_plugin ON skills(plugin_name)`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source)`
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_skills_path ON skills(skill_path)`
    );
  }

  /**
   * Prepare insert statement
   */
  private prepareInsert(): ReturnType<Database["prepare"]> {
    return this.db.prepare(`
      INSERT OR REPLACE INTO skills (
        id, source, plugin_name, skill_name, skill_path,
        description, allowed_tools, subskills, git_sha, last_indexed, capabilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * Prepare search statement
   */
  private prepareSearch(): ReturnType<Database["prepare"]> {
    return this.db.prepare(`
      SELECT s.rowid, s.* FROM skills s
      JOIN skills_fts fts ON s.rowid = fts.rowid
      WHERE skills_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
  }

  /**
   * Insert a single skill
   */
  insert(skill: SkillEntry): void {
    this.insertStmt.run(
      skill.id,
      skill.source,
      skill.pluginName,
      skill.skillName,
      skill.skillPath,
      skill.description,
      JSON.stringify(skill.allowedTools),
      JSON.stringify(skill.subskills),
      skill.gitSha,
      skill.lastIndexed,
      JSON.stringify(skill.capabilities)
    );
  }

  /**
   * Bulk insert with transaction (much faster for large imports)
   */
  bulkInsert(skills: SkillEntry[]): void {
    const transaction = this.db.transaction((skillsToInsert: SkillEntry[]) => {
      for (const skill of skillsToInsert) {
        this.insert(skill);
      }
    });
    transaction(skills);
  }

  /**
   * Delete a skill by path
   */
  deleteByPath(skillPath: string): void {
    this.db.run(`DELETE FROM skills WHERE skill_path = ?`, [skillPath]);
  }

  /**
   * Delete all skills from a source
   */
  deleteBySource(source: string): void {
    this.db.run(`DELETE FROM skills WHERE source = ?`, [source]);
  }

  /**
   * Search skills using FTS5
   */
  search(query: string, options?: SkillSearchOptions): SkillRecord[] {
    const limit = options?.limit ?? 50;

    // Handle empty or whitespace query
    if (!query.trim()) {
      return this.getAll(limit);
    }

    // Escape special FTS5 characters and format query
    const sanitizedQuery = this.sanitizeFtsQuery(query);

    const rows = this.searchStmt.all(sanitizedQuery, limit) as unknown[];
    return rows.map((row) => this.rowToRecord(row as Record<string, unknown>));
  }

  /**
   * Sanitize query for FTS5
   */
  private sanitizeFtsQuery(query: string): string {
    // Remove FTS5 special characters and add prefix matching
    const words = query
      .replace(/[":()^*-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    // Use prefix matching for partial word matches
    return words.map((w) => `"${w}"*`).join(" OR ");
  }

  /**
   * Get all skills (with optional limit)
   */
  getAll(limit: number = 1000): SkillRecord[] {
    const rows = this.db
      .prepare(`SELECT rowid, * FROM skills ORDER BY plugin_name, skill_name LIMIT ?`)
      .all(limit) as unknown[];
    return rows.map((row) => this.rowToRecord(row as Record<string, unknown>));
  }

  /**
   * Get all skills for a plugin
   */
  getByPlugin(pluginName: string): SkillRecord[] {
    const rows = this.db
      .prepare(`SELECT rowid, * FROM skills WHERE plugin_name = ? ORDER BY skill_name`)
      .all(pluginName) as unknown[];
    return rows.map((row) => this.rowToRecord(row as Record<string, unknown>));
  }

  /**
   * Get skill by ID
   */
  getById(id: string): SkillRecord | null {
    const row = this.db
      .prepare(`SELECT rowid, * FROM skills WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  /**
   * Get skill by path
   */
  getByPath(path: string): SkillRecord | null {
    const row = this.db
      .prepare(`SELECT rowid, * FROM skills WHERE skill_path = ?`)
      .get(path) as Record<string, unknown> | undefined;
    return row ? this.rowToRecord(row) : null;
  }

  /**
   * Get all skill paths and SHAs (for incremental update)
   */
  getAllPathsAndShas(): Map<string, string> {
    const rows = this.db
      .prepare(`SELECT skill_path, git_sha FROM skills`)
      .all() as Array<{ skill_path: string; git_sha: string }>;

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.skill_path, row.git_sha);
    }
    return map;
  }

  /**
   * Get skills by capability
   */
  getByCapability(capability: string): SkillRecord[] {
    const rows = this.db
      .prepare(
        `SELECT rowid, * FROM skills WHERE capabilities LIKE ? ORDER BY plugin_name, skill_name`
      )
      .all(`%"${capability}"%`) as unknown[];
    return rows.map((row) => this.rowToRecord(row as Record<string, unknown>));
  }

  /**
   * Get catalog statistics
   */
  getStats(): SkillCatalogStats {
    const totalSkills = (
      this.db.prepare(`SELECT COUNT(*) as count FROM skills`).get() as {
        count: number;
      }
    ).count;

    const pluginCounts = this.db
      .prepare(
        `SELECT plugin_name, COUNT(*) as count FROM skills GROUP BY plugin_name ORDER BY count DESC`
      )
      .all() as Array<{ plugin_name: string; count: number }>;

    // Count tools usage
    const allTools = this.db
      .prepare(`SELECT allowed_tools FROM skills`)
      .all() as Array<{ allowed_tools: string }>;

    const toolCounts: Record<string, number> = {};
    for (const row of allTools) {
      try {
        const tools = JSON.parse(row.allowed_tools) as string[];
        for (const tool of tools) {
          toolCounts[tool] = (toolCounts[tool] ?? 0) + 1;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return {
      totalSkills,
      totalPlugins: pluginCounts.length,
      lastFullScan: this.getMeta("last_full_scan"),
      lastIncrementalScan: this.getMeta("last_incremental_scan"),
      byPlugin: Object.fromEntries(
        pluginCounts.map((r) => [r.plugin_name, r.count])
      ),
      byTool: toolCounts,
    };
  }

  /**
   * Get unique plugin names
   */
  getPluginNames(): string[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT plugin_name FROM skills ORDER BY plugin_name`)
      .all() as Array<{ plugin_name: string }>;
    return rows.map((r) => r.plugin_name);
  }

  /**
   * Mark indexing complete
   */
  markIndexed(key: "last_full_scan" | "last_incremental_scan"): void {
    const timestamp = new Date().toISOString();
    this.db.run(
      `INSERT OR REPLACE INTO indexing_meta (key, value) VALUES (?, ?)`,
      [key, timestamp]
    );
  }

  /**
   * Get metadata value
   */
  private getMeta(key: string): string | null {
    const row = this.db
      .prepare(`SELECT value FROM indexing_meta WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  /**
   * Convert database row to SkillRecord
   */
  private rowToRecord(row: Record<string, unknown>): SkillRecord {
    return {
      rowid: row.rowid as number,
      id: row.id as string,
      source: row.source as string,
      pluginName: row.plugin_name as string,
      skillName: row.skill_name as string,
      skillPath: row.skill_path as string,
      description: (row.description as string) ?? "",
      allowedTools: this.parseJsonArray(row.allowed_tools as string),
      subskills: this.parseJsonArray(row.subskills as string),
      gitSha: row.git_sha as string,
      lastIndexed: row.last_indexed as string,
      capabilities: this.parseJsonArray(row.capabilities as string),
    };
  }

  /**
   * Safely parse JSON array
   */
  private parseJsonArray(json: string | null): string[] {
    if (!json) return [];
    try {
      return JSON.parse(json) as string[];
    } catch {
      return [];
    }
  }

  /**
   * Rebuild FTS index (use after bulk operations if triggers fail)
   */
  rebuildFtsIndex(): void {
    this.db.run(`INSERT INTO skills_fts(skills_fts) VALUES ('rebuild')`);
  }

  /**
   * Optimize database
   */
  optimize(): void {
    this.db.run(`PRAGMA optimize`);
    this.db.run(`INSERT INTO skills_fts(skills_fts) VALUES ('optimize')`);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
