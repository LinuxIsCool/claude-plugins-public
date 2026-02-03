# Hybrid Search: Combining TF-IDF with Embeddings

Strategies for achieving semantic understanding while preserving TF-IDF's strengths.

## Purpose

Learn how to combine TF-IDF and embedding-based search to:
- Get the best of both retrieval methods
- Handle vocabulary mismatch (synonyms, paraphrasing)
- Maintain explainability and speed
- Scale semantically without full embedding dependency

## Variables

```yaml
TFIDF_WEIGHT: 0.4
EMBEDDING_WEIGHT: 0.6
RECIPROCAL_RANK_K: 60
RERANK_TOP_N: 20
EMBEDDING_MODEL: sentence-transformers/all-MiniLM-L6-v2
```

## Why Hybrid Search?

### TF-IDF Strengths

| Strength | Benefit |
|----------|---------|
| Exact term matching | Finds documents with specific keywords |
| Zero dependencies | No external services required |
| Explainable results | Know exactly why documents matched |
| Fast indexing | No embedding computation |
| Low latency | < 50ms on large corpora |

### TF-IDF Weaknesses

| Weakness | Impact |
|----------|--------|
| No semantic understanding | "car" won't match "automobile" |
| Vocabulary mismatch | Query terms must appear in documents |
| No conceptual similarity | Can't find related concepts |
| Word order ignored | Treats text as bag of words |

### Embedding Strengths

| Strength | Benefit |
|----------|---------|
| Semantic similarity | Understands meaning, not just words |
| Handles synonyms | "happy" matches "joyful" |
| Cross-lingual potential | Can match concepts across languages |
| Conceptual retrieval | Finds related ideas |

### Embedding Weaknesses

| Weakness | Impact |
|----------|--------|
| Heavy dependencies | Requires ML libraries (sentence-transformers, torch) |
| Resource intensive | ~100MB+ model, GPU beneficial |
| Black box | Hard to explain why documents matched |
| Slower indexing | Embedding computation per document |

## Hybrid Architectures

### Architecture 1: Parallel Retrieval with Fusion

```
Query
  ├──> TF-IDF Search ──> Results A (with scores)
  │
  └──> Embedding Search ──> Results B (with scores)
                │
                v
         Score Fusion ──> Final Ranked Results
```

```python
async def hybrid_search_parallel(
    query: str,
    tfidf_weight: float = 0.4,
    embedding_weight: float = 0.6,
    limit: int = 10
) -> list[dict]:
    """
    Parallel hybrid search with weighted score fusion.
    """
    # Retrieve from both systems
    tfidf_results = await semantic_search(query=query, limit=50)
    embedding_results = await embedding_search(query=query, limit=50)

    # Normalize scores to [0, 1] range
    tfidf_scores = normalize_scores(tfidf_results)
    embedding_scores = normalize_scores(embedding_results)

    # Combine into unified scoring
    combined = {}
    for doc_id, score in tfidf_scores.items():
        combined[doc_id] = {"tfidf": score, "embedding": 0.0}

    for doc_id, score in embedding_scores.items():
        if doc_id in combined:
            combined[doc_id]["embedding"] = score
        else:
            combined[doc_id] = {"tfidf": 0.0, "embedding": score}

    # Calculate weighted final score
    final_scores = []
    for doc_id, scores in combined.items():
        final = (
            scores["tfidf"] * tfidf_weight +
            scores["embedding"] * embedding_weight
        )
        final_scores.append((doc_id, final, scores))

    # Sort and return top results
    final_scores.sort(key=lambda x: x[1], reverse=True)
    return final_scores[:limit]


def normalize_scores(results: list[dict]) -> dict[str, float]:
    """Normalize scores to [0, 1] using min-max scaling."""
    if not results:
        return {}

    scores = {r["id"]: r["score"] for r in results}
    min_score = min(scores.values())
    max_score = max(scores.values())
    range_score = max_score - min_score or 1.0

    return {
        doc_id: (score - min_score) / range_score
        for doc_id, score in scores.items()
    }
```

### Architecture 2: Reciprocal Rank Fusion (RRF)

