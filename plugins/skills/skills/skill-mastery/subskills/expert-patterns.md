# Expert Patterns - Advanced Skill Development

Patterns for complex skills that go beyond basic capabilities.

## Learning Objectives

By the end of this level, you will:
- Apply progressive disclosure to large skill domains
- Use forked context for isolated execution
- Design skill trees with prerequisites
- Handle edge cases and failure modes gracefully

## Pattern 1: Progressive Disclosure

When your skill has 5+ capabilities, use the master + subskills pattern.

### When to Apply

- Total content exceeds 500 lines
- You have distinct sub-capabilities
- Users need different levels of detail
- Risk exceeding 15,000 character context budget

### Implementation

```
skill-name/
├── SKILL.md              # Master: index + overview
└── subskills/
    ├── capability-a.md   # Deep dive on A
    ├── capability-b.md   # Deep dive on B
    └── capability-c.md   # Deep dive on C
```

### Exercise: Convert to Progressive Disclosure

Take a large skill you've created and refactor it:

1. Identify 3-5 distinct capabilities
2. Create master SKILL.md with index table
3. Move detailed content to subskills
4. Test that Claude can navigate to the right subskill

**Validation Questions**:
- Can Claude find the right subskill without guidance?
- Does the master provide enough context to route correctly?
- Is anything duplicated unnecessarily?

## Pattern 2: Forked Context

Some skills benefit from isolated execution.

### When to Apply

- Deep research that might diverge
- Long-running operations
- Skills that shouldn't pollute main conversation
- Parallel execution needs

### Implementation

```yaml
---
name: deep-research
description: Conducts thorough research on a topic. Use for comprehensive investigation.
context: fork
agent: Explore
allowed-tools: Read, Glob, Grep, WebSearch, WebFetch
---

# Deep Research

This skill runs in an isolated context, conducting extensive research
without cluttering the main conversation.

## Instructions

1. Understand the research question
2. Search broadly for relevant sources
3. Synthesize findings
4. Return a concise summary to the main conversation
```

### Exercise: Create a Forked Skill

Create a skill that uses forked context for:
- Code archaeology (tracing the history of a function)
- Security audit (comprehensive vulnerability scan)
- API exploration (discovering endpoints and capabilities)

**Validation Questions**:
- Does the fork return useful summaries?
- Is isolation actually beneficial here?
- What's lost by forking (conversation context)?

## Pattern 3: Skill Trees

Design hierarchical skill relationships for complex domains.

### Relationship Types

| Type | Meaning | Use When |
|------|---------|----------|
| `requires` | Must know A before B | Hard dependency |
| `extends` | B builds on A | Enhancement |
| `complements` | A + B work well together | Synergy |
| `conflicts_with` | Can't use both | Mutual exclusion |

### Implementation

Document in master skill:

```markdown
## Learning Progression

┌─ foundation-skill (required first)
│
├─→ intermediate-skill (extends foundation)
│       │
│       ├─→ advanced-a (specialization)
│       └─→ advanced-b (specialization)
│
└─→ complementary-skill (works with any level)
```

### Exercise: Design a Skill Tree

Choose a domain you know well (testing, deployment, data analysis).

1. List 5-7 skills that would be useful
2. Map their relationships (requires, extends, complements)
3. Create a visual progression diagram
4. Implement at least 3 skills from the tree

**Validation Questions**:
- Are prerequisites actually necessary?
- Could someone skip ahead safely?
- Does the tree reflect how people actually learn?

## Pattern 4: Graceful Degradation

Skills should handle failures elegantly.

### Common Failure Modes

| Failure | Handling Strategy |
|---------|-------------------|
| Missing tool | Explain what's needed, suggest alternatives |
| No results | Acknowledge, suggest refinements |
| Ambiguous input | Ask for clarification |
| Partial success | Report what worked, what didn't |

### Implementation

```yaml
---
name: resilient-analyzer
description: Analyzes code with graceful handling of edge cases.
allowed-tools: Read, Glob, Grep
---

# Resilient Analyzer

## Instructions

1. Attempt to locate relevant files
   - If no files found: Report "No matching files found. Check the path or pattern."
   - If too many files (>50): Ask user to narrow scope

2. Analyze found files
   - If analysis fails: Report partial results with error context
   - If patterns unclear: Ask for clarification

3. Present findings
   - Always include confidence level
   - Note any limitations or caveats
```

### Exercise: Add Resilience

Take an existing skill and add explicit failure handling:

1. List 3 ways the skill could fail
2. Add instructions for handling each failure
3. Test the failure paths

**Validation Questions**:
- Does failure handling help or confuse users?
- Are error messages actionable?
- Is there a graceful "I can't help with this" path?

## Pattern 5: Skill Composition

Skills can invoke other skills.

### Implementation

```yaml
---
name: full-review
description: Comprehensive code review combining multiple analyses.
allowed-tools: Read, Skill
---

# Full Review

Orchestrates multiple review skills for comprehensive analysis.

## Instructions

1. Invoke `code-quality` skill for style and standards
2. Invoke `security-scan` skill for vulnerabilities
3. Invoke `performance-check` skill for bottlenecks
4. Synthesize findings into unified report
```

### Exercise: Compose Skills

Create a "meta-skill" that orchestrates 2-3 simpler skills:

1. Identify skills that work well together
2. Create a composition skill
3. Handle cases where sub-skills fail

**Validation Questions**:
- Is composition adding value over sequential invocation?
- How do you handle conflicting recommendations?
- What's the right level of summary vs. detail?

## Pattern 6: Skill-Specific Hooks

Add validation or side effects to skill execution.

### Implementation

```yaml
---
name: safe-deployer
description: Deploy code with safety checks.
allowed-tools: Bash(git:*), Bash(npm:*)
hooks:
  PreToolUse:
    - matcher: Bash
      hooks:
        - type: command
          command: ./scripts/validate-deploy.sh
---
```

### Exercise: Add a Pre-Execution Hook

Create a skill with a hook that:
- Validates preconditions before execution
- Logs skill invocations for audit
- Checks for dangerous operations

## Checkpoint: Expert Completion

You've completed the expert level when you can:

- [ ] Apply progressive disclosure to organize complex domains
- [ ] Use forked context appropriately
- [ ] Design skill trees with clear relationships
- [ ] Handle failure modes gracefully
- [ ] Compose skills for complex workflows
- [ ] Add hooks for validation and side effects

## Next Steps

Ready to master skill architecture and teaching?

```
Read: plugins/skills/skills/skill-mastery/subskills/master-techniques.md
```
