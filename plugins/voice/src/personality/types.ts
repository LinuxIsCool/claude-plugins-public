/**
 * Voice Personality Types
 *
 * Defines personality profiles that control text transformation
 * before TTS synthesis. Separate from voice identity (VoiceConfig).
 */

/**
 * Emotional tone types
 */
export type EmotionType =
  | "neutral"
  | "happy"
  | "calm"
  | "serious"
  | "enthusiastic"
  | "concerned"
  | "thoughtful";

/**
 * Voice personality profile
 *
 * Controls how text is transformed before TTS synthesis.
 * Stored separately from voice identity (VoiceConfig).
 */
export interface VoicePersonality {
  // Identity
  id: string;
  name: string;
  agentId?: string; // Linked agent (optional)
  description?: string;

  // Speaking Style (hints for TTS settings)
  style: {
    speed: number; // 0.5-2.0, default 1.0
    pitch: number; // -20 to +20 semitones, default 0
    volume: number; // 0.0-1.0, default 1.0
    variability: number; // 0.0-1.0, prosody variation
  };

  // TTS Backend Settings (ElevenLabs-specific)
  ttsSettings: {
    stability?: number; // 0.0-1.0
    similarityBoost?: number; // 0.0-1.0
    styleExaggeration?: number; // 0.0-1.0
  };

  // Text Transformations
  textTransforms: {
    addGreeting: boolean; // Prepend greeting phrases
    addFillers: boolean; // Add conversational fillers
    maxSentences?: number; // Truncate long responses
    codeVerbosity: "minimal" | "moderate" | "verbose";
  };

  // Emotional Defaults
  emotion: {
    default: EmotionType;
    greetingEmotion: EmotionType;
    errorEmotion: EmotionType;
    successEmotion: EmotionType;
  };
}

/**
 * Personality preset template
 */
export interface PersonalityPreset {
  name: string;
  description: string;
  personality: Partial<VoicePersonality>;
}

/**
 * Context for text transformation
 */
export interface TransformContext {
  emotion?: EmotionType;
  isGreeting?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  eventType?: string; // "SessionStart", "Stop", "Notification", "SubagentStop"
}

/**
 * Default personality values
 */
export const DEFAULT_PERSONALITY: VoicePersonality = {
  id: "default",
  name: "Professional",
  style: {
    speed: 1.0,
    pitch: 0,
    volume: 1.0,
    variability: 0.3,
  },
  ttsSettings: {},
  textTransforms: {
    addGreeting: false,
    addFillers: false,
    codeVerbosity: "minimal",
  },
  emotion: {
    default: "neutral",
    greetingEmotion: "neutral",
    errorEmotion: "concerned",
    successEmotion: "neutral",
  },
};
