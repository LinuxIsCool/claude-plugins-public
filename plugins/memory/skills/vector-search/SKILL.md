---
name: vector-search
description: This skill should be used when the user asks about "vector databases", "ChromaDB", "FAISS", "pgvector", "Qdrant", "LanceDB", "similarity search", "ANN search", "vector indexing", or needs to implement vector storage and retrieval for memory systems.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Vector Search Skill

Provides expertise on vector databases and similarity search systems - covering database selection, indexing strategies, and integration patterns.

## Overview

Vector databases store embeddings and enable efficient similarity search. Key considerations:

| Factor | Impact |
|--------|--------|
| **Scale** | Documents count, query throughput |
| **Persistence** | In-memory vs durable storage |
| **Filtering** | Metadata queries with vectors |
| **Deployment** | Local, embedded, or managed |

## Database Categories

### Embedded (Local, Zero-Config)

```
ChromaDB     Python-native, auto-embedding, SQLite backend
LanceDB      Rust-based, columnar, disk-native
SQLite-VSS   Extension for existing SQLite
```

**Use when**: Prototyping, single-user, local-first applications.

### Standalone Servers

```
Qdrant       Rust, production-grade, rich filtering
Milvus       Distributed, high-scale
Weaviate     GraphQL, built-in vectorization
```

**Use when**: Multi-user, high throughput, production deployments.

### Postgres Extensions

```
pgvector     Native Postgres extension
pgvecto.rs   Rust-based, high-performance
```

**Use when**: Existing Postgres infrastructure, transactional guarantees.

## Database Selection Framework

### Decision Tree

```
Production scale (>1M vectors)?
├─ Yes → Qdrant, Milvus, or pgvector
└─ No → Continue

Need existing Postgres?
├─ Yes → pgvector
└─ No → Continue

Embedded/local preference?
├─ Yes → ChromaDB or LanceDB
└─ No → Qdrant
```

### By Use Case

| Use Case | Recommended | Why |
|----------|-------------|-----|
| Prototyping | ChromaDB | Zero config, built-in embeddings |
| Claude Code plugin | ChromaDB/SQLite | Local, no server needed |
| Production SaaS | Qdrant | Scalable, managed options |
| Existing Postgres | pgvector | Single database |
| High throughput | Milvus | Distributed architecture |

## Implementation Patterns

### Pattern 1: ChromaDB (Recommended for Plugins)

```python
import chromadb
from chromadb.config import Settings

# Persistent storage
client = chromadb.PersistentClient(
    path="./chroma_db",
    settings=Settings(anonymized_telemetry=False)
)

# Create collection
collection = client.get_or_create_collection(
    name="memories",
    metadata={"hnsw:space": "cosine"}  # or "l2", "ip"
)

# Add documents (auto-embeds if no embedding_function set)
collection.add(
    documents=["First memory", "Second memory"],
    metadatas=[{"source": "chat"}, {"source": "tool"}],
    ids=["id1", "id2"]
)

# Query
results = collection.query(
    query_texts=["search query"],
    n_results=5,
    where={"source": "chat"}  # Metadata filter
)
```

### Pattern 2: SQLite with FTS5 (Hybrid Search)

```python
import sqlite3

conn = sqlite3.connect("memory.db")
conn.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS memories
    USING fts5(content, metadata)
""")

# Insert
conn.execute(
    "INSERT INTO memories(content, metadata) VALUES (?, ?)",
    ("Memory content", '{"source": "chat"}')
)

# Full-text search
results = conn.execute("""
    SELECT * FROM memories
    WHERE memories MATCH ?
    ORDER BY rank
    LIMIT 10
""", ("search query",)).fetchall()
```

