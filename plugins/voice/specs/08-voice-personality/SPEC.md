# Spec: Voice Personality System

**Component**: Agent Identity
**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Dependencies**: TTS adapters, AgentNet plugin

---

## Overview

Implement a system for defining and applying distinct voice personalities to agents. Each agent gets a unique voice profile that includes not just voice ID but also speaking style, prosody patterns, emotional defaults, and personality-specific text transformations.

## Goals

1. Distinct voice identity per agent
2. Personality-specific speaking styles (speed, tone, emphasis)
3. SSML prosody patterns for supported backends
4. Text transformation for personality injection
5. Integration with AgentNet profiles

## Non-Goals

- Voice training/fine-tuning (use existing voices)
- Emotion detection from context (manual or config-based)
- Real-time personality switching

---

## Data Model

### Voice Personality Schema

```typescript
// plugins/voice/specs/08-voice-personality/src/types.ts

export interface VoicePersonality {
  // Identity
  id: string;                    // Unique personality ID
  name: string;                  // Display name
  agentId?: string;              // Linked agent (optional)

  // Voice Selection
  voice: {
    backend: string;             // TTS backend
    voiceId: string;             // Voice identifier
    fallbackVoiceId?: string;    // Fallback if primary unavailable
  };

  // Speaking Style
  style: {
    speed: number;               // 0.5-2.0, default 1.0
    pitch: number;               // -20 to +20 semitones, default 0
    volume: number;              // 0.0-1.0, default 1.0
    variability: number;         // 0.0-1.0, prosody variation
  };

  // TTS Backend Settings
  ttsSettings: {
    stability?: number;          // ElevenLabs: 0.0-1.0
    similarityBoost?: number;    // ElevenLabs: 0.0-1.0
    styleExaggeration?: number;  // ElevenLabs: 0.0-1.0
  };

  // Prosody Patterns (SSML)
  prosody: {
    questionRise: boolean;       // Pitch rise on questions
    emphasisWords: string[];     // Words to always emphasize
    pauseAfterSentence: number;  // ms, default 300
    pauseAfterParagraph: number; // ms, default 600
  };

  // Text Transformations
  textTransforms: {
    addGreeting: boolean;        // Prepend greeting phrases
    addFillers: boolean;         // Add conversational fillers
    maxSentences?: number;       // Truncate long responses
    codeVerbosity: "minimal" | "moderate" | "verbose";
  };

  // Emotional Defaults
  emotion: {
    default: EmotionType;        // Base emotional state
    greetingEmotion: EmotionType;
    errorEmotion: EmotionType;
    successEmotion: EmotionType;
  };
}

export type EmotionType =
  | "neutral"
  | "happy"
  | "calm"
  | "serious"
  | "enthusiastic"
  | "concerned"
  | "thoughtful";

export interface PersonalityPreset {
  name: string;
  description: string;
  personality: Partial<VoicePersonality>;
}
```

### Built-in Personality Presets

