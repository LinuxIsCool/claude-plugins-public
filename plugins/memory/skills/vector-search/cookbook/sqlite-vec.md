# SQLite Vector Search with sqlite-vec

## Purpose

sqlite-vec brings vector search to SQLite, enabling embedded vector databases with zero external dependencies. This cookbook covers installation, virtual table patterns, and integration strategies for local-first applications and Claude Code plugins.

## Variables

```yaml
SQLITE_VEC_VERSION: "0.1.x"
EMBEDDING_DIM: 384
DEFAULT_DISTANCE: "cosine"
MAX_BATCH_SIZE: 1000

# Note: sqlite-vec also supports sqlite-vss (older) and sqlite-lembed
PREFERRED_EXTENSION: "sqlite-vec"
```

## Instructions

### Installation

```bash
# Python with sqlite-vec
pip install sqlite-vec

# Alternative: sqlite-vss (older, FAISS-based)
pip install sqlite-vss

# Verify installation
python -c "import sqlite_vec; print(sqlite_vec.loadable_path())"
```

### Extension Loading

```python
import sqlite3
import sqlite_vec

# Load the extension
conn = sqlite3.connect(":memory:")  # or "my_database.db"
conn.enable_load_extension(True)
sqlite_vec.load(conn)
conn.enable_load_extension(False)

# Verify
result = conn.execute("SELECT vec_version()").fetchone()
print(f"sqlite-vec version: {result[0]}")
```

## Code Examples

### Basic Virtual Table Setup

```python
"""
sqlite-vec uses virtual tables for vector storage and search.
"""
import sqlite3
import sqlite_vec
import json
from typing import List, Dict, Any, Optional
import struct


def serialize_vector(vector: List[float]) -> bytes:
    """Convert float list to bytes for sqlite-vec."""
    return struct.pack(f'{len(vector)}f', *vector)


def deserialize_vector(data: bytes) -> List[float]:
    """Convert bytes back to float list."""
    n = len(data) // 4
    return list(struct.unpack(f'{n}f', data))


class SQLiteVecStore:
    """Embedded vector store using sqlite-vec."""

    def __init__(self, db_path: str = ":memory:", dimension: int = 384):
        self.db_path = db_path
        self.dimension = dimension
        self.conn = self._connect()
        self._setup_tables()

    def _connect(self) -> sqlite3.Connection:
        """Create connection and load extension."""
        conn = sqlite3.connect(self.db_path)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        return conn

    def _setup_tables(self):
        """Create tables for documents and vectors."""
        # Main documents table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)

        # Vector virtual table
        self.conn.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS document_vectors
            USING vec0(
                id TEXT PRIMARY KEY,
                embedding float[{self.dimension}]
            )
        """)

        self.conn.commit()

    def add(
        self,
        ids: List[str],
        contents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict] = None
    ):
        """Add documents with embeddings."""
        if metadatas is None:
            metadatas = [{} for _ in ids]

        cursor = self.conn.cursor()

        for id_, content, embedding, metadata in zip(ids, contents, embeddings, metadatas):
            # Insert document
            cursor.execute(
                "INSERT OR REPLACE INTO documents (id, content, metadata) VALUES (?, ?, ?)",
                (id_, content, json.dumps(metadata))
            )

            # Insert vector
            vec_bytes = serialize_vector(embedding)
            cursor.execute(
                "INSERT OR REPLACE INTO document_vectors (id, embedding) VALUES (?, ?)",
                (id_, vec_bytes)
            )

        self.conn.commit()

    def search(
        self,
        embedding: List[float],
        k: int = 10,
        filter_metadata: Dict = None
    ) -> List[Dict]:
        """Search for similar documents."""
        vec_bytes = serialize_vector(embedding)

        # Basic vector search
        query = """
            SELECT
                v.id,
                d.content,
                d.metadata,
                v.distance
            FROM document_vectors v
            JOIN documents d ON v.id = d.id
            WHERE v.embedding MATCH ?
                AND k = ?
            ORDER BY v.distance
        """

        results = self.conn.execute(query, (vec_bytes, k)).fetchall()

        # Post-filter by metadata if needed
        output = []
        for id_, content, metadata_str, distance in results:
            metadata = json.loads(metadata_str)

            if filter_metadata:
                match = all(
                    metadata.get(key) == value
                    for key, value in filter_metadata.items()
                )
                if not match:
                    continue

            output.append({
                "id": id_,
                "content": content,
                "metadata": metadata,
                "distance": distance,
                "similarity": 1 - distance  # Convert distance to similarity
            })

        return output[:k]

    def get(self, ids: List[str]) -> List[Dict]:
        """Get documents by IDs."""
        placeholders = ",".join("?" * len(ids))
        query = f"SELECT id, content, metadata FROM documents WHERE id IN ({placeholders})"

        results = self.conn.execute(query, ids).fetchall()

        return [
            {
                "id": row[0],
                "content": row[1],
                "metadata": json.loads(row[2])
            }
            for row in results
        ]

    def delete(self, ids: List[str]):
        """Delete documents by IDs."""
        placeholders = ",".join("?" * len(ids))

        self.conn.execute(
            f"DELETE FROM documents WHERE id IN ({placeholders})",
            ids
        )
        self.conn.execute(
            f"DELETE FROM document_vectors WHERE id IN ({placeholders})",
            ids
        )
        self.conn.commit()

    def count(self) -> int:
        """Get total document count."""
        return self.conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]

    def close(self):
        """Close database connection."""
        self.conn.close()


# Usage
store = SQLiteVecStore("./my_vectors.db", dimension=384)

# Add documents
store.add(
    ids=["doc1", "doc2", "doc3"],
    contents=[
        "Vector databases enable similarity search",
        "SQLite is a serverless database",
        "Embeddings represent semantic meaning"
    ],
    embeddings=[
        [0.1] * 384,
        [0.2] * 384,
        [0.3] * 384
    ],
    metadatas=[
        {"source": "tutorial", "topic": "vectors"},
        {"source": "docs", "topic": "sqlite"},
        {"source": "tutorial", "topic": "ml"}
    ]
)

# Search
results = store.search(
    embedding=[0.15] * 384,
    k=5,
    filter_metadata={"source": "tutorial"}
)
```

