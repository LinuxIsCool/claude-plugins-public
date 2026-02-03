---
description: Generate multi-persona reflections on a document
---

# Multi-Persona Reflection

Target document: $ARGUMENTS

## Your Task

Orchestrate reflections from multiple perspectives on the target document.

## Process

1. **Read the target document** at the path provided above
2. **Discover personas** by listing files in `.claude/agents/`
3. **For each persona**:
   - Read their agent definition to understand their perspective, voice, and focus
   - Embody that perspective authentically
   - Write a reflection (300-500 words) to `.claude/perspectives/{persona-name}/reflections/{document-filename}.md`
4. **Summarize** what perspectives were generated

## Reflection Guidelines

- Each persona has a distinct voice - honor it
- Focus on what that perspective uniquely sees
- Be genuine analysis, not summary
- Identify what excites, concerns, or puzzles that persona
- Connect to their domain expertise

## Output Structure

For each reflection file:
```markdown
# {Persona Name} Reflection

**Document**: {original document path}
**Date**: {today}

---

{The reflection in the persona's authentic voice}
```

After all reflections are written, briefly note which perspectives contributed.
