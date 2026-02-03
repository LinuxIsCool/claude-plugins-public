# Statusline Plugin Analysis for Session Recovery

## Executive Summary

The statusline plugin provides a sophisticated instance tracking system that captures session identity, lifecycle events, and runtime metadata for Claude Code sessions. At its core, the registry maintains a JSON database at `.claude/instances/registry.json` that maps session UUIDs to rich metadata including process numbers, pane identifiers, task descriptions, and temporal markers. The architecture already includes preliminary tmux integration through the `pane_id` and `pane_ref` fields captured during session start, though this integration remains incomplete for full recovery scenarios.

The plugin demonstrates strong fundamentals for session recovery: monotonic process numbering, pane identity detection via process ancestry walking, atomic registry updates with flock, and comprehensive JSONL event logging. However, the current implementation has gaps that prevent reliable crash recovery. Specifically, pane identifiers are captured only at session start (not updated on pane migration), there is no mechanism to detect orphaned sessions after tmux server restart, and the registry lacks the inverse lookup structure needed for pane-to-session resolution at scale.

The path to robust session recovery requires extending the registry schema with tmux session/window metadata, implementing bidirectional pane-session mapping, and adding tmux hook integration for real-time state synchronization. The existing `lib/pane-identity.sh` library provides the foundation for process-to-pane resolution, but the reverse operation (pane-to-session) requires additional infrastructure to handle pane reuse and tmux restarts.

## Registry Analysis

### Data Structure

The registry is stored as a JSON object at `.claude/instances/registry.json` with session UUIDs as keys:

```
.claude/instances/
├── registry.json              # Main session metadata store
├── registry.json.lock         # flock lock file for atomic updates
├── process_counter.txt        # Monotonic counter for spawn order
├── statusline.jsonl           # Append-only event log
├── counts/{session_id}.txt    # Per-session prompt counters
├── summaries/{session_id}.txt # LLM-generated session summaries
├── descriptions/{session_id}.txt # LLM-generated descriptions
└── summaries/{session_id}.history # Summary change history
```

The registry uses JSON with string keys (session UUIDs) and object values containing all session metadata. Updates are performed atomically using `flock` and a temporary file pattern.

### Fields Captured

| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `name` | string | Auto-generated or user-set | Instance identity (e.g., "Archaeologist") |
| `task` | string | LLM-generated | Current task description |
| `model` | string | Claude Code runtime | Model identifier (e.g., "Opus 4.5") |
| `cwd` | string | Hook input JSON | Working directory path |
| `created` | ISO timestamp | SessionStart hook | Session birth time |
| `last_seen` | ISO timestamp | Any activity | Last update time |
| `status` | string | "active" or "inactive" | Liveness marker |
| `process_number` | integer | Monotonic counter | Spawn order (C1, C2, C3...) |
| `pane_id` | string | pane-identity.sh | tmux pane ID ("%XX" format) |
| `pane_ref` | string | pane-identity.sh | Human-readable "session:window.pane" |
| `auto_named` | boolean | auto-identity hook | Whether name was auto-generated |
| `continued` | boolean | user-prompt-submit hook | Session without SessionStart event |

### Lifecycle Tracking

The plugin tracks sessions through multiple hooks:

1. **SessionStart** (`hooks/session-start.sh`):
   - Registers new sessions with default name "Claude"
   - Assigns monotonic process number from counter file
   - Captures pane identity via `get_current_pane_info()`
   - Creates summary/description/count files
   - Exports SESSION_ID via CLAUDE_ENV_FILE

2. **UserPromptSubmit** (`hooks/user-prompt-submit.sh`):
   - Increments prompt counter
   - Handles "continued" sessions (where SessionStart never fired)
   - Updates last_seen timestamp
   - Creates missing infrastructure files

3. **Stop** (`hooks/auto-identity-wrapper.sh`):
   - Triggers auto-identity generation (name, description, summary)
   - Uses single LLM call for efficiency

4. **Statusline render** (`tools/statusline.sh`):
   - Self-healing: auto-registers missing sessions
   - Updates last_seen on every render
   - Backfills missing model information
   - Logs complete state to statusline.jsonl

### Current Limitations

1. **Pane Identity Staleness**: `pane_id` and `pane_ref` are captured only at SessionStart. If a Claude process moves to a different pane (via tmux pane migration), the registry becomes stale.

2. **No Orphan Detection**: After system crash or tmux server restart, sessions remain "active" in the registry indefinitely. The `cleanup_stale()` function uses time-based heuristics (24 hours) rather than actual process liveness.

3. **Pane Reuse Ambiguity**: When a pane is reused (old Claude exits, new Claude starts), the registry may have multiple sessions pointing to the same `pane_id`. The resolution logic uses `last_seen` ordering, which is fragile.

