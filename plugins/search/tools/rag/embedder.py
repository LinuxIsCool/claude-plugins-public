"""Ollama embeddings provider."""
import numpy as np
from numpy.typing import NDArray
from .protocols import Embedder


class OllamaEmbedder:
    """
    Generate embeddings via local Ollama instance.

    Prerequisites:
        1. Install Ollama: curl https://ollama.ai/install.sh | sh
        2. Pull model: ollama pull nomic-embed-text
        3. Start server: ollama serve (runs on port 11434 by default)
    """

    name = "ollama"

    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434"
    ):
        self.model = model
        self.base_url = base_url
        self._dimensions: int | None = None

    @property
    def dimensions(self) -> int:
        """Get embedding dimensions (lazy loaded)."""
        if self._dimensions is None:
            # Get dimensions from test embedding
            test_emb = self.embed("test")
            self._dimensions = len(test_emb)
        return self._dimensions

    def embed(self, text: str) -> NDArray[np.float32]:
        """Generate embedding for single text."""
        import httpx

        try:
            response = httpx.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
                timeout=30.0
            )
            response.raise_for_status()

            embedding = np.array(response.json()["embedding"], dtype=np.float32)

            # Normalize to unit length for cosine similarity
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            return embedding

        except httpx.ConnectError:
            raise ConnectionError(
                f"Cannot connect to Ollama at {self.base_url}. "
                "Make sure Ollama is running: ollama serve"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ValueError(
                    f"Model '{self.model}' not found. "
                    f"Pull it first: ollama pull {self.model}"
                )
            raise

    def embed_batch(self, texts: list[str], show_progress: bool = True) -> NDArray[np.float32]:
        """Generate embeddings for multiple texts."""
        embeddings = []

        for i, text in enumerate(texts):
            if show_progress and (i + 1) % 10 == 0:
                print(f"  Embedding {i + 1}/{len(texts)}...")

            emb = self.embed(text)
            embeddings.append(emb)

        return np.array(embeddings, dtype=np.float32)
