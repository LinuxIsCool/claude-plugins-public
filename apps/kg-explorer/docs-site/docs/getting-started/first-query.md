---
sidebar_position: 3
title: First Query
description: Write and execute your first knowledge graph queries
keywords: [query, cypher, graphql, tutorial]
---

# First Query

KG Explorer supports Cypher, GraphQL, and natural language queries.

## Cypher Queries

### Basic Pattern Matching

```cypher
MATCH (c:Concept)
RETURN c.name, c.summary
LIMIT 20
```

### Relationship Traversal

```cypher
MATCH (s:Speaker {name: "Dan"})-[:DISCUSSES]->(concept:Concept)
RETURN concept.name
```

### Temporal Queries

```cypher
MATCH (s:Speaker)-[b:BELIEVES]->(belief:Belief)
WHERE b.valid_at >= datetime("2024-01-01")
RETURN s.name, belief.statement
```

## GraphQL Queries

```graphql
query GetConcept($id: ID!) {
  concept(id: $id) {
    name
    summary
    relatedConcepts {
      name
    }
  }
}
```

## Natural Language

Type questions directly:
- "What does Dan believe about agents?"
- "How has thinking on transformers evolved?"

## Next Steps

- [Writing Queries](../guides/writing-queries) - Advanced patterns
- [GraphQL Schema](../api/graphql-schema) - API reference
