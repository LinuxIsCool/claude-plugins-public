/**
 * Discord Import Checkpoint Manager
 *
 * Persists import progress to disk for resume capability.
 * Uses JSON files for simplicity and human readability.
 */

import { join } from "path";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { getMessagesBasePath } from "../../config";
import type {
  CheckpointState,
  ChannelProgress,
  DiscordImportOptions,
  DiscordImportStats,
  ImportProgress,
} from "./types";

/**
 * Get the checkpoint directory path
 */
function getCheckpointDir(): string {
  return join(getMessagesBasePath(), "discord-import/checkpoints");
}

/**
 * Generate a unique checkpoint ID
 */
function generateCheckpointId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `discord_${timestamp}_${random}`;
}

/**
 * Checkpoint Manager
 *
 * Handles persistence and recovery of import state.
 */
export class CheckpointManager {
  private checkpointDir: string;
  private state: CheckpointState | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private saveInProgress: Promise<void> | null = null; // Mutex for concurrent saves

  constructor() {
    this.checkpointDir = getCheckpointDir();
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.checkpointDir)) {
      mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  private getCheckpointPath(id: string): string {
    return join(this.checkpointDir, `${id}.json`);
  }

  /**
   * Create a new checkpoint session
   */
  async create(options: DiscordImportOptions): Promise<string> {
    const id = generateCheckpointId();

    this.state = {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      options,
      phase: "discovery",
      processedGuilds: [],
      processedChannels: [],
      processedThreads: [],
      channelProgress: {},
      stats: {
        messages: 0,
        guilds: 0,
        channels: 0,
        threads: 0,
        archivedThreads: 0,
        dms: 0,
        accounts: 0,
        skipped: 0,
        errors: 0,
        dateRange: {},
      },
    };

    await this.save();
    return id;
  }

  /**
   * Load an existing checkpoint
   */
  async load(id: string): Promise<CheckpointState | null> {
    const path = this.getCheckpointPath(id);

    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = await Bun.file(path).text();
      this.state = JSON.parse(content) as CheckpointState;

      // Convert date strings back to Date objects
      if (this.state.stats.dateRange.earliest) {
        this.state.stats.dateRange.earliest = new Date(this.state.stats.dateRange.earliest);
      }
      if (this.state.stats.dateRange.latest) {
        this.state.stats.dateRange.latest = new Date(this.state.stats.dateRange.latest);
      }

      return this.state;
    } catch (error) {
      console.error(`[checkpoint] Failed to load checkpoint ${id}:`, error);
      return null;
    }
  }

  /**
   * Get the current state
   */
  getState(): CheckpointState | null {
    return this.state;
  }

  /**
   * Save checkpoint to disk (serialized to prevent concurrent writes)
   */
  async save(): Promise<void> {
    if (!this.state) return;

    // Wait for any in-progress save to complete first
    if (this.saveInProgress) {
      await this.saveInProgress;
    }

    // Create the save promise
    this.saveInProgress = this.doSave();
    try {
      await this.saveInProgress;
    } finally {
      this.saveInProgress = null;
    }
  }

  /**
   * Internal save implementation
   */
  private async doSave(): Promise<void> {
    if (!this.state) return;

    this.state.updatedAt = Date.now();
    const path = this.getCheckpointPath(this.state.id);

    // Atomic write: write to temp file, then rename
    const tempPath = `${path}.tmp`;
    await Bun.write(tempPath, JSON.stringify(this.state, null, 2));

    // Rename for atomic update
    const fs = await import("fs/promises");
    await fs.rename(tempPath, path);

    this.dirty = false;
  }

  /**
   * Mark state as dirty (needs save)
   */
  markDirty(): void {
    this.dirty = true;

    // Debounced auto-save every 5 seconds if dirty
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(async () => {
        this.saveTimer = null;
        if (this.dirty) {
          await this.save();
        }
      }, 5000);
    }
  }

  /**
   * Update the current phase
   */
  setPhase(phase: ImportProgress["phase"]): void {
    if (!this.state) return;
    this.state.phase = phase;
    this.markDirty();
  }

  /**
   * Mark a guild as fully processed
   */
  markGuildProcessed(guildId: string): void {
    if (!this.state) return;
    if (!this.state.processedGuilds.includes(guildId)) {
      this.state.processedGuilds.push(guildId);
      this.state.stats.guilds++;
      this.markDirty();
    }
  }

  /**
   * Mark a channel as fully processed
   */
  markChannelProcessed(channelId: string): void {
    if (!this.state) return;
    if (!this.state.processedChannels.includes(channelId)) {
      this.state.processedChannels.push(channelId);
      this.state.stats.channels++;
      // Remove from partial progress
      delete this.state.channelProgress[channelId];
      this.markDirty();
    }
  }

  /**
   * Mark a thread as fully processed
   */
  markThreadProcessed(threadId: string, isArchived: boolean): void {
    if (!this.state) return;
    if (!this.state.processedThreads.includes(threadId)) {
      this.state.processedThreads.push(threadId);
      if (isArchived) {
        this.state.stats.archivedThreads++;
      } else {
        this.state.stats.threads++;
      }
      // Remove from partial progress
      delete this.state.channelProgress[threadId];
      this.markDirty();
    }
  }

  /**
   * Update progress for a partially-fetched channel
   */
  updateChannelProgress(channelId: string, progress: ChannelProgress): void {
    if (!this.state) return;
    this.state.channelProgress[channelId] = progress;
    this.markDirty();
  }

  /**
   * Get checkpoint for a specific channel
   */
  getChannelCheckpoint(channelId: string): ChannelProgress | undefined {
    return this.state?.channelProgress[channelId];
  }

  /**
   * Check if a channel is already fully processed
   */
  isChannelProcessed(channelId: string): boolean {
    if (!this.state) return false;
    return (
      this.state.processedChannels.includes(channelId) ||
      this.state.processedThreads.includes(channelId)
    );
  }

  /**
   * Increment message count
   */
  incrementMessages(count = 1): void {
    if (!this.state) return;
    this.state.stats.messages += count;
    this.markDirty();
  }

  /**
   * Increment skip count
   */
  incrementSkipped(count = 1): void {
    if (!this.state) return;
    this.state.stats.skipped += count;
    this.markDirty();
  }

  /**
   * Increment error count
   */
  incrementErrors(count = 1): void {
    if (!this.state) return;
    this.state.stats.errors += count;
    this.markDirty();
  }

  /**
   * Increment account count
   */
  incrementAccounts(count = 1): void {
    if (!this.state) return;
    this.state.stats.accounts += count;
    this.markDirty();
  }

  /**
   * Increment DM count
   */
  incrementDMs(count = 1): void {
    if (!this.state) return;
    this.state.stats.dms += count;
    this.markDirty();
  }

  /**
   * Update date range
   */
  updateDateRange(timestamp: number): void {
    if (!this.state) return;

    const date = new Date(timestamp);
    const range = this.state.stats.dateRange;

    if (!range.earliest || date < range.earliest) {
      range.earliest = date;
    }
    if (!range.latest || date > range.latest) {
      range.latest = date;
    }
    this.markDirty();
  }

  /**
   * Get final stats
   */
  getStats(startTime: number, resumed: boolean): DiscordImportStats {
    if (!this.state) {
      throw new Error("No active checkpoint");
    }

    return {
      ...this.state.stats,
      checkpointId: this.state.id,
      resumed,
      duration: Date.now() - startTime,
    };
  }

  /**
   * List available checkpoints
   */
  async list(): Promise<Array<{ id: string; createdAt: number; phase: string; messages: number }>> {
    const files = readdirSync(this.checkpointDir).filter((f) => f.endsWith(".json"));
    const checkpoints: Array<{ id: string; createdAt: number; phase: string; messages: number }> =
      [];

    for (const file of files) {
      try {
        const content = await Bun.file(join(this.checkpointDir, file)).text();
        const state = JSON.parse(content) as CheckpointState;
        checkpoints.push({
          id: state.id,
          createdAt: state.createdAt,
          phase: state.phase,
          messages: state.stats.messages,
        });
      } catch {
        // Skip invalid files
      }
    }

    return checkpoints.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Find the most recent incomplete checkpoint
   */
  async findResumable(): Promise<string | null> {
    const checkpoints = await this.list();

    for (const cp of checkpoints) {
      if (cp.phase !== "complete") {
        return cp.id;
      }
    }

    return null;
  }

  /**
   * Delete a checkpoint
   */
  async delete(id: string): Promise<void> {
    const path = this.getCheckpointPath(id);
    if (existsSync(path)) {
      unlinkSync(path);
    }
    if (this.state?.id === id) {
      this.state = null;
    }
  }

  /**
   * Mark checkpoint as complete
   */
  async complete(): Promise<void> {
    if (!this.state) return;
    this.state.phase = "complete";
    await this.save();
  }

  /**
   * Cleanup - ensure final save
   */
  async cleanup(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      await this.save();
    }
  }
}
