---
name: dgraph
description: Master Dgraph for horizontally scalable, distributed GraphQL databases with native graph backend. Use when building production-scale graph databases requiring ACID transactions, consistent replication, and native GraphQL. Supports distributed architecture, full-text search, geo search, and regex queries.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Dgraph Mastery

Horizontally scalable distributed GraphQL database with native graph backend for production workloads.

## Territory Map

```
resources/knowledge_graphs/dgraph/
├── dgraph/cmd/              # CLI commands
│   ├── alpha/               # Alpha server (data nodes)
│   ├── zero/                # Zero server (cluster coordinator)
│   ├── bulk/                # Bulk data loading
│   ├── live/                # Live data loading
│   └── migrate/             # Data migration tools
├── graphql/                 # GraphQL implementation
│   ├── schema/              # Schema management
│   ├── resolve/             # Query resolution
│   └── admin/               # Admin API
├── worker/                  # Distributed operations
├── protos/                  # Protocol buffers
├── acl/                     # Access control
├── backup/                  # Backup/restore
├── tok/                     # Tokenizers & indexing
└── compose/                 # Docker Compose generator
```

## Core Capabilities

- **Distributed Architecture**: Horizontally scalable with automatic sharding
- **ACID Transactions**: Distributed transactions with snapshot isolation
- **Native GraphQL**: First-class GraphQL support with schema-driven design
- **Consistent Replication**: Raft-based consensus for data consistency
- **Full-Text Search**: Native support with regex and tokenizers
- **Geo Search**: Built-in geospatial indexing and queries
- **Multiple Protocols**: gRPC, HTTP+JSON, RDF support

## Architecture Components

### Zero Nodes (Cluster Coordination)
- Assign UIDs and transaction timestamps
- Maintain cluster membership
- Handle predicate rebalancing
- Recommend: 3 or 5 Zero nodes for production

### Alpha Nodes (Data Storage)
- Store and serve data predicates
- Execute queries and mutations
- Organized into groups for sharding
- Scale horizontally by adding more groups

## Beginner Techniques

### Docker Standalone Setup
```bash
# Quick standalone instance (NOT for production)
docker run -it -p 8080:8080 -p 9080:9080 \
  -v ~/dgraph:/dgraph \
  dgraph/standalone:latest
```

### Basic Cluster with Docker Compose
```yaml
version: "3.5"
services:
  zero:
    image: dgraph/dgraph:latest
    ports:
      - "5080:5080"
      - "6080:6080"
    command: dgraph zero --my=zero:5080 --replicas=1

  alpha:
    image: dgraph/dgraph:latest
    ports:
      - "8080:8080"
      - "9080:9080"
    command: dgraph alpha --my=alpha:7080 --zero=zero:5080
      --security "whitelist=0.0.0.0/0"
```

### GraphQL Schema Definition
```graphql
type Person {
  id: ID!
  name: String! @search(by: [hash, fulltext])
  age: Int @search
  email: String @id
  friends: [Person] @hasInverse(field: friends)
}

type Post {
  id: ID!
  title: String! @search(by: [fulltext])
  content: String @search(by: [fulltext])
  author: Person!
  createdAt: DateTime @search
  tags: [String] @search(by: [hash])
}
```

### Basic GraphQL Mutations
```graphql
mutation {
  addPerson(input: [{
    name: "Alice"
    age: 30
    email: "alice@example.com"
  }]) {
    person {
      id
      name
    }
  }
}
```

### Basic GraphQL Queries
```graphql
query {
  queryPerson(filter: { age: { gt: 25 } }) {
    name
    age
    friends {
      name
    }
  }
}
```

## Intermediate Techniques

### Multi-Node Cluster Deployment
```yaml
# 3 Zero nodes + 6 Alpha nodes (2 groups, 3 replicas each)
version: "3.5"
services:
  zero1:
    image: dgraph/dgraph:latest
    command: dgraph zero --my=zero1:5080 --replicas=3 --raft='idx=1'

  zero2:
    image: dgraph/dgraph:latest
    command: dgraph zero --my=zero2:5080 --peer=zero1:5080 --raft='idx=2'

  zero3:
    image: dgraph/dgraph:latest
    command: dgraph zero --my=zero3:5080 --peer=zero1:5080 --raft='idx=3'

  alpha1:
    image: dgraph/dgraph:latest
    command: dgraph alpha --my=alpha1:7080
      --zero=zero1:5080,zero2:5080,zero3:5080
      --raft "idx=1; group=1"

  alpha2:
    image: dgraph/dgraph:latest
    command: dgraph alpha --my=alpha2:7080
      --zero=zero1:5080,zero2:5080,zero3:5080
      --raft "idx=2; group=1"

  # ... alpha3-6 for group 1 and group 2
```

