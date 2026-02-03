---
name: memory
description: This skill should be used when the user asks about "agent memory", "context persistence", "memory architecture", "embedding models", "vector search", "RAG systems", "HippoRAG", "mem0", "agentmemory", "claude-mem", "lumera memory", "domain memory", or needs guidance on implementing memory systems for AI agents. Master skill covering 8 specialized memory sub-skills.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash, Task, WebFetch, WebSearch
---

# Memory Plugin - Master Skill

Comprehensive agent memory system providing expertise across multiple memory frameworks, embedding models, and architectural patterns. This master skill orchestrates access to 8 specialized sub-skills.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **agentmemory** | ChromaDB/Postgres vector memory with semantic search | `../agentmemory/SKILL.md` |
| **hipporag** | Hippocampal-inspired RAG with knowledge graphs + PageRank | `../hipporag/SKILL.md` |
| **mem0** | Three-tier memory (user/session/agent) with 90% token reduction | `../mem0/SKILL.md` |
| **claude-mem** | Claude Code plugin patterns with progressive disclosure | `../claude-mem/SKILL.md` |
| **lumera-memory** | Blockchain-backed encrypted permanent storage | `../lumera-memory/SKILL.md` |
| **domain-memory** | TF-IDF search with zero ML dependencies | `../domain-memory/SKILL.md` |
| **embeddings** | State-of-art embedding models, MTEB benchmarks, selection guidance | `../embeddings/SKILL.md` |
| **vector-search** | Vector database integration (ChromaDB, FAISS, pgvector, SQLite) | `../vector-search/SKILL.md` |

## Quick Reference: When to Use Which Framework

| Requirement | Recommended Framework | Why |
|-------------|----------------------|-----|
| Fast prototyping | agentmemory | Simple API, ChromaDB default |
| Production accuracy | mem0 | 26% accuracy gain over OpenAI |
| Complex reasoning | HippoRAG | Knowledge graph + multi-hop |
| Claude Code plugin | claude-mem | Native hooks, proven patterns |
| Permanent archival | lumera-memory | Blockchain, AES-256 encryption |
| Zero dependencies | domain-memory | TF-IDF only, no ML |
| Edge/mobile | embeddings (EmbeddingGemma) | <22ms, 300M params |

## Memory Architecture Decision Framework

To select the appropriate memory architecture:

### Step 1: Determine Temporal Requirements

```
Hot Memory (0-24h)    → In-memory cache, auto-inject all
Warm Memory (1-7d)    → SQLite + embeddings, triggered retrieval
Cold Memory (8d+)     → Explicit search, permanent archive
```

### Step 2: Assess Infrastructure Constraints

```
No GPU available      → domain-memory (TF-IDF) or pre-computed embeddings
Limited storage       → mem0 (90% token reduction)
Privacy requirements  → lumera-memory (client-side encryption)
Graph relationships   → HippoRAG (knowledge graph)
Simple semantics      → agentmemory (vector similarity)
```

### Step 3: Evaluate Integration Points

For Claude Code plugins, use the hook architecture:

| Hook Event | Memory Application |
|------------|-------------------|
| UserPromptSubmit | Inject hot/warm context |
| PostToolUse | Index tool results |
| Stop | Summarize and store exchange |
| SessionEnd | Batch embedding generation |
| PreCompact | Archive context before loss |

## Loading Sub-Skills

To get detailed guidance on any framework, read the sub-skill:

```
Read /path/to/plugin/skills/agentmemory/SKILL.md
Read /path/to/plugin/skills/hipporag/SKILL.md
Read /path/to/plugin/skills/embeddings/SKILL.md
```

## Core Concepts

### Three-Tier Temporal Memory

All frameworks can implement the three-tier pattern:

1. **Hot Tier**: Last 24 hours, auto-inject, no threshold filtering
2. **Warm Tier**: 1-7 days, triggered by semantic cues, 0.4 similarity threshold
3. **Cold Tier**: 8+ days, explicit invocation only

### Progressive Disclosure (Token Optimization)

The claude-mem pattern achieves ~10x token savings:

1. **Layer 1 (search)**: Compact index with IDs (~50-100 tokens)
2. **Layer 2 (timeline)**: Chronological context (~200-500 tokens)
3. **Layer 3 (get_observations)**: Full details only when needed (~500-1000 tokens)

### Hybrid Search

Combine semantic and keyword search for best results:

```python
final_score = (
    similarity * 0.6 +      # Semantic weight
    keyword_score * 0.4 +   # Keyword weight
    recency_weight * 0.3 +  # Exponential decay
    importance * 0.25       # Manual importance flags
)
```

## References

### External Repositories (Cloned for Analysis)

- `/.research/agentmemory/` - elizaOS/agentmemory
- `/.research/HippoRAG/` - OSU-NLP-Group/HippoRAG
- `/.research/mem0/` - mem0ai/mem0
- `/.research/claude-mem/` - thedotmack/claude-mem
- `/.research/claude-code-plugins-plus-skills/` - jeremylongshore plugin collection

### Internal References

- `references/architecture-comparison.md` - Detailed framework comparison
- `references/embedding-models.md` - MTEB leaderboard analysis
- `references/hook-patterns.md` - Claude Code hook implementations

## Implementation Starting Points

### Minimal Memory (30 minutes)

```python
from agentmemory import create_memory, search_memory

create_memory("context", "User prefers dark mode", metadata={"type": "preference"})
results = search_memory("context", "display settings")
```

### Production Memory (2-4 hours)

Use mem0 with three-tier architecture:
```python
from mem0 import Memory

m = Memory()
m.add("User is working on memory plugin", user_id="u1", metadata={"session": "s1"})
results = m.search("what is user working on", user_id="u1")
```

### Advanced Memory (8-16 hours)

HippoRAG with knowledge graph:
- Extract entities and relations
- Build graph with PageRank
- Multi-hop retrieval for complex queries

Consult the relevant sub-skill for detailed implementation guidance.
