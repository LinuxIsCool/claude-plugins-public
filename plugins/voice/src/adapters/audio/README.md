# Audio Buffer Manager

Low-latency audio buffer management for the voice plugin.

## Overview

The Audio Buffer Manager provides:

- **Prebuffering**: Eliminates first-syllable clipping on TTS playback (50ms default)
- **Low latency**: <50ms audio latency with PipeWire backend
- **Concurrent streams**: Multiple simultaneous playback/recording streams
- **Audio ducking**: Automatic volume reduction of background audio
- **Health metrics**: Real-time buffer health and latency monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AudioBufferManager                        │
│  - Backend selection (native/subprocess)                     │
│  - Stream lifecycle management                               │
│  - Ducking coordination                                      │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│   NativeAudioAdapter    │     │   SubprocessAudioAdapter    │
│   (Rust N-API binding)  │     │   (pw-play/paplay fallback) │
└─────────────────────────┘     └─────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│   PipeWire / PulseAudio │     │   pw-play / paplay / ffplay │
│   (Linux audio stack)   │     │   (subprocess)              │
└─────────────────────────┘     └─────────────────────────────┘
```

## Quick Start

```typescript
import { getAudioBufferManager } from "./adapters/audio";

// Get singleton manager (auto-initializes)
const manager = await getAudioBufferManager();

// Create playback stream with prebuffering
const stream = await manager.createPlaybackStream({
  name: "tts-output",
  prebufferMs: 50,
  priority: 80,
});

// Write audio data (prebuffers before playback)
await stream.prebuffer(audioBuffer);
await stream.start();
await stream.drain();
await stream.close();
```

## Playback Modes

The `playAudioBuffer()` function in `base.ts` supports three modes:

```typescript
import { setPlaybackMode } from "./adapters/tts/base";

// Default: Try streaming, fall back to legacy
setPlaybackMode("auto");

// Streaming only (fails if unavailable)
setPlaybackMode("stream");

// Legacy temp-file + subprocess only
setPlaybackMode("legacy");
```

## Ducking Strategies

Audio ducking reduces background audio volume when higher priority audio plays:

```typescript
const manager = createAudioBufferManager({
  duckingStrategy: "simple",  // Binary: full or ducked
  duckLevel: 0.3,             // Duck to 30% volume
});

// Or change at runtime
manager.setDuckingStrategy("proportional", 0.2);
```

Available strategies:

| Strategy | Description |
|----------|-------------|
| `simple` | Binary ducking: full volume or ducked |
| `proportional` | Volume scaled by priority (0-100) |
| `fade` | Same as simple but with fade transitions |
| `none` | No ducking (all streams at full volume) |

## Stream Priority

Streams have priority 0-100 (higher = more important):

```typescript
// Background music (low priority)
const bgStream = await manager.createPlaybackStream({
  name: "background",
  priority: 20,
});

// TTS output (high priority - ducks background)
const ttsStream = await manager.createPlaybackStream({
  name: "tts",
  priority: 80,
});
```

## Recording Streams

```typescript
const recording = await manager.createRecordingStream({
  name: "stt-input",
  sampleRate: 16000,  // STT-optimized sample rate
  channels: 1,
});

await recording.start();

for await (const chunk of recording) {
  // Process audio chunks
}

await recording.stop();
await recording.close();
```

## Health Metrics

```typescript
// Global metrics
const health = manager.getBufferHealth();
console.log(`Underruns: ${health.underruns}`);
console.log(`Overruns: ${health.overruns}`);

// Per-stream metrics
const streamHealth = stream.getHealth();
console.log(`Fill level: ${streamHealth.fillLevel * 100}%`);
console.log(`Latency: ${streamHealth.latencyMs}ms`);
```

## Backend Selection

```typescript
// Auto-detect best backend
const manager = createAudioBufferManager({ backend: "auto" });

// Force native Rust backend
const manager = createAudioBufferManager({ backend: "native" });

// Force subprocess fallback
const manager = createAudioBufferManager({ backend: "subprocess" });
```

## Native Rust Backend

The native backend requires building the Rust N-API module:

```bash
cd native/audio-buffer-napi
cargo build --release
```

Features:
- Lock-free ring buffers (SPSC)
- Direct PipeWire integration
- Atomic health metrics
- Minimal latency

## File Structure

```
src/
├── ports/
│   └── audio-buffer.ts      # Port interface definitions
└── adapters/
    └── audio/
        ├── index.ts         # Factory exports
        ├── manager.ts       # AudioBufferManager orchestrator
        ├── subprocess.ts    # Subprocess fallback adapter
        └── manager.test.ts  # Tests

native/
└── audio-buffer-napi/
    ├── Cargo.toml           # Rust project config
    ├── build.rs             # N-API build script
    └── src/
        ├── lib.rs           # N-API exports
        ├── backend/
        │   ├── mod.rs       # Backend trait
        │   ├── mock.rs      # Mock backend for testing
        │   └── pipewire.rs  # PipeWire backend
        ├── buffer/
        │   ├── ring.rs      # Lock-free ring buffer
        │   └── health.rs    # Health monitor
        └── ducking/
            └── mod.rs       # Ducking strategies
```
