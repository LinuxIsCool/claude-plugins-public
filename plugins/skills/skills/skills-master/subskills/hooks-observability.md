# Multi-Agent Observability with Hooks

Build observable multi-agent systems using Claude Code hooks. Based on disler/claude-code-hooks-multi-agent-observability.

## Source

- **Repository**: https://github.com/disler/claude-code-hooks-multi-agent-observability
- **Pattern**: Track and visualize multi-agent interactions via hooks

## Core Concept

Use Claude Code hooks to:
- Capture agent activity events
- Track tool usage across agents
- Visualize multi-agent coordination
- Build observability dashboards

## Hook Architecture

Hooks intercept Claude Code events:

| Event | When Fires | Use Case |
|-------|------------|----------|
| `PreToolUse` | Before tool execution | Validate, log intent |
| `PostToolUse` | After tool execution | Log results, metrics |
| `Stop` | Agent completes | Summarize, hand off |
| `SubagentStop` | Subagent completes | Aggregate results |
| `SessionStart` | New session begins | Initialize tracking |
| `SessionEnd` | Session terminates | Finalize logs |

## Agent Identification

Every hook event includes:
- `source_app`: Application identifier
- `session_id`: Unique session ID

**Display format**: `source_app:session_id` (truncate session_id to 8 chars)

## Hook Configuration

### hooks.json
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python ${CLAUDE_PLUGIN_ROOT}/hooks/log_tool_use.py"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python ${CLAUDE_PLUGIN_ROOT}/hooks/agent_completed.py"
          }
        ]
      }
    ]
  }
}
```

## Event Logging Pattern

### log_tool_use.py
```python
#!/usr/bin/env python3
"""Log tool usage events for observability."""

import json
import sys
from datetime import datetime

def main():
    # Hook receives event via stdin
    event = json.load(sys.stdin)

    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "source_app": event.get("source_app"),
        "session_id": event.get("session_id")[:8],
        "tool": event.get("tool_name"),
        "status": event.get("status"),
        "duration_ms": event.get("duration_ms")
    }

    # Append to JSONL log
    with open("agent_events.jsonl", "a") as f:
        f.write(json.dumps(log_entry) + "\n")

if __name__ == "__main__":
    main()
```

## Multi-Agent Tracking

### Tracking Subagents

When spawning subagents, correlate via session:

```python
def track_subagent(parent_session_id, child_session_id, task):
    relationship = {
        "parent": parent_session_id[:8],
        "child": child_session_id[:8],
        "task": task,
        "spawned_at": datetime.utcnow().isoformat()
    }
    # Store relationship for graph visualization
```

### Event Stream

```jsonl
{"ts":"2025-01-20T10:00:00Z","agent":"main:abc12345","event":"spawn","child":"explore:def67890"}
{"ts":"2025-01-20T10:00:01Z","agent":"explore:def67890","event":"tool","tool":"Glob"}
{"ts":"2025-01-20T10:00:02Z","agent":"explore:def67890","event":"tool","tool":"Read"}
{"ts":"2025-01-20T10:00:05Z","agent":"explore:def67890","event":"stop","status":"success"}
{"ts":"2025-01-20T10:00:06Z","agent":"main:abc12345","event":"received","from":"explore:def67890"}
```

## Visualization

### Real-Time Dashboard

Using event stream:
1. WebSocket server reads JSONL log
2. Frontend renders agent activity
3. Graph shows parent/child relationships
4. Timeline shows tool execution

### Agent Graph

```
main:abc12345
    ├── explore:def67890 (completed)
    ├── explore:ghi01234 (running)
    └── general:jkl56789 (pending)
```

## Output Styles

The repository includes output styles for observability:

### observable-tools-diffs.md
```yaml
## Output Style

When showing tool results:
- Show tool name and duration
- Include diff for file changes
- Summarize in structured format
```

## Skills from Repository

### meta-skill
Creates new skills following best practices. Meta-recursive pattern.

### worktree-manager-skill
Manage git worktrees for parallel development.

### create-worktree-skill
Create isolated worktrees with agent configuration.

### video-processor
Process video files with transcription.

## Key Insights

1. **Hooks for Observability**
   Every tool call can be intercepted and logged.

2. **Session Correlation**
   `source_app:session_id` uniquely identifies agents.

3. **JSONL Event Streams**
   Append-only logs enable real-time monitoring.

4. **Parent-Child Tracking**
   Map subagent relationships for coordination visibility.

5. **Output Styles**
   Customize Claude output for observability needs.
