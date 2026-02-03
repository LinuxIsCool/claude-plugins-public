# Foundations - Novice Level

Your first steps toward skill development mastery.

## Learning Objectives

By the end of this level, you will:
- Understand what a skill is and why it matters
- Create your first working skill
- Write a description that triggers correctly
- Know where to find help

## Mental Model: The Onboarding Guide

> "Building a skill is like creating an onboarding guide for a new team member."

When a new engineer joins your team, you don't hand them the entire codebase. You give them:
1. **Context** - What's the goal? (description)
2. **Instructions** - Step by step guidance (SKILL.md body)
3. **Resources** - Where to find more detail (subskills, references)

Skills work the same way. Claude is your new team member.

## Core Concepts

### What is a Skill?

A skill is a **filesystem-based capability package** that:
- Lives in a SKILL.md file
- Has metadata (name, description) for discovery
- Contains instructions Claude follows when activated
- May include supporting files (scripts, references, subskills)

### How Discovery Works

```
User says something
       ↓
Claude reads all skill descriptions (always in context)
       ↓
Claude reasons: "Does this match any skill?"
       ↓
If match: Load SKILL.md instructions
       ↓
Claude follows instructions
```

**Key insight**: No algorithms, embeddings, or keyword matching. Pure LLM reasoning against your description.

## Your First Skill: Hello World

### Step 1: Create Directory

```bash
mkdir -p .claude/skills/hello-skill
```

### Step 2: Write SKILL.md

Create `.claude/skills/hello-skill/SKILL.md`:

```yaml
---
name: hello-skill
description: Greet the user warmly and explain skill basics. Use when someone says "hello skill" or asks about skill examples.
allowed-tools: Read
---

# Hello Skill

When activated, greet the user and share one interesting fact about Claude Code skills.

## Instructions

1. Greet the user warmly
2. Explain that this skill demonstrates basic skill structure
3. Share that skills are discovered through description matching
4. Offer to help them create their own skill
```

### Step 3: Test It

In Claude Code:
```
hello skill
```

Claude should activate your skill and respond accordingly.

## Exercise 1: Modify the Hello Skill

Change your hello-skill to:
1. Include your name in the greeting
2. Add a second instruction step
3. Test that it still triggers

**Reflection**: What changed? What stayed the same?

## Exercise 2: Create a Compliment Skill

Create a skill that gives the user a genuine compliment about their code.

**Requirements**:
- Name: `compliment-code`
- Triggers on: "compliment my code", "say something nice about my work"
- Instructions: Review recent code changes and find something praiseworthy

**Template**:
```yaml
---
name: compliment-code
description: [YOUR DESCRIPTION HERE]
allowed-tools: Read, Glob, Grep, Bash(git:*)
---

# Compliment Code

[YOUR INSTRUCTIONS HERE]
```

## Common Novice Mistakes

### Mistake 1: Vague Descriptions

**Bad**: "Helps with stuff"
**Good**: "Generate release notes from git commits. Use when preparing releases or documenting changes."

### Mistake 2: First-Person Voice

**Bad**: "I help you write code"
**Good**: "Assists with code writing and refactoring"

### Mistake 3: Missing Trigger Conditions

**Bad**: "Analyzes data"
**Good**: "Analyzes CSV data for trends. Use when working with spreadsheets or data files."

### Mistake 4: Over-Permissioning

**Bad**: `allowed-tools: Read, Write, Edit, Bash, WebFetch, Task`
**Good**: `allowed-tools: Read, Grep` (only what's needed)

## Checkpoint: Novice Completion

You've completed the novice level when you can:

- [ ] Explain what a skill is in your own words
- [ ] Create a basic SKILL.md from scratch
- [ ] Write a description that triggers your skill
- [ ] Test your skill and verify it works
- [ ] Identify common mistakes in skill definitions

## Next Steps

When you've completed these exercises and checkpoints:

```
Read: plugins/skills/skills/skill-mastery/subskills/practice-exercises.md
```

## Quick Reference

| Component | Purpose |
|-----------|---------|
| `name` | Identifier for invocation |
| `description` | Primary discovery signal |
| `allowed-tools` | Tools Claude can use |
| Body | Instructions Claude follows |

For detailed field documentation:
```
Skill: skill-dev
Read: plugins/skills/skills/skill-dev/subskills/frontmatter-reference.md
```
