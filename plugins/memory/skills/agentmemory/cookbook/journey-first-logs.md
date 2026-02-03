# Journey: Indexing the First Claude Code Logs with Agentmemory

*A practical exploration of using agentmemory to index Claude Code logging data from December 8, 2025 - the repository's first day of logs.*

---

## Overview

This document chronicles the journey of analyzing and designing a memory indexing strategy for 18 JSONL log files from December 8, 2025. These logs capture Claude Code hook events including sessions, tool usage, subagent activity, and user interactions.

**Log Location**: `.claude/logging/2025/12/08/`

**Data Profile**:
- 18 JSONL files
- ~1.6MB total
- Time range: 15:11 - 21:00 PST
- Event types: SessionStart, SessionEnd, UserPromptSubmit, Stop, AssistantResponse, PreToolUse, PostToolUse, SubagentStop, Notification

---

## Lessons Learned

### 1. JSONL Structure Discovery

Each log line is a self-contained JSON object with:

```json
{
  "ts": "2025-12-08T17:15:35.566082",
  "type": "PreToolUse",
  "session_id": "35f45aae-fd4d-44dc-9c15-9b25feaa1397",
  "data": {
    "tool_name": "Bash",
    "tool_input": {"command": "git log --oneline -5"},
    "tool_use_id": "toolu_012L7KcyC8AF2HwnpsLZ4SQ4"
  }
}
```

**Lesson**: The `type` field is the natural category for agentmemory. Create memories per event type for targeted semantic search.

### 2. Session Boundaries Matter

Sessions have clear lifecycle events:
- `SessionStart` with `source: "startup"` marks new sessions
- `SessionEnd` with `reason: "prompt_input_exit"` or `reason: "other"` marks termination

**Lesson**: Index session metadata separately from event content. Sessions provide temporal context that helps interpret individual events.

### 3. Large Files Require Streaming

Two files exceeded 25,000 tokens:
- `16-54-20-a522aa51.jsonl` (~56K tokens)
- `17-48-29-0143495c.jsonl` (~49K tokens)

These contain extended sessions with parallel subagent research tasks.

**Lesson**: Process large log files line-by-line rather than loading entire files. Agentmemory's `create_memory` is fast (<10ms) so streaming works well.

### 4. Tool Response Data is Valuable

PostToolUse events contain complete tool responses:

```json
{
  "type": "PostToolUse",
  "data": {
    "tool_name": "Glob",
    "tool_response": {
      "filenames": ["...57 Python files..."],
      "durationMs": 294
    }
  }
}
```

**Lesson**: Index tool responses with high priority - they represent concrete work products and codebase discoveries.

### 5. Subagent Patterns Emerge

Sessions frequently spawn 2-3 subagents at startup via hooks, plus user-triggered subagents:

```
SessionStart -> SubagentStop (hook 1) -> SubagentStop (hook 2) -> UserPromptSubmit
```

**Lesson**: The `agent_id` field enables linking subagent work to parent sessions. Index this relationship for later retrieval.

---

## Examples: Indexing Claude Code Logs

### Basic Event Indexing

```python
import json
from agentmemory import create_memory, search_memory
from datetime import datetime

def index_log_file(filepath: str):
    """Index a single JSONL log file into agentmemory."""
    with open(filepath, 'r') as f:
        for line in f:
            if not line.strip():
                continue

            event = json.loads(line)

            # Use event type as category
            category = f"claude_code_{event['type'].lower()}"

            # Build searchable text
            text = build_event_text(event)

            # Extract useful metadata
            metadata = {
                "ts": event["ts"],
                "session_id": event.get("session_id"),
                "type": event["type"],
                "source_file": filepath
            }

            create_memory(
                category=category,
                text=text,
                metadata=metadata
            )

def build_event_text(event: dict) -> str:
    """Convert event to searchable text."""
    event_type = event["type"]
    data = event.get("data", {})

    if event_type == "UserPromptSubmit":
        return f"User prompt: {data.get('prompt', '')}"

    elif event_type == "AssistantResponse":
        return f"Assistant response: {data.get('response', '')}"

    elif event_type == "PreToolUse":
        tool = data.get("tool_name", "unknown")
        tool_input = json.dumps(data.get("tool_input", {}))
        return f"Tool call: {tool} with input: {tool_input}"

    elif event_type == "PostToolUse":
        tool = data.get("tool_name", "unknown")
        response = json.dumps(data.get("tool_response", {}))[:500]
        return f"Tool result: {tool} returned: {response}"

    elif event_type == "SubagentStop":
        agent_id = data.get("agent_id", "unknown")
        return f"Subagent completed: {agent_id}"

    elif event_type == "SessionStart":
        return f"Session started from {data.get('source', 'unknown')}"

    elif event_type == "SessionEnd":
        return f"Session ended: {data.get('reason', 'unknown')}"

    else:
        return f"Event: {event_type}"
```

