/**
 * Transformation Service
 *
 * Core service implementing: f(input, prompt) → output + provenance
 *
 * Supports:
 * - Pluggable LLM backends (Claude Code default)
 * - Versioned prompts with triple versioning
 * - Cryptographic provenance chain
 * - Composable transformations (output → input)
 */

import { join } from "path";
import { getClaudePath } from "../../../../lib/paths.js";
import type { LLMBackendPort, ModelTier } from "../ports/llm.js";
import { llmBackendFactory } from "../adapters/llm/index.js";
import {
  type PromptVariables,
  loadPrompt,
  renderPrompt,
} from "../domain/values/prompt.js";
import {
  type ContentHash,
  type ProvenanceChain,
  type SourceProvenance,
  type TransformationStep,
  computeHash,
  createTransformationStep,
  createProvenanceChain,
} from "../domain/values/provenance.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Input to a transformation
 */
export interface TransformationInput {
  /** The text content to transform */
  content: string;
  /** Source provenance (for first transformation in chain) */
  source?: SourceProvenance;
  /** Previous provenance (for chained transformations) */
  previous_provenance?: ProvenanceChain;
}

/**
 * Options for transformation
 */
export interface TransformationOptions {
  /** Prompt ID to use */
  prompt_id: string;
  /** Prompt directory (defaults to plugin prompts) */
  prompts_dir?: string;
  /** LLM backend name (defaults to claude-code) */
  backend?: string;
  /** Model tier override */
  model?: ModelTier;
  /** Custom variables for prompt template */
  variables?: Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of a transformation
 */
export interface TransformationResult {
  /** Transformed content */
  output: string;
  /** Hash of output content */
  output_hash: ContentHash;
  /** Updated provenance chain */
  provenance: ProvenanceChain;
  /** Processing metrics */
  metrics: {
    processing_time_ms: number;
    model: string;
    backend: string;
  };
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Default prompts directory
 */
function getDefaultPromptsDir(): string {
  return join(getClaudePath(""), "../plugins/transcripts/prompts");
}

/**
 * Transform input content using a versioned prompt
 *
 * Core function: f(input, prompt) → output + provenance
 */
export async function transform(
  input: TransformationInput,
  options: TransformationOptions
): Promise<TransformationResult> {
  // Resolve prompts directory
  const promptsDir = options.prompts_dir || getDefaultPromptsDir();

  // Load and validate prompt
  const prompt = loadPrompt(options.prompt_id, promptsDir);

  // Get LLM backend
  const backend: LLMBackendPort = options.backend
    ? llmBackendFactory.create(options.backend)
    : llmBackendFactory.default();

  // Check backend availability
  const available = await backend.isAvailable();
  if (!available) {
    throw new Error(`LLM backend not available: ${backend.name()}`);
  }

  // Prepare variables for template
  const variables: PromptVariables = {
    input: input.content,
    source_type: input.source?.type,
    ...options.variables,
  };

  // Render prompt template
  const renderedPrompt = renderPrompt(prompt, variables);

  // Compute input hash
  const inputHash = computeHash(input.content);

  // Call LLM
  const completion = await backend.complete(renderedPrompt, {
    model: options.model,
    timeout: options.timeout,
  });

  // Compute output hash
  const outputHash = computeHash(completion.text);

  // Determine transformation type from prompt category
  const transformationType = mapCategoryToType(prompt.metadata.category);

  // Create transformation step
  const step = createTransformationStep({
    type: transformationType,
    prompt_hash: prompt.version.content_hash,
    prompt_version: prompt.version,
    model: completion.model,
    output_hash: outputHash,
  });

  // Build or extend provenance chain
  let provenance: ProvenanceChain;

  if (input.previous_provenance) {
    // Extend existing chain
    provenance = createProvenanceChain({
      source: input.previous_provenance.source,
      input_hash: input.previous_provenance.input_hash,
      transformations: [...input.previous_provenance.transformations, step],
    });
  } else if (input.source) {
    // Create new chain
    provenance = createProvenanceChain({
      source: input.source,
      input_hash: inputHash,
      transformations: [step],
    });
  } else {
    throw new Error("Either source or previous_provenance must be provided");
  }

  return {
    output: completion.text,
    output_hash: outputHash,
    provenance,
    metrics: {
      processing_time_ms: completion.processing_time_ms,
      model: completion.model,
      backend: backend.name(),
    },
  };
}

/**
 * Map prompt category to transformation type
 */
function mapCategoryToType(
  category: string
): TransformationStep["type"] {
  switch (category) {
    case "prose":
      return "prose_refinement";
    case "extraction":
      return "entity_extraction";
    case "summary":
      return "summary";
    default:
      return "custom";
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Transform raw transcript to prose markdown
 */
export async function transformToProse(
  input: TransformationInput,
  options?: Partial<TransformationOptions>
): Promise<TransformationResult> {
  return transform(input, {
    prompt_id: "prose-refinement",
    ...options,
  });
}

/**
 * Extract entities from transcript
 */
export async function extractEntities(
  input: TransformationInput,
  options?: Partial<TransformationOptions>
): Promise<TransformationResult> {
  return transform(input, {
    prompt_id: "entity-extraction",
    ...options,
  });
}

/**
 * Generate summary from transcript
 */
export async function summarize(
  input: TransformationInput,
  options?: Partial<TransformationOptions>
): Promise<TransformationResult> {
  return transform(input, {
    prompt_id: "summary",
    ...options,
  });
}

// =============================================================================
// Pipeline Support
// =============================================================================

/**
 * Run a sequence of transformations
 *
 * Each transformation's output becomes the next transformation's input,
 * building a complete provenance chain.
 */
export async function runPipeline(
  input: TransformationInput,
  steps: Array<{ prompt_id: string; options?: Partial<TransformationOptions> }>
): Promise<TransformationResult[]> {
  const results: TransformationResult[] = [];
  let currentInput = input;

  for (const step of steps) {
    const result = await transform(currentInput, {
      prompt_id: step.prompt_id,
      ...step.options,
    });

    results.push(result);

    // Output becomes input for next step
    currentInput = {
      content: result.output,
      previous_provenance: result.provenance,
    };
  }

  return results;
}
