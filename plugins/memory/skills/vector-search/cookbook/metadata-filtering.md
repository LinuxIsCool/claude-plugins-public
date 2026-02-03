# Advanced Metadata Filtering

## Purpose

Metadata filtering combines vector similarity search with structured query predicates, enabling precise retrieval based on attributes like timestamps, categories, permissions, and custom tags. This cookbook covers filter syntax across databases, optimization strategies, and production patterns.

## Variables

```yaml
# Common Metadata Fields
STANDARD_FIELDS:
  - source: str        # Origin of document
  - category: str      # Classification
  - timestamp: int     # Unix timestamp
  - user_id: str       # Owner/creator
  - tags: list[str]    # Labels (stored as JSON string in some DBs)
  - priority: int      # Importance level
  - active: bool       # Status flag

# Filter Performance
PRE_FILTER_THRESHOLD: 0.1    # Filter before vector search if <10% pass
POST_FILTER_THRESHOLD: 0.9   # Filter after vector search if >90% pass
```

## Instructions

### Filter Strategy Selection

```
Pre-filtering (filter then vector search):
  - Pros: Reduces vector search space, faster for selective filters
  - Cons: May miss semantically similar results outside filter
  - Use when: Filter eliminates >50% of documents

Post-filtering (vector search then filter):
  - Pros: Finds best semantic matches first
  - Cons: May return fewer results than requested
  - Use when: Filter is loose or quality is paramount

Hybrid (database-dependent):
  - Most modern vector DBs use smart query planners
  - Let the database decide based on filter selectivity
```

### Metadata Schema Design

```python
# Good: Flat, typed fields
metadata = {
    "source": "chat",           # String for exact match
    "timestamp": 1705123456,    # Integer for range queries
    "priority": 2,              # Integer for comparison
    "active": True,             # Boolean for flags
    "tags": '["work", "urgent"]'  # JSON string for lists
}

# Avoid: Nested objects (most vector DBs don't support)
metadata = {
    "user": {"name": "Alice", "role": "admin"},  # Won't work in ChromaDB
    "dates": {"created": "...", "modified": "..."}  # Flatten instead
}

# Flattened version
metadata = {
    "user_name": "Alice",
    "user_role": "admin",
    "date_created": 1705123456,
    "date_modified": 1705200000
}
```

## Code Examples

### ChromaDB Filter Syntax

```python
"""
ChromaDB supports $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin
and logical operators $and, $or.
"""
import chromadb

client = chromadb.PersistentClient(path="./db")
collection = client.get_or_create_collection("documents")

# Add documents with metadata
collection.add(
    documents=["Doc 1", "Doc 2", "Doc 3", "Doc 4"],
    ids=["d1", "d2", "d3", "d4"],
    metadatas=[
        {"source": "chat", "priority": 1, "timestamp": 1705000000, "active": True},
        {"source": "email", "priority": 2, "timestamp": 1705100000, "active": True},
        {"source": "chat", "priority": 3, "timestamp": 1705200000, "active": False},
        {"source": "file", "priority": 1, "timestamp": 1705300000, "active": True}
    ]
)

# Simple equality filter
results = collection.query(
    query_texts=["find important documents"],
    n_results=5,
    where={"source": "chat"}
)

# Comparison operators
results = collection.query(
    query_texts=["recent updates"],
    n_results=5,
    where={"timestamp": {"$gt": 1705100000}}  # After timestamp
)

# Multiple conditions with $and
results = collection.query(
    query_texts=["active chat messages"],
    n_results=5,
    where={
        "$and": [
            {"source": "chat"},
            {"active": True}
        ]
    }
)

# $or conditions
results = collection.query(
    query_texts=["important items"],
    n_results=5,
    where={
        "$or": [
            {"priority": {"$lte": 2}},
            {"source": "email"}
        ]
    }
)

# $in for multiple values
results = collection.query(
    query_texts=["messages"],
    n_results=5,
    where={
        "source": {"$in": ["chat", "email"]}
    }
)

# Complex nested conditions
results = collection.query(
    query_texts=["find documents"],
    n_results=10,
    where={
        "$and": [
            {"active": True},
            {
                "$or": [
                    {"priority": {"$lte": 2}},
                    {"source": "chat"}
                ]
            },
            {"timestamp": {"$gte": 1705000000}}
        ]
    }
)

# Filter on document content (where_document)
results = collection.query(
    query_texts=["machine learning"],
    n_results=5,
    where={"source": "tutorial"},
    where_document={"$contains": "neural"}  # Document must contain "neural"
)
```

### Qdrant Filter Syntax

