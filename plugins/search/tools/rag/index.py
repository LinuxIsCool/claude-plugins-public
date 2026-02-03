"""File-based index storage for chunks and embeddings."""
import json
import numpy as np
from pathlib import Path
from .protocols import Document


class FileIndex:
    """
    Local file storage for RAG index.

    Stores:
    - chunks.jsonl: Document content and metadata
    - embeddings.npz: Numpy array of embedding vectors
    - config.json: Index configuration
    """

    def __init__(self, index_dir: str | Path = ".rag-index"):
        self.index_dir = Path(index_dir)
        self.chunks_file = self.index_dir / "chunks.jsonl"
        self.embeddings_file = self.index_dir / "embeddings.npz"
        self.config_file = self.index_dir / "config.json"

    def save(
        self,
        documents: list[Document],
        embeddings: np.ndarray,
        config: dict | None = None
    ) -> None:
        """Save documents and embeddings to disk."""
        self.index_dir.mkdir(parents=True, exist_ok=True)

        # Save documents as JSONL
        with open(self.chunks_file, 'w') as f:
            for doc in documents:
                record = {
                    'id': doc.id,
                    'content': doc.content,
                    'metadata': doc.metadata
                }
                f.write(json.dumps(record) + '\n')

        # Save embeddings as compressed numpy
        np.savez_compressed(self.embeddings_file, embeddings=embeddings)

        # Save config
        config_data = config or {}
        config_data['num_documents'] = len(documents)
        config_data['embedding_dim'] = embeddings.shape[1] if len(embeddings) > 0 else 0

        with open(self.config_file, 'w') as f:
            json.dump(config_data, f, indent=2)

        print(f"Saved {len(documents)} documents to {self.index_dir}")

    def load(self) -> tuple[list[Document], np.ndarray]:
        """Load documents and embeddings from disk."""
        if not self.exists():
            raise FileNotFoundError(
                f"Index not found at {self.index_dir}. "
                "Run 'rag index' first to build the index."
            )

        # Load documents
        documents = []
        with open(self.chunks_file) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                    documents.append(Document(
                        id=record['id'],
                        content=record['content'],
                        metadata=record.get('metadata', {})
                    ))
                except json.JSONDecodeError:
                    # Skip malformed entries - could happen from interrupted writes
                    continue

        # Load embeddings
        data = np.load(self.embeddings_file)
        embeddings = data['embeddings']

        return documents, embeddings

    def exists(self) -> bool:
        """Check if index exists."""
        return (
            self.chunks_file.exists() and
            self.embeddings_file.exists()
        )

    def get_stats(self) -> dict:
        """Get index statistics."""
        if not self.exists():
            return {'exists': False}

        with open(self.config_file) as f:
            config = json.load(f)

        return {
            'exists': True,
            'index_dir': str(self.index_dir),
            'num_documents': config.get('num_documents', 0),
            'embedding_dim': config.get('embedding_dim', 0),
            'chunks_size_bytes': self.chunks_file.stat().st_size,
            'embeddings_size_bytes': self.embeddings_file.stat().st_size
        }
