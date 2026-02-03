# Spec: Content Selection Architecture

**Component**: Voice Content Pipeline
**Priority**: High
**Estimated Effort**: 6-8 hours
**Dependencies**: Personality system, voice-hook.ts, TTS adapters

---

## Problem Statement

The voice system currently conflates three distinct responsibilities:

1. **What to say** (content selection/summarization)
2. **How to phrase it** (personality transforms)
3. **How to speak it** (TTS synthesis)

The content selection layer (responsibility #1) is implemented as a hardcoded `summarizeForVoice()` function that uses naive regex-based sentence splitting with magic numbers (`maxSentences = 3`, `maxWords = 100`). This causes:

- **Truncation mid-structure**: Numbered lists like "1. X 2. Y 3. Z" get cut at "2." because the regex treats `1.` `2.` `3.` as sentence terminators
- **Silent data loss**: Content is discarded with no logging of what was lost
- **No customization**: Users cannot configure content selection per-agent, per-event, or per-personality
- **Architectural confusion**: The personality system has `textTransforms.maxSentences` but it runs *after* `summarizeForVoice()` has already truncated

### Evidence

From logs (2025-12-19T22:32:39):
```
Original: "1. READ-ONLY MODE... 2. Core principles... 3. Repository structure... I'm equipped to:..."
Spoken:   "...1. READ-ONLY MODE: I can only search and analyze code, not modify files\n2."
```

The voice output ended mid-sentence at "2." because the regex `/(?<=[.!?])\s+/` treated numbered list markers as sentence boundaries.

---

## Design Philosophy

### Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│                        Voice Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Raw Text ──▶ ContentSelector ──▶ TextTransformer ──▶ TTS     │
│                     │                     │               │      │
│                     ▼                     ▼               ▼      │
│               "What to say"        "How to phrase"  "How to speak"
│                                                                  │
│   Strategies:              Personality:           Backends:      │
│   - Naive truncate         - Greetings            - ElevenLabs   │
│   - Structural extract     - Fillers              - Piper        │
│   - LLM summarize          - Code verbosity       - Edge TTS     │
│   - Voice directive        - Emotion              - Kokoro       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **No silent truncation**: When content is reduced, log what was lost
2. **Configurable at every level**: Global defaults, per-personality, per-event, per-agent
3. **Strategy pattern**: Pluggable content selection strategies
4. **Graceful degradation**: If a strategy fails, fall back to simpler strategies
5. **Event awareness**: Different events (Stop, SubagentStop, Notification) may need different strategies
6. **Structural awareness**: Understand lists, headings, conclusions - not just sentences

---

## Data Model

### ContentSelectionConfig

```typescript
// plugins/voice/src/content/types.ts

/**
 * Content selection strategy types
 */
export type SelectionStrategy =
  | "naive-truncate"      // Current behavior: first N sentences
  | "structural-extract"  // Parse structure, extract intelligently
  | "llm-summarize"       // Use LLM to generate spoken summary
  | "voice-directive"     // Extract <!-- voice: ... --> from source
  | "passthrough";        // No modification

/**
 * Configuration for content selection
 */
export interface ContentSelectionConfig {
  /** Primary selection strategy */
  strategy: SelectionStrategy;

  /** Maximum output length in characters (not sentences) */
  maxLength: number;

  /** Fallback strategy if primary fails */
  fallbackStrategy?: SelectionStrategy;

  /** Strategy-specific options */
  options?: StrategyOptions;

  /** Event-specific overrides */
  eventOverrides?: Partial<Record<VoiceEventType, Partial<ContentSelectionConfig>>>;

  /** Format-specific handling rules */
  formatRules?: FormatRules;
}

/**
 * Voice event types that trigger content selection
 */
export type VoiceEventType =
  | "SessionStart"
  | "Stop"
  | "SubagentStop"
  | "Notification";

/**
 * Strategy-specific options
 */
export interface StrategyOptions {
  // Naive truncate options
  maxSentences?: number;
  maxWords?: number;

  // Structural extract options
  extractionRules?: ExtractionRule[];
  preferConclusion?: boolean;
  summarizeLists?: boolean;

  // LLM summarize options
  summaryPrompt?: string;
  maxTokens?: number;
  model?: "haiku" | "sonnet";  // Fast models only

  // Voice directive options
  directivePattern?: string;  // Default: <!-- voice: ... -->
  fallbackOnMissing?: SelectionStrategy;
}

/**
 * Rules for handling specific content formats
 */
export interface FormatRules {
  /** How to handle numbered lists */
  numberedList: "read-all" | "summarize-count" | "read-first-n" | "skip";
  numberedListN?: number;  // For read-first-n

  /** How to handle bullet lists */
  bulletList: "read-all" | "summarize-count" | "read-first-n" | "skip";
  bulletListN?: number;

  /** How to handle code blocks (pre-personality transform) */
  codeBlock: "skip" | "mention-language" | "describe-briefly";

  /** How to handle markdown headings */
  headings: "read" | "skip" | "emphasize";

  /** How to handle URLs */
  urls: "skip" | "mention-domain" | "read-full";
}

/**
 * Extraction rule for structural strategy
 */
export interface ExtractionRule {
  /** Rule type */
  type: "conclusion-marker" | "heading-level" | "last-paragraph" | "first-paragraph" | "summary-section";

  /** Priority (lower = higher priority) */
  priority: number;

  /** Configuration */
  config?: {
    markers?: string[];      // For conclusion-marker: ["In summary", "Done.", "Complete."]
    level?: number;          // For heading-level: 1, 2, 3
    sectionName?: string;    // For summary-section: "Summary", "TL;DR"
  };
}
```

### Default Configurations

```typescript
// plugins/voice/src/content/defaults.ts

import type { ContentSelectionConfig, FormatRules } from "./types.js";

/**
 * Default format rules - conservative, structure-aware
 */
export const DEFAULT_FORMAT_RULES: FormatRules = {
  numberedList: "summarize-count",  // "3 items covering: X, Y, Z"
  bulletList: "summarize-count",
  codeBlock: "mention-language",     // "(TypeScript code block)"
  headings: "read",
  urls: "skip",
};

/**
 * Default content selection config
 */
export const DEFAULT_CONTENT_CONFIG: ContentSelectionConfig = {
  strategy: "structural-extract",
  maxLength: 500,  // ~50-60 words spoken, ~15-20 seconds
  fallbackStrategy: "naive-truncate",

  options: {
    // Structural options
    extractionRules: [
      { type: "conclusion-marker", priority: 1, config: { markers: ["Done.", "Complete.", "In summary", "Ready."] } },
      { type: "summary-section", priority: 2, config: { sectionName: "Summary" } },
      { type: "last-paragraph", priority: 3 },
    ],
    preferConclusion: true,
    summarizeLists: true,

    // Fallback naive options
    maxSentences: 5,
    maxWords: 100,
  },

  formatRules: DEFAULT_FORMAT_RULES,

  eventOverrides: {
    SessionStart: {
      strategy: "passthrough",  // "Ready." is already short
    },
    Notification: {
      strategy: "passthrough",  // Notifications are pre-formatted
      maxLength: 200,
    },
    SubagentStop: {
      strategy: "structural-extract",
      options: {
        preferConclusion: true,
        summarizeLists: true,
        extractionRules: [
          { type: "conclusion-marker", priority: 1, config: { markers: ["I found", "Complete.", "Done.", "Ready to", "I've"] } },
          { type: "last-paragraph", priority: 2 },
        ],
      },
    },
  },
};

/**
 * Minimal config for fast, short responses
 */
export const MINIMAL_CONTENT_CONFIG: ContentSelectionConfig = {
  strategy: "naive-truncate",
  maxLength: 200,
  options: {
    maxSentences: 2,
    maxWords: 40,
  },
  formatRules: {
    ...DEFAULT_FORMAT_RULES,
    numberedList: "skip",
    bulletList: "skip",
  },
};

/**
 * Verbose config for detailed spoken output
 */
export const VERBOSE_CONTENT_CONFIG: ContentSelectionConfig = {
  strategy: "structural-extract",
  maxLength: 1000,
  options: {
    maxSentences: 10,
    maxWords: 200,
    summarizeLists: false,  // Read lists fully
  },
  formatRules: {
    ...DEFAULT_FORMAT_RULES,
    numberedList: "read-all",
    bulletList: "read-first-n",
    bulletListN: 5,
  },
};
```

---

## Implementation

### ContentSelector Interface

```typescript
// plugins/voice/src/content/selector.ts

import type { ContentSelectionConfig, VoiceEventType } from "./types.js";

/**
 * Result of content selection
 */
export interface SelectionResult {
  /** The selected/transformed text for TTS */
  text: string;

  /** Original text length (for logging) */
  originalLength: number;

  /** Strategy that was used */
  strategyUsed: string;

  /** Whether fallback was needed */
  usedFallback: boolean;

  /** What was truncated/removed (for logging, not spoken) */
  truncatedContent?: string;

  /** Metadata about the selection */
  metadata?: {
    sentenceCount?: number;
    wordCount?: number;
    structuresFound?: string[];  // "numbered-list", "code-block", etc.
  };
}

/**
 * Content selection context
 */
export interface SelectionContext {
  /** Event type triggering selection */
  eventType: VoiceEventType;

  /** Agent ID if applicable */
  agentId?: string;

  /** Session ID */
  sessionId?: string;

  /** Working directory for config loading */
  cwd: string;
}

/**
 * Content Selector
 *
 * Selects and transforms content for voice output based on
 * configurable strategies and event context.
 */
export class ContentSelector {
  private config: ContentSelectionConfig;
  private strategies: Map<string, SelectionStrategy>;

  constructor(config: ContentSelectionConfig) {
    this.config = config;
    this.strategies = new Map();
    this.registerBuiltinStrategies();
  }

  /**
   * Select content for voice output
   */
  async select(text: string, context: SelectionContext): Promise<SelectionResult> {
    if (!text) {
      return {
        text: "",
        originalLength: 0,
        strategyUsed: "empty",
        usedFallback: false,
      };
    }

    // Get event-specific config
    const effectiveConfig = this.getEffectiveConfig(context.eventType);

    // Try primary strategy
    const strategy = this.strategies.get(effectiveConfig.strategy);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${effectiveConfig.strategy}`);
    }

    try {
      const result = await strategy.execute(text, effectiveConfig, context);

      // Enforce max length
      if (result.text.length > effectiveConfig.maxLength) {
        result.text = this.enforceMaxLength(result.text, effectiveConfig.maxLength);
      }

      return result;
    } catch (error) {
      // Try fallback
      if (effectiveConfig.fallbackStrategy) {
        const fallback = this.strategies.get(effectiveConfig.fallbackStrategy);
        if (fallback) {
          const result = await fallback.execute(text, effectiveConfig, context);
          result.usedFallback = true;
          return result;
        }
      }

      // Ultimate fallback: passthrough with length limit
      return {
        text: text.slice(0, effectiveConfig.maxLength),
        originalLength: text.length,
        strategyUsed: "emergency-fallback",
        usedFallback: true,
      };
    }
  }

  /**
   * Get effective config for an event type
   */
  private getEffectiveConfig(eventType: VoiceEventType): ContentSelectionConfig {
    const override = this.config.eventOverrides?.[eventType];
    if (!override) return this.config;

    return {
      ...this.config,
      ...override,
      options: {
        ...this.config.options,
        ...override.options,
      },
      formatRules: {
        ...this.config.formatRules,
        ...override.formatRules,
      },
    };
  }

  /**
   * Enforce max length while respecting word boundaries
   */
  private enforceMaxLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Find last space before limit
    const truncated = text.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.8) {
      return truncated.slice(0, lastSpace) + "...";
    }

    return truncated + "...";
  }

  /**
   * Register built-in strategies
   */
  private registerBuiltinStrategies(): void {
    this.strategies.set("naive-truncate", new NaiveTruncateStrategy());
    this.strategies.set("structural-extract", new StructuralExtractStrategy());
    this.strategies.set("voice-directive", new VoiceDirectiveStrategy());
    this.strategies.set("passthrough", new PassthroughStrategy());
    // LLM strategy registered separately due to async init
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(name: string, strategy: SelectionStrategy): void {
    this.strategies.set(name, strategy);
  }
}
```

### Strategy Implementations

```typescript
// plugins/voice/src/content/strategies/index.ts

