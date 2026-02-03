# Hybrid Search: Combining Vector + Full-Text Search

## Purpose

Hybrid search combines the semantic understanding of vector search with the precision of keyword matching. This cookbook covers fusion algorithms, implementation patterns, and optimization strategies for production-grade hybrid retrieval systems.

## Variables

```yaml
# Fusion Parameters
RRF_K: 60                       # Reciprocal Rank Fusion constant
VECTOR_WEIGHT: 0.7              # Default weight for vector results
FTS_WEIGHT: 0.3                 # Default weight for full-text results
RERANK_CANDIDATES: 100          # Candidates to fetch for reranking

# Quality Thresholds
MIN_SIMILARITY: 0.5             # Minimum vector similarity
MIN_BM25_SCORE: 1.0             # Minimum full-text score
FUSION_THRESHOLD: 0.3           # Minimum combined score
```

## Instructions

### Why Hybrid Search?

| Search Type | Strengths | Weaknesses |
|-------------|-----------|------------|
| Vector Only | Semantic similarity, synonyms, concepts | Misses exact keywords, acronyms |
| Full-Text Only | Exact matches, keywords, phrases | No semantic understanding |
| Hybrid | Best of both worlds | More complex, needs tuning |

### When to Use Hybrid Search

```
Use hybrid search when:
- Users search with both concepts and specific terms
- Document corpus has technical jargon or acronyms
- Query patterns vary widely (some conceptual, some keyword-heavy)
- You need high recall AND precision

Stick with vector-only when:
- All queries are conceptual/semantic
- Dataset is small (<10K documents)
- Latency is critical (hybrid adds overhead)

Stick with full-text when:
- Exact keyword matching is sufficient
- Documents are short and keyword-dense
- No embedding infrastructure available
```

## Code Examples

### Fusion Algorithm 1: Reciprocal Rank Fusion (RRF)

```python
"""
Reciprocal Rank Fusion - Simple and effective.
Each result gets a score of 1/(k + rank), summed across result lists.
"""
from typing import List, Dict, Any
from collections import defaultdict


def reciprocal_rank_fusion(
    result_lists: List[List[str]],
    weights: List[float] = None,
    k: int = 60
) -> List[tuple[str, float]]:
    """
    Combine multiple ranked lists using RRF.

    Args:
        result_lists: List of ranked ID lists [[id1, id2...], [id3, id1...]]
        weights: Optional weights for each list (default: equal)
        k: RRF constant (default 60 works well)

    Returns:
        List of (id, score) tuples sorted by score
    """
    if weights is None:
        weights = [1.0] * len(result_lists)

    scores = defaultdict(float)

    for weight, results in zip(weights, result_lists):
        for rank, doc_id in enumerate(results):
            scores[doc_id] += weight * (1.0 / (k + rank + 1))

    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


# Example usage
vector_results = ["doc_a", "doc_b", "doc_c", "doc_d", "doc_e"]
fts_results = ["doc_c", "doc_a", "doc_f", "doc_g", "doc_b"]

combined = reciprocal_rank_fusion(
    [vector_results, fts_results],
    weights=[0.7, 0.3]
)
# [('doc_a', 0.0159), ('doc_c', 0.0154), ('doc_b', 0.0089), ...]
```

### Fusion Algorithm 2: Convex Combination (Score Fusion)

