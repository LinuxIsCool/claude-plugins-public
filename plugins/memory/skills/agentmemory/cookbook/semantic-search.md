# Semantic Search Cookbook

Advanced search patterns for finding relevant memories using vector similarity.

## Purpose

Provide comprehensive guidance on using agentmemory's semantic search capabilities. This cookbook covers similarity-based retrieval, distance thresholds, combined filtering, and advanced search patterns for building intelligent retrieval systems.

## Variables

```yaml
DEFAULT_N_RESULTS: 5
DEFAULT_MAX_DISTANCE: 1.0
DEFAULT_MIN_DISTANCE: 0.0
INCLUDE_EMBEDDINGS: true
INCLUDE_DISTANCES: true
SIMILARITY_TO_DISTANCE: "distance = 1.0 - similarity"
```

## Instructions

1. Understand the relationship between similarity and distance
2. Choose appropriate distance thresholds for your use case
3. Combine semantic search with metadata filtering
4. Implement result post-processing as needed

## Understanding Distance vs Similarity

Agentmemory uses **cosine distance** where:

- **Distance 0.0** = Identical vectors (100% similar)
- **Distance 1.0** = Orthogonal vectors (0% similar)
- **Similarity** = 1.0 - Distance

```python
# Converting between similarity and distance
similarity = 0.85  # 85% similar
max_distance = 1.0 - similarity  # 0.15

# In search
results = search_memory(
    category="documents",
    search_text="query",
    max_distance=0.15  # Only return results >= 85% similar
)
```

---

## Basic Semantic Search

### Simple Query

```python
from agentmemory import search_memory

# Search for semantically similar content
results = search_memory(
    category="knowledge",
    search_text="What is machine learning?",
    n_results=5
)

for result in results:
    similarity = 1.0 - result["distance"]
    print(f"[{similarity:.2%}] {result['document']}")
```

### Search with Limited Results

```python
from agentmemory import search_memory

# Get top 3 most relevant results
results = search_memory(
    category="faq",
    search_text="How do I reset my password?",
    n_results=3
)
```

### Search Without Embeddings (Faster)

```python
from agentmemory import search_memory

# Exclude embeddings from results for faster response
results = search_memory(
    category="documents",
    search_text="quarterly report",
    n_results=10,
    include_embeddings=False
)
```

---

## Distance Threshold Filtering

### Maximum Distance (Minimum Similarity)

```python
from agentmemory import search_memory

# Only return highly similar results (>= 80% similarity)
results = search_memory(
    category="knowledge",
    search_text="neural network architecture",
    n_results=10,
    max_distance=0.20  # 1.0 - 0.80 = 0.20
)

# Filter out low-quality matches
high_quality = [r for r in results if r["distance"] < 0.15]
```

### Minimum Distance (Exclude Too Similar)

```python
from agentmemory import search_memory

# Find related but distinct content (exclude near-duplicates)
results = search_memory(
    category="articles",
    search_text="introduction to python",
    n_results=20,
    min_distance=0.10,  # Exclude > 90% similar
    max_distance=0.40   # Include > 60% similar
)
```

### Similarity Bands

```python
from agentmemory import search_memory

def search_by_similarity_band(category, query, min_sim, max_sim, n=10):
    """Search within a similarity range."""
    results = search_memory(
        category=category,
        search_text=query,
        n_results=n,
        min_distance=1.0 - max_sim,
        max_distance=1.0 - min_sim
    )
    return results

# Find moderately related content (50-80% similar)
moderate_matches = search_by_similarity_band(
    "knowledge",
    "deep learning",
    min_sim=0.50,
    max_sim=0.80
)
```

---

## Combined Filtering

### Semantic Search with Metadata Filter

```python
from agentmemory import search_memory

# Search within a specific topic
results = search_memory(
    category="knowledge",
    search_text="optimization techniques",
    n_results=10,
    filter_metadata={"topic": "machine_learning"}
)
```

### Multiple Metadata Conditions

```python
from agentmemory import search_memory

# Search with multiple filter criteria (AND logic)
results = search_memory(
    category="documents",
    search_text="budget planning",
    n_results=5,
    filter_metadata={
        "department": "finance",
        "year": "2024"
    }
)
```

### Semantic Search with Text Contains

```python
from agentmemory import search_memory

# Combine semantic similarity with keyword matching
results = search_memory(
    category="code_snippets",
    search_text="sort an array efficiently",
    n_results=10,
    contains_text="def "  # Must contain function definition
)
```

### Full Combined Search

```python
from agentmemory import search_memory

# Maximum filtering power
results = search_memory(
    category="documentation",
    search_text="authentication flow",
    n_results=20,
    filter_metadata={"status": "published"},
    contains_text="OAuth",
    max_distance=0.30,
    include_embeddings=False
)
```

---

## Novel Memory Search

Novel memories are those marked as unique during creation with `create_unique_memory`.

### Search Only Novel Memories

