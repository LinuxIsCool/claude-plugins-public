---
name: search
description: Master skill for repository search (4 active, 6 planned sub-skills). Covers: hybrid-search, rag-pipelines, vector-embeddings, search-orchestration. Future: graph-rag, fuzzy-search, ripgrep-patterns, elasticsearch. Invoke for finding code, understanding retrieval, or choosing search methods.
allowed-tools: Read, Skill, Task, Glob, Grep, Bash, WebFetch
---

# Search Plugin - Master Skill

Master search capabilities for code repositories. From low-level grep to sophisticated Graph RAG.

## Philosophy

**The Navigator's Creed**: Finding is not enough. Understanding where to look, why certain methods work, and how to improve over time - that is mastery.

## Sub-Skills Index

| Sub-Skill | Use When | Status | File |
|-----------|----------|--------|------|
| **hybrid-search** | Combining keyword (BM25) with semantic (vector) search | Active | `subskills/hybrid-search.md` |
| **rag-pipelines** | Building retrieval-augmented generation workflows | Active | `subskills/rag-pipelines.md` |
| **vector-embeddings** | Working with embeddings, pgvector, similarity metrics | Active | `subskills/vector-embeddings.md` |
| **search-orchestration** | Choosing which search method for which task | Active | `subskills/search-orchestration.md` |
| **graph-rag** | Graph-enhanced retrieval, knowledge graph queries | Phase 2 | `subskills/graph-rag.md` |
| **fuzzy-search** | Approximate matching, Levenshtein, n-gram | Phase 2 | `subskills/fuzzy-search.md` |
| **ripgrep-patterns** | Advanced regex, file filtering, performance | Phase 2 | `subskills/ripgrep-patterns.md` |
| **elasticsearch** | Full-text search, indexing, analyzers | Phase 3 | `subskills/elasticsearch.md` |
| **self-improvement** | Query pattern learning, mastery progression | Phase 2 | `subskills/self-improvement.md` |
| **anti-patterns** | What NOT to do - common search mistakes | Phase 3 | `subskills/anti-patterns.md` |

## Quick Selection Guide

### By Use Case

| Need | Sub-Skill | Why |
|------|-----------|-----|
| Find code by meaning | vector-embeddings | Semantic similarity captures intent |
| Find exact matches | ripgrep-patterns | Pattern matching is precise |
| Balance precision & recall | hybrid-search | Best of both worlds |
| Build LLM context | rag-pipelines | Structured retrieval for generation |
| Navigate relationships | graph-rag | Follow connections between entities |
| Handle typos/variants | fuzzy-search | Approximate matching |
| Choose between methods | search-orchestration | Decision framework |

### By Query Type

| Query Type | Recommended Method |
|------------|-------------------|
| "Find all uses of X" | ripgrep-patterns |
| "Code similar to this" | vector-embeddings |
| "Explain how X works" | rag-pipelines |
| "Find X or things like X" | hybrid-search |
| "How does X connect to Y?" | graph-rag |
| "Find Xs even with typos" | fuzzy-search |

### By Scale

| Data Size | Recommended |
|-----------|-------------|
| < 1K files | ripgrep (fast enough) |
| 1K - 100K files | hybrid-search (indexed) |
| > 100K files | elasticsearch (distributed) |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill.

### Deep Dive
```
Read: plugins/search/skills/search-master/subskills/{name}.md
```

### The Search Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    USER QUERY                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    "What method?"    ┌─────────────────┐   │
│  │   Query     │ ──────────────────▶  │   Orchestrator   │  │
│  │  Analysis   │                       │  (chooses path)  │  │
│  └─────────────┘                       └────────┬────────┘   │
│                                                 │            │
│         ┌───────────────────────────────────────┼──────┐    │
│         │                   │                   │      │    │
│         ▼                   ▼                   ▼      ▼    │
│  ┌────────────┐    ┌────────────┐    ┌────────┐ ┌────────┐ │
│  │  Keyword   │    │  Semantic  │    │ Graph  │ │ Fuzzy  │ │
│  │  (BM25/rg) │    │  (Vector)  │    │ (RAG)  │ │        │ │
│  └─────┬──────┘    └─────┬──────┘    └───┬────┘ └───┬────┘ │
│        │                 │               │          │      │
│        └─────────────────┼───────────────┼──────────┘      │
│                          ▼                                  │
│                   ┌────────────┐                            │
│                   │   Hybrid   │                            │
│                   │  Ranker    │                            │
│                   └─────┬──────┘                            │
│                         ▼                                   │
│                  ┌─────────────┐                            │
│                  │   Results   │                            │
│                  │ + Learning  │                            │
│                  └─────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Sub-Skill Summaries

