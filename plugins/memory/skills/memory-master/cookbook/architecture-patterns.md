# Memory Architecture Patterns

Common architecture patterns for agent memory systems with implementation examples.

## Core Pattern: Three-Tier Temporal Memory

The foundational pattern that all memory systems should implement.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: HOT MEMORY (0-24 hours)                            │
├─────────────────────────────────────────────────────────────┤
│ Strategy:    Automatic injection on EVERY prompt           │
│ Storage:     In-memory cache (deque, maxlen=5)             │
│ Threshold:   None (inject all recent context)              │
│ Decay:       24-hour hard cutoff                           │
│ Max items:   Last 5 interactions                           │
│                                                             │
│ Rationale:   Within a day, continuity >> noise             │
└─────────────────────────────────────────────────────────────┘
                    ↓ Automatic aging
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: WARM MEMORY (1-7 days)                             │
├─────────────────────────────────────────────────────────────┤
│ Strategy:    Triggered by semantic cues in prompt          │
│ Storage:     SQLite + embeddings (persistent)              │
│ Threshold:   0.4 similarity (moderate selectivity)         │
│ Decay:       7-day hard cutoff                             │
│ Max items:   Top 2 matches only                            │
│                                                             │
│ Triggers:    • Question marks in prompt                    │
│              • File/directory references                   │
│              • >10 word queries (complex questions)        │
│              • Temporal keywords (yesterday, last week)    │
└─────────────────────────────────────────────────────────────┘
                    ↓ Archival
┌─────────────────────────────────────────────────────────────┐
│ TIER 3: COLD MEMORY (8+ days)                              │
├─────────────────────────────────────────────────────────────┤
│ Strategy:    Explicit user invocation ONLY                 │
│ Storage:     JSONL logs + BM25/FTS5 index                  │
│ Threshold:   User-controlled search parameters             │
│ Decay:       None (permanent archive)                      │
│                                                             │
│ Access:      Skills, commands, or explicit queries         │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
from collections import deque
from datetime import datetime, timedelta
import sqlite3
import json

