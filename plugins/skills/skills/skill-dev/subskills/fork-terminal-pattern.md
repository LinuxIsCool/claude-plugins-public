# Fork Terminal Pattern

Fork terminal sessions to new windows with agentic tools. Based on disler/fork-repository-skill.

## Source

- **Repository**: https://github.com/disler/fork-repository-skill
- **Pattern**: Spawn new Claude/Codex/Gemini sessions in separate terminals

## Core Concept

Fork the current conversation context to a new terminal window running:
- Claude Code
- Codex CLI
- Gemini CLI
- Raw CLI commands

## Directory Structure

```
fork-terminal/
├── SKILL.md
├── cookbook/
│   ├── claude-code.md
│   ├── codex-cli.md
│   ├── gemini-cli.md
│   └── cli-command.md
├── prompts/
│   └── fork_summary_user_prompt.md
└── tools/
    └── fork_terminal.py
```

## SKILL.md Pattern

```yaml
---
name: Fork Terminal Skill
description: Fork a terminal session to a new terminal window. Use when the user requests 'fork terminal' or 'create a new terminal' or 'new terminal: <command>'.
---

# Purpose

Fork a terminal session using agentic coding tools or raw CLI.
Follow the `Instructions`, execute the `Workflow`, based on the `Cookbook`.

## Variables

ENABLE_RAW_CLI_COMMANDS: true
ENABLE_CLAUDE_CODE: true
ENABLE_CODEX_CLI: true
ENABLE_GEMINI_CLI: true

## Instructions

Based on user request, follow the Cookbook to determine which tool to use.

## Cookbook

### Claude Code
- IF: User requests claude code agent
- THEN: Read and execute: `cookbook/claude-code.md`
- EXAMPLES: "fork terminal use claude code to <xyz>"

### Raw CLI
- IF: User requests non-agentic tool
- THEN: Read and execute: `cookbook/cli-command.md`
- EXAMPLES: "Create a new terminal to <xyz> with ffmpeg"
```

## Cookbook Pattern

### claude-code.md
```markdown
# Claude Code Fork

## Command
`./tools/fork_terminal.py "claude <prompt>"`

## Prompt Template
Pass user request as the prompt argument.

## With Summary
If user wants history:
1. Read `prompts/fork_summary_user_prompt.md`
2. Fill in conversation history
3. Pass combined prompt to new session
```

## Prompt Template

```markdown
# Fork Summary

## History
<fill in the history here>

## Next User Request
<fill in the next user request here>
```

## Implementation Details

### fork_terminal.py

```python
#!/usr/bin/env python3
"""Fork terminal to new window with command."""

import subprocess
import sys

def fork_terminal(command: str):
    """Open new terminal with command."""
    # macOS
    subprocess.run([
        "osascript", "-e",
        f'tell app "Terminal" to do script "{command}"'
    ])
    # Linux alternative: gnome-terminal, xterm, etc.

if __name__ == "__main__":
    fork_terminal(sys.argv[1])
```

## Use Cases

### Parallel Work
Fork exploration while continuing current task:
```
"fork terminal use claude to research the API docs while I implement"
```

### Isolated Testing
Run tests in separate environment:
```
"create a new terminal to run the test suite"
```

### Long-Running Tasks
Offload long operations:
```
"fork terminal to build and deploy in background"
```

## Key Insights

1. **Variables as Configuration**
   Use skill-level variables for feature flags.

2. **Cookbook for Branching Logic**
   IF/THEN/EXAMPLES pattern for conditional execution.

3. **Prompt Templates**
   Separate prompts into files for reuse and maintenance.

4. **Tool Scripts**
   Executable scripts for deterministic operations.

5. **Multi-Agent Coordination**
   Fork enables parallel agent work on related tasks.
