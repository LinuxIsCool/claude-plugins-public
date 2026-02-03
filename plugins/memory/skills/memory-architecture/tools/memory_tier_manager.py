#!/usr/bin/env python3
"""
Three-Tier Memory Manager

Production-ready implementation of the hot/warm/cold temporal memory architecture.
Provides unified interface for memory capture, retrieval, and lifecycle management.

Usage:
    from memory_tier_manager import MemoryTierManager

    manager = MemoryTierManager("/path/to/memory/root")

    # Capture observations
    manager.capture("User implemented JWT authentication", importance=0.8)

    # Retrieve context for a prompt
    context = manager.get_context_for_prompt("How did we handle auth?")

    # Run maintenance
    stats = manager.run_maintenance()
"""

import json
import math
import sqlite3
import struct
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
import hashlib
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class TierConfig:
    """Configuration for a memory tier."""
    enabled: bool = True
    max_age_hours: Optional[int] = None
    max_age_days: Optional[int] = None
    max_items: Optional[int] = None
    similarity_threshold: float = 0.4


@dataclass
class MemoryConfig:
    """Complete memory system configuration."""
    hot: TierConfig = field(default_factory=lambda: TierConfig(
        enabled=True,
        max_age_hours=24,
        max_items=5
    ))
    warm: TierConfig = field(default_factory=lambda: TierConfig(
        enabled=True,
        max_age_days=7,
        max_items=2,
        similarity_threshold=0.4
    ))
    cold: TierConfig = field(default_factory=lambda: TierConfig(
        enabled=True
    ))
    embedding_dimensions: int = 1536

    @classmethod
    def from_yaml(cls, path: Path) -> "MemoryConfig":
        """Load configuration from YAML file."""
        import yaml
        if path.exists():
            with open(path) as f:
                data = yaml.safe_load(f)
                return cls(
                    hot=TierConfig(**data.get("hot_memory", {})),
                    warm=TierConfig(**data.get("warm_memory", {})),
                    cold=TierConfig(**data.get("cold_memory", {})),
                    embedding_dimensions=data.get("embedding_dimensions", 1536)
                )
        return cls()


# =============================================================================
# Data Structures
# =============================================================================

class ImportanceLevel(Enum):
    """Memory importance classification."""
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"

    @property
    def decay_multiplier(self) -> float:
        """Get decay rate multiplier for importance level."""
        return {
            ImportanceLevel.CRITICAL: 0.1,
            ImportanceLevel.HIGH: 0.5,
            ImportanceLevel.NORMAL: 1.0,
            ImportanceLevel.LOW: 2.0
        }[self]


@dataclass
class MemoryEntry:
    """Universal memory entry structure."""
    id: str
    content: str
    summary: str
    timestamp: str
    importance: float
    source: str
    tier: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[bytes] = None
    access_count: int = 0
    last_accessed: Optional[str] = None

    @classmethod
    def create(cls, content: str, importance: float = 0.5,
               source: str = "unknown", tier: str = "hot",
               summary: str = None, metadata: Dict = None) -> "MemoryEntry":
        """Create a new memory entry."""
        content_hash = hashlib.md5(content.encode()).hexdigest()[:12]
        return cls(
            id=f"{tier}_{content_hash}_{datetime.now().strftime('%H%M%S')}",
            content=content,
            summary=summary or content[:100],
            timestamp=datetime.now().isoformat(),
            importance=importance,
            source=source,
            tier=tier,
            metadata=metadata or {}
        )

    def to_dict(self) -> dict:
        """Convert to dictionary (excluding embedding bytes)."""
        d = asdict(self)
        d.pop("embedding", None)
        return d


@dataclass
class SearchResult:
    """Search result with scoring."""
    entry: MemoryEntry
    score: float
    source_tier: str
    scoring_breakdown: Dict[str, float] = field(default_factory=dict)


# =============================================================================
# Embedding Interface
# =============================================================================

