/**
 * @fileoverview GraphQL Module Index
 * @module kg-explorer/graphql
 *
 * Main entry point for the KG Explorer GraphQL API.
 * Exports schema, resolvers, directives, and utilities.
 */

// =============================================================================
// Schema Exports
// =============================================================================

import { readFileSync } from "fs";
import { join } from "path";
import { buildSchema, type GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";

import { resolvers } from "./resolvers";
import { directiveTypeDefs, applyDirectives } from "./directives";
import { createDataLoaders, primeLoaders, clearAllLoaders } from "./dataloaders";

// Read schema files
const schemaPath = join(__dirname, "schema.graphql");
const federationSchemaPath = join(__dirname, "federation.graphql");

/**
 * Load the main schema SDL.
 */
export function loadSchemaSDL(): string {
  return readFileSync(schemaPath, "utf-8");
}

/**
 * Load the federation schema SDL.
 */
export function loadFederationSchemaSDL(): string {
  return readFileSync(federationSchemaPath, "utf-8");
}

/**
 * Build the executable GraphQL schema with all resolvers and directives.
 */
export function buildExecutableSchema(): GraphQLSchema {
  const typeDefs = [directiveTypeDefs, loadSchemaSDL()];

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Apply custom directives
  schema = applyDirectives(schema);

  return schema;
}

/**
 * Build the federation-ready schema for Apollo Router.
 */
export function buildFederationSchema(): GraphQLSchema {
  const typeDefs = [directiveTypeDefs, loadFederationSchemaSDL()];

  let schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  schema = applyDirectives(schema);

  return schema;
}

// =============================================================================
// Resolver Exports
// =============================================================================

export { resolvers } from "./resolvers";
export * from "./resolvers/types";
export * from "./resolvers/utils";

// =============================================================================
// DataLoader Exports
// =============================================================================

export { createDataLoaders, primeLoaders, clearAllLoaders } from "./dataloaders";
export type { DataLoaders } from "./resolvers/types";

// =============================================================================
// Directive Exports
// =============================================================================

export {
  directiveTypeDefs,
  applyDirectives,
  // Temporal
  temporalDirectiveTypeDefs,
  temporalDirectiveTransformer,
  parseTemporalArgs,
  buildTemporalCypherClause,
  // Cached
  cachedDirectiveTypeDefs,
  cachedDirectiveTransformer,
  invalidateEntity,
  invalidateTrigger,
  CacheStats,
  // Auth
  authDirectiveTypeDefs,
  authDirectiveTransformer,
  registerPolicy,
  createUserContext,
  hasRole,
  hasScope,
  AuthorizationError,
  // Traced
  tracedDirectiveTypeDefs,
  tracedDirectiveTransformer,
  createTraceContext,
  buildProvenanceChain,
  formatTrace,
} from "./directives";

// =============================================================================
// Context Factory
// =============================================================================

import type {
  GraphQLContext,
  BackendClient,
  CacheClient,
  PubSubClient,
  UserContext,
} from "./resolvers/types";

/**
 * Options for creating GraphQL context.
 */
export interface ContextOptions {
  /** Graph database backend client */
  backend: BackendClient;
  /** Cache client for caching */
  cache: CacheClient;
  /** Pub/Sub client for subscriptions */
  pubsub: PubSubClient;
  /** Authenticated user (if any) */
  user?: UserContext;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Create a new GraphQL context for a request.
 *
 * @param options - Context options
 * @returns GraphQL context
 */
export function createContext(options: ContextOptions): GraphQLContext {
  const { backend, cache, pubsub, user, requestId } = options;

  const traceId = requestId ?? generateTraceId();

  return {
    loaders: createDataLoaders(backend, cache),
    backend,
    cache,
    pubsub,
    user,
    traceId,
    startTime: Date.now(),
  };
}

/**
 * Generate a trace ID for request tracking.
 */
function generateTraceId(): string {
  return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// Query Complexity Configuration
// =============================================================================

import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from "graphql-query-complexity";
import type { DocumentNode } from "graphql";

/**
 * Default complexity configuration.
 */
export const complexityConfig = {
  /** Maximum allowed query complexity */
  maxComplexity: 50000,
  /** Default cost per field */
  defaultFieldCost: 1,
  /** Cost multipliers for lists */
  listMultiplier: 10,
};

/**
 * Calculate query complexity.
 *
 * @param schema - GraphQL schema
 * @param query - Query document
 * @param variables - Query variables
 * @returns Complexity score
 */
export function calculateComplexity(
  schema: GraphQLSchema,
  query: DocumentNode,
  variables?: Record<string, unknown>
): number {
  return getComplexity({
    schema,
    query,
    variables: variables ?? {},
    estimators: [
      fieldExtensionsEstimator(),
      simpleEstimator({ defaultComplexity: complexityConfig.defaultFieldCost }),
    ],
  });
}

/**
 * Validate that query complexity is within limits.
 *
 * @param schema - GraphQL schema
 * @param query - Query document
 * @param variables - Query variables
 * @throws Error if complexity exceeds maximum
 */
export function validateComplexity(
  schema: GraphQLSchema,
  query: DocumentNode,
  variables?: Record<string, unknown>
): void {
  const complexity = calculateComplexity(schema, query, variables);

  if (complexity > complexityConfig.maxComplexity) {
    throw new Error(
      `Query complexity (${complexity}) exceeds maximum allowed (${complexityConfig.maxComplexity}). ` +
      `Consider adding pagination or reducing query depth.`
    );
  }
}

// =============================================================================
// Depth Limiting
// =============================================================================

import depthLimit from "graphql-depth-limit";
import type { ValidationRule } from "graphql";

/**
 * Get validation rules including depth limiting.
 *
 * @param maxDepth - Maximum query depth (default: 10)
 * @returns Array of validation rules
 */
export function getValidationRules(maxDepth: number = 10): ValidationRule[] {
  return [depthLimit(maxDepth)];
}

// =============================================================================
// Server Integration Helpers
// =============================================================================

/**
 * Configuration for Apollo Server integration.
 */
export const apolloServerConfig = {
  schema: () => buildExecutableSchema(),
  context: createContext,
  validationRules: getValidationRules(10),
  plugins: [
    // Complexity limiting plugin
    {
      requestDidStart: () => ({
        didResolveOperation: ({ request, document }: { request: { query?: string }; document: DocumentNode }) => {
          const schema = buildExecutableSchema();
          const complexity = calculateComplexity(schema, document, request.query as unknown as Record<string, unknown>);
          if (complexity > complexityConfig.maxComplexity) {
            throw new Error(`Query too complex: ${complexity}`);
          }
        },
      }),
    },
  ],
};

/**
 * Configuration for graphql-yoga integration.
 */
export const yogaServerConfig = {
  schema: buildExecutableSchema(),
  context: createContext,
};
