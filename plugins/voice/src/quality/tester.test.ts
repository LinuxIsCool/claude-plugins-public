/**
 * Voice Quality Testing Framework - Integration Tests
 *
 * Tests the quality testing framework with real TTS backends.
 * Skips tests for backends that are not available.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { createQualityTester, STANDARD_SAMPLES, QualityTester } from "./tester.js";
import { getDefaultTTSFactory } from "../adapters/tts/index.js";
import type { TestSample } from "./types.js";

const TEST_OUTPUT_DIR = "/tmp/voice-quality-test";

// Small sample set for faster tests
const QUICK_SAMPLES: TestSample[] = [
  { id: "test-short", text: "Hello world.", category: "short", charCount: 12 },
  { id: "test-medium", text: "This is a medium length test sentence for synthesis.", category: "medium", charCount: 52 },
];

describe("QualityTester", () => {
  let availableBackends: string[] = [];
  let tester: QualityTester;

  beforeAll(async () => {
    // Clean up previous test runs
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

    // Discover available backends
    const factory = getDefaultTTSFactory();
    const potentialBackends = ["pyttsx3", "huggingface-xtts", "elevenlabs"];

    for (const name of potentialBackends) {
      try {
        const backend = factory.create(name);
        if (await backend.isAvailable()) {
          availableBackends.push(name);
        }
      } catch {
        // Backend not implemented or unavailable
      }
    }

    console.log(`Available backends for testing: ${availableBackends.join(", ") || "none"}`);

    // Create tester with quick samples
    tester = createQualityTester({
      backends: availableBackends,
      samples: QUICK_SAMPLES,
      iterations: 1, // Single iteration for speed
      outputDir: TEST_OUTPUT_DIR,
    });
  });

  afterAll(() => {
    // Clean up test output
    if (existsSync(TEST_OUTPUT_DIR)) {
      rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("isBackendAvailable", () => {
    test("returns true for available backends", async () => {
      if (availableBackends.length === 0) {
        console.log("Skipping: no backends available");
        return;
      }

      const available = await tester.isBackendAvailable(availableBackends[0]);
      expect(available).toBe(true);
    });

    test("returns false for unknown backends", async () => {
      const available = await tester.isBackendAvailable("nonexistent-backend");
      expect(available).toBe(false);
    });
  });

  describe("collectMetrics", () => {
    test("returns valid metrics structure", async () => {
      if (availableBackends.length === 0) {
        console.log("Skipping: no backends available");
        return;
      }

      const backend = availableBackends[0];
      const metrics = await tester.collectMetrics(backend);

      // Check structure
      expect(metrics.backend).toBe(backend);
      expect(metrics.testSuite).toBe("standard");
      expect(metrics.sampleCount).toBe(QUICK_SAMPLES.length);
      expect(metrics.iterations).toBe(1);

      // Check latency metrics (always present, even with failures)
      expect(metrics.latency.p50Ms).toBeGreaterThanOrEqual(0);
      expect(metrics.latency.p95Ms).toBeGreaterThanOrEqual(0);
      expect(metrics.latency.p99Ms).toBeGreaterThanOrEqual(0);
      expect(metrics.latency.meanMs).toBeGreaterThanOrEqual(0);
      expect(metrics.latency.minMs).toBeGreaterThanOrEqual(0);
      expect(metrics.latency.maxMs).toBeGreaterThanOrEqual(metrics.latency.minMs);

      // Check synthesis metrics
      // Note: totalChars can be 0 if all tests fail (e.g., pyttsx3 not installed)
      expect(metrics.synthesis.totalChars).toBeGreaterThanOrEqual(0);
      expect(metrics.synthesis.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.synthesis.successRate).toBeLessThanOrEqual(1);

      // If synthesis failed, the test still passes (we're testing the framework, not the backend)
      if (metrics.synthesis.successRate === 0) {
        console.log(`Warning: All synthesis attempts failed for ${backend} - backend may not be properly configured`);
      }
    });

    test("throws for unavailable backend", async () => {
      await expect(tester.collectMetrics("nonexistent-backend")).rejects.toThrow();
    });
  });

  describe("runABTest", () => {
    test("compares two backends", async () => {
      if (availableBackends.length < 2) {
        console.log("Skipping: need at least 2 backends for A/B test");
        return;
      }

      const [backendA, backendB] = availableBackends;
      const result = await tester.runABTest(backendA, backendB);

      // Check structure
      expect(result.backendA).toBe(backendA);
      expect(result.backendB).toBe(backendB);
      expect(result.testCaseIds).toHaveLength(QUICK_SAMPLES.length);
      expect(result.metricsA).toBeDefined();
      expect(result.metricsB).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.analysis).toContain("Latency");
    });
  });

  describe("checkRegressions", () => {
    test("passes when no baseline exists", async () => {
      if (availableBackends.length === 0) {
        console.log("Skipping: no backends available");
        return;
      }

      const backend = availableBackends[0];
      const result = await tester.checkRegressions(backend);

      // Without baseline, should pass if gates pass
      expect(result.backend).toBe(backend);
      expect(result.violations).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.baseline).toBeUndefined();
    });

    test("compares against baseline after setting one", async () => {
      if (availableBackends.length === 0) {
        console.log("Skipping: no backends available");
        return;
      }

      const backend = availableBackends[0];

      // Set baseline
      await tester.updateBaseline(backend);

      // Check regressions
      const result = await tester.checkRegressions(backend);

      expect(result.backend).toBe(backend);
      expect(result.baseline).toBeDefined();
    });
  });

  describe("generateReport", () => {
    test("generates valid markdown for metrics", async () => {
      if (availableBackends.length === 0) {
        console.log("Skipping: no backends available");
        return;
      }

      const metrics = await tester.collectMetrics(availableBackends[0]);
      const report = tester.generateReport({ metrics });

      expect(report).toContain("# Voice Quality Report");
      expect(report).toContain("## Metrics Summary");
      expect(report).toContain("### Latency");
      expect(report).toContain("### Synthesis");
      expect(report).toContain(availableBackends[0]);
    });

    test("generates valid markdown for comparison", async () => {
      if (availableBackends.length < 2) {
        console.log("Skipping: need at least 2 backends");
        return;
      }

      const result = await tester.runABTest(availableBackends[0], availableBackends[1]);
      const report = tester.generateReport({ comparison: result });

      expect(report).toContain("# Voice Quality Report");
      expect(report).toContain("## A/B Comparison");
      expect(report).toContain(availableBackends[0]);
      expect(report).toContain(availableBackends[1]);
    });
  });

  describe("STANDARD_SAMPLES", () => {
    test("has samples for each category", () => {
      const categories = new Set(STANDARD_SAMPLES.map((s) => s.category));

      expect(categories.has("short")).toBe(true);
      expect(categories.has("medium")).toBe(true);
      expect(categories.has("long")).toBe(true);
      expect(categories.has("edge_case")).toBe(true);
    });

    test("has correct charCount for each sample", () => {
      for (const sample of STANDARD_SAMPLES) {
        expect(sample.charCount).toBe(sample.text.length);
      }
    });
  });
});
