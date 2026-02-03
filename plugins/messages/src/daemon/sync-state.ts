/**
 * Sync State Manager
 *
 * Type-safe watermark API for unified sync state management.
 * Provides platform-agnostic interface on top of StateManager.
 *
 * ID format: "platform:source:scope"
 * Examples:
 *   - "signal:desktop:_global" - Global Signal Desktop watermark
 *   - "signal:daemon:+12505551234" - Signal daemon per-conversation
 *   - "gmail:daemon:account123" - Gmail per-account UID
 *   - "discord:import:guild123:channel456" - Discord per-channel progress
 */

import { getStateManager, StateManager } from "./state-manager";

// =============================================================================
// Watermark Types
// =============================================================================

/**
 * Watermark type discriminator
 */
export type WatermarkType =
  | "timestamp" // Unix timestamp (ms)
  | "message_id" // String message ID
  | "uid" // IMAP UID (number)
  | "sequence" // Sequence number
  | "cursor" // Opaque pagination cursor
  | "composite"; // Complex JSON state

/**
 * Timestamp watermark (Signal, Email by date)
 */
export interface TimestampWatermark {
  type: "timestamp";
  value: number;
}

/**
 * Message ID watermark (Discord, Telegram)
 */
export interface MessageIdWatermark {
  type: "message_id";
  value: string;
  timestamp?: number; // Optional for ordering
}

/**
 * IMAP UID watermark (Gmail)
 */
export interface UidWatermark {
  type: "uid";
  value: number;
  validity?: number; // UIDVALIDITY
}

/**
 * Sequence number watermark
 */
export interface SequenceWatermark {
  type: "sequence";
  value: number;
}

/**
 * Cursor/pagination token watermark
 */
export interface CursorWatermark {
  type: "cursor";
  value: string;
}

/**
 * Composite watermark (complex state like Discord channel progress)
 */
export interface CompositeWatermark {
  type: "composite";
  value: Record<string, unknown>;
}

/**
 * Union of all watermark types
 */
export type Watermark =
  | TimestampWatermark
  | MessageIdWatermark
  | UidWatermark
  | SequenceWatermark
  | CursorWatermark
  | CompositeWatermark;

// =============================================================================
// Watermark Utilities
// =============================================================================

/**
 * Create a timestamp watermark
 */
export function createTimestampWatermark(value: number | Date): TimestampWatermark {
  return {
    type: "timestamp",
    value: typeof value === "number" ? value : value.getTime(),
  };
}

/**
 * Create a message ID watermark
 */
export function createMessageIdWatermark(
  value: string,
  timestamp?: number
): MessageIdWatermark {
  return {
    type: "message_id",
    value,
    timestamp,
  };
}

/**
 * Create a UID watermark
 */
export function createUidWatermark(value: number, validity?: number): UidWatermark {
  return {
    type: "uid",
    value,
    validity,
  };
}

/**
 * Create a sequence watermark
 */
export function createSequenceWatermark(value: number): SequenceWatermark {
  return {
    type: "sequence",
    value,
  };
}

/**
 * Create a cursor watermark
 */
export function createCursorWatermark(value: string): CursorWatermark {
  return {
    type: "cursor",
    value,
  };
}

/**
 * Create a composite watermark
 */
export function createCompositeWatermark(
  value: Record<string, unknown>
): CompositeWatermark {
  return {
    type: "composite",
    value,
  };
}

/**
 * Serialize watermark to string for storage
 */
function serializeWatermark(watermark: Watermark): string {
  return JSON.stringify(watermark);
}

/**
 * Deserialize watermark from storage
 */
function deserializeWatermark(serialized: string): Watermark {
  return JSON.parse(serialized) as Watermark;
}

// =============================================================================
// Sync State Manager
// =============================================================================

/**
 * Sync state entry with metadata
 */
export interface SyncStateEntry {
  id: string;
  platform: string;
  source: string;
  scope: string;
  watermark: Watermark;
  metadata: Record<string, unknown> | null;
  updatedAt: Date;
}

/**
 * Sync State Manager
 *
 * Provides type-safe watermark API for all platforms.
 */
export class SyncStateManager {
  private stateManager: StateManager;

  constructor(stateManager?: StateManager) {
    this.stateManager = stateManager ?? getStateManager();
  }

  // ===========================================================================
  // ID Management
  // ===========================================================================

  /**
   * Build a sync state ID from components
   */
  buildId(platform: string, source: string, scope: string): string {
    return `${platform}:${source}:${scope}`;
  }

  /**
   * Parse a sync state ID into components
   */
  parseId(id: string): { platform: string; source: string; scope: string } | null {
    const parts = id.split(":");
    if (parts.length < 3) return null;

    return {
      platform: parts[0],
      source: parts[1],
      scope: parts.slice(2).join(":"), // Scope can contain colons
    };
  }

  // ===========================================================================
  // Core Operations
  // ===========================================================================

  /**
   * Get watermark for a sync state ID
   */
  getWatermark(id: string): Watermark | null {
    const state = this.stateManager.loadSyncState(id);
    if (!state) return null;

    try {
      return deserializeWatermark(state.watermarkValue);
    } catch {
      return null;
    }
  }

