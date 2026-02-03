#!/usr/bin/env python3
"""
Lumera Agent Memory - Python Client

A complete client for the Lumera Agent Memory MCP server.
Provides store, query, retrieve, and cost estimation operations.
"""

import asyncio
import hashlib
import json
import os
import re
import sqlite3
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Tuple
from collections import Counter

# Encryption imports
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    print("Warning: cryptography not installed. Encryption disabled.")


# ==============================================================================
# Data Classes
# ==============================================================================

@dataclass
class CryptoResult:
    """Encryption result with metadata."""
    ciphertext: bytes
    algorithm: str
    key_id: str
    plaintext_sha256: str
    ciphertext_sha256: str

    def to_dict(self) -> dict:
        return {
            "algorithm": self.algorithm,
            "key_id": self.key_id,
            "plaintext_sha256": self.plaintext_sha256,
            "ciphertext_sha256": self.ciphertext_sha256,
            "bytes": len(self.ciphertext)
        }


@dataclass
class RedactionRule:
    """A single redaction rule."""
    rule_name: str
    pattern: re.Pattern
    critical: bool
    count: int = 0


@dataclass
class RedactionReport:
    """Report of redactions performed."""
    rules_fired: list = field(default_factory=list)
    critical_detected: bool = False

    def to_dict(self) -> dict:
        return {
            "rules_fired": [
                {"rule": r.rule_name, "count": r.count, "critical": r.critical}
                for r in self.rules_fired
            ],
            "critical_detected": self.critical_detected
        }


@dataclass
class MemoryCard:
    """Deterministic session summary card."""
    title: str
    summary_bullets: list = field(default_factory=list)
    decisions: list = field(default_factory=list)
    todos: list = field(default_factory=list)
    entities: list = field(default_factory=list)
    keywords: list = field(default_factory=list)
    notable_quotes: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "summary_bullets": self.summary_bullets,
            "decisions": self.decisions,
            "todos": self.todos,
            "entities": list(self.entities),
            "keywords": self.keywords,
            "notable_quotes": self.notable_quotes
        }


# ==============================================================================
# Redaction Module
# ==============================================================================

# Critical patterns: MUST fail-closed
CRITICAL_PATTERNS = [
    RedactionRule(
        "aws_secret_key",
        re.compile(r'aws_secret_access_key["\s:=\\]+([A-Za-z0-9/+=]{40})', re.IGNORECASE),
        critical=True
    ),
    RedactionRule(
        "private_key",
        re.compile(r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----', re.IGNORECASE),
        critical=True
    ),
    RedactionRule(
        "auth_header_raw",
        re.compile(r'Authorization:\s*(Bearer|Basic)\s+[A-Za-z0-9+/=._-]{20,}', re.IGNORECASE),
        critical=True
    ),
    RedactionRule(
        "database_password",
        re.compile(r'(password|passwd|pwd)["\s:=]+(["\'][^"\']{8,}["\']|[A-Za-z0-9!@#$%^&*]{8,})\s*(;|,|$)', re.IGNORECASE),
        critical=True
    ),
]

# Non-critical patterns: redact and continue
NON_CRITICAL_PATTERNS = [
    RedactionRule(
        "aws_access_key",
        re.compile(r'\b(AKIA[0-9A-Z]{16})\b'),
        critical=False
    ),
    RedactionRule(
        "email",
        re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
        critical=False
    ),
    RedactionRule(
        "phone",
        re.compile(r'\b\d{3}[-.]?\d{4}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'),
        critical=False
    ),
    RedactionRule(
        "ipv4",
        re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),
        critical=False
    ),
    RedactionRule(
        "api_token_generic",
        re.compile(r'\b[A-Za-z0-9_-]{32,}\b'),
        critical=False
    ),
]


