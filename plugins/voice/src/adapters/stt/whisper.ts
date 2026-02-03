/**
 * Whisper STT Adapter
 *
 * Speech-to-text using OpenAI's Whisper model via faster-whisper.
 * Communicates with a persistent Python process via JSON-RPC.
 *
 * Features:
 * - High accuracy transcription (<10% WER with 'small' model)
 * - GPU acceleration via CUDA
 * - Multi-language support with auto-detection
 * - Word-level timestamps
 * - Streaming transcription with real-time events
 */

import { spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  STTPort,
  STTCapabilities,
  STTOptions,
  STTResult,
  AudioInput,
  TranscriptSegment,
  StreamingSTTEvent,
  STTProgressCallback,
} from "../../ports/stt.js";
import { BaseSTTAdapter, audioInputToFile, cleanupTempFile } from "./base.js";

/**
 * Whisper model sizes
 */
export type WhisperModel = "tiny" | "base" | "small" | "medium" | "large-v3" | "turbo";

/**
 * Configuration for Whisper adapter
 */
export interface WhisperConfig {
  /** Python interpreter path. Default: ~/.venvs/ml/bin/python */
  pythonPath?: string;
  /** Model size. Default: small */
  model?: WhisperModel;
  /** Device for inference. Default: auto (uses CUDA if available) */
  device?: "cuda" | "cpu" | "auto";
  /** Compute type. Default: auto (float16 for GPU, int8 for CPU) */
  computeType?: "int8" | "float16" | "float32" | "auto";
  /** Default language (null for auto-detect). Default: null */
  defaultLanguage?: string;
  /** Beam search width. Default: 5 */
  beamSize?: number;
  /** Enable VAD filter to skip silence. Default: true */
  vadFilter?: boolean;
  /** Request timeout in ms. Default: 120000 (2 minutes) */
  requestTimeout?: number;
  /** Process startup timeout in ms. Default: 120000 (model loading is slow) */
  startupTimeout?: number;
}

/**
 * JSON-RPC request
 */
interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC response
 */
interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  method?: string;
  result?: unknown;
  params?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Transcription result from Python server
 */
interface TranscribeResult {
  text: string;
  segments: TranscriptSegment[];
  language: string;
  languageConfidence?: number;
  durationMs: number;
  processingTimeMs: number;
  model: string;
}

/**
 * Language detection result
 */
interface DetectLanguageResult {
  language: string;
  confidence: number;
}

/**
 * Health check result
 */
interface HealthResult {
  status: string;
  model: string;
  device: string;
  compute_type: string;
  model_loaded: boolean;
  active_sessions: number;
}

/**
 * Stream event from Python server
 */
interface StreamEventParams {
  session_id: string;
  event: StreamingSTTEvent;
}

/**
 * Languages supported by Whisper
 */
const SUPPORTED_LANGUAGES = [
  "en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt", "tr",
  "pl", "ca", "nl", "ar", "sv", "it", "id", "hi", "fi", "vi",
  "he", "uk", "el", "ms", "cs", "ro", "da", "hu", "ta", "no",
  "th", "ur", "hr", "bg", "lt", "la", "mi", "ml", "cy", "sk",
  "te", "fa", "lv", "bn", "sr", "az", "sl", "kn", "et", "mk",
  "br", "eu", "is", "hy", "ne", "mn", "bs", "kk", "sq", "sw",
  "gl", "mr", "pa", "si", "km", "sn", "yo", "so", "af", "oc",
  "ka", "be", "tg", "sd", "gu", "am", "yi", "lo", "uz", "fo",
  "ht", "ps", "tk", "nn", "mt", "sa", "lb", "my", "bo", "tl",
  "mg", "as", "tt", "haw", "ln", "ha", "ba", "jw", "su",
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<WhisperConfig> = {
  pythonPath: join(homedir(), ".venvs/ml/bin/python"),
  model: "small",
  device: "auto",
  computeType: "auto",
  defaultLanguage: "",
  beamSize: 5,
  vadFilter: true,
  requestTimeout: 120000,
  startupTimeout: 120000,
};

/**
 * Get cuDNN library path for GPU support
 */
function getCudnnLibPath(): string {
  const venvPath = join(homedir(), ".venvs/ml");
  return join(venvPath, "lib/python3.11/site-packages/nvidia/cudnn/lib");
}

/**
 * Get path to the Python server script
 */
function getServerScriptPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "whisper_server.py");
}

/**
 * Whisper STT Adapter
 */
export class WhisperAdapter extends BaseSTTAdapter implements STTPort {
  private whisperConfig: Required<WhisperConfig>;
  private process: ChildProcess | null = null;
  private ready = false;
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private outputBuffer = "";
  private deviceInfo: string | null = null;

  // Streaming support
  private activeStreams = new Map<
    string,
    {
      eventQueue: StreamingSTTEvent[];
      completed: boolean;
      error: Error | null;
    }
  >();

