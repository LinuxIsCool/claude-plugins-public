---
name: tmux
description: Terminal multiplexer layer - sessions, windows, panes, keybindings, and programmatic interaction.
allowed-tools: Bash, Read, Glob
---

# tmux Layer

tmux is a terminal multiplexer that allows multiple terminal sessions within a single window. When Claude Code runs inside tmux, understanding this layer enables powerful workflows.

## Detection

```bash
# Check if in tmux
if [[ -n "$TMUX" ]]; then
  echo "Inside tmux"
  echo "Socket: $(echo $TMUX | cut -d',' -f1)"
  echo "Session ID: $(tmux display-message -p '#S')"
  echo "Window: $(tmux display-message -p '#W')"
  echo "Pane: $(tmux display-message -p '#P')"
else
  echo "Not in tmux"
fi
```

## Concepts

### Hierarchy
```
Server (tmux process)
└── Session (named workspace)
    └── Window (like a tab)
        └── Pane (split within window)
```

### Current Context
```bash
# Full context string
tmux display-message -p '#S:#W.#P'  # session:window.pane

# Detailed info
tmux display-message -p 'Session: #S, Window: #I (#W), Pane: #P (#{pane_width}x#{pane_height})'
```

## Observation Commands

### List Everything
```bash
# All sessions
tmux list-sessions

# All windows in current session
tmux list-windows

# All panes in current window
tmux list-panes

# All panes in all sessions
tmux list-panes -a
```

### Pane Information
```bash
# Current pane details
tmux display-message -p '#{pane_id} #{pane_pid} #{pane_current_command}'

# What's running in each pane
tmux list-panes -F '#{pane_index}: #{pane_current_command} (pid #{pane_pid})'
```

### Session Information
```bash
# Session details
tmux display-message -p 'Created: #{session_created_string}'
tmux display-message -p 'Attached: #{session_attached}'
tmux display-message -p 'Windows: #{session_windows}'
```

## Configuration

### Config File Location
```bash
# Standard location
cat ~/.tmux.conf 2>/dev/null | head -30

# Or XDG location
cat ~/.config/tmux/tmux.conf 2>/dev/null | head -30
```

### Key Bindings
```bash
# List all keybindings
tmux list-keys | head -30

# Find specific binding
tmux list-keys | grep split

# Show prefix key
tmux show-option -g prefix
```

### Options
```bash
# Show all options
tmux show-options -g | head -20

# Specific options
tmux show-option -g mouse
tmux show-option -g base-index
tmux show-option -g default-terminal
```

## Action Commands

### Window Management
```bash
# Create new window
tmux new-window -n "window-name"

# Rename current window
tmux rename-window "new-name"

# Switch windows
tmux select-window -t :0  # by index
tmux select-window -t :name  # by name
```

### Pane Management
```bash
# Split horizontally (side by side)
tmux split-window -h

# Split vertically (top/bottom)
tmux split-window -v

# Navigate panes
tmux select-pane -U  # up
tmux select-pane -D  # down
tmux select-pane -L  # left
tmux select-pane -R  # right

# Resize panes
tmux resize-pane -U 5  # up 5 lines
tmux resize-pane -R 10  # right 10 columns

# Zoom pane (toggle)
tmux resize-pane -Z
```

### Send Keys to Other Panes
```bash
# Send text to pane 1
tmux send-keys -t 1 "echo hello" Enter

# Send to specific window:pane
tmux send-keys -t :0.1 "command" Enter

# Send special keys
tmux send-keys -t 1 C-c  # Ctrl-C
tmux send-keys -t 1 Escape
```

### Capture Pane Content
```bash
# Capture visible content
tmux capture-pane -p

# Capture with history
tmux capture-pane -p -S -100  # last 100 lines

# Capture specific pane
tmux capture-pane -t 1 -p
```

## Session Management

```bash
# Create new session
tmux new-session -d -s "session-name"

# Attach to session
tmux attach-session -t "session-name"

# Kill session
tmux kill-session -t "session-name"

# Switch session (from within tmux)
tmux switch-client -t "session-name"
```

## Environment Variables

```bash
# tmux-specific
echo "TMUX: $TMUX"
echo "TMUX_PANE: $TMUX_PANE"
echo "TERM: $TERM"  # Usually tmux-256color

# Get tmux environment
tmux show-environment | head -10
```

## Integration Patterns

### Claude Code + tmux
When Claude Code runs in tmux:
- Can query other panes for context
- Can split panes for parallel work
- Can send commands to other panes
- Can capture output from other panes

### Workflow Example
```bash
# See what's in the pane to the right
tmux capture-pane -t '{right}' -p | tail -20

# Send a command to run tests in another pane
tmux send-keys -t 1 "npm test" Enter
```

## Common Configuration

```bash
# Typical ~/.tmux.conf settings
# Show current config values
tmux show-options -g | grep -E "^(mouse|prefix|base-index|pane-base-index|default-terminal)"
```

## Troubleshooting

### Not Responding
```bash
# Check if tmux server is running
pgrep -l tmux

# List server info
tmux info | head -10
```

### Wrong Terminal
```bash
# Check TERM value
echo $TERM

# Should be tmux-256color or similar
# If wrong, check tmux.conf default-terminal setting
```

## Safety Considerations

- **send-keys** can disrupt running processes
- **kill-pane** destroys without confirmation
- Always confirm before sending to unknown panes
- Capture pane content before modifying

## Relationship to Other Layers

- **Claude Code**: Claude runs in a tmux pane
- **nvim**: nvim may run in another pane
- **fish**: fish is the shell in panes (but Bash tool uses bash)
- **alacritty**: Renders the tmux session
