---
name: core-retrieval
description: Master HippoRAG retrieval with Personalized PageRank, multi-hop queries, and associative recall. Use when executing queries, tuning retrieval parameters, or understanding graph-based ranking.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Core: Retrieval (Pattern Completion)

Query execution using Personalized PageRank over knowledge graphs.

## Biological Analogy: Pattern Completion

In the hippocampus, the **CA3 region** performs pattern completion:
- Takes partial cues (incomplete memories)
- Activates connected neurons via recurrent connections
- Reconstructs complete memory from fragments

HippoRAG's retrieval mimics this:
- Takes partial cues (query entities)
- Activates connected nodes via graph edges
- Reconstructs relevant context from associations

```
Query Cue                    →    Pattern Completion
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Apple's founder"                 Steve Jobs (via FOUNDED)
                                  → Pixar (via COFOUNDED)
                                  → Apple Inc. (seed)
                                  → iPhone (via CREATED)
                                  → Cupertino (via LOCATED_IN)
```

## Territory Map

```
HippoRAG Retrieval Pipeline:

┌─────────────────┐
│      Query      │  Natural language question
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Entity Extract  │  Identify query entities
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Seed Selection │  Find matching graph nodes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PPR Walk       │  Personalized PageRank
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Ranking      │  Score and filter nodes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Assembly│  Gather text for LLM
└─────────────────┘
```

## Beginner Techniques

### Basic Query Execution

```python
from hipporag import HippoRAG

# Initialize HippoRAG
hippo = HippoRAG(
    backend="kuzu",
    connection="./hipporag_data/"
)

# Simple query
results = await hippo.search("Who founded Apple?")

# View results
for result in results.edges:
    print(f"Fact: {result.fact}")
    print(f"Score: {result.score:.3f}")
    print(f"Source: {result.source}")
    print()
```

### Understanding Results

```python
# Results contain multiple components
results = await hippo.search("Apple products and founder")

# Edges (relationships) - most useful for factual queries
print("Facts:")
for edge in results.edges[:5]:
    print(f"  {edge.subject} --[{edge.predicate}]--> {edge.object}")
    print(f"    Score: {edge.score:.3f}")

# Nodes (entities) - useful for entity-centric queries
print("\nEntities:")
for node in results.nodes[:5]:
    print(f"  {node.name} ({node.type})")
    print(f"    Score: {node.score:.3f}")

# Source passages - original text chunks
print("\nSource passages:")
for passage in results.passages[:3]:
    print(f"  {passage.text[:100]}...")
```

### Multi-hop Query Example

```python
# Multi-hop query - follows relationships
query = "What companies did Apple's founders also start?"

results = await hippo.search(query)

# The result includes multi-hop discoveries:
# Apple → (founded by) → Steve Jobs → (cofounded) → Pixar
# Apple → (founded by) → Steve Jobs → (cofounded) → NeXT
```

## Intermediate Techniques

### Configuring PPR Parameters

```python
from hipporag import HippoRAG, SearchConfig

# Create custom search configuration
config = SearchConfig(
    damping_factor=0.85,    # Higher = deeper walks (0.7-0.95)
    max_iterations=20,      # PPR convergence iterations
    top_k=20,               # Number of results to return
    min_score=0.01          # Minimum score threshold
)

results = await hippo.search(
    "Apple products",
    config=config
)
```

### Parameter Tuning Guide

| Parameter | Low Value | High Value | When to Adjust |
|-----------|-----------|------------|----------------|
| `damping_factor` | 0.70 | 0.95 | Lower for focused results, higher for exploration |
| `max_iterations` | 10 | 50 | Higher if results unstable |
| `top_k` | 5 | 50 | Balance context size vs. coverage |
| `min_score` | 0.001 | 0.1 | Filter noise (higher) vs. coverage (lower) |

### Query Entity Extraction

Control how query entities are identified:

```python
# Automatic entity extraction
results = await hippo.search("Who is the CEO of TechCorp?")
# Extracted entities: ["CEO", "TechCorp"]

# Manual entity specification (for precision)
results = await hippo.search(
    "leadership information",
    seed_entities=["TechCorp"]  # Start from known entity
)

# View what was extracted
print(f"Query entities: {results.query_entities}")
print(f"Seed nodes: {[n.name for n in results.seed_nodes]}")
```