  constructor(config?: WhisperConfig) {
    super(config || {});
    this.whisperConfig = { ...DEFAULT_CONFIG, ...config };
  }

  name(): string {
    return "whisper";
  }

  capabilities(): STTCapabilities {
    return {
      streaming: true,
      batch: true,
      wordTimestamps: true,
      speakerDiarization: false,
      languages: SUPPORTED_LANGUAGES,
      vadIncluded: true,
      local: true,
      costPerMinute: 0,
      models: ["tiny", "base", "small", "medium", "large-v3", "turbo"],
      defaultModel: this.whisperConfig.model,
    };
  }

  async isAvailable(): Promise<boolean> {
    // Check Python path exists
    if (!existsSync(this.whisperConfig.pythonPath)) {
      console.error(`[whisper] Python not found: ${this.whisperConfig.pythonPath}`);
      return false;
    }

    // Check faster-whisper library is installed
    try {
      const result = await this.runQuickCommand([
        "-c",
        "from faster_whisper import WhisperModel; print('ok')",
      ]);
      if (!result.includes("ok")) {
        console.error("[whisper] faster-whisper library not installed");
        return false;
      }
    } catch {
      console.error("[whisper] Failed to import faster-whisper library");
      return false;
    }

    // Check CUDA availability (optional, will fall back to CPU)
    try {
      const deviceResult = await this.runQuickCommand([
        "-c",
        "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')",
      ]);
      this.deviceInfo = deviceResult.trim();
      if (this.deviceInfo === "cpu" && this.whisperConfig.device === "cuda") {
        console.error("[whisper] CUDA requested but not available");
        return false;
      }
    } catch {
      this.deviceInfo = "cpu";
    }

    return true;
  }

  async transcribe(
    input: AudioInput,
    options?: STTOptions,
    onProgress?: STTProgressCallback
  ): Promise<STTResult> {
    const startTime = Date.now();

    // Convert input to file path
    const [audioPath, needsCleanup] = await audioInputToFile(input);

    try {
      await this.ensureProcess();

      const result = await this.callRPC<TranscribeResult>("transcribe", {
        audio_path: audioPath,
        language: options?.language || this.whisperConfig.defaultLanguage || null,
        beam_size: options?.beamSize || this.whisperConfig.beamSize,
        vad_filter: this.whisperConfig.vadFilter,
        word_timestamps: options?.wordTimestamps ?? false,
        initial_prompt: options?.initialPrompt,
        temperature: options?.temperature ?? 0.0,
      });

      return {
        text: result.text,
        segments: result.segments,
        language: result.language,
        languageConfidence: result.languageConfidence,
        durationMs: result.durationMs,
        processingTimeMs: Date.now() - startTime,
        model: result.model,
      };
    } finally {
      if (needsCleanup) {
        cleanupTempFile(audioPath);
      }
    }
  }

