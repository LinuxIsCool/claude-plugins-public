# ChromaDB Patterns and Best Practices

## Purpose

ChromaDB is a Python-native vector database optimized for AI applications. This cookbook covers production patterns, performance optimization, and integration best practices for building robust memory systems.

## Variables

```yaml
CHROMA_VERSION: "0.4.x"
DEFAULT_EMBEDDING_MODEL: "all-MiniLM-L6-v2"
EMBEDDING_DIM: 384
MAX_BATCH_SIZE: 5000
RECOMMENDED_BATCH_SIZE: 100
HNSW_SPACE: "cosine"
HNSW_M: 16
HNSW_EF_CONSTRUCTION: 100
HNSW_EF_SEARCH: 50
```

## Instructions

### Installation and Setup

```bash
# Basic installation
pip install chromadb

# With sentence-transformers for local embeddings
pip install chromadb sentence-transformers

# Full installation with all embedding options
pip install chromadb sentence-transformers openai cohere
```

### Client Modes

ChromaDB supports three client modes:

```python
import chromadb
from chromadb.config import Settings

# 1. EPHEMERAL - In-memory only (testing/development)
client = chromadb.EphemeralClient()

# 2. PERSISTENT - Local file storage (recommended for most cases)
client = chromadb.PersistentClient(
    path="./chroma_data",
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True
    )
)

# 3. HTTP - Client-server mode (production/multi-process)
# First, run server: chroma run --path ./chroma_data
client = chromadb.HttpClient(host="localhost", port=8000)
```

### Collection Configuration

```python
from chromadb.utils import embedding_functions

# Define embedding function
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Create collection with optimal HNSW settings
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=embedding_fn,
    metadata={
        # Distance metric
        "hnsw:space": "cosine",  # Options: "cosine", "l2", "ip"

        # Index construction quality (higher = better index, slower build)
        "hnsw:construction_ef": 200,

        # Query quality (higher = better recall, slower query)
        "hnsw:search_ef": 100,

        # Connections per node (higher = better recall, more memory)
        "hnsw:M": 32,

        # Number of threads for index operations
        "hnsw:num_threads": 4,

        # Batch size for index construction
        "hnsw:batch_size": 1000
    }
)
```

## Code Examples

### Production-Ready Client Singleton

```python
"""ChromaDB client with connection pooling and error handling."""
import chromadb
from chromadb.config import Settings
from pathlib import Path
from typing import Optional
import threading


class ChromaDBManager:
    """Thread-safe ChromaDB client manager."""

    _instance: Optional["ChromaDBManager"] = None
    _lock = threading.Lock()

    def __new__(cls, path: str = "./chroma_data"):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialize(path)
            return cls._instance

    def _initialize(self, path: str):
        """Initialize the ChromaDB client."""
        self._path = Path(path)
        self._path.mkdir(parents=True, exist_ok=True)

        self._client = chromadb.PersistentClient(
            path=str(self._path),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=False,  # Safety: prevent accidental resets
                is_persistent=True
            )
        )
        self._collections: dict = {}

    def get_collection(
        self,
        name: str,
        embedding_function=None,
        create_if_missing: bool = True
    ):
        """Get or create a collection with caching."""
        cache_key = f"{name}_{id(embedding_function)}"

        if cache_key not in self._collections:
            if create_if_missing:
                self._collections[cache_key] = self._client.get_or_create_collection(
                    name=name,
                    embedding_function=embedding_function,
                    metadata={"hnsw:space": "cosine"}
                )
            else:
                self._collections[cache_key] = self._client.get_collection(
                    name=name,
                    embedding_function=embedding_function
                )

        return self._collections[cache_key]

    def delete_collection(self, name: str):
        """Delete a collection and clear from cache."""
        self._client.delete_collection(name)
        # Clear from cache
        keys_to_remove = [k for k in self._collections if k.startswith(f"{name}_")]
        for key in keys_to_remove:
            del self._collections[key]

    @property
    def client(self):
        """Direct access to underlying client."""
        return self._client


# Usage
db = ChromaDBManager("./my_data")
collection = db.get_collection("memories")
```