```typescript
// plugins/voice/specs/08-voice-personality/src/presets.ts

import type { PersonalityPreset } from "./types.js";

export const PERSONALITY_PRESETS: Record<string, PersonalityPreset> = {
  professional: {
    name: "Professional",
    description: "Clear, measured, business-appropriate",
    personality: {
      style: {
        speed: 1.0,
        pitch: 0,
        volume: 1.0,
        variability: 0.3,
      },
      prosody: {
        questionRise: true,
        emphasisWords: ["important", "critical", "note"],
        pauseAfterSentence: 350,
        pauseAfterParagraph: 700,
      },
      textTransforms: {
        addGreeting: false,
        addFillers: false,
        codeVerbosity: "minimal",
      },
      emotion: {
        default: "neutral",
        greetingEmotion: "calm",
        errorEmotion: "concerned",
        successEmotion: "calm",
      },
    },
  },

  friendly: {
    name: "Friendly",
    description: "Warm, conversational, approachable",
    personality: {
      style: {
        speed: 1.05,
        pitch: 2,
        volume: 1.0,
        variability: 0.6,
      },
      prosody: {
        questionRise: true,
        emphasisWords: ["great", "awesome", "love"],
        pauseAfterSentence: 300,
        pauseAfterParagraph: 500,
      },
      textTransforms: {
        addGreeting: true,
        addFillers: true,
        codeVerbosity: "moderate",
      },
      emotion: {
        default: "happy",
        greetingEmotion: "enthusiastic",
        errorEmotion: "concerned",
        successEmotion: "happy",
      },
    },
  },

  mentor: {
    name: "Mentor",
    description: "Patient, encouraging, educational",
    personality: {
      style: {
        speed: 0.95,
        pitch: -2,
        volume: 0.95,
        variability: 0.4,
      },
      prosody: {
        questionRise: true,
        emphasisWords: ["consider", "notice", "remember", "key"],
        pauseAfterSentence: 400,
        pauseAfterParagraph: 800,
      },
      textTransforms: {
        addGreeting: true,
        addFillers: false,
        codeVerbosity: "verbose",
      },
      emotion: {
        default: "thoughtful",
        greetingEmotion: "calm",
        errorEmotion: "calm",
        successEmotion: "happy",
      },
    },
  },

  archivist: {
    name: "Archivist",
    description: "Precise, methodical, scholarly",
    personality: {
      style: {
        speed: 0.9,
        pitch: -3,
        volume: 0.9,
        variability: 0.2,
      },
      prosody: {
        questionRise: false,
        emphasisWords: ["documented", "recorded", "observed", "noted"],
        pauseAfterSentence: 450,
        pauseAfterParagraph: 900,
      },
      textTransforms: {
        addGreeting: false,
        addFillers: false,
        codeVerbosity: "minimal",
      },
      emotion: {
        default: "serious",
        greetingEmotion: "neutral",
        errorEmotion: "serious",
        successEmotion: "neutral",
      },
    },
  },

  explorer: {
    name: "Explorer",
    description: "Curious, energetic, discovery-oriented",
    personality: {
      style: {
        speed: 1.1,
        pitch: 3,
        volume: 1.0,
        variability: 0.7,
      },
      prosody: {
        questionRise: true,
        emphasisWords: ["found", "discovered", "interesting", "look"],
        pauseAfterSentence: 250,
        pauseAfterParagraph: 400,
      },
      textTransforms: {
        addGreeting: true,
        addFillers: true,
        codeVerbosity: "moderate",
      },
      emotion: {
        default: "enthusiastic",
        greetingEmotion: "enthusiastic",
        errorEmotion: "thoughtful",
        successEmotion: "enthusiastic",
      },
    },
  },
};
```

---

## Implementation Guide

### File Structure

```
plugins/voice/specs/08-voice-personality/
├── SPEC.md
├── src/
│   ├── types.ts                 # Type definitions
│   ├── presets.ts               # Built-in presets
│   ├── personality-manager.ts   # CRUD operations
│   ├── text-transformer.ts      # Text personality injection
│   ├── ssml-generator.ts        # SSML prosody generation
│   └── index.ts                 # Exports
├── profiles/                    # Default agent profiles
│   ├── opus.json
│   ├── sonnet.json
│   ├── haiku.json
│   └── agents/
│       ├── archivist.json
│       ├── mentor.json
│       └── explorer.json
├── tests/
│   ├── personality-manager.test.ts
│   ├── text-transformer.test.ts
│   └── ssml-generator.test.ts
└── README.md
```

### Personality Manager

