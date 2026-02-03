/**
 * Voice Quality Testing Framework
 *
 * Provides tools for measuring TTS backend quality,
 * comparing backends, and detecting performance regressions.
 *
 * @example
 * ```typescript
 * import { createQualityTester } from "./quality/index.js";
 *
 * const tester = createQualityTester();
 *
 * // Benchmark a backend
 * const metrics = await tester.collectMetrics("pyttsx3");
 *
 * // Compare two backends
 * const comparison = await tester.runABTest("pyttsx3", "huggingface-xtts");
 *
 * // Check for regressions
 * const report = await tester.checkRegressions("pyttsx3");
 * ```
 */

export { QualityTester, createQualityTester, STANDARD_SAMPLES } from "./tester.js";

export type {
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

export { DEFAULT_GATES } from "./types.js";
