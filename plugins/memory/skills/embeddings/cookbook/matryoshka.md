# Purpose

Matryoshka Representation Learning (MRL) produces embeddings that can be truncated to any prefix length while preserving semantic quality. This enables adaptive precision: use full dimensions for accuracy, truncated dimensions for speed.

## Variables

MRL_MODELS: nomic-embed-text, mxbai-embed-large, text-embedding-3-small, Qwen3-Embedding
TRUNCATION_LEVELS: [64, 128, 256, 512, 768, 1024]
QUALITY_RETENTION_256: ~95%
QUALITY_RETENTION_128: ~90%
QUALITY_RETENTION_64: ~80%

## Instructions

### What is Matryoshka?

Traditional embeddings require fixed dimensions. Matryoshka embeddings encode information hierarchically:

```
Full embedding (768 dims): [x1, x2, x3, ..., x768]
                            ↑
                            Most important information first

Truncated (256 dims):       [x1, x2, x3, ..., x256]
                            ↑
                            Still captures ~95% of semantic meaning
```

**Benefits:**
- **Storage savings**: 3-12x reduction in vector storage
- **Faster search**: Smaller vectors = faster similarity computation
- **Adaptive precision**: Use different sizes for different use cases
- **No retraining**: Single model, multiple deployment options

### Supported Models

| Model | Max Dims | Matryoshka? | Truncation Levels |
|-------|----------|-------------|-------------------|
| nomic-embed-text | 768 | Native | 64, 128, 256, 512, 768 |
| mxbai-embed-large | 1024 | Native | 64, 128, 256, 512, 1024 |
| text-embedding-3-small | 1536 | API param | Any (via dimensions param) |
| text-embedding-3-large | 3072 | API param | Any (via dimensions param) |
| Qwen3-Embedding | 1024-4096 | Native | Various |

### Basic Usage

#### Using nomic-embed-text (Ollama)

```python
import ollama
import numpy as np

def get_matryoshka_embedding(
    text: str,
    dimensions: int = 768,
    model: str = "nomic-embed-text"
) -> list[float]:
    """
    Get Matryoshka embedding with optional truncation.

    Args:
        text: Input text
        dimensions: Desired output dimensions (64, 128, 256, 512, 768)
        model: Ollama model name
    """
    response = ollama.embeddings(model=model, prompt=text)
    embedding = response['embedding']

    # Truncate to desired dimensions
    if dimensions < len(embedding):
        embedding = embedding[:dimensions]

    # Optional: re-normalize after truncation
    norm = np.linalg.norm(embedding)
    embedding = (np.array(embedding) / norm).tolist()

    return embedding

# Full precision
full_emb = get_matryoshka_embedding("Machine learning is powerful", dimensions=768)
print(f"Full: {len(full_emb)} dims")

# Compressed for fast search
small_emb = get_matryoshka_embedding("Machine learning is powerful", dimensions=128)
print(f"Small: {len(small_emb)} dims")
```

#### Using text-embedding-3 (OpenAI)

```python
from openai import OpenAI

client = OpenAI()

def get_openai_matryoshka(
    text: str,
    dimensions: int = 1536,
    model: str = "text-embedding-3-small"
) -> list[float]:
    """
    Get OpenAI embedding with native dimension reduction.

    Note: OpenAI applies MRL during generation, so truncation
    is handled server-side for optimal quality.
    """
    response = client.embeddings.create(
        input=text,
        model=model,
        dimensions=dimensions  # Native MRL support
    )
    return response.data[0].embedding

# Standard dimensions
standard = get_openai_matryoshka("Hello world", dimensions=1536)
print(f"Standard: {len(standard)} dims, {len(standard) * 4 / 1024:.1f} KB")

# Compressed
compressed = get_openai_matryoshka("Hello world", dimensions=256)
print(f"Compressed: {len(compressed)} dims, {len(compressed) * 4 / 1024:.1f} KB")
```

#### Using sentence-transformers

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# Load a Matryoshka-trained model
model = SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')

