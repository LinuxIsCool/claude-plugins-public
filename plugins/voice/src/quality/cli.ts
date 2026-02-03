#!/usr/bin/env bun
/**
 * Voice Quality Testing Framework - CLI
 *
 * Command-line interface for running quality tests.
 *
 * Usage:
 *   bun run src/quality/cli.ts benchmark <backend>
 *   bun run src/quality/cli.ts compare <backendA> <backendB>
 *   bun run src/quality/cli.ts regression <backend>
 *   bun run src/quality/cli.ts baseline <backend>
 *   bun run src/quality/cli.ts report
 */

import { createQualityTester } from "./tester.js";

const HELP = `
Voice Quality Testing CLI

Usage:
  bun run src/quality/cli.ts <command> [args]

Commands:
  benchmark <backend>            Collect metrics for a backend
  compare <backendA> <backendB>  A/B test between two backends
  regression <backend>           Check for regressions against baseline
  baseline <backend>             Update baseline for a backend
  report                         Generate quality report
  list                           List available backends

Options:
  --help, -h     Show this help message
  --iterations   Number of iterations per sample (default: 3)
  --output       Output directory for results

Examples:
  bun run src/quality/cli.ts benchmark pyttsx3
  bun run src/quality/cli.ts compare pyttsx3 huggingface-xtts
  bun run src/quality/cli.ts regression pyttsx3
  bun run src/quality/cli.ts baseline pyttsx3
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    process.exit(0);
  }

  const command = args[0];
  const tester = createQualityTester();

  try {
    switch (command) {
      case "benchmark": {
        const backend = args[1];
        if (!backend) {
          console.error("Error: backend name required");
          console.error("Usage: bun run src/quality/cli.ts benchmark <backend>");
          process.exit(1);
        }

        if (!(await tester.isBackendAvailable(backend))) {
          console.error(`Error: backend "${backend}" is not available`);
          process.exit(1);
        }

        console.log(`\nBenchmarking ${backend}...\n`);
        const metrics = await tester.collectMetrics(backend);

        console.log("\n--- Results ---");
        console.log(`Backend: ${metrics.backend}`);
        console.log(`Samples: ${metrics.sampleCount} x ${metrics.iterations} iterations`);
        console.log(`\nLatency:`);
        console.log(`  p50:  ${metrics.latency.p50Ms.toFixed(0)}ms`);
        console.log(`  p95:  ${metrics.latency.p95Ms.toFixed(0)}ms`);
        console.log(`  p99:  ${metrics.latency.p99Ms.toFixed(0)}ms`);
        console.log(`  mean: ${metrics.latency.meanMs.toFixed(0)}ms`);
        console.log(`\nSynthesis:`);
        console.log(`  Success Rate: ${(metrics.synthesis.successRate * 100).toFixed(1)}%`);
        console.log(`  Throughput:   ${metrics.synthesis.charsPerSecond.toFixed(1)} chars/sec`);
        console.log(`  Errors:       ${metrics.synthesis.errorCount}`);

        const report = tester.generateReport({ metrics });
        const reportPath = await tester.writeReport(report);
        console.log(`\nReport saved to: ${reportPath}`);
        break;
      }

      case "compare": {
        const backendA = args[1];
        const backendB = args[2];

        if (!backendA || !backendB) {
          console.error("Error: two backend names required");
          console.error("Usage: bun run src/quality/cli.ts compare <backendA> <backendB>");
          process.exit(1);
        }

        if (!(await tester.isBackendAvailable(backendA))) {
          console.error(`Error: backend "${backendA}" is not available`);
          process.exit(1);
        }

        if (!(await tester.isBackendAvailable(backendB))) {
          console.error(`Error: backend "${backendB}" is not available`);
          process.exit(1);
        }

        console.log(`\nComparing ${backendA} vs ${backendB}...\n`);
        const result = await tester.runABTest(backendA, backendB);

        console.log("\n--- A/B Test Results ---");
        console.log(`\n${result.analysis}`);
        console.log(`\nConfidence: ${(result.confidence * 100).toFixed(0)}%`);

        const report = tester.generateReport({ comparison: result });
        const reportPath = await tester.writeReport(report, `ab-${backendA}-vs-${backendB}.md`);
        console.log(`\nReport saved to: ${reportPath}`);
        break;
      }

      case "regression": {
        const backend = args[1];
        if (!backend) {
          console.error("Error: backend name required");
          console.error("Usage: bun run src/quality/cli.ts regression <backend>");
          process.exit(1);
        }

        if (!(await tester.isBackendAvailable(backend))) {
          console.error(`Error: backend "${backend}" is not available`);
          process.exit(1);
        }

        console.log(`\nChecking regressions for ${backend}...\n`);
        const result = await tester.checkRegressions(backend);

        console.log("\n--- Regression Check ---");

        if (result.passed) {
          console.log(`\n✅ ${backend}: All quality gates passed`);
        } else {
          console.log(`\n❌ ${backend}: Quality gate violations detected`);
          for (const v of result.violations) {
            console.log(`  - ${v.message}`);
          }
        }

        if (result.warnings.length > 0) {
          console.log(`\n⚠️  Warnings:`);
          for (const w of result.warnings) {
            console.log(`  - ${w.message}`);
          }
        }

        if (!result.baseline) {
          console.log(`\nNote: No baseline found for ${backend}. Run 'baseline ${backend}' to create one.`);
        }

        const report = tester.generateReport({ regression: result });
        const reportPath = await tester.writeReport(report, `regression-${backend}.md`);
        console.log(`\nReport saved to: ${reportPath}`);

        // Exit with non-zero code if failed
        if (!result.passed) {
          process.exit(1);
        }
        break;
      }

      case "baseline": {
        const backend = args[1];
        if (!backend) {
          console.error("Error: backend name required");
          console.error("Usage: bun run src/quality/cli.ts baseline <backend>");
          process.exit(1);
        }

        if (!(await tester.isBackendAvailable(backend))) {
          console.error(`Error: backend "${backend}" is not available`);
          process.exit(1);
        }

        console.log(`\nEstablishing baseline for ${backend}...\n`);
        await tester.updateBaseline(backend);
        console.log(`\n✅ Baseline updated for ${backend}`);
        break;
      }

      case "report": {
        console.log("\nGenerating combined report...");
        // For now, just show help - in full implementation, this would
        // read from JSONL and generate a combined report
        console.log("Combined report generation not yet implemented.");
        console.log("Use individual commands to generate per-backend reports.");
        break;
      }

      case "list": {
        console.log("\nAvailable backends:\n");
        const backends = tester.listBackends();
        for (const backend of backends) {
          const available = await tester.isBackendAvailable(backend);
          const status = available ? "✅" : "❌";
          console.log(`  ${status} ${backend}`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(2);
  }
}

main();
