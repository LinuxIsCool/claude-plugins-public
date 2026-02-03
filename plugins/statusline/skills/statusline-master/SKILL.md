---
name: statusline-master
description: Master skill for instance identity management. Sub-skills (3): self-namer, instance-tracker, generation-tuner. Invoke for naming yourself, tracking other instances, or improving name/summary/description generation quality.
allowed-tools: Read, Bash, Write, Edit
---

# Statusline Plugin - Master Skill

Instance identity and multi-Claude coordination.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **self-namer** | Starting a new session, naming yourself | `subskills/self-namer.md` |
| **instance-tracker** | Checking other instances, coordination | `subskills/instance-tracker.md` |
| **generation-tuner** | Improving name/summary/description quality, prompt iteration | `subskills/generation-tuner.md` |

## Core Concept

Every Claude instance should have:
1. **Identity** - A name that reflects its task
2. **Persistence** - Name survives context resets
3. **Visibility** - Name shows in statusline
4. **Traceability** - Links to commits, logs, journal

## The Identity Problem

When multiple Claude instances work in parallel:
- Which Claude made this commit?
- What was this session working on?
- How do I find context from a previous instance?

This skill solves identity by enabling self-naming and tracking.

## Quick Start

### Name Yourself

When starting a new session or task:

1. Consider your primary task
2. Choose a descriptive name (1-2 words)
3. Register with the instance registry

```bash
python3 plugins/statusline/tools/registry.py register \
  "$SESSION_ID" "Explorer" \
  --task "Environmental exploration" \
  --model "claude-opus-4-5" \
  --cwd "$(pwd)"
```

### Check Other Instances

```bash
python3 plugins/statusline/tools/registry.py list --active
```

## Naming Conventions

| Task Type | Example Names |
|-----------|---------------|
| Exploration/Discovery | Explorer, Cartographer, Scout |
| Code Review | Reviewer, Auditor, Inspector |
| Documentation | Scribe, Documenter, Writer |
| Debugging | Debugger, Detective, Fixer |
| Architecture | Architect, Designer, Builder |
| Testing | Tester, Validator, QA |
| Refactoring | Refactorer, Optimizer, Cleaner |
| General | Claude-{short_id} |

Guidelines:
- Short (1-2 words)
- Descriptive of the task
- Unique among active instances
- Professional but memorable

## Integration Points

### Git Commits

Add to commit message trailers:
```
feat: Add new feature

Session-Id: a1b2c3d4
Instance-Name: Explorer
```

### Journal Entries

Include in YAML frontmatter:
```yaml
session_id: a1b2c3d4
instance_name: Explorer
author: claude-opus-4-5
```

### Logs

Already tracked - logs are named with session ID.

## Registry Format

```json
{
  "a1b2c3d4-5678-...": {
    "name": "Explorer",
    "task": "Environmental exploration",
    "model": "claude-opus-4-5",
    "cwd": "/home/user/path",
    "created": "2025-12-15T13:30:00Z",
    "last_seen": "2025-12-15T14:00:00Z",
    "status": "active"
  }
}
```

## How to Use

### At Session Start

1. Read any existing registry to check for name conflicts
2. Determine your primary task
3. Choose an appropriate name
4. Register yourself

### During Session

1. Update task description if focus changes
2. Keep last_seen updated (automatic via statusline)

### At Session End

1. Mark yourself inactive (or let timeout handle it)
