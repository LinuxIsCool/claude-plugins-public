# HippoRAG Plugin

Neurobiologically-inspired RAG with OpenIE knowledge graphs and Personalized PageRank retrieval.

## Overview

HippoRAG is a retrieval framework inspired by the hippocampal memory indexing theory. This plugin provides comprehensive knowledge for configuring, deploying, and using HippoRAG in production systems.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         The Hippocampal Trinity                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    Indexing              Retrieval            Consolidation                 │
│  (Pattern Separation)  (Pattern Completion)  (Memory Strengthening)        │
│                                                                             │
│    OpenIE               Personalized          Schema Evolution              │
│    Extraction           PageRank              Edge Decay                    │
│                                                                             │
│    Documents →          Query →               Time →                        │
│    Knowledge Graph      Associative Recall    Refined Memory                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Initialize HippoRAG

```bash
# Via command
/hipporag-init
```

Or in Python:

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend="kuzu",                          # or "neo4j", "falkordb"
    llm_model="gpt-4o-mini",                 # For extraction
    embedding_model="text-embedding-3-small" # For embeddings
)
```

### Index Documents

```bash
# Via command
/hipporag-index ./documents/
```

Or in Python:

```python
await hippo.add_episode("Alice founded TechCorp in 2020. Bob joined as CTO.")
```

### Query

```bash
# Via command
/hipporag-query "Who founded TechCorp?"
```

Or in Python:

```python
results = await hippo.search("What companies did Alice found?")
for edge in results.edges:
    print(f"{edge.subject} --[{edge.predicate}]--> {edge.object}")
```

## Plugin Components

### Master Skill

The `hipporag` skill provides access to 10 sub-skills:

| Sub-Skill | Purpose |
|-----------|---------|
| `core-indexing` | OpenIE extraction and graph construction |
| `core-retrieval` | PPR algorithm and query execution |
| `core-consolidation` | Memory strengthening and decay |
| `integration-backends` | Neo4j, FalkorDB, Kuzu setup |
| `integration-llm` | OpenAI, Anthropic, Ollama config |
| `integration-mcp` | MCP server integration |
| `comparison-graphrag` | HippoRAG vs GraphRAG |
| `comparison-lightrag` | HippoRAG vs LightRAG |
| `comparison-traditional` | HippoRAG vs vector RAG |
| `recipes-use-cases` | Production patterns |

### Agent

The **Memory Architect** agent (`hipporag:memory-architect`) is a specialist in:

- Designing memory system architectures
- Selecting optimal backends and configurations
- Debugging retrieval issues
- Optimizing indexing pipelines

### Commands

| Command | Description |
|---------|-------------|
| `/hipporag-init` | Initialize HippoRAG with guided setup |
| `/hipporag-index` | Index documents into knowledge graph |
| `/hipporag-query` | Execute retrieval queries |
| `/hipporag-compare` | Compare with other RAG approaches |

## When to Use HippoRAG

### HippoRAG Excels At

- **Multi-hop reasoning**: "Who founded the company that acquired our competitor?"
- **Associative recall**: "What's connected to this concept?"
- **Entity-centric queries**: "Tell me everything about Alice"
- **Memory-like systems**: Consolidation, decay, contradiction detection

### Consider Alternatives For

- **Single-hop queries**: Traditional vector RAG is simpler
- **Global synthesis**: GraphRAG's community summaries are better
- **Maximum simplicity**: LightRAG is self-contained

## Architecture

```
Documents                    Knowledge Graph                   Query
    │                              │                             │
    ▼                              ▼                             ▼
┌─────────┐                 ┌─────────────┐              ┌─────────────┐
│ OpenIE  │────Triples─────►│   Graph     │◄────PPR──────│   Search    │
│ Extract │                 │  Database   │              │   Engine    │
└─────────┘                 └─────────────┘              └─────────────┘
                                   │
                                   ▼
                           ┌─────────────┐
                           │Consolidation│
                           │   Service   │
                           └─────────────┘
```

## Backend Selection

| Backend | Best For |
|---------|----------|
| **Kuzu** | Development, embedded, single-user |
| **Neo4j** | Production, visualization, teams |
| **FalkorDB** | High-throughput, Redis infrastructure |

## Resources

- [HippoRAG Paper](https://arxiv.org/abs/2405.14831)
- [OSU-NLP-Group/HippoRAG](https://github.com/OSU-NLP-Group/HippoRAG)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [FalkorDB Documentation](https://docs.falkordb.com/)
- [Kuzu Documentation](https://docs.kuzudb.com/)

## License

This plugin is part of the claude-plugins ecosystem.
