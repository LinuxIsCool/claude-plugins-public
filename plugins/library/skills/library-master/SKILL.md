---
name: library
description: Master skill for universal resource library (8 sub-skills). Covers URL management, citation tracking, resource cataloguing, cache management, extractor development, export formats, migration/import, and advanced search with citation-aware ranking. Invoke for external resource provenance, deduplication, academic citations, or library queries.
allowed-tools: Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task, Skill
---

# Library - Master Skill

The Library plugin manages all external resources accessed by the ecosystem. Every URL fetched, paper referenced, and dataset discovered gets catalogued with full provenance.

## Core Capabilities

- **Automatic URL Capture**: PostToolUse hooks capture WebFetch/WebSearch resources
- **Content-Addressed Storage**: SHA-256 deduplication at `.claude/library/.cache/`
- **Specialized Extractors**: arXiv, GitHub, DOI, and generic HTML parsing
- **Citation Graph**: PageRank, HITS, bibliographic coupling, co-citation analysis
- **SQLite FTS5 Search**: Full-text search with BM25 ranking and citation re-ranking
- **Dublin Core Metadata**: Standard schema with type-specific extensions

## Sub-Skills Index

Load sub-skills with Read tool from `${CLAUDE_PLUGIN_ROOT}/skills/library-master/subskills/`

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **resource-finder** | Finding existing resources by URL, topic, or type | `subskills/resource-finder.md` |
| **resource-adder** | Manually adding resources to the library | `subskills/resource-adder.md` |
| **citation-manager** | Working with citations and provenance | `subskills/citation-manager.md` |
| **search-advanced** | Hybrid search with FTS5 + citation ranking | `subskills/search-advanced.md` |
| **cache-manager** | Managing content-addressed cache | `subskills/cache-manager.md` |
| **extractor-developer** | Creating new extractors for resource types | `subskills/extractor-developer.md` |
| **library-exporter** | Exporting to BibTeX, CSL-JSON, markdown | `subskills/library-exporter.md` |
| **library-migration** | Importing from bookmarks, BibTeX, JSONL, URLs | `subskills/library-migration.md` |

## Quick Reference

### Key Files

```
.claude/library/
├── catalog.json           # Resource catalog (primary)
├── citations.json         # Citation graph
├── .url_index.json        # Quick URL lookup
└── .cache/objects/        # Content-addressed storage
```

### Resource Types

- `url` - Generic web pages
- `paper` - Academic papers (arXiv, DOI)
- `repo` - Code repositories (GitHub, GitLab)
- `book` - Books (ISBN)
- `video` - Video content
- `dataset` - Data sources
- `image` - Images

### Common Operations

**Check if URL exists:**
```python
from plugins.library.src.lib import Library
lib = Library()
if lib.has_url("https://example.com"):
    resource = lib.get_by_url("https://example.com")
```

**Add resource manually:**
```python
resource, is_new = lib.add_resource(
    url="https://arxiv.org/abs/2312.12345",
    title="Paper Title",
    resource_type=ResourceType.PAPER,
)
```

**Basic FTS5 search:**
```python
results = lib.search(query="knowledge graphs", resource_type=ResourceType.PAPER)
```

**Hybrid search with citation ranking:**
```python
results = lib.hybrid_search(
    query="knowledge graphs",
    limit=20,
    candidate_limit=100,
)
for resource, scores in results:
    print(f"{resource.title}: {scores['final_score']:.3f}")
    print(f"  BM25: {scores['bm25_normalized']:.2f}, PageRank: {scores['pagerank']:.3f}")
```

**Citation graph analysis:**
```python
graph = lib.get_citation_graph()
pagerank = graph.pagerank()           # Importance scores
hits = graph.hits()                    # Hub/authority scores
velocity = graph.get_citation_velocity(resource_id)
coupling = graph.get_bibliographic_coupling(resource_id)
```

## Integration Points

- **Hooks**: PostToolUse captures WebFetch/WebSearch automatically
- **SessionEnd**: Batch processes pending resources into catalog
- **Librarian Agent**: Use `library:librarian` for complex queries
- **Journal**: Resources link to journal entries via citations