### Hybrid Search with FTS5

```python
"""
Combine sqlite-vec with FTS5 for hybrid vector + full-text search.
"""
import sqlite3
import sqlite_vec
import json
import struct
from typing import List, Dict


class HybridSQLiteStore:
    """SQLite store with both vector and full-text search."""

    def __init__(self, db_path: str, dimension: int = 384):
        self.db_path = db_path
        self.dimension = dimension
        self.conn = self._connect()
        self._setup()

    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        return conn

    def _setup(self):
        """Create all necessary tables."""
        # Main document store
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                metadata TEXT DEFAULT '{}'
            )
        """)

        # FTS5 for full-text search
        self.conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts
            USING fts5(id, content, content=documents, content_rowid=rowid)
        """)

        # Triggers to keep FTS in sync
        self.conn.execute("""
            CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
                INSERT INTO documents_fts(rowid, id, content)
                VALUES (new.rowid, new.id, new.content);
            END
        """)

        self.conn.execute("""
            CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts, rowid, id, content)
                VALUES('delete', old.rowid, old.id, old.content);
            END
        """)

        self.conn.execute("""
            CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts, rowid, id, content)
                VALUES('delete', old.rowid, old.id, old.content);
                INSERT INTO documents_fts(rowid, id, content)
                VALUES (new.rowid, new.id, new.content);
            END
        """)

        # Vector table
        self.conn.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS document_vectors
            USING vec0(id TEXT PRIMARY KEY, embedding float[{self.dimension}])
        """)

        self.conn.commit()

    def add(
        self,
        ids: List[str],
        contents: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict] = None
    ):
        """Add documents with both text and embeddings."""
        if metadatas is None:
            metadatas = [{} for _ in ids]

        for id_, content, embedding, metadata in zip(ids, contents, embeddings, metadatas):
            self.conn.execute(
                "INSERT OR REPLACE INTO documents (id, content, metadata) VALUES (?, ?, ?)",
                (id_, content, json.dumps(metadata))
            )

            vec_bytes = struct.pack(f'{len(embedding)}f', *embedding)
            self.conn.execute(
                "INSERT OR REPLACE INTO document_vectors (id, embedding) VALUES (?, ?)",
                (id_, vec_bytes)
            )

        self.conn.commit()

    def hybrid_search(
        self,
        query_text: str,
        query_embedding: List[float],
        k: int = 10,
        vector_weight: float = 0.7,
        fts_weight: float = 0.3
    ) -> List[Dict]:
        """
        Perform hybrid search combining vector and full-text results.

        Uses Reciprocal Rank Fusion (RRF) to combine rankings.
        """
        # Vector search
        vec_bytes = struct.pack(f'{len(query_embedding)}f', *query_embedding)
        vector_results = self.conn.execute("""
            SELECT id, distance
            FROM document_vectors
            WHERE embedding MATCH ?
            AND k = ?
            ORDER BY distance
        """, (vec_bytes, k * 2)).fetchall()

        # Full-text search
        fts_results = self.conn.execute("""
            SELECT id, rank
            FROM documents_fts
            WHERE documents_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query_text, k * 2)).fetchall()

        # RRF fusion
        rrf_k = 60  # RRF constant
        scores = {}

        for rank, (id_, _) in enumerate(vector_results):
            scores[id_] = scores.get(id_, 0) + vector_weight / (rrf_k + rank + 1)

        for rank, (id_, _) in enumerate(fts_results):
            scores[id_] = scores.get(id_, 0) + fts_weight / (rrf_k + rank + 1)

        # Sort by combined score
        ranked_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:k]

        # Fetch full documents
        if not ranked_ids:
            return []

        placeholders = ",".join("?" * len(ranked_ids))
        docs = self.conn.execute(
            f"SELECT id, content, metadata FROM documents WHERE id IN ({placeholders})",
            ranked_ids
        ).fetchall()

        doc_map = {row[0]: {"id": row[0], "content": row[1], "metadata": json.loads(row[2])} for row in docs}

        return [
            {**doc_map[id_], "score": scores[id_]}
            for id_ in ranked_ids
            if id_ in doc_map
        ]

    def vector_search(self, embedding: List[float], k: int = 10) -> List[Dict]:
        """Pure vector search."""
        vec_bytes = struct.pack(f'{len(embedding)}f', *embedding)

        results = self.conn.execute("""
            SELECT v.id, d.content, d.metadata, v.distance
            FROM document_vectors v
            JOIN documents d ON v.id = d.id
            WHERE v.embedding MATCH ?
            AND k = ?
            ORDER BY v.distance
        """, (vec_bytes, k)).fetchall()

        return [
            {
                "id": row[0],
                "content": row[1],
                "metadata": json.loads(row[2]),
                "distance": row[3]
            }
            for row in results
        ]

    def text_search(self, query: str, k: int = 10) -> List[Dict]:
        """Pure full-text search."""
        results = self.conn.execute("""
            SELECT d.id, d.content, d.metadata, f.rank
            FROM documents_fts f
            JOIN documents d ON f.id = d.id
            WHERE documents_fts MATCH ?
            ORDER BY f.rank
            LIMIT ?
        """, (query, k)).fetchall()

        return [
            {
                "id": row[0],
                "content": row[1],
                "metadata": json.loads(row[2]),
                "rank": row[3]
            }
            for row in results
        ]


# Usage
store = HybridSQLiteStore("./hybrid.db", dimension=384)

# Add documents
store.add(
    ids=["d1", "d2", "d3"],
    contents=[
        "Machine learning models use neural networks",
        "Database systems store and retrieve data efficiently",
        "Vector search enables semantic similarity matching"
    ],
    embeddings=[
        [0.1] * 384,
        [0.2] * 384,
        [0.3] * 384
    ]
)

# Hybrid search
results = store.hybrid_search(
    query_text="machine learning",
    query_embedding=[0.15] * 384,
    k=5,
    vector_weight=0.6,
    fts_weight=0.4
)
```

