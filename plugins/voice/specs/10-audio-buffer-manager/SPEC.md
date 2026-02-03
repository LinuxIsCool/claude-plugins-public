# Spec: Audio Buffer Manager

**Component**: Low-Level Audio Infrastructure
**Priority**: High
**Estimated Effort**: 4-5 hours
**Dependencies**: PipeWire/PulseAudio, Node.js native addons

---

## Overview

Implement a low-level audio buffer management system that provides fine-grained control over audio playback and recording. This addresses issues like initial audio clipping, buffer underruns, and latency optimization by working directly with the Linux audio stack (PipeWire/PulseAudio).

## Goals

1. Eliminate first-syllable clipping on TTS playback
2. Provide low-latency audio streaming (<50ms)
3. Support concurrent audio streams with mixing
4. Enable audio ducking for multi-agent scenarios
5. Expose audio metrics (latency, buffer health)

## Non-Goals

- Cross-platform support (Linux-only for v1)
- Audio effects processing (reverb, EQ)
- Multi-channel surround sound
- ASIO/WASAPI Windows support

---

## Architecture

### Audio Stack Layers

```
┌─────────────────────────────────────────┐
│         Voice Plugin (TypeScript)       │
├─────────────────────────────────────────┤
│         Audio Buffer Manager            │
│    - Ring buffers, stream management    │
├─────────────────────────────────────────┤
│           Native Binding Layer          │
│      (N-API addon or subprocess)        │
├─────────────────────────────────────────┤
│          PipeWire / PulseAudio          │
│     - pw-stream / pa_simple API         │
├─────────────────────────────────────────┤
│               ALSA                      │
├─────────────────────────────────────────┤
│           Audio Hardware                │
└─────────────────────────────────────────┘
```

### Interface Design

```typescript
// plugins/voice/src/ports/audio-buffer.ts

export interface AudioBufferPort {
  // Lifecycle
  initialize(config: AudioConfig): Promise<void>;
  shutdown(): Promise<void>;

  // Playback
  createPlaybackStream(options: PlaybackOptions): Promise<PlaybackStream>;
  getDefaultPlaybackDevice(): Promise<AudioDevice>;
  listPlaybackDevices(): Promise<AudioDevice[]>;

  // Recording
  createRecordingStream(options: RecordingOptions): Promise<RecordingStream>;
  getDefaultRecordingDevice(): Promise<AudioDevice>;
  listRecordingDevices(): Promise<AudioDevice[]>;

  // Metrics
  getLatency(): AudioLatency;
  getBufferHealth(): BufferHealth;
}

export interface AudioConfig {
  backend?: "pipewire" | "pulseaudio" | "auto";
  sampleRate?: number;      // Default: 48000
  bufferSizeMs?: number;    // Default: 20
  prebufferMs?: number;     // Default: 50 (for first-syllable fix)
  channels?: number;        // Default: 1 (mono)
  format?: AudioFormat;     // Default: f32le
}

export interface PlaybackStream {
  id: string;
  state: StreamState;

  // Write audio data
  write(buffer: Buffer): Promise<number>;  // Returns bytes written

  // Pre-buffer for gapless playback
  prebuffer(buffer: Buffer): Promise<void>;

  // Control
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  drain(): Promise<void>;  // Wait for all data to play

  // Volume (0.0 - 1.0)
  setVolume(volume: number): void;
  getVolume(): number;

  // Ducking (reduce other streams' volume)
  duck(amount: number): void;
  unduck(): void;

  // Events
  on(event: "started" | "stopped" | "underrun" | "drained", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;

  // Cleanup
  close(): Promise<void>;
}

export interface RecordingStream {
  id: string;
  state: StreamState;

  // Read audio data
  read(size: number): Promise<Buffer>;

  // Async iterator for streaming
  [Symbol.asyncIterator](): AsyncIterator<Buffer>;

  // Control
  start(): Promise<void>;
  stop(): Promise<void>;

  // Events
  on(event: "started" | "stopped" | "overrun", cb: () => void): void;
  on(event: "data", cb: (buffer: Buffer) => void): void;
  on(event: "error", cb: (err: Error) => void): void;

  close(): Promise<void>;
}

export interface PlaybackOptions {
  name?: string;           // Stream name for mixer
  sampleRate?: number;
  channels?: number;
  format?: AudioFormat;
  bufferSizeMs?: number;
  prebufferMs?: number;    // Pre-fill before starting
  device?: string;         // Specific device
  priority?: "low" | "normal" | "high";
}

export interface RecordingOptions {
  name?: string;
  sampleRate?: number;
  channels?: number;
  format?: AudioFormat;
  bufferSizeMs?: number;
  device?: string;
}

export interface AudioDevice {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  sampleRate: number;
  channels: number;
}

export interface AudioLatency {
  outputMs: number;        // Playback latency
  inputMs: number;         // Recording latency
  roundTripMs: number;     // Total
}

export interface BufferHealth {
  playbackBufferMs: number;
  playbackBufferPercent: number;
  recordingBufferMs: number;
  recordingBufferPercent: number;
  underruns: number;
  overruns: number;
}

type StreamState = "idle" | "prebuffering" | "running" | "paused" | "draining" | "stopped";
type AudioFormat = "s16le" | "s32le" | "f32le" | "f64le";
```

