"""Cross-encoder reranker using sentence-transformers."""
import numpy as np
from .protocols import SearchResult, Document


class CrossEncoderReranker:
    """
    Rerank search results using a cross-encoder model.

    Cross-encoders jointly encode query+document pairs and are more accurate
    than bi-encoders (used in retrieval) but slower, making them ideal for
    reranking a small set of candidates.

    Popular models:
    - ms-marco-MiniLM-L-6-v2: Fast, good for English (default)
    - ms-marco-MiniLM-L-12-v2: Better accuracy, slower
    - ms-marco-electra-base: Best accuracy, slowest

    Prerequisites:
        pip install sentence-transformers torch
    """

    def __init__(
        self,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        batch_size: int = 32,
        normalize_scores: bool = True
    ):
        """
        Initialize cross-encoder reranker.

        Args:
            model_name: HuggingFace model identifier
            batch_size: Batch size for inference
            normalize_scores: Whether to normalize scores to [0, 1] via sigmoid
        """
        self.model_name = model_name
        self.batch_size = batch_size
        self.normalize_scores = normalize_scores
        self._model = None

    @property
    def name(self) -> str:
        """Unique identifier for this reranker."""
        return f"cross_encoder:{self.model_name.split('/')[-1]}"

    @property
    def model(self):
        """Lazy-load the cross-encoder model."""
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
            except ImportError:
                raise ImportError(
                    "sentence-transformers not installed. "
                    "Install with: pip install sentence-transformers torch"
                )

            self._model = CrossEncoder(self.model_name, max_length=512)

        return self._model

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int | None = None
    ) -> list[SearchResult]:
        """
        Rerank search results using cross-encoder scores.

        Args:
            query: Search query
            results: Initial search results
            top_k: Number of top results to return (default: all)

        Returns:
            Reranked results with cross-encoder scores
        """
        if not results:
            return []

        # Prepare query-document pairs
        pairs = [(query, result.document.content) for result in results]

        # Score in batches
        scores = self.model.predict(
            pairs,
            batch_size=self.batch_size,
            show_progress_bar=False
        )

        # Normalize scores if requested
        if self.normalize_scores:
            scores = self._sigmoid(scores)

        # Create reranked results with new scores
        reranked = []
        for result, new_score in zip(results, scores):
            # Preserve original score in metadata
            new_metadata = {
                **result.metadata,
                'original_score': result.score,
                'original_method': result.metadata.get('method', 'unknown'),
                'reranker': self.name
            }

            reranked.append(SearchResult(
                document=result.document,
                score=float(new_score),
                metadata=new_metadata
            ))

        # Sort by new score (descending)
        reranked.sort(key=lambda r: r.score, reverse=True)

        # Apply top_k if specified
        if top_k is not None:
            reranked = reranked[:top_k]

        return reranked

    def _sigmoid(self, scores: np.ndarray) -> np.ndarray:
        """Normalize scores to [0, 1] using sigmoid."""
        return 1 / (1 + np.exp(-scores))