4. **No tmux Session Tracking**: The registry captures pane identity but not the tmux session name or window name. After tmux restart, pane IDs are reassigned, breaking all mappings.

5. **Unidirectional Mapping**: The registry is optimized for session-to-pane lookup. Pane-to-session lookup requires scanning the entire registry.

## Session-to-Pane Mapping

### Current Capabilities

The `lib/pane-identity.sh` library provides robust process-to-pane resolution:

```bash
get_current_pane_info()  # Returns "pane_pid|pane_id|session:window.pane"
get_current_pane_id()    # Returns "%44"
get_current_pane_ref()   # Returns "0:5.0"
```

The algorithm walks the process ancestry tree (`$$` -> parent -> grandparent...) and matches against tmux's pane PIDs. This correctly handles Claude Code's process hierarchy (claude -> node -> shell -> tmux pane).

The `lib/session-resolver.sh` library provides resolution in both directions:

```bash
resolve_session "main:0.0"      # Pane ref -> session_id
resolve_session_by_pane "%44"   # Pane ID -> session_id
resolve_session_by_cwd "/path"  # CWD fallback for legacy sessions
```

### Missing Links

1. **Pane Persistence**: tmux pane IDs (`%XX`) are stable within a tmux server lifetime but reset on server restart. The current approach provides no persistence across restarts.

2. **No Window/Session Tracking**: The registry lacks tmux session name and window index, which are needed to restore layout context.

3. **Process Liveness**: No mechanism to verify that a registered session's process is still running. The PID is not captured.

4. **Bidirectional Index**: Reverse lookup (pane -> session) requires O(n) registry scan. For recovery scenarios with many sessions, this becomes expensive.

### Enhancement Opportunities

1. **Capture PID**: Store the Claude process PID in registry for liveness checking.

2. **Track tmux Hierarchy**: Add `tmux_session`, `window_index`, `window_name` fields.

3. **Build Reverse Index**: Maintain a separate `pane_registry.json` mapping pane_ids to session_ids.

4. **Periodic Refresh**: Update pane identity on each statusline render, not just session start.

## tmux Integration Potential

### Window/Pane Identification

tmux provides several identifiers at different stability levels:

| Identifier | Format | Stability | Recovery Value |
|------------|--------|-----------|----------------|
| `pane_id` | `%123` | tmux server lifetime | High within session |
| `pane_index` | `0`, `1`, `2`... | Pane lifetime | Low (reordering) |
| `window_index` | `0`, `1`, `2`... | Session lifetime | Medium |
| `window_name` | string | User-controlled | High (if set) |
| `session_name` | string | User-controlled | Very high |
| `pane_pid` | PID | Process lifetime | None (changes on restart) |

For robust recovery, the combination of `session_name:window_name` provides the most stable identifier, but requires the user to name their windows (which the `/statusline:rename` command supports).

### Proposed Data Extensions

Extend registry entries with:

```json
{
  "session_id": "...",
  "tmux": {
    "session_name": "main",
    "window_index": 5,
    "window_name": "Archaeologist:C3",
    "pane_index": 0,
    "pane_id": "%44",
    "pane_pid": 3706660,
    "captured_at": "2026-01-29T18:00:00Z"
  },
  "process": {
    "pid": 3706665,
    "ppid": 3706660
  }
}
```

### Persistence Strategy

1. **On SessionStart**: Capture full tmux hierarchy and process info.

2. **On Statusline Render**: Refresh `pane_id`, detect if pane moved.

3. **On Window Rename**: Update `window_name` in registry (via tmux hook or manual command).

4. **Separately**: Maintain `.claude/instances/layout.json` with current tmux layout snapshot.

5. **tmux Hooks**: Use tmux's `after-split-window`, `session-closed`, etc. hooks to track layout changes externally.

## Recovery Workflow Design

### On Crash: What's Lost

When the system crashes or tmux server restarts:

| Data | Status | Recovery Source |
|------|--------|-----------------|
| Registry entries | Preserved | `.claude/instances/registry.json` |
| Session UUIDs | Preserved | Registry keys |
| Process numbers (C1, C2...) | Preserved | Registry `process_number` field |
| Names/tasks/descriptions | Preserved | Registry + per-session files |
| Conversation history | Preserved | `.claude/logging/YYYY/MM/DD/*-{session}.jsonl` |
| Prompt counts | Preserved | `.claude/instances/counts/{session}.txt` |
| Pane IDs | **Invalid** | tmux reassigns on restart |
| Process PIDs | **Invalid** | New PIDs after restart |
| tmux Layout | **Lost** | Not currently captured |

### On Restore: What's Available

