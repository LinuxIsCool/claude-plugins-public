/**
 * Voice Daemon
 *
 * Main orchestrator for the voice pipeline:
 *   AudioInput → VAD → STT → Output
 *
 * v0.1: Dictation tool (outputs transcripts to console)
 * v0.2: Add wake word detection
 * v0.3: Add intent routing (tmux, Claude handlers)
 */

import type { DaemonConfig, DaemonState, DaemonEvent, TranscriptHandler } from "./types.js";
import { loadConfig } from "./config.js";
import { AudioInputStream } from "./audio-input.js";
import { createVADFactory, type VADFactory } from "../adapters/vad/index.js";
import { createSTTFactory, type STTFactory } from "../adapters/stt/index.js";
import type { VADPort, SpeechSegment, VADStreamEvent } from "../ports/vad.js";
import type { STTPort, AudioChunk } from "../ports/stt.js";

/**
 * Convert raw PCM audio to WAV format
 *
 * WAV is PCM with a 44-byte header containing sample rate, channels, etc.
 * This is needed because Whisper/FFmpeg can't read raw PCM without headers.
 */
export function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  // Create WAV header (44 bytes)
  const header = Buffer.alloc(44);

  // RIFF header
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);

  // fmt chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // audio format (1 = PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  // Combine header and PCM data
  return Buffer.concat([header, pcmData]);
}

/**
 * Audio buffer for speech segment extraction
 *
 * Buffers audio chunks with timestamps to extract speech segments
 * for transcription after VAD detects speech end.
 */
class AudioBuffer {
  private chunks: AudioChunk[] = [];
  private maxDurationMs: number;

  constructor(maxDurationMs: number = 60000) {
    this.maxDurationMs = maxDurationMs;
  }

  /**
   * Add a chunk to the buffer
   */
  push(chunk: AudioChunk): void {
    this.chunks.push(chunk);
    this.prune();
  }

  /**
   * Remove chunks older than maxDurationMs
   */
  private prune(): void {
    if (this.chunks.length === 0) return;

    const latestTs = this.chunks[this.chunks.length - 1].timestampMs;
    const cutoff = latestTs - this.maxDurationMs;

    // Find first chunk within window
    let startIdx = 0;
    while (startIdx < this.chunks.length && this.chunks[startIdx].timestampMs < cutoff) {
      startIdx++;
    }

    if (startIdx > 0) {
      this.chunks = this.chunks.slice(startIdx);
    }
  }

  /**
   * Extract audio data for a speech segment
   *
   * Note: chunk.timestampMs is when the chunk was created, not when its
   * audio content ends. We use an inclusive filter with margin to ensure
   * we capture all audio within the segment.
   *
   * @param segment Speech segment with start/end timestamps
   * @returns Buffer containing PCM audio data
   */
  extractSegment(segment: SpeechSegment): Buffer {
    // Use inclusive filter: chunk timestamp is start of chunk, so include
    // chunks where timestamp is before endMs (they may contain audio up to
    // timestamp + chunkDuration). Also include margin before startMs for
    // chunks that started slightly before but contain segment start.
    const margin = 100; // 100ms margin for timing jitter
    const relevantChunks = this.chunks.filter(
      (c) => c.timestampMs >= segment.startMs - margin && c.timestampMs < segment.endMs + margin
    );

    if (relevantChunks.length === 0) {
      console.warn(`[daemon] No audio chunks found for segment ${segment.startMs}-${segment.endMs}ms`);
      return Buffer.alloc(0);
    }

    // Concatenate chunk data
    const totalLength = relevantChunks.reduce((sum, c) => sum + c.data.length, 0);
    const result = Buffer.alloc(totalLength);
    let offset = 0;

    for (const chunk of relevantChunks) {
      chunk.data.copy(result, offset);
      offset += chunk.data.length;
    }

    return result;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * Get buffer stats
   */
  stats(): { chunks: number; durationMs: number } {
    if (this.chunks.length === 0) {
      return { chunks: 0, durationMs: 0 };
    }

    const first = this.chunks[0].timestampMs;
    const last = this.chunks[this.chunks.length - 1].timestampMs;

    return {
      chunks: this.chunks.length,
      durationMs: last - first,
    };
  }
}

/**
 * Voice Daemon
 *
 * Orchestrates the voice pipeline: audio capture → VAD → STT
 */
export class VoiceDaemon {
  private config: DaemonConfig;
  private state: DaemonState = "initializing";
  private audioInput: AudioInputStream | null = null;
  private vadFactory: VADFactory | null = null;
  private sttFactory: STTFactory | null = null;
  private vad: VADPort | null = null;
  private stt: STTPort | null = null;
  private audioBuffer: AudioBuffer;
  private running = false;
  private eventHandlers: ((event: DaemonEvent) => void)[] = [];
  private transcriptHandlers: TranscriptHandler[] = [];

