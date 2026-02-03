# HNSW and IVF Index Parameter Optimization

## Purpose

Index parameters dramatically affect search quality, speed, and memory usage. This cookbook provides systematic guidance for tuning HNSW and IVF indexes across different vector databases, including benchmarking strategies and production recommendations.

## Variables

```yaml
# HNSW Parameters
HNSW_M_DEFAULT: 16              # Connections per node
HNSW_M_HIGH_RECALL: 32          # For quality-critical applications
HNSW_M_LOW_MEMORY: 8            # For memory-constrained environments

HNSW_EF_CONSTRUCTION_DEFAULT: 100
HNSW_EF_CONSTRUCTION_HIGH: 200
HNSW_EF_CONSTRUCTION_LOW: 40

HNSW_EF_SEARCH_DEFAULT: 50
HNSW_EF_SEARCH_HIGH: 100
HNSW_EF_SEARCH_LOW: 16

# IVF Parameters
IVF_NLIST_FORMULA: "4 * sqrt(n_vectors)"
IVF_NPROBE_DEFAULT: 10
IVF_NPROBE_HIGH_RECALL: 50
IVF_NPROBE_FAST: 1

# PQ Parameters
PQ_M_FORMULA: "dimension / 8"
PQ_NBITS_DEFAULT: 8
```

## Instructions

### Understanding the Trade-offs

```
HNSW Trade-offs:
┌─────────────────┬────────────┬────────────┬─────────────┐
│ Parameter       │ Higher     │ Lower      │ Affects     │
├─────────────────┼────────────┼────────────┼─────────────┤
│ M               │ ↑ Recall   │ ↓ Memory   │ Graph conn. │
│                 │ ↑ Memory   │ ↓ Recall   │             │
├─────────────────┼────────────┼────────────┼─────────────┤
│ ef_construction │ ↑ Quality  │ ↓ Build    │ Index build │
│                 │ ↑ Time     │ ↓ Quality  │             │
├─────────────────┼────────────┼────────────┼─────────────┤
│ ef_search       │ ↑ Recall   │ ↓ Latency  │ Query time  │
│                 │ ↑ Latency  │ ↓ Recall   │             │
└─────────────────┴────────────┴────────────┴─────────────┘

IVF Trade-offs:
┌─────────────────┬────────────┬────────────┬─────────────┐
│ Parameter       │ Higher     │ Lower      │ Affects     │
├─────────────────┼────────────┼────────────┼─────────────┤
│ nlist           │ ↓ Recall   │ ↑ Recall   │ Partitions  │
│                 │ ↓ Latency  │ ↑ Latency  │             │
├─────────────────┼────────────┼────────────┼─────────────┤
│ nprobe          │ ↑ Recall   │ ↓ Latency  │ Query time  │
│                 │ ↑ Latency  │ ↓ Recall   │             │
└─────────────────┴────────────┴────────────┴─────────────┘
```

### Quick Reference: Starting Points

| Dataset Size | Index Type | M | ef_construction | ef_search | nlist | nprobe |
|--------------|------------|---|-----------------|-----------|-------|--------|
| <10K | Flat | - | - | - | - | - |
| 10K-100K | HNSW | 16 | 100 | 50 | - | - |
| 100K-1M | HNSW | 32 | 200 | 100 | - | - |
| 100K-1M | IVF | - | - | - | 1000 | 10 |
| 1M-10M | IVF | - | - | - | 4000 | 32 |
| >10M | IVF+PQ | - | - | - | 10000 | 64 |

## Code Examples

### HNSW Parameter Tuning

