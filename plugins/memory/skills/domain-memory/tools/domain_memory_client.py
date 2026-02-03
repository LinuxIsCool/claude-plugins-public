#!/usr/bin/env python3
"""
Domain Memory Agent MCP Client

A Python client for interacting with the Domain Memory Agent MCP server.
Provides a clean interface for document storage, search, and summarization.

Usage:
    client = DomainMemoryClient()
    await client.connect()

    # Store a document
    doc = await client.store_document(
        title="My Document",
        content="Document content...",
        tags=["tag1", "tag2"]
    )

    # Search documents
    results = await client.search("query terms")

    # Summarize a document
    summary = await client.summarize(doc_id=doc["id"])

Requirements:
    pip install mcp

Author: Domain Memory Agent
License: MIT
"""

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any, Optional

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False


@dataclass
class Document:
    """Represents a document in the knowledge base."""
    id: str
    title: str
    content: str = ""
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    word_count: int = 0
    summary: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

    @classmethod
    def from_dict(cls, data: dict) -> "Document":
        """Create Document from API response dictionary."""
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            content=data.get("content", ""),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
            word_count=data.get("wordCount", 0),
            summary=data.get("summary"),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
        )


@dataclass
class SearchResult:
    """Represents a search result."""
    id: str
    title: str
    score: float
    relevant_excerpts: list[str]
    tags: list[str]
    word_count: int
    updated_at: str

    @classmethod
    def from_dict(cls, data: dict) -> "SearchResult":
        """Create SearchResult from API response dictionary."""
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            score=data.get("score", 0.0),
            relevant_excerpts=data.get("relevantExcerpts", []),
            tags=data.get("tags", []),
            word_count=data.get("wordCount", 0),
            updated_at=data.get("updatedAt", ""),
        )


@dataclass
class Summary:
    """Represents a document summary."""
    summary: str
    cached: bool
    document_id: Optional[str]
    sentence_count: int
    original_length: int = 0
    summary_length: int = 0

    @classmethod
    def from_dict(cls, data: dict) -> "Summary":
        """Create Summary from API response dictionary."""
        return cls(
            summary=data.get("summary", ""),
            cached=data.get("cached", False),
            document_id=data.get("documentId"),
            sentence_count=data.get("sentenceCount", 0),
            original_length=data.get("originalLength", 0),
            summary_length=data.get("summaryLength", 0),
        )