1. **Session Identity**: Name, task, description, model, cwd, process_number
2. **Conversation State**: Full conversation history in JSONL logs
3. **Activity Timeline**: statusline.jsonl event stream
4. **Last Known Directory**: `cwd` field in registry

### Proposed Recovery Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    CRASH/RESTART DETECTED                       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 1. SCAN REGISTRY                                                │
│    - Load registry.json                                         │
│    - Filter entries with status="active"                        │
│    - Sort by last_seen (most recent first)                      │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 2. VALIDATE SESSIONS                                            │
│    - For each active session:                                   │
│      - Check if PID still running (via /proc or ps)             │
│      - If not running, mark for recovery                        │
│    - Build recovery manifest                                    │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 3. PRESENT RECOVERY OPTIONS                                     │
│    - Show table of recoverable sessions:                        │
│      | C# | Name | Task | Last Seen | CWD |                     │
│    - Allow user to select which to restore                      │
│    - Allow user to specify target panes                         │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. RESTORE SESSIONS                                             │
│    For each selected session:                                   │
│    a. Create/select tmux pane                                   │
│    b. cd to session's cwd                                       │
│    c. Run: claude --resume {session_id}                         │
│    d. Update registry with new pane_id                          │
│    e. Rename window to "{Name}:C{#}"                            │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ 5. POST-RECOVERY CLEANUP                                        │
│    - Mark non-restored sessions as "inactive"                   │
│    - Log recovery event to statusline.jsonl                     │
│    - Update process_counter to avoid collisions                 │
└────────────────────────────────────────────────────────────────┘
```

## Enhancement Recommendations

### Registry Extensions

1. **Add `process.pid` field**: Enable liveness checking via `/proc/{pid}` or `ps`.

2. **Add `tmux.session_name` and `tmux.window_name`**: Stable identifiers for layout restoration.

3. **Add `tmux.captured_at` timestamp**: Track staleness of tmux data.

4. **Add `recovery.last_attempted` field**: Prevent repeated recovery of same session.

5. **Create reverse index**: Maintain `pane_to_session.json` for O(1) pane lookup.

### New Hooks

1. **tmux-window-renamed hook**: Update registry when window is renamed.

2. **Recovery command**: `/statusline:recover` - scan for recoverable sessions and present options.

3. **Layout snapshot hook**: Periodically capture tmux layout to `.claude/instances/layout.json`.

4. **Process monitor hook**: Periodic liveness check that marks dead sessions inactive.

### tmux Hook Integration

tmux supports external command hooks that can update the registry:

```bash
# In ~/.tmux.conf
set-hook -g after-split-window 'run-shell "~/.claude/hooks/tmux-pane-created.sh"'
set-hook -g pane-exited 'run-shell "~/.claude/hooks/tmux-pane-exited.sh"'
set-hook -g session-closed 'run-shell "~/.claude/hooks/tmux-session-closed.sh"'
```

These hooks could:
- Detect new panes and check for Claude processes
- Mark sessions as inactive when panes close
- Trigger layout snapshot on major changes

## Implementation Suggestions

### Phase 1: Registry Schema Extension

Extend the registry entry structure in `hooks/session-start.sh`:

```bash
# Current registration (lines 96-117)
update_registry "$REGISTRY" \
    --arg sid "$SESSION_ID" \
    --arg name "$DEFAULT_NAME" \
    --arg cwd "$CWD" \
    --arg ts "$TIMESTAMP" \
    --arg dir "$DIR_NAME" \
    --argjson pnum "$PROCESS_NUM" \
    --arg pane_id "$PANE_ID" \
    --arg pane_ref "$PANE_REF" \
    --argjson pid "$$" \                              # ADD: process PID
    --arg tmux_session "$(tmux display -p '#{session_name}')" \ # ADD
    --arg tmux_window "$(tmux display -p '#{window_name}')" \   # ADD
    '.[$sid] = {
      "name": $name,
      "task": ("Working in " + $dir),
      "model": "",
      "cwd": $cwd,
      "created": $ts,
      "last_seen": $ts,
      "status": "active",
      "process_number": $pnum,
      "pane_id": (if $pane_id != "" then $pane_id else null end),
      "pane_ref": (if $pane_ref != "" then $pane_ref else null end),
      "pid": $pid,                                    # ADD
      "tmux_session": (if $tmux_session != "" then $tmux_session else null end), # ADD
      "tmux_window": (if $tmux_window != "" then $tmux_window else null end)     # ADD
    }'
```

### Phase 2: Liveness Detection

Add to `lib/session-resolver.sh`:

```bash
# Check if a session's process is still running
is_session_alive() {
    local session_id="$1"
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"

    local pid
    pid=$(jq -r --arg sid "$session_id" '.[$sid].pid // empty' "$registry" 2>/dev/null)

    if [[ -z "$pid" ]]; then
        return 1  # No PID recorded, assume dead
    fi

    if [[ -d "/proc/$pid" ]]; then
        # Verify it's actually a claude process
        local comm
        comm=$(cat "/proc/$pid/comm" 2>/dev/null)
        [[ "$comm" == "claude" || "$comm" == "node" ]] && return 0
    fi

    return 1  # Process not found or wrong type
}

