# FAISS Indexing Patterns

## Purpose

FAISS (Facebook AI Similarity Search) is the gold standard for high-performance vector similarity search. This cookbook covers index types, construction patterns, and production deployment strategies for Flat, HNSW, and IVF+PQ indexes.

## Variables

```yaml
FAISS_VERSION: "1.7.4"
CPU_PACKAGE: "faiss-cpu"
GPU_PACKAGE: "faiss-gpu"

# Index Parameters
FLAT_THRESHOLD: 10000           # Use Flat below this
HNSW_M: 32                      # Connections per node
HNSW_EF_CONSTRUCTION: 40        # Build quality
HNSW_EF_SEARCH: 16              # Search quality

IVF_NLIST_FORMULA: "4 * sqrt(n)"  # Number of clusters
IVF_NPROBE_DEFAULT: 10            # Clusters to search
PQ_M: 8                           # Subquantizers
PQ_NBITS: 8                       # Bits per subquantizer
```

## Instructions

### Installation

```bash
# CPU-only (recommended for most use cases)
pip install faiss-cpu

# GPU-accelerated (requires CUDA)
pip install faiss-gpu

# With numpy for data handling
pip install faiss-cpu numpy
```

### Index Type Selection

```
Dataset Size        Recommended Index       Memory vs Speed Trade-off
-----------         -----------------       -------------------------
< 10K vectors       Flat (IndexFlatL2)      Perfect recall, fast enough
10K - 100K          HNSW                    High recall, fast search
100K - 1M           IVF + Flat              Good recall, moderate memory
1M - 10M            IVF + PQ                Compressed, fast search
> 10M               IVF + PQ + GPU          Distributed, very fast
```

### Distance Metrics

```python
import faiss

# L2 (Euclidean) - Default, most common
index_l2 = faiss.IndexFlatL2(dimension)

# Inner Product (Cosine similarity for normalized vectors)
index_ip = faiss.IndexFlatIP(dimension)

# Note: For cosine similarity, normalize vectors first:
# faiss.normalize_L2(vectors)
# Then use IndexFlatIP
```

## Code Examples

### Index Type 1: Flat (Brute Force)

```python
"""
Flat Index: Exact search, no approximation.
Use for: Small datasets (<10K), benchmark baseline, when recall must be 100%
"""
import faiss
import numpy as np

class FlatIndex:
    """Exact nearest neighbor search using brute force."""

    def __init__(self, dimension: int, metric: str = "l2"):
        self.dimension = dimension
        self.metric = metric

        if metric == "l2":
            self.index = faiss.IndexFlatL2(dimension)
        elif metric == "cosine":
            self.index = faiss.IndexFlatIP(dimension)
        else:
            raise ValueError(f"Unknown metric: {metric}")

        self.ids = []

    def add(self, vectors: np.ndarray, ids: list = None):
        """Add vectors to index."""
        vectors = np.ascontiguousarray(vectors.astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(vectors)

        self.index.add(vectors)

        if ids:
            self.ids.extend(ids)
        else:
            start_id = len(self.ids)
            self.ids.extend(range(start_id, start_id + len(vectors)))

    def search(self, query: np.ndarray, k: int = 10):
        """Search for k nearest neighbors."""
        query = np.ascontiguousarray(query.reshape(1, -1).astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(query)

        distances, indices = self.index.search(query, k)

        results = []
        for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
            if idx != -1:  # -1 means no result
                results.append({
                    "id": self.ids[idx],
                    "distance": float(dist),
                    "index": int(idx)
                })

        return results

    @property
    def size(self) -> int:
        return self.index.ntotal


# Usage
index = FlatIndex(dimension=384, metric="cosine")
vectors = np.random.rand(1000, 384).astype('float32')
index.add(vectors)

query = np.random.rand(384).astype('float32')
results = index.search(query, k=5)
```

### Index Type 2: HNSW (Hierarchical Navigable Small World)

