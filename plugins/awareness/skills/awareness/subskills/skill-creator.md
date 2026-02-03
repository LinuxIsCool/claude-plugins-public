---
name: skill-creator
description: Create new skills for Claude Code. Use when you need to define a new capability, package knowledge into a reusable skill, or extend the awareness system. Follows the SKILL.md format and best practices for auto-discovery.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Skill Creator

A meta-skill for creating new Claude Code skills.

## What is a Skill?

A skill is a **model-invoked** capability that Claude autonomously uses based on context matching. Unlike slash commands (user-invoked), skills are discovered and invoked by Claude when the description matches the task at hand.

## Skill Structure

```
skills/
└── my-skill/
    ├── SKILL.md (required)     # Main skill definition
    ├── reference.md (optional) # Supporting documentation
    ├── examples.md (optional)  # Usage examples
    └── scripts/ (optional)     # Helper scripts
```

## SKILL.md Format

```yaml
---
name: skill-name-kebab-case
description: Clear description of what this skill does. Include trigger phrases like "Use when..." to help Claude know when to invoke it. Be specific about the types of tasks this skill handles.
allowed-tools: Tool1, Tool2, Tool3
---

# Skill Title

## Purpose
What problem does this skill solve?

## Instructions
Step-by-step guidance for using this skill.

## Examples
Concrete examples of skill usage.

## Notes
Any caveats, limitations, or special considerations.
```

## Creating a Skill: Step by Step

### 1. Identify the Need
- What capability is missing?
- When would Claude need this?
- Is this truly model-invoked or user-invoked (command)?

### 2. Define the Scope
- What tools are required?
- What's in scope vs out of scope?
- How does this relate to existing skills?

### 3. Write the Description
The description is **critical** for auto-discovery:

```yaml
# Weak description (too vague)
description: Helps with code

# Strong description (specific triggers)
description: Analyze Python code for performance bottlenecks, memory leaks, and optimization opportunities. Use when reviewing slow code, profiling applications, or improving execution speed.
```

### 4. Define Instructions
Clear, actionable steps that Claude should follow:

```markdown
## Instructions

1. First, identify the scope of analysis
2. Use Read tool to examine the target files
3. Look for specific patterns: [list patterns]
4. Provide recommendations in this format: [format]
```

### 5. Add Examples
Concrete examples help Claude understand usage:

```markdown
## Examples

### Example 1: Simple Performance Check
**Input**: "Check if this function has performance issues"
**Approach**: Read the function, identify O(n²) loops, suggest improvements

### Example 2: Memory Analysis
**Input**: "Why is this script using so much memory?"
**Approach**: Look for large data structures, unclosed resources, etc.
```

### 6. Test the Skill
- Does Claude invoke it at the right times?
- Does it work correctly when invoked?
- Are the tool permissions appropriate?

## Best Practices

### Description Writing
- Be specific about trigger conditions
- Include "Use when..." phrases
- List technologies/domains covered
- Mention key capabilities

### Tool Selection
- Only allow tools actually needed
- Prefer read-only tools when possible
- Consider security implications

### Scope Management
- One skill = one clear purpose
- If scope grows, consider splitting
- Cross-reference related skills

### Documentation
- Instructions should be self-contained
- Examples should cover common cases
- Notes should mention limitations

## Common Patterns

### Analysis Skill
```yaml
---
name: code-analyzer
description: Analyze code for [specific aspect]. Use when...
allowed-tools: Read, Glob, Grep
---
```

### Creation Skill
```yaml
---
name: component-creator
description: Create [type of thing]. Use when...
allowed-tools: Read, Write, Edit
---
```

### Transformation Skill
```yaml
---
name: format-converter
description: Convert [X] to [Y]. Use when...
allowed-tools: Read, Write
---
```

### Research Skill
```yaml
---
name: topic-researcher
description: Research [domain]. Use when...
allowed-tools: WebSearch, WebFetch, Read
---
```

## Anti-Patterns

1. **Too broad** - "Helps with everything" (split into specific skills)
2. **Too narrow** - Single use case that could be a prompt
3. **Vague description** - Claude won't know when to invoke
4. **Over-permissioned** - Allowing tools that aren't needed
5. **No examples** - Makes correct usage harder

## Skill vs Command Decision

| Use Skill When | Use Command When |
|----------------|------------------|
| Claude should auto-invoke based on context | User explicitly wants to trigger |
| General capability that applies to many situations | Specific workflow with fixed steps |
| Model judgment needed for when to use | User knows exactly when to use |
| Complex multi-step capability | Simple, direct operation |

## Integration with Awareness

New skills should be:
- **Documented** in your learnings
- **Tested** thoroughly before relying on
- **Reviewed** for how they interact with existing skills

## Next Steps After Creation

1. Test invocation triggers
2. Verify correct behavior
3. Document in awareness learnings
4. Consider if related skills are needed