### Phase 1: Core Search (Active)

**hybrid-search** - The best of both worlds. Combines BM25 keyword matching with vector semantic search. Reciprocal rank fusion for result merging. The default choice for most searches.

**rag-pipelines** - Retrieval-Augmented Generation patterns. Chunking strategies, retrieval methods, prompt templates, evaluation metrics. How to build context for LLMs.

**vector-embeddings** - Working with embeddings. Models (OpenAI, sentence-transformers, nomic), databases (pgvector, Pinecone, Qdrant), distance metrics (cosine, L2, inner product), indexing (HNSW, IVFFlat).

**search-orchestration** - The meta-skill. When to use which method. Query analysis, method selection, result fusion, fallback strategies.

### Phase 2: Specialized Search (Planned)

**graph-rag** - Knowledge graph enhanced retrieval. Entity extraction, relationship traversal, subgraph retrieval, combining vector + graph signals.

**fuzzy-search** - Approximate string matching. Levenshtein distance, Jaro-Winkler, n-gram similarity. Handling typos, abbreviations, variants.

**ripgrep-patterns** - Master of regex. Advanced patterns, performance optimization, file type filtering, context lines, multiline matching.

**self-improvement** - Learning from usage. Query pattern analysis, success metrics, preference tracking, mastery progression.

### Phase 3: Enterprise Search (Planned)

**elasticsearch** - Full-text search at scale. Inverted indexes, analyzers, aggregations, distributed search, relevance tuning.

**anti-patterns** - What NOT to do. Common mistakes, performance pitfalls, when simple is better than sophisticated.

## Mastery Progression

```
Level 0: Stranger
- Uses grep/find for everything
- Doesn't know other methods exist

Level 1: Tourist
- Knows multiple methods exist
- Uses them randomly

Level 2: Resident
- Understands trade-offs
- Can choose appropriate method

Level 3: Native
- Builds hybrid pipelines
- Optimizes for specific use cases

Level 4: Navigator (Master)
- Teaches others
- Contributes new patterns
- Improves the search system itself
```

## Integration Points

### With Other Plugins

| Plugin | Integration |
|--------|-------------|
| **llms** | Uses pgvector, graphiti for storage |
| **knowledge-graphs** | Leverages graph traversal for Graph RAG |
| **logging** | Searches conversation history |
| **awareness** | Learns from temporal-kg-memory patterns |

### With Claude Code Tools

| Tool | How Search Enhances It |
|------|------------------------|
| **Grep** | Orchestrator decides when regex is best |
| **Glob** | File filtering recommendations |
| **Task (Explore)** | When to delegate vs search directly |

## Self-Improvement Architecture

```
┌─────────────────────────────────────────┐
│         SELF-IMPROVEMENT LOOP            │
├─────────────────────────────────────────┤
│                                          │
│  Query → Method → Results → Feedback     │
│    │                           │         │
│    │      ┌───────────────┐   │         │
│    └─────▶│  Learnings    │◀──┘         │
│           │  Log          │              │
│           └───────┬───────┘              │
│                   │                      │
│           ┌───────▼───────┐              │
│           │  Pattern      │              │
│           │  Recognition  │              │
│           └───────┬───────┘              │
│                   │                      │
│           ┌───────▼───────┐              │
│           │  Method       │              │
│           │  Optimization │              │
│           └───────────────┘              │
│                                          │
└─────────────────────────────────────────┘

State stored in: plugins/search/state/
- learnings.md: Experiment log with mastery tracking
- preferences.local.md: User-specific patterns (gitignored)
```

## The Navigator's Principles

1. **Match method to query** - Not everything needs embeddings
2. **Simple before complex** - grep often beats RAG
3. **Measure before assuming** - Benchmark your methods
4. **Learn from failures** - Failed searches are data
5. **Share cartography** - Document what works for others
