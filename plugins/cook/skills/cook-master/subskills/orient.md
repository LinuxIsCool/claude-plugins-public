# Orient Sub-Skill

## Purpose

Assemble context and recognize patterns. Transform raw observations into actionable understanding.

## Context Assembly

### 1. Goal Hierarchy
Load from `.claude/cook/goals/hierarchy.yaml`:
- Current decade vision
- This year's strategy
- This quarter's objectives
- This month's goals
- This week's initiatives
- Today's focus

### 2. Resource Inventory
What's available:
- **Agents**: 44 specialized agents (see registry)
- **Tools**: MCP tools across plugins
- **Compute**: Current session capacity
- **Time**: User's available attention
- **Knowledge**: Accumulated in KG, library, journal

### 3. Constraint Mapping
What limits action:
- Technical blockers
- Knowledge gaps
- Resource constraints
- Dependencies
- User preferences

## Pattern Recognition

### What's Working? (Reinforce)
Patterns that produce good outcomes:
- Successful agent orchestrations
- Effective workflows
- High-leverage actions

### What's Failing? (Adapt)
Patterns that produce poor outcomes:
- Recurring failures
- Inefficient loops
- Missed opportunities

### What's Missing? (Acquire)
Gaps in capability:
- Agent gaps
- Skill gaps
- Knowledge gaps
- Tool gaps

### What's Emerging? (Track)
New developments:
- External discoveries
- Internal insights
- Ecosystem evolution

## Mental Models

Apply these lenses:

### Systems Thinking
- Feedback loops (reinforcing, balancing)
- Delays and buffers
- Leverage points
- Emergence patterns

### Information Theory
- Signal vs noise
- Compression opportunities
- Redundancy costs
- Channel capacity

### Evolutionary Biology
- Variation, selection, retention
- Fitness landscapes
- Adaptive radiation
- Niche construction

### Management Science
- Constraint theory (find the bottleneck)
- Lean principles (eliminate waste)
- Agile patterns (iterate, adapt)

## Output Format

```yaml
orientation:
  timestamp: "ISO-8601"

  context:
    current_focus: "..."
    goal_alignment: high|medium|low
    resource_state: abundant|adequate|scarce
    constraint_severity: blocking|limiting|minor

  patterns:
    working:
      - pattern: "..."
        evidence: "..."
        recommendation: "reinforce"

    failing:
      - pattern: "..."
        evidence: "..."
        recommendation: "adapt how"

    missing:
      - gap: "..."
        impact: high|medium|low
        recommendation: "acquire how"

    emerging:
      - signal: "..."
        source: "..."
        recommendation: "track|integrate|ignore"

  synthesis:
    situation: "One paragraph summary"
    key_insight: "Most important realization"
    strategic_question: "What should we ask?"
```

## Key Questions

1. What's the real situation? (Not what we assume)
2. What matters most right now?
3. What's the highest-leverage intervention?
4. What are we not seeing?
5. What would change our mind?