```typescript
// plugins/voice/specs/08-voice-personality/src/personality-manager.ts

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { VoicePersonality } from "./types.js";
import { PERSONALITY_PRESETS } from "./presets.js";

const PROFILES_DIR = join(process.cwd(), ".claude/voice/personalities");

export class PersonalityManager {
  private personalities: Map<string, VoicePersonality> = new Map();

  constructor() {
    this.loadDefaults();
    this.loadUserProfiles();
  }

  private loadDefaults(): void {
    // Load built-in agent personalities
    const defaultsDir = join(__dirname, "../profiles/agents");
    if (existsSync(defaultsDir)) {
      for (const file of Bun.readdir(defaultsDir)) {
        if (file.endsWith(".json")) {
          const personality = JSON.parse(
            readFileSync(join(defaultsDir, file), "utf-8")
          );
          this.personalities.set(personality.id, personality);
        }
      }
    }
  }

  private loadUserProfiles(): void {
    if (!existsSync(PROFILES_DIR)) {
      mkdirSync(PROFILES_DIR, { recursive: true });
      return;
    }

    for (const file of Bun.readdir(PROFILES_DIR)) {
      if (file.endsWith(".json")) {
        try {
          const personality = JSON.parse(
            readFileSync(join(PROFILES_DIR, file), "utf-8")
          );
          this.personalities.set(personality.id, personality);
        } catch (e) {
          console.error(`Failed to load personality ${file}:`, e);
        }
      }
    }
  }

  /**
   * Get personality by ID.
   */
  get(id: string): VoicePersonality | undefined {
    return this.personalities.get(id);
  }

  /**
   * Get personality for agent, with fallback chain.
   */
  getForAgent(agentId: string): VoicePersonality {
    // Try exact agent match
    const exact = this.personalities.get(agentId);
    if (exact) return exact;

    // Try agent type prefix (e.g., "exploration:explorer" -> "explorer")
    const agentType = agentId.split(":").pop();
    const byType = this.personalities.get(agentType!);
    if (byType) return byType;

    // Try model-based default
    const model = this.detectModel(agentId);
    const byModel = this.personalities.get(model);
    if (byModel) return byModel;

    // Ultimate fallback
    return this.getDefault();
  }

  /**
   * Get default personality.
   */
  getDefault(): VoicePersonality {
    return this.personalities.get("default") ?? this.createFromPreset("professional", "default");
  }

  /**
   * Create personality from preset.
   */
  createFromPreset(presetName: string, id: string): VoicePersonality {
    const preset = PERSONALITY_PRESETS[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    return {
      id,
      name: preset.name,
      voice: {
        backend: "elevenlabs",
        voiceId: "21m00Tcm4TlvDq8ikWAM",  // Rachel as default
      },
      style: {
        speed: 1.0,
        pitch: 0,
        volume: 1.0,
        variability: 0.5,
        ...preset.personality.style,
      },
      ttsSettings: {},
      prosody: {
        questionRise: true,
        emphasisWords: [],
        pauseAfterSentence: 300,
        pauseAfterParagraph: 600,
        ...preset.personality.prosody,
      },
      textTransforms: {
        addGreeting: false,
        addFillers: false,
        codeVerbosity: "minimal",
        ...preset.personality.textTransforms,
      },
      emotion: {
        default: "neutral",
        greetingEmotion: "neutral",
        errorEmotion: "concerned",
        successEmotion: "neutral",
        ...preset.personality.emotion,
      },
    };
  }

  /**
   * Save personality to user profiles.
   */
  save(personality: VoicePersonality): void {
    this.personalities.set(personality.id, personality);

    const filePath = join(PROFILES_DIR, `${personality.id}.json`);
    writeFileSync(filePath, JSON.stringify(personality, null, 2));
  }

  /**
   * Delete personality.
   */
  delete(id: string): boolean {
    if (!this.personalities.has(id)) return false;

    this.personalities.delete(id);

    const filePath = join(PROFILES_DIR, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return true;
  }

  /**
   * List all personalities.
   */
  list(): VoicePersonality[] {
    return Array.from(this.personalities.values());
  }

  private detectModel(agentId: string): string {
    // Heuristic: agent IDs often contain model hints
    if (agentId.includes("opus")) return "opus";
    if (agentId.includes("sonnet")) return "sonnet";
    if (agentId.includes("haiku")) return "haiku";
    return "sonnet";  // Default
  }
}
```

### Text Transformer

