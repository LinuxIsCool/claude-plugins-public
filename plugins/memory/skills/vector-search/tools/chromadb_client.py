#!/usr/bin/env python3
"""
ChromaDB Client Wrapper

Production-ready ChromaDB client with:
- Connection pooling and thread safety
- Automatic batching
- Retry logic
- Metadata flattening
- Collection management
- Backup/restore utilities

Usage:
    from chromadb_client import ChromaManager, MemoryStore

    # Simple usage
    store = MemoryStore("./data")
    store.add("memories", documents, metadatas)
    results = store.search("memories", "query text", k=5)

    # Advanced usage with manager
    manager = ChromaManager("./data")
    collection = manager.get_collection("documents")
    collection.add(documents=texts, ids=ids)
"""

import json
import threading
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, Union
import logging

try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
except ImportError:
    raise ImportError("chromadb is required. Install with: pip install chromadb")


logger = logging.getLogger(__name__)


@dataclass
class ChromaConfig:
    """Configuration for ChromaDB client."""
    path: str = "./chroma_data"
    anonymized_telemetry: bool = False
    allow_reset: bool = False

    # HNSW defaults
    hnsw_space: str = "cosine"
    hnsw_m: int = 16
    hnsw_construction_ef: int = 100
    hnsw_search_ef: int = 50

    # Batching
    batch_size: int = 1000
    max_retries: int = 3
    retry_delay: float = 0.5

    # Embedding
    embedding_model: str = "all-MiniLM-L6-v2"
    use_default_embedding: bool = True


class ChromaManager:
    """
    Thread-safe ChromaDB client manager with connection pooling.

    Implements singleton pattern per database path to avoid
    multiple clients competing for the same database.
    """

    _instances: Dict[str, "ChromaManager"] = {}
    _lock = threading.Lock()

    def __new__(cls, path: str = "./chroma_data", config: ChromaConfig = None):
        """Get or create singleton instance for given path."""
        path = str(Path(path).resolve())

        with cls._lock:
            if path not in cls._instances:
                instance = super().__new__(cls)
                instance._initialized = False
                cls._instances[path] = instance

            return cls._instances[path]

    def __init__(self, path: str = "./chroma_data", config: ChromaConfig = None):
        """Initialize the manager."""
        if getattr(self, "_initialized", False):
            return

        self.path = str(Path(path).resolve())
        self.config = config or ChromaConfig(path=self.path)

        # Ensure directory exists
        Path(self.path).mkdir(parents=True, exist_ok=True)

        # Initialize client
        self._client = chromadb.PersistentClient(
            path=self.path,
            settings=Settings(
                anonymized_telemetry=self.config.anonymized_telemetry,
                allow_reset=self.config.allow_reset,
                is_persistent=True
            )
        )

        # Collection cache
        self._collections: Dict[str, Any] = {}
        self._collection_lock = threading.Lock()

        # Embedding function
        self._embedding_fn = None
        if self.config.use_default_embedding:
            try:
                self._embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name=self.config.embedding_model
                )
            except Exception as e:
                logger.warning(f"Could not load embedding model: {e}")

        self._initialized = True

    def get_collection(
        self,
        name: str,
        embedding_function: Any = None,
        metadata: Dict[str, Any] = None
    ) -> Any:
        """
        Get or create a collection with caching.

        Args:
            name: Collection name
            embedding_function: Optional custom embedding function
            metadata: Optional collection metadata

        Returns:
            ChromaDB collection
        """
        cache_key = f"{name}_{id(embedding_function)}"

        with self._collection_lock:
            if cache_key not in self._collections:
                # Build metadata with HNSW defaults
                coll_metadata = {
                    "hnsw:space": self.config.hnsw_space,
                    "hnsw:M": self.config.hnsw_m,
                    "hnsw:construction_ef": self.config.hnsw_construction_ef,
                }
                if metadata:
                    coll_metadata.update(metadata)

                # Get or create collection
                ef = embedding_function or self._embedding_fn
                self._collections[cache_key] = self._client.get_or_create_collection(
                    name=name,
                    embedding_function=ef,
                    metadata=coll_metadata
                )

            return self._collections[cache_key]

    def delete_collection(self, name: str) -> None:
        """Delete a collection and clear from cache."""
        self._client.delete_collection(name)

        # Clear from cache
        with self._collection_lock:
            keys_to_remove = [k for k in self._collections if k.startswith(f"{name}_")]
            for key in keys_to_remove:
                del self._collections[key]

    def list_collections(self) -> List[str]:
        """List all collection names."""
        return [c.name for c in self._client.list_collections()]

    @property
    def client(self) -> Any:
        """Direct access to underlying ChromaDB client."""
        return self._client

    @classmethod
    def clear_instances(cls):
        """Clear all singleton instances (useful for testing)."""
        with cls._lock:
            cls._instances.clear()


