# Plug

A declarative plugin manager for Claude Code. Declare your plugins. Plug handles the rest.

```lua
-- plug.lua
return {
  'anthropics/claude-code-plugins/security-guidance',
  'anthropics/claude-code-plugins/feature-dev',
  { 'user/custom-plugin', branch = 'main' },
  { dir = '~/projects/my-plugin' },
}
```

```bash
plug sync   # Install missing, update outdated, remove orphaned
```

## Philosophy

Plug is built on seven core beliefs:

### 1. Plugins Are Compositions, Not Programs

A Claude Code plugin is a composition of capabilities: skills for knowledge, commands for actions, agents for personas, hooks for automation. Plug manages this composition, not the execution.

### 2. Git Is the Universal Transport

Git repositories are the natural unit of plugin distribution. Git provides versioning, history, integrity, and distributed access. Plug doesn't fight this; it embraces it.

### 3. Files Are Configuration

Claude Code's power comes from file-based configuration. Plug extends this: `plug.lua` is declarative, human-readable, version-controllable.

### 4. The Happy Path Is Trivial

Installing a plugin is one command. No account creation. No API keys for basic use. No manual post-install steps.

### 5. Complexity Is Opt-In

Advanced features (local overrides, version pinning, custom sources) exist but don't intrude on basic usage.

### 6. Reproducibility Is Achievable

With `plug-lock.json`, any Plug configuration can be exactly reproduced on any machine at any time.

### 7. Failures Are Visible

When something goes wrong, you know immediately. Error messages tell you what happened and what to do about it.

## Installation

Plug installs itself:

```bash
# Clone Plug to your plugins directory
git clone --depth 1 https://github.com/linuxiscool/plug ~/.claude/plugins/plug

# Run initial setup
~/.claude/plugins/plug/bin/plug init
```

After installation, Plug manages everything—including its own updates.

## Quick Start

### 1. Create a Plugfile

```bash
plug init
```

This creates `~/.claude/plug.lua` (or `.claude/plug.lua` for project-specific plugins).

### 2. Add Plugins

Edit `plug.lua`:

```lua
return {
  -- Official plugins (shorthand)
  'anthropics/claude-code-plugins/security-guidance',
  'anthropics/claude-code-plugins/feature-dev',

  -- Third-party plugin
  'username/awesome-plugin',

  -- With version pinning
  { 'username/stable-plugin', tag = 'v1.2.0' },

  -- Local development
  { dir = '~/projects/my-wip-plugin' },
}
```

### 3. Sync

```bash
plug sync
```

Plug will:
- Install missing plugins
- Update outdated plugins (unless pinned)
- Remove plugins not in your spec
- Generate `plug-lock.json` for reproducibility

## Configuration Format

### String Shorthand

The simplest declaration:

```lua
'username/repo'                    -- GitHub repo
'username/repo/subpath'            -- Subdirectory in repo
```

### Table Format

For advanced options:

```lua
{
  'username/repo',

  -- Version pinning (pick one)
  branch = 'main',           -- Track a branch
  tag = 'v1.0.0',            -- Pin to a tag
  commit = 'abc123',         -- Pin to exact commit

  -- Installation
  enabled = true,            -- Enable/disable (default: true)

  -- Source override
  url = 'git@github.com:org/private-repo.git',  -- Custom URL
}
```

### Local Plugins

For development or private plugins:

```lua
{
  dir = '~/projects/my-plugin',    -- Absolute or ~ path
  name = 'my-plugin',              -- Optional: override name
}
```

## Commands

| Command | Description |
|---------|-------------|
| `plug init` | Create a new Plugfile |
| `plug sync` | Reconcile installed plugins with Plugfile |
| `plug update [plugin]` | Update all or specific plugin |
| `plug list` | List installed plugins |
| `plug status` | Show sync status (what would change) |
| `plug doctor` | Diagnose common issues |
| `plug lock` | Regenerate lockfile without changing plugins |

### Command Flags

```bash
plug sync --dry-run      # Show what would happen without doing it
plug sync --force        # Discard local changes and force sync
plug sync --quiet        # Suppress output except errors
plug update --all        # Update all plugins to latest
```

## File Locations