### Efficient Batch Operations

```python
from typing import List, Dict, Any
import uuid


def batch_add(
    collection,
    documents: List[str],
    metadatas: List[Dict[str, Any]] = None,
    ids: List[str] = None,
    batch_size: int = 100
) -> int:
    """
    Add documents in batches for optimal performance.

    Args:
        collection: ChromaDB collection
        documents: List of document texts
        metadatas: Optional list of metadata dicts
        ids: Optional list of IDs (generated if not provided)
        batch_size: Number of documents per batch

    Returns:
        Number of documents added
    """
    if ids is None:
        ids = [str(uuid.uuid4()) for _ in documents]

    if metadatas is None:
        metadatas = [{} for _ in documents]

    total_added = 0

    for i in range(0, len(documents), batch_size):
        batch_end = min(i + batch_size, len(documents))

        collection.add(
            documents=documents[i:batch_end],
            metadatas=metadatas[i:batch_end],
            ids=ids[i:batch_end]
        )

        total_added += batch_end - i

    return total_added


def batch_query(
    collection,
    queries: List[str],
    n_results: int = 5,
    where: Dict = None,
    batch_size: int = 10
) -> List[Dict]:
    """
    Query in batches for multiple queries.

    Args:
        collection: ChromaDB collection
        queries: List of query texts
        n_results: Results per query
        where: Optional metadata filter
        batch_size: Queries per batch

    Returns:
        List of result dicts
    """
    all_results = []

    for i in range(0, len(queries), batch_size):
        batch_queries = queries[i:i + batch_size]

        results = collection.query(
            query_texts=batch_queries,
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"]
        )

        # Restructure results per query
        for j in range(len(batch_queries)):
            all_results.append({
                "query": batch_queries[j],
                "documents": results["documents"][j],
                "metadatas": results["metadatas"][j],
                "distances": results["distances"][j]
            })

    return all_results
```

### Multi-Collection Architecture

```python
"""
Pattern: Separate collections by document type for better organization
and more focused similarity search.
"""

class MemoryStore:
    """Multi-collection memory store with semantic separation."""

    COLLECTIONS = {
        "conversations": {
            "description": "Chat messages and dialogue",
            "hnsw:space": "cosine",
            "hnsw:M": 32
        },
        "documents": {
            "description": "Long-form documents and notes",
            "hnsw:space": "cosine",
            "hnsw:M": 16
        },
        "code": {
            "description": "Code snippets and technical content",
            "hnsw:space": "cosine",
            "hnsw:M": 48  # Higher for more precise matching
        },
        "facts": {
            "description": "Extracted facts and knowledge",
            "hnsw:space": "cosine",
            "hnsw:M": 24
        }
    }

    def __init__(self, db_path: str, embedding_function=None):
        self.client = chromadb.PersistentClient(path=db_path)
        self.embedding_fn = embedding_function
        self._collections = {}

        for name, config in self.COLLECTIONS.items():
            self._collections[name] = self.client.get_or_create_collection(
                name=name,
                embedding_function=self.embedding_fn,
                metadata={k: v for k, v in config.items() if k.startswith("hnsw:")}
            )

    def add(self, collection_name: str, **kwargs):
        """Add to specific collection."""
        return self._collections[collection_name].add(**kwargs)

    def query(self, collection_name: str, **kwargs):
        """Query specific collection."""
        return self._collections[collection_name].query(**kwargs)

    def search_all(self, query: str, n_results: int = 3) -> Dict[str, Any]:
        """Search across all collections."""
        results = {}
        for name, collection in self._collections.items():
            results[name] = collection.query(
                query_texts=[query],
                n_results=n_results,
                include=["documents", "metadatas", "distances"]
            )
        return results
```

### Embedding Function Patterns

