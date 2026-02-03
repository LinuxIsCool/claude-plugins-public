"""Contextual chunking using Anthropic's technique.

Prepends LLM-generated context to each chunk before embedding,
improving retrieval accuracy by ~67% (per Anthropic research).
"""
from .protocols import Document, Chunk, Chunker
from .ollama_generator import OllamaGenerator


CONTEXT_PROMPT = """<document>
{document_content}
</document>

Here is a chunk from the document:
<chunk>
{chunk_content}
</chunk>

Please give a short succinct context (1-2 sentences) to situate this chunk within the overall document for improving search retrieval. Answer only with the context, nothing else."""


class ContextualChunker:
    """
    Wrap a chunker to add contextual descriptions to each chunk.

    This implements Anthropic's "Contextual Retrieval" technique:
    1. Chunk document normally
    2. For each chunk, use LLM to generate context describing how it
       fits within the larger document
    3. Prepend context to chunk content before embedding

    The context helps retrieval by adding document-level understanding
    to each chunk, dramatically improving accuracy.

    Reference: https://www.anthropic.com/engineering/contextual-retrieval
    """

    def __init__(
        self,
        base_chunker: Chunker,
        generator: OllamaGenerator | None = None,
        max_doc_chars: int = 8000,
        cache_contexts: bool = True
    ):
        """
        Initialize contextual chunker.

        Args:
            base_chunker: Underlying chunker for splitting documents
            generator: LLM generator for context (creates default if None)
            max_doc_chars: Max document chars to include in prompt
            cache_contexts: Whether to cache generated contexts
        """
        self.base_chunker = base_chunker
        self.generator = generator or OllamaGenerator()
        self.max_doc_chars = max_doc_chars
        self.cache_contexts = cache_contexts
        self._context_cache: dict[str, str] = {}

    @property
    def name(self) -> str:
        """Unique identifier for this chunker."""
        return f"contextual:{self.base_chunker.name}"

    def chunk(self, document: Document) -> list[Chunk]:
        """
        Chunk document and add contextual descriptions.

        Args:
            document: Document to chunk

        Returns:
            Chunks with context prepended to content
        """
        # First, chunk normally
        base_chunks = self.base_chunker.chunk(document)

        if not base_chunks:
            return []

        # Truncate document for prompt if needed
        doc_content = document.content
        if len(doc_content) > self.max_doc_chars:
            doc_content = doc_content[:self.max_doc_chars] + "\n...[truncated]..."

        # Add context to each chunk
        contextual_chunks = []
        for chunk in base_chunks:
            context = self._get_context(doc_content, chunk)
            contextual_chunks.append(self._apply_context(chunk, context))

        return contextual_chunks

    def _get_context(self, doc_content: str, chunk: Chunk) -> str:
        """Generate or retrieve cached context for a chunk."""
        cache_key = f"{chunk.parent_id}:{chunk.id}"

        if self.cache_contexts and cache_key in self._context_cache:
            return self._context_cache[cache_key]

        prompt = CONTEXT_PROMPT.format(
            document_content=doc_content,
            chunk_content=chunk.content
        )

        try:
            context = self.generator.generate(prompt, max_tokens=100)
        except (ConnectionError, TimeoutError, OSError) as e:
            # Fall back to basic context on LLM unavailability
            context = self._fallback_context(chunk)

        if self.cache_contexts:
            self._context_cache[cache_key] = context

        return context

    def _fallback_context(self, chunk: Chunk) -> str:
        """Generate basic context when LLM is unavailable."""
        file_path = chunk.metadata.get('source', chunk.parent_id)
        chunk_num = chunk.metadata.get('chunk_num', 0)

        # Infer file type from path
        if '.py' in file_path:
            file_type = "Python source file"
        elif '.md' in file_path:
            file_type = "Markdown documentation"
        elif '.ts' in file_path or '.js' in file_path:
            file_type = "JavaScript/TypeScript file"
        else:
            file_type = "source file"

        return f"This is chunk {chunk_num + 1} from {file_path}, a {file_type}."

    def _apply_context(self, chunk: Chunk, context: str) -> Chunk:
        """Create new chunk with context prepended."""
        contextual_content = f"{context}\n\n{chunk.content}"

        return Chunk(
            id=chunk.id,
            content=contextual_content,
            parent_id=chunk.parent_id,
            start_idx=chunk.start_idx,
            end_idx=chunk.end_idx,
            metadata={
                **chunk.metadata,
                'context': context,
                'original_content': chunk.content,
                'chunker': self.name
            }
        )

    def chunk_batch(
        self,
        documents: list[Document],
        show_progress: bool = True
    ) -> list[Chunk]:
        """
        Chunk multiple documents with progress indication.

        Args:
            documents: Documents to chunk
            show_progress: Whether to print progress

        Returns:
            All chunks from all documents
        """
        all_chunks = []
        total = len(documents)

        for i, doc in enumerate(documents):
            if show_progress and i % 10 == 0:
                print(f"Chunking document {i+1}/{total}: {doc.id}")

            chunks = self.chunk(doc)
            all_chunks.extend(chunks)

        if show_progress:
            print(f"Generated {len(all_chunks)} contextual chunks from {total} documents")

        return all_chunks

    def clear_cache(self) -> None:
        """Clear the context cache."""
        self._context_cache.clear()