```python
"""
Systematic HNSW parameter optimization with benchmarking.
"""
import numpy as np
import time
from typing import List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class BenchmarkResult:
    """Results from a parameter configuration benchmark."""
    m: int
    ef_construction: int
    ef_search: int
    build_time: float
    query_time_ms: float
    recall_at_10: float
    memory_mb: float


def compute_recall(
    ground_truth: np.ndarray,  # True nearest neighbors
    predictions: np.ndarray,   # Predicted nearest neighbors
    k: int = 10
) -> float:
    """Compute recall@k."""
    correct = 0
    for gt, pred in zip(ground_truth, predictions):
        correct += len(set(gt[:k]) & set(pred[:k]))
    return correct / (len(ground_truth) * k)


def tune_hnsw_chromadb(
    vectors: np.ndarray,
    queries: np.ndarray,
    ground_truth: np.ndarray,
    m_values: List[int] = [8, 16, 32, 48],
    ef_construction_values: List[int] = [40, 100, 200],
    ef_search_values: List[int] = [16, 50, 100, 200]
) -> List[BenchmarkResult]:
    """
    Benchmark HNSW parameters in ChromaDB.

    Args:
        vectors: Dataset vectors (n_vectors, dimension)
        queries: Query vectors (n_queries, dimension)
        ground_truth: True nearest neighbors for queries
        m_values: M parameter values to test
        ef_construction_values: ef_construction values to test
        ef_search_values: ef_search values to test

    Returns:
        List of benchmark results sorted by recall
    """
    import chromadb

    results = []
    dimension = vectors.shape[1]

    for m in m_values:
        for ef_construction in ef_construction_values:
            # Build index
            client = chromadb.EphemeralClient()

            start_time = time.time()
            collection = client.create_collection(
                name="benchmark",
                metadata={
                    "hnsw:space": "cosine",
                    "hnsw:M": m,
                    "hnsw:construction_ef": ef_construction
                }
            )

            # Add vectors in batches
            batch_size = 1000
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i+batch_size]
                collection.add(
                    embeddings=batch.tolist(),
                    ids=[str(j) for j in range(i, i+len(batch))]
                )

            build_time = time.time() - start_time

            # Test different ef_search values
            for ef_search in ef_search_values:
                # Note: ChromaDB doesn't expose ef_search directly
                # In practice, you'd need to modify the collection metadata
                # This is a simplified benchmark

                # Query
                start_time = time.time()
                all_results = []
                for query in queries:
                    result = collection.query(
                        query_embeddings=[query.tolist()],
                        n_results=10
                    )
                    # Convert IDs back to indices
                    all_results.append([int(id_) for id_ in result["ids"][0]])

                query_time = (time.time() - start_time) / len(queries) * 1000

                # Compute recall
                recall = compute_recall(ground_truth, np.array(all_results))

                # Estimate memory (simplified)
                memory_mb = (vectors.nbytes + m * len(vectors) * 8) / 1_000_000

                results.append(BenchmarkResult(
                    m=m,
                    ef_construction=ef_construction,
                    ef_search=ef_search,
                    build_time=build_time,
                    query_time_ms=query_time,
                    recall_at_10=recall,
                    memory_mb=memory_mb
                ))

            # Cleanup
            client.delete_collection("benchmark")

    return sorted(results, key=lambda x: x.recall_at_10, reverse=True)


def tune_hnsw_faiss(
    vectors: np.ndarray,
    queries: np.ndarray,
    ground_truth: np.ndarray,
    m_values: List[int] = [8, 16, 32, 48],
    ef_construction_values: List[int] = [40, 100, 200],
    ef_search_values: List[int] = [16, 50, 100, 200]
) -> List[BenchmarkResult]:
    """Benchmark HNSW parameters in FAISS."""
    import faiss

    results = []
    dimension = vectors.shape[1]

    for m in m_values:
        for ef_construction in ef_construction_values:
            # Build index
            index = faiss.IndexHNSWFlat(dimension, m)
            index.hnsw.efConstruction = ef_construction

            start_time = time.time()
            index.add(vectors.astype('float32'))
            build_time = time.time() - start_time

            for ef_search in ef_search_values:
                index.hnsw.efSearch = ef_search

                # Query
                start_time = time.time()
                distances, indices = index.search(queries.astype('float32'), 10)
                query_time = (time.time() - start_time) / len(queries) * 1000

                # Compute recall
                recall = compute_recall(ground_truth, indices)

                # Memory estimate
                memory_mb = (vectors.nbytes + m * len(vectors) * 8) / 1_000_000

                results.append(BenchmarkResult(
                    m=m,
                    ef_construction=ef_construction,
                    ef_search=ef_search,
                    build_time=build_time,
                    query_time_ms=query_time,
                    recall_at_10=recall,
                    memory_mb=memory_mb
                ))

    return sorted(results, key=lambda x: x.recall_at_10, reverse=True)


# Example usage
def run_hnsw_benchmark():
    """Run a complete HNSW benchmark."""
    np.random.seed(42)

    # Generate test data
    n_vectors = 100000
    n_queries = 1000
    dimension = 384

    vectors = np.random.rand(n_vectors, dimension).astype('float32')
    queries = np.random.rand(n_queries, dimension).astype('float32')

    # Compute ground truth with brute force
    import faiss
    flat_index = faiss.IndexFlatL2(dimension)
    flat_index.add(vectors)
    _, ground_truth = flat_index.search(queries, 10)

    # Run benchmark
    results = tune_hnsw_faiss(
        vectors, queries, ground_truth,
        m_values=[16, 32, 48],
        ef_construction_values=[64, 128, 200],
        ef_search_values=[32, 64, 128]
    )

    # Print results
    print("\nTop configurations by recall:")
    print("-" * 80)
    print(f"{'M':>4} {'ef_c':>6} {'ef_s':>6} {'Build(s)':>10} {'Query(ms)':>10} {'Recall@10':>10} {'Mem(MB)':>10}")
    print("-" * 80)

    for r in results[:10]:
        print(f"{r.m:4d} {r.ef_construction:6d} {r.ef_search:6d} {r.build_time:10.2f} {r.query_time_ms:10.2f} {r.recall_at_10:10.4f} {r.memory_mb:10.1f}")

    # Find Pareto-optimal configurations
    print("\nPareto-optimal (recall vs latency):")
    pareto = find_pareto_optimal(results)
    for r in pareto:
        print(f"M={r.m}, ef_c={r.ef_construction}, ef_s={r.ef_search}: recall={r.recall_at_10:.4f}, latency={r.query_time_ms:.2f}ms")


def find_pareto_optimal(results: List[BenchmarkResult]) -> List[BenchmarkResult]:
    """Find Pareto-optimal configurations (recall vs latency)."""
    pareto = []

    for r in results:
        dominated = False
        for other in results:
            # Check if other dominates r
            if (other.recall_at_10 >= r.recall_at_10 and
                other.query_time_ms <= r.query_time_ms and
                (other.recall_at_10 > r.recall_at_10 or other.query_time_ms < r.query_time_ms)):
                dominated = True
                break

        if not dominated:
            pareto.append(r)

    return sorted(pareto, key=lambda x: x.recall_at_10, reverse=True)
```

