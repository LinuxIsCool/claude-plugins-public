#!/usr/bin/env python3
"""
mem0 Client Wrapper

A production-ready wrapper for mem0 operations with support for:
- User, session, and agent memory levels
- Context injection for LLM prompts
- Token optimization
- Graph memory (optional)
- Error handling and logging
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MemoryConfig:
    """Configuration for mem0 client."""

    # LLM Configuration
    llm_provider: str = "openai"
    llm_model: str = "gpt-4.1-nano-2025-04-14"
    llm_temperature: float = 0.0

    # Embedding Configuration
    embedder_provider: str = "openai"
    embedder_model: str = "text-embedding-3-small"
    embedder_dims: int = 1536

    # Vector Store Configuration
    vector_store_provider: str = "qdrant"
    vector_store_host: str = "localhost"
    vector_store_port: int = 6333
    vector_store_collection: str = "memories"

    # Graph Store Configuration (optional)
    graph_enabled: bool = False
    graph_provider: str = "neo4j"
    graph_url: str = "bolt://localhost:7687"
    graph_username: str = "neo4j"
    graph_password: str = ""
    graph_database: str = "neo4j"

    # Custom prompts (optional)
    custom_fact_extraction_prompt: Optional[str] = None
    custom_update_memory_prompt: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to mem0 configuration dict."""
        config = {
            "llm": {
                "provider": self.llm_provider,
                "config": {
                    "model": self.llm_model,
                    "temperature": self.llm_temperature,
                },
            },
            "embedder": {
                "provider": self.embedder_provider,
                "config": {
                    "model": self.embedder_model,
                    "embedding_dims": self.embedder_dims,
                },
            },
            "vector_store": {
                "provider": self.vector_store_provider,
                "config": {
                    "host": self.vector_store_host,
                    "port": self.vector_store_port,
                    "collection_name": self.vector_store_collection,
                },
            },
        }

        if self.graph_enabled:
            config["graph_store"] = {
                "provider": self.graph_provider,
                "config": {
                    "url": self.graph_url,
                    "username": self.graph_username,
                    "password": self.graph_password,
                    "database": self.graph_database,
                },
            }

        if self.custom_fact_extraction_prompt:
            config["custom_fact_extraction_prompt"] = self.custom_fact_extraction_prompt

        if self.custom_update_memory_prompt:
            config["custom_update_memory_prompt"] = self.custom_update_memory_prompt

        return config


@dataclass
class MemoryResult:
    """Result from a memory operation."""

    success: bool
    results: List[Dict[str, Any]] = field(default_factory=list)
    relations: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    @classmethod
    def from_response(cls, response: Dict[str, Any]) -> "MemoryResult":
        """Create MemoryResult from mem0 response."""
        return cls(
            success=True,
            results=response.get("results", []),
            relations=response.get("relations"),
        )

    @classmethod
    def from_error(cls, error: str) -> "MemoryResult":
        """Create error MemoryResult."""
        return cls(success=False, error=error)


@dataclass
class SearchResult:
    """Result from a memory search."""

    memories: List[Dict[str, Any]]
    total_count: int
    query: str

    @classmethod
    def from_response(cls, response: Dict[str, Any], query: str) -> "SearchResult":
        """Create SearchResult from mem0 response."""
        results = response.get("results", [])
        return cls(memories=results, total_count=len(results), query=query)

    def to_context_string(self, max_items: int = 5) -> str:
        """Convert search results to context string for LLM prompts."""
        if not self.memories:
            return ""

        items = self.memories[:max_items]
        return "\n".join(f"- {m.get('memory', m.get('text', ''))}" for m in items)

    def filter_by_score(self, min_score: float = 0.7) -> "SearchResult":
        """Filter results by minimum score."""
        filtered = [m for m in self.memories if m.get("score", 0) >= min_score]
        return SearchResult(
            memories=filtered, total_count=len(filtered), query=self.query
        )


