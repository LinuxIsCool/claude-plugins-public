#!/usr/bin/env python3
"""
Vector Database Benchmark Tool

Comprehensive benchmarking for vector database performance across
different backends, index types, and configurations.

Usage:
    python vector_benchmark.py --backend chromadb --vectors 100000 --dimension 384
    python vector_benchmark.py --backend faiss --index-type hnsw --vectors 1000000
    python vector_benchmark.py --compare-all --vectors 50000
"""

import argparse
import json
import time
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
import tempfile
import shutil

import numpy as np


@dataclass
class BenchmarkConfig:
    """Configuration for a benchmark run."""
    n_vectors: int = 100000
    n_queries: int = 1000
    dimension: int = 384
    k: int = 10
    batch_size: int = 1000
    seed: int = 42


@dataclass
class BenchmarkResult:
    """Results from a single benchmark run."""
    backend: str
    index_type: str
    config: Dict[str, Any]
    n_vectors: int
    dimension: int

    # Build metrics
    build_time_s: float
    memory_mb: float

    # Query metrics
    query_time_mean_ms: float
    query_time_p50_ms: float
    query_time_p95_ms: float
    query_time_p99_ms: float
    queries_per_second: float

    # Quality metrics
    recall_at_10: float

    # Additional info
    notes: str = ""


class VectorBenchmark(ABC):
    """Abstract base class for vector database benchmarks."""

    def __init__(self, config: BenchmarkConfig):
        self.config = config
        np.random.seed(config.seed)

        # Generate test data
        self.vectors = np.random.rand(config.n_vectors, config.dimension).astype('float32')
        self.queries = np.random.rand(config.n_queries, config.dimension).astype('float32')
        self.ground_truth = self._compute_ground_truth()

    def _compute_ground_truth(self) -> np.ndarray:
        """Compute exact nearest neighbors using brute force."""
        print("Computing ground truth with brute force...")

        # Use batched computation for memory efficiency
        ground_truth = np.zeros((self.config.n_queries, self.config.k), dtype=np.int64)

        batch_size = 100
        for i in range(0, self.config.n_queries, batch_size):
            batch_queries = self.queries[i:i + batch_size]

            # Compute distances (using dot product for normalized comparison)
            # For cosine similarity, we'd normalize first
            distances = np.dot(batch_queries, self.vectors.T)

            # Get top-k indices (highest similarity = closest)
            top_k_indices = np.argsort(-distances, axis=1)[:, :self.config.k]
            ground_truth[i:i + batch_size] = top_k_indices

        return ground_truth

    def compute_recall(self, predictions: np.ndarray) -> float:
        """Compute recall@k against ground truth."""
        correct = 0
        total = len(self.ground_truth) * self.config.k

        for gt, pred in zip(self.ground_truth, predictions):
            correct += len(set(gt) & set(pred))

        return correct / total

    @abstractmethod
    def setup(self) -> None:
        """Set up the database/index."""
        pass

    @abstractmethod
    def build_index(self) -> float:
        """Build the index and return build time in seconds."""
        pass

    @abstractmethod
    def query(self, query_vector: np.ndarray, k: int) -> np.ndarray:
        """Query the index and return indices of nearest neighbors."""
        pass

    @abstractmethod
    def get_memory_usage(self) -> float:
        """Get approximate memory usage in MB."""
        pass

    @abstractmethod
    def cleanup(self) -> None:
        """Clean up resources."""
        pass

    def run_benchmark(self) -> BenchmarkResult:
        """Run the complete benchmark."""
        print(f"\nRunning benchmark: {self.__class__.__name__}")
        print(f"  Vectors: {self.config.n_vectors}")
        print(f"  Dimension: {self.config.dimension}")
        print(f"  Queries: {self.config.n_queries}")

        # Setup
        self.setup()

        # Build
        print("  Building index...")
        build_time = self.build_index()
        print(f"    Build time: {build_time:.2f}s")

        memory_mb = self.get_memory_usage()
        print(f"    Memory: {memory_mb:.1f}MB")

        # Query
        print("  Running queries...")
        query_times = []
        predictions = []

        for i, query in enumerate(self.queries):
            start = time.perf_counter()
            indices = self.query(query, self.config.k)
            elapsed = (time.perf_counter() - start) * 1000  # ms
            query_times.append(elapsed)
            predictions.append(indices)

            if (i + 1) % 100 == 0:
                print(f"    Completed {i + 1}/{self.config.n_queries} queries")

        predictions = np.array(predictions)
        query_times = np.array(query_times)

        # Compute metrics
        recall = self.compute_recall(predictions)
        print(f"    Recall@{self.config.k}: {recall:.4f}")

        result = BenchmarkResult(
            backend=self.backend_name,
            index_type=self.index_type,
            config=self.index_config,
            n_vectors=self.config.n_vectors,
            dimension=self.config.dimension,
            build_time_s=build_time,
            memory_mb=memory_mb,
            query_time_mean_ms=np.mean(query_times),
            query_time_p50_ms=np.percentile(query_times, 50),
            query_time_p95_ms=np.percentile(query_times, 95),
            query_time_p99_ms=np.percentile(query_times, 99),
            queries_per_second=1000 / np.mean(query_times),
            recall_at_10=recall
        )

        self.cleanup()
        return result

    @property
    @abstractmethod
    def backend_name(self) -> str:
        pass

    @property
    @abstractmethod
    def index_type(self) -> str:
        pass

    @property
    @abstractmethod
    def index_config(self) -> Dict[str, Any]:
        pass


