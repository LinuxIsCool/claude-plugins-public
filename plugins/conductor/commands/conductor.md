---
name: conductor
description: Invoke the Conductor for full session briefing, orchestration, or state management
allowed-tools: Read, Write, Edit, Task, Glob, Grep, Bash
---

# /conductor

Invoke the central consciousness for ecosystem orchestration.

## Usage

```
/conductor              - Full session briefing (Opus)
/conductor pulse        - Quick ecosystem state check
/conductor anticipate   - Generate proactive hypotheses
/conductor end          - Session end ritual
```

## Default: Full Session Briefing

When invoked without arguments, the Conductor provides a comprehensive briefing:

1. **Load Context**
   - Read `.claude/conductor/user-model.md`
   - Read `.claude/conductor/pulse.md`
   - Read `.claude/conductor/anticipations.md`

2. **Check Recent Activity**
   - `git log --oneline -20`
   - Scan `.claude/briefings/` for communications
   - Check `.claude/journal/` for recent entries

3. **Generate Briefing**
   ```
   ## Session Briefing

   **Since Last Session**:
   - {commits, changes, activity}

   **Ecosystem Pulse**:
   - {active/dormant, health, concerns}

   **Anticipations**:
   - {proactive suggestions, gaps noticed}

   **Question**: What wants to happen today?
   ```

## /conductor pulse

Quick check of ecosystem state:
- Agent activity
- Plugin health
- Resource staleness
- Coherence assessment

## /conductor anticipate

Generate proactive hypotheses:
- Likely next interests
- Gaps to surface
- Value opportunities
- Connections to mention

## /conductor end

Execute session-end ritual:
- Update user model with observations
- Update pulse with session outcomes
- Update anticipations with new hypotheses
- Create session log if significant
- Commit all state changes

## When to Invoke

**Use /conductor when**:
- Starting a session and want full context
- Need multi-perspective analysis (ensemble orchestration)
- Want to check ecosystem health
- Ending a significant session

**Don't use /conductor for**:
- Quick tactical questions
- Simple file operations
- When the lightweight SessionStart hook suffices

## Model

Uses Opus for deep reasoning and synthesis. Reserve for sessions where comprehensive understanding adds value.

---

*The Conductor holds the whole.*