```python
"""
HNSW Index: Graph-based approximate search.
Use for: Medium datasets (10K-1M), when you need good recall with fast queries
"""
import faiss
import numpy as np


class HNSWIndex:
    """
    HNSW graph-based index for fast approximate search.

    Parameters:
        M: Number of connections per node (higher = better recall, more memory)
        ef_construction: Build quality (higher = better index, slower build)
        ef_search: Search quality (higher = better recall, slower search)
    """

    def __init__(
        self,
        dimension: int,
        M: int = 32,
        ef_construction: int = 40,
        ef_search: int = 16,
        metric: str = "l2"
    ):
        self.dimension = dimension
        self.metric = metric

        # Create base index
        if metric == "l2":
            self.index = faiss.IndexHNSWFlat(dimension, M)
        elif metric == "cosine":
            # For cosine, use IP on normalized vectors
            self.index = faiss.IndexHNSWFlat(dimension, M, faiss.METRIC_INNER_PRODUCT)
        else:
            raise ValueError(f"Unknown metric: {metric}")

        # Set parameters
        self.index.hnsw.efConstruction = ef_construction
        self.index.hnsw.efSearch = ef_search

        self.ids = []

    def add(self, vectors: np.ndarray, ids: list = None):
        """Add vectors to index (note: HNSW doesn't support removal)."""
        vectors = np.ascontiguousarray(vectors.astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(vectors)

        self.index.add(vectors)

        if ids:
            self.ids.extend(ids)
        else:
            start_id = len(self.ids)
            self.ids.extend(range(start_id, start_id + len(vectors)))

    def search(self, query: np.ndarray, k: int = 10, ef_search: int = None):
        """Search with optional dynamic ef_search adjustment."""
        query = np.ascontiguousarray(query.reshape(1, -1).astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(query)

        # Temporarily adjust ef_search if specified
        original_ef = self.index.hnsw.efSearch
        if ef_search:
            self.index.hnsw.efSearch = ef_search

        try:
            distances, indices = self.index.search(query, k)
        finally:
            self.index.hnsw.efSearch = original_ef

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1:
                results.append({
                    "id": self.ids[idx],
                    "distance": float(dist),
                    "index": int(idx)
                })

        return results

    def save(self, path: str):
        """Save index to file."""
        faiss.write_index(self.index, path)

    def load(self, path: str):
        """Load index from file."""
        self.index = faiss.read_index(path)

    @property
    def size(self) -> int:
        return self.index.ntotal


# Usage with parameter tuning
index = HNSWIndex(
    dimension=384,
    M=32,               # More connections = better recall
    ef_construction=64, # Higher = better index quality
    ef_search=32,       # Higher = better search quality
    metric="cosine"
)

# Add data
vectors = np.random.rand(100000, 384).astype('float32')
index.add(vectors)

# Search with dynamic quality adjustment
results = index.search(query, k=10, ef_search=64)  # Higher for important queries
```

### Index Type 3: IVF (Inverted File Index)

