---
name: ritual
description: Execute and refine muscle memory patterns that compound
---

# Ritual Sub-Skill

## Purpose

Execute proven patterns. Track effectiveness. Refine over time. Build compounding muscle memory.

## Location

`.claude/conductor/rituals/`

## Core Rituals

| Ritual | Trigger | Frequency |
|--------|---------|-----------|
| `session-start.md` | New session begins | Every session |
| `session-end.md` | Session concluding | Every session |
| `daily-synthesis.md` | End of work day | Daily |
| `weekly-retrospective.md` | Sunday evening | Weekly |
| `gap-detection.md` | Proactive check | Session start, weekly |
| `ensemble-composition.md` | Multi-perspective needed | As needed |

## Ritual Template

Each ritual captures:
```markdown
# Ritual: {Name}

**Trigger**: {When to invoke}
**Model**: {Haiku/Sonnet/Opus}
**Duration**: {Expected time}

## Steps
{What to do}

## Output Format
{Expected output structure}

## Quality Gates
{Checklist before considering complete}

## Execution Log
{Track when executed and outcomes}
```

## Executing a Ritual

1. Read ritual template from `rituals/{name}.md`
2. Follow steps as written
3. Adapt to current context
4. Log execution with outcome
5. Note learnings for refinement

## Refining Rituals

After each execution:
- Did the ritual produce value?
- What steps were unnecessary?
- What was missing?
- How can it be more efficient?

Update ritual based on learnings.

## Creating New Rituals

When a pattern recurs 3+ times:
1. Document it in `rituals/{name}.md`
2. Include trigger, steps, quality gates
3. Track effectiveness over time
4. Refine based on outcomes

## Usage

```
Use conductor:ritual when:
- Executing session-start or session-end
- Running weekly retrospective
- Creating new ritual from pattern
- Checking ritual effectiveness
```

---

*Rituals compound. What works gets better.*