### IVF Parameter Tuning

```python
"""
IVF parameter optimization for large-scale datasets.
"""
import faiss
import numpy as np
import time
from typing import List
from dataclasses import dataclass


@dataclass
class IVFBenchmarkResult:
    """Results from IVF parameter configuration benchmark."""
    nlist: int
    nprobe: int
    pq_m: int  # 0 for IVFFlat
    build_time: float
    query_time_ms: float
    recall_at_10: float
    memory_mb: float
    compression_ratio: float


def compute_optimal_nlist(n_vectors: int) -> int:
    """
    Compute optimal nlist using the 4*sqrt(n) rule.

    For very large datasets, cap at reasonable maximum.
    """
    nlist = int(4 * np.sqrt(n_vectors))
    # Cap at reasonable values
    nlist = max(nlist, 16)
    nlist = min(nlist, 65536)
    return nlist


def tune_ivf_faiss(
    vectors: np.ndarray,
    queries: np.ndarray,
    ground_truth: np.ndarray,
    nlist_values: List[int] = None,
    nprobe_values: List[int] = [1, 5, 10, 20, 50, 100],
    use_pq: bool = False,
    pq_m: int = 8
) -> List[IVFBenchmarkResult]:
    """
    Benchmark IVF parameters in FAISS.

    Args:
        vectors: Dataset vectors
        queries: Query vectors
        ground_truth: True nearest neighbors
        nlist_values: Number of clusters to test (auto-computed if None)
        nprobe_values: Number of probes to test
        use_pq: Whether to use Product Quantization
        pq_m: Number of PQ subquantizers

    Returns:
        List of benchmark results
    """
    n_vectors, dimension = vectors.shape
    results = []

    if nlist_values is None:
        base_nlist = compute_optimal_nlist(n_vectors)
        nlist_values = [
            base_nlist // 2,
            base_nlist,
            base_nlist * 2
        ]

    vectors = vectors.astype('float32')
    queries = queries.astype('float32')

    for nlist in nlist_values:
        # Build index
        quantizer = faiss.IndexFlatL2(dimension)

        if use_pq:
            index = faiss.IndexIVFPQ(quantizer, dimension, nlist, pq_m, 8)
        else:
            index = faiss.IndexIVFFlat(quantizer, dimension, nlist)

        # Train
        start_time = time.time()
        train_size = min(len(vectors), nlist * 40)
        train_vectors = vectors[:train_size]
        index.train(train_vectors)
        index.add(vectors)
        build_time = time.time() - start_time

        # Memory calculation
        if use_pq:
            # PQ: pq_m bytes per vector + centroid overhead
            vector_memory = n_vectors * pq_m
            centroid_memory = nlist * dimension * 4
        else:
            # IVFFlat: full vectors + centroid overhead
            vector_memory = n_vectors * dimension * 4
            centroid_memory = nlist * dimension * 4

        memory_mb = (vector_memory + centroid_memory) / 1_000_000
        original_memory = n_vectors * dimension * 4 / 1_000_000
        compression_ratio = original_memory / memory_mb

        # Test different nprobe values
        for nprobe in nprobe_values:
            index.nprobe = nprobe

            # Query
            start_time = time.time()
            distances, indices = index.search(queries, 10)
            query_time = (time.time() - start_time) / len(queries) * 1000

            # Compute recall
            recall = compute_recall(ground_truth, indices)

            results.append(IVFBenchmarkResult(
                nlist=nlist,
                nprobe=nprobe,
                pq_m=pq_m if use_pq else 0,
                build_time=build_time,
                query_time_ms=query_time,
                recall_at_10=recall,
                memory_mb=memory_mb,
                compression_ratio=compression_ratio
            ))

    return sorted(results, key=lambda x: x.recall_at_10, reverse=True)


def compute_recall(ground_truth: np.ndarray, predictions: np.ndarray, k: int = 10) -> float:
    """Compute recall@k."""
    correct = 0
    for gt, pred in zip(ground_truth, predictions):
        correct += len(set(gt[:k]) & set(pred[:k]))
    return correct / (len(ground_truth) * k)


# Production tuning workflow
def production_ivf_tuning(
    vectors: np.ndarray,
    target_recall: float = 0.95,
    max_latency_ms: float = 10.0
) -> Dict:
    """
    Find optimal IVF configuration for production.

    Args:
        vectors: Dataset vectors
        target_recall: Minimum acceptable recall@10
        max_latency_ms: Maximum acceptable query latency

    Returns:
        Recommended configuration dict
    """
    n_vectors, dimension = vectors.shape
    vectors = vectors.astype('float32')

    # Generate test queries
    n_queries = min(1000, n_vectors // 10)
    query_indices = np.random.choice(n_vectors, n_queries, replace=False)
    queries = vectors[query_indices]

    # Compute ground truth
    flat_index = faiss.IndexFlatL2(dimension)
    flat_index.add(vectors)
    _, ground_truth = flat_index.search(queries, 10)

    # Start with recommended nlist
    nlist = compute_optimal_nlist(n_vectors)

    # Test configurations
    configs = []

    for nlist_mult in [0.5, 1.0, 2.0]:
        test_nlist = int(nlist * nlist_mult)

        for nprobe in [1, 5, 10, 20, 50, 100]:
            quantizer = faiss.IndexFlatL2(dimension)
            index = faiss.IndexIVFFlat(quantizer, dimension, test_nlist)
            index.train(vectors[:test_nlist * 40])
            index.add(vectors)
            index.nprobe = nprobe

            # Benchmark
            start = time.time()
            _, indices = index.search(queries, 10)
            latency = (time.time() - start) / len(queries) * 1000

            recall = compute_recall(ground_truth, indices)

            configs.append({
                "nlist": test_nlist,
                "nprobe": nprobe,
                "recall": recall,
                "latency_ms": latency
            })

    # Find configurations meeting requirements
    valid = [c for c in configs if c["recall"] >= target_recall and c["latency_ms"] <= max_latency_ms]

    if valid:
        # Return fastest valid configuration
        best = min(valid, key=lambda x: x["latency_ms"])
    else:
        # Return configuration closest to requirements
        configs.sort(key=lambda x: (x["recall"] < target_recall, x["latency_ms"]))
        best = configs[0]

    return {
        "nlist": best["nlist"],
        "nprobe": best["nprobe"],
        "expected_recall": best["recall"],
        "expected_latency_ms": best["latency_ms"],
        "training_vectors_needed": best["nlist"] * 40
    }
```