def get_matryoshka_embeddings(
    texts: list[str],
    dimensions: int = 768,
    normalize: bool = True
) -> np.ndarray:
    """
    Get Matryoshka embeddings with truncation.
    """
    # Generate full embeddings
    embeddings = model.encode(texts, normalize_embeddings=False)

    # Truncate
    if dimensions < embeddings.shape[1]:
        embeddings = embeddings[:, :dimensions]

    # Re-normalize if requested
    if normalize:
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        embeddings = embeddings / norms

    return embeddings

# Multiple dimension variants
texts = ["Document one", "Document two"]
for dims in [64, 128, 256, 512, 768]:
    embs = get_matryoshka_embeddings(texts, dimensions=dims)
    print(f"{dims} dims: shape={embs.shape}, storage={dims * 4 / 1024:.1f} KB/doc")
```

### Quality vs Dimensions Analysis

```python
from sentence_transformers import SentenceTransformer, util
import numpy as np

model = SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')

def analyze_matryoshka_quality(test_pairs: list[tuple[str, str]]):
    """
    Analyze how similarity scores change with truncation.
    """
    results = {}

    for dims in [64, 128, 256, 512, 768]:
        similarities = []

        for text1, text2 in test_pairs:
            emb1 = model.encode(text1)[:dims]
            emb2 = model.encode(text2)[:dims]

            # Normalize
            emb1 = emb1 / np.linalg.norm(emb1)
            emb2 = emb2 / np.linalg.norm(emb2)

            similarity = np.dot(emb1, emb2)
            similarities.append(similarity)

        results[dims] = np.mean(similarities)

    return results

# Test pairs (semantically similar)
test_pairs = [
    ("Machine learning uses algorithms", "AI relies on computational methods"),
    ("Python is a programming language", "Python is used for coding"),
    ("The weather is sunny today", "It's a bright and clear day"),
]

quality = analyze_matryoshka_quality(test_pairs)
baseline = quality[768]

print("Dimension | Avg Similarity | Quality Retention")
print("-" * 50)
for dims, score in quality.items():
    retention = (score / baseline) * 100
    print(f"{dims:8d} | {score:.4f}       | {retention:.1f}%")
```

**Typical Results:**

| Dimensions | Quality Retention | Storage (per doc) |
|------------|-------------------|-------------------|
| 768 | 100% | 3 KB |
| 512 | ~98% | 2 KB |
| 256 | ~95% | 1 KB |
| 128 | ~90% | 0.5 KB |
| 64 | ~80% | 0.25 KB |

### Two-Stage Retrieval Pattern

Use Matryoshka for efficient two-stage retrieval:

```python
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Tuple

model = SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')

