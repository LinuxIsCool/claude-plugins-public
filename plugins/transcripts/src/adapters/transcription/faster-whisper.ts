/**
 * Faster-Whisper Transcription Adapter
 *
 * Uses faster-whisper Python library with GPU acceleration.
 * References the shared ML environment at ~/.venvs/ml
 *
 * Key benefits over whisper.cpp:
 * - 4x faster than original Whisper
 * - INT8 quantization for memory efficiency
 * - Better GPU utilization
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
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
 * Faster-Whisper model sizes
 */
export type FasterWhisperModel =
  | "tiny"
  | "tiny.en"
  | "base"
  | "base.en"
  | "small"
  | "small.en"
  | "medium"
  | "medium.en"
  | "large-v2"
  | "large-v3";

/**
 * Compute type for inference
 */
export type ComputeType = "int8" | "int8_float16" | "float16" | "float32";

/**
 * Configuration
 */
export interface FasterWhisperConfig {
  model?: FasterWhisperModel;
  device?: "cuda" | "cpu" | "auto";
  computeType?: ComputeType;
  pythonPath?: string;  // Path to Python with faster-whisper
}

/**
 * Default configuration - uses shared ML environment
 */
const DEFAULT_CONFIG: FasterWhisperConfig = {
  model: "base",
  device: "auto",
  computeType: "int8",
  pythonPath: join(homedir(), ".venvs/ml/bin/python"),
};

/**
 * Get cuDNN library path for GPU support.
 * nvidia-cudnn-cu12 installs libs here but ctranslate2 needs them in LD_LIBRARY_PATH.
 */
function getCudnnLibPath(): string {
  // Extract venv path from python path and construct cudnn lib path
  const venvPath = join(homedir(), ".venvs/ml");
  return join(venvPath, "lib/python3.11/site-packages/nvidia/cudnn/lib");
}

/**
 * Faster-Whisper Adapter
 */
export class FasterWhisperAdapter implements TranscriptionPort {
  private config: FasterWhisperConfig;

  constructor(config: Partial<FasterWhisperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  name(): string {
    return "faster-whisper";
  }

  capabilities(): TranscriptionCapabilities {
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
      speaker_diarization: false,
      punctuation: true,
      profanity_filter: false,
      supports_streaming: false,
      supports_files: true,
      supports_urls: false,
      audio_formats: ["wav", "mp3", "m4a", "flac", "ogg", "webm"],
      max_duration_ms: undefined,
      models: [
        "tiny", "tiny.en", "base", "base.en", "small", "small.en",
        "medium", "medium.en", "large-v2", "large-v3",
      ],
      default_model: "base",
    };
  }

  async isAvailable(): Promise<boolean> {
    const pythonPath = this.config.pythonPath || DEFAULT_CONFIG.pythonPath!;

    if (!existsSync(pythonPath)) {
      return false;
    }

    // Set LD_LIBRARY_PATH for cuDNN libs
    const cudnnPath = getCudnnLibPath();
    const env = {
      ...process.env,
      LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
    };

    return new Promise((resolve) => {
      const proc = spawn(pythonPath, ["-c", "from faster_whisper import WhisperModel; print('ok')"], { env });
      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
    });
  }

  async transcribe(
    input: AudioInput,
    options?: TranscriptionOptions,
    onProgress?: TranscriptionProgressCallback
  ): Promise<TranscriptionResult> {
    if (input.type !== "file") {
      throw new Error("faster-whisper adapter only supports file input");
    }

    const pythonPath = this.config.pythonPath || DEFAULT_CONFIG.pythonPath!;
    const model = options?.model || this.config.model || "base";
    const device = this.config.device || "auto";
    const computeType = this.config.computeType || "int8";
    const language = options?.language || "";
    const beamSize = options?.beam_size || 5;

    // Build Python script to run
    const script = `
import json
import sys
import time
from faster_whisper import WhisperModel

# Configuration
file_path = ${JSON.stringify(input.path)}
model_name = ${JSON.stringify(model)}
device = ${JSON.stringify(device)}
compute_type = ${JSON.stringify(computeType)}
language = ${JSON.stringify(language)} or None
beam_size = ${beamSize}

# Load model
start_load = time.time()
model = WhisperModel(model_name, device=device, compute_type=compute_type)
load_time = time.time() - start_load

# Transcribe
start_transcribe = time.time()
segments, info = model.transcribe(
    file_path,
    language=language,
    beam_size=beam_size,
    word_timestamps=True,
)

# Collect segments
utterances = []
for segment in segments:
    utterances.append({
        "start": segment.start,
        "end": segment.end,
        "text": segment.text.strip(),
        "avg_logprob": segment.avg_logprob,
        "no_speech_prob": segment.no_speech_prob,
    })

transcribe_time = time.time() - start_transcribe

# Output result as JSON
result = {
    "utterances": utterances,
    "language": info.language,
    "language_probability": info.language_probability,
    "duration": info.duration,
    "load_time_ms": int(load_time * 1000),
    "transcribe_time_ms": int(transcribe_time * 1000),
    "model": model_name,
}
print(json.dumps(result))
`;

    // Run Python
    const result = await this.runPython(pythonPath, script, onProgress);
    const data = JSON.parse(result);

    // Convert to our format
    const utterances: Utterance[] = data.utterances.map((seg: any, i: number) => ({
      id: `ut_temp_${String(i).padStart(4, "0")}`,
      index: i,
      speaker: {
        id: "spk_unknown",
        name: "Speaker",
      },
      text: seg.text,
      start_ms: Math.round(seg.start * 1000),
      end_ms: Math.round(seg.end * 1000),
      duration_ms: Math.round((seg.end - seg.start) * 1000),
      confidence: {
        transcription: 1 - (seg.no_speech_prob || 0),
      },
      language: data.language,
    }));

    return {
      utterances,
      language: data.language,
      language_confidence: data.language_probability,
      duration_ms: Math.round(data.duration * 1000),
      processing_time_ms: data.load_time_ms + data.transcribe_time_ms,
      model: data.model,
    };
  }

  /**
   * Run Python script and capture output
   */
  private runPython(
    pythonPath: string,
    script: string,
    _onProgress?: TranscriptionProgressCallback
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Set LD_LIBRARY_PATH to include cuDNN libs for GPU support
      const cudnnPath = getCudnnLibPath();
      const env = {
        ...process.env,
        LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
      };

      const proc = spawn(pythonPath, ["-c", script], { env });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
        // Progress could be parsed from stderr if we add progress reporting
      });

      proc.on("error", (error) => {
        reject(new Error(`Failed to run Python: ${error.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Python exited with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Streaming not supported by faster-whisper adapter
   */
  async *transcribeStream(
    input: AudioInput,
    options?: TranscriptionOptions
  ): AsyncGenerator<StreamingEvent> {
    yield { type: "started", session_id: `fw_${Date.now()}` };

    try {
      const result = await this.transcribe(input, options);
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
 * Factory function
 */
export function createFasterWhisperAdapter(config?: Partial<FasterWhisperConfig>): FasterWhisperAdapter {
  return new FasterWhisperAdapter(config);
}
