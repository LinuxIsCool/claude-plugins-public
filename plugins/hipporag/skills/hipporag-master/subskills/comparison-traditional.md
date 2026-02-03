---
name: comparison-traditional
description: Deep comparison between HippoRAG and traditional vector-only RAG. Covers when graphs add value, multi-hop limitations of vectors, cost-benefit analysis, and hybrid approaches.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Comparison: HippoRAG vs Traditional Vector RAG

Understanding when knowledge graphs add value over pure vector retrieval.

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                HippoRAG vs Traditional Vector RAG                           │
├───────────────────────────────────┬─────────────────────────────────────────┤
│            HippoRAG               │         Traditional Vector RAG          │
├───────────────────────────────────┼─────────────────────────────────────────┤
│                                   │                                         │
│  Documents                        │  Documents                              │
│      │                            │      │                                  │
│      ▼                            │      ▼                                  │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │ OpenIE  │                      │  │  Chunking   │                       │
│  │ Extract │                      │  │  (512-1024) │                       │
│  └────┬────┘                      │  └──────┬──────┘                       │
│       │                           │         │                               │
│       ▼                           │         ▼                               │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │Knowledge│                      │  │  Embedding  │                       │
│  │  Graph  │                      │  │   Vectors   │                       │
│  └────┬────┘                      │  └──────┬──────┘                       │
│       │                           │         │                               │
│       ▼                           │         ▼                               │
│  ┌─────────┐                      │  ┌─────────────┐                       │
│  │   PPR   │                      │  │   Vector    │                       │
│  │ + Graph │                      │  │  Similarity │                       │
│  └─────────┘                      │  │   (ANN)     │                       │
│                                   │  └─────────────┘                       │
│                                   │                                         │
│  Structure: Explicit relations    │  Structure: None (implicit in space)   │
│  Multi-hop: Native graph walk     │  Multi-hop: Requires iteration         │
│  Storage: Graph DB + vectors      │  Storage: Vector store only            │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

## The Multi-Hop Problem

### Why Traditional RAG Struggles

```
Query: "What companies did the founders of Apple's competitors start?"

Traditional RAG approach:
1. Embed query
2. Find similar chunks: "Apple competitors include Samsung, Google..."
3. But: Chunk doesn't mention founders or their other companies
4. Result: Incomplete or missing answer

The problem: Information is spread across multiple chunks
- Chunk A: "Samsung competes with Apple"
- Chunk B: "Lee Byung-chul founded Samsung"
- Chunk C: "Lee also founded other companies including..."

Vector similarity doesn't connect these chunks!
```

### How HippoRAG Solves It

```
HippoRAG approach:
1. Extract entities: [Apple, competitors, founders, companies]
2. Find seeds in graph: Apple
3. PPR walk discovers:
   Apple → (competes_with) → Samsung
   Samsung → (founded_by) → Lee Byung-chul
   Lee Byung-chul → (founded) → Samsung Life Insurance
   Lee Byung-chul → (founded) → Samsung C&T

The graph explicitly connects entities across document boundaries!
```

## Decision Framework

### Use Traditional Vector RAG When:

1. **Single-hop queries dominate**
   ```
   "What is machine learning?"
   "Summarize the Q3 earnings report"
   "What are the side effects of aspirin?"

   → Direct semantic similarity suffices
   → No relationship reasoning needed
   ```

2. **Document boundaries matter**
   ```
   Legal contracts: Each document is self-contained
   Research papers: Citation is the only cross-doc link
   FAQ systems: Question-answer pairs

   → Cross-document reasoning isn't needed
   ```

3. **Speed is paramount**
   ```
   Vector search: O(log n) with HNSW
   Graph PPR: O(edges * iterations)

   → For sub-10ms requirements, vectors win
   ```

4. **Budget is constrained**
   ```
   Vector RAG: Embedding cost only (~$0.0001/1K tokens)
   HippoRAG: Embedding + LLM extraction (~$0.01/document)

   → 100x cost difference for indexing
   ```

5. **Schema is unknown or highly variable**
   ```
   User-generated content with no structure
   Highly diverse document types

   → OpenIE may produce inconsistent graphs
   ```

### Use HippoRAG When:

1. **Multi-hop reasoning is required**
   ```
   "Who advised the CEO of the company that acquired our competitor?"
   "What skills do successful candidates have based on their past roles?"

   → Relationship chains need explicit traversal
   ```

2. **Associative recall matters**
   ```
   "What else is connected to this concept?"
   "Find related but not obviously similar information"

   → Graph structure captures indirect relationships
   ```

3. **Facts must be traceable**
   ```
   Each (subject, predicate, object) has a source
   Provenance is critical for trust

   → Triples are auditable, chunks are not
   ```

4. **Knowledge evolves over time**
   ```
   HippoRAG consolidation handles:
   - Fact updates (new CEO replaces old)
   - Contradictions (conflicting information)
   - Decay (outdated information fades)

   → Memory semantics vs. static index
   ```