### Pattern 3: pgvector

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table
CREATE TABLE memories (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding vector(384),  -- Match your embedding dimensions
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast search
CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Insert
INSERT INTO memories (content, embedding, metadata)
VALUES ('Memory content', '[0.1, 0.2, ...]', '{"source": "chat"}');

-- Query (cosine similarity)
SELECT *, 1 - (embedding <=> $1) as similarity
FROM memories
WHERE metadata->>'source' = 'chat'
ORDER BY embedding <=> $1
LIMIT 10;
```

### Pattern 4: Qdrant

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Local storage
client = QdrantClient(path="./qdrant_db")

# Create collection
client.create_collection(
    collection_name="memories",
    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
)

# Insert
client.upsert(
    collection_name="memories",
    points=[
        PointStruct(
            id=1,
            vector=[0.1, 0.2, ...],
            payload={"content": "Memory", "source": "chat"}
        )
    ]
)

# Search with filter
results = client.search(
    collection_name="memories",
    query_vector=[0.1, 0.2, ...],
    query_filter={"must": [{"key": "source", "match": {"value": "chat"}}]},
    limit=10
)
```

### Pattern 5: LanceDB

```python
import lancedb

db = lancedb.connect("./lance_db")

# Create table from data
data = [
    {"text": "First memory", "vector": [0.1, 0.2], "source": "chat"},
    {"text": "Second memory", "vector": [0.3, 0.4], "source": "tool"}
]
table = db.create_table("memories", data)

# Search
results = table.search([0.1, 0.2]).limit(5).to_list()

# With filter
results = (
    table.search([0.1, 0.2])
    .where("source = 'chat'")
    .limit(5)
    .to_list()
)
```

## Indexing Strategies

### HNSW (Hierarchical Navigable Small World)

```
Pros: Fast search, good recall
Cons: Memory-intensive, slower inserts
Use: Default for most cases

Parameters:
- M: Connections per node (16-64)
- ef_construction: Build quality (100-200)
- ef_search: Query quality (50-100)
```

### IVF (Inverted File Index)

```
Pros: Lower memory, faster builds
Cons: Lower recall without reranking
Use: Very large datasets (>10M vectors)

Parameters:
- nlist: Number of clusters (sqrt(n) rule)
- nprobe: Clusters to search (10-100)
```

### Flat (Brute Force)

```
Pros: Perfect recall
Cons: O(n) search time
Use: Small datasets (<10K vectors)
```

## Hybrid Search Patterns

### Vector + Full-Text

```python
def hybrid_search(query: str, collection, k: int = 10):
    # Vector search
    vector_results = collection.query(
        query_texts=[query],
        n_results=k * 2
    )

    # Full-text search (if supported)
    fts_results = full_text_search(query, k * 2)

    # Reciprocal rank fusion
    combined = reciprocal_rank_fusion(vector_results, fts_results)
    return combined[:k]

def reciprocal_rank_fusion(results_a, results_b, k=60):
    scores = {}
    for rank, doc_id in enumerate(results_a):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    for rank, doc_id in enumerate(results_b):
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
```

### Vector + Metadata Filtering

```python
# ChromaDB - filter then search
results = collection.query(
    query_texts=["query"],
    where={
        "$and": [
            {"source": {"$eq": "chat"}},
            {"timestamp": {"$gt": 1704067200}}
        ]
    },
    n_results=10
)

# Qdrant - complex filters
from qdrant_client.models import Filter, FieldCondition, MatchValue, Range

filter = Filter(
    must=[
        FieldCondition(key="source", match=MatchValue(value="chat")),
        FieldCondition(key="timestamp", range=Range(gt=1704067200))
    ]
)
```

## Performance Optimization

### Batch Operations

```python
# ChromaDB - batch add
collection.add(
    documents=documents,  # List of N documents
    ids=ids,              # List of N IDs
    metadatas=metadatas   # List of N metadata dicts
)

# Batch query (reduces overhead)
results = collection.query(
    query_texts=queries,  # List of queries
    n_results=5
)
```

### Connection Pooling

```python
# Singleton pattern for ChromaDB
_client = None

def get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path="./chroma_db")
    return _client
```

### Index Tuning

```python
# ChromaDB HNSW settings
collection = client.get_or_create_collection(
    name="memories",
    metadata={
        "hnsw:space": "cosine",
        "hnsw:construction_ef": 200,  # Higher = better index
        "hnsw:search_ef": 100,         # Higher = better search
        "hnsw:M": 32                    # More connections
    }
)
```

## Framework Integration

### With agentmemory

```python
from agentmemory import create_memory, search_memory

# Uses ChromaDB internally
create_memory(
    category="conversations",
    document="Memory content",
    metadata={"source": "chat"}
)

results = search_memory(
    category="conversations",
    search_text="query",
    n_results=5
)
```

### With mem0

```python
from mem0 import Memory

# ChromaDB backend (default)
m = Memory(vector_store={
    "provider": "chroma",
    "config": {"path": "./mem0_db"}
})

# Qdrant backend
m = Memory(vector_store={
    "provider": "qdrant",
    "config": {"host": "localhost", "port": 6333}
})
```

## Repository-Specific Patterns

### For Claude Code Plugins

```python
from pathlib import Path

def get_memory_db_path() -> Path:
    """Get consistent database path anchored to repo root."""
    # Follow plugin data storage conventions
    from lib.paths import getClaudePath
    return Path(getClaudePath("memory/vectors"))

# Initialize ChromaDB with repo-anchored path
client = chromadb.PersistentClient(path=str(get_memory_db_path()))
```

### Three-Tier Storage Pattern

```python
# Hot tier: In-memory for current session
hot_store = {}

# Warm tier: ChromaDB for recent history
warm_client = chromadb.PersistentClient(path="./warm_db")
warm_collection = warm_client.get_or_create_collection("warm_memories")

# Cold tier: Compressed archive (SQLite FTS)
cold_conn = sqlite3.connect("cold_archive.db")
```

## When to Use This Skill

**Best for:**
- Selecting vector database for memory system
- Implementing similarity search
- Optimizing vector indexing
- Hybrid search patterns

**See also:**
- `../embeddings/SKILL.md` - Embedding model selection
- `../memory-architecture/SKILL.md` - Three-tier design
- `../agentmemory/SKILL.md` - ChromaDB patterns

## Additional Resources

### Cookbooks

Detailed implementation guides for specific use cases:

| Cookbook | Description |
|----------|-------------|
| `cookbook/quickstart.md` | Getting started with vector databases in 10 minutes |
| `cookbook/chromadb.md` | ChromaDB patterns, connection pooling, batching |
| `cookbook/faiss.md` | FAISS index types: Flat, HNSW, IVF, IVF+PQ |
| `cookbook/pgvector.md` | PostgreSQL vector search with SQL integration |
| `cookbook/sqlite-vec.md` | Embedded vector search for local-first apps |
| `cookbook/hybrid-search.md` | Combining vector + full-text with RRF fusion |
| `cookbook/metadata-filtering.md` | Advanced filter syntax for each database |
| `cookbook/index-tuning.md` | HNSW/IVF parameter optimization guide |

### Prompts

| Prompt | Purpose |
|--------|---------|
| `prompts/search_refinement.md` | Templates for query expansion and iterative refinement |

### Tools

Production-ready utilities:

| Tool | Description |
|------|-------------|
| `tools/vector_benchmark.py` | Benchmark vector DB performance (FAISS, ChromaDB) |
| `tools/chromadb_client.py` | Thread-safe ChromaDB wrapper with batching and metadata |
| `tools/faiss_client.py` | FAISS wrapper with ID mapping, persistence, auto-config |

### External Documentation
- ChromaDB Docs: https://docs.trychroma.com/
- Qdrant Docs: https://qdrant.tech/documentation/
- pgvector: https://github.com/pgvector/pgvector
- FAISS Wiki: https://github.com/facebookresearch/faiss/wiki
- sqlite-vec: https://github.com/asg017/sqlite-vec
