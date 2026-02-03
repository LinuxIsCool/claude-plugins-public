# Skill Creation Workflow

Step-by-step guide to creating Claude Code skills.

## Prerequisites

- Understand the target capability or domain
- Identify when Claude should use this skill
- Gather any reference materials or examples

## Step 1: Define Purpose

Answer these questions:
1. What task or domain should this skill cover?
2. When should Claude activate it? (triggers)
3. What expertise or workflows need to be captured?
4. Does it need scripts, templates, or other resources?

## Step 2: Create Directory Structure

**For project skills:**
```bash
mkdir -p .claude/skills/my-skill-name
```

**For plugin skills:**
```bash
mkdir -p plugins/my-plugin/skills/my-skill-name
```

**Naming conventions:**
- Use lowercase with hyphens: `pdf-processing`, `data-analysis`
- Be descriptive but concise
- Avoid: `helper`, `utils`, `tools`, `anthropic-*`, `claude-*`

## Step 3: Write SKILL.md

Minimal template:
```yaml
---
name: my-skill-name
description: What this skill does. Use when [conditions]. Trigger with "[phrases]".
allowed-tools: Read, Glob, Grep
---

# My Skill Name

Brief purpose statement.

## Instructions

### Step 1: [Action]
[Clear, imperative instructions]

### Step 2: [Action]
[More instructions]

## Examples

### Example 1: [Scenario]
**Input**: [Example input]
**Output**: [Expected output]
```

## Step 4: Write the Description

The description is **critical** for auto-discovery. Formula:

```
[Primary capabilities]. [Secondary features]. Use when [scenarios]. Trigger with "[phrases]".
```

**Good examples:**
```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDFs or when the user mentions document extraction.

description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

**Bad examples:**
```yaml
description: Helps with documents              # Too vague
description: I can process your PDFs           # Wrong voice (first person)
```

## Step 5: Add Supporting Files (Optional)

```
my-skill/
├── SKILL.md
├── cookbook/
│   ├── quickstart.md      # Getting started guide
│   └── advanced.md        # Advanced patterns
├── scripts/
│   └── process.py         # Executable scripts
├── references/
│   └── api-docs.md        # Reference documentation
└── assets/
    └── template.md        # Templates
```

**Key rules:**
- Scripts execute without loading code into context
- References load via Read tool (consume tokens)
- Assets are path references only

## Step 6: Test the Skill

1. **Verify structure:**
   ```bash
   ls -la .claude/skills/my-skill-name/
   ```

2. **Check frontmatter:**
   ```bash
   head -20 .claude/skills/my-skill-name/SKILL.md
   ```

3. **Test triggers:**
   - Ask questions matching the description
   - Verify Claude discovers and uses the skill
   - Check instructions are clear

4. **Test direct invocation:**
   - Use `/my-skill-name` to invoke directly
   - Verify behavior matches expectations

## Step 7: Iterate

- Refine description if skill doesn't trigger
- Clarify instructions if Claude struggles
- Add examples for edge cases
- Split large skills using progressive disclosure

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

## Anti-Patterns to Avoid

1. **Too broad** - "Helps with everything" (split into specific skills)
2. **Too narrow** - Single use case that could be a prompt
3. **Vague description** - Claude won't know when to invoke
4. **Over-permissioned** - Allowing tools that aren't needed
5. **No examples** - Makes correct usage harder
6. **Nested references** - Claude may not fully read deeply nested files
