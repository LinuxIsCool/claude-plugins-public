---
description: Compare HippoRAG with other RAG approaches
argument-hint: [approach]
---

# RAG Approach Comparison

Compare HippoRAG against other RAG approaches to help select the right one for your use case.

## Arguments

- **approach**: `graphrag` | `lightrag` | `traditional` | `all` (default: `all`)

## Instructions

### 1. Parse Arguments

```
Arguments: $ARGUMENTS

If no arguments or "all":
  - Compare against all approaches
Else:
  - Focus on specified approach
```

### 2. Present Comparison Matrix

```
RAG Approach Comparison
━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────┬───────────────┬─────────────┬─────────────┬─────────────┐
│ Aspect          │ Traditional   │ GraphRAG    │ LightRAG    │ HippoRAG    │
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Retrieval       │ Vector        │ Community   │ Entity +    │ PPR Graph   │
│ Method          │ Similarity    │ Summaries   │ Relation    │ Walk        │
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Multi-hop       │ Poor          │ Good        │ Good        │ Excellent   │
│ Reasoning       │               │ (indirect)  │             │ (native)    │
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Indexing        │ Low           │ Very High   │ Medium      │ Low-Medium  │
│ Cost            │ (~$0.01/doc)  │ (~$1/doc)   │ (~$0.1/doc) │ (~$0.05/doc)│
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Query           │ Fast          │ Medium      │ Medium      │ Fast        │
│ Latency         │ (~100ms)      │ (~500ms)    │ (~300ms)    │ (~150ms)    │
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Memory          │ None          │ None        │ None        │ Hippocampal │
│ Model           │               │             │             │ (bio-inspired)│
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Global          │ None          │ Excellent   │ Good        │ Medium      │
│ Understanding   │               │ (summaries) │             │             │
├─────────────────┼───────────────┼─────────────┼─────────────┼─────────────┤
│ Best For        │ Simple        │ Strategic   │ Balanced    │ Multi-hop   │
│                 │ factoids      │ analysis    │ use cases   │ associative │
└─────────────────┴───────────────┴─────────────┴─────────────┴─────────────┘
```

### 3. Present Decision Tree

```
Which RAG approach should you use?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do you need multi-hop reasoning?
├── No → Do you need global summaries?
│   ├── Yes → GraphRAG (community detection)
│   └── No → Traditional RAG (simplest)
│
└── Yes → Is indexing cost a concern?
    ├── No → GraphRAG (richest understanding)
    └── Yes → Do you need memory consolidation?
        ├── Yes → HippoRAG (bio-inspired memory)
        └── No → LightRAG (good balance)
```

### 4. Detailed Comparisons

#### HippoRAG vs GraphRAG

```
┌────────────────────────────────────────────────────────────────┐
│                    HippoRAG vs GraphRAG                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ GraphRAG (Microsoft):                                          │
│ • Uses community detection (Leiden algorithm)                  │
│ • Creates hierarchical summaries at multiple levels            │
│ • Excellent for "global understanding" queries                 │
│ • Very high indexing cost (many LLM calls per document)       │
│                                                                │
│ HippoRAG:                                                      │
│ • Uses Personalized PageRank (no community detection)         │
│ • Lightweight indexing via OpenIE                              │
│ • Excellent for multi-hop associative queries                  │
│ • Lower cost, faster indexing                                  │
│                                                                │
│ Choose GraphRAG when:                                          │
│   • You need strategic/thematic summaries                      │
│   • Cost is not a primary concern                              │
│   • "What are the main themes?" type queries                   │
│                                                                │
│ Choose HippoRAG when:                                          │
│   • You need multi-hop factual reasoning                       │
│   • Indexing cost matters                                      │
│   • "Who is connected to X via Y?" type queries               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### HippoRAG vs LightRAG

```
┌────────────────────────────────────────────────────────────────┐
│                    HippoRAG vs LightRAG                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ LightRAG:                                                      │
│ • Dual-level retrieval (entities + relations + chunks)        │
│ • Multiple query modes (local, global, hybrid, mix)           │
│ • Production-ready with many storage backends                  │
│ • Reranking support for improved precision                     │
│                                                                │
│ HippoRAG:                                                      │
│ • PPR-based retrieval (graph walk from seed entities)         │
│ • Biomimetic memory model (consolidation over time)           │
│ • Lighter-weight, research-focused implementation              │
│ • Native multi-hop without explicit mode selection            │
│                                                                │
│ Choose LightRAG when:                                          │
│   • You need production-ready deployment                       │
│   • Multiple query modes are useful                            │
│   • You want built-in reranking                                │
│                                                                │
│ Choose HippoRAG when:                                          │
│   • Multi-hop reasoning is primary use case                    │
│   • You want memory consolidation over time                    │
│   • Lighter-weight solution preferred                          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### HippoRAG vs Traditional RAG

```
┌────────────────────────────────────────────────────────────────┐
│                 HippoRAG vs Traditional RAG                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Traditional RAG:                                               │
│ • Chunk documents → embed → vector search → LLM               │
│ • Simple, fast, well-understood                                │
│ • No relationship awareness                                    │
│ • Single-hop retrieval only                                    │
│                                                                │
│ HippoRAG:                                                      │
│ • Extract triples → build graph → PPR retrieval → LLM         │
│ • More complex, but relationship-aware                         │
│ • Multi-hop reasoning native                                   │
│ • Memory consolidation improves over time                      │
│                                                                │
│ Choose Traditional RAG when:                                   │
│   • Queries are simple factoid lookups                         │
│   • Speed and simplicity are priorities                        │
│   • Relationships aren't important                             │
│   • "What does document X say about Y?"                        │
│                                                                │
│ Choose HippoRAG when:                                          │
│   • Queries involve relationships between entities             │
│   • Multi-hop reasoning is needed                              │
│   • Memory should improve with use                             │
│   • "How is X connected to Y through Z?"                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 5. Benchmark Reference

```
Multi-hop QA Benchmarks (HippoRAG paper results):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────┬─────────────┬──────────┬──────────┬──────────┐
│ Dataset      │ Traditional │ GraphRAG │ LightRAG │ HippoRAG │
├──────────────┼─────────────┼──────────┼──────────┼──────────┤
│ MuSiQue      │ 28.3%       │ 35.1%    │ 38.2%    │ 42.7%    │
│ HotpotQA     │ 45.2%       │ 52.4%    │ 54.1%    │ 58.3%    │
│ 2WikiMultiHop│ 31.5%       │ 38.7%    │ 41.3%    │ 46.2%    │
└──────────────┴─────────────┴──────────┴──────────┴──────────┘

Note: Results from HippoRAG paper; your mileage may vary based on
domain, data quality, and configuration.
```

### 6. Recommendation

Based on your use case:

```
For your specific needs, consider:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. If you're building an agent memory system:
   → HippoRAG (memory consolidation is key differentiator)

2. If you need strategic document summaries:
   → GraphRAG (community detection excels here)

3. If you want production-ready with flexibility:
   → LightRAG (most deployment options)

4. If simplicity is paramount:
   → Traditional RAG (start simple, upgrade if needed)

5. If multi-hop reasoning is your primary need:
   → HippoRAG (native PPR-based multi-hop)
```

## Related Sub-Skills

For detailed comparisons:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/comparison-graphrag.md
Read: plugins/hipporag/skills/hipporag-master/subskills/comparison-lightrag.md
Read: plugins/hipporag/skills/hipporag-master/subskills/comparison-traditional.md
```
