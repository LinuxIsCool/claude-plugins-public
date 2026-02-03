/**
 * @fileoverview GraphQL Resolver Type Definitions
 * @module kg-explorer/graphql/resolvers/types
 *
 * Shared types for all GraphQL resolvers including context,
 * DataLoader types, and backend abstractions.
 */

import type DataLoader from "dataloader";
import type {
  EntityId,
  RelationshipId,
  QueryId,
  InsightId,
  ISOTimestamp,
} from "../../types/utility-types";

// =============================================================================
// Enums (matching schema.graphql)
// =============================================================================

export const EntityType = {
  REPOSITORY: "REPOSITORY",
  AUTHOR: "AUTHOR",
  TECHNOLOGY: "TECHNOLOGY",
  ORGANIZATION: "ORGANIZATION",
  CONCEPT: "CONCEPT",
  DOCUMENT: "DOCUMENT",
  COMMIT: "COMMIT",
  ISSUE: "ISSUE",
  PULL_REQUEST: "PULL_REQUEST",
  RELEASE: "RELEASE",
  LICENSE: "LICENSE",
  TOPIC: "TOPIC",
  COMMUNITY: "COMMUNITY",
} as const;

export type EntityTypeValue = (typeof EntityType)[keyof typeof EntityType];

export const RelationType = {
  AUTHORED_BY: "AUTHORED_BY",
  CONTRIBUTES_TO: "CONTRIBUTES_TO",
  DEPENDS_ON: "DEPENDS_ON",
  USES_TECHNOLOGY: "USES_TECHNOLOGY",
  FORKED_FROM: "FORKED_FROM",
  AFFILIATED_WITH: "AFFILIATED_WITH",
  RELATED_TO: "RELATED_TO",
  MENTIONS: "MENTIONS",
  IMPLEMENTS: "IMPLEMENTS",
  PART_OF: "PART_OF",
  SUPERSEDES: "SUPERSEDES",
  COMPETES_WITH: "COMPETES_WITH",
  COMPLEMENTS: "COMPLEMENTS",
} as const;

export type RelationTypeValue = (typeof RelationType)[keyof typeof RelationType];

export const GraphBackend = {
  NEO4J: "NEO4J",
  TYPEDB: "TYPEDB",
  DGRAPH: "DGRAPH",
  FALKORDB: "FALKORDB",
  KUZU: "KUZU",
} as const;

export type GraphBackendValue = (typeof GraphBackend)[keyof typeof GraphBackend];

export const QueryStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  TIMEOUT: "TIMEOUT",
} as const;

export type QueryStatusValue = (typeof QueryStatus)[keyof typeof QueryStatus];

export const InsightType = {
  TREND: "TREND",
  ANOMALY: "ANOMALY",
  CORRELATION: "CORRELATION",
  PREDICTION: "PREDICTION",
  RECOMMENDATION: "RECOMMENDATION",
  COMMUNITY_DETECTION: "COMMUNITY_DETECTION",
  PATH_DISCOVERY: "PATH_DISCOVERY",
  PATTERN_MATCH: "PATTERN_MATCH",
} as const;

export type InsightTypeValue = (typeof InsightType)[keyof typeof InsightType];

export const ConfidenceLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  VERY_HIGH: "VERY_HIGH",
} as const;

export type ConfidenceLevelValue =
  (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];

export const SearchMode = {
  SEMANTIC: "SEMANTIC",
  KEYWORD: "KEYWORD",
  GRAPH: "GRAPH",
  HYBRID: "HYBRID",
} as const;

export type SearchModeValue = (typeof SearchMode)[keyof typeof SearchMode];

// Re-export branded types from utility-types
export type { EntityId, RelationshipId, QueryId, InsightId, ISOTimestamp };

// =============================================================================
// Core Entity Types
// =============================================================================

