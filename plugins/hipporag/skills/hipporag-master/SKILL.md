---
name: hipporag
description: Master skill for HippoRAG neurobiological memory framework (10 sub-skills). Covers core-indexing, core-retrieval, core-consolidation, integration-backends, integration-mcp, integration-llm, comparison-graphrag, comparison-lightrag, comparison-traditional, recipes-use-cases. Invoke for biomimetic RAG, multi-hop retrieval, memory-augmented LLMs, or RAG approach selection.
allowed-tools: Read, Skill, Task, Glob, Grep, Bash, WebFetch
---

# HippoRAG Plugin - Master Skill

Neurobiologically-inspired retrieval-augmented generation with knowledge graphs and associative memory.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **core-indexing** | Setting up OpenIE extraction, building knowledge graphs from documents | `subskills/core-indexing.md` |
| **core-retrieval** | Personalized PageRank queries, multi-hop reasoning, associative recall | `subskills/core-retrieval.md` |
| **core-consolidation** | Memory consolidation, schema evolution, long-term knowledge management | `subskills/core-consolidation.md` |
| **integration-backends** | Choosing graph database (Neo4j, FalkorDB, Kuzu), backend configuration | `subskills/integration-backends.md` |
| **integration-mcp** | Setting up MCP server for Claude Code ecosystem integration | `subskills/integration-mcp.md` |
| **integration-llm** | Configuring LLM clients (OpenAI, Anthropic, local models) | `subskills/integration-llm.md` |
| **comparison-graphrag** | Understanding HippoRAG vs GraphRAG tradeoffs | `subskills/comparison-graphrag.md` |
| **comparison-lightrag** | Understanding HippoRAG vs LightRAG tradeoffs | `subskills/comparison-lightrag.md` |
| **comparison-traditional** | Understanding HippoRAG vs vector-only RAG | `subskills/comparison-traditional.md` |
| **recipes-use-cases** | Multi-hop QA, agent memory, conversational context patterns | `subskills/recipes-use-cases.md` |

## Quick Selection Guide

### By Use Case

| Need | Sub-Skill |
|------|-----------|
| Initial setup | integration-backends, integration-llm |
| Document ingestion | core-indexing |
| Query execution | core-retrieval |
| Long-term memory | core-consolidation |
| Claude Code integration | integration-mcp |
| Choosing RAG approach | comparison-* |
| Implementation patterns | recipes-use-cases |

### By Comparison Point

| Comparing Against | Sub-Skill |
|-------------------|-----------|
| GraphRAG (Microsoft) | comparison-graphrag |
| LightRAG | comparison-lightrag |
| Traditional vector RAG | comparison-traditional |

## The Hippocampal Analogy

HippoRAG mimics three core hippocampal functions:

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│    INDEXING     │ ──> │    RETRIEVAL    │ ──> │  CONSOLIDATION   │
│    (OpenIE)     │     │     (PPR)       │     │    (Schema)      │
└─────────────────┘     └─────────────────┘     └──────────────────┘
   Pattern                 Associative            Long-term
   Separation              Recall                 Storage
```

1. **Pattern Separation (Indexing)**: Extract distinct entities and relations via OpenIE
2. **Associative Recall (Retrieval)**: Navigate knowledge graph with PPR for multi-hop reasoning
3. **Consolidation (Schema)**: Evolve schema and strengthen connections over time

## Why HippoRAG?

### The Problem with Traditional RAG

```
Query ──> Embedding ──> Vector Search ──> Top-K Chunks ──> LLM
                              │
                              └── Single-hop only, no relationship awareness
```

Traditional RAG finds semantically similar chunks but cannot:
- Follow multi-hop relationships ("Who founded the company that acquired X?")
- Leverage entity-relationship structure for context
- Build persistent memory that improves over time

### The HippoRAG Solution

```
Documents ──> OpenIE ──> Knowledge Graph
                              │
Query ──> Entity Extraction ──┘
              │
              └──> Personalized PageRank Walk
                          │
                          └──> Multi-hop Context ──> LLM