class MetadataProcessor:
    """Utilities for processing metadata for ChromaDB compatibility."""

    @staticmethod
    def flatten(obj: Any, prefix: str = "") -> Dict[str, Any]:
        """
        Flatten nested objects and convert to ChromaDB-compatible types.

        ChromaDB supports: str, int, float, bool
        Does not support: None, nested dicts, lists
        """
        result = {}

        if isinstance(obj, dict):
            for key, value in obj.items():
                new_key = f"{prefix}.{key}" if prefix else key
                result.update(MetadataProcessor.flatten(value, new_key))

        elif isinstance(obj, (list, tuple)):
            # Convert to JSON string
            result[prefix] = json.dumps(obj)

        elif isinstance(obj, datetime):
            # Convert to timestamp
            result[prefix] = int(obj.timestamp())

        elif isinstance(obj, bool):
            result[prefix] = obj

        elif isinstance(obj, (int, float)):
            result[prefix] = obj

        elif obj is None:
            # ChromaDB doesn't support None, use empty string
            result[prefix] = ""

        else:
            # Convert to string
            result[prefix] = str(obj)

        return result

    @staticmethod
    def unflatten(data: Dict[str, Any]) -> Dict[str, Any]:
        """Unflatten a flattened dictionary back to nested structure."""
        result = {}

        for key, value in data.items():
            parts = key.split(".")
            current = result

            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]

            # Try to parse JSON strings back to lists
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, (list, dict)):
                        value = parsed
                except (json.JSONDecodeError, TypeError):
                    pass

            current[parts[-1]] = value

        return result


