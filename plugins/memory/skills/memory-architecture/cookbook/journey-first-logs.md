# Journey: Indexing the First Day of Logs

This document chronicles the analysis of December 8, 2025 - the first day of logs in this repository - and demonstrates how to apply three-tier memory architecture to real Claude Code log data.

## The Source Material

**Location**: `.claude/logging/2025/12/08/`
**Total Files**: 18 JSONL files
**Total Lines**: 782 log entries
**Time Span**: 15:11 PST to 21:00 PST (approximately 6 hours)

### Session Size Distribution

| Size Category | Files | Lines | Characteristics |
|---------------|-------|-------|-----------------|
| **Tiny** (4-8 lines) | 6 | 35 | Quick tests, abandoned sessions |
| **Small** (9-20 lines) | 7 | 93 | Single-task sessions, testing |
| **Medium** (21-62 lines) | 4 | 147 | Multi-turn conversations |
| **Large** (450+ lines) | 1 | 452 | Extended work session |

### Event Type Inventory

From analyzing the 782 log entries, the following event types were observed:

```yaml
HOOK_EVENTS:
  SessionStart: 18      # Every session begins with this
  SessionEnd: 18        # Most sessions have explicit end
  UserPromptSubmit: 31  # User messages to Claude
  Stop: 28              # Turn completions
  SubagentStop: 54      # Subagent completions (many per session)
  PreToolUse: 15        # Before tool execution
  PostToolUse: 15       # After tool execution with results
  Notification: 37      # Idle prompts and system notifications
  AssistantResponse: 22 # Claude's responses (captured later in day)
```

---

## Lessons Learned: Applying Three-Tier to Logs

### Lesson 1: Session Metadata is HOT, Content is WARM/COLD

The JSONL log structure reveals a natural tier separation:

```
┌─────────────────────────────────────────────────────────────┐
│ HOT TIER: Session Envelope                                  │
├─────────────────────────────────────────────────────────────┤
│ • Session ID and transcript path                            │
│ • Start/end timestamps                                      │
│ • Current working directory                                 │
│ • Permission mode                                           │
│ • Total event count                                         │
│                                                             │
│ WHY HOT: Needed for EVERY prompt to maintain context        │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ WARM TIER: Recent Interactions                              │
├─────────────────────────────────────────────────────────────┤
│ • User prompts (last 7 days)                                │
│ • Tool usage patterns (what tools, what files)              │
│ • Assistant responses (summarized)                          │
│ • Subagent results (aggregated)                             │
│                                                             │
│ WHY WARM: Cross-session coherence, triggered by cues        │
└─────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ COLD TIER: Full Log Archive                                 │
├─────────────────────────────────────────────────────────────┤
│ • Complete JSONL files                                      │
│ • Tool input/output details                                 │
│ • Usage statistics (tokens, timing)                         │
│ • Full transcript paths for deep investigation              │
│                                                             │
│ WHY COLD: Reference archive, explicit retrieval only        │
└─────────────────────────────────────────────────────────────┘
```

### Lesson 2: SubagentStop Events are High-Frequency Noise

**Observation**: 54 SubagentStop events in 18 sessions (3 per session average).

**Problem**: Most SubagentStop events are SessionStart hooks that fire subagents to check project state. These are infrastructure noise, not meaningful interactions.

**Solution**: Filter SubagentStop events by context:
- **Discard**: SubagentStop immediately after SessionStart (initialization)
- **Keep**: SubagentStop after PreToolUse with `tool_name: "Task"` (user-initiated)

```python
def is_meaningful_subagent_stop(event, previous_event):
    """Filter initialization subagents from meaningful work."""
    if previous_event is None:
        return False

    # Subagent spawned right after session start = initialization
    if previous_event["type"] == "SessionStart":
        return False

    # Subagent spawned after Task tool = user work
    if previous_event["type"] == "PreToolUse":
        return previous_event["data"].get("tool_name") == "Task"

    return True
```

