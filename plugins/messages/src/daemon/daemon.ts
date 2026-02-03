#!/usr/bin/env bun
/**
 * Messages Daemon
 *
 * Main entry point for the always-on messaging sync daemon.
 * Manages all platforms in a single process with health monitoring.
 *
 * Usage:
 *   bun run src/daemon/daemon.ts
 *
 * Or via CLI:
 *   messages daemon start
 */

// Load .env from repo root BEFORE any other imports that might read env vars
import { loadEnvFromRepoRoot } from "../../../../lib/paths";
loadEnvFromRepoRoot();

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { getOrchestrator, resetOrchestrator } from "./orchestrator";
import { getIpcServer, resetIpcServer } from "./ipc-server";
import type { DaemonConfig } from "./types";
import { DEFAULT_DAEMON_CONFIG } from "./types";

const DEFAULT_PID_PATH = "/tmp/messages-daemon.pid";

/**
 * Messages Daemon
 *
 * Main daemon class with lifecycle management.
 */
export class MessagesDaemon {
  private config: DaemonConfig;
  private pidPath: string;
  private shutdownInProgress = false;

  constructor(config: Partial<DaemonConfig> = {}) {
    this.config = { ...DEFAULT_DAEMON_CONFIG, ...config };
    this.pidPath = config.pidPath ?? DEFAULT_PID_PATH;
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    // Check if already running
    if (this.isRunning()) {
      const pid = this.getRunningPid();
      throw new Error(`Daemon already running with PID ${pid}`);
    }

    console.log("[daemon] Starting messages daemon...");

    // Write PID file
    this.writePidFile();

    // Set up signal handlers
    this.setupSignalHandlers();

    try {
      // Initialize orchestrator
      const orchestrator = getOrchestrator(this.config);

      // Start IPC server
      const ipcServer = getIpcServer(orchestrator, this.config.socketPath);
      await ipcServer.start();

      // Start orchestrator (which starts all platforms)
      await orchestrator.start();

      console.log("[daemon] Daemon started successfully");
      console.log(`[daemon] PID: ${process.pid}`);
      console.log(`[daemon] Socket: ${this.config.socketPath}`);

      // Keep process alive
      await this.keepAlive();
    } catch (error) {
      console.error("[daemon] Failed to start:", error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    console.log("[daemon] Stopping...");

    try {
      const orchestrator = getOrchestrator();
      await orchestrator.stop();

      resetIpcServer();
      resetOrchestrator();
    } catch (error) {
      console.error("[daemon] Error during shutdown:", error);
    }

    this.cleanup();
    console.log("[daemon] Stopped");
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    const pid = this.getRunningPid();
    if (!pid) return false;

    // Check if process exists
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      // Process doesn't exist, clean up stale PID file
      this.removePidFile();
      return false;
    }
  }

  /**
   * Get PID of running daemon
   */
  getRunningPid(): number | null {
    if (!existsSync(this.pidPath)) {
      return null;
    }

    try {
      const content = readFileSync(this.pidPath, "utf-8").trim();
      const pid = parseInt(content, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private writePidFile(): void {
    writeFileSync(this.pidPath, process.pid.toString());
  }

  private removePidFile(): void {
    if (existsSync(this.pidPath)) {
      try {
        unlinkSync(this.pidPath);
      } catch {
        // Ignore errors
      }
    }
  }

  private cleanup(): void {
    this.removePidFile();
  }

  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`[daemon] Received ${signal}`);
      await this.stop();
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      console.error("[daemon] Uncaught exception:", error);
      this.stop().finally(() => process.exit(1));
    });

    process.on("unhandledRejection", (reason) => {
      console.error("[daemon] Unhandled rejection:", reason);
    });
  }

  private async keepAlive(): Promise<void> {
    // Keep the process running
    return new Promise(() => {
      // This promise never resolves - the daemon runs until stopped
    });
  }
}

// ===========================================================================
// Main
// ===========================================================================

async function main(): Promise<void> {
  const daemon = new MessagesDaemon();

  try {
    await daemon.start();
  } catch (error) {
    console.error("[daemon] Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

