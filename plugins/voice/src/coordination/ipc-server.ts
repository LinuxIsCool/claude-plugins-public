/**
 * Voice Queue IPC Server
 *
 * Unix socket server for voice queue coordination.
 * Handles client connections and message routing.
 */

import type { Socket, Server } from "net";
import { createServer, type AddressInfo } from "net";
import { unlinkSync, existsSync } from "fs";
import { EventEmitter } from "events";
import type {
  ClientMessage,
  DaemonMessage,
  QueueItem,
  ConnectionState,
} from "./types.js";
import { QueueManager } from "./queue-manager.js";
import type { QueueConfig } from "./config.js";
import { loadConfig } from "./config.js";

/**
 * IPC Server for Voice Queue Daemon
 *
 * Listens on Unix socket and coordinates voice playback
 * across multiple Claude instances.
 */
export class IPCServer extends EventEmitter {
  private server: Server | null = null;
  private connections: Map<string, Socket> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private queueManager: QueueManager;
  private config: QueueConfig;
  private connectionCounter: number = 0;

  // Track which connection is currently playing
  private playingConnectionId: string | null = null;

  constructor(queueManager: QueueManager, config: Partial<QueueConfig> = {}) {
    super();
    this.queueManager = queueManager;
    this.config = loadConfig(config);

    // Listen for queue events
    this.queueManager.on("interrupted", (event) => {
      this.handleQueueInterrupt(event);
    });
  }

