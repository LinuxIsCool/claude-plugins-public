---
name: integration-backends
description: Master HippoRAG graph database backend selection and configuration. Covers Neo4j, FalkorDB, and Kuzu backends with installation, setup, performance tuning, and production deployment patterns.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Integration: Graph Database Backends

Selecting and configuring the right graph database for HippoRAG.

## Backend Overview

HippoRAG supports three primary backends:

```
┌─────────────────────────────────────────────────────────────────┐
│                     HippoRAG Backends                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│      Kuzu       │     Neo4j       │        FalkorDB             │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Embedded        │ Server-based    │ Redis-based                 │
│ Zero-config     │ Production-grade│ High-performance            │
│ Development     │ Visualization   │ In-memory speed             │
│ Small datasets  │ Large datasets  │ Medium-large datasets       │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Quick Selection Guide

| Use Case | Recommended Backend | Reason |
|----------|--------------------|---------|
| **Development/Testing** | Kuzu | Zero setup, embedded |
| **Production (general)** | Neo4j | Mature, tooling, visualization |
| **High-throughput queries** | FalkorDB | In-memory, Redis ecosystem |
| **Resource-constrained** | Kuzu | Minimal memory footprint |
| **Graph visualization needed** | Neo4j | Neo4j Browser, Bloom |
| **Existing Redis infrastructure** | FalkorDB | Leverages Redis |

## Backend 1: Kuzu (Embedded)

### Overview

Kuzu is an embedded graph database optimized for analytical workloads.

**Pros**:
- Zero configuration required
- Single file storage
- Fast for small-medium datasets
- No server process

**Cons**:
- Single-process only (no concurrent access)
- Limited visualization tools
- Less mature ecosystem

### Installation

```bash
pip install hipporag[kuzu]
# or
pip install kuzu
```

### Basic Setup

```python
from hipporag import HippoRAG

# Simplest setup - creates database in ./hipporag_data/
hippo = HippoRAG(
    backend="kuzu"
)

# Custom path
hippo = HippoRAG(
    backend="kuzu",
    connection="./my_graph_data/"
)

# Build indices
await hippo.build_indices_and_constraints()
```

### Kuzu Configuration

```python
from hipporag.backends import KuzuConfig

config = KuzuConfig(
    db_path="./hipporag_data/",
    buffer_pool_size=1024 * 1024 * 1024,  # 1GB buffer pool
    max_num_threads=4,                     # Parallel query threads
    enable_compression=True,               # Compress storage
    read_only=False                        # Read-write mode
)

hippo = HippoRAG(
    backend="kuzu",
    backend_config=config
)
```

### When to Use Kuzu

- Local development and testing
- Single-user applications
- Datasets < 1M triples
- Embedded deployments (edge, desktop apps)

---

## Backend 2: Neo4j (Production)

### Overview

Neo4j is the most mature and widely-used graph database.

**Pros**:
- Production-proven at scale
- Excellent visualization (Neo4j Browser, Bloom)
- Rich query language (Cypher)
- Active community and support
- ACID compliant

**Cons**:
- Requires separate server
- More resource-intensive
- Community Edition limitations

### Installation

```bash
# Install Python driver
pip install hipporag[neo4j]
# or
pip install neo4j

# Start Neo4j server (Docker recommended)
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your_password \
  -v neo4j_data:/data \
  neo4j:5.26-community
```

### Basic Setup

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    username="neo4j",
    password="your_password"
)

# Build indices
await hippo.build_indices_and_constraints()
```

### Neo4j Configuration

```python
from hipporag.backends import Neo4jConfig

config = Neo4jConfig(
    uri="bolt://localhost:7687",
    username="neo4j",
    password="your_password",
    database="neo4j",                    # Database name
    max_connection_pool_size=100,        # Connection pool
    connection_acquisition_timeout=60,    # Seconds
    max_transaction_retry_time=30,       # Retry duration
    encrypted=False                       # TLS (True for production)
)

hippo = HippoRAG(
    backend="neo4j",
    backend_config=config
)
```

### Neo4j Indices for HippoRAG

```cypher
-- Entity indices
CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name);
CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.type);
CREATE INDEX entity_embedding IF NOT EXISTS FOR (n:Entity) ON (n.embedding);

-- Relation indices
CREATE INDEX relation_type IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.type);
CREATE INDEX relation_weight IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.weight);

-- Full-text search (optional)
CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS
FOR (n:Entity) ON EACH [n.name, n.description];

-- Vector index for similarity search (Neo4j 5.13+)
CREATE VECTOR INDEX entity_vector IF NOT EXISTS
FOR (n:Entity) ON (n.embedding)
OPTIONS {indexConfig: {
  `vector.dimensions`: 1536,
  `vector.similarity_function`: 'cosine'
}};
```

### Neo4j Production Deployment

```yaml
# docker-compose.yml for Neo4j production
version: '3.8'
services:
  neo4j:
    image: neo4j:5.26-enterprise
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
      - NEO4J_dbms_memory_heap_initial__size=2G
      - NEO4J_dbms_memory_heap_max__size=4G
      - NEO4J_dbms_memory_pagecache_size=2G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs

volumes:
  neo4j_data:
  neo4j_logs:
```

### When to Use Neo4j

- Production deployments
- Need for graph visualization
- Large datasets (millions of triples)
- Team collaboration (shared database)
- Complex Cypher queries needed

---

## Backend 3: FalkorDB (High-Performance)

### Overview

