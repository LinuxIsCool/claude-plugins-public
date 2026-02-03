---
name: hybrid-search
description: Combine keyword (BM25) and semantic (vector) search for optimal retrieval. Use when you need both precision (exact matches) and recall (semantic similarity). The default choice for most code search tasks.
allowed-tools: Read, Bash, Glob, Grep, Task, WebFetch
---

# Hybrid Search

Combining the best of keyword and semantic search.

## Why Hybrid?

| Method | Strength | Weakness |
|--------|----------|----------|
| Keyword (BM25) | Exact matches, specific terms | Misses synonyms, context |
| Semantic (Vector) | Meaning, intent, synonyms | Can miss specific terms |
| **Hybrid** | **Both precision AND recall** | More complex |

## The Core Pattern

```
Query: "authentication middleware"

Keyword Search (BM25):              Semantic Search (Vector):
├── auth_middleware.py [0.95]       ├── login_handler.py [0.89]
├── middleware.js [0.82]            ├── session_manager.py [0.85]
└── auth.config.ts [0.71]           └── user_auth.py [0.81]

                  ↓ Fusion ↓

Hybrid Results (RRF):
├── auth_middleware.py [0.92]    ← Appears in both
├── login_handler.py [0.78]      ← Strong semantic
├── middleware.js [0.71]         ← Strong keyword
├── session_manager.py [0.68]
└── auth.config.ts [0.55]
```

## Reciprocal Rank Fusion (RRF)

The standard fusion algorithm:

```python
def reciprocal_rank_fusion(keyword_results, semantic_results, k=60):
    """
    Combine ranked lists using RRF.

    k parameter controls influence of lower-ranked results:
    - Lower k (20-40): Emphasize top results
    - Higher k (60-100): More democratic fusion
    """
    scores = {}

    for rank, doc in enumerate(keyword_results):
        scores[doc] = scores.get(doc, 0) + 1 / (k + rank + 1)

    for rank, doc in enumerate(semantic_results):
        scores[doc] = scores.get(doc, 0) + 1 / (k + rank + 1)

    return sorted(scores.items(), key=lambda x: -x[1])
```

## Implementation Patterns

### Pattern 1: Sequential (Simple)

```python
# Run both searches, then fuse
keyword_results = bm25_search(query, corpus)
semantic_results = vector_search(embed(query), index)
hybrid_results = reciprocal_rank_fusion(keyword_results, semantic_results)
```

### Pattern 2: Parallel (Efficient)

```python
import asyncio

async def hybrid_search(query: str) -> list:
    keyword_task = asyncio.create_task(bm25_search(query))
    semantic_task = asyncio.create_task(vector_search(embed(query)))

    keyword_results, semantic_results = await asyncio.gather(
        keyword_task, semantic_task
    )

    return reciprocal_rank_fusion(keyword_results, semantic_results)
```

### Pattern 3: Weighted Fusion

```python
def weighted_rrf(keyword_results, semantic_results, alpha=0.5, k=60):
    """
    Weight keyword vs semantic contribution.

    alpha: 0.0 = pure semantic, 1.0 = pure keyword
    """
    scores = {}

    for rank, doc in enumerate(keyword_results):
        scores[doc] = scores.get(doc, 0) + alpha / (k + rank + 1)

    for rank, doc in enumerate(semantic_results):
        scores[doc] = scores.get(doc, 0) + (1 - alpha) / (k + rank + 1)

    return sorted(scores.items(), key=lambda x: -x[1])
```

## BM25: The Keyword Side

### What is BM25?

Best Matching 25 - a probabilistic ranking function:

```
BM25(Q, D) = Σ IDF(qi) * (f(qi, D) * (k1 + 1)) / (f(qi, D) + k1 * (1 - b + b * |D|/avgdl))

Where:
- IDF(qi): Inverse document frequency (rarity of term)
- f(qi, D): Term frequency in document
- |D|: Document length
- avgdl: Average document length
- k1, b: Tuning parameters (default: k1=1.5, b=0.75)
```

### Python Implementation (rank_bm25)

```python
from rank_bm25 import BM25Okapi

# Index your documents
tokenized_corpus = [doc.split() for doc in documents]
bm25 = BM25Okapi(tokenized_corpus)

# Search
tokenized_query = query.split()
scores = bm25.get_scores(tokenized_query)
top_n = bm25.get_top_n(tokenized_query, documents, n=10)
```

### Optimizing BM25 for Code

```python
import re

def code_tokenizer(text: str) -> list[str]:
    """Tokenize code with camelCase, snake_case splitting."""
    # Split on whitespace and punctuation
    tokens = re.split(r'[\s\.\,\(\)\[\]\{\}\;\:\=\+\-\*\/\<\>\!\@\#\$\%\^\&]+', text)

    expanded = []
    for token in tokens:
        if not token:
            continue
        # Split camelCase
        parts = re.sub(r'([a-z])([A-Z])', r'\1 \2', token).split()
        # Split snake_case
        for part in parts:
            expanded.extend(part.split('_'))

    return [t.lower() for t in expanded if len(t) > 1]

# Use custom tokenizer
tokenized_corpus = [code_tokenizer(doc) for doc in documents]
bm25 = BM25Okapi(tokenized_corpus)
```

## Vector: The Semantic Side

### Embedding Models for Code