```python
"""
Convex Combination - Directly combines normalized scores.
Requires score normalization since different systems use different scales.
"""
import numpy as np
from typing import List, Dict


def normalize_scores(scores: List[float], method: str = "min_max") -> List[float]:
    """
    Normalize scores to [0, 1] range.

    Args:
        scores: Raw scores
        method: "min_max" or "z_score"
    """
    if not scores:
        return []

    scores = np.array(scores)

    if method == "min_max":
        min_s, max_s = scores.min(), scores.max()
        if max_s == min_s:
            return [0.5] * len(scores)
        return ((scores - min_s) / (max_s - min_s)).tolist()

    elif method == "z_score":
        mean_s, std_s = scores.mean(), scores.std()
        if std_s == 0:
            return [0.5] * len(scores)
        z_scores = (scores - mean_s) / std_s
        # Convert to [0, 1] using sigmoid
        return (1 / (1 + np.exp(-z_scores))).tolist()

    return scores.tolist()


def convex_combination(
    vector_results: List[Dict],  # [{"id": ..., "score": ...}, ...]
    fts_results: List[Dict],
    vector_weight: float = 0.7,
    normalize: bool = True
) -> List[Dict]:
    """
    Combine results using weighted score fusion.

    Args:
        vector_results: Vector search results with scores
        fts_results: Full-text search results with scores
        vector_weight: Weight for vector scores (1 - this for FTS)
        normalize: Whether to normalize scores first

    Returns:
        Combined results sorted by fused score
    """
    fts_weight = 1 - vector_weight

    # Normalize if requested
    if normalize:
        v_scores = normalize_scores([r["score"] for r in vector_results])
        f_scores = normalize_scores([r["score"] for r in fts_results])

        for r, s in zip(vector_results, v_scores):
            r["norm_score"] = s
        for r, s in zip(fts_results, f_scores):
            r["norm_score"] = s
    else:
        for r in vector_results:
            r["norm_score"] = r["score"]
        for r in fts_results:
            r["norm_score"] = r["score"]

    # Build score map
    scores = {}
    data = {}

    for r in vector_results:
        scores[r["id"]] = vector_weight * r["norm_score"]
        data[r["id"]] = r

    for r in fts_results:
        if r["id"] in scores:
            scores[r["id"]] += fts_weight * r["norm_score"]
        else:
            scores[r["id"]] = fts_weight * r["norm_score"]
            data[r["id"]] = r

    # Sort and return
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    return [
        {**data[id_], "combined_score": scores[id_]}
        for id_ in sorted_ids
    ]


# Example
vector_results = [
    {"id": "doc1", "score": 0.95, "content": "..."},
    {"id": "doc2", "score": 0.82, "content": "..."},
]
fts_results = [
    {"id": "doc2", "score": 15.3, "content": "..."},  # BM25 score
    {"id": "doc3", "score": 12.1, "content": "..."},
]

combined = convex_combination(vector_results, fts_results, vector_weight=0.6)
```

### Fusion Algorithm 3: Distribution-Based Combination (DBSF)

```python
"""
Distribution-Based Score Fusion - More sophisticated normalization.
Uses the score distribution statistics for better calibration.
"""
import numpy as np
from typing import List, Dict
from scipy import stats


def distribution_based_fusion(
    vector_results: List[Dict],
    fts_results: List[Dict],
    vector_weight: float = 0.7,
    target_mean: float = 0.5,
    target_std: float = 0.2
) -> List[Dict]:
    """
    Fuse results by mapping score distributions to a common target.

    Args:
        vector_results: Vector search results
        fts_results: Full-text search results
        vector_weight: Weight for vector scores
        target_mean: Target mean for normalized scores
        target_std: Target std for normalized scores

    Returns:
        Combined results with calibrated scores
    """
    def calibrate_scores(results: List[Dict]) -> List[Dict]:
        if not results:
            return results

        scores = np.array([r["score"] for r in results])
        mean, std = scores.mean(), scores.std()

        if std == 0:
            calibrated = np.full_like(scores, target_mean)
        else:
            # Z-score then map to target distribution
            z_scores = (scores - mean) / std
            calibrated = z_scores * target_std + target_mean

        # Clip to [0, 1]
        calibrated = np.clip(calibrated, 0, 1)

        for r, s in zip(results, calibrated):
            r["calibrated_score"] = float(s)

        return results

    # Calibrate both result sets
    vector_results = calibrate_scores(vector_results)
    fts_results = calibrate_scores(fts_results)

    # Combine
    fts_weight = 1 - vector_weight
    scores = {}
    data = {}

    for r in vector_results:
        scores[r["id"]] = vector_weight * r["calibrated_score"]
        data[r["id"]] = r

    for r in fts_results:
        if r["id"] in scores:
            scores[r["id"]] += fts_weight * r["calibrated_score"]
        else:
            scores[r["id"]] = fts_weight * r["calibrated_score"]
            data[r["id"]] = r

    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    return [
        {**data[id_], "fused_score": scores[id_]}
        for id_ in sorted_ids
    ]
```