```python
"""
Qdrant has rich filtering with nested conditions and geo queries.
"""
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Filter, FieldCondition, MatchValue, MatchAny,
    Range, IsEmpty, IsNull, HasId,
    PointStruct, VectorParams, Distance
)

client = QdrantClient(path="./qdrant_db")

# Create collection
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
)

# Add points with payload (metadata)
client.upsert(
    collection_name="documents",
    points=[
        PointStruct(
            id=1,
            vector=[0.1] * 384,
            payload={
                "source": "chat",
                "priority": 1,
                "timestamp": 1705000000,
                "tags": ["work", "urgent"],
                "user": {"name": "Alice", "role": "admin"}  # Nested supported!
            }
        ),
        # ... more points
    ]
)

# Simple match
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must=[
            FieldCondition(key="source", match=MatchValue(value="chat"))
        ]
    ),
    limit=10
)

# Match any from list
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must=[
            FieldCondition(key="source", match=MatchAny(any=["chat", "email"]))
        ]
    ),
    limit=10
)

# Range filter
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must=[
            FieldCondition(
                key="timestamp",
                range=Range(gte=1705000000, lt=1705200000)
            )
        ]
    ),
    limit=10
)

# Nested field access
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must=[
            FieldCondition(key="user.role", match=MatchValue(value="admin"))
        ]
    ),
    limit=10
)

# Array contains
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must=[
            FieldCondition(key="tags", match=MatchValue(value="urgent"))
        ]
    ),
    limit=10
)

# Complex conditions: must, should, must_not
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must=[
            FieldCondition(key="timestamp", range=Range(gte=1705000000))
        ],
        should=[
            FieldCondition(key="priority", range=Range(lte=2)),
            FieldCondition(key="source", match=MatchValue(value="chat"))
        ],
        must_not=[
            FieldCondition(key="user.role", match=MatchValue(value="guest"))
        ]
    ),
    limit=10
)

# Check for empty/null fields
results = client.search(
    collection_name="documents",
    query_vector=[0.1] * 384,
    query_filter=Filter(
        must_not=[
            IsEmpty(key="tags"),  # Has tags
            IsNull(key="priority")  # Has priority
        ]
    ),
    limit=10
)
```

### pgvector Filter Syntax

```sql
-- pgvector uses standard SQL WHERE clauses with JSONB operators

-- Simple equality
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE metadata->>'source' = 'chat'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Multiple conditions
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE metadata->>'source' = 'chat'
  AND (metadata->>'priority')::int <= 2
  AND (metadata->>'timestamp')::bigint > 1705000000
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- JSONB containment (check if metadata contains these values)
SELECT *
FROM documents
WHERE metadata @> '{"source": "chat", "active": true}'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Check if field exists
SELECT *
FROM documents
WHERE metadata ? 'priority'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Array contains (tags stored as JSON array)
SELECT *
FROM documents
WHERE metadata->'tags' ? 'urgent'
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Full-text search on JSONB text fields
SELECT *
FROM documents
WHERE to_tsvector('english', metadata->>'content') @@ plainto_tsquery('english', 'machine learning')
ORDER BY embedding <=> $1::vector
LIMIT 10;

-- Complex conditions with OR
SELECT *, 1 - (embedding <=> $1::vector) as similarity
FROM documents
WHERE (
    (metadata->>'source' = 'chat' AND (metadata->>'priority')::int <= 2)
    OR
    (metadata->>'source' = 'email' AND (metadata->>'active')::boolean = true)
)
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

```python
"""Python wrapper for pgvector metadata queries."""
import psycopg2
from psycopg2.extras import Json
from typing import List, Dict, Any, Optional


