/**
 * Headless Claude Extraction Adapter
 *
 * Uses Claude Code in headless mode (included in Max plan) for entity extraction.
 * No API costs - runs as subprocess with `claude -p "prompt"`.
 *
 * Based on proven pattern from autocommit plugin.
 */

import { execSync, spawn } from "child_process";
import type {
  ExtractionPort,
  ExtractionCapabilities,
  ExtractionResult,
  ExtractionOptions,
  ExtractionContext,
  ExtractedEntity,
  ExtractedRelationship,
  ExtractedTopic,
} from "../../ports/extraction.js";
import type { EntityType } from "../../domain/entities/entity.js";

// =============================================================================
// Headless Claude Caller
// =============================================================================

interface HeadlessOptions {
  model?: "haiku" | "sonnet" | "opus";
  timeout?: number;
  maxTokens?: number;
}

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

    // Provide empty stdin to prevent hanging
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

// =============================================================================
// Extraction Prompts
// =============================================================================

const ENTITY_EXTRACTION_PROMPT = `You are an entity extraction system. Extract named entities from the following transcript text.

OUTPUT FORMAT (JSON only, no explanation):
{
  "entities": [
    {
      "text": "exact text as it appears",
      "type": "person|organization|location|product|concept|event|date|time",
      "normalized_name": "canonical form",
      "confidence": 0.0-1.0
    }
  ]
}

RULES:
- Extract people, organizations, products, technologies, concepts
- Normalize names (e.g., "Claude" and "Claude AI" → "Claude")
- Assign confidence based on clarity (clear mention = high, ambiguous = low)
- For concepts/topics, only extract specific named concepts, not generic words
- Return empty array if no entities found

TEXT TO ANALYZE:
`;

const RELATIONSHIP_EXTRACTION_PROMPT = `You are a relationship extraction system. Given these entities and the source text, identify relationships between them.

OUTPUT FORMAT (JSON only, no explanation):
{
  "relationships": [
    {
      "subject": "entity name",
      "predicate": "works_at|created|uses|mentions|believes|contradicts|builds_on",
      "object": "entity name",
      "confidence": 0.0-1.0,
      "evidence": "brief quote from text"
    }
  ]
}

RULES:
- Only extract relationships clearly stated or strongly implied
- Use specific predicates: works_at, created, uses, mentions, believes, contradicts, builds_on
- Include brief evidence (5-15 words) from the text
- Return empty array if no relationships found

ENTITIES:
`;

const TOPIC_EXTRACTION_PROMPT = `You are a topic extraction system. Identify the main topics discussed in this text.

OUTPUT FORMAT (JSON only, no explanation):
{
  "topics": [
    {
      "name": "topic name",
      "confidence": 0.0-1.0,
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "summary": "2-3 sentence summary of the content"
}

RULES:
- Extract 2-5 main topics
- Topics should be specific (not "technology" but "agent architectures")
- Include 3-5 representative keywords per topic
- Summary should capture the essence of what was discussed
- Return empty arrays if content is too short/unclear

TEXT TO ANALYZE:
`;

const BELIEF_EXTRACTION_PROMPT = `You are a belief extraction system. Identify what the speaker believes, thinks, or advocates.

OUTPUT FORMAT (JSON only, no explanation):
{
  "beliefs": [
    {
      "statement": "what the speaker believes",
      "confidence": 0.0-1.0,
      "evidence": "brief quote from text",
      "category": "technical|philosophical|practical|evaluative"
    }
  ]
}

RULES:
- Extract explicit beliefs ("I think...", "I believe...", "You should...")
- Extract implicit beliefs (strong recommendations, repeated patterns)
- Categorize: technical (how things work), philosophical (values), practical (how to do things), evaluative (what's good/bad)
- Return empty array if no clear beliefs

TEXT TO ANALYZE:
`;

// =============================================================================
// Adapter Implementation
// =============================================================================

export class HeadlessClaudeExtractionAdapter implements ExtractionPort {
  private model: "haiku" | "sonnet" | "opus";

  constructor(model: "haiku" | "sonnet" | "opus" = "haiku") {
    this.model = model;
  }

  name(): string {
    return `headless-claude-${this.model}`;
  }

