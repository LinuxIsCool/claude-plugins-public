/**
 * Text Transformer
 *
 * Applies personality-based text transformations before TTS synthesis.
 * Handles greetings, fillers, sentence truncation, and code verbosity.
 */

import type { VoicePersonality, EmotionType, TransformContext } from "./types.js";
import { GREETINGS, FILLERS, getRandomPhrase } from "./presets.js";

/**
 * Text Transformer
 *
 * Transforms text according to a voice personality profile.
 * All transformations are pure functions - no side effects.
 */
/** Regex for splitting text into sentences */
const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;

export class TextTransformer {
  private personality: VoicePersonality;

  constructor(personality: VoicePersonality) {
    this.personality = personality;
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    return text.split(SENTENCE_SPLIT_REGEX);
  }

  /**
   * Transform text according to personality settings
   */
  transform(text: string, context?: TransformContext): string {
    if (!text) return "";

    try {
      let result = text;

      // 1. Truncate sentences if configured
      if (this.personality.textTransforms.maxSentences) {
        result = this.truncateSentences(
          result,
          this.personality.textTransforms.maxSentences
        );
      }

      // 2. Handle code blocks based on verbosity
      result = this.adjustCodeVerbosity(result);

      // 3. Add conversational fillers
      if (this.personality.textTransforms.addFillers) {
        result = this.addFillers(result, context?.emotion);
      }

      // 4. Add greeting for greeting context
      if (this.personality.textTransforms.addGreeting && context?.isGreeting) {
        result = this.addGreeting(result, context?.emotion);
      }

      return result;
    } catch (e) {
      // On any error, return original text
      console.error("Text transformation error:", e);
      return text;
    }
  }

  /**
   * Truncate text to maximum number of sentences
   */
  private truncateSentences(text: string, maxSentences: number): string {
    const sentences = this.splitSentences(text);

    if (sentences.length <= maxSentences) {
      return text;
    }

    const truncated = sentences.slice(0, maxSentences).join(" ");
    return truncated + "...";
  }

  /**
   * Add a greeting based on emotion
   */
  private addGreeting(text: string, emotion?: EmotionType): string {
    const em = emotion ?? this.personality.emotion.greetingEmotion;
    const greetings = GREETINGS[em] || GREETINGS.neutral;
    const greeting = getRandomPhrase(greetings);

    if (greeting) {
      return `${greeting} ${text}`;
    }
    return text;
  }

  /**
   * Add conversational fillers to some sentences
   */
  private addFillers(text: string, emotion?: EmotionType): string {
    const em = emotion ?? this.personality.emotion.default;
    const fillers = FILLERS[em] || FILLERS.neutral;

    const sentences = this.splitSentences(text);

    // Add filler to ~20% of sentences (not the first one)
    const result = sentences.map((sentence, i) => {
      if (i > 0 && Math.random() < 0.2) {
        const filler = getRandomPhrase(fillers);
        if (filler) {
          // Capitalize filler, preserve sentence capitalization
          const capitalFiller = filler.charAt(0).toUpperCase() + filler.slice(1);
          return `${capitalFiller}, ${sentence}`;
        }
      }
      return sentence;
    });

    return result.join(" ");
  }

  /**
   * Adjust code block handling based on verbosity setting
   */
  private adjustCodeVerbosity(text: string): string {
    const verbosity = this.personality.textTransforms.codeVerbosity;

    switch (verbosity) {
      case "minimal":
        // Replace code blocks with simple indicator
        return text.replace(/```[\s\S]*?```/g, "(code block)");

      case "moderate":
        // Keep language name and first couple lines
        return text.replace(
          /```(\w*)\n([\s\S]*?)```/g,
          (_, lang, code) => {
            const lines = code.trim().split("\n");
            const langStr = lang || "code";
            if (lines.length > 3) {
              const preview = lines.slice(0, 2).join(", ").slice(0, 50);
              return `(${langStr}: ${preview}...)`;
            }
            return `(${langStr}: ${lines.join(", ")})`;
          }
        );

      case "verbose":
        // Keep full code but we could describe it
        // For TTS, we still want to summarize rather than read raw code
        return text.replace(
          /```(\w*)\n([\s\S]*?)```/g,
          (_, lang, code) => {
            const lines = code.trim().split("\n");
            const langStr = lang || "code";
            return `(${langStr} block with ${lines.length} lines)`;
          }
        );

      default:
        return text;
    }
  }

  /**
   * Get the personality being used
   */
  getPersonality(): VoicePersonality {
    return this.personality;
  }
}

/**
 * Create a transformer for a given personality
 */
export function createTransformer(personality: VoicePersonality): TextTransformer {
  return new TextTransformer(personality);
}

/**
 * Transform text with a personality (convenience function)
 */
export function transformText(
  text: string,
  personality: VoicePersonality,
  context?: TransformContext
): string {
  return new TextTransformer(personality).transform(text, context);
}
