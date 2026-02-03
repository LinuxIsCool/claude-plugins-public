# Personalized PageRank Tuning

## Purpose

Master the tuning of Personalized PageRank (PPR) parameters in HippoRAG to optimize retrieval for different document collections and query types. This cookbook covers damping factor selection, node weighting strategies, and performance optimization techniques.

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAMPING` | `0.5` | PPR damping factor (probability of following edges) |
| `PASSAGE_NODE_WEIGHT` | `0.05` | Multiplicative weight for passage nodes in PPR |
| `LINKING_TOP_K` | `5` | Number of top facts used as seed nodes |
| `RETRIEVAL_TOP_K` | `200` | Total documents to retrieve |

## Instructions

### Understanding Personalized PageRank in HippoRAG

HippoRAG uses PPR to rank document relevance by simulating a random walk on the knowledge graph:

```
                    ┌─────────────────────────────────────────┐
                    │        Personalized PageRank Flow       │
                    └─────────────────────────────────────────┘

Query: "Where was Einstein born?"
                    │
                    ▼
        ┌───────────────────┐
        │  Extract Entities │ → "Einstein", "born"
        └───────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │   Match Facts     │ → ("Einstein", "born in", "Ulm")
        └───────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │  Seed Nodes       │ → Entity: "Einstein", Entity: "Ulm"
        │  (reset_prob)     │    with weights from fact scores
        └───────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │  PPR Random Walk  │ → Follow edges with probability (1 - damping)
        │                   │ → Teleport to seeds with probability (damping)
        └───────────────────┘
                    │
                    ▼
        ┌───────────────────┐
        │  Passage Scores   │ → Rank passages by PPR probability
        └───────────────────┘
```

### The Damping Factor

The damping factor `d` controls the balance between:
- **Following edges** (probability `1 - d`): Explore the graph via relationships
- **Teleporting to seeds** (probability `d`): Return to query-relevant starting points

```python
# High damping (0.85): Strong preference for seed nodes
# - Better for single-hop queries
# - Retrieved docs are more directly related to query entities
# - Less exploration of multi-hop connections

# Low damping (0.3): More graph exploration
# - Better for multi-hop reasoning
# - Retrieves docs connected through longer paths
# - May include less directly relevant docs
```

## Code Examples

### Example 1: Basic Damping Tuning

```python
from hipporag import HippoRAG
from hipporag.utils.config_utils import BaseConfig

# Test different damping values
damping_values = [0.3, 0.5, 0.7, 0.85]

results_by_damping = {}
for damping in damping_values:
    config = BaseConfig(
        llm_name='gpt-4o-mini',
        embedding_model_name='text-embedding-3-small',
        damping=damping
    )

    hipporag = HippoRAG(
        global_config=config,
        save_dir=f'outputs/damping_{damping}'
    )

    # Index documents
    hipporag.index(docs=documents)

    # Evaluate retrieval
    results, metrics = hipporag.retrieve(
        queries=test_queries,
        gold_docs=gold_documents
    )

    results_by_damping[damping] = {
        'recall@5': metrics.get('recall@5', 0),
        'recall@10': metrics.get('recall@10', 0),
        'recall@20': metrics.get('recall@20', 0)
    }

# Compare results
import pandas as pd
df = pd.DataFrame(results_by_damping).T
print(df)
```

### Example 2: Understanding Passage Node Weight

```python
from hipporag.utils.config_utils import BaseConfig

# Passage node weight affects how much direct passage similarity
# contributes vs. graph-based (entity) similarity

# Higher weight: More emphasis on dense passage retrieval
config_high_passage = BaseConfig(
    passage_node_weight=0.2,  # 4x default
    damping=0.5
)

# Lower weight: More emphasis on graph traversal
config_low_passage = BaseConfig(
    passage_node_weight=0.01,  # 5x lower than default
    damping=0.5
)

# The combined node weights for PPR are:
# node_weights = phrase_weights + (passage_weights * passage_node_weight)
```

### Example 3: Analyzing PPR Node Weights

```python
import numpy as np