class DomainMemoryClient:
    """
    Client for the Domain Memory Agent MCP server.

    Provides methods for:
    - Document storage and retrieval
    - TF-IDF semantic search
    - Extractive summarization
    - Tag-based filtering

    Example:
        async with DomainMemoryClient() as client:
            doc = await client.store_document(
                title="Python Guide",
                content="Python is a programming language...",
                tags=["python", "programming"]
            )
            results = await client.search("programming language")
    """

    def __init__(
        self,
        server_command: str = "npx",
        server_args: Optional[list[str]] = None
    ):
        """
        Initialize the client.

        Args:
            server_command: Command to start the MCP server
            server_args: Arguments for the server command
        """
        if not MCP_AVAILABLE:
            raise ImportError(
                "MCP package not available. Install with: pip install mcp"
            )

        self.server_command = server_command
        self.server_args = server_args or [
            "-y",
            "@anthropic/domain-memory-agent"
        ]
        self._session: Optional[ClientSession] = None
        self._client = None

    async def __aenter__(self) -> "DomainMemoryClient":
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()

    async def connect(self):
        """
        Connect to the MCP server.

        Starts the server process and establishes communication.
        """
        server_params = StdioServerParameters(
            command=self.server_command,
            args=self.server_args,
        )

        self._client = stdio_client(server_params)
        self._read, self._write = await self._client.__aenter__()
        self._session = ClientSession(self._read, self._write)
        await self._session.__aenter__()
        await self._session.initialize()

    async def disconnect(self):
        """Disconnect from the MCP server."""
        if self._session:
            await self._session.__aexit__(None, None, None)
        if self._client:
            await self._client.__aexit__(None, None, None)

    async def _call_tool(self, tool_name: str, arguments: dict) -> dict:
        """
        Call an MCP tool and return the result.

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments

        Returns:
            Parsed JSON response from the tool
        """
        if not self._session:
            raise RuntimeError("Client not connected. Call connect() first.")

        result = await self._session.call_tool(tool_name, arguments)

        # Parse the text content from the response
        if result.content and len(result.content) > 0:
            text_content = result.content[0].text
            return json.loads(text_content)

        return {}

    # =========================================================================
    # Document Operations
    # =========================================================================

    async def store_document(
        self,
        title: str,
        content: str,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
        document_id: Optional[str] = None
    ) -> dict:
        """
        Store a document in the knowledge base.

        The document is automatically indexed for TF-IDF search.

        Args:
            title: Document title
            content: Document content
            tags: Optional tags for categorization
            metadata: Optional additional metadata
            document_id: Optional custom ID (auto-generated if not provided)

        Returns:
            Dictionary with document ID and storage confirmation

        Example:
            doc = await client.store_document(
                title="API Design Guide",
                content="REST APIs should follow...",
                tags=["api", "rest", "design"]
            )
            print(f"Stored document: {doc['id']}")
        """
        arguments = {
            "title": title,
            "content": content,
        }
        if tags:
            arguments["tags"] = tags
        if metadata:
            arguments["metadata"] = metadata
        if document_id:
            arguments["id"] = document_id

        return await self._call_tool("store_document", arguments)

    async def get_document(self, document_id: str) -> Document:
        """
        Retrieve a document by ID.

        Args:
            document_id: The document ID

        Returns:
            Document object with full content

        Raises:
            Exception: If document not found
        """
        result = await self._call_tool("get_document", {"documentId": document_id})
        return Document.from_dict(result)

    async def delete_document(self, document_id: str) -> dict:
        """
        Delete a document from the knowledge base.

        Removes the document and unindexes it from search.

        Args:
            document_id: The document ID to delete

        Returns:
            Confirmation dictionary

        Raises:
            Exception: If document not found
        """
        return await self._call_tool("delete_document", {"documentId": document_id})

    async def list_documents(
        self,
        tags: Optional[list[str]] = None,
        sort_by: str = "updated",
        limit: int = 50,
        offset: int = 0
    ) -> dict:
        """
        List documents in the knowledge base.

        Args:
            tags: Optional tag filter (OR logic)
            sort_by: Sort field - "created", "updated", or "title"
            limit: Maximum documents to return
            offset: Pagination offset

        Returns:
            Dictionary with documents list and pagination info

        Example:
            result = await client.list_documents(tags=["python"], limit=10)
            for doc in result["documents"]:
                print(f"{doc['title']} - {doc['wordCount']} words")
        """
        arguments = {
            "sortBy": sort_by,
            "limit": limit,
            "offset": offset,
        }
        if tags:
            arguments["tags"] = tags

        return await self._call_tool("list_documents", arguments)

    # =========================================================================
    # Search Operations
    # =========================================================================

    async def search(
        self,
        query: str,
        limit: int = 10,
        tags: Optional[list[str]] = None,
        min_score: float = 0.0
    ) -> list[SearchResult]:
        """
        Search documents using TF-IDF semantic search.

        Args:
            query: Search query string
            limit: Maximum results to return
            tags: Optional tag filter (OR logic)
            min_score: Minimum relevance score threshold

        Returns:
            List of SearchResult objects

        Example:
            results = await client.search(
                query="error handling exceptions",
                tags=["python"],
                limit=5
            )
            for result in results:
                print(f"{result.title} (score: {result.score})")
                for excerpt in result.relevant_excerpts:
                    print(f"  - {excerpt[:100]}...")
        """
        arguments = {
            "query": query,
            "limit": limit,
            "minScore": min_score,
        }
        if tags:
            arguments["tags"] = tags

        result = await self._call_tool("semantic_search", arguments)
        return [SearchResult.from_dict(r) for r in result.get("results", [])]

    async def search_raw(
        self,
        query: str,
        limit: int = 10,
        tags: Optional[list[str]] = None,
        min_score: float = 0.0
    ) -> dict:
        """
        Search documents and return raw response.

        Same as search() but returns the full API response including metadata.

        Returns:
            Raw dictionary response with results, totalResults, query, showing
        """
        arguments = {
            "query": query,
            "limit": limit,
            "minScore": min_score,
        }
        if tags:
            arguments["tags"] = tags

        return await self._call_tool("semantic_search", arguments)

    # =========================================================================
    # Summarization Operations
    # =========================================================================

    async def summarize(
        self,
        document_id: Optional[str] = None,
        content: Optional[str] = None,
        max_sentences: int = 5,
        regenerate: bool = False
    ) -> Summary:
        """
        Generate extractive summary of a document or content.

        Args:
            document_id: ID of document to summarize
            content: Direct content to summarize (if no document_id)
            max_sentences: Maximum sentences in summary
            regenerate: Force regenerate even if cached

        Returns:
            Summary object

        Example:
            # Summarize stored document
            summary = await client.summarize(document_id="doc123")
            print(summary.summary)

            # Summarize direct content
            summary = await client.summarize(
                content="Long text to summarize...",
                max_sentences=3
            )
        """
        arguments = {
            "maxSentences": max_sentences,
            "regenerate": regenerate,
        }
        if document_id:
            arguments["documentId"] = document_id
        if content:
            arguments["content"] = content

        result = await self._call_tool("summarize", arguments)
        return Summary.from_dict(result)

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def store_and_search(
        self,
        title: str,
        content: str,
        query: str,
        tags: Optional[list[str]] = None
    ) -> tuple[dict, list[SearchResult]]:
        """
        Store a document and immediately search for related content.

        Useful for finding existing documents related to new content.

        Args:
            title: Document title to store
            content: Document content to store
            query: Search query to find related documents
            tags: Optional tags

        Returns:
            Tuple of (stored document info, related search results)
        """
        doc = await self.store_document(title, content, tags)
        results = await self.search(query, limit=5, tags=tags)
        return doc, results

    async def batch_store(
        self,
        documents: list[dict]
    ) -> list[dict]:
        """
        Store multiple documents.

        Args:
            documents: List of document dictionaries with title, content, tags

        Returns:
            List of storage confirmations

        Example:
            docs = [
                {"title": "Doc 1", "content": "...", "tags": ["a"]},
                {"title": "Doc 2", "content": "...", "tags": ["b"]},
            ]
            results = await client.batch_store(docs)
        """
        results = []
        for doc in documents:
            result = await self.store_document(
                title=doc["title"],
                content=doc["content"],
                tags=doc.get("tags"),
                metadata=doc.get("metadata"),
                document_id=doc.get("id"),
            )
            results.append(result)
        return results

    async def get_stats(self) -> dict:
        """
        Get knowledge base statistics.

        Returns:
            Dictionary with total documents, tag counts, etc.
        """
        docs = await self.list_documents(limit=1000)

        tag_counts = {}
        total_words = 0
        docs_with_summary = 0

        for doc in docs.get("documents", []):
            total_words += doc.get("wordCount", 0)
            if doc.get("hasSummary"):
                docs_with_summary += 1
            for tag in doc.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        return {
            "total_documents": docs.get("total", 0),
            "total_words": total_words,
            "documents_with_summary": docs_with_summary,
            "unique_tags": len(tag_counts),
            "tag_distribution": dict(
                sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
            ),
        }


# =============================================================================
# Standalone Usage
# =============================================================================

async def main():
    """Example usage of the DomainMemoryClient."""
    async with DomainMemoryClient() as client:
        # Store a document
        doc = await client.store_document(
            title="Python Programming Basics",
            content="""Python is a high-level programming language known for
            its readability and versatility. It supports multiple programming
            paradigms including procedural, object-oriented, and functional
            programming. Python's extensive standard library and active
            community make it ideal for web development, data science,
            automation, and scripting.""",
            tags=["python", "programming", "tutorial"],
        )
        print(f"Stored document: {doc['id']}")

        # Search for documents
        results = await client.search("programming language features")
        print(f"\nSearch results ({len(results)} found):")
        for result in results:
            print(f"  - {result.title} (score: {result.score:.3f})")

        # Generate summary
        summary = await client.summarize(document_id=doc["id"], max_sentences=2)
        print(f"\nSummary: {summary.summary}")

        # Get stats
        stats = await client.get_stats()
        print(f"\nKnowledge base stats: {stats['total_documents']} documents")


if __name__ == "__main__":
    asyncio.run(main())