```python
from agentmemory import search_memory

# Only search through unique/novel memories
results = search_memory(
    category="insights",
    search_text="customer behavior patterns",
    n_results=10,
    novel=True
)
```

### Compare Novel vs All

```python
from agentmemory import search_memory

def compare_novel_search(category, query, n=5):
    """Compare results from novel-only vs all memories."""
    all_results = search_memory(
        category=category,
        search_text=query,
        n_results=n,
        novel=False
    )

    novel_results = search_memory(
        category=category,
        search_text=query,
        n_results=n,
        novel=True
    )

    return {
        "all": all_results,
        "novel": novel_results,
        "novel_ratio": len(novel_results) / max(len(all_results), 1)
    }
```

---

## Advanced Search Patterns

### Multi-Query Expansion

```python
from agentmemory import search_memory

def multi_query_search(category, queries, n_per_query=5, dedupe=True):
    """Search with multiple query variations."""
    all_results = []
    seen_ids = set()

    for query in queries:
        results = search_memory(
            category=category,
            search_text=query,
            n_results=n_per_query
        )

        for result in results:
            if dedupe and result["id"] in seen_ids:
                continue
            seen_ids.add(result["id"])
            all_results.append(result)

    # Sort by distance
    all_results.sort(key=lambda x: x["distance"])
    return all_results

# Usage: search with query variations
queries = [
    "machine learning algorithms",
    "ML techniques and methods",
    "statistical learning models"
]
results = multi_query_search("knowledge", queries)
```

### Hierarchical Search

```python
from agentmemory import search_memory

def hierarchical_search(categories, query, n_per_category=3):
    """Search across multiple categories with priority."""
    results = {}

    for priority, category in enumerate(categories):
        category_results = search_memory(
            category=category,
            search_text=query,
            n_results=n_per_category
        )

        for result in category_results:
            result["source_category"] = category
            result["priority"] = priority

        results[category] = category_results

    return results

# Usage: search with category priority
results = hierarchical_search(
    categories=["critical_docs", "general_docs", "archive"],
    query="security policy"
)
```

### Relevance Scoring

```python
from agentmemory import search_memory

def search_with_relevance_score(category, query, n=10, weights=None):
    """Search with custom relevance scoring."""
    weights = weights or {
        "similarity": 0.6,
        "recency": 0.3,
        "novelty": 0.1
    }

    results = search_memory(
        category=category,
        search_text=query,
        n_results=n
    )

    import time
    now = time.time()

    for result in results:
        similarity_score = 1.0 - result["distance"]

        # Recency score (decay over 30 days)
        created_at = result["metadata"].get("created_at", now)
        days_old = (now - created_at) / 86400
        recency_score = max(0, 1.0 - (days_old / 30))

        # Novelty score
        is_novel = result["metadata"].get("novel") == "True"
        novelty_score = 1.0 if is_novel else 0.5

        # Combined score
        result["relevance_score"] = (
            weights["similarity"] * similarity_score +
            weights["recency"] * recency_score +
            weights["novelty"] * novelty_score
        )

    # Re-sort by relevance score
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results
```

### Contextual Re-ranking

```python
from agentmemory import search_memory

def contextual_rerank(category, query, context, n=10, boost_factor=1.5):
    """Re-rank results based on additional context."""
    # Primary search
    results = search_memory(
        category=category,
        search_text=query,
        n_results=n * 2  # Over-fetch for re-ranking
    )

    # Context search for boosting
    context_results = search_memory(
        category=category,
        search_text=context,
        n_results=n * 2
    )
    context_ids = {r["id"] for r in context_results[:n]}

    # Boost results that match context
    for result in results:
        if result["id"] in context_ids:
            result["distance"] = result["distance"] / boost_factor

    # Re-sort and trim
    results.sort(key=lambda x: x["distance"])
    return results[:n]

# Usage
results = contextual_rerank(
    category="support_tickets",
    query="billing issue",
    context="enterprise customer annual subscription"
)
```

---

## Threshold Calibration

### Find Optimal Threshold

```python
from agentmemory import search_memory, get_memories

def calibrate_threshold(category, sample_queries, relevance_labels):
    """
    Find optimal distance threshold.
    relevance_labels: dict mapping (query, doc_id) -> is_relevant (bool)
    """
    thresholds = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]
    results = {}

    for threshold in thresholds:
        true_positives = 0
        false_positives = 0
        false_negatives = 0

        for query in sample_queries:
            search_results = search_memory(
                category=category,
                search_text=query,
                n_results=100,
                max_distance=threshold
            )

            returned_ids = {r["id"] for r in search_results}

            for (q, doc_id), is_relevant in relevance_labels.items():
                if q != query:
                    continue

                if doc_id in returned_ids:
                    if is_relevant:
                        true_positives += 1
                    else:
                        false_positives += 1
                elif is_relevant:
                    false_negatives += 1

        precision = true_positives / max(true_positives + false_positives, 1)
        recall = true_positives / max(true_positives + false_negatives, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)

        results[threshold] = {
            "precision": precision,
            "recall": recall,
            "f1": f1
        }

    # Find best threshold by F1
    best_threshold = max(results, key=lambda t: results[t]["f1"])
    return best_threshold, results
```