def analyze_ppr_weights(hipporag, query: str):
    """
    Analyze how weights are distributed in PPR for a given query.
    """
    # Prepare retrieval objects
    hipporag.prepare_retrieval_objects()
    hipporag.get_query_embeddings([query])

    # Get fact scores
    query_fact_scores = hipporag.get_fact_scores(query)

    # Get top facts after reranking
    top_k_fact_indices, top_k_facts, rerank_log = hipporag.rerank_facts(
        query, query_fact_scores
    )

    print(f"Query: {query}")
    print(f"\nTop facts selected as seeds:")
    for i, fact in enumerate(top_k_facts):
        score = query_fact_scores[top_k_fact_indices[i]]
        print(f"  {i+1}. [{score:.4f}] {fact}")

    # Simulate weight computation (from graph_search_with_fact_entities)
    phrase_weights = np.zeros(len(hipporag.graph.vs['name']))
    passage_weights = np.zeros(len(hipporag.graph.vs['name']))

    # Count entity occurrences
    entity_counts = {}
    for fact in top_k_facts:
        for entity in [fact[0].lower(), fact[2].lower()]:
            entity_counts[entity] = entity_counts.get(entity, 0) + 1

    print(f"\nSeed entity weights:")
    for entity, count in sorted(entity_counts.items(), key=lambda x: -x[1]):
        print(f"  {entity}: appears in {count} facts")

    return top_k_facts, query_fact_scores

# Usage
analyze_ppr_weights(hipporag, "Who directed Titanic?")
```

### Example 4: Custom PPR Implementation

```python
import numpy as np

def custom_ppr(hipporag, seed_weights: np.ndarray, damping: float = 0.5,
               max_iter: int = 100, tol: float = 1e-6) -> np.ndarray:
    """
    Custom PPR implementation for experimentation.
    (HippoRAG uses igraph's built-in PPR which is faster)
    """
    graph = hipporag.graph
    n = graph.vcount()

    # Normalize seed weights to probability distribution
    reset_prob = seed_weights / seed_weights.sum() if seed_weights.sum() > 0 else np.ones(n) / n

    # Initialize scores
    scores = reset_prob.copy()

    # Get adjacency matrix with weights
    adj_matrix = np.zeros((n, n))
    for e in graph.es:
        adj_matrix[e.source, e.target] = e['weight']
        adj_matrix[e.target, e.source] = e['weight']  # Undirected

    # Normalize columns (stochastic matrix)
    col_sums = adj_matrix.sum(axis=0)
    col_sums[col_sums == 0] = 1  # Avoid division by zero
    transition_matrix = adj_matrix / col_sums

    # Power iteration
    for iteration in range(max_iter):
        new_scores = (1 - damping) * transition_matrix @ scores + damping * reset_prob
        diff = np.abs(new_scores - scores).sum()
        scores = new_scores

        if diff < tol:
            print(f"Converged after {iteration + 1} iterations")
            break

    return scores

# Usage
hipporag.prepare_retrieval_objects()
seed_weights = np.zeros(hipporag.graph.vcount())
# ... set seed weights based on query ...
scores = custom_ppr(hipporag, seed_weights, damping=0.5)
```

### Example 5: Damping Factor Sweep with Visualization

```python
import matplotlib.pyplot as plt
import numpy as np

def damping_sweep(hipporag, queries, gold_docs, damping_range):
    """
    Sweep damping values and plot recall curves.
    """
    results = {d: {} for d in damping_range}

    for damping in damping_range:
        hipporag.global_config.damping = damping

        # Re-run retrieval with new damping
        retrieval_results, metrics = hipporag.retrieve(
            queries=queries,
            gold_docs=gold_docs
        )

        for k in [1, 5, 10, 20, 50]:
            results[damping][f'recall@{k}'] = metrics.get(f'recall@{k}', 0)

    return results

# Plot results
def plot_damping_sweep(results):
    dampings = list(results.keys())
    k_values = [1, 5, 10, 20, 50]

    plt.figure(figsize=(10, 6))
    for k in k_values:
        recalls = [results[d][f'recall@{k}'] for d in dampings]
        plt.plot(dampings, recalls, marker='o', label=f'Recall@{k}')

    plt.xlabel('Damping Factor')
    plt.ylabel('Recall')
    plt.title('Effect of Damping Factor on Retrieval Recall')
    plt.legend()
    plt.grid(True)
    plt.savefig('damping_sweep.png')
    plt.show()