---

## Implementation Guide

### Ring Buffer Implementation

```typescript
// plugins/voice/src/core/ring-buffer.ts

/**
 * Lock-free ring buffer for audio streaming.
 * Designed for single-producer, single-consumer scenarios.
 */
export class AudioRingBuffer {
  private buffer: Float32Array;
  private readIndex: number = 0;
  private writeIndex: number = 0;
  private size: number;

  constructor(sizeInSamples: number) {
    // Round up to power of 2 for efficient modulo
    this.size = Math.pow(2, Math.ceil(Math.log2(sizeInSamples)));
    this.buffer = new Float32Array(this.size);
  }

  /**
   * Write samples to buffer.
   * Returns number of samples actually written.
   */
  write(samples: Float32Array): number {
    const available = this.availableWrite();
    const toWrite = Math.min(samples.length, available);

    for (let i = 0; i < toWrite; i++) {
      this.buffer[this.writeIndex & (this.size - 1)] = samples[i];
      this.writeIndex++;
    }

    return toWrite;
  }

  /**
   * Read samples from buffer.
   * Returns number of samples actually read.
   */
  read(output: Float32Array): number {
    const available = this.availableRead();
    const toRead = Math.min(output.length, available);

    for (let i = 0; i < toRead; i++) {
      output[i] = this.buffer[this.readIndex & (this.size - 1)];
      this.readIndex++;
    }

    return toRead;
  }

  /**
   * Peek at samples without consuming them.
   */
  peek(output: Float32Array): number {
    const available = this.availableRead();
    const toRead = Math.min(output.length, available);
    let index = this.readIndex;

    for (let i = 0; i < toRead; i++) {
      output[i] = this.buffer[index & (this.size - 1)];
      index++;
    }

    return toRead;
  }

  availableRead(): number {
    return this.writeIndex - this.readIndex;
  }

  availableWrite(): number {
    return this.size - this.availableRead();
  }

  clear(): void {
    this.readIndex = 0;
    this.writeIndex = 0;
  }

  get capacity(): number {
    return this.size;
  }

  get fillPercent(): number {
    return (this.availableRead() / this.size) * 100;
  }
}
```

### PipeWire Binding (Rust N-API)

