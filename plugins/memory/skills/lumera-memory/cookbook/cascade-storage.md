# Cascade Content-Addressed Storage

Object storage patterns for durable agent memory using the Cascade protocol.

## Purpose

Cascade implements content-addressed storage where data is identified by its cryptographic hash rather than arbitrary identifiers. This pattern provides automatic deduplication, integrity verification, and immutable storage semantics. Lumera uses Cascade for the object storage layer while maintaining a separate local index for searchability.

## Variables

```yaml
URI_FORMAT: "cascade://sha256:{hash}"
HASH_ALGORITHM: SHA-256
DIRECTORY_SHARDING: first 2 chars of hash
MOCK_STORAGE_PATH: ~/.lumera/cascade/
LIVE_ENDPOINT_ENV: LUMERA_CASCADE_ENDPOINT
LIVE_API_KEY_ENV: LUMERA_CASCADE_API_KEY
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Lumera Memory Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Session    │───▶│   Encrypt    │───▶│   Cascade    │      │
│  │    Data      │    │  AES-256-GCM │    │   Upload     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                  │               │
│                                                  ▼               │
│                                          ┌──────────────┐       │
│                                          │cascade://    │       │
│                                          │sha256:abc... │       │
│                                          └──────────────┘       │
│                                                  │               │
│                      ┌───────────────────────────┘               │
│                      ▼                                           │
│               ┌──────────────┐                                   │
│               │ Local SQLite │ ◀── Search queries               │
│               │  FTS Index   │ ──▶ Returns URIs (never data)    │
│               └──────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Key principle: Object storage + metadata indexing separation
- Cascade: Stores encrypted blobs (source of truth)
- Index: Stores searchable metadata + URIs (never raw data)
```

## Instructions

### 1. Cascade Interface (Abstract)

```python
from abc import ABC, abstractmethod
from typing import Optional

class CascadeInterface(ABC):
    """Abstract interface for Cascade storage operations."""

    @abstractmethod
    async def upload_blob(
        self,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None
    ) -> str:
        """
        Upload a blob to Cascade.

        Args:
            data: Binary data to upload
            content_type: MIME type
            metadata: Optional metadata

        Returns:
            Cascade URI (e.g., cascade://sha256:<hash>)
        """
        pass

    @abstractmethod
    async def download_blob(self, uri: str) -> bytes:
        """
        Download a blob from Cascade by URI.

        Args:
            uri: Cascade URI

        Returns:
            Binary data
        """
        pass

    @abstractmethod
    async def delete_blob(self, uri: str) -> bool:
        """
        Delete a blob from Cascade.

        Args:
            uri: Cascade URI

        Returns:
            True if deleted, False if not found
        """
        pass

    @abstractmethod
    async def blob_exists(self, uri: str) -> bool:
        """Check if a blob exists."""
        pass
```

### 2. Mock Filesystem Implementation

