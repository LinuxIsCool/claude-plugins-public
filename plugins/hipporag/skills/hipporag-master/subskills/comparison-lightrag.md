---
name: comparison-lightrag
description: Deep comparison between HippoRAG and LightRAG. Covers dual-level retrieval, graph construction differences, performance tradeoffs, and decision criteria for choosing between them.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Comparison: HippoRAG vs LightRAG

Understanding when to use HippoRAG vs LightRAG's dual-level retrieval.

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HippoRAG vs LightRAG Architecture                        │
├───────────────────────────────────┬─────────────────────────────────────────┤
│            HippoRAG               │              LightRAG                   │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                                   │                                         │
│  Documents                        │  Documents                              │
│      │                            │      │                                  │
│      ▼                            │      ▼                                  │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │ OpenIE  │                      │  │  Entity +   │                       │
│  │ Triples │                      │  │  Relation   │                       │
│  └────┬────┘                      │  │  Extraction │                       │
│       │                           │  └──────┬──────┘                       │
│       ▼                           │         │                               │
│  ┌─────────┐                      │         ▼                               │
│  │ Graph   │                      │  ┌─────────────┐                       │
│  │ + Embed │                      │  │  Graph +    │                       │
│  └────┬────┘                      │  │  Chunks     │                       │
│       │                           │  └──────┬──────┘                       │
│       ▼                           │         │                               │
│  ┌─────────┐                      │  ┌──────┴──────┐                       │
│  │   PPR   │                      │  │             │                       │
│  │ Search  │                      │  ▼             ▼                       │
│  └─────────┘                      │ Low-level   High-level                 │
│                                   │ (entities)  (summaries)                │
│                                   │                                         │
│  Single-path: PPR only            │  Dual-path: Entity + Global            │
│  Bio-inspired: Hippocampus        │  Pragmatic: Coverage optimization      │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

## Key Architectural Differences

### 1. Retrieval Strategy

| Aspect | HippoRAG | LightRAG |
|--------|----------|----------|
| **Approach** | Single-path (PPR) | Dual-level (low + high) |
| **Low-level** | Entity-centric PPR | Entity-centric vector search |
| **High-level** | Emergent from PPR walk | Explicit global summaries |
| **Fusion** | PPR scores | Configurable (RRF, weighted) |

### 2. Graph Construction

**HippoRAG Graph Construction:**
```python
# OpenIE-based, schema-less
Document: "Alice founded TechCorp. She hired Bob as CTO."

Triples:
- (Alice, founded, TechCorp)
- (Alice, hired, Bob)
- (Bob, is CTO of, TechCorp)

# Dense relationship capture
# Relations preserved as-is from text
```

**LightRAG Graph Construction:**
```python
# Entity-relation extraction with deduplication
Document: "Alice founded TechCorp. She hired Bob as CTO."

Entities:
- Alice [type: Person]
- TechCorp [type: Organization]
- Bob [type: Person]
- CTO [type: Role]

Relations:
- (Alice) --[FOUNDED]--> (TechCorp)
- (Alice) --[HIRED]--> (Bob)
- (Bob) --[HAS_ROLE]--> (CTO)

# Type normalization
# Relation standardization
```

### 3. Dual-Level Retrieval (LightRAG's Innovation)

```
LightRAG Dual-Level Retrieval:

Query: "What is TechCorp's leadership structure?"

┌─────────────────────────────────────────────────┐
│              Low-Level Retrieval                │
├─────────────────────────────────────────────────┤
│  1. Extract query entities: [TechCorp]          │
│  2. Find entity in graph                        │
│  3. Retrieve connected entities + relations     │
│  4. Return specific facts                       │
│                                                 │
│  Result: Alice → founder                        │
│          Bob → CTO                              │
└─────────────────────────────────────────────────┘
                    +
┌─────────────────────────────────────────────────┐
│             High-Level Retrieval                │
├─────────────────────────────────────────────────┤
│  1. Embed query                                 │
│  2. Search global summaries/chunks             │
│  3. Return relevant context passages           │
│                                                 │
│  Result: "TechCorp has a flat organizational   │
│           structure with founder oversight..." │
└─────────────────────────────────────────────────┘
                    ↓
         Merged Results (RRF/weighted)
```

### 4. HippoRAG's PPR vs LightRAG's Vectors

**HippoRAG PPR Retrieval:**
```python
# Graph walk from seeds
Query: "Companies related to Alice"

1. Identify seed: Alice (entity node)
2. Initialize PPR: Alice = 1.0, others = 0.0
3. Iterate:
   - Alice walks to TechCorp (founded edge)
   - TechCorp walks to Bob (employs edge)
   - Bob walks to StartupX (founded edge)
4. Return top-k by converged scores

# Discovers multi-hop associations
# No embedding comparison needed for graph walk
```