# Usage
damping_range = np.arange(0.1, 1.0, 0.1)
results = damping_sweep(hipporag, test_queries, gold_docs, damping_range)
plot_damping_sweep(results)
```

### Example 6: Linking Top-K Tuning

```python
from hipporag.utils.config_utils import BaseConfig

# linking_top_k controls how many facts contribute to PPR seeds

# Higher linking_top_k: More seed entities, broader search
# - May include less relevant facts
# - Better for complex multi-entity queries

# Lower linking_top_k: Fewer, more focused seeds
# - Higher precision on seed selection
# - Better for simple, specific queries

configs = {
    'narrow': BaseConfig(linking_top_k=3, damping=0.5),
    'default': BaseConfig(linking_top_k=5, damping=0.5),
    'broad': BaseConfig(linking_top_k=10, damping=0.5),
    'very_broad': BaseConfig(linking_top_k=20, damping=0.5)
}

# Evaluate each configuration
for name, config in configs.items():
    hipporag = HippoRAG(global_config=config, save_dir=f'outputs/{name}')
    hipporag.index(docs=documents)
    results, metrics = hipporag.retrieve(queries=test_queries, gold_docs=gold_docs)
    print(f"{name}: Recall@10 = {metrics.get('recall@10', 0):.4f}")
```

## Common Patterns

### Pattern 1: Query-Adaptive Damping

```python
def get_adaptive_damping(query: str, hipporag) -> float:
    """
    Dynamically select damping based on query characteristics.
    """
    # Count query entities
    hipporag.prepare_retrieval_objects()
    hipporag.get_query_embeddings([query])
    fact_scores = hipporag.get_fact_scores(query)

    # High-scoring facts indicate good entity matches
    top_score = fact_scores.max() if len(fact_scores) > 0 else 0

    # Simple heuristic:
    # - High confidence matches → higher damping (trust seeds)
    # - Low confidence → lower damping (explore more)

    if top_score > 0.8:
        return 0.7  # High confidence - trust seeds
    elif top_score > 0.5:
        return 0.5  # Medium - balanced
    else:
        return 0.3  # Low confidence - explore more

# Usage
query = "What is the capital of France?"
damping = get_adaptive_damping(query, hipporag)
hipporag.global_config.damping = damping
results = hipporag.retrieve(queries=[query])
```

### Pattern 2: Combining Multiple PPR Runs

```python
def ensemble_ppr(hipporag, query: str, damping_values: list) -> list:
    """
    Run PPR with multiple damping values and combine results.
    """
    all_doc_scores = {}

    for damping in damping_values:
        hipporag.global_config.damping = damping
        results = hipporag.retrieve(queries=[query], num_to_retrieve=50)

        for doc, score in zip(results[0].docs, results[0].doc_scores):
            if doc not in all_doc_scores:
                all_doc_scores[doc] = []
            all_doc_scores[doc].append(score)

    # Aggregate scores (e.g., mean)
    aggregated = {doc: np.mean(scores) for doc, scores in all_doc_scores.items()}

    # Sort by aggregated score
    sorted_docs = sorted(aggregated.items(), key=lambda x: -x[1])
    return sorted_docs

# Usage
ensemble_results = ensemble_ppr(hipporag, "Who is Einstein?", [0.3, 0.5, 0.7])
```

### Pattern 3: Dataset-Specific Tuning

```python
# Recommended damping values by dataset type

DATASET_CONFIGS = {
    # HotpotQA: Mix of single and multi-hop
    'hotpotqa': {
        'damping': 0.5,
        'linking_top_k': 5,
        'passage_node_weight': 0.05
    },

    # MuSiQue: Multi-hop compositional questions
    'musique': {
        'damping': 0.4,  # More exploration for multi-hop
        'linking_top_k': 7,
        'passage_node_weight': 0.03
    },

    # 2WikiMultiHopQA: Complex multi-document reasoning
    '2wikimultihopqa': {
        'damping': 0.35,  # Maximum exploration
        'linking_top_k': 10,
        'passage_node_weight': 0.02
    },

    # Simple QA (single-hop)
    'simple_qa': {
        'damping': 0.7,  # Trust direct matches
        'linking_top_k': 3,
        'passage_node_weight': 0.1
    }
}