### Distance Distribution Analysis

```python
from agentmemory import search_memory, get_memories

def analyze_distance_distribution(category, sample_queries, n=100):
    """Analyze distance distribution for threshold selection."""
    all_distances = []

    for query in sample_queries:
        results = search_memory(
            category=category,
            search_text=query,
            n_results=n
        )

        distances = [r["distance"] for r in results]
        all_distances.extend(distances)

    if not all_distances:
        return None

    import statistics

    return {
        "min": min(all_distances),
        "max": max(all_distances),
        "mean": statistics.mean(all_distances),
        "median": statistics.median(all_distances),
        "stdev": statistics.stdev(all_distances) if len(all_distances) > 1 else 0,
        "quartiles": {
            "q1": statistics.quantiles(all_distances, n=4)[0],
            "q2": statistics.quantiles(all_distances, n=4)[1],
            "q3": statistics.quantiles(all_distances, n=4)[2]
        }
    }
```

---

## Performance Optimization

### Batch Search

```python
from agentmemory import search_memory
from concurrent.futures import ThreadPoolExecutor

def batch_search(category, queries, n_results=5, max_workers=4):
    """Execute multiple searches in parallel."""
    def single_search(query):
        return {
            "query": query,
            "results": search_memory(
                category=category,
                search_text=query,
                n_results=n_results,
                include_embeddings=False  # Faster
            )
        }

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        return list(executor.map(single_search, queries))
```

### Cached Search

```python
from agentmemory import search_memory
from functools import lru_cache
import hashlib

# Note: Only cache if your memory store doesn't change frequently
@lru_cache(maxsize=100)
def cached_search(category, query, n_results=5, max_distance=None):
    """Cache search results for repeated queries."""
    return tuple(
        search_memory(
            category=category,
            search_text=query,
            n_results=n_results,
            max_distance=max_distance,
            include_embeddings=False
        )
    )

def search_with_cache(category, query, n_results=5, max_distance=None):
    """Search with caching support."""
    # Convert to hashable tuple for cache
    results = cached_search(category, query, n_results, max_distance)
    return list(results)
```

---

## Search Result Processing

### Format Results for Display

```python
from agentmemory import search_memory

def format_search_results(results, max_length=200):
    """Format results for display."""
    formatted = []

    for i, result in enumerate(results, 1):
        similarity = (1.0 - result["distance"]) * 100
        document = result["document"]

        if len(document) > max_length:
            document = document[:max_length] + "..."

        formatted.append({
            "rank": i,
            "similarity": f"{similarity:.1f}%",
            "preview": document,
            "id": result["id"],
            "metadata": result["metadata"]
        })

    return formatted

# Usage
results = search_memory("docs", "API authentication", n_results=5)
display = format_search_results(results)
```

### Extract Answer Context

```python
from agentmemory import search_memory

def get_answer_context(category, question, n_results=3, min_similarity=0.7):
    """Get context for answering a question."""
    results = search_memory(
        category=category,
        search_text=question,
        n_results=n_results,
        max_distance=1.0 - min_similarity
    )

    if not results:
        return None

    context_parts = []
    sources = []

    for result in results:
        context_parts.append(result["document"])
        sources.append({
            "id": result["id"],
            "similarity": 1.0 - result["distance"]
        })

    return {
        "context": "\n\n---\n\n".join(context_parts),
        "sources": sources,
        "top_similarity": 1.0 - results[0]["distance"]
    }
```

---

## Troubleshooting

### No Results Returned

```python
from agentmemory import search_memory, count_memories

def diagnose_empty_search(category, query):
    """Diagnose why search returns no results."""
    # Check if category has memories
    count = count_memories(category)
    if count == 0:
        return "Category is empty"

    # Try search without filters
    results = search_memory(
        category=category,
        search_text=query,
        n_results=10,
        max_distance=1.0  # No distance filter
    )

    if not results:
        return "No memories in category match any semantic criteria"

    # Check distances
    distances = [r["distance"] for r in results]
    return {
        "memory_count": count,
        "result_count": len(results),
        "min_distance": min(distances),
        "max_distance": max(distances),
        "suggestion": f"Try max_distance >= {min(distances):.2f}"
    }
```

### Unexpected Results

```python
from agentmemory import search_memory

def debug_search(category, query, n_results=10):
    """Debug search with detailed output."""
    results = search_memory(
        category=category,
        search_text=query,
        n_results=n_results,
        include_distances=True
    )

    print(f"Query: {query}")
    print(f"Category: {category}")
    print(f"Results: {len(results)}")
    print("-" * 50)

    for i, r in enumerate(results):
        sim = (1.0 - r["distance"]) * 100
        print(f"{i+1}. [{sim:.1f}%] {r['document'][:100]}...")
        print(f"   ID: {r['id']}")
        print(f"   Metadata: {r['metadata']}")
        print()

    return results
```