**LightRAG Low-Level Retrieval:**
```python
# Vector similarity on entities
Query: "Companies related to Alice"

1. Embed query: embed("Companies related to Alice")
2. Search entity embeddings: similar_entities(query_embed)
3. For each hit, retrieve connected entities
4. Combine with edge information

# Direct similarity matching
# Requires pre-computed embeddings
```

## Decision Framework

### Choose HippoRAG When:

1. **Pure multi-hop reasoning**
   ```
   Query: "Who funded the company that hired the person Alice mentored?"

   HippoRAG: PPR naturally follows chain
   Alice → mentored → Person → hired by → Company → funded by → Funder

   LightRAG: Requires multiple entity lookups
   ```

2. **Associative discovery**
   ```
   Query: "What's connected to quantum computing?"

   HippoRAG: PPR spreads through graph, finds unexpected connections
   LightRAG: Returns similar entities, may miss structural connections
   ```

3. **Memory-like semantics**
   ```
   HippoRAG models memory: access patterns, consolidation, decay
   LightRAG is retrieval-focused: find relevant information
   ```

4. **Biological interpretability**
   ```
   HippoRAG: Can explain retrieval as "memory recall"
   LightRAG: Traditional retrieval explanation
   ```

### Choose LightRAG When:

1. **Need both specific and global**
   ```
   Query: "What is Project X and how does it fit our strategy?"

   LightRAG: Low-level (Project X facts) + High-level (strategic context)
   HippoRAG: Would need two separate queries
   ```

2. **Query type is unpredictable**
   ```
   LightRAG: Dual-level handles both entity and thematic queries
   HippoRAG: Optimized for entity-centric associative queries
   ```

3. **Simpler deployment**
   ```
   LightRAG: Pure Python, minimal dependencies
   HippoRAG: Requires graph database (Neo4j/FalkorDB/Kuzu)
   ```

4. **Incremental indexing priority**
   ```
   LightRAG: Designed for incremental updates
   HippoRAG: Also supports incremental, but consolidation adds complexity
   ```

## Quantitative Comparison

### Indexing Characteristics

| Metric | HippoRAG | LightRAG |
|--------|----------|----------|
| **Extraction method** | OpenIE | Entity + Relation extraction |
| **LLM calls/doc** | 1 | 1-2 |
| **Graph density** | Higher (more edges) | Lower (normalized) |
| **Storage** | Graph DB required | Graph + Vector store |
| **Incremental cost** | O(1) per document | O(1) per document |

### Retrieval Characteristics

| Metric | HippoRAG | LightRAG |
|--------|----------|----------|
| **Multi-hop** | Native (PPR) | Via entity expansion |
| **Global context** | Requires consolidation | Built-in (high-level) |
| **Latency** | 50-200ms | 100-300ms |
| **LLM calls/query** | 0-1 (for entity extraction) | 0-1 |

### Benchmark Comparison

| Dataset | HippoRAG | LightRAG | Notes |
|---------|----------|----------|-------|
| **Multi-hop QA** | Better | Good | PPR advantage |
| **Global synthesis** | Limited | Better | Dual-level advantage |
| **Incremental scenarios** | Good | Good | Both handle well |
| **Memory footprint** | Lower | Higher | Dual indexes |

## Implementation Comparison

### HippoRAG Setup

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend="kuzu",
    llm_model="gpt-4o-mini",
    embedding_model="text-embedding-3-small",
    damping_factor=0.85,
    consolidation_enabled=True
)

# Index
await hippo.add_episode("Alice founded TechCorp in 2020...")

# Query
results = await hippo.search("Who founded TechCorp?")
for edge in results.edges:
    print(f"{edge.subject} --[{edge.predicate}]--> {edge.object}")
```

### LightRAG Setup

```python
from lightrag import LightRAG, QueryParam

rag = LightRAG(
    working_dir="./lightrag_data",
    llm_model_func=openai_model,
    embedding_func=openai_embedding
)

# Index
await rag.ainsert("Alice founded TechCorp in 2020...")

# Query (can specify mode)
result = await rag.aquery(
    "Who founded TechCorp?",
    param=QueryParam(mode="hybrid")  # or "local", "global"
)
print(result)
```

## Feature-by-Feature Comparison

### Entity Handling

```
HippoRAG:
- Schema-less: entities are strings
- Types inferred or extracted during OpenIE
- Embeddings stored per entity node
- Deduplication via string matching + embeddings