5. **Entity-centric queries**
   ```
   "Tell me everything about Alice"
   "What do we know about Project X?"

   → Graph naturally organizes around entities
   ```

## Quantitative Comparison

### Indexing Costs

| Metric | HippoRAG | Vector RAG |
|--------|----------|------------|
| **Embedding calls** | Yes | Yes |
| **LLM calls** | Yes (extraction) | No |
| **Cost per 1K docs** | ~$5-50 | ~$0.10-0.50 |
| **Time per 1K docs** | 10-30 min | 1-5 min |
| **Storage** | 2-5x larger | Baseline |

### Retrieval Performance

| Metric | HippoRAG | Vector RAG |
|--------|----------|------------|
| **Single-hop accuracy** | ~Same | ~Same |
| **Multi-hop accuracy** | +15-30% | Baseline |
| **Latency (simple)** | 100-200ms | 10-50ms |
| **Latency (multi-hop)** | 150-300ms | 500ms+ (iterative) |

### Benchmark Results

| Benchmark | HippoRAG | Vector RAG | Delta |
|-----------|----------|------------|-------|
| **NQ (single-hop)** | 68.2% | 65.8% | +2.4% |
| **MuSiQue (multi-hop)** | 62.3% | 45.8% | +16.5% |
| **HotpotQA (2-hop)** | 68.5% | 55.3% | +13.2% |
| **2WikiMultihop** | 71.2% | 52.1% | +19.1% |

*From HippoRAG paper benchmarks*

## Implementation Patterns

### Traditional Vector RAG

```python
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings

# Simple and fast
vectorstore = Chroma(embedding_function=OpenAIEmbeddings())

# Index
vectorstore.add_documents(documents)

# Query
results = vectorstore.similarity_search(query, k=5)
context = "\n".join([doc.page_content for doc in results])
```

### HippoRAG

```python
from hipporag import HippoRAG

# More setup, more capability
hippo = HippoRAG(
    backend="kuzu",
    llm_model="gpt-4o-mini",
    embedding_model="text-embedding-3-small"
)

# Index (includes extraction)
for doc in documents:
    await hippo.add_episode(doc.page_content, source=doc.metadata["source"])

# Query (graph-enhanced)
results = await hippo.search(query)
context = results.assemble_context()
```

### Iterative Vector RAG (Multi-hop Attempt)

```python
# Trying to do multi-hop with vectors
async def iterative_vector_rag(query, vectorstore, llm, max_hops=3):
    """
    Attempt multi-hop reasoning with vectors.
    Less effective than graph-based approaches.
    """
    context = []
    current_query = query

    for hop in range(max_hops):
        # Retrieve
        docs = vectorstore.similarity_search(current_query, k=3)
        context.extend(docs)

        # Check if we have enough
        answer = llm.check_answerable(query, context)
        if answer.is_complete:
            return answer

        # Generate follow-up query
        current_query = llm.generate_followup(query, context)

    return llm.best_effort_answer(query, context)

# Problems with this approach:
# 1. Each hop adds latency (LLM call)
# 2. Follow-up query generation may miss connections
# 3. No explicit relationship tracking
# 4. Context window fills up quickly
```

## Hybrid Approach

Best of both worlds:

```python
class HybridRAG:
    """
    Use vectors for speed, graph for depth.
    """

    def __init__(self):
        self.vector_store = Chroma(embedding_function=OpenAIEmbeddings())
        self.hippo = HippoRAG(backend="kuzu")

    async def index(self, document):
        # Index in both
        self.vector_store.add_documents([document])
        await self.hippo.add_episode(document.page_content)

    async def query(self, query, mode="auto"):
        if mode == "auto":
            # Classify query complexity
            if self._is_multi_hop(query):
                mode = "graph"
            elif self._is_entity_centric(query):
                mode = "graph"
            else:
                mode = "vector"

        if mode == "vector":
            # Fast path: pure vector search
            docs = self.vector_store.similarity_search(query, k=5)
            return [doc.page_content for doc in docs]

        elif mode == "graph":
            # Deep path: HippoRAG
            results = await self.hippo.search(query)
            return results.passages

        else:  # hybrid
            # Both: merge results
            vector_docs = self.vector_store.similarity_search(query, k=3)
            graph_results = await self.hippo.search(query, top_k=10)
            return self._merge(vector_docs, graph_results)

    def _is_multi_hop(self, query):
        """Detect multi-hop patterns."""
        patterns = [
            r"who .* the .* of .* that",
            r"what .* did .* after .* before",
            r"companies? .* founded by .* who also",
            r"connected to",
            r"related to .* through"
        ]
        return any(re.search(p, query.lower()) for p in patterns)
```

## When Vectors Are Enough

### Scenario 1: FAQ / Support

