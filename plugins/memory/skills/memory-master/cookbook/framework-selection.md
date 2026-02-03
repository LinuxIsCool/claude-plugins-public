# Framework Selection Guide

Decision trees and selection criteria for choosing the right memory framework.

## Quick Reference Decision Tree

```
START: What is your primary requirement?
│
├─── Permanent archival + encryption required?
│    └─ YES → lumera-memory
│           - AES-256-GCM client-side encryption
│           - Cascade blockchain storage
│           - PII redaction (email, phone, AWS keys)
│           - Memory cards for structured metadata
│           - SQLite FTS5 local index
│
├─── Multi-hop reasoning + entity relationships?
│    └─ YES → HippoRAG
│           - Knowledge graph construction via OpenIE
│           - PageRank for relevance ranking
│           - Multi-hop query resolution
│           - Entity extraction and linking
│           - Research-backed methodology
│
├─── Multi-user production system?
│    └─ YES → mem0
│           - Three-tier: user/session/agent
│           - 90% token reduction
│           - 26% accuracy improvement vs OpenAI
│           - Automatic memory extraction
│           - Graph memory option (Neo4j)
│
├─── Claude Code plugin with hooks?
│    └─ YES → claude-mem patterns
│           - 5 lifecycle hooks
│           - Progressive disclosure (~10x token savings)
│           - Worker service (port 37777)
│           - Biomimetic decay
│           - SQLite + Chroma hybrid
│
├─── Zero dependencies / offline required?
│    └─ YES → domain-memory
│           - TF-IDF only (pure Python)
│           - Extractive summarization
│           - Explainable results
│           - <50ms search latency
│           - No model loading overhead
│
└─── Simple prototyping?
     └─ YES → agentmemory
            - Simple API (create/search/get)
            - ChromaDB default backend
            - Postgres option for production
            - Built-in deduplication
            - Event system for notifications

## Detailed Selection Matrix

### By Infrastructure Constraints

| Constraint | Recommended | Avoid | Notes |
|------------|-------------|-------|-------|
| No GPU | domain-memory, agentmemory | HippoRAG | Use pre-computed embeddings or TF-IDF |
| No network | domain-memory, lumera-memory | mem0 hosted | Offline-capable options |
| Limited storage | mem0 (90% reduction) | lumera-memory | Token efficiency critical |
| Existing Postgres | agentmemory (Supabase) | - | pgvector integration |
| Container/Lambda | domain-memory | HippoRAG | Minimal cold start |

### By Use Case

| Use Case | Primary | Alternative | Rationale |
|----------|---------|-------------|-----------|
| Chat memory | mem0 | claude-mem | Three-tier handles conversation context |
| Document search | agentmemory | HippoRAG | Vector similarity for simple queries |
| Research assistant | HippoRAG | mem0 + graph | Multi-hop reasoning required |
| Compliance/audit | lumera-memory | - | Immutable, encrypted storage |
| Edge/IoT | domain-memory | - | Zero dependencies, offline |
| Plugin development | claude-mem | agentmemory | Native hook integration |

### By Scale Requirements

| Scale | Framework | Database | Notes |
|-------|-----------|----------|-------|
| <1K docs | Any | ChromaDB | All frameworks perform well |
| 1K-100K docs | mem0, agentmemory | ChromaDB, pgvector | Consider index optimization |
| 100K-1M docs | mem0 | Qdrant, pgvector | Need efficient filtering |
| >1M docs | Custom | Milvus, Qdrant | Distributed architecture |

## Migration Paths

### Prototype to Production

```
agentmemory (ChromaDB)
    │
    ├─── Growing users → mem0
    │    - Add user_id, session_id tracking
    │    - Enable memory extraction
    │    - Configure graph store (optional)
    │
    └─── Growing documents → HippoRAG
         - Add entity extraction
         - Build knowledge graph
         - Enable PageRank retrieval
