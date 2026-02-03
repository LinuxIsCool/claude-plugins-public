# Claude Code Session Management Research Report

*Generated: 2026-01-29*

## Executive Summary

Claude Code provides session management capabilities that allow users to resume conversations across terminal sessions, system restarts, and even machine migrations. Sessions are stored locally as JSONL files in `~/.claude/projects/` organized by encoded directory paths, with each session assigned a UUID identifier. The `--resume` and `--continue` flags provide the primary mechanisms for session recovery.

However, significant limitations exist for crash recovery scenarios. Session state is fundamentally tied to the conversation history stored in JSONL files, but critical context like background processes, active file states, and environment-specific data are not automatically preserved. When Claude Code crashes or is interrupted, the conversation history remains intact, but resuming does not restore the full working state. The SDK documentation indicates that resumed sessions may receive new session IDs in certain circumstances, which can complicate external tracking systems.

For users running multiple Claude Code instances in tmux panes who need to recover from PC crashes, a combination of approaches is recommended: capturing session IDs during startup via hooks (as the logging plugin already does), maintaining a mapping of tmux panes to session IDs, and implementing a restoration script that re-launches Claude Code with the appropriate `--resume <session-id>` flags in the correct pane positions.

## Session Lifecycle

### Creation

A new session is created when Claude Code starts without the `--resume` or `--continue` flags. The SDK automatically generates a UUID session ID (e.g., `550e8400-e29b-41d4-a716-446655440000`) and returns it in the initial system message with `subtype: 'init'`.

```typescript
for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id
    // Save this ID for later resumption
  }
}
```

Session creation triggers the `SessionStart` hook with the following data:
- `session_id`: The UUID for this session
- `transcript_path`: Path to the JSONL conversation file
- `cwd`: Current working directory
- `source`: One of `startup`, `compact`, `clear`, or `resume`
- `model`: The model being used

### Active State

During an active session:
- Every user prompt and Claude response is appended to the session's JSONL file
- Tool uses are logged with their inputs and outputs
- Subagent spawning creates separate transcript files
- Context compaction (`/compact`) creates a new "agent session" within the same session ID
- The session file grows incrementally as a complete audit trail

Sessions auto-save after every message exchange. Pressing Ctrl+C does not corrupt sessions - safe interruption is supported.

### Expiration

Session data does not expire automatically. JSONL files persist indefinitely in `~/.claude/projects/` until manually deleted. However, there are usage-based constraints:

- **5-hour rolling window**: Claude Code tracks session-based usage limits that reset every five hours from the first request in a session
- **7-day weekly ceiling**: Additional weekly limits cap total compute hours across a 7-day rolling window
- **Context window limits**: Long conversations eventually require compaction, creating a new agent session

Session files from months ago remain resumable, though context reconstruction may be affected by changes to the codebase or environment.

### Resume Window

Sessions can be resumed at any time while the JSONL file exists. Practical considerations:

- **Cross-restart**: Sessions survive system restarts and terminal closures
- **Cross-directory**: Sessions can be resumed from any directory if you have the session ID
- **Post-crash**: JSONL files are append-only; crashes don't corrupt history
- **Directory migration**: Moving project directories breaks automatic session discovery (the encoded path changes)

## Storage Mechanisms

### Local Storage (~/.claude/)

The global Claude Code directory contains:

```
~/.claude/
├── history.jsonl           # Metadata for all sessions (timestamps, project, session_id)
├── projects/               # Session conversation transcripts
│   └── [encoded-path]/     # Directory path with / replaced by -
│       ├── [session-uuid].jsonl      # Full conversation history
│       └── [session-uuid]/           # Session-specific data
│           └── tasks/                # Subagent task files
├── instances/              # Instance registry (statusline plugin)
│   └── registry.json       # Maps session_ids to tmux panes, cwds, etc.
├── session-env/            # Session environment snapshots
├── todos/                  # Per-session todo lists
├── file-history/           # File modification tracking
├── settings.json           # User preferences
└── .credentials.json       # API authentication
```

Path encoding converts `/home/user/path to `-home-ygg-Workspace-sandbox-marketplaces-claude`.

### Project Storage (.claude/)

Project-level storage in `.claude/local/` (gitignored) contains:

```
.claude/local/
└── logging/
    └── sessions/
        └── [session-uuid].jsonl      # Project-local logging data
        └── [session-uuid].md         # Generated markdown reports
