# Progressive Disclosure Pattern

Organize large skills efficiently using the master skill + subskills pattern.

## Why Progressive Disclosure?

Claude Code has a **~15,000 character budget** for skill descriptions. When exceeded:
- Skills get truncated
- Claude can't see all available skills
- Discovery fails for truncated skills

**Solution**: One master skill that indexes subskills loaded on-demand.

## The Pattern

```
plugin-name/skills/
└── skill-master/
    ├── SKILL.md              # Master skill (discoverable)
    └── subskills/            # Sub-skills (loaded on-demand)
        ├── capability-a.md
        ├── capability-b.md
        └── capability-c.md
```

## How It Works

### Level 1: Metadata (Always Loaded)
Only `name` and `description` consume the discovery budget.

### Level 2: Instructions (On Trigger)
Full SKILL.md loads when Claude decides to use the skill.

### Level 3: Resources (On Demand)
Subskills and references load only when specifically needed.

## Master SKILL.md Template

```yaml
---
name: plugin-name
description: Master skill for [purpose]. Sub-skills (N): name1, name2, name3. Invoke for [use cases].
allowed-tools: Read, Skill, Task, Glob, Grep
---

# Plugin Name - Master Skill

[Brief overview]

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **name1** | [trigger condition] | `subskills/name1.md` |
| **name2** | [trigger condition] | `subskills/name2.md` |
| **name3** | [trigger condition] | `subskills/name3.md` |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill.

### Deep Dive
Load full sub-skill content:
```
Read: plugins/plugin-name/skills/skill-master/subskills/{name}.md
```

## [Additional overview sections...]
```

## Key Principles

### 1. Description Lists Sub-Skills
Include sub-skill names in the description for discoverability:
```yaml
description: Master skill for memory systems (8 sub-skills). Covers: agentmemory, hipporag, mem0, embeddings. Invoke for...
```

### 2. Index Table for Navigation
Provide quick reference to help Claude (and users) find the right sub-skill.

### 3. One-Level Deep References
**CRITICAL**: Claude may not fully read deeply nested files.

**Bad:**
```
SKILL.md → advanced.md → details.md → actual_info.md
```

**Good:**
```
SKILL.md → subskills/advanced.md
SKILL.md → subskills/details.md
```

### 4. Keep Master Skill Focused
The master SKILL.md should provide:
- Overview and purpose
- Sub-skill index with trigger conditions
- Quick reference tables
- Navigation instructions

Move detailed content to subskills.

## Examples from This Ecosystem

### knowledge-graphs Plugin (17 sub-skills)
```yaml
description: Master skill for knowledge graph technologies (17 sub-skills). Covers: Graphiti, LightRAG, Cognee, KAG, Dgraph, FalkorDB, SPARQL...
```

### memory Plugin (8 sub-skills)
```yaml
description: Master skill covering 8 specialized memory sub-skills. Covers: agentmemory, hipporag, mem0, claude-mem, embeddings...
```

### awareness Plugin (10 sub-skills)
```yaml
description: Master skill for Claude Code self-improvement and learning. Sub-skills (10): docs-reader, guide-utilizer, techniques...
```

## When to Use This Pattern

Use master + subskills when:
- You have **5+ distinct capabilities**
- Total content exceeds **500 lines**
- Skills risk exceeding the **15,000 char budget**
- You need **clear organization** for related capabilities

Don't use when:
- Single, focused capability
- Under 300 lines of content
- No natural sub-divisions

## Alternative Patterns

### Cookbook Organization
For how-to content rather than distinct capabilities:
```
skill/
├── SKILL.md
└── cookbook/
    ├── quickstart.md
    ├── advanced.md
    └── patterns.md
```

### Reference Organization
For domain-specific documentation:
```
skill/
├── SKILL.md
└── references/
    ├── api-docs.md
    ├── examples.md
    └── troubleshooting.md
```

## Verifying Your Budget

Check context budget usage:
```
/context
```

If you see "excluded skills" warning, you've exceeded the budget. Apply progressive disclosure.

Increase budget (if needed):
```bash
export SLASH_COMMAND_TOOL_CHAR_BUDGET=20000
```
