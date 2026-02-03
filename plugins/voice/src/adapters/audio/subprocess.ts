/**
 * Subprocess Audio Adapter
 *
 * Fallback audio implementation using system commands (pw-play, paplay).
 * Used when native Rust binding is not available.
 *
 * While slightly higher latency than native (~30-50ms overhead),
 * it still provides prebuffering to prevent first-syllable clipping.
 */

import { spawn, ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";
import { randomUUID } from "crypto";
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
  StreamEvent,
  StreamHealth,
  StreamState,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_PLAYBACK_OPTIONS,
  DEFAULT_RECORDING_OPTIONS,
} from "../../ports/audio-buffer.js";

/**
 * Subprocess-based playback stream.
 */
class SubprocessPlaybackStream extends EventEmitter implements PlaybackStream {
  readonly id: string;
  private _state: StreamState = "idle";
  private process: ChildProcess | null = null;
  private prebufferChunks: Buffer[] = [];
  private prebufferTargetBytes: number;
  private bytesPerMs: number;
  private _volume: number = 1.0;
  private config: Required<PlaybackOptions>;
  private healthMetrics = {
    underrunCount: 0,
    overrunCount: 0,
    fillLevel: 0,
  };

  constructor(config: Required<PlaybackOptions>) {
    super();
    this.id = randomUUID();
    this.config = config;

    // Calculate bytes per millisecond
    const bytesPerSample = config.format === "f32le" ? 4 : 2;
    this.bytesPerMs = (config.sampleRate * config.channels * bytesPerSample) / 1000;
    this.prebufferTargetBytes = this.bytesPerMs * config.prebufferMs;
  }

  get state(): StreamState {
    return this._state;
  }

  async write(buffer: Buffer): Promise<number> {
    if (this._state === "prebuffering") {
      this.prebufferChunks.push(buffer);
      const totalBytes = this.prebufferChunks.reduce((sum, b) => sum + b.length, 0);
      this.healthMetrics.fillLevel = Math.min(1.0, totalBytes / this.prebufferTargetBytes);

      if (totalBytes >= this.prebufferTargetBytes) {
        await this.flushPrebuffer();
      }

      return buffer.length;
    }

    if (!this.process || !this.process.stdin) {
      throw new Error("Stream not started");
    }

    return new Promise((resolve, reject) => {
      this.process!.stdin!.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer.length);
        }
      });
    });
  }

  async prebuffer(buffer: Buffer): Promise<void> {
    if (this._state === "idle") {
      this._state = "prebuffering";
    }
    await this.write(buffer);
  }

  private async flushPrebuffer(): Promise<void> {
    await this.startProcess();

    // Write all prebuffered chunks
    for (const chunk of this.prebufferChunks) {
      if (this.process?.stdin) {
        this.process.stdin.write(chunk);
      }
    }
    this.prebufferChunks = [];
    this._state = "running";
    this.emit("started");
  }

  private async startProcess(): Promise<void> {
    const format = this.config.format === "f32le" ? "f32" : "s16";

    // Try players in order of preference
    const players = [
      {
        cmd: "pw-play",
        args: [
          "--rate", this.config.sampleRate.toString(),
          "--channels", this.config.channels.toString(),
          "--format", format,
          "--volume", this._volume.toString(),
          "--media-name", this.config.name,
          "-",  // Read from stdin
        ],
      },
      {
        cmd: "paplay",
        args: [
          "--rate", this.config.sampleRate.toString(),
          "--channels", this.config.channels.toString(),
          "--format", this.config.format === "f32le" ? "float32le" : "s16le",
          "--raw",
          "--volume", Math.floor(this._volume * 65536).toString(),
          "-",
        ],
      },
    ];

    for (const player of players) {
      try {
        // Check if command exists
        execSync(`which ${player.cmd}`, { stdio: "ignore" });

        this.process = spawn(player.cmd, player.args, {
          stdio: ["pipe", "ignore", "pipe"],
        });

        this.process.on("close", (code) => {
          this._state = "stopped";
          this.emit("stopped");
          if (code !== 0 && code !== null) {
            this.emit("error", new Error(`Player exited with code ${code}`));
          }
        });

        this.process.on("error", (err) => {
          this.emit("error", err);
        });

        this.process.stderr?.on("data", (data) => {
          const msg = data.toString();
          if (msg.includes("underrun")) {
            this.healthMetrics.underrunCount++;
            this.emit("underrun");
          }
        });

        return;  // Success
      } catch {
        continue;  // Try next player
      }
    }

    throw new Error("No audio player available (tried pw-play, paplay)");
  }

  async start(): Promise<void> {
    if (this._state === "idle") {
      this._state = "prebuffering";
    } else if (this._state === "prebuffering" && this.prebufferChunks.length > 0) {
      await this.flushPrebuffer();
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this._state = "stopped";
    this.prebufferChunks = [];
    this.emit("stopped");
  }

  async pause(): Promise<void> {
    if (this._state === "running") {
      // Send SIGSTOP to pause (Unix only)
      if (this.process && this.process.pid) {
        try {
          process.kill(this.process.pid, "SIGSTOP");
          this._state = "paused";
          this.emit("paused");
        } catch {
          // Ignore errors
        }
      }
    }
  }

  async resume(): Promise<void> {
    if (this._state === "paused") {
      if (this.process && this.process.pid) {
        try {
          process.kill(this.process.pid, "SIGCONT");
          this._state = "running";
          this.emit("resumed");
        } catch {
          // Ignore errors
        }
      }
    }
  }

  async drain(): Promise<void> {
    this._state = "draining";

    return new Promise((resolve, reject) => {
      if (!this.process) {
        this.emit("drained");
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error("Drain timeout"));
      }, 30000);  // 30 second timeout

      this.process.stdin?.end();
      this.process.on("close", () => {
        clearTimeout(timeout);
        this.emit("drained");
        resolve();
      });
    });
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    // Volume change takes effect on next stream (subprocess limitation)
  }

  getVolume(): number {
    return this._volume;
  }

  duck(_amount: number): void {
    // Ducking not supported in subprocess mode
    // Would need pactl to adjust stream volumes
  }

  unduck(): void {
    // No-op for subprocess
  }

  on(event: StreamEvent, callback: (...args: unknown[]) => void): void {
    super.on(event, callback);
  }

  off(event: StreamEvent, callback: (...args: unknown[]) => void): void {
    super.off(event, callback);
  }

  getHealth(): StreamHealth {
    return {
      fillLevel: this.healthMetrics.fillLevel,
      underrunCount: this.healthMetrics.underrunCount,
      overrunCount: this.healthMetrics.overrunCount,
      latencyMs: this.config.prebufferMs + 30,  // Estimated subprocess overhead
      state: this._state,
    };
  }

  async close(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }
}

