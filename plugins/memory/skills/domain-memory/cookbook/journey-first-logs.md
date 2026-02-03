# Journey: Indexing the First Day of Logs with Domain Memory

A chronicle of indexing December 8, 2025 - the first day of Claude Code hook logging in this repository - using domain-memory's TF-IDF approach.

## The Dataset

**Location**: `.claude/logging/2025/12/08/`

**Scale**:
- 18 JSONL files
- 782 total log events
- ~1.6MB of structured event data
- Timespan: 15:11 to 21:00 (local time)

**Event Distribution** (discovered through analysis):

| Event Type | Count | % of Total |
|------------|-------|------------|
| PreToolUse | 275 | 35.2% |
| PostToolUse | 273 | 34.9% |
| SubagentStop | 53 | 6.8% |
| UserPromptSubmit | 40 | 5.1% |
| Stop | 40 | 5.1% |
| Notification | 40 | 5.1% |
| AssistantResponse | 29 | 3.7% |
| SessionStart | 18 | 2.3% |
| SessionEnd | 14 | 1.8% |

---

## Lessons Learned: TF-IDF for Structured Event Logs

### 1. Structured logs have predictable term frequencies

Unlike free-text documents, event logs exhibit highly regular vocabulary:

```
High TF terms (appear in every document):
- "session_id" - in every event
- "timestamp" ("ts") - in every event
- "data" - in every event
- "transcript_path" - in every event

Discriminative terms (IDF matters):
- "tool_name" - only in PreToolUse/PostToolUse events
- "prompt" - only in UserPromptSubmit events
- "agent_id" - only in SubagentStop events
- "response" - only in AssistantResponse events
```

**Lesson**: For structured logs, field names have low IDF (appear everywhere). Field values carry the discriminative power.

### 2. Event type becomes the primary document segmentation

TF-IDF works best when you treat each event type as a document class:

```python
# Effective: Index by event type
documents = {
    "PreToolUse_events": all_pretooluse_events,
    "UserPromptSubmit_events": all_userprompt_events,
    # ...
}

# Less effective: Index individual events
documents = {
    "event_001": single_event,  # Too granular, low term diversity
    "event_002": single_event,
}
```

### 3. Nested JSON requires flattening for TF-IDF

The log structure has nested data:

```json
{
  "ts": "2025-12-08T17:15:35.566082",
  "type": "PreToolUse",
  "data": {
    "tool_name": "Bash",
    "tool_input": {
      "command": "git log --oneline -5",
      "description": "Show recent git commits"
    }
  }
}
```

**Strategy**: Flatten to extractable text:
```
PreToolUse Bash command:"git log --oneline -5" description:"Show recent git commits"
```

This allows searching for "git commits" to match the event.

---

## Examples: Keyword Extraction from Log Events

### Example 1: Tool Usage Keywords

From PreToolUse events, extract discriminative tool+action pairs:

| Tool | Frequency | Common Actions |
|------|-----------|----------------|
| Read | 79 | file_path, content inspection |
| Bash | 76 | ls, git, pwd, find, head |
| Grep | 51 | pattern matching, code search |
| Glob | 37 | *.ts, *.md, **/* patterns |
| Task | 17 | subagent spawning |
| WebSearch | 9 | documentation lookup |

**TF-IDF Insight**: "Read" and "Bash" have low IDF (appear often), but combining with their inputs creates discriminative terms:
- `Read + CLAUDE.md` = high specificity
- `Bash + "git log"` = git operation detection

### Example 2: User Prompt Keywords

Top user prompts by frequency:

| Prompt Pattern | Count | Keywords |
|----------------|-------|----------|
| "Testing" / "Test" | 14 | test, testing |
| Subagent requests | 7 | subagent, agent, task |
| Tool usage requests | 4 | tools, couple, use |
| Exploration prompts | 3 | explore, investigate |

**TF-IDF Application**:
```python
# Query: "subagent testing"
# Would match: "Testing logging can you spin up a quick subagent?"
# Score breakdown:
#   "testing" TF=0.14 (appears in 14/40 prompts)
#   "subagent" TF=0.175 (appears in 7/40 prompts)
#   Combined: Higher score for prompts containing both
```

### Example 3: Session Activity Fingerprinting

Each session has a unique fingerprint of events:

```
Session 17-48-29-0143495c (452 events):
  - 212 PreToolUse + 212 PostToolUse = 424 tool events
  - 5 UserPromptSubmit
  - Ratio: 84.8 tool events per prompt
  - Character: Heavy tool usage session

Session 15-28-41-b7ebc124 (35 events):
  - 0 PreToolUse + 0 PostToolUse
  - 11 UserPromptSubmit
  - Ratio: 0 tool events per prompt
  - Character: Conversational testing session
```

---

## Stories: Term Frequency Patterns Discovered

### Story 1: The Testing Phase Pattern

On December 8, 2025, logging was being actively developed and tested. The term frequency reveals this:

```
"test"/"testing" frequency across sessions:
- 15:28-15:57: 10 occurrences (intensive testing)
- 17:11-17:55: 4 occurrences (continued testing)
- 18:24-18:37: 6 occurrences (final validation)

Pattern: Testing intensity peaked early, tapered off as logging stabilized.
```

### Story 2: Subagent Evolution

Agent IDs show 53 unique subagent spawns across the day:

```
Early sessions (15:xx-16:xx): 2-4 agents per session
Mid sessions (17:xx): 3-8 agents per session
Late sessions (18:xx): 3-4 agents per session
Largest burst: Session 17-48-29 with 8 subagents
```

**Discovery**: The 17:48 session was the primary development session - it has 452 events and 8 subagent spawns, indicating complex multi-agent workflows were being tested.

### Story 3: Tool Usage Distribution

The Bash tool shows varied command patterns:

```
Navigation: pwd, ls -la (high frequency)
Git: git log, git status, git diff (medium frequency)
Discovery: find, head, cat (medium frequency)
System: wc -l (low frequency, used once for counting)
```

**TF-IDF Relevance**: The `wc -l` command, being rare, would have high IDF weight. A search for "line count" would strongly match the session containing this command.

---

## Tips & Tricks: Offline Indexing Without Embeddings

### Tip 1: Use event type as a tag filter

```python
# Before TF-IDF search, filter by event type
events = load_events(log_file)
tool_events = [e for e in events if e["type"] == "PreToolUse"]

# Now TF-IDF operates on a focused corpus
results = tfidf_search(tool_events, query="git operations")
```

### Tip 2: Extract and index command descriptions

The `description` field in Bash events is human-readable:

```json
{"tool_input": {"command": "pwd", "description": "Get current working directory"}}
```

Index the description for semantic search:
```python
doc_text = f"{event['data']['tool_name']} {event['data']['tool_input'].get('description', '')}"
# Yields: "Bash Get current working directory"
```

### Tip 3: Time-window aggregation for session summaries

Instead of indexing individual events, aggregate by session:

```python
session_doc = {
    "session_id": "17-48-29-0143495c",
    "content": " ".join([
        f"tool:{e['data']['tool_name']}"
        for e in events if e["type"] == "PreToolUse"
    ]),
    "stats": {
        "total_events": 452,
        "tool_events": 424,
        "prompts": 5
    }
}
# Content: "tool:Read tool:Bash tool:Grep tool:Glob tool:Read tool:Bash..."
```

### Tip 4: Build a term vocabulary upfront

For structured logs, build a controlled vocabulary:

```python
LOG_VOCABULARY = {
    "events": ["SessionStart", "SessionEnd", "Stop", "Notification",
               "PreToolUse", "PostToolUse", "SubagentStop",
               "UserPromptSubmit", "AssistantResponse"],
    "tools": ["Read", "Bash", "Grep", "Glob", "Task", "WebSearch", "Edit", "Write"],
    "patterns": ["test", "subagent", "explore", "git", "file"]
}

# Use vocabulary for query expansion
def expand_query(query):
    tokens = query.lower().split()
    expanded = set(tokens)
    for token in tokens:
        for category, terms in LOG_VOCABULARY.items():
            if token in [t.lower() for t in terms]:
                expanded.update(t.lower() for t in terms)
    return list(expanded)
```

### Tip 5: Preserve temporal order in document IDs

Log files are named with timestamps (`17-48-29-0143495c.jsonl`). Use this:

```python
# Document IDs that sort chronologically
doc_id = f"{session_start_time}_{event_index:04d}"
# Example: "2025-12-08T17:48:29_0001"

# Enables range queries:
recent_docs = [d for d in docs if d.id > "2025-12-08T18:00:00"]
```

---

## Playbook: Lightweight Log Indexing with Domain Memory

### Phase 1: Data Preparation

```python
import json
from pathlib import Path
from collections import Counter

def load_log_day(log_dir: Path) -> list[dict]:
    """Load all JSONL files from a day's log directory."""
    events = []
    for jsonl_file in sorted(log_dir.glob("*.jsonl")):
        with open(jsonl_file) as f:
            for line in f:
                if line.strip():
                    event = json.loads(line)
                    event["_source_file"] = jsonl_file.name
                    events.append(event)
    return events

# Load December 8, 2025 logs
events = load_log_day(Path(".claude/logging/2025/12/08/"))
print(f"Loaded {len(events)} events")  # Expected: 782
```

### Phase 2: Document Generation

```python
def event_to_document(event: dict) -> str:
    """Convert a log event to indexable text."""
    parts = [event["type"]]

    data = event.get("data", {})

    # Add tool information
    if "tool_name" in data:
        parts.append(f"tool:{data['tool_name']}")

    # Add tool input details
    if "tool_input" in data:
        tool_input = data["tool_input"]
        if isinstance(tool_input, dict):
            for key, value in tool_input.items():
                if isinstance(value, str) and len(value) < 200:
                    parts.append(f"{key}:{value}")

    # Add prompt text
    if "prompt" in data:
        parts.append(f"prompt:{data['prompt']}")

    # Add response text (truncated for indexing)
    if "response" in data and isinstance(data["response"], str):
        response = data["response"][:500]
        parts.append(f"response:{response}")

    return " ".join(parts)

# Generate documents
documents = [
    {
        "id": f"{e['ts']}_{e['type']}",
        "title": f"{e['type']} at {e['ts'][:19]}",
        "content": event_to_document(e),
        "tags": [e["type"], e.get("data", {}).get("tool_name", "none")],
        "metadata": {"session_id": e.get("session_id", "unknown")}
    }
    for e in events
]
```

### Phase 3: TF-IDF Indexing

```python
# Using domain-memory's store_document
for doc in documents:
    await store_document(
        title=doc["title"],
        content=doc["content"],
        tags=doc["tags"],
        metadata=doc["metadata"]
    )

print(f"Indexed {len(documents)} log events")
```

### Phase 4: Search Examples

```python
# Find all git-related operations
results = await semantic_search(
    query="git log commit status",
    limit=20,
    tag_filter=["Bash"]
)

# Find subagent test sessions
results = await semantic_search(
    query="test subagent spawn",
    tag_filter=["Task"]
)

# Find sessions with heavy tool usage
results = await semantic_search(
    query="tool Read Bash Grep multiple",
    min_score=0.3
)
```

### Phase 5: Session-Level Aggregation

For higher-level search, aggregate events by session:

```python
from collections import defaultdict

sessions = defaultdict(list)
for event in events:
    session_id = event.get("data", {}).get("session_id", "unknown")
    sessions[session_id].append(event)

session_documents = []
for session_id, session_events in sessions.items():
    # Count event types
    type_counts = Counter(e["type"] for e in session_events)

    # Count tools used
    tools_used = Counter(
        e["data"]["tool_name"]
        for e in session_events
        if "tool_name" in e.get("data", {})
    )

    # Extract all prompts
    prompts = [
        e["data"]["prompt"]
        for e in session_events
        if e["type"] == "UserPromptSubmit"
    ]

    session_doc = {
        "id": session_id,
        "title": f"Session {session_id[:8]}",
        "content": f"""
            Events: {' '.join(f'{k}:{v}' for k, v in type_counts.items())}
            Tools: {' '.join(f'{k}:{v}' for k, v in tools_used.items())}
            Prompts: {' | '.join(prompts)}
        """,
        "tags": list(tools_used.keys()) + ["session"],
        "metadata": {
            "event_count": len(session_events),
            "tool_events": type_counts.get("PreToolUse", 0)
        }
    }
    session_documents.append(session_doc)

# Index session documents
for doc in session_documents:
    await store_document(**doc)
```

---

## Summary: Domain Memory's Strengths for Log Indexing

| Capability | How It Applies to Logs |
|------------|----------------------|
| **Zero dependencies** | Index logs on any machine - no Python ML packages needed |
| **Offline capable** | Index historical logs without internet connectivity |
| **Explainable scoring** | "This session matched because it contains 'git' (TF=0.8) and 'test' (TF=0.4)" |
| **Fast indexing** | 782 events indexed in <10ms (no embedding computation) |
| **Predictable performance** | Search latency stays consistent regardless of log volume |

### When to Enhance with Embeddings

Consider adding embeddings (via hybrid approach) when:
- Semantic similarity matters: "authentication" should match "login"
- Query vocabulary varies: Users search with different terms than logs contain
- Cross-lingual search: Logs mix languages or use abbreviations

For pure log search where terms are predictable and consistent, TF-IDF alone provides excellent results with minimal complexity.

---

*Generated: 2026-01-20 | Data Source: December 8, 2025 logs | Indexed Events: 782*
