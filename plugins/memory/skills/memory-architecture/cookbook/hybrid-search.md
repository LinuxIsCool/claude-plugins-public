# Purpose

Combine semantic vector search with keyword-based retrieval to achieve superior memory recall. Pure semantic search misses exact matches and rare terms; pure keyword search misses conceptual similarity. Hybrid search leverages the strengths of both approaches through intelligent score fusion.

## Variables

```yaml
# Search Configuration
HYBRID_CONFIG:
  semantic_weight: 0.6
  keyword_weight: 0.4
  recency_weight: 0.3
  importance_weight: 0.25
  access_pattern_weight: 0.15

# Thresholds
SEMANTIC_THRESHOLD: 0.35
KEYWORD_THRESHOLD: 0.1
COMBINED_THRESHOLD: 0.4

# Embedding Settings
EMBEDDING_MODEL: "text-embedding-3-small"
EMBEDDING_DIMENSIONS: 1536

# Keyword Search Settings
FTS_TOKENIZER: "porter unicode61"
BM25_K1: 1.2
BM25_B: 0.75

# Result Limits
MAX_SEMANTIC_RESULTS: 20
MAX_KEYWORD_RESULTS: 20
FINAL_RESULTS_LIMIT: 10
```

## Instructions

### 1. Understand When Each Approach Excels

| Query Type | Semantic Wins | Keyword Wins |
|------------|--------------|--------------|
| Conceptual | "How do I handle authentication?" | |
| Exact term | | "MemoryTierManager class" |
| Synonym-rich | "store user preferences" | |
| Technical names | | "UserPromptSubmit hook" |
| Natural language | "What did we discuss yesterday?" | |
| Code identifiers | | "calculate_recency_weight" |

Hybrid search captures both patterns by combining scores.

### 2. Implement the Semantic Search Component

```python
import numpy as np
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass
import sqlite3
from pathlib import Path
import struct


@dataclass
class SearchResult:
    """Unified search result from any method."""
    content: str
    score: float
    source: str  # "semantic", "keyword", or "hybrid"
    metadata: Dict[str, Any]

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "score": self.score,
            "source": self.source,
            "metadata": self.metadata
        }


class SemanticSearcher:
    """Vector similarity search using embeddings."""

    def __init__(self, db_path: Path, threshold: float = 0.35):
        self.db_path = db_path
        self.threshold = threshold

    def search(self, query_embedding: np.ndarray,
               limit: int = 20) -> List[SearchResult]:
        """Search by embedding similarity."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "SELECT id, content, embedding, importance, timestamp, metadata FROM memories"
        )

        results = []
        for row in cursor.fetchall():
            mem_id, content, emb_blob, importance, timestamp, metadata = row

            # Deserialize embedding
            embedding = self._deserialize(emb_blob)

            # Calculate cosine similarity
            similarity = self._cosine_similarity(query_embedding, embedding)

            if similarity >= self.threshold:
                results.append(SearchResult(
                    content=content,
                    score=similarity,
                    source="semantic",
                    metadata={
                        "id": mem_id,
                        "importance": importance,
                        "timestamp": timestamp,
                        "raw_metadata": metadata
                    }
                ))

        conn.close()

        # Sort by score and limit
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between vectors."""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def _deserialize(self, blob: bytes) -> np.ndarray:
        """Deserialize bytes to numpy array."""
        n = len(blob) // 4
        return np.array(struct.unpack(f'{n}f', blob))


class SemanticIndexer:
    """Build and maintain semantic index."""

    def __init__(self, db_path: Path, embedding_fn):
        self.db_path = db_path
        self.get_embedding = embedding_fn
        self._init_db()

    def _init_db(self) -> None:
        """Initialize database schema."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                importance REAL DEFAULT 0.5,
                timestamp TEXT NOT NULL,
                metadata TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON memories(timestamp)")
        conn.commit()
        conn.close()

    def index(self, content: str, importance: float = 0.5,
              timestamp: str = None, metadata: dict = None) -> int:
        """Index new content with embedding."""
        from datetime import datetime
        import json

        embedding = self.get_embedding(content)
        ts = timestamp or datetime.now().isoformat()

        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            """INSERT INTO memories (content, embedding, importance, timestamp, metadata)
               VALUES (?, ?, ?, ?, ?)""",
            (
                content,
                self._serialize(embedding),
                importance,
                ts,
                json.dumps(metadata) if metadata else None
            )
        )
        mem_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return mem_id

    def _serialize(self, embedding: np.ndarray) -> bytes:
        """Serialize numpy array to bytes."""
        return struct.pack(f'{len(embedding)}f', *embedding.tolist())
```

