---
sidebar_position: 2
title: Interpreting Insights
description: Understanding knowledge graph insights
keywords: [insights, analysis, interpretation]
---

# Interpreting Insights

KG Explorer generates insights automatically.

## Insight Types

### Cluster Detection

Related concepts forming natural groupings.

```
[Insight] Cluster: "attention mechanisms"
- Concepts: Self-Attention, Cross-Attention, Multi-Head
- Speakers: 12
- Density: 0.87
```

### Knowledge Gaps

Missing expected relationships.

```
[Insight] Gap: "Attention Is All You Need"
- Cited in 23 utterances
- No Paper node exists
- Action: Add paper node
```

### Belief Conflicts

Contradictory positions.

```
[Insight] Conflict: "output formats"
- Speaker A: "JSON is best"
- Speaker B: "Structured outputs beat JSON"
```

### Trends

Significant changes in mention frequency.

```
[Insight] Trend: "MCP Protocol"
- Change: +340% (30 days)
- New speakers: 8
```

## Confidence Scores

| Range | Action |
|-------|--------|
| 0.9-1.0 | Act on insight |
| 0.7-0.9 | Review evidence |
| 0.5-0.7 | Verify manually |
| <0.5 | Treat as hypothesis |

## Actions

- **Dismiss**: Mark as not useful
- **Promote**: Create improvement task
- **Share**: Export for collaboration

## Next Steps

- [Ontology Evolution](./ontology-evolution) - Act on gaps
- [Agent System](../architecture/agent-system) - How insights are generated
