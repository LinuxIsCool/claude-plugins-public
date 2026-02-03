/**
 * Piper TTS Adapter
 *
 * Fast, local TTS using Piper (ONNX-optimized neural TTS).
 * Serves as CPU fallback when GPU is unavailable.
 * ~200ms latency, 100+ pre-trained voices, zero API cost.
 *
 * @see https://github.com/rhasspy/piper
 * @see https://rhasspy.github.io/piper-samples/
 */

import { spawn, type ChildProcess } from "child_process";
import { existsSync, readdirSync, createWriteStream, mkdirSync } from "fs";
import { readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { homedir, tmpdir } from "os";
import type { TTSCapabilities, TTSOptions, TTSResult, VoiceInfo } from "../../ports/tts.js";
import { BaseTTSAdapter } from "./base.js";

/**
 * Piper configuration
 */
export interface PiperConfig {
  /** Directory containing voice models. Default: ~/.local/share/piper/voices */
  voicesDir?: string;
  /** Default voice to use. Default: en_US-lessac-high */
  defaultVoice?: string;
  /** Sample rate (Hz). Default: 22050 */
  sampleRate?: number;
  /** Speech speed multiplier. Default: 1.0 (0.5 = slower, 2.0 = faster) */
  lengthScale?: number;
  /** Phoneme noise scale (variation). Default: 0.667 */
  noiseScale?: number;
  /** Phoneme width noise. Default: 0.8 */
  noiseW?: number;
}

const DEFAULT_VOICES_DIR = join(homedir(), ".local/share/piper/voices");
const DEFAULT_VOICE = "en_US-lessac-high";
const DEFAULT_SAMPLE_RATE = 22050;

/** Timeout for piper synthesis in milliseconds (30 seconds) */
const PIPER_TIMEOUT_MS = 30000;

/**
 * HuggingFace base URL for Piper voice models
 */
const PIPER_VOICES_BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

/**
 * Piper TTS Adapter
 *
 * Uses the piper CLI tool for synthesis via safe subprocess spawning.
 * Text is passed via stdin to avoid shell injection vulnerabilities.
 */
export class PiperAdapter extends BaseTTSAdapter {
  private voicesDir: string;
  private defaultVoice: string;
  private sampleRate: number;
  private lengthScale: number;
  private noiseScale: number;
  private noiseW: number;
  private cachedVoices: VoiceInfo[] | null = null;

  constructor(config: PiperConfig = {}) {
    super(config);
    this.voicesDir = config.voicesDir || DEFAULT_VOICES_DIR;
    this.defaultVoice = config.defaultVoice || DEFAULT_VOICE;
    this.sampleRate = config.sampleRate || DEFAULT_SAMPLE_RATE;
    this.lengthScale = config.lengthScale || 1.0;
    this.noiseScale = config.noiseScale || 0.667;
    this.noiseW = config.noiseW || 0.8;
  }

  name(): string {
    return "piper";
  }

  capabilities(): TTSCapabilities {
    return {
      voices: [], // Populated via listVoices()
      streaming: false,
      voiceCloning: false,
      ssml: false,
      emotions: false,
      local: true,
      costPerChar: 0, // Free
      maxTextLength: 10000,
      supportedFormats: ["wav"],
    };
  }

  /**
   * Check if piper CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("piper", ["--version"]);
      let output = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });
      proc.stderr.on("data", (data) => {
        output += data.toString();
      });

      proc.on("error", () => resolve(false));
      proc.on("close", (code) => {
        // piper --version returns 0 and outputs version info
        resolve(code === 0 || output.toLowerCase().includes("piper"));
      });
    });
  }

  /**
   * Synthesize speech from text
   *
   * Uses stdin pipe for safe text delivery (no shell injection).
   */
  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    // Validate input text
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot synthesize empty or whitespace-only text");
    }

    const startTime = Date.now();
    const voiceId = options.voiceId || this.defaultVoice;
    const modelPath = this.getModelPath(voiceId);

    if (!existsSync(modelPath)) {
      throw new Error(
        `Piper voice not found: ${voiceId}. ` +
        `Expected at: ${modelPath}. ` +
        `Use downloadVoice('${voiceId}') to install.`
      );
    }

    // Calculate length scale from speed option (inverse relationship)
    // speed 1.0 = normal, 2.0 = faster (length_scale 0.5)
    const lengthScale = options.speed ? 1.0 / options.speed : this.lengthScale;

    // Create temp output file
    const outputPath = join(tmpdir(), `piper-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);

    try {
      // Spawn piper with stdin for text input (safe approach)
      await this.runPiper(text, {
        model: modelPath,
        outputFile: outputPath,
        lengthScale,
        noiseScale: this.noiseScale,
        noiseW: this.noiseW,
      });

      // Read the generated audio
      const audio = await readFile(outputPath);

      // Calculate duration from WAV file
      // WAV at 22050Hz, 16-bit mono: bytes = samples * 2
      const headerSize = 44;
      const bytesPerSample = 2;
      const numSamples = (audio.length - headerSize) / bytesPerSample;
      const durationMs = (numSamples / this.sampleRate) * 1000;

      return {
        audio,
        durationMs,
        format: "wav",
        processingTimeMs: Date.now() - startTime,
        charCount: text.length,
      };
    } finally {
      // Clean up temp file
      await unlink(outputPath).catch(() => {});
    }
  }

  /**
   * List installed voices by scanning the voices directory
   */
  async listVoices(): Promise<VoiceInfo[]> {
    if (this.cachedVoices) {
      return this.cachedVoices;
    }

    const voices: VoiceInfo[] = [];

    if (existsSync(this.voicesDir)) {
      const files = readdirSync(this.voicesDir);
      for (const file of files) {
        if (file.endsWith(".onnx")) {
          const voiceId = file.replace(".onnx", "");
          const info = this.parseVoiceId(voiceId);
          voices.push(info);
        }
      }
    }

    this.cachedVoices = voices;
    return voices;
  }

  /**
   * Download a voice model from HuggingFace
   *
   * @param voiceId Voice identifier (e.g., "en_US-lessac-high")
   * @param onProgress Optional progress callback (0-100)
   */
  async downloadVoice(voiceId: string, onProgress?: (percent: number) => void): Promise<void> {
    const { langShort, lang, name, quality } = this.parseVoiceIdParts(voiceId);

    const modelUrl = `${PIPER_VOICES_BASE_URL}/${langShort}/${lang}/${name}/${quality}/${voiceId}.onnx`;
    const configUrl = `${modelUrl}.json`;

    const modelPath = this.getModelPath(voiceId);
    const configPath = `${modelPath}.json`;

    // Ensure voices directory exists
    if (!existsSync(this.voicesDir)) {
      mkdirSync(this.voicesDir, { recursive: true });
    }

    // Download model file
    await this.downloadFile(modelUrl, modelPath, (percent) => {
      // Model is ~95% of download, config is ~5%
      onProgress?.(percent * 0.95);
    });

    // Download config file
    await this.downloadFile(configUrl, configPath, (percent) => {
      onProgress?.(95 + percent * 0.05);
    });

    // Clear voice cache to pick up new voice
    this.cachedVoices = null;
  }

  /**
   * Get list of installed voice IDs
   */
  async getInstalledVoices(): Promise<string[]> {
    if (!existsSync(this.voicesDir)) {
      return [];
    }

    return readdirSync(this.voicesDir)
      .filter((f) => f.endsWith(".onnx"))
      .map((f) => f.replace(".onnx", ""));
  }

  /**
   * Check if a specific voice is installed
   */
  isVoiceInstalled(voiceId: string): boolean {
    return existsSync(this.getModelPath(voiceId));
  }

  // ─────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Get the file path for a voice model
   */
  private getModelPath(voiceId: string): string {
    return join(this.voicesDir, `${voiceId}.onnx`);
  }

  /**
   * Parse voice ID into components (DRY: single source of truth for parsing)
   *
   * Voice ID format: {lang}_{COUNTRY}-{name}-{quality}
   * Example: en_US-lessac-high
   */
  private parseVoiceIdComponents(voiceId: string): {
    langCode: string;      // "en_US"
    langShort: string;     // "en"
    country: string;       // "US" or ""
    name: string;          // "lessac"
    quality: string;       // "high"
    language: string;      // "en-US" (display format)
  } {
    const parts = voiceId.split("-");
    const langCode = parts[0] || "";           // e.g., "en_US"
    const [langShort, country = ""] = langCode.split("_");
    const name = parts[1] || "unknown";
    const quality = parts[2] || "medium";
    const language = country ? `${langShort}-${country}` : langShort;

    return { langCode, langShort, country, name, quality, language };
  }

  /**
   * Parse voice ID into VoiceInfo for listing
   */
  private parseVoiceId(voiceId: string): VoiceInfo {
    const { langShort, name, quality, language } = this.parseVoiceIdComponents(voiceId);

    return {
      id: voiceId,
      name: `${name} (${language}, ${quality})`,
      gender: this.inferGender(name),
      language,
      languageCode: langShort,
      description: `Piper ${quality} quality voice`,
    };
  }

  /**
   * Parse voice ID into URL path components for downloads
   */
  private parseVoiceIdParts(voiceId: string): {
    langShort: string;
    lang: string;
    name: string;
    quality: string;
  } {
    const { langShort, langCode, name, quality } = this.parseVoiceIdComponents(voiceId);
    return { langShort, lang: langCode, name, quality };
  }

  /**
   * Infer gender from voice name (heuristic)
   */
  private inferGender(name: string): "male" | "female" | "neutral" {
    const femalNames = ["lessac", "amy", "jenny", "alba", "ljspeech", "nancy", "kusal"];
    const maleNames = ["ryan", "alan", "joe", "arctic", "danny"];

    const lowerName = name.toLowerCase();
    if (femalNames.some((n) => lowerName.includes(n))) return "female";
    if (maleNames.some((n) => lowerName.includes(n))) return "male";
    return "neutral";
  }

  /**
   * Run piper CLI with stdin text input
   *
   * Includes timeout protection and proper error handling for stdin.
   */
  private runPiper(
    text: string,
    options: {
      model: string;
      outputFile: string;
      lengthScale: number;
      noiseScale: number;
      noiseW: number;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const cleanup = (error?: Error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      const args = [
        "--model", options.model,
        "--output_file", options.outputFile,
        "--length_scale", options.lengthScale.toString(),
        "--noise_scale", options.noiseScale.toString(),
        "--noise_w", options.noiseW.toString(),
      ];

      const proc = spawn("piper", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Set timeout to prevent hanging forever
      const timeout = setTimeout(() => {
        proc.kill("SIGTERM");
        cleanup(new Error(`Piper process timed out after ${PIPER_TIMEOUT_MS / 1000}s`));
      }, PIPER_TIMEOUT_MS);

      let stderr = "";

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("error", (err) => {
        cleanup(new Error(`Failed to spawn piper: ${err.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          cleanup();
        } else {
          cleanup(new Error(`Piper exited with code ${code}: ${stderr}`));
        }
      });

      // Handle stdin errors (e.g., broken pipe if process dies early)
      proc.stdin.on("error", (err) => {
        cleanup(new Error(`Failed to write to piper stdin: ${err.message}`));
      });

      // Write text to stdin and close (this is the safe approach)
      proc.stdin.write(text);
      proc.stdin.end();
    });
  }

  /**
   * Download a file using native fetch with progress tracking
   */
  private async downloadFile(
    url: string,
    destPath: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (contentLength > 0 && onProgress) {
        onProgress((receivedLength / contentLength) * 100);
      }
    }

    // Combine chunks and write to file
    const buffer = Buffer.concat(chunks);
    await writeFile(destPath, buffer);
  }
}

/**
 * Factory function
 */
export function createPiperAdapter(config?: PiperConfig): PiperAdapter {
  return new PiperAdapter(config);
}
