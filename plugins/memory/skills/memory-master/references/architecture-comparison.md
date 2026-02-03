# Memory Architecture Comparison

Detailed comparison of memory frameworks for informed selection.

## Framework Comparison Matrix

| Framework | Persistence | Search | Dependencies | Accuracy | Token Savings |
|-----------|-------------|--------|--------------|----------|---------------|
| agentmemory | ChromaDB/Postgres | Vector | chromadb | Good | - |
| HippoRAG | Files | KG+PageRank | networkx, LLM | Best | - |
| mem0 | Configurable | Vector+Extract | mem0ai | +26% vs OpenAI | 90% |
| claude-mem | SQLite+Chroma | Hybrid | bun | Good | ~10x |
| lumera-memory | Blockchain | FTS5 | cryptography | Good | - |
| domain-memory | In-memory | TF-IDF | None | Moderate | - |

## Detailed Framework Analysis

### agentmemory (elizaOS)

**Architecture**:
- ChromaDB for vector storage (default)
- Postgres alternative for production
- Category-based memory organization
- Event system for memory notifications

**Strengths**:
- Simple API (`create_memory`, `search_memory`)
- Built-in clustering for memory organization
- Export/import functionality
- Well-documented

**Weaknesses**:
- No built-in temporal decay
- No progressive disclosure
- Requires ChromaDB dependency

**Best for**: Quick prototyping, simple semantic search needs

### HippoRAG (OSU-NLP)

**Architecture**:
- Knowledge graph from documents
- Entity extraction via OpenIE
- PageRank for relevance ranking
- Multi-hop reasoning support

**Strengths**:
- Best for complex, relational queries
- Multi-hop reasoning capability
- Knowledge graph explainability
- Research-backed methodology

**Weaknesses**:
- Requires LLM for entity extraction
- Complex setup
- Higher latency

**Best for**: Research applications, complex reasoning tasks

### mem0 (mem0ai)

**Architecture**:
- Three-tier: user/session/agent
- Automatic memory extraction from conversations
- Graph memory optional (Neo4j)
- Multiple vector store backends

**Strengths**:
- Production-proven (26% accuracy improvement)
- 90% token reduction
- Multi-user support
- Rich configuration options

**Weaknesses**:
- Requires LLM for extraction
- More complex setup
- API dependency for hosted version

**Best for**: Production applications, multi-user systems

### claude-mem (thedotmack)

**Architecture**:
- 5 Claude Code lifecycle hooks
- Worker service on port 37777
- SQLite + Chroma hybrid
- Progressive disclosure pattern

**Strengths**:
- Native Claude Code integration
- ~10x token savings
- Web viewer UI
- Biomimetic decay mode

**Weaknesses**:
- Claude Code specific
- Requires worker service
- Bun runtime dependency

**Best for**: Claude Code plugins, session-based memory

### lumera-memory (jeremylongshore)

**Architecture**:
- Cascade blockchain storage
- AES-256-GCM client-side encryption
- SQLite FTS5 local index
- Memory card generation

**Strengths**:
- Permanent, immutable storage
- Client-side encryption
- PII redaction
- No external API needed

**Weaknesses**:
- Blockchain overhead
- More complex retrieval
- Storage costs

**Best for**: Compliance, audit trails, permanent archival

### domain-memory (jeremylongshore)

**Architecture**:
- TF-IDF based search
- In-memory document store
- No ML dependencies
- Extractive summarization

**Strengths**:
- Zero dependencies
- Explainable results
- Fast indexing
- Offline capable

**Weaknesses**:
- Keyword dependent
- No semantic understanding
- Vocabulary mismatch issues

**Best for**: Edge deployment, privacy-sensitive, prototyping

## Selection Decision Tree

```
Start
 │
 ├─ Need permanent archival?
 │   └─ Yes → lumera-memory
 │
 ├─ Need multi-hop reasoning?
 │   └─ Yes → HippoRAG
 │
 ├─ Multi-user production system?
 │   └─ Yes → mem0
 │
 ├─ Claude Code plugin?
 │   └─ Yes → claude-mem patterns
 │
 ├─ Zero dependencies required?
 │   └─ Yes → domain-memory
 │
 └─ Simple prototyping?
     └─ Yes → agentmemory
```

## Performance Benchmarks

### Retrieval Quality (Relative)

| Framework | Simple Queries | Complex Queries | Multi-hop |
|-----------|---------------|-----------------|-----------|
| agentmemory | Good | Moderate | Poor |
| HippoRAG | Good | Excellent | Excellent |
| mem0 | Good | Good | Moderate |
| domain-memory | Moderate | Poor | Poor |

### Latency (Approximate)

| Framework | Indexing | Search (1000 docs) |
|-----------|----------|-------------------|
| agentmemory | ~100ms | ~50ms |
| HippoRAG | ~500ms+ | ~200ms |
| mem0 | ~200ms | ~100ms |
| domain-memory | ~10ms | ~50ms |

### Token Consumption

| Framework | Context Injection | Claim |
|-----------|------------------|-------|
| mem0 | Filtered | 90% reduction |
| claude-mem | Progressive | ~10x savings |
| agentmemory | Full | No reduction |
| HippoRAG | Ranked | Variable |

## Hybrid Approaches

### Recommended Combinations

1. **Prototype → Production**:
   - Start with agentmemory
   - Migrate to mem0 when ready

2. **Speed + Quality**:
   - domain-memory for fast filtering
   - mem0 for semantic refinement

3. **Claude Code Plugin**:
   - claude-mem patterns for hooks
   - ChromaDB from agentmemory for storage

4. **Research System**:
   - HippoRAG for complex reasoning
   - mem0 for user context