  constructor(config: DaemonConfig) {
    this.config = config;
    this.audioBuffer = new AudioBuffer(config.daemon.maxSpeechDuration * 1000);
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error("Daemon already running");
    }

    this.running = true;
    this.setState("initializing");

    try {
      // Initialize backends
      await this.initializeBackends();

      // Create audio input
      this.audioInput = new AudioInputStream(this.config.audio);

      // Start the pipeline
      await this.runPipeline();
    } catch (error) {
      this.emitEvent({ type: "error", error: error as Error });
      this.setState("error");
      throw error;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.setState("shutdown");
    this.emitEvent({ type: "shutdown" });

    // Stop audio input
    if (this.audioInput) {
      this.audioInput.stop();
      this.audioInput = null;
    }

    // Dispose backends
    if (this.vadFactory) {
      this.vadFactory.disposeAll();
      this.vadFactory = null;
    }

    // Note: STTFactory doesn't have disposeAll() method - STT adapters
    // use persistent processes that clean up when their Python process exits
    this.sttFactory = null;
    this.vad = null;
    this.stt = null;

    console.log("[daemon] Stopped");
  }

  /**
   * Subscribe to daemon events
   */
  onEvent(handler: (event: DaemonEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const idx = this.eventHandlers.indexOf(handler);
      if (idx >= 0) {
        this.eventHandlers.splice(idx, 1);
      }
    };
  }

  /**
   * Register a transcript handler
   *
   * Handlers are called in order when a transcript is received.
   * The first handler that returns true stops the chain.
   *
   * @param handler Transcript handler to register
   */
  registerHandler(handler: TranscriptHandler): void {
    this.transcriptHandlers.push(handler);
    console.log(`[daemon] Registered handler: ${handler.name}`);
  }

  /**
   * Unregister a transcript handler
   *
   * @param name Handler name to unregister
   */
  unregisterHandler(name: string): void {
    const idx = this.transcriptHandlers.findIndex((h) => h.name === name);
    if (idx >= 0) {
      this.transcriptHandlers.splice(idx, 1);
      console.log(`[daemon] Unregistered handler: ${name}`);
    }
  }

  /**
   * Get current state
   */
  getState(): DaemonState {
    return this.state;
  }

  /**
   * Initialize VAD and STT backends
   */
  private async initializeBackends(): Promise<void> {
    console.log("[daemon] Initializing backends...");

    // Initialize VAD
    this.vadFactory = createVADFactory({
      silero: {
        threshold: this.config.vad.threshold,
        minSpeechDurationMs: this.config.vad.minSpeechDurationMs,
        minSilenceDurationMs: this.config.vad.minSilenceDurationMs,
        speechPadMs: this.config.vad.speechPadMs,
      },
    });

    this.vad = await this.vadFactory.getWithFallback(this.config.vad.backend);
    await this.vad.initialize();
    console.log(`[daemon] VAD initialized: ${this.vad.name()}`);

    // Initialize STT
    this.sttFactory = createSTTFactory({
      whisper: {
        model: this.config.stt.model,
        language: this.config.stt.language,
      },
    });

    this.stt = await this.sttFactory.getWithFallback(this.config.stt.backend);
    console.log(`[daemon] STT initialized: ${this.stt.name()}`);
  }

