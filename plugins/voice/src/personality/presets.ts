/**
 * Voice Personality Presets
 *
 * Built-in personality templates for common agent types.
 * Also includes emotion-to-phrase mappings for text transformation.
 */

import type { PersonalityPreset, EmotionType } from "./types.js";

/**
 * Greeting phrases by emotion type
 */
export const GREETINGS: Record<EmotionType, string[]> = {
  neutral: [""],
  happy: ["Great!", "Wonderful!", ""],
  calm: ["Alright.", "Okay.", ""],
  serious: [""],
  enthusiastic: ["Excellent!", "Oh!", "Wow!", ""],
  concerned: ["Hmm.", "I see.", ""],
  thoughtful: ["Let me think.", "Interesting.", ""],
};

/**
 * Conversational filler phrases by emotion type
 */
export const FILLERS: Record<EmotionType, string[]> = {
  neutral: ["", "so", "well"],
  happy: ["actually", "you know", ""],
  calm: ["", "so"],
  serious: [""],
  enthusiastic: ["oh", "actually", "you know"],
  concerned: ["well", "hmm"],
  thoughtful: ["let's see", "considering this", ""],
};

/**
 * Built-in personality presets
 */
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
      ttsSettings: {
        stability: 0.6,
        similarityBoost: 0.75,
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
      ttsSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        styleExaggeration: 0.2,
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
      ttsSettings: {
        stability: 0.6,
        similarityBoost: 0.75,
        styleExaggeration: 0.2,
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
      ttsSettings: {
        stability: 0.7,
        similarityBoost: 0.8,
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
      ttsSettings: {
        stability: 0.4,
        similarityBoost: 0.75,
        styleExaggeration: 0.3,
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

/**
 * Get a random phrase from an array, preferring non-empty strings
 */
export function getRandomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}
