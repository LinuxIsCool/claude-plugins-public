/**
 * Whisper Transcription Adapter
 *
 * Implements TranscriptionPort for OpenAI Whisper (local and API).
 * Supports whisper.cpp for local inference and OpenAI API for cloud.
 */

import { spawn } from "child_process";
import type {
  TranscriptionPort,
  TranscriptionCapabilities,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgressCallback,
  StreamingEvent,
} from "../../ports/transcription.js";
import type { AudioInput } from "../../domain/values/media-source.js";
import type { Utterance } from "../../domain/entities/utterance.js";

/**
 * Whisper model sizes
 */
export type WhisperModel =
  | "tiny"
  | "tiny.en"
  | "base"
  | "base.en"
  | "small"
  | "small.en"
  | "medium"
  | "medium.en"
  | "large"
  | "large-v2"
  | "large-v3";

/**
 * Whisper backend mode
 */
export type WhisperMode = "local" | "api";

/**
 * Whisper adapter configuration
 */
export interface WhisperConfig {
  mode: WhisperMode;
  model?: WhisperModel;

  // Local mode settings
  whisperCppPath?: string;      // Path to whisper.cpp binary
  modelPath?: string;           // Path to model file

  // API mode settings
  apiKey?: string;              // OpenAI API key
  apiBaseUrl?: string;          // Custom API base URL
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WhisperConfig = {
  mode: "local",
  model: "base",
  whisperCppPath: "whisper",    // Assumes in PATH
};

/**
 * Whisper.cpp JSON output segment
 */
interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

/**
 * Whisper.cpp JSON output
 */
interface WhisperOutput {
  systeminfo: string;
  model: {
    type: string;
    multilingual: boolean;
    vocab: number;
    audio: { ctx: number; state: number; head: number; layer: number };
    text: { ctx: number; state: number; head: number; layer: number };
    mels: number;
    ftype: number;
  };
  params: {
    model: string;
    language: string;
    translate: boolean;
  };
  result: {
    language: string;
  };
  transcription: WhisperSegment[];
}

/**
 * Whisper Transcription Adapter
 */
export class WhisperAdapter implements TranscriptionPort {
  private config: WhisperConfig;

