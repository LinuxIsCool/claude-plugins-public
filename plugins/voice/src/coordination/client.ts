/**
 * Voice Queue Client
 *
 * Client library for hooks to communicate with the voice queue daemon.
 * Handles connection, auto-start, and graceful fallback.
 */

import type { Socket } from "net";
import { createConnection } from "net";
import { existsSync } from "fs";
import type {
  ClientMessage,
  DaemonMessage,
  EnqueueRequest,
  QueueItem,
  QueueStats,
  VoicePriority,
  VoiceConfig,
} from "./types.js";
import { loadConfig, type QueueConfig } from "./config.js";
import { ensureDaemonRunning } from "./launcher.js";

/**
 * Voice Queue Client
 *
 * Connects to daemon, enqueues items, waits for play signal.
 * Falls back to direct playback if daemon unavailable.
 */
export class VoiceQueueClient {
  private socket: Socket | null = null;
  private config: QueueConfig;
  private connected: boolean = false;

  // Message handling
  private messageBuffer: string = "";
  private pendingCallbacks: Map<
    string,
    {
      resolve: (msg: DaemonMessage) => void;
      reject: (err: Error) => void;
    }
  > = new Map();
  private playSignalCallback:
    | ((item: QueueItem) => void)
    | null = null;
  private abortCallback: ((reason: string) => void) | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = loadConfig(config);
  }

  /**
   * Connect to the daemon.
   * Optionally auto-starts daemon if not running.
   */
  async connect(options: { autoStart?: boolean } = {}): Promise<void> {
    if (this.connected) {
      return;
    }

    const socketPath = this.config.socketPath;

    // Check if socket exists
    if (!existsSync(socketPath)) {
      if (options.autoStart) {
        const started = await ensureDaemonRunning(this.config);
        if (!started) {
          throw new Error("Failed to start voice queue daemon");
        }
      } else {
        throw new Error("Voice queue daemon not running");
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, this.config.connectTimeoutMs);

      this.socket = createConnection(socketPath, () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.socket.on("data", (data) => {
        this.handleData(data.toString());
      });

      this.socket.on("close", () => {
        this.connected = false;
        this.socket = null;
      });

      this.socket.on("error", (err) => {
        clearTimeout(timeout);
        this.connected = false;
        reject(err);
      });
    });
  }

  /**
   * Disconnect from daemon.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected to daemon.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Enqueue an item for playback.
   * Returns the queue ID.
   */
  async enqueue(request: EnqueueRequest): Promise<string> {
    this.assertConnected();

    const response = await this.sendAndWait<{ type: "queued"; id: string }>({
      type: "enqueue",
      payload: request,
    });

    return response.id;
  }

  /**
   * Wait for play signal from daemon.
   * Resolves when it's this client's turn to play.
   */
  waitForPlaySignal(
    timeoutMs: number = 30000
  ): Promise<QueueItem> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.playSignalCallback = null;
        reject(new Error("Play signal timeout"));
      }, timeoutMs);

      this.playSignalCallback = (item) => {
        clearTimeout(timeout);
        this.playSignalCallback = null;
        resolve(item);
      };
    });
  }

  /**
   * Set callback for abort signals.
   */
  onAbort(callback: (reason: string) => void): void {
    this.abortCallback = callback;
  }

  /**
   * Report playback completed.
   */
  async reportComplete(id: string, durationMs: number): Promise<void> {
    this.assertConnected();
    this.send({ type: "playback_complete", id, durationMs });
  }

  /**
   * Report playback failed.
   */
  async reportFailed(id: string, error: string): Promise<void> {
    this.assertConnected();
    this.send({ type: "playback_failed", id, error });
  }

  /**
   * Report playback was interrupted (by abort signal).
   */
  async reportInterrupted(id: string): Promise<void> {
    this.assertConnected();
    this.send({ type: "playback_interrupted", id });
  }

  /**
   * Cancel an item in the queue.
   */
  async cancel(id: string): Promise<boolean> {
    this.assertConnected();

    const response = await this.sendAndWait<
      { type: "cancelled" } | { type: "error"; message: string }
    >({
      type: "cancel",
      id,
    });

    return response.type === "cancelled";
  }

  /**
   * Get queue status.
   */
  async getStatus(): Promise<QueueStats> {
    this.assertConnected();

    const response = await this.sendAndWait<{
      type: "status";
      stats: QueueStats;
    }>({
      type: "status",
    });

    return response.stats;
  }

  /**
   * Request daemon shutdown.
   */
  async requestShutdown(): Promise<void> {
    this.assertConnected();
    await this.sendAndWait<{ type: "shutdown_ack" }>({ type: "shutdown" });
  }

  // Private methods

  private assertConnected(): void {
    if (!this.connected || !this.socket) {
      throw new Error("Not connected to voice queue daemon");
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket) {
      this.socket.write(JSON.stringify(message) + "\n");
    }
  }

  private sendAndWait<T extends DaemonMessage>(
    message: ClientMessage,
    timeoutMs: number = 5000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).slice(2);

      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(requestId);
        reject(new Error("Request timeout"));
      }, timeoutMs);

      this.pendingCallbacks.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timeout);
          this.pendingCallbacks.delete(requestId);
          resolve(msg as T);
        },
        reject: (err) => {
          clearTimeout(timeout);
          this.pendingCallbacks.delete(requestId);
          reject(err);
        },
      });

      // Include requestId in message for correlation
      this.send({ ...message, requestId });
    });
  }

  private handleData(data: string): void {
    this.messageBuffer += data;

    const lines = this.messageBuffer.split("\n");
    this.messageBuffer = lines.pop()!;

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as DaemonMessage;
          this.handleMessage(message);
        } catch (error) {
          // Log invalid JSON for debugging (protocol corruption, daemon malfunction, etc.)
          console.error(
            `[VoiceQueueClient] Invalid JSON from daemon: ${line.slice(0, 100)}${line.length > 100 ? "..." : ""}`,
            error
          );
        }
      }
    }
  }

  private handleMessage(message: DaemonMessage): void {
    // Handle push messages (daemon-initiated, no requestId)
    if (message.type === "play_now" && this.playSignalCallback) {
      this.playSignalCallback(message.item);
      return;
    }

    if (message.type === "abort" && this.abortCallback) {
      this.abortCallback(message.reason);
      return;
    }

    // Handle response messages (correlated by requestId)
    const requestId = "requestId" in message ? message.requestId : undefined;
    if (requestId && this.pendingCallbacks.has(requestId)) {
      const callback = this.pendingCallbacks.get(requestId)!;
      if (message.type === "error") {
        callback.reject(new Error(message.message));
      } else {
        callback.resolve(message);
      }
    }
  }
}

