# Official Claude Code Skills Documentation

Authoritative reference from code.claude.com and Anthropic engineering.

## Source

- **Primary**: https://code.claude.com/docs/en/skills
- **Blog**: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

## Core Definition

A Claude Skill is a filesystem-based capability package containing:
- Instructions (SKILL.md)
- Executable code (scripts/)
- Resources (references/, assets/)

**Key Insight**: Skills are NOT executable plugins or slash commands. They are prompt-based context modifiers that Claude discovers via description matching.

## Storage Locations

| Location | Path | Scope | Priority |
|----------|------|-------|----------|
| Personal | `~/.claude/skills/<name>/SKILL.md` | All projects | 1 (lowest) |
| Project | `.claude/skills/<name>/SKILL.md` | This project | 2 |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where enabled | 3 |
| Built-in | Platform-provided | Platform | 4 (highest) |

Later sources override earlier ones when names conflict.

## SKILL.md Structure

```yaml
---
name: skill-name                    # Required, max 64 chars
description: What and when to use   # Required, max 1024 chars
allowed-tools: Read, Write, Edit    # Optional, pre-approved tools
model: sonnet                       # Optional, model override
context: fork                       # Optional, isolated execution
agent: Explore                      # Optional, subagent type
disable-model-invocation: true      # Optional, manual only
user-invocable: false               # Optional, hide from menu
argument-hint: [issue-number]       # Optional, autocomplete hint
hooks: {...}                        # Optional, skill-scoped hooks
---

# Skill Title

[Instructions, examples, resources...]
```

## String Substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed when invoking |
| `${CLAUDE_SESSION_ID}` | Current session ID |

## Dynamic Context Injection

Use `!`command`` to run shell commands before sending to Claude:

```yaml
## Context
- Current branch: !`git branch --show-current`
- Staged changes: !`git diff --staged`
```

Commands execute immediately (preprocessing). Claude only sees the output.

## Invocation Control Matrix

| Frontmatter | User Can Invoke | Claude Can Invoke |
|-------------|-----------------|-------------------|
| (default) | Yes | Yes |
| `disable-model-invocation: true` | Yes | No |
| `user-invocable: false` | No | Yes |

## Tool Restriction

```yaml
allowed-tools: Read, Grep, Glob     # Read-only mode
allowed-tools: Bash(git:*), Read    # Scoped bash commands
```

Tools revert to normal permissions after skill completes.

## Best Practices from Official Docs

1. **Keep SKILL.md under 500 lines** - Use supporting files for details
2. **Use imperative voice** - "Analyze data" not "You should analyze"
3. **Include 2-3 concrete examples** with input/output
4. **Document 4+ common errors** with solutions
5. **Use `{baseDir}`** for all paths, never hardcode
6. **One-level-deep references only** - Claude may not fully read nested files
