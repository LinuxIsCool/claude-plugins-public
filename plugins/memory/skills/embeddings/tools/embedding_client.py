#!/usr/bin/env python3
"""
Unified Embedding Client

Provider-agnostic embedding client supporting multiple backends:
- Sentence Transformers (local)
- OpenAI API
- Ollama (local server)
- ONNX Runtime (optimized local)

Usage:
    from embedding_client import EmbeddingClient

    # Auto-select best available provider
    client = EmbeddingClient()

    # Specific provider
    client = EmbeddingClient(provider="openai", model="text-embedding-3-small")
    client = EmbeddingClient(provider="ollama", model="nomic-embed-text")
    client = EmbeddingClient(provider="sentence-transformers", model="all-MiniLM-L6-v2")

    # Generate embeddings
    embeddings = client.encode(["text1", "text2"])
    embedding = client.encode_single("single text")
"""

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import List, Literal, Optional, Union

import numpy as np


class Provider(Enum):
    """Supported embedding providers."""
    SENTENCE_TRANSFORMERS = "sentence-transformers"
    OPENAI = "openai"
    OLLAMA = "ollama"
    ONNX = "onnx"


@dataclass
class EmbeddingConfig:
    """Configuration for embedding client."""
    provider: str = "auto"
    model: str = "auto"
    device: str = "cpu"
    batch_size: int = 32
    normalize: bool = True
    cache_dir: Optional[str] = None
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    dimensions: Optional[int] = None  # For Matryoshka/OpenAI dimension reduction


class BaseEmbedder(ABC):
    """Abstract base class for embedding backends."""

    @abstractmethod
    def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True
    ) -> np.ndarray:
        """Encode list of texts to embeddings."""
        pass

    @abstractmethod
    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        """Encode single text to embedding."""
        pass

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return embedding dimensions."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return model name."""
        pass


class SentenceTransformerEmbedder(BaseEmbedder):
    """Sentence Transformers backend."""

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        device: str = "cpu",
        cache_dir: Optional[str] = None,
        target_dimensions: Optional[int] = None
    ):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )

        self._model_name = model_name
        self.target_dimensions = target_dimensions

        # Set cache directory if specified
        if cache_dir:
            os.environ["SENTENCE_TRANSFORMERS_HOME"] = cache_dir

        self.model = SentenceTransformer(model_name, device=device)
        self._dimensions = self.model.get_sentence_embedding_dimension()

    def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True
    ) -> np.ndarray:
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=False  # We'll handle normalization
        )

        # Apply Matryoshka truncation if requested
        if self.target_dimensions and self.target_dimensions < embeddings.shape[1]:
            embeddings = embeddings[:, :self.target_dimensions]

        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / norms

        return embeddings

    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        return self.encode([text], normalize=normalize)[0]

    @property
    def dimensions(self) -> int:
        return self.target_dimensions or self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name


class OpenAIEmbedder(BaseEmbedder):
    """OpenAI API backend."""

    def __init__(
        self,
        model_name: str = "text-embedding-3-small",
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        dimensions: Optional[int] = None
    ):
        try:
            from openai import OpenAI
        except ImportError:
            raise ImportError(
                "openai not installed. Run: pip install openai"
            )

        self._model_name = model_name
        self.target_dimensions = dimensions

        kwargs = {}
        if api_key:
            kwargs["api_key"] = api_key
        if api_base:
            kwargs["base_url"] = api_base

        self.client = OpenAI(**kwargs)

        # Get dimensions from test embedding
        test_kwargs = {"input": "test", "model": model_name}
        if dimensions:
            test_kwargs["dimensions"] = dimensions
        response = self.client.embeddings.create(**test_kwargs)
        self._dimensions = len(response.data[0].embedding)

    def encode(
        self,
        texts: List[str],
        batch_size: int = 100,
        normalize: bool = True
    ) -> np.ndarray:
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]

            kwargs = {"input": batch, "model": self._model_name}
            if self.target_dimensions:
                kwargs["dimensions"] = self.target_dimensions

            response = self.client.embeddings.create(**kwargs)
            sorted_data = sorted(response.data, key=lambda x: x.index)
            batch_embeddings = [d.embedding for d in sorted_data]
            all_embeddings.extend(batch_embeddings)

        embeddings = np.array(all_embeddings)

        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / norms

        return embeddings

    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        return self.encode([text], normalize=normalize)[0]

    @property
    def dimensions(self) -> int:
        return self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name


