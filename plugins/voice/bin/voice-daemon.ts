#!/usr/bin/env bun
/**
 * Voice Queue Daemon - Entry Point
 *
 * CLI for starting and managing the voice queue daemon.
 *
 * Usage:
 *   bun run bin/voice-daemon.ts          # Start daemon
 *   bun run bin/voice-daemon.ts start    # Start daemon
 *   bun run bin/voice-daemon.ts stop     # Stop daemon
 *   bun run bin/voice-daemon.ts status   # Check status
 */

import { VoiceQueueDaemon } from "../src/coordination/daemon.js";
import {
  isDaemonRunning,
  stopDaemon,
} from "../src/coordination/launcher.js";
import { VoiceQueueClient } from "../src/coordination/client.js";
import { loadConfig } from "../src/coordination/config.js";

const command = process.argv[2] || "start";
const config = loadConfig();

async function main(): Promise<void> {
  switch (command) {
    case "start":
      await startDaemon();
      break;

    case "stop":
      await stopDaemonCommand();
      break;

    case "status":
      await statusCommand();
      break;

    case "help":
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function startDaemon(): Promise<void> {
  if (isDaemonRunning(config)) {
    console.log("Daemon is already running");
    return;
  }

  console.log("Starting voice queue daemon...");
  const daemon = new VoiceQueueDaemon(config);
  await daemon.start();

  console.log(`Daemon started on ${config.socketPath}`);
  console.log(`PID file: ${config.pidFile}`);
  console.log(`Log file: ${config.logFile}`);
}

async function stopDaemonCommand(): Promise<void> {
  if (!isDaemonRunning(config)) {
    console.log("Daemon is not running");
    return;
  }

  console.log("Stopping daemon...");
  const stopped = await stopDaemon(config);

  if (stopped) {
    console.log("Daemon stopped");
  } else {
    console.error("Failed to stop daemon");
    process.exit(1);
  }
}

async function statusCommand(): Promise<void> {
  if (!isDaemonRunning(config)) {
    console.log("Status: NOT RUNNING");
    return;
  }

  console.log("Status: RUNNING");

  // Try to get queue stats
  try {
    const client = new VoiceQueueClient(config);
    await client.connect({ autoStart: false });
    const stats = await client.getStatus();
    client.disconnect();

    console.log("\nQueue Statistics:");
    console.log(`  Queue length: ${stats.queueLength}`);
    console.log(`  Currently playing: ${stats.isPlaying ? "Yes" : "No"}`);
    console.log(`  Total processed: ${stats.totalProcessed}`);
    console.log(`  Total dropped: ${stats.totalDropped}`);
    console.log(`  Avg wait time: ${stats.avgWaitTimeMs.toFixed(0)}ms`);
    console.log("\nItems by priority:");
    console.log(`  CRITICAL (100): ${stats.itemsByPriority[100] || 0}`);
    console.log(`  HIGH (80): ${stats.itemsByPriority[80] || 0}`);
    console.log(`  NORMAL (50): ${stats.itemsByPriority[50] || 0}`);
    console.log(`  LOW (20): ${stats.itemsByPriority[20] || 0}`);
    console.log(`  AMBIENT (10): ${stats.itemsByPriority[10] || 0}`);
  } catch (error) {
    console.log("\n(Could not retrieve queue statistics)");
  }
}

function printHelp(): void {
  console.log(`
Voice Queue Daemon

Usage:
  bun run bin/voice-daemon.ts [command]

Commands:
  start   Start the daemon (default)
  stop    Stop the daemon
  status  Show daemon status and queue statistics
  help    Show this help message

Environment Variables:
  VOICE_QUEUE_SOCKET_PATH       Unix socket path (default: /tmp/claude-voice.sock)
  VOICE_QUEUE_MAX_SIZE          Max queue size (default: 50)
  VOICE_QUEUE_MAX_WAIT_MS       Max wait time in ms (default: 30000)
  VOICE_QUEUE_INTERRUPTION_POLICY  drop|requeue_front|requeue_priority (default: requeue_front)
  VOICE_DAEMON_DEBUG            Set to 1 for debug output
`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