```python
def reciprocal_rank_fusion(
    result_lists: list[list[str]],
    k: int = 60
) -> list[tuple[str, float]]:
    """
    Combine rankings using Reciprocal Rank Fusion.

    RRF Score = sum(1 / (k + rank_i)) for each result list

    k=60 is a common choice that balances top and lower ranks.
    """
    doc_scores = {}

    for results in result_lists:
        for rank, doc_id in enumerate(results, start=1):
            rrf_score = 1.0 / (k + rank)
            doc_scores[doc_id] = doc_scores.get(doc_id, 0.0) + rrf_score

    # Sort by combined RRF score
    ranked = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
    return ranked


async def hybrid_search_rrf(query: str, limit: int = 10) -> list[dict]:
    """Hybrid search using Reciprocal Rank Fusion."""
    # Get ranked lists from each system
    tfidf_results = await semantic_search(query=query, limit=50)
    embedding_results = await embedding_search(query=query, limit=50)

    tfidf_ranking = [r["id"] for r in tfidf_results["results"]]
    embedding_ranking = [r["id"] for r in embedding_results]

    # Fuse rankings
    combined = reciprocal_rank_fusion([tfidf_ranking, embedding_ranking])

    return combined[:limit]
```

### Architecture 3: Cascade (TF-IDF First, Embedding Rerank)

```
Query
  │
  v
TF-IDF Search (fast, broad retrieval)
  │
  └──> Top 100 candidates
           │
           v
    Embedding Rerank (precise, semantic)
           │
           └──> Top 10 final results
```

```python
async def hybrid_search_cascade(
    query: str,
    initial_limit: int = 100,
    final_limit: int = 10
) -> list[dict]:
    """
    Cascade hybrid: TF-IDF retrieval, embedding reranking.

    Benefits:
    - Fast initial retrieval (TF-IDF on full corpus)
    - Precise final ranking (embeddings on small set)
    - Reduced embedding compute (only top candidates)
    """
    # Stage 1: Fast TF-IDF retrieval
    candidates = await semantic_search(query=query, limit=initial_limit)

    # Stage 2: Compute embeddings only for candidates
    query_embedding = compute_embedding(query)

    reranked = []
    for candidate in candidates["results"]:
        doc = await get_document(documentId=candidate["id"])
        doc_embedding = compute_embedding(doc["content"])

        similarity = cosine_similarity(query_embedding, doc_embedding)
        reranked.append({
            **candidate,
            "embedding_score": similarity,
            "combined_score": 0.4 * candidate["score"] + 0.6 * similarity
        })

    # Sort by combined score
    reranked.sort(key=lambda x: x["combined_score"], reverse=True)
    return reranked[:final_limit]


def compute_embedding(text: str) -> list[float]:
    """Compute embedding vector for text."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer('all-MiniLM-L6-v2')
    return model.encode(text).tolist()


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    import numpy as np

    a = np.array(vec_a)
    b = np.array(vec_b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
```

## Instructions

### When to Use Each Approach

| Scenario | Recommended Architecture |
|----------|-------------------------|
| Keyword-heavy queries | TF-IDF only |
| Conceptual queries | Embedding-focused hybrid |
| Mixed queries | Balanced parallel fusion |
| Large corpus, limited compute | Cascade (TF-IDF + rerank) |
| Explainability required | TF-IDF with optional embedding boost |

### Implementing Graceful Fallback

```python
async def hybrid_search_with_fallback(
    query: str,
    use_embeddings: bool = True,
    limit: int = 10
) -> dict:
    """
    Hybrid search with graceful embedding fallback.
    """
    # Always get TF-IDF results
    tfidf_results = await semantic_search(query=query, limit=limit * 2)

    if not use_embeddings:
        return {"results": tfidf_results["results"][:limit], "method": "tfidf_only"}

    # Try embedding search
    try:
        embedding_results = await embedding_search(query=query, limit=limit * 2)

        # Fuse results
        combined = fuse_results(tfidf_results, embedding_results)
        return {"results": combined[:limit], "method": "hybrid"}

    except Exception as e:
        # Fallback to TF-IDF only
        return {
            "results": tfidf_results["results"][:limit],
            "method": "tfidf_fallback",
            "fallback_reason": str(e)
        }
```

### Tuning Weights

```python
async def evaluate_weights(
    test_queries: list[dict],
    weight_range: list[float] = [0.2, 0.4, 0.5, 0.6, 0.8]
) -> dict:
    """
    Evaluate different TF-IDF/embedding weight combinations.

    test_queries format:
    [{"query": "...", "relevant_docs": ["doc1", "doc2"]}]
    """
    results = {}

    for tfidf_weight in weight_range:
        embedding_weight = 1.0 - tfidf_weight

        scores = []
        for test in test_queries:
            hybrid_results = await hybrid_search_parallel(
                query=test["query"],
                tfidf_weight=tfidf_weight,
                embedding_weight=embedding_weight
            )

            # Calculate precision@k
            top_k_ids = [r[0] for r in hybrid_results[:5]]
            relevant = set(test["relevant_docs"])
            precision = len(set(top_k_ids) & relevant) / 5
            scores.append(precision)

        results[f"tfidf_{tfidf_weight}"] = sum(scores) / len(scores)

    return results
```

## Common Patterns