def get_dataset_config(dataset: str) -> BaseConfig:
    params = DATASET_CONFIGS.get(dataset, DATASET_CONFIGS['hotpotqa'])
    return BaseConfig(**params)
```

### Pattern 4: Performance Profiling

```python
import time

def profile_ppr_performance(hipporag, queries: list):
    """
    Profile PPR execution time breakdown.
    """
    hipporag.ppr_time = 0
    hipporag.rerank_time = 0
    hipporag.all_retrieval_time = 0

    start = time.time()
    results = hipporag.retrieve(queries=queries)
    total_time = time.time() - start

    print(f"\nPerformance Profile:")
    print(f"  Total retrieval time: {hipporag.all_retrieval_time:.2f}s")
    print(f"  PPR time: {hipporag.ppr_time:.2f}s ({hipporag.ppr_time/hipporag.all_retrieval_time*100:.1f}%)")
    print(f"  Rerank time: {hipporag.rerank_time:.2f}s ({hipporag.rerank_time/hipporag.all_retrieval_time*100:.1f}%)")
    print(f"  Other: {hipporag.all_retrieval_time - hipporag.ppr_time - hipporag.rerank_time:.2f}s")

    return results

# Usage
results = profile_ppr_performance(hipporag, test_queries)
```

### Pattern 5: Graph Density Impact

```python
def analyze_graph_impact_on_ppr(hipporag):
    """
    Analyze how graph density affects PPR behavior.
    """
    graph = hipporag.graph
    n_nodes = graph.vcount()
    n_edges = graph.ecount()

    # Graph density
    density = 2 * n_edges / (n_nodes * (n_nodes - 1)) if n_nodes > 1 else 0

    # Average degree
    degrees = graph.degree()
    avg_degree = sum(degrees) / len(degrees) if degrees else 0

    # Clustering coefficient
    clustering = graph.transitivity_undirected()

    print(f"Graph Statistics:")
    print(f"  Nodes: {n_nodes}")
    print(f"  Edges: {n_edges}")
    print(f"  Density: {density:.6f}")
    print(f"  Average degree: {avg_degree:.2f}")
    print(f"  Clustering coefficient: {clustering:.4f}")

    # Recommendations
    if density > 0.01:
        print("\nRecommendation: Dense graph - consider higher damping (0.6-0.8)")
    else:
        print("\nRecommendation: Sparse graph - lower damping (0.3-0.5) for better exploration")

    if avg_degree < 3:
        print("Warning: Low average degree may limit PPR effectiveness")
```

## Troubleshooting

### Common PPR Issues

1. **All documents have similar scores**: Damping too low or graph too dense
2. **Only directly connected docs retrieved**: Damping too high
3. **Slow PPR execution**: Graph too large; consider subgraph extraction
4. **Irrelevant docs ranked high**: Check seed node selection (fact scores)

### Debugging PPR

```python
def debug_ppr_run(hipporag, query: str):
    """
    Debug a single PPR execution.
    """
    hipporag.prepare_retrieval_objects()
    hipporag.get_query_embeddings([query])

    # Get fact scores
    fact_scores = hipporag.get_fact_scores(query)
    print(f"Fact score range: [{fact_scores.min():.4f}, {fact_scores.max():.4f}]")

    # Get selected facts
    _, top_facts, _ = hipporag.rerank_facts(query, fact_scores)
    print(f"Selected {len(top_facts)} facts as seeds")

    # Run retrieval
    results = hipporag.retrieve(queries=[query], num_to_retrieve=10)

    # Check score distribution
    scores = results[0].doc_scores
    print(f"\nRetrieved doc score range: [{min(scores):.4f}, {max(scores):.4f}]")
    print(f"Score std dev: {np.std(scores):.4f}")

    # If scores are too similar, PPR may not be discriminating well
    if np.std(scores) < 0.01:
        print("Warning: Low score variance - PPR may not be differentiating documents")

# Usage
debug_ppr_run(hipporag, "Who invented the telephone?")
```
