---
name: falkordb
description: Master FalkorDB for ultra-fast graph database operations optimized for LLM and AI agent memory systems. Use when building knowledge graphs, agent memory, RAG with graph traversal, or entity relationship storage. Supports OpenCypher queries and graph algorithms.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# FalkorDB Mastery

Ultra-fast graph database for AI agents and knowledge graphs.

## Territory Map

```
resources/embeddings/FalkorDB/
├── src/                     # C implementation
│   ├── graph/               # Graph data structures
│   ├── algorithms/          # Graph algorithms
│   └── execution_plan/      # Query execution
├── tests/                   # Test suites
└── docs/                    # Documentation
```

## Core Capabilities

- **Sparse matrix representation** using GraphBLAS
- **Linear algebra-based** query execution
- **Multi-tenant** with isolated graphs per Redis instance
- **Property Graph Model** compliance
- **OpenCypher** query language
- **Graph algorithms**: PageRank, BFS, WCC, CDLP, MSF

## OpenCypher Query Language

### Pattern Matching
```cypher
-- Find connected nodes
MATCH (p:Person)-[:KNOWS]->(friend:Person)
RETURN friend.name

-- Multi-hop traversal
MATCH (a:Person)-[:KNOWS*1..3]->(b:Person)
WHERE b.age > 25
RETURN a.name, b.name

-- Optional patterns (left join)
MATCH (a:Actor)-[:ACTS_IN]->(m:Movie)
OPTIONAL MATCH (a)-[:AWARDS]->(award)
RETURN a.name, COUNT(award) as awards
```

### Data Manipulation
```cypher
-- Create nodes with properties
CREATE (n:Person {name: "Alice", age: 30})

-- Create relationships
CREATE (a:Person)-[:KNOWS]->(b:Person)

-- Update properties
MATCH (p:Person {name: "Alice"})
SET p.age = 31

-- Delete (with cascading)
MATCH (p:Person {name: "Alice"})
DELETE p
```

## Beginner Techniques

### Basic Node Operations
```cypher
-- Create
CREATE (n:Person {name: "Alice", age: 30})

-- Query
MATCH (p:Person {name: "Alice"})
RETURN p.age

-- Count
MATCH (p:Person)
RETURN COUNT(p) as total
```

### Simple Relationships
```cypher
-- Create relationship with property
CREATE (a:Actor)-[:ACTS_IN {role: "Lead"}]->(m:Movie)

-- Find connected nodes
MATCH (p:Person)-[:KNOWS]-(friend:Person)
RETURN friend.name
```

## Intermediate Techniques

### Variable-Length Paths
```cypher
-- Friends of friends (2 hops)
MATCH (me:Person {id: 1})-[:KNOWS]-()-[:KNOWS]-(fof:Person)
RETURN DISTINCT fof.name

-- Constrained path length
MATCH (a:Person)-[:KNOWS*1..3]->(b:Person)
RETURN a.name, b.name
```

### Complex Patterns
```cypher
-- Multiple relationship types
MATCH (a:Actor)-[:ACTS_IN]->(m:Movie)<-[:DIRECTED]-(d:Director)
RETURN a.name, m.title, d.name

-- Intersection of paths
MATCH (a:Person)-[:KNOWS]->(c:Person),
      (b:Person)-[:KNOWS]->(c:Person)
WHERE a.id < b.id
RETURN a.name, b.name, c.name
```

## Advanced Techniques

### Graph Algorithms
```cypher
-- PageRank
CALL algo.pageRank('Person', 'KNOWS')
YIELD node, score
RETURN node.name, score
ORDER BY score DESC

-- Community Detection
CALL algo.cdlp('Person', 'KNOWS')
YIELD node, community
RETURN community, COUNT(node) as size

-- Shortest Path
CALL algo.shortestPath.dijkstra(startId, endId, 'KNOWS')
YIELD path, length
RETURN path, length

-- Weakly Connected Components
CALL algo.wcc()
YIELD node, component
RETURN component, collect(node.name) as members
```

### Vector Similarity Search
```cypher
-- K-nearest neighbor search
CALL algo.knn('Document', 'embedding', 5, $queryVector)
YIELD node, score
RETURN node.title, score
ORDER BY score DESC

-- Combine with graph traversal
CALL algo.knn('Document', 'embedding', 10, $queryVector)
YIELD node
MATCH (node)-[:RELATES_TO]->(related:Document)
RETURN node.title, related.title
```

### Metadata & Introspection
```cypher
CALL db.labels()           -- All node labels
CALL db.relationshipTypes() -- All relationship types
CALL db.propertyKeys()     -- All properties
CALL db.stats()            -- Graph statistics
```

## Commands

```bash
# Main commands
GRAPH.QUERY {key} {query}     # Execute query
GRAPH.RO_QUERY {key} {query}  # Read-only query
GRAPH.DELETE {key}            # Delete graph
GRAPH.EXPLAIN {key} {query}   # Execution plan
```

## Client Libraries

- Python: `falkordb`
- JavaScript: `falkordb`
- Java: `jfalkordb`
- Go: `falkordb-go`
- Rust: `falkordb-rs`

## Use Cases for AI/LLMs

**Agent Memory**:
```cypher
-- Store conversation entities
CREATE (topic:Topic {id: $contextId})-[:mentions]->(entity:Entity {name: $name})

-- Retrieve context
MATCH (topic:Topic)-[:mentions]->(entity)
WHERE topic.id = $contextId
RETURN entity
```

**RAG with Graph**:
- Store document chunks as nodes
- Link with semantic relationships
- Multi-hop traversal for context

**Entity Resolution**:
- Community detection for clustering
- Property comparison for disambiguation

## When to Use FalkorDB

- Knowledge graphs for AI agents
- Entity relationship storage
- Graph-augmented RAG
- Social network analysis
- Recommendation systems
- Temporal knowledge graphs

## Reference Files

- Query syntax: OpenCypher standard
- Algorithms: `CALL algo.*` procedures
- Full-text search: `CALL db.idx.fulltext.*`
