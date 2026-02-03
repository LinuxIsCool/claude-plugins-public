# Auto-Restore Architecture Design

## Executive Summary

The auto-restore system enables seamless recovery of Claude Code sessions after system crashes, reboots, or intentional restarts. By coordinating four existing systems (tmux-resurrect, logging plugin, statusline plugin, and interface plugin), users can restore their multi-pane Claude workspace with full context preservation.

The core insight is that tmux-resurrect already handles pane layout restoration, but Claude Code sessions are stateless between launches. The solution bridges this gap by: (1) continuously persisting session state to disk, (2) mapping tmux pane IDs to Claude session IDs, and (3) providing a post-restore hook that automatically resumes each Claude session with its prior context.

This architecture treats git as the coordination layer, with all state stored in observable, version-controlled files. The system requires no new running processes or daemons; it operates entirely through hooks and file-based state.

## Problem Statement

### Current Pain Points

1. **Session Loss on Crash**: When the PC crashes or is rebooted, all running Claude Code sessions terminate. The conversation context exists only in memory and is lost.

2. **Manual Reconstruction**: After rebooting, users must manually:
   - Start a new tmux session
   - Recreate the window/pane layout
   - Navigate to each project directory
   - Remember what each Claude instance was working on
   - Re-explain context to each new Claude instance

3. **Context Fragmentation**: Even with session logs, users must manually search and paste relevant context back into new sessions.

4. **Multi-Instance Complexity**: With 4-8 Claude instances across tmux panes, reconstruction takes 15-30 minutes and results in degraded context quality.

### User Workflow

Typical multi-Claude workflow:

```
tmux session "work"
├── Window 0: "exploration"
│   ├── Pane 0: Claude (exploring codebase)
│   └── Pane 1: Shell (git, tests)
├── Window 1: "development"
│   ├── Pane 0: Claude (main feature work)
│   ├── Pane 1: Claude (parallel refactor)
│   └── Pane 2: Shell (build, logs)
└── Window 2: "research"
    └── Pane 0: Claude (documentation)
```

**Desired Recovery Flow**:
1. System reboots
2. User opens terminal
3. Runs single command: `tmux-restore` (or automatic on tmux start)
4. All windows/panes restored with Claude sessions running
5. Each Claude instance automatically receives context injection: "Restoring session: You were working on [task]. Your last exchange was: [summary]."

### Recovery Requirements

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Pane Layout | Must Have | Exact tmux window/pane arrangement restored |
| Working Directory | Must Have | Each pane returns to correct project directory |
| Session Identity | Must Have | Map restored pane to previous Claude session |
| Context Summary | Should Have | Inject prior work context into new session |
| Conversation Restore | Nice to Have | Full conversation history available to Claude |
| Automatic Trigger | Should Have | Restore happens without manual commands |

## System Architecture

### Data Flow Diagram