/**
 * Convenience function: Speak text through the queue.
 *
 * This is the main entry point for hooks.
 * Handles connection, queueing, waiting for turn, and playback.
 */
export async function queuedSpeak(
  text: string,
  priority: VoicePriority,
  voiceConfig: VoiceConfig,
  options: {
    sessionId?: string;
    agentId?: string;
    timeout?: number;
    onPlay: (item: QueueItem) => Promise<void>;
    onAbort?: () => void;
  }
): Promise<void> {
  const client = new VoiceQueueClient();

  try {
    // Connect with auto-start
    await client.connect({ autoStart: true });

    // Set up abort handler
    if (options.onAbort) {
      client.onAbort(() => {
        options.onAbort!();
      });
    }

    // Enqueue
    const queueId = await client.enqueue({
      text,
      priority,
      voiceConfig,
      sessionId: options.sessionId,
      agentId: options.agentId,
      timeout: options.timeout,
    });

    // Wait for play signal
    const item = await client.waitForPlaySignal();

    // Play (caller does actual TTS)
    const startTime = Date.now();
    try {
      await options.onPlay(item);
      const durationMs = Date.now() - startTime;
      await client.reportComplete(queueId, durationMs);
    } catch (error) {
      await client.reportFailed(
        queueId,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  } finally {
    client.disconnect();
  }
}
