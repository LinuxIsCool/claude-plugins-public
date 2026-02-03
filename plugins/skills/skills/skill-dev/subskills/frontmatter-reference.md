# YAML Frontmatter Reference

Complete reference for all SKILL.md frontmatter fields.

## Required Fields

### `name`

**Type**: string
**Max Length**: 64 characters
**Constraints**:
- Lowercase letters, numbers, and hyphens only
- Cannot contain reserved words: `anthropic`, `claude`

**Purpose**: Command identifier when invoking the Skill tool.

```yaml
name: processing-pdfs          # Good - gerund form
name: pdf-processing           # Good - noun phrase
name: PDF_Processing           # Bad - uppercase
name: claude-helper            # Bad - reserved word
```

### `description`

**Type**: string
**Max Length**: 1024 characters
**Constraints**:
- Must be non-empty
- Must use **third person** voice

**Purpose**: Primary signal for Claude's skill selection.

**Formula**:
```
[Primary capabilities]. [Secondary features]. Use when [scenarios]. Trigger with "[phrases]".
```

## Optional Fields

### `allowed-tools`

**Type**: CSV string
**Default**: No pre-approved tools

**Purpose**: Pre-approves tools scoped to skill execution only.

```yaml
# Multiple tools
allowed-tools: Read, Write, Glob, Grep, Edit

# Scoped bash commands
allowed-tools: Bash(git status:*), Bash(git diff:*), Read, Grep

# NPM-scoped
allowed-tools: Bash(npm:*), Bash(npx:*), Read, Write

# Read-only
allowed-tools: Read, Glob, Grep
```

**Note**: Only supported in Claude Code, not claude.ai web.

### `model`

**Type**: string
**Default**: `inherit` (session model)

**Purpose**: Override model for skill execution.

```yaml
model: inherit                  # Use session model (default)
model: sonnet                   # Use Sonnet
model: opus                     # Use Opus (complex tasks)
model: haiku                    # Use Haiku (fast, simple)
```

### `context`

**Type**: string
**Values**: `fork`

**Purpose**: Run skill in isolated subagent context.

```yaml
context: fork                   # Isolated execution
```

**Effect**:
- New isolated context created
- Subagent receives skill content as prompt
- No access to conversation history
- Results summarized and returned

### `agent`

**Type**: string
**Used with**: `context: fork`

**Purpose**: Specify which subagent type to use.

```yaml
context: fork
agent: Explore                  # Built-in Explore agent
agent: general-purpose          # General-purpose agent
agent: my-custom-agent          # Custom agent
```

### `disable-model-invocation`

**Type**: boolean
**Default**: `false`

**Purpose**: Prevent Claude from automatically loading this skill.

```yaml
disable-model-invocation: true  # Manual only (/skill-name)
disable-model-invocation: false # Auto-discovery enabled
```

**Use cases**:
- Dangerous operations (deploy, delete)
- Operations requiring explicit user action
- Skills that should never auto-activate

### `user-invocable`

**Type**: boolean
**Default**: `true`

**Purpose**: Hide skill from `/` menu.

```yaml
user-invocable: false           # Hidden from menu
user-invocable: true            # Visible in menu (default)
```

**Use cases**:
- Background knowledge skills
- Skills Claude should use but users shouldn't invoke directly

### `argument-hint`

**Type**: string

**Purpose**: Hint shown in autocomplete.

```yaml
argument-hint: [issue-number]
argument-hint: [filename] [format]
argument-hint: <topic>
```

### `hooks`

**Type**: object

**Purpose**: Hooks scoped to skill lifecycle.

```yaml
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: ./validate.sh
```

**Supported events**: `PreToolUse`, `PostToolUse`, `Stop`

### `version`

**Type**: string (semver)

**Purpose**: Version tracking.

```yaml
version: 1.0.0
version: 2.1.0
```

### `mode`

**Type**: boolean
**Default**: `false`

**Purpose**: Categorize as "mode command" in UI.

```yaml
mode: true                      # Appears in "Mode Commands" section
```

## Enterprise Extension Fields

For marketplace submission (not official Anthropic spec):

### `author`

**Type**: string
**Format**: `Name <email>` or `Name`

```yaml
author: Jane Smith <jane@example.com>
author: Engineering Team
```

### `tags`

**Type**: array of strings

```yaml
tags:
  - devops
  - kubernetes
  - deployment
```

### `license`

**Type**: string

```yaml
license: MIT
license: Apache-2.0
license: Proprietary
```

## Complete Example

```yaml
---
name: reviewing-pull-requests
description: |
  Analyze pull request diffs and generate structured code reviews.
  Checks for bugs, security issues, performance problems, and style violations.
  Use when reviewing PRs, analyzing code changes, or checking diffs.
  Trigger with "review this PR", "check my code changes", "analyze diff".
allowed-tools: Read, Grep, Glob, Bash(git:*)
version: 1.0.0
author: Skills Plugin <skills@example.com>
tags:
  - code-review
  - git
  - quality
---
```
