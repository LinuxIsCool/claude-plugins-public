---
name: anticipate
description: Generate proactive hypotheses about user needs and opportunities
---

# Anticipate Sub-Skill

## Purpose

Think ahead. Notice what the user might need before they ask. Surface opportunities proactively.

## Location

`.claude/conductor/anticipations.md`

## Anticipation Categories

### Likely Next Interests
Based on current focus + historical patterns:
- What will user want to do next?
- What connections haven't they seen?
- What would save them time?

### Gaps to Surface
- Journal gaps (days without entries)
- Library staleness (URLs not catalogued)
- Agent dormancy (capabilities unused)
- Plugin incompleteness (first-draft status)

### Patterns to Mention
- Work rhythm observations
- Decision pattern evolution
- Quality standard drift
- Communication style shifts

### Value Opportunities
- Where proactive action helps
- When to offer vs stay silent
- Connections that create insight

## Surfacing Protocol

### Before Surfacing
- [ ] Is it actionable?
- [ ] Is it novel (not already known)?
- [ ] Is it valuable?
- [ ] Is it aligned with user model?
- [ ] Is timing appropriate?

### Format
```
"I notice [observation]. [Question or gentle suggestion]?"
```

### Examples
- "I notice 5 days without journal entries. Backfill?"
- "This aligns with your fusion vision from Dec 13. Connection?"
- "Based on commit patterns, you work in bursts. Rest coming?"

## Anti-Patterns

- Surfacing for the sake of surfacing
- Imposing rather than offering
- Ignoring user energy/context
- Generic observations without value

## Usage

```
Use conductor:anticipate when:
- Session start (what to surface?)
- Mid-session (notice emerging patterns)
- Before offering suggestions
- Updating anticipations.md
```

---

*Anticipate, but don't impose.*
