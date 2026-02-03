---
description: Search library resources with hybrid citation-aware ranking
args: query
---

# Library Search Command

Search library resources using FTS5 full-text search with citation-aware re-ranking.

## Arguments

- `query` (required): Search query supporting FTS5 syntax

## Instructions

1. **Parse Query**: Extract the search query from arguments. If no query provided, prompt the user.

2. **Load Library**:
   ```python
   import sys
   sys.path.insert(0, "${CLAUDE_PLUGIN_ROOT}/src")
   from lib import Library
   lib = Library()
   ```

3. **Execute Hybrid Search**:
   ```python
   results = lib.hybrid_search(
       query="<user query>",
       limit=20,
       candidate_limit=100,
   )
   ```

4. **Present Results**: Display results with relevance scores:
   ```python
   for i, (resource, scores) in enumerate(results, 1):
       print(f"{i}. {resource.title or resource.source}")
       print(f"   URL: {resource.source}")
       print(f"   Type: {resource.type.value}")
       print(f"   Score: {scores['final_score']:.3f}")
       if scores['snippet']:
           print(f"   Match: ...{scores['snippet']}...")
       print()
   ```

5. **Explain Scoring** (if user asks): Show score breakdown:
   ```python
   print(f"   BM25: {scores['bm25_normalized']:.2f}")
   print(f"   PageRank: {scores['pagerank']:.4f}")
   print(f"   Authority: {scores['authority']:.4f}")
   print(f"   Velocity: {scores['velocity']:.4f}/day")
   ```

## Query Syntax Examples

Help users with FTS5 query syntax:

| Query | Meaning |
|-------|---------|
| `knowledge graphs` | Both terms anywhere |
| `"knowledge graph"` | Exact phrase |
| `knowledge OR graph` | Either term |
| `knowledge NOT neural` | Exclude term |
| `title:transformer` | Search only title field |
| `neuro*` | Prefix match |

## Output Format

```
# Search Results: "knowledge graphs"

Found 15 results (showing top 10):

1. **Paper Title Here**
   https://arxiv.org/abs/2312.12345
   Type: paper | Score: 0.847
   ...matching text with <mark>knowledge</mark> <mark>graphs</mark>...

2. **Another Resource**
   https://github.com/org/repo
   Type: repo | Score: 0.723
   ...
```

## When No Results

If no results found:
1. Suggest relaxing the query (remove restrictive terms)
2. Try field-specific search: `title:term` vs full text
3. Check if index needs rebuild: `lib.rebuild_search_index()`
4. List available resource types to help refine search

## Advanced Options

For power users, mention:
- Custom weights via Python API
- Field-specific search
- Type filtering: `lib.hybrid_search(query, resource_type=ResourceType.PAPER)`
- Similar resource discovery via `index.get_similar(resource_id)`
