/**
 * STT Adapter Factory
 *
 * Creates STT backends with priority-based fallback.
 * Priority order: Whisper (local GPU) > Cloud APIs > Fallbacks
 */

import type {
  STTPort,
  STTBackendFactory,
  STTOptions,
  STTResult,
  AudioInput,
  StreamingSTTEvent,
} from "../../ports/stt.js";
import { WhisperAdapter, createWhisperAdapter, type WhisperConfig } from "./whisper.js";

/**
 * Backend configuration
 */
export interface STTBackendConfig {
  whisper?: WhisperConfig;
  // Future backends
  deepgram?: Record<string, unknown>;
  assemblyai?: Record<string, unknown>;
  vosk?: Record<string, unknown>;
}

/**
 * Backend priority (higher number = higher priority)
 */
const BACKEND_PRIORITY: Record<string, number> = {
  whisper: 100,      // Local GPU, best accuracy
  deepgram: 90,      // Cloud, streaming, fast
  assemblyai: 85,    // Cloud, high accuracy
  vosk: 70,          // Local, lightweight
};

/**
 * STT Backend Factory Implementation
 */
export class STTFactory implements STTBackendFactory {
  private backends: Map<string, STTPort> = new Map();
  private config: STTBackendConfig;

  constructor(config: STTBackendConfig = {}) {
    this.config = config;
  }

  create(name: string, config?: Record<string, unknown>): STTPort {
    const existing = this.backends.get(name);
    if (existing) return existing;

    let adapter: STTPort;
    const backendConfig = { ...this.config[name as keyof STTBackendConfig], ...config };

    switch (name) {
      case "whisper":
        adapter = createWhisperAdapter(backendConfig as WhisperConfig);
        break;
      // Future backends
      case "deepgram":
      case "assemblyai":
      case "vosk":
        throw new Error(`Backend "${name}" not yet implemented`);
      default:
        throw new Error(`Unknown STT backend: ${name}`);
    }

    this.backends.set(name, adapter);
    return adapter;
  }

  list(): string[] {
    return Object.keys(BACKEND_PRIORITY).sort(
      (a, b) => BACKEND_PRIORITY[b] - BACKEND_PRIORITY[a]
    );
  }

  async getAvailable(): Promise<STTPort | null> {
    // Try backends in priority order
    for (const name of this.list()) {
      try {
        const adapter = this.create(name);
        if (await adapter.isAvailable()) {
          return adapter;
        }
      } catch {
        // Backend not implemented or config error, continue
      }
    }
    return null;
  }

  async getStreaming(): Promise<STTPort | null> {
    // Try backends that support streaming
    for (const name of this.list()) {
      try {
        const adapter = this.create(name);
        if (await adapter.isAvailable()) {
          const caps = adapter.capabilities();
          if (caps.streaming) {
            return adapter;
          }
        }
      } catch {
        // Continue
      }
    }
    return null;
  }

  async getBatch(): Promise<STTPort | null> {
    // Try backends that support batch
    for (const name of this.list()) {
      try {
        const adapter = this.create(name);
        if (await adapter.isAvailable()) {
          const caps = adapter.capabilities();
          if (caps.batch) {
            return adapter;
          }
        }
      } catch {
        // Continue
      }
    }
    return null;
  }

  async getWithFallback(preferred?: string): Promise<STTPort> {
    // Try preferred backend first
    if (preferred) {
      try {
        const adapter = this.create(preferred);
        if (await adapter.isAvailable()) {
          return adapter;
        }
      } catch {
        // Continue to fallback
      }
    }

    // Try all backends in priority order
    const available = await this.getAvailable();
    if (available) {
      return available;
    }

    throw new Error("No STT backend available");
  }
}

/**
 * Create an STT factory with configuration
 */
export function createSTTFactory(config?: STTBackendConfig): STTFactory {
  return new STTFactory(config);
}

/**
 * Default factory instance
 */
let defaultFactory: STTFactory | null = null;

/**
 * Get or create the default STT factory
 */
export function getDefaultSTTFactory(): STTFactory {
  if (!defaultFactory) {
    defaultFactory = createSTTFactory();
  }
  return defaultFactory;
}

/**
 * High-level transcribe function with automatic backend selection
 */
export async function transcribe(
  input: AudioInput,
  options: Partial<STTOptions> = {},
  preferredBackend?: string
): Promise<STTResult> {
  const factory = getDefaultSTTFactory();
  const backend = await factory.getWithFallback(preferredBackend);

  const fullOptions: STTOptions = {
    wordTimestamps: options.wordTimestamps ?? false,
    ...options,
  };

  return backend.transcribe(input, fullOptions);
}

/**
 * High-level streaming transcription function
 */
export async function* transcribeStream(
  input: AudioInput,
  options: Partial<STTOptions> = {},
  preferredBackend?: string
): AsyncGenerator<StreamingSTTEvent> {
  const factory = getDefaultSTTFactory();
  const backend = await factory.getStreaming();

  if (!backend || !backend.transcribeStream) {
    throw new Error("No streaming STT backend available");
  }

  const fullOptions: STTOptions = {
    wordTimestamps: options.wordTimestamps ?? true,
    ...options,
  };

  yield* backend.transcribeStream(input, fullOptions);
}

// Re-export adapters
export { WhisperAdapter, createWhisperAdapter, type WhisperConfig } from "./whisper.js";
export { BaseSTTAdapter, audioInputToFile, cleanupTempFile } from "./base.js";