```python
import hashlib
import os
import json
from pathlib import Path

class MockCascadeFS(CascadeInterface):
    """Filesystem-backed mock Cascade with content-addressed storage."""

    def __init__(self, storage_dir: Optional[str] = None):
        """
        Initialize mock Cascade.

        Args:
            storage_dir: Directory for blob storage (default: ~/.lumera/cascade)
        """
        if storage_dir is None:
            storage_dir = os.path.expanduser("~/.lumera/cascade")

        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    async def upload_blob(
        self,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None
    ) -> str:
        """Upload blob with content-addressed URI."""
        # Compute SHA-256 hash for content-addressed storage
        sha256_hash = hashlib.sha256(data).hexdigest()

        # Create URI
        uri = f"cascade://sha256:{sha256_hash}"

        # Store blob using hash-based directory structure
        # Sharding: first 2 chars as subdirectory
        subdir = self.storage_dir / sha256_hash[:2]
        subdir.mkdir(exist_ok=True)

        blob_path = subdir / sha256_hash

        # Write blob if it doesn't exist (automatic deduplication)
        if not blob_path.exists():
            blob_path.write_bytes(data)

        # Store metadata if provided
        if metadata:
            meta_path = subdir / f"{sha256_hash}.meta"
            meta_path.write_text(json.dumps(metadata))

        return uri

    async def download_blob(self, uri: str) -> bytes:
        """Download blob by content-addressed URI."""
        sha256_hash = self._parse_uri(uri)

        # Locate blob
        subdir = self.storage_dir / sha256_hash[:2]
        blob_path = subdir / sha256_hash

        if not blob_path.exists():
            raise FileNotFoundError(f"Blob not found: {uri}")

        return blob_path.read_bytes()

    async def delete_blob(self, uri: str) -> bool:
        """Delete blob by URI."""
        sha256_hash = self._parse_uri(uri)

        subdir = self.storage_dir / sha256_hash[:2]
        blob_path = subdir / sha256_hash
        meta_path = subdir / f"{sha256_hash}.meta"

        deleted = False
        if blob_path.exists():
            blob_path.unlink()
            deleted = True

        if meta_path.exists():
            meta_path.unlink()

        return deleted

    async def blob_exists(self, uri: str) -> bool:
        """Check if blob exists."""
        sha256_hash = self._parse_uri(uri)
        blob_path = self.storage_dir / sha256_hash[:2] / sha256_hash
        return blob_path.exists()

    def _parse_uri(self, uri: str) -> str:
        """Parse Cascade URI to extract hash."""
        if not uri.startswith("cascade://sha256:"):
            raise ValueError(f"Invalid Cascade URI format: {uri}")
        return uri.replace("cascade://sha256:", "")
```

### 3. Live Cascade Client

```python
import aiohttp
import os

class LiveCascadeClient(CascadeInterface):
    """HTTP client for live Cascade service."""

    def __init__(
        self,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        self.endpoint = endpoint or os.environ.get("LUMERA_CASCADE_ENDPOINT")
        self.api_key = api_key or os.environ.get("LUMERA_CASCADE_API_KEY")

        if not self.endpoint or not self.api_key:
            raise ValueError(
                "Live Cascade requires LUMERA_CASCADE_ENDPOINT and "
                "LUMERA_CASCADE_API_KEY environment variables"
            )

    async def upload_blob(
        self,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None
    ) -> str:
        """Upload blob to live Cascade service."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": content_type
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.endpoint}/v1/blobs",
                data=data,
                headers=headers,
                params={"metadata": json.dumps(metadata)} if metadata else None
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return result["uri"]

    async def download_blob(self, uri: str) -> bytes:
        """Download blob from live Cascade service."""
        sha256_hash = uri.replace("cascade://sha256:", "")

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.endpoint}/v1/blobs/{sha256_hash}",
                headers=headers
            ) as response:
                response.raise_for_status()
                return await response.read()

    async def delete_blob(self, uri: str) -> bool:
        """Delete blob from live Cascade service."""
        sha256_hash = uri.replace("cascade://sha256:", "")

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{self.endpoint}/v1/blobs/{sha256_hash}",
                headers=headers
            ) as response:
                return response.status == 204

    async def blob_exists(self, uri: str) -> bool:
        """Check if blob exists on live Cascade service."""
        sha256_hash = uri.replace("cascade://sha256:", "")

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with aiohttp.ClientSession() as session:
            async with session.head(
                f"{self.endpoint}/v1/blobs/{sha256_hash}",
                headers=headers
            ) as response:
                return response.status == 200
```

### 4. Storage Factory

```python
def get_cascade_client(mode: str = "mock") -> CascadeInterface:
    """
    Factory for Cascade clients.

    Args:
        mode: "mock" for local filesystem, "live" for production service

    Returns:
        CascadeInterface implementation
    """
    if mode == "mock":
        return MockCascadeFS()
    elif mode == "live":
        return LiveCascadeClient()
    else:
        raise ValueError(f"Unknown mode: {mode}. Use 'mock' or 'live'.")
```

### 5. Local Index (FTS5)

