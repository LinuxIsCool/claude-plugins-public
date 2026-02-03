# Topic: Knowledge Graphs

*Resources related to knowledge graph technologies*

---

## Resources

| Resource | Domain | Key Insight |
|----------|--------|-------------|
| [[github.com#graphiti\|Graphiti]] | github.com | Temporal knowledge graphs for AI agents |

---

## Related Topics

- [[temporal-graphs]]
- [[agent-memory]]
- [[graph-databases]]

---

## How We Use This Topic

Knowledge graphs are central to this ecosystem:

1. **Git Temporal KG**: The `git-historian` agent maintains a FalkorDB graph of repository history
2. **Concept Extraction**: Future semantic layer will use KG patterns for concept linking
3. **Agent Memory**: Graphiti patterns inform how agents maintain persistent context

---

## Key Patterns Learned

### From Graphiti

1. **Bi-temporal Model**: Track both when facts were true AND when they were recorded
2. **Episode-based Ingestion**: All data enters as "episodes" (text, JSON, messages)
3. **Hybrid Retrieval**: Combine semantic search, keyword search, and graph traversal
4. **Automatic Invalidation**: New facts can invalidate contradictory old facts

### Applied In This Repository

```
Graphiti Pattern          → Our Implementation
────────────────────────────────────────────────
Episode ingestion         → Git commit ingestion
Bi-temporal edges         → valid_at on commit facts
Hybrid search            → (planned) combined query
Entity deduplication     → (planned) file node merging
```

---

*Topic catalogue for knowledge graphs.*
