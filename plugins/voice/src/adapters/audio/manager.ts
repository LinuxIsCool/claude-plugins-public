/**
 * Audio Buffer Manager
 *
 * High-level orchestrator for audio playback and recording.
 * Handles:
 * - Backend selection (native vs subprocess)
 * - Multiple concurrent streams
 * - Audio ducking coordination
 * - Metrics aggregation
 */

import { EventEmitter } from "events";
import type {
  AudioBufferPort,
  AudioConfig,
  AudioDevice,
  AudioLatency,
  BufferHealth,
  PlaybackOptions,
  PlaybackStream,
  RecordingOptions,
  RecordingStream,
  StreamHealth,
} from "../../ports/audio-buffer.js";
import { SubprocessAudioAdapter, createSubprocessAudio } from "./subprocess.js";

/**
 * Ducking strategy type.
 */
export type DuckingStrategy = "simple" | "fade" | "proportional" | "none";

/**
 * Managed stream with priority.
 */
interface ManagedStream {
  stream: PlaybackStream;
  priority: number;
  ducked: boolean;
}

/**
 * Ducking coordinator.
 *
 * Manages volume relationships between concurrent streams.
 */
class DuckingCoordinator {
  private streams: Map<string, ManagedStream> = new Map();
  private strategy: DuckingStrategy = "simple";
  private duckLevel = 0.3;  // Default: duck to 30% volume

  setStrategy(strategy: DuckingStrategy, duckLevel?: number): void {
    this.strategy = strategy;
    if (duckLevel !== undefined) {
      this.duckLevel = Math.max(0, Math.min(1, duckLevel));
    }
  }

  addStream(stream: PlaybackStream, priority: number): void {
    this.streams.set(stream.id, {
      stream,
      priority,
      ducked: false,
    });
    this.recalculateVolumes();
  }

  removeStream(streamId: string): void {
    this.streams.delete(streamId);
    this.recalculateVolumes();
  }

  updatePriority(streamId: string, priority: number): void {
    const managed = this.streams.get(streamId);
    if (managed) {
      managed.priority = priority;
      this.recalculateVolumes();
    }
  }

  private recalculateVolumes(): void {
    if (this.strategy === "none" || this.streams.size === 0) {
      return;
    }

    // Find highest priority
    let maxPriority = 0;
    for (const managed of this.streams.values()) {
      maxPriority = Math.max(maxPriority, managed.priority);
    }

    // Apply ducking based on strategy
    for (const managed of this.streams.values()) {
      const isHighest = managed.priority === maxPriority;

      switch (this.strategy) {
        case "simple":
          // Binary: full volume or ducked
          if (isHighest) {
            if (managed.ducked) {
              managed.stream.setVolume(1.0);
              managed.ducked = false;
            }
          } else if (!managed.ducked) {
            managed.stream.setVolume(this.duckLevel);
            managed.ducked = true;
          }
          break;

        case "proportional":
          // Proportional to priority
          const normalized = managed.priority / 100;
          const volume = this.duckLevel + normalized * (1 - this.duckLevel);
          managed.stream.setVolume(volume);
          break;

        case "fade":
          // Same as simple but would use smooth transitions
          // (Not implemented in subprocess adapter)
          if (isHighest) {
            managed.stream.setVolume(1.0);
          } else {
            managed.stream.setVolume(this.duckLevel);
          }
          break;
      }
    }
  }
}

/**
 * Audio Buffer Manager options.
 */
export interface AudioBufferManagerOptions {
  /** Preferred backend: "auto", "native", or "subprocess" */
  backend?: "auto" | "native" | "subprocess";
  /** Ducking strategy */
  duckingStrategy?: DuckingStrategy;
  /** Duck level (0.0 - 1.0) */
  duckLevel?: number;
  /** Audio configuration */
  audioConfig?: AudioConfig;
}

/**
 * Audio Buffer Manager.
 *
 * Main entry point for audio operations. Automatically selects the best
 * available backend and coordinates multiple streams.
 */
