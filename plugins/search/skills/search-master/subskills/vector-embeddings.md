---
name: vector-embeddings
description: Work with embeddings for semantic search. Use when building vector indices, choosing embedding models, or optimizing similarity search. Covers models, databases, distance metrics, and indexing strategies.
allowed-tools: Read, Bash, Glob, Grep, Task, WebFetch
---

# Vector Embeddings

Semantic representations for code search.

## What are Embeddings?

```
Text → [0.012, -0.834, 0.271, ..., 0.093]  # 768-3072 dimensions
       ↑
       Dense vector capturing semantic meaning
```

**Key Insight**: Similar meanings → Similar vectors → Close in vector space

## Embedding Models

### Comparison Table

| Model | Dimensions | Quality | Speed | Cost | Best For |
|-------|------------|---------|-------|------|----------|
| `text-embedding-3-small` | 1536 | Good | Fast | $0.02/1M | General use |
| `text-embedding-3-large` | 3072 | Excellent | Medium | $0.13/1M | High quality |
| `voyage-code-2` | 1536 | Excellent | Medium | $0.12/1M | Code-specific |
| `nomic-embed-text` | 768 | Good | Fast | Free (local) | Self-hosted |
| `all-MiniLM-L6-v2` | 384 | OK | Very fast | Free (local) | Speed critical |
| `bge-large-en-v1.5` | 1024 | Excellent | Medium | Free (local) | Open source best |
| `CodeBERT` | 768 | Good | Medium | Free (local) | Code understanding |

### Choosing a Model

```
Decision Tree:

Is cost a concern?
├── Yes → Local models (nomic-embed-text, bge-large)
└── No → Is it code-specific?
         ├── Yes → voyage-code-2 (best for code)
         └── No → text-embedding-3-large (best general)
```

## Using Embedding Models

### OpenAI

```python
from openai import OpenAI

client = OpenAI()

def embed_openai(texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
    """Embed texts using OpenAI."""
    response = client.embeddings.create(
        input=texts,
        model=model
    )
    return [item.embedding for item in response.data]

# Batch for efficiency
texts = ["function authenticate()", "class UserService", ...]
embeddings = embed_openai(texts)
```

### Sentence Transformers (Local)

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_local(texts: list[str]) -> list[list[float]]:
    """Embed texts locally."""
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()

# Supports batching automatically
embeddings = embed_local(["code snippet 1", "code snippet 2"])
```

### Ollama (Local)

```python
import ollama

def embed_ollama(texts: list[str], model: str = "nomic-embed-text") -> list[list[float]]:
    """Embed texts using Ollama."""
    embeddings = []
    for text in texts:
        response = ollama.embeddings(model=model, prompt=text)
        embeddings.append(response['embedding'])
    return embeddings

# Make sure model is pulled
# ollama pull nomic-embed-text
```

### Voyage AI (Code-Specific)

```python
import voyageai

client = voyageai.Client()

def embed_voyage(texts: list[str]) -> list[list[float]]:
    """Embed code using Voyage's code-specific model."""
    result = client.embed(texts, model="voyage-code-2")
    return result.embeddings
```

## Distance Metrics

### Cosine Similarity (Default for Text)

```python
import numpy as np

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """
    Range: -1 to 1 (1 = identical, 0 = orthogonal, -1 = opposite)
    Most common for text embeddings.
    """
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

### Euclidean Distance (L2)

```python
def euclidean_distance(a: list[float], b: list[float]) -> float:
    """
    Range: 0 to infinity (0 = identical)
    Good when magnitude matters.
    """
    a, b = np.array(a), np.array(b)
    return np.linalg.norm(a - b)
```

### Inner Product (Dot Product)

```python
def inner_product(a: list[float], b: list[float]) -> float:
    """
    Range: unbounded
    Fast, equivalent to cosine for normalized vectors.
    """
    a, b = np.array(a), np.array(b)
    return np.dot(a, b)
```

### When to Use Which