class FAISSFlatBenchmark(VectorBenchmark):
    """FAISS Flat (brute force) benchmark."""

    def setup(self):
        import faiss
        self.index = faiss.IndexFlatIP(self.config.dimension)

    def build_index(self) -> float:
        start = time.time()
        # Normalize vectors for cosine similarity
        vectors = self.vectors.copy()
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        vectors = vectors / norms
        self.index.add(vectors)
        return time.time() - start

    def query(self, query_vector: np.ndarray, k: int) -> np.ndarray:
        query = query_vector.copy().reshape(1, -1)
        query = query / np.linalg.norm(query)
        _, indices = self.index.search(query.astype('float32'), k)
        return indices[0]

    def get_memory_usage(self) -> float:
        return self.config.n_vectors * self.config.dimension * 4 / 1_000_000

    def cleanup(self):
        del self.index

    @property
    def backend_name(self) -> str:
        return "faiss"

    @property
    def index_type(self) -> str:
        return "flat"

    @property
    def index_config(self) -> Dict[str, Any]:
        return {}


class FAISSHNSWBenchmark(VectorBenchmark):
    """FAISS HNSW benchmark."""

    def __init__(self, config: BenchmarkConfig, M: int = 32, ef_construction: int = 100, ef_search: int = 50):
        super().__init__(config)
        self.M = M
        self.ef_construction = ef_construction
        self.ef_search = ef_search

    def setup(self):
        import faiss
        self.index = faiss.IndexHNSWFlat(self.config.dimension, self.M, faiss.METRIC_INNER_PRODUCT)
        self.index.hnsw.efConstruction = self.ef_construction
        self.index.hnsw.efSearch = self.ef_search

    def build_index(self) -> float:
        start = time.time()
        vectors = self.vectors.copy()
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        vectors = vectors / norms
        self.index.add(vectors.astype('float32'))
        return time.time() - start

    def query(self, query_vector: np.ndarray, k: int) -> np.ndarray:
        query = query_vector.copy().reshape(1, -1)
        query = query / np.linalg.norm(query)
        _, indices = self.index.search(query.astype('float32'), k)
        return indices[0]

    def get_memory_usage(self) -> float:
        base = self.config.n_vectors * self.config.dimension * 4
        graph = self.config.n_vectors * self.M * 8  # Approximate graph overhead
        return (base + graph) / 1_000_000

    def cleanup(self):
        del self.index

    @property
    def backend_name(self) -> str:
        return "faiss"

    @property
    def index_type(self) -> str:
        return "hnsw"

    @property
    def index_config(self) -> Dict[str, Any]:
        return {"M": self.M, "ef_construction": self.ef_construction, "ef_search": self.ef_search}