```rust
// plugins/voice/native/src/lib.rs

use napi::{bindgen_prelude::*, JsFunction};
use napi_derive::napi;
use pipewire::{
    context::Context,
    main_loop::MainLoop,
    stream::{Stream, StreamFlags},
};
use std::sync::{Arc, Mutex};

#[napi]
pub struct AudioManager {
    main_loop: Arc<MainLoop>,
    context: Arc<Context>,
    streams: Arc<Mutex<Vec<StreamHandle>>>,
}

struct StreamHandle {
    id: String,
    stream: Stream,
    buffer: Arc<Mutex<Vec<f32>>>,
}

#[napi]
impl AudioManager {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        pipewire::init();

        let main_loop = MainLoop::new(None)?;
        let context = Context::new(&main_loop)?;

        Ok(Self {
            main_loop: Arc::new(main_loop),
            context: Arc::new(context),
            streams: Arc::new(Mutex::new(Vec::new())),
        })
    }

    #[napi]
    pub fn create_playback_stream(&self, options: PlaybackOptions) -> Result<String> {
        let props = pipewire::properties! {
            *pipewire::keys::MEDIA_TYPE => "Audio",
            *pipewire::keys::MEDIA_CATEGORY => "Playback",
            *pipewire::keys::MEDIA_ROLE => "Game",
            *pipewire::keys::NODE_NAME => options.name.unwrap_or("voice-plugin".into()),
        };

        let stream = Stream::new(&self.context, &options.name.unwrap_or_default(), props)?;

        let buffer = Arc::new(Mutex::new(Vec::new()));
        let buffer_clone = buffer.clone();

        // Setup stream callbacks
        let _listener = stream.add_local_listener_with_user_data(buffer_clone)
            .process(|stream, buffer| {
                // Callback when PipeWire needs audio data
                if let Some(buf) = stream.dequeue_buffer() {
                    let data = buf.datas_mut().first_mut().unwrap();
                    let samples = data.data().unwrap();

                    // Copy from our buffer to PipeWire buffer
                    let mut user_buffer = buffer.lock().unwrap();
                    let len = std::cmp::min(samples.len() / 4, user_buffer.len());

                    for (i, sample) in user_buffer.drain(..len).enumerate() {
                        let bytes = sample.to_le_bytes();
                        samples[i*4..(i+1)*4].copy_from_slice(&bytes);
                    }

                    // Zero-fill remaining
                    for i in len*4..samples.len() {
                        samples[i] = 0;
                    }
                }
            })
            .register()?;

        let params = [
            pipewire::spa::pod::serialize::PodSerializer::serialize(
                std::io::Cursor::new(Vec::new()),
                &pipewire::spa::pod::Value::Object(pipewire::spa::pod::Object {
                    type_: pipewire::spa::utils::SpaTypes::ObjectParamFormat.as_raw(),
                    id: pipewire::spa::param::ParamType::EnumFormat.as_raw(),
                    properties: vec![
                        pipewire::spa::pod::Property {
                            key: pipewire::spa::format::FormatProperties::MediaType.as_raw(),
                            flags: pipewire::spa::pod::PropertyFlags::empty(),
                            value: pipewire::spa::pod::Value::Id(
                                pipewire::spa::utils::Id(pipewire::spa::format::MediaType::Audio.as_raw())
                            ),
                        },
                        // ... more properties for sample rate, format, channels
                    ],
                }),
            )?.0.into_inner(),
        ];

        stream.connect(
            pipewire::stream::Direction::Output,
            None,
            StreamFlags::AUTOCONNECT | StreamFlags::MAP_BUFFERS,
            &mut params.iter().map(|p| p.as_slice()),
        )?;

        let id = uuid::Uuid::new_v4().to_string();

        self.streams.lock().unwrap().push(StreamHandle {
            id: id.clone(),
            stream,
            buffer,
        });

        Ok(id)
    }

    #[napi]
    pub fn write_audio(&self, stream_id: String, samples: Buffer) -> Result<u32> {
        let streams = self.streams.lock().unwrap();
        let handle = streams.iter().find(|s| s.id == stream_id)
            .ok_or_else(|| napi::Error::from_reason("Stream not found"))?;

        // Convert bytes to f32 samples
        let float_samples: Vec<f32> = samples
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
            .collect();

        let mut buffer = handle.buffer.lock().unwrap();
        let written = float_samples.len() as u32;
        buffer.extend(float_samples);

        Ok(written)
    }

    #[napi]
    pub fn get_buffer_level(&self, stream_id: String) -> Result<u32> {
        let streams = self.streams.lock().unwrap();
        let handle = streams.iter().find(|s| s.id == stream_id)
            .ok_or_else(|| napi::Error::from_reason("Stream not found"))?;

        Ok(handle.buffer.lock().unwrap().len() as u32)
    }

    #[napi]
    pub fn close_stream(&self, stream_id: String) -> Result<()> {
        let mut streams = self.streams.lock().unwrap();
        streams.retain(|s| s.id != stream_id);
        Ok(())
    }
}

#[napi(object)]
pub struct PlaybackOptions {
    pub name: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub buffer_size_ms: Option<u32>,
}
```

### TypeScript Adapter (using native binding)

