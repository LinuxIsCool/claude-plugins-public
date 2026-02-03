#!/usr/bin/env bun
/**
 * Voice Daemon Entry Point
 *
 * Starts the voice daemon with optional config file path.
 *
 * Usage:
 *   bun run src/daemon/start-daemon.ts
 *   bun run src/daemon/start-daemon.ts --config /path/to/daemon.yaml
 *   bun run src/daemon/start-daemon.ts -c ~/.config/claude-voice/daemon.yaml
 */

import { parseArgs } from "util";
import { createDaemon, VoiceDaemon } from "./daemon.js";
import { createSampleConfig } from "./config.js";

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    config: {
      type: "string",
      short: "c",
      description: "Path to configuration file",
    },
    "sample-config": {
      type: "boolean",
      description: "Print sample configuration and exit",
    },
    help: {
      type: "boolean",
      short: "h",
      description: "Show help",
    },
  },
  strict: true,
  allowPositionals: true,
});

// Show help
if (values.help) {
  console.log(`
Voice Daemon - Continuous speech-to-text transcription

Usage:
  bun run start-daemon.ts [options]

Options:
  -c, --config <path>    Path to YAML configuration file
  --sample-config        Print sample configuration and exit
  -h, --help             Show this help message

Config file locations (searched in order):
  1. ./daemon.yaml
  2. ~/.config/claude-voice/daemon.yaml

Examples:
  # Start with default config
  bun run start-daemon.ts

  # Start with custom config
  bun run start-daemon.ts -c /path/to/config.yaml

  # Generate sample config
  bun run start-daemon.ts --sample-config > daemon.yaml
`);
  process.exit(0);
}

// Print sample config
if (values["sample-config"]) {
  console.log(createSampleConfig());
  process.exit(0);
}

// Main function
async function main(): Promise<void> {
  console.log("=".repeat(50));
  console.log("Voice Daemon v0.1 - Dictation Mode");
  console.log("=".repeat(50));
  console.log("");

  let daemon: VoiceDaemon | null = null;

  // Setup signal handlers
  const shutdown = async (signal: string) => {
    console.log(`\n[daemon] Received ${signal}, shutting down...`);
    if (daemon) {
      await daemon.stop();
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    // Create and start daemon
    daemon = await createDaemon(values.config);

    // Subscribe to events for logging
    daemon.onEvent((event) => {
      switch (event.type) {
        case "state_change":
          console.log(`[daemon] State: ${event.from} → ${event.to}`);
          break;
        case "transcript":
          // Already logged by daemon, but could add extra handling here
          break;
        case "error":
          console.error("[daemon] Error:", event.error.message);
          break;
      }
    });

    console.log("[daemon] Starting... Press Ctrl+C to stop\n");
    await daemon.start();
  } catch (error) {
    console.error("[daemon] Fatal error:", error);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error("[daemon] Unhandled error:", error);
  process.exit(1);
});