```
SAVE FLOW (Continuous during operation)
========================================

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Claude Code Session                                │
│  session_id: abc12345                                                       │
└───────────────┬─────────────────────────────────────────┬───────────────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────────┐       ┌───────────────────────────────────┐
│      Logging Plugin           │       │      Statusline Plugin            │
│  SessionStart hook            │       │  SessionStart hook                │
│                               │       │                                   │
│  Writes to:                   │       │  Writes to:                       │
│  .claude/logging/YYYY/MM/DD/  │       │  .claude/instances/               │
│    HH-MM-SS-{session}.jsonl   │       │    registry.json                  │
│    HH-MM-SS-{session}.md      │       │    summaries/{session}.txt        │
└───────────────┬───────────────┘       │    pane_id, pane_ref              │
                │                       └───────────────┬───────────────────┘
                │                                       │
                ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     Pane-Session Map (NEW)                                 │
│  .claude/instances/pane-session-map.json                                  │
│                                                                           │
│  {                                                                        │
│    "%44": {                                                               │
│      "session_id": "abc12345...",                                        │
│      "cwd": "/home/user/project",                                        │
│      "name": "Explorer",                                                  │
│      "task": "Exploring codebase architecture",                          │
│      "last_log": ".claude/logging/2026/01/29/14-30-00-abc12345.jsonl",   │
│      "last_seen": "2026-01-29T22:30:00Z"                                 │
│    },                                                                     │
│    "%45": { ... }                                                         │
│  }                                                                        │
└───────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        tmux-resurrect                                      │
│                                                                           │
│  ~/.tmux/resurrect/last                                                   │
│  (Stores pane layout, commands, pane_id references)                       │
│                                                                           │
│  Triggered: prefix + Ctrl-s (manual) or auto via tmux-continuum          │
└───────────────────────────────────────────────────────────────────────────┘


RESTORE FLOW (After reboot)
============================

┌─────────────────────────────────────────────────────────────────────────────┐
│                           User starts tmux                                   │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        tmux-resurrect                                      │
│                                                                           │
│  Restores: sessions, windows, panes, working directories                  │
│  Executes: pane commands (e.g., "claude" for Claude panes)               │
│  NEW pane_ids assigned (different from pre-reboot)                       │
└───────────────┬───────────────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│             Post-Restore Hook (NEW): session-restorer                      │
│                                                                           │
│  Triggered by: resurrect_post_restore_hook (tmux-resurrect config)       │
│                                                                           │
│  For each pane with Claude:                                               │
│  1. Get original pane_ref from resurrect data (e.g., "0:1.0")            │
│  2. Lookup session_id from pane-session-map.json by pane_ref             │
│  3. Find last log file for that session                                   │
│  4. Generate context summary                                              │
│  5. Send context injection to pane via `tmux send-keys`                  │
└───────────────┬───────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Claude Code (New Session)                                │
│                                                                              │
│  Receives prompt:                                                           │
│  "RESTORATION CONTEXT: You are resuming work from session abc12345.        │
│   Instance name: Explorer                                                   │
│   Task: Exploring codebase architecture                                     │
│   Last active: Jan 29, 2:30 PM PST                                         │
│                                                                             │
│   Summary of last exchange:                                                 │
│   User asked about the plugin architecture.                                 │
│   You analyzed plugins/interface/ and documented the stack model.          │
│                                                                             │
│   Continue from where you left off, or ask clarifying questions."          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Saves | Restores | Triggers |
|-----------|-------|----------|----------|
| **tmux-resurrect** | Pane layout, cwd, running commands | Window/pane structure, directories | Manual (prefix+Ctrl-s) or tmux-continuum |
| **logging plugin** | Full conversation JSONL, summaries | N/A (read-only archive) | Every hook event (continuous) |
| **statusline plugin** | Session registry, pane identity, task summaries | N/A (provides lookup) | SessionStart hook, statusline updates |
| **NEW: pane-session-mapper** | Pane-to-session mapping with metadata | N/A (provides lookup) | Every statusline update, session end |
| **NEW: session-restorer** | N/A | Context injection to new sessions | tmux-resurrect post_restore hook |

### State Files

```
$HOME/.claude/instances/
├── registry.json              # Existing: session_id → {name, task, pane_id, ...}
├── pane-session-map.json      # NEW: pane_ref → {session_id, context}
├── summaries/{session}.txt    # Existing: current task summary
├── descriptions/{session}.txt # Existing: detailed description
└── restore/
    ├── last-restore.json      # NEW: metadata about last restoration
    └── context-cache/         # NEW: pre-generated context summaries
        └── {session}.txt

$PROJECT/.claude/logging/YYYY/MM/DD/
├── HH-MM-SS-{session}.jsonl   # Full conversation (source of truth)
└── HH-MM-SS-{session}.md      # Human-readable report