  constructor(config: Partial<WhisperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  name(): string {
    return `whisper-${this.config.mode}`;
  }

  capabilities(): TranscriptionCapabilities {
    const isLocal = this.config.mode === "local";

    return {
      languages: [
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
      ],
      auto_detect_language: true,
      word_timestamps: true,
      speaker_diarization: false,  // Whisper doesn't do diarization
      punctuation: true,
      profanity_filter: false,
      supports_streaming: isLocal,  // Local can stream
      supports_files: true,
      supports_urls: !isLocal,      // API supports URLs
      audio_formats: ["wav", "mp3", "m4a", "flac", "ogg", "webm"],
      max_duration_ms: isLocal ? undefined : 25 * 60 * 1000,  // API has 25 min limit
      models: [
        "tiny", "tiny.en", "base", "base.en", "small", "small.en",
        "medium", "medium.en", "large", "large-v2", "large-v3",
      ],
      default_model: "base",
    };
  }

  async isAvailable(): Promise<boolean> {
    if (this.config.mode === "api") {
      return !!this.config.apiKey;
    }

    // Check if whisper.cpp is available
    return new Promise((resolve) => {
      const proc = spawn(this.config.whisperCppPath || "whisper", ["--help"]);
      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
    });
  }

  async transcribe(
    input: AudioInput,
    options?: TranscriptionOptions,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult> {
    if (this.config.mode === "api") {
      return this.transcribeAPI(input, options);
    }
    return this.transcribeLocal(input, options, onProgress);
  }

  /**
   * Local transcription using whisper.cpp
   */
  private async transcribeLocal(
    input: AudioInput,
    options?: TranscriptionOptions,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult> {
    if (input.type !== "file") {
      throw new Error("Local Whisper only supports file input");
    }

    const startTime = Date.now();

    // Build command arguments
    const args: string[] = [
      "-f", input.path,
      "-oj",                      // JSON output
      "--print-progress",
    ];

    if (options?.language) {
      args.push("-l", options.language);
    }

    if (options?.word_timestamps) {
      args.push("--max-len", "0");  // Word-level timestamps
    }

    if (options?.model) {
      args.push("-m", this.getModelPath(options.model));
    } else if (this.config.modelPath) {
      args.push("-m", this.config.modelPath);
    }

    if (options?.beam_size) {
      args.push("--beam-size", String(options.beam_size));
    }

    if (options?.initial_prompt) {
      args.push("--prompt", options.initial_prompt);
    }

    // Run whisper
    const result = await this.runWhisper(args, onProgress);

    // Parse JSON output
    const output: WhisperOutput = JSON.parse(result);

    // Convert segments to utterances
    const utterances: Utterance[] = output.transcription.map((seg, i) => ({
      id: `ut_temp_${String(i).padStart(4, "0")}`,  // Temp ID, real one assigned by store
      index: i,
      speaker: {
        id: "spk_unknown",
        name: "Speaker",
      },
      text: seg.text.trim(),
      start_ms: Math.round(seg.start * 1000),
      end_ms: Math.round(seg.end * 1000),
      duration_ms: Math.round((seg.end - seg.start) * 1000),
      confidence: {
        transcription: 1 - seg.no_speech_prob,
      },
      language: output.result.language,
    }));

    return {
      utterances,
      language: output.result.language,
      language_confidence: undefined,  // Whisper doesn't provide this
      duration_ms: utterances.length > 0
        ? utterances[utterances.length - 1].end_ms
        : 0,
      processing_time_ms: Date.now() - startTime,
      model: output.params.model || this.config.model || "unknown",
    };
  }

  /**
   * API transcription using OpenAI Whisper API
   */
  private async transcribeAPI(
    input: AudioInput,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    if (!this.config.apiKey) {
      throw new Error("OpenAI API key required for API mode");
    }

    const startTime = Date.now();

    // Prepare form data
    const formData = new FormData();

    if (input.type === "file") {
      const file = Bun.file(input.path);
      formData.append("file", file);
    } else if (input.type === "buffer") {
      const blob = new Blob([input.buffer], { type: `audio/${input.format}` });
      formData.append("file", blob, `audio.${input.format}`);
    } else {
      throw new Error("API mode requires file or buffer input");
    }

    formData.append("model", options?.model || "whisper-1");
    formData.append("response_format", "verbose_json");

    if (options?.language) {
      formData.append("language", options.language);
    }

    if (options?.initial_prompt) {
      formData.append("prompt", options.initial_prompt);
    }

    if (options?.temperature !== undefined) {
      formData.append("temperature", String(options.temperature));
    }

    // Call API
    const baseUrl = this.config.apiBaseUrl || "https://api.openai.com/v1";
    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const data = await response.json() as {
      text: string;
      language: string;
      duration: number;
      segments: Array<{
        id: number;
        start: number;
        end: number;
        text: string;
        avg_logprob: number;
        no_speech_prob: number;
      }>;
    };

    // Convert to utterances
    const utterances: Utterance[] = data.segments.map((seg, i) => ({
      id: `ut_temp_${String(i).padStart(4, "0")}`,
      index: i,
      speaker: {
        id: "spk_unknown",
        name: "Speaker",
      },
      text: seg.text.trim(),
      start_ms: Math.round(seg.start * 1000),
      end_ms: Math.round(seg.end * 1000),
      duration_ms: Math.round((seg.end - seg.start) * 1000),
      confidence: {
        transcription: 1 - seg.no_speech_prob,
      },
      language: data.language,
    }));

    return {
      utterances,
      language: data.language,
      duration_ms: Math.round(data.duration * 1000),
      processing_time_ms: Date.now() - startTime,
      model: options?.model || "whisper-1",
    };
  }

  /**
   * Run whisper.cpp and capture output
   */
  private runWhisper(
    args: string[],
    onProgress?: TranscriptionProgressCallback
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.whisperCppPath || "whisper", args);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        const text = data.toString();
        stderr += text;

        // Parse progress from stderr
        if (onProgress) {
          const match = text.match(/progress\s*=\s*(\d+)%/);
          if (match) {
            onProgress({
              percent: parseInt(match[1], 10),
              current_time_ms: 0,
              total_time_ms: 0,
              utterances_processed: 0,
            });
          }
        }
      });

      proc.on("error", (error) => {
        reject(new Error(`Failed to run whisper: ${error.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Get model file path
   */
  private getModelPath(model: string): string {
    if (this.config.modelPath) {
      return this.config.modelPath;
    }
    // Default whisper.cpp model location
    return `ggml-${model}.bin`;
  }

  /**
   * Streaming transcription (local only)
   */
  async *transcribeStream(
    input: AudioInput,
    options?: TranscriptionOptions
  ): AsyncGenerator<StreamingEvent> {
    if (this.config.mode === "api") {
      throw new Error("Streaming not supported in API mode");
    }

    // For now, fall back to batch and emit as single final
    yield { type: "started", session_id: `whisper_${Date.now()}` };

    try {
      const result = await this.transcribeLocal(input, options);

      for (const utterance of result.utterances) {
        yield { type: "final", utterance };
      }

      yield { type: "completed", result };
    } catch (error) {
      yield { type: "error", error: error as Error };
    }
  }
}

/**
 * Create a Whisper adapter
 */
export function createWhisperAdapter(config?: Partial<WhisperConfig>): WhisperAdapter {
  return new WhisperAdapter(config);
}
