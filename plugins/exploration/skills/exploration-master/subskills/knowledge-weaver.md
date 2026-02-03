---
name: knowledge-weaver
description: Weave exploration discoveries into a temporal knowledge graph using FalkorDB/Graphiti. Use when persisting discoveries as connected nodes, querying relationships, or finding patterns across circles.
allowed-tools: Bash, Read, Glob, Grep, Task
---

# Knowledge Weaver

Transform exploration discoveries into a living knowledge graph. This skill bridges exploration with the graph infrastructure to enable relational reasoning about the environment.

## Prerequisites - Reference These Skills

**For detailed patterns, invoke these skills first:**

| Skill | Use For |
|-------|---------|
| `llms:graphiti` | Temporal knowledge graphs, episode ingestion, hybrid search |
| `llms:falkordb` | OpenCypher queries, graph algorithms, direct operations |
| `agents:mem0` | Self-improving memory, automatic fact extraction |
| `awareness:temporal-kg-memory` | Production patterns for conversation → graph |

This skill focuses on **exploration-specific** usage patterns.

## Critical Insight: Direct Parsing vs LLM

From `awareness:temporal-kg-memory` production experience:

> **LLM extraction is WRONG for structured data.**
> - LLM extraction: 80-140 seconds per 10 events, creates duplicates
> - Direct parsing: 2 seconds per 10 events, no duplicates

