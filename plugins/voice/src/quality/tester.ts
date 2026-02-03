/**
 * Voice Quality Testing Framework - Core Tester
 *
 * Provides metrics collection, A/B testing, and regression detection
 * for TTS backends.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import type { TTSBackendFactory, TTSOptions } from "../ports/tts.js";
import { getDefaultTTSFactory } from "../adapters/tts/index.js";
import type {
  TestSample,
  QualityMetrics,
  LatencyMetrics,
  SynthesisMetrics,
  TestRun,
  ABTestResult,
  QualityGates,
  QualityBaseline,
  GateViolation,
  RegressionWarning,
  RegressionReport,
  TestConfig,
} from "./types.js";
import { DEFAULT_GATES } from "./types.js";

/**
 * Standard test samples covering various text lengths and edge cases
 */
export const STANDARD_SAMPLES: TestSample[] = [
  // Short texts (<10 words)
  { id: "short-1", text: "Hello.", category: "short", charCount: 6 },
  { id: "short-2", text: "Ready.", category: "short", charCount: 6 },
  { id: "short-3", text: "I understand.", category: "short", charCount: 13 },
  { id: "short-4", text: "Let me help you with that.", category: "short", charCount: 26 },

  // Medium texts (10-30 words)
  {
    id: "medium-1",
    text: "I've analyzed the code and found several issues that we should address before deploying to production.",
    category: "medium",
    charCount: 102,
  },
  {
    id: "medium-2",
    text: "The test suite has completed successfully. All forty-two tests passed with no failures or warnings detected.",
    category: "medium",
    charCount: 108,
  },
  {
    id: "medium-3",
    text: "Based on my analysis, I recommend refactoring the authentication module to use a more secure hashing algorithm.",
    category: "medium",
    charCount: 111,
  },

  // Long texts (30-100 words)
  {
    id: "long-1",
    text: "Looking at the architecture, I can see that this system follows a hexagonal design pattern with clear separation between ports and adapters. The TTS subsystem currently supports multiple backends including ElevenLabs for high-quality cloud synthesis, Piper for fast local processing, and pyttsx3 as a fallback.",
    category: "long",
    charCount: 310,
  },

  // Edge cases
  {
    id: "edge-numbers",
    text: "The price is $1,234.56 and the date is 12/25/2025.",
    category: "edge_case",
    charCount: 50,
  },
  {
    id: "edge-technical",
    text: "Run npm install and npm test to verify the CI CD pipeline.",
    category: "edge_case",
    charCount: 58,
  },
  {
    id: "edge-abbreviations",
    text: "The API returns JSON via HTTP. Check the README for more info.",
    category: "edge_case",
    charCount: 62,
  },
  {
    id: "edge-punctuation",
    text: "Wait... what? That's incredible! How did you do that?",
    category: "edge_case",
    charCount: 53,
  },
];

/**
 * Statistical utility functions
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Linear interpolation method for accurate percentiles
  const pos = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Core Quality Tester class
 *
 * Combines metrics collection, A/B testing, and regression detection
 * into a single interface.
 */
export class QualityTester {
  private factory: TTSBackendFactory;
  private outputDir: string;
  private baselineDir: string;
  private samples: TestSample[];
  private iterations: number;
  private regressionThreshold: number;

  constructor(config: TestConfig = { backends: [] }) {
    this.factory = getDefaultTTSFactory();
    this.outputDir = config.outputDir || join(process.cwd(), ".claude", "voice", "quality");
    this.baselineDir = config.baselineDir || join(this.outputDir, "baselines");
    this.samples = config.samples || STANDARD_SAMPLES;
    this.iterations = config.iterations || 3;
    this.regressionThreshold = config.regressionThreshold || 0.20; // 20% degradation

    // Ensure directories exist
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
    if (!existsSync(this.baselineDir)) {
      mkdirSync(this.baselineDir, { recursive: true });
    }
  }

  /**
   * Get list of known backends (in priority order)
   */
  listBackends(): string[] {
    return this.factory.list();
  }