class MemoryStore:
    """
    High-level memory store interface built on ChromaDB.

    Provides simplified API for common operations:
    - Multi-collection management
    - Automatic batching
    - Retry logic
    - Metadata processing
    """

    def __init__(
        self,
        path: str = "./memories",
        config: ChromaConfig = None,
        auto_flatten_metadata: bool = True
    ):
        """
        Initialize memory store.

        Args:
            path: Database path
            config: ChromaDB configuration
            auto_flatten_metadata: Automatically flatten nested metadata
        """
        self.manager = ChromaManager(path, config)
        self.config = self.manager.config
        self.auto_flatten = auto_flatten_metadata

    def add(
        self,
        collection: str,
        documents: List[str],
        metadatas: List[Dict] = None,
        ids: List[str] = None,
        embeddings: List[List[float]] = None
    ) -> List[str]:
        """
        Add documents to a collection with automatic batching.

        Args:
            collection: Collection name
            documents: List of document texts
            metadatas: Optional metadata for each document
            ids: Optional IDs (generated if not provided)
            embeddings: Optional pre-computed embeddings

        Returns:
            List of document IDs
        """
        if not documents:
            return []

        # Generate IDs if not provided
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in documents]

        # Process metadata
        if metadatas is None:
            metadatas = [{} for _ in documents]
        elif self.auto_flatten:
            metadatas = [MetadataProcessor.flatten(m) for m in metadatas]

        # Get collection
        coll = self.manager.get_collection(collection)

        # Add in batches with retry
        batch_size = self.config.batch_size

        for i in range(0, len(documents), batch_size):
            end = min(i + batch_size, len(documents))

            batch_kwargs = {
                "documents": documents[i:end],
                "ids": ids[i:end],
                "metadatas": metadatas[i:end]
            }

            if embeddings is not None:
                batch_kwargs["embeddings"] = embeddings[i:end]

            self._retry_operation(lambda: coll.add(**batch_kwargs))

        return ids

    def search(
        self,
        collection: str,
        query: Union[str, List[float]],
        k: int = 10,
        where: Dict = None,
        where_document: Dict = None,
        include: List[str] = None
    ) -> List[Dict]:
        """
        Search for similar documents.

        Args:
            collection: Collection name
            query: Query text or embedding
            k: Number of results
            where: Metadata filter
            where_document: Document content filter
            include: Fields to include in results

        Returns:
            List of result dictionaries
        """
        coll = self.manager.get_collection(collection)

        if include is None:
            include = ["documents", "metadatas", "distances"]

        # Build query kwargs
        kwargs = {
            "n_results": k,
            "include": include
        }

        if isinstance(query, str):
            kwargs["query_texts"] = [query]
        else:
            kwargs["query_embeddings"] = [query]

        if where:
            kwargs["where"] = where

        if where_document:
            kwargs["where_document"] = where_document

        # Execute query
        results = self._retry_operation(lambda: coll.query(**kwargs))

        # Format results
        formatted = []
        for i in range(len(results["ids"][0])):
            result = {"id": results["ids"][0][i]}

            if "documents" in include and results.get("documents"):
                result["content"] = results["documents"][0][i]

            if "metadatas" in include and results.get("metadatas"):
                metadata = results["metadatas"][0][i]
                if self.auto_flatten:
                    metadata = MetadataProcessor.unflatten(metadata)
                result["metadata"] = metadata

            if "distances" in include and results.get("distances"):
                result["distance"] = results["distances"][0][i]
                result["similarity"] = 1 - results["distances"][0][i]

            if "embeddings" in include and results.get("embeddings"):
                result["embedding"] = results["embeddings"][0][i]

            formatted.append(result)

        return formatted

    def get(
        self,
        collection: str,
        ids: List[str] = None,
        where: Dict = None,
        limit: int = None
    ) -> List[Dict]:
        """
        Get documents by ID or filter.

        Args:
            collection: Collection name
            ids: Document IDs to retrieve
            where: Metadata filter
            limit: Maximum results

        Returns:
            List of document dictionaries
        """
        coll = self.manager.get_collection(collection)

        kwargs = {"include": ["documents", "metadatas"]}

        if ids:
            kwargs["ids"] = ids
        if where:
            kwargs["where"] = where
        if limit:
            kwargs["limit"] = limit

        results = self._retry_operation(lambda: coll.get(**kwargs))

        formatted = []
        for i in range(len(results["ids"])):
            metadata = results["metadatas"][i]
            if self.auto_flatten:
                metadata = MetadataProcessor.unflatten(metadata)

            formatted.append({
                "id": results["ids"][i],
                "content": results["documents"][i] if results.get("documents") else None,
                "metadata": metadata
            })

        return formatted

    def update(
        self,
        collection: str,
        ids: List[str],
        documents: List[str] = None,
        metadatas: List[Dict] = None,
        embeddings: List[List[float]] = None
    ) -> None:
        """
        Update existing documents.

        Args:
            collection: Collection name
            ids: Document IDs to update
            documents: New document texts
            metadatas: New metadata
            embeddings: New embeddings
        """
        coll = self.manager.get_collection(collection)

        kwargs = {"ids": ids}

        if documents:
            kwargs["documents"] = documents
        if metadatas:
            if self.auto_flatten:
                metadatas = [MetadataProcessor.flatten(m) for m in metadatas]
            kwargs["metadatas"] = metadatas
        if embeddings:
            kwargs["embeddings"] = embeddings

        self._retry_operation(lambda: coll.update(**kwargs))

    def delete(
        self,
        collection: str,
        ids: List[str] = None,
        where: Dict = None
    ) -> None:
        """
        Delete documents by ID or filter.

        Args:
            collection: Collection name
            ids: Document IDs to delete
            where: Metadata filter for deletion
        """
        coll = self.manager.get_collection(collection)

        kwargs = {}
        if ids:
            kwargs["ids"] = ids
        if where:
            kwargs["where"] = where

        if kwargs:
            self._retry_operation(lambda: coll.delete(**kwargs))

    def count(self, collection: str) -> int:
        """Get document count in collection."""
        coll = self.manager.get_collection(collection)
        return coll.count()

    def _retry_operation(self, operation: Callable, max_retries: int = None) -> Any:
        """Execute operation with retry logic."""
        max_retries = max_retries or self.config.max_retries

        for attempt in range(max_retries):
            try:
                return operation()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise

                logger.warning(f"Operation failed (attempt {attempt + 1}): {e}")
                time.sleep(self.config.retry_delay * (attempt + 1))


