/**
 * Audio Buffer Port
 *
 * Interface for low-level audio buffer management with fine-grained control
 * over playback and recording. Designed to solve first-syllable clipping
 * and enable multi-stream audio with ducking.
 *
 * @see specs/10-audio-buffer-manager/SPEC.md
 */

/**
 * Audio configuration options.
 */
export interface AudioConfig {
  /** Audio backend: "auto", "pipewire", "pulseaudio", or "subprocess" */
  backend?: "auto" | "pipewire" | "pulseaudio" | "subprocess";
  /** Sample rate in Hz (default: 48000) */
  sampleRate?: number;
  /** Buffer size in milliseconds for latency (default: 20) */
  bufferSizeMs?: number;
  /** Prebuffer size in milliseconds before playback starts (default: 50) */
  prebufferMs?: number;
  /** Number of channels (default: 1 for mono) */
  channels?: number;
  /** Audio format (default: "f32le") */
  format?: AudioFormat;
}

/**
 * Stream configuration options.
 */
export interface PlaybackOptions {
  /** Stream name for identification in mixer */
  name?: string;
  /** Sample rate override */
  sampleRate?: number;
  /** Channel count override */
  channels?: number;
  /** Audio format override */
  format?: AudioFormat;
  /** Buffer size override */
  bufferSizeMs?: number;
  /** Prebuffer size override - fills before playback starts */
  prebufferMs?: number;
  /** Target audio device ID */
  device?: string;
  /** Stream priority (0-100, higher = more important) */
  priority?: number;
}

/**
 * Recording stream configuration.
 */
export interface RecordingOptions {
  /** Stream name for identification */
  name?: string;
  /** Sample rate (default: 16000 for STT) */
  sampleRate?: number;
  /** Channel count (default: 1) */
  channels?: number;
  /** Audio format (default: "f32le") */
  format?: AudioFormat;
  /** Buffer size for latency */
  bufferSizeMs?: number;
  /** Source device ID */
  device?: string;
}

/**
 * Audio device information.
 */
export interface AudioDevice {
  /** Device identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Whether this is the system default */
  isDefault: boolean;
  /** Native sample rate */
  sampleRate: number;
  /** Number of channels */
  channels: number;
}

/**
 * Audio latency metrics.
 */
export interface AudioLatency {
  /** Output latency in milliseconds */
  outputMs: number;
  /** Input latency in milliseconds */
  inputMs: number;
  /** Round-trip latency */
  roundTripMs: number;
}

/**
 * Buffer health metrics.
 */
export interface BufferHealth {
  /** Playback buffer fill level in milliseconds */
  playbackBufferMs: number;
  /** Playback buffer fill percentage (0-100) */
  playbackBufferPercent: number;
  /** Recording buffer fill level in milliseconds */
  recordingBufferMs: number;
  /** Recording buffer fill percentage (0-100) */
  recordingBufferPercent: number;
  /** Number of buffer underruns */
  underruns: number;
  /** Number of buffer overruns */
  overruns: number;
}

/**
 * Stream health metrics.
 */
export interface StreamHealth {
  /** Buffer fill level (0.0 - 1.0) */
  fillLevel: number;
  /** Number of underrun events */
  underrunCount: number;
  /** Number of overrun events */
  overrunCount: number;
  /** Estimated latency in milliseconds */
  latencyMs: number;
  /** Current stream state */
  state: StreamState;
}

/**
 * Stream lifecycle state.
 */
export type StreamState =
  | "idle"
  | "prebuffering"
  | "running"
  | "paused"
  | "draining"
  | "stopped"
  | "error";

/**
 * Audio format specification.
 */
export type AudioFormat = "s16le" | "s32le" | "f32le" | "f64le";

/**
 * Stream event types.
 */
export type StreamEvent =
  | "started"
  | "stopped"
  | "paused"
  | "resumed"
  | "underrun"
  | "overrun"
  | "drained"
  | "error";

/**
 * Playback stream interface.
 *
 * Manages audio output to speakers with prebuffering to prevent clipping.
 */
export interface PlaybackStream {
  /** Unique stream identifier */
  readonly id: string;
  /** Current stream state */
  readonly state: StreamState;

  /**
   * Write audio data to the stream.
   * @param buffer Audio data as Buffer (raw PCM)
   * @returns Number of bytes written
   */
  write(buffer: Buffer): Promise<number>;

  /**
   * Pre-buffer audio data before starting playback.
   * Use this for the first chunk to prevent first-syllable clipping.
   * @param buffer Audio data to prebuffer
   */
  prebuffer(buffer: Buffer): Promise<void>;

  /**
   * Start playback.
   */
  start(): Promise<void>;

  /**
   * Stop playback and clear buffer.
   */
  stop(): Promise<void>;

