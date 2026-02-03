# Interface Plugin

Navigate the vertical interface stack through which Claude Code operates.

## The Stack Model

```
┌─────────────────────────────────────────────┐
│            Claude Code (CLI)                │ ← Your intent enters here
├─────────────────────────────────────────────┤
│                  tmux                        │ ← Session multiplexer
├─────────────────────────────────────────────┤
│                  nvim                        │ ← Editor (if embedded)
├─────────────────────────────────────────────┤
│               fish shell                     │ ← Shell interpreter
├─────────────────────────────────────────────┤
│               alacritty                      │ ← Terminal emulator
├─────────────────────────────────────────────┤
│             Linux Kernel                     │ ← System calls
├─────────────────────────────────────────────┤
│               Pop!_OS                        │ ← Distribution
└─────────────────────────────────────────────┘
```

## Relationship to Exploration

| Plugin | Metaphor | Axis | Question |
|--------|----------|------|----------|
| **exploration** | Cartographer | Horizontal (circles) | "What exists around me?" |
| **interface** | Navigator | Vertical (stack) | "How do I operate through this?" |

**Exploration** tells you tmux exists. **Interface** tells you how to split panes.

## Components

### Master Skill
`interface:interface` - Navigation through the interface stack

### Sub-Skills (8)
| Sub-Skill | Domain |
|-----------|--------|
| `stack-overview` | Complete stack model and data flow |
| `claude-code` | Claude Code CLI behavior and tools |
| `tmux` | Sessions, windows, panes, keybindings |
| `nvim` | Buffers, remote commands, embedding |
| `fish` | Completions, abbreviations, functions |
| `alacritty` | Terminal config, rendering, colors |
| `kernel` | Syscalls, processes, devices |
| `popos` | Packages, COSMIC, systemd |

### Agent
`interface:interface-navigator` - Opus-powered deep stack analysis

### Command
`/interface:stack` - Detect and display current stack context

## Usage

### Quick Stack Check
```
/interface:stack
```

### Load Interface Skill
```
Skill(interface:interface)
```

### Spawn Navigator Agent
```
Task(subagent_type="interface:interface-navigator", prompt="Analyze my current interface stack")
```

### Access Sub-Skill
```
Read: plugins/interface/skills/interface-master/subskills/tmux.md
```

## Capability Modes

| Mode | Default | Description |
|------|---------|-------------|
| **Observe** | Yes | Read configs, list state, query capabilities |
| **Act** | On request | Split panes, send keys, modify configs |

Actions require explicit user confirmation.

## Installation

The plugin is part of the linuxiscool-claude-plugins marketplace. Enable it in `~/.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "interface@linuxiscool-claude-plugins": true
  }
}
```

Then restart Claude Code.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025-12-13 | Initial release with 8 sub-skills, navigator agent, /stack command |
