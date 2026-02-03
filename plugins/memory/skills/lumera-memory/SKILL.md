---
name: lumera-memory
description: This skill should be used when the user asks about "lumera memory", "blockchain memory", "encrypted memory", "permanent storage", "memory cards", "PII redaction", "AES-256 encryption", or needs durable, encrypted, permanent agent memory storage.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash
---

# Lumera Agent Memory Skill

Provides expertise on lumera-agent-memory - an MCP server implementing durable agent memory with blockchain storage, client-side encryption, and permanent archival.

## Overview

Lumera Agent Memory implements a three-layer architecture:

| Layer | Purpose | Technology |
|-------|---------|------------|
| **Object Storage** | Permanent data storage | Cascade blockchain (Lumera Protocol) |
| **Encryption** | Client-side security | AES-256-GCM |
| **Local Index** | Fast search | SQLite FTS5 |

## Architecture

```
CASS Session → Redact PII/Secrets → Encrypt Client-Side
                                           ↓
                                    Upload to Cascade
                                           ↓
                                      Cascade URI
                                           ↓
                          Store in Local SQLite FTS Index
                                           ↓
           Query Index → Retrieve via URI → Decrypt
```

**Key principle**: Object storage + metadata indexing pattern separates data from searchability.

## Security Implementation

### Critical Patterns (Rejected)

The system blocks storage containing:
- Private keys (PEM format)
- AWS secret access keys
- Raw authorization headers
- Database connection passwords

```python
CRITICAL_PATTERNS = [
    r"-----BEGIN.*PRIVATE KEY-----",
    r"aws_secret_access_key\s*=",
    r"Authorization:\s*Bearer",
    r"password\s*[:=]\s*['\"]"
]
```

### Non-Critical Patterns (Redacted)

Masked with `[REDACTED:PATTERN_NAME]`:
- Email addresses
- Phone numbers
- AWS access keys (AKIA prefix)
- IPv4 addresses
- Generic API tokens

## MCP Tools (4 Required)

### 1. store_session_to_cascade

```python
# Store a session with full security pipeline
result = await store_session_to_cascade(
    session_id="sess_123",
    content="Session data...",
    encryption_key=user_key
)

# Returns:
# - cascade_uri: Content-addressed storage location
# - redaction_summary: What was redacted
# - encryption_verification: Checksum
# - memory_card: Auto-generated summary
```

### 2. query_memories

```python
# Search local FTS index (never queries Cascade directly)
results = await query_memories(
    query="authentication implementation",
    limit=10
)

# Returns:
# - matching sessions with relevance scores
# - snippets for preview
# - cascade_uri for retrieval
```

### 3. retrieve_session_from_cascade

```python
# Fetch and decrypt
session = await retrieve_session_from_cascade(
    cascade_uri="cascade://abc123...",
    decryption_key=user_key
)

# Returns:
# - Complete session data
# - Verification checksums
```

### 4. estimate_storage_cost

```python
# Calculate Cascade storage costs
estimate = await estimate_storage_cost(
    data_size_bytes=1024 * 1024,  # 1MB
    redundancy_factor=3
)
```

## Memory Card Pattern

Each stored session generates a deterministic "memory card":

```yaml
title: "First user message (80 chars)"
summary:
  - "[user] First message..."
  - "[assistant] Response..."
  - "[user] Follow-up..."
decisions:
  - Messages flagged by decision keywords
todos:
  - Action items detected
entities:
  - Capitalized proper nouns
keywords:
  - Top 10 frequent words (5+ chars)
quotes:
  - Messages with ? or !
```

**Benefit**: Intelligent search results without LLM calls or network overhead.

## Storage Infrastructure

```
~/.lumera/
├── cascade/           # Content-addressed blobs (mock for local)
│   └── abc123...     # Encrypted session data
└── index.db          # SQLite FTS index
```

## Integration with Claude Code

### PostToolUse Hook for Capture

```python
# Capture significant tool operations
def post_tool_hook(tool_name, tool_input, tool_response):
    if should_archive(tool_name, tool_response):
        store_session_to_cascade(
            session_id=current_session,
            content=format_observation(tool_name, tool_input, tool_response)
        )
```

### SessionEnd Hook for Archival

```python
# Archive complete sessions
def session_end_hook(session_id, transcript_path):
    session_content = load_transcript(transcript_path)
    store_session_to_cascade(
        session_id=session_id,
        content=session_content,
        metadata={"type": "complete_session"}
    )
```

## When to Use Lumera Memory

**Best for:**
- Permanent archival requirements
- Security-sensitive applications
- Compliance/audit trail needs
- Long-term knowledge preservation

**Consider alternatives for:**
- Fast prototyping → agentmemory
- Token optimization → mem0
- Multi-hop reasoning → HippoRAG
- Zero dependencies → domain-memory

## Encryption Details

AES-256-GCM implementation:

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt_session(content: str, key: bytes) -> bytes:
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, content.encode(), None)
    return nonce + ciphertext

def decrypt_session(encrypted: bytes, key: bytes) -> str:
    aesgcm = AESGCM(key)
    nonce = encrypted[:12]
    ciphertext = encrypted[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
```

## Cookbook Resources

For detailed implementation guides, read the cookbook files:

| Cookbook | Use When | File |
|----------|----------|------|
| **quickstart** | Getting started with basic operations | `cookbook/quickstart.md` |
| **encryption** | Deep-dive into AES-256-GCM implementation | `cookbook/encryption.md` |
| **pii-redaction** | Understanding critical vs non-critical patterns | `cookbook/pii-redaction.md` |
| **memory-cards** | Memory card generation algorithm | `cookbook/memory-cards.md` |
| **cascade-storage** | Content-addressed storage patterns | `cookbook/cascade-storage.md` |

## Prompt Templates

| Template | Use When | File |
|----------|----------|------|
| **memory_card_template** | Generating or validating memory cards | `prompts/memory_card_template.md` |
| **redaction_report** | Creating redaction summaries | `prompts/redaction_report.md` |

## Tools

Standalone Python utilities:

| Tool | Description | File |
|------|-------------|------|
| **lumera_client.py** | Complete Python client for Lumera MCP | `tools/lumera_client.py` |
| **encrypt_decrypt.py** | Standalone AES-256-GCM encryption CLI | `tools/encrypt_decrypt.py` |

### Quick Start with Tools

```bash
# Using the client
python tools/lumera_client.py store --session-id test_001
python tools/lumera_client.py query --query "deployment"
python tools/lumera_client.py retrieve --uri "cascade://sha256:..."

# Using encryption utilities
python tools/encrypt_decrypt.py generate-key --key-id default
python tools/encrypt_decrypt.py encrypt input.json output.enc
python tools/encrypt_decrypt.py decrypt output.enc decrypted.json
```

## Reference Source

- Local research: `.research/claude-code-plugins-plus-skills/plugins/mcp/lumera-agent-memory/`
- GitHub: https://github.com/jeremylongshore/claude-code-plugins-plus-skills

## Related Skills

- `../domain-memory/SKILL.md` - Lightweight alternative
- `../memory-architecture/SKILL.md` - Three-tier patterns
