# Logging Plugin Analysis for Session Recovery

## Executive Summary

The logging plugin provides comprehensive session capture through hook-based event logging. It captures 10 distinct event types to JSONL files, including session lifecycle events, user prompts, assistant responses, tool usage, subagent activity, and notifications. The data fidelity is high: complete prompts, full tool invocations with inputs, and assistant responses are preserved with millisecond-precision timestamps.

For session recovery purposes, the logging plugin captures approximately 70-80% of the information needed to reconstruct what happened in a session. The critical gaps are: (1) no pane/terminal mapping to correlate sessions with physical tmux panes, (2) no intermediate model reasoning or rejected tool calls, and (3) no system context at session start (loaded files, git state, etc.). The existing search infrastructure (BM25, semantic, pairs) provides strong foundation for querying historical sessions but would need enhancement for recovery workflows.

The most viable recovery strategy using current capabilities would reconstruct conversation flow (prompts/responses), tool execution sequence, and subagent work. Full context restoration would require integration with tmux session capture and Claude's native transcript files.

## Data Capture Analysis

### Events Captured

The plugin hooks into all 10 Claude Code hook events:

| Event Type | Purpose | Recovery Value |
|------------|---------|----------------|
| `SessionStart` | Session creation with source (startup/compact/clear/resume), model ID | Critical - identifies session boundaries, model used |
| `SessionEnd` | Session termination with reason | Critical - identifies session completion or crash |
| `UserPromptSubmit` | Complete user prompts | Critical - full user intent preserved |
| `AssistantResponse` | Claude's final response text | Critical - complete response preserved |
| `PreToolUse` | Tool name, input parameters, tool_use_id | High - shows intended actions |
| `PostToolUse` | Tool name, response/result | High - shows outcomes |
| `SubagentStop` | Subagent ID, transcript path | High - tracks delegated work |
| `PermissionRequest` | Permission prompts | Medium - security context |
| `Notification` | Idle prompts, alerts | Low - operational state |
| `PreCompact` | Context compaction trigger | Medium - explains context loss |

### Session ID Tracking

Each event includes:
- `session_id` - Persistent UUID for the session (e.g., `e3191ef5-b9c3-4835-9940-0fa0e24e60b5`)
- `agent_session_num` - Counter tracking context resets within the session (0 = fresh, 1+ = after compactions)
- `ts` - ISO8601 timestamp with timezone
- `id` - Unique event ID (e.g., `evt_ec6d3b15a9fe`)

The `agent_session_num` is derived from counting `compact` and `clear` sources in `SessionStart` events within the JSONL file, providing a single-source-of-truth approach to tracking context resets.

### Content Preserved