  /**
   * Pause playback (keeps buffer).
   */
  pause(): Promise<void>;

  /**
   * Resume paused playback.
   */
  resume(): Promise<void>;

  /**
   * Wait for all buffered audio to finish playing.
   */
  drain(): Promise<void>;

  /**
   * Set stream volume (0.0 - 1.0).
   */
  setVolume(volume: number): void;

  /**
   * Get current stream volume.
   */
  getVolume(): number;

  /**
   * Duck other streams (reduce their volume).
   * @param amount Duck amount (0.0 = full duck, 1.0 = no duck)
   */
  duck(amount: number): void;

  /**
   * Restore other streams to normal volume.
   */
  unduck(): void;

  /**
   * Register event listener.
   */
  on(event: StreamEvent, callback: (...args: unknown[]) => void): void;

  /**
   * Remove event listener.
   */
  off(event: StreamEvent, callback: (...args: unknown[]) => void): void;

  /**
   * Get current buffer health metrics.
   */
  getHealth(): StreamHealth;

  /**
   * Close the stream and release resources.
   */
  close(): Promise<void>;
}

/**
 * Recording stream interface.
 *
 * Captures audio from microphone for STT.
 */
export interface RecordingStream {
  /** Unique stream identifier */
  readonly id: string;
  /** Current stream state */
  readonly state: StreamState;

  /**
   * Read audio data from the buffer.
   * @param size Number of bytes to read
   * @returns Audio data
   */
  read(size: number): Promise<Buffer>;

  /**
   * Async iterator for streaming audio chunks.
   */
  [Symbol.asyncIterator](): AsyncIterator<Buffer>;

  /**
   * Start recording.
   */
  start(): Promise<void>;

  /**
   * Stop recording.
   */
  stop(): Promise<void>;

  /**
   * Register event listener.
   */
  on(event: StreamEvent | "data", callback: (...args: unknown[]) => void): void;

  /**
   * Remove event listener.
   */
  off(event: StreamEvent | "data", callback: (...args: unknown[]) => void): void;

  /**
   * Get current buffer health metrics.
   */
  getHealth(): StreamHealth;

  /**
   * Close the stream and release resources.
   */
  close(): Promise<void>;
}

/**
 * Audio Buffer Port Interface.
 *
 * Main interface for audio buffer management. Implementations include:
 * - NativeAudioAdapter: Uses Rust N-API binding for PipeWire (best performance)
 * - SubprocessAudioAdapter: Uses pw-play/paplay subprocess (fallback)
 */
export interface AudioBufferPort {
  /**
   * Get the backend name.
   */
  name(): string;

  /**
   * Check if the backend is available.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize the audio system.
   */
  initialize(config?: AudioConfig): Promise<void>;

  /**
   * Shutdown and release resources.
   */
  shutdown(): Promise<void>;

  // --- Playback ---

  /**
   * Create a new playback stream.
   */
  createPlaybackStream(options?: PlaybackOptions): Promise<PlaybackStream>;

  /**
   * Get the default playback device.
   */
  getDefaultPlaybackDevice(): Promise<AudioDevice>;

  /**
   * List available playback devices.
   */
  listPlaybackDevices(): Promise<AudioDevice[]>;

  // --- Recording ---

  /**
   * Create a new recording stream.
   */
  createRecordingStream(options?: RecordingOptions): Promise<RecordingStream>;

  /**
   * Get the default recording device.
   */
  getDefaultRecordingDevice(): Promise<AudioDevice>;

  /**
   * List available recording devices.
   */
  listRecordingDevices(): Promise<AudioDevice[]>;

  // --- Metrics ---

  /**
   * Get overall audio latency.
   */
  getLatency(): AudioLatency;

  /**
   * Get aggregate buffer health across all streams.
   */
  getBufferHealth(): BufferHealth;
}

/**
 * Default audio configuration.
 */
export const DEFAULT_AUDIO_CONFIG: Required<AudioConfig> = {
  backend: "auto",
  sampleRate: 48000,
  bufferSizeMs: 20,
  prebufferMs: 50,
  channels: 1,
  format: "f32le",
};

/**
 * Default playback options.
 */
export const DEFAULT_PLAYBACK_OPTIONS: Required<PlaybackOptions> = {
  name: "claude-voice",
  sampleRate: 48000,
  channels: 1,
  format: "f32le",
  bufferSizeMs: 20,
  prebufferMs: 50,
  device: "",
  priority: 50,
};

/**
 * Default recording options.
 */
export const DEFAULT_RECORDING_OPTIONS: Required<RecordingOptions> = {
  name: "claude-stt",
  sampleRate: 16000,
  channels: 1,
  format: "f32le",
  bufferSizeMs: 20,
  device: "",
};