  capabilities(): ExtractionCapabilities {
    return {
      entity_types: [
        "person",
        "organization",
        "location",
        "date",
        "time",
        "product",
        "event",
        "concept",
        "topic",
      ],
      relationship_extraction: true,
      topic_extraction: true,
      sentiment_analysis: false, // Not implemented yet
      summarization: true,
      languages: ["en"], // Primary support
      model_name: `claude-${this.model}`,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync("which claude", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async extract(
    text: string,
    options?: ExtractionOptions,
    context?: ExtractionContext
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const result: ExtractionResult = {
      entities: [],
      relationships: [],
      topics: [],
      processing_time_ms: 0,
    };

    // Truncate very long text to avoid token limits
    const maxChars = 8000;
    const truncatedText = text.length > maxChars
      ? text.slice(0, maxChars) + "\n[...truncated...]"
      : text;

    // Extract entities
    if (options?.extract_entities !== false) {
      try {
        const entityPrompt = ENTITY_EXTRACTION_PROMPT + truncatedText;
        const entityResponse = await callHeadlessClaude(entityPrompt, {
          model: this.model,
          timeout: 60000,
        });

        const entityData = this.parseJSON(entityResponse);
        if (entityData?.entities) {
          result.entities = entityData.entities
            .filter((e: any) => e.text && e.type)
            .map((e: any) => ({
              text: e.text,
              type: e.type as EntityType,
              start_offset: 0,
              end_offset: 0,
              confidence: e.confidence || 0.7,
              normalized_name: e.normalized_name || e.text,
            }));
        }
      } catch (error) {
        console.error("Entity extraction failed:", error);
      }
    }

    // Extract relationships
    if (options?.extract_relationships !== false && result.entities.length > 1) {
      try {
        const entityList = result.entities
          .map((e) => `${e.normalized_name} (${e.type})`)
          .join(", ");
        const relPrompt =
          RELATIONSHIP_EXTRACTION_PROMPT +
          entityList +
          "\n\nTEXT:\n" +
          truncatedText;

        const relResponse = await callHeadlessClaude(relPrompt, {
          model: this.model,
          timeout: 60000,
        });

        const relData = this.parseJSON(relResponse);
        if (relData?.relationships) {
          result.relationships = relData.relationships
            .filter((r: any) => r.subject && r.predicate && r.object)
            .map((r: any) => ({
              subject: {
                text: r.subject,
                type: "concept" as EntityType,
                start_offset: 0,
                end_offset: 0,
                confidence: r.confidence || 0.7,
              },
              predicate: r.predicate,
              object: {
                text: r.object,
                type: "concept" as EntityType,
                start_offset: 0,
                end_offset: 0,
                confidence: r.confidence || 0.7,
              },
              confidence: r.confidence || 0.7,
              evidence: r.evidence,
            }));
        }
      } catch (error) {
        console.error("Relationship extraction failed:", error);
      }
    }

    // Extract topics and summary
    if (options?.extract_topics !== false || options?.extract_summary !== false) {
      try {
        const topicPrompt = TOPIC_EXTRACTION_PROMPT + truncatedText;
        const topicResponse = await callHeadlessClaude(topicPrompt, {
          model: this.model,
          timeout: 60000,
        });

        const topicData = this.parseJSON(topicResponse);
        if (topicData?.topics) {
          result.topics = topicData.topics
            .filter((t: any) => t.name)
            .map((t: any) => ({
              name: t.name,
              confidence: t.confidence || 0.7,
              keywords: t.keywords || [],
            }));
        }
        if (topicData?.summary) {
          result.summary = topicData.summary;
        }
      } catch (error) {
        console.error("Topic extraction failed:", error);
      }
    }

    result.processing_time_ms = Date.now() - startTime;
    return result;
  }

  /**
   * Extract beliefs from text (Theory of Mind foundation)
   */
  async extractBeliefs(text: string): Promise<
    Array<{
      statement: string;
      confidence: number;
      evidence: string;
      category: string;
    }>
  > {
    try {
      const maxChars = 8000;
      const truncatedText = text.length > maxChars
        ? text.slice(0, maxChars) + "\n[...truncated...]"
        : text;

      const prompt = BELIEF_EXTRACTION_PROMPT + truncatedText;
      const response = await callHeadlessClaude(prompt, {
        model: this.model,
        timeout: 60000,
      });

      const data = this.parseJSON(response);
      return data?.beliefs || [];
    } catch (error) {
      console.error("Belief extraction failed:", error);
      return [];
    }
  }

  private parseJSON(text: string): any {
    // Find JSON in response (Claude sometimes adds explanation)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createHeadlessClaudeExtractor(
  model: "haiku" | "sonnet" | "opus" = "haiku"
): HeadlessClaudeExtractionAdapter {
  return new HeadlessClaudeExtractionAdapter(model);
}
