/**
 * Speech-to-Text Port
 *
 * Interface for STT backends. Any transcription service (Whisper, Deepgram,
 * Vosk, AssemblyAI, etc.) implements this port.
 */

/**
 * Audio input types
 */
export type AudioInput =
  | { type: "file"; path: string }
  | { type: "buffer"; data: Buffer; format: string; sampleRate: number }
  | { type: "url"; url: string }
  | { type: "stream"; stream: AsyncIterable<Buffer> };

/**
 * Audio chunk for streaming
 */
export interface AudioChunk {
  data: Buffer;
  sampleRate: number;
  channels: number;
  timestampMs: number;
}

/**
 * Backend capabilities
 */
export interface STTCapabilities {
  streaming: boolean;           // Real-time transcription
  batch: boolean;               // File-based transcription
  wordTimestamps: boolean;      // Word-level timing
  speakerDiarization: boolean;  // Speaker separation
  languages: string[];          // Supported language codes
  vadIncluded: boolean;         // Built-in VAD
  local: boolean;               // Runs locally (no API)
  costPerMinute?: number;       // API cost estimate (USD)
  maxDurationMs?: number;       // Maximum audio duration
  models: string[];             // Available model variants
  defaultModel: string;
}

/**
 * STT transcription options
 */
export interface STTOptions {
  language?: string;            // Force language (ISO 639-1 code)
  model?: string;               // Specific model to use
  wordTimestamps?: boolean;     // Request word-level timing
  speakerDiarization?: boolean; // Request speaker separation
  beamSize?: number;            // Beam search width
  temperature?: number;         // Sampling temperature
  initialPrompt?: string;       // Context prompt for better accuracy
}

/**
 * Transcription segment
 */
export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  speaker?: string;
  confidence?: number;
  words?: Array<{
    word: string;
    startMs: number;
    endMs: number;
    confidence?: number;
  }>;
}

/**
 * STT transcription result (batch mode)
 */
export interface STTResult {
  text: string;                 // Full transcript text
  segments: TranscriptSegment[];
  language: string;
  languageConfidence?: number;
  durationMs: number;
  processingTimeMs: number;
  model: string;
}

/**
 * Streaming transcription event
 */
export type StreamingSTTEvent =
  | { type: "started"; sessionId: string }
  | { type: "partial"; text: string; isFinal: boolean; timestampMs: number }
  | { type: "final"; segment: TranscriptSegment }
  | { type: "vad"; isSpeech: boolean; timestampMs: number }
  | { type: "speakerChange"; speakerId: string }
  | { type: "languageDetected"; language: string; confidence: number }
  | { type: "error"; error: Error }
  | { type: "completed"; result: STTResult };

/**
 * Progress callback for long transcriptions
 */
export type STTProgressCallback = (progress: {
  percent: number;
  currentTimeMs: number;
  totalTimeMs: number;
  segmentsProcessed: number;
}) => void;

/**
 * STT Port Interface
 *
 * All STT backends implement this interface.
 */
export interface STTPort {
  /**
   * Get backend name/identifier
   */
  name(): string;

  /**
   * Get backend capabilities
   */
  capabilities(): STTCapabilities;

  /**
   * Check if backend is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Transcribe audio (batch mode)
   *
   * @param input Audio source
   * @param options Transcription options
   * @param onProgress Optional progress callback
   * @returns Transcription result
   */
  transcribe(
    input: AudioInput,
    options?: STTOptions,
    onProgress?: STTProgressCallback
  ): Promise<STTResult>;

  /**
   * Transcribe audio (streaming mode)
   *
   * @param input Audio stream
   * @param options Transcription options
   * @yields Streaming events
   */
  transcribeStream?(
    input: AudioInput,
    options?: STTOptions
  ): AsyncGenerator<StreamingSTTEvent>;
}

/**
 * Default STT options
 */
export const DEFAULT_STT_OPTIONS: Partial<STTOptions> = {
  wordTimestamps: false,
  speakerDiarization: false,
  beamSize: 5,
  temperature: 0.0,
};

/**
 * Factory for creating STT backends
 */
export interface STTBackendFactory {
  /**
   * Create a backend by name
   */
  create(name: string, config?: Record<string, unknown>): STTPort;

  /**
   * List available backends
   */
  list(): string[];

  /**
   * Get first available backend
   */
  getAvailable(): Promise<STTPort | null>;

  /**
   * Get streaming backend (if available)
   */
  getStreaming(): Promise<STTPort | null>;

  /**
   * Get batch backend (for high accuracy)
   */
  getBatch(): Promise<STTPort | null>;

  /**
   * Get preferred backend with priority-based fallback
   */
  getWithFallback(preferred?: string): Promise<STTPort>;
}