class FAISSIVFBenchmark(VectorBenchmark):
    """FAISS IVF benchmark."""

    def __init__(self, config: BenchmarkConfig, nlist: int = None, nprobe: int = 10):
        super().__init__(config)
        self.nlist = nlist or int(4 * np.sqrt(config.n_vectors))
        self.nprobe = nprobe

    def setup(self):
        import faiss
        self.quantizer = faiss.IndexFlatIP(self.config.dimension)
        self.index = faiss.IndexIVFFlat(
            self.quantizer, self.config.dimension, self.nlist, faiss.METRIC_INNER_PRODUCT
        )

    def build_index(self) -> float:
        vectors = self.vectors.copy()
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        vectors = vectors / norms

        start = time.time()
        # Train on subset
        train_size = min(len(vectors), self.nlist * 40)
        self.index.train(vectors[:train_size].astype('float32'))
        self.index.add(vectors.astype('float32'))
        self.index.nprobe = self.nprobe
        return time.time() - start

    def query(self, query_vector: np.ndarray, k: int) -> np.ndarray:
        query = query_vector.copy().reshape(1, -1)
        query = query / np.linalg.norm(query)
        _, indices = self.index.search(query.astype('float32'), k)
        return indices[0]

    def get_memory_usage(self) -> float:
        base = self.config.n_vectors * self.config.dimension * 4
        centroids = self.nlist * self.config.dimension * 4
        return (base + centroids) / 1_000_000

    def cleanup(self):
        del self.index
        del self.quantizer

    @property
    def backend_name(self) -> str:
        return "faiss"

    @property
    def index_type(self) -> str:
        return "ivf"

    @property
    def index_config(self) -> Dict[str, Any]:
        return {"nlist": self.nlist, "nprobe": self.nprobe}


class ChromaDBBenchmark(VectorBenchmark):
    """ChromaDB benchmark."""

    def __init__(self, config: BenchmarkConfig, M: int = 16, ef_construction: int = 100):
        super().__init__(config)
        self.M = M
        self.ef_construction = ef_construction
        self.temp_dir = None

    def setup(self):
        import chromadb
        self.temp_dir = tempfile.mkdtemp()
        self.client = chromadb.PersistentClient(path=self.temp_dir)

        self.collection = self.client.create_collection(
            name="benchmark",
            metadata={
                "hnsw:space": "cosine",
                "hnsw:M": self.M,
                "hnsw:construction_ef": self.ef_construction
            }
        )

    def build_index(self) -> float:
        start = time.time()

        # Add in batches
        for i in range(0, self.config.n_vectors, self.config.batch_size):
            end = min(i + self.config.batch_size, self.config.n_vectors)
            batch = self.vectors[i:end]

            self.collection.add(
                embeddings=batch.tolist(),
                ids=[str(j) for j in range(i, end)]
            )

        return time.time() - start

    def query(self, query_vector: np.ndarray, k: int) -> np.ndarray:
        result = self.collection.query(
            query_embeddings=[query_vector.tolist()],
            n_results=k
        )
        return np.array([int(id_) for id_ in result["ids"][0]])

    def get_memory_usage(self) -> float:
        # Estimate based on directory size
        total_size = 0
        for path in Path(self.temp_dir).rglob('*'):
            if path.is_file():
                total_size += path.stat().st_size
        return total_size / 1_000_000

    def cleanup(self):
        del self.collection
        del self.client
        if self.temp_dir:
            shutil.rmtree(self.temp_dir, ignore_errors=True)

    @property
    def backend_name(self) -> str:
        return "chromadb"

    @property
    def index_type(self) -> str:
        return "hnsw"

    @property
    def index_config(self) -> Dict[str, Any]:
        return {"M": self.M, "ef_construction": self.ef_construction}


def run_comparison(config: BenchmarkConfig, backends: List[str] = None) -> List[BenchmarkResult]:
    """Run benchmarks across multiple backends."""
    if backends is None:
        backends = ["faiss-flat", "faiss-hnsw", "faiss-ivf", "chromadb"]

    results = []

    for backend in backends:
        try:
            if backend == "faiss-flat":
                benchmark = FAISSFlatBenchmark(config)
            elif backend == "faiss-hnsw":
                benchmark = FAISSHNSWBenchmark(config)
            elif backend == "faiss-ivf":
                benchmark = FAISSIVFBenchmark(config)
            elif backend == "chromadb":
                benchmark = ChromaDBBenchmark(config)
            else:
                print(f"Unknown backend: {backend}")
                continue

            result = benchmark.run_benchmark()
            results.append(result)

        except ImportError as e:
            print(f"Skipping {backend}: {e}")
        except Exception as e:
            print(f"Error benchmarking {backend}: {e}")

    return results