### Memory-Efficient Batch Operations

```python
"""
Batch operations for large-scale data loading.
"""
import sqlite3
import sqlite_vec
import struct
from typing import Iterator, Tuple, List


def batch_insert(
    conn: sqlite3.Connection,
    documents: Iterator[Tuple[str, str, List[float], dict]],
    batch_size: int = 1000
):
    """
    Memory-efficient batch insert.

    Args:
        conn: Database connection
        documents: Iterator of (id, content, embedding, metadata) tuples
        batch_size: Documents per batch
    """
    batch_docs = []
    batch_vecs = []

    for id_, content, embedding, metadata in documents:
        batch_docs.append((id_, content, json.dumps(metadata)))
        batch_vecs.append((id_, struct.pack(f'{len(embedding)}f', *embedding)))

        if len(batch_docs) >= batch_size:
            # Insert batch
            conn.executemany(
                "INSERT OR REPLACE INTO documents (id, content, metadata) VALUES (?, ?, ?)",
                batch_docs
            )
            conn.executemany(
                "INSERT OR REPLACE INTO document_vectors (id, embedding) VALUES (?, ?)",
                batch_vecs
            )
            conn.commit()

            batch_docs = []
            batch_vecs = []

    # Insert remaining
    if batch_docs:
        conn.executemany(
            "INSERT OR REPLACE INTO documents (id, content, metadata) VALUES (?, ?, ?)",
            batch_docs
        )
        conn.executemany(
            "INSERT OR REPLACE INTO document_vectors (id, embedding) VALUES (?, ?)",
            batch_vecs
        )
        conn.commit()


# Usage with generator for memory efficiency
def document_generator():
    """Generate documents from a large source."""
    for i in range(100000):
        yield (
            f"doc_{i}",
            f"Document content {i}",
            [0.1 + i * 0.0001] * 384,
            {"batch": i // 1000}
        )


# conn = setup_connection()
# batch_insert(conn, document_generator(), batch_size=1000)
```