```python
"""
IVF Index: Cluster-based approximate search.
Use for: Large datasets (100K-10M), when you need memory efficiency
"""
import faiss
import numpy as np


class IVFIndex:
    """
    IVF index using Voronoi partitioning for fast search.

    Parameters:
        nlist: Number of clusters (rule of thumb: 4 * sqrt(n))
        nprobe: Clusters to search (higher = better recall, slower)
    """

    def __init__(
        self,
        dimension: int,
        nlist: int = 100,
        nprobe: int = 10,
        metric: str = "l2"
    ):
        self.dimension = dimension
        self.nlist = nlist
        self.nprobe = nprobe
        self.metric = metric
        self.is_trained = False

        # Create quantizer and index
        if metric == "l2":
            self.quantizer = faiss.IndexFlatL2(dimension)
            self.index = faiss.IndexIVFFlat(self.quantizer, dimension, nlist)
        elif metric == "cosine":
            self.quantizer = faiss.IndexFlatIP(dimension)
            self.index = faiss.IndexIVFFlat(
                self.quantizer, dimension, nlist, faiss.METRIC_INNER_PRODUCT
            )

        self.index.nprobe = nprobe
        self.ids = []

    def train(self, vectors: np.ndarray):
        """Train the index on representative data."""
        vectors = np.ascontiguousarray(vectors.astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(vectors)

        self.index.train(vectors)
        self.is_trained = True

    def add(self, vectors: np.ndarray, ids: list = None):
        """Add vectors (index must be trained first)."""
        if not self.is_trained:
            raise RuntimeError("Index must be trained before adding vectors")

        vectors = np.ascontiguousarray(vectors.astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(vectors)

        self.index.add(vectors)

        if ids:
            self.ids.extend(ids)
        else:
            start_id = len(self.ids)
            self.ids.extend(range(start_id, start_id + len(vectors)))

    def search(self, query: np.ndarray, k: int = 10, nprobe: int = None):
        """Search with optional dynamic nprobe adjustment."""
        query = np.ascontiguousarray(query.reshape(1, -1).astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(query)

        original_nprobe = self.index.nprobe
        if nprobe:
            self.index.nprobe = nprobe

        try:
            distances, indices = self.index.search(query, k)
        finally:
            self.index.nprobe = original_nprobe

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1:
                results.append({
                    "id": self.ids[idx],
                    "distance": float(dist),
                    "index": int(idx)
                })

        return results

    @property
    def size(self) -> int:
        return self.index.ntotal


# Usage
dimension = 384
n_vectors = 1000000

# Calculate optimal nlist
nlist = int(4 * np.sqrt(n_vectors))  # ~4000 for 1M vectors

index = IVFIndex(
    dimension=dimension,
    nlist=nlist,
    nprobe=32,  # Search 32 clusters
    metric="cosine"
)

# Train on subset (10-50x nlist is good)
training_data = np.random.rand(50000, dimension).astype('float32')
index.train(training_data)

# Add all data
all_data = np.random.rand(n_vectors, dimension).astype('float32')
index.add(all_data)

# Search
query = np.random.rand(dimension).astype('float32')
results = index.search(query, k=10, nprobe=64)  # Higher nprobe for better recall
```

### Index Type 4: IVF+PQ (Product Quantization)