```typescript
// plugins/voice/src/adapters/audio/pipewire.ts

import { AudioRingBuffer } from "../../core/ring-buffer.js";
import type {
  AudioBufferPort,
  AudioConfig,
  PlaybackStream,
  RecordingStream,
  PlaybackOptions,
  RecordingOptions,
  AudioDevice,
  AudioLatency,
  BufferHealth,
} from "../../ports/audio-buffer.js";

// Try to load native binding, fall back to subprocess
let nativeBinding: any;
try {
  nativeBinding = require("../../native/audio-manager.node");
} catch {
  nativeBinding = null;
}

export class PipeWireAudioAdapter implements AudioBufferPort {
  private config: AudioConfig = {};
  private manager: any;
  private streams: Map<string, PipeWirePlaybackStream> = new Map();
  private metrics = {
    underruns: 0,
    overruns: 0,
  };

  async initialize(config: AudioConfig): Promise<void> {
    this.config = {
      backend: config.backend ?? "auto",
      sampleRate: config.sampleRate ?? 48000,
      bufferSizeMs: config.bufferSizeMs ?? 20,
      prebufferMs: config.prebufferMs ?? 50,
      channels: config.channels ?? 1,
      format: config.format ?? "f32le",
    };

    if (nativeBinding) {
      this.manager = new nativeBinding.AudioManager();
    } else {
      // Fall back to subprocess approach
      console.warn("Native audio binding not available, using subprocess fallback");
    }
  }

  async shutdown(): Promise<void> {
    for (const stream of this.streams.values()) {
      await stream.close();
    }
    this.streams.clear();
  }

  async createPlaybackStream(options: PlaybackOptions): Promise<PlaybackStream> {
    const stream = new PipeWirePlaybackStream(this.manager, {
      ...this.config,
      ...options,
    });
    await stream.initialize();
    this.streams.set(stream.id, stream);
    return stream;
  }

  async getDefaultPlaybackDevice(): Promise<AudioDevice> {
    // Query PipeWire for default sink
    const { execSync } = await import("child_process");
    try {
      const output = execSync("pw-cli info @DEFAULT_SINK@", { encoding: "utf-8" });
      // Parse output...
      return {
        id: "@DEFAULT_SINK@",
        name: "Default",
        description: "System default output",
        isDefault: true,
        sampleRate: this.config.sampleRate!,
        channels: this.config.channels!,
      };
    } catch {
      return {
        id: "default",
        name: "Default",
        description: "System default",
        isDefault: true,
        sampleRate: 48000,
        channels: 2,
      };
    }
  }

  async listPlaybackDevices(): Promise<AudioDevice[]> {
    const { execSync } = await import("child_process");
    try {
      const output = execSync("pw-cli list-objects Node", { encoding: "utf-8" });
      // Parse and filter for audio sinks
      return [await this.getDefaultPlaybackDevice()];
    } catch {
      return [await this.getDefaultPlaybackDevice()];
    }
  }

  async createRecordingStream(options: RecordingOptions): Promise<RecordingStream> {
    // Similar to playback but with input direction
    throw new Error("Not implemented");
  }

  async getDefaultRecordingDevice(): Promise<AudioDevice> {
    return {
      id: "@DEFAULT_SOURCE@",
      name: "Default",
      description: "System default input",
      isDefault: true,
      sampleRate: this.config.sampleRate!,
      channels: 1,
    };
  }

  async listRecordingDevices(): Promise<AudioDevice[]> {
    return [await this.getDefaultRecordingDevice()];
  }

  getLatency(): AudioLatency {
    // Get from PipeWire metrics
    return {
      outputMs: this.config.bufferSizeMs! * 2,
      inputMs: this.config.bufferSizeMs! * 2,
      roundTripMs: this.config.bufferSizeMs! * 4,
    };
  }

  getBufferHealth(): BufferHealth {
    let totalPlaybackMs = 0;
    let totalPlaybackPercent = 0;
    let count = 0;

    for (const stream of this.streams.values()) {
      totalPlaybackMs += stream.getBufferLevelMs();
      totalPlaybackPercent += stream.getBufferFillPercent();
      count++;
    }

    return {
      playbackBufferMs: count > 0 ? totalPlaybackMs / count : 0,
      playbackBufferPercent: count > 0 ? totalPlaybackPercent / count : 0,
      recordingBufferMs: 0,
      recordingBufferPercent: 0,
      underruns: this.metrics.underruns,
      overruns: this.metrics.overruns,
    };
  }
}

class PipeWirePlaybackStream implements PlaybackStream {
  id: string = "";
  state: "idle" | "prebuffering" | "running" | "paused" | "draining" | "stopped" = "idle";

  private buffer: AudioRingBuffer;
  private prebufferSize: number;
  private volume: number = 1.0;
  private events: Map<string, Function[]> = new Map();
  private nativeStreamId?: string;
  private config: PlaybackOptions & AudioConfig;

  constructor(private manager: any, config: PlaybackOptions & AudioConfig) {
    this.config = config;
    const bufferSamples = (config.sampleRate! * (config.bufferSizeMs! + config.prebufferMs!)) / 1000;
    this.buffer = new AudioRingBuffer(bufferSamples * 4); // Extra headroom
    this.prebufferSize = (config.sampleRate! * config.prebufferMs!) / 1000;
    this.id = crypto.randomUUID();
  }

  async initialize(): Promise<void> {
    if (this.manager) {
      this.nativeStreamId = await this.manager.createPlaybackStream({
        name: this.config.name,
        sampleRate: this.config.sampleRate,
        channels: this.config.channels,
        bufferSizeMs: this.config.bufferSizeMs,
      });
    }
  }

  async write(buffer: Buffer): Promise<number> {
    // Convert to Float32Array
    const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    const written = this.buffer.write(samples);

    // If prebuffering, check if we've reached threshold
    if (this.state === "prebuffering" && this.buffer.availableRead() >= this.prebufferSize) {
      await this.start();
    }

    // Forward to native binding if available
    if (this.manager && this.nativeStreamId) {
      this.manager.writeAudio(this.nativeStreamId, buffer);
    }

    return written * 4; // Return bytes
  }

  async prebuffer(buffer: Buffer): Promise<void> {
    this.state = "prebuffering";
    await this.write(buffer);
  }

  async start(): Promise<void> {
    this.state = "running";
    this.emit("started");
  }

  async stop(): Promise<void> {
    this.state = "stopped";
    this.emit("stopped");
  }

  async pause(): Promise<void> {
    this.state = "paused";
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async drain(): Promise<void> {
    this.state = "draining";

    // Wait for buffer to empty
    return new Promise((resolve) => {
      const check = () => {
        if (this.buffer.availableRead() === 0) {
          this.emit("drained");
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  duck(amount: number): void {
    // Reduce volume of other streams
    // Implementation depends on mixer access
  }

  unduck(): void {
    // Restore volume of other streams
  }

  on(event: string, cb: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(cb);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }

  async close(): Promise<void> {
    await this.stop();
    if (this.manager && this.nativeStreamId) {
      this.manager.closeStream(this.nativeStreamId);
    }
  }

  // Helper methods for metrics
  getBufferLevelMs(): number {
    return (this.buffer.availableRead() / this.config.sampleRate!) * 1000;
  }

  getBufferFillPercent(): number {
    return this.buffer.fillPercent;
  }
}

export function createPipeWireAudio(): PipeWireAudioAdapter {
  return new PipeWireAudioAdapter();
}
```