```python
import sqlite3
from datetime import datetime

class MemoryIndex:
    """SQLite FTS5-based memory index."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            db_path = Path.home() / ".lumera" / "index.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Initialize database schema with FTS5."""
        conn = sqlite3.connect(self.db_path)

        # Main memories table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                cascade_uri TEXT NOT NULL,
                memory_card TEXT,
                tags TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        # FTS5 virtual table for full-text search
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                session_id,
                title,
                content,
                keywords,
                tokenize='porter unicode61'
            )
        """)

        # Indexes for common queries
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_cascade_uri
            ON memories(cascade_uri)
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_created_at
            ON memories(created_at)
        """)

        conn.commit()
        conn.close()

    def store_memory(
        self,
        session_id: str,
        cascade_uri: str,
        memory_card: dict,
        tags: list[str] = None,
        metadata: dict = None
    ) -> bool:
        """Store memory metadata in index."""
        conn = sqlite3.connect(self.db_path)
        now = datetime.utcnow().isoformat()

        try:
            # Insert into main table
            conn.execute("""
                INSERT OR REPLACE INTO memories
                (session_id, cascade_uri, memory_card, tags, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id,
                cascade_uri,
                json.dumps(memory_card),
                json.dumps(tags or []),
                json.dumps(metadata or {}),
                now,
                now
            ))

            # Insert into FTS table
            title = memory_card.get("title", "")
            content = " ".join(memory_card.get("summary_bullets", []))
            keywords = " ".join(memory_card.get("keywords", []))

            conn.execute("""
                INSERT OR REPLACE INTO memories_fts
                (rowid, session_id, title, content, keywords)
                VALUES (
                    (SELECT id FROM memories WHERE session_id = ?),
                    ?, ?, ?, ?
                )
            """, (session_id, session_id, title, content, keywords))

            conn.commit()
            return True

        finally:
            conn.close()

    def search(
        self,
        query: str,
        tags: Optional[list[str]] = None,
        time_range: Optional[dict] = None,
        limit: int = 10
    ) -> list[dict]:
        """
        Search memories using FTS5.

        IMPORTANT: Never queries Cascade directly.
        Returns Cascade URIs for subsequent retrieval.
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row

        sql_parts = ["""
            SELECT
                m.session_id,
                m.cascade_uri,
                m.memory_card,
                m.tags,
                m.created_at,
                fts.rank as score
            FROM memories m
            JOIN memories_fts fts ON m.id = fts.rowid
            WHERE memories_fts MATCH ?
        """]

        params = [query]

        # Add filters
        if tags:
            sql_parts.append("AND (" + " OR ".join(["m.tags LIKE ?" for _ in tags]) + ")")
            params.extend([f'%"{tag}"%' for tag in tags])

        if time_range:
            if time_range.get("start"):
                sql_parts.append("AND m.created_at >= ?")
                params.append(time_range["start"])
            if time_range.get("end"):
                sql_parts.append("AND m.created_at <= ?")
                params.append(time_range["end"])

        sql_parts.append("ORDER BY fts.rank LIMIT ?")
        params.append(limit)

        cursor = conn.execute(" ".join(sql_parts), params)
        rows = cursor.fetchall()
        conn.close()

        return [self._format_hit(row) for row in rows]

    def get_by_cascade_uri(self, cascade_uri: str) -> Optional[dict]:
        """Get memory entry by Cascade URI."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row

        cursor = conn.execute(
            "SELECT * FROM memories WHERE cascade_uri = ?",
            (cascade_uri,)
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return {
            "session_id": row["session_id"],
            "cascade_uri": row["cascade_uri"],
            "memory_card": json.loads(row["memory_card"]),
            "tags": json.loads(row["tags"]),
            "metadata": json.loads(row["metadata"]),
            "created_at": row["created_at"]
        }

    def _format_hit(self, row) -> dict:
        """Format search result row."""
        memory_card = json.loads(row["memory_card"])
        return {
            "session_id": row["session_id"],
            "cascade_uri": row["cascade_uri"],
            "title": memory_card.get("title", ""),
            "snippet": memory_card.get("summary_bullets", [""])[0][:100],
            "tags": json.loads(row["tags"]),
            "created_at": row["created_at"],
            "score": abs(row["score"])
        }
```

## Common Patterns

### Complete Store Workflow

