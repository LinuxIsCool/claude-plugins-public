---
name: cook
description: Meta-orchestration engine for recursive self-improvement. Sub-skills (7): observe, orient, decide, act, learn, improve, infinite. Invoke for autonomous goal pursuit, emergence tracking, agent orchestration, self-modification, temporal planning.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, WebFetch, WebSearch, Skill
---

# Cook: Meta-Orchestration Engine

## Philosophy

Cook embodies the OODA loop (Observe-Orient-Decide-Act) enhanced with Learning and Self-Improvement. It orchestrates the 44-agent ecosystem toward goals while continuously improving its own capabilities.

## The Cook Loop

```
OBSERVE → ORIENT → DECIDE → ACT → LEARN → (loop)
                                    ↓
                              SELF-IMPROVE
```

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **observe** | Scanning environment for state and opportunities | `subskills/observe.md` |
| **orient** | Assembling context and recognizing patterns | `subskills/orient.md` |
| **decide** | Selecting high-leverage actions | `subskills/decide.md` |
| **act** | Executing through agent orchestration | `subskills/act.md` |
| **learn** | Recording outcomes and extracting insights | `subskills/learn.md` |
| **improve** | Self-modification and capability enhancement | `subskills/improve.md` |
| **infinite** | Infinite loop pattern with wave-based execution | `subskills/infinite.md` |

## Quick Reference

### Entry Points

```
/cook              # Start infinite loop (default)
/cook status       # Quick status check (no loop)
/cook steer "..."  # Add steering input
/cook stop         # Signal graceful shutdown
/cook observe      # Single observe phase
/cook plan         # Single cycle, no execute
```

### Key Data Structures

| Structure | Location | Purpose |
|-----------|----------|---------|
| Goal Hierarchy | `.claude/cook/goals/` | Multi-scale planning |
| Emergence Feed | `.claude/cook/emergence/` | External discovery tracking |
| Role Models | `.claude/cook/rolemodels/` | People, projects, papers to learn from |
| Learning Log | `.claude/cook/learning/` | Outcome recording and insights |

### Agent Orchestration Patterns

1. **Direct** - Cook acts via tools
2. **Single** - Delegate to one agent
3. **Ensemble** - Parallel agents, synthesize outputs
4. **Pipeline** - Sequential agent chain
5. **Swarm** - Emergent coordination

## Architecture

Read `ARCHITECTURE.md` in plugin root for complete design.

## How to Use

### First Run
1. Cook will assess current state
2. Review goal hierarchy (or create if missing)
3. Scan environment (git, backlog, emergence)
4. Propose high-leverage actions
5. Execute with your approval

### Daily Use
1. `/cook` at session start
2. Review proposed actions
3. Approve or redirect
4. Cook executes and learns
5. Repeat as needed

### For Emergence Tracking
1. `/cook track add {source} {target}`
2. `/cook track scan` periodically
3. `/cook track process` for new discoveries

### For Self-Improvement
1. `/cook improve` to run improvement cycle
2. Cook identifies weaknesses
3. Proposes modifications
4. Implements with approval

### For Autonomous Operation
1. `/cook` starts the infinite loop (default mode)
2. Type ideas anytime - they're added to steering inbox
3. `/cook status` to check progress (doesn't enter loop)
4. `/cook stop` for graceful shutdown