### Pattern 1: Query Classification

```python
def classify_query(query: str) -> str:
    """
    Classify query type to select search strategy.
    """
    tokens = query.lower().split()

    # Keyword-heavy indicators
    keyword_indicators = [
        len(tokens) <= 3,
        any(t.startswith('"') for t in tokens),  # Quoted terms
        any(char.isdigit() for char in query),   # Version numbers, IDs
        "error" in tokens or "exception" in tokens,
    ]

    # Conceptual indicators
    conceptual_indicators = [
        len(tokens) > 5,
        any(word in tokens for word in ["how", "why", "explain", "similar"]),
        "like" in tokens or "related" in tokens,
    ]

    if sum(keyword_indicators) > sum(conceptual_indicators):
        return "keyword"
    return "conceptual"


async def adaptive_search(query: str, limit: int = 10) -> list[dict]:
    """Search with strategy based on query type."""
    query_type = classify_query(query)

    if query_type == "keyword":
        # Favor TF-IDF
        return await hybrid_search_parallel(
            query, tfidf_weight=0.7, embedding_weight=0.3, limit=limit
        )
    else:
        # Favor embeddings
        return await hybrid_search_parallel(
            query, tfidf_weight=0.3, embedding_weight=0.7, limit=limit
        )
```

### Pattern 2: Explanation Augmentation

```python
async def explainable_hybrid_search(
    query: str,
    limit: int = 10
) -> list[dict]:
    """
    Hybrid search with explanations for each result.
    """
    results = await hybrid_search_parallel(query, limit=limit)

    explained = []
    for doc_id, final_score, component_scores in results:
        doc = await get_document(documentId=doc_id)

        explanation = {
            "id": doc_id,
            "title": doc["title"],
            "final_score": final_score,
            "explanation": {
                "tfidf_contribution": component_scores["tfidf"] * 0.4,
                "embedding_contribution": component_scores["embedding"] * 0.6,
                "tfidf_matched_terms": get_matched_terms(query, doc["content"]),
                "semantic_similarity": component_scores["embedding"]
            }
        }
        explained.append(explanation)

    return explained


def get_matched_terms(query: str, content: str) -> list[str]:
    """Find query terms that appear in content."""
    query_tokens = set(tokenize(query))
    content_tokens = set(tokenize(content))
    return list(query_tokens & content_tokens)
```

### Pattern 3: Incremental Embedding Adoption

```python
class HybridSearchManager:
    """
    Manage gradual transition from TF-IDF to hybrid search.
    """

    def __init__(self):
        self.embedding_cache = {}
        self.embedding_model = None

    def enable_embeddings(self):
        """Lazy load embedding model."""
        if self.embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

    async def search(self, query: str, limit: int = 10) -> list[dict]:
        """Search with optional embedding enhancement."""
        tfidf_results = await semantic_search(query=query, limit=limit)

        if self.embedding_model is None:
            return tfidf_results["results"]

        # Enhance with embeddings
        return await self._hybrid_rerank(query, tfidf_results["results"])

    async def index_document(self, doc_id: str, content: str):
        """Index document with optional embedding."""
        if self.embedding_model is not None:
            self.embedding_cache[doc_id] = self.embedding_model.encode(content)

    async def _hybrid_rerank(
        self,
        query: str,
        candidates: list[dict]
    ) -> list[dict]:
        """Rerank candidates using embeddings."""
        query_embedding = self.embedding_model.encode(query)

        for candidate in candidates:
            if candidate["id"] in self.embedding_cache:
                doc_embedding = self.embedding_cache[candidate["id"]]
                similarity = cosine_similarity(query_embedding, doc_embedding)
                candidate["embedding_score"] = similarity
                candidate["hybrid_score"] = (
                    0.4 * candidate["score"] + 0.6 * similarity
                )
            else:
                candidate["hybrid_score"] = candidate["score"]

        candidates.sort(key=lambda x: x.get("hybrid_score", 0), reverse=True)
        return candidates
```

## Performance Considerations

| Metric | TF-IDF Only | Hybrid (Parallel) | Hybrid (Cascade) |
|--------|-------------|-------------------|------------------|
| Indexing | < 1ms/doc | + 50-100ms/doc | + 50-100ms/doc |
| Query (cold) | 10-50ms | 100-500ms | 50-200ms |
| Query (warm) | 10-50ms | 50-200ms | 30-100ms |
| Memory | Minimal | + ~100MB model | + ~100MB model |

## See Also

- `tfidf-search.md` - Deep dive into TF-IDF scoring
- `quickstart.md` - Basic search usage
- `../tools/tfidf_calculator.py` - Standalone TF-IDF implementation
- Related: mem0, agentmemory for full embedding solutions
