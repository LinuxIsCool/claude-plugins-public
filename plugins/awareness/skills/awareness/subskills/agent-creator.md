---
name: agent-creator
description: Create new custom agents and sub-agents for Claude Code. Use when you need specialized AI personalities for specific tasks, want to define new agent types, or need to delegate work to focused agents with specific tool sets and system prompts.
allowed-tools: Read, Write, Edit, Glob, Task
---

# Agent Creator

A meta-skill for creating custom Claude Code sub-agents.

## What is a Sub-Agent?

A sub-agent is a **specialized AI personality** with:
- Its own context window (isolated from main conversation)
- Restricted tool access (only what it needs)
- Custom system prompt (specialized behavior)
- Specific model (can use cheaper models for simple tasks)

## Built-in Agent Types

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| Explore | Fast codebase search | Haiku | Read-only |
| General-purpose | Complex multi-step tasks | Sonnet | All |
| Plan | Research in plan mode | Sonnet | Read-only |

## Custom Agent Structure

Agents are defined as Markdown files:

```
.claude/agents/           # Project agents (shared via git)
~/.claude/agents/         # User agents (personal)
```

## Agent Definition Format

```yaml
---
name: agent-name-kebab-case
description: Clear description of what this agent does and when to use it. Include specific trigger conditions.
tools: Tool1, Tool2, Tool3
model: sonnet|opus|haiku
---

# Agent System Prompt

You are a [specialized role] with expertise in [domain].

## Your Responsibilities
- [Responsibility 1]
- [Responsibility 2]

## Your Approach
1. [Step 1]
2. [Step 2]

## Constraints
- [Constraint 1]
- [Constraint 2]

## Output Format
[How to structure responses]
```

## Creating an Agent: Step by Step

### 1. Identify the Need
- What specialized task requires isolation?
- Why can't the main agent handle this?
- What expertise should this agent have?

### 2. Define the Personality
- What role does this agent play?
- What tone/approach should it use?
- What knowledge domain does it specialize in?

### 3. Select the Model
```yaml
# Use haiku for:
- Simple, fast tasks
- High-volume operations
- Cost-sensitive applications

# Use sonnet for:
- Most tasks
- Good balance of capability and cost

# Use opus for:
- Complex reasoning
- Critical decisions
- Tasks requiring deep understanding
```

### 4. Restrict Tools
Only include tools the agent actually needs:

```yaml
# Read-only agent (safe, can't modify)
tools: Read, Glob, Grep

# Analysis agent (read + search)
tools: Read, Glob, Grep, WebSearch

# Implementation agent (can modify)
tools: Read, Write, Edit, Bash

# Full-capability agent (use sparingly)
tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
```

### 5. Write the System Prompt
The system prompt shapes agent behavior:

```markdown
# Security Reviewer Agent

You are a security expert specializing in code review.

## Your Responsibilities
- Identify security vulnerabilities
- Assess risk levels
- Recommend mitigations

## Your Approach
1. Scan for common vulnerability patterns (OWASP Top 10)
2. Check authentication and authorization logic
3. Review data validation and sanitization
4. Assess cryptographic usage

## Constraints
- Only report confirmed issues, not speculative ones
- Prioritize by severity (Critical > High > Medium > Low)
- Always suggest specific fixes

## Output Format
For each issue found:
- **Location**: file:line
- **Severity**: Critical/High/Medium/Low
- **Issue**: What's wrong
- **Risk**: What could happen
- **Fix**: How to resolve
```

### 6. Test the Agent
- Does it invoke correctly?
- Does it stay within its specialty?
- Are tool permissions appropriate?
- Is the model choice efficient?

## Agent Patterns

### Specialist Agent
Focused expertise in one area:
```yaml
---
name: typescript-expert
description: Expert TypeScript assistance. Use for type issues, generics, advanced patterns.
tools: Read, Glob, Grep
model: sonnet
---
```

### Reviewer Agent
Evaluates and critiques:
```yaml
---
name: code-reviewer
description: Thorough code review. Use after writing significant code.
tools: Read, Glob, Grep
model: sonnet
---
```

### Worker Agent
Executes specific tasks:
```yaml
---
name: test-writer
description: Writes tests for code. Use when tests are needed for a module.
tools: Read, Write, Edit, Bash
model: sonnet
---
```

### Research Agent
Gathers information:
```yaml
---
name: researcher
description: Deep research on topics. Use for complex questions requiring investigation.
tools: Read, Glob, Grep, WebSearch, WebFetch
model: opus
---
```

### Fast Agent
Quick, simple tasks:
```yaml
---
name: formatter
description: Quick code formatting checks. Use for style issues.
tools: Read
model: haiku
---
```

## Agent Invocation Patterns

### Explicit Invocation
```
Use the security-reviewer agent to analyze this authentication code
```

### Chained Invocation
```
Use the researcher agent to understand the problem, then use the implementer agent to fix it
```

### Parallel Invocation
```
Use the typescript-expert and security-reviewer agents in parallel to analyze this module
```

### Background Invocation
```
Run the test-writer agent in the background while I continue working
```

## Agent Resumption

Agents return an `agentId` that can be used to resume:
```
# First invocation
Use the researcher agent to investigate memory leaks
# Returns: agentId: abc123

# Resume with full context
Resume agent abc123 to now suggest specific fixes
```

## Best Practices

### Isolation
- Each agent should have clear boundaries
- Avoid agents that do "everything"
- Use tool restrictions to enforce boundaries

### Naming
- Use descriptive, action-oriented names
- Include the domain in the name
- Keep names concise

### Documentation
- System prompt should be self-contained
- Include examples of expected behavior
- Document constraints clearly

### Testing
- Test with various inputs
- Verify tool restrictions work
- Ensure model choice is appropriate

## Anti-Patterns

1. **God agent** - Too many responsibilities
2. **Over-powered** - More tools than needed
3. **Vague prompt** - Unclear expectations
4. **Wrong model** - Opus for simple tasks, Haiku for complex
5. **No boundaries** - Agent scope creeps into other domains

## Integration with Awareness

When creating agents:
- Document the agent's purpose in learnings
- Track which agents are most useful
- Iterate based on observed behavior
- Consider if skills would be better (model-invoked vs explicit)