  /**
   * Streaming transcription
   */
  async *transcribeStream(
    input: AudioInput,
    options?: STTOptions
  ): AsyncGenerator<StreamingSTTEvent> {
    const sessionId = crypto.randomUUID();

    // Convert input to file path (for now, streaming uses batch processing internally)
    const [audioPath, needsCleanup] = await audioInputToFile(input);

    try {
      await this.ensureProcess();

      // Initialize stream state
      this.activeStreams.set(sessionId, {
        eventQueue: [],
        completed: false,
        error: null,
      });

      // Start streaming session
      await this.callRPC("start_stream", {
        session_id: sessionId,
        options: {
          language: options?.language || this.whisperConfig.defaultLanguage || null,
          beam_size: options?.beamSize || this.whisperConfig.beamSize,
          vad_filter: this.whisperConfig.vadFilter,
          word_timestamps: options?.wordTimestamps ?? true,
        },
      });

      // Yield started event
      yield { type: "started", sessionId };

      // Read audio file and send as chunks
      const audioBuffer = await Bun.file(audioPath).arrayBuffer();
      const audioData = Buffer.from(audioBuffer);

      // Send audio in chunks (32KB chunks = ~1 second of 16kHz 16-bit audio)
      const chunkSize = 32000;
      for (let offset = 0; offset < audioData.length; offset += chunkSize) {
        const chunk = audioData.slice(offset, Math.min(offset + chunkSize, audioData.length));
        const isLast = offset + chunkSize >= audioData.length;

        this.sendNotification("audio_chunk", {
          session_id: sessionId,
          chunk_base64: chunk.toString("base64"),
          is_final: isLast,
        });

        // Small delay to prevent overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Yield events as they arrive with timeout protection
      const streamState = this.activeStreams.get(sessionId)!;
      const startTime = Date.now();
      const timeout = this.whisperConfig.requestTimeout;

      while (!streamState.completed || streamState.eventQueue.length > 0) {
        // Check for timeout
        if (Date.now() - startTime > timeout) {
          throw new Error(`Stream timeout after ${timeout}ms`);
        }

        if (streamState.eventQueue.length > 0) {
          const event = streamState.eventQueue.shift()!;
          yield event;

          if (event.type === "completed" || event.type === "error") {
            break;
          }
        } else {
          // Wait for more events
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (streamState.error) {
        throw streamState.error;
      }
    } catch (error) {
      // Cancel stream session in Python on error
      try {
        this.sendNotification("cancel_stream", { session_id: sessionId });
      } catch {
        // Ignore cancellation errors
      }
      throw error;
    } finally {
      // Cleanup
      this.activeStreams.delete(sessionId);
      if (needsCleanup) {
        cleanupTempFile(audioPath);
      }
    }
  }

  /**
   * Detect language in audio
   */
  async detectLanguage(input: AudioInput): Promise<{ language: string; confidence: number }> {
    const [audioPath, needsCleanup] = await audioInputToFile(input);

    try {
      await this.ensureProcess();

      return await this.callRPC<DetectLanguageResult>("detect_language", {
        audio_path: audioPath,
      });
    } finally {
      if (needsCleanup) {
        cleanupTempFile(audioPath);
      }
    }
  }

  /**
   * Shutdown the Python process
   */
  async shutdown(): Promise<void> {
    if (this.process) {
      try {
        await this.callRPC("shutdown", {});
      } catch {
        // Ignore shutdown errors
      }
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Ensure the Python process is running and ready
   */
  private async ensureProcess(): Promise<void> {
    if (this.process && this.ready) {
      return;
    }

    await this.startProcess();
  }

  /**
   * Start the Python inference server
   */
  private async startProcess(): Promise<void> {
    const scriptPath = getServerScriptPath();

    if (!existsSync(scriptPath)) {
      throw new Error(`Whisper server script not found: ${scriptPath}`);
    }

    // Set up environment with cuDNN libs for GPU support
    const cudnnPath = getCudnnLibPath();
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
    };

    try {
      // Spawn Python process
      this.process = spawn(
        this.whisperConfig.pythonPath,
        [
          scriptPath,
          "--model", this.whisperConfig.model,
          "--device", this.whisperConfig.device,
          "--compute-type", this.whisperConfig.computeType,
        ],
        { env, stdio: ["pipe", "pipe", "pipe"] }
      );

      // Handle stdout (JSON-RPC responses)
      this.process.stdout!.on("data", (data) => {
        this.handleStdout(data.toString());
      });

      // Handle stderr (logs)
      this.process.stderr!.on("data", (data) => {
        console.error(`[whisper_server] ${data.toString().trim()}`);
      });

      // Handle process exit
      this.process.on("exit", (code) => {
        console.error(`[whisper] Process exited with code ${code}`);
        this.ready = false;
        this.process = null;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Process exited with code ${code}`));
          this.pendingRequests.delete(id);
        }

        // Mark all active streams as errored
        for (const [sessionId, state] of this.activeStreams) {
          state.error = new Error(`Process exited with code ${code}`);
          state.completed = true;
        }
      });

      // Wait for ready signal
      await this.waitForReady();
    } catch (error) {
      // Clean up process on startup failure
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
      this.ready = false;
      throw error;
    }
  }

  /**
   * Wait for the server to signal it's ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, this.whisperConfig.startupTimeout);

      const checkReady = () => {
        if (this.ready) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Handle stdout data from Python process
   */
  private handleStdout(data: string): void {
    this.outputBuffer += data;

    // Process complete lines
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: JSONRPCResponse = JSON.parse(line);

        // Check for ready signal
        if (response.method === "ready") {
          this.ready = true;
          continue;
        }

        // Check for stream events
        if (response.method === "stream_event") {
          const params = response.params as StreamEventParams;
          const streamState = this.activeStreams.get(params.session_id);

          if (streamState) {
            streamState.eventQueue.push(params.event);

            if (params.event.type === "completed" || params.event.type === "error") {
              streamState.completed = true;
              if (params.event.type === "error") {
                streamState.error = new Error((params.event as { type: "error"; error: Error }).error.message || "Stream error");
              }
            }
          }
          continue;
        }

        // Match response to pending request
        if (response.id !== null && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (e) {
        console.error(`[whisper] Failed to parse response: ${line}`);
      }
    }
  }

  /**
   * Call a JSON-RPC method on the Python server
   */
  private callRPC<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.ready) {
        reject(new Error("Process not ready"));
        return;
      }

      const id = ++this.requestId;
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.whisperConfig.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.process.stdin!.write(JSON.stringify(request) + "\n");
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.process || !this.ready) {
      throw new Error("Process not ready");
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    this.process.stdin!.write(JSON.stringify(notification) + "\n");
  }

  /**
   * Run a quick Python command (for availability checks)
   */
  private runQuickCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.whisperConfig.pythonPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
    });
  }
}

/**
 * Factory function
 */
export function createWhisperAdapter(config?: WhisperConfig): WhisperAdapter {
  return new WhisperAdapter(config);
}
