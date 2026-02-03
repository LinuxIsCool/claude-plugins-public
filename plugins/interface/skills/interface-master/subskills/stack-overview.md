---
name: stack-overview
description: The complete mental model of the interface stack - how layers interact, data flows, and where Claude Code sits in the hierarchy.
allowed-tools: Read, Bash
---

# Stack Overview

The interface stack is the vertical hierarchy of software layers through which Claude Code operates. Understanding this stack illuminates both capabilities and constraints.

## The Complete Model

```
                     USER INTENT
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE (CLI)                           │
│  • Receives user input via terminal                             │
│  • Executes tools (Bash, Read, Write, etc.)                     │
│  • Outputs responses to terminal                                │
│  • May run standalone or embedded in editor                     │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        TMUX (optional)                          │
│  • Multiplexes single terminal into many                        │
│  • Provides session persistence                                 │
│  • Manages windows and panes                                    │
│  • Adds its own keybindings (prefix + key)                      │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NVIM (optional)                           │
│  • Editor that may host terminal buffers                        │
│  • Claude Code can run inside nvim :terminal                    │
│  • Provides buffer, window, tab management                      │
│  • Has its own mode system (normal, insert, visual)             │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FISH SHELL                                │
│  • Interprets commands from Claude Code's Bash tool             │
│  • Provides completions, abbreviations, functions               │
│  • Manages environment variables                                │
│  • Actually bash runs for Bash tool, but fish is login shell    │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ALACRITTY                                  │
│  • Terminal emulator - renders text to screen                   │
│  • GPU-accelerated rendering                                    │
│  • Handles font rendering, colors, scrollback                   │
│  • Translates keyboard input to terminal codes                  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LINUX KERNEL                                 │
│  • Provides system calls for all operations                     │
│  • Process management (fork, exec, signals)                     │
│  • File I/O (open, read, write, close)                          │
│  • Network operations (socket, connect, send)                   │
│  • Device access (/dev/*, ioctl)                                │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      POP!_OS                                    │
│  • Ubuntu-based distribution from System76                      │
│  • Package management (apt, flatpak)                            │
│  • COSMIC desktop environment                                   │
│  • systemd service management                                   │
│  • Pop Shell tiling window management                           │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
                     HARDWARE
           (CPU, RAM, GPU, Storage, Display)
```

## Data Flow Examples

### When Claude Code Runs `ls`

1. **Claude Code** invokes Bash tool with command `ls`
2. Tool spawns **shell process** (bash, not fish, for Bash tool)
3. Shell forks and execs `/bin/ls`
4. **Kernel** handles exec() syscall, loads ls binary
5. ls makes syscalls to read directory (getdents64)
6. Kernel returns directory entries
7. ls writes output to stdout
8. Output flows back through shell → Claude Code
9. **tmux** (if present) routes output to correct pane
10. **alacritty** renders text to screen via GPU

### When User Types Input

1. User presses key on keyboard
2. **Hardware** generates interrupt
3. **Kernel** keyboard driver receives scancode
4. Converts to character, sends to TTY subsystem
5. **alacritty** receives character via pseudo-terminal
6. If in **tmux**, routes to active pane
7. If in **nvim** terminal buffer, nvim processes
8. Eventually reaches **Claude Code** as input

## Layer Detection

```bash
# Full stack detection script
echo "=== Interface Stack Detection ==="
echo ""
echo "Claude Code: $(which claude 2>/dev/null && echo 'available' || echo 'check PATH')"
echo "TMUX: ${TMUX:-'not in tmux'}"
echo "NVIM: ${NVIM:-'not in nvim'}"
echo "SHELL: $SHELL"
echo "TERM: $TERM"
echo "COLORTERM: ${COLORTERM:-'unset'}"
echo ""
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Kernel: $(uname -r)"
echo ""
echo "Terminal PID: $$"
echo "Parent PID: $PPID"
echo "Process tree:"
pstree -s $$ 2>/dev/null || ps -o pid,ppid,comm --forest
```

## Cross-Layer Interactions

### tmux ↔ nvim
- nvim can run in a tmux pane
- nvim terminal can create nested tmux sessions (avoid this)
- Both have copy/paste systems that can conflict

### fish ↔ bash
- Claude Code's Bash tool runs bash, not fish
- But environment inherits from fish login shell
- Some fish-specific syntax won't work in Bash tool

### alacritty ↔ tmux
- tmux advertises TERM as tmux-256color
- alacritty sets COLORTERM=truecolor
- Color capabilities depend on full chain

## Why This Matters

Understanding the stack helps when:
- **Debugging**: Where in the stack is the problem?
- **Optimizing**: Which layer is the bottleneck?
- **Integrating**: How do layers communicate?
- **Configuring**: Which config file affects which layer?

Claude Code operates through this entire stack. Every command, every output, traverses these layers. Knowing the stack is knowing your operational context.
