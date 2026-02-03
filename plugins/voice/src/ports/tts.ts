/**
 * Text-to-Speech Port
 *
 * Interface for TTS backends. Any TTS service (ElevenLabs, OpenAI, HuggingFace,
 * Piper, pyttsx3, etc.) implements this port.
 */

/**
 * Voice metadata
 */
export interface VoiceInfo {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  language: string;
  languageCode: string;
  previewUrl?: string;
  description?: string;
}

/**
 * Backend capabilities
 */
export interface TTSCapabilities {
  voices: VoiceInfo[];
  streaming: boolean;           // Streaming audio output
  voiceCloning: boolean;        // Custom voice support
  ssml: boolean;                // SSML markup support
  emotions: boolean;            // Emotional expression
  local: boolean;               // Runs locally (no API)
  costPerChar?: number;         // API cost estimate (USD)
  maxTextLength?: number;       // Maximum text length
  supportedFormats: Array<"mp3" | "wav" | "ogg" | "pcm">;
}

/**
 * TTS synthesis options
 */
export interface TTSOptions {
  voiceId: string;
  model?: string;
  speed?: number;               // 0.5 - 2.0 (default 1.0)
  pitch?: number;               // Semitones adjustment
  stability?: number;           // 0.0 - 1.0 (ElevenLabs-style)
  similarityBoost?: number;     // 0.0 - 1.0
  style?: number;               // 0.0 - 1.0
  useSpeakerBoost?: boolean;
  outputFormat?: "mp3" | "wav" | "ogg" | "pcm";
}

/**
 * TTS synthesis result
 */
export interface TTSResult {
  audio: Buffer;
  durationMs: number;
  format: string;
  processingTimeMs: number;
  charCount: number;
}

/**
 * TTS Port Interface
 *
 * All TTS backends implement this interface.
 */
export interface TTSPort {
  /**
   * Get backend name/identifier
   */
  name(): string;

  /**
   * Get backend capabilities
   */
  capabilities(): TTSCapabilities;

  /**
   * Check if backend is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Synthesize speech from text
   *
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Synthesis result with audio buffer
   */
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;

  /**
   * Synthesize speech with streaming output (optional)
   *
   * @param text Text to synthesize
   * @param options Synthesis options
   * @yields Audio chunks
   */
  synthesizeStream?(
    text: string,
    options: TTSOptions
  ): AsyncGenerator<Buffer>;

  /**
   * Play audio through system speakers
   *
   * @param audio Audio buffer to play
   */
  play(audio: Buffer): Promise<void>;

  /**
   * List available voices
   */
  listVoices(): Promise<VoiceInfo[]>;
}

/**
 * Default TTS options
 */
export const DEFAULT_TTS_OPTIONS: Partial<TTSOptions> = {
  speed: 1.0,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0,
  outputFormat: "mp3",
};

/**
 * Factory for creating TTS backends
 */
export interface TTSBackendFactory {
  /**
   * Create a backend by name
   */
  create(name: string, config?: Record<string, unknown>): TTSPort;

  /**
   * List available backends (in priority order)
   */
  list(): string[];

  /**
   * Get first available backend
   */
  getAvailable(): Promise<TTSPort | null>;

  /**
   * Get backend by priority, falling back if unavailable
   */
  getWithFallback(preferred?: string): Promise<TTSPort>;
}