```python
from chromadb.utils import embedding_functions

# 1. Sentence Transformers (Local, Free)
st_ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2",  # Fast, 384 dims
    # model_name="all-mpnet-base-v2",  # Better quality, 768 dims
    device="cuda"  # Use GPU if available
)

# 2. OpenAI (API, Paid)
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key="sk-...",
    model_name="text-embedding-3-small"  # or "text-embedding-3-large"
)

# 3. Cohere (API, Free tier available)
cohere_ef = embedding_functions.CohereEmbeddingFunction(
    api_key="...",
    model_name="embed-english-v3.0"
)

# 4. Custom Embedding Function
class CustomEmbeddingFunction:
    """Custom embedding function interface."""

    def __init__(self, model):
        self.model = model

    def __call__(self, input: List[str]) -> List[List[float]]:
        """ChromaDB calls this with a list of texts."""
        return self.model.encode(input).tolist()


# 5. Hybrid: Cache expensive embeddings
class CachedEmbeddingFunction:
    """Embedding function with caching layer."""

    def __init__(self, base_ef, cache_path: str = "./embedding_cache.db"):
        self.base_ef = base_ef
        self.cache_path = cache_path
        self._init_cache()

    def _init_cache(self):
        import sqlite3
        self.conn = sqlite3.connect(self.cache_path)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                text_hash TEXT PRIMARY KEY,
                embedding BLOB
            )
        """)

    def __call__(self, input: List[str]) -> List[List[float]]:
        import hashlib
        import pickle

        results = []
        uncached_texts = []
        uncached_indices = []

        # Check cache
        for i, text in enumerate(input):
            text_hash = hashlib.sha256(text.encode()).hexdigest()
            cached = self.conn.execute(
                "SELECT embedding FROM embeddings WHERE text_hash = ?",
                (text_hash,)
            ).fetchone()

            if cached:
                results.append(pickle.loads(cached[0]))
            else:
                results.append(None)
                uncached_texts.append(text)
                uncached_indices.append(i)

        # Generate missing embeddings
        if uncached_texts:
            new_embeddings = self.base_ef(uncached_texts)

            for idx, text, embedding in zip(uncached_indices, uncached_texts, new_embeddings):
                text_hash = hashlib.sha256(text.encode()).hexdigest()
                self.conn.execute(
                    "INSERT OR REPLACE INTO embeddings VALUES (?, ?)",
                    (text_hash, pickle.dumps(embedding))
                )
                results[idx] = embedding

            self.conn.commit()

        return results
```

### Metadata Best Practices

```python
"""
ChromaDB metadata constraints:
- Keys must be strings
- Values must be: str, int, float, or bool
- No nested objects or lists
- Maximum key length: 256 characters
"""

from datetime import datetime
import json


def prepare_metadata(raw_metadata: Dict) -> Dict:
    """
    Flatten and convert metadata for ChromaDB compatibility.

    Args:
        raw_metadata: Arbitrary nested dictionary

    Returns:
        Flattened dictionary with ChromaDB-compatible types
    """
    def flatten(obj, prefix=""):
        items = {}

        if isinstance(obj, dict):
            for k, v in obj.items():
                new_key = f"{prefix}.{k}" if prefix else k
                items.update(flatten(v, new_key))
        elif isinstance(obj, (list, tuple)):
            # Convert lists to JSON string
            items[prefix] = json.dumps(obj)
        elif isinstance(obj, datetime):
            # Convert datetime to timestamp
            items[prefix] = int(obj.timestamp())
        elif isinstance(obj, bool):
            items[prefix] = obj
        elif isinstance(obj, (int, float, str)):
            items[prefix] = obj
        elif obj is None:
            items[prefix] = ""  # ChromaDB doesn't support None
        else:
            items[prefix] = str(obj)

        return items

    return flatten(raw_metadata)


# Example usage
raw = {
    "source": "chat",
    "user": {"name": "Alice", "id": 123},
    "tags": ["important", "work"],
    "timestamp": datetime.now(),
    "processed": True
}

metadata = prepare_metadata(raw)
# Result:
# {
#     "source": "chat",
#     "user.name": "Alice",
#     "user.id": 123,
#     "tags": '["important", "work"]',
#     "timestamp": 1705123456,
#     "processed": True
# }
```

## Performance Characteristics