### Claude Code Plugin Integration

```python
"""
Pattern for Claude Code plugins using sqlite-vec.
"""
from pathlib import Path
import sqlite3
import sqlite_vec
import struct
import json
from typing import List, Dict, Optional


def get_plugin_db_path() -> Path:
    """
    Get database path anchored to repository root.
    Follows plugin data storage conventions.
    """
    # Try to find repo root via git
    import subprocess
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True
        )
        repo_root = Path(result.stdout.strip())
    except subprocess.CalledProcessError:
        # Fallback to current directory
        repo_root = Path.cwd()

    db_dir = repo_root / ".claude" / "memory" / "vectors"
    db_dir.mkdir(parents=True, exist_ok=True)

    return db_dir / "embeddings.db"


class PluginVectorStore:
    """Vector store designed for Claude Code plugins."""

    _instance: Optional["PluginVectorStore"] = None

    @classmethod
    def get_instance(cls, dimension: int = 384) -> "PluginVectorStore":
        """Singleton pattern for plugin usage."""
        if cls._instance is None:
            db_path = get_plugin_db_path()
            cls._instance = cls(str(db_path), dimension)
        return cls._instance

    def __init__(self, db_path: str, dimension: int = 384):
        self.db_path = db_path
        self.dimension = dimension
        self.conn = self._connect()
        self._setup()

    def _connect(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        # Enable WAL mode for better concurrency
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _setup(self):
        self.conn.executescript(f"""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT DEFAULT '{{}}',
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_memories_category
            ON memories(category);

            CREATE VIRTUAL TABLE IF NOT EXISTS memory_vectors
            USING vec0(id TEXT PRIMARY KEY, embedding float[{self.dimension}]);
        """)
        self.conn.commit()

    def remember(
        self,
        category: str,
        content: str,
        embedding: List[float],
        metadata: Dict = None,
        id_: str = None
    ) -> str:
        """Store a memory."""
        import uuid

        if id_ is None:
            id_ = str(uuid.uuid4())

        if metadata is None:
            metadata = {}

        self.conn.execute(
            "INSERT OR REPLACE INTO memories (id, category, content, metadata) VALUES (?, ?, ?, ?)",
            (id_, category, content, json.dumps(metadata))
        )

        vec_bytes = struct.pack(f'{len(embedding)}f', *embedding)
        self.conn.execute(
            "INSERT OR REPLACE INTO memory_vectors (id, embedding) VALUES (?, ?)",
            (id_, vec_bytes)
        )

        self.conn.commit()
        return id_

    def recall(
        self,
        embedding: List[float],
        k: int = 5,
        category: str = None
    ) -> List[Dict]:
        """Retrieve similar memories."""
        vec_bytes = struct.pack(f'{len(embedding)}f', *embedding)

        if category:
            results = self.conn.execute("""
                SELECT v.id, m.category, m.content, m.metadata, v.distance
                FROM memory_vectors v
                JOIN memories m ON v.id = m.id
                WHERE v.embedding MATCH ?
                AND k = ?
                AND m.category = ?
                ORDER BY v.distance
            """, (vec_bytes, k * 2, category)).fetchall()
        else:
            results = self.conn.execute("""
                SELECT v.id, m.category, m.content, m.metadata, v.distance
                FROM memory_vectors v
                JOIN memories m ON v.id = m.id
                WHERE v.embedding MATCH ?
                AND k = ?
                ORDER BY v.distance
            """, (vec_bytes, k)).fetchall()

        return [
            {
                "id": row[0],
                "category": row[1],
                "content": row[2],
                "metadata": json.loads(row[3]),
                "similarity": 1 - row[4]
            }
            for row in results[:k]
        ]

    def forget(self, id_: str):
        """Delete a memory."""
        self.conn.execute("DELETE FROM memories WHERE id = ?", (id_,))
        self.conn.execute("DELETE FROM memory_vectors WHERE id = ?", (id_,))
        self.conn.commit()


# Plugin usage
store = PluginVectorStore.get_instance()

# Remember something
store.remember(
    category="conversation",
    content="User prefers dark mode in all applications",
    embedding=[0.1] * 384,
    metadata={"topic": "preferences", "confidence": 0.9}
)

# Recall relevant memories
memories = store.recall(
    embedding=[0.12] * 384,
    k=3,
    category="conversation"
)
```