export interface RepositoryModel {
  id: EntityId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  validFrom?: ISOTimestamp;
  validTo?: ISOTimestamp;
  recordedAt?: ISOTimestamp;
  name: string;
  fullName: string;
  description?: string;
  primaryLanguage?: string;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  url: string;
  isArchived: boolean;
  isFork: boolean;
  defaultBranch: string;
  lastPushedAt?: ISOTimestamp;
  lastCommitAt?: ISOTimestamp;
  ownerId: EntityId;
  forkedFromId?: EntityId;
  licenseKey?: string;
  embedding?: number[];
  confidence?: number;
}

export interface AuthorModel {
  id: EntityId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  validFrom?: ISOTimestamp;
  validTo?: ISOTimestamp;
  recordedAt?: ISOTimestamp;
  username: string;
  displayName?: string;
  bio?: string;
  email?: string;
  location?: string;
  company?: string;
  url?: string;
  avatarUrl?: string;
  followers: number;
  following: number;
  publicRepoCount: number;
  githubCreatedAt?: ISOTimestamp;
  isOrganization: boolean;
  embedding?: number[];
  confidence?: number;
}

export interface TechnologyModel {
  id: EntityId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  validFrom?: ISOTimestamp;
  validTo?: ISOTimestamp;
  recordedAt?: ISOTimestamp;
  name: string;
  canonicalName: string;
  category: string;
  description?: string;
  documentationUrl?: string;
  repositoryUrl?: string;
  currentVersion?: string;
  isActive: boolean;
  firstReleaseDate?: ISOTimestamp;
  latestReleaseDate?: ISOTimestamp;
  embedding?: number[];
  confidence?: number;
}

export interface OrganizationModel {
  id: EntityId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  validFrom?: ISOTimestamp;
  validTo?: ISOTimestamp;
  recordedAt?: ISOTimestamp;
  name: string;
  displayName?: string;
  description?: string;
  websiteUrl?: string;
  location?: string;
  email?: string;
  avatarUrl?: string;
  memberCount?: number;
  publicRepoCount: number;
  isVerified: boolean;
  embedding?: number[];
}

export interface RelationshipModel {
  id: RelationshipId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  validFrom?: ISOTimestamp;
  validTo?: ISOTimestamp;
  recordedAt?: ISOTimestamp;
  type: RelationTypeValue;
  customType?: string;
  sourceId: EntityId;
  targetId: EntityId;
  weight?: number;
  properties?: Record<string, unknown>;
  confidence?: number;
}

export interface QueryModel {
  id: QueryId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  name?: string;
  naturalLanguageQuery: string;
  generatedQuery?: string;
  queryLanguage?: string;
  backend: GraphBackendValue;
  parameters?: Record<string, unknown>;
  status: QueryStatusValue;
  startedAt?: ISOTimestamp;
  completedAt?: ISOTimestamp;
  durationMs?: number;
  errorMessage?: string;
  complexityScore?: number;
  resultCount?: number;
  createdById?: EntityId;
}

export interface InsightModel {
  id: InsightId;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
  title: string;
  description: string;
  type: InsightTypeValue;
  confidenceLevel: ConfidenceLevelValue;
  confidenceScore: number;
  importanceScore: number;
  isActionable: boolean;
  suggestedActions: string[];
  involvedEntityIds: EntityId[];
  involvedRelationshipIds: RelationshipId[];
  sourceQueryId?: QueryId;
  applicablePeriodStart?: ISOTimestamp;
  applicablePeriodEnd?: ISOTimestamp;
  expiresAt?: ISOTimestamp;
  confidence?: number;
}

// =============================================================================
// DataLoader Types
// =============================================================================