def redact_session(session_data: dict) -> Tuple[dict, RedactionReport]:
    """
    Redact PII and secrets from session data.

    - Critical patterns: Fail immediately
    - Non-critical patterns: Redact and continue

    Returns: (redacted_data, report)
    """
    session_json = json.dumps(session_data, indent=2)
    report = RedactionReport()
    redacted_json = session_json

    all_rules = CRITICAL_PATTERNS + NON_CRITICAL_PATTERNS

    for rule in all_rules:
        matches = list(rule.pattern.finditer(redacted_json))

        if matches:
            rule.count = len(matches)
            report.rules_fired.append(rule)

            if rule.critical:
                report.critical_detected = True
                raise ValueError(
                    f"CRITICAL: Detected {rule.rule_name} pattern in session. "
                    f"Found {len(matches)} occurrence(s). "
                    f"Remove sensitive data before storing."
                )
            else:
                redacted_json = rule.pattern.sub(
                    f"[REDACTED:{rule.rule_name.upper()}]",
                    redacted_json
                )

    redacted_data = json.loads(redacted_json)
    return redacted_data, report


# ==============================================================================
# Encryption Module
# ==============================================================================

_KEY_STORE = {}


def _get_or_create_key(key_id: str = "default") -> bytes:
    """Get or create encryption key."""
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package not installed")

    if key_id not in _KEY_STORE:
        _KEY_STORE[key_id] = AESGCM.generate_key(bit_length=256)
    return _KEY_STORE[key_id]


def encrypt_data(plaintext: str, key_id: str = "default") -> CryptoResult:
    """Encrypt data using AES-256-GCM."""
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package not installed")

    key = _get_or_create_key(key_id)
    aesgcm = AESGCM(key)

    nonce = os.urandom(12)
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext_without_nonce = aesgcm.encrypt(nonce, plaintext_bytes, None)
    ciphertext = nonce + ciphertext_without_nonce

    return CryptoResult(
        ciphertext=ciphertext,
        algorithm="AES-256-GCM",
        key_id=key_id,
        plaintext_sha256=hashlib.sha256(plaintext_bytes).hexdigest(),
        ciphertext_sha256=hashlib.sha256(ciphertext).hexdigest()
    )


def decrypt_data(
    ciphertext: bytes,
    key_id: str = "default",
    expected_ciphertext_sha256: str = None
) -> str:
    """Decrypt AES-256-GCM encrypted data."""
    if not HAS_CRYPTO:
        raise RuntimeError("cryptography package not installed")

    if expected_ciphertext_sha256:
        actual_sha256 = hashlib.sha256(ciphertext).hexdigest()
        if actual_sha256 != expected_ciphertext_sha256:
            raise ValueError(
                f"Ciphertext integrity check failed. "
                f"Expected: {expected_ciphertext_sha256}, Got: {actual_sha256}"
            )

    key = _get_or_create_key(key_id)
    aesgcm = AESGCM(key)

    nonce = ciphertext[:12]
    ciphertext_only = ciphertext[12:]

    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext_only, None)
    return plaintext_bytes.decode('utf-8')


# ==============================================================================
# Memory Card Generation
# ==============================================================================

DECISION_KEYWORDS = ["decided", "decision", "will use", "chosen", "selected", "going with"]
TODO_KEYWORDS = ["todo", "need to", "should", "must", "will need", "remember to"]
STOP_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "have", "been", "would",
    "could", "should", "will", "with", "this", "that", "from", "they",
    "which", "their", "what", "there", "about", "when", "make", "like"
}


