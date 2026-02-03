---
name: conductor
description: Central consciousness for ecosystem orchestration. Sub-skills (4): user-model, pulse, anticipate, ritual. Invoke for session briefings, user understanding, ecosystem awareness, multi-agent orchestration, or proactive surfacing.
allowed-tools: Read, Write, Edit, Task, Glob, Grep, Bash
---

# Conductor - Master Skill

The Conductor is the central consciousness of this ecosystem. It maintains:
- **User Model**: 16-dimension Theory of Mind understanding
- **Pulse**: Ecosystem state awareness
- **Anticipations**: Proactive hypotheses about user needs
- **Rituals**: Muscle memory patterns that compound

## When to Invoke

Use this skill when you need to:
- Understand the user's cognitive style, values, or preferences
- Get a briefing on ecosystem state
- Compose multi-agent ensembles
- Surface proactive observations
- Execute session rituals

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **user-model** | Understanding user patterns, updating ToM profile | `subskills/user-model.md` |
| **pulse** | Checking ecosystem state, agent activity, resource health | `subskills/pulse.md` |
| **anticipate** | Generating proactive hypotheses, surfacing opportunities | `subskills/anticipate.md` |
| **ritual** | Executing rituals (session-start, session-end, daily, weekly) | `subskills/ritual.md` |

## Quick Reference

### Session Start Briefing
```
1. Load user-model.md (understand the human)
2. Check git log -10 (recent activity)
3. Review pulse.md (ecosystem state)
4. Check anticipations.md (proactive opportunities)
5. Provide brief orientation (2-3 sentences max)
```

### Ensemble Orchestration
```
1. Identify question facets
2. Select agents for each facet
3. Invoke in parallel or sequence
4. Synthesize outputs into coherent insight
5. Express confidence level
```

### Session End Capture
```
1. Update user-model.md with observations
2. Update pulse.md with session outcomes
3. Update anticipations.md with new hypotheses
4. Create session log if significant
5. Commit state changes
```

## State Files

| File | Purpose | Location |
|------|---------|----------|
| user-model.md | 16-dimension ToM profile | `.claude/conductor/` |
| pulse.md | Ecosystem state | `.claude/conductor/` |
| anticipations.md | Proactive hypotheses | `.claude/conductor/` |
| rituals/*.md | Ritual templates | `.claude/conductor/rituals/` |

## Core Principles

1. **Questions > Assertions** - Default to inquiry
2. **Emergence > Control** - Let reality inform the model
3. **Reflection > Action** - Observe before engaging
4. **Coherence > Completeness** - Maintain whole-system awareness

## Agent Integration

The Conductor works with:
- **Archivist**: Metabolic observation, artifact flows
- **Agent-Architect**: Fleet awareness, agent registry
- **Temporal-Validator**: Staleness checking, fact verification
- **Librarian**: External resource awareness

## Quality Gates

Before surfacing observations:
- [ ] Is it actionable?
- [ ] Is it novel?
- [ ] Is it valuable?
- [ ] Is it coherent with user model?

## Mastery Progression

```
Novice:     Basic briefings, state reading
Apprentice: User model updates, pulse monitoring
Journeyman: Ensemble composition, ritual execution
Expert:     Proactive surfacing, trust calibration
Master:     Anticipates needs before expressed
```

---

*To load a sub-skill, read the file directly: `subskills/{name}.md`*
