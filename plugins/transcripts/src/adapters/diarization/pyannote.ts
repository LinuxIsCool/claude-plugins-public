/**
 * PyAnnote Speaker Diarization Adapter
 *
 * Uses pyannote-audio Python library with GPU acceleration for speaker diarization.
 * References the shared ML environment at ~/.venvs/ml
 *
 * Key features:
 * - GPU-accelerated speaker segmentation
 * - Overlapping speech detection
 * - Speaker embeddings for re-identification
 */

import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type {
  DiarizationPort,
  DiarizationCapabilities,
  DiarizationOptions,
  DiarizationResult,
  DiarizationSegment,
} from "../../ports/diarization.js";
import type { AudioInput } from "../../domain/values/media-source.js";

/**
 * PyAnnote model variants
 */
export type PyAnnoteModel =
  | "pyannote/speaker-diarization-3.1"
  | "pyannote/speaker-diarization@2.1";

/**
 * Configuration
 */
export interface PyAnnoteConfig {
  model?: PyAnnoteModel;
  device?: "cuda" | "cpu" | "auto";
  pythonPath?: string;
  hfToken?: string;  // HuggingFace token for gated models
}

/**
 * Default configuration - uses shared ML environment
 */
const DEFAULT_CONFIG: PyAnnoteConfig = {
  model: "pyannote/speaker-diarization-3.1",
  device: "auto",
  pythonPath: join(homedir(), ".venvs/ml/bin/python"),
};

/**
 * Get HuggingFace token from environment or .env file
 */
function getHfToken(): string | undefined {
  if (process.env.HF_TOKEN) {
    return process.env.HF_TOKEN;
  }

  // Try to read from local .env file
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf8");
      const match = envContent.match(/^HF_TOKEN=(.+)$/m);
      if (match) {
        return match[1].trim();
      }
    } catch {
      // Ignore read errors
    }
  }

  return undefined;
}

/**
 * Get cuDNN library path for GPU support.
 * nvidia-cudnn-cu12 installs libs here but ctranslate2 needs them in LD_LIBRARY_PATH.
 */
function getCudnnLibPath(): string {
  const venvPath = join(homedir(), ".venvs/ml");
  return join(venvPath, "lib/python3.11/site-packages/nvidia/cudnn/lib");
}

/**
 * PyAnnote Diarization Adapter
 */
export class PyAnnoteAdapter implements DiarizationPort {
  private config: PyAnnoteConfig;