FalkorDB is a Redis-based graph database optimized for speed.

**Pros**:
- In-memory performance
- Redis ecosystem integration
- Excellent for high-throughput
- OpenCypher support

**Cons**:
- Memory-bound dataset size
- Less mature than Neo4j
- Fewer visualization options

### Installation

```bash
# Install Python driver
pip install hipporag[falkordb]
# or
pip install falkordb

# Start FalkorDB (Docker)
docker run -d \
  --name falkordb \
  -p 6379:6379 \
  falkordb/falkordb:latest
```

### Basic Setup

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend="falkordb",
    connection="redis://localhost:6379",
    database="hipporag"  # Graph name within FalkorDB
)

# Build indices
await hippo.build_indices_and_constraints()
```

### FalkorDB Configuration

```python
from hipporag.backends import FalkorDBConfig

config = FalkorDBConfig(
    host="localhost",
    port=6379,
    password=None,           # Redis password if set
    database="hipporag",     # Graph name
    socket_timeout=30,       # Connection timeout
    connection_pool_size=20  # Pool size
)

hippo = HippoRAG(
    backend="falkordb",
    backend_config=config
)
```

### FalkorDB with Persistence

```yaml
# docker-compose.yml for FalkorDB with persistence
version: '3.8'
services:
  falkordb:
    image: falkordb/falkordb:latest
    ports:
      - "6379:6379"
    command: >
      --appendonly yes
      --appendfsync everysec
    volumes:
      - falkordb_data:/data

volumes:
  falkordb_data:
```

### When to Use FalkorDB

- High query throughput requirements
- Existing Redis infrastructure
- Medium-sized datasets that fit in memory
- Low-latency requirements
- Real-time applications

---

## Backend Comparison

### Performance Characteristics

| Metric | Kuzu | Neo4j | FalkorDB |
|--------|------|-------|----------|
| **Write throughput** | Medium | Medium | High |
| **Read latency** | Low | Medium | Very Low |
| **Scaling** | Single-node | Clustered | Single-node* |
| **Memory usage** | Low | Medium | High |
| **Disk usage** | Compressed | Medium | High |

*FalkorDB clustering available in enterprise version

### Feature Comparison

| Feature | Kuzu | Neo4j | FalkorDB |
|---------|------|-------|----------|
| **ACID transactions** | Yes | Yes | Yes |
| **Vector indices** | No | Yes (5.13+) | Yes |
| **Full-text search** | No | Yes | Yes |
| **Graph algorithms** | Limited | Extensive (GDS) | Limited |
| **Visualization** | No | Excellent | Basic |
| **Cypher support** | Subset | Full | OpenCypher |

### Cost Comparison

| Backend | Free Tier | Production Cost |
|---------|-----------|-----------------|
| **Kuzu** | Fully free | N/A (embedded) |
| **Neo4j Community** | Fully free | Self-managed |
| **Neo4j Enterprise** | N/A | $$$$ |
| **Neo4j Aura** | 200K nodes | $65+/month |
| **FalkorDB** | Fully free | Self-managed |
| **FalkorDB Cloud** | N/A | $$/month |

## Migration Between Backends

### Export from One Backend

```python
# Export graph data
data = await hippo.export_graph(
    format="json",        # or "cypher", "csv"
    include_embeddings=True
)

with open("graph_export.json", "w") as f:
    json.dump(data, f)
```

### Import to Another Backend

```python
# Initialize new backend
new_hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687"
)

# Import data
with open("graph_export.json") as f:
    data = json.load(f)

await new_hippo.import_graph(data)
await new_hippo.build_indices_and_constraints()
```

## Connection Pooling

### Neo4j Connection Pool

```python
# Optimize for concurrent access
config = Neo4jConfig(
    uri="bolt://localhost:7687",
    max_connection_pool_size=50,        # Increase for high concurrency
    connection_acquisition_timeout=60,
    max_connection_lifetime=3600,       # 1 hour max connection age
    connection_liveness_check_timeout=10
)
```

### FalkorDB Connection Pool

```python
# Redis connection pooling
import redis

pool = redis.ConnectionPool(
    host='localhost',
    port=6379,
    max_connections=50,
    socket_timeout=30
)

config = FalkorDBConfig(
    connection_pool=pool,
    database="hipporag"
)
```

## Troubleshooting

| Issue | Backend | Solution |
|-------|---------|----------|
| Connection refused | All | Verify server is running |
| Authentication failed | Neo4j/FalkorDB | Check username/password |
| Slow queries | Neo4j | Add appropriate indices |
| Out of memory | FalkorDB | Increase Redis maxmemory |
| Database locked | Kuzu | Check for other processes |
| Write failed | All | Check disk space, permissions |

## Reference

### Environment Variables

```bash
# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j

# FalkorDB
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_PASSWORD=
FALKORDB_DATABASE=hipporag

# Kuzu
KUZU_DB_PATH=./hipporag_data
```

### Health Checks

```python
# Check backend health
health = await hippo.health_check()
print(f"Backend: {health['backend']}")
print(f"Connected: {health['connected']}")
print(f"Version: {health['version']}")
print(f"Node count: {health['node_count']}")
print(f"Edge count: {health['edge_count']}")
```

## Related Sub-Skills

- **core-indexing**: Uses backend for triple storage
- **core-retrieval**: Queries backend for PPR
- **integration-mcp**: MCP server needs backend configuration
- **comparison-graphrag**: Backend considerations for different approaches
