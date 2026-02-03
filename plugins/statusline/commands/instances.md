---
description: List all Claude instances with their status, identity, and task
argument-hint: "[active|all|<name>]"
---

# Instances Command

View and manage Claude instance identities across sessions.

## Arguments

- `active` - Show only active instances (default)
- `all` - Show all instances including inactive
- `<name>` - Search for instance by name

## What It Shows

For each instance:
- **Name** - Self-assigned identity (e.g., "Explorer", "Debugger")
- **ID** - Short session ID (first 8 chars)
- **Status** - active/inactive
- **Task** - What the instance is working on
- **Last Seen** - When the instance was last active
- **Directory** - Working directory

## Workflow

### List Active Instances

```bash
# Read registry
python3 plugins/statusline/tools/registry.py list --active
```

Display as formatted table:

```
┌─────────────┬──────────┬────────┬─────────────────────────────────┐
│ Name        │ ID       │ Status │ Task                            │
├─────────────┼──────────┼────────┼─────────────────────────────────┤
│ Explorer    │ 117ec3ac │ active │ Environmental exploration       │
│ Debugger    │ a1b2c3d4 │ active │ Fixing auth bug                 │
│ Architect   │ e5f6g7h8 │ active │ Designing new API               │
└─────────────┴──────────┴────────┴─────────────────────────────────┘
```

### Show All Instances

```bash
python3 plugins/statusline/tools/registry.py list
```

Include inactive instances with dimmed formatting.

### Search by Name

```bash
python3 plugins/statusline/tools/registry.py get <name>
```

Show detailed information for matching instance.

## Output Format

### Table View (Default)

```markdown
## Active Claude Instances

| Name | ID | Status | Task | Last Seen |
|------|-----|--------|------|-----------|
| Explorer | 117ec3ac | active | Environmental exploration | 2 min ago |
| Debugger | a1b2c3d4 | active | Fixing auth bug | 5 min ago |

**Total**: 2 active instances
```

### Detailed View (Single Instance)

```markdown
## Instance: Explorer

- **Session ID**: 117ec3ac-1234-5678-...
- **Status**: active
- **Task**: Environmental exploration and discovery
- **Model**: claude-opus-4-5
- **Directory**: /home/user/path
- **Created**: 2025-12-15T13:30:00Z
- **Last Seen**: 2025-12-15T14:00:00Z
```

## Registry Location

The instance registry is stored at:
- Project: `.claude/instances/registry.json`
- Global: `~/.claude/instances/registry.json`

## Examples

```bash
# List active instances
/statusline:instances

# List all instances (including inactive)
/statusline:instances all

# Find instance by name
/statusline:instances Explorer
```

## Tips

- Use this to see what other Claude sessions are working on
- Helpful for coordinating multi-instance workflows
- Inactive instances are kept for 24 hours before cleanup
- Names are self-assigned based on task using the self-namer skill