### Category-Based Organization

```python
# Create specialized categories for different use cases

CATEGORIES = {
    # Core interaction
    "user_prompts": "User messages and requests",
    "assistant_responses": "Claude's responses to users",

    # Tool activity
    "tool_calls": "Tool invocations with inputs",
    "tool_results": "Tool execution results",

    # Session management
    "sessions": "Session lifecycle events",

    # Multi-agent
    "subagents": "Subagent spawn and completion",
}

def index_by_role(event: dict):
    """Index events into role-appropriate categories."""
    event_type = event["type"]

    if event_type == "UserPromptSubmit":
        category = "user_prompts"
    elif event_type == "AssistantResponse":
        category = "assistant_responses"
    elif event_type == "PreToolUse":
        category = "tool_calls"
    elif event_type == "PostToolUse":
        category = "tool_results"
    elif event_type in ("SessionStart", "SessionEnd"):
        category = "sessions"
    elif event_type == "SubagentStop":
        category = "subagents"
    else:
        category = "other_events"

    text = build_event_text(event)
    create_memory(category=category, text=text, metadata={"type": event_type})
```

### Searching Indexed Logs

```python
# Find relevant tool usage
results = search_memory(
    category="tool_calls",
    query="find Python files in repository",
    n_results=5
)

# Find user requests about subagents
results = search_memory(
    category="user_prompts",
    query="test subagent",
    n_results=10
)

# Find assistant explanations
results = search_memory(
    category="assistant_responses",
    query="plugin architecture overview",
    n_results=3
)
```

### Deduplication for Repeated Events

The logs show many repeated test prompts:

```python
from agentmemory import create_unique_memory

# Avoid storing identical test messages
create_unique_memory(
    category="user_prompts",
    text="User prompt: test",
    similarity_threshold=0.95  # Very high - nearly exact match
)
```

---

## Stories: Patterns in the First Day's Logs

### Story 1: The Testing Phase (15:00 - 16:00)

The first few sessions show a developer testing the logging hook system:

```
Session 0f78bdd7: "test" -> Stop
Session b7ebc124: "Test", "How are you?", "Testing", "Testing again."
Session d8c4dc8a: Quick exit (no user prompt)
Session 35c6a1ad: Idle, then exit
```

**Pattern**: Short sessions with minimal prompts indicate hook testing, not productive work.

**Memory Strategy**: Tag these with `{"purpose": "testing"}` to filter them out of normal searches.

### Story 2: The First Real Work (17:15)

Session `35f45aae` shows the first substantive interaction:

```
User: "Can you use a couple tools and give me a decently long response
       (like 50 lines) that I can use to test logging?"

Tools used: Bash (git log), Bash (ls -la), Glob (**/*.ts)
```

The assistant discovered 22 TypeScript files across two projects:
- claude-code-hooks-mastery
- claude-code-hooks-multi-agent-observability

**Pattern**: Tool responses contain codebase structure information. The Glob results show the project architecture.

**Memory Strategy**: Index PostToolUse events with file lists as high-value memories for codebase navigation.

### Story 3: The Subagent Orchestra (17:33 - 17:38)

Multiple sessions demonstrate subagent testing:

```
Session c48f5bed: "Testing logging can you spin up a quick subagent?"
  -> Task tool spawns haiku model subagent (agent_id: 40a352ca)
  -> Subagent confirms: "Subagent test successful!"

Session ce3a7bfb: "Testing. Please use a small subagent."
  -> Two sequential subagent tests
  -> agent_id: a45a219e, 2d962622
```

