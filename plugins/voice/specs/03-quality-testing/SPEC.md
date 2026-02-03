# Spec: Voice Quality Testing Framework

**Component**: Testing Infrastructure
**Priority**: Critical
**Estimated Effort**: 4-6 hours
**Dependencies**: Existing TTS adapters, Bun test runner

---

## Overview

Build a comprehensive testing framework for voice quality evaluation. This enables automated quality regression detection, A/B testing between backends, and continuous improvement tracking.

## Goals

1. Automated quality metrics collection (latency, success rate)
2. A/B testing framework for backend comparison
3. Regression detection with CI integration
4. Quality dashboard and trend visualization
5. Baseline establishment for all backends

## Non-Goals

- Human MOS evaluation automation (future work)
- Audio quality analysis (spectrogram, pitch) - out of scope for v1
- Real-time monitoring (batch evaluation only)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Quality Testing Framework                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Metrics    │  │  A/B Testing │  │  Regression  │  │
│  │  Collector   │  │   Framework  │  │   Detector   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └────────┬────────┴────────┬────────┘           │
│                  │                 │                    │
│         ┌────────▼────────┐ ┌──────▼───────┐           │
│         │  Test Runner    │ │  Dashboard   │           │
│         │  (Bun + CI)     │ │  (Reports)   │           │
│         └────────┬────────┘ └──────────────┘           │
│                  │                                      │
│         ┌────────▼────────┐                            │
│         │  JSONL Storage  │                            │
│         │ (.claude/voice/ │                            │
│         │   quality/)     │                            │
│         └─────────────────┘                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

### Quality Metrics Schema

```typescript
// plugins/voice/specs/03-quality-testing/src/types.ts

interface QualityMetrics {
  timestamp: string;         // ISO 8601
  backend: string;           // e.g., "elevenlabs", "piper"
  test_suite: string;        // e.g., "latency", "accuracy"

  // Latency metrics
  latency: {
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    mean_ms: number;
    min_ms: number;
    max_ms: number;
  };

  // Synthesis metrics
  synthesis: {
    total_chars: number;
    total_duration_ms: number;
    chars_per_second: number;
    success_rate: number;
    error_count: number;
  };

  // Audio quality (optional, v2)
  audio?: {
    sample_rate: number;
    bit_depth: number;
    duration_accuracy: number;  // actual vs expected
  };
}

interface TestCase {
  id: string;
  text: string;
  expected_duration_range?: [number, number];  // ms
  language?: string;
  category: "short" | "medium" | "long" | "edge_case";
}

interface ABTestResult {
  timestamp: string;
  backend_a: string;
  backend_b: string;
  test_cases: string[];  // TestCase IDs

  results: {
    backend: string;
    metrics: QualityMetrics;
  }[];

  winner?: string;
  confidence: number;
  analysis: string;
}

interface QualityBaseline {
  backend: string;
  created: string;
  metrics: QualityMetrics;
  gates: QualityGates;
}

interface QualityGates {
  latency_p95_max_ms: number;
  success_rate_min: number;
  chars_per_second_min: number;
}
```

---

## Test Cases

### Standard Test Set

```typescript
// plugins/voice/specs/03-quality-testing/src/test-cases.ts

export const STANDARD_TEST_CASES: TestCase[] = [
  // Short texts (<10 words)
  { id: "short-1", text: "Hello.", category: "short" },
  { id: "short-2", text: "Ready.", category: "short" },
  { id: "short-3", text: "I understand.", category: "short" },
  { id: "short-4", text: "Let me help you with that.", category: "short" },

  // Medium texts (10-30 words)
  { id: "medium-1", text: "I've analyzed the code and found several issues that we should address before deploying to production.", category: "medium" },
  { id: "medium-2", text: "The test suite has completed successfully. All forty-two tests passed with no failures or warnings detected.", category: "medium" },
  { id: "medium-3", text: "Based on my analysis, I recommend refactoring the authentication module to use a more secure hashing algorithm.", category: "medium" },

  // Long texts (30-100 words)
  { id: "long-1", text: "Looking at the architecture, I can see that this system follows a hexagonal design pattern with clear separation between ports and adapters. The TTS subsystem currently supports multiple backends including ElevenLabs for high-quality cloud synthesis, Piper for fast local processing, and pyttsx3 as a fallback. Each adapter implements the TTSPort interface, allowing seamless switching between backends based on availability and quality requirements.", category: "long" },

  // Edge cases
  { id: "edge-numbers", text: "The price is $1,234.56 and the date is 12/25/2025.", category: "edge_case" },
  { id: "edge-technical", text: "Run npm install && npm test to verify the CI/CD pipeline.", category: "edge_case" },
  { id: "edge-abbreviations", text: "The API returns JSON via HTTP. Check the README for more info.", category: "edge_case" },
  { id: "edge-punctuation", text: "Wait... what? That's incredible! How did you do that?", category: "edge_case" },
  { id: "edge-code", text: "The function async function getData takes a parameter URL and returns a Promise.", category: "edge_case" },
];

export const LATENCY_TEST_CASES = STANDARD_TEST_CASES.filter(
  tc => tc.category === "short" || tc.category === "medium"
);

export const COMPREHENSIVE_TEST_CASES = STANDARD_TEST_CASES;
```

