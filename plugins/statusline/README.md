# Statusline Plugin

Instance identity and statusline management for multi-Claude coordination.

## Philosophy

> *Know thyself. Name thyself. Track thyself.*

When multiple Claude instances work in parallel, identity becomes crucial:
- Which Claude made this commit?
- What was this session working on?
- How do I find the context from a previous instance?

This plugin solves the identity problem by:
1. **Self-naming** - Each instance names itself based on its task
2. **Persistence** - Names persist across context window resets
3. **Tracking** - All instances registered with timestamps and tasks
4. **Display** - Statusline shows identity at a glance

## Quick Start

```bash
# Install (one-time setup)
/statusline:install

# See all running instances
/statusline:instances

# Self-naming happens automatically via SessionStart hook
# Claude can update its name using the statusline skill
```

## Data Storage

Runtime data stored in `.claude/instances/`:

```
.claude/instances/
├── registry.json       # session_id → {name, task, created, model}
├── active/             # Currently running (symlinks or markers)
└── history/            # Archived instances for reference
```

## Statusline Display

The statusline shows:
```
[Explorer:a1b2c] 📁 exploration | ctx:45% | $0.12
```

Where:
- `Explorer` = Self-assigned instance name
- `a1b2c` = Short session ID (first 5 chars)
- `exploration` = Current directory
- `ctx:45%` = Context window usage
- `$0.12` = Session cost

## Components

### Tools

| Tool | Purpose |
|------|---------|
| `statusline.sh` | Script that renders the statusline |
| `registry.py` | Python module for instance registry operations |

### Commands

| Command | Purpose |
|---------|---------|
| `/statusline:install` | One-time setup (symlinks, settings, hooks) |
| `/statusline:instances` | Show all instances with status |

### Skills

| Skill | Purpose |
|-------|---------|
| `statusline-master` | Master skill for instance management |
| `self-namer` | Help Claude name itself based on task |
| `instance-tracker` | Coordinate with other instances |

### Hooks

| Hook | Purpose |
|------|---------|
| `session-start.sh` | Auto-register on session start (captures session_id via JSON stdin) |

## Installation

Run the install command:
```bash
/statusline:install
```

This automatically:
1. Symlinks `statusline.sh` and `session-start.sh` hook to `~/.claude/`
2. Configures `settings.json` with statusline and hook settings
3. Creates `~/.claude/instances/` for the registry

**Restart Claude Code** after installation to activate.

### Manual Installation

If you prefer manual setup:

1. Enable in `~/.claude/settings.json`:
```json
{
  "enabledPlugins": {
    "statusline@linuxiscool-claude-plugins": true
  },
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  },
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "~/.claude/hooks/session-start.sh",
        "timeout": 10
      }]
    }]
  }
}
```

2. Create symlinks:
```bash
ln -sf /path/to/plugins/statusline/tools/statusline.sh ~/.claude/statusline.sh
ln -sf /path/to/plugins/statusline/hooks/session-start.sh ~/.claude/hooks/session-start.sh
chmod +x ~/.claude/statusline.sh ~/.claude/hooks/session-start.sh
```

## Self-Naming Convention

Instances name themselves based on their primary task:

| Task Type | Example Name |
|-----------|--------------|
| Exploration/Discovery | Explorer, Cartographer |
| Code Review | Reviewer, Auditor |
| Documentation | Scribe, Documenter |
| Debugging | Debugger, Detective |
| Architecture | Architect, Designer |
| Testing | Tester, Validator |
| General | Claude-{short_id} |

Names should be:
- Short (1-2 words)
- Descriptive of the task
- Unique within active instances

## Linking to Other Systems

### Git Commits

Add session ID to commit trailers:
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

## API

### Registry Format

```json
{
  "a1b2c3d4-5678-...": {
    "name": "Explorer",
    "task": "Environmental exploration and discovery",
    "model": "claude-opus-4-5",
    "created": "2025-12-15T13:30:00Z",
    "last_seen": "2025-12-15T14:00:00Z",
    "cwd": "plugins/exploration",
    "status": "active"
  }
}
```

### Python API

```python
from statusline.tools.registry import InstanceRegistry

registry = InstanceRegistry()

# Register self
registry.register(
    session_id="a1b2c3d4...",
    name="Explorer",
    task="Environmental exploration",
    model="opus"
)

# List active
active = registry.list_active()

# Find by name
instance = registry.find_by_name("Explorer")
```

## Version History

- **0.1.0** - Initial release with registry, statusline, and /instances command

## License

MIT
