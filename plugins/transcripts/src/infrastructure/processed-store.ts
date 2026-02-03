/**
 * Processed Transcript Store
 *
 * Storage for transformation outputs with parallel youtube/local hierarchies.
 * Implements global storage at ~/.claude/transcripts/ with source discrimination.
 *
 * Structure:
 *   ~/.claude/transcripts/
 *   ├── youtube/
 *   │   └── yt_{video_id}/
 *   │       ├── raw.json
 *   │       ├── prose.md
 *   │       ├── extraction.yaml
 *   │       └── provenance.json
 *   └── local/
 *       └── tx_{content_hash}/
 *           ├── raw.json
 *           ├── prose.md
 *           ├── extraction.yaml
 *           ├── speakers.json
 *           └── provenance.json
 */

import { join } from "path";
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";
import type { ProvenanceChain, SourceProvenance } from "../domain/values/provenance.js";
import type { TransformationResult } from "../services/transformation-service.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Artifact types that can be stored
 */
export type ArtifactType = "raw" | "prose" | "extraction" | "summary" | "speakers" | "provenance";

/**
 * Stored artifact metadata
 */
export interface StoredArtifact {
  /** Artifact type */
  type: ArtifactType;
  /** File path */
  path: string;
  /** Content hash */
  hash: string;
  /** When stored */
  stored_at: string;
}

/**
 * Transcript folder contents
 */
export interface TranscriptFolder {
  /** Folder ID (yt_* or tx_*) */
  id: string;
  /** Source type */
  source_type: "youtube" | "local";
  /** Full folder path */
  path: string;
  /** Available artifacts */
  artifacts: StoredArtifact[];
  /** Provenance chain if available */
  provenance?: ProvenanceChain;
}

// =============================================================================
// Paths
// =============================================================================

/**
 * Get global transcripts directory
 */
export function getGlobalTranscriptsDir(): string {
  return join(homedir(), ".claude", "transcripts");
}

/**
 * Get source-specific directory (youtube or local)
 */
export function getSourceDir(sourceType: "youtube" | "local"): string {
  return join(getGlobalTranscriptsDir(), sourceType);
}

/**
 * Get folder for a specific transcript
 */
export function getTranscriptFolder(
  sourceType: "youtube" | "local",
  id: string
): string {
  return join(getSourceDir(sourceType), id);
}

/**
 * Generate folder ID from source provenance
 */
export function generateFolderId(source: SourceProvenance): string {
  if (source.type === "youtube" && source.video_id) {
    return `yt_${source.video_id}`;
  } else if (source.type === "local" && source.file_hash) {
    // Use first 16 chars of hash for folder name
    const hashPart = source.file_hash.replace("sha256:", "").slice(0, 16);
    return `tx_${hashPart}`;
  }
  throw new Error("Invalid source provenance: missing video_id or file_hash");
}

// =============================================================================
// Storage Operations
// =============================================================================

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Store a transformation result
 */
export function storeTransformation(
  result: TransformationResult,
  artifactType: ArtifactType
): StoredArtifact {
  const source = result.provenance.source;
  const folderId = generateFolderId(source);
  const folderPath = getTranscriptFolder(source.type, folderId);

  ensureDir(folderPath);

  // Determine filename and content based on artifact type
  let filename: string;
  let content: string;

  switch (artifactType) {
    case "prose":
      filename = "prose.md";
      content = formatProseArtifact(result);
      break;
    case "extraction":
      filename = "extraction.yaml";
      content = result.output; // Assume YAML output
      break;
    case "summary":
      filename = "summary.md";
      content = formatSummaryArtifact(result);
      break;
    case "raw":
      filename = "raw.json";
      content = JSON.stringify({ content: result.output }, null, 2);
      break;
    default:
      filename = `${artifactType}.txt`;
      content = result.output;
  }

  const filePath = join(folderPath, filename);
  writeFileSync(filePath, content, "utf-8");

  // Always update provenance
  storeProvenance(result.provenance);

  return {
    type: artifactType,
    path: filePath,
    hash: result.output_hash,
    stored_at: new Date().toISOString(),
  };
}

/**
 * Store provenance chain
 */
export function storeProvenance(provenance: ProvenanceChain): void {
  const folderId = generateFolderId(provenance.source);
  const folderPath = getTranscriptFolder(provenance.source.type, folderId);

  ensureDir(folderPath);

  const provenancePath = join(folderPath, "provenance.json");
  writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), "utf-8");
}

/**
 * Store raw transcript (initial ingestion)
 */