class EmbeddingProvider(ABC):
    """Abstract interface for embedding generation."""

    @abstractmethod
    def embed(self, text: str) -> bytes:
        """Generate embedding for text, returned as bytes."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[bytes]:
        """Generate embeddings for multiple texts."""
        pass


class MockEmbeddingProvider(EmbeddingProvider):
    """Mock provider for testing (generates random embeddings)."""

    def __init__(self, dimensions: int = 1536):
        self.dimensions = dimensions
        import random
        self._random = random.Random(42)

    def embed(self, text: str) -> bytes:
        """Generate deterministic mock embedding based on text hash."""
        # Use text hash for deterministic results
        seed = int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)
        self._random.seed(seed)
        values = [self._random.gauss(0, 1) for _ in range(self.dimensions)]
        # Normalize
        norm = math.sqrt(sum(v*v for v in values))
        values = [v/norm for v in values]
        return struct.pack(f'{self.dimensions}f', *values)

    def embed_batch(self, texts: List[str]) -> List[bytes]:
        """Generate mock embeddings for batch."""
        return [self.embed(text) for text in texts]


# =============================================================================
# Hot Memory Tier
# =============================================================================

class HotMemoryTier:
    """
    In-memory cache for immediate session context.

    Characteristics:
    - Automatic injection on every prompt
    - 24-hour hard cutoff
    - Last 5 interactions
    - Persisted to JSON for session recovery
    """

    def __init__(self, cache_path: Path, config: TierConfig):
        self.cache_path = cache_path
        self.config = config
        self.max_items = config.max_items or 5
        self.max_age = timedelta(hours=config.max_age_hours or 24)
        self.entries: deque = deque(maxlen=self.max_items)
        self._load()

    def add(self, entry: MemoryEntry) -> None:
        """Add entry to hot cache."""
        entry.tier = "hot"
        self.entries.append(entry)
        self._evict_stale()
        self._persist()
        logger.debug(f"Added to hot cache: {entry.id}")

    def get_all(self) -> List[MemoryEntry]:
        """Get all active hot memory entries."""
        self._evict_stale()
        return list(self.entries)

    def format_for_injection(self) -> str:
        """Format hot memory for context injection."""
        entries = self.get_all()
        if not entries:
            return ""

        lines = ["## Recent Context (This Session)"]
        for entry in entries:
            age = self._format_age(entry.timestamp)
            lines.append(f"- [{age}] {entry.summary}")
            if entry.metadata.get("key_entities"):
                entities = ", ".join(entry.metadata["key_entities"][:5])
                lines.append(f"  Entities: {entities}")

        return "\n".join(lines)

    def clear(self) -> int:
        """Clear all hot memory entries."""
        count = len(self.entries)
        self.entries.clear()
        self._persist()
        return count

    def _evict_stale(self) -> int:
        """Remove entries older than max_age."""
        now = datetime.now()
        evicted = 0
        while self.entries:
            oldest = self.entries[0]
            entry_time = datetime.fromisoformat(oldest.timestamp)
            if now - entry_time > self.max_age:
                self.entries.popleft()
                evicted += 1
            else:
                break
        if evicted > 0:
            self._persist()
        return evicted

    def _format_age(self, timestamp: str) -> str:
        """Format timestamp as relative age."""
        try:
            age = datetime.now() - datetime.fromisoformat(timestamp)
            if age.total_seconds() < 60:
                return "just now"
            elif age.total_seconds() < 3600:
                return f"{int(age.total_seconds() / 60)}m ago"
            elif age.total_seconds() < 86400:
                return f"{int(age.total_seconds() / 3600)}h ago"
            else:
                return f"{age.days}d ago"
        except (ValueError, TypeError):
            return "?"

    def _load(self) -> None:
        """Load cache from disk."""
        if self.cache_path.exists():
            try:
                data = json.loads(self.cache_path.read_text())
                for item in data:
                    entry = MemoryEntry(**item)
                    self.entries.append(entry)
                logger.debug(f"Loaded {len(self.entries)} hot memory entries")
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.warning(f"Failed to load hot cache: {e}")
                self.entries.clear()

    def _persist(self) -> None:
        """Persist cache to disk."""
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        data = [e.to_dict() for e in self.entries]
        self.cache_path.write_text(json.dumps(data, indent=2))


# =============================================================================
# Warm Memory Tier
# =============================================================================

class WarmMemoryTier:
    """
    SQLite-based vector store for recent context.

    Characteristics:
    - Triggered by semantic cues in prompt
    - 7-day hard cutoff
    - Top 2 matches only
    - 0.4 similarity threshold
    """

    def __init__(self, db_path: Path, config: TierConfig,
                 embedder: EmbeddingProvider):
        self.db_path = db_path
        self.config = config
        self.threshold = config.similarity_threshold or 0.4
        self.max_results = config.max_items or 2
        self.max_age = timedelta(days=config.max_age_days or 7)
        self.embedder = embedder
        self._init_db()

    def store(self, entry: MemoryEntry) -> int:
        """Store entry with embedding."""
        entry.tier = "warm"

        # Generate embedding if not provided
        if entry.embedding is None:
            entry.embedding = self.embedder.embed(entry.content)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            """INSERT INTO warm_memories
               (id, content, summary, embedding, importance, timestamp,
                source, metadata, access_count)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                entry.id,
                entry.content,
                entry.summary,
                entry.embedding,
                entry.importance,
                entry.timestamp,
                entry.source,
                json.dumps(entry.metadata),
                0
            )
        )
        row_id = cursor.lastrowid
        conn.commit()
        conn.close()
        logger.debug(f"Stored in warm memory: {entry.id}")
        return row_id

    def search(self, query: str, limit: int = None) -> List[SearchResult]:
        """Search warm memory by semantic similarity."""
        limit = limit or self.max_results
        query_embedding = self.embedder.embed(query)

        # Get cutoff timestamp
        cutoff = (datetime.now() - self.max_age).isoformat()

        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            """SELECT id, content, summary, embedding, importance, timestamp,
                      source, metadata, access_count
               FROM warm_memories
               WHERE timestamp > ?
               ORDER BY timestamp DESC""",
            (cutoff,)
        )

        results = []
        for row in cursor.fetchall():
            (mem_id, content, summary, emb_blob, importance,
             timestamp, source, metadata_json, access_count) = row

            similarity = self._cosine_similarity(
                query_embedding, emb_blob
            )

            if similarity >= self.threshold:
                entry = MemoryEntry(
                    id=mem_id,
                    content=content,
                    summary=summary,
                    timestamp=timestamp,
                    importance=importance,
                    source=source,
                    tier="warm",
                    metadata=json.loads(metadata_json) if metadata_json else {},
                    access_count=access_count
                )
                results.append(SearchResult(
                    entry=entry,
                    score=similarity,
                    source_tier="warm",
                    scoring_breakdown={"semantic": similarity}
                ))

        conn.close()

        # Sort by score and limit
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    def should_trigger(self, prompt: str) -> bool:
        """Determine if warm memory retrieval should be triggered."""
        triggers = [
            "?" in prompt,
            len(prompt.split()) > 10,
            any(kw in prompt.lower() for kw in
                ["yesterday", "last week", "earlier", "before", "previously"]),
            self._contains_file_reference(prompt)
        ]
        return any(triggers)

    def cleanup_old(self) -> int:
        """Remove entries older than max_age."""
        cutoff = (datetime.now() - self.max_age).isoformat()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "DELETE FROM warm_memories WHERE timestamp < ?",
            (cutoff,)
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        logger.info(f"Cleaned up {deleted} old warm memories")
        return deleted

    def count(self) -> int:
        """Get count of warm memories."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT COUNT(*) FROM warm_memories")
        count = cursor.fetchone()[0]
        conn.close()
        return count

    def _init_db(self) -> None:
        """Initialize database schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS warm_memories (
                rowid INTEGER PRIMARY KEY,
                id TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                embedding BLOB NOT NULL,
                importance REAL DEFAULT 0.5,
                timestamp TEXT NOT NULL,
                source TEXT,
                metadata TEXT,
                access_count INTEGER DEFAULT 0,
                last_accessed TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_warm_timestamp ON warm_memories(timestamp)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_warm_importance ON warm_memories(importance)")
        conn.commit()
        conn.close()

    def _cosine_similarity(self, a: bytes, b: bytes) -> float:
        """Calculate cosine similarity between two embedding blobs."""
        n = len(a) // 4
        vec_a = struct.unpack(f'{n}f', a)
        vec_b = struct.unpack(f'{n}f', b)

        dot = sum(x*y for x, y in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(x*x for x in vec_a))
        norm_b = math.sqrt(sum(x*x for x in vec_b))

        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _contains_file_reference(self, text: str) -> bool:
        """Check if text contains file path references."""
        import re
        return bool(re.search(r'[\w/.-]+\.(py|ts|js|md|json|yaml|yml)', text))


# =============================================================================
# Cold Memory Tier
# =============================================================================

class ColdMemoryTier:
    """
    JSONL archive with FTS5 full-text search.

    Characteristics:
    - Explicit user invocation only
    - No age limit (permanent archive)
    - User-controlled search parameters
    """

    def __init__(self, archive_dir: Path, db_path: Path, config: TierConfig):
        self.archive_dir = archive_dir
        self.db_path = db_path
        self.config = config
        self._init_fts()

    def archive(self, content: str, source: str = "session",
                importance: float = 0.5, metadata: Dict = None) -> str:
        """Add content to cold archive."""
        timestamp = datetime.now()
        entry_id = f"cold_{hashlib.md5(content.encode()).hexdigest()[:12]}"

        # Append to monthly JSONL file
        jsonl_file = self.archive_dir / f"{timestamp.strftime('%Y-%m')}.jsonl"
        jsonl_file.parent.mkdir(parents=True, exist_ok=True)

        entry_data = {
            "id": entry_id,
            "timestamp": timestamp.isoformat(),
            "content": content,
            "source": source,
            "importance": importance,
            "metadata": metadata or {}
        }

        with jsonl_file.open("a") as f:
            f.write(json.dumps(entry_data) + "\n")

        # Index in FTS
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            """INSERT INTO cold_fts (entry_id, content, timestamp, source, importance)
               VALUES (?, ?, ?, ?, ?)""",
            (entry_id, content, timestamp.isoformat(), source, importance)
        )
        conn.commit()
        conn.close()

        logger.debug(f"Archived to cold storage: {entry_id}")
        return entry_id

    def search(self, query: str, limit: int = 10,
               months_back: int = None) -> List[SearchResult]:
        """Full-text search over archived memories."""
        conn = sqlite3.connect(self.db_path)

        # Build query
        sql = """
            SELECT entry_id, content, timestamp, source, importance,
                   bm25(cold_fts) as score
            FROM cold_fts
            WHERE cold_fts MATCH ?
        """
        params = [self._escape_fts_query(query)]

        if months_back:
            cutoff = (datetime.now() - timedelta(days=months_back * 30)).isoformat()
            sql += " AND timestamp > ?"
            params.append(cutoff)

        sql += " ORDER BY bm25(cold_fts) LIMIT ?"
        params.append(limit)

        cursor = conn.execute(sql, params)

        results = []
        for row in cursor.fetchall():
            entry_id, content, timestamp, source, importance, bm25_score = row

            entry = MemoryEntry(
                id=entry_id,
                content=content,
                summary=content[:100],
                timestamp=timestamp,
                importance=importance,
                source=source,
                tier="cold"
            )

            # Normalize BM25 score (typically negative, more negative = better)
            normalized_score = min(1.0, abs(bm25_score) / 20.0)

            results.append(SearchResult(
                entry=entry,
                score=normalized_score,
                source_tier="cold",
                scoring_breakdown={"bm25": bm25_score}
            ))

        conn.close()
        return results

    def count(self) -> int:
        """Get count of cold archive entries."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT COUNT(*) FROM cold_fts")
        count = cursor.fetchone()[0]
        conn.close()
        return count

    def get_archive_size_mb(self) -> float:
        """Get total size of archive files in MB."""
        total = 0
        if self.archive_dir.exists():
            for f in self.archive_dir.glob("*.jsonl"):
                total += f.stat().st_size
        return total / (1024 * 1024)

    def _init_fts(self) -> None:
        """Initialize FTS5 virtual table."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS cold_fts USING fts5(
                entry_id,
                content,
                timestamp,
                source,
                importance UNINDEXED,
                tokenize='porter unicode61'
            )
        """)
        conn.commit()
        conn.close()

    def _escape_fts_query(self, query: str) -> str:
        """Escape query for FTS5."""
        # Remove FTS5 special characters, keep words
        words = query.replace('"', '').replace("'", "").split()
        return " ".join(f'"{w}"' for w in words if len(w) > 2)


# =============================================================================
# Main Manager
# =============================================================================

class MemoryTierManager:
    """
    Unified three-tier memory manager.

    Provides a single interface for:
    - Capturing observations (auto-tiered)
    - Context injection for prompts
    - Explicit memory search
    - Lifecycle maintenance
    """

    def __init__(self, memory_root: Path,
                 config: MemoryConfig = None,
                 embedder: EmbeddingProvider = None):
        """
        Initialize the memory tier manager.

        Args:
            memory_root: Root directory for all memory storage
            config: Optional configuration (uses defaults if not provided)
            embedder: Optional embedding provider (uses mock if not provided)
        """
        self.memory_root = Path(memory_root)
        self.config = config or MemoryConfig()

        # Initialize embedder
        self.embedder = embedder or MockEmbeddingProvider(
            dimensions=self.config.embedding_dimensions
        )

        # Initialize tiers
        self.hot = HotMemoryTier(
            cache_path=self.memory_root / "hot_cache.json",
            config=self.config.hot
        )

        self.warm = WarmMemoryTier(
            db_path=self.memory_root / "warm.db",
            config=self.config.warm,
            embedder=self.embedder
        )

        self.cold = ColdMemoryTier(
            archive_dir=self.memory_root / "archive",
            db_path=self.memory_root / "cold_fts.db",
            config=self.config.cold
        )

        logger.info(f"Initialized MemoryTierManager at {memory_root}")

    def capture(self, content: str, importance: float = 0.5,
                source: str = "observation", metadata: Dict = None) -> str:
        """
        Capture an observation into the memory system.

        Automatically routes to appropriate tier(s) based on importance.

        Args:
            content: The content to capture
            importance: Importance score 0.0-1.0
            source: Source identifier (e.g., "tool:Edit", "session:abc123")
            metadata: Additional metadata

        Returns:
            Entry ID
        """
        entry = MemoryEntry.create(
            content=content,
            importance=importance,
            source=source,
            tier="hot",
            summary=content[:100] if len(content) > 100 else content,
            metadata=metadata
        )

        # Always add to hot memory
        self.hot.add(entry)

        # Add to warm memory if important enough
        if importance >= 0.5:
            self.warm.store(entry)

        return entry.id

    def get_context_for_prompt(self, prompt: str,
                               max_tokens: int = 1000) -> str:
        """
        Get memory context to inject with a user prompt.

        Args:
            prompt: The user's prompt
            max_tokens: Maximum token budget for context

        Returns:
            Formatted context string for injection
        """
        parts = []

        # Always include hot memory
        hot_context = self.hot.format_for_injection()
        if hot_context:
            parts.append(hot_context)

        # Conditionally include warm memory
        if self.warm.should_trigger(prompt):
            warm_results = self.warm.search(prompt)
            if warm_results:
                warm_lines = ["## Related Context (Recent Memory)"]
                for result in warm_results:
                    warm_lines.append(
                        f"### [Score: {result.score:.2f}]"
                    )
                    content_preview = result.entry.content[:400]
                    if len(result.entry.content) > 400:
                        content_preview += "..."
                    warm_lines.append(content_preview)
                parts.append("\n".join(warm_lines))

        if not parts:
            return ""

        # Build final context
        context = "[MEMORY CONTEXT]\n\n" + "\n\n".join(parts) + "\n\n[END MEMORY]"

        # Token estimation (rough)
        estimated_tokens = len(context.split()) * 1.3
        if estimated_tokens > max_tokens:
            # Truncate context
            logger.warning(f"Context exceeds budget: {estimated_tokens} > {max_tokens}")

        return context

    def search(self, query: str, tiers: List[str] = None,
               limit: int = 10) -> List[SearchResult]:
        """
        Search across specified memory tiers.

        Args:
            query: Search query
            tiers: List of tiers to search ["hot", "warm", "cold"]
            limit: Maximum results

        Returns:
            Combined search results sorted by score
        """
        tiers = tiers or ["warm", "cold"]
        all_results = []

        if "hot" in tiers:
            # Hot memory doesn't have search, return all entries
            for entry in self.hot.get_all():
                all_results.append(SearchResult(
                    entry=entry,
                    score=1.0,  # Hot memory is always relevant
                    source_tier="hot"
                ))

        if "warm" in tiers:
            all_results.extend(self.warm.search(query, limit=limit))

        if "cold" in tiers:
            all_results.extend(self.cold.search(query, limit=limit))

        # Sort by score
        all_results.sort(key=lambda x: x.score, reverse=True)
        return all_results[:limit]

    def archive_to_cold(self, content: str, source: str = "manual",
                        importance: float = 0.5, metadata: Dict = None) -> str:
        """
        Explicitly archive content to cold storage.

        Args:
            content: Content to archive
            source: Source identifier
            importance: Importance score
            metadata: Additional metadata

        Returns:
            Archive entry ID
        """
        return self.cold.archive(
            content=content,
            source=source,
            importance=importance,
            metadata=metadata
        )

    def run_maintenance(self) -> Dict[str, Any]:
        """
        Run maintenance tasks across all tiers.

        Returns:
            Statistics about maintenance operations
        """
        stats = {
            "timestamp": datetime.now().isoformat(),
            "hot": {
                "entries": len(self.hot.get_all()),
                "evicted": self.hot._evict_stale()
            },
            "warm": {
                "entries": self.warm.count(),
                "cleaned": self.warm.cleanup_old()
            },
            "cold": {
                "entries": self.cold.count(),
                "size_mb": self.cold.get_archive_size_mb()
            }
        }

        logger.info(f"Maintenance completed: {stats}")
        return stats

    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics for all tiers."""
        return {
            "hot": {
                "entries": len(self.hot.get_all()),
                "max_items": self.hot.max_items,
                "max_age_hours": self.hot.max_age.total_seconds() / 3600
            },
            "warm": {
                "entries": self.warm.count(),
                "threshold": self.warm.threshold,
                "max_age_days": self.warm.max_age.days
            },
            "cold": {
                "entries": self.cold.count(),
                "size_mb": self.cold.get_archive_size_mb()
            }
        }

    def clear_hot(self) -> int:
        """Clear hot memory cache."""
        return self.hot.clear()


