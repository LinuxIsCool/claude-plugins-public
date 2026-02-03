---
name: claude-code
description: Understanding Claude Code CLI - the entry point of the interface stack. Tool behavior, context management, terminal interaction patterns.
allowed-tools: Read, Bash, Glob, Grep
---

# Claude Code Layer

Claude Code is the topmost layer of the interface stack - where user intent enters the system.

## What Claude Code Is

Claude Code is Anthropic's official CLI for Claude. It provides:
- Interactive conversation with Claude models
- Tool access (Bash, Read, Write, Edit, Glob, Grep, etc.)
- Plugin system for extensibility
- Sub-agent spawning for parallel work
- MCP (Model Context Protocol) server integration

## How Claude Code Interfaces

### Input
- Receives text from terminal stdin
- Parses slash commands (`/help`, `/clear`, etc.)
- Interprets tool invocations from Claude's responses

### Output
- Writes responses to terminal stdout
- Renders markdown for display
- Shows tool invocation results
- Displays thinking process (when enabled)

### Tool Execution
When Claude invokes a tool:
1. Claude Code parses the tool call
2. Validates parameters
3. Executes tool (e.g., spawns bash for Bash tool)
4. Captures output
5. Returns result to Claude

## Detection

```bash
# Check Claude Code environment
echo "CLAUDE_CODE_ENTRY: ${CLAUDE_CODE_ENTRY:-'unset'}"
echo "Running as: $(ps -o comm= -p $PPID 2>/dev/null)"

# Check if we're in a Claude Code session
if [[ -n "$CLAUDE_CODE_ENTRY" ]]; then
  echo "Inside Claude Code session"
fi
```

## Key Files

```bash
# Claude Code configuration
~/.claude/settings.json          # User settings
~/.claude/plugins/               # Plugin cache
.claude/                         # Project-level config
CLAUDE.md                        # Project instructions

# Check current settings
cat ~/.claude/settings.json 2>/dev/null | head -20
```

## Tool Behavior Patterns

### Bash Tool
- Spawns a bash shell (even if fish is login shell)
- Commands run in Claude Code's working directory
- Output is captured and returned
- Long-running commands can timeout

### Read Tool
- Reads file contents
- Supports line ranges (offset, limit)
- Can read images, PDFs, notebooks
- Returns content with line numbers

### Write Tool
- Creates or overwrites files
- Requires prior Read for existing files
- Returns success/failure status

### Edit Tool
- Performs string replacement
- `old_string` must be unique in file
- `replace_all` for multiple occurrences

## Context Management

Claude Code maintains context through:

1. **Conversation history**: All messages in session
2. **CLAUDE.md files**: Project instructions loaded automatically
3. **Tool results**: Output from tool invocations
4. **Summarization**: Automatic context compression for long sessions

### CLAUDE.md Hierarchy
```
~/.claude/CLAUDE.md              # User-level (all projects)
./CLAUDE.md                      # Project root
./subdirectory/CLAUDE.md         # Directory-specific
```

## Terminal Interaction

Claude Code interacts with terminal via:
- **stdin**: User input, piped content
- **stdout**: Responses, tool output
- **stderr**: Errors, diagnostics

### Environment Variables
```bash
# Relevant environment
echo "TERM: $TERM"
echo "COLUMNS: $COLUMNS"
echo "LINES: $LINES"
echo "LANG: $LANG"
```

## Plugin Integration

Claude Code loads plugins that provide:
- **Skills**: Invokable knowledge packages
- **Commands**: Slash commands
- **Agents**: Sub-agent definitions
- **Hooks**: Event-triggered scripts
- **MCP servers**: External tool providers

### Plugin Discovery
```bash
# See enabled plugins
cat ~/.claude/settings.json | grep -A 20 "enabledPlugins"

# Plugin cache location
ls ~/.claude/plugins/cache/
```

## Sub-Agent Spawning

Claude Code can spawn sub-agents via the Task tool:
- Each agent gets isolated context
- Can specify model (opus, sonnet, haiku)
- Can restrict available tools
- Runs asynchronously or in background

## Common Operations

### Check Claude Code Status
```bash
# Version
claude --version 2>/dev/null || echo "claude command not found"

# Help
claude --help 2>/dev/null | head -20
```

### Working Directory Context
```bash
# Where Claude Code is operating
pwd
ls -la
git status 2>/dev/null | head -10
```

## Capabilities Within Stack

Claude Code's power depends on the stack:
- **With tmux**: Can reference other panes, sessions
- **With nvim**: Can operate on editor buffers (if embedded)
- **With fish**: Inherits fish environment
- **With alacritty**: Gets full color support

## Limitations

- Cannot directly access previous sessions (stateless between sessions)
- Tool output is truncated at certain sizes
- Cannot see user's screen beyond terminal
- Network calls require explicit tool use (WebFetch, WebSearch)

## Best Practices for Interface Awareness

1. **Detect embedding**: Check if in tmux/nvim before assuming standalone
2. **Respect context**: Use CLAUDE.md for project-specific behavior
3. **Handle long output**: Use head/tail or pagination for large results
4. **Consider timeout**: Long bash commands should use timeout
