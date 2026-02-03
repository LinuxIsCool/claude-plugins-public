/**
 * Piper TTS Adapter - Integration Tests
 *
 * Tests actual TTS synthesis with the piper CLI.
 * REQUIRES: piper CLI installed and at least one voice model downloaded.
 *
 * Install piper:
 *   pip install piper-tts
 *
 * Download a voice:
 *   mkdir -p ~/.local/share/piper/voices
 *   cd ~/.local/share/piper/voices
 *   wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx
 *   wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { PiperAdapter } from "../../src/adapters/tts/piper.js";

// Skip integration tests if piper is not available
let piperAvailable = false;
let voiceInstalled = false;
let adapter: PiperAdapter;

beforeAll(async () => {
  adapter = new PiperAdapter();
  piperAvailable = await adapter.isAvailable();

  if (piperAvailable) {
    voiceInstalled = adapter.isVoiceInstalled("en_US-lessac-high");
  }

  if (!piperAvailable) {
    console.log("⚠️  Skipping integration tests: piper CLI not installed");
  } else if (!voiceInstalled) {
    console.log("⚠️  Skipping synthesis tests: en_US-lessac-high voice not installed");
  }
});

describe("Piper Integration", () => {
  describe("isAvailable()", () => {
    test("detects piper CLI availability", async () => {
      const available = await adapter.isAvailable();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("synthesize()", () => {
    test("synthesizes speech", async () => {
      if (!piperAvailable || !voiceInstalled) {
        console.log("  → Skipped: piper or voice not available");
        return;
      }

      const result = await adapter.synthesize("Hello world", {
        voiceId: "en_US-lessac-high",
      });

      expect(result.audio.length).toBeGreaterThan(1000);
      expect(result.format).toBe("wav");
      expect(result.charCount).toBe(11); // "Hello world"
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    test("handles longer text", async () => {
      if (!piperAvailable || !voiceInstalled) {
        console.log("  → Skipped: piper or voice not available");
        return;
      }

      const text = "This is a longer sentence that tests the synthesis of multiple words.";
      const result = await adapter.synthesize(text, {
        voiceId: "en_US-lessac-high",
      });

      expect(result.audio.length).toBeGreaterThan(5000);
      expect(result.charCount).toBe(text.length);
    });

    test("speed adjustment works (faster)", async () => {
      if (!piperAvailable || !voiceInstalled) {
        console.log("  → Skipped: piper or voice not available");
        return;
      }

      const text = "Testing speed adjustment.";

      const normal = await adapter.synthesize(text, {
        voiceId: "en_US-lessac-high",
        speed: 1.0,
      });

      const fast = await adapter.synthesize(text, {
        voiceId: "en_US-lessac-high",
        speed: 1.5,
      });

      // Faster speech should have shorter duration
      expect(fast.durationMs).toBeLessThan(normal.durationMs);
    });

    test("speed adjustment works (slower)", async () => {
      if (!piperAvailable || !voiceInstalled) {
        console.log("  → Skipped: piper or voice not available");
        return;
      }

      const text = "Testing speed adjustment.";

      const normal = await adapter.synthesize(text, {
        voiceId: "en_US-lessac-high",
        speed: 1.0,
      });

      const slow = await adapter.synthesize(text, {
        voiceId: "en_US-lessac-high",
        speed: 0.75,
      });

      // Slower speech should have longer duration
      expect(slow.durationMs).toBeGreaterThan(normal.durationMs);
    });

    test("throws for non-existent voice", async () => {
      if (!piperAvailable) {
        console.log("  → Skipped: piper not available");
        return;
      }

      expect(
        adapter.synthesize("Test", { voiceId: "nonexistent-voice-xyz" })
      ).rejects.toThrow(/voice not found/i);
    });

    test("handles special characters in text", async () => {
      if (!piperAvailable || !voiceInstalled) {
        console.log("  → Skipped: piper or voice not available");
        return;
      }

      // Test text with quotes, newlines, special chars
      const text = `Hello! It's a "test" with special chars: 1, 2, 3.`;
      const result = await adapter.synthesize(text, {
        voiceId: "en_US-lessac-high",
      });

      expect(result.audio.length).toBeGreaterThan(1000);
    });

    test("rejects empty text", async () => {
      if (!piperAvailable) {
        console.log("  → Skipped: piper not available");
        return;
      }

      // Empty text should be rejected with a clear error
      expect(
        adapter.synthesize("", { voiceId: "en_US-lessac-high" })
      ).rejects.toThrow(/empty|whitespace/i);
    });

    test("rejects whitespace-only text", async () => {
      if (!piperAvailable) {
        console.log("  → Skipped: piper not available");
        return;
      }

      // Whitespace-only text should also be rejected
      expect(
        adapter.synthesize("   \n\t  ", { voiceId: "en_US-lessac-high" })
      ).rejects.toThrow(/empty|whitespace/i);
    });
  });

  describe("listVoices()", () => {
    test("lists installed voices", async () => {
      if (!piperAvailable) {
        console.log("  → Skipped: piper not available");
        return;
      }

      const voices = await adapter.listVoices();
      expect(Array.isArray(voices)).toBe(true);

      if (voiceInstalled) {
        expect(voices.length).toBeGreaterThan(0);

        // Check voice structure
        const voice = voices[0];
        expect(voice).toHaveProperty("id");
        expect(voice).toHaveProperty("name");
        expect(voice).toHaveProperty("gender");
        expect(voice).toHaveProperty("language");
        expect(voice).toHaveProperty("languageCode");
      }
    });
  });

  describe("getInstalledVoices()", () => {
    test("returns array of voice IDs", async () => {
      if (!piperAvailable) {
        console.log("  → Skipped: piper not available");
        return;
      }

      const voices = await adapter.getInstalledVoices();
      expect(Array.isArray(voices)).toBe(true);

      if (voiceInstalled) {
        expect(voices).toContain("en_US-lessac-high");
      }
    });
  });

  describe("isVoiceInstalled()", () => {
    test("returns true for installed voice", async () => {
      if (!piperAvailable || !voiceInstalled) {
        console.log("  → Skipped: voice not installed");
        return;
      }

      expect(adapter.isVoiceInstalled("en_US-lessac-high")).toBe(true);
    });

    test("returns false for non-installed voice", async () => {
      expect(adapter.isVoiceInstalled("nonexistent-voice")).toBe(false);
    });
  });
});

describe("Factory integration with fallback", () => {
  test("factory can get piper with fallback", async () => {
    if (!piperAvailable) {
      console.log("  → Skipped: piper not available");
      return;
    }

    const { TTSFactory } = await import("../../src/adapters/tts/index.js");
    const factory = new TTSFactory();

    const backend = await factory.getWithFallback("piper");
    expect(backend.name()).toBe("piper");
  });
});
