# Learn Sub-Skill

## Purpose

Record outcomes, extract insights, accumulate knowledge. This closes the feedback loop.

## Learning Process

### 1. Outcome Recording
Capture what happened:
- What action was taken?
- What was the result?
- How long did it take?
- What resources were used?

### 2. Success/Failure Analysis
Understand why:
- Why did it succeed/fail?
- What was unexpected?
- What assumptions were wrong?

### 3. Insight Extraction
Generalize:
- What pattern does this reveal?
- What should change?
- What should stay the same?

### 4. Knowledge Integration
Store durably:
- Update learning log
- Create journal entry if significant
- Update KG if applicable
- Flag for self-improvement if systemic

## Learning Log Structure

Location: `.claude/cook/learning/log.yaml`

```yaml
entries:
  - id: learn-{timestamp}
    timestamp: "ISO-8601"

    action:
      id: "act-001"
      description: "What was attempted"
      pattern: "direct|delegate|ensemble|pipeline|swarm"

    outcome:
      status: success|partial|failure
      description: "What happened"
      duration_ms: N
      artifacts: [...]

    analysis:
      expected: "What we expected"
      actual: "What actually happened"
      delta: "The gap"
      root_cause: "Why the gap exists"

    insights:
      - insight: "Generalized learning"
        confidence: high|medium|low
        scope: "Where this applies"

    adaptations:
      - target: "What to change"
        change: "How to change it"
        priority: high|medium|low
        status: proposed|approved|implemented
```

## Learning Types

### 1. Tactical Learning
Immediate applicability:
- This prompt works better than that one
- This agent is good at X
- This tool has this quirk

### 2. Strategic Learning
Pattern-level:
- Ensemble works better than pipeline for X
- Morning sessions are more productive
- Goal Y is harder than expected

### 3. Meta-Learning
Learning about learning:
- What types of actions teach most?
- What patterns are we missing?
- How accurate are our predictions?

## Knowledge Integration Paths

### To Journal
For significant insights worth permanent record:
```
Task(journal:scribe, "Create atomic entry for insight: {insight}")
```

### To Library
For external resources discovered:
```
Task(librarian, "Catalog resource: {url}")
```

### To KG
For structured knowledge:
```
Add to temporal KG via FalkorDB
```

### To Self-Improvement
For systemic issues:
```
Flag in adaptations with priority=high
→ Self-improver agent will process
```

## Metrics to Track

### Efficiency Metrics
- Actions per session
- Success rate
- Time per action type
- Agent utilization

### Effectiveness Metrics
- Goals advanced
- Blockers removed
- Knowledge accumulated
- Self-improvements made

### Learning Metrics
- Insights generated
- Adaptations implemented
- Prediction accuracy
- Pattern detection rate

## Output Format

```yaml
learning:
  timestamp: "ISO-8601"
  session_summary:
    actions_taken: N
    successes: N
    failures: N
    insights_generated: N

  entries: [...]  # Individual learning entries

  recommendations:
    immediate:
      - "Do X in next action"
    session:
      - "Focus on Y this session"
    systemic:
      - "Consider changing Z"
```

## Key Questions

1. What worked? Why?
2. What failed? Why?
3. What surprised us?
4. What pattern is emerging?
5. What should we do differently?