export class AudioBufferManager extends EventEmitter {
  private backend: AudioBufferPort | null = null;
  private duckingCoordinator: DuckingCoordinator;
  private playbackStreams: Map<string, PlaybackStream> = new Map();
  private recordingStreams: Map<string, RecordingStream> = new Map();
  private options: AudioBufferManagerOptions;
  private initialized = false;

  constructor(options?: AudioBufferManagerOptions) {
    super();
    this.options = options ?? {};
    this.duckingCoordinator = new DuckingCoordinator();

    if (options?.duckingStrategy) {
      this.duckingCoordinator.setStrategy(
        options.duckingStrategy,
        options.duckLevel
      );
    }
  }

  /**
   * Initialize the audio manager.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const backendPreference = this.options.backend ?? "auto";

    // Try native backend first if available
    if (backendPreference === "auto" || backendPreference === "native") {
      try {
        const native = await this.tryLoadNativeBackend();
        if (native) {
          this.backend = native;
          console.log("[audio-manager] Using native backend");
        }
      } catch (err) {
        console.warn("[audio-manager] Native backend failed:", err);
      }
    }

    // Fall back to subprocess
    if (!this.backend) {
      const subprocess = createSubprocessAudio();
      if (await subprocess.isAvailable()) {
        this.backend = subprocess;
        console.log("[audio-manager] Using subprocess backend");
      } else {
        throw new Error("No audio backend available");
      }
    }

    await this.backend.initialize(this.options.audioConfig);
    this.initialized = true;
  }

  /**
   * Try to load the native Rust backend.
   */
  private async tryLoadNativeBackend(): Promise<AudioBufferPort | null> {
    try {
      // Try to load the native binding
      // Path relative to this module
      const binding = await import(
        "../../../native/audio-buffer-napi/audio-buffer-napi.node"
      ).catch(() => null);

      if (!binding) {
        return null;
      }

      // Create wrapper that implements AudioBufferPort
      return new NativeAudioAdapter(binding);
    } catch {
      return null;
    }
  }

  /**
   * Shutdown and release resources.
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Close all streams
    for (const stream of this.playbackStreams.values()) {
      await stream.close();
    }
    for (const stream of this.recordingStreams.values()) {
      await stream.close();
    }

    this.playbackStreams.clear();
    this.recordingStreams.clear();

    if (this.backend) {
      await this.backend.shutdown();
      this.backend = null;
    }

    this.initialized = false;
  }

  /**
   * Get the current backend name.
   */
  getBackendName(): string {
    return this.backend?.name() ?? "none";
  }

  /**
   * Create a new playback stream.
   */
  async createPlaybackStream(options?: PlaybackOptions): Promise<PlaybackStream> {
    if (!this.backend) {
      await this.initialize();
    }

    const stream = await this.backend!.createPlaybackStream(options);
    this.playbackStreams.set(stream.id, stream);

    // Add to ducking coordinator
    const priority = options?.priority ?? 50;
    this.duckingCoordinator.addStream(stream, priority);

    // Track stream lifecycle
    stream.on("stopped", () => {
      this.playbackStreams.delete(stream.id);
      this.duckingCoordinator.removeStream(stream.id);
    });

    return stream;
  }

  /**
   * Create a new recording stream.
   */
  async createRecordingStream(options?: RecordingOptions): Promise<RecordingStream> {
    if (!this.backend) {
      await this.initialize();
    }

    const stream = await this.backend!.createRecordingStream(options);
    this.recordingStreams.set(stream.id, stream);

    stream.on("stopped", () => {
      this.recordingStreams.delete(stream.id);
    });

    return stream;
  }

  /**
   * Set ducking strategy.
   */
  setDuckingStrategy(strategy: DuckingStrategy, duckLevel?: number): void {
    this.duckingCoordinator.setStrategy(strategy, duckLevel);
  }

  /**
   * List playback devices.
   */
  async listPlaybackDevices(): Promise<AudioDevice[]> {
    if (!this.backend) {
      await this.initialize();
    }
    return this.backend!.listPlaybackDevices();
  }