  /**
   * Run the main pipeline
   */
  private async runPipeline(): Promise<void> {
    if (!this.audioInput || !this.vad || !this.stt) {
      throw new Error("Backends not initialized");
    }

    console.log("[daemon] Starting pipeline...");
    this.setState("listening");

    // Create tee to feed audio to both buffer and VAD
    const audioStream = this.audioInput.stream();

    // Create a stream that tees audio to buffer while yielding to VAD
    // Capture running flag reference for early exit
    const self = this;
    async function* teeStream(
      stream: AsyncGenerator<AudioChunk>,
      buffer: AudioBuffer
    ): AsyncGenerator<AudioChunk> {
      for await (const chunk of stream) {
        if (!self.running) break; // Early exit when daemon stops
        buffer.push(chunk);
        yield chunk;
      }
    }

    // Process VAD events
    const vadStream = this.vad.processStream(
      teeStream(audioStream, this.audioBuffer),
      {
        threshold: this.config.vad.threshold,
        minSpeechDurationMs: this.config.vad.minSpeechDurationMs,
        minSilenceDurationMs: this.config.vad.minSilenceDurationMs,
        speechPadMs: this.config.vad.speechPadMs,
      }
    );

    for await (const event of vadStream) {
      if (!this.running) break;

      await this.handleVADEvent(event);
    }
  }

  /**
   * Handle VAD event
   */
  private async handleVADEvent(event: VADStreamEvent): Promise<void> {
    switch (event.type) {
      case "speech_start":
        this.setState("capturing");
        this.emitEvent({
          type: "speech_start",
          timestampMs: event.timestampMs,
        });
        console.log(`[daemon] Speech started at ${event.timestampMs}ms`);
        break;

      case "speech_end":
        this.setState("transcribing");
        this.emitEvent({
          type: "speech_end",
          durationMs: event.segment.durationMs,
        });
        console.log(`[daemon] Speech ended: ${event.segment.durationMs}ms`);

        // Extract and transcribe
        await this.transcribeSegment(event.segment);

        this.setState("listening");
        break;

      case "probability":
        // Could emit probability events for visualization
        // For now, just log in debug mode
        if (this.config.daemon.logLevel === "debug") {
          console.log(
            `[daemon] VAD: speech=${event.isSpeech}, prob=${event.probability.toFixed(2)}`
          );
        }
        break;

      case "error":
        console.error("[daemon] VAD error:", event.error);
        this.emitEvent({ type: "error", error: event.error });
        break;
    }
  }

  /**
   * Transcribe a speech segment
   */
  private async transcribeSegment(segment: SpeechSegment): Promise<void> {
    if (!this.stt) return;

    try {
      // Extract audio from buffer
      const audioData = this.audioBuffer.extractSegment(segment);

      if (audioData.length === 0) {
        console.warn("[daemon] Empty audio segment, skipping transcription");
        return;
      }

      // Convert raw PCM to WAV format (Whisper/FFmpeg needs headers)
      const wavData = pcmToWav(
        audioData,
        this.config.audio.sampleRate,
        this.config.audio.channels
      );

      console.log(
        `[daemon] Transcribing ${segment.durationMs}ms of audio (${wavData.length} bytes WAV)...`
      );

      // Transcribe
      const result = await this.stt.transcribe(
        {
          type: "buffer",
          data: wavData,
          format: "wav",
        },
        {
          language: this.config.stt.language,
        }
      );

      // Emit transcript event
      const confidence = result.segments.length > 0
        ? result.segments.reduce((sum, s) => sum + (s.confidence || 0), 0) / result.segments.length
        : 0;

      this.emitEvent({
        type: "transcript",
        text: result.text,
        confidence,
      });

      // Route to transcript handlers (v0.3 behavior)
      let handled = false;
      for (const handler of this.transcriptHandlers) {
        try {
          handled = await handler.handle(result.text, confidence);
          if (handled) {
            console.log(`[daemon] Handled by: ${handler.name}`);
            break;
          }
        } catch (err) {
          console.error(`[daemon] Handler "${handler.name}" error:`, err);
        }
      }

      // Output to console if not handled (v0.1 fallback)
      if (!handled) {
        console.log(`\n>>> ${result.text}\n`);
      }
    } catch (error) {
      console.error("[daemon] Transcription error:", error);
      this.emitEvent({ type: "error", error: error as Error });
    }
  }

  /**
   * Set daemon state and emit event
   */
  private setState(newState: DaemonState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      this.emitEvent({
        type: "state_change",
        from: oldState,
        to: newState,
      });
    }
  }

  /**
   * Emit event to handlers
   */
  private emitEvent(event: DaemonEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error("[daemon] Event handler error:", e);
      }
    }
  }
}

/**
 * Create and start a daemon with the given configuration
 */
export async function createDaemon(configPath?: string): Promise<VoiceDaemon> {
  const config = await loadConfig(configPath);
  return new VoiceDaemon(config);
}
