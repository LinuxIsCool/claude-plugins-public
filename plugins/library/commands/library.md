---
description: Show library statistics and recent resources
---

# Library Command

Show the library's current state including statistics, recent resources, and citation graph health.

## Instructions

1. **Load Library**: Import and instantiate the Library class:
   ```python
   import sys
   sys.path.insert(0, "${CLAUDE_PLUGIN_ROOT}/src")
   from lib import Library
   lib = Library()
   ```

2. **Get Statistics**: Display library stats:
   ```python
   stats = lib.get_stats()
   print(f"Resources: {stats['resource_count']}")
   print(f"Citations: {stats['citation_count']}")
   print(f"By type: {stats['resources_by_type']}")
   print(f"Cache: {stats['cache']}")
   ```

3. **Show Recent Resources**: List recently accessed resources:
   ```python
   recent = lib.search(limit=10)  # Empty query returns sorted by access
   for r in recent:
       print(f"- {r.title or r.source}")
       print(f"  Type: {r.type.value}, Accessed: {r.access_count}x")
   ```

4. **Search Index Status**: Check search index health:
   ```python
   try:
       index = lib.get_search_index()
       index_stats = index.get_stats()
       print(f"Indexed: {index_stats['total_indexed']}")
       print(f"Index size: {index_stats['index_size_human']}")
   except Exception as e:
       print(f"Index not available: {e}")
   ```

5. **Citation Graph Overview**: Show graph statistics:
   ```python
   graph = lib.get_citation_graph()
   graph_stats = graph.get_stats()
   print(f"Nodes: {graph_stats['unique_nodes']}")
   print(f"Citation types: {graph_stats['citation_types']}")
   print(f"Avg in-degree: {graph_stats['avg_in_degree']:.2f}")
   ```

## Output Format

Present as a structured summary:

```
# Library Status

## Resources
- Total: N resources
- Papers: X | Repos: Y | URLs: Z | ...

## Search Index
- Indexed: N resources (size)
- Status: healthy/needs rebuild

## Citation Graph
- N citations across M resources
- Types: reference (X), extends (Y), ...

## Recent Activity
1. [Title](URL) - paper, 5 accesses
2. [Title](URL) - repo, 3 accesses
...
```

## When to Suggest Actions

- **Empty library**: Explain automatic capture via WebFetch hooks
- **Index out of sync**: Suggest running `lib.rebuild_search_index()`
- **Many resources**: Suggest using `/library-search` for finding specific items
- **Citation questions**: Point to citation-manager skill
