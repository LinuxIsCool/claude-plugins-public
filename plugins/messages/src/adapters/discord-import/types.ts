/**
 * Discord Historical Import Types
 *
 * Type definitions for bulk historical message ingestion.
 */

import type { DiscordChannelType } from "../../integrations/discord/types";

/**
 * Options for historical Discord import
 */
export interface DiscordImportOptions {
  /** Filter to specific guild IDs */
  guilds?: string[];
  /** Filter to specific channel IDs */
  channels?: string[];
  /** Filter by channel type */
  channelTypes?: DiscordChannelType[];
  /** Include threads (default: true) */
  includeThreads?: boolean;
  /** Include archived threads (default: true) */
  includeArchivedThreads?: boolean;
  /** Include DM channels (default: true) */
  includeDMs?: boolean;
  /** Only messages after this date */
  since?: Date;
  /** Only messages before this date */
  until?: Date;
  /** Max messages per channel (default: unlimited) */
  maxPerChannel?: number;

  // Parallelism
  /** Number of concurrent channel fetches (default: 3) */
  concurrentChannels?: number;
  /** Delay between batches in ms (default: 200) */
  delayBetweenBatches?: number;

  // Checkpointing
  /** Resume from existing checkpoint ID */
  checkpointId?: string;
  /** Save checkpoint every N messages (default: 100) */
  checkpointInterval?: number;

  // Progress
  /** Progress callback */
  onProgress?: (progress: ImportProgress) => void;
}

/**
 * Import progress data
 */
export interface ImportProgress {
  /** Current phase */
  phase: "discovery" | "importing" | "finalizing" | "complete";
  /** Total channels to process */
  channelsTotal: number;
  /** Channels completed */
  channelsCompleted: number;
  /** Currently processing channel names */
  channelsCurrent: string[];
  /** Messages imported so far */
  messagesImported: number;
  /** Threads discovered */
  threadsDiscovered: number;
  /** Errors encountered */
  errors: number;
  /** Elapsed time in ms */
  elapsed: number;
}

/**
 * Final import statistics
 */
export interface DiscordImportStats {
  /** Total messages imported */
  messages: number;
  /** Guilds processed */
  guilds: number;
  /** Channels processed */
  channels: number;
  /** Threads processed (active) */
  threads: number;
  /** Archived threads processed */
  archivedThreads: number;
  /** DM channels processed */
  dms: number;
  /** Accounts created/updated */
  accounts: number;
  /** Messages skipped (empty/filtered) */
  skipped: number;
  /** Errors encountered */
  errors: number;
  /** Whether this was a resumed import */
  resumed: boolean;
  /** Checkpoint ID for this import */
  checkpointId: string;
  /** Date range of imported messages */
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
  /** Total duration in ms */
  duration: number;
}

/**
 * Channel task for the worker pool
 */
export interface ChannelTask {
  /** Channel ID */
  channelId: string;
  /** Channel name for display */
  channelName: string;
  /** Channel type */
  channelType: "text" | "dm" | "thread" | "forum";
  /** Guild ID (undefined for DMs) */
  guildId?: string;
  /** Guild name for display */
  guildName?: string;
  /** Whether this is an archived thread */
  isArchivedThread?: boolean;
  /** Resume checkpoint for this channel */
  checkpoint?: ChannelProgress;
}

/**
 * Per-channel progress for checkpointing
 */
export interface ChannelProgress {
  /** Last fetched message ID (for pagination cursor) */
  lastMessageId: string;
  /** Messages fetched from this channel */
  messageCount: number;
}

/**
 * Checkpoint state persisted to disk
 */
export interface CheckpointState {
  /** Unique checkpoint ID */
  id: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Original import options */
  options: DiscordImportOptions;
  /** Current phase */
  phase: ImportProgress["phase"];
  /** Processed guilds */
  processedGuilds: string[];
  /** Fully processed channels */
  processedChannels: string[];
  /** Fully processed threads */
  processedThreads: string[];
  /** Per-channel progress (for partial channels) */
  channelProgress: Record<string, ChannelProgress>;
  /** Running statistics */
  stats: Omit<DiscordImportStats, "checkpointId" | "resumed" | "duration">;
}

/**
 * Count result for dry-run mode
 */
export interface DiscordCountResult {
  /** Number of guilds */
  guilds: number;
  /** Number of channels */
  channels: number;
  /** Number of threads (active) */
  threads: number;
  /** Number of archived threads */
  archivedThreads: number;
  /** Number of DM channels */
  dms: number;
  /** Estimated message count (based on channel metadata) */
  estimatedMessages: number;
  /** List of channels that would be processed */
  channelList: Array<{
    id: string;
    name: string;
    type: string;
    guildName?: string;
  }>;
}