class BackupManager:
    """Utilities for backing up and restoring ChromaDB data."""

    def __init__(self, store: MemoryStore):
        self.store = store

    def export_collection(
        self,
        collection: str,
        output_path: str,
        include_embeddings: bool = False
    ) -> int:
        """
        Export collection to JSON file.

        Args:
            collection: Collection name
            output_path: Output file path
            include_embeddings: Include embedding vectors (large!)

        Returns:
            Number of documents exported
        """
        coll = self.store.manager.get_collection(collection)

        include = ["documents", "metadatas"]
        if include_embeddings:
            include.append("embeddings")

        # Get all documents
        results = coll.get(include=include)

        # Format for export
        documents = []
        for i in range(len(results["ids"])):
            doc = {
                "id": results["ids"][i],
                "content": results["documents"][i] if results.get("documents") else None,
                "metadata": results["metadatas"][i] if results.get("metadatas") else {}
            }
            if include_embeddings and results.get("embeddings"):
                doc["embedding"] = results["embeddings"][i]

            documents.append(doc)

        # Write to file
        export_data = {
            "collection": collection,
            "exported_at": datetime.now().isoformat(),
            "count": len(documents),
            "documents": documents
        }

        with open(output_path, 'w') as f:
            json.dump(export_data, f, indent=2)

        return len(documents)

    def import_collection(
        self,
        input_path: str,
        collection: str = None,
        overwrite: bool = False
    ) -> int:
        """
        Import collection from JSON file.

        Args:
            input_path: Input file path
            collection: Target collection (uses file's collection if not specified)
            overwrite: Delete existing collection first

        Returns:
            Number of documents imported
        """
        with open(input_path, 'r') as f:
            data = json.load(f)

        target_collection = collection or data["collection"]

        if overwrite:
            try:
                self.store.manager.delete_collection(target_collection)
            except Exception:
                pass  # Collection might not exist

        documents = data["documents"]

        # Extract components
        ids = [d["id"] for d in documents]
        contents = [d["content"] for d in documents]
        metadatas = [d.get("metadata", {}) for d in documents]
        embeddings = None

        if documents and "embedding" in documents[0]:
            embeddings = [d["embedding"] for d in documents]

        self.store.add(
            collection=target_collection,
            documents=contents,
            metadatas=metadatas,
            ids=ids,
            embeddings=embeddings
        )

        return len(documents)


# Convenience functions for quick usage
def quick_store(path: str = "./quick_memories") -> MemoryStore:
    """Get a quick memory store with default settings."""
    return MemoryStore(path)


def quick_add(store: MemoryStore, texts: List[str], collection: str = "default") -> List[str]:
    """Quickly add texts to a collection."""
    return store.add(collection, texts)


def quick_search(store: MemoryStore, query: str, k: int = 5, collection: str = "default") -> List[Dict]:
    """Quickly search a collection."""
    return store.search(collection, query, k=k)


if __name__ == "__main__":
    # Demo usage
    print("ChromaDB Client Demo")
    print("=" * 50)

    # Create store
    store = MemoryStore("./demo_memories")

    # Add documents
    docs = [
        "Vector databases enable fast similarity search",
        "ChromaDB is great for prototyping AI applications",
        "Embeddings represent semantic meaning of text"
    ]
    metadatas = [
        {"topic": "databases", "importance": 1},
        {"topic": "tools", "importance": 2},
        {"topic": "ml", "importance": 1}
    ]

    ids = store.add("demo", docs, metadatas)
    print(f"Added {len(ids)} documents")

    # Search
    results = store.search("demo", "What is vector search?", k=2)
    print("\nSearch results:")
    for r in results:
        print(f"  - {r['content'][:50]}... (similarity: {r['similarity']:.3f})")

    # Get by filter
    filtered = store.get("demo", where={"topic": "databases"})
    print(f"\nDocuments about databases: {len(filtered)}")

    # Count
    print(f"Total documents: {store.count('demo')}")

    # Cleanup
    store.manager.delete_collection("demo")
    print("\nDemo complete!")
