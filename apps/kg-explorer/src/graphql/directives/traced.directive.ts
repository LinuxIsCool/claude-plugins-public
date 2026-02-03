/**
 * @fileoverview @traced Directive Implementation
 * @module kg-explorer/graphql/directives/traced
 *
 * Implements query provenance tracking for insight lineage.
 * Records which data sources contributed to a result and
 * the transformations applied.
 */

import { getDirective, MapperKind, mapSchema } from "@graphql-tools/utils";
import type { GraphQLSchema, GraphQLFieldConfig } from "graphql";
import type { GraphQLContext } from "../resolvers/types";

// =============================================================================
// Directive Definition
// =============================================================================

/**
 * Traced directive schema definition.
 *
 * Usage in schema:
 * ```graphql
 * directive @traced(
 *   level: TraceLevel = SUMMARY
 *   timing: Boolean = true
 * ) on FIELD_DEFINITION | QUERY
 *
 * type Query {
 *   search(input: SearchInput!): SearchResultConnection! @traced
 *   shortestPath(input: PathQueryInput!): [Entity!] @traced(level: FULL)
 * }
 * ```
 */
export const tracedDirectiveTypeDefs = `
  enum TraceLevel {
    """Only final provenance summary"""
    SUMMARY
    """Include major transformation steps"""
    STANDARD
    """Complete trace with all intermediate data"""
    FULL
  }

  directive @traced(
    """Trace level: full captures all intermediate steps"""
    level: TraceLevel = SUMMARY
    """Include timing information"""
    timing: Boolean = true
  ) on FIELD_DEFINITION | QUERY
`;

// =============================================================================
// Types
// =============================================================================

interface TracedDirectiveArgs {
  level?: "SUMMARY" | "STANDARD" | "FULL";
  timing?: boolean;
}

/**
 * Trace entry for a single operation.
 */
export interface TraceEntry {
  /** Unique ID for this trace step */
  stepId: string;
  /** Operation name */
  operation: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Data sources accessed */
  sources: TraceSource[];
  /** Transformations applied */
  transformations: TraceTransformation[];
  /** Input summary */
  inputSummary?: Record<string, unknown>;
  /** Output summary */
  outputSummary?: Record<string, unknown>;
  /** Child trace entries */
  children: TraceEntry[];
  /** Error if operation failed */
  error?: string;
}

/**
 * A data source accessed during tracing.
 */
export interface TraceSource {
  /** Source type */
  type: "ENTITY" | "RELATIONSHIP" | "QUERY" | "EXTERNAL_API" | "CACHE";
  /** Source identifier */
  identifier: string;
  /** Number of items from this source */
  count?: number;
  /** Timestamp of access */
  accessedAt: number;
}

/**
 * A transformation applied during tracing.
 */