```python
"""
IVF+PQ Index: Compressed vectors with cluster-based search.
Use for: Very large datasets (>1M), memory-constrained environments
"""
import faiss
import numpy as np


class IVFPQIndex:
    """
    IVF index with Product Quantization for memory efficiency.

    Memory savings: ~32x compression for typical settings.

    Parameters:
        nlist: Number of clusters
        m: Number of subquantizers (dimension must be divisible by m)
        nbits: Bits per subquantizer (usually 8)
    """

    def __init__(
        self,
        dimension: int,
        nlist: int = 100,
        m: int = 8,
        nbits: int = 8,
        nprobe: int = 10,
        metric: str = "l2"
    ):
        self.dimension = dimension
        self.nlist = nlist
        self.m = m
        self.nbits = nbits
        self.nprobe = nprobe
        self.metric = metric
        self.is_trained = False

        # Dimension must be divisible by m
        assert dimension % m == 0, f"dimension ({dimension}) must be divisible by m ({m})"

        # Create quantizer and index
        if metric == "l2":
            self.quantizer = faiss.IndexFlatL2(dimension)
            self.index = faiss.IndexIVFPQ(
                self.quantizer, dimension, nlist, m, nbits
            )
        elif metric == "cosine":
            self.quantizer = faiss.IndexFlatIP(dimension)
            self.index = faiss.IndexIVFPQ(
                self.quantizer, dimension, nlist, m, nbits,
                faiss.METRIC_INNER_PRODUCT
            )

        self.index.nprobe = nprobe
        self.ids = []

    def train(self, vectors: np.ndarray):
        """Train the index (requires substantial training data)."""
        vectors = np.ascontiguousarray(vectors.astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(vectors)

        # PQ needs more training data than IVF alone
        min_training = max(self.nlist * 40, 10000)
        if len(vectors) < min_training:
            print(f"Warning: {len(vectors)} training samples may be insufficient. "
                  f"Recommend at least {min_training}.")

        self.index.train(vectors)
        self.is_trained = True

    def add(self, vectors: np.ndarray, ids: list = None):
        """Add vectors (compresses automatically)."""
        if not self.is_trained:
            raise RuntimeError("Index must be trained before adding vectors")

        vectors = np.ascontiguousarray(vectors.astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(vectors)

        self.index.add(vectors)

        if ids:
            self.ids.extend(ids)
        else:
            start_id = len(self.ids)
            self.ids.extend(range(start_id, start_id + len(vectors)))

    def search(self, query: np.ndarray, k: int = 10, nprobe: int = None):
        """Search the compressed index."""
        query = np.ascontiguousarray(query.reshape(1, -1).astype('float32'))

        if self.metric == "cosine":
            faiss.normalize_L2(query)

        original_nprobe = self.index.nprobe
        if nprobe:
            self.index.nprobe = nprobe

        try:
            distances, indices = self.index.search(query, k)
        finally:
            self.index.nprobe = original_nprobe

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1:
                results.append({
                    "id": self.ids[idx],
                    "distance": float(dist),
                    "index": int(idx)
                })

        return results

    def memory_usage(self) -> dict:
        """Estimate memory usage."""
        n = self.index.ntotal
        # PQ codes: n * m bytes (for 8-bit quantization)
        pq_memory = n * self.m
        # Centroids: nlist * dimension * 4 bytes
        centroid_memory = self.nlist * self.dimension * 4
        # PQ codebook: 256 * m * (dimension / m) * 4 bytes
        codebook_memory = 256 * self.dimension * 4

        return {
            "pq_codes_mb": pq_memory / 1_000_000,
            "centroids_mb": centroid_memory / 1_000_000,
            "codebook_mb": codebook_memory / 1_000_000,
            "total_mb": (pq_memory + centroid_memory + codebook_memory) / 1_000_000,
            "compression_ratio": (n * self.dimension * 4) / (pq_memory + centroid_memory + codebook_memory)
        }

    @property
    def size(self) -> int:
        return self.index.ntotal


# Usage for large-scale deployment
dimension = 384
n_vectors = 10_000_000

index = IVFPQIndex(
    dimension=dimension,
    nlist=int(4 * np.sqrt(n_vectors)),  # ~12649 clusters
    m=48,       # 48 subquantizers (384 / 48 = 8 dims each)
    nbits=8,    # 8 bits per subquantizer
    nprobe=64,
    metric="cosine"
)

# Train on substantial subset
training_data = np.random.rand(500000, dimension).astype('float32')
index.train(training_data)

print(index.memory_usage())
# {'pq_codes_mb': 480.0, 'centroids_mb': 19.4, 'codebook_mb': 0.4, 'total_mb': 499.8, 'compression_ratio': 30.6}
```

### Composite Index Factory

```python
"""
Use FAISS index_factory for common index configurations.
"""
import faiss
import numpy as np


def create_index(
    dimension: int,
    n_vectors: int,
    priority: str = "balanced"
) -> faiss.Index:
    """
    Create optimal index based on dataset size and priority.

    Args:
        dimension: Vector dimension
        n_vectors: Expected number of vectors
        priority: "speed", "memory", "recall", or "balanced"

    Returns:
        Configured FAISS index
    """
    # Index factory strings
    if n_vectors < 10_000:
        # Small: exact search
        index_string = "Flat"

    elif n_vectors < 100_000:
        # Medium: HNSW
        if priority == "speed":
            index_string = "HNSW32"
        elif priority == "recall":
            index_string = "HNSW64"
        else:
            index_string = "HNSW32"

    elif n_vectors < 1_000_000:
        # Large: IVF
        nlist = int(4 * np.sqrt(n_vectors))
        if priority == "speed":
            index_string = f"IVF{nlist},Flat"
        elif priority == "memory":
            m = dimension // 8
            index_string = f"IVF{nlist},PQ{m}"
        elif priority == "recall":
            index_string = f"IVF{nlist},Flat"
        else:
            index_string = f"IVF{nlist},Flat"

    else:
        # Very large: IVF+PQ
        nlist = int(4 * np.sqrt(n_vectors))
        m = dimension // 8
        if priority == "speed":
            index_string = f"IVF{nlist},PQ{m}x8"
        elif priority == "memory":
            index_string = f"OPQ{m},IVF{nlist},PQ{m}x8"  # With rotation
        elif priority == "recall":
            index_string = f"IVF{nlist * 2},PQ{m}x8"
        else:
            index_string = f"IVF{nlist},PQ{m}x8"

    print(f"Creating index: {index_string}")
    return faiss.index_factory(dimension, index_string)


# Usage
index = create_index(384, 5_000_000, priority="balanced")
# Creating index: IVF8944,PQ48x8

# Train and use
training_data = np.random.rand(100000, 384).astype('float32')
index.train(training_data)
```

