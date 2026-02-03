/**
 * Transcription Adapters
 *
 * Backend implementations for TranscriptionPort.
 */

export * from "./whisper.js";
export * from "./faster-whisper.js";

import type { TranscriptionPort, TranscriptionBackendFactory } from "../../ports/transcription.js";
import { WhisperAdapter, type WhisperConfig } from "./whisper.js";
import { FasterWhisperAdapter, type FasterWhisperConfig } from "./faster-whisper.js";

/**
 * Available transcription backends
 */
const BACKENDS: Record<string, (config?: Record<string, unknown>) => TranscriptionPort> = {
  // Faster-whisper (GPU-accelerated, recommended)
  "faster-whisper": (config) => new FasterWhisperAdapter(config as FasterWhisperConfig),

  // Original whisper.cpp
  whisper: (config) => new WhisperAdapter({ mode: "local", ...config } as WhisperConfig),
  "whisper-local": (config) => new WhisperAdapter({ ...config, mode: "local" } as WhisperConfig),
  "whisper-api": (config) => new WhisperAdapter({ ...config, mode: "api" } as WhisperConfig),
};

/**
 * Factory for creating transcription backends
 */
export const transcriptionFactory: TranscriptionBackendFactory = {
  create(name: string, config?: Record<string, unknown>): TranscriptionPort {
    const factory = BACKENDS[name];
    if (!factory) {
      throw new Error(`Unknown transcription backend: ${name}. Available: ${Object.keys(BACKENDS).join(", ")}`);
    }
    return factory(config);
  },

  list(): string[] {
    return Object.keys(BACKENDS);
  },

  default(): TranscriptionPort {
    // Default to faster-whisper (GPU-accelerated)
    return new FasterWhisperAdapter();
  },
};