### Database-Specific Tuning

```python
"""
Database-specific parameter tuning for ChromaDB, Qdrant, pgvector.
"""

# ChromaDB HNSW Tuning
def chromadb_optimal_config(n_vectors: int, priority: str = "balanced") -> Dict:
    """
    Get optimal ChromaDB configuration.

    Args:
        n_vectors: Expected number of vectors
        priority: "speed", "recall", "memory", or "balanced"

    Returns:
        Collection metadata dict
    """
    configs = {
        "speed": {
            "hnsw:M": 8,
            "hnsw:construction_ef": 40,
            "hnsw:search_ef": 16
        },
        "recall": {
            "hnsw:M": 48,
            "hnsw:construction_ef": 200,
            "hnsw:search_ef": 128
        },
        "memory": {
            "hnsw:M": 8,
            "hnsw:construction_ef": 64,
            "hnsw:search_ef": 32
        },
        "balanced": {
            "hnsw:M": 16,
            "hnsw:construction_ef": 100,
            "hnsw:search_ef": 50
        }
    }

    config = configs.get(priority, configs["balanced"]).copy()

    # Adjust for dataset size
    if n_vectors > 1_000_000:
        config["hnsw:M"] = min(config["hnsw:M"] * 2, 64)
        config["hnsw:construction_ef"] = min(config["hnsw:construction_ef"] * 1.5, 300)

    config["hnsw:space"] = "cosine"

    return config


# pgvector Index Tuning
def pgvector_index_sql(
    table_name: str,
    n_vectors: int,
    index_type: str = "hnsw",
    priority: str = "balanced"
) -> str:
    """
    Generate optimal pgvector index SQL.

    Args:
        table_name: Name of the table
        n_vectors: Expected number of vectors
        index_type: "hnsw" or "ivfflat"
        priority: "speed", "recall", or "balanced"

    Returns:
        SQL to create the index
    """
    if index_type == "hnsw":
        configs = {
            "speed": {"m": 8, "ef_construction": 32},
            "recall": {"m": 32, "ef_construction": 128},
            "balanced": {"m": 16, "ef_construction": 64}
        }
        config = configs.get(priority, configs["balanced"])

        return f"""
CREATE INDEX ON {table_name}
USING hnsw (embedding vector_cosine_ops)
WITH (m = {config['m']}, ef_construction = {config['ef_construction']});

-- Set search parameter (run before queries)
-- SET hnsw.ef_search = {config['ef_construction']};
"""

    elif index_type == "ivfflat":
        lists = int(4 * np.sqrt(n_vectors))
        lists = max(lists, 16)

        probes = {
            "speed": max(1, lists // 100),
            "recall": max(10, lists // 10),
            "balanced": max(5, lists // 20)
        }[priority]

        return f"""
CREATE INDEX ON {table_name}
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = {lists});

-- Set search parameter (run before queries)
-- SET ivfflat.probes = {probes};
"""


# Qdrant Collection Config
def qdrant_optimal_config(
    n_vectors: int,
    dimension: int,
    priority: str = "balanced"
) -> Dict:
    """
    Get optimal Qdrant collection configuration.

    Args:
        n_vectors: Expected number of vectors
        dimension: Vector dimension
        priority: "speed", "recall", "memory", or "balanced"

    Returns:
        Collection config dict
    """
    from qdrant_client.models import VectorParams, Distance, HnswConfigDiff

    configs = {
        "speed": HnswConfigDiff(m=8, ef_construct=40),
        "recall": HnswConfigDiff(m=32, ef_construct=200),
        "memory": HnswConfigDiff(m=8, ef_construct=64),
        "balanced": HnswConfigDiff(m=16, ef_construct=100)
    }

    hnsw_config = configs.get(priority, configs["balanced"])

    return {
        "vectors_config": VectorParams(
            size=dimension,
            distance=Distance.COSINE
        ),
        "hnsw_config": hnsw_config,
        "optimizers_config": {
            "memmap_threshold": 20000 if n_vectors > 100000 else None
        }
    }
```