### Filtering by Entity Type

```python
# Filter results to specific entity types
results = await hippo.search(
    "Apple",
    node_types=["Company", "Product"],  # Only these types
    edge_types=["FOUNDED", "CREATED"]    # Only these relations
)
```

### Temporal Filtering

```python
from datetime import datetime

# Filter by temporal validity
results = await hippo.search(
    "TechCorp executives",
    valid_at=datetime(2022, 1, 1)  # State as of Jan 2022
)

# For HippoRAG with temporal edges:
# Returns facts valid at the specified time
# Excludes facts that were invalidated before that date
```

## Advanced Techniques

### Understanding PPR Algorithm

```python
"""
Personalized PageRank (PPR) Algorithm:

1. INITIALIZATION
   - Set all node scores to 0
   - Set seed node scores to 1/|seeds|

2. ITERATION (repeat until convergence)
   For each node v:
     score[v] = (1 - d) * seed_score[v] +
                d * sum(score[u] / out_degree[u] for u in neighbors[v])

   Where:
   - d = damping factor (typically 0.85)
   - seed_score[v] = 1/|seeds| if v is seed node, else 0

3. TERMINATION
   - Stop when scores converge (change < epsilon)
   - Or after max_iterations

4. OUTPUT
   - Return top-k nodes by score
"""

# Simplified PPR implementation for understanding
def ppr_simple(graph, seeds, damping=0.85, iterations=20):
    n_nodes = len(graph.nodes)
    scores = {node: 0 for node in graph.nodes}

    # Initialize seeds
    for seed in seeds:
        scores[seed] = 1.0 / len(seeds)

    seed_scores = scores.copy()

    for _ in range(iterations):
        new_scores = {}
        for node in graph.nodes:
            # Teleport component (return to seeds)
            teleport = (1 - damping) * seed_scores.get(node, 0)

            # Walk component (from neighbors)
            walk = 0
            for neighbor in graph.neighbors(node):
                walk += scores[neighbor] / graph.out_degree(neighbor)
            walk *= damping

            new_scores[node] = teleport + walk

        scores = new_scores

    return sorted(scores.items(), key=lambda x: -x[1])
```

### Multi-hop Path Analysis

```python
# Get explicit paths discovered during retrieval
results = await hippo.search(
    "Companies connected to Steve Jobs",
    return_paths=True
)

# View multi-hop paths
for path in results.paths:
    print(f"Path (score: {path.score:.3f}):")
    for i, step in enumerate(path.steps):
        if i > 0:
            print(f"    --[{step.relation}]-->")
        print(f"  {step.entity}")

# Example output:
# Path (score: 0.342):
#   Steve Jobs
#     --[FOUNDED]-->
#   Apple Inc.
#     --[ACQUIRED]-->
#   NeXT
```

### Hybrid Search (PPR + Vector)

```python
# Combine PPR with vector similarity
config = SearchConfig(
    search_methods=["ppr", "vector"],
    fusion_method="rrf",       # Reciprocal Rank Fusion
    ppr_weight=0.6,            # Weight for PPR scores
    vector_weight=0.4          # Weight for vector scores
)

results = await hippo.search(
    "innovative technology companies",
    config=config
)
```

### Reranking with Cross-Encoder

```python
from hipporag.rerank import CrossEncoderReranker

# Add cross-encoder reranking for better precision
reranker = CrossEncoderReranker(
    model="BAAI/bge-reranker-v2-m3"
)

results = await hippo.search(
    "Apple's most successful product launch",
    reranker=reranker,
    top_k_before_rerank=50,  # Retrieve more, then rerank
    top_k=10                  # Final result count
)
```

### Custom Scoring Functions

```python
# Custom scoring that considers edge properties
def custom_scorer(edge, query_embedding):
    base_score = edge.ppr_score

    # Boost recent facts
    recency = (datetime.now() - edge.created_at).days
    recency_boost = 1.0 / (1 + recency / 365)

    # Boost high-confidence extractions
    confidence_boost = edge.confidence if edge.confidence else 0.5

    return base_score * recency_boost * confidence_boost

results = await hippo.search(
    "Latest developments at Apple",
    custom_scorer=custom_scorer
)
```