class ThreeTierMemory:
    def __init__(self, db_path: str):
        # Tier 1: Hot memory (in-memory)
        self.hot_cache = deque(maxlen=5)
        self.hot_cutoff = timedelta(hours=24)

        # Tier 2: Warm memory (SQLite + embeddings)
        self.conn = sqlite3.connect(db_path)
        self.warm_cutoff = timedelta(days=7)
        self.warm_threshold = 0.4
        self._init_db()

    def _init_db(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY,
                content TEXT,
                embedding BLOB,
                timestamp TEXT,
                tier TEXT DEFAULT 'warm'
            )
        """)
        self.conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
            USING fts5(content, content=memories, content_rowid=id)
        """)

    def add(self, content: str, embedding: list[float]):
        now = datetime.now()

        # Add to hot cache
        self.hot_cache.append({
            "content": content,
            "timestamp": now.isoformat()
        })

        # Store in warm tier (SQLite)
        self.conn.execute(
            "INSERT INTO memories (content, embedding, timestamp) VALUES (?, ?, ?)",
            (content, json.dumps(embedding), now.isoformat())
        )
        self.conn.commit()

    def get_hot(self) -> list[dict]:
        """Get all hot memories (no filtering)."""
        cutoff = datetime.now() - self.hot_cutoff
        return [
            m for m in self.hot_cache
            if datetime.fromisoformat(m["timestamp"]) > cutoff
        ]

    def search_warm(self, query: str, query_embedding: list[float], triggers: dict) -> list[dict]:
        """Search warm tier if triggers match."""
        if not self._should_trigger(query, triggers):
            return []

        cutoff = (datetime.now() - self.warm_cutoff).isoformat()

        # Vector similarity search
        results = self._vector_search(query_embedding, cutoff)

        # Filter by threshold
        return [r for r in results if r["similarity"] >= self.warm_threshold][:2]

    def _should_trigger(self, query: str, triggers: dict) -> bool:
        """Check if warm retrieval should trigger."""
        if triggers.get("question_mark") and "?" in query:
            return True
        if triggers.get("complex_query") and len(query.split()) > 10:
            return True
        if triggers.get("temporal_keywords"):
            keywords = ["yesterday", "last week", "earlier", "before"]
            if any(kw in query.lower() for kw in keywords):
                return True
        return False

    def search_cold(self, query: str, limit: int = 10) -> list[dict]:
        """Explicit cold tier search (FTS5)."""
        results = self.conn.execute("""
            SELECT content, timestamp FROM memories_fts
            WHERE memories_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit)).fetchall()
        return [{"content": r[0], "timestamp": r[1]} for r in results]
```

## Pattern: Progressive Disclosure

The token-saving pattern from claude-mem achieving ~10x reduction.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: SEARCH (50-100 tokens)                            │
├─────────────────────────────────────────────────────────────┤
│ Returns: Compact index with IDs only                       │
│                                                             │
│ Format:                                                    │
│ [MEM_001] Tool: Edit, File: auth.py, Time: 2h ago          │
│ [MEM_002] Topic: Authentication, Score: 0.85               │
│ [MEM_003] Topic: User preferences, Score: 0.72             │
└─────────────────────────────────────────────────────────────┘
                    ↓ If more context needed
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: TIMELINE (200-500 tokens)                         │
├─────────────────────────────────────────────────────────────┤
│ Returns: Chronological context around selected IDs         │
│                                                             │
│ Format:                                                    │
│ [2h ago] MEM_001: Edited auth.py to add JWT validation     │
│ [2h ago] MEM_002: User asked about token expiration        │
│ [3h ago] MEM_000: Started authentication refactor          │
│ [4h ago] MEM_003: User mentioned preferring OAuth2         │
└─────────────────────────────────────────────────────────────┘
                    ↓ If full details needed
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: DETAILS (500-1000 tokens)                         │
├─────────────────────────────────────────────────────────────┤
│ Returns: Full observation content for specific IDs         │
│                                                             │
│ Format:                                                    │
│ ## MEM_001: Edit auth.py                                   │
│ Tool: Edit                                                 │
│ File: /src/auth.py                                         │
│ Changes:                                                   │
│   - Added JWT validation middleware                        │
│   - Implemented token refresh logic                        │
│   - Added expiration check                                 │
│ Timestamp: 2026-01-20T09:15:00Z                            │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
from dataclasses import dataclass
from typing import Optional
import json

@dataclass
class Memory:
    id: str
    content: str
    summary: str  # One-line summary
    tool: Optional[str]
    topic: str
    timestamp: str
    score: float = 0.0

class ProgressiveDisclosure:
    def __init__(self, memories: list[Memory]):
        self.memories = {m.id: m for m in memories}

    def layer1_search(self, query: str, limit: int = 5) -> str:
        """Return compact index (50-100 tokens)."""
        # Assume memories are already scored by similarity
        sorted_mems = sorted(
            self.memories.values(),
            key=lambda m: m.score,
            reverse=True
        )[:limit]

        lines = []
        for m in sorted_mems:
            if m.tool:
                lines.append(f"[{m.id}] Tool: {m.tool}, Topic: {m.topic}, Score: {m.score:.2f}")
            else:
                lines.append(f"[{m.id}] Topic: {m.topic}, Score: {m.score:.2f}")

        return "\n".join(lines)

    def layer2_timeline(self, ids: list[str], context_window: int = 2) -> str:
        """Return chronological context (200-500 tokens)."""
        # Get requested memories plus surrounding context
        all_ids = set(ids)
        sorted_all = sorted(self.memories.values(), key=lambda m: m.timestamp)

        for i, m in enumerate(sorted_all):
            if m.id in ids:
                # Add context_window memories before/after
                start = max(0, i - context_window)
                end = min(len(sorted_all), i + context_window + 1)
                for j in range(start, end):
                    all_ids.add(sorted_all[j].id)

        # Format timeline
        timeline_mems = [self.memories[mid] for mid in all_ids if mid in self.memories]
        timeline_mems.sort(key=lambda m: m.timestamp, reverse=True)

        lines = []
        for m in timeline_mems:
            marker = "*" if m.id in ids else " "
            lines.append(f"[{m.timestamp[-8:-3]}]{marker} {m.id}: {m.summary}")

        return "\n".join(lines)

    def layer3_details(self, ids: list[str]) -> str:
        """Return full details (500-1000 tokens)."""
        sections = []
        for mid in ids:
            if mid not in self.memories:
                continue
            m = self.memories[mid]
            section = f"""## {m.id}: {m.topic}
{f"Tool: {m.tool}" if m.tool else ""}
Timestamp: {m.timestamp}

{m.content}
"""
            sections.append(section)

        return "\n---\n".join(sections)
```

## Pattern: Hook-Based Capture

Claude Code hook integration for automatic memory capture.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ SessionStart                                                │
│ └─ Load hot cache from previous session                    │
│ └─ Initialize warm memory connection                       │
│ └─ Return system message with recent context               │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ UserPromptSubmit                                            │
│ └─ Check triggers (question marks, file refs, etc.)        │
│ └─ Search warm memory if triggered                         │
│ └─ Inject context via additionalContext                    │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ PostToolUse                                                 │
│ └─ Extract observations from tool results                  │
│ └─ Generate embedding (if configured)                      │
│ └─ Store in warm memory                                    │
│ └─ Update hot cache                                        │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ Stop                                                        │
│ └─ Summarize exchange                                      │
│ └─ Update session summary in hot cache                     │
│ └─ Optionally compress conversation                        │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ SessionEnd                                                  │
│ └─ Flush hot cache to warm memory                          │
│ └─ Batch generate embeddings for new memories              │
│ └─ Archive to cold storage (if configured)                 │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
#!/usr/bin/env python3
"""Memory hooks for Claude Code integration."""

import json
import sys
from datetime import datetime
from pathlib import Path

# Hook implementations

def session_start_hook(session_id: str, memory_store) -> dict:
    """Load context on session start."""
    # Get hot memories
    hot = memory_store.get_hot()

    if not hot:
        return {}

    context = "[PREVIOUS SESSION]\n"
    for m in hot[-3:]:  # Last 3 memories
        context += f"- {m['content'][:100]}\n"
    context += "[END PREVIOUS SESSION]\n"

    return {
        "systemMessage": context
    }


def user_prompt_hook(prompt: str, session_id: str, memory_store) -> dict:
    """Inject relevant context before processing."""
    triggers = {
        "question_mark": "?" in prompt,
        "complex_query": len(prompt.split()) > 10,
        "temporal_keywords": any(kw in prompt.lower()
            for kw in ["yesterday", "last week", "earlier"]),
        "file_reference": "/" in prompt or "." in prompt
    }

    if not any(triggers.values()):
        return {}

    # Search warm memory
    embedding = memory_store.embed(prompt)
    results = memory_store.search_warm(prompt, embedding, triggers)

    if not results:
        return {}

    context = "[MEMORY CONTEXT]\n"
    for r in results[:2]:
        context += f"- [{r['timestamp'][-5:]}] {r['content'][:150]}\n"
    context += "[END MEMORY]\n"

    return {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context
        }
    }


def post_tool_hook(tool_name: str, tool_input: dict, tool_response: str, memory_store) -> dict:
    """Capture observations from tool use."""
    # Skip noisy tools
    if tool_name in ["Glob", "Grep"]:
        return {}

    # Create observation
    observation = {
        "tool": tool_name,
        "input": json.dumps(tool_input)[:200],
        "output": tool_response[:500] if tool_response else "",
        "timestamp": datetime.now().isoformat()
    }

    # Store with embedding
    content = f"Used {tool_name}: {observation['input']}"
    embedding = memory_store.embed(content)
    memory_store.add(content, embedding)

    return {}


def stop_hook(session_id: str, transcript_path: str, memory_store) -> dict:
    """Summarize exchange on completion."""
    # Load transcript
    transcript = Path(transcript_path).read_text() if Path(transcript_path).exists() else ""

    # Simple summarization (could use LLM)
    lines = transcript.split("\n")
    summary = f"Session with {len(lines)} exchanges"

    memory_store.add_summary(session_id, summary)
    return {}


def session_end_hook(session_id: str, memory_store) -> dict:
    """Persist and index on session end."""
    # Flush hot to warm
    memory_store.flush_hot_to_warm()

    # Batch embed any pending memories
    memory_store.batch_embed_pending()

    return {}


# Hook router
def main():
    hook_data = json.loads(sys.stdin.read())
    hook_name = hook_data.get("hook_name")

    # Initialize memory store (singleton pattern)
    from memory_store import get_memory_store
    memory_store = get_memory_store()

    result = {}

    if hook_name == "SessionStart":
        result = session_start_hook(
            hook_data.get("session_id"),
            memory_store
        )
    elif hook_name == "UserPromptSubmit":
        result = user_prompt_hook(
            hook_data.get("prompt"),
            hook_data.get("session_id"),
            memory_store
        )
    elif hook_name == "PostToolUse":
        result = post_tool_hook(
            hook_data.get("tool_name"),
            hook_data.get("tool_input", {}),
            hook_data.get("tool_response", ""),
            memory_store
        )
    elif hook_name == "Stop":
        result = stop_hook(
            hook_data.get("session_id"),
            hook_data.get("transcript_path", ""),
            memory_store
        )
    elif hook_name == "SessionEnd":
        result = session_end_hook(
            hook_data.get("session_id"),
            memory_store
        )

    print(json.dumps(result))


if __name__ == "__main__":
    main()
```

## Pattern: Hybrid Search

Combining vector similarity with keyword matching for optimal retrieval.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Query                                                       │
└─────────────────────────────────────────────────────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌─────────┐   ┌─────────────┐
│ Vector  │   │ Keyword     │
│ Search  │   │ Search      │
│ (Chroma)│   │ (FTS5/BM25) │
└─────────┘   └─────────────┘
    │               │
    │ results_a     │ results_b
    │               │
    └───────┬───────┘
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Reciprocal Rank Fusion                                      │
│ score[doc] = sum(1/(k + rank_a), 1/(k + rank_b))           │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Recency Boost                                               │
│ final_score = rrf_score * exp(-age_days / decay_days)      │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Top-K Results                                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```python
import math
from datetime import datetime
from typing import Optional

def hybrid_search(
    query: str,
    query_embedding: list[float],
    vector_store,
    fts_store,
    k: int = 10,
    rrf_k: int = 60,
    decay_days: int = 30
) -> list[dict]:
    """Hybrid search with RRF and recency boost."""

    # Vector search
    vector_results = vector_store.search(query_embedding, limit=k * 2)

    # Keyword search (FTS5/BM25)
    keyword_results = fts_store.search(query, limit=k * 2)

    # Reciprocal Rank Fusion
    scores = {}
    doc_data = {}

    for rank, doc in enumerate(vector_results):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (rrf_k + rank + 1)
        doc_data[doc_id] = doc

    for rank, doc in enumerate(keyword_results):
        doc_id = doc["id"]
        scores[doc_id] = scores.get(doc_id, 0) + 1 / (rrf_k + rank + 1)
        doc_data[doc_id] = doc

    # Recency boost
    now = datetime.now()
    for doc_id, score in scores.items():
        doc = doc_data.get(doc_id, {})
        timestamp = doc.get("timestamp")
        if timestamp:
            age_days = (now - datetime.fromisoformat(timestamp)).days
            decay_factor = math.exp(-age_days / decay_days)
            scores[doc_id] = score * decay_factor

    # Sort and return top-k
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:k]

    return [
        {**doc_data[doc_id], "hybrid_score": scores[doc_id]}
        for doc_id in sorted_ids
        if doc_id in doc_data
    ]


def calculate_hybrid_score(
    similarity: float,
    keyword_score: float,
    recency_weight: float,
    importance: float = 0.0,
    access_count: int = 0,
    context_boost: float = 0.0,
    weights: Optional[dict] = None
) -> float:
    """Calculate weighted hybrid score."""
    w = weights or {
        "semantic": 0.6,
        "keyword": 0.4,
        "recency": 0.3,
        "importance": 0.25,
        "access": 0.15
    }

    # Normalize access count (log scale)
    access_factor = math.log1p(access_count) / 10.0

    return (
        similarity * w["semantic"] +
        keyword_score * w["keyword"] +
        recency_weight * w["recency"] +
        importance * w["importance"] +
        access_factor * w["access"] +
        context_boost
    )
```

## Pattern: Biomimetic Decay

Natural memory decay inspired by human memory systems.

### Implementation

```python
import math
from datetime import datetime, timedelta
from typing import Callable

class BiomimeticMemory:
    """Memory with natural decay patterns."""

    def __init__(
        self,
        half_life_hours: float = 24.0,
        consolidation_threshold: int = 3,
        importance_boost: float = 2.0
    ):
        self.half_life = half_life_hours
        self.consolidation_threshold = consolidation_threshold
        self.importance_boost = importance_boost
        self.memories = {}
        self.access_counts = {}

    def add(self, memory_id: str, content: str, importance: float = 0.5):
        """Add memory with initial importance."""
        self.memories[memory_id] = {
            "content": content,
            "created": datetime.now(),
            "last_accessed": datetime.now(),
            "importance": importance,
            "consolidated": False
        }
        self.access_counts[memory_id] = 0

    def access(self, memory_id: str):
        """Record memory access (strengthens memory)."""
        if memory_id in self.memories:
            self.access_counts[memory_id] += 1
            self.memories[memory_id]["last_accessed"] = datetime.now()

            # Check for consolidation
            if self.access_counts[memory_id] >= self.consolidation_threshold:
                self.memories[memory_id]["consolidated"] = True

    def get_strength(self, memory_id: str) -> float:
        """Calculate current memory strength with decay."""
        if memory_id not in self.memories:
            return 0.0

        m = self.memories[memory_id]

        # Base decay from last access
        hours_since_access = (
            datetime.now() - m["last_accessed"]
        ).total_seconds() / 3600

        # Exponential decay
        decay = math.exp(-0.693 * hours_since_access / self.half_life)

        # Modifiers
        importance_mod = 1.0 + (m["importance"] * self.importance_boost)
        consolidation_mod = 2.0 if m["consolidated"] else 1.0
        access_mod = 1.0 + (math.log1p(self.access_counts[memory_id]) * 0.1)

        return min(1.0, decay * importance_mod * consolidation_mod * access_mod)

    def prune(self, threshold: float = 0.1) -> list[str]:
        """Remove memories below strength threshold."""
        pruned = []
        for memory_id in list(self.memories.keys()):
            if self.get_strength(memory_id) < threshold:
                del self.memories[memory_id]
                del self.access_counts[memory_id]
                pruned.append(memory_id)
        return pruned

    def search(
        self,
        similarity_fn: Callable[[str, str], float],
        query: str,
        limit: int = 5
    ) -> list[dict]:
        """Search with strength-weighted results."""
        results = []
        for memory_id, m in self.memories.items():
            base_similarity = similarity_fn(query, m["content"])
            strength = self.get_strength(memory_id)
            weighted_score = base_similarity * strength

            self.access(memory_id)  # Record access

            results.append({
                "id": memory_id,
                "content": m["content"],
                "similarity": base_similarity,
                "strength": strength,
                "score": weighted_score
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
```

## Configuration Templates

### Minimal Setup (agentmemory)

```yaml
memory:
  framework: agentmemory
  backend: chromadb
  path: .claude/memory/chroma
  embedding: default  # Uses ChromaDB's default

hooks:
  post_tool_use: true
  session_end: true
```

### Production Setup (mem0)

```yaml
memory:
  framework: mem0

  vector_store:
    provider: qdrant
    config:
      host: localhost
      port: 6333

  embedder:
    provider: openai
    config:
      model: text-embedding-3-small

  llm:
    provider: openai
    config:
      model: gpt-4o-mini

  graph_store:  # Optional
    provider: neo4j
    config:
      url: bolt://localhost:7687
      username: neo4j
      password: ${NEO4J_PASSWORD}

hooks:
  session_start: true
  user_prompt_submit: true
  post_tool_use: true
  stop: true
  session_end: true

three_tier:
  hot:
    max_age_hours: 24
    max_items: 5
    auto_inject: true
  warm:
    max_age_days: 7
    similarity_threshold: 0.4
    max_injections: 2
    triggers:
      question_mark: true
      file_reference: true
      complex_query_min_words: 10
  cold:
    enabled: true
    tool: /log-search
```

### Research Setup (HippoRAG)

```yaml
memory:
  framework: hipporag

  llm:
    model: gpt-4o
    api_key: ${OPENAI_API_KEY}

  embedding:
    model: NV-Embed-v2
    device: cuda

  graph:
    backend: networkx  # or neo4j for persistence
    save_path: .claude/memory/knowledge_graph.pkl

  retrieval:
    top_k: 5
    pagerank_alpha: 0.85
    min_score: 0.3

hooks:
  post_tool_use: true  # Extract entities from tool results
  session_end: true    # Build/update knowledge graph
```
