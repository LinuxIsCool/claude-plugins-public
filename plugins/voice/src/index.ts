/**
 * Voice Plugin - Main Entry Point
 *
 * Provides voice input/output capabilities for the Claude Code ecosystem.
 */

// Port interfaces
export type {
  TTSPort,
  TTSCapabilities,
  TTSOptions,
  TTSResult,
  VoiceInfo,
  TTSBackendFactory,
} from "./ports/tts.js";

export type {
  STTPort,
  STTCapabilities,
  STTOptions,
  STTResult,
  AudioInput,
  AudioChunk,
  TranscriptSegment,
  StreamingSTTEvent,
  STTProgressCallback,
  STTBackendFactory,
} from "./ports/stt.js";

export type {
  VADPort,
  VADCapabilities,
  VADOptions,
  VADResult,
  SpeechSegment,
  VADStreamEvent,
  VADBackendFactory,
} from "./ports/vad.js";

// TTS adapters
export {
  TTSFactory,
  createTTSFactory,
  getDefaultTTSFactory,
  speak,
  speakAndPlay,
  ElevenLabsAdapter,
  createElevenLabsAdapter,
  Pyttsx3Adapter,
  createPyttsx3Adapter,
} from "./adapters/tts/index.js";

// STT adapters
export {
  STTFactory,
  createSTTFactory,
  getDefaultSTTFactory,
  transcribe,
  transcribeStream,
  WhisperAdapter,
  createWhisperAdapter,
} from "./adapters/stt/index.js";

export type { WhisperConfig } from "./adapters/stt/index.js";

// Voice identity
export {
  resolveVoiceForSession,
  resolveVoiceForAgent,
  setSessionVoiceOverride,
  normalizeVoiceSettings,
  clampVoiceSetting,
  getSystemDefaultVoice,
  MODEL_VOICE_DEFAULTS,
  AGENT_VOICE_DEFAULTS,
  SYSTEM_DEFAULT_VOICE,
} from "./identity/resolver.js";

export type {
  VoiceConfig,
  ResolvedVoice,
} from "./identity/resolver.js";

// Re-export default options
export { DEFAULT_TTS_OPTIONS } from "./ports/tts.js";
export { DEFAULT_STT_OPTIONS } from "./ports/stt.js";
export { DEFAULT_VAD_OPTIONS } from "./ports/vad.js";

// Voice personality system
export type {
  VoicePersonality,
  PersonalityPreset,
  EmotionType,
  TransformContext,
} from "./personality/index.js";

export {
  DEFAULT_PERSONALITY,
  PERSONALITY_PRESETS,
  GREETINGS,
  FILLERS,
  getRandomPhrase,
  PersonalityManager,
  getPersonalityManager,
  TextTransformer,
  createTransformer,
  transformText,
} from "./personality/index.js";

// Tmux control port
export type {
  TmuxControlPort,
  TmuxControlCapabilities,
  TmuxControlFactory,
  TmuxSession,
  TmuxWindow,
  TmuxPane,
  Direction,
  SplitDirection,
} from "./ports/tmux.js";

// Tmux control adapters
export {
  TmuxControlAdapter,
  createTmuxControl,
  TmuxVoiceHandler,
  createTmuxHandler,
  createTmuxTranscriptHandler,
  isTmuxAvailable,
  parseIntent,
  TMUX_COMMANDS,
  ORDINALS,
  DIRECTIONS,
  SPLIT_DIRECTIONS,
} from "./adapters/tmux/index.js";

export type {
  TmuxControlConfig,
  TmuxHandlerConfig,
  HandlerResult,
  TmuxVoiceCommand,
  TmuxIntent,
  ParsedIntent,
} from "./adapters/tmux/index.js";
