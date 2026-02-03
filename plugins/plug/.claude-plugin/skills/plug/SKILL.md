---
name: plug
description: Plugin management skill for Claude Code. Use when user wants to install, update, remove, sync, or manage plugins. Supports lazy.nvim-style declarative configuration via plug.lua. Commands: sync, list, status, doctor, init.
allowed-tools: Bash, Read, Write, Glob, Grep
---

# Plug - Plugin Manager Skill

Manage Claude Code plugins with a lazy.nvim-style declarative approach.

## Philosophy

**Declare your plugins. Plug handles the rest.**

1. Plugins are compositions, not programs
2. Git is the universal transport
3. Files are configuration
4. The happy path is trivial
5. Complexity is opt-in
6. Reproducibility is achievable
7. Failures are visible

## Quick Start

```bash
# Initialize a Plugfile
plug init

# Edit ~/.claude/plug.lua to add plugins

# Sync plugins with Plugfile
plug sync

# Restart Claude Code to load changes
```

## CLI Commands

| Command | Purpose | Common Flags |
|---------|---------|--------------|
| `plug init` | Create new Plugfile | `--project` |
| `plug sync` | Reconcile installed with Plugfile | `--dry-run`, `--force` |
| `plug list` | List installed plugins | `--skills`, `--commands` |
| `plug status` | Show what sync would change | |
| `plug doctor` | Diagnose common issues | |
| `plug lock` | Regenerate lockfile | |

## Plugin Specification Format

### String Shorthand
```lua
'username/repo'                    -- GitHub repo
'username/repo/subpath'            -- Plugin in subdirectory
```

### Table Format
```lua
{
  'username/repo',
  branch = 'main',           -- Track a branch
  tag = 'v1.0.0',            -- Pin to a tag
  commit = 'abc123',         -- Pin to exact commit
  enabled = true,            -- Enable/disable (default: true)
  url = 'git@github.com:...' -- Custom URL for private repos
}
```

### Local Development
```lua
{
  dir = '~/projects/my-plugin',
  name = 'my-plugin',
}
```

## Example plug.lua

```lua
return {
  -- Official plugins
  'anthropics/claude-code/plugins/feature-dev',
  'anthropics/claude-code/plugins/commit-commands',

  -- Pinned version
  { 'anthropics/claude-code/plugins/security-guidance', tag = 'v1.0.0' },

  -- Local development
  { dir = '~/projects/my-plugin' },

  -- Disabled
  { 'username/heavy-plugin', enabled = false },
}
```

## File Locations

| File | Purpose | Scope |
|------|---------|-------|
| `~/.claude/plug.lua` | User plugin specification | Global |
| `.claude/plug.lua` | Project plugin specification | Project |
| `~/.claude/plug-lock.json` | Version lockfile | Global |
| `~/.claude/plugins/cache/` | Installed plugin files | - |

## Workflow

### When User Asks to Install a Plugin

1. Check if plug.lua exists, create if not: `plug init`
2. Edit plug.lua to add the plugin spec
3. Run `plug sync --dry-run` to preview
4. Run `plug sync` to install
5. Remind user to restart Claude Code

### When User Asks to Update Plugins

1. Run `plug sync` to sync with current spec
2. Or edit plug.lua to change version pins
3. Run `plug sync` again

### When User Asks to Remove a Plugin

1. Edit plug.lua to remove or disable the plugin
2. Run `plug sync` to apply changes

## Cookbook

For detailed procedures:

| Task | Cookbook |
|------|----------|
| Install from GitHub | `cookbook/install.md` |
| Sync with Plugfile | `cookbook/sync.md` |
| Update all plugins | `cookbook/update.md` |

## CLI Location

The plug CLI is at: `${PLUG_ROOT}/bin/plug`

Where `PLUG_ROOT` is the Plug plugin installation directory.
