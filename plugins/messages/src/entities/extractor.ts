/**
 * Entity Extractor
 *
 * Uses headless Claude (claude -p) for entity extraction.
 * Zero-cost extraction using Max plan's included Claude Code calls.
 *
 * Based on pattern from plugins/transcripts/src/adapters/extraction/headless-claude.ts
 */

import { spawn } from "child_process";
import type { ExtractionResult, ExtractedEntity, EntityType } from "./types";

/**
 * Extraction prompt for messages
 * Optimized for Signal/chat messages
 */
const EXTRACTION_PROMPT = `Extract entities from these messages. Return ONLY a JSON array.

ENTITY TYPES:
- person: Names of people (e.g., "Bob", "Alice Smith")
- date: Dates, deadlines, temporal references (e.g., "tomorrow", "Friday", "next week")
- question: Questions being asked (the full question text)
- keyword: Important topics/concepts (e.g., "authentication", "React", "bug fix")
- organization: Companies, teams (e.g., "Google", "engineering team")
- product: Tools, libraries, frameworks (e.g., "TypeScript", "Claude", "git")

OUTPUT FORMAT - JSON array only, no markdown, no explanation:
[
  {
    "message_index": 0,
    "entities": [
      {"text": "exact text", "type": "person|date|question|keyword|organization|product", "confidence": 0.0-1.0}
    ]
  }
]

RULES:
- Extract all relevant entities from each message
- Normalize dates when possible ("tomorrow" -> include raw text)
- Questions should be the complete question text
- Keywords should be specific (not generic words)
- Return empty entities array if no entities found
- Confidence: 0.9+ for clear mentions, 0.7-0.9 for implied, 0.5-0.7 for uncertain

MESSAGES TO ANALYZE:
`;

interface HeadlessOptions {
  model?: "haiku" | "sonnet";
  timeout?: number;
}

/**
 * Call headless Claude via subprocess
 */
async function callHeadlessClaude(
  prompt: string,
  options: HeadlessOptions = {}
): Promise<string> {
  const { model = "haiku", timeout = 120000 } = options;

  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      prompt,
      "--model",
      model,
      "--no-session-persistence",
      "--max-turns",
      "1",
      "--tools",
      "",
      "--setting-sources",
      "",
      "--output-format",
      "text",
    ];

    const proc = spawn("claude", args, {
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    // Provide empty stdin
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Headless Claude timeout after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Headless Claude failed (code ${code}): ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Parse JSON from Claude response
 * Handles mixed text/JSON responses
 */
function parseJSON(text: string): unknown {
  // Find JSON array in response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

interface MessageInput {
  id: string;
  content: string;
  author: string;
  timestamp: number;
}

interface BatchExtractionResult {
  message_index: number;
  entities: Array<{
    text: string;
    type: EntityType;
    confidence: number;
  }>;
}

/**
 * Entity Extractor using headless Claude
 */
export class EntityExtractor {
  private model: "haiku" | "sonnet";
  private timeout: number;

  constructor(model: "haiku" | "sonnet" = "haiku", timeout = 120000) {
    this.model = model;
    this.timeout = timeout;
  }

  /**
   * Extract entities from a single message
   */
  async extract(message: MessageInput): Promise<ExtractionResult> {
    const results = await this.extractBatch([message]);
    return results[0] || {
      message_id: message.id,
      entities: [],
      processing_time_ms: 0,
    };
  }

  /**
   * Extract entities from multiple messages (batch optimization)
   */
  async extractBatch(messages: MessageInput[]): Promise<ExtractionResult[]> {
    if (messages.length === 0) {
      return [];
    }

    const startTime = Date.now();

    // Build prompt with all messages
    const messageBlocks = messages.map((msg, idx) => {
      const date = new Date(msg.timestamp).toISOString().slice(0, 16).replace("T", " ");
      const content = msg.content.length > 800
        ? msg.content.slice(0, 800) + "..."
        : msg.content;
      return `[${idx}] Author: ${msg.author} | ${date}\n${content}`;
    });

    const prompt = EXTRACTION_PROMPT + messageBlocks.join("\n\n---\n\n");

    // Call Claude
    const response = await callHeadlessClaude(prompt, {
      model: this.model,
      timeout: this.timeout,
    });

    const processingTime = Date.now() - startTime;

    // Parse response
    const parsed = parseJSON(response) as BatchExtractionResult[] | null;

    if (!parsed || !Array.isArray(parsed)) {
      // Throw error so CLI can mark batch as failed and retry later
      throw new Error(
        `Failed to parse extraction response. Response: ${response.slice(0, 500)}${response.length > 500 ? "..." : ""}`
      );
    }

    // Map results back to messages
    const results: ExtractionResult[] = messages.map((msg, idx) => {
      const result = parsed.find((r) => r.message_index === idx);
      const entities: ExtractedEntity[] = (result?.entities || [])
        .filter((e) => e.text && e.type && typeof e.confidence === "number")
        .map((e) => ({
          text: e.text,
          type: e.type as EntityType,
          confidence: Math.min(1, Math.max(0, e.confidence)),
        }));

      return {
        message_id: msg.id,
        entities,
        processing_time_ms: Math.round(processingTime / messages.length),
      };
    });

    return results;
  }

  /**
   * Check if Claude CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("which", ["claude"]);
      proc.on("close", (code) => {
        resolve(code === 0);
      });
      proc.on("error", () => {
        resolve(false);
      });
    });
  }

  /**
   * Get extractor identifier
   */
  getIdentifier(): string {
    return `headless-claude-${this.model}`;
  }
}

/**
 * Create extractor instance
 */
export function createExtractor(
  model: "haiku" | "sonnet" = "haiku"
): EntityExtractor {
  return new EntityExtractor(model);
}
