# Organizing Documents with Tags

Strategic use of tags for document organization and filtered search.

## Purpose

Learn how to effectively use tags to:
- Organize documents into logical categories
- Enable precise filtered searches
- Build multi-domain knowledge bases
- Create navigable document hierarchies

## Variables

```yaml
MAX_TAGS_PER_DOCUMENT: unlimited
TAG_CASE_SENSITIVITY: case_sensitive
TAG_FILTER_MODE: any_match
RESERVED_TAGS: []
```

## How Tag Filtering Works

Tags provide categorical metadata for documents. During search and list operations, tags enable filtering to narrow results.

### Tag Matching Logic

```python
def matches_tags(doc_tags: list[str], filter_tags: list[str]) -> bool:
    """
    Check if document matches tag filter.

    Match mode: ANY (OR logic)
    A document matches if it has at least one tag from the filter.
    """
    return any(tag in doc_tags for tag in filter_tags)

# Examples:
# doc_tags=["python", "tutorial"], filter_tags=["python"] -> True
# doc_tags=["python", "tutorial"], filter_tags=["java"] -> False
# doc_tags=["python", "tutorial"], filter_tags=["python", "advanced"] -> True
```

### Filtered Search Flow

```
Query: "error handling"
Tag Filter: ["python", "best-practices"]

1. Calculate TF-IDF scores for all documents
2. Filter to documents with at least one matching tag
3. Return filtered results sorted by score
```

## Instructions

### Adding Tags to Documents

```python
# Single category
await store_document(
    title="Flask REST API Guide",
    content="...",
    tags=["python"]
)

# Multiple categories
await store_document(
    title="Flask REST API Guide",
    content="...",
    tags=["python", "web", "api", "flask", "tutorial"]
)
```

### Searching with Tag Filters

```python
# Filter to specific category
results = await semantic_search(
    query="authentication implementation",
    tags=["python"]  # Only Python documents
)

# Multiple tag filter (OR logic)
results = await semantic_search(
    query="authentication implementation",
    tags=["python", "javascript"]  # Python OR JavaScript documents
)
```

### Listing Documents by Tag

```python
# List all Python documents
python_docs = await list_documents(
    tags=["python"],
    sortBy="updated",
    limit=20
)

# List all tutorial documents
tutorials = await list_documents(
    tags=["tutorial"],
    sortBy="title"
)
```

## Common Patterns

### Pattern 1: Hierarchical Tag Taxonomy

Create a structured tag system for complex knowledge bases:

```yaml
# Tag Taxonomy Example
domains:
  - backend
  - frontend
  - devops
  - data

languages:
  - python
  - javascript
  - go
  - rust

types:
  - tutorial
  - reference
  - troubleshooting
  - architecture

levels:
  - beginner
  - intermediate
  - advanced
```

Apply multiple taxonomy levels:

```python
await store_document(
    title="Advanced Python Async Patterns",
    content="...",
    tags=[
        "backend",       # Domain
        "python",        # Language
        "reference",     # Type
        "advanced"       # Level
    ]
)
```

### Pattern 2: Project-Based Organization

```python
# Tag documents by project
projects = ["project-alpha", "project-beta", "project-gamma"]

await store_document(
    title="Alpha API Specification",
    content="...",
    tags=["project-alpha", "api", "specification"]
)

await store_document(
    title="Alpha Deployment Guide",
    content="...",
    tags=["project-alpha", "devops", "deployment"]
)

# Find all Alpha project documents
alpha_docs = await list_documents(tags=["project-alpha"])
```

### Pattern 3: Temporal Tags

```python
# Tag by time period or version
await store_document(
    title="Q1 2024 Architecture Decisions",
    content="...",
    tags=["architecture", "decisions", "2024-q1"]
)

await store_document(
    title="v2.0 Migration Guide",
    content="...",
    tags=["migration", "v2.0", "breaking-changes"]
)
```

### Pattern 4: Status Tags

```python
# Track document status
status_tags = ["draft", "review", "approved", "archived"]

await store_document(
    title="New Feature Proposal",
    content="...",
    tags=["proposal", "feature", "draft"]
)

# Update status by re-storing with new tags
await store_document(
    id="existing-id",
    title="New Feature Proposal",
    content="...",
    tags=["proposal", "feature", "approved"]  # Status changed
)
```

### Pattern 5: Cross-Domain Search

