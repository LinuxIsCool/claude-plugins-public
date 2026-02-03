# Vector Database Quickstart

## Purpose

Get started with vector databases for similarity search in under 10 minutes. This guide covers installation, basic operations, and choosing the right database for your use case.

## Variables

```yaml
EMBEDDING_DIM: 384          # all-MiniLM-L6-v2 dimensions
EMBEDDING_DIM_LARGE: 1536   # OpenAI ada-002 dimensions
DEFAULT_DISTANCE: cosine    # Most common for text embeddings
BATCH_SIZE: 100             # Optimal batch size for inserts
```

## Instructions

### Step 1: Choose Your Database

| Use Case | Database | Install Command |
|----------|----------|-----------------|
| Prototyping | ChromaDB | `pip install chromadb` |
| Embedded/Local | SQLite-vec | `pip install sqlite-vec` |
| Production | Qdrant | `pip install qdrant-client` |
| Existing Postgres | pgvector | `CREATE EXTENSION vector;` |
| High-scale | Milvus | Docker deployment |

### Step 2: Quick Installation

```bash
# Option A: ChromaDB (recommended for getting started)
pip install chromadb sentence-transformers

# Option B: All-in-one with agentmemory
pip install agentmemory

# Option C: Full stack with multiple backends
pip install chromadb qdrant-client faiss-cpu pgvector
```

### Step 3: Your First Vector Database

```python
import chromadb
from chromadb.utils import embedding_functions

# Initialize persistent database
client = chromadb.PersistentClient(path="./my_vector_db")

# Use sentence-transformers for embeddings
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Create a collection
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=embedding_fn,
    metadata={"hnsw:space": "cosine"}
)

# Add documents (embeddings generated automatically)
collection.add(
    documents=[
        "Vector databases store embeddings for similarity search",
        "ChromaDB is great for prototyping and local development",
        "Production systems often use Qdrant or pgvector"
    ],
    ids=["doc1", "doc2", "doc3"],
    metadatas=[
        {"source": "tutorial", "topic": "introduction"},
        {"source": "tutorial", "topic": "chromadb"},
        {"source": "tutorial", "topic": "production"}
    ]
)

# Query for similar documents
results = collection.query(
    query_texts=["Which database should I use in production?"],
    n_results=2
)

print(results["documents"])
# [['Production systems often use Qdrant or pgvector',
#   'ChromaDB is great for prototyping and local development']]
```

## Code Examples

### Example 1: Basic CRUD Operations

```python
import chromadb

client = chromadb.PersistentClient(path="./db")
collection = client.get_or_create_collection("memories")

# CREATE - Add documents
collection.add(
    documents=["First memory", "Second memory"],
    ids=["m1", "m2"],
    metadatas=[{"type": "note"}, {"type": "task"}]
)

# READ - Query similar documents
results = collection.query(
    query_texts=["find my notes"],
    n_results=5
)

# READ - Get by ID
docs = collection.get(ids=["m1"])

# UPDATE - Modify existing document
collection.update(
    ids=["m1"],
    documents=["Updated first memory"],
    metadatas=[{"type": "note", "updated": True}]
)

# DELETE - Remove documents
collection.delete(ids=["m2"])

# DELETE - Remove by filter
collection.delete(where={"type": "task"})
```

### Example 2: Pre-computed Embeddings

```python
from sentence_transformers import SentenceTransformer
import chromadb

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Generate embeddings
texts = ["Document one", "Document two", "Document three"]
embeddings = model.encode(texts).tolist()

# Store in ChromaDB
client = chromadb.PersistentClient(path="./db")
collection = client.get_or_create_collection("precomputed")

collection.add(
    embeddings=embeddings,
    documents=texts,
    ids=[f"doc_{i}" for i in range(len(texts))]
)

# Query with pre-computed embedding
query_embedding = model.encode(["search query"]).tolist()[0]
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=2
)
```

### Example 3: Metadata Filtering

```python
# Add documents with rich metadata
collection.add(
    documents=["Meeting notes from standup", "Project roadmap Q1"],
    ids=["d1", "d2"],
    metadatas=[
        {"type": "meeting", "date": "2024-01-15", "priority": 1},
        {"type": "planning", "date": "2024-01-10", "priority": 2}
    ]
)

# Query with filters
results = collection.query(
    query_texts=["planning documents"],
    n_results=5,
    where={"type": "planning"}  # Only planning documents
)

# Complex filters
results = collection.query(
    query_texts=["recent meetings"],
    n_results=5,
    where={
        "$and": [
            {"type": "meeting"},
            {"priority": {"$lte": 2}}
        ]
    }
)
```

## Performance Characteristics

| Operation | ChromaDB | Qdrant | pgvector | FAISS |
|-----------|----------|--------|----------|-------|
| Insert (1K docs) | ~2s | ~1s | ~3s | ~0.5s |
| Query (single) | ~50ms | ~10ms | ~20ms | ~5ms |
| Memory (100K docs) | ~500MB | ~200MB | ~300MB | ~100MB |
| Persistence | SQLite | Custom | Postgres | Manual |

### Latency Expectations

```
Small dataset (<10K vectors):
  - Any database will work well
  - Query latency: <100ms
  - Brute force (Flat index) is often fastest

Medium dataset (10K-1M vectors):
  - Use HNSW or IVF indexes
  - Query latency: 10-100ms
  - Index build time becomes noticeable

Large dataset (>1M vectors):
  - Consider distributed solutions (Milvus, Qdrant cluster)
  - Query latency: 1-50ms with proper tuning
  - Sharding and replication important
```

## When to Use This Pattern

**Use vector databases when:**
- Building semantic search over documents
- Implementing RAG (Retrieval Augmented Generation)
- Creating recommendation systems
- Building memory systems for AI agents
- Deduplicating content based on similarity

**Consider alternatives when:**
- Exact keyword matching is sufficient (use full-text search)
- Data is highly structured (use traditional databases)
- Real-time updates are critical (vector indexes have rebuild overhead)
- Dataset is tiny (<100 items) - a simple list with cosine similarity works

## Next Steps

1. **Choose your embedding model**: See `../embeddings/SKILL.md`
2. **Scale to production**: See `pgvector.md` or `chromadb.md`
3. **Optimize search quality**: See `hybrid-search.md`
4. **Tune for performance**: See `index-tuning.md`

## Common Pitfalls

```python
# WRONG: Creating new client for each operation
def search(query):
    client = chromadb.PersistentClient(path="./db")  # Expensive!
    collection = client.get_collection("docs")
    return collection.query(query_texts=[query])

# RIGHT: Reuse client connection
_client = None
def get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path="./db")
    return _client

def search(query):
    collection = get_client().get_collection("docs")
    return collection.query(query_texts=[query])
```

```python
# WRONG: Adding documents one at a time
for doc in documents:
    collection.add(documents=[doc], ids=[str(uuid4())])

# RIGHT: Batch operations
collection.add(
    documents=documents,
    ids=[str(uuid4()) for _ in documents]
)
```

```python
# WRONG: Ignoring distance metric mismatch
# If embeddings use cosine similarity, collection must too
collection = client.create_collection(
    name="docs",
    metadata={"hnsw:space": "l2"}  # Wrong for normalized embeddings!
)

# RIGHT: Match distance to embedding type
collection = client.create_collection(
    name="docs",
    metadata={"hnsw:space": "cosine"}  # Correct for text embeddings
)
```
