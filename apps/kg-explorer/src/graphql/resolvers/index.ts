/**
 * @fileoverview Resolver Index and Aggregation
 * @module kg-explorer/graphql/resolvers
 *
 * Exports all resolvers and provides the combined resolver map
 * for the GraphQL schema.
 */

// Type exports
export * from "./types";
export * from "./utils";

// Resolver imports
import repositoryResolvers from "./repository.resolver";
import queryResolvers from "./query.resolver";
import insightResolvers from "./insight.resolver";
import ontologyResolvers from "./ontology.resolver";

// =============================================================================
// Combined Resolver Map
// =============================================================================

/**
 * Combined resolvers for all types.
 * Merges Query, Mutation, Subscription, and type resolvers.
 */
export const resolvers = {
  // Root Query resolvers
  Query: {
    ...repositoryResolvers.Query,
    ...queryResolvers.Query,
    ...insightResolvers.Query,
    ...ontologyResolvers.Query,
  },

  // Root Mutation resolvers
  Mutation: {
    ...queryResolvers.Mutation,
    ...insightResolvers.Mutation,
    ...ontologyResolvers.Mutation,
  },

  // Root Subscription resolvers
  Subscription: {
    ...queryResolvers.Subscription,
    ...insightResolvers.Subscription,
  },

  // Type resolvers
  Repository: repositoryResolvers.Repository,
  Query: queryResolvers.Query,
  Insight: insightResolvers.Insight,
  Ontology: ontologyResolvers.Ontology,
  OntologyEntityType: ontologyResolvers.OntologyEntityType,
  OntologyRelationshipType: ontologyResolvers.OntologyRelationshipType,
  InferenceRule: ontologyResolvers.InferenceRule,

  // Union type resolver
  Entity: {
    __resolveType(obj: { __typename?: string; isOrganization?: boolean }) {
      if (obj.__typename) {
        return obj.__typename;
      }
      // Infer type from properties
      if ("fullName" in obj && "stars" in obj) {
        return "Repository";
      }
      if ("username" in obj) {
        return obj.isOrganization ? "Organization" : "Author";
      }
      if ("canonicalName" in obj && "category" in obj) {
        return "Technology";
      }
      if ("memberCount" in obj && "isVerified" in obj) {
        return "Organization";
      }
      return null;
    },
  },
};

// =============================================================================
// Individual Resolver Exports
// =============================================================================

export { default as repositoryResolvers } from "./repository.resolver";
export { default as queryResolvers } from "./query.resolver";
export { default as insightResolvers } from "./insight.resolver";
export { default as ontologyResolvers } from "./ontology.resolver";
