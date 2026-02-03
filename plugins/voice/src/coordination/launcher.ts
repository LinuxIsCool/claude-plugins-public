/**
 * Voice Queue Daemon Launcher
 *
 * Handles auto-starting the daemon when needed.
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { QueueConfig } from "./config.js";
import { DEFAULT_CONFIG } from "./config.js";

// Get directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Check if daemon is running by checking socket and PID file.
 */
export function isDaemonRunning(config: Partial<QueueConfig> = {}): boolean {
  const socketPath = config.socketPath ?? DEFAULT_CONFIG.socketPath;
  const pidFile = config.pidFile ?? DEFAULT_CONFIG.pidFile;

  // Check if socket exists
  if (!existsSync(socketPath)) {
    return false;
  }

  // Check PID file
  if (existsSync(pidFile)) {
    try {
      const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
      // Check if process is running
      try {
        process.kill(pid, 0); // Signal 0 just checks if process exists
        return true;
      } catch {
        // Process not running, clean up stale files
        unlinkSync(pidFile);
        if (existsSync(socketPath)) {
          unlinkSync(socketPath);
        }
        return false;
      }
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Wait for socket file to appear.
 */
async function waitForSocket(
  socketPath: string,
  timeoutMs: number
): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 100; // Check every 100ms

  while (Date.now() - startTime < timeoutMs) {
    if (existsSync(socketPath)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  return false;
}

/**
 * Start the daemon process.
 */
export async function startDaemon(
  config: Partial<QueueConfig> = {}
): Promise<boolean> {
  const socketPath = config.socketPath ?? DEFAULT_CONFIG.socketPath;
  const pidFile = config.pidFile ?? DEFAULT_CONFIG.pidFile;
  const logFile = config.logFile ?? DEFAULT_CONFIG.logFile;
  const timeout = config.daemonStartTimeoutMs ?? DEFAULT_CONFIG.daemonStartTimeoutMs;

  // Path to daemon script - use bin entry point (Bun handles .ts directly)
  const scriptPath = join(__dirname, "..", "..", "bin", "voice-daemon.ts");

  if (!existsSync(scriptPath)) {
    console.error(`[VoiceQueueLauncher] Daemon script not found at ${scriptPath}`);
    return false;
  }

  try {
    // Spawn daemon as detached process
    const proc = spawn("bun", ["run", scriptPath], {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        ...process.env,
        VOICE_QUEUE_SOCKET_PATH: socketPath,
        VOICE_QUEUE_PID_FILE: pidFile,
        VOICE_QUEUE_LOG_FILE: logFile,
      },
    });

    // Detach from parent
    proc.unref();

    // Wait for socket to appear
    return await waitForSocket(socketPath, timeout);
  } catch (error) {
    return false;
  }
}

/**
 * Ensure daemon is running, starting it if needed.
 */
export async function ensureDaemonRunning(
  config: Partial<QueueConfig> = {}
): Promise<boolean> {
  // Check if already running
  if (isDaemonRunning(config)) {
    return true;
  }

  // Start daemon
  return await startDaemon(config);
}

/**
 * Stop the daemon by sending shutdown request.
 */
export async function stopDaemon(
  config: Partial<QueueConfig> = {}
): Promise<boolean> {
  const pidFile = config.pidFile ?? DEFAULT_CONFIG.pidFile;
  const socketPath = config.socketPath ?? DEFAULT_CONFIG.socketPath;

  if (!existsSync(pidFile)) {
    return true; // Already stopped
  }

  try {
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);

    // Send SIGTERM
    process.kill(pid, "SIGTERM");

    // Wait for process to exit
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      try {
        process.kill(pid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        // Process exited
        break;
      }
    }

    // Clean up files
    if (existsSync(pidFile)) {
      unlinkSync(pidFile);
    }
    if (existsSync(socketPath)) {
      unlinkSync(socketPath);
    }

    return true;
  } catch {
    return false;
  }
}