### 3. Implement the Keyword Search Component

```python
class KeywordSearcher:
    """BM25/FTS5 keyword search."""

    def __init__(self, db_path: Path, threshold: float = 0.1):
        self.db_path = db_path
        self.threshold = threshold
        self._init_fts()

    def _init_fts(self) -> None:
        """Initialize FTS5 virtual table."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                content,
                importance,
                timestamp,
                mem_id UNINDEXED,
                tokenize='porter unicode61'
            )
        """)
        conn.commit()
        conn.close()

    def search(self, query: str, limit: int = 20) -> List[SearchResult]:
        """Search using BM25 ranking."""
        # Escape special FTS characters
        safe_query = self._escape_query(query)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            """
            SELECT content, importance, timestamp, mem_id, bm25(memories_fts) as score
            FROM memories_fts
            WHERE memories_fts MATCH ?
            ORDER BY bm25(memories_fts)
            LIMIT ?
            """,
            (safe_query, limit)
        )

        results = []
        for row in cursor.fetchall():
            content, importance, timestamp, mem_id, bm25_score = row

            # BM25 returns negative scores (closer to 0 is better)
            # Normalize to 0-1 range
            normalized_score = self._normalize_bm25(bm25_score)

            if normalized_score >= self.threshold:
                results.append(SearchResult(
                    content=content,
                    score=normalized_score,
                    source="keyword",
                    metadata={
                        "id": mem_id,
                        "importance": float(importance) if importance else 0.5,
                        "timestamp": timestamp,
                        "bm25_raw": bm25_score
                    }
                ))

        conn.close()
        return results

    def _escape_query(self, query: str) -> str:
        """Escape special FTS5 characters."""
        # FTS5 special characters: AND OR NOT ( ) * "
        # Convert to simple query
        words = query.split()
        # Quote each word to treat as literal
        return " ".join(f'"{w}"' for w in words if len(w) > 2)

    def _normalize_bm25(self, score: float) -> float:
        """Normalize BM25 score to 0-1 range."""
        # BM25 scores are typically negative in SQLite FTS5
        # More negative = better match
        # Typical range: -20 (excellent) to 0 (poor)
        if score >= 0:
            return 0.0
        # Map -20 to 0 -> 1.0 to 0.0
        normalized = min(1.0, abs(score) / 20.0)
        return normalized


class KeywordIndexer:
    """Maintain FTS5 index synchronized with semantic index."""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def index(self, content: str, importance: float, timestamp: str,
              mem_id: int) -> None:
        """Add content to FTS index."""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO memories_fts (content, importance, timestamp, mem_id) VALUES (?, ?, ?, ?)",
            (content, str(importance), timestamp, mem_id)
        )
        conn.commit()
        conn.close()

    def delete(self, mem_id: int) -> None:
        """Remove content from FTS index."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("DELETE FROM memories_fts WHERE mem_id = ?", (mem_id,))
        conn.commit()
        conn.close()
```

### 4. Implement Score Fusion

