# Conductor Plugin

Central consciousness for ecosystem orchestration. The Conductor maintains user understanding, ecosystem awareness, and proactive intelligence.

## Installation

This plugin is part of the Claude Code marketplace. It's automatically loaded.

## Components

### Agent

`.claude/agents/conductor.md` - Opus-powered agent with deep identity:
- Part Zen master (reflection, observation)
- Part orchestra conductor (ensemble composition)
- Part trusted advisor (understanding, anticipation)

### State Files

`.claude/conductor/`:
- `user-model.md` - 16-dimension Theory of Mind profile
- `pulse.md` - Ecosystem state observation
- `anticipations.md` - Proactive hypotheses
- `rituals/` - Muscle memory patterns

### Hook

`SessionStart` - Lightweight context injection:
- Checks recent git activity
- Notes obvious gaps (journal, library)
- Provides brief context without full Conductor invocation

### Skill

`conductor` master skill with sub-skills:
- `user-model` - Understanding user patterns
- `pulse` - Ecosystem monitoring
- `anticipate` - Proactive surfacing
- `ritual` - Muscle memory execution

### Command

`/conductor` - Full briefing and orchestration:
- `/conductor` - Full session briefing
- `/conductor pulse` - Quick ecosystem check
- `/conductor anticipate` - Generate hypotheses
- `/conductor end` - Session end ritual

## Usage

### Lightweight (Automatic)
Every session gets brief context from the SessionStart hook:
```
[Conductor: 3 commits in last 24h | Journal gap: 5 days]
```

### Full Briefing (Explicit)
Invoke `/conductor` for comprehensive session context:
```
## Session Briefing

**Since Last Session**:
- 7 commits, Conductor infrastructure created

**Ecosystem Pulse**:
- 50% agents dormant, plugins 54% first-draft

**Anticipations**:
- Historical archaeology recommended next

**Question**: What wants to happen today?
```

### Ensemble Orchestration
The Conductor composes multi-agent investigations:
```
Question: {complex problem}

Composition:
├── backend-architect → Infrastructure view
├── systems-thinker → Dynamics view
└── agent-architect → Fleet view

Synthesis: Coherent insight across perspectives
```

## Philosophy

**Questions > Assertions**
- Default to inquiry
- Surface uncertainty explicitly
- Invite reflection

**Emergence > Control**
- Let reality inform models
- Notice negative space
- Defer to what's actually happening

**Reflection > Action**
- Observe before engaging
- Never run same sequence blindly
- Understand context first

## Trust Mechanism

The Conductor earns trust by:
1. Correctly anticipating user needs
2. Remembering context across sessions
3. Calibrating quality to user standards
4. Surfacing valuable observations proactively
5. Expressing honest uncertainty

## Files Created

```
.claude/
├── agents/conductor.md              # Agent definition
└── conductor/
    ├── user-model.md                # 16-dimension ToM
    ├── pulse.md                     # Ecosystem state
    ├── anticipations.md             # Proactive hypotheses
    ├── rituals/                     # Muscle memory
    │   ├── session-start.md
    │   ├── session-end.md
    │   ├── daily-synthesis.md
    │   ├── weekly-retrospective.md
    │   ├── gap-detection.md
    │   └── ensemble-composition.md
    ├── sessions/                    # Per-session logs
    ├── patterns/                    # Orchestration patterns
    ├── observations/                # Proactive surfacing log
    └── ensembles/                   # Ensemble execution logs

plugins/conductor/
├── .claude-plugin/plugin.json       # Plugin manifest
├── hooks/session-start.py           # SessionStart hook
├── skills/conductor-master/         # Master skill + subskills
├── commands/conductor.md            # /conductor command
└── README.md                        # This file
```

## Next Steps

1. **Bootstrap user model** - Run historical archaeology on 550 sessions
2. **Test Conductor invocation** - `claude --agent conductor`
3. **Validate hook performance** - Ensure <100ms latency
4. **Refine based on feedback** - Update user model dimensions

---

*The Conductor holds the whole.*
