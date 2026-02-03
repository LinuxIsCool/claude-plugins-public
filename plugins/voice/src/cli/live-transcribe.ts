#!/usr/bin/env bun
/**
 * Live Audio Transcription CLI
 *
 * Captures live audio from a specified device and transcribes it in chunks,
 * outputting to both console and a timestamped markdown file.
 *
 * Usage:
 *   bun run src/cli/live-transcribe.ts --device <device> [options]
 *
 * Options:
 *   --device, -d       Audio device name (required)
 *   --chunk-duration   Chunk duration in seconds (default: 60)
 *   --output, -o       Output directory (default: .claude/voice/transcripts)
 *   --model, -m        Whisper model (default: small)
 *   --language, -l     Force language (default: auto-detect)
 *   --verbose, -v      Show detailed timing info
 */

import { parseArgs } from "util";
import { existsSync, mkdirSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";

import { AudioInputStream } from "../daemon/audio-input.js";
import { pcmToWav } from "../daemon/daemon.js";
import { createWhisperAdapter, type WhisperConfig } from "../adapters/stt/whisper.js";
import { writeToTempFile, cleanupTempFile } from "../adapters/stt/base.js";
import { getClaudePath } from "../lib/paths.js";
import type { AudioChunk } from "../ports/stt.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LiveTranscribeOptions {
  device: string;
  chunkDuration: number;
  outputDir: string;
  model: string;
  language: string | null;
  verbose: boolean;
}

interface DrainResult {
  pcmBuffer: Buffer;
  durationMs: number;
  startTimeMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChunkAccumulator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accumulates audio chunks until a target duration is reached
 */
class ChunkAccumulator {
  private chunks: AudioChunk[] = [];
  private startTimeMs: number | null = null;
  private chunkDurationMs: number;

  constructor(chunkDurationSeconds: number) {
    this.chunkDurationMs = chunkDurationSeconds * 1000;
  }

  /**
   * Add a chunk to the accumulator
   * @returns true when chunk duration is reached
   */
  push(chunk: AudioChunk): boolean {
    if (this.startTimeMs === null) {
      this.startTimeMs = chunk.timestampMs;
    }
    this.chunks.push(chunk);

    const elapsed = chunk.timestampMs - this.startTimeMs;
    return elapsed >= this.chunkDurationMs;
  }

  /**
   * Drain accumulated chunks and reset
   */
  drain(): DrainResult {
    const pcmBuffer = Buffer.concat(this.chunks.map((c) => c.data));
    const durationMs =
      this.chunks.length > 0
        ? this.chunks[this.chunks.length - 1].timestampMs - (this.startTimeMs || 0)
        : 0;
    const startTimeMs = this.startTimeMs || 0;

    // Reset
    this.chunks = [];
    this.startTimeMs = null;

    return { pcmBuffer, durationMs, startTimeMs };
  }

  /**
   * Check if there's any accumulated data
   */
  hasData(): boolean {
    return this.chunks.length > 0;
  }

