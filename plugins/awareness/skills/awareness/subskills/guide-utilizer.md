---
name: guide-utilizer
description: Effectively use the claude-code-guide subagent to get accurate information about Claude Code features, hooks, MCP servers, settings, IDE integrations, keyboard shortcuts, Agent SDK, and API usage. Use when you need authoritative answers about Claude Code capabilities.
allowed-tools: Task
---

# Claude Code Guide Utilization Skill

Maximize effectiveness when querying the claude-code-guide subagent.

## What claude-code-guide Knows

The claude-code-guide subagent has access to official documentation about:

1. **Claude Code (CLI)** - Features, hooks, slash commands, MCP servers, settings, IDE integrations, keyboard shortcuts
2. **Claude Agent SDK** - Building custom agents programmatically
3. **Claude API** - API usage, tool use, Anthropic SDK usage

## Query Formulation Principles

### Be Specific, Not Vague

```markdown
# Weak query
"Tell me about hooks"

# Strong query
"What hook events are available in Claude Code? When does each trigger, and what input/output does each receive?"
```

### Include Context

```markdown
# Without context
"How do I create an MCP server?"

# With context
"I want to create an MCP server that exposes custom tools for schedule management. What's the recommended approach using TypeScript and the @modelcontextprotocol/sdk?"
```

### Ask for Specifics

```markdown
# Generic
"How do skills work?"

# Specific
"What is the SKILL.md file format? What fields are required in the frontmatter? How does Claude discover and invoke skills automatically?"
```

## Query Templates

### Feature Understanding
```
What is [feature]? How does it work? What are the key concepts, configuration options, and best practices?
```

### How-To Questions
```
How do I [accomplish X]? Walk me through the steps, file locations, and any configuration needed.
```

### Comparison Questions
```
What's the difference between [A] and [B]? When should I use each?
```

### Debugging Questions
```
I'm trying to [do X] but [problem occurs]. What could be wrong and how do I fix it?
```

### Architecture Questions
```
How is [component] structured? What are the key files, patterns, and integration points?
```

## Continuation Pattern

The claude-code-guide subagent returns an agentId for resumption:

```markdown
# Initial query
Use claude-code-guide: "Explain the hook system in Claude Code"
# Returns: agentId: abc123

# Follow-up (preserves context)
Resume claude-code-guide abc123: "Now show me examples of PostToolUse hooks"
```

## Multi-Part Learning

For complex topics, break into chained queries:

```markdown
# Part 1: Overview
"What are MCP servers and how do they integrate with Claude Code?"

# Part 2: Deep dive (resume)
"How do I define tools in an MCP server?"

# Part 3: Practice (resume)
"Show me a complete example of a simple MCP server"

# Part 4: Advanced (resume)
"How do I handle resources and authentication?"
```

## Topics Best Suited for claude-code-guide

| Topic | Why Guide is Best |
|-------|-------------------|
| Hook events | Authoritative list with exact trigger conditions |
| Settings schema | Complete field definitions |
| CLI flags | All available options with descriptions |
| SDK patterns | Recommended architectures and APIs |
| MCP protocol | Server/tool/resource specifications |

## Topics Where Guide + Exploration is Better

| Topic | Approach |
|-------|----------|
| Real-world patterns | Guide for concepts + Explore for examples in code |
| Debugging | Guide for documentation + Read for actual implementation |
| Integration | Guide for API + WebSearch for community solutions |

## Recording Guide Interactions

After each guide session:

```markdown
## Guide Query: [Topic]
**Date**: YYYY-MM-DD
**Query**: [What you asked]
**Key Answer**: [Main insight gained]
**Follow-up Needed**: [Any gaps to fill]
**Agent ID**: [For resumption]
```

## Common Mistakes

1. **Too broad** - "Explain Claude Code" (too vague, ask specific questions)
2. **Assuming prior context** - Each new query starts fresh (use resume for continuity)
3. **Not resuming** - Losing context by starting new queries instead of resuming
4. **Ignoring agent ID** - The returned ID enables powerful follow-up

## Progression to techniques Skill

Once comfortable with guide-utilizer:
- You can efficiently get authoritative information
- You understand when to use guide vs. other tools
- You can chain queries for complex topics

Progress to **techniques** skill to practice what you've learned.