```python
from enum import Enum


class FusionMethod(Enum):
    """Score fusion strategies."""
    WEIGHTED_SUM = "weighted_sum"
    RECIPROCAL_RANK = "reciprocal_rank"
    CONVEX_COMBINATION = "convex_combination"
    MAX_SCORE = "max_score"


class ScoreFusion:
    """Fuse scores from multiple retrieval methods."""

    def __init__(self,
                 semantic_weight: float = 0.6,
                 keyword_weight: float = 0.4,
                 method: FusionMethod = FusionMethod.WEIGHTED_SUM):
        self.semantic_weight = semantic_weight
        self.keyword_weight = keyword_weight
        self.method = method

    def fuse(self, semantic_results: List[SearchResult],
             keyword_results: List[SearchResult]) -> List[SearchResult]:
        """Fuse results from semantic and keyword search."""

        if self.method == FusionMethod.WEIGHTED_SUM:
            return self._weighted_sum_fusion(semantic_results, keyword_results)
        elif self.method == FusionMethod.RECIPROCAL_RANK:
            return self._rrf_fusion(semantic_results, keyword_results)
        elif self.method == FusionMethod.CONVEX_COMBINATION:
            return self._convex_fusion(semantic_results, keyword_results)
        elif self.method == FusionMethod.MAX_SCORE:
            return self._max_fusion(semantic_results, keyword_results)
        else:
            return self._weighted_sum_fusion(semantic_results, keyword_results)

    def _weighted_sum_fusion(self, semantic: List[SearchResult],
                             keyword: List[SearchResult]) -> List[SearchResult]:
        """Weighted sum of normalized scores."""
        # Build content -> results mapping
        content_scores = {}

        for result in semantic:
            key = result.content[:200]  # Use prefix as key
            if key not in content_scores:
                content_scores[key] = {"semantic": 0, "keyword": 0, "result": result}
            content_scores[key]["semantic"] = result.score

        for result in keyword:
            key = result.content[:200]
            if key not in content_scores:
                content_scores[key] = {"semantic": 0, "keyword": 0, "result": result}
            content_scores[key]["keyword"] = result.score

        # Calculate fused scores
        fused_results = []
        for key, scores in content_scores.items():
            fused_score = (
                scores["semantic"] * self.semantic_weight +
                scores["keyword"] * self.keyword_weight
            )

            result = scores["result"]
            fused_results.append(SearchResult(
                content=result.content,
                score=fused_score,
                source="hybrid",
                metadata={
                    **result.metadata,
                    "semantic_score": scores["semantic"],
                    "keyword_score": scores["keyword"],
                    "fusion_method": "weighted_sum"
                }
            ))

        fused_results.sort(key=lambda x: x.score, reverse=True)
        return fused_results

    def _rrf_fusion(self, semantic: List[SearchResult],
                    keyword: List[SearchResult]) -> List[SearchResult]:
        """Reciprocal Rank Fusion (RRF)."""
        k = 60  # RRF constant

        content_rrf = {}

        # Calculate RRF scores from semantic ranks
        for rank, result in enumerate(semantic, 1):
            key = result.content[:200]
            if key not in content_rrf:
                content_rrf[key] = {"score": 0, "result": result}
            content_rrf[key]["score"] += self.semantic_weight / (k + rank)

        # Add RRF scores from keyword ranks
        for rank, result in enumerate(keyword, 1):
            key = result.content[:200]
            if key not in content_rrf:
                content_rrf[key] = {"score": 0, "result": result}
            content_rrf[key]["score"] += self.keyword_weight / (k + rank)

        fused_results = []
        for key, data in content_rrf.items():
            fused_results.append(SearchResult(
                content=data["result"].content,
                score=data["score"],
                source="hybrid",
                metadata={
                    **data["result"].metadata,
                    "fusion_method": "rrf"
                }
            ))

        fused_results.sort(key=lambda x: x.score, reverse=True)
        return fused_results

    def _convex_fusion(self, semantic: List[SearchResult],
                       keyword: List[SearchResult]) -> List[SearchResult]:
        """Convex combination with dynamic weighting."""
        # Calculate query-specific weights based on result quality
        sem_quality = np.mean([r.score for r in semantic]) if semantic else 0
        kw_quality = np.mean([r.score for r in keyword]) if keyword else 0

        total_quality = sem_quality + kw_quality
        if total_quality == 0:
            return []

        # Adjust weights based on which method performed better
        adjusted_sem = self.semantic_weight * (sem_quality / total_quality)
        adjusted_kw = self.keyword_weight * (kw_quality / total_quality)

        # Normalize
        total_weight = adjusted_sem + adjusted_kw
        adjusted_sem /= total_weight
        adjusted_kw /= total_weight

        # Reuse weighted sum with adjusted weights
        original_sem = self.semantic_weight
        original_kw = self.keyword_weight

        self.semantic_weight = adjusted_sem
        self.keyword_weight = adjusted_kw

        result = self._weighted_sum_fusion(semantic, keyword)

        # Restore original weights
        self.semantic_weight = original_sem
        self.keyword_weight = original_kw

        return result

    def _max_fusion(self, semantic: List[SearchResult],
                    keyword: List[SearchResult]) -> List[SearchResult]:
        """Take maximum score from either method."""
        content_max = {}

        for result in semantic:
            key = result.content[:200]
            if key not in content_max or result.score > content_max[key]["score"]:
                content_max[key] = {"score": result.score, "result": result}

        for result in keyword:
            key = result.content[:200]
            if key not in content_max or result.score > content_max[key]["score"]:
                content_max[key] = {"score": result.score, "result": result}

        fused_results = [
            SearchResult(
                content=data["result"].content,
                score=data["score"],
                source="hybrid",
                metadata={**data["result"].metadata, "fusion_method": "max"}
            )
            for data in content_max.values()
        ]

        fused_results.sort(key=lambda x: x.score, reverse=True)
        return fused_results
```