~/.tmux/resurrect/
└── last                       # tmux-resurrect state file
```

## Implementation Design

### Phase 1: Foundation (Enhance Existing)

**Goal**: Ensure all required data is being saved reliably.

#### 1.1 Enhance pane-identity tracking

The statusline plugin already captures `pane_id` and `pane_ref` in `session-start.sh`. Ensure this data persists through session lifecycle:

```bash
# In session-start.sh: Already captures pane identity
PANE_INFO=$(get_current_pane_info)
PANE_ID=$(echo "$PANE_INFO" | cut -d'|' -f2)   # %44
PANE_REF=$(echo "$PANE_INFO" | cut -d'|' -f3)  # 0:1.0
```

**Enhancement needed**: Update pane mapping on every statusline refresh (handles window reordering).

#### 1.2 Create pane-session-map.json

A dedicated mapping file keyed by `pane_ref` (stable across restores):

```json
{
  "0:1.0": {
    "session_id": "abc12345-1234-5678-9012-abc123456789",
    "short_id": "abc12345",
    "name": "Explorer",
    "task": "Exploring codebase architecture",
    "cwd": "/home/user/path",
    "last_log": ".claude/logging/2026/01/29/14-30-00-abc12345.jsonl",
    "last_summary": ".claude/instances/summaries/abc12345.txt",
    "created": "2026-01-29T20:00:00Z",
    "last_seen": "2026-01-29T22:30:00Z",
    "model": "claude-opus-4-5-20251101"
  }
}
```

**Key insight**: `pane_ref` (session:window.pane format like "0:1.0") survives tmux-resurrect restoration, while `pane_id` (%44) does not. The restore process assigns new pane_ids, but preserves the logical position.

#### 1.3 Add session-end hook

Track when sessions end gracefully to mark them as "restorable":

```bash
# hooks/session-end.sh
# Triggered on SessionEnd event (if available) or inferred from staleness
update_pane_session_map --session "$SESSION_ID" --status "ended_cleanly"
```

### Phase 2: Integration (Connect Components)

**Goal**: Wire up the restore flow.

#### 2.1 tmux-resurrect configuration

Add post-restore hook in `~/.tmux.conf`:

```bash
# tmux-resurrect settings
set -g @resurrect-capture-pane-contents 'on'
set -g @resurrect-processes 'claude'  # Save Claude command

# Post-restore hook (NEW)
set -g @resurrect-hook-post-restore-all 'bash ~/.claude/hooks/post-tmux-restore.sh'
```

#### 2.2 Create post-restore hook

```bash
#!/bin/bash
# ~/.claude/hooks/post-tmux-restore.sh
# Triggered after tmux-resurrect completes

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../plugins/statusline/lib/pane-identity.sh"

# Load pane-session map
MAP_FILE="$HOME/.claude/instances/pane-session-map.json"
if [[ ! -f "$MAP_FILE" ]]; then
    echo "No pane-session map found, skipping restore" >&2
    exit 0
fi

# Get all panes running Claude
CLAUDE_PANES=$(tmux list-panes -a -F '#{pane_id}|#{session_name}:#{window_index}.#{pane_index}|#{pane_current_command}' \
    | grep -E '\|claude$')

while IFS='|' read -r pane_id pane_ref command; do
    # Lookup previous session by pane_ref
    SESSION_DATA=$(jq -r --arg ref "$pane_ref" '.[$ref] // empty' "$MAP_FILE")

    if [[ -n "$SESSION_DATA" ]]; then
        # Generate context injection
        CONTEXT=$(generate_restore_context "$SESSION_DATA")

        # Wait for Claude to be ready (prompt visible)
        sleep 2

        # Send context as first prompt
        tmux send-keys -t "$pane_id" "$CONTEXT" Enter
    fi
done <<< "$CLAUDE_PANES"
```

#### 2.3 Context generator

```bash
# generate_restore_context function
# Reads session data and creates a restoration prompt

