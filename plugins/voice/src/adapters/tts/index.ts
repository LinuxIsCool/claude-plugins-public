/**
 * TTS Adapter Factory
 *
 * Creates TTS backends with priority-based fallback.
 * Priority order: HuggingFace > ElevenLabs > OpenAI > Piper > Coqui > pyttsx3
 */

import type { TTSPort, TTSBackendFactory, TTSOptions, TTSResult } from "../../ports/tts.js";
import { ElevenLabsAdapter, createElevenLabsAdapter } from "./elevenlabs.js";
import { Pyttsx3Adapter, createPyttsx3Adapter } from "./pyttsx3.js";
import { HuggingFaceXTTSAdapter, createHuggingFaceXTTSAdapter, type HuggingFaceXTTSConfig } from "./huggingface-xtts.js";
import { PiperAdapter, createPiperAdapter, type PiperConfig } from "./piper.js";

/**
 * Backend configuration
 */
export interface BackendConfig {
  elevenlabs?: {
    apiKey?: string;
    defaultVoiceId?: string;
    defaultModel?: string;
  };
  pyttsx3?: {
    pythonPath?: string;
    rate?: number;
    volume?: number;
  };
  "huggingface-xtts"?: HuggingFaceXTTSConfig;
  piper?: PiperConfig;
  // Future backends
  huggingface?: Record<string, unknown>;
  openai?: Record<string, unknown>;
  coqui?: Record<string, unknown>;
}

/**
 * Backend priority (higher number = higher priority)
 */
const BACKEND_PRIORITY: Record<string, number> = {
  "huggingface-xtts": 100,  // Local GPU, XTTS v2, best free quality
  huggingface: 95,   // Local GPU, generic (future)
  elevenlabs: 90,    // Cloud, excellent quality
  openai: 80,        // Cloud, good quality
  piper: 70,         // Local, fast
  coqui: 60,         // Local, good quality
  pyttsx3: 10,       // Fallback, always available
};

/**
 * TTS Backend Factory Implementation
 */
export class TTSFactory implements TTSBackendFactory {
  private backends: Map<string, TTSPort> = new Map();
  private config: BackendConfig;

  constructor(config: BackendConfig = {}) {
    this.config = config;
  }

  create(name: string, config?: Record<string, unknown>): TTSPort {
    const existing = this.backends.get(name);
    if (existing) return existing;

    let adapter: TTSPort;
    const backendConfig = { ...this.config[name as keyof BackendConfig], ...config };

    switch (name) {
      case "huggingface-xtts":
        adapter = createHuggingFaceXTTSAdapter(backendConfig as HuggingFaceXTTSConfig);
        break;
      case "elevenlabs":
        adapter = createElevenLabsAdapter(backendConfig);
        break;
      case "pyttsx3":
        adapter = createPyttsx3Adapter(backendConfig);
        break;
      case "piper":
        adapter = createPiperAdapter(backendConfig as PiperConfig);
        break;
      // Future backends
      case "huggingface":
      case "openai":
      case "coqui":
        throw new Error(`Backend "${name}" not yet implemented`);
      default:
        throw new Error(`Unknown TTS backend: ${name}`);
    }

    this.backends.set(name, adapter);
    return adapter;
  }

  list(): string[] {
    return Object.keys(BACKEND_PRIORITY).sort(
      (a, b) => BACKEND_PRIORITY[b] - BACKEND_PRIORITY[a]
    );
  }

  async getAvailable(): Promise<TTSPort | null> {
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

  async getWithFallback(preferred?: string): Promise<TTSPort> {
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

    throw new Error("No TTS backend available");
  }
}

/**
 * Create a TTS factory with configuration
 */
export function createTTSFactory(config?: BackendConfig): TTSFactory {
  return new TTSFactory(config);
}

/**
 * Default factory instance
 */
let defaultFactory: TTSFactory | null = null;

/**
 * Get or create the default TTS factory
 */
export function getDefaultTTSFactory(): TTSFactory {
  if (!defaultFactory) {
    defaultFactory = createTTSFactory();
  }
  return defaultFactory;
}

/**
 * High-level speak function with automatic backend selection
 */
export async function speak(
  text: string,
  options: Partial<TTSOptions> = {},
  preferredBackend?: string
): Promise<TTSResult> {
  const factory = getDefaultTTSFactory();
  const backend = await factory.getWithFallback(preferredBackend);

  const fullOptions: TTSOptions = {
    voiceId: options.voiceId || "",  // Will use backend default
    ...options,
  };

  return backend.synthesize(text, fullOptions);
}

/**
 * High-level speakAndPlay function
 */
export async function speakAndPlay(
  text: string,
  options: Partial<TTSOptions> = {},
  preferredBackend?: string
): Promise<void> {
  const factory = getDefaultTTSFactory();
  const backend = await factory.getWithFallback(preferredBackend);

  const fullOptions: TTSOptions = {
    voiceId: options.voiceId || "",
    ...options,
  };

  const result = await backend.synthesize(text, fullOptions);
  await backend.play(result.audio);
}

// Re-export adapters
export { ElevenLabsAdapter, createElevenLabsAdapter } from "./elevenlabs.js";
export { Pyttsx3Adapter, createPyttsx3Adapter } from "./pyttsx3.js";
export { HuggingFaceXTTSAdapter, createHuggingFaceXTTSAdapter, type HuggingFaceXTTSConfig } from "./huggingface-xtts.js";
export { PiperAdapter, createPiperAdapter, type PiperConfig } from "./piper.js";