---

## Implementation Guide

### File Structure

```
plugins/voice/specs/03-quality-testing/
├── SPEC.md
├── src/
│   ├── types.ts              # Type definitions
│   ├── test-cases.ts         # Standard test cases
│   ├── metrics-collector.ts  # Collect metrics from tests
│   ├── ab-tester.ts          # A/B testing framework
│   ├── regression-detector.ts # Detect quality regressions
│   ├── dashboard.ts          # Generate reports
│   └── runner.ts             # Test orchestration
├── tests/
│   ├── collector.test.ts
│   ├── ab-tester.test.ts
│   └── regression.test.ts
├── baselines/
│   ├── elevenlabs.json       # ElevenLabs baseline
│   ├── piper.json            # Piper baseline
│   └── gates.json            # Quality gates
└── scripts/
    ├── run-quality-tests.sh
    ├── establish-baseline.sh
    └── compare-backends.sh
```

### Metrics Collector

```typescript
// plugins/voice/specs/03-quality-testing/src/metrics-collector.ts

import type { QualityMetrics, TestCase } from "./types.js";
import { getDefaultTTSFactory } from "../../../src/adapters/tts/index.js";

export class MetricsCollector {
  private results: Map<string, number[]> = new Map();

  async collectForBackend(
    backend: string,
    testCases: TestCase[],
    iterations: number = 3
  ): Promise<QualityMetrics> {
    const factory = getDefaultTTSFactory();
    const adapter = factory.create(backend);

    const latencies: number[] = [];
    const charRates: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    let totalChars = 0;
    let totalDuration = 0;

    for (const testCase of testCases) {
      for (let i = 0; i < iterations; i++) {
        try {
          const startTime = Date.now();
          const result = await adapter.synthesize(testCase.text, {});
          const latency = Date.now() - startTime;

          latencies.push(latency);
          charRates.push(testCase.text.length / (latency / 1000));
          totalChars += testCase.text.length;
          totalDuration += result.durationMs;
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Test case ${testCase.id} failed:`, error);
        }
      }
    }

    latencies.sort((a, b) => a - b);

    return {
      timestamp: new Date().toISOString(),
      backend,
      test_suite: "standard",
      latency: {
        p50_ms: percentile(latencies, 50),
        p95_ms: percentile(latencies, 95),
        p99_ms: percentile(latencies, 99),
        mean_ms: mean(latencies),
        min_ms: Math.min(...latencies),
        max_ms: Math.max(...latencies),
      },
      synthesis: {
        total_chars: totalChars,
        total_duration_ms: totalDuration,
        chars_per_second: mean(charRates),
        success_rate: successCount / (successCount + errorCount),
        error_count: errorCount,
      },
    };
  }
}

function percentile(arr: number[], p: number): number {
  const index = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, index)];
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
```

### A/B Testing Framework

```typescript
// plugins/voice/specs/03-quality-testing/src/ab-tester.ts

import type { ABTestResult, TestCase, QualityMetrics } from "./types.js";
import { MetricsCollector } from "./metrics-collector.js";

export class ABTester {
  private collector = new MetricsCollector();

  async compare(
    backendA: string,
    backendB: string,
    testCases: TestCase[],
    iterations: number = 5
  ): Promise<ABTestResult> {
    console.log(`Comparing ${backendA} vs ${backendB}...`);

    const metricsA = await this.collector.collectForBackend(backendA, testCases, iterations);
    const metricsB = await this.collector.collectForBackend(backendB, testCases, iterations);

    // Determine winner based on weighted score
    const scoreA = this.calculateScore(metricsA);
    const scoreB = this.calculateScore(metricsB);

    const winner = scoreA > scoreB ? backendA : scoreB > scoreA ? backendB : undefined;
    const confidence = Math.abs(scoreA - scoreB) / Math.max(scoreA, scoreB);

    return {
      timestamp: new Date().toISOString(),
      backend_a: backendA,
      backend_b: backendB,
      test_cases: testCases.map(tc => tc.id),
      results: [
        { backend: backendA, metrics: metricsA },
        { backend: backendB, metrics: metricsB },
      ],
      winner,
      confidence,
      analysis: this.generateAnalysis(metricsA, metricsB, winner),
    };
  }