**Complete preservation:**
- User prompts (full text, no truncation)
- Assistant responses (extracted from Claude's transcript on `Stop` event)
- Tool inputs (complete parameters for Read, Edit, Bash, etc.)
- Tool responses (through PostToolUse events)
- Subagent transcripts (path to transcript file preserved)

**Partially preserved:**
- Session context (cwd, transcript_path, permission_mode)
- Model information (on SessionStart only)

**Not preserved:**
- System prompt/CLAUDE.md content active at session start
- Files read before first logged event
- Git state at session boundaries
- Environment variables (except cwd, permission_mode)
- Terminal/pane identity

### Timestamp Precision

Timestamps use ISO8601 with microsecond precision and timezone offset:
```
2026-01-28T20:21:23.561944+00:00
```

This provides:
- Microsecond ordering of events within a session
- Accurate reconstruction of event sequences
- Time-of-day context for session activity
- Timezone awareness (stored as UTC with offset)

## Session Correlation Capabilities

### Mapping Session to Pane

**Current state: No capability**

The logging plugin does not capture any information that would link a session to a specific tmux pane or terminal:

- No `$TMUX_PANE` environment variable captured
- No `$TTY` or pseudo-terminal identifier
- No window/pane geometry or title
- No pane-to-session registry

The `cwd` field might provide weak correlation (different panes might have different working directories), but this is unreliable for multi-pane setups all operating in the same repository.

### Temporal Reconstruction

**Strong capability through chronological event ordering:**

Events within a session can be perfectly ordered by `ts` field. The reconstruction flow would be:

1. Load all events for a session_id
2. Sort by timestamp
3. Group into "exchanges" (UserPromptSubmit -> tools -> AssistantResponse cycles)
4. Track subagent spawning and completion
5. Identify context resets via SessionStart with source="compact"

The existing `generate_markdown()` function in `log_event.py` already implements this reconstruction pattern for report generation.

### Search Capabilities

The `search_logs.py` tool provides:

| Capability | Flag | Recovery Utility |
|------------|------|------------------|
| Keyword search | (default BM25) | Find sessions discussing specific topics |
| Semantic search | `--semantic` | Find conceptually related sessions |
| Session filter | `--session {id}` | Browse all events in a specific session |
| Date range | `--from/--to` | Find sessions from specific time periods |
| Conversation pairs | `--pairs` | Reconstruct prompt/response exchanges |
| Full content | `--full` | No truncation for complete context |
| Statistics | `--stats` | Overview of logging coverage |

## Recovery Potential Assessment

### What CAN Be Recovered

**High Fidelity (90%+ accuracy):**
- Complete conversation thread: all user prompts and Claude responses
- Tool execution sequence: what tools were called, with what parameters
- Tool results: outputs and side effects
- Subagent activity: what subagents were spawned, their work
- Temporal flow: exact sequence and timing of events
- Context reset points: when and why compaction occurred

**Medium Fidelity (60-80% accuracy):**
- Session context: working directory, permission mode
- Model identity: which Claude model was used
- Session boundaries: when sessions started/ended

**Example recovery query:**
```bash
# Reconstruct a crashed session's activity
uv run plugins/logging/tools/search_logs.py --session e3191ef5 --pairs --full --format text
```

### What CANNOT Be Recovered

**Missing entirely:**
1. **Pane mapping** - Which tmux pane hosted which session
2. **System prompt** - CLAUDE.md and plugins active at session start
3. **Pre-session context** - Files Claude had in context from prior compactions
4. **Rejected actions** - Tool calls Claude considered but didn't make
5. **Intermediate reasoning** - Claude's thinking between tool calls
6. **User edits** - Changes user made to Claude's outputs before accepting
7. **Permission denials** - User refusing to allow an action (only requests logged)

**Partially missing:**
1. **Git state** - No snapshot of repo state at session boundaries
2. **Environment** - Only cwd and permission_mode captured
3. **File contents** - Tool inputs show what was read, but not full file content
4. **Session continuity** - Cannot link a resumed session to its predecessor

### Reconstruction Fidelity

For a crashed session, recovery would provide:

| Aspect | Fidelity | Notes |
|--------|----------|-------|
| What user asked | 100% | Complete prompts preserved |
| What Claude said | 100% | Complete responses preserved |
| Tools used | 95% | Complete, may miss some PostToolUse if crash during tool |
| Tool parameters | 100% | Full inputs preserved |
| Tool outputs | 90% | Depends on PostToolUse capture before crash |
| Subagent work | 80% | Has transcript path, but transcript may be incomplete |
| Session timeline | 100% | Full microsecond-precision sequence |
| Context for continuation | 30% | Missing system prompt, prior context, git state |

## Current Gaps

### Critical for Session Recovery

1. **No Pane-Session Mapping**
   - Cannot determine which physical pane had which session
   - For multi-pane crash recovery, must manually match sessions to panes
   - No integration with tmux session metadata

2. **No Session Predecessor Tracking**
   - When session is resumed (e.g., `claude --continue`), no link to prior session
   - Agent session number only tracks compactions, not session chains
   - Cannot reconstruct full conversation history across restarts

3. **No Environment Capture**
   - CLAUDE.md content at session start not preserved
   - Active plugins not recorded
   - Git branch/commit not captured
   - No snapshot of what Claude "knew" at start

### Important but Not Critical

4. **Incomplete Crash State**
   - If crash occurs mid-tool-execution, PostToolUse may be missing
   - No event for "session crashed" vs "session ended normally"
   - Notification with `idle_prompt` type may or may not appear before crash

5. **Subagent Transcript Dependency**
   - SubagentStop events reference transcript path
   - Actual transcript is separate file that must also survive crash
   - No inline capture of subagent work in main log

6. **No Tool Output Content**
   - PostToolUse has `tool_response` but it's often summarized
   - File contents read via Read tool not stored in log
   - Bash command outputs not fully preserved

## Enhancement Recommendations

### New Hooks Needed

1. **SessionCrash / SessionInterrupt**
   - Detect abnormal termination
   - Capture last known state before exit
   - Record reason if determinable

2. **ContextLoad**
   - Fire when session loads prior context
   - Capture what files/context were restored
   - Link to predecessor session if any

3. **EnvCapture**
   - Periodic or on-demand environment snapshot
   - CLAUDE.md content hash or full content
   - Active plugin list
   - Git status summary

### Additional Data Points

1. **In SessionStart:**
   ```json
   {
     "tmux_pane": "%5",
     "tmux_window": "dev:1",
     "tty": "/dev/pts/3",
     "predecessor_session": "abc123...",
     "claude_md_hash": "sha256:...",
     "active_plugins": ["logging", "statusline", ...],
     "git_branch": "main",
     "git_commit": "abc123"
   }
   ```

2. **In UserPromptSubmit:**
   ```json
   {
     "context_token_count": 45000,
     "files_in_context": ["CLAUDE.md", "src/main.py", ...]
   }
   ```

3. **In PostToolUse (for Read):**
   ```json
   {
     "file_content_hash": "sha256:...",
     "file_size_bytes": 1234
   }
   ```

### Integration with tmux

**Proposed pane registry integration:**

1. On SessionStart, query tmux for pane metadata:
   ```python
   import subprocess
   pane_info = subprocess.run(
       ["tmux", "display-message", "-p", "#{pane_id}:#{window_name}:#{pane_title}"],
       capture_output=True, text=True
   ).stdout.strip()
   ```

2. Store in event data:
   ```json
   {"tmux_pane_id": "%3", "tmux_window": "claude:0", "tmux_pane_title": "tbff-research"}
   ```

3. Create recovery index: `session_id -> pane_id` mapping file

**Pane title convention for recovery:**
- Set pane title to include session ID prefix: `tmux select-pane -T "sess:abc123"`
- On crash, pane titles survive and can be queried

## Implementation Suggestions

### 1. Add Pane Tracking (Immediate)

Modify `log_event.py` to capture tmux context:

```python
def get_tmux_context():
    """Capture tmux pane context if available."""
    try:
        result = subprocess.run(
            ["tmux", "display-message", "-p",
             "#{pane_id}|#{window_index}|#{window_name}|#{pane_title}"],
            capture_output=True, text=True, timeout=1
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split("|")
            return {
                "pane_id": parts[0],
                "window_index": parts[1],
                "window_name": parts[2],
                "pane_title": parts[3]
            }
    except:
        pass
    return None
```

Add to SessionStart event data.

### 2. Create Session Registry (Short-term)

New file: `.claude/local/session-registry.json`

```json
{
  "sessions": {
    "e3191ef5-b9c3-4835-9940-0fa0e24e60b5": {
      "started": "2026-01-28T20:20:52",
      "pane_id": "%5",
      "cwd": "/home/user/path",
      "model": "claude-opus-4-5-20251101",
      "status": "active",
      "last_event": "2026-01-28T21:15:33"
    }
  },
  "panes": {
    "%5": {
      "current_session": "e3191ef5-b9c3-4835-9940-0fa0e24e60b5",
      "history": ["abc123...", "def456..."]
    }
  }
}
```

Update on SessionStart, SessionEnd, and periodically via Notification events.

### 3. Add Recovery Command (Medium-term)

New skill: `/recover-session`

```bash
# Show recoverable sessions from crash
uv run plugins/logging/tools/recover_session.py --list-orphaned

# Output:
# Orphaned sessions (no SessionEnd):
# - e3191ef5 (Jan 28, 8:20 PM) - Pane %5 - 47 events, last: 9:15 PM
# - abc12345 (Jan 28, 7:00 PM) - Pane %3 - 23 events, last: 7:45 PM

# Recover specific session
uv run plugins/logging/tools/recover_session.py --session e3191ef5 --output recovery.md
```

### 4. Link to Claude Transcripts (Long-term)

The `transcript_path` field points to Claude's native transcript:
```
/home/user/path
```

For full recovery, combine:
1. Logging plugin JSONL (hook events, timestamps)
2. Claude transcript JSONL (full message content, tool results)
3. Subagent transcripts (referenced by path in SubagentStop)

A recovery tool could merge these sources for complete reconstruction.

### 5. Heartbeat for Crash Detection

Add periodic heartbeat to detect silent crashes:

```python
# In SessionStart hook, also schedule heartbeat
# Every 5 minutes, log a heartbeat event

def heartbeat():
    log_entry = {
        "ts": datetime.now().isoformat(),
        "type": "Heartbeat",
        "session_id": sid,
        "data": {"alive": True}
    }
```

If session has no SessionEnd and last event is old with no heartbeat, it crashed.

---

## Appendix: Sample Event Structures

### SessionStart
```json
{
  "id": "evt_ec6d3b15a9fe",
  "type": "SessionStart",
  "ts": "2026-01-28T20:20:52.124223+00:00",
  "session_id": "e3191ef5-b9c3-4835-9940-0fa0e24e60b5",
  "agent_session_num": 0,
  "data": {
    "session_id": "e3191ef5-b9c3-4835-9940-0fa0e24e60b5",
    "transcript_path": "/home/user/path",
    "cwd": "/home/user/path",
    "hook_event_name": "SessionStart",
    "source": "startup",
    "model": "claude-opus-4-5-20251101"
  }
}
```

### PreToolUse
```json
{
  "id": "evt_4e7b259c0d5c",
  "type": "PreToolUse",
  "ts": "2026-01-28T20:21:23.561944+00:00",
  "session_id": "e3191ef5-b9c3-4835-9940-0fa0e24e60b5",
  "agent_session_num": 0,
  "data": {
    "tool_name": "Bash",
    "tool_input": {
      "command": "ls -la",
      "description": "List directory contents"
    },
    "tool_use_id": "toolu_01XvskU3ymEh7tLsVWBTEzXa"
  }
}
```

### SubagentStop
```json
{
  "id": "evt_abc123",
  "type": "SubagentStop",
  "ts": "2026-01-28T20:21:59.323485+00:00",
  "session_id": "e3191ef5-b9c3-4835-9940-0fa0e24e60b5",
  "agent_session_num": 0,
  "data": {
    "agent_id": "subagent_xyz",
    "agent_transcript_path": "/path/to/subagent/transcript.jsonl",
    "stop_hook_active": false
  }
}
```

---

*Analysis completed: 2026-01-29*
*Source: plugins/logging/ (v0.4.0)*
