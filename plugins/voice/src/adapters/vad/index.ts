/**
 * VAD Adapter Factory
 *
 * Creates VAD backends with priority-based fallback.
 * Priority order: Silero > WebRTC (future) > ...
 */

import type {
  VADPort,
  VADBackendFactory,
  VADOptions,
  VADResult,
} from "../../ports/vad.js";
import type { AudioChunk } from "../../ports/stt.js";
import { SileroVADAdapter, createSileroVADAdapter, type SileroVADConfig } from "./silero.js";

/**
 * Backend configuration
 */
export interface VADBackendConfig {
  silero?: SileroVADConfig;
  // Future backends
  webrtc?: Record<string, unknown>;
}

/**
 * Backend priority (higher number = higher priority)
 */
const BACKEND_PRIORITY: Record<string, number> = {
  silero: 100,    // Local GPU/CPU, accurate
  webrtc: 50,     // Simple, fast (future)
  pyannote: 40,   // Heavy, very accurate (future)
};

/**
 * VAD Backend Factory Implementation
 */
export class VADFactory implements VADBackendFactory {
  private backends: Map<string, VADPort> = new Map();
  private config: VADBackendConfig;

  constructor(config: VADBackendConfig = {}) {
    this.config = config;
  }

  create(name: string, config?: Record<string, unknown>): VADPort {
    const existing = this.backends.get(name);
    if (existing) return existing;

    let adapter: VADPort;
    const backendConfig = { ...this.config[name as keyof VADBackendConfig], ...config };

    switch (name) {
      case "silero":
        adapter = createSileroVADAdapter(backendConfig as SileroVADConfig);
        break;
      // Future backends
      case "webrtc":
      case "pyannote":
        throw new Error(`Backend "${name}" not yet implemented`);
      default:
        throw new Error(`Unknown VAD backend: ${name}`);
    }

    this.backends.set(name, adapter);
    return adapter;
  }

  list(): string[] {
    return Object.keys(BACKEND_PRIORITY).sort(
      (a, b) => BACKEND_PRIORITY[b] - BACKEND_PRIORITY[a]
    );
  }

  async getAvailable(): Promise<VADPort | null> {
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

  async getWithFallback(preferred?: string): Promise<VADPort> {
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

    throw new Error("No VAD backend available");
  }

  /**
   * Dispose all backends and release resources
   */
  disposeAll(): void {
    for (const backend of this.backends.values()) {
      backend.dispose();
    }
    this.backends.clear();
  }
}

/**
 * Create a VAD factory with configuration
 */
export function createVADFactory(config?: VADBackendConfig): VADFactory {
  return new VADFactory(config);
}

/**
 * Default factory instance
 */
let defaultFactory: VADFactory | null = null;

/**
 * Get or create the default VAD factory
 */
export function getDefaultVADFactory(): VADFactory {
  if (!defaultFactory) {
    defaultFactory = createVADFactory();
  }
  return defaultFactory;
}

/**
 * High-level detect function with automatic backend selection
 *
 * Note: For streaming, use getDefaultVADFactory().getAvailable() and
 * call processStream() directly on the adapter.
 */
export async function detect(
  audio: AudioChunk,
  options?: VADOptions,
  preferredBackend?: string
): Promise<VADResult> {
  const factory = getDefaultVADFactory();
  const backend = await factory.getWithFallback(preferredBackend);

  // Initialize if needed
  await backend.initialize();

  // For async backends like Silero, we need to use the stream interface
  // Create a single-item stream and get the result
  async function* singleChunk(): AsyncGenerator<AudioChunk> {
    yield audio;
  }

  let result: VADResult | null = null;
  for await (const event of backend.processStream(singleChunk(), options)) {
    if (event.type === "probability") {
      result = {
        isSpeech: event.isSpeech,
        probability: event.probability,
        timestampMs: event.timestampMs,
      };
      break;
    }
  }

  if (!result) {
    throw new Error("VAD processing failed - no result");
  }

  return result;
}

// Re-export adapters
export { SileroVADAdapter, createSileroVADAdapter, type SileroVADConfig } from "./silero.js";