## Performance Characteristics

### Index Comparison (1M vectors, 384 dimensions)

| Index Type | Build Time | Query Time | Memory | Recall@10 |
|------------|------------|------------|--------|-----------|
| Flat | N/A | 50ms | 1.5GB | 100% |
| HNSW32 | 5min | 0.5ms | 2.5GB | 98% |
| IVF4096,Flat | 30s | 2ms | 1.6GB | 95% |
| IVF4096,PQ48 | 2min | 1ms | 100MB | 85% |
| OPQ48,IVF4096,PQ48 | 5min | 1ms | 100MB | 90% |

### Memory Formulas

```python
def estimate_memory(n_vectors: int, dimension: int, index_type: str) -> float:
    """Estimate memory in MB."""

    if index_type == "flat":
        # Raw vectors: n * d * 4 bytes
        return n_vectors * dimension * 4 / 1_000_000

    elif index_type == "hnsw":
        # Vectors + graph (~1.5x overhead)
        return n_vectors * dimension * 4 * 1.5 / 1_000_000

    elif index_type == "ivf_flat":
        # Vectors + cluster info
        return n_vectors * dimension * 4 * 1.05 / 1_000_000

    elif index_type == "ivf_pq":
        m = dimension // 8  # subquantizers
        # PQ codes (m bytes per vector) + overhead
        return (n_vectors * m + 10_000_000) / 1_000_000

    return 0

# Examples
print(estimate_memory(1_000_000, 384, "flat"))     # ~1536 MB
print(estimate_memory(1_000_000, 384, "hnsw"))     # ~2304 MB
print(estimate_memory(1_000_000, 384, "ivf_pq"))   # ~58 MB
```

### Query Latency by nprobe/efSearch

```
IVF Index (1M vectors, 4096 clusters):
nprobe=1:   0.2ms, recall=60%
nprobe=8:   0.8ms, recall=85%
nprobe=32:  2.5ms, recall=95%
nprobe=128: 8ms,   recall=99%

HNSW Index (1M vectors, M=32):
efSearch=16:  0.3ms, recall=90%
efSearch=32:  0.5ms, recall=95%
efSearch=64:  0.8ms, recall=98%
efSearch=128: 1.5ms, recall=99%
```

## When to Use This Pattern

**FAISS excels at:**
- Maximum query performance requirements
- Very large datasets (10M+ vectors)
- GPU-accelerated search
- Research and benchmarking
- Custom index configurations

**Consider alternatives when:**
- Need built-in persistence (use ChromaDB or Qdrant)
- Need metadata filtering (FAISS is vectors-only)
- Need easy deployment (FAISS requires manual management)
- Need distributed search (use Milvus or Qdrant)

## Persistence and Serialization

```python
import faiss
import pickle

# Save index
faiss.write_index(index, "my_index.faiss")

# Load index
loaded_index = faiss.read_index("my_index.faiss")

# Save with ID mapping (FAISS doesn't store IDs natively)
def save_index_with_ids(index, ids, path):
    faiss.write_index(index, f"{path}.faiss")
    with open(f"{path}.ids", 'wb') as f:
        pickle.dump(ids, f)

def load_index_with_ids(path):
    index = faiss.read_index(f"{path}.faiss")
    with open(f"{path}.ids", 'rb') as f:
        ids = pickle.load(f)
    return index, ids
```

## Related Cookbooks

- `quickstart.md` - Getting started basics
- `index-tuning.md` - Parameter optimization details
- `chromadb.md` - For metadata filtering needs
- `hybrid-search.md` - Combining with full-text search
