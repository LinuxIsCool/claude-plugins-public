# Purpose

Implement a three-tier temporal memory architecture that provides seamless context continuity while preventing information pollution. This pattern recognizes that memory access patterns should match information decay rates - recent context is always relevant, while older context requires explicit retrieval.

## Variables

```yaml
# Tier Configuration
HOT_TIER:
  max_age_hours: 24
  max_items: 5
  storage: in_memory_deque
  injection: automatic_always

WARM_TIER:
  max_age_days: 7
  max_items: 2
  storage: sqlite_vector_db
  injection: triggered_by_cues
  similarity_threshold: 0.4

COLD_TIER:
  max_age_days: unlimited
  storage: jsonl_with_fts5
  injection: explicit_only

# Storage Paths (use repo-anchored paths)
MEMORY_ROOT: "${REPO_ROOT}/.claude/memory"
HOT_CACHE: "${MEMORY_ROOT}/hot_cache.json"
WARM_DB: "${MEMORY_ROOT}/warm.db"
COLD_ARCHIVE: "${MEMORY_ROOT}/archive/"

# Embedding Configuration
EMBEDDING_MODEL: "text-embedding-3-small"
EMBEDDING_DIMENSIONS: 1536
```

## Instructions

### 1. Understand the Tier Philosophy

Each tier serves a distinct purpose aligned with human memory patterns:

| Tier | Metaphor | Automation Level | Why |
|------|----------|------------------|-----|
| **Hot** | Short-term memory | Full automation | "What we just talked about" |
| **Warm** | Working memory | Selective automation | "What we worked on recently" |
| **Cold** | Long-term memory | No automation | "What we did months ago" |

### 2. Implement Hot Memory (Session Cache)

Hot memory provides zero-friction continuity within a working session.

```python
from collections import deque
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import json
from pathlib import Path
from typing import Optional, List

@dataclass
class HotMemoryEntry:
    """Single entry in hot memory cache."""
    timestamp: str
    summary: str
    key_entities: List[str]
    tool_uses: List[str]
    importance: float  # 0.0-1.0

    @classmethod
    def from_exchange(cls, user_msg: str, assistant_response: str,
                      tools_used: List[str]) -> "HotMemoryEntry":
        """Create entry from a conversation exchange."""
        return cls(
            timestamp=datetime.now().isoformat(),
            summary=cls._generate_summary(user_msg, assistant_response),
            key_entities=cls._extract_entities(user_msg, assistant_response),
            tool_uses=tools_used,
            importance=cls._calculate_importance(tools_used)
        )

    @staticmethod
    def _generate_summary(user: str, assistant: str) -> str:
        """Generate concise summary of exchange."""
        # In production, use LLM for summarization
        # For now, truncate intelligently
        user_preview = user[:100] + "..." if len(user) > 100 else user
        return f"User asked: {user_preview}"

    @staticmethod
    def _extract_entities(user: str, assistant: str) -> List[str]:
        """Extract key entities (files, concepts, names)."""
        entities = []
        # Extract file paths
        import re
        file_pattern = r'[/\w-]+\.[a-zA-Z]{1,4}'
        entities.extend(re.findall(file_pattern, user + assistant))
        return list(set(entities))[:10]  # Cap at 10 entities

    @staticmethod
    def _calculate_importance(tools: List[str]) -> float:
        """Calculate importance based on tool usage."""
        high_importance_tools = {"Write", "Edit", "Bash"}
        if any(t in high_importance_tools for t in tools):
            return 0.8
        return 0.5


class HotMemoryCache:
    """In-memory cache for hot tier with persistence."""

    def __init__(self, cache_path: Path, max_items: int = 5,
                 max_age_hours: int = 24):
        self.cache_path = cache_path
        self.max_items = max_items
        self.max_age = timedelta(hours=max_age_hours)
        self.entries: deque = deque(maxlen=max_items)
        self._load_cache()

    def add(self, entry: HotMemoryEntry) -> None:
        """Add entry, automatically evicting oldest if at capacity."""
        self.entries.append(entry)
        self._persist()

    def get_active_context(self) -> List[HotMemoryEntry]:
        """Get all entries within the age threshold."""
        self._evict_stale()
        return list(self.entries)

    def format_for_injection(self) -> str:
        """Format hot memory for context injection."""
        entries = self.get_active_context()
        if not entries:
            return ""

        lines = ["## Recent Context (Hot Memory)"]
        for entry in entries:
            age = self._format_age(entry.timestamp)
            lines.append(f"- [{age}] {entry.summary}")
            if entry.key_entities:
                lines.append(f"  Files: {', '.join(entry.key_entities[:5])}")
        return "\n".join(lines)

    def _evict_stale(self) -> None:
        """Remove entries older than max_age."""
        now = datetime.now()
        while self.entries:
            oldest = self.entries[0]
            entry_time = datetime.fromisoformat(oldest.timestamp)
            if now - entry_time > self.max_age:
                self.entries.popleft()
            else:
                break
        self._persist()

    def _format_age(self, timestamp: str) -> str:
        """Format timestamp as relative age."""
        age = datetime.now() - datetime.fromisoformat(timestamp)
        if age.seconds < 3600:
            return f"{age.seconds // 60}m ago"
        elif age.seconds < 86400:
            return f"{age.seconds // 3600}h ago"
        else:
            return f"{age.days}d ago"

    def _load_cache(self) -> None:
        """Load cache from disk if exists."""
        if self.cache_path.exists():
            try:
                data = json.loads(self.cache_path.read_text())
                for item in data:
                    self.entries.append(HotMemoryEntry(**item))
            except (json.JSONDecodeError, KeyError):
                self.entries.clear()

    def _persist(self) -> None:
        """Persist cache to disk."""
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        data = [asdict(e) for e in self.entries]
        self.cache_path.write_text(json.dumps(data, indent=2))
```

