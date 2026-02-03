/**
 * Prompt Value Objects
 *
 * Versioned prompt templates with triple versioning:
 * 1. Content hash (deterministic)
 * 2. Semantic version (human-readable)
 * 3. Git commit (optional, for tracking changes)
 */

import { readFileSync, existsSync } from "fs";
import { join, basename, dirname } from "path";
import { parse as parseYaml } from "yaml";
import { computeHash, type PromptVersion } from "./provenance.js";

/**
 * Output format a prompt can produce
 */
export type PromptOutputFormat = "prose" | "yaml" | "json";

/**
 * Prompt categories
 */
export type PromptCategory = "prose" | "extraction" | "summary" | "custom";

/**
 * Prompt metadata from frontmatter
 */
export interface PromptMetadata {
  /** Unique identifier (filename without extension) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this prompt does */
  description: string;
  /** Category for organization */
  category: PromptCategory;
  /** Semantic version */
  version: string;
  /** Author */
  author?: string;
  /** Output format */
  output_format: PromptOutputFormat;
  /** Compatible ontologies (for extraction prompts) */
  ontologies?: string[];
  /** Tags for discovery */
  tags?: string[];
}

/**
 * Complete prompt definition
 */
export interface Prompt {
  /** Metadata from frontmatter */
  metadata: PromptMetadata;
  /** The actual prompt content (after frontmatter) */
  content: string;
  /** Full file path */
  path: string;
  /** Triple version info */
  version: PromptVersion;
}

// =============================================================================
// Parsing
// =============================================================================

/**
 * Parse a prompt file with YAML frontmatter
 *
 * Format:
 * ```
 * ---
 * name: Prose Refinement
 * version: 1.0.0
 * ...
 * ---
 *
 * Prompt content here...
 * ```
 */
export function parsePromptFile(filePath: string): Prompt {
  if (!existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${filePath}`);
  }

  const raw = readFileSync(filePath, "utf-8");
  const id = basename(filePath, ".md");

  // Extract frontmatter
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    throw new Error(`Invalid prompt format (missing frontmatter): ${filePath}`);
  }

  const [, frontmatterYaml, content] = frontmatterMatch;

  let metadata: PromptMetadata;
  try {
    const parsed = parseYaml(frontmatterYaml);
    metadata = {
      id,
      name: parsed.name || id,
      description: parsed.description || "",
      category: parsed.category || inferCategory(filePath),
      version: parsed.version || "0.0.1",
      author: parsed.author,
      output_format: parsed.output_format || "prose",
      ontologies: parsed.ontologies,
      tags: parsed.tags,
    };
  } catch (e) {
    throw new Error(`Invalid frontmatter YAML in ${filePath}: ${e}`);
  }

  // Compute content hash
  const content_hash = computeHash(content.trim());

  return {
    metadata,
    content: content.trim(),
    path: filePath,
    version: {
      content_hash,
      semver: metadata.version,
      // git_commit would be populated by the store when loading
    },
  };
}

/**
 * Infer prompt category from file path
 */
function inferCategory(filePath: string): PromptCategory {
  const dir = dirname(filePath);
  if (dir.includes("/prose")) return "prose";
  if (dir.includes("/extraction")) return "extraction";
  if (dir.includes("/summary")) return "summary";
  return "custom";
}

// =============================================================================
// Prompt Store
// =============================================================================

/**
 * In-memory cache of loaded prompts
 */
const promptCache = new Map<string, Prompt>();

/**
 * Load a prompt by ID from the prompts directory
 */
export function loadPrompt(promptId: string, promptsDir: string): Prompt {
  const cacheKey = `${promptsDir}:${promptId}`;

  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!;
  }

  // Search in category subdirectories
  const categories = ["prose", "extraction", "summary", "custom"];
  for (const category of categories) {
    const filePath = join(promptsDir, category, `${promptId}.md`);
    if (existsSync(filePath)) {
      const prompt = parsePromptFile(filePath);
      promptCache.set(cacheKey, prompt);
      return prompt;
    }
  }

  // Try root level
  const rootPath = join(promptsDir, `${promptId}.md`);
  if (existsSync(rootPath)) {
    const prompt = parsePromptFile(rootPath);
    promptCache.set(cacheKey, prompt);
    return prompt;
  }

  throw new Error(`Prompt not found: ${promptId}`);
}

/**
 * List all available prompts
 */
export function listPrompts(promptsDir: string): PromptMetadata[] {
  const prompts: PromptMetadata[] = [];
  const categories = ["prose", "extraction", "summary", "custom"];

  for (const category of categories) {
    const categoryDir = join(promptsDir, category);
    if (!existsSync(categoryDir)) continue;

    const { readdirSync } = require("fs");
    const files = readdirSync(categoryDir) as string[];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      try {
        const prompt = parsePromptFile(join(categoryDir, file));
        prompts.push(prompt.metadata);
      } catch {
        // Skip invalid prompts
      }
    }
  }

  return prompts;
}

/**
 * Clear prompt cache (for hot reloading)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

// =============================================================================
// Template Rendering
// =============================================================================

/**
 * Variables available for prompt template interpolation
 */
export interface PromptVariables {
  /** The input text to transform */
  input: string;
  /** Source type for context */
  source_type?: "youtube" | "local";
  /** Speaker names if available */
  speakers?: string[];
  /** Previous context (for composability) */
  previous_output?: string;
  /** Custom variables */
  [key: string]: unknown;
}

/**
 * Render a prompt template with variables
 *
 * Supports simple {{variable}} interpolation
 */
export function renderPrompt(prompt: Prompt, variables: PromptVariables): string {
  let rendered = prompt.content;

  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined || value === null) continue;

    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    const stringValue = Array.isArray(value) ? value.join(", ") : String(value);
    rendered = rendered.replace(pattern, stringValue);
  }

  return rendered;
}
