---
name: interface
description: Master skill for interface stack navigation (9 sub-skills). Covers: stack-overview, claude-code, tmux, nvim, fish, alacritty, kernel, popos, agent-navigation. Invoke to understand or operate through the layered interface stack in which Claude Code is embedded.
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Interface Plugin - Master Skill

Navigate the vertical interface stack through which Claude Code operates.

## The Stack Model

```
┌─────────────────────────────────────────────┐
│            Claude Code (CLI)                │ ← Your intent enters here
├─────────────────────────────────────────────┤
│                  tmux                        │ ← Session multiplexer
│           (session, window, pane)           │
├─────────────────────────────────────────────┤
│                  nvim                        │ ← Editor (if embedded)
│         (buffers, commands, plugins)        │
├─────────────────────────────────────────────┤
│               fish shell                     │ ← Shell interpreter
│        (completions, abbreviations)         │
├─────────────────────────────────────────────┤
│               alacritty                      │ ← Terminal emulator
│           (rendering, input)                │
├─────────────────────────────────────────────┤
│             Linux Kernel                     │ ← System calls
│          (processes, devices, IPC)          │
├─────────────────────────────────────────────┤
│               Pop!_OS                        │ ← Distribution
│        (packages, COSMIC, systemd)          │
└─────────────────────────────────────────────┘
```

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **stack-overview** | Understanding the full interface model, layer relationships | `subskills/stack-overview.md` |
| **claude-code** | Learning Claude Code CLI capabilities, tool behavior | `subskills/claude-code.md` |
| **tmux** | Working with sessions, windows, panes, keybindings | `subskills/tmux.md` |
| **nvim** | Interacting with nvim if embedded, buffers, commands | `subskills/nvim.md` |
| **fish** | Fish shell completions, abbreviations, functions | `subskills/fish.md` |
| **alacritty** | Terminal emulator configuration, capabilities | `subskills/alacritty.md` |
| **kernel** | Linux syscalls, process management, devices | `subskills/kernel.md` |
| **popos** | Pop!_OS specifics, COSMIC DE, systemd, packages | `subskills/popos.md` |
| **agent-navigation** | Navigating between Claude agent panes with fuzzy search | `subskills/agent-navigation.md` |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill for your need.

### Deep Dive
To load full sub-skill content:
```
Read: plugins/interface/skills/interface-master/subskills/{name}.md
```

### Detect Current Stack
Quick commands to identify active layers:
```bash
# Am I in tmux?
echo "TMUX: $TMUX"

# Am I in nvim?
echo "NVIM: $NVIM"

# What shell?
echo "SHELL: $SHELL"

# What terminal?
echo "TERM: $TERM"

# What OS?
cat /etc/os-release | grep PRETTY_NAME
```

## Relationship to Exploration

| Plugin | Metaphor | Axis | Question |
|--------|----------|------|----------|
| **exploration** | Cartographer | Horizontal (circles) | "What exists around me?" |
| **interface** | Navigator | Vertical (stack) | "How do I operate through this?" |

**Exploration** tells you tmux exists. **Interface** tells you how to split panes.

## Capability Modes

### Observation (Default)
Safe, read-only exploration of each layer:
- Read configurations
- List sessions/buffers/processes
- Query capabilities
- Understand current state

### Action (On Request)
Execute operations through layers:
- Split tmux panes
- Send keys to nvim
- Run fish functions
- Modify configurations

Always confirm before taking actions that modify state.

## Sub-Skill Summaries

### stack-overview
The complete mental model of how layers interact. Data flow from user intent through each layer to hardware and back. Useful for understanding how Claude Code's commands traverse the stack.

### claude-code
The Claude Code CLI itself. Tool behavior, context management, how Claude interacts with the terminal. The entry point of the stack.

### tmux
Terminal multiplexer layer. Sessions, windows, panes. Prefix keys, configuration. How to detect if in tmux, how to interact programmatically.

### nvim
Editor layer (when Claude Code runs inside nvim). Buffer management, command mode, plugins. Remote communication via `$NVIM` socket.

### fish
Shell interpreter. Completions, abbreviations, functions, variables. Fish-specific syntax and capabilities distinct from bash/zsh.

### alacritty
GPU-accelerated terminal emulator. Configuration (TOML), font rendering, color schemes, keybindings. How terminal capabilities affect display.

### kernel
Linux kernel interface. System calls, process model, file descriptors, signals, devices. The boundary between userspace and kernel.

### popos
Pop!_OS distribution layer. Package management (apt, flatpak), COSMIC desktop environment, systemd services, Pop Shell tiling.

### agent-navigation
Navigate between Claude Code instances across tmux panes. Uses pane titles (set via escape sequences) for fuzzy search with fzf. Includes tools for scanning agents and interactive selection.

## Integration with Agents

The **interface-navigator** agent (`interface:interface-navigator`) provides deep, opus-powered understanding of the interface stack. Use when you need:
- Comprehensive layer analysis
- Cross-layer problem diagnosis
- Interface optimization suggestions

Invoke via:
```
Task(subagent_type="interface:interface-navigator", ...)
```