# Mark dead sessions as inactive
cleanup_dead_sessions() {
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"
    local active_sessions

    active_sessions=$(jq -r 'to_entries[] | select(.value.status == "active") | .key' "$registry")

    for sid in $active_sessions; do
        if ! is_session_alive "$sid"; then
            update_registry "$registry" \
                --arg sid "$sid" \
                --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
                '.[$sid].status = "inactive" | .[$sid].last_seen = $ts'
        fi
    done
}
```

### Phase 3: Recovery Command

Create `commands/recover.md`:

```markdown
---
name: recover
description: Scan for and restore crashed Claude sessions
allowed-tools: Bash, Read, Task
---

# Session Recovery

Scan for recoverable sessions and optionally restore them.

## Usage

```bash
# List recoverable sessions
/statusline:recover list

# Restore specific session
/statusline:recover {session_id}

# Restore all recent sessions
/statusline:recover all
```

## Process

1. Call cleanup_dead_sessions() to identify dead sessions
2. Present recovery candidates (sessions that were active but have no running process)
3. For each selected session:
   - Offer to create new tmux pane or use existing
   - Run `claude --resume {session_id}` in target pane
   - Update registry with new pane info
```

### Phase 4: Pane Refresh on Render

In `tools/statusline.sh`, add pane identity refresh after line 118:

```bash
# Refresh pane identity on each render (detect pane migration)
if [ -n "$REGISTRY" ] && [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "unknown" ]; then
    source "$SCRIPT_DIR/../lib/pane-identity.sh" 2>/dev/null || true

    CURRENT_PANE_INFO=$(get_current_pane_info 2>/dev/null) || CURRENT_PANE_INFO=""
    if [ -n "$CURRENT_PANE_INFO" ]; then
        NEW_PANE_ID=$(echo "$CURRENT_PANE_INFO" | cut -d'|' -f2)
        NEW_PANE_REF=$(echo "$CURRENT_PANE_INFO" | cut -d'|' -f3)

        STORED_PANE_ID=$(jq -r --arg sid "$SESSION_ID" '.[$sid].pane_id // empty' "$REGISTRY" 2>/dev/null)

        # Update if pane changed
        if [ "$NEW_PANE_ID" != "$STORED_PANE_ID" ] && [ -n "$NEW_PANE_ID" ]; then
            update_registry "$REGISTRY" \
                --arg sid "$SESSION_ID" \
                --arg pane_id "$NEW_PANE_ID" \
                --arg pane_ref "$NEW_PANE_REF" \
                '.[$sid].pane_id = $pane_id | .[$sid].pane_ref = $pane_ref'

            log_statusline "pane_migrated" "$SESSION_ID" "old=$STORED_PANE_ID new=$NEW_PANE_ID"
        fi
    fi
fi
```

### Phase 5: Layout Snapshot

Create `tools/layout-snapshot.sh`:

```bash
#!/bin/bash
#
# Capture current tmux layout for recovery purposes
#
# Stores: session names, window names, pane arrangements, and session mappings

INSTANCES_DIR="${STATUSLINE_INSTANCES_DIR:-$HOME/.claude/instances}"
LAYOUT_FILE="$INSTANCES_DIR/layout.json"
REGISTRY="$INSTANCES_DIR/registry.json"

# Build layout snapshot
tmux list-panes -a -F '#{session_name}|#{window_index}|#{window_name}|#{pane_index}|#{pane_id}|#{pane_pid}|#{pane_current_path}' | \
jq -Rs '
    split("\n") | map(select(length > 0)) | map(split("|")) |
    map({
        session: .[0],
        window_index: (.[1] | tonumber),
        window_name: .[2],
        pane_index: (.[3] | tonumber),
        pane_id: .[4],
        pane_pid: (.[5] | tonumber),
        cwd: .[6]
    }) |
    group_by(.session) |
    map({
        session: .[0].session,
        windows: (group_by(.window_index) | map({
            index: .[0].window_index,
            name: .[0].window_name,
            panes: map({pane_id, pane_index, pane_pid, cwd})
        }))
    })
' > "$LAYOUT_FILE.tmp" && mv "$LAYOUT_FILE.tmp" "$LAYOUT_FILE"

echo "Layout snapshot saved to $LAYOUT_FILE"
```

---

*Analysis conducted: 2026-01-29*
*Source: `plugins/statusline/`*
*Registry: `.claude/instances/registry.json`*