  private calculateScore(metrics: QualityMetrics): number {
    // Weighted scoring: latency (40%), success rate (40%), throughput (20%)
    const latencyScore = 1000 / metrics.latency.p95_ms;  // Lower is better
    const successScore = metrics.synthesis.success_rate * 100;
    const throughputScore = metrics.synthesis.chars_per_second / 10;

    return latencyScore * 0.4 + successScore * 0.4 + throughputScore * 0.2;
  }

  private generateAnalysis(
    metricsA: QualityMetrics,
    metricsB: QualityMetrics,
    winner?: string
  ): string {
    const lines: string[] = [];

    // Latency comparison
    const latencyDiff = metricsA.latency.p95_ms - metricsB.latency.p95_ms;
    lines.push(`Latency (p95): ${metricsA.latency.p95_ms}ms vs ${metricsB.latency.p95_ms}ms (${latencyDiff > 0 ? "B" : "A"} faster by ${Math.abs(latencyDiff)}ms)`);

    // Success rate
    lines.push(`Success rate: ${(metricsA.synthesis.success_rate * 100).toFixed(1)}% vs ${(metricsB.synthesis.success_rate * 100).toFixed(1)}%`);

    // Throughput
    lines.push(`Throughput: ${metricsA.synthesis.chars_per_second.toFixed(1)} vs ${metricsB.synthesis.chars_per_second.toFixed(1)} chars/sec`);

    if (winner) {
      lines.push(`\nWinner: ${winner}`);
    } else {
      lines.push(`\nResult: Tie (no significant difference)`);
    }

    return lines.join("\n");
  }
}
```

### Regression Detector

```typescript
// plugins/voice/specs/03-quality-testing/src/regression-detector.ts

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { QualityMetrics, QualityBaseline, QualityGates } from "./types.js";

const BASELINES_DIR = join(__dirname, "../baselines");

export class RegressionDetector {
  private baselines: Map<string, QualityBaseline> = new Map();
  private gates: QualityGates;

  constructor() {
    this.loadBaselines();
    this.loadGates();
  }

  private loadBaselines(): void {
    const baselineFiles = ["elevenlabs.json", "piper.json", "huggingface-xtts.json"];

    for (const file of baselineFiles) {
      const path = join(BASELINES_DIR, file);
      if (existsSync(path)) {
        const baseline = JSON.parse(readFileSync(path, "utf-8"));
        this.baselines.set(baseline.backend, baseline);
      }
    }
  }

  private loadGates(): void {
    const gatesPath = join(BASELINES_DIR, "gates.json");
    if (existsSync(gatesPath)) {
      this.gates = JSON.parse(readFileSync(gatesPath, "utf-8"));
    } else {
      // Default gates
      this.gates = {
        latency_p95_max_ms: 3000,
        success_rate_min: 0.95,
        chars_per_second_min: 10,
      };
    }
  }

  checkRegression(metrics: QualityMetrics): RegressionReport {
    const baseline = this.baselines.get(metrics.backend);
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check against gates
    if (metrics.latency.p95_ms > this.gates.latency_p95_max_ms) {
      violations.push(`Latency p95 (${metrics.latency.p95_ms}ms) exceeds gate (${this.gates.latency_p95_max_ms}ms)`);
    }

    if (metrics.synthesis.success_rate < this.gates.success_rate_min) {
      violations.push(`Success rate (${(metrics.synthesis.success_rate * 100).toFixed(1)}%) below gate (${this.gates.success_rate_min * 100}%)`);
    }

    if (metrics.synthesis.chars_per_second < this.gates.chars_per_second_min) {
      violations.push(`Throughput (${metrics.synthesis.chars_per_second.toFixed(1)} c/s) below gate (${this.gates.chars_per_second_min} c/s)`);
    }

    // Check against baseline (if exists)
    if (baseline) {
      const latencyIncrease = (metrics.latency.p95_ms - baseline.metrics.latency.p95_ms) / baseline.metrics.latency.p95_ms;
      if (latencyIncrease > 0.2) {  // 20% regression
        warnings.push(`Latency increased ${(latencyIncrease * 100).toFixed(1)}% from baseline`);
      }

      const successDecrease = baseline.metrics.synthesis.success_rate - metrics.synthesis.success_rate;
      if (successDecrease > 0.05) {  // 5% drop
        warnings.push(`Success rate dropped ${(successDecrease * 100).toFixed(1)}% from baseline`);
      }
    }

    return {
      backend: metrics.backend,
      timestamp: new Date().toISOString(),
      passed: violations.length === 0,
      violations,
      warnings,
      metrics,
      baseline: baseline?.metrics,
    };
  }

