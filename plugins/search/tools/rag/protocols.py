"""Protocol definitions for RAG pipeline components.

These protocols define interfaces that can be swapped out for different
implementations (e.g., different chunking strategies, embedding providers).
"""
from typing import Protocol, runtime_checkable, Any
from dataclasses import dataclass, field
import numpy as np
from numpy.typing import NDArray


@dataclass
class Document:
    """A source document from the repository."""
    id: str
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def __hash__(self):
        return hash(self.id)


@dataclass
class Chunk:
    """A chunk extracted from a document."""
    id: str
    content: str
    parent_id: str
    start_idx: int
    end_idx: int
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_document(self) -> Document:
        """Convert chunk to document for retrieval."""
        return Document(
            id=self.id,
            content=self.content,
            metadata={**self.metadata, 'parent_id': self.parent_id}
        )


@dataclass
class SearchResult:
    """A search result with score."""
    document: Document
    score: float
    metadata: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class Chunker(Protocol):
    """Protocol for document chunking strategies."""

    @property
    def name(self) -> str:
        """Unique identifier for this chunker."""
        ...

    def chunk(self, document: Document) -> list[Chunk]:
        """Split document into chunks."""
        ...


@runtime_checkable
class Embedder(Protocol):
    """Protocol for embedding generation."""

    @property
    def name(self) -> str:
        """Unique identifier for this embedder."""
        ...

    @property
    def dimensions(self) -> int:
        """Dimensionality of embeddings."""
        ...

    def embed(self, text: str) -> NDArray[np.float32]:
        """Generate embedding for single text."""
        ...

    def embed_batch(self, texts: list[str]) -> NDArray[np.float32]:
        """Generate embeddings for multiple texts."""
        ...


@runtime_checkable
class Retriever(Protocol):
    """Protocol for document retrieval."""

    @property
    def name(self) -> str:
        """Unique identifier for this retriever."""
        ...

    def index(self, documents: list[Document]) -> None:
        """Build search index from documents."""
        ...

    def search(self, query: str, k: int = 10) -> list[SearchResult]:
        """Search for relevant documents."""
        ...


@runtime_checkable
class Reranker(Protocol):
    """Protocol for reranking search results.

    Rerankers take initial retrieval results and re-score them
    using more expensive but accurate methods (cross-encoders, LLMs).
    """

    @property
    def name(self) -> str:
        """Unique identifier for this reranker."""
        ...

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int | None = None
    ) -> list[SearchResult]:
        """Rerank search results based on query-document relevance.

        Args:
            query: Search query
            results: Initial search results to rerank
            top_k: Number of results to return (default: all)

        Returns:
            Reranked results with updated scores
        """
        ...