```typescript
// plugins/voice/specs/08-voice-personality/src/text-transformer.ts

import type { VoicePersonality, EmotionType } from "./types.js";

const GREETINGS: Record<EmotionType, string[]> = {
  neutral: [""],
  happy: ["Great!", "Wonderful!", ""],
  calm: ["Alright.", "Okay.", ""],
  serious: [""],
  enthusiastic: ["Excellent!", "Oh!", "Wow!", ""],
  concerned: ["Hmm.", "I see.", ""],
  thoughtful: ["Let me think.", "Interesting.", ""],
};

const FILLERS: Record<EmotionType, string[]> = {
  neutral: ["", "so", "well"],
  happy: ["actually", "you know", ""],
  calm: ["", "so"],
  serious: [""],
  enthusiastic: ["oh", "actually", "you know"],
  concerned: ["well", "hmm"],
  thoughtful: ["let's see", "considering this", ""],
};

export class TextTransformer {
  private personality: VoicePersonality;

  constructor(personality: VoicePersonality) {
    this.personality = personality;
  }

  /**
   * Transform text according to personality.
   */
  transform(text: string, context?: TransformContext): string {
    let result = text;

    // Apply transformations
    if (this.personality.textTransforms.maxSentences) {
      result = this.truncateSentences(result, this.personality.textTransforms.maxSentences);
    }

    if (this.personality.textTransforms.addFillers) {
      result = this.addFillers(result, context?.emotion);
    }

    if (this.personality.textTransforms.addGreeting && context?.isGreeting) {
      result = this.addGreeting(result, context?.emotion);
    }

    // Handle code blocks based on verbosity
    result = this.adjustCodeVerbosity(result);

    return result;
  }

  private truncateSentences(text: string, maxSentences: number): string {
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length <= maxSentences) return text;

    return sentences.slice(0, maxSentences).join(" ") + "...";
  }

  private addGreeting(text: string, emotion?: EmotionType): string {
    const em = emotion ?? this.personality.emotion.greetingEmotion;
    const greetings = GREETINGS[em];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    if (greeting) {
      return `${greeting} ${text}`;
    }
    return text;
  }

  private addFillers(text: string, emotion?: EmotionType): string {
    const em = emotion ?? this.personality.emotion.default;
    const fillers = FILLERS[em];

    // Add filler to ~20% of sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    const result = sentences.map((sentence, i) => {
      if (i > 0 && Math.random() < 0.2) {
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        if (filler) {
          return `${filler.charAt(0).toUpperCase() + filler.slice(1)}, ${sentence.toLowerCase()}`;
        }
      }
      return sentence;
    });

    return result.join(" ");
  }

  private adjustCodeVerbosity(text: string): string {
    const verbosity = this.personality.textTransforms.codeVerbosity;

    switch (verbosity) {
      case "minimal":
        // Remove code blocks entirely
        return text.replace(/```[\s\S]*?```/g, "(code block)");

      case "moderate":
        // Keep first few lines of code
        return text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
          const lines = code.trim().split("\n");
          if (lines.length > 3) {
            return `(code in ${lang || "text"}: ${lines.slice(0, 2).join(", ")}...)`;
          }
          return `(code: ${lines.join(", ")})`;
        });

      case "verbose":
        // Keep full code but describe it
        return text;

      default:
        return text;
    }
  }
}

interface TransformContext {
  emotion?: EmotionType;
  isGreeting?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
}
```

### SSML Generator

```typescript
// plugins/voice/specs/08-voice-personality/src/ssml-generator.ts

import type { VoicePersonality } from "./types.js";

/**
 * Generate SSML markup for text based on personality.
 *
 * Note: Not all TTS backends support SSML. This generates
 * backend-agnostic SSML that can be stripped for unsupported backends.
 */
export class SSMLGenerator {
  private personality: VoicePersonality;

  constructor(personality: VoicePersonality) {
    this.personality = personality;
  }

  /**
   * Generate SSML for text.
   */
  generate(text: string): string {
    let ssml = text;

    // Apply prosody wrapper
    ssml = this.wrapWithProsody(ssml);

    // Add emphasis to key words
    ssml = this.addEmphasis(ssml);

    // Add pauses
    ssml = this.addPauses(ssml);

    // Handle questions
    if (this.personality.prosody.questionRise) {
      ssml = this.handleQuestions(ssml);
    }

    // Wrap in speak tags
    return `<speak>${ssml}</speak>`;
  }

  /**
   * Strip SSML for backends that don't support it.
   */
  static stripSSML(ssml: string): string {
    return ssml
      .replace(/<speak>|<\/speak>/g, "")
      .replace(/<prosody[^>]*>/g, "")
      .replace(/<\/prosody>/g, "")
      .replace(/<emphasis[^>]*>/g, "")
      .replace(/<\/emphasis>/g, "")
      .replace(/<break[^>]*\/>/g, " ")
      .trim();
  }

  private wrapWithProsody(text: string): string {
    const { speed, pitch, volume } = this.personality.style;

    const rate = `${Math.round(speed * 100)}%`;
    const pitchVal = pitch >= 0 ? `+${pitch}st` : `${pitch}st`;
    const vol = `${Math.round(volume * 100)}%`;

    return `<prosody rate="${rate}" pitch="${pitchVal}" volume="${vol}">${text}</prosody>`;
  }

  private addEmphasis(text: string): string {
    const words = this.personality.prosody.emphasisWords;
    if (words.length === 0) return text;

    const pattern = new RegExp(`\\b(${words.join("|")})\\b`, "gi");
    return text.replace(pattern, '<emphasis level="strong">$1</emphasis>');
  }

  private addPauses(text: string): string {
    const { pauseAfterSentence, pauseAfterParagraph } = this.personality.prosody;

    // Add pause after sentences
    text = text.replace(
      /([.!?])\s+/g,
      `$1<break time="${pauseAfterSentence}ms"/> `
    );

    // Add longer pause after paragraphs (double newline)
    text = text.replace(
      /\n\n+/g,
      `<break time="${pauseAfterParagraph}ms"/>\n\n`
    );

    return text;
  }

  private handleQuestions(text: string): string {
    // Wrap question sentences with rising pitch
    return text.replace(
      /([^.!?]*\?)/g,
      '<prosody pitch="+5%">$1</prosody>'
    );
  }
}
```

