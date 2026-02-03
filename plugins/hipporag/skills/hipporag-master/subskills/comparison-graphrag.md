---
name: comparison-graphrag
description: Deep comparison between HippoRAG and Microsoft GraphRAG. Covers architectural differences, retrieval mechanisms, cost tradeoffs, and decision criteria for choosing between them.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Comparison: HippoRAG vs GraphRAG

Understanding when to use HippoRAG vs Microsoft's GraphRAG.

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HippoRAG vs GraphRAG Architecture                        │
├───────────────────────────────────┬─────────────────────────────────────────┤
│            HippoRAG               │              GraphRAG                   │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                                   │                                         │
│  Documents                        │  Documents                              │
│      │                            │      │                                  │
│      ▼                            │      ▼                                  │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │ OpenIE  │                      │  │  Chunking   │                       │
│  │ Triples │                      │  │  + Entities │                       │
│  └────┬────┘                      │  └──────┬──────┘                       │
│       │                           │         │                               │
│       ▼                           │         ▼                               │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │ Schema- │                      │  │  Community  │                       │
│  │  less   │                      │  │  Detection  │                       │
│  │  Graph  │                      │  │  (Leiden)   │                       │
│  └────┬────┘                      │  └──────┬──────┘                       │
│       │                           │         │                               │
│       ▼                           │         ▼                               │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │   PPR   │                      │  │  Community  │                       │
│  │ Search  │                      │  │  Summaries  │                       │
│  └─────────┘                      │  └─────────────┘                       │
│                                   │                                         │
│  Retrieval: Multi-hop PPR         │  Retrieval: Hierarchical summaries     │
│  Strengths: Associative recall    │  Strengths: Global synthesis           │
│  Inspired by: Hippocampus         │  Inspired by: Community structure      │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

## Key Architectural Differences

### 1. Knowledge Representation

| Aspect | HippoRAG | GraphRAG |
|--------|----------|----------|
| **Unit** | Triple (subject, predicate, object) | Entity + community membership |
| **Schema** | Schema-less (emergent) | Schema-less with community hierarchy |
| **Granularity** | Fine-grained relations | Community-level summaries |
| **Storage** | Graph database | Graph + vector store + summaries |

### 2. Indexing Process

**HippoRAG Indexing:**
```
Document → OpenIE Extraction → Triples → Graph Storage
          ~$0.002/doc          ~1-5 triples/sent    O(1) per triple

Cost: Low (extraction only)
Time: Fast (no clustering)
Output: Dense knowledge graph
```

**GraphRAG Indexing:**
```
Document → Chunking → Entity Extraction → Graph → Community Detection → Summaries
           O(1)       ~$0.01/chunk        O(E)    O(V log V)           ~$0.05/community

Cost: High (multiple LLM passes + summarization)
Time: Slow (iterative clustering)
Output: Hierarchical community summaries
```

### 3. Retrieval Mechanism

**HippoRAG Retrieval:**
```python
# Personalized PageRank from seed entities
query = "What companies did Apple's founders start?"

# 1. Extract query entities
seeds = ["Apple", "founders"]  # Matched to graph nodes

# 2. PPR walk
# Starts from seeds, follows edges, decays by damping factor
# Multi-hop: Apple → Steve Jobs → NeXT, Pixar

# 3. Return top-k nodes/edges by PPR score
results = ranked_by_ppr_score(graph, seeds, damping=0.85)
```

**GraphRAG Retrieval:**
```python
# Community-based retrieval
query = "What companies did Apple's founders start?"

# Local search: Vector similarity within communities
# Global search: Map-reduce over community summaries

# Local: Find relevant entities, return community context
# Global: Query all community summaries, synthesize
```

## Decision Framework

### Choose HippoRAG When:

1. **Multi-hop reasoning is critical**
   ```
   Query: "Who mentored the advisor of the CEO's predecessor?"
   HippoRAG: Follows relationship chain naturally via PPR
   GraphRAG: Requires multiple community lookups
   ```

2. **Associative recall matters**
   ```
   Query: "What else is connected to X?"
   HippoRAG: PPR discovers related entities automatically
   GraphRAG: Limited to community boundaries
   ```

3. **Budget constraints**
   ```
   HippoRAG indexing: ~$0.01-0.05 per document
   GraphRAG indexing: ~$0.50-2.00 per document (10-50x more)
   ```

4. **Real-time updates needed**
   ```
   HippoRAG: Add triples incrementally, no reprocessing
   GraphRAG: Community structure may need recalculation
   ```

5. **Fine-grained facts preferred**
   ```
   HippoRAG: Returns specific (subject, predicate, object) facts
   GraphRAG: Returns community summaries (may lose detail)
   ```

### Choose GraphRAG When:

1. **Global synthesis required**
   ```
   Query: "What are the main themes across all documents?"
   GraphRAG: Community summaries provide global view
   HippoRAG: Returns individual facts, requires synthesis
   ```

2. **Hierarchical understanding needed**
   ```
   Query: "Give me an overview of the organization structure"
   GraphRAG: Multi-level community hierarchy
   HippoRAG: Flat graph, no inherent hierarchy
   ```