| Model | Dimensions | Quality | Speed | Notes |
|-------|------------|---------|-------|-------|
| `text-embedding-3-small` | 1536 | Good | Fast | OpenAI, cheap |
| `text-embedding-3-large` | 3072 | Best | Medium | OpenAI, expensive |
| `nomic-embed-text` | 768 | Good | Fast | Local via Ollama |
| `all-MiniLM-L6-v2` | 384 | OK | Very fast | sentence-transformers |
| `voyage-code-2` | 1536 | Excellent | Medium | Code-specific |

### Chunking for Code

```python
def chunk_code_file(content: str, max_tokens: int = 512) -> list[str]:
    """
    Chunk code respecting logical boundaries.

    Priority:
    1. Function/class boundaries
    2. Comment blocks
    3. Fixed token windows with overlap
    """
    import re

    # Try to split on function/class definitions
    pattern = r'((?:def |class |function |const |export )[^\n]+)'
    parts = re.split(pattern, content)

    chunks = []
    current_chunk = ""

    for part in parts:
        if len(current_chunk) + len(part) > max_tokens * 4:  # ~4 chars/token
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = part
        else:
            current_chunk += part

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks
```

## When to Weight Toward Keyword

- Query contains **specific identifiers** (function names, variables)
- Query has **error codes** or **version numbers**
- User asks for **exact match** explicitly
- Domain has **specialized vocabulary**

```python
# Detect keyword-heavy query
def keyword_weight(query: str) -> float:
    """Return alpha for weighted fusion. Higher = more keyword."""
    # Specific patterns suggest keyword search
    if re.search(r'[A-Z][a-z]+[A-Z]', query):  # camelCase
        return 0.7
    if re.search(r'[a-z]+_[a-z]+', query):  # snake_case
        return 0.7
    if re.search(r'v?\d+\.\d+', query):  # version number
        return 0.8
    if re.search(r'[A-Z]{2,}', query):  # ACRONYM
        return 0.6
    return 0.5  # default balanced
```

## When to Weight Toward Semantic

- Query is **natural language question**
- Looking for **conceptually similar** code
- Query is **vague or exploratory**
- Want to find **alternatives/synonyms**

```python
def semantic_weight(query: str) -> float:
    """Return alpha for weighted fusion. Lower = more semantic."""
    question_words = ['how', 'what', 'why', 'when', 'where', 'which']
    if any(query.lower().startswith(w) for w in question_words):
        return 0.3  # More semantic for questions
    if len(query.split()) > 5:  # Longer queries
        return 0.4
    return 0.5  # default balanced
```

## Tools and Libraries

### All-in-One Solutions

| Tool | Features | Best For |
|------|----------|----------|
| **LangChain** | Hybrid retrievers, many vector DBs | Quick prototyping |
| **LlamaIndex** | Hybrid query engines | Document QA |
| **Haystack** | Production pipelines | Enterprise |
| **Weaviate** | Native hybrid search | Self-hosted |
| **Pinecone** | Managed, hybrid built-in | Serverless |

### pgvector with BM25 (PostgreSQL)

```sql
-- Create hybrid search function
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding VECTOR(1536),
    match_count INT DEFAULT 10,
    keyword_weight FLOAT DEFAULT 0.5
)
RETURNS TABLE (id INT, score FLOAT) AS $$
BEGIN
    RETURN QUERY
    WITH keyword_results AS (
        SELECT id, ts_rank(to_tsvector(content), plainto_tsquery(query_text)) AS rank
        FROM documents
        WHERE to_tsvector(content) @@ plainto_tsquery(query_text)
        ORDER BY rank DESC
        LIMIT match_count * 2
    ),
    semantic_results AS (
        SELECT id, 1 - (embedding <=> query_embedding) AS similarity
        FROM documents
        ORDER BY embedding <=> query_embedding
        LIMIT match_count * 2
    )
    SELECT
        COALESCE(k.id, s.id) AS id,
        (COALESCE(k.rank, 0) * keyword_weight +
         COALESCE(s.similarity, 0) * (1 - keyword_weight)) AS score
    FROM keyword_results k
    FULL OUTER JOIN semantic_results s ON k.id = s.id
    ORDER BY score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

## Evaluation Metrics

### Precision@K
```python
def precision_at_k(retrieved: list, relevant: set, k: int) -> float:
    """What fraction of top-k results are relevant?"""
    return len(set(retrieved[:k]) & relevant) / k
```

### Recall@K
```python
def recall_at_k(retrieved: list, relevant: set, k: int) -> float:
    """What fraction of relevant items are in top-k?"""
    return len(set(retrieved[:k]) & relevant) / len(relevant)
```

### Mean Reciprocal Rank (MRR)
```python
def mrr(retrieved: list, relevant: set) -> float:
    """Average of 1/rank of first relevant result."""
    for i, doc in enumerate(retrieved):
        if doc in relevant:
            return 1 / (i + 1)
    return 0
```

## Anti-Patterns

1. **Skipping keyword when query is specific**
   - Bad: Using only vectors for "getUserById function"
   - Good: Weight toward keyword for specific identifiers

2. **Using same weights for all queries**
   - Bad: Fixed 50/50 for everything
   - Good: Adaptive weighting based on query analysis

3. **Not evaluating on your data**
   - Bad: Assuming default parameters work
   - Good: Benchmark with your codebase's patterns

4. **Over-chunking code**
   - Bad: 100-token chunks that break functions
   - Good: Respect logical boundaries (functions, classes)

## Learnings Log

### Entry Template
```markdown
**Date**: YYYY-MM-DD
**Query**: [The search query]
**Method**: hybrid (alpha=X)
**Results**: Good/Bad/Mixed
**Learning**: [What we discovered]
**Adjustment**: [How to improve]
```

Track your learnings in `plugins/search/state/learnings.md`.
