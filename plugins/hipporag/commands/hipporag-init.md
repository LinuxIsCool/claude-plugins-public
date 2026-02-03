---
description: Initialize HippoRAG memory system with chosen backend
argument-hint: [backend] [connection]
---

# HippoRAG Initialization

Initialize a HippoRAG instance with the specified graph database backend.

## Arguments

- **backend**: `neo4j` | `falkordb` | `kuzu` (default: `kuzu`)
- **connection**: Database connection string (default: embedded for kuzu)

## Instructions

### 1. Parse Arguments

```
Arguments: $ARGUMENTS

If no arguments provided:
  - backend = kuzu (embedded, zero-config)
  - connection = ./hipporag_data/

Parse format: "[backend] [connection]"
Examples:
  - "kuzu" → embedded Kuzu at ./hipporag_data/
  - "neo4j bolt://localhost:7687" → Neo4j connection
  - "falkordb redis://localhost:6379" → FalkorDB connection
```

### 2. Validate Backend

Check if the specified backend is available:

**For Kuzu (embedded)**:
```bash
pip show kuzu || pip install kuzu
```

**For Neo4j**:
```bash
# Check Neo4j is running
curl -s http://localhost:7474 || echo "Neo4j not accessible"
pip show neo4j || pip install neo4j
```

**For FalkorDB**:
```bash
# Check Redis/FalkorDB is running
redis-cli -h localhost -p 6379 ping || echo "FalkorDB not accessible"
pip show falkordb || pip install falkordb
```

### 3. Install HippoRAG

```bash
pip show hipporag || pip install hipporag
```

### 4. Initialize Configuration

Create configuration file at `.hipporag/config.yaml`:

```yaml
backend:
  type: {backend}
  connection: {connection}

extraction:
  model: gpt-4o-mini  # or claude-sonnet-4-5-latest
  batch_size: 10

retrieval:
  damping_factor: 0.85
  max_iterations: 20
  top_k: 20

embedding:
  model: text-embedding-3-small
  dimension: 1536
```

### 5. Build Indices

For graph databases that require indices:

**Neo4j**:
```cypher
CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name);
CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.type);
CREATE INDEX relation_type IF NOT EXISTS FOR ()-[r:RELATES]-() ON (r.type);
```

**FalkorDB**:
```
# Indices created automatically via FalkorDB schema
```

**Kuzu**:
```
# Embedded database, schema created on first use
```

### 6. Report Status

Output initialization summary:

```
HippoRAG Initialized
━━━━━━━━━━━━━━━━━━━
Backend: {backend}
Connection: {connection}
Config: .hipporag/config.yaml

Next steps:
  /hipporag-index <path>  - Index documents
  /hipporag-query <query> - Execute retrieval query
```

## Backend Selection Guide

| Backend | Best For | Requirements |
|---------|----------|--------------|
| **kuzu** | Development, small datasets, embedded | None (bundled) |
| **neo4j** | Production, large scale, visualization | Neo4j server |
| **falkordb** | High performance, Redis ecosystem | Redis + FalkorDB |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Ensure database server is running |
| Authentication failed | Check credentials in connection string |
| Missing dependencies | Run `pip install hipporag[{backend}]` |

## Related Sub-Skills

For detailed backend configuration:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/integration-backends.md
```

For LLM client setup:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/integration-llm.md
```