def generate_memory_card(session_data: dict) -> MemoryCard:
    """Generate deterministic memory card from session data."""
    messages = session_data.get("messages", [])

    text_parts = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            text_parts.append(content)
    full_text = " ".join(text_parts)

    # Title
    title = "Untitled Session"
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str) and len(content) > 0:
                title = content[:80] + ("..." if len(content) > 80 else "")
                break

    # Summary bullets
    summary_bullets = []
    for msg in messages[:3]:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if isinstance(content, str):
            snippet = content[:100] + ("..." if len(content) > 100 else "")
            summary_bullets.append(f"[{role}] {snippet}")

    # Decisions
    decisions = []
    for msg in messages:
        content = str(msg.get("content", "")).lower()
        if any(kw in content for kw in DECISION_KEYWORDS):
            decisions.append(str(msg.get("content", ""))[:100])
            if len(decisions) >= 3:
                break

    # TODOs
    todos = []
    for msg in messages:
        content = str(msg.get("content", "")).lower()
        if any(kw in content for kw in TODO_KEYWORDS):
            todos.append(str(msg.get("content", ""))[:100])
            if len(todos) >= 3:
                break

    # Entities
    entities = set()
    for word in full_text.split():
        if word and word[0].isupper() and len(word) > 2:
            if word not in {"The", "This", "That", "It", "We", "You", "They", "I"}:
                entities.add(word)

    # Keywords
    words = full_text.lower().split()
    word_freq = {}
    for word in words:
        word = re.sub(r'[^\w]', '', word)
        if len(word) > 4 and word not in STOP_WORDS:
            word_freq[word] = word_freq.get(word, 0) + 1
    keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
    keywords = [w[0] for w in keywords]

    # Notable quotes
    notable_quotes = []
    for msg in messages:
        content = str(msg.get("content", ""))
        if "?" in content or "!" in content:
            notable_quotes.append(content[:100])
            if len(notable_quotes) >= 3:
                break

    return MemoryCard(
        title=title,
        summary_bullets=summary_bullets,
        decisions=decisions,
        todos=todos,
        entities=list(entities)[:10],
        keywords=keywords,
        notable_quotes=notable_quotes
    )


# ==============================================================================
# Cascade Interface
# ==============================================================================

class CascadeInterface(ABC):
    """Abstract interface for Cascade storage operations."""

    @abstractmethod
    async def upload_blob(
        self,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None
    ) -> str:
        """Upload a blob to Cascade. Returns URI."""
        pass

    @abstractmethod
    async def download_blob(self, uri: str) -> bytes:
        """Download a blob from Cascade by URI."""
        pass

    @abstractmethod
    async def delete_blob(self, uri: str) -> bool:
        """Delete a blob from Cascade."""
        pass


class MockCascadeFS(CascadeInterface):
    """Filesystem-backed mock Cascade with content-addressed storage."""

    def __init__(self, storage_dir: Optional[str] = None):
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
        sha256_hash = hashlib.sha256(data).hexdigest()
        uri = f"cascade://sha256:{sha256_hash}"

        subdir = self.storage_dir / sha256_hash[:2]
        subdir.mkdir(exist_ok=True)

        blob_path = subdir / sha256_hash

        if not blob_path.exists():
            blob_path.write_bytes(data)

        if metadata:
            meta_path = subdir / f"{sha256_hash}.meta"
            meta_path.write_text(json.dumps(metadata))

        return uri

    async def download_blob(self, uri: str) -> bytes:
        """Download blob by content-addressed URI."""
        if not uri.startswith("cascade://sha256:"):
            raise ValueError(f"Invalid Cascade URI format: {uri}")

        sha256_hash = uri.replace("cascade://sha256:", "")
        subdir = self.storage_dir / sha256_hash[:2]
        blob_path = subdir / sha256_hash

        if not blob_path.exists():
            raise FileNotFoundError(f"Blob not found: {uri}")

        return blob_path.read_bytes()

    async def delete_blob(self, uri: str) -> bool:
        """Delete blob by URI."""
        if not uri.startswith("cascade://sha256:"):
            raise ValueError(f"Invalid Cascade URI format: {uri}")

        sha256_hash = uri.replace("cascade://sha256:", "")
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


