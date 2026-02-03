/**
 * LLM Backend Adapters
 *
 * Pluggable LLM backends for transformation service.
 * Default: Claude Code (Max plan, no per-token costs)
 */

import type { LLMBackendPort, LLMBackendFactory } from "../../ports/llm.js";
import { createClaudeCodeBackend } from "./claude-code.js";

// Registry of available backends
const backends: Map<string, () => LLMBackendPort> = new Map([
  ["claude-code", () => createClaudeCodeBackend("sonnet")],
  ["claude-code-haiku", () => createClaudeCodeBackend("haiku")],
  ["claude-code-opus", () => createClaudeCodeBackend("opus")],
  // Future: ["claude-api", () => createClaudeAPIBackend()],
  // Future: ["ollama", () => createOllamaBackend()],
]);

/**
 * LLM Backend Factory Implementation
 */
export const llmBackendFactory: LLMBackendFactory = {
  create(name: string, _config?: Record<string, unknown>): LLMBackendPort {
    const factory = backends.get(name);
    if (!factory) {
      throw new Error(
        `Unknown LLM backend: ${name}. Available: ${Array.from(backends.keys()).join(", ")}`
      );
    }
    return factory();
  },

  list(): string[] {
    return Array.from(backends.keys());
  },

  default(): LLMBackendPort {
    // Claude Code (sonnet) is default - uses Max plan
    return createClaudeCodeBackend("sonnet");
  },
};

// Re-export for direct use
export { ClaudeCodeBackend, createClaudeCodeBackend } from "./claude-code.js";