export interface TraceTransformation {
  /** Transformation type */
  type: "FILTER" | "MAP" | "AGGREGATE" | "SORT" | "JOIN" | "INFERENCE" | "ENRICHMENT";
  /** Description of transformation */
  description: string;
  /** Input count */
  inputCount: number;
  /** Output count */
  outputCount: number;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Complete trace context for a request.
 */
export interface TraceContext {
  /** Request trace ID */
  traceId: string;
  /** Current active trace entries */
  entries: TraceEntry[];
  /** Current entry stack (for nesting) */
  stack: TraceEntry[];
  /** Trace level */
  level: "SUMMARY" | "STANDARD" | "FULL";
  /** Whether to include timing */
  includeTiming: boolean;
}

/**
 * Provenance chain built from trace.
 */
export interface ProvenanceChain {
  chainId: string;
  sources: Array<{
    type: string;
    identifier: string;
    timestamp?: string;
    confidence?: number;
  }>;
  transformations: Array<{
    type: string;
    operation: string;
    inputCount: number;
    outputCount: number;
    timestamp: string;
  }>;
  isComplete: boolean;
  missingLinks: string[];
}

// =============================================================================
// Trace Context Management
// =============================================================================

/**
 * Create a new trace context for a request.
 */
export function createTraceContext(
  traceId: string,
  level: TracedDirectiveArgs["level"] = "SUMMARY",
  includeTiming: boolean = true
): TraceContext {
  return {
    traceId,
    entries: [],
    stack: [],
    level: level ?? "SUMMARY",
    includeTiming,
  };
}

/**
 * Start a new trace entry.
 */
export function startTrace(
  context: TraceContext,
  operation: string
): TraceEntry {
  const entry: TraceEntry = {
    stepId: generateStepId(),
    operation,
    startTime: Date.now(),
    sources: [],
    transformations: [],
    children: [],
  };

  // Add to parent if in a nested context
  if (context.stack.length > 0) {
    const parent = context.stack[context.stack.length - 1];
    parent.children.push(entry);
  } else {
    context.entries.push(entry);
  }

  // Push to stack for nesting
  context.stack.push(entry);

  return entry;
}

/**
 * End a trace entry.
 */
export function endTrace(
  context: TraceContext,
  entry: TraceEntry,
  outputSummary?: Record<string, unknown>
): void {
  entry.endTime = Date.now();
  entry.durationMs = entry.endTime - entry.startTime;
  entry.outputSummary = outputSummary;

  // Pop from stack
  context.stack.pop();
}

/**
 * Record a data source access.
 */
export function recordSource(
  context: TraceContext,
  source: Omit<TraceSource, "accessedAt">
): void {
  if (context.stack.length === 0) return;

  const current = context.stack[context.stack.length - 1];
  current.sources.push({
    ...source,
    accessedAt: Date.now(),
  });
}

/**
 * Record a transformation.
 */
export function recordTransformation(
  context: TraceContext,
  transformation: Omit<TraceTransformation, "durationMs">
): void {
  if (context.stack.length === 0) return;

  const current = context.stack[context.stack.length - 1];
  current.transformations.push({
    ...transformation,
    durationMs: 0,
  });
}

/**
 * Record an error in the current trace.
 */
export function recordError(context: TraceContext, error: Error): void {
  if (context.stack.length === 0) return;

  const current = context.stack[context.stack.length - 1];
  current.error = error.message;
}

// =============================================================================
// Directive Transformer
// =============================================================================

/**
 * Transform schema to apply traced directive logic.
 *
 * @param schema - Original GraphQL schema
 * @returns Schema with traced directive applied
 */
export function tracedDirectiveTransformer(
  schema: GraphQLSchema
): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (
      fieldConfig: GraphQLFieldConfig<unknown, GraphQLContext>
    ) => {
      const tracedDirective = getDirective(
        schema,
        fieldConfig,
        "traced"
      )?.[0] as TracedDirectiveArgs | undefined;

      if (!tracedDirective) {
        return fieldConfig;
      }

      const { resolve: originalResolve } = fieldConfig;

      if (!originalResolve) {
        return fieldConfig;
      }

      // Wrap resolver with tracing
      fieldConfig.resolve = async (source, args, context, info) => {
        // Create or get trace context
        let traceContext = (context as unknown as { _trace?: TraceContext })._trace;
        if (!traceContext) {
          traceContext = createTraceContext(
            context.traceId,
            tracedDirective.level,
            tracedDirective.timing ?? true
          );
          (context as unknown as { _trace: TraceContext })._trace = traceContext;
        }

        // Start trace
        const traceEntry = startTrace(traceContext, info.fieldName);

        // Record input summary (based on trace level)
        if (traceContext.level !== "SUMMARY") {
          traceEntry.inputSummary = summarizeInput(source, args, traceContext.level);
        }

        try {
          // Execute resolver
          const result = await originalResolve(source, args, context, info);

          // End trace with output summary
          const outputSummary =
            traceContext.level !== "SUMMARY"
              ? summarizeOutput(result, traceContext.level)
              : undefined;

          endTrace(traceContext, traceEntry, outputSummary);

          // Attach provenance to result if it's an object
          if (result && typeof result === "object" && !Array.isArray(result)) {
            attachProvenance(result, traceContext, traceEntry);
          }

          return result;
        } catch (error) {
          recordError(traceContext, error as Error);
          endTrace(traceContext, traceEntry);
          throw error;
        }
      };

      return fieldConfig;
    },
  });
}

// =============================================================================
// Provenance Building
// =============================================================================

/**
 * Build a provenance chain from trace entries.
 */
