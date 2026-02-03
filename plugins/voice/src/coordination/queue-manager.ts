/**
 * Voice Queue Manager
 *
 * Priority queue with OS-like scheduling semantics.
 * Manages ordering, interruption, and re-queue policies.
 */

import { EventEmitter } from "events";
import type {
  QueueItem,
  EnqueueRequest,
  QueueStats,
  QueueEvent,
  InterruptionPolicy,
} from "./types.js";
import { VoicePriority, generateQueueId } from "./types.js";
import type { QueueConfig } from "./config.js";
import { loadConfig } from "./config.js";

/**
 * Voice Queue Manager
 *
 * Implements priority-based scheduling for voice output.
 * Like an OS scheduler: higher priority items run first,
 * and can preempt lower priority items.
 */
export class QueueManager extends EventEmitter {
  private queue: QueueItem[] = [];
  private currentItem: QueueItem | null = null;
  private isPlaying: boolean = false;
  private lastSpeaker: string | null = null;

  // Statistics
  private totalProcessed: number = 0;
  private totalDropped: number = 0;
  private waitTimes: number[] = [];

  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = loadConfig(config);
  }

  /**
   * Add item to the queue.
   * Returns the queue ID and position.
   */
  enqueue(request: EnqueueRequest): { id: string; position: number } {
    const item: QueueItem = {
      id: generateQueueId(),
      text: request.text,
      priority: request.priority,
      timestamp: Date.now(),
      timeout: request.timeout ?? this.config.maxWaitTimeMs,
      sessionId: request.sessionId,
      agentId: request.agentId,
      voiceConfig: request.voiceConfig,
    };

    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      this.dropLowestPriority();
    }

    // Insert by priority (higher priority = earlier in queue)
    const position = this.insertByPriority(item);

    this.emitEvent({
      type: "enqueued",
      item,
      position,
    });

    // Check if should interrupt current playback
    if (this.shouldInterrupt(item)) {
      // Emit interrupt signal - daemon will handle actual interruption
      this.emitEvent({
        type: "interrupted",
        item: this.currentItem!,
        byItem: item,
      });
    }

    return { id: item.id, position };
  }

  /**
   * Remove item from queue (before it plays).
   */
  cancel(id: string): boolean {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index !== -1) {
      const [item] = this.queue.splice(index, 1);
      this.emitEvent({ type: "dropped", item, reason: "cancelled" });
      return true;
    }
    return false;
  }

  /**
   * Get the next item to play.
   * Called by daemon when ready for next item.
   */
  getNext(): QueueItem | null {
    // Remove expired items first
    this.removeExpired();

    if (this.queue.length === 0) {
      return null;
    }

    // Get highest priority item (first in sorted queue)
    const item = this.queue.shift()!;
    this.currentItem = item;
    this.isPlaying = true;

    // Track wait time
    const waitTime = Date.now() - item.timestamp;
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > 100) {
      this.waitTimes.shift(); // Keep last 100 for average
    }

    this.emitEvent({ type: "playing", item });

    return item;
  }

  /**
   * Mark current item as completed.
   */
  markCompleted(id: string, durationMs: number): void {
    if (this.currentItem?.id === id) {
      this.lastSpeaker = this.currentItem.agentId ?? null;
      this.totalProcessed++;

      this.emitEvent({
        type: "completed",
        item: this.currentItem,
        durationMs,
      });

      this.currentItem = null;
      this.isPlaying = false;
    }
  }

  /**
   * Mark current item as failed.
   */
  markFailed(id: string, error: string): void {
    if (this.currentItem?.id === id) {
      this.emitEvent({
        type: "failed",
        item: this.currentItem,
        error,
      });

      this.currentItem = null;
      this.isPlaying = false;
    }
  }

  /**
   * Handle interruption of current playback.
   * Applies configured re-queue policy.
   */
  handleInterruption(id: string): void {
    if (!this.currentItem || this.currentItem.id !== id) {
      return;
    }

    const item = this.currentItem;

    switch (this.config.interruptionPolicy) {
      case "drop":
        this.totalDropped++;
        this.emitEvent({
          type: "dropped",
          item,
          reason: "interrupted",
        });
        break;

      case "requeue_front":
        // Put at front of queue (plays next)
        this.queue.unshift(item);
        break;

      case "requeue_priority":
        // Re-insert at normal priority position
        this.insertByPriority(item);
        break;
    }

    this.currentItem = null;
    this.isPlaying = false;
  }

  /**
   * Get queue statistics.
   */
  getStats(): QueueStats {
    // Initialize from enum values to avoid hard-coded magic numbers
    const itemsByPriority: Record<VoicePriority, number> = {
      [VoicePriority.CRITICAL]: 0,
      [VoicePriority.HIGH]: 0,
      [VoicePriority.NORMAL]: 0,
      [VoicePriority.LOW]: 0,
      [VoicePriority.AMBIENT]: 0,
    };

    for (const item of this.queue) {
      if (item.priority in itemsByPriority) {
        itemsByPriority[item.priority]++;
      }
    }

    const avgWaitTimeMs =
      this.waitTimes.length > 0
        ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        : 0;

    return {
      queueLength: this.queue.length,
      currentItemId: this.currentItem?.id ?? null,
      itemsByPriority,
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      avgWaitTimeMs,
      isPlaying: this.isPlaying,
    };
  }

  /**
   * Get current playing item.
   */
  getCurrentItem(): QueueItem | null {
    return this.currentItem;
  }

  /**
   * Check if a different speaker is about to speak.
   * Used for adding transition pauses.
   */
  needsSpeakerTransition(item: QueueItem): boolean {
    return !!(this.lastSpeaker && this.lastSpeaker !== item.agentId);
  }

  /**
   * Get speaker transition delay in ms.
   */
  getSpeakerTransitionMs(): number {
    return this.config.speakerTransitionMs;
  }

  /**
   * Clear all items from queue.
   */
  clear(): void {
    for (const item of this.queue) {
      this.totalDropped++;
      this.emitEvent({ type: "dropped", item, reason: "cleared" });
    }
    this.queue = [];
  }

  // Private methods

  /**
   * Insert item in priority order.
   * Returns the position where item was inserted.
   */
  private insertByPriority(item: QueueItem): number {
    // Find insertion point (higher priority = earlier)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, item);
    return insertIndex;
  }

  /**
   * Drop the lowest priority item to make room.
   */
  private dropLowestPriority(): void {
    if (this.queue.length === 0) return;

    // Queue is sorted by priority (high to low), so last item is lowest
    const dropped = this.queue.pop()!;
    this.totalDropped++;

    this.emitEvent({
      type: "dropped",
      item: dropped,
      reason: "queue_full",
    });
  }

  /**
   * Remove expired items from queue.
   */
  private removeExpired(): void {
    const now = Date.now();
    this.queue = this.queue.filter((item) => {
      const age = now - item.timestamp;
      if (age > item.timeout) {
        this.totalDropped++;
        this.emitEvent({
          type: "dropped",
          item,
          reason: "expired",
        });
        return false;
      }
      return true;
    });
  }

  /**
   * Check if new item should interrupt current playback.
   */
  private shouldInterrupt(newItem: QueueItem): boolean {
    if (!this.isPlaying || !this.currentItem) {
      return false;
    }

    // New item must meet interrupt threshold
    if (newItem.priority < this.config.interruptThreshold) {
      return false;
    }

    // New item must be higher priority than current
    return newItem.priority > this.currentItem.priority;
  }

  /**
   * Emit a queue event.
   */
  private emitEvent(event: QueueEvent): void {
    this.emit("queue_event", event);
    this.emit(event.type, event);
  }
}
