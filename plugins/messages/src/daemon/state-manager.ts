/**
 * State Manager
 *
 * SQLite persistence for daemon state, sync cursors, and health metrics.
 * Enables crash recovery and state continuity across restarts.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getClaudePath } from "../../../../lib/paths";
import type {
  PlatformId,
  PlatformStatus,
  PersistedPlatformState,
} from "./types";

/**
 * Get the daemon database path
 */
export function getDaemonDbPath(): string {
  return getClaudePath("messages/daemon/state.db");
}

/**
 * Get the daemon log path
 */
export function getDaemonLogPath(): string {
  return getClaudePath("messages/daemon/daemon.log");
}

/**
 * State Manager - SQLite persistence for daemon
 */
export class StateManager {
  private db: Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? getDaemonDbPath();

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
    // Platform state table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS platform_state (
        platform TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        last_connected INTEGER,
        last_message INTEGER,
        last_error TEXT,
        error_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `);

    // Sync cursors for resumable sync
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_cursors (
        platform TEXT PRIMARY KEY,
        cursor TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Daemon metadata (shutdown state, etc.)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS daemon_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Health metrics history
    this.db.run(`
      CREATE TABLE IF NOT EXISTS health_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        healthy INTEGER NOT NULL,
        issues TEXT,
        checked_at INTEGER NOT NULL
      )
    `);

    // Index for health history queries
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_health_history_platform_time
      ON health_history(platform, checked_at DESC)
    `);

    // Unified sync state table (Phase 2 architecture)
    // Supports hierarchical scoping: platform:source:scope
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_state (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        source TEXT NOT NULL,
        scope TEXT NOT NULL,
        watermark_type TEXT NOT NULL,
        watermark_value TEXT NOT NULL,
        metadata TEXT,
        updated_at INTEGER NOT NULL,
        synced_at INTEGER
      )
    `);

    // Indexes for sync_state queries
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sync_state_platform
      ON sync_state(platform, updated_at DESC)
    `);
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_sync_state_source
      ON sync_state(platform, source, updated_at DESC)
    `);
  }

  // ===========================================================================
  // Platform State
  // ===========================================================================

  /**
   * Save platform state
   */
  savePlatformState(
    platform: PlatformId,
    status: PlatformStatus,
    state: {
      lastConnected?: Date;
      lastMessage?: Date;
      lastError?: string;
      errorCount?: number;
      messageCount?: number;
    }
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO platform_state (
        platform, status, last_connected, last_message,
        last_error, error_count, message_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      platform,
      status,
      state.lastConnected?.getTime() ?? null,
      state.lastMessage?.getTime() ?? null,
      state.lastError ?? null,
      state.errorCount ?? 0,
      state.messageCount ?? 0,
      Date.now()
    );
  }

  /**
   * Load platform state
   */
  loadPlatformState(platform: PlatformId): PersistedPlatformState | null {
    const stmt = this.db.prepare(`
      SELECT * FROM platform_state WHERE platform = ?
    `);

    const row = stmt.get(platform) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      platform: row.platform as PlatformId,
      status: row.status as PlatformStatus,
      last_connected: row.last_connected as number | null,
      last_message: row.last_message as number | null,
      last_error: row.last_error as string | null,
      error_count: row.error_count as number,
      message_count: row.message_count as number,
      updated_at: row.updated_at as number,
    };
  }

  /**
   * Load all platform states
   */
  loadAllPlatformStates(): PersistedPlatformState[] {
    const stmt = this.db.prepare(`SELECT * FROM platform_state`);
    const rows = stmt.all() as Record<string, unknown>[];

    return rows.map((row) => ({
      platform: row.platform as PlatformId,
      status: row.status as PlatformStatus,
      last_connected: row.last_connected as number | null,
      last_message: row.last_message as number | null,
      last_error: row.last_error as string | null,
      error_count: row.error_count as number,
      message_count: row.message_count as number,
      updated_at: row.updated_at as number,
    }));
  }

  // ===========================================================================
  // Sync Cursors
  // ===========================================================================

  /**
   * Save sync cursor for resumable sync
   */
  saveSyncCursor(platform: PlatformId, cursor: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_cursors (platform, cursor, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(platform, cursor, Date.now());
  }

  /**
   * Load sync cursor
   */
  loadSyncCursor(platform: PlatformId): string | null {
    const stmt = this.db.prepare(`
      SELECT cursor FROM sync_cursors WHERE platform = ?
    `);
    const row = stmt.get(platform) as { cursor: string } | undefined;
    return row?.cursor ?? null;
  }

  // ===========================================================================
  // Unified Sync State (Phase 2 Architecture)
  // ===========================================================================

  /**
   * Save sync state with typed watermark
   */
  saveSyncState(
    id: string,
    platform: string,
    source: string,
    scope: string,
    watermarkType: string,
    watermarkValue: string,
    metadata?: Record<string, unknown>
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sync_state (
        id, platform, source, scope, watermark_type, watermark_value,
        metadata, updated_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      platform,
      source,
      scope,
      watermarkType,
      watermarkValue,
      metadata ? JSON.stringify(metadata) : null,
      Date.now(),
      Date.now()
    );
  }

  /**
   * Load sync state by ID
   */
  loadSyncState(id: string): {
    id: string;
    platform: string;
    source: string;
    scope: string;
    watermarkType: string;
    watermarkValue: string;
    metadata: Record<string, unknown> | null;
    updatedAt: number;
    syncedAt: number | null;
  } | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_state WHERE id = ?
    `);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      platform: row.platform as string,
      source: row.source as string,
      scope: row.scope as string,
      watermarkType: row.watermark_type as string,
      watermarkValue: row.watermark_value as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      updatedAt: row.updated_at as number,
      syncedAt: row.synced_at as number | null,
    };
  }

  /**
   * Delete sync state
   */
  deleteSyncState(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM sync_state WHERE id = ?`);
    stmt.run(id);
  }

  /**
   * Load all sync states for a platform
   */
  loadPlatformSyncStates(platform: string): Array<{
    id: string;
    source: string;
    scope: string;
    watermarkType: string;
    watermarkValue: string;
    metadata: Record<string, unknown> | null;
    updatedAt: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_state WHERE platform = ? ORDER BY updated_at DESC
    `);
    const rows = stmt.all(platform) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      source: row.source as string,
      scope: row.scope as string,
      watermarkType: row.watermark_type as string,
      watermarkValue: row.watermark_value as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      updatedAt: row.updated_at as number,
    }));
  }

  /**
   * Load sync states for a platform and source
   */
  loadSourceSyncStates(platform: string, source: string): Array<{
    id: string;
    scope: string;
    watermarkType: string;
    watermarkValue: string;
    metadata: Record<string, unknown> | null;
    updatedAt: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_state
      WHERE platform = ? AND source = ?
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(platform, source) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      scope: row.scope as string,
      watermarkType: row.watermark_type as string,
      watermarkValue: row.watermark_value as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      updatedAt: row.updated_at as number,
    }));
  }

  // ===========================================================================
  // Daemon State
  // ===========================================================================

  /**
   * Record daemon shutdown state
   */
  recordShutdown(clean: boolean): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO daemon_state (key, value, updated_at)
      VALUES ('last_shutdown', ?, ?)
    `);
    stmt.run(clean ? "clean" : "crash", Date.now());
  }

  /**
   * Check if last shutdown was clean
   */
  wasCleanShutdown(): boolean {
    const stmt = this.db.prepare(`
      SELECT value FROM daemon_state WHERE key = 'last_shutdown'
    `);
    const row = stmt.get() as { value: string } | undefined;
    return row?.value === "clean";
  }

  /**
   * Record daemon start
   */
  recordStart(): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO daemon_state (key, value, updated_at)
      VALUES ('last_start', ?, ?)
    `);
    stmt.run(Date.now().toString(), Date.now());

    // Mark shutdown as not clean (until we explicitly clean shutdown)
    this.recordShutdown(false);
  }

  /**
   * Get last start time
   */
  getLastStartTime(): Date | null {
    const stmt = this.db.prepare(`
      SELECT value FROM daemon_state WHERE key = 'last_start'
    `);
    const row = stmt.get() as { value: string } | undefined;
    if (!row) return null;
    return new Date(parseInt(row.value, 10));
  }

  // ===========================================================================
  // Health History
  // ===========================================================================

  /**
   * Record health check result
   */
  recordHealthCheck(
    platform: PlatformId,
    healthy: boolean,
    issues: string[]
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO health_history (platform, healthy, issues, checked_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(platform, healthy ? 1 : 0, JSON.stringify(issues), Date.now());

    // Cleanup old entries (keep last 1000 per platform)
    this.db.run(`
      DELETE FROM health_history
      WHERE id NOT IN (
        SELECT id FROM health_history
        WHERE platform = ?
        ORDER BY checked_at DESC
        LIMIT 1000
      ) AND platform = ?
    `, [platform, platform]);
  }

  /**
   * Get recent health history for a platform
   */
  getHealthHistory(
    platform: PlatformId,
    limit = 100
  ): { healthy: boolean; issues: string[]; checkedAt: Date }[] {
    const stmt = this.db.prepare(`
      SELECT healthy, issues, checked_at
      FROM health_history
      WHERE platform = ?
      ORDER BY checked_at DESC
      LIMIT ?
    `);
    const rows = stmt.all(platform, limit) as {
      healthy: number;
      issues: string;
      checked_at: number;
    }[];

    return rows.map((row) => ({
      healthy: row.healthy === 1,
      issues: JSON.parse(row.issues),
      checkedAt: new Date(row.checked_at),
    }));
  }

  /**
   * Get error count within a time window
   */
  getRecentErrorCount(platform: PlatformId, windowMs: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM health_history
      WHERE platform = ?
        AND healthy = 0
        AND checked_at > ?
    `);
    const row = stmt.get(platform, Date.now() - windowMs) as { count: number };
    return row.count;
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let stateManagerInstance: StateManager | null = null;

/**
 * Get or create state manager instance
 */
export function getStateManager(dbPath?: string): StateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager(dbPath);
  }
  return stateManagerInstance;
}

/**
 * Reset state manager (for testing)
 */
export function resetStateManager(): void {
  if (stateManagerInstance) {
    stateManagerInstance.close();
    stateManagerInstance = null;
  }
}