class PgVectorMetadataSearch:
    """Pgvector search with metadata filtering."""

    def __init__(self, connection_string: str, table_name: str = "documents"):
        self.conn = psycopg2.connect(connection_string)
        self.table_name = table_name

    def search(
        self,
        embedding: List[float],
        k: int = 10,
        filters: Dict[str, Any] = None,
        filter_mode: str = "and"  # "and" or "or"
    ) -> List[Dict]:
        """
        Search with metadata filters.

        Args:
            embedding: Query vector
            k: Number of results
            filters: Dictionary of field -> value or field -> {"op": value}
            filter_mode: How to combine filters

        Returns:
            List of matching documents
        """
        where_clauses = []
        params = [embedding]

        if filters:
            for field, condition in filters.items():
                if isinstance(condition, dict):
                    # Operator condition: {"$gt": 5}
                    for op, value in condition.items():
                        if op == "$eq":
                            where_clauses.append(f"metadata->>'{field}' = %s")
                            params.append(str(value))
                        elif op == "$ne":
                            where_clauses.append(f"metadata->>'{field}' != %s")
                            params.append(str(value))
                        elif op == "$gt":
                            where_clauses.append(f"(metadata->>'{field}')::numeric > %s")
                            params.append(value)
                        elif op == "$gte":
                            where_clauses.append(f"(metadata->>'{field}')::numeric >= %s")
                            params.append(value)
                        elif op == "$lt":
                            where_clauses.append(f"(metadata->>'{field}')::numeric < %s")
                            params.append(value)
                        elif op == "$lte":
                            where_clauses.append(f"(metadata->>'{field}')::numeric <= %s")
                            params.append(value)
                        elif op == "$in":
                            placeholders = ",".join(["%s"] * len(value))
                            where_clauses.append(f"metadata->>'{field}' IN ({placeholders})")
                            params.extend(value)
                        elif op == "$contains":
                            where_clauses.append(f"metadata->'{field}' ? %s")
                            params.append(value)
                else:
                    # Simple equality
                    if isinstance(condition, bool):
                        where_clauses.append(f"(metadata->>'{field}')::boolean = %s")
                    elif isinstance(condition, (int, float)):
                        where_clauses.append(f"(metadata->>'{field}')::numeric = %s")
                    else:
                        where_clauses.append(f"metadata->>'{field}' = %s")
                    params.append(condition)

        where_sql = ""
        if where_clauses:
            joiner = " AND " if filter_mode == "and" else " OR "
            where_sql = "WHERE " + joiner.join(where_clauses)

        params.append(k)

        query = f"""
            SELECT id, content, metadata, 1 - (embedding <=> %s::vector) as similarity
            FROM {self.table_name}
            {where_sql}
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """

        # Insert embedding twice for ORDER BY
        params.insert(len(params) - 1, embedding)

        with self.conn.cursor() as cur:
            cur.execute(query, params)
            results = cur.fetchall()

        return [
            {"id": r[0], "content": r[1], "metadata": r[2], "similarity": r[3]}
            for r in results
        ]


# Usage
search = PgVectorMetadataSearch("postgresql://user:pass@localhost/db")

results = search.search(
    embedding=[0.1] * 384,
    k=10,
    filters={
        "source": "chat",
        "priority": {"$lte": 2},
        "timestamp": {"$gte": 1705000000}
    }
)
```

### Metadata Index Optimization

```python
"""
Strategies for optimizing filtered vector search performance.
"""
import chromadb
from typing import Dict, Any, List


class OptimizedMetadataStore:
    """
    Vector store with metadata indexing optimization strategies.
    """

    def __init__(self, path: str):
        self.client = chromadb.PersistentClient(path=path)

        # Strategy 1: Separate collections for common filter values
        # Reduces search space significantly for frequent filters
        self.collections = {}

    def get_collection_for_filter(self, primary_filter: Dict) -> Any:
        """
        Get or create a collection optimized for a filter pattern.

        For high-cardinality filters (e.g., user_id), use separate collections.
        For low-cardinality filters (e.g., source), use single collection with metadata.
        """
        # Example: Separate collection per source
        if "source" in primary_filter:
            source = primary_filter["source"]
            collection_name = f"docs_source_{source}"

            if collection_name not in self.collections:
                self.collections[collection_name] = self.client.get_or_create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": "cosine"}
                )

            return self.collections[collection_name]

        # Default collection
        if "default" not in self.collections:
            self.collections["default"] = self.client.get_or_create_collection(
                name="documents",
                metadata={"hnsw:space": "cosine"}
            )

        return self.collections["default"]

    def add(self, documents: List[Dict]):
        """Add documents to appropriate collections."""
        # Group by source for optimized storage
        by_source = {}
        for doc in documents:
            source = doc.get("metadata", {}).get("source", "default")
            if source not in by_source:
                by_source[source] = []
            by_source[source].append(doc)

        for source, docs in by_source.items():
            collection = self.get_collection_for_filter({"source": source})
            collection.add(
                ids=[d["id"] for d in docs],
                documents=[d["content"] for d in docs],
                metadatas=[d["metadata"] for d in docs]
            )

    def search(
        self,
        query: str,
        filters: Dict,
        k: int = 10
    ) -> List[Dict]:
        """
        Search with filter-aware collection selection.
        """
        # Use source-specific collection if filtering by source
        if "source" in filters and isinstance(filters["source"], str):
            collection = self.get_collection_for_filter({"source": filters["source"]})
            # Remove source from filters since we're already in that collection
            remaining_filters = {k: v for k, v in filters.items() if k != "source"}
        else:
            collection = self.get_collection_for_filter({})
            remaining_filters = filters

        where = remaining_filters if remaining_filters else None

        results = collection.query(
            query_texts=[query],
            n_results=k,
            where=where
        )

        return [
            {
                "id": id_,
                "content": doc,
                "metadata": meta,
                "distance": dist
            }
            for id_, doc, meta, dist in zip(
                results["ids"][0],
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            )
        ]