### Context Window Management

```python
# Control context assembly for LLM
results = await hippo.search(
    "Apple history and products",
    max_context_tokens=8000,    # Total token budget
    max_per_entity=500,         # Max tokens per entity
    include_sources=True,       # Include source passages
    deduplicate=True            # Remove redundant facts
)

# Get assembled context for LLM
context = results.assemble_context(
    format="markdown",          # or "json", "text"
    include_scores=False        # Hide scores in output
)

print(context)
# Output:
# ## Apple Inc.
# - Founded by Steve Jobs in 1976
# - Headquartered in Cupertino, California
# - Known for iPhone, Mac, iPad
#
# ## Steve Jobs
# - Cofounded Apple with Steve Wozniak
# - Also founded NeXT and Pixar
# ...
```

## PPR Deep Dive

### Why PPR Works for Retrieval

```
Traditional vector search:
  Query → Embedding → Nearest neighbors (by similarity)
  Problem: Only finds directly similar items

PPR-based search:
  Query → Seed entities → Graph walk → Associated entities
  Advantage: Finds related items through relationships

Example:
  Query: "Apple competitors"

  Vector search might return:
    - Documents mentioning "Apple" and "competitors"

  PPR search discovers:
    Apple → (competes_with) → Samsung
    Apple → (competes_with) → Google
    Samsung → (products) → Galaxy
    Google → (products) → Pixel

  Multi-hop reveals competitive landscape automatically
```

### Damping Factor Intuition

```
Damping factor (d) controls exploration vs. exploitation:

d = 0.5 (low):
  - Stays close to seed entities
  - Good for precise, focused queries
  - "What exactly is X?"

d = 0.85 (typical):
  - Balanced exploration
  - Good for most queries
  - "Tell me about X"

d = 0.95 (high):
  - Explores far from seeds
  - Good for discovery queries
  - "What's connected to X?"

Visual intuition:
  Low d:  Seed ● ◐ ○ ○ ○    (concentrated)
  High d: Seed ● ● ● ◐ ○    (spread out)
```

### PPR vs PageRank

```
Standard PageRank:
  - Starts from uniform distribution
  - Finds globally important nodes
  - "What's important in this graph?"

Personalized PageRank:
  - Starts from seed nodes
  - Finds nodes important relative to seeds
  - "What's important to my query?"

This personalization is why PPR works for retrieval:
  Different queries → Different seed nodes → Different results
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| No results | No matching seed entities | Check entity extraction, try manual seeds |
| Irrelevant results | Damping too high | Lower damping_factor (e.g., 0.7) |
| Missing obvious facts | Damping too low | Raise damping_factor (e.g., 0.9) |
| Slow queries | Large graph, high iterations | Reduce max_iterations, use min_score |
| Incomplete paths | Walk terminated early | Increase max_iterations |

## Performance Optimization

### Query Speed

```python
# Optimize for speed
config = SearchConfig(
    damping_factor=0.80,     # Converges faster
    max_iterations=10,       # Fewer iterations
    top_k=10,                # Fewer results
    use_cache=True           # Cache PPR results
)
```

### Result Quality

```python
# Optimize for quality
config = SearchConfig(
    damping_factor=0.90,     # More exploration
    max_iterations=30,       # Better convergence
    top_k=30,                # More candidates
    reranker=CrossEncoderReranker()  # Rerank for precision
)
```

## Reference

### Search Methods

| Method | Description | Best For |
|--------|-------------|----------|
| `ppr` | Personalized PageRank | Multi-hop, associative queries |
| `vector` | Embedding similarity | Semantic similarity |
| `bm25` | Keyword matching | Exact term matching |
| `hybrid` | Combined methods | General purpose |

### Result Components

| Component | Description | Use Case |
|-----------|-------------|----------|
| `edges` | Relationship facts | Factual answers |
| `nodes` | Entity information | Entity-centric queries |
| `passages` | Source text | Context for LLM |
| `paths` | Multi-hop chains | Explanation, reasoning |

## Related Sub-Skills

- **core-indexing**: Build the knowledge graph to query
- **core-consolidation**: Improve retrieval quality over time
- **comparison-traditional**: When to use PPR vs. vector search
- **recipes-use-cases**: Multi-hop QA implementation patterns