### 5. Add Recency and Importance Boosting

```python
from datetime import datetime, timedelta
import math


class ScoreBooster:
    """Apply recency, importance, and access pattern boosts."""

    def __init__(self,
                 recency_weight: float = 0.3,
                 importance_weight: float = 0.25,
                 access_weight: float = 0.15,
                 recency_decay_days: int = 30):
        self.recency_weight = recency_weight
        self.importance_weight = importance_weight
        self.access_weight = access_weight
        self.decay_days = recency_decay_days

    def boost(self, results: List[SearchResult]) -> List[SearchResult]:
        """Apply boosts to search results."""
        boosted = []

        for result in results:
            base_score = result.score
            metadata = result.metadata

            # Calculate boost factors
            recency_boost = self._recency_factor(metadata.get("timestamp"))
            importance_boost = metadata.get("importance", 0.5)
            access_boost = self._access_factor(metadata.get("access_count", 0))

            # Calculate final score
            final_score = (
                base_score * (1 - self.recency_weight - self.importance_weight - self.access_weight) +
                recency_boost * self.recency_weight +
                importance_boost * self.importance_weight +
                access_boost * self.access_weight
            )

            boosted.append(SearchResult(
                content=result.content,
                score=final_score,
                source=result.source,
                metadata={
                    **metadata,
                    "base_score": base_score,
                    "recency_boost": recency_boost,
                    "importance_boost": importance_boost,
                    "access_boost": access_boost
                }
            ))

        boosted.sort(key=lambda x: x.score, reverse=True)
        return boosted

    def _recency_factor(self, timestamp: str) -> float:
        """Calculate recency factor with exponential decay."""
        if not timestamp:
            return 0.5

        try:
            ts = datetime.fromisoformat(timestamp)
            age_days = (datetime.now() - ts).days
            decay_rate = 1.0 / self.decay_days
            return math.exp(-decay_rate * age_days)
        except:
            return 0.5

    def _access_factor(self, access_count: int) -> float:
        """Calculate access pattern factor."""
        # Logarithmic scaling for access count
        if access_count <= 0:
            return 0.0
        return min(1.0, math.log1p(access_count) / 5)
```

### 6. Complete Hybrid Search Implementation