# Strategy 2: Bitmap indexes for common boolean filters
class BitmapFilteredStore:
    """
    Use bitmap indexes for fast boolean/enum filtering before vector search.
    """

    def __init__(self):
        self.vectors = []  # In production, use FAISS or similar
        self.documents = []
        self.bitmaps = {}  # field -> value -> set of indices

    def add(self, id_: str, vector: List[float], metadata: Dict):
        idx = len(self.vectors)
        self.vectors.append(vector)
        self.documents.append({"id": id_, "metadata": metadata})

        # Build bitmaps for each field
        for field, value in metadata.items():
            if field not in self.bitmaps:
                self.bitmaps[field] = {}
            if value not in self.bitmaps[field]:
                self.bitmaps[field][value] = set()
            self.bitmaps[field][value].add(idx)

    def search(self, query_vector: List[float], filters: Dict, k: int = 10):
        # Get candidate indices from bitmap intersection
        candidate_sets = []
        for field, value in filters.items():
            if field in self.bitmaps and value in self.bitmaps[field]:
                candidate_sets.append(self.bitmaps[field][value])

        if candidate_sets:
            candidates = set.intersection(*candidate_sets)
        else:
            candidates = set(range(len(self.vectors)))

        # Only search within candidates (much faster for selective filters)
        # In production, use FAISS IDSelector or similar
        import numpy as np

        query = np.array(query_vector)
        scores = []

        for idx in candidates:
            vec = np.array(self.vectors[idx])
            similarity = np.dot(query, vec) / (np.linalg.norm(query) * np.linalg.norm(vec))
            scores.append((idx, similarity))

        scores.sort(key=lambda x: x[1], reverse=True)

        return [
            {**self.documents[idx], "similarity": sim}
            for idx, sim in scores[:k]
        ]
```

## Performance Characteristics

### Filter Selectivity Impact

| Selectivity | Strategy | Expected Speedup |
|-------------|----------|------------------|
| <1% pass | Pre-filter | 10-100x |
| 1-10% pass | Pre-filter | 2-10x |
| 10-50% pass | Database decides | 1-2x |
| >50% pass | Post-filter | ~1x (no benefit) |

### Index Recommendations

```
ChromaDB:
- Automatic HNSW on vectors
- No explicit metadata indexes
- Consider collection sharding for high-cardinality filters

Qdrant:
- Automatic payload indexes for filtered fields
- Use indexed fields for frequently filtered attributes
- Set index_type="keyword" for enum fields

pgvector:
- Create GIN index on JSONB metadata column
- Create partial indexes for common filter patterns
- Use covering indexes to avoid table lookups

CREATE INDEX idx_active_docs ON documents
USING hnsw (embedding vector_cosine_ops)
WHERE (metadata->>'active')::boolean = true;
```

## When to Use This Pattern

**Metadata filtering excels at:**
- Multi-tenant systems (filter by user/org)
- Time-bounded retrieval (filter by date range)
- Category-scoped search (filter by type/source)
- Permission-aware search (filter by access level)
- Status-filtered results (active/archived)

**Consider alternatives when:**
- Filters are extremely selective (use separate stores)
- No structured metadata (use pure vector search)
- Filter cardinality is very high (consider partitioning)

## Common Patterns

### Multi-Tenant Search

```python
def tenant_search(
    collection,
    query: str,
    tenant_id: str,
    k: int = 10,
    additional_filters: Dict = None
):
    """Always filter by tenant for data isolation."""
    where = {"tenant_id": tenant_id}

    if additional_filters:
        where = {
            "$and": [
                {"tenant_id": tenant_id},
                additional_filters
            ]
        }

    return collection.query(
        query_texts=[query],
        n_results=k,
        where=where
    )
```

### Time-Windowed Search

```python
import time

def recent_search(
    collection,
    query: str,
    hours: int = 24,
    k: int = 10
):
    """Search only recent documents."""
    cutoff = int(time.time()) - (hours * 3600)

    return collection.query(
        query_texts=[query],
        n_results=k,
        where={"timestamp": {"$gte": cutoff}}
    )
```

### Faceted Search

```python
def faceted_search(
    collection,
    query: str,
    facets: Dict[str, List[str]],  # {"category": ["a", "b"], "source": ["x"]}
    k: int = 10
):
    """Search with multiple facet selections."""
    conditions = []

    for field, values in facets.items():
        if len(values) == 1:
            conditions.append({field: values[0]})
        else:
            conditions.append({field: {"$in": values}})

    where = {"$and": conditions} if len(conditions) > 1 else conditions[0]

    return collection.query(
        query_texts=[query],
        n_results=k,
        where=where
    )
```

## Related Cookbooks

- `quickstart.md` - Getting started basics
- `chromadb.md` - ChromaDB-specific patterns
- `pgvector.md` - SQL-based filtering
- `hybrid-search.md` - Combining with full-text search