```

HippoRAG adds:
- **Associative retrieval**: PPR follows relationships, not just similarity
- **Multi-hop reasoning**: Naturally discovers connected facts
- **Memory consolidation**: Schema evolves with repeated access

### Comparison Summary

| Aspect | Traditional RAG | GraphRAG | LightRAG | HippoRAG |
|--------|-----------------|----------|----------|----------|
| **Retrieval** | Vector similarity | Community summaries | Entity + Relation | PPR graph walk |
| **Multi-hop** | Poor | Good (via summaries) | Good | Excellent (native) |
| **Indexing Cost** | Low | Very High | Medium | Low-Medium |
| **Query Latency** | Fast | Medium | Medium | Fast |
| **Memory Model** | None | None | None | Hippocampal |

## Learning Progression

```
                    integration-backends
                           │
                           ▼
                    integration-llm
                           │
                           ▼
                    core-indexing ──────────────────┐
                           │                        │
                           ▼                        │
                    core-retrieval                  │
                           │                        │
                           ▼                        │
                recipes-use-cases                   │
                           │                        │
                           ▼                        │
                core-consolidation                  │
                           │                        │
                           ▼                        │
                    integration-mcp                 │
                           │                        │
                           ▼                        │
                    comparison-* ◄──────────────────┘
                 (when choosing approach)
```

## Sub-Skill Summaries

### Core Capabilities

- **core-indexing**: OpenIE triple extraction (subject-predicate-object), entity recognition, knowledge graph construction. Covers LLM-based extraction, batch processing, and incremental updates.

- **core-retrieval**: Personalized PageRank algorithm, query entity extraction, multi-hop graph traversal. Covers damping factor tuning, walk depth limits, and result ranking.

- **core-consolidation**: Schema evolution, edge strengthening based on access patterns, contradiction detection, temporal decay. Covers long-term memory management.

### Integration

- **integration-backends**: Neo4j (production scale), FalkorDB (Redis-based, high performance), Kuzu (embedded, zero-config). Installation, configuration, and performance tuning.

- **integration-mcp**: MCP server setup for Claude Code ecosystem. Expose HippoRAG as tools: `hipporag_add_episode`, `hipporag_search`, `hipporag_get_status`.

- **integration-llm**: OpenAI GPT models, Anthropic Claude, local models via vLLM/Ollama. API configuration, embedding selection, cost optimization.

### Comparisons

- **comparison-graphrag**: Microsoft GraphRAG uses community detection and summarization. Higher indexing cost but rich global understanding. HippoRAG is lighter with native multi-hop.

- **comparison-lightrag**: LightRAG uses dual-level (entity + relation) retrieval. Similar philosophy but different graph construction and query modes.

- **comparison-traditional**: When to use HippoRAG vs simple vector RAG. Multi-hop queries benefit; simple factoid lookups may not need graphs.

### Implementation

- **recipes-use-cases**: Multi-hop QA patterns, agent memory systems, conversational context, codebase QA, research paper synthesis. Complete implementation examples.

## How to Use

### Quick Reference

```
Read: plugins/hipporag/skills/hipporag-master/subskills/{skill}.md
```

### Example Invocations

| User Intent | Sub-Skill to Read |
|-------------|-------------------|
| "Set up HippoRAG" | integration-backends, integration-llm |
| "Index my documents" | core-indexing |
| "Query my knowledge graph" | core-retrieval |
| "Build agent memory" | core-consolidation, integration-mcp |
| "HippoRAG vs GraphRAG?" | comparison-graphrag |
| "Multi-hop QA setup" | recipes-use-cases |

## Key Technical Details

### OpenIE Extraction

HippoRAG uses LLM-based OpenIE (Open Information Extraction) to extract triples:

```
Input: "Alice is the CEO of TechCorp. She founded it in 2020."

Output Triples:
  (Alice, is CEO of, TechCorp)
  (Alice, founded, TechCorp)
  (TechCorp, founded in, 2020)
```

### Personalized PageRank

PPR starts from query-related entities and walks the graph:

```python
# Simplified PPR concept
def personalized_pagerank(graph, seed_nodes, damping=0.85, iterations=20):
    scores = initialize_from_seeds(seed_nodes)
    for _ in range(iterations):
        scores = damping * propagate(graph, scores) + (1 - damping) * seed_scores
    return top_k(scores, k=20)
```

### Memory Consolidation

Inspired by hippocampal-neocortical consolidation:

```
Short-term (Hippocampus)     Long-term (Neocortex)
        │                            │
        ▼                            ▼
  Episodic Graph  ──replay──>  Semantic Schema
  (raw triples)               (strengthened edges)
```

## Repository Reference

**Official Repository**: https://github.com/OSU-NLP-Group/HippoRAG

**Papers**:
- HippoRAG (NeurIPS 2024): "HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models"
- HippoRAG 2 (ICML 2025): "From RAG to Memory: Non-Parametric Continual Learning for Large Language Models"

## Relationship to Other Plugins

- **knowledge-graphs**: General KG toolkit; HippoRAG is specialized for memory-centric retrieval
- **llms**: Provides embedding infrastructure that HippoRAG uses
- **search**: Traditional search methods; HippoRAG adds graph-based associative retrieval
- **awareness**: Learning patterns; HippoRAG enables memory for learning systems