```

The logging plugin creates per-session logs here, capturing:
- Session starts/ends with source information
- User prompts with full text
- Tool uses with inputs and responses
- Subagent spawning and completion
- Assistant responses

### What Gets Persisted

**Fully Persisted:**
- Complete conversation history (user prompts, Claude responses)
- Tool use records with inputs and outputs
- Subagent task definitions and results
- Timestamps for every event
- Model information
- Working directory at session start

**Partially Persisted:**
- File checkpoints (via `/checkpoint` command)
- Compact/clear context events (tracked as "agent session" increments)

**Not Persisted:**
- Background processes (shell commands in progress)
- Environment variables at time of crash
- Exact cursor position or UI state
- tmux pane associations (must be tracked externally)

## Resume Functionality

### The --resume Flag

Resume a specific session by ID:

```bash
claude --resume 550e8400-e29b-41d4-a716-446655440000
```

Interactive session picker:

```bash
claude --resume
# Displays list of recent sessions with timestamps
```

Resume in non-interactive (print) mode:

```bash
claude -p --resume session-id "continue with the next step"
```

### --continue Flag

Continue the most recent session in the current directory:

```bash
claude --continue
# or
claude -c
```

The `--continue` flag loads the most recent conversation with full context including "messages, code changes, and checkpoint history."

Key difference: `--continue` is directory-scoped (uses encoded path to find sessions), while `--resume session-id` works from any directory.

### Session ID Format

Session IDs are UUIDs in the format:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Examples from local storage:
- `4c629599-49c6-492f-8e83-daf70424ee24`
- `1c57d0b6-65e2-46db-be5b-48640dd4f51a`

The short form (first 8 characters) is often used in displays:
- `4c629599` in session labels
- Used for file naming: `15-33-43-4c629599.jsonl`

### Programmatic Usage

SDK example (TypeScript):

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk"

// Resume a previous session
const response = query({
  prompt: "Continue where we left off",
  options: {
    resume: "session-xyz",
    model: "claude-sonnet-4-5",
    allowedTools: ["Read", "Edit", "Write", "Glob", "Grep", "Bash"]
  }
})

for await (const message of response) {
  console.log(message)
}
```

SDK example (Python):

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Continue implementing the authentication system",
    options=ClaudeAgentOptions(
        resume="session-xyz",
        model="claude-sonnet-4-5",
        allowed_tools=["Read", "Edit", "Write", "Glob", "Grep", "Bash"]
    )
):
    print(message)