### Search Capabilities
```graphql
type Document {
  title: String! @search(by: [fulltext, trigram])
  content: String! @search(by: [fulltext])
  location: Point @search
  category: String @search(by: [hash, exact])
  pattern: String @search(by: [regexp])
}

query {
  # Full-text search
  queryDocument(filter: {
    title: { anyoftext: "graph database" }
  }) { title }

  # Regex search
  queryDocument(filter: {
    pattern: { regexp: "/^[A-Z].*/" }
  }) { pattern }

  # Geo search
  queryDocument(filter: {
    location: { near: { coordinate: { latitude: 37.7, longitude: -122.4 }, distance: 10000 } }
  }) { title location }
}
```

### Transactions via GraphQL
```graphql
# Upsert operation
mutation {
  addPerson(input: [{
    email: "alice@example.com"
    name: "Alice"
  }], upsert: true) {
    person {
      id
      name
    }
  }
}

# Conditional update
mutation updateWithCheck($filter: PersonFilter!) {
  updatePerson(input: { filter: $filter, set: { age: 31 } }) {
    person {
      name
      age
    }
  }
}
```

### Bulk Data Loading
```bash
# Prepare RDF or JSON data
dgraph bulk -f data.rdf.gz -s schema.txt \
  --map_shards=4 --reduce_shards=2 \
  --http "localhost:8000" --zero=localhost:5080
```

### Live Data Loading
```bash
# Stream data to running cluster
dgraph live -f data.rdf.gz -s schema.txt \
  --alpha localhost:9080 --zero localhost:5080 \
  -c 10  # 10 concurrent goroutines
```

## Advanced Techniques

### Access Control Lists (ACL)
```bash
# Enable ACL on Alpha
dgraph alpha --acl "secret-file=/path/to/hmac-secret"

# Create user
dgraphctl acl add -u alice -p password123

# Create group with permissions
dgraphctl acl mod -g dev --pred "name,age:R" --pred "email:W"

# Assign user to group
dgraphctl acl mod -u alice -g dev
```

### Backup and Restore
```bash
# Full backup to S3
dgraph backup --alpha localhost:9080 --destination s3://bucket/backup \
  --access_key $AWS_KEY --secret_key $AWS_SECRET

# Incremental backup
dgraph backup --alpha localhost:9080 --destination s3://bucket/backup \
  --access_key $AWS_KEY --secret_key $AWS_SECRET --incremental

# Restore from backup
dgraph restore --location /path/to/backup --postings /data/p \
  --zero localhost:5080
```

### Encryption at Rest
```bash
# Generate encryption key
dgraph cert --dir /certs

# Start with encryption
dgraph alpha --encryption "key-file=/certs/enc-key.txt"
```

### Performance Tuning

#### Alpha Configuration
```bash
dgraph alpha \
  --badger "compression=snappy" \
  --cache "size-mb=2048" \
  --limit "mutations=1000000; mutations-nquad=10000000" \
  --raft "snapshot-after-entries=10000; snapshot-after-duration=30m" \
  --postings "/fast-ssd/p" \
  --wal "/fast-ssd/w"
```

#### Indexing Strategies
```graphql
# Strategic index selection
type Product {
  sku: String! @id                    # Unique lookups
  name: String! @search(by: [hash])   # Exact match
  description: String @search(by: [fulltext])  # Text search
  price: Float @search                # Range queries
  tags: [String] @search(by: [hash])  # Filter by list
}
```

#### Query Optimization
```graphql
# Use pagination
query {
  queryProduct(first: 100, offset: 0) {
    id
    name
  }
}

# Use filters early in the query tree
query {
  queryProduct(filter: {
    price: { between: { min: 10, max: 100 } }
  }) {
    name
    category {
      name
    }
  }
}
```

### Vector Similarity Search (v23.1+)
```graphql
type Document {
  id: ID!
  content: String!
  embedding: [Float] @embedding
}

# Query similar documents
query {
  querySimilarById(id: "doc123", topK: 5) {
    id
    content
  }
}

# Query by embedding vector
query {
  querySimilarByEmbedding(
    by: { embedding: [0.1, 0.2, ...] }
    topK: 5
  ) {
    id
    content
  }
}
```

### Custom DQL Queries (Advanced)
```graphql
# GraphQL with DQL extension
query {
  queryPerson @cascade {
    name
    friends @filter(gt(age, 30)) {
      name
      age
    }
  }
}
```