generate_restore_context() {
    local session_data="$1"
    local session_id=$(echo "$session_data" | jq -r '.session_id')
    local name=$(echo "$session_data" | jq -r '.name')
    local task=$(echo "$session_data" | jq -r '.task')
    local last_log=$(echo "$session_data" | jq -r '.last_log')
    local last_seen=$(echo "$session_data" | jq -r '.last_seen')

    # Convert UTC to Pacific
    local last_seen_pt=$(date -d "$last_seen" +"%b %d, %-I:%M %p PST" 2>/dev/null || echo "$last_seen")

    # Get summary if available
    local summary=""
    if [[ -f "$HOME/.claude/instances/summaries/${session_id:0:8}.txt" ]]; then
        summary=$(cat "$HOME/.claude/instances/summaries/${session_id:0:8}.txt")
    fi

    # Get last exchange from log
    local last_exchange=""
    if [[ -f "$last_log" ]]; then
        # Extract last user prompt and assistant response
        last_exchange=$(tail -20 "$last_log" | \
            jq -r 'select(.type == "UserPromptSubmit" or .type == "AssistantResponse") | .content' | \
            tail -4)
    fi

    cat << EOF
RESTORATION CONTEXT

You are resuming work from a previous session that was interrupted.

Previous session: $name (${session_id:0:8})
Task: $task
Last active: $last_seen_pt

${summary:+Current task summary: $summary}

${last_exchange:+Last exchange:
$last_exchange}

Please continue from where we left off. If you need clarification about the current state, ask.
EOF
}
```

### Phase 3: Automation (Seamless Experience)

**Goal**: Make restoration automatic and robust.

#### 3.1 tmux-continuum integration

Auto-save on interval and auto-restore on tmux start:

```bash
# ~/.tmux.conf additions
set -g @continuum-save-interval '5'     # Save every 5 minutes
set -g @continuum-restore 'on'          # Auto-restore on tmux start
set -g @continuum-boot 'on'             # Start tmux on system boot
```

#### 3.2 Graceful degradation

Handle edge cases:

| Scenario | Handling |
|----------|----------|
| No map file | Skip context injection, Claude starts fresh |
| Session data stale (>24h) | Warn user, offer abbreviated context |
| Log file missing | Use registry data only |
| Claude not ready | Retry with exponential backoff |
| Pane layout changed | Match by cwd as fallback |

#### 3.3 User notification

Show restoration status in tmux status bar:

```bash
# Status bar segment
#[fg=green]Restored: 4/4 sessions
```

Or via pane title update:

```bash
printf '\033]0;[RESTORED] %s\007' "$name"
```

## New Components Needed

### skill: session-saver

**Purpose**: Ensure all session state is persistently saved.

**Location**: `plugins/interface/skills/interface-master/subskills/session-saver.md`

**Triggers**:
- SessionStart hook (initial registration)
- Statusline update (every refresh, ~1s)
- Explicit save command
- SessionEnd hook (final state capture)

**Data Saved**:
```json
{
  "pane_ref": "0:1.0",
  "session_id": "abc12345...",
  "name": "Explorer",
  "task": "Current task description",
  "cwd": "/absolute/path",
  "model": "claude-opus-4-5",
  "created": "ISO timestamp",
  "last_seen": "ISO timestamp",
  "last_log": "path/to/log.jsonl",
  "context_hash": "sha256 of recent context"
}
```

### skill: session-restorer

**Purpose**: Inject context into newly launched Claude sessions after tmux restore.

**Location**: `plugins/interface/skills/interface-master/subskills/session-restorer.md`

**Triggers**:
- tmux-resurrect post_restore hook
- Manual `/restore` command
- Startup detection (Claude launched in pane with prior mapping)

**Actions**:
1. Identify all Claude panes
2. Match to prior sessions via pane_ref
3. Generate context summaries
4. Inject via tmux send-keys

### hook: post-tmux-restore.sh

**Purpose**: Orchestrate restoration after tmux-resurrect completes.

**Location**: `~/.claude/hooks/post-tmux-restore.sh`

**Integration**:
```bash
# In ~/.tmux.conf
set -g @resurrect-hook-post-restore-all 'bash ~/.claude/hooks/post-tmux-restore.sh'
```

**Logic**:
```
1. Wait for tmux to stabilize (100ms)
2. List all panes with "claude" command
3. For each pane:
   a. Get pane_ref from tmux
   b. Lookup in pane-session-map.json
   c. If found:
      - Generate context injection text
      - Wait for Claude prompt
      - Send text via tmux send-keys
   d. If not found:
      - Log warning
      - Skip (fresh session)