**Rule**: Use direct JSON/structured parsing for exploration data. Reserve LLM (Graphiti's `add_episode`) for unstructured narrative text only.

## Quick Start

### Unix-Style Tools

```bash
# Remember something (direct to graph, no LLM)
echo "Neo4j runs on port 7474" | python tools/remember.py --circle network

# Recall knowledge (keyword search)
python tools/recall.py "database ports"

# Ingest structured discovery (direct parsing)
python tools/ingest_exploration.py discovery.json
```

### Python API

```python
from tools.graphiti_config import get_falkordb, get_graphiti

# For structured data - use direct FalkorDB (fast, no LLM)
graph = get_falkordb()
graph.query("CREATE (e:Entity {name: 'Neo4j', type: 'container'})")

# For unstructured text - use Graphiti (LLM extraction)
graphiti = await get_graphiti()
await graphiti.add_episode(name="discovery", episode_body="Found something interesting...")
```

## Exploration Graph Schema

### Node Types

```cypher
// Exploration domain nodes
(:Circle {name, mastery, mastery_level, description})
(:Discovery {id, text, circle, created_at, valid_at})
(:Entity {id, name, entity_type, circle, first_seen})
(:Question {id, text, circle, status, priority, created_at})

// Temporal properties on all edges
[r {created_at, valid_at, confidence}]
```

### Relationship Types

```cypher
// Temporal sequence (following awareness:temporal-kg-memory pattern)
(:Discovery)-[:THEN]->(:Discovery)     // Linear chain, not hub-and-spoke

// Discovery relationships
(:Discovery)-[:FOUND]->(:Entity)       // What was discovered
(:Discovery)-[:RAISED]->(:Question)    // Questions generated
(:Discovery)-[:IN_CIRCLE]->(:Circle)   // Which circle

// Entity relationships
(:Entity)-[:RUNS_ON]->(:Entity)
(:Entity)-[:PART_OF]->(:Entity)
(:Entity)-[:USES]->(:Entity)
(:Entity)-[:CONNECTS_TO]->(:Entity)
(:Entity)-[:IN_CIRCLE]->(:Circle)

// Question relationships
(:Question)-[:ABOUT]->(:Entity)
(:Question)-[:IN_CIRCLE]->(:Circle)
```

## Workflows

### 1. Record a Discovery (Direct Parsing)

Create a JSON file:
```json
{
  "circle": "network",
  "summary": "Found Neo4j container with Bolt on 7687",
  "entities": [
    {"name": "Neo4j", "type": "container", "properties": {"port": 7687}}
  ],
  "questions": ["What data is stored in Neo4j?"]
}
```

Ingest:
```bash
python tools/ingest_exploration.py discovery.json
```

### 2. Quick Memory Addition

```bash
# One-liner additions
python tools/remember.py "Claude Code version is 2.0.67" --circle tools
python tools/remember.py "GPU is RTX 4070 with 12GB VRAM" --circle substrate

# From pipe (useful in scripts)
docker ps --format '{{.Names}}: {{.Image}}' | python tools/remember.py --circle network
```

### 3. Search Knowledge

```bash
# Keyword search
python tools/recall.py "database"
python tools/recall.py --circle network "port"
python tools/recall.py --type entity "container"

# JSON output for scripting
python tools/recall.py --json "GPU" | jq '.[] | .text'
```

### 4. Direct Cypher Queries

For complex queries, use FalkorDB directly:

```python
from tools.graphiti_config import get_falkordb

graph = get_falkordb()

# What entities are in the network circle?
result = graph.query("""
    MATCH (e:Entity)-[:IN_CIRCLE]->(c:Circle {name: 'network'})
    RETURN e.name, e.entity_type
""")

# What questions are open?
result = graph.query("""
    MATCH (q:Question {status: 'open'})
    RETURN q.text, q.circle, q.priority
    ORDER BY q.priority
""")

# Cross-circle connections
result = graph.query("""
    MATCH (e1:Entity)-[:IN_CIRCLE]->(c1:Circle),
          (e1)-[r]-(e2:Entity)-[:IN_CIRCLE]->(c2:Circle)
    WHERE c1.name <> c2.name
    RETURN c1.name, e1.name, type(r), e2.name, c2.name
""")
```

### 5. Semantic Search (When Needed)

For unstructured queries requiring LLM understanding:

```python
from tools.graphiti_config import get_graphiti

graphiti = await get_graphiti()

# Hybrid search: semantic + keyword + graph traversal
results = await graphiti.search("What containers use the GPU?")
for edge in results.edges:
    print(edge.fact)
```

See `llms:graphiti` for advanced search recipes (RRF fusion, cross-encoder reranking).

## Graph Visualization

View the exploration graph at http://localhost:3001 (FalkorDB browser):

```cypher
-- See everything
MATCH (n)-[r]->(m) RETURN n, r, m

-- See by circle
MATCH (c:Circle {name: 'substrate'})<-[:IN_CIRCLE]-(e)
RETURN c, e

-- See discovery chains
MATCH path = (d1:Discovery)-[:THEN*]->(d2:Discovery)
RETURN path
```

## When to Use What

| Situation | Use This | Why |
|-----------|----------|-----|
| Structured discovery data | `ingest_exploration.py` | Direct parsing, fast |
| Quick fact to remember | `remember.py` | Simple, Unix-style |
| Keyword search | `recall.py` | Fast, no LLM needed |
| Complex graph queries | Direct Cypher | Full control |
| Unstructured narrative | Graphiti `add_episode()` | LLM extraction |
| Semantic search | Graphiti `search()` | Hybrid retrieval |
| Self-improving memory | Mem0 | Automatic contradictions |

## Philosophy

A knowledge graph is not just storage - it's a **model of understanding**.

```
Flat Files:                 Knowledge Graph:
  discovery-1.md             ┌─────┐
  discovery-2.md      →      │Neo4j│──[RUNS_ON]──→┌────┐
  discovery-3.md             └─────┘              │Host│
                                │                 └────┘
                           [STORES_DATA]
                                ↓
                           ┌────────┐
                           │Graphiti│
                           └────────┘
```

Facts are nodes. Understanding is the graph. The exploration plugin discovers facts; the knowledge weaver transforms them into understanding.

## Reference Files

- Configuration: `tools/graphiti_config.py`
- Quick add: `tools/remember.py`
- Search: `tools/recall.py`
- Batch ingest: `tools/ingest_exploration.py`
- Bootstrap: `tools/seed_falkordb.py`
- Architecture: `ARCHITECTURE.md`

For framework documentation:
- Graphiti: Invoke `llms:graphiti`
- FalkorDB Cypher: Invoke `llms:falkordb`
- Mem0 memory: Invoke `agents:mem0`
- Production patterns: Invoke `awareness:temporal-kg-memory`