class OllamaEmbedder(BaseEmbedder):
    """Ollama backend."""

    def __init__(
        self,
        model_name: str = "nomic-embed-text",
        api_base: Optional[str] = None,
        target_dimensions: Optional[int] = None
    ):
        try:
            import ollama
        except ImportError:
            raise ImportError(
                "ollama not installed. Run: pip install ollama"
            )

        self._model_name = model_name
        self.target_dimensions = target_dimensions

        if api_base:
            self.client = ollama.Client(host=api_base)
        else:
            self.client = ollama

        # Get dimensions
        response = self.client.embeddings(model=model_name, prompt="test")
        self._dimensions = len(response["embedding"])

    def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True
    ) -> np.ndarray:
        embeddings = []

        for text in texts:
            response = self.client.embeddings(model=self._model_name, prompt=text)
            embeddings.append(response["embedding"])

        embeddings = np.array(embeddings)

        # Apply Matryoshka truncation if requested
        if self.target_dimensions and self.target_dimensions < embeddings.shape[1]:
            embeddings = embeddings[:, :self.target_dimensions]

        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / norms

        return embeddings

    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        return self.encode([text], normalize=normalize)[0]

    @property
    def dimensions(self) -> int:
        return self.target_dimensions or self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name


class ONNXEmbedder(BaseEmbedder):
    """ONNX Runtime backend for optimized inference."""

    def __init__(
        self,
        model_path: str,
        tokenizer_path: Optional[str] = None,
        max_length: int = 256,
        num_threads: int = 4,
        target_dimensions: Optional[int] = None
    ):
        try:
            import onnxruntime as ort
            from transformers import AutoTokenizer
        except ImportError:
            raise ImportError(
                "onnxruntime and transformers required. "
                "Run: pip install onnxruntime transformers"
            )

        self._model_name = Path(model_path).name
        self.max_length = max_length
        self.target_dimensions = target_dimensions

        tokenizer_path = tokenizer_path or model_path
        self.tokenizer = AutoTokenizer.from_pretrained(tokenizer_path)

        # Configure session
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = num_threads
        sess_options.inter_op_num_threads = num_threads
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        # Find ONNX file
        model_dir = Path(model_path)
        if model_dir.is_dir():
            onnx_files = list(model_dir.glob("*.onnx"))
            if onnx_files:
                onnx_path = str(onnx_files[0])
            else:
                raise ValueError(f"No ONNX file found in {model_path}")
        else:
            onnx_path = model_path

        self.session = ort.InferenceSession(
            onnx_path,
            sess_options=sess_options,
            providers=["CPUExecutionProvider"]
        )

        self.input_names = [inp.name for inp in self.session.get_inputs()]

        # Determine dimensions from test inference
        test_emb = self._encode_batch(["test"])
        self._dimensions = test_emb.shape[1]

    def _mean_pooling(
        self,
        token_embeddings: np.ndarray,
        attention_mask: np.ndarray
    ) -> np.ndarray:
        input_mask_expanded = np.expand_dims(attention_mask, axis=-1)
        sum_embeddings = np.sum(token_embeddings * input_mask_expanded, axis=1)
        sum_mask = np.clip(np.sum(input_mask_expanded, axis=1), a_min=1e-9, a_max=None)
        return sum_embeddings / sum_mask

    def _encode_batch(self, texts: List[str]) -> np.ndarray:
        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="np"
        )

        onnx_inputs = {
            "input_ids": inputs["input_ids"].astype(np.int64),
            "attention_mask": inputs["attention_mask"].astype(np.int64)
        }

        if "token_type_ids" in self.input_names:
            onnx_inputs["token_type_ids"] = inputs.get(
                "token_type_ids",
                np.zeros_like(inputs["input_ids"])
            ).astype(np.int64)

        outputs = self.session.run(None, onnx_inputs)
        return self._mean_pooling(outputs[0], inputs["attention_mask"])

    def encode(
        self,
        texts: List[str],
        batch_size: int = 32,
        normalize: bool = True
    ) -> np.ndarray:
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = self._encode_batch(batch)
            all_embeddings.append(embeddings)

        embeddings = np.vstack(all_embeddings)

        # Apply Matryoshka truncation if requested
        if self.target_dimensions and self.target_dimensions < embeddings.shape[1]:
            embeddings = embeddings[:, :self.target_dimensions]

        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / norms

        return embeddings

    def encode_single(self, text: str, normalize: bool = True) -> np.ndarray:
        return self.encode([text], normalize=normalize)[0]

    @property
    def dimensions(self) -> int:
        return self.target_dimensions or self._dimensions

    @property
    def model_name(self) -> str:
        return self._model_name


