#!/usr/bin/env python3
"""
FAISS Client Wrapper

Production-ready FAISS wrapper with:
- Automatic index type selection
- ID mapping and persistence
- Index saving/loading
- Metadata storage via SQLite sidecar
- Batch operations

Usage:
    from faiss_client import FAISSStore, IndexConfig

    # Simple usage - auto-selects best index
    store = FAISSStore("./index", dimension=384, expected_size=100000)
    store.add(vectors, ids, metadatas)
    results = store.search(query_vector, k=10)

    # Explicit index configuration
    config = IndexConfig(index_type="hnsw", hnsw_m=32)
    store = FAISSStore("./index", dimension=384, config=config)
"""

import json
import pickle
import sqlite3
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import logging

import numpy as np

try:
    import faiss
except ImportError:
    raise ImportError("faiss is required. Install with: pip install faiss-cpu")


logger = logging.getLogger(__name__)


@dataclass
class IndexConfig:
    """Configuration for FAISS index."""
    # Index type selection
    index_type: str = "auto"  # "flat", "hnsw", "ivf", "ivf_pq", "auto"
    metric: str = "cosine"    # "cosine", "l2", "ip"

    # HNSW parameters
    hnsw_m: int = 32
    hnsw_ef_construction: int = 100
    hnsw_ef_search: int = 50

    # IVF parameters
    ivf_nlist: Optional[int] = None  # Auto-computed if None
    ivf_nprobe: int = 10

    # PQ parameters (for IVF+PQ)
    pq_m: Optional[int] = None  # Subquantizers (auto: dimension // 8)
    pq_nbits: int = 8

    # Training
    train_size_multiplier: int = 40  # train_size = nlist * multiplier

    @staticmethod
    def for_size(
        n_vectors: int,
        dimension: int,
        priority: str = "balanced"
    ) -> "IndexConfig":
        """
        Get recommended configuration based on dataset size.

        Args:
            n_vectors: Expected number of vectors
            dimension: Vector dimension
            priority: "speed", "recall", "memory", or "balanced"

        Returns:
            IndexConfig with recommended settings
        """
        if n_vectors < 10000:
            return IndexConfig(index_type="flat")

        elif n_vectors < 100000:
            configs = {
                "speed": IndexConfig(index_type="hnsw", hnsw_m=16, hnsw_ef_search=16),
                "recall": IndexConfig(index_type="hnsw", hnsw_m=48, hnsw_ef_search=100),
                "memory": IndexConfig(index_type="hnsw", hnsw_m=8, hnsw_ef_search=32),
                "balanced": IndexConfig(index_type="hnsw", hnsw_m=32, hnsw_ef_search=50)
            }
            return configs.get(priority, configs["balanced"])

        elif n_vectors < 1000000:
            nlist = int(4 * np.sqrt(n_vectors))
            configs = {
                "speed": IndexConfig(index_type="ivf", ivf_nlist=nlist, ivf_nprobe=5),
                "recall": IndexConfig(index_type="ivf", ivf_nlist=nlist, ivf_nprobe=50),
                "memory": IndexConfig(index_type="ivf_pq", ivf_nlist=nlist, pq_m=dimension // 8),
                "balanced": IndexConfig(index_type="ivf", ivf_nlist=nlist, ivf_nprobe=20)
            }
            return configs.get(priority, configs["balanced"])

        else:
            nlist = int(4 * np.sqrt(n_vectors))
            pq_m = dimension // 8
            configs = {
                "speed": IndexConfig(index_type="ivf_pq", ivf_nlist=nlist, pq_m=pq_m, ivf_nprobe=10),
                "recall": IndexConfig(index_type="ivf_pq", ivf_nlist=nlist * 2, pq_m=pq_m, ivf_nprobe=100),
                "memory": IndexConfig(index_type="ivf_pq", ivf_nlist=nlist, pq_m=pq_m // 2, ivf_nprobe=10),
                "balanced": IndexConfig(index_type="ivf_pq", ivf_nlist=nlist, pq_m=pq_m, ivf_nprobe=32)
            }
            return configs.get(priority, configs["balanced"])


@dataclass
class SearchResult:
    """Single search result."""
    id: str
    distance: float
    similarity: float
    index: int
    metadata: Optional[Dict] = None
    vector: Optional[np.ndarray] = None


class MetadataStore:
    """SQLite-based metadata storage for FAISS vectors."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """Get thread-local connection."""
        if not hasattr(self._local, "conn"):
            self._local.conn = sqlite3.connect(self.db_path)
        return self._local.conn

    def _init_db(self):
        """Initialize database schema."""
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS vectors (
                idx INTEGER PRIMARY KEY,
                id TEXT UNIQUE NOT NULL,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_vectors_id ON vectors(id);
        """)
        conn.commit()

    def add(self, indices: List[int], ids: List[str], metadatas: List[Dict] = None):
        """Add ID and metadata mappings."""
        if metadatas is None:
            metadatas = [None] * len(ids)

        conn = self._get_conn()
        data = [
            (idx, id_, json.dumps(meta) if meta else None)
            for idx, id_, meta in zip(indices, ids, metadatas)
        ]

        conn.executemany(
            "INSERT OR REPLACE INTO vectors (idx, id, metadata) VALUES (?, ?, ?)",
            data
        )
        conn.commit()

    def get_by_indices(self, indices: List[int]) -> List[Tuple[str, Optional[Dict]]]:
        """Get IDs and metadata by FAISS indices."""
        conn = self._get_conn()
        placeholders = ",".join("?" * len(indices))
        results = conn.execute(
            f"SELECT idx, id, metadata FROM vectors WHERE idx IN ({placeholders})",
            indices
        ).fetchall()

        # Build lookup
        lookup = {}
        for idx, id_, meta_str in results:
            meta = json.loads(meta_str) if meta_str else None
            lookup[idx] = (id_, meta)

        # Return in order
        return [lookup.get(idx, (str(idx), None)) for idx in indices]

    def get_by_id(self, id_: str) -> Optional[Tuple[int, Dict]]:
        """Get index and metadata by ID."""
        conn = self._get_conn()
        result = conn.execute(
            "SELECT idx, metadata FROM vectors WHERE id = ?",
            (id_,)
        ).fetchone()

        if result:
            idx, meta_str = result
            meta = json.loads(meta_str) if meta_str else None
            return (idx, meta)
        return None

    def delete_by_indices(self, indices: List[int]):
        """Delete by FAISS indices."""
        conn = self._get_conn()
        placeholders = ",".join("?" * len(indices))
        conn.execute(
            f"DELETE FROM vectors WHERE idx IN ({placeholders})",
            indices
        )
        conn.commit()

    def count(self) -> int:
        """Get total count."""
        conn = self._get_conn()
        return conn.execute("SELECT COUNT(*) FROM vectors").fetchone()[0]

    def close(self):
        """Close database connection."""
        if hasattr(self._local, "conn"):
            self._local.conn.close()
            del self._local.conn


class FAISSStore:
    """
    High-level FAISS vector store with ID mapping and metadata.

    Handles:
    - Index creation and configuration
    - ID <-> index mapping
    - Metadata storage
    - Persistence (save/load)
    - Batch operations
    """

    def __init__(
        self,
        path: str,
        dimension: int,
        config: IndexConfig = None,
        expected_size: int = None
    ):
        """
        Initialize FAISS store.

        Args:
            path: Directory for storing index and metadata
            dimension: Vector dimension
            config: Index configuration (auto-computed if None)
            expected_size: Expected dataset size (for auto-config)
        """
        self.path = Path(path)
        self.dimension = dimension
        self.path.mkdir(parents=True, exist_ok=True)

        # Auto-configure if needed
        if config is None:
            if expected_size:
                config = IndexConfig.for_size(expected_size, dimension)
            else:
                config = IndexConfig()  # Default: auto

        self.config = config

        # Initialize components
        self._index: Optional[faiss.Index] = None
        self._metadata = MetadataStore(str(self.path / "metadata.db"))
        self._lock = threading.Lock()
        self._is_trained = False
        self._training_vectors: List[np.ndarray] = []

        # Try to load existing index
        self._load_if_exists()

    def _create_index(self) -> faiss.Index:
        """Create FAISS index based on configuration."""
        config = self.config
        d = self.dimension

        # Determine metric
        if config.metric == "cosine":
            metric = faiss.METRIC_INNER_PRODUCT
        elif config.metric == "l2":
            metric = faiss.METRIC_L2
        else:
            metric = faiss.METRIC_INNER_PRODUCT

        # Create index
        if config.index_type == "flat" or config.index_type == "auto":
            if config.metric == "l2":
                index = faiss.IndexFlatL2(d)
            else:
                index = faiss.IndexFlatIP(d)
            self._is_trained = True

        elif config.index_type == "hnsw":
            if config.metric == "l2":
                index = faiss.IndexHNSWFlat(d, config.hnsw_m)
            else:
                index = faiss.IndexHNSWFlat(d, config.hnsw_m, metric)
            index.hnsw.efConstruction = config.hnsw_ef_construction
            index.hnsw.efSearch = config.hnsw_ef_search
            self._is_trained = True

        elif config.index_type == "ivf":
            nlist = config.ivf_nlist or 100
            quantizer = faiss.IndexFlatIP(d) if metric == faiss.METRIC_INNER_PRODUCT else faiss.IndexFlatL2(d)
            index = faiss.IndexIVFFlat(quantizer, d, nlist, metric)
            index.nprobe = config.ivf_nprobe
            self._is_trained = False

        elif config.index_type == "ivf_pq":
            nlist = config.ivf_nlist or 100
            pq_m = config.pq_m or (d // 8)

            # Ensure dimension is divisible by pq_m
            if d % pq_m != 0:
                pq_m = d // 8
                while d % pq_m != 0 and pq_m > 1:
                    pq_m -= 1

            quantizer = faiss.IndexFlatIP(d) if metric == faiss.METRIC_INNER_PRODUCT else faiss.IndexFlatL2(d)
            index = faiss.IndexIVFPQ(quantizer, d, nlist, pq_m, config.pq_nbits, metric)
            index.nprobe = config.ivf_nprobe
            self._is_trained = False

        else:
            raise ValueError(f"Unknown index type: {config.index_type}")

        return index

    def _normalize_vectors(self, vectors: np.ndarray) -> np.ndarray:
        """Normalize vectors for cosine similarity."""
        if self.config.metric == "cosine":
            vectors = vectors.copy()
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1, norms)  # Avoid division by zero
            vectors = vectors / norms
        return vectors.astype('float32')

    def add(
        self,
        vectors: np.ndarray,
        ids: List[str] = None,
        metadatas: List[Dict] = None
    ) -> List[str]:
        """
        Add vectors to the index.

        Args:
            vectors: Vectors to add (n, dimension)
            ids: Optional string IDs (generated if not provided)
            metadatas: Optional metadata for each vector

        Returns:
            List of IDs
        """
        vectors = np.asarray(vectors, dtype='float32')

        if len(vectors.shape) == 1:
            vectors = vectors.reshape(1, -1)

        assert vectors.shape[1] == self.dimension, \
            f"Vector dimension mismatch: {vectors.shape[1]} != {self.dimension}"

        n = len(vectors)

        # Generate IDs if not provided
        if ids is None:
            import uuid
            ids = [str(uuid.uuid4()) for _ in range(n)]

        if metadatas is None:
            metadatas = [None] * n

        with self._lock:
            # Create index if needed
            if self._index is None:
                self._index = self._create_index()

            # Handle training for IVF indexes
            if not self._is_trained:
                self._training_vectors.append(vectors)
                total_training = sum(len(v) for v in self._training_vectors)

                nlist = self.config.ivf_nlist or 100
                required_training = nlist * self.config.train_size_multiplier

                if total_training >= required_training:
                    # Train the index
                    all_training = np.vstack(self._training_vectors)
                    all_training = self._normalize_vectors(all_training)
                    self._index.train(all_training)
                    self._is_trained = True
                    self._training_vectors = []
                else:
                    logger.info(f"Accumulating training data: {total_training}/{required_training}")
                    # Store in metadata but don't add to index yet
                    # This is a simplification - in production you might want a staging area

            # Normalize and add
            vectors = self._normalize_vectors(vectors)

            # Get starting index
            start_idx = self._index.ntotal

            # Add to FAISS
            self._index.add(vectors)

            # Add to metadata store
            indices = list(range(start_idx, start_idx + n))
            self._metadata.add(indices, ids, metadatas)

        return ids

    def search(
        self,
        query: Union[np.ndarray, List[float]],
        k: int = 10,
        ef_search: int = None,
        nprobe: int = None,
        include_vectors: bool = False
    ) -> List[SearchResult]:
        """
        Search for nearest neighbors.

        Args:
            query: Query vector
            k: Number of results
            ef_search: Override HNSW ef_search (if applicable)
            nprobe: Override IVF nprobe (if applicable)
            include_vectors: Include vectors in results

        Returns:
            List of SearchResult objects
        """
        query = np.asarray(query, dtype='float32')
        if len(query.shape) == 1:
            query = query.reshape(1, -1)

        query = self._normalize_vectors(query)

        with self._lock:
            if self._index is None or self._index.ntotal == 0:
                return []

            # Temporarily adjust search parameters
            original_ef = None
            original_nprobe = None

            if ef_search and hasattr(self._index, 'hnsw'):
                original_ef = self._index.hnsw.efSearch
                self._index.hnsw.efSearch = ef_search

            if nprobe and hasattr(self._index, 'nprobe'):
                original_nprobe = self._index.nprobe
                self._index.nprobe = nprobe

            try:
                distances, indices = self._index.search(query, k)
            finally:
                # Restore parameters
                if original_ef is not None:
                    self._index.hnsw.efSearch = original_ef
                if original_nprobe is not None:
                    self._index.nprobe = original_nprobe

        # Process results
        distances = distances[0]
        indices = indices[0]

        # Filter out -1 (no result)
        valid_mask = indices != -1
        distances = distances[valid_mask]
        indices = indices[valid_mask]

        # Get IDs and metadata
        id_meta_pairs = self._metadata.get_by_indices(indices.tolist())

        results = []
        for i, (idx, dist) in enumerate(zip(indices, distances)):
            id_, meta = id_meta_pairs[i]

            # Convert distance to similarity for cosine
            if self.config.metric == "cosine":
                similarity = float(dist)  # IP already gives similarity
                distance = 1 - similarity
            else:
                distance = float(dist)
                similarity = 1 / (1 + distance)

            result = SearchResult(
                id=id_,
                distance=distance,
                similarity=similarity,
                index=int(idx),
                metadata=meta
            )

            if include_vectors:
                result.vector = self._index.reconstruct(int(idx))

            results.append(result)

        return results

    def get(self, ids: List[str]) -> List[Optional[Dict]]:
        """
        Get vectors and metadata by ID.

        Args:
            ids: IDs to retrieve

        Returns:
            List of dicts with id, vector, metadata (None if not found)
        """
        results = []

        for id_ in ids:
            lookup = self._metadata.get_by_id(id_)

            if lookup is None:
                results.append(None)
            else:
                idx, meta = lookup
                vector = self._index.reconstruct(idx) if self._index else None
                results.append({
                    "id": id_,
                    "index": idx,
                    "vector": vector,
                    "metadata": meta
                })

        return results

    def save(self):
        """Save index to disk."""
        with self._lock:
            if self._index is not None:
                index_path = str(self.path / "index.faiss")
                faiss.write_index(self._index, index_path)

                # Save config
                config_path = self.path / "config.json"
                with open(config_path, 'w') as f:
                    json.dump({
                        "dimension": self.dimension,
                        "config": {
                            "index_type": self.config.index_type,
                            "metric": self.config.metric,
                            "hnsw_m": self.config.hnsw_m,
                            "hnsw_ef_construction": self.config.hnsw_ef_construction,
                            "hnsw_ef_search": self.config.hnsw_ef_search,
                            "ivf_nlist": self.config.ivf_nlist,
                            "ivf_nprobe": self.config.ivf_nprobe,
                            "pq_m": self.config.pq_m,
                            "pq_nbits": self.config.pq_nbits
                        },
                        "is_trained": self._is_trained,
                        "ntotal": self._index.ntotal
                    }, f, indent=2)

                logger.info(f"Saved index with {self._index.ntotal} vectors to {index_path}")

    def _load_if_exists(self):
        """Load existing index if available."""
        index_path = self.path / "index.faiss"
        config_path = self.path / "config.json"

        if index_path.exists() and config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    saved_config = json.load(f)

                if saved_config["dimension"] != self.dimension:
                    raise ValueError(
                        f"Dimension mismatch: saved {saved_config['dimension']} vs requested {self.dimension}"
                    )

                self._index = faiss.read_index(str(index_path))
                self._is_trained = saved_config.get("is_trained", True)

                logger.info(f"Loaded index with {self._index.ntotal} vectors from {index_path}")

            except Exception as e:
                logger.warning(f"Could not load existing index: {e}")

    @property
    def size(self) -> int:
        """Get number of vectors in index."""
        with self._lock:
            return self._index.ntotal if self._index else 0

    def close(self):
        """Close the store and save."""
        self.save()
        self._metadata.close()


class FAISSIndexFactory:
    """Factory for creating FAISS indexes using index_factory string."""

    @staticmethod
    def create(
        dimension: int,
        factory_string: str,
        metric: str = "cosine"
    ) -> Tuple[faiss.Index, bool]:
        """
        Create index using FAISS index_factory.

        Args:
            dimension: Vector dimension
            factory_string: FAISS factory string (e.g., "HNSW32", "IVF1000,Flat")
            metric: Distance metric ("cosine", "l2", "ip")

        Returns:
            Tuple of (index, requires_training)
        """
        if metric == "l2":
            index = faiss.index_factory(dimension, factory_string, faiss.METRIC_L2)
        else:
            index = faiss.index_factory(dimension, factory_string, faiss.METRIC_INNER_PRODUCT)

        requires_training = not index.is_trained

        return index, requires_training

    @staticmethod
    def recommend_factory_string(
        n_vectors: int,
        dimension: int,
        priority: str = "balanced"
    ) -> str:
        """
        Get recommended factory string for dataset.

        Args:
            n_vectors: Expected number of vectors
            dimension: Vector dimension
            priority: "speed", "recall", "memory", or "balanced"

        Returns:
            FAISS factory string
        """
        if n_vectors < 10000:
            return "Flat"

        elif n_vectors < 100000:
            m_values = {"speed": 16, "recall": 48, "memory": 8, "balanced": 32}
            m = m_values.get(priority, 32)
            return f"HNSW{m}"

        elif n_vectors < 1000000:
            nlist = int(4 * np.sqrt(n_vectors))
            if priority == "memory":
                pq_m = dimension // 8
                return f"IVF{nlist},PQ{pq_m}"
            return f"IVF{nlist},Flat"

        else:
            nlist = int(4 * np.sqrt(n_vectors))
            pq_m = dimension // 8

            if priority == "recall":
                return f"IVF{nlist * 2},PQ{pq_m}"
            elif priority == "memory":
                return f"OPQ{pq_m},IVF{nlist},PQ{pq_m}"
            else:
                return f"IVF{nlist},PQ{pq_m}"


# Convenience functions
def quick_index(
    vectors: np.ndarray,
    ids: List[str] = None,
    path: str = "./quick_faiss"
) -> FAISSStore:
    """Create a quick FAISS store with auto-configuration."""
    n, d = vectors.shape
    store = FAISSStore(path, dimension=d, expected_size=n)
    store.add(vectors, ids)
    store.save()
    return store


def quick_search(
    store: FAISSStore,
    query: np.ndarray,
    k: int = 10
) -> List[SearchResult]:
    """Quick search convenience function."""
    return store.search(query, k=k)


if __name__ == "__main__":
    # Demo usage
    print("FAISS Client Demo")
    print("=" * 50)

    # Create store with auto-config
    dimension = 384
    n_vectors = 10000

    print(f"Creating store for {n_vectors} vectors of dimension {dimension}")

    store = FAISSStore(
        "./demo_faiss",
        dimension=dimension,
        expected_size=n_vectors
    )

    # Generate random vectors
    np.random.seed(42)
    vectors = np.random.rand(n_vectors, dimension).astype('float32')
    ids = [f"doc_{i}" for i in range(n_vectors)]
    metadatas = [{"index": i, "batch": i // 1000} for i in range(n_vectors)]

    # Add vectors
    print("Adding vectors...")
    store.add(vectors, ids, metadatas)
    print(f"Index size: {store.size}")

    # Save
    store.save()

    # Search
    query = np.random.rand(dimension).astype('float32')
    print("\nSearching...")
    results = store.search(query, k=5)

    print("Top 5 results:")
    for r in results:
        print(f"  ID: {r.id}, Similarity: {r.similarity:.4f}, Metadata: {r.metadata}")

    # Get by ID
    print("\nGetting by ID...")
    docs = store.get(["doc_0", "doc_100", "nonexistent"])
    for doc in docs:
        if doc:
            print(f"  Found: {doc['id']}")
        else:
            print("  Not found")

    # Cleanup
    store.close()
    print("\nDemo complete!")