### Subprocess Fallback (for when native binding unavailable)

```typescript
// plugins/voice/src/adapters/audio/subprocess.ts

import { spawn, ChildProcess } from "child_process";
import type { PlaybackStream, PlaybackOptions } from "../../ports/audio-buffer.js";

/**
 * Subprocess-based audio playback using pw-play or paplay.
 * Used as fallback when native binding is not available.
 */
export class SubprocessPlaybackStream implements PlaybackStream {
  id: string = crypto.randomUUID();
  state: "idle" | "prebuffering" | "running" | "paused" | "draining" | "stopped" = "idle";

  private process: ChildProcess | null = null;
  private prebuffer: Buffer[] = [];
  private prebufferTargetMs: number;
  private config: PlaybackOptions;
  private events: Map<string, Function[]> = new Map();

  constructor(config: PlaybackOptions) {
    this.config = config;
    this.prebufferTargetMs = config.prebufferMs ?? 50;
  }

  async write(buffer: Buffer): Promise<number> {
    if (this.state === "prebuffering") {
      this.prebuffer.push(buffer);

      // Calculate buffered duration
      const totalBytes = this.prebuffer.reduce((sum, b) => sum + b.length, 0);
      const sampleRate = this.config.sampleRate ?? 48000;
      const bytesPerSample = 4; // f32le
      const durationMs = (totalBytes / bytesPerSample / sampleRate) * 1000;

      if (durationMs >= this.prebufferTargetMs) {
        await this.flush();
      }

      return buffer.length;
    }

    if (this.process && this.process.stdin) {
      this.process.stdin.write(buffer);
    }

    return buffer.length;
  }

  async prebuffer(buffer: Buffer): Promise<void> {
    this.state = "prebuffering";
    await this.write(buffer);
  }

  private async flush(): Promise<void> {
    // Start process and write all prebuffered data
    await this.startProcess();

    for (const chunk of this.prebuffer) {
      if (this.process?.stdin) {
        this.process.stdin.write(chunk);
      }
    }

    this.prebuffer = [];
    this.state = "running";
    this.emit("started");
  }

  private async startProcess(): Promise<void> {
    const sampleRate = this.config.sampleRate ?? 48000;
    const channels = this.config.channels ?? 1;

    // Try pw-play first, fall back to paplay
    const players = [
      {
        cmd: "pw-play",
        args: [
          "--rate", sampleRate.toString(),
          "--channels", channels.toString(),
          "--format", "f32",
          "-",  // stdin
        ],
      },
      {
        cmd: "paplay",
        args: [
          "--rate", sampleRate.toString(),
          "--channels", channels.toString(),
          "--format", "float32le",
          "--raw",
          "-",
        ],
      },
    ];

    for (const player of players) {
      try {
        this.process = spawn(player.cmd, player.args, {
          stdio: ["pipe", "ignore", "ignore"],
        });

        this.process.on("close", () => {
          this.state = "stopped";
          this.emit("stopped");
        });

        this.process.on("error", (err) => {
          this.emit("error", err);
        });

        return;
      } catch {
        continue;
      }
    }

    throw new Error("No audio player available");
  }

  async start(): Promise<void> {
    if (!this.process) {
      await this.startProcess();
    }
    this.state = "running";
    this.emit("started");
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this.state = "stopped";
    this.emit("stopped");
  }

  async pause(): Promise<void> {
    // Subprocess approach doesn't support pause well
    this.state = "paused";
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async drain(): Promise<void> {
    this.state = "draining";

    if (this.process?.stdin) {
      this.process.stdin.end();
    }

    return new Promise((resolve) => {
      if (this.process) {
        this.process.on("close", () => {
          this.emit("drained");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  setVolume(_volume: number): void {
    // Volume control requires pactl or similar
  }

  getVolume(): number {
    return 1.0;
  }

  duck(_amount: number): void {}
  unduck(): void {}

  on(event: string, cb: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(cb);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(h => h(...args));
    }
  }

  async close(): Promise<void> {
    await this.stop();
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/10-audio-buffer-manager/tests/unit.test.ts

import { AudioRingBuffer } from "../src/ring-buffer.js";

describe("AudioRingBuffer", () => {
  test("write and read samples correctly", () => {
    const buffer = new AudioRingBuffer(1024);
    const input = new Float32Array([0.1, 0.2, 0.3, 0.4]);

    const written = buffer.write(input);
    expect(written).toBe(4);
    expect(buffer.availableRead()).toBe(4);

    const output = new Float32Array(4);
    const read = buffer.read(output);

    expect(read).toBe(4);
    expect(output[0]).toBeCloseTo(0.1);
    expect(output[3]).toBeCloseTo(0.4);
  });

  test("handles buffer wrap-around", () => {
    const buffer = new AudioRingBuffer(8);

    // Fill buffer partially
    const input1 = new Float32Array([1, 2, 3, 4, 5, 6]);
    buffer.write(input1);

    // Read some
    const output1 = new Float32Array(4);
    buffer.read(output1);

    // Write more (causes wrap)
    const input2 = new Float32Array([7, 8, 9, 10]);
    buffer.write(input2);

    // Read all
    const output2 = new Float32Array(6);
    const read = buffer.read(output2);

    expect(read).toBe(6);
    expect(output2[0]).toBe(5);
    expect(output2[5]).toBe(10);
  });

  test("reports fill percentage correctly", () => {
    const buffer = new AudioRingBuffer(100);

    buffer.write(new Float32Array(50));
    expect(buffer.fillPercent).toBeCloseTo(50, 0);

    buffer.write(new Float32Array(50));
    expect(buffer.fillPercent).toBeCloseTo(100, 0);
  });
});
```