export { NaiveTruncateStrategy } from "./naive-truncate.js";
export { StructuralExtractStrategy } from "./structural-extract.js";
export { VoiceDirectiveStrategy } from "./voice-directive.js";
export { PassthroughStrategy } from "./passthrough.js";
export { LLMSummarizeStrategy } from "./llm-summarize.js";
```

#### Naive Truncate Strategy

```typescript
// plugins/voice/src/content/strategies/naive-truncate.ts

import type { SelectionResult, SelectionContext, ContentSelectionConfig } from "../types.js";

/**
 * Improved naive truncation that respects list structures
 */
export class NaiveTruncateStrategy {

  async execute(
    text: string,
    config: ContentSelectionConfig,
    context: SelectionContext
  ): Promise<SelectionResult> {
    const maxSentences = config.options?.maxSentences ?? 5;
    const maxWords = config.options?.maxWords ?? 100;

    // Pre-process: protect numbered lists from sentence splitting
    const processed = this.protectLists(text);

    // Split into sentences (improved regex)
    const sentences = this.splitSentences(processed);

    // Collect sentences up to limits
    let result = "";
    let wordCount = 0;
    let sentenceCount = 0;

    for (const sentence of sentences) {
      if (sentenceCount >= maxSentences) break;

      const words = sentence.trim().split(/\s+/).length;
      if (wordCount + words > maxWords && result) break;

      result += (result ? " " : "") + sentence.trim();
      wordCount += words;
      sentenceCount++;
    }

    // Restore protected content
    result = this.restoreLists(result);

    return {
      text: result || text.slice(0, 300),
      originalLength: text.length,
      strategyUsed: "naive-truncate",
      usedFallback: false,
      metadata: {
        sentenceCount,
        wordCount,
      },
    };
  }