4. Update status bar with restore count
5. Write restore report to last-restore.json
```

### data: pane-session-map.json

**Location**: `~/.claude/instances/pane-session-map.json`

**Schema**:
```typescript
interface PaneSessionMap {
  [pane_ref: string]: {
    session_id: string;       // Full UUID
    short_id: string;         // First 8 chars
    name: string;             // Instance name (e.g., "Explorer")
    task: string;             // Current task description
    cwd: string;              // Working directory (absolute path)
    model: string;            // Model ID
    created: string;          // ISO 8601 timestamp
    last_seen: string;        // ISO 8601 timestamp
    last_log: string;         // Path to most recent JSONL log
    last_summary?: string;    // Path to summary file
    status: "active" | "ended_cleanly" | "crashed";
  };
}
```

**Lifecycle**:
- **Created**: First statusline update with pane identity
- **Updated**: Every statusline refresh, session-end
- **Cleaned**: After successful restore (old entries removed)
- **Retained**: 7 days for crash recovery

**Example**:
```json
{
  "0:0.0": {
    "session_id": "abc12345-1234-5678-9012-abc123456789",
    "short_id": "abc12345",
    "name": "Explorer",
    "task": "Researching plugin architecture",
    "cwd": "/home/user/path",
    "model": "claude-opus-4-5-20251101",
    "created": "2026-01-29T20:00:00Z",
    "last_seen": "2026-01-29T22:45:00Z",
    "last_log": ".claude/logging/2026/01/29/20-00-00-abc12345.jsonl",
    "last_summary": "/home/user/path",
    "status": "active"
  },
  "0:1.0": {
    "session_id": "def67890-5678-9012-3456-def678901234",
    "short_id": "def67890",
    "name": "Debugger",
    "task": "Fixing authentication flow",
    "cwd": "/home/user/path",
    "model": "claude-sonnet-4-20250514",
    "created": "2026-01-29T21:30:00Z",
    "last_seen": "2026-01-29T22:40:00Z",
    "last_log": "/home/user/path",
    "status": "active"
  }
}
```

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **pane_ref changes after window reorder** | Medium | Session mismatch | Also track by cwd+task hash as fallback |
| **Large context overwhelms new session** | Low | Degraded UX | Limit injection to 2000 chars, summarize |
| **tmux-resurrect version incompatibility** | Low | Hook not triggered | Document minimum version, test hook path |
| **Race condition: Claude not ready** | Medium | Injection lost | Retry with backoff, detect prompt string |
| **Stale map data (old sessions)** | Low | Wrong context | TTL on entries, validate session existence |
| **Log file in different project** | Medium | File not found | Store absolute paths, handle missing gracefully |
| **Multiple Claude in same pane_ref** | Very Low | Collision | Track pane_id change, invalidate on mismatch |
| **User interrupts restoration** | Low | Partial state | Allow manual trigger, idempotent design |

### Fallback Strategy

If primary restoration fails:
1. **Level 1**: Use pane_ref mapping
2. **Level 2**: Match by cwd (same directory = likely same session)
3. **Level 3**: Match by task description similarity
4. **Level 4**: Present list of recent sessions, user selects
5. **Level 5**: Start fresh, but note available prior sessions

## Success Criteria

### Must Pass

- [ ] After reboot + `tmux restore`, all panes return to correct directories
- [ ] Claude panes receive context injection within 5 seconds of launch
- [ ] Context injection includes: instance name, task, last active time
- [ ] No manual intervention required for basic restoration

### Should Pass

- [ ] Context includes summary of last user prompt
- [ ] Restoration works across different tmux sessions
- [ ] Status bar shows restoration count
- [ ] Works with tmux-continuum auto-restore

### Nice to Have

- [ ] Full conversation history searchable from restored session
- [ ] Visual indicator of restored vs fresh sessions
- [ ] Restoration report written to journal
- [ ] Support for partial restoration (some panes only)

### Verification Commands

```bash
# 1. Simulate crash
kill -9 $(pgrep -f "tmux: server")

