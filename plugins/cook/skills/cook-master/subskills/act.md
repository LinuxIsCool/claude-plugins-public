# Act Sub-Skill

## Purpose

Execute selected actions through appropriate orchestration patterns.

## Orchestration Patterns

### 1. Direct Execution
Cook uses tools directly.

**Use when:**
- Simple, well-defined action
- No specialized knowledge needed
- Speed matters

**Example:**
```
Read file, Write file, WebFetch, etc.
```

### 2. Single Agent Delegation
One specialized agent handles the task.

**Use when:**
- Task matches agent specialty
- Domain expertise needed
- Clear handoff possible

**Example:**
```
Task(
  subagent_type="librarian",
  description="Catalog new resource",
  prompt="Catalog this URL: {url}. Extract metadata, check for duplicates, add to library."
)
```

### 3. Ensemble (Parallel)
Multiple agents work simultaneously, outputs synthesized.

**Use when:**
- Multiple perspectives valuable
- Agents don't need each other's output
- Comprehensive coverage needed

**Example:**
```
# Launch in parallel
Task(subagent_type="backend-architect", prompt="Analyze from infrastructure perspective: {topic}")
Task(subagent_type="systems-thinker", prompt="Analyze from complexity perspective: {topic}")
Task(subagent_type="process-cartographer", prompt="Analyze from workflow perspective: {topic}")

# Then synthesize outputs
```

### 4. Pipeline (Sequential)
Agents form a processing chain.

**Use when:**
- Each step depends on previous
- Progressive refinement
- Multi-stage transformation

**Example:**
```
1. Task(emergence-tracker) → discoveries
2. Task(librarian) → catalog discoveries
3. Task(journal:scribe) → record insights
```

### 5. Swarm (Emergent)
Many agents, loose coordination, emergent results.

**Use when:**
- Exploring solution space
- Diverse approaches valuable
- Winner-take-all selection

**Example:**
```
# Spawn multiple approaches
Task(agent-a, approach="method 1")
Task(agent-b, approach="method 2")
Task(agent-c, approach="method 3")

# Evaluate and select best
```

## Agent Selection Matrix

| Need | Primary Agent | Backup |
|------|--------------|--------|
| Fleet overview | agent-architect | conductor |
| External resources | librarian | emergence-tracker |
| Internal artifacts | archivist | journal:scribe |
| Task breakdown | backlog:taskmaster | - |
| Knowledge graphs | knowledge-graphs:weaver | hipporag:memory-architect |
| Learning guidance | awareness:mentor | - |
| Frameworks | agents:orchestrator | - |
| Infrastructure | backend-architect | - |
| Complexity | systems-thinker | - |
| Workflows | process-cartographer | - |
| Time grounding | temporal:chronologist | - |

## Execution Protocol

### Before Acting
1. Confirm action selection with user (if significant)
2. Check prerequisites (files exist, agents available)
3. Set up progress tracking (TodoWrite)

### During Action
1. Monitor progress
2. Handle errors gracefully
3. Record intermediate results

### After Action
1. Capture full output
2. Assess success/failure
3. Pass to LEARN phase

## Error Handling

### Agent Failure
- Retry once with clarified prompt
- Fall back to backup agent
- Fall back to direct execution
- Record failure for learning

### Tool Failure
- Check error message
- Retry with adjustments
- Skip if non-critical
- Escalate if critical

### Timeout
- Check partial results
- Decide: retry, skip, or decompose

## Output Format

```yaml
execution:
  timestamp: "ISO-8601"
  action_id: "act-001"

  pattern: direct|delegate|ensemble|pipeline|swarm

  steps:
    - step: 1
      type: task|tool
      target: "agent or tool name"
      input: "..."
      output: "..."
      status: success|failure|timeout
      duration_ms: N

  result:
    status: success|partial|failure
    output: "..."
    artifacts:
      - path: "..."
        type: "..."
    errors: [...]
```

## Key Principles

1. **Smallest Effective Action**: Don't over-orchestrate
2. **Fail Fast**: Detect problems early
3. **Preserve Outputs**: Every execution generates learnable data
4. **Idempotency**: Safe to retry when possible
5. **Observability**: Make execution visible