export interface DataLoaders {
  repository: DataLoader<EntityId, RepositoryModel | null>;
  repositoryByName: DataLoader<string, RepositoryModel | null>;
  author: DataLoader<EntityId, AuthorModel | null>;
  authorByUsername: DataLoader<string, AuthorModel | null>;
  technology: DataLoader<EntityId, TechnologyModel | null>;
  technologyByName: DataLoader<string, TechnologyModel | null>;
  organization: DataLoader<EntityId, OrganizationModel | null>;
  relationship: DataLoader<RelationshipId, RelationshipModel | null>;
  outgoingRelationships: DataLoader<EntityId, RelationshipModel[]>;
  incomingRelationships: DataLoader<EntityId, RelationshipModel[]>;
  query: DataLoader<QueryId, QueryModel | null>;
  insight: DataLoader<InsightId, InsightModel | null>;
  insightsByQuery: DataLoader<QueryId, InsightModel[]>;
  contributorsByRepository: DataLoader<EntityId, ContributorInfo[]>;
  repositoriesByAuthor: DataLoader<EntityId, EntityId[]>;
  repositoriesByTechnology: DataLoader<EntityId, EntityId[]>;
  technologiesByRepository: DataLoader<EntityId, EntityId[]>;
}

export interface ContributorInfo {
  authorId: EntityId;
  contributions: number;
  firstContributionAt?: ISOTimestamp;
  lastContributionAt?: ISOTimestamp;
}

// =============================================================================
// Context Types
// =============================================================================

export interface GraphQLContext {
  loaders: DataLoaders;
  user?: UserContext;
  traceId: string;
  startTime: number;
  backend: BackendClient;
  cache: CacheClient;
  pubsub: PubSubClient;
  temporal?: TemporalContext;
}

export interface UserContext {
  id: string;
  username: string;
  roles: string[];
  scopes: string[];
}

export interface TemporalContext {
  asOf?: ISOTimestamp;
  asOfTransaction?: ISOTimestamp;
  validDuring?: {
    start: ISOTimestamp;
    end: ISOTimestamp;
  };
}

// =============================================================================
// Backend Abstraction
// =============================================================================

export interface BackendClient {
  type: GraphBackendValue;
  executeQuery<T>(query: string, parameters?: Record<string, unknown>): Promise<T[]>;
  findEntitiesByIds<T>(entityType: EntityTypeValue, ids: EntityId[]): Promise<Map<EntityId, T>>;
  findRelationshipsByIds(ids: RelationshipId[]): Promise<Map<RelationshipId, RelationshipModel>>;
  findOutgoingRelationships(entityId: EntityId, relationTypes?: RelationTypeValue[]): Promise<RelationshipModel[]>;
  findIncomingRelationships(entityId: EntityId, relationTypes?: RelationTypeValue[]): Promise<RelationshipModel[]>;
  semanticSearch(query: string, entityTypes: EntityTypeValue[], limit: number, minSimilarity: number): Promise<SearchResult[]>;
  keywordSearch(query: string, entityTypes: EntityTypeValue[], limit: number): Promise<SearchResult[]>;
  shortestPath(fromId: EntityId, toId: EntityId, maxLength: number, allowedRelations?: RelationTypeValue[]): Promise<PathResult | null>;
  allPaths(fromId: EntityId, toId: EntityId, maxLength: number, allowedRelations?: RelationTypeValue[]): Promise<PathResult[]>;
  getNeighborhood(entityId: EntityId, depth: number, relationTypes?: RelationTypeValue[], limit?: number): Promise<NeighborhoodResult>;
  detectCommunities(algorithm: string, options: CommunityDetectionOptions): Promise<CommunityResult[]>;
  getGraphStats(): Promise<GraphStats>;
}

export interface SearchResult {
  entityId: EntityId;
  entityType: EntityTypeValue;
  score: number;
  matchType: "EXACT" | "FUZZY" | "SEMANTIC" | "GRAPH";
  highlights?: Array<{ field: string; snippets: string[] }>;
}

export interface PathResult {
  nodeIds: EntityId[];
  edgeIds: RelationshipId[];
  length: number;
  cost?: number;
}

export interface NeighborhoodResult {
  centerEntityId: EntityId;
  entities: EntityId[];
  relationships: RelationshipId[];
  depth: number;
}