### Production Implementation: ChromaDB + FTS5

```python
"""
Complete hybrid search implementation with ChromaDB vectors and SQLite FTS5.
"""
import chromadb
import sqlite3
from typing import List, Dict, Optional
from collections import defaultdict


class HybridSearchEngine:
    """Production-ready hybrid search with ChromaDB and SQLite FTS5."""

    def __init__(
        self,
        chroma_path: str,
        sqlite_path: str,
        collection_name: str = "documents",
        embedding_function=None
    ):
        # Vector store
        self.chroma_client = chromadb.PersistentClient(path=chroma_path)
        self.collection = self.chroma_client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_function,
            metadata={"hnsw:space": "cosine"}
        )

        # Full-text store
        self.sqlite_conn = sqlite3.connect(sqlite_path)
        self._setup_fts()

    def _setup_fts(self):
        """Initialize FTS5 tables."""
        self.sqlite_conn.executescript("""
            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts
            USING fts5(
                id UNINDEXED,
                content,
                tokenize='porter unicode61'
            );

            CREATE TABLE IF NOT EXISTS document_metadata (
                id TEXT PRIMARY KEY,
                metadata TEXT
            );
        """)
        self.sqlite_conn.commit()

    def add(
        self,
        ids: List[str],
        documents: List[str],
        metadatas: List[Dict] = None
    ):
        """Add documents to both vector and FTS indexes."""
        if metadatas is None:
            metadatas = [{} for _ in ids]

        # Add to ChromaDB
        self.collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

        # Add to FTS5
        cursor = self.sqlite_conn.cursor()
        for id_, doc, metadata in zip(ids, documents, metadatas):
            cursor.execute(
                "INSERT OR REPLACE INTO documents_fts (id, content) VALUES (?, ?)",
                (id_, doc)
            )
            cursor.execute(
                "INSERT OR REPLACE INTO document_metadata (id, metadata) VALUES (?, ?)",
                (id_, str(metadata))
            )

        self.sqlite_conn.commit()

    def search(
        self,
        query: str,
        k: int = 10,
        vector_weight: float = 0.7,
        metadata_filter: Dict = None,
        min_score: float = 0.0,
        fetch_multiplier: int = 3
    ) -> List[Dict]:
        """
        Perform hybrid search with RRF fusion.

        Args:
            query: Search query text
            k: Number of results to return
            vector_weight: Weight for vector results (0-1)
            metadata_filter: Optional ChromaDB metadata filter
            min_score: Minimum combined score threshold
            fetch_multiplier: How many more results to fetch for fusion

        Returns:
            List of result dictionaries with combined scores
        """
        fetch_k = k * fetch_multiplier

        # Vector search
        vector_results = self.collection.query(
            query_texts=[query],
            n_results=fetch_k,
            where=metadata_filter,
            include=["documents", "metadatas", "distances"]
        )

        # Full-text search
        fts_results = self.sqlite_conn.execute("""
            SELECT id, content, rank
            FROM documents_fts
            WHERE documents_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, fetch_k)).fetchall()

        # RRF fusion
        rrf_k = 60
        scores = defaultdict(float)
        doc_data = {}

        # Process vector results
        if vector_results["ids"][0]:
            for i, (id_, doc, meta, dist) in enumerate(zip(
                vector_results["ids"][0],
                vector_results["documents"][0],
                vector_results["metadatas"][0],
                vector_results["distances"][0]
            )):
                scores[id_] += vector_weight / (rrf_k + i + 1)
                doc_data[id_] = {
                    "id": id_,
                    "content": doc,
                    "metadata": meta,
                    "vector_distance": dist,
                    "vector_rank": i + 1
                }

        # Process FTS results
        fts_weight = 1 - vector_weight
        for i, (id_, content, rank) in enumerate(fts_results):
            scores[id_] += fts_weight / (rrf_k + i + 1)
            if id_ not in doc_data:
                # Fetch metadata from sqlite
                meta_row = self.sqlite_conn.execute(
                    "SELECT metadata FROM document_metadata WHERE id = ?",
                    (id_,)
                ).fetchone()
                doc_data[id_] = {
                    "id": id_,
                    "content": content,
                    "metadata": eval(meta_row[0]) if meta_row else {},
                    "fts_rank": i + 1
                }
            else:
                doc_data[id_]["fts_rank"] = i + 1

        # Sort and filter
        sorted_results = sorted(
            scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        results = []
        for id_, score in sorted_results[:k]:
            if score >= min_score:
                result = doc_data[id_]
                result["hybrid_score"] = score
                results.append(result)

        return results

    def explain_search(
        self,
        query: str,
        k: int = 5,
        vector_weight: float = 0.7
    ) -> Dict:
        """
        Search with detailed explanation of ranking.
        Useful for debugging and tuning.
        """
        fetch_k = k * 5

        # Get raw results
        vector_results = self.collection.query(
            query_texts=[query],
            n_results=fetch_k,
            include=["documents", "distances"]
        )

        fts_results = self.sqlite_conn.execute("""
            SELECT id, content, rank, bm25(documents_fts) as bm25_score
            FROM documents_fts
            WHERE documents_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, fetch_k)).fetchall()

        return {
            "query": query,
            "vector_results": [
                {"id": id_, "distance": dist, "rank": i + 1}
                for i, (id_, dist) in enumerate(zip(
                    vector_results["ids"][0],
                    vector_results["distances"][0]
                ))
            ][:10],
            "fts_results": [
                {"id": id_, "bm25": bm25, "rank": i + 1}
                for i, (id_, _, _, bm25) in enumerate(fts_results)
            ][:10],
            "fusion_weights": {
                "vector": vector_weight,
                "fts": 1 - vector_weight
            }
        }


# Usage
engine = HybridSearchEngine(
    chroma_path="./chroma_db",
    sqlite_path="./fts.db"
)

# Add documents
engine.add(
    ids=["d1", "d2", "d3"],
    documents=[
        "Machine learning enables pattern recognition in data",
        "SQL databases use structured query language",
        "Neural networks are inspired by biological neurons"
    ],
    metadatas=[
        {"topic": "ml"},
        {"topic": "database"},
        {"topic": "ml"}
    ]
)

# Search
results = engine.search(
    query="how do neural networks learn patterns",
    k=5,
    vector_weight=0.65,
    metadata_filter={"topic": "ml"}
)

# Debug search
explanation = engine.explain_search(
    query="how do neural networks learn patterns",
    vector_weight=0.65
)
```

