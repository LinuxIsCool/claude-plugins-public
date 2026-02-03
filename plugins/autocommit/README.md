# Autocommit Plugin

Intelligent version control that commits work based on human-agent collaboration signals.

## Philosophy

Traditional version control requires explicit commit actions. Autocommit recognizes that your natural conversation already contains the signals needed:

- "looks good" → Previous work approved → **COMMIT**
- "still not working" → Previous work incomplete → **SKIP**

The user's language IS the commit gate. No extra actions required.

## Features

- **Sentiment-based commits**: Analyzes user messages to detect approval/rejection
- **Rich commit messages**: Captures the "third mind" - collaborative insights
- **Safety-first**: Never commits secrets, warns on large files
- **Proactive guidance**: Suggests .gitignore additions for common pitfalls
- **Works standalone**: No dependencies required - enhanced by ecosystem if available

## How It Works

```
UserPromptSubmit Event
         ↓
    Git Status Check
         ↓
    [No changes?] → Exit
         ↓
    Safety Analysis
         ↓
    Call Haiku with:
    - User's message (sentiment)
    - Last assistant response (context)
    - Changed files (what)
    - Diff content (details)
         ↓
    Haiku decides: COMMIT or SKIP
         ↓
    [COMMIT] → Generate rich message → git add + commit
    [SKIP] → Log reason → Continue
```

## Installation

The plugin auto-activates when installed. No configuration required for basic usage.

## Configuration (Optional)

Create `.claude/autocommit.conf`:

```ini
# Enable/disable (default: true)
ENABLED=true

# Backend: headless (free) or api (costs credits)
BACKEND=headless

# Additional patterns to never commit
NEVER_COMMIT=*.log,tmp/*

# Log decisions (default: true)
LOG_DECISIONS=true
```

## Commands

- `/autocommit:status` - Show pending changes and recent decisions
- `/autocommit:organize` - Organize accumulated changes into semantic commits

### /autocommit:organize

When changes accumulate without commits (common during focused work sessions), this command helps organize them into structured, meaningful commits.

**What it does:**
1. Analyzes all uncommitted changes
2. Groups files by namespace (plugins, journal, system, etc.)
3. Detects semantic units (related changes that belong together)
4. Generates rich commit messages with context and insights
5. Presents a commit plan for your approval
6. Executes approved commits

**Usage:**
```bash
/autocommit:organize              # Interactive mode - analyze and ask for approval
/autocommit:organize --dry-run    # Show plan without executing
/autocommit:organize --scope journal  # Only organize journal files
```

**Example:**
```
## Commit Plan

Found 12 uncommitted files across 3 namespaces.

### Proposed Commits (3 commits)

1. [journal] add: Dec 17 entries (4 files)
2. [plugin:autocommit] create: organize command (2 files)
3. [plugin:agentnet] update: TUI improvements (6 files)

Approve? (yes/no/edit):
```

**Grouping signals:**
- **Namespace**: Files in same directory/plugin
- **Temporal proximity**: Files modified around same time
- **Logical coupling**: Related imports/references
- **Action type**: Creates vs updates vs fixes

**Safety**: Applies same safety rules as the autocommit hook - never commits secrets, warns on large files.

## Commit Message Format

Autocommit generates rich, insightful commit messages:

```
[agent:Phoenix] update: implement sentiment-based autocommit

## Context
User wanted automatic version control respecting natural collaboration flow.
The insight: UserPromptSubmit signals approval without explicit action.

## Insights
- User's language already contains commit-worthiness signals
- "looks good" vs "still broken" is all the information needed
- Headless Claude requires empty stdin (undocumented gotcha)

## Changes
- Created autocommit plugin with UserPromptSubmit hook
- Single Haiku call for decision + message generation
- Safety checks for secrets and large files

## Third Mind Notes
The breakthrough: natural conversation IS the commit protocol.
This transforms version control from mechanical to collaborative.

---
Session: 298311d7-dc9e-4d73-bbb3-323eaba7d29e
Agent: Phoenix

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Phoenix <agent@claude-ecosystem>
```

## Safety Rules

### Never Commits
- `.env*` files
- Files matching `secret`, `credential`, `password`, `token`
- `*.key`, `*.pem` files

### Warns About
- Files >5MB
- Common gitignore candidates (`node_modules/`, `__pycache__/`, etc.)

### Never Risks Data Loss
- Only stages files, never `git clean`
- On failure, logs and continues

## Logs

Decisions logged to `.claude/autocommit.log`:

```
[2025-12-17T09:45:00] COMMIT a3edb0d - [agent:Phoenix] update: feature
[2025-12-17T09:50:15] SKIP - User reported: "still not working"
[2025-12-17T10:00:30] WARNING - .env.local detected, auto-skipped
```

## Optional Integrations

Autocommit works fully standalone but is enhanced by ecosystem plugins when available:

| Plugin | When Available | When Missing |
|--------|----------------|--------------|
| **Statusline** | Uses human-readable agent names (e.g., "Phoenix") | Uses session ID prefix (e.g., "Session-a3edb0d") |
| **Logging** | Includes conversation context for better decisions | Decides from user prompt + diff only |

Integrations are detected at runtime. Use `DEBUG_AUTOCOMMIT=1` to see integration status:

```
[autocommit] ✓ Statusline integration: agent names available
[autocommit] ✓ Logging integration: conversation context available
```

Or without the plugins:
```
[autocommit] ○ Statusline not found: using session ID for attribution
[autocommit] ○ Logging not found: decisions based on user prompt + diff only
```

## Technical Notes

Based on proven patterns from statusline plugin:
- Wrapper script handles `uv run` stdin limitation
- `--setting-sources ""` prevents recursive hook triggering
- `input=""` prevents headless Claude from hanging

## License

MIT