  updateBaseline(metrics: QualityMetrics): void {
    const baseline: QualityBaseline = {
      backend: metrics.backend,
      created: new Date().toISOString(),
      metrics,
      gates: this.gates,
    };

    const path = join(BASELINES_DIR, `${metrics.backend}.json`);
    writeFileSync(path, JSON.stringify(baseline, null, 2));
    this.baselines.set(metrics.backend, baseline);
  }
}

interface RegressionReport {
  backend: string;
  timestamp: string;
  passed: boolean;
  violations: string[];
  warnings: string[];
  metrics: QualityMetrics;
  baseline?: QualityMetrics;
}
```

### Dashboard Generator

```typescript
// plugins/voice/specs/03-quality-testing/src/dashboard.ts

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { QualityMetrics, ABTestResult } from "./types.js";

const QUALITY_DIR = join(process.cwd(), ".claude/voice/quality");

export class Dashboard {
  constructor() {
    if (!existsSync(QUALITY_DIR)) {
      mkdirSync(QUALITY_DIR, { recursive: true });
    }
  }

  appendMetrics(metrics: QualityMetrics): void {
    const logPath = join(QUALITY_DIR, "metrics.jsonl");
    const line = JSON.stringify(metrics) + "\n";

    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, "utf-8");
      writeFileSync(logPath, existing + line);
    } else {
      writeFileSync(logPath, line);
    }
  }

  appendABTest(result: ABTestResult): void {
    const logPath = join(QUALITY_DIR, "ab-tests.jsonl");
    const line = JSON.stringify(result) + "\n";

    if (existsSync(logPath)) {
      const existing = readFileSync(logPath, "utf-8");
      writeFileSync(logPath, existing + line);
    } else {
      writeFileSync(logPath, line);
    }
  }

  generateReport(): string {
    const metricsPath = join(QUALITY_DIR, "metrics.jsonl");
    if (!existsSync(metricsPath)) {
      return "No metrics data available.";
    }

    const lines = readFileSync(metricsPath, "utf-8").trim().split("\n");
    const metrics: QualityMetrics[] = lines.map(l => JSON.parse(l));

    // Group by backend
    const byBackend = new Map<string, QualityMetrics[]>();
    for (const m of metrics) {
      const arr = byBackend.get(m.backend) || [];
      arr.push(m);
      byBackend.set(m.backend, arr);
    }

    let report = "# Voice Quality Report\n\n";
    report += `Generated: ${new Date().toISOString()}\n\n`;

    for (const [backend, data] of byBackend) {
      const latest = data[data.length - 1];

      report += `## ${backend}\n\n`;
      report += `| Metric | Value |\n`;
      report += `|--------|-------|\n`;
      report += `| Latency (p50) | ${latest.latency.p50_ms}ms |\n`;
      report += `| Latency (p95) | ${latest.latency.p95_ms}ms |\n`;
      report += `| Success Rate | ${(latest.synthesis.success_rate * 100).toFixed(1)}% |\n`;
      report += `| Throughput | ${latest.synthesis.chars_per_second.toFixed(1)} chars/sec |\n`;
      report += `| Last Updated | ${latest.timestamp} |\n`;
      report += `\n`;
    }

    return report;
  }

  writeReport(): void {
    const report = this.generateReport();
    const reportPath = join(QUALITY_DIR, "REPORT.md");
    writeFileSync(reportPath, report);
  }
}
```

---

## CLI Runner

```typescript
// plugins/voice/specs/03-quality-testing/src/runner.ts

import { MetricsCollector } from "./metrics-collector.js";
import { ABTester } from "./ab-tester.js";
import { RegressionDetector } from "./regression-detector.js";
import { Dashboard } from "./dashboard.js";
import { STANDARD_TEST_CASES, LATENCY_TEST_CASES } from "./test-cases.js";