export function buildProvenanceChain(
  traceContext: TraceContext
): ProvenanceChain {
  const sources: ProvenanceChain["sources"] = [];
  const transformations: ProvenanceChain["transformations"] = [];
  const missingLinks: string[] = [];

  // Collect sources and transformations from all entries
  function processEntry(entry: TraceEntry): void {
    for (const source of entry.sources) {
      sources.push({
        type: source.type,
        identifier: source.identifier,
        timestamp: new Date(source.accessedAt).toISOString(),
        confidence: 1.0, // Could be refined based on source type
      });
    }

    for (const transform of entry.transformations) {
      transformations.push({
        type: transform.type,
        operation: transform.description,
        inputCount: transform.inputCount,
        outputCount: transform.outputCount,
        timestamp: new Date(entry.startTime).toISOString(),
      });
    }

    // Process children
    for (const child of entry.children) {
      processEntry(child);
    }
  }

  for (const entry of traceContext.entries) {
    processEntry(entry);
  }

  // Check for completeness
  const isComplete = sources.length > 0 && missingLinks.length === 0;

  return {
    chainId: traceContext.traceId,
    sources,
    transformations,
    isComplete,
    missingLinks,
  };
}

/**
 * Attach provenance information to a result object.
 */
function attachProvenance(
  result: Record<string, unknown>,
  traceContext: TraceContext,
  currentEntry: TraceEntry
): void {
  // Only attach if result doesn't already have provenance
  if ("_provenance" in result) {
    return;
  }

  // Build simplified provenance for this specific result
  Object.defineProperty(result, "_provenance", {
    value: {
      traceId: traceContext.traceId,
      stepId: currentEntry.stepId,
      sources: currentEntry.sources.map((s) => ({
        type: s.type,
        identifier: s.identifier,
      })),
      transformations: currentEntry.transformations.map((t) => t.type),
    },
    enumerable: false, // Don't include in JSON serialization by default
    writable: false,
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function summarizeInput(
  source: unknown,
  args: unknown,
  level: "STANDARD" | "FULL"
): Record<string, unknown> {
  if (level === "FULL") {
    return {
      source: summarizeValue(source, 3),
      args: summarizeValue(args, 3),
    };
  }

  return {
    sourceType: source ? typeof source : "null",
    hasArgs: !!args && Object.keys(args as object).length > 0,
  };
}

function summarizeOutput(
  result: unknown,
  level: "STANDARD" | "FULL"
): Record<string, unknown> {
  if (level === "FULL") {
    return {
      result: summarizeValue(result, 3),
    };
  }

  if (Array.isArray(result)) {
    return {
      type: "array",
      count: result.length,
    };
  }

  if (result && typeof result === "object") {
    return {
      type: "object",
      keys: Object.keys(result).slice(0, 10),
    };
  }

  return {
    type: typeof result,
  };
}

function summarizeValue(value: unknown, maxDepth: number): unknown {
  if (maxDepth <= 0) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length <= 5) {
      return value.map((v) => summarizeValue(v, maxDepth - 1));
    }
    return {
      _type: "array",
      length: value.length,
      sample: value.slice(0, 3).map((v) => summarizeValue(v, maxDepth - 1)),
    };
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    if (keys.length <= 10) {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        result[key] = summarizeValue(obj[key], maxDepth - 1);
      }
      return result;
    }

    return {
      _type: "object",
      keyCount: keys.length,
      sampleKeys: keys.slice(0, 5),
    };
  }

  // Primitive values
  if (typeof value === "string" && value.length > 100) {
    return value.slice(0, 100) + "...";
  }

  return value;
}

// =============================================================================
// Trace Visualization
// =============================================================================

/**
 * Format trace entries as a human-readable string.
 */
export function formatTrace(traceContext: TraceContext): string {
  const lines: string[] = [];
  lines.push(`Trace ID: ${traceContext.traceId}`);
  lines.push(`Level: ${traceContext.level}`);
  lines.push("");

  function formatEntry(entry: TraceEntry, indent: number): void {
    const prefix = "  ".repeat(indent);
    const duration = entry.durationMs ? `(${entry.durationMs}ms)` : "";

    lines.push(`${prefix}[${entry.operation}] ${duration}`);

    if (entry.sources.length > 0) {
      lines.push(`${prefix}  Sources:`);
      for (const source of entry.sources) {
        lines.push(`${prefix}    - ${source.type}: ${source.identifier}`);
      }
    }

    if (entry.transformations.length > 0) {
      lines.push(`${prefix}  Transformations:`);
      for (const transform of entry.transformations) {
        lines.push(
          `${prefix}    - ${transform.type}: ${transform.description} (${transform.inputCount} -> ${transform.outputCount})`
        );
      }
    }

    if (entry.error) {
      lines.push(`${prefix}  Error: ${entry.error}`);
    }

    for (const child of entry.children) {
      formatEntry(child, indent + 1);
    }
  }

  for (const entry of traceContext.entries) {
    formatEntry(entry, 0);
  }

  return lines.join("\n");
}

export default tracedDirectiveTransformer;