```

### Upgrading Token Efficiency

```
Full context injection
    │
    ├─── mem0 (90% reduction)
    │    - Memory extraction removes redundancy
    │    - Three-tier filtering
    │
    └─── claude-mem (10x savings)
         - Progressive disclosure pattern
         - Layer 1: IDs only (50-100 tokens)
         - Layer 2: Timeline (200-500 tokens)
         - Layer 3: Details on demand
```

### Adding Security

```
Any framework
    │
    └─── lumera-memory wrapper
         - Add PII redaction layer
         - Enable client-side encryption
         - Store to Cascade blockchain
         - Maintain local FTS index
```

## Hybrid Architecture Patterns

### Pattern 1: Speed + Quality

```
┌─────────────────────────────────────┐
│ Query                               │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ domain-memory (TF-IDF)              │
│ Fast keyword filtering (<50ms)      │
│ Returns: candidate_ids              │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ mem0 (Vector refinement)            │
│ Semantic reranking                  │
│ Returns: top_k results              │
└─────────────────────────────────────┘
```

### Pattern 2: Research System

```
┌─────────────────────────────────────┐
│ User Query                          │
└─────────────────────────────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌─────────┐   ┌─────────────┐
│ mem0    │   │ HippoRAG    │
│ User    │   │ Knowledge   │
│ Context │   │ Graph       │
└─────────┘   └─────────────┘
    │               │
    └───────┬───────┘
            ▼
┌─────────────────────────────────────┐
│ Merged Context                      │
│ User preferences + entity relations │
└─────────────────────────────────────┘
```

### Pattern 3: Claude Code Plugin

```
┌─────────────────────────────────────┐
│ SessionStart                        │
│ └─ Load from claude-mem hot cache   │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ UserPromptSubmit                    │
│ └─ Search agentmemory (ChromaDB)    │
│ └─ Apply progressive disclosure     │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ PostToolUse                         │
│ └─ Index with agentmemory           │
│ └─ Extract entities (optional)      │
└─────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ SessionEnd                          │
│ └─ Archive to lumera-memory         │
│    (if compliance required)         │
└─────────────────────────────────────┘
```

## Anti-Patterns to Avoid

### 1. Full Context Injection

```python
# BAD: Dumps all memories into context
context = "\n".join([m["content"] for m in all_memories])
```

**Problem**: Consumes entire context window, drowns signal in noise.

**Solution**: Use progressive disclosure or mem0's 90% reduction.

### 2. Single-Tier Memory

```python
# BAD: Everything in one bucket
memories.add(content, category="all")
```

**Problem**: No temporal filtering, old memories pollute recent context.

**Solution**: Implement three-tier (hot/warm/cold) architecture.

### 3. No Deduplication

```python
# BAD: Stores duplicates on every interaction
create_memory(category="facts", text=user_preference)
```

**Problem**: Same facts stored repeatedly, wasted storage and noise.

**Solution**: Use `create_unique_memory` with similarity threshold.

### 4. Missing User Isolation

```python
# BAD: All users share same memory space
m.add("User likes Python")  # No user_id
```

**Problem**: Memory leakage between users in multi-tenant systems.

**Solution**: Always include `user_id` in mem0 or category prefixes in agentmemory.

## Framework Comparison Summary

| Aspect | agentmemory | HippoRAG | mem0 | claude-mem | lumera | domain |
|--------|-------------|----------|------|------------|--------|--------|
| Setup Time | 5 min | 30 min | 10 min | 15 min | 20 min | 2 min |
| Dependencies | ChromaDB | networkx, LLM | mem0ai | bun | crypto | None |
| GPU Required | Optional | Recommended | Optional | No | No | No |
| Multi-hop | No | Yes | Limited | No | No | No |
| Token Savings | None | Variable | 90% | 10x | None | None |
| Encryption | No | No | No | No | Yes | No |
| Multi-user | Basic | No | Yes | Session | No | No |
| Best For | Prototype | Research | Production | Plugins | Compliance | Edge |