3. **Document collection is static**
   ```
   One-time indexing cost amortized over many queries
   GraphRAG summaries pre-computed for fast retrieval
   ```

4. **Abstractive answers preferred**
   ```
   GraphRAG: LLM-generated summaries ready to use
   HippoRAG: Facts require post-processing for narrative
   ```

## Quantitative Comparison

### Indexing Cost

| Metric | HippoRAG | GraphRAG |
|--------|----------|----------|
| **LLM calls/doc** | 1 (extraction) | 3-5 (chunk, extract, summarize) |
| **Cost/1000 docs** | ~$10-50 | ~$500-2000 |
| **Time/1000 docs** | ~10-30 min | ~2-8 hours |
| **Storage** | Graph only | Graph + vectors + summaries |

### Retrieval Performance

| Metric | HippoRAG | GraphRAG |
|--------|----------|----------|
| **Multi-hop accuracy** | Higher | Lower |
| **Global synthesis** | Lower | Higher |
| **Latency** | 50-200ms | 100-500ms |
| **Context window usage** | Efficient (facts) | Large (summaries) |

### Benchmark Results (from HippoRAG paper)

| Dataset | HippoRAG | GraphRAG | Vector RAG |
|---------|----------|----------|------------|
| **MuSiQue** | 62.3% | 54.1% | 45.8% |
| **2WikiMultihop** | 71.2% | 63.4% | 52.1% |
| **HotpotQA** | 68.5% | 61.2% | 55.3% |

*Note: Results from HippoRAG paper, multi-hop QA benchmarks*

## Implementation Considerations

### HippoRAG Setup

```python
# Minimal setup
from hipporag import HippoRAG

hippo = HippoRAG(
    backend="kuzu",  # or neo4j, falkordb
    llm_model="gpt-4o-mini",
    embedding_model="text-embedding-3-small"
)

# Index and query
await hippo.add_episode("Document content...")
results = await hippo.search("Query")
```

### GraphRAG Setup

```python
# Requires more configuration
from graphrag.index import create_pipeline
from graphrag.query import create_search_engine

# Multi-stage pipeline
pipeline = create_pipeline(
    input_dir="./documents",
    output_dir="./graphrag_output",
    entity_extraction_prompt="...",
    community_summarization_prompt="...",
    # Many more config options
)

await pipeline.run()  # Long indexing process
```

## Hybrid Approach

For best of both worlds:

```python
# Use HippoRAG for multi-hop, GraphRAG for global
class HybridRAG:
    def __init__(self):
        self.hippo = HippoRAG(backend="neo4j")
        self.graphrag = GraphRAGSearch(output_dir="./graphrag")

    async def search(self, query, mode="auto"):
        if mode == "auto":
            # Classify query type
            if is_multi_hop_query(query):
                return await self.hippo.search(query)
            elif is_global_synthesis_query(query):
                return await self.graphrag.global_search(query)
            else:
                # Combine both
                hippo_results = await self.hippo.search(query)
                graphrag_results = await self.graphrag.local_search(query)
                return merge_results(hippo_results, graphrag_results)
```

## Migration Path

### From GraphRAG to HippoRAG

```python
# Export GraphRAG entities to HippoRAG
async def migrate_graphrag_to_hipporag(graphrag_output_dir, hippo):
    # Load GraphRAG entity graph
    entities = load_graphrag_entities(graphrag_output_dir)
    relations = load_graphrag_relations(graphrag_output_dir)

    # Convert to HippoRAG episodes
    for rel in relations:
        content = f"{rel.source} {rel.relation} {rel.target}"
        await hippo.add_episode(
            content,
            source=f"graphrag_migration",
            metadata={"original_community": rel.community_id}
        )
```

### From HippoRAG to GraphRAG

```python
# Export HippoRAG triples for GraphRAG indexing
async def export_for_graphrag(hippo, output_dir):
    # Export as documents (GraphRAG will re-extract)
    edges = await hippo.get_all_edges()

    # Group by source document
    docs = group_edges_by_source(edges)

    for doc_id, doc_edges in docs.items():
        content = "\n".join(
            f"{e.subject} {e.predicate} {e.object}"
            for e in doc_edges
        )
        save_document(output_dir, doc_id, content)
```

## Summary Decision Matrix

| Factor | HippoRAG | GraphRAG | Winner |
|--------|----------|----------|--------|
| **Multi-hop queries** | Excellent | Good | HippoRAG |
| **Global synthesis** | Limited | Excellent | GraphRAG |
| **Indexing cost** | Low | High | HippoRAG |
| **Indexing speed** | Fast | Slow | HippoRAG |
| **Incremental updates** | Easy | Difficult | HippoRAG |
| **Abstraction level** | Facts | Summaries | Depends |
| **Tooling maturity** | Emerging | Maturing | GraphRAG |
| **Documentation** | Growing | Extensive | GraphRAG |

## Related Sub-Skills

- **comparison-lightrag**: Another graph-based alternative
- **comparison-traditional**: When vectors alone suffice
- **core-retrieval**: HippoRAG's PPR mechanism in depth
- **recipes-use-cases**: Real-world application patterns