### 3. Implement Warm Memory (Vector Store)

Warm memory uses semantic search with triggered retrieval.

```python
import sqlite3
import numpy as np
from typing import Tuple, Optional
import struct

class WarmMemoryStore:
    """SQLite-based vector store for warm tier."""

    def __init__(self, db_path: Path, similarity_threshold: float = 0.4):
        self.db_path = db_path
        self.threshold = similarity_threshold
        self._init_db()

    def _init_db(self) -> None:
        """Initialize database schema."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY,
                timestamp TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB NOT NULL,
                importance REAL DEFAULT 0.5,
                access_count INTEGER DEFAULT 0,
                last_accessed TEXT,
                metadata TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp
            ON memories(timestamp)
        """)
        conn.commit()
        conn.close()

    def store(self, content: str, embedding: np.ndarray,
              importance: float = 0.5, metadata: dict = None) -> int:
        """Store a memory with its embedding."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            """INSERT INTO memories
               (timestamp, content, embedding, importance, metadata)
               VALUES (?, ?, ?, ?, ?)""",
            (
                datetime.now().isoformat(),
                content,
                self._serialize_embedding(embedding),
                importance,
                json.dumps(metadata) if metadata else None
            )
        )
        memory_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return memory_id

    def search(self, query_embedding: np.ndarray,
               max_age_days: int = 7,
               limit: int = 2) -> List[Tuple[str, float]]:
        """Search for similar memories within age threshold."""
        cutoff = (datetime.now() - timedelta(days=max_age_days)).isoformat()

        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            """SELECT id, content, embedding, importance
               FROM memories
               WHERE timestamp > ?
               ORDER BY timestamp DESC""",
            (cutoff,)
        )

        results = []
        for row in cursor.fetchall():
            memory_id, content, emb_blob, importance = row
            embedding = self._deserialize_embedding(emb_blob)
            similarity = self._cosine_similarity(query_embedding, embedding)

            if similarity >= self.threshold:
                # Boost score by importance
                final_score = similarity * 0.7 + importance * 0.3
                results.append((memory_id, content, final_score))

        conn.close()

        # Sort by score and return top matches
        results.sort(key=lambda x: x[2], reverse=True)
        return [(content, score) for _, content, score in results[:limit]]

    def should_trigger(self, prompt: str) -> bool:
        """Determine if warm memory retrieval should be triggered."""
        triggers = [
            "?" in prompt,  # Question mark
            len(prompt.split()) > 10,  # Complex query
            any(kw in prompt.lower() for kw in
                ["yesterday", "last week", "earlier", "before", "previously"]),
            self._contains_file_reference(prompt)
        ]
        return any(triggers)

    def _contains_file_reference(self, text: str) -> bool:
        """Check if text contains file path references."""
        import re
        return bool(re.search(r'[/\w-]+\.(py|ts|js|md|json|yaml|yml)', text))

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def _serialize_embedding(self, embedding: np.ndarray) -> bytes:
        """Serialize numpy array to bytes."""
        return struct.pack(f'{len(embedding)}f', *embedding.tolist())

    def _deserialize_embedding(self, blob: bytes) -> np.ndarray:
        """Deserialize bytes to numpy array."""
        n = len(blob) // 4
        return np.array(struct.unpack(f'{n}f', blob))

    def cleanup_old_memories(self, max_age_days: int = 7) -> int:
        """Move old memories to cold storage."""
        cutoff = (datetime.now() - timedelta(days=max_age_days)).isoformat()
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute(
            "DELETE FROM memories WHERE timestamp < ?",
            (cutoff,)
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        return deleted
```