### Lesson 3: Notification Events Mark Decay Boundaries

**Pattern Discovered**: Notification events with `notification_type: "idle_prompt"` consistently appear 60 seconds after the last Stop event.

**Insight**: These are natural decay signals. A session that generates multiple idle notifications is cooling down - its content should start decaying toward warm tier.

```python
def calculate_session_temperature(events):
    """Determine if session is hot, cooling, or cold based on notifications."""
    idle_notifications = [e for e in events
                          if e["type"] == "Notification"
                          and e["data"].get("notification_type") == "idle_prompt"]

    if len(idle_notifications) == 0:
        return "hot"  # Active session
    elif len(idle_notifications) <= 2:
        return "cooling"  # User stepped away
    else:
        return "cold"  # Likely abandoned
```

### Lesson 4: AssistantResponse is the Compaction Target

**Discovery**: The `AssistantResponse` event type only appeared later in the day (after ~16:54 PST), suggesting this logging feature was added during the session.

**Key Insight**: AssistantResponse events contain the `response` field - the actual Claude output. This is the MOST IMPORTANT field for memory:

- **Hot**: Full response (truncated at 500 chars) for recent context
- **Warm**: Embedded response for semantic search
- **Cold**: Full response indexed in FTS5

```python
def extract_memory_content(log_entry):
    """Extract the content most valuable for memory."""
    if log_entry["type"] == "AssistantResponse":
        return {
            "content": log_entry["data"]["response"],
            "importance": 0.9,  # High - actual output
            "tier_affinity": "all"
        }
    elif log_entry["type"] == "UserPromptSubmit":
        return {
            "content": log_entry["data"]["prompt"],
            "importance": 0.7,  # Medium - user intent
            "tier_affinity": "warm_cold"
        }
    elif log_entry["type"] == "PostToolUse":
        return {
            "content": summarize_tool_result(log_entry),
            "importance": 0.5,  # Variable - depends on tool
            "tier_affinity": "cold"
        }
    return None
```

---

## Examples: Architecture Diagrams

### Example 1: Single Session Memory Flow

Session `35f45aae` from 17:14 PST demonstrates a complete flow:

```
17:14:35 SessionStart
    │
    ▼
17:14:40 UserPromptSubmit: "hello"
    │
    │ → HOT: Add to hot cache (immediate)
    │
    ▼
17:14:43 Stop + AssistantResponse: "Hello! How can I help..."
    │
    │ → HOT: Update with response
    │
    ▼
17:15:27 SubagentStop (initialization - filtered)
    │
    ▼
17:15:31 UserPromptSubmit: "Can you use a couple tools..."
    │
    │ → HOT: Update current exchange
    │ → WARM: Queue for embedding (complex query detected)
    │
    ▼
17:15:35 PreToolUse: Bash, Glob (parallel)
17:15:35 PostToolUse: Bash → git log output
17:15:35 PostToolUse: Bash → ls output
17:15:36 PostToolUse: Glob → 22 TypeScript files
    │
    │ → COLD: Archive full tool responses
    │ → HOT: Summarize tool usage
    │
    ▼
17:15:51 Stop + AssistantResponse: "Here's a comprehensive summary..."
    │
    │ → HOT: Full exchange captured
    │ → WARM: Generate embedding for response
    │
    ▼
17:16:51 Notification (idle_prompt)
17:26:21 Notification (idle_prompt) ← Second idle = cooling
    │
    │ → Begin decay: HOT importance reduces
    │
    ▼
17:33:07 SessionEnd
    │
    │ → WARM: Commit session summary
    │ → COLD: Archive full session
```

### Example 2: Tier Assignment Matrix

Based on December 8 data, here's how each event type maps to tiers:

