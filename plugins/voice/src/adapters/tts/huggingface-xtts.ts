/**
 * HuggingFace XTTS v2 TTS Adapter
 *
 * GPU-accelerated text-to-speech using Coqui's XTTS v2 model.
 * Communicates with a persistent Python process via JSON-RPC.
 *
 * Features:
 * - Voice cloning from audio samples
 * - Multi-language support (17 languages)
 * - <2s latency after model warm-up
 */

import { spawn, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { readFile } from "fs/promises";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getClaudePath } from "../../lib/paths.js";
import type { TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";
import { BaseTTSAdapter } from "./base.js";

/**
 * Configuration for XTTS adapter
 */
export interface HuggingFaceXTTSConfig {
  /** Python interpreter path. Default: ~/.venvs/ml/bin/python */
  pythonPath?: string;
  /** Device for inference. Default: auto (uses CUDA if available) */
  device?: "cuda" | "cpu" | "auto";
  /** Default language for synthesis. Default: en */
  defaultLanguage?: string;
  /** Directory for cached speaker files. Default: ~/.cache/claude-voice/speakers */
  speakerCacheDir?: string;
  /** Project-specific speaker directory. Default: .claude/voice/speakers */
  projectSpeakerDir?: string;
  /** Request timeout in ms. Default: 30000 */
  requestTimeout?: number;
  /** Process startup timeout in ms. Default: 60000 (model loading is slow) */
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
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Synthesis result from Python server
 */
interface SynthesisResult {
  audio_base64: string;
  duration_ms: number;
  sample_rate: number;
  synthesis_time_ms: number;
  device: string;
}

/**
 * Health check result
 */
interface HealthResult {
  status: string;
  model: string;
  device: string;
  model_loaded: boolean;
}

/**
 * Languages supported by XTTS v2
 */
const SUPPORTED_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl",
  "cs", "ar", "zh-cn", "ja", "hu", "ko", "hi",
];

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<HuggingFaceXTTSConfig> = {
  pythonPath: join(homedir(), ".venvs/ml/bin/python"),
  device: "auto",
  defaultLanguage: "en",
  speakerCacheDir: join(homedir(), ".cache/claude-voice/speakers"),
  projectSpeakerDir: getClaudePath("voice/speakers"),  // Repo-root anchored
  requestTimeout: 30000,
  startupTimeout: 60000,
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
  return join(__dirname, "xtts_server.py");
}

/**
 * HuggingFace XTTS v2 TTS Adapter
 */
export class HuggingFaceXTTSAdapter extends BaseTTSAdapter {
  private config: Required<HuggingFaceXTTSConfig>;
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
  private cachedVoices: VoiceInfo[] | null = null;
  private deviceInfo: string | null = null;

  constructor(config?: HuggingFaceXTTSConfig) {
    super(config || {});
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  name(): string {
    return "huggingface-xtts";
  }

  capabilities(): TTSCapabilities {
    return {
      voices: [],
      streaming: false,
      voiceCloning: true,
      ssml: false,
      emotions: false,
      local: true,
      costPerChar: 0,
      maxTextLength: 1000,
      supportedFormats: ["wav"],
    };
  }

  async isAvailable(): Promise<boolean> {
    // Check Python path exists
    if (!existsSync(this.config.pythonPath)) {
      console.error(`[huggingface-xtts] Python not found: ${this.config.pythonPath}`);
      return false;
    }

    // Check TTS library is installed
    try {
      const result = await this.runQuickCommand([
        "-c",
        "from TTS.api import TTS; print('ok')",
      ]);
      if (!result.includes("ok")) {
        console.error("[huggingface-xtts] TTS library not installed");
        return false;
      }
    } catch {
      console.error("[huggingface-xtts] Failed to import TTS library");
      return false;
    }

    // Check CUDA availability (optional, will fall back to CPU)
    try {
      const deviceResult = await this.runQuickCommand([
        "-c",
        "import torch; print('cuda' if torch.cuda.is_available() else 'cpu')",
      ]);
      this.deviceInfo = deviceResult.trim();
      if (this.deviceInfo === "cpu" && this.config.device === "cuda") {
        console.error("[huggingface-xtts] CUDA requested but not available");
        return false;
      }
    } catch {
      this.deviceInfo = "cpu";
    }

    return true;
  }

  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();

    // Validate language
    const language = options.language || this.config.defaultLanguage;
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new Error(
        `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`
      );
    }

    await this.ensureProcess();

    // Resolve speaker WAV path
    const voiceId = options.voiceId || "default";
    const speakerWav = this.resolveSpeakerPath(voiceId);

    const result = await this.callRPC<SynthesisResult>("synthesize", {
      text,
      speaker_wav: speakerWav,
      language,
    });

    // Decode base64 audio
    const audio = Buffer.from(result.audio_base64, "base64");

    return {
      audio,
      durationMs: result.duration_ms,
      format: "wav",
      processingTimeMs: Date.now() - startTime,
      charCount: text.length,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    if (this.cachedVoices) {
      return this.cachedVoices;
    }

    // Default voice (always available)
    const defaultVoice: VoiceInfo = {
      id: "default",
      name: "XTTS Default",
      gender: "neutral",
      language: "English",
      languageCode: "en",
      description: "Default XTTS v2 speaker",
    };

    // Load cloned voices from cache
    const clonedVoices: VoiceInfo[] = [];
    try {
      await this.ensureProcess();
      const speakers = await this.callRPC<Array<{
        id: string;
        name: string;
        source: string;
      }>>("list_speakers", {
        cache_dir: this.config.speakerCacheDir,
      });

      for (const speaker of speakers) {
        clonedVoices.push({
          id: speaker.id,
          name: speaker.name,
          gender: "neutral",
          language: "English",
          languageCode: "en",
          description: `Cloned voice: ${speaker.name}`,
        });
      }
    } catch {
      // Ignore errors loading cloned voices
    }

    this.cachedVoices = [defaultVoice, ...clonedVoices];
    return this.cachedVoices;
  }

  /**
   * Clone a voice from audio samples
   */
  async cloneVoice(name: string, audioSamples: string[]): Promise<VoiceInfo> {
    await this.ensureProcess();

    // Validate samples exist
    const validSamples = audioSamples.filter((p) => existsSync(p));
    if (validSamples.length === 0) {
      throw new Error("No valid audio samples provided");
    }

    const result = await this.callRPC<{
      speaker_id: string;
      reference_path: string;
    }>("clone_voice", {
      name: this.sanitizeVoiceId(name),
      audio_paths: validSamples,
      cache_dir: this.config.speakerCacheDir,
    });

    // Invalidate cache
    this.cachedVoices = null;

    return {
      id: result.speaker_id,
      name,
      gender: "neutral",
      language: "English",
      languageCode: "en",
      description: `Cloned from ${validSamples.length} sample(s)`,
    };
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
      throw new Error(`XTTS server script not found: ${scriptPath}`);
    }

    // Set up environment with cuDNN libs for GPU support
    const cudnnPath = getCudnnLibPath();
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
    };

    try {
      // Spawn Python process
      this.process = spawn(
        this.config.pythonPath,
        [scriptPath, "--device", this.config.device],
        { env, stdio: ["pipe", "pipe", "pipe"] }
      );

      // Handle stdout (JSON-RPC responses)
      this.process.stdout!.on("data", (data) => {
        this.handleStdout(data.toString());
      });

      // Handle stderr (logs)
      this.process.stderr!.on("data", (data) => {
        console.error(`[xtts_server] ${data.toString().trim()}`);
      });

      // Handle process exit
      this.process.on("exit", (code) => {
        console.error(`[huggingface-xtts] Process exited with code ${code}`);
        this.ready = false;
        this.process = null;
        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`Process exited with code ${code}`));
          this.pendingRequests.delete(id);
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
      }, this.config.startupTimeout);

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
        console.error(`[huggingface-xtts] Failed to parse response: ${line}`);
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
      }, this.config.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.process.stdin!.write(JSON.stringify(request) + "\n");
    });
  }

  /**
   * Run a quick Python command (for availability checks)
   */
  private runQuickCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.pythonPath, args, {
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

  /**
   * Resolve a voice ID to a speaker WAV path
   */
  private resolveSpeakerPath(voiceId: string): string | null {
    if (!voiceId || voiceId === "default") {
      return null;
    }

    const sanitized = this.sanitizeVoiceId(voiceId);

    // Check project directory first
    const projectPath = join(this.config.projectSpeakerDir, `${sanitized}.wav`);
    if (existsSync(projectPath)) {
      return projectPath;
    }

    // Check cache directory
    const cachePath = join(this.config.speakerCacheDir, `${sanitized}.wav`);
    if (existsSync(cachePath)) {
      return cachePath;
    }

    return null;
  }

  /**
   * Sanitize voice ID to prevent path traversal
   */
  private sanitizeVoiceId(voiceId: string): string {
    return voiceId.replace(/[^a-zA-Z0-9_-]/g, "");
  }
}

/**
 * Factory function
 */
export function createHuggingFaceXTTSAdapter(
  config?: HuggingFaceXTTSConfig
): HuggingFaceXTTSAdapter {
  return new HuggingFaceXTTSAdapter(config);
}