# 2. Restart
tmux

# 3. Verify layout
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_current_path}'

# 4. Verify context injection
# (Check first prompt in each Claude pane includes "RESTORATION CONTEXT")

# 5. Check logs
cat ~/.claude/instances/restore/last-restore.json
```

## Recommended Skill Structure

Integrate into interface plugin with master-subskill pattern:

```
plugins/interface/
├── skills/
│   └── interface-master/
│       ├── SKILL.md                    # Add references to new subskills
│       └── subskills/
│           ├── session-saver.md        # NEW: Continuous state persistence
│           ├── session-restorer.md     # NEW: Post-restore context injection
│           └── tmux.md                 # UPDATE: Add tmux-resurrect section
├── tools/
│   ├── pane-session-mapper.sh          # NEW: Maintain pane-session-map.json
│   └── generate-restore-context.sh     # NEW: Create context injection text
└── hooks/
    └── post-tmux-restore.sh            # NEW: Orchestrate restoration

~/.claude/
├── hooks/
│   └── post-tmux-restore.sh            # Symlink to plugin hook
└── instances/
    ├── registry.json                   # Existing
    ├── pane-session-map.json           # NEW
    └── restore/
        └── last-restore.json           # NEW
```

### Master Skill Update

Add to `interface-master/SKILL.md`:

```markdown
| **session-saver** | Persisting session state for crash recovery | `subskills/session-saver.md` |
| **session-restorer** | Restoring context after tmux-resurrect | `subskills/session-restorer.md` |
```

### Command Addition

Consider adding `/interface:restore` command:

```markdown
# /interface:restore

Manually trigger session restoration or check restoration status.

Usage:
  /interface:restore         # Show restoration status
  /interface:restore inject  # Re-inject context for current pane
  /interface:restore map     # Show pane-session mapping
```

## Appendix: tmux-resurrect Reference

### Installation

```bash
# Via TPM (recommended)
set -g @plugin 'tmux-plugins/tmux-resurrect'
set -g @plugin 'tmux-plugins/tmux-continuum'

# Manual
git clone https://github.com/tmux-plugins/tmux-resurrect ~/.tmux/plugins/tmux-resurrect
```

### Key Bindings

| Binding | Action |
|---------|--------|
| `prefix + Ctrl-s` | Save tmux environment |
| `prefix + Ctrl-r` | Restore tmux environment |

### Relevant Options

```bash
# Save command history (experimental)
set -g @resurrect-save-command-strategy 'cmdline'

# Restore processes
set -g @resurrect-processes 'vi vim nvim emacs man less more tail top htop irssi claude'

# Hook after restore
set -g @resurrect-hook-post-restore-all 'bash /path/to/hook.sh'

# Save pane contents
set -g @resurrect-capture-pane-contents 'on'
```

### State File Format

tmux-resurrect saves to `~/.tmux/resurrect/last` with format:

```
pane	0:0.0	:*	0	:bash	1	:/home/user/project	0	bash
pane	0:1.0	:	1	:bash	0	:/home/user/other	0	claude
window	0	0	main	*	cd
state	version	4
```

Fields: type, pane_ref, flags, layout_id, cmd, active, cwd, ...

This provides the `pane_ref` needed to correlate with our `pane-session-map.json`.