**Pattern**: Subagent spawning follows PreToolUse (Task) -> SubagentStop -> PostToolUse (Task result) sequence.

**Memory Strategy**: Create cross-referenced memories linking:
- Parent session_id
- Subagent agent_id
- Task description
- Completion status

### Story 4: The Parallel Research (17:54)

The largest session (`17-48-29-0143495c`) shows parallel subagent research:

```
User: "Can you have 5 parallel subagents research how to achieve
       hot reloading with plugins?"

Response: Spawns 5 background subagents:
  - aa310459: Research plugin command implementation
  - 834d8cfc: Research Claude Code settings/config
  - 144d790f: Research Claude Code hooks system
  - b899fce7: Research Python hot reload techniques
  - 331b96e9: Research file watcher hook approach
```

**Pattern**: Background subagents (`run_in_background: true`) appear as async launches, not blocking.

**Memory Strategy**: Index parallel research patterns with linked agent IDs and research topics for later recall.

---

## Tips and Tricks

### 1. Timestamp Parsing

```python
from datetime import datetime

def parse_log_timestamp(ts_string: str) -> datetime:
    """Parse JSONL timestamp to datetime."""
    return datetime.fromisoformat(ts_string)

# Example: "2025-12-08T17:15:35.566082" -> datetime object
```

### 2. Session Grouping

```python
from collections import defaultdict

def group_events_by_session(events: list) -> dict:
    """Group events by session_id for context-aware indexing."""
    sessions = defaultdict(list)
    for event in events:
        sid = event.get("session_id")
        if sid:
            sessions[sid].append(event)
    return dict(sessions)
```

### 3. Tool Chain Reconstruction

```python
def extract_tool_chain(session_events: list) -> list:
    """Extract the sequence of tools used in a session."""
    tools = []
    for event in session_events:
        if event["type"] == "PreToolUse":
            tools.append({
                "tool": event["data"]["tool_name"],
                "input": event["data"]["tool_input"],
                "ts": event["ts"]
            })
    return tools
```

### 4. Conversation Extraction

```python
def extract_conversation(session_events: list) -> list:
    """Extract user-assistant exchanges from session."""
    conversation = []
    for event in session_events:
        if event["type"] == "UserPromptSubmit":
            conversation.append({
                "role": "user",
                "content": event["data"]["prompt"],
                "ts": event["ts"]
            })
        elif event["type"] == "AssistantResponse":
            conversation.append({
                "role": "assistant",
                "content": event["data"]["response"],
                "ts": event["ts"]
            })
    return conversation
```

### 5. Memory Enrichment

```python
def enrich_memory_text(event: dict, session_context: dict) -> str:
    """Add session context to memory text for better retrieval."""
    base_text = build_event_text(event)

    # Add session duration context
    session_start = session_context.get("start_ts")
    event_ts = event["ts"]

    if session_start:
        # Add relative timing
        base_text += f" (occurred {event_ts} in session)"

    # Add tool count context
    tool_count = session_context.get("tool_count", 0)
    if tool_count > 0:
        base_text += f" (session used {tool_count} tools)"

    return base_text
```

---

## Playbook: Indexing Claude Code Logs

### Step 1: Discover Log Files

```python
import glob
import os

LOG_BASE = ".claude/logging"

def discover_log_files(date_folder: str = None) -> list:
    """Find all JSONL log files, optionally filtered by date."""
    if date_folder:
        pattern = os.path.join(LOG_BASE, date_folder, "*.jsonl")
    else:
        pattern = os.path.join(LOG_BASE, "**", "*.jsonl")

    return sorted(glob.glob(pattern, recursive=True))

# Example: Find all logs from December 8, 2025
files = discover_log_files("2025/12/08")
print(f"Found {len(files)} log files")  # 18 files
```

### Step 2: Parse and Validate

```python
import json

def parse_log_file(filepath: str) -> list:
    """Parse JSONL file with error handling."""
    events = []
    with open(filepath, 'r') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                events.append(event)
            except json.JSONDecodeError as e:
                print(f"Warning: Line {line_num} in {filepath}: {e}")
    return events
```

