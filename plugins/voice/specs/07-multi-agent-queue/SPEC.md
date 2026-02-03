# Spec: Multi-Agent Voice Queue

**Component**: Voice Coordination
**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Dependencies**: TTS adapters, Voice Identity

---

## Overview

Implement a priority queue system for coordinating voice output from multiple agents. When multiple Claude instances or subagents generate responses simultaneously, this system ensures orderly, non-overlapping speech with appropriate prioritization.

## Goals

1. Queue-based voice output management
2. Priority-based ordering (critical > high > normal > low)
3. Interrupt handling for urgent messages
4. Speaker transition management (pauses between speakers)
5. Queue overflow protection

## Non-Goals

- Audio mixing (no simultaneous playback)
- Speech synthesis (uses existing TTS adapters)
- User voice input handling

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Multi-Agent Voice Queue                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Agents ──────────────────────────────────────┐             │
│  ├─ Main Claude                               │             │
│  ├─ Subagent (explore)                        │             │
│  ├─ Subagent (code-review)                    ▼             │
│  └─ System (notifications)          ┌─────────────────┐    │
│                                      │  Voice Queue    │    │
│                                      │  Manager        │    │
│                                      │  ┌───────────┐  │    │
│                                      │  │ Priority  │  │    │
│                                      │  │ Heap      │  │    │
│                                      │  │           │  │    │
│                                      │  │ ○ crit    │  │    │
│                                      │  │ ○ high    │  │    │
│                                      │  │ ○ norm    │  │    │
│                                      │  │ ○ low     │  │    │
│                                      │  └───────────┘  │    │
│                                      └────────┬────────┘    │
│                                               │             │
│                                      ┌────────▼────────┐    │
│                                      │   Playback      │    │
│                                      │   Controller    │    │
│                                      │   (TTS + Audio) │    │
│                                      └─────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

```typescript
// plugins/voice/specs/07-multi-agent-queue/src/types.ts

export enum VoicePriority {
  CRITICAL = 100,   // System errors, security alerts
  HIGH = 80,        // User requests, direct notifications
  NORMAL = 50,      // Agent responses
  LOW = 20,         // Background updates, greetings
  AMBIENT = 10,     // Optional enhancements
}

export interface VoiceQueueItem {
  id: string;                    // Unique item ID
  text: string;                  // Text to speak
  priority: VoicePriority;
  agentId?: string;              // Source agent
  sessionId?: string;            // Claude session ID
  voiceConfig: VoiceConfig;      // Voice settings
  timestamp: number;             // Enqueue time
  timeout?: number;              // Max wait time (ms)
  interruptAllowed: boolean;     // Can interrupt current playback
  onComplete?: () => void;       // Callback when spoken
  onSkipped?: () => void;        // Callback if dropped
}

export interface VoiceConfig {
  backend: string;               // TTS backend
  voiceId: string;               // Voice identifier
  settings?: {
    stability?: number;
    speed?: number;
    [key: string]: unknown;
  };
}

export interface QueueStats {
  queueLength: number;
  currentlyPlaying: VoiceQueueItem | null;
  itemsByPriority: Record<VoicePriority, number>;
  totalProcessed: number;
  totalDropped: number;
  avgWaitTimeMs: number;
}

export interface QueueConfig {
  maxQueueSize: number;          // Max items in queue
  maxWaitTimeMs: number;         // Default timeout
  speakerTransitionMs: number;   // Pause between speakers
  interruptThreshold: VoicePriority;  // Min priority to interrupt
}
```

---

## Implementation Guide

### File Structure

```
plugins/voice/specs/07-multi-agent-queue/
├── SPEC.md
├── src/
│   ├── types.ts                 # Type definitions
│   ├── queue-manager.ts         # Main queue logic
│   ├── playback-controller.ts   # TTS playback
│   └── index.ts                 # Exports
├── tests/
│   ├── queue-manager.test.ts
│   ├── playback.test.ts
│   └── integration.test.ts
└── README.md
```

### Queue Manager