| Metric | Use When | Notes |
|--------|----------|-------|
| Cosine | Text similarity | Default choice, scale-invariant |
| L2 | Clustering, when magnitude matters | Penalizes large differences |
| Inner Product | Pre-normalized vectors | Fastest |

## Vector Databases

### pgvector (PostgreSQL)

```sql
-- Enable extension
CREATE EXTENSION vector;

-- Create table with vector column
CREATE TABLE code_embeddings (
    id SERIAL PRIMARY KEY,
    file_path TEXT,
    content TEXT,
    embedding VECTOR(1536)  -- Match your model's dimensions
);

-- Create index (HNSW recommended)
CREATE INDEX ON code_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Search
SELECT id, file_path, content,
       1 - (embedding <=> query_embedding) AS similarity
FROM code_embeddings
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

### pgvector with Python

```python
import psycopg
from pgvector.psycopg import register_vector

# Connect
conn = psycopg.connect("postgresql://user:pass@localhost/db")
register_vector(conn)

# Insert
cur = conn.cursor()
cur.execute(
    "INSERT INTO code_embeddings (file_path, content, embedding) VALUES (%s, %s, %s)",
    (file_path, content, embedding)
)

# Search
cur.execute("""
    SELECT file_path, content, 1 - (embedding <=> %s) AS similarity
    FROM code_embeddings
    ORDER BY embedding <=> %s
    LIMIT 10
""", (query_embedding, query_embedding))

results = cur.fetchall()
```

### Pinecone (Managed)

```python
from pinecone import Pinecone

pc = Pinecone(api_key="...")
index = pc.Index("code-search")

# Upsert
index.upsert(
    vectors=[
        {
            "id": "file1:1",
            "values": embedding,
            "metadata": {"file_path": "src/auth.py", "content": "..."}
        }
    ]
)

# Query
results = index.query(
    vector=query_embedding,
    top_k=10,
    include_metadata=True
)
```

### Qdrant (Self-Hosted or Cloud)

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = QdrantClient("localhost", port=6333)

# Create collection
client.create_collection(
    collection_name="code",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
)

# Insert
client.upsert(
    collection_name="code",
    points=[
        PointStruct(
            id=1,
            vector=embedding,
            payload={"file_path": "src/auth.py", "content": "..."}
        )
    ]
)

# Search
results = client.search(
    collection_name="code",
    query_vector=query_embedding,
    limit=10
)
```

### ChromaDB (Local, Simple)

```python
import chromadb

client = chromadb.Client()
collection = client.create_collection("code")

# Add documents (auto-embeds if you configure it)
collection.add(
    documents=["function auth()", "class User"],
    metadatas=[{"file": "auth.py"}, {"file": "user.py"}],
    ids=["1", "2"]
)

# Query
results = collection.query(
    query_texts=["authentication"],
    n_results=5
)
```

## Indexing Strategies

### HNSW (Hierarchical Navigable Small World)

```
Best for: Most use cases
Trade-off: More memory, faster search
Parameters:
- M: Number of connections per layer (16-64)
- ef_construction: Build quality (64-512)
- ef_search: Search quality vs speed (50-500)
```

```python
# pgvector HNSW
CREATE INDEX ON embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

# At query time
SET hnsw.ef_search = 100;  # Higher = better recall, slower
```

### IVFFlat (Inverted File with Flat)

```
Best for: Large datasets with memory constraints
Trade-off: Less memory, requires training
Parameters:
- lists: Number of clusters (sqrt(n) to n/1000)
- probes: Clusters to search (higher = better recall)
```

```python
# pgvector IVFFlat
CREATE INDEX ON embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

# At query time
SET ivfflat.probes = 10;  # Search 10 of 100 clusters
```

### When to Use Which

| Index | Best For | Memory | Build Time | Query Time |
|-------|----------|--------|------------|------------|
| HNSW | <10M vectors | High | Medium | Fast |
| IVFFlat | >10M vectors | Low | Fast | Medium |
| Flat | <100K vectors | Low | None | Slow |

## Optimizing Embeddings

### Dimensionality Reduction