---

## Default Agent Profiles

### Archivist

```json
// plugins/voice/specs/08-voice-personality/profiles/agents/archivist.json
{
  "id": "archivist",
  "name": "Archivist",
  "agentId": "archivist",
  "voice": {
    "backend": "elevenlabs",
    "voiceId": "pNInz6obpgDQGcFmaJgB",
    "fallbackVoiceId": "en_US-ryan-high"
  },
  "style": {
    "speed": 0.9,
    "pitch": -3,
    "volume": 0.9,
    "variability": 0.2
  },
  "ttsSettings": {
    "stability": 0.7,
    "similarityBoost": 0.8
  },
  "prosody": {
    "questionRise": false,
    "emphasisWords": ["documented", "recorded", "observed", "noted", "discovered"],
    "pauseAfterSentence": 450,
    "pauseAfterParagraph": 900
  },
  "textTransforms": {
    "addGreeting": false,
    "addFillers": false,
    "codeVerbosity": "minimal"
  },
  "emotion": {
    "default": "serious",
    "greetingEmotion": "neutral",
    "errorEmotion": "serious",
    "successEmotion": "neutral"
  }
}
```

### Mentor

```json
// plugins/voice/specs/08-voice-personality/profiles/agents/mentor.json
{
  "id": "mentor",
  "name": "Mentor",
  "agentId": "awareness:mentor",
  "voice": {
    "backend": "elevenlabs",
    "voiceId": "TxGEqnHWrfWFTfGW9XjX",
    "fallbackVoiceId": "en_US-lessac-high"
  },
  "style": {
    "speed": 0.95,
    "pitch": -2,
    "volume": 0.95,
    "variability": 0.4
  },
  "ttsSettings": {
    "stability": 0.6,
    "similarityBoost": 0.75,
    "styleExaggeration": 0.2
  },
  "prosody": {
    "questionRise": true,
    "emphasisWords": ["consider", "notice", "remember", "key", "important"],
    "pauseAfterSentence": 400,
    "pauseAfterParagraph": 800
  },
  "textTransforms": {
    "addGreeting": true,
    "addFillers": false,
    "codeVerbosity": "verbose"
  },
  "emotion": {
    "default": "thoughtful",
    "greetingEmotion": "calm",
    "errorEmotion": "calm",
    "successEmotion": "happy"
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/08-voice-personality/tests/text-transformer.test.ts

describe("TextTransformer", () => {
  test("truncates long text", () => {
    const personality = createTestPersonality({
      textTransforms: { maxSentences: 2 }
    });
    const transformer = new TextTransformer(personality);

    const text = "First sentence. Second sentence. Third sentence. Fourth.";
    const result = transformer.transform(text);

    expect(result).toBe("First sentence. Second sentence....");
  });

  test("handles code blocks based on verbosity", () => {
    const minimal = createTestPersonality({
      textTransforms: { codeVerbosity: "minimal" }
    });
    const transformer = new TextTransformer(minimal);

    const text = "Here is code:\n```javascript\nconst x = 1;\n```";
    const result = transformer.transform(text);

    expect(result).toContain("(code block)");
    expect(result).not.toContain("const x");
  });
});
```

---

## Success Criteria

1. [ ] Personality profiles load and save correctly
2. [ ] Agent-to-personality resolution works
3. [ ] Text transformation applies personality
4. [ ] SSML generation produces valid markup
5. [ ] Presets cover common personality types
6. [ ] Integration with voice hook works

---

## Deliverables

```
plugins/voice/specs/08-voice-personality/
├── SPEC.md
├── src/
│   ├── types.ts
│   ├── presets.ts
│   ├── personality-manager.ts
│   ├── text-transformer.ts
│   ├── ssml-generator.ts
│   └── index.ts
├── profiles/
│   ├── opus.json
│   ├── sonnet.json
│   ├── haiku.json
│   └── agents/
│       ├── archivist.json
│       ├── mentor.json
│       └── explorer.json
├── tests/
│   ├── personality-manager.test.ts
│   ├── text-transformer.test.ts
│   └── ssml-generator.test.ts
└── README.md
```