  /**
   * Get current accumulated duration in ms
   */
  getCurrentDurationMs(): number {
    if (this.chunks.length === 0 || this.startTimeMs === null) {
      return 0;
    }
    return this.chunks[this.chunks.length - 1].timestampMs - this.startTimeMs;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format milliseconds as HH:MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Create output file with frontmatter
 */
function createOutputFile(outputDir: string, options: LiveTranscribeOptions): string {
  // Ensure directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${timestamp}.md`;
  const filepath = join(outputDir, filename);

  // Write frontmatter
  const frontmatter = `---
created: ${now.toISOString()}
device: ${options.device}
model: ${options.model}
chunk_duration: ${options.chunkDuration}
language: ${options.language || "auto"}
---

# Live Transcription

`;

  writeFileSync(filepath, frontmatter);
  return filepath;
}

/**
 * Append transcript to markdown file
 */
function appendToMarkdown(filepath: string, startTimeMs: number, text: string): void {
  const timestamp = formatTime(startTimeMs);
  const content = `## ${timestamp}\n${text}\n\n`;
  appendFileSync(filepath, content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Parse arguments
  const { values } = parseArgs({
    options: {
      device: { type: "string", short: "d" },
      "chunk-duration": { type: "string", default: "60" },
      output: { type: "string", short: "o" },
      model: { type: "string", short: "m", default: "small" },
      language: { type: "string", short: "l" },
      verbose: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help || !values.device) {
    printHelp();
    process.exit(values.help ? 0 : 1);
  }

  const options: LiveTranscribeOptions = {
    device: values.device,
    chunkDuration: parseInt(values["chunk-duration"] || "60", 10),
    outputDir: values.output || getClaudePath("voice/transcripts"),
    model: values.model || "small",
    language: values.language || null,
    verbose: values.verbose || false,
  };

  // Initialize STT adapter
  console.log(`[live-transcribe] Initializing Whisper (model: ${options.model})...`);
  const whisperConfig: WhisperConfig = {
    model: options.model as "tiny" | "base" | "small" | "medium" | "large-v3",
  };
  const stt = createWhisperAdapter(whisperConfig);

  const available = await stt.isAvailable();
  if (!available) {
    console.error("[live-transcribe] Whisper is not available. Check your Python environment.");
    process.exit(1);
  }

  // Create output file
  const outputFile = createOutputFile(options.outputDir, options);
  console.log(`[live-transcribe] Output file: ${outputFile}`);

  // Initialize audio input
  const audioConfig = {
    device: options.device,
    sampleRate: 16000,
    channels: 1,
    chunkSize: 512,
  };
  const audioInput = new AudioInputStream(audioConfig);
  const accumulator = new ChunkAccumulator(options.chunkDuration);

  // Track state
  let running = true;
  let chunkCount = 0;
  let totalTranscribed = 0;

  // Signal handling
  const cleanup = async () => {
    running = false;
    console.log("\n[live-transcribe] Shutting down...");

    // Process remaining audio if any
    if (accumulator.hasData()) {
      console.log("[live-transcribe] Processing final chunk...");
      await processChunk(accumulator.drain(), stt, outputFile, options, audioConfig.sampleRate, audioConfig.channels);
    }

    audioInput.stop();
    await stt.shutdown();
    console.log(`[live-transcribe] Done. Total chunks: ${chunkCount}, Total time: ${formatTime(totalTranscribed)}`);
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Start message
  console.log(`[live-transcribe] Recording from device: ${options.device}`);
  console.log(`[live-transcribe] Chunk duration: ${options.chunkDuration}s`);
  console.log("[live-transcribe] Press Ctrl+C to stop\n");
  console.log("─".repeat(60));

  // Main loop
  try {
    for await (const chunk of audioInput.stream()) {
      if (!running) break;

      // Show progress indicator in verbose mode
      if (options.verbose) {
        const currentDuration = accumulator.getCurrentDurationMs();
        const progress = Math.floor((currentDuration / (options.chunkDuration * 1000)) * 100);
        process.stdout.write(`\r[live-transcribe] Buffering: ${progress}%`);
      }

      if (accumulator.push(chunk)) {
        if (options.verbose) {
          process.stdout.write("\r" + " ".repeat(40) + "\r");
        }

        const drainResult = accumulator.drain();
        await processChunk(drainResult, stt, outputFile, options, audioConfig.sampleRate, audioConfig.channels);

        chunkCount++;
        totalTranscribed += drainResult.durationMs;
      }
    }
  } catch (error) {
    console.error("[live-transcribe] Error:", error);
    await cleanup();
  }
}

/**
 * Process a single chunk: convert to WAV, transcribe, output
 */
async function processChunk(
  drainResult: DrainResult,
  stt: ReturnType<typeof createWhisperAdapter>,
  outputFile: string,
  options: LiveTranscribeOptions,
  sampleRate: number,
  channels: number
): Promise<void> {
  const { pcmBuffer, startTimeMs } = drainResult;

  if (pcmBuffer.length === 0) {
    return;
  }

  const startProcess = Date.now();

  // Convert PCM to WAV
  const wavBuffer = pcmToWav(pcmBuffer, sampleRate, channels);

  // Write to temp file
  const tempPath = writeToTempFile(wavBuffer, "wav");

  try {
    // Transcribe
    const result = await stt.transcribe(
      { type: "file", path: tempPath },
      { language: options.language || undefined }
    );

    const processTime = Date.now() - startProcess;
    const timestamp = formatTime(startTimeMs);

    // Output to console
    if (options.verbose) {
      console.log(`[${timestamp}] (${processTime}ms) ${result.text}`);
    } else {
      console.log(`[${timestamp}] ${result.text}`);
    }

    // Append to markdown
    appendToMarkdown(outputFile, startTimeMs, result.text);
  } catch (error) {
    console.error(`[live-transcribe] Transcription error at ${formatTime(startTimeMs)}:`, error);
  } finally {
    cleanupTempFile(tempPath);
  }
}

function printHelp(): void {
  console.log(`
Live Audio Transcription

Captures live audio and transcribes it in chunks, outputting to console
and a markdown file.

Usage:
  bun run src/cli/live-transcribe.ts --device <device> [options]

Required:
  --device, -d <name>       Audio device name (use 'default' for default mic,
                            or a PulseAudio monitor source for system audio)

Options:
  --chunk-duration <sec>    Chunk duration in seconds (default: 60)
  --output, -o <dir>        Output directory (default: .claude/voice/transcripts)
  --model, -m <model>       Whisper model: tiny, base, small, medium, large-v3
                            (default: small)
  --language, -l <code>     Force language code (e.g., 'en', 'es', 'zh')
                            (default: auto-detect)
  --verbose, -v             Show progress and timing info
  --help, -h                Show this help

Examples:
  # Transcribe from default microphone
  bun run src/cli/live-transcribe.ts -d default

  # Transcribe system audio (requires PulseAudio monitor)
  bun run src/cli/live-transcribe.ts -d "alsa_output.pci-0000_00_1f.3.monitor"

  # Use specific model and shorter chunks
  bun run src/cli/live-transcribe.ts -d default -m large-v3 --chunk-duration 30

Finding audio devices:
  # List PulseAudio sources (including monitors for system audio)
  pactl list short sources

  # Create a loopback for capturing application audio
  pactl load-module module-loopback latency_msec=1
`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
