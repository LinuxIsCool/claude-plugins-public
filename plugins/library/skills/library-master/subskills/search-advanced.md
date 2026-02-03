# Search Advanced

Advanced search capabilities using SQLite FTS5 with citation-aware re-ranking.

## Architecture

The search system uses a two-stage architecture:

1. **Stage 1 - Candidate Retrieval**: SQLite FTS5 with BM25 ranking retrieves top 100-200 candidates
2. **Stage 2 - Citation Re-ranking**: Citation graph signals re-rank candidates for final results

## Ranking Signals

The hybrid search combines multiple signals with configurable weights:

| Signal | Weight | Description |
|--------|--------|-------------|
| BM25 | 0.30 | Text relevance from FTS5 |
| PageRank | 0.25 | Citation importance (cited by important resources) |
| Velocity | 0.15 | Citation rate over time, acceleration |
| Co-citation | 0.10 | Cited alongside other top results |
| Recency | 0.10 | Last access time decay (1 year half-life) |
| Influence | 0.10 | Authority score + direct citation impact |

## Search Methods

### Basic FTS5 Search

```python
from plugins.library.src.lib import Library

lib = Library()

# Simple text search
results = lib.search("knowledge graphs")

# Filtered by type
results = lib.search("transformer architecture", resource_type=ResourceType.PAPER)

# The search() method uses FTS5 when query provided, falls back to listing when empty
```

### Hybrid Search with Citation Ranking

```python
# Full citation-aware search
results = lib.hybrid_search(
    query="knowledge graphs",
    resource_type=ResourceType.PAPER,  # Optional filter
    limit=20,                           # Final results
    candidate_limit=100,                # Stage 1 candidates
)

# Returns list of (Resource, scores_dict) tuples
for resource, scores in results:
    print(f"{resource.title}")
    print(f"  Final: {scores['final_score']:.3f}")
    print(f"  BM25: {scores['bm25']:.2f} (norm: {scores['bm25_normalized']:.2f})")
    print(f"  PageRank: {scores['pagerank']:.4f}")
    print(f"  Authority: {scores['authority']:.4f}")
    print(f"  Velocity: {scores['velocity']:.4f}/day")
    print(f"  Snippet: {scores['snippet']}")
```

### Custom Ranking Weights

```python
# Override default weights for specific use cases
custom_weights = {
    "bm25": 0.50,      # Emphasize text match
    "pagerank": 0.20,
    "velocity": 0.10,
    "co_citation": 0.05,
    "recency": 0.10,
    "influence": 0.05,
}

results = lib.hybrid_search(
    query="attention mechanisms",
    weights=custom_weights,
)
```

### Field-Specific Search

```python
index = lib.get_search_index()

# Search only titles
results = index.search_field("title", "transformer")

# Search only descriptions
results = index.search_field("description", "attention mechanism")

# FTS5 syntax also works in main search
results = lib.search("title:transformer OR description:attention")
```

### Similar Resource Discovery

```python
index = lib.get_search_index()

# Find resources similar to a specific resource
similar = index.get_similar(resource_id, limit=10)

for result in similar:
    resource = lib.get_by_id(result.resource_id)
    print(f"{resource.title}: BM25={result.bm25_score:.2f}")
```

## FTS5 Query Syntax

SQLite FTS5 supports rich query syntax:

| Syntax | Example | Meaning |
|--------|---------|---------|
| AND | `neural AND network` | Both terms required |
| OR | `neural OR network` | Either term |
| NOT | `neural NOT network` | Exclude term |
| Phrase | `"neural network"` | Exact phrase |
| Prefix | `neuro*` | Prefix match |
| Field | `title:transformer` | Search specific field |
| NEAR | `neural NEAR/5 network` | Within 5 tokens |

## Index Management

### Rebuild Index

```python
# Full rebuild from catalog (use after bulk imports)
count = lib.rebuild_search_index()
print(f"Indexed {count} resources")
```

### Index Statistics

```python
index = lib.get_search_index()
stats = index.get_stats()

print(f"Total indexed: {stats['total_indexed']}")
print(f"Index size: {stats['index_size_human']}")
print(f"By type: {stats['by_type']}")
```

### Optimize Index

```python
# Run FTS5 optimize and VACUUM (automatic at session end)
index = lib.get_search_index()
index.optimize()
```

## Citation Graph Algorithms

The search system leverages several graph algorithms:

### PageRank

Resources cited by many high-ranking resources score higher:

```python
graph = lib.get_citation_graph()
pagerank = graph.pagerank(damping_factor=0.85, iterations=10)

# Get top resources
top_resources = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:10]
```

### HITS (Hub/Authority)

Distinguishes between well-curated bibliographies (hubs) and seminal resources (authorities):

```python
hits = graph.hits()

for rid, scores in hits.items():
    print(f"{rid}: hub={scores['hub']:.3f}, authority={scores['authority']:.3f}")
```

### Citation Velocity

Measures how quickly a resource is being cited:

```python
velocity = graph.get_citation_velocity(resource_id, window_days=30)

print(f"Total citations: {velocity['total']}")
print(f"Recent (30d): {velocity['recent']}")
print(f"Velocity: {velocity['velocity']:.4f}/day")
print(f"Acceleration: {velocity['acceleration']:.4f}")
print(f"Age: {velocity['age_days']} days")
```

### Bibliographic Coupling

Find resources that cite the same references:

```python
coupling = graph.get_bibliographic_coupling(resource_id, limit=10)

for item in coupling:
    print(f"{item['coupled_id']}: {item['strength']} shared refs")
    print(f"  Shared: {item['shared_refs']}")
```

## Performance Notes

- FTS5 search: <50ms for 10K documents
- Hybrid search: <500ms including citation scoring
- Index is WAL-mode SQLite for concurrent read performance
- Ranking caches (PageRank, HITS) invalidated on citation changes
- Session-end hook optimizes index after batch processing