/**
 * Subprocess-based recording stream.
 */
class SubprocessRecordingStream extends EventEmitter implements RecordingStream {
  readonly id: string;
  private _state: StreamState = "idle";
  private process: ChildProcess | null = null;
  private config: Required<RecordingOptions>;
  private buffer: Buffer[] = [];
  private healthMetrics = {
    underrunCount: 0,
    overrunCount: 0,
    fillLevel: 0,
  };

  constructor(config: Required<RecordingOptions>) {
    super();
    this.id = randomUUID();
    this.config = config;
  }

  get state(): StreamState {
    return this._state;
  }

  async read(size: number): Promise<Buffer> {
    // Accumulate from buffer until we have enough
    const chunks: Buffer[] = [];
    let accumulated = 0;

    while (accumulated < size && this.buffer.length > 0) {
      const chunk = this.buffer.shift()!;
      chunks.push(chunk);
      accumulated += chunk.length;
    }

    if (chunks.length === 0) {
      return Buffer.alloc(0);
    }

    const result = Buffer.concat(chunks);
    if (result.length > size) {
      // Put excess back
      this.buffer.unshift(result.subarray(size));
      return result.subarray(0, size);
    }

    return result;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Buffer> {
    if (this._state !== "running") {
      await this.start();
    }

    const chunkSize = Math.floor(this.config.sampleRate * 0.1);  // 100ms chunks

    while (this._state === "running") {
      const chunk = await this.read(chunkSize * 4);  // f32 = 4 bytes
      if (chunk.length > 0) {
        yield chunk;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  async start(): Promise<void> {
    const format = this.config.format === "f32le" ? "f32" : "s16";

    const recorders = [
      {
        cmd: "pw-record",
        args: [
          "--rate", this.config.sampleRate.toString(),
          "--channels", this.config.channels.toString(),
          "--format", format,
          "-",  // Output to stdout
        ],
      },
      {
        cmd: "parecord",
        args: [
          "--rate", this.config.sampleRate.toString(),
          "--channels", this.config.channels.toString(),
          "--format", this.config.format === "f32le" ? "float32le" : "s16le",
          "--raw",
          "-",
        ],
      },
    ];

    for (const recorder of recorders) {
      try {
        execSync(`which ${recorder.cmd}`, { stdio: "ignore" });

        this.process = spawn(recorder.cmd, recorder.args, {
          stdio: ["ignore", "pipe", "pipe"],
        });

        this.process.stdout?.on("data", (data: Buffer) => {
          this.buffer.push(data);
          this.emit("data", data);
        });

        this.process.on("close", () => {
          this._state = "stopped";
          this.emit("stopped");
        });

        this.process.on("error", (err) => {
          this.emit("error", err);
        });

        this._state = "running";
        this.emit("started");
        return;
      } catch {
        continue;
      }
    }

    throw new Error("No audio recorder available (tried pw-record, parecord)");
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this._state = "stopped";
    this.emit("stopped");
  }

  on(event: StreamEvent | "data", callback: (...args: unknown[]) => void): void {
    super.on(event, callback);
  }

  off(event: StreamEvent | "data", callback: (...args: unknown[]) => void): void {
    super.off(event, callback);
  }

  getHealth(): StreamHealth {
    return {
      fillLevel: this.healthMetrics.fillLevel,
      underrunCount: this.healthMetrics.underrunCount,
      overrunCount: this.healthMetrics.overrunCount,
      latencyMs: 50,  // Estimated
      state: this._state,
    };
  }

  async close(): Promise<void> {
    await this.stop();
    this.buffer = [];
    this.removeAllListeners();
  }
}

/**
 * Subprocess audio adapter.
 *
 * Provides audio playback and recording using system commands.
 * Used as fallback when native binding is not available.
 */
export class SubprocessAudioAdapter implements AudioBufferPort {
  private config: Required<AudioConfig>;
  private playbackStreams: Map<string, SubprocessPlaybackStream> = new Map();
  private recordingStreams: Map<string, SubprocessRecordingStream> = new Map();
  private initialized = false;
  private metrics = {
    underruns: 0,
    overruns: 0,
  };

  constructor() {
    this.config = {
      backend: "subprocess",
      sampleRate: 48000,
      bufferSizeMs: 20,
      prebufferMs: 50,
      channels: 1,
      format: "f32le",
    };
  }

  name(): string {
    return "subprocess";
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync("which pw-play || which paplay", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async initialize(config?: AudioConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config } as Required<AudioConfig>;
    }
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // Close all streams
    for (const stream of this.playbackStreams.values()) {
      await stream.close();
    }
    for (const stream of this.recordingStreams.values()) {
      await stream.close();
    }

    this.playbackStreams.clear();
    this.recordingStreams.clear();
    this.initialized = false;
  }

  async createPlaybackStream(options?: PlaybackOptions): Promise<PlaybackStream> {
    if (!this.initialized) {
      throw new Error("Adapter not initialized");
    }

    const config: Required<PlaybackOptions> = {
      name: options?.name ?? "claude-voice",
      sampleRate: options?.sampleRate ?? this.config.sampleRate,
      channels: options?.channels ?? this.config.channels,
      format: options?.format ?? this.config.format,
      bufferSizeMs: options?.bufferSizeMs ?? this.config.bufferSizeMs,
      prebufferMs: options?.prebufferMs ?? this.config.prebufferMs,
      device: options?.device ?? "",
      priority: options?.priority ?? 50,
    };

    const stream = new SubprocessPlaybackStream(config);
    this.playbackStreams.set(stream.id, stream);

    stream.on("underrun", () => this.metrics.underruns++);
    stream.on("stopped", () => this.playbackStreams.delete(stream.id));

    return stream;
  }

  async getDefaultPlaybackDevice(): Promise<AudioDevice> {
    return {
      id: "@DEFAULT_SINK@",
      name: "Default",
      description: "System default output",
      isDefault: true,
      sampleRate: this.config.sampleRate,
      channels: 2,
    };
  }

  async listPlaybackDevices(): Promise<AudioDevice[]> {
    return [await this.getDefaultPlaybackDevice()];
  }

  async createRecordingStream(options?: RecordingOptions): Promise<RecordingStream> {
    if (!this.initialized) {
      throw new Error("Adapter not initialized");
    }

    const config: Required<RecordingOptions> = {
      name: options?.name ?? "claude-stt",
      sampleRate: options?.sampleRate ?? 16000,
      channels: options?.channels ?? 1,
      format: options?.format ?? this.config.format,
      bufferSizeMs: options?.bufferSizeMs ?? this.config.bufferSizeMs,
      device: options?.device ?? "",
    };

    const stream = new SubprocessRecordingStream(config);
    this.recordingStreams.set(stream.id, stream);

    stream.on("stopped", () => this.recordingStreams.delete(stream.id));

    return stream;
  }

  async getDefaultRecordingDevice(): Promise<AudioDevice> {
    return {
      id: "@DEFAULT_SOURCE@",
      name: "Default",
      description: "System default input",
      isDefault: true,
      sampleRate: 16000,
      channels: 1,
    };
  }

  async listRecordingDevices(): Promise<AudioDevice[]> {
    return [await this.getDefaultRecordingDevice()];
  }

  getLatency(): AudioLatency {
    return {
      outputMs: this.config.prebufferMs + 30,  // Subprocess overhead
      inputMs: 50,
      roundTripMs: this.config.prebufferMs + 80,
    };
  }

  getBufferHealth(): BufferHealth {
    let totalPlaybackMs = 0;
    let totalPlaybackPercent = 0;
    let playbackCount = 0;

    for (const stream of this.playbackStreams.values()) {
      const health = stream.getHealth();
      totalPlaybackMs += health.latencyMs;
      totalPlaybackPercent += health.fillLevel * 100;
      playbackCount++;
    }

    return {
      playbackBufferMs: playbackCount > 0 ? totalPlaybackMs / playbackCount : 0,
      playbackBufferPercent: playbackCount > 0 ? totalPlaybackPercent / playbackCount : 0,
      recordingBufferMs: 0,
      recordingBufferPercent: 0,
      underruns: this.metrics.underruns,
      overruns: this.metrics.overruns,
    };
  }
}

/**
 * Create subprocess audio adapter.
 */
export function createSubprocessAudio(): SubprocessAudioAdapter {
  return new SubprocessAudioAdapter();
}
