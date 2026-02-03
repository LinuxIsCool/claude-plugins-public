/**
 * Voice Queue Coordination Types
 *
 * Type definitions for the multi-agent voice queue daemon.
 * Implements priority-based scheduling like an OS scheduler.
 */

/**
 * Voice priority levels (higher number = higher priority)
 */
export enum VoicePriority {
  CRITICAL = 100, // System errors, security alerts
  HIGH = 80, // User requests, direct notifications
  NORMAL = 50, // Agent responses
  LOW = 20, // Background updates, greetings
  AMBIENT = 10, // Optional enhancements
}

/**
 * Re-export VoiceConfig from identity resolver (single source of truth)
 */
export type { VoiceConfig } from "../identity/resolver.js";

/**
 * Item in the voice queue
 */
export interface QueueItem {
  id: string;
  text: string;
  priority: VoicePriority;
  timestamp: number;
  timeout: number;
  sessionId?: string;
  agentId?: string;
  voiceConfig: VoiceConfig;
}

/**
 * Request to enqueue a voice item
 */
export interface EnqueueRequest {
  text: string;
  priority: VoicePriority;
  voiceConfig: VoiceConfig;
  sessionId?: string;
  agentId?: string;
  timeout?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  queueLength: number;
  currentItemId: string | null;
  itemsByPriority: Record<VoicePriority, number>;
  totalProcessed: number;
  totalDropped: number;
  avgWaitTimeMs: number;
  isPlaying: boolean;
}

/**
 * Re-queue policy for interrupted items
 */
export type InterruptionPolicy = "drop" | "requeue_front" | "requeue_priority";

/**
 * Base fields for all client messages
 */
interface ClientMessageBase {
  /** Request ID for correlating responses (optional for fire-and-forget messages) */
  requestId?: string;
}

/**
 * IPC message types - Client to Daemon
 */
export type ClientMessage =
  | (ClientMessageBase & { type: "enqueue"; payload: EnqueueRequest })
  | (ClientMessageBase & { type: "cancel"; id: string })
  | (ClientMessageBase & { type: "status" })
  | (ClientMessageBase & { type: "shutdown" })
  | { type: "playback_complete"; id: string; durationMs: number }
  | { type: "playback_failed"; id: string; error: string }
  | { type: "playback_interrupted"; id: string };

/**
 * Base fields for daemon responses
 */
interface DaemonResponseBase {
  /** Request ID echoed back for correlation */
  requestId?: string;
}

/**
 * IPC message types - Daemon to Client
 *
 * Response messages include requestId for correlation.
 * Push messages (play_now, abort) don't have requestId.
 */
export type DaemonMessage =
  // Response messages (correlated with requests)
  | (DaemonResponseBase & { type: "queued"; id: string; position: number })
  | (DaemonResponseBase & { type: "cancelled"; id: string })
  | (DaemonResponseBase & { type: "status"; stats: QueueStats })
  | (DaemonResponseBase & { type: "error"; message: string })
  | (DaemonResponseBase & { type: "shutdown_ack" })
  // Push messages (daemon-initiated, no requestId)
  | { type: "play_now"; id: string; item: QueueItem }
  | { type: "abort"; id: string; reason: string };

/**
 * Queue manager event types
 */
export type QueueEvent =
  | { type: "enqueued"; item: QueueItem; position: number }
  | { type: "dequeued"; item: QueueItem }
  | { type: "dropped"; item: QueueItem; reason: string }
  | { type: "playing"; item: QueueItem }
  | { type: "completed"; item: QueueItem; durationMs: number }
  | { type: "failed"; item: QueueItem; error: string }
  | { type: "interrupted"; item: QueueItem; byItem?: QueueItem };

/**
 * Connection state for IPC
 */
export interface ConnectionState {
  id: string;
  currentItemId: string | null;
  connectedAt: number;
}

/**
 * Generate a unique queue item ID
 */
export function generateQueueId(): string {
  return `vq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