```typescript
// plugins/voice/specs/07-multi-agent-queue/src/queue-manager.ts

import { EventEmitter } from "events";
import type {
  VoiceQueueItem,
  VoicePriority,
  QueueStats,
  QueueConfig,
} from "./types.js";

const DEFAULT_CONFIG: QueueConfig = {
  maxQueueSize: 50,
  maxWaitTimeMs: 30000,
  speakerTransitionMs: 300,
  interruptThreshold: VoicePriority.HIGH,
};

export class VoiceQueueManager extends EventEmitter {
  private queue: VoiceQueueItem[] = [];
  private currentItem: VoiceQueueItem | null = null;
  private isPlaying: boolean = false;
  private lastSpeaker: string | null = null;
  private config: QueueConfig;

  // Stats
  private totalProcessed: number = 0;
  private totalDropped: number = 0;
  private waitTimes: number[] = [];

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add item to the queue.
   */
  enqueue(item: Omit<VoiceQueueItem, "id" | "timestamp">): string {
    const id = this.generateId();
    const queueItem: VoiceQueueItem = {
      ...item,
      id,
      timestamp: Date.now(),
      timeout: item.timeout ?? this.config.maxWaitTimeMs,
      interruptAllowed: item.interruptAllowed ?? item.priority >= this.config.interruptThreshold,
    };

    // Check queue size
    if (this.queue.length >= this.config.maxQueueSize) {
      // Drop lowest priority item
      this.dropLowestPriority();
    }

    // Insert in priority order
    this.insertByPriority(queueItem);

    this.emit("enqueued", queueItem);

    // Check if should interrupt current playback
    if (this.shouldInterrupt(queueItem)) {
      this.emit("interrupt", queueItem);
    }

    // Start processing if not already
    if (!this.isPlaying) {
      this.processNext();
    }

    return id;
  }

  /**
   * Remove item from queue.
   */
  dequeue(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const [item] = this.queue.splice(index, 1);
      item.onSkipped?.();
      return true;
    }
    return false;
  }

  /**
   * Clear all items from queue.
   */
  clear(): void {
    for (const item of this.queue) {
      item.onSkipped?.();
      this.totalDropped++;
    }
    this.queue = [];
    this.emit("cleared");
  }

  /**
   * Get next item to play.
   */
  async processNext(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    // Remove expired items
    this.removeExpired();

    if (this.queue.length === 0) {
      return;
    }

    // Get highest priority item
    const item = this.queue.shift()!;
    this.currentItem = item;
    this.isPlaying = true;

    // Track wait time
    const waitTime = Date.now() - item.timestamp;
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > 100) {
      this.waitTimes.shift();
    }

    // Add speaker transition pause if different speaker
    if (this.lastSpeaker && this.lastSpeaker !== item.agentId) {
      await this.sleep(this.config.speakerTransitionMs);
    }

    this.emit("playing", item);

    // Actual playback handled by listener
    // This emits event and waits for playbackComplete to be called
  }

  /**
   * Called when playback completes.
   */
  playbackComplete(): void {
    if (this.currentItem) {
      this.currentItem.onComplete?.();
      this.lastSpeaker = this.currentItem.agentId ?? null;
      this.totalProcessed++;
    }

    this.currentItem = null;
    this.isPlaying = false;
    this.emit("completed");

    // Process next item
    this.processNext();
  }

  /**
   * Called when playback is interrupted.
   */
  playbackInterrupted(): void {
    if (this.currentItem) {
      // Re-queue with reduced priority? Or drop?
      this.currentItem.onSkipped?.();
    }

    this.currentItem = null;
    this.isPlaying = false;
    this.processNext();
  }

  /**
   * Get queue statistics.
   */
  getStats(): QueueStats {
    const itemsByPriority: Record<VoicePriority, number> = {
      [VoicePriority.CRITICAL]: 0,
      [VoicePriority.HIGH]: 0,
      [VoicePriority.NORMAL]: 0,
      [VoicePriority.LOW]: 0,
      [VoicePriority.AMBIENT]: 0,
    };

    for (const item of this.queue) {
      itemsByPriority[item.priority]++;
    }

    return {
      queueLength: this.queue.length,
      currentlyPlaying: this.currentItem,
      itemsByPriority,
      totalProcessed: this.totalProcessed,
      totalDropped: this.totalDropped,
      avgWaitTimeMs: this.waitTimes.length > 0
        ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length
        : 0,
    };
  }

  // Private methods

  private generateId(): string {
    return `vq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private insertByPriority(item: VoiceQueueItem): void {
    // Find insertion point (higher priority = earlier in queue)
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority > this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, item);
  }

  private dropLowestPriority(): void {
    if (this.queue.length === 0) return;

    // Find and remove lowest priority item
    let lowestIndex = this.queue.length - 1;
    let lowestPriority = this.queue[lowestIndex].priority;

    for (let i = this.queue.length - 2; i >= 0; i--) {
      if (this.queue[i].priority < lowestPriority) {
        lowestIndex = i;
        lowestPriority = this.queue[i].priority;
      }
    }

    const [dropped] = this.queue.splice(lowestIndex, 1);
    dropped.onSkipped?.();
    this.totalDropped++;
    this.emit("dropped", dropped);
  }

  private removeExpired(): void {
    const now = Date.now();
    this.queue = this.queue.filter(item => {
      const age = now - item.timestamp;
      if (item.timeout && age > item.timeout) {
        item.onSkipped?.();
        this.totalDropped++;
        return false;
      }
      return true;
    });
  }

  private shouldInterrupt(newItem: VoiceQueueItem): boolean {
    if (!this.isPlaying || !this.currentItem) {
      return false;
    }

    return (
      newItem.interruptAllowed &&
      newItem.priority >= this.config.interruptThreshold &&
      newItem.priority > this.currentItem.priority
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Playback Controller

```typescript
// plugins/voice/specs/07-multi-agent-queue/src/playback-controller.ts

import { VoiceQueueManager } from "./queue-manager.js";
import type { VoiceQueueItem, VoiceConfig } from "./types.js";
import { getDefaultTTSFactory, speakAndPlay } from "../../../src/adapters/tts/index.js";

export class PlaybackController {
  private queueManager: VoiceQueueManager;
  private currentAbortController: AbortController | null = null;

  constructor(queueManager: VoiceQueueManager) {
    this.queueManager = queueManager;

    // Listen for queue events
    this.queueManager.on("playing", this.handlePlay.bind(this));
    this.queueManager.on("interrupt", this.handleInterrupt.bind(this));
  }

  private async handlePlay(item: VoiceQueueItem): Promise<void> {
    this.currentAbortController = new AbortController();

    try {
      await this.synthesizeAndPlay(item);
      this.queueManager.playbackComplete();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        // Playback was interrupted
        this.queueManager.playbackInterrupted();
      } else {
        console.error("Playback error:", error);
        this.queueManager.playbackComplete();  // Continue queue even on error
      }
    }
  }

  private handleInterrupt(urgentItem: VoiceQueueItem): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  private async synthesizeAndPlay(item: VoiceQueueItem): Promise<void> {
    const factory = getDefaultTTSFactory();
    const backend = await factory.getWithFallback(item.voiceConfig.backend);

    // Check for abort before synthesis
    if (this.currentAbortController?.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const result = await backend.synthesize(item.text, {
      voiceId: item.voiceConfig.voiceId,
      ...item.voiceConfig.settings,
    });

    // Check for abort before playback
    if (this.currentAbortController?.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    await backend.play(result.audio);
  }

  /**
   * Convenience method to speak with queue.
   */
  async speak(
    text: string,
    voiceConfig: VoiceConfig,
    options: Partial<VoiceQueueItem> = {}
  ): Promise<string> {
    return this.queueManager.enqueue({
      text,
      voiceConfig,
      priority: options.priority ?? 50,
      agentId: options.agentId,
      sessionId: options.sessionId,
      timeout: options.timeout,
      interruptAllowed: options.interruptAllowed ?? false,
      onComplete: options.onComplete,
      onSkipped: options.onSkipped,
    });
  }
}
```

### Integration with Voice Hook

```typescript
// Example usage in voice-hook.ts

import { VoiceQueueManager, PlaybackController, VoicePriority } from "./multi-agent-queue";

// Global queue manager (singleton)
const queueManager = new VoiceQueueManager({
  maxQueueSize: 50,
  speakerTransitionMs: 300,
});

const playbackController = new PlaybackController(queueManager);

// In handleSubagentStop
async function handleSubagentStop(data: Record<string, unknown>, cwd: string): Promise<void> {
  const agentId = data.agent_id as string;
  const summary = getSubagentSummary(data);

  const voiceConfig = await resolveVoiceForAgent(agentId, cwd);

  await playbackController.speak(
    summary,
    voiceConfig.config,
    {
      priority: VoicePriority.NORMAL,
      agentId,
      sessionId: data.session_id as string,
    }
  );
}

// In handleNotification (higher priority)
async function handleNotification(data: Record<string, unknown>, cwd: string): Promise<void> {
  const message = data.message as string;

  await playbackController.speak(
    message,
    await resolveSystemVoice(cwd),
    {
      priority: VoicePriority.HIGH,
      interruptAllowed: true,
    }
  );
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/07-multi-agent-queue/tests/queue-manager.test.ts

import { VoiceQueueManager, VoicePriority } from "../src";

describe("VoiceQueueManager", () => {
  let manager: VoiceQueueManager;

  beforeEach(() => {
    manager = new VoiceQueueManager();
  });

  test("enqueues items in priority order", () => {
    manager.enqueue({ text: "low", priority: VoicePriority.LOW, voiceConfig: mockConfig() });
    manager.enqueue({ text: "high", priority: VoicePriority.HIGH, voiceConfig: mockConfig() });
    manager.enqueue({ text: "normal", priority: VoicePriority.NORMAL, voiceConfig: mockConfig() });

    const stats = manager.getStats();
    expect(stats.queueLength).toBe(3);

    // When processed, should be: high, normal, low
  });

  test("drops lowest priority when queue is full", () => {
    const manager = new VoiceQueueManager({ maxQueueSize: 2 });

    manager.enqueue({ text: "1", priority: VoicePriority.NORMAL, voiceConfig: mockConfig() });
    manager.enqueue({ text: "2", priority: VoicePriority.NORMAL, voiceConfig: mockConfig() });
    manager.enqueue({ text: "3", priority: VoicePriority.HIGH, voiceConfig: mockConfig() });

    const stats = manager.getStats();
    expect(stats.queueLength).toBe(2);
    expect(stats.totalDropped).toBe(1);
  });

  test("removes expired items", async () => {
    const manager = new VoiceQueueManager();

    manager.enqueue({
      text: "expires",
      priority: VoicePriority.LOW,
      voiceConfig: mockConfig(),
      timeout: 10,  // 10ms timeout
    });

    await sleep(50);

    // Trigger processing to clean expired
    manager.processNext();

    const stats = manager.getStats();
    expect(stats.queueLength).toBe(0);
  });

  test("emits interrupt event for high priority items", (done) => {
    const manager = new VoiceQueueManager();

    // Simulate playing
    manager.enqueue({ text: "playing", priority: VoicePriority.NORMAL, voiceConfig: mockConfig() });

    manager.on("interrupt", (item) => {
      expect(item.priority).toBe(VoicePriority.CRITICAL);
      done();
    });

    // Add critical item while playing
    manager.enqueue({
      text: "urgent",
      priority: VoicePriority.CRITICAL,
      voiceConfig: mockConfig(),
      interruptAllowed: true,
    });
  });
});

function mockConfig() {
  return { backend: "mock", voiceId: "test" };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Success Criteria

1. [ ] Queue orders items by priority correctly
2. [ ] Speaker transition pauses work
3. [ ] Interrupt handling works for urgent messages
4. [ ] Queue overflow protection drops lowest priority
5. [ ] Expired items are cleaned up
6. [ ] Stats tracking is accurate
7. [ ] Integration with voice hook works

---

## Deliverables

```
plugins/voice/specs/07-multi-agent-queue/
├── SPEC.md
├── src/
│   ├── types.ts
│   ├── queue-manager.ts
│   ├── playback-controller.ts
│   └── index.ts
├── tests/
│   ├── queue-manager.test.ts
│   ├── playback.test.ts
│   └── integration.test.ts
└── README.md
```