class EmbeddingClient:
    """
    Unified embedding client with automatic provider selection.

    Provides a consistent interface across different embedding backends,
    with automatic fallback and provider detection.
    """

    # Default models for each provider
    DEFAULT_MODELS = {
        Provider.SENTENCE_TRANSFORMERS: "all-MiniLM-L6-v2",
        Provider.OPENAI: "text-embedding-3-small",
        Provider.OLLAMA: "nomic-embed-text",
        Provider.ONNX: None  # Requires explicit path
    }

    def __init__(
        self,
        provider: Union[str, Provider] = "auto",
        model: str = "auto",
        device: str = "cpu",
        normalize: bool = True,
        batch_size: int = 32,
        dimensions: Optional[int] = None,
        cache_dir: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None
    ):
        """
        Initialize embedding client.

        Args:
            provider: Embedding provider ("auto", "sentence-transformers", "openai", "ollama", "onnx")
            model: Model name or "auto" for default
            device: Device for local models ("cpu", "cuda", "mps")
            normalize: Whether to L2-normalize embeddings
            batch_size: Default batch size for encoding
            dimensions: Target dimensions (for Matryoshka/OpenAI)
            cache_dir: Cache directory for models
            api_key: API key for OpenAI
            api_base: Base URL for API providers
        """
        self.normalize = normalize
        self.batch_size = batch_size

        # Resolve provider
        if provider == "auto":
            provider = self._auto_detect_provider()
        elif isinstance(provider, str):
            provider = Provider(provider)

        # Resolve model
        if model == "auto":
            model = self.DEFAULT_MODELS.get(provider)
            if not model:
                raise ValueError(f"No default model for provider {provider}")

        # Initialize backend
        self._embedder = self._create_embedder(
            provider=provider,
            model=model,
            device=device,
            dimensions=dimensions,
            cache_dir=cache_dir,
            api_key=api_key,
            api_base=api_base
        )

        self._provider = provider

    def _auto_detect_provider(self) -> Provider:
        """Auto-detect best available provider."""
        # Check for OpenAI API key
        if os.getenv("OPENAI_API_KEY"):
            try:
                from openai import OpenAI
                return Provider.OPENAI
            except ImportError:
                pass

        # Check for Ollama
        try:
            import ollama
            ollama.list()  # Test connection
            return Provider.OLLAMA
        except Exception:
            pass

        # Fall back to sentence-transformers
        try:
            from sentence_transformers import SentenceTransformer
            return Provider.SENTENCE_TRANSFORMERS
        except ImportError:
            pass

        raise RuntimeError(
            "No embedding provider available. Install one of: "
            "sentence-transformers, openai, ollama"
        )

    def _create_embedder(
        self,
        provider: Provider,
        model: str,
        device: str,
        dimensions: Optional[int],
        cache_dir: Optional[str],
        api_key: Optional[str],
        api_base: Optional[str]
    ) -> BaseEmbedder:
        """Create embedder instance for provider."""
        if provider == Provider.SENTENCE_TRANSFORMERS:
            return SentenceTransformerEmbedder(
                model_name=model,
                device=device,
                cache_dir=cache_dir,
                target_dimensions=dimensions
            )
        elif provider == Provider.OPENAI:
            return OpenAIEmbedder(
                model_name=model,
                api_key=api_key,
                api_base=api_base,
                dimensions=dimensions
            )
        elif provider == Provider.OLLAMA:
            return OllamaEmbedder(
                model_name=model,
                api_base=api_base,
                target_dimensions=dimensions
            )
        elif provider == Provider.ONNX:
            return ONNXEmbedder(
                model_path=model,
                target_dimensions=dimensions
            )
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: Optional[int] = None,
        normalize: Optional[bool] = None
    ) -> np.ndarray:
        """
        Encode texts to embeddings.

        Args:
            texts: Single text or list of texts
            batch_size: Override default batch size
            normalize: Override default normalization

        Returns:
            Embeddings as numpy array. Shape (dims,) for single text,
            (n, dims) for list of texts.
        """
        single_input = isinstance(texts, str)
        if single_input:
            texts = [texts]

        embeddings = self._embedder.encode(
            texts,
            batch_size=batch_size or self.batch_size,
            normalize=normalize if normalize is not None else self.normalize
        )

        if single_input:
            return embeddings[0]
        return embeddings

    def encode_single(
        self,
        text: str,
        normalize: Optional[bool] = None
    ) -> np.ndarray:
        """Encode single text to embedding."""
        return self._embedder.encode_single(
            text,
            normalize=normalize if normalize is not None else self.normalize
        )

    def similarity(
        self,
        text1: Union[str, np.ndarray],
        text2: Union[str, np.ndarray]
    ) -> float:
        """Compute cosine similarity between two texts or embeddings."""
        if isinstance(text1, str):
            emb1 = self.encode_single(text1)
        else:
            emb1 = text1

        if isinstance(text2, str):
            emb2 = self.encode_single(text2)
        else:
            emb2 = text2

        # Normalize for cosine similarity
        emb1 = emb1 / np.linalg.norm(emb1)
        emb2 = emb2 / np.linalg.norm(emb2)

        return float(np.dot(emb1, emb2))

    @property
    def dimensions(self) -> int:
        """Return embedding dimensions."""
        return self._embedder.dimensions

    @property
    def model_name(self) -> str:
        """Return model name."""
        return self._embedder.model_name

    @property
    def provider(self) -> str:
        """Return provider name."""
        return self._provider.value

    def __repr__(self) -> str:
        return (
            f"EmbeddingClient(provider='{self.provider}', "
            f"model='{self.model_name}', dims={self.dimensions})"
        )


