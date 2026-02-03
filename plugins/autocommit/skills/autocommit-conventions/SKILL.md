---
name: autocommit-conventions
description: Documents intelligent version control conventions - commit message format, safety patterns, .gitignore guidance, and the "third mind" commit philosophy. Use when discussing autocommit behavior, commit conventions, or understanding version control in this ecosystem.
allowed-tools: Read
---

# Autocommit Conventions

This skill documents the conventions and philosophy behind the autocommit plugin.

## The "Third Mind" Commit Philosophy

Traditional commits capture **what** changed. Third mind commits capture **why it was understood to be the right change** at the moment of collaborative insight.

The "third mind" emerges from human-agent collaboration - it's the shared understanding that exists between the human's intent and the agent's execution. This ephemeral context is usually lost when sessions end. Autocommit captures it.

## Commit Message Format

```
[scope] action: one-line summary

## Context
What problem was being solved? What was the user's original intent?
How did the conversation arrive at this solution?

## Insights
- Key realizations that emerged during the work
- Non-obvious discoveries (gotchas, edge cases, undocumented behaviors)
- Patterns recognized or established

## Changes
Technical summary of what changed. Can reference specific files
and describe the nature of modifications.

## Third Mind Notes
Observations about the collaboration itself:
- What assumptions were challenged during discussion?
- What alternatives were considered and why rejected?
- What makes this solution appropriate for this moment?
- What's the "vibe" of this work - exploratory, corrective, foundational?

---
Session: {full-session-uuid}
Agent: {agent-name}

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: {agent-name} <agent@claude-ecosystem>
```

## Scopes

| Scope | When to Use |
|-------|-------------|
| `[agent:NAME]` | Work done by or attributed to a specific agent |
| `[plugin:NAME]` | Plugin development or configuration |
| `[journal]` | Journal entries |
| `[system]` | Infrastructure, conventions, meta-level changes |
| `[planning]` | Planning documents |
| `[registry]` | Registry updates |

## Actions

| Action | Meaning |
|--------|---------|
| `create` | New artifact or feature |
| `update` | Enhanced or modified existing |
| `fix` | Bug fix or correction |
| `refactor` | Restructured without changing behavior |
| `observe` | Documented observation or analysis |
| `synthesize` | Combined multiple sources or insights |
| `add` | Added content to existing structure |
| `remove` | Removed content or artifacts |

## Decision Logic: When to Commit

The autocommit hook analyzes the user's message on UserPromptSubmit:

### Commit Signals
- Approval expressions: "looks good", "nice", "perfect", "works"
- Moving forward: "now let's", "next", "also", "continue"
- Explicit approval: "yes", "commit it", "ship it"
- Topic change: user asks about something unrelated (previous work implicitly done)

### Skip Signals
- Problems reported: "not working", "error", "wrong", "broken"
- Change requests: "try again", "fix", "change", "redo"
- Clarifications: "I meant", "actually", "wait"
- Continuation: follow-up questions about same in-progress task

## Safety Rules

### Never Commit (Auto-Skip)
- `.env*` files (environment variables with secrets)
- Files matching `secret`, `credential`, `password`, `token`
- `*.key`, `*.pem` files (cryptographic material)
- API keys or tokens in any form

### Warn and Suggest .gitignore
- Files >5MB (large data files)
- `node_modules/`, `__pycache__/`, `.venv/`
- `.DS_Store`, `.idea/`, `.vscode/`
- `dist/`, `build/` (build artifacts)

### Never Risk Data Loss
- Only stage files, never `git clean`
- Never force-push or destructive operations
- On failure, log and continue - don't block session

## Configuration

Create `.claude/autocommit.conf`:

```ini
# Enable/disable autocommit (default: true)
ENABLED=true

# Backend: headless (free with Max) or api (costs credits)
BACKEND=headless

# Additional patterns to never commit (comma-separated)
NEVER_COMMIT=*.log,tmp/*

# Log all decisions (default: true)
LOG_DECISIONS=true
```

## Integration with Ecosystem

### Statusline Plugin
Autocommit reads agent names from the statusline registry at `.claude/instances/registry.json`. This ensures commit attribution matches the session's identity.

### Logging Plugin
Autocommit reads recent assistant responses from the logging plugin's JSONL files to provide context for commit message generation.

### Coordination Conventions
Autocommit follows the commit format specified in `.claude/conventions/coordination.md`, ensuring consistency across all ecosystem commits.

## Log Format

Decisions are logged to `.claude/autocommit.log`:

```
[2025-12-17T09:45:00-08:00] COMMIT a3edb0d - [agent:Phoenix] update: implement feature
[2025-12-17T09:50:15-08:00] SKIP - User reported problem: "still not working"
[2025-12-17T10:00:30-08:00] WARNING - .env.local detected, auto-skipped
[2025-12-17T10:00:30-08:00] GITIGNORE_SUGGEST - .env* should be in .gitignore
```

## Philosophy

Autocommit transforms git history from a changelog into a **collaborative knowledge artifact**. Future agents can reconstruct not just what code existed, but the reasoning and insights that produced it.

The key insight: the user's natural language feedback IS the commit approval signal. No explicit action required - just continue the natural flow of conversation, and appropriate commits emerge.