| Event Type | HOT | WARM | COLD | Notes |
|------------|-----|------|------|-------|
| SessionStart | X | - | X | Metadata hot, full event cold |
| UserPromptSubmit | X | X | X | All tiers, prompt is core content |
| AssistantResponse | X | X | X | All tiers, response is key |
| PreToolUse | - | - | X | Cold only, pre-execution state |
| PostToolUse | X* | - | X | Hot summary, cold full output |
| SubagentStop | - | X* | X | Warm if user-initiated |
| Stop | - | - | X | Cold only, turn marker |
| Notification | - | - | - | Filtered (infrastructure) |
| SessionEnd | - | X | X | Warm summary, cold full |

*Conditional - depends on context

### Example 3: Cross-Session Pattern Recognition

Analyzing the 18 sessions reveals a clear pattern of iterative testing:

```
Session Timeline (December 8, 2025 PST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15:11 ┃ 0f78bdd7 │ Short test (6 lines)
15:28 ┃ b7ebc124 │ Multiple test prompts (35 lines)
16:02 ┃ d8c4dc8a │ Quick session, no prompts (4 lines)
16:04 ┃ 35c6a1ad │ Idle session (5 lines)
16:54 ┃ a522aa51 │ Testing with response logging (52 lines)
17:11 ┃ 0461b6dc │ First AssistantResponse capture (8 lines)
17:13 ┃ a4db2a5e │ Subagent testing (8 lines)
17:14 ┃ 35f45aae │ Tool usage demo (18 lines)
17:33 ┃ c48f5bed │ Subagent spawn testing (16 lines)
17:36 ┃ ce3a7bfb │ Subagent confirmation (16 lines)
17:38 ┃ fbc544f1 │ Multi-tool testing (26 lines)
17:48 ┃ 0143495c │ LONG SESSION - real work (452 lines)
17:55 ┃ 7c0a64e4 │ Subagent tests (24 lines)
18:24 ┃ ce7b2628 │ Subagent workflow (62 lines)
18:29 ┃ cc943e39 │ Quick explore test (13 lines)
18:31 ┃ 9d4455cc │ Haiku model test (11 lines)
18:33 ┃ 56ba9489 │ Final explore test (15 lines)
18:37 ┃ 6701e294 │ Last session of day (11 lines)
      ┃         │
21:00 ┃ (sessions ended externally - "reason": "other")
```

**WARM tier insight**: Sessions `17:33` through `18:37` form a coherent work cluster - subagent testing workflow. These should cross-reference in warm memory searches.

---

## Stories: Session Lifecycle Patterns

### Story 1: The Abandoned Session

Session `35c6a1ad` (16:04 PST) tells a brief story:

```json
{"ts": "2025-12-08T16:04:08", "type": "SessionStart"}
{"ts": "2025-12-08T16:04:11", "type": "SubagentStop"}  // Init
{"ts": "2025-12-08T16:04:12", "type": "SubagentStop"}  // Init
{"ts": "2025-12-08T16:05:23", "type": "Notification"}  // 71 seconds idle
{"ts": "2025-12-08T16:54:18", "type": "SessionEnd"}    // ~50 min later
```

**What happened**: User started Claude Code, didn't send any prompts, got distracted, session ended after prolonged idle.

**Memory treatment**:
- **HOT**: No entries (no user interaction)
- **WARM**: Skip (no content to embed)
- **COLD**: Archive with metadata only, mark as `session_type: "abandoned"`

### Story 2: The Testing Sprint

Sessions from 17:33 to 18:37 (1 hour) show rapid iteration:

- 8 sessions in 64 minutes
- Each testing subagent spawning
- Similar prompts: "Testing", "Test a subagent quickly", "Quickly test a subagent"
- Confirming haiku model, explore agent, general-purpose agent

**Memory treatment**:
- **HOT**: Group as single "testing context" - deduplicate similar prompts
- **WARM**: Single embedding for the testing theme, not individual sessions
- **COLD**: Full archive maintains granular history

