---
sidebar_position: 3
title: Agent System
description: Autonomous agents driving recursive improvement
keywords: [agents, autonomous, improvement]
---

# Agent System

Autonomous agents observe, analyze, and improve KG Explorer.

## Agent Types

### Observation Agents

- **Query Monitor**: Track query patterns
- **Gap Detector**: Identify missing knowledge
- **Error Collector**: Gather failures

### Analysis Agents

- **Pattern Detector**: Find recurring patterns
- **Quality Analyzer**: Score data quality
- **Insight Synthesizer**: Generate insights

### Improvement Agents

- **Schema Evolver**: Propose schema changes
- **Pipeline Optimizer**: Improve processing
- **Query Optimizer**: Enhance retrieval

## Agent Lifecycle

1. Initialize and register
2. Run observation loop
3. Trigger analysis periodically
4. Execute improvements on-demand

## Configuration

```yaml
agents:
  query_monitor:
    enabled: true
    sample_rate: 1.0

  schema_evolver:
    auto_implement: false
    max_changes_per_day: 3
```

## Next Steps

- [Performance](./performance) - Agent-driven optimization
- [Recursive Improvement](../concepts/recursive-improvement) - Philosophy
