# Agent Navigation Sub-Skill

Navigate between Claude agent panes across tmux sessions using fuzzy search.

## Purpose

When running multiple Claude Code instances across tmux panes, this sub-skill enables quick navigation between them using pane titles as identifiers.

## How It Works

### Pane Titles as Agent Identifiers

Claude Code sets the terminal pane title via escape sequences:
```
\033]0;✳ Task Summary\007
```

The `✳` prefix identifies Claude agent panes. The summary describes the current task (e.g., "Calendar Sync Settings", "Autocommit Plugin").

### Why Not Capture the Statusline?

Claude Code uses VT100 scrolling regions (DECSTBM):
```
ESC [ 2 ; 24 r  # Set scrolling region from row 2 to row 24
```

This places the statusline in row 1, OUTSIDE the scrolling region. `tmux capture-pane` only captures content within the scrolling region, making the statusline invisible to capture.

The pane title approach is the reliable alternative - it's visible via `#{pane_title}` format variable in tmux.

## Tools

### agent-scanner.sh

Scans all tmux panes and filters for Claude agents:

```bash
# List all Claude agents (TSV format)
./plugins/interface/tools/agent-scanner.sh

# Output: session:window.pane \t pane_id \t pane_title
# Example: 0:1.0    %9    ✳ Calendar Sync Settings

# fzf-friendly format
./plugins/interface/tools/agent-scanner.sh --format=fzf

# Output: [session:window.pane] ✳ Summary
# Example: [0:1.0] ✳ Calendar Sync Settings

# Include all panes (not just Claude agents)
./plugins/interface/tools/agent-scanner.sh --all
```

### agent-finder.sh

Interactive fuzzy finder using fzf:

```bash
# Direct execution
./plugins/interface/tools/agent-finder.sh

# In tmux popup (recommended)
tmux display-popup -E -w 80% -h 60% "./plugins/interface/tools/agent-finder.sh --popup"

# With preview pane showing captured content
./plugins/interface/tools/agent-finder.sh --preview
```

## Tmux Keybinding

Add to `~/.tmux.conf`:

```bash
# prefix + g: Jump to Claude agent pane
bind-key g display-popup -E -w 80% -h 60% "/path/to/plugins/interface/tools/agent-finder.sh --popup"
```

Reload with: `tmux source-file ~/.tmux.conf`

## Slash Command

The `/interface:agents` command provides navigation help:

```
/interface:agents        # List all Claude agent panes
/interface:agents jump   # Instructions for interactive finder
/interface:agents keybind # Show keybinding setup
```

## Integration with Registry

While the navigation uses pane titles (real-time, accurate), the instance registry at `.claude/instances/registry.json` provides richer metadata:

- `name`: Self-assigned instance name
- `model`: Current model (Opus 4.5, Sonnet 4, etc.)
- `process_number`: Spawn order (C1, C2, C3...)
- `created`/`last_seen`: Timestamps
- `cwd`: Working directory

Future enhancement: Correlate pane_id with session_id to display full registry data in the finder.

## Technical Architecture

```
┌──────────────────────────────────────────────────┐
│                 agent-finder.sh                   │
│         (UI: fzf in tmux display-popup)          │
├──────────────────────────────────────────────────┤
│                 agent-scanner.sh                  │
│         (Data: tmux list-panes + filtering)       │
├──────────────────────────────────────────────────┤
│                    tmux                           │
│  #{pane_title} format variable → Claude agents   │
├──────────────────────────────────────────────────┤
│                 Claude Code                       │
│   Sets pane title via \033]0;✳ Summary\007      │
└──────────────────────────────────────────────────┘
```

## Troubleshooting

### No agents found

1. Ensure Claude Code instances are running
2. Check pane titles: `tmux list-panes -a -F '#{pane_title}'`
3. Verify the `✳` prefix is being set

### fzf not found

Install fzf:
```bash
sudo apt install fzf  # Debian/Ubuntu
brew install fzf      # macOS
```

### Keybinding not working

1. Verify the path in `~/.tmux.conf` is absolute
2. Reload config: `tmux source-file ~/.tmux.conf`
3. Check for conflicts: `tmux list-keys | grep "prefix g"`