const commands = {
  async benchmark(backend: string) {
    console.log(`Benchmarking ${backend}...`);
    const collector = new MetricsCollector();
    const metrics = await collector.collectForBackend(backend, STANDARD_TEST_CASES);

    const dashboard = new Dashboard();
    dashboard.appendMetrics(metrics);

    console.log("\nResults:");
    console.log(`  Latency (p95): ${metrics.latency.p95_ms}ms`);
    console.log(`  Success Rate: ${(metrics.synthesis.success_rate * 100).toFixed(1)}%`);
    console.log(`  Throughput: ${metrics.synthesis.chars_per_second.toFixed(1)} chars/sec`);
  },

  async compare(backendA: string, backendB: string) {
    const tester = new ABTester();
    const result = await tester.compare(backendA, backendB, LATENCY_TEST_CASES);

    const dashboard = new Dashboard();
    dashboard.appendABTest(result);

    console.log("\n" + result.analysis);
  },

  async checkRegression(backend: string) {
    const collector = new MetricsCollector();
    const metrics = await collector.collectForBackend(backend, STANDARD_TEST_CASES);

    const detector = new RegressionDetector();
    const report = detector.checkRegression(metrics);

    if (report.passed) {
      console.log(`✅ ${backend}: All quality gates passed`);
    } else {
      console.log(`❌ ${backend}: Quality gate violations:`);
      for (const v of report.violations) {
        console.log(`  - ${v}`);
      }
    }

    if (report.warnings.length > 0) {
      console.log(`⚠️  Warnings:`);
      for (const w of report.warnings) {
        console.log(`  - ${w}`);
      }
    }

    return report.passed;
  },

  async updateBaseline(backend: string) {
    const collector = new MetricsCollector();
    const metrics = await collector.collectForBackend(backend, STANDARD_TEST_CASES);

    const detector = new RegressionDetector();
    detector.updateBaseline(metrics);

    console.log(`✅ Updated baseline for ${backend}`);
  },

  async report() {
    const dashboard = new Dashboard();
    dashboard.writeReport();
    console.log("Report written to .claude/voice/quality/REPORT.md");
  },
};

// CLI entry point
const [cmd, ...args] = process.argv.slice(2);
if (cmd && commands[cmd as keyof typeof commands]) {
  commands[cmd as keyof typeof commands](...args).catch(console.error);
} else {
  console.log("Usage: bun run runner.ts <command> [args]");
  console.log("Commands: benchmark, compare, checkRegression, updateBaseline, report");
}
```

---

## CI Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/voice-quality.yml

name: Voice Quality Check

on:
  push:
    paths:
      - 'plugins/voice/**'
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: |
          pip install piper-tts
          bun install

      - name: Run quality gates
        run: |
          cd plugins/voice/specs/03-quality-testing
          bun run src/runner.ts checkRegression piper

      - name: Generate report
        run: |
          cd plugins/voice/specs/03-quality-testing
          bun run src/runner.ts report

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: quality-report
          path: .claude/voice/quality/REPORT.md
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/03-quality-testing/tests/collector.test.ts

describe("MetricsCollector", () => {
  test("calculates percentiles correctly", () => {
    const latencies = [100, 200, 300, 400, 500];
    expect(percentile(latencies, 50)).toBe(300);
    expect(percentile(latencies, 90)).toBe(500);
  });

  test("handles empty results", async () => {
    // Mock adapter that always fails
    const collector = new MetricsCollector();
    const metrics = await collector.collectForBackend("mock-fail", []);
    expect(metrics.synthesis.success_rate).toBe(NaN);  // No tests run
  });
});
```

---

## Success Criteria

1. [ ] Metrics collector measures latency percentiles accurately
2. [ ] A/B tester produces valid comparisons
3. [ ] Regression detector catches quality drops
4. [ ] Dashboard generates readable reports
5. [ ] CI integration works in GitHub Actions
6. [ ] Baselines established for at least 2 backends

---

## Deliverables

```
plugins/voice/specs/03-quality-testing/
├── SPEC.md
├── src/
│   ├── types.ts
│   ├── test-cases.ts
│   ├── metrics-collector.ts
│   ├── ab-tester.ts
│   ├── regression-detector.ts
│   ├── dashboard.ts
│   └── runner.ts
├── tests/
│   ├── collector.test.ts
│   ├── ab-tester.test.ts
│   └── regression.test.ts
├── baselines/
│   └── gates.json
├── scripts/
│   └── run-quality-tests.sh
└── README.md
```