### Production Implementation: pgvector Hybrid

```sql
-- PostgreSQL hybrid search function using pgvector + tsvector

-- Create the hybrid search function
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(384),
    match_count INT DEFAULT 10,
    vector_weight FLOAT DEFAULT 0.7,
    full_text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id TEXT,
    content TEXT,
    metadata JSONB,
    vector_score FLOAT,
    fts_score FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            d.id,
            d.content,
            d.metadata,
            1 - (d.embedding <=> query_embedding) as v_score,
            ROW_NUMBER() OVER (ORDER BY d.embedding <=> query_embedding) as v_rank
        FROM documents d
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count * 3
    ),
    fts_results AS (
        SELECT
            d.id,
            d.content,
            d.metadata,
            ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', query_text)) as f_score,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', query_text)) DESC) as f_rank
        FROM documents d
        WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
        LIMIT match_count * 3
    ),
    combined AS (
        SELECT
            COALESCE(v.id, f.id) as id,
            COALESCE(v.content, f.content) as content,
            COALESCE(v.metadata, f.metadata) as metadata,
            COALESCE(v.v_score, 0) as vector_score,
            COALESCE(f.f_score, 0) as fts_score,
            -- RRF fusion
            (vector_weight / (60 + COALESCE(v.v_rank, 1000))) +
            (full_text_weight / (60 + COALESCE(f.f_rank, 1000))) as combined_score
        FROM vector_results v
        FULL OUTER JOIN fts_results f ON v.id = f.id
    )
    SELECT *
    FROM combined
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- Usage
SELECT * FROM hybrid_search(
    'machine learning neural networks',
    '[0.1, 0.2, ...]'::vector,
    10,
    0.7,
    0.3
);
```

