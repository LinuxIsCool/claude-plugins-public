---
sidebar_position: 4
title: Performance
description: Performance optimization strategies
keywords: [performance, optimization, caching]
---

# Performance

Optimization strategies for KG Explorer.

## Targets

| Metric | Target |
|--------|--------|
| Query p50 | < 50ms |
| Query p99 | < 200ms |
| Ingestion | 100 eps/s |

## Query Optimization

### Indexing

```cypher
CREATE INDEX speaker_name FOR (s:Speaker) ON (s.name);
CREATE INDEX concept_type FOR (c:Concept) ON (c.type);
```

### Efficient Patterns

```cypher
-- Good: Filter in pattern
MATCH (s:Speaker {name: $name})-[:DISCUSSES]->(c)
RETURN c

-- Bad: Filter after match
MATCH (s:Speaker)-[:DISCUSSES]->(c)
WHERE s.name = $name
RETURN c
```

### Query Caching

```yaml
cache:
  result:
    max_entries: 10000
    ttl_seconds: 300
```

## Ingestion Optimization

- Batch processing (100 episodes)
- Parallel LLM calls
- Deferred aggregation

## Monitoring

```yaml
metrics:
  - kg_query_duration_seconds
  - kg_cache_hit_ratio
  - kg_graph_size_nodes
```

## Next Steps

- [System Overview](./system-overview) - Architecture
- [Writing Queries](../guides/writing-queries) - Query patterns
