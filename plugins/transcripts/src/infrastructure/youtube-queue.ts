/**
 * YouTube Ingestion Queue
 *
 * Rate-limit-aware queue for ingesting YouTube transcripts over time.
 * Maintains persistent state so ingestion can resume across sessions.
 *
 * Storage: .claude/transcripts/youtube-queue/
 * ├── state.json           # Queue state (backoff, last run)
 * ├── channels.json        # Subscribed channels
 * └── queue.jsonl          # Pending video queue (append-only)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  listChannelVideos,
  ingestVideo,
  getCachedTranscript,
  type ChannelVideo,
  type IngestOptions,
} from "../adapters/ingestion/youtube.js";

// ============================================================================
// Types
// ============================================================================

export interface ChannelSubscription {
  id: string;                    // Channel handle or ID
  name: string;                  // Display name
  url: string;                   // Full channel URL
  priority: "high" | "medium" | "low";
  added_at: number;              // Timestamp
  last_checked: number;          // Last time we checked for new videos
  video_count: number;           // Known videos
  ingested_count: number;        // Successfully ingested
}

export interface QueuedVideo {
  id: string;                    // YouTube video ID
  channel_id: string;            // Channel subscription ID
  title: string;
  upload_date: string;           // YYYYMMDD
  status: "pending" | "processing" | "completed" | "failed" | "rate_limited";
  attempts: number;
  last_attempt: number | null;
  error: string | null;
  added_at: number;
}

export interface QueueState {
  is_rate_limited: boolean;
  rate_limit_until: number | null;     // Timestamp when to retry
  backoff_minutes: number;             // Current backoff (exponential)
  last_successful_ingest: number | null;
  total_ingested: number;
  total_failed: number;
  processing_enabled: boolean;
}

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  rate_limited: boolean;
  videos: Array<{
    id: string;
    title: string;
    status: "completed" | "failed" | "rate_limited";
    error?: string;
  }>;
}

// ============================================================================
// Rate Limit Detection
// ============================================================================

const RATE_LIMIT_PATTERNS = [
  /HTTP Error 429/i,
  /Too Many Requests/i,
  /rate.?limit/i,
  /quota.?exceeded/i,
  /sign in to confirm/i,           // YouTube anti-bot
  /Please sign in/i,
  /this video is unavailable/i,    // Sometimes indicates rate limit
  /unable to extract/i,
  /blocked/i,
];

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RATE_LIMIT_PATTERNS.some(pattern => pattern.test(message));
}

// ============================================================================
// Queue Manager
// ============================================================================

const DEFAULT_BASE_PATH = join(homedir(), ".claude", "transcripts", "youtube-queue");
const MIN_BACKOFF_MINUTES = 5;
const MAX_BACKOFF_MINUTES = 60 * 24;  // 24 hours
const VIDEOS_PER_BATCH = 5;           // Process 5 videos per run

export class YouTubeQueue {
  private basePath: string;
  private state: QueueState;
  private channels: Map<string, ChannelSubscription>;
  private queue: Map<string, QueuedVideo>;

  constructor(basePath = DEFAULT_BASE_PATH) {
    this.basePath = basePath;
    this.ensureDirectories();
    this.state = this.loadState();
    this.channels = this.loadChannels();
    this.queue = this.loadQueue();
  }

  // ===========================================================================
  // Directory & State Management
  // ===========================================================================

  private ensureDirectories(): void {
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  private loadState(): QueueState {
    const path = join(this.basePath, "state.json");
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8"));
    }
    return {
      is_rate_limited: false,
      rate_limit_until: null,
      backoff_minutes: MIN_BACKOFF_MINUTES,
      last_successful_ingest: null,
      total_ingested: 0,
      total_failed: 0,
      processing_enabled: true,
    };
  }

  private saveState(): void {
    const path = join(this.basePath, "state.json");
    writeFileSync(path, JSON.stringify(this.state, null, 2));
  }

  private loadChannels(): Map<string, ChannelSubscription> {
    const path = join(this.basePath, "channels.json");
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, "utf-8"));
      return new Map(Object.entries(data));
    }
    return new Map();
  }

  private saveChannels(): void {
    const path = join(this.basePath, "channels.json");
    const data = Object.fromEntries(this.channels.entries());
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  private loadQueue(): Map<string, QueuedVideo> {
    const path = join(this.basePath, "queue.jsonl");
    const queue = new Map<string, QueuedVideo>();

    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      for (const line of content.trim().split("\n")) {
        if (!line.trim()) continue;
        try {
          const video: QueuedVideo = JSON.parse(line);
          // Keep latest state for each video
          queue.set(video.id, video);
        } catch {
          // Skip malformed lines
        }
      }
    }

    return queue;
  }

  private appendToQueue(video: QueuedVideo): void {
    const path = join(this.basePath, "queue.jsonl");
    appendFileSync(path, JSON.stringify(video) + "\n");
    this.queue.set(video.id, video);
  }

  private updateQueueItem(video: QueuedVideo): void {
    this.queue.set(video.id, video);
    this.appendToQueue(video);  // Append new state (last wins on reload)
  }

  // ===========================================================================
  // Channel Subscription Management
  // ===========================================================================

  /**
   * Subscribe to a YouTube channel
   */
  async subscribe(
    channelUrlOrHandle: string,
    options: { name?: string; priority?: "high" | "medium" | "low" } = {}
  ): Promise<{ channel: ChannelSubscription; videosQueued: number }> {
    // Normalize URL
    let url = channelUrlOrHandle;
    if (!url.startsWith("http")) {
      url = `https://www.youtube.com/@${url.replace("@", "")}`;
    }

    // Extract ID from URL for deduplication
    const id = url.replace(/https?:\/\//, "").replace(/\//g, "_");

    // Check if already subscribed
    if (this.channels.has(id)) {
      const existing = this.channels.get(id)!;
      return { channel: existing, videosQueued: 0 };
    }

    // Fetch channel videos to get count and queue them
    const videos = await listChannelVideos(url, { limit: 200 });

    const channel: ChannelSubscription = {
      id,
      name: options.name || id.split("@").pop() || id,
      url,
      priority: options.priority || "medium",
      added_at: Date.now(),
      last_checked: Date.now(),
      video_count: videos.length,
      ingested_count: 0,
    };

    this.channels.set(id, channel);
    this.saveChannels();

    // Queue videos in reverse chronological order (newest first in queue = oldest processed first)
    // But we want oldest first so transcripts accumulate chronologically
    // So we reverse: oldest videos go into queue first, will be processed first
    const sortedVideos = [...videos].sort((a, b) => {
      // Sort by upload_date ascending (oldest first)
      return a.upload_date.localeCompare(b.upload_date);
    });

    let queued = 0;
    for (const video of sortedVideos) {
      if (!this.queue.has(video.id)) {
        this.appendToQueue({
          id: video.id,
          channel_id: id,
          title: video.title,
          upload_date: video.upload_date,
          status: "pending",
          attempts: 0,
          last_attempt: null,
          error: null,
          added_at: Date.now(),
        });
        queued++;
      }
    }

    return { channel, videosQueued: queued };
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channelId: string): boolean {
    if (this.channels.has(channelId)) {
      this.channels.delete(channelId);
      this.saveChannels();
      return true;
    }
    return false;
  }

  /**
   * List all subscribed channels
   */
  listChannels(): ChannelSubscription[] {
    return Array.from(this.channels.values());
  }

  /**
   * Check for new videos on subscribed channels
   */
  async checkForNewVideos(): Promise<{ channel: string; newVideos: number }[]> {
    const results: { channel: string; newVideos: number }[] = [];

    for (const channel of this.channels.values()) {
      try {
        const videos = await listChannelVideos(channel.url, { limit: 50 });
        let newCount = 0;

        for (const video of videos) {
          if (!this.queue.has(video.id)) {
            this.appendToQueue({
              id: video.id,
              channel_id: channel.id,
              title: video.title,
              upload_date: video.upload_date,
              status: "pending",
              attempts: 0,
              last_attempt: null,
              error: null,
              added_at: Date.now(),
            });
            newCount++;
          }
        }

        channel.last_checked = Date.now();
        channel.video_count = Math.max(channel.video_count, videos.length);

        if (newCount > 0) {
          results.push({ channel: channel.name, newVideos: newCount });
        }
      } catch (error) {
        // Log but don't fail the whole check
        console.error(`Failed to check channel ${channel.name}:`, error);
      }
    }

    this.saveChannels();
    return results;
  }

  // ===========================================================================
  // Queue Processing
  // ===========================================================================

  /**
   * Check if we should be processing (respects rate limits)
   */
  canProcess(): { can: boolean; reason?: string; retryIn?: number } {
    if (!this.state.processing_enabled) {
      return { can: false, reason: "Processing is disabled" };
    }

    if (this.state.is_rate_limited && this.state.rate_limit_until) {
      const now = Date.now();
      if (now < this.state.rate_limit_until) {
        const retryIn = Math.ceil((this.state.rate_limit_until - now) / 1000 / 60);
        return {
          can: false,
          reason: `Rate limited. Retry in ${retryIn} minutes`,
          retryIn,
        };
      }
      // Rate limit expired, reset
      this.state.is_rate_limited = false;
      this.state.rate_limit_until = null;
      this.saveState();
    }

    return { can: true };
  }

  /**
   * Process pending videos with rate limit awareness
   */
  async processQueue(
    options: IngestOptions = { mode: "auto" },
    batchSize = VIDEOS_PER_BATCH
  ): Promise<ProcessResult> {
    const checkResult = this.canProcess();
    if (!checkResult.can) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        rate_limited: true,
        videos: [],
      };
    }

    // Get pending videos sorted by priority and date
    const pending = Array.from(this.queue.values())
      .filter(v => v.status === "pending" || v.status === "rate_limited")
      .sort((a, b) => {
        // First by channel priority
        const chanA = this.channels.get(a.channel_id);
        const chanB = this.channels.get(b.channel_id);
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priA = chanA ? priorityOrder[chanA.priority] : 1;
        const priB = chanB ? priorityOrder[chanB.priority] : 1;
        if (priA !== priB) return priA - priB;

        // Then by upload date (oldest first for chronological accumulation)
        return a.upload_date.localeCompare(b.upload_date);
      })
      .slice(0, batchSize);

    const result: ProcessResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      rate_limited: false,
      videos: [],
    };

    for (const video of pending) {
      // Check if already cached (from direct ingestVideo calls)
      const cached = getCachedTranscript(video.id, { language: options.language });
      if (cached && cached.length > 0) {
        // Already have this transcript - mark as completed
        video.status = "completed";
        video.error = null;
        video.last_attempt = Date.now();
        this.updateQueueItem(video);

        // Update channel stats
        const channel = this.channels.get(video.channel_id);
        if (channel) {
          channel.ingested_count++;
          this.saveChannels();
        }

        this.state.total_ingested++;
        this.saveState();

        result.succeeded++;
        result.processed++;
        result.videos.push({
          id: video.id,
          title: video.title,
          status: "completed",
        });
        continue;
      }

      // Mark as processing
      video.status = "processing";
      video.attempts++;
      video.last_attempt = Date.now();
      this.updateQueueItem(video);

      try {
        // Attempt ingestion
        await ingestVideo(video.id, options);

        // Success!
        video.status = "completed";
        video.error = null;
        this.updateQueueItem(video);

        // Update channel stats
        const channel = this.channels.get(video.channel_id);
        if (channel) {
          channel.ingested_count++;
          this.saveChannels();
        }

        // Reset backoff on success
        this.state.backoff_minutes = MIN_BACKOFF_MINUTES;
        this.state.last_successful_ingest = Date.now();
        this.state.total_ingested++;
        this.saveState();

        result.succeeded++;
        result.videos.push({
          id: video.id,
          title: video.title,
          status: "completed",
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (isRateLimitError(error)) {
          // Rate limit hit - stop processing and set backoff
          video.status = "rate_limited";
          video.error = message;
          this.updateQueueItem(video);

          this.state.is_rate_limited = true;
          this.state.backoff_minutes = Math.min(
            this.state.backoff_minutes * 2,
            MAX_BACKOFF_MINUTES
          );
          this.state.rate_limit_until = Date.now() + this.state.backoff_minutes * 60 * 1000;
          this.saveState();

          result.rate_limited = true;
          result.videos.push({
            id: video.id,
            title: video.title,
            status: "rate_limited",
            error: `Rate limited. Backing off for ${this.state.backoff_minutes} minutes`,
          });

          // Stop processing batch
          break;

        } else {
          // Other error - mark as failed but continue
          video.status = "failed";
          video.error = message;
          this.updateQueueItem(video);

          this.state.total_failed++;
          this.saveState();

          result.failed++;
          result.videos.push({
            id: video.id,
            title: video.title,
            status: "failed",
            error: message,
          });
        }
      }

      result.processed++;
    }

    return result;
  }

  /**
   * Retry failed videos
   */
  retryFailed(): number {
    let count = 0;
    for (const video of this.queue.values()) {
      if (video.status === "failed") {
        video.status = "pending";
        video.error = null;
        this.updateQueueItem(video);
        count++;
      }
    }
    return count;
  }

  /**
   * Reconcile queue with cache - mark already-cached videos as completed
   * Useful after direct ingestVideo calls that bypassed the queue
   */
  reconcileWithCache(options: { language?: string } = {}): {
    reconciled: number;
    videos: Array<{ id: string; title: string }>;
  } {
    const reconciled: Array<{ id: string; title: string }> = [];

    for (const video of this.queue.values()) {
      if (video.status === "pending" || video.status === "rate_limited") {
        const cached = getCachedTranscript(video.id, { language: options.language });
        if (cached && cached.length > 0) {
          video.status = "completed";
          video.error = null;
          video.last_attempt = Date.now();
          this.updateQueueItem(video);

          // Update channel stats
          const channel = this.channels.get(video.channel_id);
          if (channel) {
            channel.ingested_count++;
          }

          this.state.total_ingested++;
          reconciled.push({ id: video.id, title: video.title });
        }
      }
    }

    if (reconciled.length > 0) {
      this.saveChannels();
      this.saveState();
    }

    return { reconciled: reconciled.length, videos: reconciled };
  }

  /**
   * Clear rate limit (manual override)
   */
  clearRateLimit(): void {
    this.state.is_rate_limited = false;
    this.state.rate_limit_until = null;
    this.state.backoff_minutes = MIN_BACKOFF_MINUTES;
    this.saveState();
  }

  /**
   * Enable/disable processing
   */
  setProcessingEnabled(enabled: boolean): void {
    this.state.processing_enabled = enabled;
    this.saveState();
  }

  // ===========================================================================
  // Status & Statistics
  // ===========================================================================

  /**
   * Get queue status
   */
  getStatus(): {
    state: QueueState;
    channels: number;
    queue: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      rate_limited: number;
    };
    canProcess: { can: boolean; reason?: string; retryIn?: number };
  } {
    const counts = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      rate_limited: 0,
    };

    for (const video of this.queue.values()) {
      counts.total++;
      counts[video.status]++;
    }

    return {
      state: { ...this.state },
      channels: this.channels.size,
      queue: counts,
      canProcess: this.canProcess(),
    };
  }

  /**
   * Get queue items with optional filtering
   */
  getQueueItems(options: {
    status?: QueuedVideo["status"];
    channel_id?: string;
    limit?: number;
  } = {}): QueuedVideo[] {
    let items = Array.from(this.queue.values());

    if (options.status) {
      items = items.filter(v => v.status === options.status);
    }
    if (options.channel_id) {
      items = items.filter(v => v.channel_id === options.channel_id);
    }

    // Sort by upload date (oldest first)
    items.sort((a, b) => a.upload_date.localeCompare(b.upload_date));

    if (options.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }
}

// ============================================================================
// Factory
// ============================================================================

let defaultQueue: YouTubeQueue | null = null;

export function getYouTubeQueue(basePath?: string): YouTubeQueue {
  if (!defaultQueue || basePath) {
    defaultQueue = new YouTubeQueue(basePath);
  }
  return defaultQueue;
}

export function createYouTubeQueue(basePath?: string): YouTubeQueue {
  return new YouTubeQueue(basePath);
}
