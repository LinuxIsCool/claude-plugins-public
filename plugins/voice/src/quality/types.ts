/**
 * Voice Quality Testing Framework - Types
 *
 * Core type definitions for metrics collection, A/B testing,
 * and regression detection.
 */

/**
 * Test sample for quality evaluation
 */
export interface TestSample {
  id: string;
  text: string;
  category: "short" | "medium" | "long" | "edge_case";
  charCount: number;
}

/**
 * Latency metrics collected from synthesis operations
 */
export interface LatencyMetrics {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

/**
 * Synthesis metrics for throughput and success tracking
 */
export interface SynthesisMetrics {
  totalChars: number;
  totalDurationMs: number;
  charsPerSecond: number;
  successRate: number;
  errorCount: number;
}

/**
 * Complete quality metrics for a backend
 */
export interface QualityMetrics {
  timestamp: string;
  backend: string;
  testSuite: string;
  sampleCount: number;
  iterations: number;
  latency: LatencyMetrics;
  synthesis: SynthesisMetrics;
}

/**
 * Individual test run result
 */
export interface TestRun {
  sampleId: string;
  text: string;
  charCount: number;
  processingTimeMs: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * A/B test comparison result
 */
export interface ABTestResult {
  timestamp: string;
  backendA: string;
  backendB: string;
  testCaseIds: string[];
  iterations: number;
  metricsA: QualityMetrics;
  metricsB: QualityMetrics;
  winner?: string;
  confidence: number;
  analysis: string;
}

/**
 * Quality gates (hard limits)
 */
export interface QualityGates {
  latencyP95MaxMs: number;
  successRateMin: number;
  charsPerSecondMin: number;
}

/**
 * Stored baseline for regression detection
 */
export interface QualityBaseline {
  backend: string;
  created: string;
  metrics: QualityMetrics;
  gates: QualityGates;
}

/**
 * Gate violation (hard limit exceeded)
 */
export interface GateViolation {
  gate: keyof QualityGates;
  expected: number;
  actual: number;
  message: string;
}

/**
 * Regression warning (degradation from baseline)
 */
export interface RegressionWarning {
  metric: string;
  baselineValue: number;
  currentValue: number;
  changePercent: number;
  message: string;
}

/**
 * Regression check result
 */
export interface RegressionReport {
  backend: string;
  timestamp: string;
  passed: boolean;
  violations: GateViolation[];
  warnings: RegressionWarning[];
  metrics: QualityMetrics;
  baseline?: QualityMetrics;
}

/**
 * Configuration for quality testing
 */
export interface TestConfig {
  backends: string[];
  samples?: TestSample[];
  iterations?: number;
  outputDir?: string;
  baselineDir?: string;
  regressionThreshold?: number;
}

/**
 * Default quality gates
 */
export const DEFAULT_GATES: QualityGates = {
  latencyP95MaxMs: 5000,
  successRateMin: 0.90,
  charsPerSecondMin: 5,
};
