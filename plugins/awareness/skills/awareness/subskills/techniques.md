---
name: techniques
description: Practice and master Claude Code techniques through incremental experimentation. Use when developing new capabilities, testing ideas, improving workflow, or compounding skill mastery. Start small, test incrementally, learn from outcomes.
allowed-tools: Read, Write, Edit, Bash, Task, Glob, Grep, TodoWrite
---

# Claude Code Techniques Mastery

A disciplined approach to developing expertise through practice.

## Core Method

```
Observe → Hypothesize → Test (small) → Learn → Compound
```

1. **Observe** - Notice a pattern or capability
2. **Hypothesize** - Form an idea about how it works
3. **Test (small)** - Try the smallest possible experiment
4. **Learn** - Record what happened and why
5. **Compound** - Build next experiment on this foundation

## Technique Categories

### Category 1: Tool Mastery

**Read Tool**
- Read files efficiently
- Handle large files with offset/limit
- Read images and PDFs
- Parallel reads for speed

**Edit Tool**
- Precise string replacement
- Context for uniqueness
- replace_all for bulk changes
- Preserve indentation exactly

**Bash Tool**
- Use specialized tools instead where possible
- Chain commands with && for sequential
- Parallel calls for independent commands
- Background execution for long-running

**Grep/Glob Tools**
- Pattern matching strategies
- Combining glob + grep
- Output modes (files, content, count)
- Multiline matching

### Category 2: Sub-agent Patterns

**Explore Agent**
- Quick codebase searches
- Thoroughness levels: quick, medium, very thorough
- When to use vs. direct Grep/Glob

**General-purpose Agent**
- Complex multi-step tasks
- Research + modification workflows
- Background execution

**Custom Agents**
- Creating specialized personalities
- Tool restrictions
- Model selection

### Category 3: Extended Thinking

**Triggering Thinking**
- Tab key toggle
- Verbal triggers: "think", "think hard", "think deeply"
- Combining with complexity

**When to Use**
- Architecture decisions
- Complex debugging
- Implementation planning
- Security analysis

**Depth Control**
- Light: "think about this"
- Medium: "think hard about this"
- Deep: "think very deeply about all implications"

### Category 4: Memory & Context

**CLAUDE.md Patterns**
- Project-level instructions
- Modular rules in .claude/rules/
- Quick additions with # prefix
- @imports for references

**Settings Management**
- Hierarchy: enterprise → project → user → local
- Permission rules (allow/deny)
- Hook configuration
- Environment variables

### Category 5: Hooks

**Event-Driven Automation**
- Identify hook points (11 events)
- Write hook scripts (bash/python)
- JSON input/output patterns
- Exit codes for control flow

**Common Patterns**
- Auto-formatting on Write/Edit
- Logging all tool usage
- Context injection on UserPromptSubmit
- Intelligent continuation on Stop

### Category 6: Skills & Commands

**Creating Skills**
- SKILL.md structure
- Description for auto-discovery
- allowed-tools constraints
- Multi-file skills

**Creating Commands**
- Markdown frontmatter
- Variable interpolation
- Arguments with $1, $2, $ARGUMENTS
- Structured output generation

## Practice Exercises

### Exercise 1: Tool Efficiency
```markdown
Goal: Find all TypeScript files containing "async function"
Approach 1: Glob *.ts, then Grep for pattern
Approach 2: Grep with --type ts flag
Compare: Which is more efficient?
```

### Exercise 2: Sub-agent Delegation
```markdown
Goal: Understand a complex function
Task 1: Use Explore agent with "quick" thoroughness
Task 2: Same query with "very thorough"
Compare: Quality vs. speed tradeoff
```

### Exercise 3: Extended Thinking
```markdown
Goal: Design a new feature
Test 1: Without thinking enabled
Test 2: With "think about this"
Test 3: With "think very deeply about implications"
Compare: Depth of analysis at each level
```

### Exercise 4: Hook Creation
```markdown
Goal: Log every Bash command executed
Step 1: Create hook script
Step 2: Configure in settings.json
Step 3: Test with sample commands
Step 4: Verify logging output
```

### Exercise 5: Memory Layering
```markdown
Goal: Set up project-specific conventions
Step 1: Create .claude/rules/typescript.md
Step 2: Add path-specific rules
Step 3: Test that rules are applied
Step 4: Override at user level
```

## Recording Technique Practice

```markdown
## Technique: [Name]
**Date**: YYYY-MM-DD
**Category**: [1-6]
**Experiment**: [What you tested]
**Result**: [What happened]
**Learning**: [Key insight]
**Mastery Level**: [0-1 scale]
**Next Experiment**: [What to try next]
```

## Mastery Progression

```
Novice (0.0-0.2)
→ Know the technique exists
→ Have tried it once

Apprentice (0.2-0.4)
→ Can use in simple cases
→ Understand basic behavior

Journeyman (0.4-0.6)
→ Use reliably in normal situations
→ Know common edge cases

Expert (0.6-0.8)
→ Use efficiently and creatively
→ Can teach others

Master (0.8-1.0)
→ Deep intuition about when and how
→ Can combine with other techniques fluidly
```

## Anti-Patterns

1. **Testing too big** - Start with smallest possible experiment
2. **Not recording** - Learnings fade without documentation
3. **Skipping fundamentals** - Advanced techniques need solid foundation
4. **Rushing** - Mastery requires patience and repetition
5. **Isolated practice** - Compound techniques together

## Integration with Other Skills

- **docs-reader** → Understand what techniques exist
- **guide-utilizer** → Get authoritative details
- **techniques** → Practice and develop mastery

Together, these form a complete learning cycle:
```
Learn (docs) → Clarify (guide) → Practice (techniques) → Apply → Learn more...
```