```python
async def cross_domain_search(query: str, domains: list[str]) -> dict:
    """Search across multiple knowledge domains."""
    all_results = []

    for domain in domains:
        results = await semantic_search(
            query=query,
            tags=[domain],
            limit=5
        )
        for r in results["results"]:
            r["domain"] = domain
        all_results.extend(results["results"])

    # Re-sort by score across all domains
    all_results.sort(key=lambda x: x["score"], reverse=True)
    return {"results": all_results[:10], "domains_searched": domains}

# Usage
results = await cross_domain_search(
    query="caching strategies",
    domains=["backend", "frontend", "devops"]
)
```

### Pattern 6: Tag-Based Navigation

```python
async def browse_by_tags():
    """Build a tag-based navigation structure."""
    all_docs = await list_documents(limit=1000)

    # Collect all unique tags
    tag_counts = {}
    for doc in all_docs["documents"]:
        for tag in doc["tags"]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Sort by frequency
    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        "total_documents": all_docs["total"],
        "unique_tags": len(tag_counts),
        "tags_by_frequency": sorted_tags
    }
```

## Tag Naming Conventions

### Recommended Practices

```python
# Use lowercase with hyphens
good_tags = ["best-practices", "error-handling", "api-design"]

# Avoid spaces (use hyphens)
bad_tags = ["best practices", "error handling"]

# Use singular forms consistently
good_tags = ["tutorial", "guide", "reference"]
bad_tags = ["tutorials", "guides", "references"]

# Be specific over general
good_tags = ["python-3.11", "django-4.x"]
bad_tags = ["python", "django"]  # Less useful alone

# Combine general + specific
balanced_tags = ["python", "python-3.11", "async"]
```

### Tag Length Guidelines

| Tag Type | Example | Length |
|----------|---------|--------|
| Domain | `backend` | 5-15 chars |
| Language | `python` | 4-15 chars |
| Topic | `authentication` | 8-20 chars |
| Project | `project-alpha` | 10-25 chars |
| Version | `v2.1.0` | 5-10 chars |

## Simulating AND Logic

Tag filtering uses OR logic. For AND logic, filter client-side:

```python
async def search_with_all_tags(query: str, required_tags: list[str]) -> list:
    """Search requiring ALL specified tags (AND logic)."""
    # Get broader results with any tag
    results = await semantic_search(
        query=query,
        tags=required_tags,
        limit=100  # Larger set to filter
    )

    # Filter to documents with ALL tags
    filtered = []
    for result in results["results"]:
        doc = await get_document(documentId=result["id"])
        if all(tag in doc["tags"] for tag in required_tags):
            filtered.append(result)

    return filtered[:10]  # Return top 10

# Find documents tagged with BOTH python AND tutorial
results = await search_with_all_tags(
    query="error handling",
    required_tags=["python", "tutorial"]
)
```

## Tag Analytics

### Understanding Tag Distribution

```python
async def analyze_tags() -> dict:
    """Analyze tag usage patterns."""
    docs = await list_documents(limit=1000)

    tag_stats = {
        "tag_counts": {},
        "docs_without_tags": 0,
        "avg_tags_per_doc": 0,
        "tag_cooccurrence": {}
    }

    total_tags = 0
    for doc in docs["documents"]:
        if not doc["tags"]:
            tag_stats["docs_without_tags"] += 1
            continue

        total_tags += len(doc["tags"])

        for tag in doc["tags"]:
            tag_stats["tag_counts"][tag] = tag_stats["tag_counts"].get(tag, 0) + 1

        # Track co-occurrence
        for i, tag1 in enumerate(doc["tags"]):
            for tag2 in doc["tags"][i+1:]:
                pair = tuple(sorted([tag1, tag2]))
                tag_stats["tag_cooccurrence"][pair] = \
                    tag_stats["tag_cooccurrence"].get(pair, 0) + 1

    tag_stats["avg_tags_per_doc"] = total_tags / max(1, docs["total"])
    return tag_stats
```

### Finding Orphan Tags

```python
async def find_orphan_tags(min_usage: int = 2) -> list[str]:
    """Find tags used by only a few documents."""
    analysis = await analyze_tags()

    return [
        tag for tag, count in analysis["tag_counts"].items()
        if count < min_usage
    ]
```

## Troubleshooting

**No results with tag filter:**
- Verify tag exists: `await list_documents(tags=["your-tag"])`
- Check case sensitivity: `"Python"` != `"python"`
- Ensure documents have the tag assigned

**Too many results:**
- Add more specific tags to filter
- Combine tag filter with `minScore` threshold
- Use client-side AND logic for multiple tags

**Tag organization became unwieldy:**
- Audit tags with `analyze_tags()`
- Consolidate similar tags
- Document your tag taxonomy
- Remove orphan tags from documents

## See Also

- `quickstart.md` - Basic tag usage
- `tfidf-search.md` - How search works with tag filtering
- `hybrid-approach.md` - Tags combined with semantic search