  /**
   * Protect numbered/bulleted lists from sentence splitting
   * by replacing periods in list markers with a placeholder
   */
  private protectLists(text: string): string {
    // Protect "1." "2." etc from being treated as sentence ends
    return text.replace(/(\d+)\.\s+/g, "$1\u0000 ");
  }

  /**
   * Restore protected list markers
   */
  private restoreLists(text: string): string {
    return text.replace(/(\d+)\u0000 /g, "$1. ");
  }

  /**
   * Split into sentences with improved handling
   */
  private splitSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by whitespace
    // But not after abbreviations like "Dr." "Mr." "vs." etc.
    const abbrevPattern = /(?:Mr|Mrs|Ms|Dr|Prof|vs|etc|e\.g|i\.e)\.\s+/gi;
    const protected = text.replace(abbrevPattern, match => match.replace(". ", ".\u0001"));

    const sentences = protected
      .split(/(?<=[.!?])\s+/)
      .map(s => s.replace(/\u0001/g, " "))
      .filter(s => s.trim().length > 0);

    return sentences;
  }
}
```

#### Structural Extract Strategy

```typescript
// plugins/voice/src/content/strategies/structural-extract.ts

import type { SelectionResult, SelectionContext, ContentSelectionConfig, FormatRules } from "../types.js";