def print_results(results: List[BenchmarkResult]):
    """Print benchmark results in a formatted table."""
    print("\n" + "=" * 100)
    print("BENCHMARK RESULTS")
    print("=" * 100)

    headers = ["Backend", "Index", "Build(s)", "Mem(MB)", "QPS", "P50(ms)", "P99(ms)", "Recall@10"]
    widths = [12, 10, 10, 10, 10, 10, 10, 10]

    # Header
    header_line = " | ".join(h.center(w) for h, w in zip(headers, widths))
    print(header_line)
    print("-" * len(header_line))

    # Results
    for r in results:
        row = [
            r.backend,
            r.index_type,
            f"{r.build_time_s:.2f}",
            f"{r.memory_mb:.1f}",
            f"{r.queries_per_second:.0f}",
            f"{r.query_time_p50_ms:.2f}",
            f"{r.query_time_p99_ms:.2f}",
            f"{r.recall_at_10:.4f}"
        ]
        print(" | ".join(v.center(w) for v, w in zip(row, widths)))

    print("=" * 100)


def save_results(results: List[BenchmarkResult], output_path: str):
    """Save results to JSON file."""
    data = [asdict(r) for r in results]
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"\nResults saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Vector Database Benchmark Tool")
    parser.add_argument("--backend", type=str, default="faiss-hnsw",
                        choices=["faiss-flat", "faiss-hnsw", "faiss-ivf", "chromadb"],
                        help="Backend to benchmark")
    parser.add_argument("--compare-all", action="store_true",
                        help="Compare all backends")
    parser.add_argument("--vectors", type=int, default=100000,
                        help="Number of vectors")
    parser.add_argument("--queries", type=int, default=1000,
                        help="Number of queries")
    parser.add_argument("--dimension", type=int, default=384,
                        help="Vector dimension")
    parser.add_argument("--k", type=int, default=10,
                        help="Number of nearest neighbors")
    parser.add_argument("--output", type=str, default=None,
                        help="Output JSON file for results")

    # HNSW parameters
    parser.add_argument("--hnsw-m", type=int, default=32,
                        help="HNSW M parameter")
    parser.add_argument("--hnsw-ef-construction", type=int, default=100,
                        help="HNSW ef_construction parameter")
    parser.add_argument("--hnsw-ef-search", type=int, default=50,
                        help="HNSW ef_search parameter")

    # IVF parameters
    parser.add_argument("--ivf-nlist", type=int, default=None,
                        help="IVF nlist parameter (auto-computed if not specified)")
    parser.add_argument("--ivf-nprobe", type=int, default=10,
                        help="IVF nprobe parameter")

    args = parser.parse_args()

    config = BenchmarkConfig(
        n_vectors=args.vectors,
        n_queries=args.queries,
        dimension=args.dimension,
        k=args.k
    )

    print("Vector Database Benchmark")
    print(f"  Vectors: {config.n_vectors}")
    print(f"  Queries: {config.n_queries}")
    print(f"  Dimension: {config.dimension}")
    print(f"  k: {config.k}")

    if args.compare_all:
        results = run_comparison(config)
    else:
        # Run single backend
        if args.backend == "faiss-flat":
            benchmark = FAISSFlatBenchmark(config)
        elif args.backend == "faiss-hnsw":
            benchmark = FAISSHNSWBenchmark(
                config,
                M=args.hnsw_m,
                ef_construction=args.hnsw_ef_construction,
                ef_search=args.hnsw_ef_search
            )
        elif args.backend == "faiss-ivf":
            benchmark = FAISSIVFBenchmark(
                config,
                nlist=args.ivf_nlist,
                nprobe=args.ivf_nprobe
            )
        elif args.backend == "chromadb":
            benchmark = ChromaDBBenchmark(
                config,
                M=args.hnsw_m,
                ef_construction=args.hnsw_ef_construction
            )
        else:
            print(f"Unknown backend: {args.backend}")
            sys.exit(1)

        results = [benchmark.run_benchmark()]

    print_results(results)

    if args.output:
        save_results(results, args.output)


if __name__ == "__main__":
    main()