### Integration Tests

```typescript
// plugins/voice/specs/10-audio-buffer-manager/tests/integration.test.ts

import { PipeWireAudioAdapter } from "../src/pipewire.js";

describe("PipeWire Audio Integration", () => {
  let adapter: PipeWireAudioAdapter;

  beforeAll(async () => {
    adapter = new PipeWireAudioAdapter();
    await adapter.initialize({
      sampleRate: 48000,
      prebufferMs: 50,
    });
  });

  afterAll(async () => {
    await adapter.shutdown();
  });

  test("lists playback devices", async () => {
    const devices = await adapter.listPlaybackDevices();
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0]).toHaveProperty("id");
    expect(devices[0]).toHaveProperty("name");
  });

  test("creates playback stream", async () => {
    const stream = await adapter.createPlaybackStream({
      name: "test-stream",
    });

    expect(stream.id).toBeDefined();
    expect(stream.state).toBe("idle");

    await stream.close();
  });

  test("prebuffering prevents clipping", async () => {
    const stream = await adapter.createPlaybackStream({
      prebufferMs: 100,
    });

    // Generate test tone
    const sampleRate = 48000;
    const duration = 0.5; // 500ms
    const samples = new Float32Array(sampleRate * duration);

    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate)) * 0.5;
    }

    // Write with prebuffering
    await stream.prebuffer(Buffer.from(samples.buffer));

    // Should be in running state after prebuffer threshold reached
    expect(stream.state).toBe("running");

    await stream.drain();
    await stream.close();
  });
});
```

