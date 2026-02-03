# Log Search Design

## Goal

Enable semantic search over conversation history: "What did we discuss about authentication?"

## Architecture

```
logging/
├── hooks/
│   └── log_event.py          # Add: generate embeddings on key events
├── tools/
│   └── search_logs.py        # NEW: Search script (invoked via Bash)
├── skills/
│   └── log-search/
│       └── SKILL.md          # NEW: Skill that guides search usage
└── .claude-plugin/plugin.json  # Update version
```

## Embedding Approach

### Option Analysis

| Option | Pros | Cons |
|--------|------|------|
| sentence-transformers | Free, local, semantic | Heavy deps (~2GB), slow first load |
| Voyage AI | High quality, Anthropic-recommended | API cost, new dependency |
| TF-IDF | Zero deps, fast | Not semantic, keyword-only |
| BM25 | Zero deps, good for search | Not semantic |

### Decision: Two-Phase Approach

**Phase 1 (Now)**: BM25 search
- Zero new dependencies
- Pure Python implementation
- Works immediately
- Good enough for keyword search

**Phase 2 (Later)**: Semantic embeddings
- Add sentence-transformers when needed
- Can coexist with BM25
- Hybrid search (BM25 + semantic)

## Phase 1: BM25 Implementation

### Data to Index

| Event Type | Content to Index |
|------------|------------------|
| UserPromptSubmit | `data.prompt` - User's full message |
| AssistantResponse | `data.response` - Claude's full response |
| SubagentStop | Agent response (from transcript) |

### Index Storage

```
.claude/logging/.search-index/
├── index.json        # BM25 index data
└── documents.json    # Document metadata
```

**documents.json**:
```json
[
  {
    "id": "doc-001",
    "type": "UserPromptSubmit",
    "content": "Help me debug the authentication code",
    "session_id": "abc123",
    "timestamp": "2025-12-11T10:30:00",
    "log_file": ".claude/logging/2025/12/11/10-30-00-abc123.jsonl"
  }
]
```

**index.json**:
```json
{
  "vocab": {"authentication": 0, "code": 1, ...},
  "idf": [2.3, 1.5, ...],
  "doc_term_freqs": [[0, 1, ...], ...]
}
```

### Search Interface

```bash
# Search logs
uv run plugins/logging/tools/search_logs.py "authentication" --limit 5

# Output: JSON array of matches
[
  {
    "score": 0.85,
    "type": "UserPromptSubmit",
    "content": "Help me debug the authentication code...",
    "timestamp": "2025-12-11T10:30:00",
    "session_id": "abc123"
  }
]
```

### Indexing Strategy

**Option A: Index on query (lazy)**
- Build index when search is requested
- Slow first search, but no overhead during logging
- Simple to implement

**Option B: Index on log (eager)**
- Update index when events are logged
- Fast searches, but adds overhead to hook
- More complex

**Decision: Option A (lazy indexing)**
- Start simple
- Can optimize later if search is slow

## Implementation Steps

1. Create `search_logs.py` with:
   - JSONL file scanner
   - BM25 implementation
   - JSON output

2. Create `log-search` skill with:
   - Description for auto-discovery
   - Instructions for using search
   - Example queries

3. Test with real logs

## Search Script API

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

"""Search conversation logs using BM25."""

import argparse
import json
import math
from pathlib import Path
from collections import Counter

def tokenize(text):
    """Simple whitespace + lowercase tokenization."""
    return text.lower().split()

def bm25_score(query_terms, doc_terms, doc_len, avg_doc_len, idf, k1=1.5, b=0.75):
    """Calculate BM25 score for a document."""
    score = 0
    doc_counter = Counter(doc_terms)
    for term in query_terms:
        if term in idf:
            tf = doc_counter[term]
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * doc_len / avg_doc_len)
            score += idf[term] * numerator / denominator
    return score

def search(query, logs_dir, limit=10):
    """Search logs for query."""
    # Collect documents
    docs = []
    for jsonl in Path(logs_dir).rglob("*.jsonl"):
        for line in jsonl.read_text().strip().split("\n"):
            if not line:
                continue
            event = json.loads(line)
            if event["type"] == "UserPromptSubmit":
                content = event.get("data", {}).get("prompt", "")
            elif event["type"] == "AssistantResponse":
                content = event.get("data", {}).get("response", "")
            else:
                continue
            if content:
                docs.append({
                    "type": event["type"],
                    "content": content,
                    "timestamp": event.get("ts", ""),
                    "session_id": event.get("session_id", ""),
                    "terms": tokenize(content)
                })

    if not docs:
        return []

    # Calculate IDF
    N = len(docs)
    df = Counter()
    for doc in docs:
        for term in set(doc["terms"]):
            df[term] += 1
    idf = {term: math.log((N - df[term] + 0.5) / (df[term] + 0.5) + 1)
           for term in df}

    # Calculate average doc length
    avg_doc_len = sum(len(d["terms"]) for d in docs) / N

    # Score documents
    query_terms = tokenize(query)
    results = []
    for doc in docs:
        score = bm25_score(query_terms, doc["terms"],
                          len(doc["terms"]), avg_doc_len, idf)
        if score > 0:
            results.append({
                "score": round(score, 3),
                "type": doc["type"],
                "content": doc["content"][:500] + "..." if len(doc["content"]) > 500 else doc["content"],
                "timestamp": doc["timestamp"],
                "session_id": doc["session_id"]
            })

    # Sort by score and limit
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query", help="Search query")
    parser.add_argument("--logs-dir", default=".claude/logging", help="Logs directory")
    parser.add_argument("--limit", type=int, default=10, help="Max results")
    args = parser.parse_args()

    results = search(args.query, args.logs_dir, args.limit)
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
```

## Skill Definition

```yaml
---
name: log-search
description: Search conversation history for past discussions, decisions, and context. Use when you need to recall what was discussed about a topic, find previous solutions, or retrieve historical context from past sessions.
allowed-tools: Bash, Read
---
```

## Future: Semantic Search (Phase 2)

When BM25 isn't enough, add semantic embeddings:

```python
# Add to dependencies
# dependencies = ["sentence-transformers"]

from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer('all-MiniLM-L6-v2')

def embed(texts):
    return model.encode(texts, normalize_embeddings=True)

def semantic_search(query, docs, limit=10):
    query_emb = embed([query])[0]
    doc_embs = embed([d["content"] for d in docs])
    scores = doc_embs @ query_emb
    # ... rank by score
```

This can be added without changing the interface - just improve the search quality.