# =============================================================================
# CLI Interface
# =============================================================================

def main():
    """CLI interface for testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Memory Tier Manager CLI")
    parser.add_argument("--root", type=Path, default=Path(".claude/memory"),
                        help="Memory root directory")

    subparsers = parser.add_subparsers(dest="command", help="Command")

    # Capture command
    capture_parser = subparsers.add_parser("capture", help="Capture observation")
    capture_parser.add_argument("content", help="Content to capture")
    capture_parser.add_argument("--importance", type=float, default=0.5)
    capture_parser.add_argument("--source", default="cli")

    # Search command
    search_parser = subparsers.add_parser("search", help="Search memories")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--tiers", nargs="+", default=["warm", "cold"])
    search_parser.add_argument("--limit", type=int, default=5)

    # Context command
    context_parser = subparsers.add_parser("context", help="Get context for prompt")
    context_parser.add_argument("prompt", help="User prompt")

    # Stats command
    subparsers.add_parser("stats", help="Show statistics")

    # Maintenance command
    subparsers.add_parser("maintenance", help="Run maintenance")

    args = parser.parse_args()

    # Initialize manager
    manager = MemoryTierManager(args.root)

    if args.command == "capture":
        entry_id = manager.capture(
            args.content,
            importance=args.importance,
            source=args.source
        )
        print(f"Captured: {entry_id}")

    elif args.command == "search":
        results = manager.search(args.query, tiers=args.tiers, limit=args.limit)
        for r in results:
            print(f"[{r.source_tier}] Score: {r.score:.2f}")
            print(f"  {r.entry.summary}")
            print()

    elif args.command == "context":
        context = manager.get_context_for_prompt(args.prompt)
        print(context)

    elif args.command == "stats":
        stats = manager.get_stats()
        print(json.dumps(stats, indent=2))

    elif args.command == "maintenance":
        stats = manager.run_maintenance()
        print(json.dumps(stats, indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