export function storeRawTranscript(
  content: string,
  source: SourceProvenance,
  metadata?: Record<string, unknown>
): string {
  const folderId = generateFolderId(source);
  const folderPath = getTranscriptFolder(source.type, folderId);

  ensureDir(folderPath);

  const rawPath = join(folderPath, "raw.json");
  writeFileSync(
    rawPath,
    JSON.stringify(
      {
        content,
        source,
        metadata,
        stored_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );

  return folderPath;
}

/**
 * Store speakers.json for local transcripts
 */
export function storeSpeakers(
  folderId: string,
  speakers: Array<{
    id: string;
    name?: string;
    embeddings?: number[];
  }>
): void {
  const folderPath = getTranscriptFolder("local", folderId);
  ensureDir(folderPath);

  const speakersPath = join(folderPath, "speakers.json");
  writeFileSync(
    speakersPath,
    JSON.stringify(
      {
        speakers,
        stored_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

// =============================================================================
// Retrieval Operations
// =============================================================================

/**
 * Load transcript folder contents
 */
export function loadTranscriptFolder(
  sourceType: "youtube" | "local",
  folderId: string
): TranscriptFolder | null {
  const folderPath = getTranscriptFolder(sourceType, folderId);

  if (!existsSync(folderPath)) {
    return null;
  }

  const artifacts: StoredArtifact[] = [];
  const files = readdirSync(folderPath);

  for (const file of files) {
    const filePath = join(folderPath, file);
    let type: ArtifactType | null = null;

    if (file === "raw.json") type = "raw";
    else if (file === "prose.md") type = "prose";
    else if (file === "extraction.yaml") type = "extraction";
    else if (file === "summary.md") type = "summary";
    else if (file === "speakers.json") type = "speakers";
    else if (file === "provenance.json") type = "provenance";

    if (type) {
      artifacts.push({
        type,
        path: filePath,
        hash: "", // Would need to compute
        stored_at: "", // Would need file stat
      });
    }
  }

  // Load provenance if available
  let provenance: ProvenanceChain | undefined;
  const provenancePath = join(folderPath, "provenance.json");
  if (existsSync(provenancePath)) {
    provenance = JSON.parse(readFileSync(provenancePath, "utf-8"));
  }

  return {
    id: folderId,
    source_type: sourceType,
    path: folderPath,
    artifacts,
    provenance,
  };
}

/**
 * List all transcript folders for a source type
 */
export function listTranscriptFolders(
  sourceType: "youtube" | "local"
): string[] {
  const sourceDir = getSourceDir(sourceType);

  if (!existsSync(sourceDir)) {
    return [];
  }

  return readdirSync(sourceDir).filter((name) => {
    const prefix = sourceType === "youtube" ? "yt_" : "tx_";
    return name.startsWith(prefix);
  });
}

/**
 * Load raw transcript content
 */
export function loadRawTranscript(
  sourceType: "youtube" | "local",
  folderId: string
): { content: string; source: SourceProvenance; metadata?: Record<string, unknown> } | null {
  const rawPath = join(getTranscriptFolder(sourceType, folderId), "raw.json");

  if (!existsSync(rawPath)) {
    return null;
  }

  return JSON.parse(readFileSync(rawPath, "utf-8"));
}

/**
 * Load prose artifact
 */
export function loadProse(
  sourceType: "youtube" | "local",
  folderId: string
): string | null {
  const prosePath = join(getTranscriptFolder(sourceType, folderId), "prose.md");

  if (!existsSync(prosePath)) {
    return null;
  }

  return readFileSync(prosePath, "utf-8");
}

/**
 * Load extraction artifact
 */
export function loadExtraction(
  sourceType: "youtube" | "local",
  folderId: string
): Record<string, unknown> | null {
  const extractionPath = join(getTranscriptFolder(sourceType, folderId), "extraction.yaml");

  if (!existsSync(extractionPath)) {
    return null;
  }

  return yamlParse(readFileSync(extractionPath, "utf-8"));
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format prose artifact with frontmatter
 */
function formatProseArtifact(result: TransformationResult): string {
  const source = result.provenance.source;
  const lastStep = result.provenance.transformations[result.provenance.transformations.length - 1];

  const frontmatter = {
    title: source.type === "youtube" ? `YouTube: ${source.video_id}` : `Local: ${source.file_path}`,
    source_type: source.type,
    video_id: source.video_id,
    channel: source.channel,
    file_path: source.file_path,
    processed_at: lastStep?.timestamp,
    model: lastStep?.model,
    prompt_version: lastStep?.prompt_version.semver,
    output_hash: result.output_hash,
  };

  // Remove undefined values
  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([_, v]) => v !== undefined)
  );

  return `---
${yamlStringify(cleanFrontmatter)}---

${result.output}
`;
}

/**
 * Format summary artifact with frontmatter
 */
function formatSummaryArtifact(result: TransformationResult): string {
  const source = result.provenance.source;

  const frontmatter = {
    type: "summary",
    source_type: source.type,
    video_id: source.video_id,
    file_path: source.file_path,
    generated_at: new Date().toISOString(),
    output_hash: result.output_hash,
  };

  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([_, v]) => v !== undefined)
  );

  return `---
${yamlStringify(cleanFrontmatter)}---

${result.output}
`;
}
