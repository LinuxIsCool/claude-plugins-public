/**
 * LLM Backend Port
 *
 * Interface for pluggable LLM backends used in transformation service.
 * Supports Claude Code (Max plan), Claude API, and future backends.
 */

/**
 * Model tiers available
 */
export type ModelTier = "haiku" | "sonnet" | "opus";

/**
 * LLM backend capabilities
 */
export interface LLMCapabilities {
  /** Backend name */
  name: string;
  /** Supported model tiers */
  models: ModelTier[];
  /** Maximum input tokens (approximate) */
  max_input_tokens: number;
  /** Maximum output tokens */
  max_output_tokens: number;
  /** Whether this backend charges per token */
  per_token_billing: boolean;
  /** Whether streaming is supported */
  streaming: boolean;
}

/**
 * Options for LLM completion
 */
export interface LLMCompletionOptions {
  /** Model tier to use */
  model?: ModelTier;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** System prompt (if separate from user prompt) */
  system_prompt?: string;
}

/**
 * Result from LLM completion
 */
export interface LLMCompletionResult {
  /** Generated text */
  text: string;
  /** Model that was used */
  model: string;
  /** Input token count (if available) */
  input_tokens?: number;
  /** Output token count (if available) */
  output_tokens?: number;
  /** Processing time in milliseconds */
  processing_time_ms: number;
  /** Whether response was truncated */
  truncated: boolean;
}

/**
 * LLM Backend Port Interface
 */
export interface LLMBackendPort {
  /**
   * Get backend name
   */
  name(): string;

  /**
   * Get capabilities
   */
  capabilities(): LLMCapabilities;

  /**
   * Check if backend is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Run a completion
   *
   * @param prompt The prompt to send
   * @param options Completion options
   * @returns Completion result
   */
  complete(prompt: string, options?: LLMCompletionOptions): Promise<LLMCompletionResult>;
}

/**
 * Factory for creating LLM backends
 */
export interface LLMBackendFactory {
  /**
   * Create a backend by name
   */
  create(name: string, config?: Record<string, unknown>): LLMBackendPort;

  /**
   * List available backend names
   */
  list(): string[];

  /**
   * Get the default backend
   */
  default(): LLMBackendPort;
}
