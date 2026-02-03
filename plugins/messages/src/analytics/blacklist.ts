/**
 * Thread Blacklist Management
 *
 * Loads and checks thread blacklist for filtering noise from analytics.
 * Blacklist is stored in .claude/messages/config/thread-blacklist.json
 *
 * Usage:
 *   const blacklist = loadBlacklist();
 *   if (blacklist.isBlacklisted(threadId)) { ... }
 */

import { existsSync, readFileSync } from "fs";
import { getClaudePath } from "../../../../lib/paths";

/**
 * A single blacklist entry with metadata
 */
export interface BlacklistEntry {
  thread_id: string;
  name?: string;
  reason?: string;
}

/**
 * Blacklist configuration file format
 */
export interface BlacklistConfig {
  description?: string;
  blacklist: BlacklistEntry[];
}

/**
 * Get the default blacklist config path
 */
export function getBlacklistPath(): string {
  return getClaudePath("messages/config/thread-blacklist.json");
}

/**
 * Thread Blacklist Manager
 *
 * Loads blacklist from JSON config and provides O(1) lookup.
 * Handles missing/invalid config gracefully (empty blacklist).
 */
export class ThreadBlacklist {
  private entries: Map<string, BlacklistEntry>;
  private configPath: string;
  private lastLoaded: number = 0;

  constructor(configPath?: string) {
    this.configPath = configPath ?? getBlacklistPath();
    this.entries = new Map();
    this.reload();
  }

  /**
   * Check if a thread is blacklisted
   */
  isBlacklisted(threadId: string): boolean {
    return this.entries.has(threadId);
  }

  /**
   * Get blacklist entry details for a thread
   */
  getEntry(threadId: string): BlacklistEntry | undefined {
    return this.entries.get(threadId);
  }

  /**
   * Get all blacklisted thread IDs
   */
  getThreadIds(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all entries with metadata
   */
  getEntries(): BlacklistEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get count of blacklisted threads
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Get last load timestamp
   */
  getLastLoaded(): number {
    return this.lastLoaded;
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Reload blacklist from disk
   *
   * Called automatically on construction.
   * Call manually to refresh after config changes.
   */
  reload(): void {
    if (!existsSync(this.configPath)) {
      this.entries.clear();
      this.lastLoaded = Date.now();
      return;
    }

    try {
      const content = readFileSync(this.configPath, "utf-8");
      const config: BlacklistConfig = JSON.parse(content);

      this.entries.clear();
      for (const entry of config.blacklist || []) {
        if (entry.thread_id) {
          this.entries.set(entry.thread_id, entry);
        }
      }

      this.lastLoaded = Date.now();
    } catch (error) {
      console.warn(`Failed to load blacklist from ${this.configPath}:`, error);
      this.entries.clear();
      this.lastLoaded = Date.now();
    }
  }
}

/**
 * Load blacklist (convenience function)
 *
 * Creates a new ThreadBlacklist instance.
 * For caching across multiple calls, create one instance and reuse it.
 */
export function loadBlacklist(configPath?: string): ThreadBlacklist {
  return new ThreadBlacklist(configPath);
}
