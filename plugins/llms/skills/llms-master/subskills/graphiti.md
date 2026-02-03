---
name: graphiti
description: Master Graphiti for building temporally-aware knowledge graphs for AI agents. Use when building agent memory systems, dynamic knowledge graphs, real-time data ingestion, or hybrid retrieval combining semantic embeddings with graph traversal. Supports Neo4j, FalkorDB, Kuzu backends.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Graphiti Mastery

Build real-time, temporally-aware knowledge graphs for AI agent memory systems.

## Territory Map

```
resources/embeddings/Graphiti/
├── graphiti_core/           # Core library
│   ├── graphiti.py          # Main Graphiti class
│   ├── nodes.py             # EntityNode, EpisodicNode, CommunityNode
│   ├── edges.py             # EntityEdge, EpisodicEdge, CommunityEdge
│   ├── driver/              # Neo4j, FalkorDB, Kuzu, Neptune drivers
│   ├── llm_client/          # OpenAI, Anthropic, Gemini, Groq clients
│   ├── embedder/            # OpenAI, Voyage, Gemini embedders
│   └── search/              # Hybrid search with recipes
├── mcp_server/              # MCP integration for Claude/Cursor
└── examples/                # Quickstart and demos
```

## Core Capabilities

- **Real-time incremental updates** without batch recomputation
- **Bi-temporal tracking** (event time + ingestion time) for historical queries
- **Hybrid retrieval**: semantic embeddings + BM25 keyword + graph traversal
- **Custom entity definitions** via Pydantic models
- **Multi-backend**: Neo4j, FalkorDB, Kuzu, Amazon Neptune

## Beginner Techniques

### Basic Setup
```python
from graphiti_core import Graphiti
from datetime import datetime, timezone

graphiti = Graphiti("bolt://localhost:7687", "neo4j", "password")
await graphiti.build_indices_and_constraints()
```

### Add Episodes (Text, JSON, or Message)
```python
from graphiti_core.nodes import EpisodeType

result = await graphiti.add_episode(
    name="meeting_notes",
    episode_body="Alice is the CEO of TechCorp. Bob is the CTO.",
    source=EpisodeType.text,
    source_description="meeting notes",
    reference_time=datetime.now(timezone.utc)
)
```

### Simple Search
```python
results = await graphiti.search("Who is the CEO?")
for edge in results.edges:
    print(f"{edge.fact}")
```

## Intermediate Techniques

### Custom Search Recipes
```python
from graphiti_core.search.search_config_recipes import (
    NODE_HYBRID_SEARCH_RRF,
    COMBINED_HYBRID_SEARCH_CROSS_ENCODER
)

results = await graphiti.search_(
    query="Find all companies",
    search_config=NODE_HYBRID_SEARCH_RRF,
    limit=5
)
```

### Group Partitioning (Multi-tenant)
```python
await graphiti.add_episode(
    name="alice_preferences",
    episode_body="Alice: I prefer Python",
    source=EpisodeType.message,
    group_id="alice_session"  # Namespace by group
)

results = await graphiti.search("preferences", group_id="alice_session")
```

### Community Detection
```python
await graphiti.build_communities(community_size=5)
```

## Advanced Techniques

### Custom LLM & Embedder Providers
```python
from graphiti_core.llm_client.anthropic_client import AnthropicClient
from graphiti_core.embedder.voyage import VoyageEmbedder

graphiti = Graphiti(
    uri="bolt://localhost:7687",
    user="neo4j", password="password",
    llm_client=AnthropicClient(config=...),
    embedder=VoyageEmbedder(config=...)
)
```

### Alternative Graph Databases
```python
# FalkorDB
from graphiti_core.driver.falkordb_driver import FalkorDriver
driver = FalkorDriver(host="localhost", port=6379)

# Kuzu (embedded)
from graphiti_core.driver.kuzu_driver import KuzuDriver
driver = KuzuDriver(db="/path/to/graphiti.kuzu")
```

### MCP Server Integration
Configure in Claude Desktop:
```json
{
  "mcpServers": {
    "graphiti-memory": {
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

MCP Tools: `add_episode`, `search_nodes`, `search_facts`, `get_episodes`, `clear_graph`

## Key Patterns

| Pattern | Use Case |
|---------|----------|
| Episode ingestion | Continuous data updates |
| Hybrid search | Combine semantic + keyword + graph |
| Community detection | Cluster related entities |
| Temporal queries | Point-in-time historical analysis |
| Group partitioning | Multi-tenant isolation |

## When to Use Graphiti

- Building AI agent memory systems
- Dynamic knowledge bases with real-time updates
- Temporal data that changes over time
- Combining RAG with graph relationships
- Multi-hop reasoning over entities

## Reference Files

- Main class: `graphiti_core/graphiti.py`
- Search recipes: `graphiti_core/search/search_config_recipes.py`
- MCP server: `mcp_server/README.md`
- Quickstart: `examples/quickstart/README.md`
