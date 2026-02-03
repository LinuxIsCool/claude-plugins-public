# GraphQL Query Patterns for Knowledge Graphs

## Overview

This document analyzes GraphQL query patterns for knowledge graphs, covering database technologies, query optimization, schema design, federation patterns, and real-time subscriptions. These patterns are critical for querying meta-KG systems that aggregate multiple knowledge sources.

**Key Technologies Covered:**
- Dgraph (native GraphQL)
- Neo4j GraphQL Library
- Hasura (PostgreSQL + Remote Schemas)
- Apollo Federation
- Schema Stitching (graphql-tools)

---

## 1. GraphQL Over Knowledge Graphs

### Native GraphQL Databases

#### Dgraph

**Repository:** [github.com/dgraph-io/dgraph](https://github.com/dgraph-io/dgraph)

Dgraph is the only database designed from the ground up as a native GraphQL database with a graph backend.

**Query Language Features:**
- Native GraphQL schema-first design
- DQL (Dgraph Query Language) for advanced graph operations
- Full-text, geo-spatial, and regex search built-in
- Vector similarity search (v23.1+)

**Performance Characteristics:**
- Horizontally scalable with automatic sharding
- Predicate-based distribution across nodes
- Parallel query processing for large traversals
- ACID transactions with snapshot isolation

**Schema Example:**
```graphql
type Entity {
  id: ID!
  name: String! @search(by: [hash, fulltext, trigram])
  type: String! @search(by: [exact])
  description: String @search(by: [fulltext])
  properties: [Property] @hasInverse(field: entity)
  relationships: [Relationship] @hasInverse(field: source)
  embedding: [Float] @embedding  # Vector similarity
}

type Relationship {
  id: ID!
  type: String! @search(by: [exact])
  source: Entity!
  target: Entity!
  weight: Float @search
  validFrom: DateTime @search
  validTo: DateTime @search
  properties: [Property] @hasInverse(field: relationship)
}

type Property {
  id: ID!
  key: String! @search(by: [exact])
  value: String! @search(by: [fulltext])
  entity: Entity
  relationship: Relationship
}
```

**Query Pattern - Multi-Hop Traversal:**
```graphql
query MultiHopTraversal($entityName: String!, $depth: Int!) {
  queryEntity(filter: { name: { eq: $entityName } }) {
    name
    type
    relationships(first: 100) {
      type
      target {
        name
        type
        relationships(first: $depth) @cascade {
          type
          target {
            name
            description
          }
        }
      }
    }
  }
}
```

**Developer Experience:**
- Automatic GraphQL API from schema
- Built-in GraphQL Playground
- Client libraries: Go, Python, JavaScript, Java, Rust
- Docker-based deployment

---

#### Neo4j GraphQL Library

**Repository:** [github.com/neo4j/graphql](https://github.com/neo4j/graphql)

Translates GraphQL queries to Cypher for execution against Neo4j.

**Query Language Features:**
- Schema-first with `@relationship` directives
- Cypher extensions via `@cypher` directive
- Full Cypher power through custom resolvers
- Apollo Federation support

**Performance Characteristics:**
- Leverages Neo4j's native graph storage
- Index-backed queries via Cypher optimization
- Causal consistency with Raft replication
- Memory-intensive for large traversals

**Schema Example:**
```graphql
type Entity @node {
  id: ID! @id
  name: String!
  type: String!
  description: String

  relatedTo: [Entity!]! @relationship(
    type: "RELATED_TO",
    direction: OUT,
    properties: "RelationshipProperties"
  )

  partOf: [Entity!]! @relationship(
    type: "PART_OF",
    direction: OUT
  )
}

type RelationshipProperties @relationshipProperties {
  weight: Float
  type: String
  validFrom: DateTime
  validTo: DateTime
}

type Query {
  shortestPath(from: ID!, to: ID!): [Entity!]! @cypher(
    statement: """
    MATCH path = shortestPath((a:Entity {id: $from})-[*]-(b:Entity {id: $to}))
    RETURN nodes(path)
    """
  )

  communityMembers(communityId: ID!): [Entity!]! @cypher(
    statement: """
    MATCH (e:Entity)-[:MEMBER_OF]->(c:Community {id: $communityId})
    RETURN e ORDER BY e.pageRank DESC
    """
  )
}
```

**Query Pattern - Path Queries:**
```graphql
query PathBetweenEntities($fromId: ID!, $toId: ID!) {
  shortestPath(from: $fromId, to: $toId) {
    id
    name
    type
    description
  }
}
```

**Developer Experience:**
- Introspection from existing Neo4j databases
- GraphQL Toolbox for experimentation
- Type-safe Cypher generation
- GraphAcademy learning resources

---

#### Hasura

**Repository:** [github.com/hasura/graphql-engine](https://github.com/hasura/graphql-engine)

Instant GraphQL API over PostgreSQL with remote schema integration for graph databases.

**Query Language Features:**
- PostgreSQL-native with extensions (pg_graphql, Apache AGE)
- Remote schemas for Neo4j/Dgraph integration
- Actions for custom business logic
- Event triggers for real-time updates

**Performance Characteristics:**
- Query multiplexing for subscriptions (1M+ concurrent connections)
- PostgreSQL connection pooling
- Compiled SQL queries (no N+1 by design)
- Horizontal scaling via read replicas

**Schema Integration Pattern:**
```graphql
# Local PostgreSQL types
type Document {
  id: uuid!
  title: String!
  content: String!
  embedding: vector(1536)

  # Remote join to Neo4j knowledge graph
  entities: [Entity!]! @remote_join(
    remote_schema: "neo4j_kg"
    field_mapping: { document_id: $id }
  )
}

# Remote schema from Neo4j
extend type Query {
  getKnowledgeGraph(documentId: uuid!): KnowledgeGraph
    @remote_schema(name: "neo4j_kg")
}
```

**Developer Experience:**
- Console UI for schema exploration
- Automatic CRUD operations
- Role-based access control
- One-click deployment on Hasura Cloud

---

## 2. Query Optimization Patterns

### The N+1 Problem in Graph Queries

Graph queries naturally suffer from N+1 issues due to relationship traversals.

**Problem Illustration:**
```graphql
# This query can generate 1 + N + N*M database calls
query {
  entities(first: 100) {        # 1 query
    name
    relationships(first: 10) {  # N queries (100)
      target {
        name
        properties {            # N*M queries (1000)
          key
          value
        }
      }
    }
  }
}
```

### DataLoader Pattern

**Repository:** [github.com/graphql/dataloader](https://github.com/graphql/dataloader)

**Implementation:**
```typescript
import DataLoader from 'dataloader';

// Batch function groups individual fetches
const entityLoader = new DataLoader(async (ids: string[]) => {
  // Single batched database query
  const entities = await db.query(
    `MATCH (e:Entity) WHERE e.id IN $ids RETURN e`,
    { ids }
  );

  // Return results in same order as input IDs
  return ids.map(id => entities.find(e => e.id === id));
});

// Resolver uses loader
const resolvers = {
  Relationship: {
    target: (relationship, _, context) => {
      // Multiple calls batch automatically
      return context.loaders.entity.load(relationship.targetId);
    }
  }
};
```

**Optimization Results:**
- Reduces N+1 queries to 2 batched queries
- E-commerce platform: 200ms to 15ms response time
- Network overhead reduction: 50-90%

### Breadth-First Loading (Advanced)

**Source:** [WunderGraph DataLoader 3.0](https://wundergraph.com/blog/dataloader_3_0_breadth_first_data_loading)

Instead of depth-first resolution, load all data at each level simultaneously.

**Benefits:**
- Reduces concurrency from O(N^2) to O(1)
- Up to 5x performance improvement
- Simplified resolver logic

---

### Query Complexity Analysis

**Repository:** [github.com/slicknode/graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity)

Protect APIs from expensive queries by calculating complexity scores.

**Implementation:**
```typescript
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator
} from 'graphql-query-complexity';

const complexity = getComplexity({
  schema,
  query,
  variables,
  estimators: [
    fieldExtensionsEstimator(),
    simpleEstimator({ defaultComplexity: 1 })
  ]
});

// Reject queries exceeding threshold
if (complexity > 50000) {
  throw new Error('Query too complex');
}
```

**Complexity Estimation Strategies:**

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Simple** | Fixed cost per field | Basic protection |
| **Field Extensions** | Per-field custom costs | Fine-grained control |
| **Directive-based** | `@complexity(value: 10)` | Schema-defined costs |
| **Connection-aware** | Multiplied by `first`/`last` args | Pagination protection |

**Schema-Level Complexity:**
```graphql
type Entity {
  id: ID!
  name: String!  # complexity: 1 (default)

  # Heavy computation
  pageRank: Float @complexity(value: 100)

  # Relationship traversal
  relationships(first: Int): [Relationship!]!
    @complexity(multipliers: ["first"], value: 5)
}
```

---

### Depth and Breadth Limiting

**Implementation:**
```typescript
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  schema,
  validationRules: [
    depthLimit(10),  // Max query depth
    // Custom breadth limiting
    createBreadthLimitRule(100)  // Max fields at any level
  ]
});
```

**Recommended Limits for Knowledge Graphs:**

| Graph Size | Max Depth | Max Breadth | Rationale |
|------------|-----------|-------------|-----------|
| Small (<10K nodes) | 10 | 100 | Exploratory queries OK |
| Medium (10K-1M) | 6 | 50 | Balance performance |
| Large (>1M) | 4 | 25 | Strict protection |

---

## 3. Schema Design for Knowledge Representation

### Entity-Relationship-Property Pattern

Standard schema pattern for knowledge graphs.

```graphql
interface Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Entity implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!

  # Core identity
  name: String!
  type: EntityType!
  aliases: [String!]!

  # Semantic content
  description: String
  summary: String
  embedding: [Float!]  # Vector representation

  # Temporal validity
  validFrom: DateTime
  validTo: DateTime

  # Relationships (outbound)
  outgoingRelations: [Relation!]! @relationship(
    type: "RELATES_TO",
    direction: OUT
  )

  # Relationships (inbound)
  incomingRelations: [Relation!]! @relationship(
    type: "RELATES_TO",
    direction: IN
  )

  # Provenance
  sources: [Source!]!
  confidence: Float
}

type Relation implements Node {
  id: ID!
  createdAt: DateTime!
  updatedAt: DateTime!

  # Relation semantics
  type: RelationType!
  description: String
  weight: Float

  # Connected entities
  source: Entity!
  target: Entity!

  # Temporal validity (bi-temporal)
  validFrom: DateTime     # When fact became true
  validTo: DateTime       # When fact became false
  recordedAt: DateTime    # When we learned it

  # Provenance
  sources: [Source!]!
  confidence: Float
}

enum EntityType {
  PERSON
  ORGANIZATION
  LOCATION
  CONCEPT
  EVENT
  DOCUMENT
  CUSTOM
}

enum RelationType {
  IS_A
  PART_OF
  RELATED_TO
  WORKS_FOR
  LOCATED_IN
  CREATED_BY
  MENTIONS
  CUSTOM
}
```

### Hybrid Search Interface

Support multiple retrieval strategies in one API.

```graphql
input SearchInput {
  query: String!
  mode: SearchMode!
  filters: SearchFilters
  pagination: PaginationInput
}

enum SearchMode {
  SEMANTIC     # Vector similarity
  KEYWORD      # BM25 text search
  GRAPH        # Traversal from seed nodes
  HYBRID       # Combined scoring
}

input SearchFilters {
  entityTypes: [EntityType!]
  relationTypes: [RelationType!]
  validAt: DateTime           # Point-in-time query
  minConfidence: Float
  sourceIds: [ID!]
}

type SearchResult {
  entities: [EntityResult!]!
  relations: [RelationResult!]!
  totalCount: Int!
  searchMetadata: SearchMetadata!
}

type EntityResult {
  entity: Entity!
  score: Float!
  matchType: MatchType!
  highlights: [Highlight!]
}

type SearchMetadata {
  executionTimeMs: Int!
  searchMode: SearchMode!
  vectorDistribution: VectorStats
}
```

### Temporal Query Support

Enable point-in-time and range queries.

```graphql
extend type Query {
  # Get entity state at specific point in time
  entityAt(id: ID!, timestamp: DateTime!): Entity

  # Get entity history
  entityHistory(
    id: ID!,
    from: DateTime,
    to: DateTime
  ): [EntitySnapshot!]!

  # Find what changed between two times
  changesBetween(
    from: DateTime!,
    to: DateTime!,
    entityTypes: [EntityType!]
  ): ChangeSet!
}

type EntitySnapshot {
  entity: Entity!
  validAt: DateTime!
  relations: [Relation!]!
}

type ChangeSet {
  added: [Entity!]!
  modified: [EntityChange!]!
  removed: [ID!]!
  relationsAdded: [Relation!]!
  relationsRemoved: [ID!]!
}

type EntityChange {
  entity: Entity!
  previousState: Entity
  changedFields: [String!]!
}
```

---

## 4. Federation Patterns for Multiple KG Sources

### Apollo Federation

**Repository:** [github.com/apollographql/federation](https://github.com/apollographql/federation)

Compose multiple GraphQL services into a unified supergraph.

**Architecture:**
```
                    ┌─────────────────┐
                    │  Apollo Router  │
                    │   (Gateway)     │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │Graphiti │        │LightRAG │        │ Dgraph  │
    │Subgraph │        │Subgraph │        │Subgraph │
    └─────────┘        └─────────┘        └─────────┘
```

**Subgraph Schema - Graphiti:**
```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@shareable", "@external", "@requires"])

type Entity @key(fields: "id") {
  id: ID!
  name: String!
  type: String!

  # Graphiti-specific temporal data
  validFrom: DateTime
  validTo: DateTime
  episodeCount: Int
}

# Reference resolver
extend type Query {
  _entities(representations: [_Any!]!): [_Entity]!
}
```

**Subgraph Schema - LightRAG:**
```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0",
        import: ["@key", "@extends", "@external", "@requires"])

# Extend entity from Graphiti
type Entity @key(fields: "id") @extends {
  id: ID! @external

  # LightRAG-specific fields
  ragContext: RAGContext
  chunkCount: Int
  lastIndexed: DateTime
}

type RAGContext {
  relevantChunks: [Chunk!]!
  queryMode: QueryMode!
  score: Float!
}
```

**Gateway Query:**
```graphql
# Single query spans both subgraphs
query UnifiedKGQuery($entityId: ID!) {
  entity(id: $entityId) {
    # From Graphiti subgraph
    id
    name
    type
    validFrom
    validTo
    episodeCount

    # From LightRAG subgraph (federated)
    ragContext {
      relevantChunks {
        content
        score
      }
    }
    chunkCount
  }
}
```

**Developer Experience:**
- Rover CLI for composition
- Apollo Studio for monitoring
- Automatic query planning
- Incremental adoption path

---

### Schema Stitching

**Repository:** [github.com/ardatan/graphql-tools](https://github.com/ardatan/graphql-tools)

Alternative to federation with more flexibility.

**Handbook:** [github.com/gmac/schema-stitching-handbook](https://github.com/gmac/schema-stitching-handbook)

**Implementation:**
```typescript
import { stitchSchemas } from '@graphql-tools/stitch';
import { stitchingDirectives } from '@graphql-tools/stitching-directives';

const { stitchingDirectivesTypeDefs, stitchingDirectivesTransformer } =
  stitchingDirectives();

const gatewaySchema = stitchSchemas({
  subschemaConfigTransforms: [stitchingDirectivesTransformer],
  subschemas: [
    {
      schema: graphitiSchema,
      executor: graphitiExecutor,
      transforms: [
        new RenameTypes((name) => `Graphiti_${name}`)
      ]
    },
    {
      schema: lightragSchema,
      executor: lightragExecutor,
      merge: {
        Entity: {
          fieldName: 'entity',
          selectionSet: '{ id }',
          args: (original) => ({ id: original.id })
        }
      }
    },
    {
      schema: dgraphSchema,
      executor: dgraphExecutor
    }
  ]
});
```

**Type Merging:**
```graphql
# Graphiti schema
type Entity {
  id: ID!
  name: String!
  temporalData: TemporalInfo
}

# LightRAG schema
type Entity {
  id: ID!
  ragScore: Float
  chunks: [Chunk!]!
}

# Merged result
type Entity {
  id: ID!
  name: String!           # from Graphiti
  temporalData: TemporalInfo  # from Graphiti
  ragScore: Float         # from LightRAG
  chunks: [Chunk!]!       # from LightRAG
}
```

**When to Use Stitching vs Federation:**

| Factor | Schema Stitching | Apollo Federation |
|--------|------------------|-------------------|
| Team structure | Central gateway team | Distributed teams |
| Schema ownership | Shared/centralized | Team-owned subgraphs |
| Flexibility | More flexible merging | Stricter contracts |
| Learning curve | Lower | Higher |
| Tooling | Manual composition | Rover CLI, Studio |
| Non-GraphQL sources | Easy integration | Requires adapters |

---

## 5. Real-Time Subscription Patterns

### Hasura Live Queries

**Source:** [Hasura Live Query Architecture](https://github.com/hasura/graphql-engine/blob/master/architecture/live-queries.md)

**Capabilities:**
- 1M+ concurrent WebSocket connections
- Query multiplexing reduces database load
- PostgreSQL NOTIFY for change detection

**Implementation:**
```graphql
subscription EntityChanges($entityId: ID!) {
  entity(where: { id: { _eq: $entityId } }) {
    id
    name
    type
    updatedAt
    relationships_aggregate {
      aggregate {
        count
      }
    }
  }
}
```

**Scaling Architecture:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Hasura    │────▶│ PostgreSQL  │
│ (WebSocket) │     │  (Poller)   │     │  (NOTIFY)   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │ (Pub/Sub)   │
                    └─────────────┘
```

---

### Event-Driven Subscriptions

**Pattern for KG Updates:**
```graphql
type Subscription {
  # Entity-level changes
  entityUpdated(entityId: ID): EntityEvent!

  # Relation changes
  relationCreated(sourceId: ID, targetId: ID): Relation!
  relationRemoved(sourceId: ID, targetId: ID): RelationRemoval!

  # Graph-wide events
  graphEvent(eventTypes: [GraphEventType!]): GraphEvent!

  # Streaming for large results
  entityStream(filter: EntityFilter!): Entity!
}

enum GraphEventType {
  ENTITY_CREATED
  ENTITY_UPDATED
  ENTITY_DELETED
  RELATION_CREATED
  RELATION_UPDATED
  RELATION_DELETED
  COMMUNITY_DETECTED
  ANOMALY_DETECTED
}

type EntityEvent {
  entity: Entity!
  eventType: GraphEventType!
  previousState: Entity
  changedFields: [String!]!
  timestamp: DateTime!
  source: EventSource!
}

type EventSource {
  system: String!
  userId: ID
  traceId: String
}
```

---

### Pub/Sub Infrastructure

**Scaling Options:**

| Scale | Solution | Characteristics |
|-------|----------|-----------------|
| Development | In-memory PubSub | Simple, single-process |
| Medium | Redis Pub/Sub | Multi-instance, low latency |
| Large | Apache Kafka | High throughput, durability |
| Enterprise | AWS SNS/SQS | Managed, auto-scaling |

**Redis Implementation:**
```typescript
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

const pubsub = new RedisPubSub({
  publisher: new Redis({ host: 'redis' }),
  subscriber: new Redis({ host: 'redis' })
});

const resolvers = {
  Mutation: {
    updateEntity: async (_, { id, input }) => {
      const entity = await db.updateEntity(id, input);

      // Publish to subscribers
      await pubsub.publish(`ENTITY_UPDATED.${id}`, {
        entityUpdated: {
          entity,
          eventType: 'ENTITY_UPDATED',
          timestamp: new Date().toISOString()
        }
      });

      return entity;
    }
  },
  Subscription: {
    entityUpdated: {
      subscribe: (_, { entityId }) => {
        const topic = entityId
          ? `ENTITY_UPDATED.${entityId}`
          : 'ENTITY_UPDATED.*';
        return pubsub.asyncIterator(topic);
      }
    }
  }
};
```

---

## 6. Pagination Patterns

### Relay Cursor Connections

**Specification:** [Relay Cursor Connections](https://relay.dev/graphql/connections.htm)

**Schema:**
```graphql
type EntityConnection {
  edges: [EntityEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type EntityEdge {
  node: Entity!
  cursor: String!

  # Edge-specific data
  relationshipContext: RelationContext
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type RelationContext {
  pathLength: Int!
  traversedRelations: [RelationType!]!
}

extend type Query {
  entities(
    first: Int
    after: String
    last: Int
    before: String
    filter: EntityFilter
    orderBy: EntityOrderBy
  ): EntityConnection!
}
```

**Cursor Implementation:**
```typescript
// Opaque cursor encoding
function encodeCursor(id: string, sortValue: any): string {
  return Buffer.from(JSON.stringify({ id, sortValue })).toString('base64');
}

function decodeCursor(cursor: string): { id: string; sortValue: any } {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
}

// Efficient WHERE-based pagination
async function paginateEntities(args: PaginationArgs) {
  const { first, after, filter, orderBy } = args;

  let whereClause = buildFilter(filter);

  if (after) {
    const { sortValue } = decodeCursor(after);
    whereClause = `${whereClause} AND ${orderBy.field} > $sortValue`;
  }

  const entities = await db.query(`
    MATCH (e:Entity)
    WHERE ${whereClause}
    RETURN e
    ORDER BY e.${orderBy.field} ${orderBy.direction}
    LIMIT ${first + 1}  // Fetch one extra to check hasNextPage
  `, { sortValue });

  const hasNextPage = entities.length > first;
  const nodes = hasNextPage ? entities.slice(0, -1) : entities;

  return {
    edges: nodes.map(e => ({
      node: e,
      cursor: encodeCursor(e.id, e[orderBy.field])
    })),
    pageInfo: {
      hasNextPage,
      hasPreviousPage: !!after,
      startCursor: nodes[0] ? encodeCursor(nodes[0].id, nodes[0][orderBy.field]) : null,
      endCursor: nodes.length ? encodeCursor(nodes[nodes.length-1].id, nodes[nodes.length-1][orderBy.field]) : null
    },
    totalCount: await db.count('Entity', filter)
  };
}
```

---

## 7. GitHub Repositories Summary

### Graph Databases with GraphQL

| Repository | Stars | Language | Key Features |
|------------|-------|----------|--------------|
| [dgraph-io/dgraph](https://github.com/dgraph-io/dgraph) | 20k+ | Go | Native GraphQL, distributed, ACID |
| [neo4j/graphql](https://github.com/neo4j/graphql) | 1k+ | TypeScript | GraphQL-to-Cypher translation |
| [hasura/graphql-engine](https://github.com/hasura/graphql-engine) | 31k+ | Haskell | Instant API, live queries |

### Federation & Composition

| Repository | Stars | Language | Key Features |
|------------|-------|----------|--------------|
| [apollographql/federation](https://github.com/apollographql/federation) | 2k+ | TypeScript | Supergraph composition |
| [ardatan/graphql-tools](https://github.com/ardatan/graphql-tools) | 5k+ | TypeScript | Schema stitching, transforms |
| [gmac/schema-stitching-handbook](https://github.com/gmac/schema-stitching-handbook) | 400+ | TypeScript | Guided examples |

### Query Optimization

| Repository | Stars | Language | Key Features |
|------------|-------|----------|--------------|
| [graphql/dataloader](https://github.com/graphql/dataloader) | 13k+ | JavaScript | Batching, caching |
| [slicknode/graphql-query-complexity](https://github.com/slicknode/graphql-query-complexity) | 500+ | TypeScript | Complexity analysis |
| [oslabs-beta/GraphQL-Gate](https://github.com/oslabs-beta/GraphQL-Gate) | 100+ | TypeScript | Rate limiting |

### Knowledge Graph Specific

| Repository | Stars | Language | Key Features |
|------------|-------|----------|--------------|
| [dgraph-io/graphql-sample-apps](https://github.com/dgraph-io/graphql-sample-apps) | 100+ | Various | Sample applications |
| [getzep/graphiti](https://github.com/getzep/graphiti) | 2k+ | Python | Temporal KG, MCP server |
| [HKUDS/LightRAG](https://github.com/HKUDS/LightRAG) | 10k+ | Python | Dual-level retrieval |
| [bp4mc2/bp4mc2-graphql](https://github.com/bp4mc2/bp4mc2-graphql) | 50+ | Spec | Semantic GraphQL spec |

---

## 8. Integration Recommendations for Meta-KG System

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GraphQL Gateway                          │
│               (Apollo Router or graphql-yoga)                │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                       │
│  ┌─────────────┐ ┌───▼───────┐ ┌─────────────┐              │
│  │  Graphiti   │ │ LightRAG  │ │   Dgraph    │              │
│  │  Subgraph   │ │ Subgraph  │ │  Subgraph   │              │
│  └──────┬──────┘ └─────┬─────┘ └──────┬──────┘              │
│         │              │              │                      │
│  ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐              │
│  │   Neo4j     │ │PostgreSQL │ │   Dgraph    │              │
│  │  FalkorDB   │ │  + Neo4j  │ │  Cluster    │              │
│  └─────────────┘ └───────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Priorities

1. **Start with Schema Stitching**
   - Lower barrier to entry
   - Works with existing Graphiti/LightRAG
   - Migrate to Federation later if needed

2. **Implement DataLoader Immediately**
   - Critical for graph traversal performance
   - Per-request caching prevents redundant fetches
   - Use batch functions for each data source

3. **Add Query Complexity Analysis**
   - Protect against expensive traversals
   - Start with simple estimator, refine over time
   - Log complexity for optimization insights

4. **Enable Subscriptions Incrementally**
   - Start with entity-level updates
   - Add Redis pub/sub for multi-instance
   - Consider Kafka for high-volume streams

5. **Use Cursor-Based Pagination**
   - Essential for large result sets
   - Avoid OFFSET for performance
   - Encode sort criteria in cursors

---

## References

### Official Documentation
- [GraphQL Specification](https://graphql.org/learn/)
- [Dgraph Documentation](https://docs.dgraph.io/)
- [Neo4j GraphQL Library](https://neo4j.com/docs/graphql/current/)
- [Hasura Documentation](https://hasura.io/docs/)
- [Apollo Federation](https://www.apollographql.com/docs/federation/)

### Research & Articles
- [Graph Databases & Query Languages 2025](https://medium.com/@visrow/graph-databases-query-languages-in-2025-a-practical-guide-39cb7a767aed)
- [Relay Cursor Connections Specification](https://relay.dev/graphql/connections.htm)
- [WunderGraph DataLoader 3.0](https://wundergraph.com/blog/dataloader_3_0_breadth_first_data_loading)
- [Hasura 1M Live Queries](https://hasura.io/blog/1-million-active-graphql-subscriptions)

### Community Resources
- [Schema Stitching Handbook](https://the-guild.dev/graphql/stitching)
- [GraphQL Security Best Practices](https://www.howtographql.com/advanced/4-security/)
- [How to GraphQL Tutorial](https://www.howtographql.com/)

---

**Last Updated:** 2025-01-15