  /**
   * Start the IPC server.
   */
  async start(): Promise<void> {
    const socketPath = this.config.socketPath;

    // Remove existing socket file if present
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });

      this.server.listen(socketPath, () => {
        this.emit("started", socketPath);
        resolve();
      });
    });
  }

  /**
   * Stop the IPC server.
   */
  async stop(): Promise<void> {
    // Close all connections
    for (const [connId, socket] of this.connections) {
      this.sendMessage(socket, { type: "shutdown_ack" });
      socket.end();
    }
    this.connections.clear();
    this.connectionStates.clear();

    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          // Clean up socket file
          if (existsSync(this.config.socketPath)) {
            unlinkSync(this.config.socketPath);
          }
          this.emit("stopped");
          resolve();
        });
      });
    }
  }

  /**
   * Process the queue - send play signal to next waiting client.
   * Called by daemon after playback completes or on new enqueue.
   */
  processQueue(): void {
    // Don't process if something is playing
    const stats = this.queueManager.getStats();
    if (stats.isPlaying) {
      return;
    }

    // Get next item
    const item = this.queueManager.getNext();
    if (!item) {
      return;
    }

    // Find connection waiting for this item
    // First, try to find the connection that enqueued it
    let targetConnId: string | null = null;

    for (const [connId, state] of this.connectionStates) {
      // Any waiting connection can play (round-robin if multiple waiting)
      if (!state.currentItemId) {
        targetConnId = connId;
        break;
      }
    }

    if (!targetConnId) {
      // No connection available - re-queue item
      // This shouldn't happen in normal operation
      this.queueManager.handleInterruption(item.id);
      return;
    }

    // Check if we need speaker transition pause
    if (this.queueManager.needsSpeakerTransition(item)) {
      setTimeout(() => {
        this.signalPlayNow(targetConnId!, item);
      }, this.queueManager.getSpeakerTransitionMs());
    } else {
      this.signalPlayNow(targetConnId, item);
    }
  }

  /**
   * Send play_now signal to a connection.
   */
  private signalPlayNow(connId: string, item: QueueItem): void {
    const socket = this.connections.get(connId);
    if (!socket) {
      // Connection gone - item will be handled by queue manager
      this.queueManager.markFailed(item.id, "connection_lost");
      this.processQueue();
      return;
    }

    // Update state
    const state = this.connectionStates.get(connId);
    if (state) {
      state.currentItemId = item.id;
    }
    this.playingConnectionId = connId;

    // Send play signal
    this.sendMessage(socket, {
      type: "play_now",
      id: item.id,
      item,
    });
  }

  /**
   * Handle new connection.
   */
  private handleConnection(socket: Socket): void {
    const connId = `conn-${++this.connectionCounter}`;

    this.connections.set(connId, socket);
    this.connectionStates.set(connId, {
      id: connId,
      currentItemId: null,
      connectedAt: Date.now(),
    });

    this.emit("connection", connId);

    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited JSON)
      const lines = buffer.split("\n");
      buffer = lines.pop()!; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line) as ClientMessage;
            this.handleMessage(connId, socket, message);
          } catch (e) {
            this.sendMessage(socket, {
              type: "error",
              message: `Invalid JSON: ${e}`,
            });
          }
        }
      }
    });

    socket.on("close", () => {
      this.handleDisconnect(connId);
    });

    socket.on("error", (err) => {
      this.emit("connection_error", connId, err);
      this.handleDisconnect(connId);
    });
  }

  /**
   * Handle client message.
   */
  private handleMessage(
    connId: string,
    socket: Socket,
    message: ClientMessage
  ): void {
    // Extract requestId for response correlation
    const requestId = "requestId" in message ? message.requestId : undefined;

    switch (message.type) {
      case "enqueue": {
        const result = this.queueManager.enqueue(message.payload);
        this.sendMessage(socket, {
          type: "queued",
          id: result.id,
          position: result.position,
          requestId,
        });
        // Process queue in case this connection should play immediately
        this.processQueue();
        break;
      }

      case "cancel": {
        const cancelled = this.queueManager.cancel(message.id);
        if (cancelled) {
          this.sendMessage(socket, { type: "cancelled", id: message.id, requestId });
        } else {
          this.sendMessage(socket, {
            type: "error",
            message: `Item ${message.id} not found in queue`,
            requestId,
          });
        }
        break;
      }

      case "status": {
        const stats = this.queueManager.getStats();
        this.sendMessage(socket, { type: "status", stats, requestId });
        break;
      }

      case "playback_complete": {
        this.queueManager.markCompleted(message.id, message.durationMs);
        this.clearPlayingState(connId);
        // Process next item
        this.processQueue();
        break;
      }

      case "playback_failed": {
        this.queueManager.markFailed(message.id, message.error);
        this.clearPlayingState(connId);
        // Process next item
        this.processQueue();
        break;
      }

      case "playback_interrupted": {
        this.queueManager.handleInterruption(message.id);
        this.clearPlayingState(connId);
        // Process next item (the interrupter)
        this.processQueue();
        break;
      }

      case "shutdown": {
        this.sendMessage(socket, { type: "shutdown_ack", requestId });
        this.emit("shutdown_requested", connId);
        break;
      }
    }
  }

  /**
   * Handle queue interrupt event.
   */
  private handleQueueInterrupt(event: { item: QueueItem; byItem?: QueueItem }): void {
    // Find connection playing the interrupted item
    if (this.playingConnectionId) {
      const socket = this.connections.get(this.playingConnectionId);
      if (socket) {
        this.sendMessage(socket, {
          type: "abort",
          id: event.item.id,
          reason: event.byItem
            ? `Preempted by higher priority item ${event.byItem.id}`
            : "Interrupted",
        });
      }
    }
  }

  /**
   * Handle client disconnect.
   */
  private handleDisconnect(connId: string): void {
    const state = this.connectionStates.get(connId);

    // If this connection was playing, mark as failed
    if (state?.currentItemId) {
      this.queueManager.markFailed(
        state.currentItemId,
        "client_disconnected"
      );
    }

    // Clean up playing state if this was the playing connection
    if (this.playingConnectionId === connId) {
      this.playingConnectionId = null;
    }

    this.connections.delete(connId);
    this.connectionStates.delete(connId);
    this.emit("disconnection", connId);

    // Process queue in case another connection is waiting
    this.processQueue();
  }

  /**
   * Clear playing state for a connection.
   */
  private clearPlayingState(connId: string): void {
    const state = this.connectionStates.get(connId);
    if (state) {
      state.currentItemId = null;
    }
    if (this.playingConnectionId === connId) {
      this.playingConnectionId = null;
    }
  }

  /**
   * Send message to a socket.
   */
  private sendMessage(socket: Socket, message: DaemonMessage): void {
    socket.write(JSON.stringify(message) + "\n");
  }

  /**
   * Get number of connected clients.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