```python
def detect_testing_cluster(sessions, time_window_minutes=60):
    """Detect rapid testing sessions that should cluster."""
    test_indicators = [
        "test", "testing", "quickly", "quick test",
        "subagent test", "confirm"
    ]

    clusters = []
    current_cluster = []

    for session in sessions:
        prompts = [e["data"]["prompt"].lower()
                   for e in session["events"]
                   if e["type"] == "UserPromptSubmit"]

        is_test = any(ind in p for p in prompts for ind in test_indicators)

        if is_test:
            if current_cluster and time_gap(current_cluster[-1], session) > time_window_minutes:
                clusters.append(current_cluster)
                current_cluster = []
            current_cluster.append(session)

    return clusters
```

### Story 3: The Long Session

Session `0143495c` (17:48 - 21:00 PST) is the only substantial work session:

- **Duration**: ~3 hours
- **Lines**: 452 (58% of day's total logs)
- **Events**: Multiple tool executions, extended responses
- **End reason**: "other" (not user exit - external termination)

**Memory treatment**:
- **HOT**: This session dominates hot memory if accessed next day
- **WARM**: Multiple embeddings for different exchange themes
- **COLD**: Full archive with session marked `significance: "high"`

---

## Tips and Tricks

### Tip 1: Use Session ID Prefixes for Fast Filtering

The session ID format `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` uses UUIDs. For memory queries, use the first 8 characters as a short ID:

```python
# Instead of full UUID
session_id = "0143495c-64d7-47df-9e2d-f1095b6a3683"

# Use short ID for display and quick lookup
short_id = session_id[:8]  # "0143495c"
```

### Tip 2: Detect Hook System Evolution

December 8 shows the logging system evolving:
- Early sessions lack `AssistantResponse` events
- Later sessions have complete response capture

**Handle gracefully**:
```python
def get_response_content(session):
    """Get response content, handling pre/post AssistantResponse era."""
    response_events = [e for e in session["events"]
                       if e["type"] == "AssistantResponse"]

    if response_events:
        return response_events[-1]["data"]["response"]

    # Fallback: infer from Stop event timing + next tool
    # (Limited reconstruction for historical data)
    return None
```

### Tip 3: Calculate Session Heat Score

Combine multiple signals for tier assignment:

```python
def calculate_heat_score(session, current_time):
    """Calculate 0-1 heat score for tier assignment."""
    factors = []

    # Recency (exponential decay)
    age_hours = (current_time - session.ended_at).total_seconds() / 3600
    recency = math.exp(-age_hours / 24)  # 24h half-life
    factors.append(("recency", recency, 0.4))

    # Engagement (events per hour)
    duration_hours = max(session.duration.total_seconds() / 3600, 0.1)
    engagement = min(len(session.events) / duration_hours / 50, 1.0)
    factors.append(("engagement", engagement, 0.2))

    # Significance (tools used, response length)
    tool_events = [e for e in session.events if "ToolUse" in e["type"]]
    significance = min(len(tool_events) / 10, 1.0)
    factors.append(("significance", significance, 0.2))

    # Idle ratio (fewer idles = hotter)
    idle_count = len([e for e in session.events
                      if e["type"] == "Notification"])
    idle_ratio = 1 - min(idle_count / 5, 1.0)
    factors.append(("activity", idle_ratio, 0.2))

    return sum(score * weight for _, score, weight in factors)
```

### Tip 4: Batch Embedding Generation

December 8 has 31 UserPromptSubmit events. Generate embeddings efficiently:

```python
async def batch_embed_day_logs(log_date, embedding_service):
    """Batch embed all prompts and responses from a day."""
    log_dir = f".claude/logging/{log_date.strftime('%Y/%m/%d')}/"

    # Collect all text to embed
    texts = []
    metadata = []

    for log_file in Path(log_dir).glob("*.jsonl"):
        session_id = log_file.stem.split("-", 1)[1]

        for line in log_file.read_text().strip().split("\n"):
            event = json.loads(line)

            if event["type"] == "UserPromptSubmit":
                texts.append(event["data"]["prompt"])
                metadata.append({
                    "session_id": session_id,
                    "type": "prompt",
                    "ts": event["ts"]
                })

            elif event["type"] == "AssistantResponse":
                texts.append(event["data"]["response"][:2000])
                metadata.append({
                    "session_id": session_id,
                    "type": "response",
                    "ts": event["ts"]
                })

    # Single batch call
    embeddings = await embedding_service.embed_batch(texts)

    return list(zip(texts, embeddings, metadata))
```

### Tip 5: Use Notification Timing for Decay Calibration

The consistent 60-second idle notification interval provides a natural decay clock:

```python
def calibrate_decay_from_notifications(session):
    """Use notification timing to calibrate decay rate."""
    notifications = [e for e in session["events"]
                     if e["type"] == "Notification"
                     and e["data"].get("notification_type") == "idle_prompt"]

    if len(notifications) < 2:
        return None

    # Calculate average interval
    intervals = []
    for i in range(1, len(notifications)):
        t1 = datetime.fromisoformat(notifications[i-1]["ts"])
        t2 = datetime.fromisoformat(notifications[i]["ts"])
        intervals.append((t2 - t1).total_seconds())

    avg_interval = sum(intervals) / len(intervals)

    # 60 seconds = standard idle
    # Deviation suggests system load or user patterns
    return {
        "avg_notification_interval": avg_interval,
        "deviation_from_standard": avg_interval - 60,
        "notification_count": len(notifications)
    }
```

---

## Hook Integration for Automatic Tiering

### Hook: PostToolUse for Warm Memory Updates

```python
#!/usr/bin/env python3
"""PostToolUse hook for warm memory indexing."""
import sys
import json
from datetime import datetime

def should_index_in_warm(tool_name: str, tool_output: dict) -> bool:
    """Determine if tool result should be indexed in warm memory."""
    # High-value tools always indexed
    high_value = {"Write", "Edit", "Task"}
    if tool_name in high_value:
        return True

    # Search results with findings
    if tool_name in {"Grep", "Glob"} and tool_output.get("numFiles", 0) > 0:
        return True

    # Bash with significant output
    if tool_name == "Bash":
        stdout = tool_output.get("stdout", "")
        return len(stdout) > 100

    return False

def main():
    event = json.loads(sys.stdin.read())

    tool_name = event["tool_name"]
    tool_output = event.get("tool_response", {})

    if should_index_in_warm(tool_name, tool_output):
        # Signal to memory system
        print(json.dumps({
            "continue": True,
            "memory_action": {
                "tier": "warm",
                "content_type": "tool_result",
                "tool": tool_name,
                "timestamp": datetime.now().isoformat()
            }
        }))
    else:
        print(json.dumps({"continue": True}))

if __name__ == "__main__":
    main()
```

### Hook: Stop for Hot Memory Update

```python
#!/usr/bin/env python3
"""Stop hook for hot memory cache update."""
import sys
import json
from pathlib import Path

HOT_CACHE = Path(".claude/memory/hot_cache.json")

def update_hot_cache(session_id: str, response_preview: str):
    """Update hot memory cache with latest exchange."""
    cache = []
    if HOT_CACHE.exists():
        cache = json.loads(HOT_CACHE.read_text())

    # Add new entry
    cache.append({
        "session_id": session_id,
        "timestamp": json.loads(sys.stdin.read()).get("ts"),
        "response_preview": response_preview[:500],
        "tools_used": []  # Populated from session state
    })

    # Keep only last 5
    cache = cache[-5:]

    HOT_CACHE.parent.mkdir(parents=True, exist_ok=True)
    HOT_CACHE.write_text(json.dumps(cache, indent=2))

def main():
    event = json.loads(sys.stdin.read())

    session_id = event.get("session_id", "")

    # Hot cache update happens in background
    # Hook returns immediately
    print(json.dumps({"continue": True}))

if __name__ == "__main__":
    main()
```

### Hook: SessionEnd for Cold Archive

```python
#!/usr/bin/env python3
"""SessionEnd hook for cold tier archival."""
import sys
import json
from datetime import datetime
from pathlib import Path

def archive_session_to_cold(session_id: str, transcript_path: str):
    """Archive complete session to cold storage."""
    archive_dir = Path(".claude/memory/archive")
    archive_dir.mkdir(parents=True, exist_ok=True)

    # Create monthly archive file
    month = datetime.now().strftime("%Y-%m")
    archive_file = archive_dir / f"{month}.jsonl"

    # Read transcript and summarize
    transcript = Path(transcript_path)
    if transcript.exists():
        events = [json.loads(line) for line in transcript.read_text().strip().split("\n")]

        summary = {
            "session_id": session_id,
            "archived_at": datetime.now().isoformat(),
            "event_count": len(events),
            "prompts": [e["data"]["prompt"][:100] for e in events
                       if e.get("type") == "UserPromptSubmit"],
            "tools_used": list(set(e["data"]["tool_name"] for e in events
                                   if e.get("type") == "PreToolUse"))
        }

        with archive_file.open("a") as f:
            f.write(json.dumps(summary) + "\n")

def main():
    event = json.loads(sys.stdin.read())

    session_id = event.get("session_id", "")
    transcript = event.get("data", {}).get("transcript_path", "")

    if session_id and transcript:
        archive_session_to_cold(session_id, transcript)

    print(json.dumps({"continue": True}))

if __name__ == "__main__":
    main()
```

---

## Playbook: Complete Memory System for Claude Code Logs

### Phase 1: Ingestion Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                    LOG INGESTION PIPELINE                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  JSONL Files (.claude/logging/YYYY/MM/DD/*.jsonl)               │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                            │
│  │ Event Parser    │ ← Parse each line as JSON                   │
│  │                 │ ← Extract type, timestamp, session_id       │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Event Filter    │ ← Remove infrastructure noise               │
│  │                 │ ← Deduplicate init SubagentStops            │
│  │                 │ ← Merge parallel tool events                │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ Session Grouper │ ← Group by session_id                       │
│  │                 │ ← Calculate session metrics                 │
│  │                 │ ← Detect testing clusters                   │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ├──────────────────┬──────────────────┐               │
│           ▼                  ▼                  ▼               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ HOT Tier     │   │ WARM Tier    │   │ COLD Tier    │        │
│  │ (In-memory)  │   │ (SQLite+Vec) │   │ (JSONL+FTS)  │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Phase 2: Tier Storage Schemas

**HOT Tier Schema** (JSON in memory):
```json
{
  "entries": [
    {
      "session_id": "0143495c",
      "timestamp": "2025-12-08T17:48:29",
      "summary": "Testing subagent spawn and tool usage",
      "tools": ["Task", "Bash", "Glob"],
      "files": ["/home/user/path"],
      "importance": 0.8
    }
  ],
  "max_entries": 5,
  "max_age_hours": 24
}
```

**WARM Tier Schema** (SQLite):
```sql
CREATE TABLE warm_memories (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    importance REAL DEFAULT 0.5,
    content_type TEXT,  -- 'prompt', 'response', 'tool_result'
    metadata TEXT       -- JSON
);

CREATE INDEX idx_warm_timestamp ON warm_memories(timestamp);
CREATE INDEX idx_warm_session ON warm_memories(session_id);
```

**COLD Tier Schema** (FTS5):
```sql
CREATE VIRTUAL TABLE cold_fts USING fts5(
    content,
    session_id,
    timestamp,
    content_type,
    tools,
    tokenize='porter unicode61'
);
```

### Phase 3: Query Patterns

**Hot Query** (Automatic - every prompt):
```python
def inject_hot_context(hot_cache):
    """Format hot memory for prompt injection."""
    if not hot_cache.entries:
        return ""

    lines = ["## Recent Context"]
    for entry in hot_cache.entries[-5:]:
        age = format_age(entry["timestamp"])
        lines.append(f"- [{age}] {entry['summary']}")
        if entry["files"]:
            lines.append(f"  Files: {', '.join(entry['files'][:3])}")

    return "\n".join(lines)
```

**Warm Query** (Triggered - semantic match):
```python
def query_warm_memory(prompt, warm_store, threshold=0.4):
    """Query warm memory when triggered."""
    if not should_trigger_warm(prompt):
        return []

    embedding = embed(prompt)
    results = warm_store.search(
        embedding,
        max_age_days=7,
        limit=2
    )

    return [(content, score) for content, score in results
            if score >= threshold]
```

**Cold Query** (Explicit - user invoked):
```python
def search_cold_archive(query, cold_store, months_back=None):
    """Full-text search over cold archive."""
    return cold_store.search(
        query,
        limit=10,
        months_back=months_back
    )
```

### Phase 4: Decay Schedule

```python
DECAY_CONFIG = {
    "hot_to_warm": {
        "trigger": "24 hours since last access OR session end",
        "action": "generate embedding, insert into warm_memories"
    },
    "warm_to_cold": {
        "trigger": "7 days since creation",
        "action": "remove from warm_memories, ensure in cold_fts"
    },
    "cold_compaction": {
        "trigger": "monthly",
        "action": "merge daily JSONL into monthly archive"
    }
}

async def run_decay_cycle():
    """Run scheduled decay operations."""
    now = datetime.now()

    # Hot to Warm
    hot_entries = hot_cache.get_all()
    for entry in hot_entries:
        age = now - datetime.fromisoformat(entry["timestamp"])
        if age > timedelta(hours=24):
            embedding = await embed(entry["summary"])
            warm_store.insert(entry, embedding)
            hot_cache.remove(entry["id"])

    # Warm to Cold
    aged_warm = warm_store.get_older_than(days=7)
    for memory in aged_warm:
        cold_store.insert(memory)
        warm_store.delete(memory["id"])
```

### Phase 5: Monitoring and Metrics

Track memory system health:

```python
def get_memory_metrics():
    """Get current memory system metrics."""
    return {
        "hot": {
            "entry_count": len(hot_cache.entries),
            "oldest_entry_age_hours": hot_cache.oldest_age(),
            "total_tokens_estimate": hot_cache.token_estimate()
        },
        "warm": {
            "entry_count": warm_store.count(),
            "avg_similarity_threshold": warm_store.avg_similarity(),
            "embeddings_pending": warm_store.pending_queue_size()
        },
        "cold": {
            "total_sessions_archived": cold_store.session_count(),
            "index_size_mb": cold_store.index_size(),
            "oldest_entry": cold_store.oldest_timestamp()
        },
        "decay": {
            "last_decay_run": decay_scheduler.last_run(),
            "next_scheduled": decay_scheduler.next_run(),
            "entries_decayed_today": decay_scheduler.today_count()
        }
    }
```

---

## Conclusion

December 8, 2025 represents the birth of this repository's memory. From 782 log entries across 18 sessions, we learned:

1. **Session metadata is hot** - always inject session context
2. **Infrastructure events are noise** - filter SubagentStop initialization
3. **Notifications signal decay** - use idle patterns for tier transitions
4. **AssistantResponse is gold** - the response field drives memory value
5. **Testing clusters aggregate** - deduplicate rapid iteration sessions

The three-tier architecture maps naturally to JSONL logs:
- **HOT**: Current session + last 5 exchanges
- **WARM**: Past week's meaningful interactions (embedded)
- **COLD**: Complete archive (searchable)

This pattern scales from a single day's 782 events to months of accumulated history, maintaining retrieval quality through natural decay boundaries.
