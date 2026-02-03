/**
 * @fileoverview GraphQL Directives Index
 * @module kg-explorer/graphql/directives
 *
 * Exports all custom directives for the KG Explorer GraphQL API.
 */

export {
  temporalDirectiveTypeDefs,
  temporalDirectiveTransformer,
  parseTemporalArgs,
  buildTemporalCypherClause,
  buildTemporalTypeQLClause,
} from "./temporal.directive";

export {
  cachedDirectiveTypeDefs,
  cachedDirectiveTransformer,
  invalidateEntity,
  invalidateTrigger,
  invalidateField,
  warmCache,
  CacheStats,
} from "./cached.directive";

export {
  authDirectiveTypeDefs,
  authDirectiveTransformer,
  registerPolicy,
  getPolicy,
  createUserContext,
  hasRole,
  hasScope,
  requireRole,
  requireScope,
  AuthorizationError,
  type PolicyFunction,
} from "./auth.directive";

export {
  tracedDirectiveTypeDefs,
  tracedDirectiveTransformer,
  createTraceContext,
  startTrace,
  endTrace,
  recordSource,
  recordTransformation,
  recordError,
  buildProvenanceChain,
  formatTrace,
  type TraceContext,
  type TraceEntry,
  type TraceSource,
  type TraceTransformation,
  type ProvenanceChain,
} from "./traced.directive";

import type { GraphQLSchema } from "graphql";
import { temporalDirectiveTransformer } from "./temporal.directive";
import { cachedDirectiveTransformer } from "./cached.directive";
import { authDirectiveTransformer } from "./auth.directive";
import { tracedDirectiveTransformer } from "./traced.directive";

/**
 * All directive type definitions combined.
 */
export const directiveTypeDefs = `
  """
  Enable bi-temporal queries on a field.
  Supports point-in-time (asOf) and range queries (validDuring).
  """
  directive @temporal(
    """Track valid time (when fact is true in the world)"""
    validTime: Boolean = true
    """Track transaction time (when fact was recorded)"""
    transactionTime: Boolean = false
  ) on FIELD_DEFINITION

  """Cache scope for @cached directive"""
  enum CacheScope {
    """Shared across all users"""
    PUBLIC
    """Per-user cache"""
    PRIVATE
    """Per-session cache"""
    SESSION
  }

  """
  Cache field results with intelligent invalidation.
  Respects entity mutations and temporal boundaries.
  """
  directive @cached(
    """Time-to-live in seconds"""
    ttl: Int = 300
    """Cache scope"""
    scope: CacheScope = PUBLIC
    """Invalidation triggers"""
    invalidateOn: [String!]
  ) on FIELD_DEFINITION

  """
  Authorization directive for field-level access control.
  Supports role-based and attribute-based access.
  """
  directive @auth(
    """Required roles (any match grants access)"""
    roles: [String!]
    """Required scopes (all must match)"""
    scopes: [String!]
    """Custom policy function"""
    policy: String
  ) on FIELD_DEFINITION | OBJECT

  """Trace level for @traced directive"""
  enum TraceLevel {
    """Only final provenance summary"""
    SUMMARY
    """Include major transformation steps"""
    STANDARD
    """Complete trace with all intermediate data"""
    FULL
  }

  """
  Query provenance tracking for insight lineage.
  Records which data sources contributed to a result.
  """
  directive @traced(
    """Trace level: full captures all intermediate steps"""
    level: TraceLevel = SUMMARY
    """Include timing information"""
    timing: Boolean = true
  ) on FIELD_DEFINITION | QUERY

  """Query complexity cost annotation"""
  directive @complexity(
    """Base cost of this field"""
    value: Int = 1
    """Multiply cost by these arguments"""
    multipliers: [String!]
  ) on FIELD_DEFINITION

  """Mark field as deprecated with migration path"""
  directive @deprecated(
    reason: String
    """Replacement field path"""
    replacedBy: String
    """Version when removed"""
    removeIn: String
  ) on FIELD_DEFINITION | ENUM_VALUE
`;

/**
 * Apply all directive transformers to a schema.
 *
 * @param schema - Original GraphQL schema
 * @returns Schema with all directives applied
 */
export function applyDirectives(schema: GraphQLSchema): GraphQLSchema {
  let result = schema;

  // Apply directives in order (order matters for some interactions)
  result = authDirectiveTransformer(result);
  result = cachedDirectiveTransformer(result);
  result = temporalDirectiveTransformer(result);
  result = tracedDirectiveTransformer(result);

  return result;
}
