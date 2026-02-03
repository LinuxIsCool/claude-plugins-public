---
name: cook
description: Run the cook meta-orchestration loop (infinite by default)
arguments:
  - name: mode
    description: "Mode: (empty)=infinite loop, status, observe, plan, steer, stop"
    required: false
  - name: args
    description: Additional arguments for the mode
    required: false
---

**COOK: INFINITE META-ORCHESTRATION ENGINE**

Think deeply about this autonomous operation task. You are about to embark on a continuous self-improving loop that runs until context exhaustion or stop signal.

## Mode: {{mode}}

{{#if (eq mode "status")}}
## Status Mode

Quick status check (does NOT enter loop):

1. Read `.claude/cook/state/current.yaml` for loop status
2. Read `.claude/cook/steering/inbox.yaml` for pending steering
3. Check backlog via `mcp__plugin_backlog_backlog__task_list`
4. Report concisely

{{else if (eq mode "steer")}}
## Steer Mode

Add steering to inbox. Args: {{args}}

1. Parse args for content
2. Determine type/urgency:
   - "!!" prefix means immediate urgency
   - "!" prefix means high urgency
   - Contains "stop" or "halt" means type: stop
   - Contains "focus" or "prioritize" means type: priority
   - Ends with "?" means type: query
   - Default: type: idea, urgency: medium

3. Append to `.claude/cook/steering/inbox.yaml` queue:
```yaml
- id: steer-TIMESTAMP
  submitted: "ISO"
  type: idea|priority|query|stop
  urgency: low|medium|high|immediate
  content: "..."
```

4. Confirm addition

{{else if (eq mode "stop")}}
## Stop Mode

Add stop signal to steering inbox:

```yaml
- id: steer-TIMESTAMP
  submitted: "ISO"
  type: stop
  urgency: immediate
  content: "User requested shutdown"
```

Confirm: "Stop signal added. Loop will complete current iteration then halt."

{{else if (eq mode "observe")}}
## Observe Mode (Single Phase)

Run only the OBSERVE phase, do not loop.

{{else if (eq mode "plan")}}
## Plan Mode (Single Cycle, No Execute)

Run OBSERVE, ORIENT, DECIDE phases. Output proposals but do not loop.

{{else}}
## INFINITE LOOP MODE

**You are now entering an infinite autonomous loop.** You will continue executing OODA+L cycles until context exhaustion or stop signal.

### CRITICAL DATA LOCATIONS

| Data | Path |
|------|------|
| State | `.claude/cook/state/current.yaml` |
| Steering | `.claude/cook/steering/inbox.yaml` |
| Constitution | `.claude/cook/autonomy/constitution.yaml` |
| Goals | `.claude/cook/goals/hierarchy.yaml` |
| Learning | `.claude/cook/learning/log.yaml` |
| Backlog | via `mcp__plugin_backlog_backlog__task_list` |

### ULTRA-THINKING DIRECTIVE

Before beginning the loop, deeply consider:

**Environment Assessment:**
- What is the current state of the codebase?
- What tasks are pending in the backlog?
- What goals are defined in the hierarchy?
- What has been learned in previous sessions?

**Strategic Planning:**
- What high-leverage actions are available?
- How can work be parallelized across sub-agents?
- What constraints does the constitution impose?
- How will you handle steering input?

**Context Management:**
- How will you monitor context capacity?
- When should you spawn sub-agents vs act directly?
- How will you ensure graceful conclusion?

### PHASE 0: INITIALIZATION

1. Read constitution from `.claude/cook/autonomy/constitution.yaml`
2. Read current state from `.claude/cook/state/current.yaml`
3. Check for continuation from previous run
4. Initialize iteration counter
5. Update state: `status: running`, `started: NOW`

### THE INFINITE LOOP

```
WHILE context_capacity > threshold AND no_stop_signal:

    === ITERATION N ===

    PHASE 1: OBSERVE
    - Check steering inbox for new items
    - If stop signal found: initiate graceful shutdown
    - Scan git status, backlog, recent commits
    - Note any urgent items (immediate steering, high-priority tasks)

    PHASE 2: ORIENT
    - Load goal hierarchy
    - Identify patterns (what's working, what's blocked)
    - Assess available resources (agents, tools)
    - Map constraints from constitution

    PHASE 3: DECIDE
    - Generate candidate actions from:
      * Steering inbox items
      * Backlog tasks (prioritized)
      * Goal hierarchy directives
      * Observed opportunities
    - Score each: priority = (impact × urgency × alignment) / (cost × risk)
    - Select highest-scoring action within constitution limits

    PHASE 4: ACT
    - For simple actions: execute directly
    - For complex actions: spawn sub-agent via Task tool
    - For parallel opportunities: spawn multiple agents simultaneously
    - Stay within iteration limits (max 15 tool calls)

    PHASE 5: LEARN
    - Record outcome in learning log
    - Extract insights
    - Update state metrics
    - Move processed steering items to processed section

    PHASE 6: CONTINUE
    - Update state with iteration count and last action
    - Evaluate context capacity (implicit - if responses feel constrained)
    - If capacity low: write continuation state and conclude
    - Otherwise: proceed to next iteration

END LOOP
```

### STEERING INBOX PROTOCOL

At the START of each OBSERVE phase:

1. Read `.claude/cook/steering/inbox.yaml`
2. Process by urgency:
   - immediate: Handle this iteration, may override planned action
   - high: Factor strongly into DECIDE scoring
   - medium/low: Normal consideration
3. If type is "stop": Graceful shutdown after current iteration
4. Move processed items to `processed` section with outcome

### AGENT DELEGATION STRATEGY

**When to spawn sub-agents:**
- Complex research requiring exploration (use `Explore` agent)
- Code modifications (use `feature-dev:code-architect`)
- Quality review (use `feature-dev:code-reviewer`)
- Knowledge graph work (use `knowledge-graphs:weaver`)
- Backlog management (use `backlog:taskmaster`)

**When to act directly:**
- File reads and searches
- State updates
- Simple edits
- Backlog queries

**Parallel execution:**
- When multiple independent actions exist, launch them simultaneously
- Use fresh agent instances for each to avoid context accumulation
- Wait for all to complete before LEARN phase

### CONSTITUTION CONSTRAINTS

From `.claude/cook/autonomy/constitution.yaml`:

**Always Allowed:** Read, search, observe, update cook state, learning log, spawn read-only agents

**Requires High Confidence (≥0.8):** Edit code, create files, spawn writing agents

**Requires Approval (STOP):** Delete files, git push, external mutations

### ITERATION LIMITS

Per iteration stay within:
- Max 15 tool calls
- Max 3 agent spawns
- Max 5 file edits
- Max 2 new files

### GRACEFUL CONCLUSION

When approaching context limits:
1. Complete current action
2. Write comprehensive state to `.claude/cook/state/current.yaml`
3. Write summary to learning log
4. If work remains, note in state for next invocation
5. Output: `[COOK] Context capacity reached. State saved. Completed N iterations.`

### OUTPUT FORMAT

During loop, output concise phase markers:
```
[OBSERVE] Iteration 3 - Checking steering inbox...
[ORIENT] Goals: 5 pending, 3 high-priority
[DECIDE] Selected: "Update library plugin config" (score: 4.2)
[ACT] Spawning feature-dev:code-architect...
[LEARN] Success - recorded insight about config patterns
[CONTINUE] Context OK - proceeding to iteration 4
```

### BEGIN INFINITE LOOP

You are now starting the infinite cook loop.

1. Initialize state
2. Begin iteration 1
3. Continue until stop signal or context exhaustion

**START NOW.**

{{/if}}
