---
name: skills
description: Master skill for Claude Code skill development (12 sub-skills). Covers: official-docs, skill-creation, skill-tree-protocol, description-writing, frontmatter-reference, progressive-disclosure, fork-terminal-pattern, hooks-observability, community-patterns, skill-validation, indydevdan-tutorial, ecosystem-discovery. Invoke for creating skills, understanding skill architecture, writing descriptions, or skill tree design.
allowed-tools: Read, Skill, Task, Glob, Grep, Write, Edit
---

# Skills Plugin - Master Skill

The definitive resource for Claude Code skill development. This plugin embodies mastery of skill development by teaching the patterns it demonstrates.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **official-docs** | Need authoritative skill documentation, frontmatter fields, best practices | `subskills/official-docs.md` |
| **skill-creation** | Creating a new skill from scratch, step-by-step workflow | `subskills/skill-creation.md` |
| **skill-tree-protocol** | Designing skill hierarchies, prerequisites, proficiency levels | `subskills/skill-tree-protocol.md` |
| **description-writing** | Writing effective descriptions for auto-discovery | `subskills/description-writing.md` |
| **frontmatter-reference** | Complete reference for all YAML frontmatter fields | `subskills/frontmatter-reference.md` |
| **progressive-disclosure** | Organizing large skills with master+subskills pattern | `subskills/progressive-disclosure.md` |
| **fork-terminal-pattern** | Forking terminal sessions with agentic tools (disler pattern) | `subskills/fork-terminal-pattern.md` |
| **hooks-observability** | Multi-agent observability with hooks (disler pattern) | `subskills/hooks-observability.md` |
| **community-patterns** | Patterns from BuildWithClaude and ecosystem skills | `subskills/community-patterns.md` |
| **skill-validation** | Testing and validating skills before deployment | `subskills/skill-validation.md` |
| **indydevdan-tutorial** | Key insights from IndyDevDan skill tutorials | `subskills/indydevdan-tutorial.md` |
| **ecosystem-discovery** | Finding and analyzing skills across GitHub and registries | `subskills/ecosystem-discovery.md` |

## Quick Reference: Common Tasks

| Task | Sub-Skill |
|------|-----------|
| "Create a new skill" | skill-creation |
| "Write a good description" | description-writing |
| "Organize a large skill" | progressive-disclosure |
| "What frontmatter fields?" | frontmatter-reference |
| "Design a skill tree" | skill-tree-protocol |
| "Test my skill" | skill-validation |
| "Find example skills" | community-patterns, ecosystem-discovery |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill for your task.

### Deep Dive
Load full sub-skill content on demand:
```
Read: plugins/skills/skills/skills-master/subskills/{name}.md
```

### Learning Progression
```
official-docs → skill-creation → description-writing → progressive-disclosure
                     ↓
              skill-tree-protocol → skill-validation
                     ↓
        fork-terminal-pattern / hooks-observability (advanced)
```

## Core Concepts

### What is a Skill?

A skill is a **filesystem-based capability package** containing instructions, executable code, and resources that Claude discovers and uses automatically. Skills are prompt-based context modifiers.

**Mental Model**: "Building a skill is like creating an onboarding guide for a new team member."

### Progressive Disclosure (3 Levels)

1. **Metadata** (always loaded): `name` and `description` in YAML frontmatter
2. **Instructions** (loaded when triggered): Main body of SKILL.md
3. **Resources** (loaded as needed): Additional files, scripts, templates

### Skill Architecture

Skills live in a **meta-tool called `Skill`** within Claude's tools array:

```javascript
tools: [
  { name: "Read", ... },
  { name: "Skill",  // Meta-tool
    inputSchema: { command: string },
    description: "<available_skills>..." // All skill descriptions
  }
]
```

### Discovery Mechanism

- Claude's system prompt includes metadata (name + description) for all skills
- Claude matches user intent to skill descriptions via LLM reasoning
- No algorithmic routing, embeddings, or keyword matching - pure reasoning

## Directory Structure

```
skill-name/
├── SKILL.md              # REQUIRED - Instructions + YAML frontmatter
├── subskills/            # OPTIONAL - Sub-skills for progressive disclosure
├── scripts/              # OPTIONAL - Executable Python/Bash scripts
├── references/           # OPTIONAL - Docs loaded into context
├── assets/               # OPTIONAL - Templates referenced by path
└── cookbook/             # OPTIONAL - How-to guides
```

## Key Patterns

### Pattern 1: Master Skill + Subskills
For plugins with 5+ capabilities, use one master SKILL.md that indexes subskills.

### Pattern 2: Cookbook Organization
```
skill/
├── SKILL.md
└── cookbook/
    ├── quickstart.md
    ├── advanced.md
    └── patterns.md
```

### Pattern 3: Fork Context
Run skills in isolated subagent with `context: fork`:
```yaml
---
name: deep-research
context: fork
agent: Explore
---
```

## Related Plugins

- **awareness**: Plugin development, learning progression
- **knowledge-graphs**: Skill relationship graphs
- **memory**: Skill proficiency tracking
- **transcripts**: Video tutorial processing

## Research Sources

This plugin synthesizes patterns from:
- Official Claude Code documentation (code.claude.com)
- BuildWithClaude registry (buildwithclaude.com)
- disler/fork-repository-skill
- disler/claude-code-hooks-multi-agent-observability
- jeremylongshore/claude-code-plugins-plus-skills
- IndyDevDan YouTube tutorials