```python
async def store_session_complete(
    session_id: str,
    session_data: dict,
    cascade: CascadeInterface,
    index: MemoryIndex,
    tags: list[str] = None
) -> dict:
    """Complete storage workflow with all layers."""

    # 1. Redact sensitive data
    redacted_data, redaction_report = redact_session(session_data)

    # 2. Generate memory card
    memory_card = generate_memory_card(redacted_data)

    # 3. Encrypt
    crypto_result = encrypt_with_metadata(json.dumps(redacted_data))

    # 4. Upload to Cascade
    cascade_uri = await cascade.upload_blob(
        crypto_result.ciphertext,
        content_type="application/octet-stream"
    )

    # 5. Index locally
    index.store_memory(
        session_id=session_id,
        cascade_uri=cascade_uri,
        memory_card=memory_card.to_dict(),
        tags=tags,
        metadata={
            "crypto": crypto_result.to_dict(),
            "redaction": redaction_report.to_dict()
        }
    )

    return {
        "cascade_uri": cascade_uri,
        "memory_card": memory_card.to_dict(),
        "redaction": redaction_report.to_dict(),
        "crypto": crypto_result.to_dict()
    }
```

### Retrieve with Verification

```python
async def retrieve_session_verified(
    cascade_uri: str,
    cascade: CascadeInterface,
    index: MemoryIndex
) -> dict:
    """Retrieve session with full integrity verification."""

    # 1. Get index entry (contains crypto metadata)
    index_entry = index.get_by_cascade_uri(cascade_uri)
    if not index_entry:
        raise ValueError(f"URI not found in index: {cascade_uri}")

    # 2. Download encrypted blob
    encrypted_blob = await cascade.download_blob(cascade_uri)

    # 3. Verify ciphertext integrity
    expected_hash = index_entry["metadata"]["crypto"]["ciphertext_sha256"]

    # 4. Decrypt (verifies internally)
    session_json = decrypt_session(
        encrypted_blob,
        expected_ciphertext_sha256=expected_hash
    )

    # 5. Parse and return
    session_data = json.loads(session_json)

    return {
        "session": session_data,
        "memory_card": index_entry["memory_card"],
        "verified": True,
        "crypto": index_entry["metadata"]["crypto"]
    }
```

### Bulk Migration

```python
async def migrate_to_cascade(
    source_sessions: list[dict],
    cascade: CascadeInterface,
    index: MemoryIndex,
    batch_size: int = 10
) -> dict:
    """Migrate sessions to Cascade storage in batches."""

    results = {"success": 0, "failed": 0, "errors": []}

    for i in range(0, len(source_sessions), batch_size):
        batch = source_sessions[i:i + batch_size]

        for session in batch:
            try:
                await store_session_complete(
                    session_id=session["session_id"],
                    session_data=session,
                    cascade=cascade,
                    index=index
                )
                results["success"] += 1
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "session_id": session.get("session_id"),
                    "error": str(e)
                })

    return results
```

### Storage Cost Estimation

```python
def estimate_cascade_cost(
    bytes_size: int,
    redundancy: int = 3,
    reads_per_month: int = 100
) -> dict:
    """Estimate Cascade storage costs."""

    # Default pricing (approximate)
    storage_per_gb_month = 0.02
    request_per_1k = 0.0004

    gb = bytes_size / (1024 ** 3)
    replicated_gb = gb * redundancy

    monthly_storage = replicated_gb * storage_per_gb_month
    request_cost = (reads_per_month / 1000) * request_per_1k

    return {
        "bytes": bytes_size,
        "gb": round(gb, 6),
        "replicated_gb": round(replicated_gb, 6),
        "monthly_storage_usd": round(monthly_storage, 4),
        "monthly_request_usd": round(request_cost, 4),
        "total_monthly_usd": round(monthly_storage + request_cost, 4)
    }
```

## Storage Layout

```
~/.lumera/
├── cascade/                    # Content-addressed blob storage
│   ├── a3/                    # Sharded by first 2 chars
│   │   ├── a3f2c8d9e1...     # Encrypted blob
│   │   └── a3f2c8d9e1....meta # Optional metadata
│   ├── b7/
│   │   └── b7d9e1f3a2...
│   └── ...
│
└── index.db                   # SQLite FTS5 index
    ├── memories              # Main table
    └── memories_fts          # Full-text search virtual table
```

## Related Resources

- `cookbook/encryption.md` - Encryption before storage
- `cookbook/memory-cards.md` - Card generation for indexing
- `tools/lumera_client.py` - Complete client implementation
