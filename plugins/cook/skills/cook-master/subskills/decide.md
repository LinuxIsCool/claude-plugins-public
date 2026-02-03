# Decide Sub-Skill

## Purpose

Select high-leverage actions. Transform understanding into specific, prioritized choices.

## Priority Formula

```
priority = (impact × urgency × alignment) / (cost × risk)
```

### Impact (0-10)
How much does this advance goals?
- 10: Major strategic progress
- 7-9: Significant advancement
- 4-6: Moderate progress
- 1-3: Minor improvement
- 0: No goal advancement

### Urgency (0-10)
How time-sensitive?
- 10: Must happen now
- 7-9: Soon (today/this week)
- 4-6: This month
- 1-3: This quarter
- 0: No time pressure

### Alignment (0-10)
How well does it fit values/direction?
- 10: Core to mission
- 7-9: Strongly aligned
- 4-6: Compatible
- 1-3: Tangential
- 0: Misaligned

### Cost (1-10)
Resources required:
- 1: Trivial
- 2-3: Minutes
- 4-5: Hours
- 6-7: Days
- 8-9: Weeks
- 10: Months

### Risk (1-10)
Probability of failure:
- 1: Certain success
- 2-3: Very likely success
- 4-5: Probable success
- 6-7: Uncertain
- 8-9: Risky
- 10: Likely failure

## Action Generation

Generate candidate actions from:

### Observation Signals
- Each opportunity → action to capture it
- Each blocker → action to remove it
- Each pattern → action to leverage/break it

### Goal Review
- Each goal gap → action to close it
- Each milestone → action to progress it

### Emergence Feed
- Each high-relevance discovery → action to integrate it

### Self-Improvement
- Each identified weakness → action to address it

## Action Types

### Focus Mode (Single Action)
Best when:
- One action dominates others
- Deep work required
- Sequential dependencies

### Breadth Mode (Parallel Actions)
Best when:
- Multiple independent high-value actions
- Exploration phase
- Agent delegation possible

### Depth Mode (Sequential Actions)
Best when:
- Actions form pipeline
- Each step informs next
- Complex multi-stage work

## Output Format

```yaml
decision:
  timestamp: "ISO-8601"

  candidates:
    - id: act-001
      description: "..."
      type: direct|delegate|ensemble|pipeline
      scores:
        impact: 8
        urgency: 7
        alignment: 9
        cost: 3
        risk: 2
      priority: 84.0  # calculated
      rationale: "Why this matters"

    - id: act-002
      # ...

  recommendation:
    mode: focus|breadth|depth
    selected:
      - act-001
    rationale: "Why this selection"

  alternatives:
    - act-002
    - act-003
```

## Decision Principles

### 1. Leverage Over Effort
Prefer actions with high impact/cost ratio.

### 2. Reversibility
Prefer reversible actions when uncertain.

### 3. Learning Value
Prefer actions that generate information.

### 4. Compound Effects
Prefer actions that enable future actions.

### 5. Constraint Focus
Address the binding constraint first.

## Key Questions

1. What's the ONE thing that would make everything else easier?
2. What would we regret NOT doing?
3. What's blocking the highest-priority goal?
4. What has the best learning potential?
5. What's the minimum viable action?
