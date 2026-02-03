"""Recursive text splitter for code-aware chunking."""
from .protocols import Document, Chunk, Chunker


class RecursiveTextSplitter:
    """
    Split text recursively using separators.

    Follows LangChain's RecursiveCharacterTextSplitter pattern:
    - Try first separator (e.g., class definitions)
    - If chunks too large, try next separator (e.g., function definitions)
    - Continue until chunk size is reached

    Code-aware separators preserve logical boundaries (classes, functions).
    """

    name = "recursive"

    # Default separators optimized for code
    DEFAULT_SEPARATORS = [
        "\n\n\n",       # Multiple blank lines (section breaks)
        "\nclass ",     # Python class definitions
        "\ndef ",       # Python function definitions
        "\nasync def ", # Python async functions
        "\nfunction ",  # JS function definitions
        "\nexport ",    # JS/TS exports
        "\n\n",         # Paragraph breaks
        "\n",           # Line breaks
        " ",            # Word breaks
    ]

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        separators: list[str] | None = None
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or self.DEFAULT_SEPARATORS

    def chunk(self, document: Document) -> list[Chunk]:
        """Split document into chunks preserving code structure.

        Note: start_idx/end_idx are approximate due to recursive splitting
        and separator re-attachment. Use chunk_num for ordering.
        """
        splits = self._split_recursive(document.content, list(self.separators))

        chunks = []

        for i, split in enumerate(splits):
            if not split.strip():
                continue

            # Find actual position in original document (best effort)
            # This handles cases where the split content exists verbatim
            start_idx = document.content.find(split)
            if start_idx == -1:
                # Content was modified during splitting (e.g., separator re-added)
                # Fall back to sequential estimation
                start_idx = sum(len(c.content) for c in chunks)

            chunk = Chunk(
                id=f"{document.id}:chunk:{i}",
                content=split,
                parent_id=document.id,
                start_idx=start_idx,
                end_idx=start_idx + len(split),
                metadata={
                    **document.metadata,
                    'chunk_num': i,
                    'chunker': self.name
                }
            )
            chunks.append(chunk)

        return chunks

    def _split_recursive(self, text: str, separators: list[str]) -> list[str]:
        """Recursively split text until chunks are small enough."""
        # Base case: text fits in chunk
        if len(text) <= self.chunk_size:
            return [text] if text.strip() else []

        # No more separators: force split
        if not separators:
            return self._split_fixed(text)

        sep = separators[0]
        remaining_seps = separators[1:]

        # Try splitting with current separator
        if sep in text:
            parts = text.split(sep)
            result = []

            for i, part in enumerate(parts):
                # Re-add separator to preserve context (except first part)
                if i > 0 and sep.strip():
                    part = sep + part

                if len(part) <= self.chunk_size:
                    if part.strip():
                        result.append(part)
                else:
                    # Recurse with remaining separators
                    result.extend(self._split_recursive(part, remaining_seps))

            # Merge small chunks to target chunk_size
            result = self._merge_small_chunks(result)
            return result

        # Separator not found, try next
        return self._split_recursive(text, remaining_seps)

    def _merge_small_chunks(self, chunks: list[str]) -> list[str]:
        """Merge adjacent small chunks up to chunk_size."""
        if not chunks:
            return []

        merged = []
        current = chunks[0]

        for chunk in chunks[1:]:
            # Can we merge?
            combined_len = len(current) + len(chunk) + 1  # +1 for newline
            if combined_len <= self.chunk_size:
                current = current + "\n" + chunk
            else:
                if current.strip():
                    merged.append(current)
                current = chunk

        if current.strip():
            merged.append(current)

        return merged

    def _split_fixed(self, text: str) -> list[str]:
        """Fixed-size split as final fallback."""
        chunks = []
        step = self.chunk_size - self.chunk_overlap

        for i in range(0, len(text), step):
            chunk = text[i:i + self.chunk_size]
            if chunk.strip():
                chunks.append(chunk)

        return chunks
