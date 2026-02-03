# Infinite Sub-Skill: Main-Agent Continuous Loop

## Overview

The `/cook` command runs an **infinite loop in the main agent**, not as a background task. The main agent continuously executes OODA+L cycles, spawning fresh sub-agents for work, until context exhaustion or a stop signal.

## Core Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN AGENT (You) - Runs the infinite loop                      │
│                                                                  │
│  WHILE context_capacity > threshold:                            │
│      1. OBSERVE - Check steering + environment                  │
│      2. ORIENT  - Context assembly                              │
│      3. DECIDE  - Select action                                 │
│      4. ACT     - Execute (spawn sub-agents for complex work)   │
│      5. LEARN   - Record outcome                                │
│      6. CONTINUE - Check capacity, loop                         │
│  END                                                             │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ spawns fresh agents for work
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUB-AGENTS (Task tool)                                          │
│  - Explore: codebase research                                   │
│  - feature-dev:code-architect: code changes                     │
│  - feature-dev:code-reviewer: quality review                    │
│  - backlog:taskmaster: task management                          │
│  - knowledge-graphs:weaver: KG work                             │
└─────────────────────────────────────────────────────────────────┘
```

## Key Insight from Reference Implementation

The reference `/infinite` command uses **wave-based parallel execution**:
- Each "wave" spawns multiple sub-agents in parallel
- Fresh agent instances avoid context accumulation
- Main orchestrator maintains lightweight state
- Graceful conclusion when context approaches limits

## Context Capacity Management

The loop continues until context is nearly exhausted:

**Implicit Monitoring:**
- If responses start feeling constrained
- If tool calls become slow or limited
- If you sense approaching limits

**Graceful Conclusion:**
1. Complete current action
2. Write comprehensive state
3. Write summary to learning log
4. Output completion message with iteration count

## Steering Inbox

Location: `.claude/cook/steering/inbox.yaml`

The user can add ideas without interrupting the loop:
- `/cook steer "idea"` - Add steering item
- `/cook stop` - Add stop signal

Each iteration's OBSERVE phase reads the inbox and processes items.

**Urgency Levels:**
| Level | Behavior |
|-------|----------|
| `immediate` | Override current plan, handle now |
| `high` | Strong factor in DECIDE |
| `medium` | Normal consideration |
| `low` | Queue for later |

## Agent Delegation

**Spawn sub-agents for:**
- Complex exploration (Explore agent)
- Code modifications (feature-dev agents)
- Quality review (code-reviewer)
- Task management (taskmaster)

**Act directly for:**
- File reads/searches
- State updates
- Simple edits
- Backlog queries

## Parallel Execution

When multiple independent actions exist:
```
[ACT] Launching 3 parallel sub-agents:
  - Explore: analyze auth patterns
  - Librarian: catalog resources
  - Taskmaster: create follow-up tasks
```

Launch all simultaneously, wait for completion, then LEARN.

## Constitution Constraints

From `.claude/cook/autonomy/constitution.yaml`:

| Level | Actions |
|-------|---------|
| Always Allowed | Read, search, observe, update state |
| High Confidence | Edit code, create files |
| Requires Approval | Delete, push, external mutations |

## Commands

```
/cook              # Start infinite loop (default)
/cook status       # Quick status check (no loop)
/cook steer "..."  # Add to steering inbox
/cook stop         # Add stop signal
/cook observe      # Single observe phase
/cook plan         # Single OODA cycle, no execute
```

## Output Format

During loop:
```
[OBSERVE] Iteration N - Checking steering inbox...
[ORIENT] Goals: X pending, Y high-priority
[DECIDE] Selected: "action" (score: Z)
[ACT] Spawning agent...
[LEARN] Success - recorded insight
[CONTINUE] Context OK - next iteration
```

On conclusion:
```
[COOK] Context capacity reached. State saved. Completed N iterations.
```

## Best Practices

1. **Don't over-plan** - Act, learn, iterate
2. **Spawn agents for heavy work** - Keep main loop lightweight
3. **Check steering each iteration** - Stay responsive to user input
4. **Record insights** - Learning log compounds over time
5. **Graceful stops** - Always save state before concluding