class MatryoshkaRetriever:
    """
    Two-stage retriever using Matryoshka embeddings.

    Stage 1: Fast coarse search with truncated embeddings
    Stage 2: Accurate reranking with full embeddings
    """

    def __init__(
        self,
        coarse_dims: int = 128,
        fine_dims: int = 768,
        coarse_top_k: int = 100,
        final_top_k: int = 10
    ):
        self.coarse_dims = coarse_dims
        self.fine_dims = fine_dims
        self.coarse_top_k = coarse_top_k
        self.final_top_k = final_top_k

        self.corpus = []
        self.coarse_embeddings = None
        self.fine_embeddings = None

    def index(self, documents: List[str]):
        """Index documents with both coarse and fine embeddings."""
        self.corpus = documents

        # Generate full embeddings once
        full_embeddings = model.encode(documents, normalize_embeddings=False)

        # Store both truncated and full versions
        self.coarse_embeddings = full_embeddings[:, :self.coarse_dims]
        self.fine_embeddings = full_embeddings[:, :self.fine_dims]

        # Normalize
        self.coarse_embeddings = self.coarse_embeddings / np.linalg.norm(
            self.coarse_embeddings, axis=1, keepdims=True
        )
        self.fine_embeddings = self.fine_embeddings / np.linalg.norm(
            self.fine_embeddings, axis=1, keepdims=True
        )

        print(f"Indexed {len(documents)} documents")
        print(f"  Coarse storage: {self.coarse_embeddings.nbytes / 1024:.1f} KB")
        print(f"  Fine storage: {self.fine_embeddings.nbytes / 1024:.1f} KB")

    def search(self, query: str) -> List[Tuple[int, float, str]]:
        """
        Two-stage search.

        Returns: List of (index, score, document)
        """
        # Generate query embedding
        query_full = model.encode(query, normalize_embeddings=False)
        query_coarse = query_full[:self.coarse_dims]
        query_fine = query_full[:self.fine_dims]

        # Normalize
        query_coarse = query_coarse / np.linalg.norm(query_coarse)
        query_fine = query_fine / np.linalg.norm(query_fine)

        # Stage 1: Fast coarse retrieval
        coarse_scores = self.coarse_embeddings @ query_coarse
        coarse_top_indices = np.argsort(coarse_scores)[-self.coarse_top_k:][::-1]

        # Stage 2: Rerank with fine embeddings
        fine_scores = self.fine_embeddings[coarse_top_indices] @ query_fine
        rerank_order = np.argsort(fine_scores)[-self.final_top_k:][::-1]

        # Get final results
        results = []
        for i in rerank_order:
            idx = coarse_top_indices[i]
            score = fine_scores[i]
            results.append((idx, score, self.corpus[idx]))

        return results

# Usage
corpus = [
    "Python is a versatile programming language",
    "Machine learning transforms data into insights",
    "Docker containers isolate application environments",
    "Git enables version control for code",
    "APIs provide interfaces between systems",
    # ... more documents
]

retriever = MatryoshkaRetriever(
    coarse_dims=128,   # Fast initial filtering
    fine_dims=768,     # Accurate reranking
    coarse_top_k=50,
    final_top_k=5
)

retriever.index(corpus)

results = retriever.search("How do I manage code versions?")
for idx, score, doc in results:
    print(f"[{score:.4f}] {doc}")
```

### Storage Optimization

```python
import numpy as np
from pathlib import Path

class MatryoshkaStorage:
    """
    Efficient storage for Matryoshka embeddings.
    Store at multiple resolutions for flexible retrieval.
    """

    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save_multi_resolution(
        self,
        embeddings: np.ndarray,
        resolutions: list[int] = [64, 128, 256, 768]
    ):
        """Save embeddings at multiple resolutions."""
        for res in resolutions:
            truncated = embeddings[:, :res].astype(np.float16)  # Half precision
            np.save(self.base_path / f"embeddings_{res}.npy", truncated)

            size_mb = truncated.nbytes / (1024 * 1024)
            print(f"Saved {res} dims: {size_mb:.2f} MB")

    def load_resolution(self, resolution: int) -> np.ndarray:
        """Load embeddings at specific resolution."""
        path = self.base_path / f"embeddings_{resolution}.npy"
        return np.load(path).astype(np.float32)

    def get_storage_summary(self) -> dict:
        """Get storage usage by resolution."""
        summary = {}
        for path in self.base_path.glob("embeddings_*.npy"):
            res = int(path.stem.split("_")[1])
            size_mb = path.stat().st_size / (1024 * 1024)
            summary[res] = size_mb
        return summary

# Usage
storage = MatryoshkaStorage("./matryoshka_index")

# Generate embeddings
model = SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')
corpus = ["doc " + str(i) for i in range(100000)]
embeddings = model.encode(corpus, show_progress_bar=True)

# Save at multiple resolutions
storage.save_multi_resolution(embeddings, [64, 128, 256, 768])

# Load appropriate resolution for use case
fast_search_embs = storage.load_resolution(128)  # For speed
accurate_embs = storage.load_resolution(768)     # For accuracy

print(storage.get_storage_summary())
```

### Training Custom Matryoshka Models

```python
from sentence_transformers import SentenceTransformer, losses
from sentence_transformers.losses import MatryoshkaLoss
from torch.utils.data import DataLoader