### Operation Benchmarks (100K documents, 384 dimensions)

| Operation | Time | Notes |
|-----------|------|-------|
| Add 1K documents | ~2s | Includes embedding generation |
| Add 1K (pre-embedded) | ~200ms | Embeddings provided |
| Single query | ~50ms | Includes embedding generation |
| Batch query (10) | ~100ms | Amortized embedding cost |
| Get by ID (single) | ~1ms | Direct lookup |
| Get by ID (100) | ~10ms | Batch lookup |
| Delete by ID | ~5ms | Index update required |
| Delete by filter | ~100ms | Scan + delete |

### Memory Usage

```
Base overhead: ~100MB
Per 100K documents (384d): ~150MB
Per 100K documents (1536d): ~600MB

Formula (approximate):
memory_mb = 100 + (num_docs * dim * 4 / 1_000_000) * 1.5
```

### Index Build Time

```python
# HNSW index build scales with:
# - Number of documents
# - Embedding dimensions
# - M parameter (connections per node)
# - ef_construction parameter

# Approximate build times for 1M documents:
# M=16, ef=100: ~5 minutes
# M=32, ef=200: ~15 minutes
# M=48, ef=300: ~30 minutes
```

## When to Use This Pattern

**ChromaDB excels at:**
- Rapid prototyping and development
- Single-user applications
- Claude Code plugins and local tools
- Python-native workflows
- Projects needing built-in embedding support

**Consider alternatives when:**
- You need horizontal scaling (use Qdrant or Milvus)
- Running in non-Python environments (use Qdrant HTTP API)
- You have existing Postgres infrastructure (use pgvector)
- You need real-time updates with minimal latency (use Qdrant)
- You need advanced filtering beyond simple conditions (use Qdrant)

## Common Issues and Solutions

### Issue: Slow queries after many updates

```python
# Problem: Index becomes fragmented with many updates/deletes
# Solution: Rebuild collection periodically

def rebuild_collection(client, collection_name: str):
    """Rebuild collection to defragment index."""
    old_collection = client.get_collection(collection_name)

    # Get all data
    all_data = old_collection.get(include=["embeddings", "documents", "metadatas"])

    # Delete and recreate
    client.delete_collection(collection_name)
    new_collection = client.create_collection(
        name=collection_name,
        metadata=old_collection.metadata
    )

    # Re-add data
    if all_data["ids"]:
        new_collection.add(
            ids=all_data["ids"],
            embeddings=all_data["embeddings"],
            documents=all_data["documents"],
            metadatas=all_data["metadatas"]
        )

    return new_collection
```

### Issue: Out of memory with large datasets

```python
# Solution: Use HTTP client mode with server

# Start server with memory limits
# chroma run --path ./data --host 0.0.0.0 --port 8000

# Connect via HTTP
client = chromadb.HttpClient(
    host="localhost",
    port=8000,
    settings=Settings(
        chroma_client_auth_provider="chromadb.auth.token.TokenAuthClientProvider",
        chroma_client_auth_credentials="your-token"
    )
)
```

### Issue: Concurrent access from multiple processes

```python
# Solution: Use HTTP client mode (server handles locking)
# OR use file locking for PersistentClient

import fcntl

class SafePersistentClient:
    def __init__(self, path: str):
        self.path = path
        self.lock_file = f"{path}/.lock"
        self._client = None

    def __enter__(self):
        self._lock_fd = open(self.lock_file, 'w')
        fcntl.flock(self._lock_fd, fcntl.LOCK_EX)
        self._client = chromadb.PersistentClient(path=self.path)
        return self._client

    def __exit__(self, *args):
        fcntl.flock(self._lock_fd, fcntl.LOCK_UN)
        self._lock_fd.close()

# Usage
with SafePersistentClient("./data") as client:
    collection = client.get_collection("docs")
    # ... operations ...
```

## Related Cookbooks

- `quickstart.md` - Getting started basics
- `hybrid-search.md` - Combining with full-text search
- `metadata-filtering.md` - Advanced filter patterns
- `index-tuning.md` - HNSW parameter optimization