## Performance Characteristics

### Benchmarks (100K vectors, 384 dimensions)

| Operation | Time | Notes |
|-----------|------|-------|
| Insert single | ~0.5ms | Without index |
| Insert batch (1000) | ~200ms | Amortized 0.2ms each |
| Search (k=10) | ~5ms | Linear scan |
| Search with join | ~10ms | Includes metadata fetch |

### Memory Usage

```
Base SQLite overhead: ~1MB
Per 100K vectors (384d):
  - Raw vectors: ~150MB
  - With metadata: ~200MB
  - With FTS5 index: +50MB

Total for 100K docs with hybrid: ~250MB
```

### Limitations

```
- No built-in ANN index (brute force search)
- Maximum practical size: ~500K vectors
- Single-threaded writes
- Query performance degrades linearly with size
```

## When to Use This Pattern

**sqlite-vec excels at:**
- Local-first applications
- Claude Code plugins
- Single-file deployments
- Prototyping and development
- Edge/embedded scenarios
- When you need combined vector + SQL

**Consider alternatives when:**
- Dataset exceeds 500K vectors (use FAISS or ChromaDB)
- Need ANN indexes for faster search (use ChromaDB)
- Need horizontal scaling (use Qdrant or pgvector)
- Need real-time high-throughput (use Qdrant)

## Common Patterns

### Persistence Best Practices

```python
# Use WAL mode for better concurrency
conn.execute("PRAGMA journal_mode=WAL")

# Optimize for writes during bulk import
conn.execute("PRAGMA synchronous=OFF")
conn.execute("PRAGMA temp_store=MEMORY")

# After bulk import, re-enable safety
conn.execute("PRAGMA synchronous=NORMAL")

# Vacuum periodically after many deletes
conn.execute("VACUUM")
```

### Error Handling

```python
import sqlite3
import sqlite_vec


def safe_connect(db_path: str):
    """Connect with proper error handling."""
    try:
        conn = sqlite3.connect(db_path)
        conn.enable_load_extension(True)
        try:
            sqlite_vec.load(conn)
        except Exception as e:
            conn.close()
            raise RuntimeError(f"Failed to load sqlite-vec: {e}")
        finally:
            conn.enable_load_extension(False)
        return conn
    except sqlite3.Error as e:
        raise RuntimeError(f"Database error: {e}")
```

## Related Cookbooks

- `quickstart.md` - Getting started basics
- `hybrid-search.md` - More on combining vector + text search
- `chromadb.md` - For larger datasets needing ANN
- `metadata-filtering.md` - Advanced filtering patterns
