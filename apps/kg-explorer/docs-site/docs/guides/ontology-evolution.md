---
sidebar_position: 3
title: Ontology Evolution
description: How to extend the KG Explorer ontology
keywords: [ontology, evolution, schema, extension]
---

# Ontology Evolution

Extend the schema safely while maintaining data integrity.

## Adding Node Types

1. Define schema
2. Register with Graphiti
3. Create constraints
4. Update GraphQL
5. Add extraction rules

```python
class PaperNode(EntityNode):
    title: str
    doi: str | None = None
    authors: list[str] = []
    citations: int = 0
```

## Adding Edge Types

1. Define semantics
2. Create schema
3. Add inference rules
4. Optional: Build aggregations

```markdown
## CITES
Direction: (Utterance)-[:CITES]->(Paper)
Properties: context, agreement, timestamp
```

## Adding Properties

Add as optional, then backfill:

```python
# Migration
await execute("""
    MATCH (c:Concept)
    WHERE c.complexity IS NULL
    SET c.complexity = 'unknown'
""")
```

## Migration Strategies

- **Online**: Small changes during operation
- **Offline**: Schema changes during maintenance
- **Dual-Write**: Zero-downtime migrations

## Validation

```python
def test_backward_compatible():
    result = execute("MATCH (s:Speaker)-[:DISCUSSES]->(c) RETURN count(*)")
    assert result > 0
```

## Next Steps

- [Contributing Data](./contributing-data) - Use new schema
- [System Overview](../architecture/system-overview) - Architecture context
