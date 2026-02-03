---
name: plugin-studier
description: Study and understand plugins in this repository or other Claude Code plugins. Use when learning from existing implementations, understanding plugin patterns, preparing to create new plugins, or analyzing how plugins work together. Examines plugin.json, hooks, commands, skills, and MCP servers.
allowed-tools: Read, Glob, Grep, Task
---

# Plugin Studier

A skill for deeply understanding Claude Code plugin implementations.

## What to Study in a Plugin

### 1. Plugin Manifest
**File**: `.claude-plugin/plugin.json`

```json
{
  "name": "plugin-name",
  "version": "X.Y.Z",
  "description": "What it does",
  "author": { "name": "Author" },
  "keywords": ["keyword1", "keyword2"],
  "commands": ["./commands/"],
  "hooks": { "EventType": [...] },
  "skills": ["./skills/"],
  "mcpServers": "./.mcp.json"
}
```

**Questions to answer**:
- What does this plugin do (description)?
- What extension points does it use (commands, hooks, skills, MCP)?
- What version is it at?

### 2. Commands
**Location**: `commands/*.md`

**Study**:
- Frontmatter (description, argument-hint, allowed-tools)
- Variable interpolation (!date, $ARGUMENTS, $1, $2)
- Output format and structure
- How they interact with user

### 3. Hooks
**Location**: `hooks/` directory or inline in plugin.json

**Study**:
- Which events are hooked (SessionStart, PostToolUse, etc.)
- What language (Python, bash, TypeScript)
- Input/output patterns
- Exit codes used for control flow

### 4. Skills
**Location**: `skills/*/SKILL.md`

**Study**:
- Description (trigger conditions)
- Allowed tools
- Instructions and examples
- Supporting files (scripts, references)

### 5. MCP Servers
**Location**: `.mcp.json`

**Study**:
- Server configuration (command, args, env)
- Tools exposed
- Resources provided
- How Claude interacts with them

## Plugins in This Repository

### brainstorm
**Type**: Command-based
**Pattern**: Structured output generation with YAML frontmatter
**Key Files**:
- `commands/storm.md` - Main command

**Learnings**:
- How to create structured markdown output
- YAML frontmatter for metadata
- Variable interpolation patterns

### logging
**Type**: Hook-based
**Pattern**: Event capture and reporting
**Key Files**:
- `hooks/log_event.py` - Single hook handler for all events
- `README.md` - Detailed documentation

**Learnings**:
- How to handle all hook events
- JSONL storage pattern
- AI-generated summaries
- Markdown report generation

### Schedule.md
**Type**: Full-stack (MCP + Skills + Web UI)
**Pattern**: Complex plugin with TypeScript implementation
**Key Files**:
- `src/mcp/server.ts` - MCP server
- `src/core/schedule.ts` - Business logic
- `skills/yoga-scheduler/SKILL.md` - Example skill

**Learnings**:
- MCP server implementation
- TypeScript plugin structure
- Skill integration with MCP
- Web interface patterns

## Study Process

### Phase 1: Overview
```
1. Read plugin.json manifest
2. List all files in plugin directory
3. Read README.md for documentation
4. Identify extension points used
```

### Phase 2: Deep Dive
```
1. Read each command file
2. Examine hook implementations
3. Study skill definitions
4. Analyze MCP server if present
```

### Phase 3: Patterns
```
1. How does data flow through the plugin?
2. What patterns does it use?
3. How does it integrate with Claude Code?
4. What can be learned for new plugins?
```

### Phase 4: Connections
```
1. How could this plugin work with others?
2. What interfaces does it expose?
3. What would it need from other plugins?
```

## Study Commands

### List plugin structure
```bash
find plugins/[name] -type f | head -50
```

### Read manifest
```bash
cat plugins/[name]/.claude-plugin/plugin.json
```

### Find hook handlers
```bash
grep -r "hooks" plugins/[name]
```

### List MCP tools (if TypeScript)
```bash
grep -r "@tool\|tool(" plugins/[name]/src
```

## Recording Study Findings

```markdown
## Plugin Study: [Name]

**Date**: YYYY-MM-DD
**Version Studied**: X.Y.Z

### Purpose
What does this plugin do?

### Architecture
- Extension points used
- Data flow
- Key files

### Patterns Learned
- Pattern 1: [description]
- Pattern 2: [description]

### Applicable To
Where could I apply these patterns?

### Questions Remaining
What wasn't clear?
```

## Cross-Plugin Analysis

When studying multiple plugins:

| Aspect | brainstorm | logging | Schedule.md |
|--------|------------|---------|-------------|
| Extension Type | Command | Hook | MCP+Skill |
| Language | Markdown | Python | TypeScript |
| Data Storage | .claude/storms/ | .claude/logging/ | schedule/blocks/ |
| Complexity | Simple | Medium | High |

## Anti-Patterns in Plugins

Watch for:
1. **Monolithic hooks** - One hook doing too much
2. **Missing documentation** - No README or SKILL.md
3. **Over-engineering** - Complex solutions for simple problems
4. **Tight coupling** - Hard dependencies on other plugins
5. **Missing error handling** - Hooks that crash silently

## Integration with Awareness

After studying plugins:
- Record patterns in learnings
- Consider how patterns apply to awareness goals
- Identify reusable components
- Plan how to extend or integrate
