# Agent Traceability

How to trace git commits back to agent executions.

---

## Overview

Claude Code assigns unique IDs to both sessions and agents:

| ID Type | Format | Example |
|---------|--------|---------|
| **Session ID** | Full UUID | `298311d7-dc9e-4d73-bbb3-323eaba7d29e` |
| **Agent ID** | Short hex (7-8 chars) | `a3edb0d` |

**Key constraint**: Agents cannot access their own hex ID during execution. The ID is only returned after the agent completes.

---

## Quick Start

### Option 1: Include Agent ID in Commits (Recommended)

When the main session spawns an agent and then commits its work:

```bash
# Task tool returns: agentId: a3edb0d

# Include in commit:
git commit -m "[agent:archivist/a3edb0d] observe: metabolic patterns

Session: 298311d7-dc9e-4d73-bbb3-323eaba7d29e
Intent: Daily ecosystem health check"
```

### Option 2: Query the Graph (Retroactive)

```bash
# Ingest with agent and commit data
uv run plugins/awareness/skills/temporal-kg-memory/tools/ingest_all_sessions.py --all

# Query which agent made a commit
uv run plugins/awareness/skills/temporal-kg-memory/tools/query_sessions.py commit 4e4cdd58
```

### Option 3: Use Correlation Script (Standalone)

```bash
python3 .claude/tools/correlate_commits.py
```

---

## Commit Format

### With Agent ID

```
[agent:{type}/{hex-id}] action: description

Session: {session-uuid}
Intent: {what was accomplished}
```

### Without Agent ID

```
[agent:{type}] action: description

Session: {session-uuid}
Intent: {what was accomplished}
```

### Examples

```
[agent:archivist/a3edb0d] observe: metabolic patterns
[agent:agent-architect] update: registry with new agents
[archivist:a3edb0d] snapshot: December ecosystem state
```

---

## Finding Agent Transcripts

### From Commit Message

```bash
# If commit says: [agent:archivist/a3edb0d]
cat ~/.claude/projects/-home-ygg-Workspace.../agent-a3edb0d.jsonl
```

### Via Graph Query

```bash
uv run query_sessions.py commit a3edb0d
```

Output:
```
=== Commit: a3edb0d ===

Hash: a3edb0d
Time: 2025-12-15T10:29:56-08:00
Message: [agent:agent-architect] refine: update metrics...

--- Likely Agent(s) ---
  Agent: a3edb0d (session 298311d7)
    Completed: 2025-12-15T18:29:21 (35s before commit)
    Transcript: ~/.claude/projects/.../agent-a3edb0d.jsonl
```

---

## Graph Schema

When running with `--include-agents --include-commits`:

```
(:Session)-[:SPAWNED]->(:AgentExecution)
(:Commit)-[:LIKELY_BY]->(:AgentExecution)
```

### Node Types

| Node | Properties |
|------|------------|
| `AgentExecution` | `agent_id`, `timestamp`, `session_id`, `transcript_path` |
| `Commit` | `hash`, `timestamp`, `message` |

### Edge Types

| Edge | Meaning |
|------|---------|
| `SPAWNED` | Session spawned this agent |
| `LIKELY_BY` | Commit was likely made by this agent (timestamp correlation) |

---

## Tools

### ingest_all_sessions.py

```bash
# Ingest everything
uv run ingest_all_sessions.py --all

# Or specific features
uv run ingest_all_sessions.py --include-agents --include-commits
```

### query_sessions.py

```bash
# List agent executions
uv run query_sessions.py agents

# Find agent for a commit
uv run query_sessions.py commit 4e4cdd58

# Search messages
uv run query_sessions.py search "archivist"
```

### correlate_commits.py

Standalone correlation without FalkorDB:

```bash
python3 .claude/tools/correlate_commits.py
```

---

## How Correlation Works

1. Parse git log for commits with timestamps
2. Parse SubagentStop events from logs with timestamps
3. For each commit, find agents that completed within 120 seconds before
4. The closest agent (by time) is the most likely author

Correlation accuracy: ~60% of commits match to agent activity (the rest are from main sessions without subagent involvement).

---

## When to Use Each Approach

| Situation | Approach |
|-----------|----------|
| Making a commit now | Include agent ID from Task output |
| Understanding old commit | Query the graph or use correlate_commits.py |
| Debugging agent behavior | Read transcript directly via agent ID |
| Auditing agent activity | `query_sessions.py agents` |

---

## References

- Coordination conventions: `.claude/conventions/coordination.md`
- Temporal KG skill: `plugins/awareness/skills/temporal-kg-memory/`
- Correlation tool: `.claude/tools/correlate_commits.py`
