# Quickstart: Basic Document Storage and Search

A getting-started guide for the Domain Memory Agent MCP server.

## Purpose

Get productive with Domain Memory Agent in under 5 minutes. This guide covers:
- Storing your first document
- Performing semantic search with TF-IDF
- Retrieving and listing documents
- Understanding basic scoring

## Variables

```yaml
MCP_SERVER: knowledge-base
DEFAULT_LIMIT: 10
MIN_SCORE_THRESHOLD: 0.0
AUTO_INDEX: true
```

## Prerequisites

The Domain Memory Agent MCP server must be running. Verify with:

```bash
# Check MCP server status
claude mcp list | grep knowledge-base
```

## Instructions

### Step 1: Store Your First Document

Store a document with title, content, and optional tags:

```python
# Basic document storage
await store_document(
    title="Getting Started with Python",
    content="""Python is a high-level programming language known for its
    readability and versatility. It supports multiple programming paradigms
    including procedural, object-oriented, and functional programming.
    Python's extensive standard library and active community make it
    ideal for web development, data science, automation, and scripting.""",
    tags=["programming", "python", "tutorial"],
    metadata={"level": "beginner", "author": "docs-team"}
)
```

**Response:**
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "title": "Getting Started with Python",
  "wordCount": 47,
  "tags": ["programming", "python", "tutorial"],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "stored": true
}
```

### Step 2: Add More Documents

Build a knowledge base by adding related documents:

```python
# Add multiple documents for better search results
await store_document(
    title="Python Data Structures",
    content="""Python provides several built-in data structures including
    lists, dictionaries, sets, and tuples. Lists are mutable sequences,
    dictionaries store key-value pairs, sets contain unique elements,
    and tuples are immutable sequences. Understanding these structures
    is fundamental to writing efficient Python code.""",
    tags=["programming", "python", "data-structures"]
)

await store_document(
    title="JavaScript Fundamentals",
    content="""JavaScript is a dynamic programming language essential for
    web development. It runs in browsers and on servers via Node.js.
    Key features include closures, prototypal inheritance, and
    asynchronous programming with promises and async/await.""",
    tags=["programming", "javascript", "web"]
)
```

### Step 3: Search Your Documents

Use TF-IDF semantic search to find relevant documents:

```python
# Basic search
results = await semantic_search(
    query="Python programming language features",
    limit=5
)
```

**Response:**
```json
{
  "results": [
    {
      "id": "a1b2c3d4e5f6g7h8",
      "title": "Getting Started with Python",
      "score": 0.847,
      "relevantExcerpts": [
        "Python is a high-level programming language known for its readability and versatility",
        "It supports multiple programming paradigms including procedural, object-oriented, and functional programming"
      ],
      "tags": ["programming", "python", "tutorial"],
      "wordCount": 47,
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": "b2c3d4e5f6g7h8i9",
      "title": "Python Data Structures",
      "score": 0.623,
      "relevantExcerpts": [
        "Python provides several built-in data structures including lists, dictionaries, sets, and tuples"
      ],
      "tags": ["programming", "python", "data-structures"],
      "wordCount": 52,
      "updatedAt": "2024-01-15T10:31:00.000Z"
    }
  ],
  "totalResults": 2,
  "query": "Python programming language features",
  "showing": 2
}
```

### Step 4: Retrieve a Specific Document

Get full document content by ID:

```python
doc = await get_document(documentId="a1b2c3d4e5f6g7h8")
```

**Response:**
```json
{
  "id": "a1b2c3d4e5f6g7h8",
  "title": "Getting Started with Python",
  "content": "Python is a high-level programming language...",
  "tags": ["programming", "python", "tutorial"],
  "wordCount": 47,
  "summary": null,
  "metadata": {"level": "beginner", "author": "docs-team"},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Step 5: List All Documents

Browse your knowledge base:

```python
# List all documents, sorted by most recently updated
docs = await list_documents(
    sortBy="updated",
    limit=10,
    offset=0
)
```

## Common Patterns

### Pattern 1: Store-and-Search Workflow

```python
# 1. Store new knowledge as you encounter it
await store_document(
    title="Error Handling Best Practices",
    content="... detailed content ...",
    tags=["best-practices", "error-handling"]
)

# 2. Later, search when you need to recall information
results = await semantic_search(
    query="how to handle errors gracefully"
)

# 3. Get full content if excerpt isn't enough
if results["results"]:
    full_doc = await get_document(documentId=results["results"][0]["id"])
```

### Pattern 2: Building Domain Knowledge

```python
# Create a structured knowledge base for a specific domain
domain_tags = ["api-design"]

# Store multiple related documents
docs_to_store = [
    ("REST API Principles", "RESTful APIs use HTTP methods...", ["rest"]),
    ("GraphQL Fundamentals", "GraphQL provides a query language...", ["graphql"]),
    ("API Versioning Strategies", "Version your APIs using...", ["versioning"]),
]

for title, content, extra_tags in docs_to_store:
    await store_document(
        title=title,
        content=content,
        tags=domain_tags + extra_tags
    )
```

### Pattern 3: Quick Document Update

```python
# Documents are updated in place when using the same ID
await store_document(
    id="existing-doc-id",  # Specify existing ID
    title="Updated Title",
    content="Updated content with new information...",
    tags=["updated"]
)
# Previous content is unindexed, new content is indexed
```

## Understanding Scores

TF-IDF scores indicate relevance:

| Score Range | Interpretation |
|-------------|----------------|
| 0.8 - 1.0 | Excellent match - query terms appear frequently |
| 0.5 - 0.8 | Good match - relevant content |
| 0.2 - 0.5 | Moderate match - some relevant terms |
| 0.0 - 0.2 | Weak match - minimal term overlap |

Scores depend on:
- **Term frequency**: How often query terms appear in the document
- **Inverse document frequency**: Rarer terms get higher weight
- **Document length**: Normalized by total terms in document

## Tips for Better Results

1. **Use specific terms**: "Python dictionary iteration" > "how to loop"
2. **Include domain vocabulary**: Use the same terms in queries as in documents
3. **Add meaningful tags**: Enable filtered search by topic
4. **Write descriptive titles**: Titles are indexed with content
5. **Keep content focused**: One topic per document improves precision

## Troubleshooting

**No results returned:**
- Check if documents are stored: `await list_documents()`
- Verify query terms appear in document content
- Lower `minScore` threshold: `minScore=0.0`

**Low relevance scores:**
- Query terms may not match document vocabulary
- Try synonyms or related terms
- Check document content contains expected keywords

**Document not found:**
- Verify document ID is correct
- Check if document was deleted
- List documents to see available IDs

## Next Steps

- Read `tfidf-search.md` to understand scoring in depth
- Learn about `tag-filtering.md` for organizing documents
- Explore `extractive-summarization.md` for generating summaries
- See `hybrid-approach.md` for combining with embeddings