## Performance Characteristics

### HNSW Parameter Impact

| M | Memory Overhead | Build Time | Query Time | Recall@10 |
|---|-----------------|------------|------------|-----------|
| 8 | ~64 bytes/vec | Fast | ~0.3ms | ~90% |
| 16 | ~128 bytes/vec | Medium | ~0.5ms | ~95% |
| 32 | ~256 bytes/vec | Slow | ~0.8ms | ~98% |
| 48 | ~384 bytes/vec | Very slow | ~1.2ms | ~99% |

### IVF Parameter Impact (1M vectors)

| nlist | nprobe | Build Time | Query Time | Recall@10 |
|-------|--------|------------|------------|-----------|
| 1000 | 1 | 30s | 0.5ms | ~50% |
| 1000 | 10 | 30s | 2ms | ~85% |
| 1000 | 50 | 30s | 8ms | ~95% |
| 4000 | 10 | 60s | 1ms | ~80% |
| 4000 | 50 | 60s | 4ms | ~93% |

## When to Use This Pattern

**HNSW is better when:**
- Memory is not constrained
- Need consistent query latency
- Incremental updates are common
- Recall requirements are high (>95%)

**IVF is better when:**
- Memory is constrained
- Build time matters less than query time
- Dataset is very large (>10M)
- Can tolerate slightly lower recall

**IVF+PQ is better when:**
- Memory is severely constrained
- Dataset is huge (>100M vectors)
- Can tolerate ~85-90% recall
- Need good compression ratio

## Tuning Workflow

```
1. Start with defaults:
   - HNSW: M=16, ef_construction=100, ef_search=50
   - IVF: nlist=4*sqrt(n), nprobe=10

2. Benchmark with representative queries:
   - Measure recall@10 against brute force
   - Measure p99 latency

3. Adjust based on requirements:
   - Need more recall? Increase M/ef_search or nprobe
   - Need lower latency? Decrease M/ef_search or nprobe
   - Need less memory? Use IVF+PQ or reduce M

4. Validate in production:
   - Monitor actual recall with holdout queries
   - Monitor latency percentiles
   - Adjust parameters dynamically if needed
```

## Related Cookbooks

- `faiss.md` - FAISS index details
- `chromadb.md` - ChromaDB-specific tuning
- `pgvector.md` - pgvector index options
- `quickstart.md` - Getting started