export interface CommunityDetectionOptions {
  minCommunitySize: number;
  resolution: number;
  entityTypes?: EntityTypeValue[];
  relationTypes?: RelationTypeValue[];
}

export interface CommunityResult {
  id: string;
  memberIds: EntityId[];
  density: number;
  hubIds: EntityId[];
  characteristics: string[];
}

export interface GraphStats {
  totalEntities: number;
  entitiesByType: Record<EntityTypeValue, number>;
  totalRelationships: number;
  relationshipsByType: Record<RelationTypeValue, number>;
  density: number;
  averageDegree: number;
  lastUpdated: ISOTimestamp;
  backend: {
    type: GraphBackendValue;
    version: string;
    status: string;
    uptimeSeconds: number;
  };
}

// =============================================================================
// Cache Abstraction
// =============================================================================

export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
}

// =============================================================================
// PubSub Abstraction
// =============================================================================

export interface PubSubClient {
  publish<T>(channel: string, payload: T): Promise<void>;
  subscribe<T>(channel: string): AsyncIterator<T>;
  unsubscribe(channel: string): Promise<void>;
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface PaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface Connection<T> {
  edges: Array<Edge<T>>;
  pageInfo: PageInfo;
  totalCount: number;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// =============================================================================
// Resolver Function Types
// =============================================================================

export type ResolverFn<TParent, TArgs, TResult> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: unknown
) => TResult | Promise<TResult>;

export type SubscriptionResolver<TPayload, TArgs> = {
  subscribe: (parent: undefined, args: TArgs, context: GraphQLContext) => AsyncIterator<TPayload>;
  resolve?: (payload: TPayload) => TPayload;
};

// =============================================================================
// Input Types
// =============================================================================

export interface QueryInput {
  naturalLanguageQuery: string;
  backend?: GraphBackendValue;
  limit?: number;
  generateInsights?: boolean;
  temporal?: TemporalQueryInput;
  filters?: SearchFiltersInput;
}

export interface TemporalQueryInput {
  asOf?: string;
  asOfTransaction?: string;
  validDuring?: { start: string; end: string };
}

export interface SearchFiltersInput {
  entityTypes?: EntityTypeValue[];
  relationTypes?: RelationTypeValue[];
  minConfidence?: number;
  sources?: string[];
  createdAfter?: string;
  createdBefore?: string;
  properties?: Record<string, unknown>;
}

export interface SearchInput {
  query: string;
  mode?: SearchModeValue;
  entityTypes?: EntityTypeValue[];
  minScore?: number;
  enableQueryExpansion?: boolean;
  first?: number;
  after?: string;
}

export interface InsightFeedbackInput {
  insightId: string;
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  rating?: number;
  comment?: string;
  aspect?: string;
  wasUseful?: boolean;
  wasAccurate?: boolean;
  wasActionable?: boolean;
}

export interface PathQueryInput {
  fromId: string;
  toId: string;
  maxLength?: number;
  minLength?: number;
  allowedRelationships?: RelationTypeValue[];
  allowCycles?: boolean;
  direction?: "OUTGOING" | "INCOMING" | "BOTH";
}

export interface RepositoryFilterInput {
  owner?: string;
  minStars?: number;
  maxStars?: number;
  languages?: string[];
  topics?: string[];
  hasLicense?: boolean;
  isActive?: boolean;
  isOriginal?: boolean;
  createdAfter?: string;
  updatedAfter?: string;
}

export interface RepositoryOrderBy {
  field: "STARS" | "FORKS" | "CREATED_AT" | "UPDATED_AT" | "LAST_PUSHED_AT" | "NAME" | "OPEN_ISSUES";
  direction?: "ASC" | "DESC";
}

export interface ContributorOrderBy {
  field: "CONTRIBUTIONS" | "FIRST_CONTRIBUTION" | "LAST_CONTRIBUTION";
  direction?: "ASC" | "DESC";
}