```python
# Reduce dimensions while preserving similarity
# OpenAI models support this natively

def embed_reduced(texts: list[str], dimensions: int = 512) -> list[list[float]]:
    """Embed with reduced dimensions."""
    response = client.embeddings.create(
        input=texts,
        model="text-embedding-3-small",
        dimensions=dimensions  # Reduce from 1536 to 512
    )
    return [item.embedding for item in response.data]
```

### Binary Quantization

```python
def quantize_binary(embedding: list[float]) -> bytes:
    """
    Convert to binary: positive values → 1, negative → 0
    Reduces storage 32x, enables bitwise operations.
    """
    import numpy as np
    arr = np.array(embedding)
    bits = (arr > 0).astype(np.uint8)
    return np.packbits(bits).tobytes()

def hamming_distance(a: bytes, b: bytes) -> int:
    """Fast similarity for binary vectors."""
    return bin(int.from_bytes(a, 'big') ^ int.from_bytes(b, 'big')).count('1')
```

### Matryoshka Embeddings

```python
# OpenAI text-embedding-3 models support Matryoshka
# Use first N dimensions for approximate search, full for rerank

def two_stage_search(query: str, index, k: int = 10):
    """
    Stage 1: Fast search with reduced dimensions
    Stage 2: Rerank with full dimensions
    """
    # Get full embedding
    full_embedding = embed_openai([query], dimensions=1536)[0]

    # Stage 1: Use first 256 dims for fast search
    reduced = full_embedding[:256]
    candidates = index.search_reduced(reduced, k=k*5)

    # Stage 2: Rerank with full embedding
    full_scores = [cosine_similarity(full_embedding, c['embedding']) for c in candidates]
    reranked = sorted(zip(candidates, full_scores), key=lambda x: -x[1])

    return [c for c, s in reranked[:k]]
```

## Code-Specific Techniques

### Preprocessing Code for Better Embeddings

```python
def preprocess_code(code: str) -> str:
    """
    Normalize code for consistent embeddings.
    """
    import re

    # Remove comments (they can confuse semantic matching)
    code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)  # Python
    code = re.sub(r'//.*$', '', code, flags=re.MULTILINE)  # JS/TS
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)  # Multi-line

    # Normalize whitespace
    code = re.sub(r'\s+', ' ', code)

    # Optionally: Expand abbreviations, normalize naming

    return code.strip()
```

### Dual Embedding Strategy

```python
def dual_embed(code: str) -> dict:
    """
    Create two embeddings: raw code and natural language description.
    """
    # Embed the code directly
    code_embedding = embed(preprocess_code(code))

    # Generate and embed a description
    description = llm_describe(code)  # "This function validates user input..."
    desc_embedding = embed(description)

    return {
        'code_embedding': code_embedding,
        'desc_embedding': desc_embedding
    }

# At search time, can query either or combine
```

## Anti-Patterns

1. **Wrong dimensions**
   - Bad: Create index with wrong dimension size
   - Good: Match index to model output exactly

2. **No normalization**
   - Bad: Compare unnormalized vectors with inner product
   - Good: Normalize before storing, or use cosine distance

3. **Over-chunking**
   - Bad: Embed individual lines
   - Good: Embed semantic units (functions, classes)

4. **Ignoring metadata**
   - Bad: Store only embeddings
   - Good: Store file paths, types, line numbers

5. **No index optimization**
   - Bad: Flat search on 1M vectors
   - Good: HNSW or IVFFlat with tuned parameters

## Benchmarking Your Setup

```python
import time
import numpy as np

def benchmark_search(index, query_embeddings: list, k: int = 10, runs: int = 100):
    """Measure search performance."""

    latencies = []
    for query in query_embeddings[:runs]:
        start = time.time()
        results = index.search(query, k=k)
        latencies.append(time.time() - start)

    return {
        'p50_ms': np.percentile(latencies, 50) * 1000,
        'p95_ms': np.percentile(latencies, 95) * 1000,
        'p99_ms': np.percentile(latencies, 99) * 1000,
        'qps': 1 / np.mean(latencies)
    }

# Target: p95 < 50ms for interactive use
```