/**
 * Structure-aware content extraction
 */
export class StructuralExtractStrategy {

  async execute(
    text: string,
    config: ContentSelectionConfig,
    context: SelectionContext
  ): Promise<SelectionResult> {
    const formatRules = config.formatRules ?? {};
    const options = config.options ?? {};

    // Parse structure
    const structure = this.parseStructure(text);

    // Apply format rules
    let processed = this.applyFormatRules(text, structure, formatRules);

    // Try extraction rules in priority order
    if (options.extractionRules) {
      const sorted = [...options.extractionRules].sort((a, b) => a.priority - b.priority);

      for (const rule of sorted) {
        const extracted = this.applyExtractionRule(processed, structure, rule);
        if (extracted) {
          processed = extracted;
          break;
        }
      }
    }

    // If still too long, fall back to intelligent truncation
    if (processed.length > config.maxLength) {
      processed = this.intelligentTruncate(processed, config.maxLength, structure);
    }

    return {
      text: processed,
      originalLength: text.length,
      strategyUsed: "structural-extract",
      usedFallback: false,
      metadata: {
        structuresFound: structure.types,
      },
    };
  }

  /**
   * Parse text structure
   */
  private parseStructure(text: string): ParsedStructure {
    const types: string[] = [];
    const sections: Section[] = [];

    // Detect numbered lists
    const numberedListMatch = text.match(/^\s*\d+\.\s+/gm);
    if (numberedListMatch && numberedListMatch.length >= 2) {
      types.push("numbered-list");
    }

    // Detect bullet lists
    const bulletMatch = text.match(/^\s*[-*]\s+/gm);
    if (bulletMatch && bulletMatch.length >= 2) {
      types.push("bullet-list");
    }

    // Detect code blocks
    if (/```[\s\S]*?```/.test(text)) {
      types.push("code-block");
    }

    // Detect headings
    if (/^#+\s+/m.test(text)) {
      types.push("headings");
    }

    // Parse sections by headings
    const headingMatches = text.matchAll(/^(#{1,6})\s+(.+)$/gm);
    let lastIndex = 0;

    for (const match of headingMatches) {
      if (match.index !== undefined && match.index > lastIndex) {
        sections.push({
          type: "content",
          content: text.slice(lastIndex, match.index).trim(),
          startIndex: lastIndex,
        });
      }
      sections.push({
        type: "heading",
        level: match[1].length,
        content: match[2],
        startIndex: match.index ?? 0,
      });
      lastIndex = (match.index ?? 0) + match[0].length;
    }

    if (lastIndex < text.length) {
      sections.push({
        type: "content",
        content: text.slice(lastIndex).trim(),
        startIndex: lastIndex,
      });
    }

    return { types, sections, raw: text };
  }

  /**
   * Apply format rules to content
   */
  private applyFormatRules(text: string, structure: ParsedStructure, rules: FormatRules): string {
    let result = text;

    // Handle numbered lists
    if (structure.types.includes("numbered-list") && rules.numberedList) {
      result = this.handleNumberedList(result, rules.numberedList, rules.numberedListN);
    }

    // Handle bullet lists
    if (structure.types.includes("bullet-list") && rules.bulletList) {
      result = this.handleBulletList(result, rules.bulletList, rules.bulletListN);
    }

    // Handle code blocks
    if (structure.types.includes("code-block") && rules.codeBlock) {
      result = this.handleCodeBlocks(result, rules.codeBlock);
    }

    // Handle URLs
    if (rules.urls) {
      result = this.handleUrls(result, rules.urls);
    }

    // Clean up markdown formatting
    result = result.replace(/[*_]+/g, "");  // Remove bold/italic markers
    result = result.replace(/^#+\s*/gm, ""); // Remove heading markers

    return result.trim();
  }

  /**
   * Handle numbered lists based on rule
   */
  private handleNumberedList(text: string, rule: string, n?: number): string {
    const listItems = text.match(/^\s*(\d+)\.\s+(.+)$/gm);
    if (!listItems || listItems.length === 0) return text;

    switch (rule) {
      case "summarize-count": {
        // Extract first few words from each item
        const count = listItems.length;
        const previews = listItems.slice(0, 3).map(item => {
          const content = item.replace(/^\s*\d+\.\s+/, "").trim();
          const words = content.split(/\s+/).slice(0, 4).join(" ");
          return words;
        });
        const previewText = previews.join(", ");
        const suffix = count > 3 ? "..." : "";
        return text.replace(
          /(?:^\s*\d+\.\s+.+$\n?)+/gm,
          `${count} items: ${previewText}${suffix}\n`
        );
      }

      case "read-first-n": {
        const limit = n ?? 3;
        const kept = listItems.slice(0, limit);
        const removed = listItems.slice(limit);
        if (removed.length === 0) return text;

        let result = text;
        for (const item of removed) {
          result = result.replace(item + "\n", "");
          result = result.replace(item, "");
        }
        if (removed.length > 0) {
          result = result.trim() + ` (and ${removed.length} more)`;
        }
        return result;
      }

      case "skip":
        return text.replace(/(?:^\s*\d+\.\s+.+$\n?)+/gm, "(list omitted)\n");

      case "read-all":
      default:
        return text;
    }
  }

  /**
   * Handle bullet lists based on rule
   */
  private handleBulletList(text: string, rule: string, n?: number): string {
    // Similar to numbered list handling
    const listItems = text.match(/^\s*[-*]\s+(.+)$/gm);
    if (!listItems || listItems.length === 0) return text;

    switch (rule) {
      case "summarize-count": {
        const count = listItems.length;
        return text.replace(
          /(?:^\s*[-*]\s+.+$\n?)+/gm,
          `${count} bullet points.\n`
        );
      }

      case "skip":
        return text.replace(/(?:^\s*[-*]\s+.+$\n?)+/gm, "");

      default:
        return text;
    }
  }

  /**
   * Handle code blocks based on rule
   */
  private handleCodeBlocks(text: string, rule: string): string {
    switch (rule) {
      case "mention-language":
        return text.replace(
          /```(\w*)\n[\s\S]*?```/g,
          (_, lang) => `(${lang || "code"} block)`
        );

      case "describe-briefly":
        return text.replace(
          /```(\w*)\n([\s\S]*?)```/g,
          (_, lang, code) => {
            const lines = code.trim().split("\n").length;
            return `(${lang || "code"} block, ${lines} lines)`;
          }
        );

      case "skip":
        return text.replace(/```[\s\S]*?```/g, "");

      default:
        return text;
    }
  }

  /**
   * Handle URLs based on rule
   */
  private handleUrls(text: string, rule: string): string {
    const urlRegex = /https?:\/\/[^\s)]+/g;

    switch (rule) {
      case "skip":
        return text.replace(urlRegex, "");

      case "mention-domain":
        return text.replace(urlRegex, (url) => {
          try {
            const domain = new URL(url).hostname.replace("www.", "");
            return `(link to ${domain})`;
          } catch {
            return "(link)";
          }
        });

      default:
        return text;
    }
  }

  /**
   * Apply extraction rule
   */
  private applyExtractionRule(
    text: string,
    structure: ParsedStructure,
    rule: ExtractionRule
  ): string | null {
    switch (rule.type) {
      case "conclusion-marker": {
        const markers = rule.config?.markers ?? ["In summary", "Done.", "Complete."];
        for (const marker of markers) {
          const index = text.lastIndexOf(marker);
          if (index !== -1) {
            // Extract from marker to end
            const extracted = text.slice(index).trim();
            if (extracted.length > 20) {
              return extracted;
            }
          }
        }
        return null;
      }

      case "last-paragraph": {
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        if (paragraphs.length > 0) {
          const last = paragraphs[paragraphs.length - 1].trim();
          if (last.length > 20 && last.length < 500) {
            return last;
          }
        }
        return null;
      }

      case "first-paragraph": {
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        if (paragraphs.length > 0) {
          return paragraphs[0].trim();
        }
        return null;
      }

      case "summary-section": {
        const sectionName = rule.config?.sectionName ?? "Summary";
        const regex = new RegExp(`#+\\s*${sectionName}[\\s\\S]*?(?=#+|$)`, "i");
        const match = text.match(regex);
        if (match) {
          return match[0].replace(/^#+\s*\w+\s*\n/, "").trim();
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Intelligent truncation that respects structure
   */
  private intelligentTruncate(text: string, maxLength: number, structure: ParsedStructure): string {
    // Find a good break point
    const sentences = text.split(/(?<=[.!?])\s+/);
    let result = "";

    for (const sentence of sentences) {
      if ((result + " " + sentence).length > maxLength) {
        break;
      }
      result += (result ? " " : "") + sentence;
    }

    if (result.length < maxLength * 0.5) {
      // Too aggressive, just truncate at word boundary
      const truncated = text.slice(0, maxLength);
      const lastSpace = truncated.lastIndexOf(" ");
      return truncated.slice(0, lastSpace) + "...";
    }

    return result;
  }
}

interface ParsedStructure {
  types: string[];
  sections: Section[];
  raw: string;
}

interface Section {
  type: "heading" | "content";
  level?: number;
  content: string;
  startIndex: number;
}

interface ExtractionRule {
  type: string;
  priority: number;
  config?: Record<string, unknown>;
}
```

#### Voice Directive Strategy

```typescript
// plugins/voice/src/content/strategies/voice-directive.ts

import type { SelectionResult, SelectionContext, ContentSelectionConfig } from "../types.js";

/**
 * Extract voice content from explicit directives in source
 *
 * Supports:
 * - <!-- voice: spoken text here -->
 * - <!-- tts: spoken text here -->
 * - [voice]: spoken text here (at start of line)
 */
export class VoiceDirectiveStrategy {

  async execute(
    text: string,
    config: ContentSelectionConfig,
    context: SelectionContext
  ): Promise<SelectionResult> {
    const pattern = config.options?.directivePattern ?? "<!-- voice: (.*?) -->";
    const fallback = config.options?.fallbackOnMissing ?? "structural-extract";

    // Try HTML comment format
    const htmlMatch = text.match(/<!--\s*(?:voice|tts):\s*([\s\S]*?)\s*-->/i);
    if (htmlMatch) {
      return {
        text: htmlMatch[1].trim(),
        originalLength: text.length,
        strategyUsed: "voice-directive",
        usedFallback: false,
        metadata: {
          directiveType: "html-comment",
        },
      };
    }

    // Try bracket format
    const bracketMatch = text.match(/^\[voice\]:\s*(.+)$/im);
    if (bracketMatch) {
      return {
        text: bracketMatch[1].trim(),
        originalLength: text.length,
        strategyUsed: "voice-directive",
        usedFallback: false,
        metadata: {
          directiveType: "bracket",
        },
      };
    }

    // No directive found - signal for fallback
    throw new Error("No voice directive found");
  }
}
```

#### Passthrough Strategy

```typescript
// plugins/voice/src/content/strategies/passthrough.ts

import type { SelectionResult, SelectionContext, ContentSelectionConfig } from "../types.js";

/**
 * Pass content through with minimal processing
 */
export class PassthroughStrategy {

  async execute(
    text: string,
    config: ContentSelectionConfig,
    context: SelectionContext
  ): Promise<SelectionResult> {
    // Only strip markdown formatting, no content reduction
    let processed = text
      .replace(/[*_]+/g, "")           // Bold/italic
      .replace(/^#+\s*/gm, "")         // Headings
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // Links
      .trim();

    return {
      text: processed,
      originalLength: text.length,
      strategyUsed: "passthrough",
      usedFallback: false,
    };
  }
}
```

---

## Integration

### Personality System Extension

Add content selection config to VoicePersonality:

```typescript
// Extend plugins/voice/src/personality/types.ts

export interface VoicePersonality {
  // ... existing fields ...

  /** Content selection configuration */
  contentSelection?: Partial<ContentSelectionConfig>;
}
```

### Voice Hook Integration

Replace `summarizeForVoice()` with ContentSelector:

```typescript
// In plugins/voice/hooks/voice-hook.ts

import { ContentSelector, DEFAULT_CONTENT_CONFIG } from "../src/content/index.js";

// Cache selector per personality
const selectorCache = new Map<string, ContentSelector>();

function getContentSelector(personality: VoicePersonality): ContentSelector {
  const cacheKey = personality.id;

  if (!selectorCache.has(cacheKey)) {
    const config = {
      ...DEFAULT_CONTENT_CONFIG,
      ...personality.contentSelection,
    };
    selectorCache.set(cacheKey, new ContentSelector(config));
  }

  return selectorCache.get(cacheKey)!;
}

// In handleStop and handleSubagentStop:
async function handleStop(data: Record<string, unknown>, cwd: string): Promise<void> {
  const sessionId = data.session_id as string;
  const transcriptPath = data.transcript_path as string;

  const response = extractResponse(transcriptPath);
  const personality = getPersonalityManager(cwd).getDefault();
  const selector = getContentSelector(personality);

  const result = await selector.select(response, {
    eventType: "Stop",
    sessionId,
    cwd,
  });

  // Log selection details
  log(`Selected ${result.text.length}/${result.originalLength} chars via ${result.strategyUsed}`);

  if (result.text) {
    await speak(result.text, sessionId, cwd, "Stop");
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/src/content/tests/strategies.test.ts

import { describe, test, expect } from "bun:test";
import { NaiveTruncateStrategy } from "../strategies/naive-truncate.js";
import { StructuralExtractStrategy } from "../strategies/structural-extract.js";
import { DEFAULT_CONTENT_CONFIG } from "../defaults.js";

describe("NaiveTruncateStrategy", () => {
  const strategy = new NaiveTruncateStrategy();
  const context = { eventType: "Stop" as const, cwd: "." };

  test("preserves numbered lists", async () => {
    const text = "I found:\n\n1. First item\n2. Second item\n3. Third item";
    const result = await strategy.execute(text, DEFAULT_CONTENT_CONFIG, context);

    // Should NOT end with "2." mid-list
    expect(result.text).not.toMatch(/\d+\.$/);
    expect(result.text).not.toMatch(/\d+\."?$/);
  });

  test("respects sentence boundaries", async () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const config = { ...DEFAULT_CONTENT_CONFIG, options: { maxSentences: 2 } };
    const result = await strategy.execute(text, config, context);

    expect(result.text).toBe("First sentence. Second sentence.");
  });

  test("handles abbreviations correctly", async () => {
    const text = "Dr. Smith went to the store. He bought apples.";
    const result = await strategy.execute(text, DEFAULT_CONTENT_CONFIG, context);

    // Should not split at "Dr."
    expect(result.text).toContain("Dr. Smith");
  });
});

describe("StructuralExtractStrategy", () => {
  const strategy = new StructuralExtractStrategy();
  const context = { eventType: "Stop" as const, cwd: "." };

  test("summarizes numbered lists when configured", async () => {
    const text = "I found:\n1. Alpha\n2. Beta\n3. Gamma\n4. Delta";
    const config = {
      ...DEFAULT_CONTENT_CONFIG,
      formatRules: { numberedList: "summarize-count" as const },
    };
    const result = await strategy.execute(text, config, context);

    expect(result.text).toContain("4 items");
  });

  test("extracts conclusion markers", async () => {
    const text = "Long explanation...\n\nDone. The task is complete.";
    const result = await strategy.execute(text, DEFAULT_CONTENT_CONFIG, context);

    expect(result.text).toContain("Done");
    expect(result.text).toContain("complete");
  });

  test("handles code blocks", async () => {
    const text = "Here is code:\n```typescript\nconst x = 1;\n```\nThat was it.";
    const config = {
      ...DEFAULT_CONTENT_CONFIG,
      formatRules: { codeBlock: "mention-language" as const },
    };
    const result = await strategy.execute(text, config, context);

    expect(result.text).toContain("typescript block");
    expect(result.text).not.toContain("const x");
  });
});
```

### Integration Tests

```typescript
// plugins/voice/src/content/tests/integration.test.ts

import { describe, test, expect } from "bun:test";
import { ContentSelector } from "../selector.js";
import { DEFAULT_CONTENT_CONFIG } from "../defaults.js";

describe("ContentSelector integration", () => {

  test("handles real agent output", async () => {
    const agentOutput = `I'm ready to assist you! I've reviewed the system context and understand:

1. **READ-ONLY MODE**: I can only search and analyze code, not modify files
2. **Core principles** from CLAUDE.md:
   - No data truncation
   - No hard-coded data or mock data
3. **Repository structure**:
   - This is a Claude Code plugin ecosystem

What would you like me to search for or analyze?`;

    const selector = new ContentSelector(DEFAULT_CONTENT_CONFIG);
    const result = await selector.select(agentOutput, {
      eventType: "SubagentStop",
      cwd: ".",
    });

    // Should NOT end mid-list
    expect(result.text).not.toMatch(/\d+\.$/);

    // Should preserve meaningful content
    expect(result.text.length).toBeGreaterThan(50);

    // Should mention the key information
    expect(
      result.text.includes("ready") ||
      result.text.includes("READ-ONLY") ||
      result.text.includes("items")
    ).toBe(true);
  });

  test("respects event-specific config", async () => {
    const selector = new ContentSelector({
      ...DEFAULT_CONTENT_CONFIG,
      eventOverrides: {
        Notification: {
          strategy: "passthrough",
        },
      },
    });

    const notification = "Attention needed!";
    const result = await selector.select(notification, {
      eventType: "Notification",
      cwd: ".",
    });

    expect(result.strategyUsed).toBe("passthrough");
    expect(result.text).toBe("Attention needed!");
  });
});
```

---

## Migration Path

### Phase 1: Add ContentSelector (Non-Breaking)

1. Implement ContentSelector and strategies
2. Add to personality types as optional field
3. Voice hook continues using `summarizeForVoice()` by default

### Phase 2: Switch Default

1. Update voice hook to use ContentSelector
2. Keep `summarizeForVoice()` as emergency fallback
3. Monitor logs for any regressions

### Phase 3: Remove Legacy

1. Remove `summarizeForVoice()` function
2. Update all personality profiles with explicit `contentSelection` config
3. Document migration for any custom profiles

---

## File Structure

```
plugins/voice/src/content/
├── index.ts                    # Exports
├── types.ts                    # Type definitions
├── defaults.ts                 # Default configurations
├── selector.ts                 # ContentSelector class
├── strategies/
│   ├── index.ts
│   ├── naive-truncate.ts
│   ├── structural-extract.ts
│   ├── voice-directive.ts
│   ├── passthrough.ts
│   └── llm-summarize.ts        # Future: LLM-based summarization
└── tests/
    ├── strategies.test.ts
    └── integration.test.ts
```

---

## Success Criteria

1. [ ] Numbered lists no longer get truncated mid-item
2. [ ] Content selection is configurable per-personality
3. [ ] Event-specific strategies work correctly
4. [ ] Fallback chain works when primary strategy fails
5. [ ] Selection decisions are logged (original length, strategy used, fallback)
6. [ ] All existing voice functionality continues working
7. [ ] Tests cover real-world agent output patterns
8. [ ] No regression in voice latency (< 50ms added)

---

## Future Extensions

### LLM Summarization Strategy

For complex outputs where structural extraction isn't sufficient:

```typescript
// plugins/voice/src/content/strategies/llm-summarize.ts

export class LLMSummarizeStrategy {
  private client: Anthropic;

  async execute(text: string, config: ContentSelectionConfig): Promise<SelectionResult> {
    const prompt = config.options?.summaryPrompt ?? DEFAULT_SUMMARY_PROMPT;

    const response = await this.client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: config.options?.maxTokens ?? 100,
      messages: [{
        role: "user",
        content: `${prompt}\n\n---\n\n${text}`
      }],
    });

    return {
      text: response.content[0].text,
      originalLength: text.length,
      strategyUsed: "llm-summarize",
      usedFallback: false,
    };
  }
}

const DEFAULT_SUMMARY_PROMPT = `You are preparing text for text-to-speech voice output.
Summarize the following assistant response in 1-2 natural spoken sentences.
Focus on the key outcome or answer. Do not include code, URLs, or formatting.
For lists, summarize the themes rather than reading individual items.`;
```

### Agent-Side Voice Directives

Teach agents to include voice hints:

```markdown
<!-- voice: I found 4 configuration issues and fixed them all. -->

## Detailed Analysis

1. Missing semicolon in config.ts:42
2. Incorrect import path in utils.ts:15
3. ...
```

The voice system reads only the directive, while the full output goes to text.