### 4. Implement Cold Memory (Archive with Full-Text Search)

Cold memory provides explicit search over the complete history.

```python
import sqlite3
from pathlib import Path

class ColdMemoryArchive:
    """JSONL archive with FTS5 full-text search."""

    def __init__(self, archive_dir: Path, db_path: Path):
        self.archive_dir = archive_dir
        self.db_path = db_path
        self._init_fts()

    def _init_fts(self) -> None:
        """Initialize FTS5 virtual table."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS cold_fts USING fts5(
                content,
                timestamp,
                source,
                tokenize='porter unicode61'
            )
        """)
        conn.commit()
        conn.close()

    def archive(self, content: str, source: str = "session") -> None:
        """Add content to cold archive."""
        timestamp = datetime.now().isoformat()

        # Append to JSONL
        jsonl_file = self.archive_dir / f"{datetime.now().strftime('%Y-%m')}.jsonl"
        jsonl_file.parent.mkdir(parents=True, exist_ok=True)
        with jsonl_file.open("a") as f:
            f.write(json.dumps({
                "timestamp": timestamp,
                "content": content,
                "source": source
            }) + "\n")

        # Index in FTS
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "INSERT INTO cold_fts (content, timestamp, source) VALUES (?, ?, ?)",
            (content, timestamp, source)
        )
        conn.commit()
        conn.close()

    def search(self, query: str, limit: int = 10,
               months_back: int = None) -> List[dict]:
        """Full-text search over archived memories."""
        conn = sqlite3.connect(self.db_path)

        sql = """
            SELECT content, timestamp, source,
                   bm25(cold_fts) as score
            FROM cold_fts
            WHERE cold_fts MATCH ?
        """

        if months_back:
            cutoff = (datetime.now() - timedelta(days=months_back * 30)).isoformat()
            sql += f" AND timestamp > '{cutoff}'"

        sql += " ORDER BY bm25(cold_fts) LIMIT ?"

        cursor = conn.execute(sql, (query, limit))
        results = []
        for row in cursor.fetchall():
            results.append({
                "content": row[0],
                "timestamp": row[1],
                "source": row[2],
                "score": abs(row[3])  # BM25 returns negative scores
            })

        conn.close()
        return results
```

### 5. Orchestrate the Three Tiers

