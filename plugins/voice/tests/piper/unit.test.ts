/**
 * Piper TTS Adapter - Unit Tests
 *
 * Tests adapter configuration, capabilities, and static behavior.
 * Does NOT require piper CLI to be installed.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { PiperAdapter, createPiperAdapter, type PiperConfig } from "../../src/adapters/tts/piper.js";

describe("PiperAdapter", () => {
  describe("name()", () => {
    test("returns 'piper'", () => {
      const adapter = new PiperAdapter();
      expect(adapter.name()).toBe("piper");
    });
  });

  describe("capabilities()", () => {
    test("indicates local and no voice cloning", () => {
      const caps = new PiperAdapter().capabilities();

      expect(caps.local).toBe(true);
      expect(caps.voiceCloning).toBe(false);
      expect(caps.streaming).toBe(false);
      expect(caps.ssml).toBe(false);
      expect(caps.emotions).toBe(false);
    });

    test("indicates zero cost", () => {
      const caps = new PiperAdapter().capabilities();
      expect(caps.costPerChar).toBe(0);
    });

    test("supports WAV format", () => {
      const caps = new PiperAdapter().capabilities();
      expect(caps.supportedFormats).toContain("wav");
    });

    test("has reasonable max text length", () => {
      const caps = new PiperAdapter().capabilities();
      expect(caps.maxTextLength).toBeGreaterThanOrEqual(1000);
    });
  });

  describe("configuration", () => {
    test("uses default values when no config provided", () => {
      const adapter = new PiperAdapter();
      // Adapter should work without throwing
      expect(adapter.name()).toBe("piper");
    });

    test("accepts custom voicesDir", () => {
      const config: PiperConfig = {
        voicesDir: "/custom/voices/path",
      };
      const adapter = new PiperAdapter(config);
      expect(adapter.name()).toBe("piper");
    });

    test("accepts custom defaultVoice", () => {
      const config: PiperConfig = {
        defaultVoice: "en_GB-alan-medium",
      };
      const adapter = new PiperAdapter(config);
      expect(adapter.name()).toBe("piper");
    });

    test("accepts speech parameters", () => {
      const config: PiperConfig = {
        lengthScale: 0.9,
        noiseScale: 0.5,
        noiseW: 0.7,
        sampleRate: 22050,
      };
      const adapter = new PiperAdapter(config);
      expect(adapter.name()).toBe("piper");
    });
  });

  describe("factory function", () => {
    test("createPiperAdapter() creates adapter instance", () => {
      const adapter = createPiperAdapter();
      expect(adapter).toBeInstanceOf(PiperAdapter);
    });

    test("createPiperAdapter() accepts config", () => {
      const adapter = createPiperAdapter({
        defaultVoice: "en_US-ryan-high",
      });
      expect(adapter).toBeInstanceOf(PiperAdapter);
    });
  });

  describe("isVoiceInstalled()", () => {
    test("returns false for non-existent voice", () => {
      const adapter = new PiperAdapter({
        voicesDir: "/nonexistent/path",
      });
      expect(adapter.isVoiceInstalled("fake-voice")).toBe(false);
    });
  });

  describe("getInstalledVoices()", () => {
    test("returns empty array for non-existent directory", async () => {
      const adapter = new PiperAdapter({
        voicesDir: "/nonexistent/path",
      });
      const voices = await adapter.getInstalledVoices();
      expect(voices).toEqual([]);
    });
  });

  describe("listVoices()", () => {
    test("returns empty array for non-existent directory", async () => {
      const adapter = new PiperAdapter({
        voicesDir: "/nonexistent/path",
      });
      const voices = await adapter.listVoices();
      expect(voices).toEqual([]);
    });

    test("caches voice list on subsequent calls", async () => {
      const adapter = new PiperAdapter({
        voicesDir: "/nonexistent/path",
      });

      const voices1 = await adapter.listVoices();
      const voices2 = await adapter.listVoices();

      // Should be the same reference (cached)
      expect(voices1).toBe(voices2);
    });
  });
});

describe("TTSFactory integration", () => {
  test("piper is in backend priority list", async () => {
    const { TTSFactory } = await import("../../src/adapters/tts/index.js");
    const factory = new TTSFactory();
    const backends = factory.list();

    expect(backends).toContain("piper");
  });

  test("factory can create piper adapter", async () => {
    const { TTSFactory } = await import("../../src/adapters/tts/index.js");
    const factory = new TTSFactory();
    const adapter = factory.create("piper");

    expect(adapter.name()).toBe("piper");
  });
});
