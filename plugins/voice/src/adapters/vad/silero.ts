/**
 * Silero VAD Adapter
 *
 * Voice Activity Detection using Silero VAD model.
 * Communicates with a persistent Python process via JSON-RPC.
 *
 * Features:
 * - Real-time speech detection with configurable threshold
 * - Streaming speech segment extraction
 * - GPU acceleration support
 * - Low latency (<10ms per chunk)
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  VADPort,
  VADCapabilities,
  VADOptions,
  VADResult,
  VADStreamEvent,
  SpeechSegment,
} from "../../ports/vad.js";
import type { AudioChunk } from "../../ports/stt.js";
import { BasePythonProcessAdapter, type BasePythonProcessConfig } from "../base-python-process.js";

/**
 * Configuration for Silero VAD adapter
 */
export interface SileroVADConfig extends BasePythonProcessConfig {
  /** Sample rate for audio processing. Default: 16000 */
  sampleRate?: number;
}

/**
 * Default configuration for Silero-specific options
 */
const DEFAULT_SILERO_CONFIG = {
  requestTimeout: 5000,   // VAD should be fast
  startupTimeout: 30000,  // Model loading is quick for VAD
  sampleRate: 16000,
};

/**
 * VAD result from Python server
 */
interface VADProcessResult {
  is_speech: boolean;
  probability: number;
}

/**
 * Get path to the Python server script
 */
function getServerScriptPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "silero_server.py");
}

/**
 * Streaming state for speech segment detection
 */
interface StreamState {
  inSpeech: boolean;
  speechStartMs: number;
  silenceStartMs: number;
  probabilities: number[];
  lastSpeechMs: number;
}

/**
 * Create initial stream state
 */
function createStreamState(): StreamState {
  return {
    inSpeech: false,
    speechStartMs: 0,
    silenceStartMs: 0,
    probabilities: [],
    lastSpeechMs: 0,
  };
}

/**
 * Silero VAD Adapter
 *
 * Implements VADPort interface using Silero VAD model via Python subprocess.
 */