### Step 3: Categorize Events

```python
EVENT_CATEGORIES = {
    "UserPromptSubmit": "user_prompts",
    "AssistantResponse": "assistant_responses",
    "PreToolUse": "tool_calls",
    "PostToolUse": "tool_results",
    "SessionStart": "sessions",
    "SessionEnd": "sessions",
    "SubagentStop": "subagents",
    "Notification": "notifications",
    "Stop": "turn_boundaries",
}

def categorize_event(event: dict) -> str:
    """Map event type to agentmemory category."""
    event_type = event.get("type", "unknown")
    return EVENT_CATEGORIES.get(event_type, "other_events")
```

### Step 4: Build Memory Text

```python
def build_searchable_text(event: dict) -> str:
    """Create semantic-search-optimized text from event."""
    event_type = event["type"]
    data = event.get("data", {})

    builders = {
        "UserPromptSubmit": lambda d: f"User asked: {d.get('prompt', '')}",
        "AssistantResponse": lambda d: f"Claude responded: {d.get('response', '')[:1000]}",
        "PreToolUse": lambda d: f"Called {d.get('tool_name')} tool",
        "PostToolUse": lambda d: f"Tool {d.get('tool_name')} returned results",
        "SubagentStop": lambda d: f"Subagent {d.get('agent_id')} completed task",
        "SessionStart": lambda d: f"New Claude Code session started",
        "SessionEnd": lambda d: f"Session ended: {d.get('reason', 'unknown')}",
    }

    builder = builders.get(event_type, lambda d: f"Event: {event_type}")
    return builder(data)
```

### Step 5: Index with Deduplication

```python
from agentmemory import create_unique_memory

def index_event(event: dict, similarity_threshold: float = 0.85):
    """Index single event with duplicate prevention."""
    category = categorize_event(event)
    text = build_searchable_text(event)

    metadata = {
        "ts": event.get("ts"),
        "session_id": event.get("session_id"),
        "event_type": event.get("type"),
    }

    # Add type-specific metadata
    data = event.get("data", {})
    if "tool_name" in data:
        metadata["tool_name"] = data["tool_name"]
    if "agent_id" in data:
        metadata["agent_id"] = data["agent_id"]

    create_unique_memory(
        category=category,
        text=text,
        metadata=metadata,
        similarity_threshold=similarity_threshold
    )
```

### Step 6: Batch Index All Files

```python
def index_all_logs(date_folder: str, verbose: bool = True):
    """Index all logs from a date folder."""
    files = discover_log_files(date_folder)

    total_events = 0
    for filepath in files:
        events = parse_log_file(filepath)
        for event in events:
            index_event(event)
            total_events += 1

        if verbose:
            print(f"Indexed {len(events)} events from {os.path.basename(filepath)}")

    print(f"Total: {total_events} events indexed from {len(files)} files")

# Index all December 8, 2025 logs
index_all_logs("2025/12/08")
```

### Step 7: Query Your Memories

```python
from agentmemory import search_memory

# Find what tools were used for Python file discovery
results = search_memory(
    category="tool_calls",
    query="find Python files",
    n_results=5
)

for r in results:
    print(f"[{r['metadata']['ts']}] {r['document']}")

# Find subagent research tasks
results = search_memory(
    category="subagents",
    query="hot reload research",
    n_results=10
)

# Find session patterns
results = search_memory(
    category="sessions",
    query="testing hook system",
    n_results=5
)
```

---

## Conclusion

Indexing Claude Code logs with agentmemory provides:

1. **Semantic search** over historical interactions
2. **Pattern discovery** across sessions
3. **Tool usage recall** for similar future tasks
4. **Subagent coordination tracking**
5. **Session context preservation**

The December 8, 2025 logs reveal a day of hook system development, subagent testing, and parallel research - all now searchable as semantic memories.

**Next steps**:
- Build a daily indexing cron job
- Create specialized categories for different work patterns
- Add memory decay for old test sessions
- Build a CLI for log search

---

*Document created: January 20, 2026*
*Log data source: December 8, 2025 (18 JSONL files, 1.6MB)*