| File | Purpose | Scope |
|------|---------|-------|
| `~/.claude/plug.lua` | User plugin specification | Global |
| `.claude/plug.lua` | Project plugin specification | Project |
| `~/.claude/plug-lock.json` | Version lockfile | Global |
| `.claude/plug-lock.json` | Project lockfile | Project |

**Precedence**: Project-scope plugins override user-scope for the same plugin name.

## The Lockfile

`plug-lock.json` records the exact state of your plugins:

```json
{
  "version": 1,
  "generated": "2026-01-29T10:00:00Z",
  "plugins": {
    "security-guidance": {
      "source": "https://github.com/anthropics/claude-code-plugins.git",
      "subpath": "plugins/security-guidance",
      "ref": "main",
      "sha": "a1b2c3d4e5f6789..."
    }
  }
}
```

**Why commit SHAs?** Tags are mutable. A maintainer can delete and recreate a tag pointing to different code. Commit SHAs are cryptographically tied to content—if the SHA matches, the code is identical.

### Using the Lockfile

```bash
# Install exact versions from lockfile (CI/reproducible builds)
plug sync --frozen

# Update lockfile to latest versions
plug update --all && plug lock
```

## How Plug Works

### The Sync Algorithm

1. **Inventory**: Read Plugfile and scan installed plugins
2. **Diff**: Compare desired state vs actual state
3. **Preview**: Show the plan (unless `--quiet`)
4. **Execute**: Remove orphaned → Install missing → Update outdated
5. **Lock**: Write `plug-lock.json` with actual installed versions

### Integration with Claude Code

Plug manipulates Claude Code's native plugin infrastructure:

```
~/.claude/plugins/known_marketplaces.json  # Plugin sources
~/.claude/plugins/installed_plugins.json   # Installation tracking
~/.claude/settings.json                    # Enable/disable state
~/.claude/plugins/cache/                   # Plugin files
```

Changes take effect on the next Claude Code session.

## Design Principles

1. **One command, one outcome**: `plug sync` syncs. `plug update` updates. No compound operations.

2. **Configuration is optional**: Works with sensible defaults. Configuration exists for customization.

3. **Git-native**: Plugins come from git repos. Versions are git refs.

4. **Declarative state**: Plugfile describes what you want, not how to get it.

5. **Lockfile integrity**: Same lockfile = same plugins everywhere.

6. **Fail fast, fail loud**: Invalid configs fail immediately with clear errors.

7. **Self-diagnosing**: `plug doctor` helps you fix problems.

8. **Offline-capable**: With cache and lockfile, works without network.

## Troubleshooting

### Common Issues

**Plugin not loading after sync**
```bash
# Claude Code loads plugins at session start
# Restart your Claude Code session after sync
```

**Sync shows "dirty" warning**
```bash
# Plugin has local modifications
plug status              # See which plugin
cd ~/.claude/plugins/cache/[plugin]
git status               # See the changes
git checkout .           # Discard changes, or
plug sync --force        # Force sync (discards changes)
```

**Network errors during sync**
```bash
plug sync --offline      # Use cached versions only
```

### Diagnostics

```bash
plug doctor
```

This checks:
- Plugfile syntax
- Git availability
- Network connectivity
- Claude Code plugin directory permissions
- Plugin integrity

## Contributing

Plug is itself a Claude Code plugin. Contributions welcome:

1. Fork the repository
2. Add Plug to your Plugfile for development:
   ```lua
   { dir = '~/path/to/plug-fork' }
   ```
3. Make changes and test with `plug sync`
4. Submit a pull request

## Development Status

Plug is functional with the following capabilities:

| Feature | Status |
|---------|--------|
| Plugfile parsing (Lua) | Working |
| Local plugin symlinks | Working |
| Remote plugin cloning | Working |
| Lockfile generation | Working |
| Claude Code JSON integration | Working |
| Plugin enable by default | Working |
| `plug init` | Working |
| `plug sync` | Working |
| `plug list` | Working |
| `plug status` | Working |
| `plug doctor` | Working |
| `plug lock` | Working |
| `plug update` | Planned |
| Self-update mechanism | Planned |
| YAML Plugfile support | Planned |

## License

MIT

---

*Inspired by [lazy.nvim](https://github.com/folke/lazy.nvim), [Homebrew](https://brew.sh), and the Unix philosophy.*