  constructor(config: Partial<PyAnnoteConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  name(): string {
    return "pyannote";
  }

  capabilities(): DiarizationCapabilities {
    return {
      max_speakers: 20,
      min_speakers: 1,
      overlapping_speech: true,
      speaker_embedding: true,
      min_segment_duration_ms: 500,
      supports_streaming: false,
      supports_batching: false,
    };
  }

  async isAvailable(): Promise<boolean> {
    const pythonPath = this.config.pythonPath || DEFAULT_CONFIG.pythonPath!;

    if (!existsSync(pythonPath)) {
      return false;
    }

    // Check for HF_TOKEN
    const hfToken = this.config.hfToken || getHfToken();
    if (!hfToken) {
      return false;
    }

    // Set LD_LIBRARY_PATH for cuDNN libs
    const cudnnPath = getCudnnLibPath();
    const env = {
      ...process.env,
      LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
      HF_TOKEN: hfToken,
    };

    return new Promise((resolve) => {
      const proc = spawn(pythonPath, ["-c", "from pyannote.audio import Pipeline; print('ok')"], { env });
      proc.on("error", () => resolve(false));
      proc.on("close", (code) => resolve(code === 0));
    });
  }

  async diarize(
    input: AudioInput,
    options?: DiarizationOptions
  ): Promise<DiarizationResult> {
    if (input.type !== "file") {
      throw new Error("pyannote adapter only supports file input");
    }

    const pythonPath = this.config.pythonPath || DEFAULT_CONFIG.pythonPath!;
    const model = this.config.model || DEFAULT_CONFIG.model!;
    const device = this.config.device || "auto";
    const hfToken = this.config.hfToken || getHfToken();

    if (!hfToken) {
      throw new Error("HuggingFace token required for pyannote. Set HF_TOKEN environment variable.");
    }

    // Build Python script to run
    const script = `
import json
import sys
import time
import torch
import torchaudio
from pyannote.audio import Pipeline

# Configuration
file_path = ${JSON.stringify(input.path)}
model_name = ${JSON.stringify(model)}
device = ${JSON.stringify(device)}
num_speakers = ${options?.num_speakers ?? "None"}
min_speakers = ${options?.min_speakers ?? "None"}
max_speakers = ${options?.max_speakers ?? "None"}

# Resolve device
if device == "auto":
    device = "cuda" if torch.cuda.is_available() else "cpu"

# Load model
start_load = time.time()
pipeline = Pipeline.from_pretrained(model_name)
pipeline.to(torch.device(device))
load_time = time.time() - start_load

# Load audio using torchaudio (bypasses torchcodec)
waveform, sample_rate = torchaudio.load(file_path)
audio_input = {"waveform": waveform, "sample_rate": sample_rate}
duration_s = waveform.shape[1] / sample_rate

# Build pipeline kwargs
pipeline_kwargs = {}
if num_speakers is not None:
    pipeline_kwargs["num_speakers"] = num_speakers
if min_speakers is not None:
    pipeline_kwargs["min_speakers"] = min_speakers
if max_speakers is not None:
    pipeline_kwargs["max_speakers"] = max_speakers

# Run diarization
start_diarize = time.time()
output = pipeline(audio_input, **pipeline_kwargs)
diarize_time = time.time() - start_diarize

# Collect segments
segments = []
speaker_labels = set()

for turn, _, speaker in output.speaker_diarization.itertracks(yield_label=True):
    speaker_labels.add(speaker)
    segments.append({
        "speaker_label": speaker,
        "start_ms": int(turn.start * 1000),
        "end_ms": int(turn.end * 1000),
    })

# Get speaker embeddings if available
# Note: speaker_embeddings is a numpy array of shape (num_speakers, embedding_dim)
embeddings = {}
if hasattr(output, 'speaker_embeddings') and output.speaker_embeddings is not None:
    emb_array = output.speaker_embeddings
    # Map speakers to embeddings by order
    unique_speakers = sorted(list(speaker_labels))
    for i, speaker in enumerate(unique_speakers):
        if i < len(emb_array):
            embeddings[speaker] = emb_array[i].tolist()

# Output result as JSON
result = {
    "segments": segments,
    "speaker_count": len(speaker_labels),
    "speaker_labels": sorted(list(speaker_labels)),
    "duration_ms": int(duration_s * 1000),
    "load_time_ms": int(load_time * 1000),
    "diarize_time_ms": int(diarize_time * 1000),
    "embeddings": embeddings,
}
print(json.dumps(result))
`;

    // Run Python
    const result = await this.runPython(pythonPath, script, hfToken);
    const data = JSON.parse(result);

    // Convert to our format
    const segments: DiarizationSegment[] = data.segments.map((seg: any) => ({
      speaker_label: seg.speaker_label,
      start_ms: seg.start_ms,
      end_ms: seg.end_ms,
    }));

    // Convert embeddings from number[] to Float32Array
    const embeddings: Record<string, Float32Array> | undefined = data.embeddings
      ? Object.fromEntries(
          Object.entries(data.embeddings as Record<string, number[]>).map(
            ([speaker, emb]) => [speaker, new Float32Array(emb)]
          )
        )
      : undefined;

    return {
      segments,
      speaker_count: data.speaker_count,
      speaker_labels: data.speaker_labels,
      duration_ms: data.duration_ms,
      processing_time_ms: data.load_time_ms + data.diarize_time_ms,
      embeddings,
    };
  }

  /**
   * Run Python script and capture output
   */
  private runPython(pythonPath: string, script: string, hfToken: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Set LD_LIBRARY_PATH to include cuDNN libs for GPU support
      const cudnnPath = getCudnnLibPath();
      const env = {
        ...process.env,
        LD_LIBRARY_PATH: cudnnPath + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ""),
        HF_TOKEN: hfToken,
      };

      const proc = spawn(pythonPath, ["-c", script], { env });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("error", (error) => {
        reject(new Error(`Failed to run Python: ${error.message}`));
      });

      proc.on("close", (code) => {
        if (code === 0) {
          // Find the JSON line (last non-empty line)
          const lines = stdout.trim().split("\n");
          const jsonLine = lines[lines.length - 1];
          resolve(jsonLine);
        } else {
          reject(new Error(`Python exited with code ${code}: ${stderr}`));
        }
      });
    });
  }
}

/**
 * Factory function
 */
export function createPyAnnoteAdapter(config?: Partial<PyAnnoteConfig>): PyAnnoteAdapter {
  return new PyAnnoteAdapter(config);
}