## Performance Characteristics

### Latency Comparison

| Method | Latency (100K docs) | Notes |
|--------|---------------------|-------|
| Vector only | 10-50ms | Depends on index type |
| FTS only | 5-20ms | With proper indexing |
| Hybrid (sequential) | 20-80ms | Sum of both |
| Hybrid (parallel) | 15-60ms | Max of both + fusion |

### Fusion Overhead

```
RRF (k results): O(k) - Very fast
Convex Combination: O(k) - Very fast
Reranking (cross-encoder): O(k * model_latency) - Can be slow

Recommendation: Use RRF for most cases, add reranking only when quality is critical
```

### Quality Metrics

```
Typical improvements from hybrid over vector-only:
- Recall@10: +5-15%
- MRR: +3-10%
- NDCG: +5-12%

Best improvements seen when:
- Queries contain specific technical terms
- Documents have distinct keyword signatures
- Query distribution is heterogeneous
```

## When to Use This Pattern

**Hybrid search excels at:**
- RAG systems where precision matters
- Technical documentation search
- E-commerce product search
- Enterprise knowledge bases
- Mixed query patterns (some conceptual, some keyword)

**Vector-only is sufficient when:**
- All queries are semantic/conceptual
- Dataset is highly homogeneous
- Latency is critical
- Implementation simplicity is priority

**Full-text-only is sufficient when:**
- Exact keyword matching is primary need
- No embedding infrastructure
- Documents are short and keyword-dense

## Tuning Guidelines

### Weight Selection

```python
def tune_weights(
    queries: List[str],
    ground_truth: List[List[str]],  # Correct results for each query
    search_fn,
    weight_range=(0.3, 0.9),
    steps=7
) -> float:
    """
    Find optimal vector weight via grid search.
    """
    import numpy as np

    best_weight = 0.5
    best_mrr = 0

    for weight in np.linspace(weight_range[0], weight_range[1], steps):
        mrrs = []
        for query, truth in zip(queries, ground_truth):
            results = search_fn(query, vector_weight=weight)
            result_ids = [r["id"] for r in results]

            # Calculate MRR
            for i, id_ in enumerate(result_ids):
                if id_ in truth:
                    mrrs.append(1 / (i + 1))
                    break
            else:
                mrrs.append(0)

        avg_mrr = sum(mrrs) / len(mrrs)
        if avg_mrr > best_mrr:
            best_mrr = avg_mrr
            best_weight = weight

    return best_weight

# Usage
# best = tune_weights(eval_queries, ground_truth, engine.search)
# print(f"Optimal vector weight: {best}")
```

### Query-Adaptive Weights

```python
def adaptive_weight(query: str) -> float:
    """
    Adjust weights based on query characteristics.
    """
    # Short queries (1-2 words) benefit more from FTS
    word_count = len(query.split())
    if word_count <= 2:
        return 0.4  # More FTS weight

    # Queries with technical terms benefit from FTS
    technical_indicators = ["api", "error", "function", "class", "method"]
    if any(term in query.lower() for term in technical_indicators):
        return 0.5  # Balanced

    # Long conceptual queries benefit from vectors
    if word_count > 5:
        return 0.8  # More vector weight

    return 0.7  # Default
```

## Related Cookbooks

- `quickstart.md` - Getting started basics
- `chromadb.md` - Vector store setup
- `pgvector.md` - PostgreSQL hybrid patterns
- `metadata-filtering.md` - Adding metadata to hybrid search