# Convenience functions
def get_embedding(
    text: str,
    provider: str = "auto",
    model: str = "auto"
) -> np.ndarray:
    """Quick function to get a single embedding."""
    client = EmbeddingClient(provider=provider, model=model)
    return client.encode_single(text)


def get_embeddings(
    texts: List[str],
    provider: str = "auto",
    model: str = "auto"
) -> np.ndarray:
    """Quick function to get embeddings for multiple texts."""
    client = EmbeddingClient(provider=provider, model=model)
    return client.encode(texts)


if __name__ == "__main__":
    # Demo usage
    print("Embedding Client Demo")
    print("=" * 50)

    # Auto-detect provider
    client = EmbeddingClient()
    print(f"\nClient: {client}")

    # Generate embeddings
    texts = [
        "Machine learning is transforming technology.",
        "AI uses algorithms to learn from data.",
        "The weather is nice today."
    ]

    print(f"\nEncoding {len(texts)} texts...")
    embeddings = client.encode(texts)
    print(f"Embeddings shape: {embeddings.shape}")

    # Compute similarities
    print("\nSimilarities:")
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            sim = client.similarity(embeddings[i], embeddings[j])
            print(f"  '{texts[i][:30]}...' <-> '{texts[j][:30]}...': {sim:.4f}")