LightRAG:
- Typed entities with normalization
- Explicit entity resolution
- Entity descriptions stored
- Deduplication via embedding similarity
```

### Relation Handling

```
HippoRAG:
- Relations preserved as-is from OpenIE
- Rich predicate vocabulary
- Edge weights for PPR
- No relation normalization by default

LightRAG:
- Relations normalized to standard types
- Smaller relation vocabulary
- Edge metadata (source, etc.)
- Relation descriptions generated
```

### Query Processing

```
HippoRAG:
1. Extract query entities (LLM or NER)
2. Match to graph nodes (embedding similarity)
3. Run PPR from seed nodes
4. Return ranked edges/nodes

LightRAG:
1. Determine query type (local/global/hybrid)
2. For local: entity extraction + graph traversal
3. For global: chunk/summary retrieval
4. Merge results based on mode
```

## Hybrid Architecture

Combine strengths of both:

```python
class HippoLightRAG:
    """
    HippoRAG for multi-hop + LightRAG for global context.
    """

    def __init__(self):
        self.hippo = HippoRAG(backend="kuzu")
        self.light = LightRAG(working_dir="./lightrag")

    async def index(self, document: str):
        # Index in both systems
        await self.hippo.add_episode(document)
        await self.light.ainsert(document)

    async def query(self, query: str, mode: str = "auto"):
        if mode == "auto":
            query_type = classify_query(query)
        else:
            query_type = mode

        if query_type == "multi_hop":
            # Use HippoRAG's PPR
            return await self.hippo.search(query)

        elif query_type == "global":
            # Use LightRAG's high-level
            return await self.light.aquery(
                query,
                param=QueryParam(mode="global")
            )

        else:  # hybrid
            # Combine both
            hippo_results = await self.hippo.search(query)
            light_results = await self.light.aquery(
                query,
                param=QueryParam(mode="hybrid")
            )
            return merge_results(hippo_results, light_results)
```

## Migration Between Systems

### LightRAG to HippoRAG

```python
async def migrate_lightrag_to_hippo(lightrag_dir, hippo):
    """Convert LightRAG graph to HippoRAG."""

    # Load LightRAG graph
    entities = load_entities(f"{lightrag_dir}/entities.json")
    relations = load_relations(f"{lightrag_dir}/relations.json")

    # Convert relations to episodes
    for rel in relations:
        content = f"{rel['source']} {rel['relation']} {rel['target']}"
        await hippo.add_episode(
            content,
            source="lightrag_migration"
        )
```

### HippoRAG to LightRAG

```python
async def migrate_hippo_to_lightrag(hippo, lightrag):
    """Convert HippoRAG triples to LightRAG documents."""

    edges = await hippo.get_all_edges()

    # Group edges by source document
    docs = group_by_source(edges)

    for source, source_edges in docs.items():
        # Reconstruct document-like content
        content = "\n".join(
            f"{e.subject} {e.predicate} {e.object}."
            for e in source_edges
        )
        await lightrag.ainsert(content)
```

## Summary Decision Matrix

| Factor | HippoRAG | LightRAG | Winner |
|--------|----------|----------|--------|
| **Multi-hop reasoning** | Excellent | Good | HippoRAG |
| **Dual-level retrieval** | No | Yes | LightRAG |
| **Biological grounding** | Yes | No | HippoRAG |
| **Deployment simplicity** | Needs graph DB | Self-contained | LightRAG |
| **Memory semantics** | Yes (consolidation) | No | HippoRAG |
| **Query flexibility** | Entity-focused | Mode-based | LightRAG |
| **Global context** | Emergent | Explicit | LightRAG |
| **Graph density** | High | Moderate | Depends |

## When to Use Each

```
Use HippoRAG if:
✓ Multi-hop reasoning is primary use case
✓ You want memory-like behavior (consolidation, decay)
✓ Biological interpretability matters
✓ You already have a graph database
✓ Dense relationship graphs are acceptable

Use LightRAG if:
✓ Need both specific and global answers
✓ Query types are varied and unpredictable
✓ Want simpler deployment (no external graph DB)
✓ Prefer explicit control over retrieval modes
✓ High-level summaries are valuable

Use Both if:
✓ Different query types require different systems
✓ Can afford the complexity of dual indexing
✓ Want best-in-class for each query type
```

## Related Sub-Skills

- **comparison-graphrag**: GraphRAG's community-based approach
- **comparison-traditional**: When vectors alone suffice
- **core-retrieval**: HippoRAG's PPR mechanism in depth
- **integration-backends**: Graph database options for HippoRAG