```
Documents: FAQ pairs, support articles
Queries: "How do I reset my password?"

Vector RAG is sufficient because:
- Each document is self-contained
- Semantic similarity directly maps query to answer
- No cross-document reasoning needed
```

### Scenario 2: Document Search

```
Documents: Research papers, reports
Queries: "Papers about transformer architectures"

Vector RAG is sufficient because:
- Looking for similar content, not relationships
- Each paper stands alone
- Citation relationships aren't queried
```

### Scenario 3: Semantic Similarity

```
Documents: Product descriptions
Queries: "Show me similar products to X"

Vector RAG is ideal because:
- Similarity is the goal, not reasoning
- No relational structure to exploit
- Fast response required
```

## When You Need Graphs

### Scenario 1: Enterprise Knowledge

```
Documents: Internal wikis, org charts, project docs
Queries: "Who should I talk to about the API that Bob's team deprecated?"

HippoRAG needed because:
- Information spans multiple documents
- Org relationships must be traversed
- Bob → team → owns → API → deprecated → replacement owner
```

### Scenario 2: Research Synthesis

```
Documents: Scientific papers
Queries: "What methods improve on the technique introduced by Smith et al.?"

HippoRAG needed because:
- Citation chains matter
- Building on → improves → uses technique
- Cross-paper relationships are primary
```

### Scenario 3: Investigation

```
Documents: Financial records, communications
Queries: "What entities are connected to the suspicious transaction?"

HippoRAG needed because:
- Following money trails
- Entity relationships are evidence
- Multi-hop is the query type
```

## Cost-Benefit Analysis

```
                    Vector RAG                  HippoRAG
                    ──────────                  ────────
Indexing Cost       Low ($0.10/1K docs)        Medium ($5-50/1K docs)
Query Cost          Very Low                   Low (no extra LLM calls)
Storage Cost        Low                        Medium (graph + vectors)
Maintenance         None                       Consolidation overhead

Single-hop          ★★★★★                      ★★★★☆
Multi-hop           ★★☆☆☆                      ★★★★★
Speed               ★★★★★                      ★★★☆☆
Simplicity          ★★★★★                      ★★★☆☆
```

### Decision Matrix

| If you need... | Vector RAG | HippoRAG | Notes |
|----------------|------------|----------|-------|
| Quick prototype | ✓ | | Faster to implement |
| Multi-hop queries | | ✓ | Core strength |
| Lowest latency | ✓ | | No graph traversal |
| Relationship tracking | | ✓ | Explicit edges |
| Memory semantics | | ✓ | Consolidation |
| Minimal infrastructure | ✓ | | No graph DB |
| Entity-centric queries | | ✓ | Graph natural fit |
| Semantic similarity | ✓ | | Native operation |

## Migration Path

### Vector RAG to HippoRAG

```python
async def migrate_vector_to_hippo(vector_store, hippo):
    """
    Re-index vector store documents into HippoRAG.
    """
    # Export documents from vector store
    # (Implementation depends on vector store type)
    documents = export_from_vector_store(vector_store)

    for doc in documents:
        await hippo.add_episode(
            doc.page_content,
            source=doc.metadata.get("source", "vector_migration"),
            metadata=doc.metadata
        )

    # Build indices for optimal retrieval
    await hippo.build_indices_and_constraints()
```

### Keep Both (Recommended)

```python
# Best practice: maintain both for different query types
class ProductionRAG:
    def __init__(self):
        # Fast path for simple queries
        self.vector = VectorStore()

        # Deep path for complex queries
        self.hippo = HippoRAG(backend="neo4j")

    async def route_query(self, query):
        complexity = await self.analyze_complexity(query)

        if complexity < 0.3:
            return "vector"
        elif complexity > 0.7:
            return "graph"
        else:
            return "hybrid"
```

## Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    Quick Decision Guide                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   START                                                         │
│     │                                                           │
│     ▼                                                           │
│   Do queries require multi-hop reasoning?                       │
│     │                                                           │
│   YES ─────────────────────────────► Use HippoRAG              │
│     │                                                           │
│   NO                                                            │
│     │                                                           │
│     ▼                                                           │
│   Is entity-centric retrieval important?                        │
│     │                                                           │
│   YES ─────────────────────────────► Consider HippoRAG          │
│     │                                                           │
│   NO                                                            │
│     │                                                           │
│     ▼                                                           │
│   Is cost/simplicity the priority?                              │
│     │                                                           │
│   YES ─────────────────────────────► Use Vector RAG            │
│     │                                                           │
│   NO ──────────────────────────────► Consider Hybrid            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Related Sub-Skills

- **comparison-graphrag**: When to use GraphRAG's community approach
- **comparison-lightrag**: LightRAG's dual-level retrieval
- **core-retrieval**: HippoRAG's PPR mechanism in depth
- **core-indexing**: How HippoRAG builds knowledge graphs
- **recipes-use-cases**: Real-world application patterns
