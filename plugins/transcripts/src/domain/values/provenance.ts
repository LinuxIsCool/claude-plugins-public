/**
 * Provenance Value Objects
 *
 * Cryptographic chain for transformation audit trail.
 * Implements: input_hash → prompt_hash → output_hash → chain_hash
 */

import { createHash } from "crypto";

/**
 * SHA-256 hash prefixed with algorithm identifier
 */
export type ContentHash = `sha256:${string}`;

/**
 * Triple versioning for prompts
 */
export interface PromptVersion {
  /** SHA-256 of prompt content */
  content_hash: ContentHash;
  /** Semantic version (e.g., "1.0.0") */
  semver: string;
  /** Git commit hash when prompt was last modified (optional) */
  git_commit?: string;
}

/**
 * Source-specific provenance metadata
 */
export interface SourceProvenance {
  /** Discriminator: "youtube" | "local" */
  type: "youtube" | "local";

  /** YouTube-specific fields */
  video_id?: string;
  channel?: string;
  caption_source?: "auto" | "manual" | "whisper";
  fetched_at?: string;

  /** Local-specific fields */
  file_hash?: ContentHash;
  file_path?: string;
  transcribed_at?: string;
  transcription_backend?: string;
  transcription_model?: string;
  diarization_backend?: string;
  speaker_count?: number;
}

/**
 * Single transformation step in the provenance chain
 */
export interface TransformationStep {
  /** Type of transformation */
  type: "prose_refinement" | "entity_extraction" | "relationship_extraction" | "summary" | "custom";
  /** Hash of the prompt used */
  prompt_hash: ContentHash;
  /** Prompt version info */
  prompt_version: PromptVersion;
  /** LLM model used */
  model: string;
  /** When this transformation occurred */
  timestamp: string;
  /** Hash of the output produced */
  output_hash: ContentHash;
}

/**
 * Complete provenance chain for a processed transcript
 */
export interface ProvenanceChain {
  /** Version of provenance schema */
  schema_version: "1.0.0";

  /** Source document provenance */
  source: SourceProvenance;

  /** Hash of the input to first transformation */
  input_hash: ContentHash;

  /** Ordered list of transformations applied */
  transformations: TransformationStep[];

  /** Hash of entire chain for integrity verification */
  chain_hash: ContentHash;

  /** When provenance record was created */
  created_at: string;
}

// =============================================================================
// Hash Functions
// =============================================================================

/**
 * Compute SHA-256 hash of content
 */
export function computeHash(content: string): ContentHash {
  const hash = createHash("sha256").update(content, "utf-8").digest("hex");
  return `sha256:${hash}`;
}

/**
 * Compute hash of a file's content (for local sources)
 */
export function computeFileHash(buffer: Buffer): ContentHash {
  const hash = createHash("sha256").update(buffer).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Compute chain hash from all components
 */
export function computeChainHash(
  inputHash: ContentHash,
  transformations: TransformationStep[]
): ContentHash {
  const chainContent = JSON.stringify({
    input_hash: inputHash,
    transformations: transformations.map((t) => ({
      type: t.type,
      prompt_hash: t.prompt_hash,
      output_hash: t.output_hash,
    })),
  });
  return computeHash(chainContent);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create provenance for YouTube source
 */
export function createYouTubeProvenance(params: {
  video_id: string;
  channel?: string;
  caption_source: "auto" | "manual" | "whisper";
}): SourceProvenance {
  return {
    type: "youtube",
    video_id: params.video_id,
    channel: params.channel,
    caption_source: params.caption_source,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * Create provenance for local source
 */
export function createLocalProvenance(params: {
  file_hash: ContentHash;
  file_path: string;
  transcription_backend: string;
  transcription_model?: string;
  diarization_backend?: string;
  speaker_count?: number;
}): SourceProvenance {
  return {
    type: "local",
    file_hash: params.file_hash,
    file_path: params.file_path,
    transcribed_at: new Date().toISOString(),
    transcription_backend: params.transcription_backend,
    transcription_model: params.transcription_model,
    diarization_backend: params.diarization_backend,
    speaker_count: params.speaker_count,
  };
}

/**
 * Create a transformation step
 */
export function createTransformationStep(params: {
  type: TransformationStep["type"];
  prompt_hash: ContentHash;
  prompt_version: PromptVersion;
  model: string;
  output_hash: ContentHash;
}): TransformationStep {
  return {
    type: params.type,
    prompt_hash: params.prompt_hash,
    prompt_version: params.prompt_version,
    model: params.model,
    timestamp: new Date().toISOString(),
    output_hash: params.output_hash,
  };
}

/**
 * Create complete provenance chain
 */
export function createProvenanceChain(params: {
  source: SourceProvenance;
  input_hash: ContentHash;
  transformations: TransformationStep[];
}): ProvenanceChain {
  const chain_hash = computeChainHash(params.input_hash, params.transformations);

  return {
    schema_version: "1.0.0",
    source: params.source,
    input_hash: params.input_hash,
    transformations: params.transformations,
    chain_hash,
    created_at: new Date().toISOString(),
  };
}

// =============================================================================
// Verification
// =============================================================================

/**
 * Verify provenance chain integrity
 */
export function verifyProvenanceChain(chain: ProvenanceChain): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Verify chain hash
  const expectedChainHash = computeChainHash(chain.input_hash, chain.transformations);
  if (chain.chain_hash !== expectedChainHash) {
    errors.push(`Chain hash mismatch: expected ${expectedChainHash}, got ${chain.chain_hash}`);
  }

  // Verify transformation sequence (each output should feed next input)
  for (let i = 1; i < chain.transformations.length; i++) {
    const prev = chain.transformations[i - 1];
    // Note: In a composable pipeline, we'd verify prev.output_hash connects to next input
    // For now, we just verify the chain exists
    if (!prev.output_hash) {
      errors.push(`Transformation ${i - 1} missing output_hash`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