  /**
   * List recording devices.
   */
  async listRecordingDevices(): Promise<AudioDevice[]> {
    if (!this.backend) {
      await this.initialize();
    }
    return this.backend!.listRecordingDevices();
  }

  /**
   * Get audio latency.
   */
  getLatency(): AudioLatency {
    return this.backend?.getLatency() ?? {
      outputMs: 0,
      inputMs: 0,
      roundTripMs: 0,
    };
  }

  /**
   * Get buffer health.
   */
  getBufferHealth(): BufferHealth {
    return this.backend?.getBufferHealth() ?? {
      playbackBufferMs: 0,
      playbackBufferPercent: 0,
      recordingBufferMs: 0,
      recordingBufferPercent: 0,
      underruns: 0,
      overruns: 0,
    };
  }

  /**
   * Get number of active playback streams.
   */
  get activePlaybackCount(): number {
    return this.playbackStreams.size;
  }

  /**
   * Get number of active recording streams.
   */
  get activeRecordingCount(): number {
    return this.recordingStreams.size;
  }
}

/**
 * Native backend adapter wrapper.
 *
 * Wraps the Rust N-API binding to implement AudioBufferPort.
 */
class NativeAudioAdapter implements AudioBufferPort {
  private binding: any;
  private manager: any;

  constructor(binding: any) {
    this.binding = binding;
  }

  name(): string {
    return this.manager?.getBackendName() ?? "native";
  }

  async isAvailable(): Promise<boolean> {
    return this.binding?.AudioManager !== undefined;
  }

  async initialize(config?: AudioConfig): Promise<void> {
    this.manager = new this.binding.AudioManager();
    await this.manager.initialize(config?.backend ?? "auto");
  }

  async shutdown(): Promise<void> {
    if (this.manager) {
      await this.manager.shutdown();
      this.manager = null;
    }
  }

  async createPlaybackStream(options?: PlaybackOptions): Promise<PlaybackStream> {
    const handle = await this.manager.createStream({
      sampleRate: options?.sampleRate,
      channels: options?.channels,
      format: options?.format,
      bufferSizeMs: options?.bufferSizeMs,
      prebufferMs: options?.prebufferMs,
      name: options?.name,
      direction: "playback",
    });

    return new NativePlaybackStream(this.manager, handle, options);
  }

  async createRecordingStream(options?: RecordingOptions): Promise<RecordingStream> {
    const handle = await this.manager.createStream({
      sampleRate: options?.sampleRate ?? 16000,
      channels: options?.channels ?? 1,
      format: options?.format,
      bufferSizeMs: options?.bufferSizeMs,
      name: options?.name,
      direction: "recording",
    });

    return new NativeRecordingStream(this.manager, handle, options);
  }

  async getDefaultPlaybackDevice(): Promise<AudioDevice> {
    return this.manager.defaultPlaybackDevice();
  }

  async listPlaybackDevices(): Promise<AudioDevice[]> {
    return this.manager.listPlaybackDevices();
  }

  async getDefaultRecordingDevice(): Promise<AudioDevice> {
    return this.manager.defaultRecordingDevice();
  }

  async listRecordingDevices(): Promise<AudioDevice[]> {
    return this.manager.listRecordingDevices();
  }

  getLatency(): AudioLatency {
    // Native binding doesn't expose this directly yet
    return { outputMs: 50, inputMs: 50, roundTripMs: 100 };
  }

  getBufferHealth(): BufferHealth {
    // Aggregate from active streams
    return {
      playbackBufferMs: 0,
      playbackBufferPercent: 0,
      recordingBufferMs: 0,
      recordingBufferPercent: 0,
      underruns: 0,
      overruns: 0,
    };
  }
}

/**
 * Native playback stream wrapper.
 */
class NativePlaybackStream extends EventEmitter implements PlaybackStream {
  readonly id: string;
  private manager: any;
  private handle: number;
  private _volume = 1.0;

