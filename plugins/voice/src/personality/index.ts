/**
 * Voice Personality System
 *
 * Provides personality-aware text transformation for TTS.
 */

// Types
export type {
  VoicePersonality,
  PersonalityPreset,
  EmotionType,
  TransformContext,
} from "./types.js";

export { DEFAULT_PERSONALITY } from "./types.js";

// Presets
export {
  PERSONALITY_PRESETS,
  GREETINGS,
  FILLERS,
  getRandomPhrase,
} from "./presets.js";

// Manager
export {
  PersonalityManager,
  getPersonalityManager,
} from "./manager.js";

// Transformer
export {
  TextTransformer,
  createTransformer,
  transformText,
} from "./transformer.js";