```

### Session Forking

When resuming, you can fork instead of continuing:

```typescript
const response = query({
  prompt: "Let's try a different approach",
  options: {
    resume: sessionId,
    forkSession: true,  // Creates new session ID from this point
    model: "claude-sonnet-4-5"
  }
})
```

| Behavior | `forkSession: false` (default) | `forkSession: true` |
|----------|-------------------------------|---------------------|
| Session ID | Same as original | New session ID generated |
| History | Appends to original session | Creates new branch |
| Original Session | Modified | Preserved unchanged |
| Use Case | Continue linear conversation | Branch to explore alternatives |

## Integration Points

### How to Get Session ID

**Method 1: From SessionStart Hook**

The logging plugin captures session_id via the SessionStart hook:

```python
# From hooks/log_event.py
data = json.loads(sys.stdin.read())
session_id = data.get("session_id", "unknown")
```

Hook data includes:
```json
{
  "session_id": "4c629599-49c6-492f-8e83-daf70424ee24",
  "transcript_path": "/home/user/path",
  "cwd": "/home/user/path",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-opus-4-5-20251101"
}
```

**Method 2: From history.jsonl**

```bash
tail -1 ~/.claude/history.jsonl | jq -r '.sessionId'
```

**Method 3: From Project Directory**

```bash
ls -t ~/.claude/projects/-home-ygg-Workspace-sandbox-marketplaces-claude/*.jsonl | head -1 | xargs basename | sed 's/.jsonl//'
```

**Method 4: From Registry (if using statusline plugin)**

```bash
jq -r 'to_entries[] | select(.value.cwd == "/home/user/path") | .key' ~/.claude/instances/registry.json
```

### How to Resume Programmatically

**Bash automation:**

```bash
#!/bin/bash
SESSION_ID="$1"
WORKING_DIR="$2"

cd "$WORKING_DIR"
claude --resume "$SESSION_ID"
```

**With tmux restoration:**

```bash
#!/bin/bash
# restore-sessions.sh

REGISTRY="$HOME/.claude/instances/registry.json"

# Get all active sessions with their pane IDs
jq -r 'to_entries[] | select(.value.status == "active") | [.key, .value.pane_id, .value.cwd] | @tsv' "$REGISTRY" | \
while IFS=$'\t' read -r session_id pane_id cwd; do
    if tmux has-session -t "${pane_id%.*}" 2>/dev/null; then
        tmux send-keys -t "$pane_id" "cd $cwd && claude --resume $session_id" Enter
    fi
done
```

### Automation Possibilities

**1. Session ID Capture on Start**

The statusline plugin's `session-start.sh` hook captures session IDs and associates them with tmux panes:

```bash
# Register in instances/registry.json
jq --arg sid "$SESSION_ID" --arg pane "$PANE_ID" --arg cwd "$CWD" \
   '.[$sid] = {pane_id: $pane, cwd: $cwd, status: "active"}' registry.json
```

**2. Periodic State Backup**

```bash
# Backup session mappings for crash recovery
cp ~/.claude/instances/registry.json /persistent/storage/claude-sessions-backup.json
```

**3. Post-Crash Restoration**

```bash
#!/bin/bash
# After reboot, restore Claude Code instances

# Read from backup or surviving registry
BACKUP="/persistent/storage/claude-sessions-backup.json"

# Recreate tmux layout first, then launch claude with --resume in each pane
# This requires knowing the original tmux layout (separate backup needed)
```

## Limitations

### Session ID Changes on Resume

A known bug exists where resumed sessions may receive a different `session_id` in hooks than the original session. GitHub issues #8069, #12235 document this:

- **Observed**: Hooks receive new UUID when resuming with `--resume`
- **Expected**: Same session_id or additional `original_session_id` field
- **Impact**: External systems tracking by session_id lose continuity
- **Workaround**: Track by transcript_path instead, or accept multiple session_ids per logical session

### No Built-In Directory Migration

When projects are moved, session history is orphaned:
- `/home/user/old-path/myproject` has sessions under `-home-user-old-path-myproject`
- Moving to `/home/user/new-path/myproject` creates new sessions under `-home-user-new-path-myproject`
- Manual fix: `mv ~/.claude/projects/-old-encoded-path ~/.claude/projects/-new-encoded-path`

### No Background Process Persistence

Long-running bash commands are not restored on resume. If Claude was running `npm test` when interrupted:
- The conversation history shows the command was issued
- The actual process does not restart
- Claude has no memory of whether it completed

### Limited Crash Context

On crash, the session file reflects the last completed write:
- Mid-response crashes may truncate Claude's last message
- Tool use in progress may be missing its response
- The conversation can continue but context about the crash point is lost

### Volatile Container Storage

In Replit and similar environments, session storage may be in volatile overlay filesystems:
- Container restarts wipe `~/.claude/`
- Workaround: Sync to persistent storage (`/workspace/` in Replit)

### tmux Pane Association Not Intrinsic

Claude Code has no native understanding of which tmux pane it runs in:
- Pane tracking requires external hooks (like statusline plugin)
- Crash recovery requires rebuilding the pane-to-session mapping
- Different Claude instances in different panes are independent

## Recommendations

For implementing an auto-restore system for multiple Claude Code instances after PC crash:

### 1. Capture Session State Continuously

Extend the statusline plugin's registry to include:
- Session ID
- tmux pane ID
- Working directory
- Current task description
- Last prompt (for context)
- tmux window/pane layout

```json
{
  "4c629599-49c6-492f-8e83-daf70424ee24": {
    "pane_id": "%44",
    "cwd": "/home/user/path",
    "name": "Claude-4c629599",
    "task": "Building cards plugin",
    "last_prompt": "Initialize the cards plugin with research and resources skills",
    "model": "claude-opus-4-5-20251101",
    "tmux_session": "main",
    "tmux_window": "dev",
    "tmux_pane_index": "0",
    "last_seen": "2026-01-29T16:37:00Z",
    "status": "active"
  }
}
```

### 2. Persist Registry to Durable Storage

```bash
# Sync registry every N seconds to tmpfs-safe location
cp ~/.claude/instances/registry.json /home/user/path
```

Or use the hook system to update both locations on every event.

### 3. Capture tmux Layout

```bash
# Save full tmux layout for reconstruction
tmux list-windows -a -F '#{session_name}:#{window_index}:#{window_layout}' > /backup/tmux-layout.txt
tmux list-panes -a -F '#{pane_id}:#{pane_current_path}:#{pane_pid}' > /backup/tmux-panes.txt
```

### 4. Build Restoration Script

```bash
#!/bin/bash
# restore-claude-instances.sh

REGISTRY="/backup/claude-registry.json"
LAYOUT="/backup/tmux-layout.txt"

# 1. Recreate tmux windows/panes from layout
# 2. For each saved session:
#    a. Find or create the corresponding pane
#    b. cd to the saved cwd
#    c. Run: claude --resume $session_id
# 3. Update registry with new pane IDs
```

### 5. Consider Session Naming

Use `/rename` to give sessions meaningful names early:
- Easier to find in `--resume` picker
- Better for logs and crash recovery
- Names persist across restarts

### 6. Implement Context Recovery Prompts

After resuming, the restored Claude won't know about the crash. Consider an initial prompt that:
- Explains the interruption
- Asks Claude to summarize where things were
- Provides any lost context

```bash
claude --resume $SESSION_ID -p "The session was interrupted by a system crash. Please review the conversation history and summarize what we were working on, then continue from where we left off."
```

### 7. Alternative: CONTEXT.md Pattern

For sessions that may be lost entirely, maintain a `.claude/CONTEXT.md` file as documented in GitHub issue #7584:

```markdown
# Session Context Rules
- Update this file after significant changes
- Summarize recent work in one line
- Add next steps if task is incomplete

## Recent Work
- 2026-01-29: Building cards plugin with research/resources skills
- 2026-01-29: Exploring morphological design patterns

## Next Steps
- Create SKILL.md for resources skill
- Implement repository cloning functionality
```

Add to CLAUDE.md:
```markdown
- Read .claude/CONTEXT.md at session start
- Tell user the last thing worked on
- Update CONTEXT.md after significant changes
```

## Sources

### Official Documentation
- [CLI Reference - Claude Code Docs](https://code.claude.com/docs/en/cli-reference)
- [Session Management - Claude API Docs (SDK)](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Common Workflows](https://code.claude.com/docs/en/common-workflows)

### Community Resources
- [Claude Code Session Management Course - Steve Kinney](https://stevekinney.com/courses/ai-development/claude-code-session-management)
- [How I Use Every Claude Code Feature - Shrivu Shankar](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)
- [Claude Code Cheat Sheet - Shipyard](https://shipyard.build/blog/claude-code-cheat-sheet/)
- [Claude Code Cheat Sheet - Devoriales](https://devoriales.com/post/400/claude-code-cheat-sheet-the-reference-guide)
- [Resume Claude Code Sessions After Restart - Mehmet Baykar](https://mehmetbaykar.com/posts/resume-claude-code-sessions-after-restart/)

### GitHub Issues and Discussions
- [Issue #7584: Add Persistent Session Storage to Prevent Context Loss](https://github.com/anthropics/claude-code/issues/7584)
- [Issue #12235: Session ID changes when resuming via --resume](https://github.com/anthropics/claude-code/issues/12235)
- [Issue #8069: SDK resume gives different session_id](https://github.com/anthropics/claude-code/issues/8069)
- [Issue #12646: Local Session History and Context Persistence](https://github.com/anthropics/claude-code/issues/12646)
- [Issue #5293: How To Avoid CLI/Replit Claude Code Crashes](https://github.com/anthropics/claude-code/issues/5293)

### Tools and Projects
- [claude-code-transcripts - Simon Willison](https://github.com/simonw/claude-code-transcripts) - Convert JSONL sessions to HTML
- [claude-JSONL-browser - withLinda](https://github.com/withLinda/claude-JSONL-browser) - Web viewer for session logs
- [claunch - Session Manager](https://github.com/0xkaz/claunch) - Project-based session management with tmux
- [claude-tmux - Niels Groen](https://github.com/nielsgroen/claude-tmux) - TUI for managing Claude Code in tmux
- [Claude Code --continue Migration Guide - Gist](https://gist.github.com/gwpl/e0b78a711b4a6b2fc4b594c9b9fa2c4c) - Internal mechanics explanation

### Usage and Limits
- [When Does Claude Code Usage Reset - CometAPI](https://www.cometapi.com/when-does-claude-code-usage-reset/)
- [Understanding Usage and Length Limits - Claude Help Center](https://support.claude.com/en/articles/11647753-understanding-usage-and-length-limits)