export class SileroVADAdapter
  extends BasePythonProcessAdapter<SileroVADConfig & { sampleRate: number }>
  implements VADPort
{
  private streamState: StreamState = createStreamState();
  private initialized = false;

  constructor(config?: SileroVADConfig) {
    super(
      config,
      DEFAULT_SILERO_CONFIG as unknown as SileroVADConfig & { sampleRate: number },
      "silero-vad"
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BasePythonProcessAdapter abstract implementations
  // ─────────────────────────────────────────────────────────────────────────────

  protected getServerScriptPath(): string {
    return getServerScriptPath();
  }

  protected getServerArgs(): string[] {
    return [
      "--device", this.config.device,
      "--sample-rate", String(this.config.sampleRate),
    ];
  }

  protected async validatePythonEnv(): Promise<boolean> {
    // Check torch is installed
    try {
      const result = await this.runQuickCommand([
        "-c",
        "import torch; print('ok')",
      ]);
      if (!result.includes("ok")) {
        console.error("[silero-vad] torch not installed");
        return false;
      }
    } catch {
      console.error("[silero-vad] Failed to import torch");
      return false;
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VADPort interface implementation
  // ─────────────────────────────────────────────────────────────────────────────

  name(): string {
    return "silero";
  }

  capabilities(): VADCapabilities {
    return {
      streaming: true,
      minSpeechMs: 250,
      minSilenceMs: 100,
      local: true,
      models: ["silero_vad"],
      defaultModel: "silero_vad",
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.isProcessAvailable();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.ensureProcess();
    this.initialized = true;
  }

  /**
   * Process a single audio chunk
   *
   * Note: This is synchronous per the VADPort interface, but internally
   * awaits the Python process. Callers should use processStream for
   * async streaming.
   */
  process(audio: AudioChunk, options?: VADOptions): VADResult {
    // Since the interface requires synchronous return but we need async IPC,
    // we use a workaround: the caller should call initialize() first,
    // then process() can work synchronously with cached results.
    // For proper async operation, use processStream().

    // For now, throw if not initialized to force proper usage
    if (!this.isReady()) {
      throw new Error(
        "VAD not initialized. Call initialize() first or use processStream() for async operation."
      );
    }

    // We can't make this truly synchronous without blocking,
    // so we return a placeholder and update via callback pattern.
    // The proper pattern is to use processStream() which is async.
    throw new Error(
      "process() is not supported for async backends. Use processStream() instead."
    );
  }

  /**
   * Process audio stream and detect speech segments
   */
  async *processStream(
    audioStream: AsyncIterable<AudioChunk>,
    options?: VADOptions
  ): AsyncGenerator<VADStreamEvent> {
    const opts = {
      threshold: options?.threshold ?? 0.5,
      minSpeechDurationMs: options?.minSpeechDurationMs ?? 250,
      minSilenceDurationMs: options?.minSilenceDurationMs ?? 1000,
      speechPadMs: options?.speechPadMs ?? 300,
    };

    // Ensure process is running
    await this.ensureProcess();

    // Reset state for new stream
    this.reset();

    for await (const chunk of audioStream) {
      // Process chunk through Python
      let result: VADResult;
      try {
        result = await this.processChunkAsync(chunk, opts.threshold);
      } catch (error) {
        yield {
          type: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        };
        continue; // Try to continue with next chunk
      }

      // Yield probability event
      yield {
        type: "probability",
        isSpeech: result.isSpeech,
        probability: result.probability,
        timestampMs: chunk.timestampMs,
      };

      // State machine for speech segment detection
      if (result.isSpeech) {
        this.streamState.lastSpeechMs = chunk.timestampMs;

        if (!this.streamState.inSpeech) {
          // Speech start
          this.streamState.inSpeech = true;
          this.streamState.speechStartMs = chunk.timestampMs;
          this.streamState.probabilities = [result.probability];

          yield {
            type: "speech_start",
            timestampMs: chunk.timestampMs,
            probability: result.probability,
          };
        } else {
          // Continue speech
          this.streamState.probabilities.push(result.probability);
        }

        // Reset silence counter
        this.streamState.silenceStartMs = 0;

      } else {
        // Silence detected
        if (this.streamState.inSpeech) {
          // Start or continue silence within speech
          if (this.streamState.silenceStartMs === 0) {
            this.streamState.silenceStartMs = chunk.timestampMs;
          }

          // Still include this chunk's probability for averaging
          this.streamState.probabilities.push(result.probability);

          // Check if silence duration exceeds threshold
          const silenceDuration = chunk.timestampMs - this.streamState.silenceStartMs;
          if (silenceDuration >= opts.minSilenceDurationMs) {
            // Check if speech duration was long enough
            const speechDuration = this.streamState.lastSpeechMs - this.streamState.speechStartMs;
            if (speechDuration >= opts.minSpeechDurationMs) {
              // Valid speech segment
              const segment: SpeechSegment = {
                startMs: this.streamState.speechStartMs,
                endMs: this.streamState.lastSpeechMs,
                durationMs: speechDuration,
                averageProbability: this.calculateAverageProbability(),
              };

              yield {
                type: "speech_end",
                segment,
              };
            }

            // Reset speech state
            this.streamState.inSpeech = false;
            this.streamState.speechStartMs = 0;
            this.streamState.silenceStartMs = 0;
            this.streamState.probabilities = [];
          }
        }
      }
    }

    // Handle any remaining speech at end of stream
    if (this.streamState.inSpeech) {
      const speechDuration = this.streamState.lastSpeechMs - this.streamState.speechStartMs;
      if (speechDuration >= opts.minSpeechDurationMs) {
        const segment: SpeechSegment = {
          startMs: this.streamState.speechStartMs,
          endMs: this.streamState.lastSpeechMs,
          durationMs: speechDuration,
          averageProbability: this.calculateAverageProbability(),
        };

        yield {
          type: "speech_end",
          segment,
        };
      }
    }
  }

  reset(): void {
    this.streamState = createStreamState();

    // Also reset Python server state if process is running
    if (this.isReady()) {
      this.callRPC("reset", {}).catch(() => {
        // Ignore reset errors
      });
    }
  }

  dispose(): void {
    this.reset();
    this.shutdown().catch(() => {
      // Ignore shutdown errors
    });
    this.initialized = false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process a single audio chunk asynchronously via Python
   */
  private async processChunkAsync(
    audio: AudioChunk,
    threshold: number
  ): Promise<VADResult> {
    // Encode audio as base64
    const audioBase64 = audio.data.toString("base64");

    // Call Python server
    const result = await this.callRPC<VADProcessResult>("process", {
      audio_base64: audioBase64,
      sample_rate: audio.sampleRate,
      threshold,
    });

    return {
      isSpeech: result.is_speech,
      probability: result.probability,
      timestampMs: audio.timestampMs,
    };
  }

  /**
   * Calculate average probability from collected samples
   */
  private calculateAverageProbability(): number {
    if (this.streamState.probabilities.length === 0) {
      return 0;
    }
    const sum = this.streamState.probabilities.reduce((a, b) => a + b, 0);
    return sum / this.streamState.probabilities.length;
  }
}

/**
 * Factory function
 */
export function createSileroVADAdapter(config?: SileroVADConfig): SileroVADAdapter {
  return new SileroVADAdapter(config);
}