  /**
   * Set watermark for a sync state ID
   */
  setWatermark(
    id: string,
    watermark: Watermark,
    metadata?: Record<string, unknown>
  ): void {
    const parsed = this.parseId(id);
    if (!parsed) {
      throw new Error(`Invalid sync state ID: ${id}`);
    }

    this.stateManager.saveSyncState(
      id,
      parsed.platform,
      parsed.source,
      parsed.scope,
      watermark.type,
      serializeWatermark(watermark),
      metadata
    );
  }

  /**
   * Delete a sync state
   */
  deleteWatermark(id: string): void {
    this.stateManager.deleteSyncState(id);
  }

  /**
   * Get full sync state entry
   */
  getEntry(id: string): SyncStateEntry | null {
    const state = this.stateManager.loadSyncState(id);
    if (!state) return null;

    try {
      return {
        id: state.id,
        platform: state.platform,
        source: state.source,
        scope: state.scope,
        watermark: deserializeWatermark(state.watermarkValue),
        metadata: state.metadata,
        updatedAt: new Date(state.updatedAt),
      };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Scoped Queries
  // ===========================================================================

  /**
   * Get all watermarks for a platform
   */
  getPlatformWatermarks(platform: string): Map<string, Watermark> {
    const states = this.stateManager.loadPlatformSyncStates(platform);
    const result = new Map<string, Watermark>();

    for (const state of states) {
      try {
        const watermark = deserializeWatermark(state.watermarkValue);
        result.set(state.id, watermark);
      } catch {
        // Skip invalid watermarks
      }
    }

    return result;
  }

  /**
   * Get all watermarks for a platform and source
   */
  getSourceWatermarks(platform: string, source: string): Map<string, Watermark> {
    const states = this.stateManager.loadSourceSyncStates(platform, source);
    const result = new Map<string, Watermark>();

    for (const state of states) {
      try {
        const watermark = deserializeWatermark(state.watermarkValue);
        const id = this.buildId(platform, source, state.scope);
        result.set(id, watermark);
      } catch {
        // Skip invalid watermarks
      }
    }

    return result;
  }

  /**
   * Get all entries for a platform
   */
  getPlatformEntries(platform: string): SyncStateEntry[] {
    const states = this.stateManager.loadPlatformSyncStates(platform);
    const result: SyncStateEntry[] = [];

    for (const state of states) {
      try {
        result.push({
          id: state.id,
          platform,
          source: state.source,
          scope: state.scope,
          watermark: deserializeWatermark(state.watermarkValue),
          metadata: state.metadata,
          updatedAt: new Date(state.updatedAt),
        });
      } catch {
        // Skip invalid entries
      }
    }

    return result;
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Get timestamp watermark value (returns null if not timestamp type)
   */
  getTimestamp(id: string): number | null {
    const watermark = this.getWatermark(id);
    if (watermark?.type === "timestamp") {
      return watermark.value;
    }
    return null;
  }

  /**
   * Set timestamp watermark
   */
  setTimestamp(
    platform: string,
    source: string,
    scope: string,
    value: number | Date,
    metadata?: Record<string, unknown>
  ): void {
    const id = this.buildId(platform, source, scope);
    this.setWatermark(id, createTimestampWatermark(value), metadata);
  }

  /**
   * Get UID watermark value (returns null if not UID type)
   */
  getUid(id: string): number | null {
    const watermark = this.getWatermark(id);
    if (watermark?.type === "uid") {
      return watermark.value;
    }
    return null;
  }

  /**
   * Set UID watermark
   */
  setUid(
    platform: string,
    source: string,
    scope: string,
    value: number,
    validity?: number,
    metadata?: Record<string, unknown>
  ): void {
    const id = this.buildId(platform, source, scope);
    this.setWatermark(id, createUidWatermark(value, validity), metadata);
  }

  /**
   * Get message ID watermark value (returns null if not message_id type)
   */
  getMessageId(id: string): string | null {
    const watermark = this.getWatermark(id);
    if (watermark?.type === "message_id") {
      return watermark.value;
    }
    return null;
  }

  /**
   * Set message ID watermark
   */
  setMessageId(
    platform: string,
    source: string,
    scope: string,
    value: string,
    timestamp?: number,
    metadata?: Record<string, unknown>
  ): void {
    const id = this.buildId(platform, source, scope);
    this.setWatermark(id, createMessageIdWatermark(value, timestamp), metadata);
  }
}

// =============================================================================
// Factory
// =============================================================================

let syncStateManagerInstance: SyncStateManager | null = null;

/**
 * Get or create sync state manager instance
 */
export function getSyncStateManager(): SyncStateManager {
  if (!syncStateManagerInstance) {
    syncStateManagerInstance = new SyncStateManager();
  }
  return syncStateManagerInstance;
}

/**
 * Reset sync state manager (for testing)
 */
export function resetSyncStateManager(): void {
  syncStateManagerInstance = null;
}