# ==============================================================================
# Memory Index
# ==============================================================================

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
        conn.row_factory = sqlite3.Row

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

        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                session_id,
                title,
                content,
                keywords,
                tokenize='porter unicode61'
            )
        """)

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
        tags: list = None,
        metadata: dict = None
    ) -> bool:
        """Store memory in index."""
        conn = sqlite3.connect(self.db_path)
        now = datetime.utcnow().isoformat()

        try:
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

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def search(
        self,
        query: str,
        tags: Optional[list] = None,
        time_range: Optional[dict] = None,
        limit: int = 10
    ) -> list:
        """Search memories using FTS5."""
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

        hits = []
        for row in rows:
            memory_card = json.loads(row["memory_card"])
            tags_list = json.loads(row["tags"])

            snippet = memory_card.get("title", "")
            if memory_card.get("summary_bullets"):
                snippet += " - " + memory_card["summary_bullets"][0][:100]

            hits.append({
                "session_id": row["session_id"],
                "cascade_uri": row["cascade_uri"],
                "title": memory_card.get("title", ""),
                "snippet": snippet,
                "tags": tags_list,
                "created_at": row["created_at"],
                "score": abs(row["score"])
            })

        return hits

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
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }


# ==============================================================================
# Lumera Client
# ==============================================================================

class LumeraClient:
    """High-level client for Lumera Agent Memory."""

    def __init__(
        self,
        mode: str = "mock",
        cascade_dir: Optional[str] = None,
        index_path: Optional[str] = None
    ):
        """
        Initialize Lumera client.

        Args:
            mode: "mock" for local filesystem, "live" for production
            cascade_dir: Override Cascade storage directory
            index_path: Override SQLite index path
        """
        self.mode = mode

        if mode == "mock":
            self.cascade = MockCascadeFS(cascade_dir)
        else:
            raise NotImplementedError("Live Cascade mode requires configuration")

        self.index = MemoryIndex(index_path)

    async def store_session(
        self,
        session_id: str,
        content: dict,
        tags: list = None,
        metadata: dict = None
    ) -> dict:
        """
        Store a session with full security pipeline.

        Pipeline: Redact -> Encrypt -> Upload -> Index
        """
        # Step 1: Redact
        redacted_data, redaction_report = redact_session(content)

        # Step 2: Generate memory card
        memory_card = generate_memory_card(redacted_data)

        # Step 3: Encrypt
        crypto_result = encrypt_data(json.dumps(redacted_data))

        # Step 4: Upload to Cascade
        cascade_uri = await self.cascade.upload_blob(
            crypto_result.ciphertext,
            content_type="application/octet-stream"
        )

        # Step 5: Index
        indexed = self.index.store_memory(
            session_id=session_id,
            cascade_uri=cascade_uri,
            memory_card=memory_card.to_dict(),
            tags=tags,
            metadata={
                **(metadata or {}),
                "crypto": crypto_result.to_dict(),
                "redaction": redaction_report.to_dict()
            }
        )

        return {
            "ok": True,
            "session_id": session_id,
            "cascade_uri": cascade_uri,
            "indexed": indexed,
            "redaction": {
                "rules_fired": [
                    {"rule": r.rule_name, "count": r.count}
                    for r in redaction_report.rules_fired
                ]
            },
            "crypto": crypto_result.to_dict(),
            "memory_card": memory_card.to_dict()
        }

    async def query_memories(
        self,
        query: str,
        tags: list = None,
        time_range: dict = None,
        limit: int = 10
    ) -> dict:
        """Search local FTS index (NEVER queries Cascade)."""
        hits = self.index.search(
            query=query,
            tags=tags,
            time_range=time_range,
            limit=limit
        )

        return {
            "ok": True,
            "hits": [
                {
                    "cass_session_id": hit["session_id"],
                    "cascade_uri": hit["cascade_uri"],
                    "title": hit.get("title", ""),
                    "snippet": hit.get("snippet", ""),
                    "tags": hit.get("tags", []),
                    "created_at": hit["created_at"],
                    "score": hit.get("score", 0.0)
                }
                for hit in hits
            ]
        }

    async def retrieve_session(self, cascade_uri: str) -> dict:
        """Fetch and decrypt session from Cascade."""
        # Get index entry
        index_entry = self.index.get_by_cascade_uri(cascade_uri)
        if not index_entry:
            return {"ok": False, "error": "URI not found in local index"}

        # Download encrypted blob
        encrypted_blob = await self.cascade.download_blob(cascade_uri)

        # Get expected hash
        expected_sha256 = index_entry["metadata"]["crypto"]["ciphertext_sha256"]

        # Decrypt
        session_json = decrypt_data(
            encrypted_blob,
            expected_ciphertext_sha256=expected_sha256
        )
        session_data = json.loads(session_json)

        return {
            "ok": True,
            "cascade_uri": cascade_uri,
            "session": session_data,
            "memory_card": index_entry.get("memory_card"),
            "crypto": {
                "verified": True,
                "plaintext_sha256": index_entry["metadata"]["crypto"]["plaintext_sha256"],
                "ciphertext_sha256": expected_sha256,
                "key_id": index_entry["metadata"]["crypto"]["key_id"]
            }
        }

    async def estimate_cost(
        self,
        bytes: int,
        redundancy: int = 3,
        pricing: dict = None
    ) -> dict:
        """Estimate Cascade storage costs."""
        pricing = pricing or {}
        storage_per_gb_month = pricing.get("storage_per_gb_month", 0.02)
        request_per_1k = pricing.get("request_per_1k", 0.0004)

        gb = bytes / (1024 ** 3)
        replicated_gb = gb * redundancy

        monthly_storage = replicated_gb * storage_per_gb_month
        estimated_requests = (100 / 1000) * request_per_1k

        return {
            "ok": True,
            "bytes": bytes,
            "gb": round(gb, 6),
            "monthly_storage_usd": round(monthly_storage, 4),
            "estimated_request_usd": round(estimated_requests, 4),
            "total_estimated_usd": round(monthly_storage + estimated_requests, 4),
            "assumptions": {
                "redundancy": redundancy,
                "storage_per_gb_month_usd": storage_per_gb_month,
                "request_per_1k_usd": request_per_1k,
                "estimated_reads_per_month": 100
            }
        }


# ==============================================================================
# CLI Interface
# ==============================================================================

async def main():
    """CLI example usage."""
    import argparse

    parser = argparse.ArgumentParser(description="Lumera Agent Memory Client")
    parser.add_argument("command", choices=["store", "query", "retrieve", "cost"])
    parser.add_argument("--session-id", help="Session ID for store/retrieve")
    parser.add_argument("--query", help="Search query")
    parser.add_argument("--uri", help="Cascade URI for retrieve")
    parser.add_argument("--bytes", type=int, help="Bytes for cost estimate")
    parser.add_argument("--limit", type=int, default=10, help="Query limit")

    args = parser.parse_args()

    client = LumeraClient()

    if args.command == "store":
        # Example session data
        session = {
            "session_id": args.session_id or "test_session",
            "messages": [
                {"role": "user", "content": "Test message from CLI"},
                {"role": "assistant", "content": "This is a test response."}
            ]
        }
        result = await client.store_session(
            session_id=session["session_id"],
            content=session
        )
        print(json.dumps(result, indent=2))

    elif args.command == "query":
        if not args.query:
            print("Error: --query required for search")
            return
        result = await client.query_memories(query=args.query, limit=args.limit)
        print(json.dumps(result, indent=2))

    elif args.command == "retrieve":
        if not args.uri:
            print("Error: --uri required for retrieve")
            return
        result = await client.retrieve_session(cascade_uri=args.uri)
        print(json.dumps(result, indent=2, default=str))

    elif args.command == "cost":
        bytes_size = args.bytes or 1024 * 1024  # Default 1MB
        result = await client.estimate_cost(bytes=bytes_size)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
