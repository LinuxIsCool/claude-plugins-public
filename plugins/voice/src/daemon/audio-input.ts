/**
 * Audio Input Module
 *
 * Spawns Python audio capture subprocess and streams AudioChunks
 * compatible with the VAD/STT pipeline.
 *
 * Uses binary protocol for efficiency: each chunk is prefixed with
 * a 4-byte little-endian length, followed by raw PCM data (int16).
 */

import { spawn, type Subprocess } from "bun";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { AudioConfig } from "./types.js";
import type { AudioChunk } from "../ports/stt.js";

// Resolve path to audio_capture.py relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AUDIO_CAPTURE_SCRIPT = join(__dirname, "audio_capture.py");

// ML venv python path (consistent with other adapters)
const PYTHON_PATH = join(process.env.HOME || "", ".venvs", "ml", "bin", "python");

// Maximum buffer size to prevent unbounded memory growth (1MB)
const MAX_BUFFER_SIZE = 1024 * 1024;

/**
 * Audio input stream that yields AudioChunks from microphone
 */
export class AudioInputStream {
  private process: Subprocess | null = null;
  private config: AudioConfig;
  private running = false;
  private startTime = 0;

  constructor(config: AudioConfig) {
    this.config = config;
  }

  /**
   * Start audio capture and yield chunks
   *
   * @yields AudioChunk objects compatible with VAD/STT
   */
  async *stream(): AsyncGenerator<AudioChunk> {
    if (this.running) {
      throw new Error("Audio stream already running");
    }

    this.running = true;
    this.startTime = Date.now();

    // Spawn Python audio capture process
    this.process = spawn({
      cmd: [
        PYTHON_PATH,
        AUDIO_CAPTURE_SCRIPT,
        "--device", this.config.device,
        "--sample-rate", String(this.config.sampleRate),
        "--channels", String(this.config.channels),
        "--chunk-size", String(this.config.chunkSize),
      ],
      stdout: "pipe",
      stderr: "pipe",
    });

    // Wait for ready signal from stderr
    await this.waitForReady();

    console.log("[audio-input] Capture started");

    try {
      // Read binary chunks from stdout
      yield* this.readChunks();
    } finally {
      this.stop();
    }
  }

  /**
   * Wait for READY signal from Python process
   */
  private async waitForReady(): Promise<void> {
    if (!this.process?.stderr) {
      throw new Error("Process stderr not available");
    }

    const reader = this.process.stderr.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const timeout = setTimeout(() => {
      reader.releaseLock();
      throw new Error("Audio capture failed to start within 10 seconds");
    }, 10000);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          clearTimeout(timeout);
          reader.releaseLock();
          throw new Error("Audio capture process exited before ready");
        }

        buffer += decoder.decode(value, { stream: true });

        // Log stderr messages (they contain status info)
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            console.log(`[audio-input] ${line.trim()}`);
          }
          if (line.includes("READY")) {
            clearTimeout(timeout);
            // Continue with SAME reader for background logging (avoids race condition)
            this.logStderrWithReader(reader, decoder, buffer);
            return;
          }
        }
      }
    } catch (error) {
      clearTimeout(timeout);
      reader.releaseLock();
      throw error;
    }
  }

  /**
   * Background task to log stderr messages (continues with existing reader)
   */
  private async logStderrWithReader(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    initialBuffer: string
  ): Promise<void> {
    let buffer = initialBuffer;

    try {
      while (this.running) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            console.log(`[audio-input] ${line.trim()}`);
          }
        }
      }
    } catch {
      // Ignore errors when stopping
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Read binary audio chunks from stdout
   */
  private async *readChunks(): AsyncGenerator<AudioChunk> {
    if (!this.process?.stdout) {
      throw new Error("Process stdout not available");
    }

    const reader = this.process.stdout.getReader();
    // Use array of chunks to avoid O(n^2) buffer copying
    const bufferChunks: Uint8Array[] = [];
    let totalBufferSize = 0;

    try {
      while (this.running) {
        // Read more data
        const { done, value } = await reader.read();
        if (done) {
          console.log("[audio-input] Process stdout closed");
          break;
        }

        // Check for buffer overflow
        if (totalBufferSize + value.length > MAX_BUFFER_SIZE) {
          throw new Error(`Audio buffer overflow: ${totalBufferSize + value.length} bytes exceeds ${MAX_BUFFER_SIZE} limit`);
        }

        bufferChunks.push(value);
        totalBufferSize += value.length;

        // Consolidate chunks when we have enough data to process
        while (totalBufferSize >= 4) {
          // Consolidate into single buffer for processing
          const buffer = new Uint8Array(totalBufferSize);
          let offset = 0;
          for (const chunk of bufferChunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }

          // Read 4-byte little-endian length
          const length = new DataView(buffer.buffer, buffer.byteOffset, 4).getUint32(0, true);

          // Check if we have the full chunk
          if (totalBufferSize < 4 + length) {
            break; // Wait for more data
          }

          // Extract PCM data
          const pcmData = buffer.slice(4, 4 + length);

          // Keep remainder in buffer
          const remainder = buffer.slice(4 + length);
          bufferChunks.length = 0;
          if (remainder.length > 0) {
            bufferChunks.push(remainder);
          }
          totalBufferSize = remainder.length;

          // Calculate timestamp relative to stream start
          const timestampMs = Date.now() - this.startTime;

          // Yield AudioChunk
          yield {
            data: Buffer.from(pcmData),
            sampleRate: this.config.sampleRate,
            channels: this.config.channels,
            timestampMs,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Stop audio capture
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.process) {
      try {
        this.process.kill("SIGTERM");
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }

    console.log("[audio-input] Capture stopped");
  }

  /**
   * Check if currently capturing
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Create an audio input stream with the given configuration
 */
export function createAudioInputStream(config: AudioConfig): AudioInputStream {
  return new AudioInputStream(config);
}
