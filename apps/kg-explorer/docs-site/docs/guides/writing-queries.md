---
sidebar_position: 1
title: Writing Queries
description: Advanced patterns for querying knowledge graphs
keywords: [queries, cypher, patterns, optimization]
---

# Writing Queries

Advanced query patterns for KG Explorer.

## Speaker Analysis

```cypher
-- What does a speaker discuss most?
MATCH (s:Speaker {name: $name})-[d:DISCUSSES]->(c:Concept)
RETURN c.name, d.mention_count
ORDER BY d.mention_count DESC
```

```cypher
-- Find speakers with similar interests
MATCH (target:Speaker {name: $name})-[:DISCUSSES]->(c:Concept)
MATCH (other:Speaker)-[:DISCUSSES]->(c)
WHERE other <> target
RETURN other.name, count(c) as overlap
ORDER BY overlap DESC
```

## Concept Exploration

```cypher
-- Prerequisite chain
MATCH path = (c:Concept {name: $name})-[:BUILDS_ON*1..5]->(prereq:Concept)
RETURN [node in nodes(path) | node.name] as chain
```

## Temporal Queries

```cypher
-- Belief evolution
MATCH (s:Speaker {name: $name})-[b:BELIEVES]->(belief:Belief)
WHERE belief.topic = $topic
RETURN belief.statement, b.valid_at, b.invalid_at
ORDER BY b.valid_at
```

## Optimization Tips

1. **Filter early**: Use pattern constraints
2. **Limit depth**: Bound path queries
3. **Use indexes**: Ensure indexed properties
4. **Profile**: Use `PROFILE` to analyze

## Next Steps

- [GraphQL Schema](../api/graphql-schema) - Typed queries
- [Performance](../architecture/performance) - Optimization