```python
class ThreeTierMemoryManager:
    """Unified manager for all memory tiers."""

    def __init__(self, memory_root: Path):
        self.hot = HotMemoryCache(
            memory_root / "hot_cache.json",
            max_items=5,
            max_age_hours=24
        )
        self.warm = WarmMemoryStore(
            memory_root / "warm.db",
            similarity_threshold=0.4
        )
        self.cold = ColdMemoryArchive(
            memory_root / "archive",
            memory_root / "cold_fts.db"
        )
        self.embedder = None  # Initialize with your embedding service

    def process_exchange(self, user_msg: str, assistant_response: str,
                         tools_used: List[str]) -> None:
        """Process a completed conversation exchange."""
        # Always add to hot memory
        entry = HotMemoryEntry.from_exchange(user_msg, assistant_response, tools_used)
        self.hot.add(entry)

        # Index in warm memory if significant
        if entry.importance >= 0.5:
            content = f"{user_msg}\n---\n{assistant_response}"
            embedding = self._get_embedding(content)
            self.warm.store(content, embedding, entry.importance)

    def get_context_for_prompt(self, user_prompt: str) -> str:
        """Get relevant context to inject with a new prompt."""
        context_parts = []

        # Always include hot memory
        hot_context = self.hot.format_for_injection()
        if hot_context:
            context_parts.append(hot_context)

        # Conditionally include warm memory
        if self.warm.should_trigger(user_prompt):
            query_embedding = self._get_embedding(user_prompt)
            warm_results = self.warm.search(query_embedding)
            if warm_results:
                context_parts.append("## Related Context (Warm Memory)")
                for content, score in warm_results:
                    context_parts.append(f"[Score: {score:.2f}]\n{content[:500]}...")

        if not context_parts:
            return ""

        return "[MEMORY CONTEXT]\n" + "\n\n".join(context_parts) + "\n[END MEMORY]"

    def daily_maintenance(self) -> dict:
        """Run daily maintenance tasks."""
        # Age warm memories to cold
        aged_out = self.warm.cleanup_old_memories(max_age_days=7)

        return {
            "warm_archived": aged_out,
            "hot_entries": len(self.hot.entries),
            "timestamp": datetime.now().isoformat()
        }

    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for text (implement with your embedding service)."""
        if self.embedder:
            return self.embedder.embed(text)
        # Fallback: return random vector (replace in production)
        return np.random.randn(1536)
```

## When to Use This Pattern

Use the three-tier architecture when:

- **Building conversational AI systems** that span multiple sessions
- **Memory pollution is a concern** - you have significant history to manage
- **Users need both automatic and explicit retrieval** - different use cases
- **Token budget is limited** - you cannot inject all history every time
- **Session continuity matters** - users return to incomplete work

Avoid when:

- Single-session applications only
- Memory budget is unlimited (can inject everything)
- All queries are independent (no context needed)

## Trade-offs and Considerations

### Performance Trade-offs

| Aspect | Hot | Warm | Cold |
|--------|-----|------|------|
| Read latency | ~1ms | ~10-50ms | ~50-200ms |
| Write latency | ~1ms | ~20ms | ~10ms |
| Storage growth | Bounded (5 items) | Linear (needs cleanup) | Unbounded |
| Query accuracy | Perfect (recent) | Good (semantic) | Variable (keyword) |

### Threshold Tuning

The similarity threshold (0.4 default) balances precision and recall:

| Threshold | Behavior | When to Use |
|-----------|----------|-------------|
| 0.3 | Aggressive (more results) | Exploratory work, learning new codebase |
| 0.4 | Balanced | Default for most use cases |
| 0.5 | Conservative (fewer results) | Focused work, known context |
| 0.6+ | Very selective | Only near-exact matches |

### Failure Recovery

```python
# Handle embedding service failures gracefully
def safe_store_warm(self, content: str, importance: float) -> bool:
    """Store to warm with fallback on embedding failure."""
    try:
        embedding = self._get_embedding(content)
        self.warm.store(content, embedding, importance)
        return True
    except EmbeddingServiceError:
        # Fall back to storing without embedding
        # Will be indexed when service recovers
        self._queue_for_later_embedding(content, importance)
        return False
```

### Memory Budget Management

Monitor and cap total memory usage:

```python
def check_memory_budget(self) -> dict:
    """Check memory usage across tiers."""
    hot_tokens = sum(len(e.summary.split()) * 1.3 for e in self.hot.entries)
    warm_tokens = self._estimate_warm_tokens()

    return {
        "hot_tokens": int(hot_tokens),
        "max_warm_injection": 500,  # Cap warm at 500 tokens
        "total_budget": 2000,
        "current_usage": int(hot_tokens + 500)  # Worst case
    }
```
