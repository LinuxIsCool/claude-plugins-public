/**
 * Diarization Adapters
 *
 * Factory and exports for speaker diarization backends.
 */

import type {
  DiarizationPort,
  DiarizationBackendFactory,
} from "../../ports/diarization.js";
import { PyAnnoteAdapter, createPyAnnoteAdapter } from "./pyannote.js";
import type { PyAnnoteConfig } from "./pyannote.js";

// Re-export adapters and their configs
export { PyAnnoteAdapter, createPyAnnoteAdapter };
export type { PyAnnoteConfig };

/**
 * Available diarization backends
 */
export type DiarizationBackend = "pyannote";

/**
 * Diarization backend factory
 */
export class DiarizationFactory implements DiarizationBackendFactory {
  private adapters: Map<string, DiarizationPort> = new Map();

  /**
   * Get or create a diarization adapter
   */
  create(name: string, config?: Record<string, unknown>): DiarizationPort {
    // Check cache
    const cacheKey = `${name}:${JSON.stringify(config || {})}`;
    const cached = this.adapters.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create new adapter
    let adapter: DiarizationPort;
    switch (name) {
      case "pyannote":
        adapter = createPyAnnoteAdapter(config as Partial<PyAnnoteConfig>);
        break;
      default:
        throw new Error(`Unknown diarization backend: ${name}`);
    }

    this.adapters.set(cacheKey, adapter);
    return adapter;
  }

  /**
   * List available backends
   */
  list(): string[] {
    return ["pyannote"];
  }

  /**
   * Get default backend
   */
  default(): DiarizationPort {
    return this.create("pyannote");
  }

  /**
   * Check which backends are available
   */
  async available(): Promise<string[]> {
    const results: string[] = [];
    for (const name of this.list()) {
      const adapter = this.create(name);
      if (await adapter.isAvailable()) {
        results.push(name);
      }
    }
    return results;
  }
}

/**
 * Singleton factory instance
 */
let factoryInstance: DiarizationFactory | null = null;

/**
 * Get the diarization factory instance
 */
export function getDiarizationFactory(): DiarizationFactory {
  if (!factoryInstance) {
    factoryInstance = new DiarizationFactory();
  }
  return factoryInstance;
}

/**
 * Convenience: get default diarization adapter
 */
export function getDefaultDiarizer(): DiarizationPort {
  return getDiarizationFactory().default();
}
