# Lumera Memory Quickstart

Basic store, query, and retrieve operations for durable agent memory.

## Purpose

Get started with Lumera Agent Memory in under 5 minutes. This cookbook covers the fundamental operations: storing a session, querying memories, and retrieving encrypted content.

## Variables

```yaml
DEFAULT_MODE: mock
INDEX_DB_PATH: ~/.lumera/index.db
CASCADE_STORAGE: ~/.lumera/cascade/
DEFAULT_REDUNDANCY: 3
FTS_TOKENIZER: porter unicode61
```

## Prerequisites

```bash
# Install dependencies
pip install cryptography mcp

# Verify installation
python3 -c "from cryptography.hazmat.primitives.ciphers.aead import AESGCM; print('OK')"
```

## Instructions

### 1. Store a Session

Store session data with automatic redaction, encryption, and indexing.

```python
from lumera_client import LumeraClient

client = LumeraClient()

# Store a session (automatic pipeline: redact -> encrypt -> upload -> index)
result = await client.store_session(
    session_id="sess_2025_01_15_001",
    content={
        "session_id": "sess_2025_01_15_001",
        "messages": [
            {"role": "user", "content": "Deploy the API to production"},
            {"role": "assistant", "content": "I'll deploy to us-east-1. What environment?"},
            {"role": "user", "content": "Production cluster, notify team@example.com"}
        ],
        "metadata": {
            "started_at": "2025-01-15T10:30:00Z",
            "ended_at": "2025-01-15T10:45:00Z"
        }
    },
    tags=["deployment", "production", "api"]
)

print(f"Stored at: {result['cascade_uri']}")
print(f"Redactions: {result['redaction']['rules_fired']}")
print(f"Memory card title: {result['memory_card']['title']}")
```

**Expected output:**
```json
{
  "ok": true,
  "session_id": "sess_2025_01_15_001",
  "cascade_uri": "cascade://sha256:a3f2c8...",
  "indexed": true,
  "redaction": {
    "rules_fired": [
      {"rule": "email", "count": 1}
    ]
  },
  "memory_card": {
    "title": "Deploy the API to production",
    "keywords": ["deploy", "production", "cluster"]
  }
}
```

### 2. Query Memories

Search the local FTS index. Queries never touch Cascade directly.

```python
# Full-text search
hits = await client.query_memories(
    query="deployment production",
    limit=5
)

for hit in hits["hits"]:
    print(f"[{hit['score']:.2f}] {hit['title']}")
    print(f"  URI: {hit['cascade_uri']}")
    print(f"  Tags: {', '.join(hit['tags'])}")
```

**Search patterns:**

```python
# Exact phrase
await client.query_memories(query='"deploy API"')

# Boolean operators (FTS5 syntax)
await client.query_memories(query="deploy AND production")

# Prefix matching
await client.query_memories(query="prod*")

# With tag filter
await client.query_memories(
    query="deployment",
    tags=["production"]
)

# With time range
await client.query_memories(
    query="api",
    time_range={
        "start": "2025-01-01T00:00:00Z",
        "end": "2025-01-31T23:59:59Z"
    }
)
```

### 3. Retrieve a Session

Fetch and decrypt session content using the Cascade URI.

```python
# Retrieve full session
session = await client.retrieve_session(
    cascade_uri="cascade://sha256:a3f2c8..."
)

print(f"Verified: {session['crypto']['verified']}")
print(f"Messages: {len(session['session']['messages'])}")

# Access session content
for msg in session["session"]["messages"]:
    print(f"[{msg['role']}] {msg['content']}")
```

**Note:** Retrieved content will contain `[REDACTED:EMAIL]` tokens where PII was removed.

### 4. Estimate Storage Cost

Calculate Cascade storage costs before committing.

```python
import json

session_data = {"messages": [...]}
data_bytes = len(json.dumps(session_data).encode('utf-8'))

estimate = await client.estimate_cost(
    bytes=data_bytes,
    redundancy=3
)

print(f"Monthly cost: ${estimate['total_estimated_usd']:.4f}")
print(f"Storage: {estimate['gb']:.6f} GB")
```

## Common Patterns

### Store and Immediately Verify

```python
# Store
store_result = await client.store_session(
    session_id="sess_verify_001",
    content=session_data
)

# Verify by retrieving
retrieved = await client.retrieve_session(
    cascade_uri=store_result["cascade_uri"]
)

assert retrieved["crypto"]["verified"] is True
assert retrieved["crypto"]["ciphertext_sha256"] == store_result["crypto"]["ciphertext_sha256"]
```

### Batch Session Storage

```python
session_ids = ["sess_001", "sess_002", "sess_003"]
results = []

for sid in session_ids:
    session_content = load_session(sid)  # Your data source
    result = await client.store_session(
        session_id=sid,
        content=session_content,
        tags=["batch_2025_01_15"]
    )
    results.append(result)

print(f"Stored {len(results)} sessions")
```

### Search and Retrieve Workflow

```python
# 1. Search for relevant sessions
hits = await client.query_memories(
    query="authentication implementation",
    limit=3
)

# 2. Retrieve the top match
if hits["hits"]:
    top_hit = hits["hits"][0]
    full_session = await client.retrieve_session(
        cascade_uri=top_hit["cascade_uri"]
    )

    # 3. Use session content
    for msg in full_session["session"]["messages"]:
        if msg["role"] == "assistant":
            print(f"Previous solution: {msg['content'][:200]}...")
```

### Error Handling

```python
try:
    result = await client.store_session(
        session_id="sess_with_secrets",
        content={
            "messages": [{
                "role": "user",
                "content": "Use aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            }]
        }
    )
except ValueError as e:
    if "CRITICAL" in str(e):
        # Fail-closed: session contains blocked patterns
        print(f"Storage rejected: {e}")
        # Handle by removing sensitive data from source
```

## MCP Tool Reference

| Tool | Purpose | Key Args |
|------|---------|----------|
| `store_session_to_cascade` | Full storage pipeline | `session_id`, `tags`, `metadata`, `mode` |
| `query_memories` | Search local FTS index | `query`, `tags`, `time_range`, `limit` |
| `retrieve_session_from_cascade` | Fetch and decrypt | `cascade_uri`, `mode` |
| `estimate_storage_cost` | Cost calculation | `bytes`, `redundancy` |

## Storage Layout

```
~/.lumera/
├── cascade/           # Content-addressed encrypted blobs
│   ├── a3/           # Sharded by first 2 chars of hash
│   │   └── a3f2c8... # Encrypted session data
│   └── b7/
│       └── b7d9e1...
└── index.db          # SQLite FTS5 index
```

## Next Steps

- **Security deep-dive:** See `cookbook/encryption.md` for AES-256-GCM details
- **PII handling:** See `cookbook/pii-redaction.md` for pattern configuration
- **Memory cards:** See `cookbook/memory-cards.md` for card generation
- **Cascade storage:** See `cookbook/cascade-storage.md` for content-addressed patterns