def train_matryoshka_model(
    base_model: str = "microsoft/mpnet-base",
    train_data: list,
    output_path: str = "./matryoshka_model",
    matryoshka_dims: list = [768, 512, 256, 128, 64]
):
    """
    Fine-tune a model with Matryoshka loss for multi-resolution embeddings.
    """
    model = SentenceTransformer(base_model)

    # Wrap your base loss with MatryoshkaLoss
    base_loss = losses.MultipleNegativesRankingLoss(model)
    matryoshka_loss = MatryoshkaLoss(
        model=model,
        loss=base_loss,
        matryoshka_dims=matryoshka_dims
    )

    # Create DataLoader
    train_dataloader = DataLoader(train_data, shuffle=True, batch_size=32)

    # Train
    model.fit(
        train_objectives=[(train_dataloader, matryoshka_loss)],
        epochs=10,
        warmup_steps=100,
        output_path=output_path
    )

    return model

# Note: Requires appropriate training data (InputExample format)
# See sentence-transformers documentation for data preparation
```

### Vector Database Integration

#### ChromaDB with Adaptive Dimensions

```python
import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('nomic-ai/nomic-embed-text-v1.5')

class MatryoshkaChromaCollection:
    """ChromaDB collection with Matryoshka support."""

    def __init__(self, name: str, dimensions: int = 256):
        self.client = chromadb.PersistentClient(path="./chroma_matryoshka")
        self.dimensions = dimensions
        self.collection = self.client.get_or_create_collection(
            name=f"{name}_{dimensions}d",
            metadata={"hnsw:space": "cosine"}
        )

    def add(self, documents: list[str], ids: list[str]):
        embeddings = model.encode(documents, normalize_embeddings=False)
        truncated = embeddings[:, :self.dimensions]
        truncated = truncated / np.linalg.norm(truncated, axis=1, keepdims=True)

        self.collection.add(
            embeddings=truncated.tolist(),
            documents=documents,
            ids=ids
        )

    def query(self, query: str, n_results: int = 10):
        query_emb = model.encode(query, normalize_embeddings=False)
        query_truncated = query_emb[:self.dimensions]
        query_truncated = query_truncated / np.linalg.norm(query_truncated)

        return self.collection.query(
            query_embeddings=[query_truncated.tolist()],
            n_results=n_results
        )

# Create collections at different resolutions
fast_collection = MatryoshkaChromaCollection("docs", dimensions=128)
accurate_collection = MatryoshkaChromaCollection("docs", dimensions=768)
```

## Performance Characteristics

### Search Speed by Dimension

| Dimensions | Search Time (1M vectors) | Memory |
|------------|--------------------------|--------|
| 64 | ~5ms | 250 MB |
| 128 | ~10ms | 500 MB |
| 256 | ~20ms | 1 GB |
| 512 | ~40ms | 2 GB |
| 768 | ~60ms | 3 GB |

*Using brute-force cosine similarity. HNSW/IVF indexes provide additional speedup.*

### Quality Retention by Task

| Task | 256d Quality | 128d Quality | 64d Quality |
|------|--------------|--------------|-------------|
| Semantic Search | 95% | 90% | 80% |
| Clustering | 93% | 87% | 75% |
| Classification | 97% | 94% | 88% |

### Storage Savings

```
1M documents:
  768 dims: 3 GB
  256 dims: 1 GB (67% savings)
  128 dims: 0.5 GB (83% savings)
  64 dims: 0.25 GB (92% savings)
```

## Next Steps

- **Model Selection**: See `cookbook/model-selection.md` for choosing MRL models
- **ONNX Optimization**: See `cookbook/onnx-optimization.md` for faster inference
- **Batch Processing**: See `cookbook/batch-processing.md` for large-scale indexing
- **Benchmarking**: Use `tools/embedding_benchmark.py` to test dimension tradeoffs
