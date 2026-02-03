---
description: "List or jump to Claude agent panes across tmux"
argument-hint: "[list|jump|keybind]"
---

# Claude Agents Navigation

Navigate between Claude agent panes across all tmux sessions.

## Arguments

- **list** - Show all active Claude agent panes (default)
- **jump** - Open interactive fuzzy finder to jump to an agent
- **keybind** - Show how to set up the `prefix + g` keybinding

## What To Do

### List Mode (default)

Run the agent scanner to show all Claude agents:

```bash
# From plugin root (plugins/interface/)
./tools/agent-scanner.sh

# Or with full path relative to repo root
plugins/interface/tools/agent-scanner.sh
```

Present results in a table format:

| Pane | Summary |
|------|---------|
| 0:0.0 | ✳ Subagent Output Styles |
| 0:1.0 | ✳ Calendar Sync Settings |
| ... | ... |

### Jump Mode

For interactive selection, tell the user to run:

```bash
# Option 1: Direct execution (from repo root)
plugins/interface/tools/agent-finder.sh

# Option 2: As tmux popup (recommended - use absolute path or configure keybinding)
# If keybinding is configured, just press: prefix + g
tmux display-popup -E -w 80% -h 60% "$(pwd)/plugins/interface/tools/agent-finder.sh --popup"
```

### Keybind Mode

Show the user how to add the keybinding to their tmux config:

```bash
# Add to ~/.tmux.conf (replace /path/to/repo with actual path)
bind-key g display-popup -E -w 80% -h 60% "/path/to/repo/plugins/interface/tools/agent-finder.sh --popup"

# Then reload tmux config
tmux source-file ~/.tmux.conf
```

After setting up, press `prefix + g` to open the agent finder popup.

## How It Works

1. **Scanner** (`agent-scanner.sh`): Queries tmux for all panes, filtering for Claude agents by detecting the `✳` prefix in pane titles. Claude Code sets pane titles via terminal escape sequences.

2. **Finder** (`agent-finder.sh`): Uses fzf for fuzzy searching the agent list, then switches to the selected pane using `tmux switch-client`.

3. **Pane Titles**: Claude Code automatically sets pane titles to `✳ Summary` where Summary describes the current task. This is set via ANSI escape sequences (`\033]0;Title\007`).

## Technical Note

The actual statusline (showing model, context %, cost, etc.) is rendered inside Claude Code's TUI using VT100 scrolling regions. This makes it invisible to `tmux capture-pane`. Instead, we use pane titles which contain the task summary - equally useful for navigation.

$ARGUMENTS