  /**
   * Check if a backend is available for testing
   */
  async isBackendAvailable(backend: string): Promise<boolean> {
    try {
      const adapter = this.factory.create(backend);
      return await adapter.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Collect quality metrics for a single backend
   */
  async collectMetrics(backend: string): Promise<QualityMetrics> {
    const adapter = this.factory.create(backend);

    if (!(await adapter.isAvailable())) {
      throw new Error(`Backend "${backend}" is not available`);
    }

    const runs: TestRun[] = [];
    const latencies: number[] = [];
    let totalChars = 0;
    let totalDuration = 0;
    let successCount = 0;
    let errorCount = 0;

    console.log(`Collecting metrics for ${backend}...`);

    for (const sample of this.samples) {
      for (let i = 0; i < this.iterations; i++) {
        const startTime = Date.now();
        try {
          const options: TTSOptions = { voiceId: "" }; // Use backend default
          const result = await adapter.synthesize(sample.text, options);
          const processingTime = Date.now() - startTime;

          latencies.push(processingTime);
          totalChars += sample.charCount;
          totalDuration += result.durationMs;
          successCount++;

          runs.push({
            sampleId: sample.id,
            text: sample.text,
            charCount: sample.charCount,
            processingTimeMs: processingTime,
            durationMs: result.durationMs,
            success: true,
          });
        } catch (error) {
          const processingTime = Date.now() - startTime;
          errorCount++;

          runs.push({
            sampleId: sample.id,
            text: sample.text,
            charCount: sample.charCount,
            processingTimeMs: processingTime,
            durationMs: 0,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          console.error(`  Sample ${sample.id} iteration ${i + 1} failed:`, error);
        }
      }
    }

    const totalRuns = successCount + errorCount;
    const latencyMetrics: LatencyMetrics = {
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      p99Ms: percentile(latencies, 99),
      meanMs: mean(latencies),
      minMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    };

    const synthesisMetrics: SynthesisMetrics = {
      totalChars,
      totalDurationMs: totalDuration,
      charsPerSecond: totalDuration > 0 ? (totalChars / totalDuration) * 1000 : 0,
      successRate: totalRuns > 0 ? successCount / totalRuns : 0,
      errorCount,
    };

    return {
      timestamp: new Date().toISOString(),
      backend,
      testSuite: "standard",
      sampleCount: this.samples.length,
      iterations: this.iterations,
      latency: latencyMetrics,
      synthesis: synthesisMetrics,
    };
  }

  /**
   * Run A/B comparison between two backends
   */
  async runABTest(backendA: string, backendB: string): Promise<ABTestResult> {
    console.log(`Comparing ${backendA} vs ${backendB}...`);

    const metricsA = await this.collectMetrics(backendA);
    const metricsB = await this.collectMetrics(backendB);

    // Calculate weighted scores
    const scoreA = this.calculateScore(metricsA);
    const scoreB = this.calculateScore(metricsB);

    // Determine winner
    let winner: string | undefined;
    if (Math.abs(scoreA - scoreB) > 0.05) {
      winner = scoreA > scoreB ? backendA : backendB;
    }

    const maxScore = Math.max(scoreA, scoreB);
    const confidence = maxScore > 0 ? Math.abs(scoreA - scoreB) / maxScore : 0;
    const analysis = this.generateABAnalysis(metricsA, metricsB, winner);

    const result: ABTestResult = {
      timestamp: new Date().toISOString(),
      backendA,
      backendB,
      testCaseIds: this.samples.map((s) => s.id),
      iterations: this.iterations,
      metricsA,
      metricsB,
      winner,
      confidence,
      analysis,
    };

    // Save to JSONL
    await this.appendToJsonl("ab-tests.jsonl", result);

    return result;
  }

  /**
   * Check for regressions against baseline
   */
  async checkRegressions(backend: string): Promise<RegressionReport> {
    const metrics = await this.collectMetrics(backend);
    const baseline = this.loadBaseline(backend);
    const gates = this.loadGates();

    const violations: GateViolation[] = [];
    const warnings: RegressionWarning[] = [];

    // Check quality gates (hard limits)
    if (metrics.latency.p95Ms > gates.latencyP95MaxMs) {
      violations.push({
        gate: "latencyP95MaxMs",
        expected: gates.latencyP95MaxMs,
        actual: metrics.latency.p95Ms,
        message: `Latency p95 (${metrics.latency.p95Ms}ms) exceeds gate (${gates.latencyP95MaxMs}ms)`,
      });
    }

    if (metrics.synthesis.successRate < gates.successRateMin) {
      violations.push({
        gate: "successRateMin",
        expected: gates.successRateMin,
        actual: metrics.synthesis.successRate,
        message: `Success rate (${(metrics.synthesis.successRate * 100).toFixed(1)}%) below gate (${gates.successRateMin * 100}%)`,
      });
    }

    if (metrics.synthesis.charsPerSecond < gates.charsPerSecondMin) {
      violations.push({
        gate: "charsPerSecondMin",
        expected: gates.charsPerSecondMin,
        actual: metrics.synthesis.charsPerSecond,
        message: `Throughput (${metrics.synthesis.charsPerSecond.toFixed(1)} c/s) below gate (${gates.charsPerSecondMin} c/s)`,
      });
    }

    // Check against baseline (if exists)
    if (baseline) {
      const baselineLatency = baseline.metrics.latency.p95Ms;
      const latencyChange = baselineLatency > 0
        ? (metrics.latency.p95Ms - baselineLatency) / baselineLatency
        : 0;

      if (latencyChange > this.regressionThreshold) {
        warnings.push({
          metric: "latency.p95Ms",
          baselineValue: baseline.metrics.latency.p95Ms,
          currentValue: metrics.latency.p95Ms,
          changePercent: latencyChange * 100,
          message: `Latency increased ${(latencyChange * 100).toFixed(1)}% from baseline`,
        });
      }

      const successChange =
        baseline.metrics.synthesis.successRate - metrics.synthesis.successRate;

      if (successChange > 0.05) {
        warnings.push({
          metric: "synthesis.successRate",
          baselineValue: baseline.metrics.synthesis.successRate,
          currentValue: metrics.synthesis.successRate,
          changePercent: -successChange * 100,
          message: `Success rate dropped ${(successChange * 100).toFixed(1)}% from baseline`,
        });
      }
    }

    const report: RegressionReport = {
      backend,
      timestamp: new Date().toISOString(),
      passed: violations.length === 0,
      violations,
      warnings,
      metrics,
      baseline: baseline?.metrics,
    };

    // Save to JSONL
    await this.appendToJsonl("regressions.jsonl", report);

    return report;
  }

  /**
   * Update baseline for a backend
   */
  async updateBaseline(backend: string): Promise<void> {
    const metrics = await this.collectMetrics(backend);
    const gates = this.loadGates();

    const baseline: QualityBaseline = {
      backend,
      created: new Date().toISOString(),
      metrics,
      gates,
    };

    const path = join(this.baselineDir, `${backend}.json`);
    writeFileSync(path, JSON.stringify(baseline, null, 2));
    console.log(`Baseline saved to ${path}`);
  }

  /**
   * Generate markdown report
   */
  generateReport(data: {
    metrics?: QualityMetrics;
    comparison?: ABTestResult;
    regression?: RegressionReport;
  }): string {
    const lines: string[] = [];
    lines.push("# Voice Quality Report");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");

    if (data.metrics) {
      lines.push("## Metrics Summary");
      lines.push("");
      lines.push(`**Backend:** ${data.metrics.backend}`);
      lines.push(`**Test Suite:** ${data.metrics.testSuite}`);
      lines.push(`**Samples:** ${data.metrics.sampleCount}`);
      lines.push(`**Iterations:** ${data.metrics.iterations}`);
      lines.push("");
      lines.push("### Latency");
      lines.push("");
      lines.push("| Metric | Value |");
      lines.push("|--------|-------|");
      lines.push(`| p50 | ${data.metrics.latency.p50Ms.toFixed(0)}ms |`);
      lines.push(`| p95 | ${data.metrics.latency.p95Ms.toFixed(0)}ms |`);
      lines.push(`| p99 | ${data.metrics.latency.p99Ms.toFixed(0)}ms |`);
      lines.push(`| Mean | ${data.metrics.latency.meanMs.toFixed(0)}ms |`);
      lines.push(`| Min | ${data.metrics.latency.minMs.toFixed(0)}ms |`);
      lines.push(`| Max | ${data.metrics.latency.maxMs.toFixed(0)}ms |`);
      lines.push("");
      lines.push("### Synthesis");
      lines.push("");
      lines.push("| Metric | Value |");
      lines.push("|--------|-------|");
      lines.push(`| Total Chars | ${data.metrics.synthesis.totalChars} |`);
      lines.push(`| Total Duration | ${data.metrics.synthesis.totalDurationMs.toFixed(0)}ms |`);
      lines.push(`| Chars/Second | ${data.metrics.synthesis.charsPerSecond.toFixed(1)} |`);
      lines.push(`| Success Rate | ${(data.metrics.synthesis.successRate * 100).toFixed(1)}% |`);
      lines.push(`| Errors | ${data.metrics.synthesis.errorCount} |`);
      lines.push("");
    }

    if (data.comparison) {
      lines.push("## A/B Comparison");
      lines.push("");
      lines.push(`**${data.comparison.backendA}** vs **${data.comparison.backendB}**`);
      lines.push("");
      lines.push("| Metric | " + data.comparison.backendA + " | " + data.comparison.backendB + " |");
      lines.push("|--------|------|------|");
      lines.push(
        `| Latency (p95) | ${data.comparison.metricsA.latency.p95Ms.toFixed(0)}ms | ${data.comparison.metricsB.latency.p95Ms.toFixed(0)}ms |`
      );
      lines.push(
        `| Success Rate | ${(data.comparison.metricsA.synthesis.successRate * 100).toFixed(1)}% | ${(data.comparison.metricsB.synthesis.successRate * 100).toFixed(1)}% |`
      );
      lines.push(
        `| Throughput | ${data.comparison.metricsA.synthesis.charsPerSecond.toFixed(1)} c/s | ${data.comparison.metricsB.synthesis.charsPerSecond.toFixed(1)} c/s |`
      );
      lines.push("");
      if (data.comparison.winner) {
        lines.push(`**Winner:** ${data.comparison.winner} (confidence: ${(data.comparison.confidence * 100).toFixed(0)}%)`);
      } else {
        lines.push("**Result:** Tie (no significant difference)");
      }
      lines.push("");
      lines.push("### Analysis");
      lines.push("");
      lines.push(data.comparison.analysis);
      lines.push("");
    }

    if (data.regression) {
      lines.push("## Regression Check");
      lines.push("");
      lines.push(`**Backend:** ${data.regression.backend}`);
      lines.push(`**Status:** ${data.regression.passed ? "PASS" : "FAIL"}`);
      lines.push("");

      if (data.regression.violations.length > 0) {
        lines.push("### Violations");
        lines.push("");
        for (const v of data.regression.violations) {
          lines.push(`- ${v.message}`);
        }
        lines.push("");
      }

      if (data.regression.warnings.length > 0) {
        lines.push("### Warnings");
        lines.push("");
        for (const w of data.regression.warnings) {
          lines.push(`- ${w.message}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Write report to file
   */
  async writeReport(content: string, filename?: string): Promise<string> {
    const name = filename || `report-${new Date().toISOString().slice(0, 10)}.md`;
    const path = join(this.outputDir, name);
    writeFileSync(path, content);
    return path;
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  private calculateScore(metrics: QualityMetrics): number {
    // Weighted scoring: latency (40%), success rate (40%), throughput (20%)
    const latencyScore = 1000 / (metrics.latency.p95Ms + 1); // Lower is better
    const successScore = metrics.synthesis.successRate * 100;
    const throughputScore = metrics.synthesis.charsPerSecond / 10;

    return latencyScore * 0.4 + successScore * 0.4 + throughputScore * 0.2;
  }

  private generateABAnalysis(
    metricsA: QualityMetrics,
    metricsB: QualityMetrics,
    winner?: string
  ): string {
    const lines: string[] = [];

    // Latency comparison
    const latencyDiff = metricsA.latency.p95Ms - metricsB.latency.p95Ms;
    const fasterBackend = latencyDiff > 0 ? metricsB.backend : metricsA.backend;
    lines.push(
      `Latency (p95): ${metricsA.latency.p95Ms.toFixed(0)}ms vs ${metricsB.latency.p95Ms.toFixed(0)}ms (${fasterBackend} faster by ${Math.abs(latencyDiff).toFixed(0)}ms)`
    );

    // Success rate
    lines.push(
      `Success rate: ${(metricsA.synthesis.successRate * 100).toFixed(1)}% vs ${(metricsB.synthesis.successRate * 100).toFixed(1)}%`
    );

    // Throughput
    lines.push(
      `Throughput: ${metricsA.synthesis.charsPerSecond.toFixed(1)} vs ${metricsB.synthesis.charsPerSecond.toFixed(1)} chars/sec`
    );

    if (winner) {
      lines.push("");
      lines.push(`Overall winner: **${winner}**`);
    } else {
      lines.push("");
      lines.push("No clear winner - backends perform similarly.");
    }

    return lines.join("\n");
  }

  private loadBaseline(backend: string): QualityBaseline | null {
    const path = join(this.baselineDir, `${backend}.json`);
    if (!existsSync(path)) {
      return null;
    }
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return null;
    }
  }

  private loadGates(): QualityGates {
    const path = join(this.baselineDir, "gates.json");
    if (!existsSync(path)) {
      return DEFAULT_GATES;
    }
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      return DEFAULT_GATES;
    }
  }

  private async appendToJsonl(filename: string, data: unknown): Promise<void> {
    const path = join(this.outputDir, filename);
    const line = JSON.stringify(data) + "\n";
    // Use appendFileSync for atomic appends - prevents race conditions
    appendFileSync(path, line, "utf-8");
  }
}

/**
 * Create a quality tester with optional configuration
 */
export function createQualityTester(config?: Partial<TestConfig>): QualityTester {
  return new QualityTester({
    backends: [],
    ...config,
  });
}
