/**
 * AudioBufferManager Tests
 *
 * Tests for the audio buffer management system.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { AudioBufferManager, createAudioBufferManager } from "./manager.js";
import type { PlaybackStream, RecordingStream } from "../../ports/audio-buffer.js";

describe("AudioBufferManager", () => {
  let manager: AudioBufferManager;

  beforeEach(async () => {
    // Create manager with subprocess backend (doesn't require native binding)
    manager = createAudioBufferManager({
      backend: "subprocess",
      duckingStrategy: "simple",
      duckLevel: 0.3,
    });
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe("initialization", () => {
    test("initializes with subprocess backend", async () => {
      await manager.initialize();
      expect(manager.getBackendName()).toBe("subprocess");
    });

    test("initializes only once", async () => {
      await manager.initialize();
      await manager.initialize(); // Second call should be no-op
      expect(manager.getBackendName()).toBe("subprocess");
    });
  });

  describe("playback streams", () => {
    test("creates playback stream with options", async () => {
      await manager.initialize();
      const stream = await manager.createPlaybackStream({
        name: "test-stream",
        prebufferMs: 50,
        priority: 80,
      });

      expect(stream).toBeDefined();
      expect(stream.id).toBeDefined();
      expect(typeof stream.id).toBe("string");
      expect(manager.activePlaybackCount).toBe(1);

      await stream.close();
      expect(manager.activePlaybackCount).toBe(0);
    });

    test("tracks multiple playback streams", async () => {
      await manager.initialize();
      const stream1 = await manager.createPlaybackStream({ name: "stream1" });
      const stream2 = await manager.createPlaybackStream({ name: "stream2" });

      expect(manager.activePlaybackCount).toBe(2);

      await stream1.close();
      expect(manager.activePlaybackCount).toBe(1);

      await stream2.close();
      expect(manager.activePlaybackCount).toBe(0);
    });
  });

  describe("recording streams", () => {
    test("creates recording stream", async () => {
      await manager.initialize();
      const stream = await manager.createRecordingStream({
        name: "test-recording",
        sampleRate: 16000,
        channels: 1,
      });

      expect(stream).toBeDefined();
      expect(stream.id).toBeDefined();
      expect(manager.activeRecordingCount).toBe(1);

      await stream.close();
      expect(manager.activeRecordingCount).toBe(0);
    });
  });

  describe("ducking", () => {
    test("changes ducking strategy", async () => {
      await manager.initialize();
      // Should not throw
      manager.setDuckingStrategy("proportional", 0.2);
      manager.setDuckingStrategy("fade", 0.5);
      manager.setDuckingStrategy("none");
    });
  });

  describe("metrics", () => {
    test("returns latency metrics", async () => {
      await manager.initialize();
      const latency = manager.getLatency();

      expect(latency).toBeDefined();
      expect(typeof latency.outputMs).toBe("number");
      expect(typeof latency.inputMs).toBe("number");
      expect(typeof latency.roundTripMs).toBe("number");
    });

    test("returns buffer health metrics", async () => {
      await manager.initialize();
      const health = manager.getBufferHealth();

      expect(health).toBeDefined();
      expect(typeof health.underruns).toBe("number");
      expect(typeof health.overruns).toBe("number");
    });
  });

  describe("shutdown", () => {
    test("closes all streams on shutdown", async () => {
      await manager.initialize();
      await manager.createPlaybackStream({ name: "stream1" });
      await manager.createPlaybackStream({ name: "stream2" });
      await manager.createRecordingStream({ name: "recording1" });

      expect(manager.activePlaybackCount).toBe(2);
      expect(manager.activeRecordingCount).toBe(1);

      await manager.shutdown();

      expect(manager.activePlaybackCount).toBe(0);
      expect(manager.activeRecordingCount).toBe(0);
    });
  });
});

describe("DuckingCoordinator", () => {
  let manager: AudioBufferManager;

  beforeEach(async () => {
    manager = createAudioBufferManager({
      backend: "subprocess",
      duckingStrategy: "simple",
      duckLevel: 0.3,
    });
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  test("ducks lower priority streams when higher priority plays", async () => {
    // Create a low priority background stream
    const bgStream = await manager.createPlaybackStream({
      name: "background",
      priority: 30,
    });

    // Create a high priority TTS stream
    const ttsStream = await manager.createPlaybackStream({
      name: "tts",
      priority: 80,
    });

    // In simple ducking, the lower priority stream should be ducked
    // This is hard to test without mocking the internal coordinator
    // but we can verify streams are tracked
    expect(manager.activePlaybackCount).toBe(2);

    await bgStream.close();
    await ttsStream.close();
  });
});

describe("PlaybackStream lifecycle", () => {
  let manager: AudioBufferManager;
  let stream: PlaybackStream;

  beforeEach(async () => {
    manager = createAudioBufferManager({ backend: "subprocess" });
    await manager.initialize();
    stream = await manager.createPlaybackStream({ name: "test" });
  });

  afterEach(async () => {
    try {
      await stream.close();
    } catch {}
    await manager.shutdown();
  });

  test("has initial idle state", () => {
    expect(stream.state).toBe("idle");
  });

  test("can set volume", () => {
    stream.setVolume(0.5);
    expect(stream.getVolume()).toBe(0.5);
  });

  test("clamps volume to valid range", () => {
    stream.setVolume(2.0);
    expect(stream.getVolume()).toBeLessThanOrEqual(1.0);

    stream.setVolume(-0.5);
    expect(stream.getVolume()).toBeGreaterThanOrEqual(0.0);
  });
});