  constructor(manager: any, handle: number, _options?: PlaybackOptions) {
    super();
    this.manager = manager;
    this.handle = handle;
    this.id = `native-${handle}`;
  }

  get state() {
    try {
      return this.manager.getState(this.handle) as any;
    } catch {
      return "error" as const;
    }
  }

  async write(buffer: Buffer): Promise<number> {
    const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    return this.manager.write(this.handle, samples);
  }

  async prebuffer(buffer: Buffer): Promise<void> {
    await this.write(buffer);
  }

  async start(): Promise<void> {
    await this.manager.start(this.handle);
    this.emit("started");
  }

  async stop(): Promise<void> {
    await this.manager.stop(this.handle);
    this.emit("stopped");
  }

  async pause(): Promise<void> {
    await this.manager.pause(this.handle);
    this.emit("paused");
  }

  async resume(): Promise<void> {
    await this.manager.resume(this.handle);
    this.emit("resumed");
  }

  async drain(): Promise<void> {
    await this.manager.drain(this.handle);
    this.emit("drained");
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    this.manager.setVolume(this.handle, this._volume);
  }

  getVolume(): number {
    return this._volume;
  }

  duck(_amount: number): void {
    // Handled by DuckingCoordinator
  }

  unduck(): void {
    // Handled by DuckingCoordinator
  }

  on(event: any, callback: any): void {
    super.on(event, callback);
  }

  off(event: any, callback: any): void {
    super.off(event, callback);
  }

  getHealth(): StreamHealth {
    const metrics = this.manager.getHealth(this.handle);
    return {
      fillLevel: metrics.fillLevel,
      underrunCount: metrics.underrunCount,
      overrunCount: metrics.overrunCount,
      latencyMs: metrics.latencyMs,
      state: metrics.state,
    };
  }

  async close(): Promise<void> {
    await this.manager.destroyStream(this.handle);
    this.removeAllListeners();
  }
}

/**
 * Native recording stream wrapper.
 */
class NativeRecordingStream extends EventEmitter implements RecordingStream {
  readonly id: string;
  private manager: any;
  private handle: number;

  constructor(manager: any, handle: number, _options?: RecordingOptions) {
    super();
    this.manager = manager;
    this.handle = handle;
    this.id = `native-${handle}`;
  }

  get state() {
    try {
      return this.manager.getState(this.handle) as any;
    } catch {
      return "error" as const;
    }
  }

  async read(size: number): Promise<Buffer> {
    const samples = this.manager.read(this.handle, size / 4);
    return Buffer.from(samples.buffer);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Buffer> {
    await this.start();

    while (this.state === "running") {
      const chunk = await this.read(4096);
      if (chunk.length > 0) {
        yield chunk;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  async start(): Promise<void> {
    await this.manager.start(this.handle);
    this.emit("started");
  }

  async stop(): Promise<void> {
    await this.manager.stop(this.handle);
    this.emit("stopped");
  }

  on(event: any, callback: any): void {
    super.on(event, callback);
  }

  off(event: any, callback: any): void {
    super.off(event, callback);
  }

  getHealth(): StreamHealth {
    const metrics = this.manager.getHealth(this.handle);
    return {
      fillLevel: metrics.fillLevel,
      underrunCount: metrics.underrunCount,
      overrunCount: metrics.overrunCount,
      latencyMs: metrics.latencyMs,
      state: metrics.state,
    };
  }

  async close(): Promise<void> {
    await this.manager.destroyStream(this.handle);
    this.removeAllListeners();
  }
}

// Singleton manager instance
let defaultManager: AudioBufferManager | null = null;

/**
 * Get or create the default audio buffer manager.
 */
export async function getAudioBufferManager(): Promise<AudioBufferManager> {
  if (!defaultManager) {
    defaultManager = new AudioBufferManager();
    await defaultManager.initialize();
  }
  return defaultManager;
}

/**
 * Create a new audio buffer manager with options.
 */
export function createAudioBufferManager(options?: AudioBufferManagerOptions): AudioBufferManager {
  return new AudioBufferManager(options);
}