```python
class HybridSearcher:
    """Complete hybrid search combining semantic and keyword retrieval."""

    def __init__(self,
                 semantic_db: Path,
                 keyword_db: Path,
                 embedding_fn,
                 config: dict = None):
        config = config or {}

        self.semantic = SemanticSearcher(
            semantic_db,
            threshold=config.get("semantic_threshold", 0.35)
        )
        self.keyword = KeywordSearcher(
            keyword_db,
            threshold=config.get("keyword_threshold", 0.1)
        )
        self.fusion = ScoreFusion(
            semantic_weight=config.get("semantic_weight", 0.6),
            keyword_weight=config.get("keyword_weight", 0.4),
            method=FusionMethod(config.get("fusion_method", "weighted_sum"))
        )
        self.booster = ScoreBooster(
            recency_weight=config.get("recency_weight", 0.3),
            importance_weight=config.get("importance_weight", 0.25),
            access_weight=config.get("access_weight", 0.15)
        )

        self.get_embedding = embedding_fn
        self.final_threshold = config.get("combined_threshold", 0.4)

    def search(self, query: str, limit: int = 10) -> List[SearchResult]:
        """Perform hybrid search."""
        # Get query embedding
        query_embedding = self.get_embedding(query)

        # Run both searches in parallel (conceptually)
        semantic_results = self.semantic.search(query_embedding, limit=20)
        keyword_results = self.keyword.search(query, limit=20)

        # Fuse results
        fused = self.fusion.fuse(semantic_results, keyword_results)

        # Apply boosts
        boosted = self.booster.boost(fused)

        # Filter by threshold and limit
        filtered = [r for r in boosted if r.score >= self.final_threshold]

        return filtered[:limit]

    def explain_search(self, query: str, limit: int = 5) -> dict:
        """Search with detailed explanation of scoring."""
        query_embedding = self.get_embedding(query)

        semantic_results = self.semantic.search(query_embedding, limit=10)
        keyword_results = self.keyword.search(query, limit=10)
        fused = self.fusion.fuse(semantic_results, keyword_results)
        boosted = self.booster.boost(fused)

        return {
            "query": query,
            "semantic_matches": len(semantic_results),
            "keyword_matches": len(keyword_results),
            "fused_results": len(fused),
            "top_results": [
                {
                    "content_preview": r.content[:100],
                    "final_score": r.score,
                    "semantic_score": r.metadata.get("semantic_score", 0),
                    "keyword_score": r.metadata.get("keyword_score", 0),
                    "recency_boost": r.metadata.get("recency_boost", 0),
                    "importance_boost": r.metadata.get("importance_boost", 0)
                }
                for r in boosted[:limit]
            ]
        }
```

## When to Use This Pattern

Use hybrid search when:

- **Queries mix conceptual and exact terms** - "How does the UserPromptSubmit hook work?"
- **Code and natural language are both searchable** - Technical documentation
- **Recall is critical** - Cannot miss relevant memories
- **Query patterns are unpredictable** - Users search in different styles

Avoid when:

- **Purely semantic queries** - Embeddings alone suffice
- **Exact match requirements** - Database lookups are more appropriate
- **Extreme latency constraints** - Hybrid adds overhead
- **Index size is tiny** - Overhead not justified

## Trade-offs and Considerations

### Performance Characteristics

| Method | Latency | Index Size | Query Types |
|--------|---------|------------|-------------|
| Semantic only | 20-50ms | Large (embeddings) | Conceptual |
| Keyword only | 5-20ms | Medium (inverted index) | Exact terms |
| Hybrid | 30-70ms | Both | All types |

### Weight Tuning Guidelines

| Scenario | Semantic | Keyword | Notes |
|----------|----------|---------|-------|
| Natural language heavy | 0.7 | 0.3 | Default for conversation |
| Code search | 0.4 | 0.6 | Identifiers matter |
| Mixed content | 0.6 | 0.4 | Balanced default |
| Technical docs | 0.5 | 0.5 | Equal importance |

### Fusion Method Selection

| Method | When to Use |
|--------|-------------|
| Weighted Sum | General purpose, interpretable |
| RRF | When absolute scores unreliable |
| Convex | Adaptive to query quality |
| Max | When one method dominates |

### Common Pitfalls

1. **Score Range Mismatch**: Ensure scores are normalized before fusion
2. **Threshold Too High**: Misses good results from one method
3. **Threshold Too Low**: Returns noise
4. **Embedding Quality**: Poor embeddings torpedo semantic search
5. **Tokenization Issues**: FTS5 tokenizer affects keyword matches