### High Availability Setup
```yaml
# Production HA cluster:
# - 5 Zero nodes (quorum: 3)
# - 9 Alpha nodes (3 groups × 3 replicas)
# - Load balancer for Alpha endpoints
# - Monitoring with Prometheus/Jaeger

services:
  # ... zero1-zero5 ...

  # Group 1
  alpha1:
    command: dgraph alpha --raft "idx=1; group=1" ...
  alpha2:
    command: dgraph alpha --raft "idx=2; group=1" ...
  alpha3:
    command: dgraph alpha --raft "idx=3; group=1" ...

  # Group 2
  alpha4:
    command: dgraph alpha --raft "idx=4; group=2" ...
  # ... continue pattern ...

  # Monitoring
  prometheus:
    image: prom/prometheus
    # Scrape /debug/prometheus endpoint

  jaeger:
    image: jaegertracing/all-in-in-one
    # Distributed tracing
```

### Cluster Operations

#### Check Cluster Health
```bash
curl localhost:6080/state
curl localhost:8080/health
```

#### Move Predicates Between Groups
```bash
# Rebalance data across groups
curl -X POST localhost:6080/moveTablet \
  -d '{ "tablet": "predicate-name", "groupId": 2 }'
```

#### Export Data
```bash
# Export all data to RDF/JSON
curl localhost:8080/admin/export
```

#### Drop Data
```bash
# Drop all data (careful!)
curl -X POST localhost:8080/alter -d '{"drop_all": true}'

# Drop specific predicate
curl -X POST localhost:8080/alter -d '{"drop_attr": "name"}'
```

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| Standalone mode | Development and testing |
| Multi-group cluster | Horizontal scaling for large datasets |
| ACL + encryption | Enterprise security requirements |
| Backup to cloud | Disaster recovery |
| Vector search | Semantic similarity and RAG |
| Live loader | Continuous data ingestion |

## When to Use Dgraph

- Building production-scale graph databases with 10+ million nodes
- Requiring ACID transactions across distributed nodes
- Native GraphQL API without translation layer
- Sparse data that doesn't fit relational models
- Combining graph traversal with full-text/geo/vector search
- Multi-tenant applications with ACL requirements

## Comparison Advantages

| Feature | Dgraph | Neo4j | JanusGraph | TigerGraph |
|---------|--------|-------|------------|------------|
| Architecture | Distributed, sharded | Single server | Layered | Distributed |
| Query Language | GraphQL | Cypher | Gremlin | GSQL |
| Transactions | Distributed ACID | Single-server ACID | Limited | Limited |
| Deployment | Simple (Go binary) | Complex (JVM) | Complex (multi-DB) | Complex |
| License | Apache 2.0 | GPL v3 (CE) | Apache 2.0 | Commercial |

## Performance Best Practices

1. **Indexing**: Only index predicates used in filters
2. **Sharding**: Distribute hot predicates across groups
3. **Caching**: Increase `--cache` for read-heavy workloads
4. **Batch Mutations**: Use bulk/live loader for large imports
5. **Connection Pooling**: Reuse gRPC connections in clients
6. **SSD Storage**: Use fast SSDs for `--postings` and `--wal`
7. **Monitoring**: Enable Prometheus metrics and Jaeger tracing

## Client Libraries

- **Go**: `github.com/dgraph-io/dgo`
- **Python**: `pydgraph`
- **JavaScript**: `dgraph-js`
- **Java**: `dgraph4j`
- **C#**: `Dgraph-dotnet`
- **Rust**: `dgraph-tonic`

## Reference Files

- Main binary: `dgraph/cmd/root.go`
- Alpha server: `dgraph/cmd/alpha/`
- Zero server: `dgraph/cmd/zero/`
- GraphQL schema: `graphql/schema/`
- Query resolution: `graphql/resolve/`
- Worker operations: `worker/`
- Compose generator: `compose/compose.go`
- ACL implementation: `acl/acl.go`

## Quick Commands

```bash
# Generate docker-compose for 3 alphas, 1 zero
cd compose && go run . -a 3 -z 1

# Check version
dgraph version

# Zero health check
curl localhost:6080/health

# Alpha health check
curl localhost:8080/health

# View cluster state
curl localhost:6080/state | jq

# GraphQL schema introspection
curl -X POST localhost:8080/admin/schema

# Prometheus metrics
curl localhost:8080/debug/prometheus
```

## Troubleshooting

**Slow Queries**: Check query plan with `@debug` directive
```graphql
query @debug {
  queryPerson { name }
}
```

**Out of Memory**: Increase `--cache` or add more Alpha nodes

**Split Brain**: Ensure odd number of Zero nodes (3 or 5)

**Rebalancing**: Manually move tablets if automatic rebalancing is slow
```bash
curl -X POST localhost:6080/moveTablet -d '{"tablet": "hot-predicate", "groupId": 2}'
```