### Latency Tests

```typescript
// plugins/voice/specs/10-audio-buffer-manager/tests/latency.test.ts

describe("Audio Latency", () => {
  test("measures playback latency", async () => {
    const adapter = new PipeWireAudioAdapter();
    await adapter.initialize({ bufferSizeMs: 20 });

    const latency = adapter.getLatency();

    expect(latency.outputMs).toBeLessThan(100);
    expect(latency.roundTripMs).toBeLessThan(200);

    await adapter.shutdown();
  });

  test("prebuffer fills before playback starts", async () => {
    const adapter = new PipeWireAudioAdapter();
    await adapter.initialize({ prebufferMs: 50 });

    const stream = await adapter.createPlaybackStream({});

    let startedAt: number | null = null;
    stream.on("started", () => {
      startedAt = Date.now();
    });

    const writeStart = Date.now();

    // Write small chunks
    for (let i = 0; i < 10; i++) {
      const chunk = Buffer.alloc(4800); // ~100ms at 48kHz mono f32
      await stream.prebuffer(chunk);
    }

    // Should have started after ~50ms of data buffered
    expect(startedAt).not.toBeNull();
    expect(startedAt! - writeStart).toBeGreaterThan(40);

    await stream.close();
    await adapter.shutdown();
  });
});
```

---

## Success Criteria

1. [ ] No first-syllable clipping on TTS playback
2. [ ] Playback latency <50ms with native binding
3. [ ] Buffer underrun rate <0.1% under normal load
4. [ ] Graceful degradation to subprocess fallback
5. [ ] Works with both PipeWire and PulseAudio
6. [ ] Concurrent streams supported

---

## Deliverables

```
plugins/voice/specs/10-audio-buffer-manager/
├── SPEC.md
├── src/
│   ├── ring-buffer.ts       # Lock-free ring buffer
│   ├── pipewire.ts          # PipeWire adapter
│   ├── subprocess.ts        # Fallback implementation
│   └── types.ts             # TypeScript interfaces
├── native/
│   ├── Cargo.toml           # Rust project
│   ├── src/
│   │   └── lib.rs           # N-API binding
│   └── build.rs             # Build script
├── tests/
│   ├── unit.test.ts
│   ├── integration.test.ts
│   └── latency.test.ts
└── README.md
```