class Mem0Client:
    """
    Production-ready mem0 client wrapper.

    Provides a simplified interface for mem0 operations with:
    - Three-tier memory (user, session, agent)
    - Context injection for LLM prompts
    - Token budget management
    - Error handling

    Example:
        >>> client = Mem0Client()
        >>> client.add("User prefers Python", user_id="shawn")
        >>> results = client.search("programming preferences", user_id="shawn")
        >>> context = results.to_context_string()
    """

    def __init__(self, config: Optional[MemoryConfig] = None):
        """
        Initialize mem0 client.

        Args:
            config: Optional MemoryConfig. If None, uses defaults.
        """
        self.config = config or MemoryConfig()
        self._memory = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazily initialize mem0 Memory instance."""
        if self._initialized:
            return

        try:
            from mem0 import Memory

            config_dict = self.config.to_dict()
            self._memory = Memory.from_config(config_dict)
            self._initialized = True
            logger.info("mem0 client initialized successfully")
        except ImportError:
            raise ImportError(
                "mem0 is not installed. Install with: pip install mem0ai"
            )
        except Exception as e:
            logger.error(f"Failed to initialize mem0: {e}")
            raise

    @property
    def memory(self):
        """Get the underlying mem0 Memory instance."""
        self._ensure_initialized()
        return self._memory

    def add(
        self,
        content: Union[str, List[Dict[str, str]]],
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
        run_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        infer: bool = True,
    ) -> MemoryResult:
        """
        Add a memory.

        Args:
            content: String or list of message dicts to add
            user_id: User identifier
            agent_id: Agent identifier
            session_id: Session identifier (requires user_id)
            run_id: Run identifier (requires agent_id)
            metadata: Additional metadata
            infer: Whether to use LLM for fact extraction

        Returns:
            MemoryResult with operation results

        Raises:
            ValueError: If no identifier provided
        """
        if not any([user_id, agent_id]):
            raise ValueError("At least user_id or agent_id must be provided")

        try:
            kwargs = {"infer": infer}

            if user_id:
                kwargs["user_id"] = user_id
            if agent_id:
                kwargs["agent_id"] = agent_id
            if session_id and user_id:
                kwargs["session_id"] = session_id
            if run_id and agent_id:
                kwargs["run_id"] = run_id
            if metadata:
                kwargs["metadata"] = metadata

            response = self.memory.add(content, **kwargs)
            return MemoryResult.from_response(response)

        except Exception as e:
            logger.error(f"Error adding memory: {e}")
            return MemoryResult.from_error(str(e))

    def search(
        self,
        query: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 5,
        min_score: Optional[float] = None,
    ) -> SearchResult:
        """
        Search memories.

        Args:
            query: Search query
            user_id: Filter by user
            agent_id: Filter by agent
            session_id: Filter by session
            run_id: Filter by run
            limit: Maximum results to return
            min_score: Minimum relevance score filter

        Returns:
            SearchResult with matching memories
        """
        if not any([user_id, agent_id]):
            raise ValueError("At least user_id or agent_id must be provided")

        try:
            kwargs = {"limit": limit}

            if user_id:
                kwargs["user_id"] = user_id
            if agent_id:
                kwargs["agent_id"] = agent_id
            if session_id and user_id:
                kwargs["session_id"] = session_id
            if run_id and agent_id:
                kwargs["run_id"] = run_id

            response = self.memory.search(query=query, **kwargs)
            result = SearchResult.from_response(response, query)

            if min_score is not None:
                result = result.filter_by_score(min_score)

            return result

        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return SearchResult(memories=[], total_count=0, query=query)

    def get_all(
        self,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
        run_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all memories for given identifiers.

        Args:
            user_id: Filter by user
            agent_id: Filter by agent
            session_id: Filter by session
            run_id: Filter by run

        Returns:
            List of memory dicts
        """
        if not any([user_id, agent_id]):
            raise ValueError("At least user_id or agent_id must be provided")

        try:
            kwargs = {}
            if user_id:
                kwargs["user_id"] = user_id
            if agent_id:
                kwargs["agent_id"] = agent_id
            if session_id and user_id:
                kwargs["session_id"] = session_id
            if run_id and agent_id:
                kwargs["run_id"] = run_id

            response = self.memory.get_all(**kwargs)
            return response.get("results", [])

        except Exception as e:
            logger.error(f"Error getting memories: {e}")
            return []

    def get(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific memory by ID.

        Args:
            memory_id: Memory identifier

        Returns:
            Memory dict or None if not found
        """
        try:
            return self.memory.get(memory_id=memory_id)
        except Exception as e:
            logger.error(f"Error getting memory {memory_id}: {e}")
            return None

    def update(self, memory_id: str, data: str) -> bool:
        """
        Update a memory's text content.

        Args:
            memory_id: Memory identifier
            data: New text content

        Returns:
            True if successful
        """
        try:
            self.memory.update(memory_id=memory_id, data=data)
            return True
        except Exception as e:
            logger.error(f"Error updating memory {memory_id}: {e}")
            return False

    def delete(self, memory_id: str) -> bool:
        """
        Delete a specific memory.

        Args:
            memory_id: Memory identifier

        Returns:
            True if successful
        """
        try:
            self.memory.delete(memory_id=memory_id)
            return True
        except Exception as e:
            logger.error(f"Error deleting memory {memory_id}: {e}")
            return False

    def delete_all(
        self,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
        run_id: Optional[str] = None,
    ) -> bool:
        """
        Delete all memories matching the filters.

        Args:
            user_id: Filter by user
            agent_id: Filter by agent
            session_id: Filter by session
            run_id: Filter by run

        Returns:
            True if successful
        """
        if not any([user_id, agent_id]):
            raise ValueError("At least user_id or agent_id must be provided")

        try:
            kwargs = {}
            if user_id:
                kwargs["user_id"] = user_id
            if agent_id:
                kwargs["agent_id"] = agent_id
            if session_id and user_id:
                kwargs["session_id"] = session_id
            if run_id and agent_id:
                kwargs["run_id"] = run_id

            self.memory.delete_all(**kwargs)
            return True
        except Exception as e:
            logger.error(f"Error deleting memories: {e}")
            return False

    def history(self, memory_id: str) -> List[Dict[str, Any]]:
        """
        Get the change history of a memory.

        Args:
            memory_id: Memory identifier

        Returns:
            List of historical versions
        """
        try:
            return self.memory.history(memory_id=memory_id)
        except Exception as e:
            logger.error(f"Error getting history for {memory_id}: {e}")
            return []


class ContextBuilder:
    """
    Build optimized context strings from memories for LLM prompts.

    Example:
        >>> builder = ContextBuilder(client)
        >>> context = builder.build_context(
        ...     query="programming help",
        ...     user_id="shawn",
        ...     token_budget=500
        ... )
    """

    def __init__(self, client: Mem0Client, chars_per_token: int = 4):
        """
        Initialize context builder.

        Args:
            client: Mem0Client instance
            chars_per_token: Estimated characters per token
        """
        self.client = client
        self.chars_per_token = chars_per_token

    def build_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
        token_budget: int = 500,
        min_score: float = 0.6,
    ) -> str:
        """
        Build optimized context string within token budget.

        Args:
            query: Search query for relevant memories
            user_id: User identifier
            agent_id: Agent identifier
            session_id: Session identifier
            token_budget: Maximum tokens for context
            min_score: Minimum relevance score

        Returns:
            Formatted context string
        """
        char_budget = token_budget * self.chars_per_token
        context_parts = []
        used_chars = 0

        # Get user-level context
        if user_id:
            user_results = self.client.search(
                query=query, user_id=user_id, limit=5, min_score=min_score
            )

            if user_results.memories:
                for m in user_results.memories:
                    memory_text = f"- {m.get('memory', '')}"
                    if used_chars + len(memory_text) <= char_budget:
                        context_parts.append(memory_text)
                        used_chars += len(memory_text)

        # Get session-level context
        if session_id and user_id and used_chars < char_budget:
            session_results = self.client.search(
                query=query,
                user_id=user_id,
                session_id=session_id,
                limit=3,
                min_score=min_score,
            )

            if session_results.memories:
                for m in session_results.memories:
                    memory_text = f"- [session] {m.get('memory', '')}"
                    if used_chars + len(memory_text) <= char_budget:
                        context_parts.append(memory_text)
                        used_chars += len(memory_text)

        # Get agent-level context
        if agent_id and used_chars < char_budget:
            agent_results = self.client.search(
                query=query, agent_id=agent_id, limit=3, min_score=min_score
            )

            if agent_results.memories:
                for m in agent_results.memories:
                    memory_text = f"- [agent] {m.get('memory', '')}"
                    if used_chars + len(memory_text) <= char_budget:
                        context_parts.append(memory_text)
                        used_chars += len(memory_text)

        return "\n".join(context_parts)

    def build_system_prompt(
        self, base_prompt: str, context: str, context_header: str = "Relevant context:"
    ) -> str:
        """
        Build system prompt with memory context.

        Args:
            base_prompt: Base system prompt
            context: Memory context string
            context_header: Header for context section

        Returns:
            Complete system prompt
        """
        if not context:
            return base_prompt

        return f"""{base_prompt}

{context_header}
{context}"""


class SessionManager:
    """
    Manage session-scoped memories.

    Example:
        >>> manager = SessionManager(client, user_id="shawn")
        >>> session_id = manager.start_session()
        >>> manager.add_context("User wants to discuss API design")
        >>> context = manager.get_context("current task")
        >>> manager.end_session()
    """

    def __init__(self, client: Mem0Client, user_id: str):
        """
        Initialize session manager.

        Args:
            client: Mem0Client instance
            user_id: User identifier
        """
        self.client = client
        self.user_id = user_id
        self.session_id: Optional[str] = None

    def start_session(self, session_id: Optional[str] = None) -> str:
        """
        Start a new session.

        Args:
            session_id: Optional custom session ID

        Returns:
            Session ID
        """
        self.session_id = session_id or f"session_{uuid.uuid4().hex[:8]}"
        logger.info(f"Started session: {self.session_id}")
        return self.session_id

    def add_context(
        self, content: str, metadata: Optional[Dict[str, Any]] = None
    ) -> MemoryResult:
        """
        Add session context.

        Args:
            content: Content to add
            metadata: Optional metadata

        Returns:
            MemoryResult
        """
        if not self.session_id:
            raise ValueError("No active session. Call start_session() first.")

        return self.client.add(
            content=content,
            user_id=self.user_id,
            session_id=self.session_id,
            metadata=metadata,
        )

    def get_context(self, query: str, limit: int = 5) -> SearchResult:
        """
        Search session context.

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            SearchResult
        """
        if not self.session_id:
            return SearchResult(memories=[], total_count=0, query=query)

        return self.client.search(
            query=query, user_id=self.user_id, session_id=self.session_id, limit=limit
        )

    def end_session(self, promote_to_user: Optional[List[str]] = None):
        """
        End the session.

        Args:
            promote_to_user: Optional list of memories to promote to user level
        """
        if promote_to_user:
            for memory_text in promote_to_user:
                self.client.add(content=memory_text, user_id=self.user_id)
                logger.info(f"Promoted to user level: {memory_text[:50]}...")

        logger.info(f"Ended session: {self.session_id}")
        self.session_id = None


def create_client(
    llm_provider: str = "openai",
    llm_model: str = "gpt-4.1-nano-2025-04-14",
    vector_store: str = "qdrant",
    enable_graph: bool = False,
    **kwargs,
) -> Mem0Client:
    """
    Factory function to create a configured Mem0Client.

    Args:
        llm_provider: LLM provider name
        llm_model: LLM model name
        vector_store: Vector store provider
        enable_graph: Enable graph memory
        **kwargs: Additional config options

    Returns:
        Configured Mem0Client
    """
    config = MemoryConfig(
        llm_provider=llm_provider,
        llm_model=llm_model,
        vector_store_provider=vector_store,
        graph_enabled=enable_graph,
        **kwargs,
    )
    return Mem0Client(config)


# Example usage and testing
if __name__ == "__main__":
    # Create client
    client = create_client()

    # Add memories
    print("Adding memories...")
    result = client.add(
        "I prefer Python for backend development and TypeScript for frontend.",
        user_id="demo_user",
    )
    print(f"Add result: {result}")

    # Search memories
    print("\nSearching memories...")
    search_result = client.search("programming preferences", user_id="demo_user")
    print(f"Found {search_result.total_count} memories")
    print(f"Context: {search_result.to_context_string()}")

    # Build context
    print("\nBuilding context...")
    builder = ContextBuilder(client)
    context = builder.build_context(
        query="What technologies should I use?",
        user_id="demo_user",
        token_budget=300,
    )
    print(f"Context:\n{context}")

    # Session management
    print("\nSession management...")
    session = SessionManager(client, user_id="demo_user")
    session_id = session.start_session()
    print(f"Session started: {session_id}")

    session.add_context("User wants to build a web application")
    session_context = session.get_context("current task")
    print(f"Session context: {session_context.to_context_string()}")

    session.end_session()
    print("Session ended")
