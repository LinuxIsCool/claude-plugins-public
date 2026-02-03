#!/usr/bin/env bun
/**
 * Voice Queue Daemon
 *
 * Main daemon process for multi-agent voice coordination.
 * Manages the priority queue and coordinates playback order.
 */

import { writeFileSync, unlinkSync, existsSync, appendFileSync } from "fs";
import { QueueManager } from "./queue-manager.js";
import { IPCServer } from "./ipc-server.js";
import { loadConfig, type QueueConfig } from "./config.js";
import type { QueueEvent } from "./types.js";

/**
 * Voice Queue Daemon
 *
 * Coordinates voice output from multiple Claude instances.
 * Acts as a scheduler - determines playback order but doesn't
 * perform TTS synthesis itself.
 */
export class VoiceQueueDaemon {
  private queueManager: QueueManager;
  private ipcServer: IPCServer;
  private config: QueueConfig;
  private running: boolean = false;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = loadConfig(config);
    this.queueManager = new QueueManager(this.config);
    this.ipcServer = new IPCServer(this.queueManager, this.config);

    // Wire up event logging
    this.queueManager.on("queue_event", (event: QueueEvent) => {
      this.logEvent(event);
    });

    this.ipcServer.on("connection", (connId: string) => {
      this.log(`Client connected: ${connId}`);
    });

    this.ipcServer.on("disconnection", (connId: string) => {
      this.log(`Client disconnected: ${connId}`);
    });

    this.ipcServer.on("error", (err: Error) => {
      this.log(`IPC error: ${err.message}`, "error");
    });

    this.ipcServer.on("shutdown_requested", () => {
      this.log("Shutdown requested by client");
      this.stop();
    });
  }

  /**
   * Start the daemon.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.log("Starting voice queue daemon...");

    // Write PID file
    this.writePidFile();

    // Set up signal handlers
    this.setupSignalHandlers();

    // Start IPC server
    await this.ipcServer.start();

    this.running = true;
    this.log(`Daemon started, listening on ${this.config.socketPath}`);
  }

  /**
   * Stop the daemon gracefully.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.log("Stopping voice queue daemon...");
    this.running = false;

    // Stop IPC server
    await this.ipcServer.stop();

    // Clear queue
    this.queueManager.clear();

    // Clean up PID file
    this.removePidFile();

    this.log("Daemon stopped");

    // Exit process
    process.exit(0);
  }

  /**
   * Write PID file.
   */
  private writePidFile(): void {
    writeFileSync(this.config.pidFile, String(process.pid));
  }

  /**
   * Remove PID file.
   */
  private removePidFile(): void {
    if (existsSync(this.config.pidFile)) {
      unlinkSync(this.config.pidFile);
    }
  }

  /**
   * Set up signal handlers for graceful shutdown.
   */
  private setupSignalHandlers(): void {
    process.on("SIGTERM", () => {
      this.log("Received SIGTERM");
      this.stop();
    });

    process.on("SIGINT", () => {
      this.log("Received SIGINT");
      this.stop();
    });

    process.on("uncaughtException", (err) => {
      this.log(`Uncaught exception: ${err.message}`, "error");
      this.stop();
    });

    process.on("unhandledRejection", (reason) => {
      this.log(`Unhandled rejection: ${reason}`, "error");
    });
  }

  /**
   * Log message to file.
   */
  private log(message: string, level: "info" | "error" = "info"): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    try {
      appendFileSync(this.config.logFile, line);
    } catch {
      // Ignore log errors
    }

    // Also log to stderr for debugging
    if (process.env.VOICE_DAEMON_DEBUG === "1") {
      console.error(`[voice-daemon] ${message}`);
    }
  }

  /**
   * Log queue event.
   */
  private logEvent(event: QueueEvent): void {
    const eventStr = JSON.stringify({
      type: event.type,
      itemId: "item" in event ? event.item.id : undefined,
      timestamp: Date.now(),
    });
    this.log(`Queue event: ${eventStr}`);
  }
}

/**
 * Main entry point when run directly.
 */
async function main(): Promise<void> {
  const daemon = new VoiceQueueDaemon();
  await daemon.start();

  // Keep process alive
  // The IPC server keeps the event loop running
}

// Run if executed directly
if (import.meta.main) {
  main().catch((err) => {
    console.error("Failed to start daemon:", err);
    process.exit(1);
  });
}
