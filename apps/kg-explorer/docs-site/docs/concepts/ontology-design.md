---
sidebar_position: 2
title: Ontology Design
description: The ontology powering KG Explorer's knowledge representation
keywords: [ontology, schema, design, taxonomy]
---

# Ontology Design

The ontology defines how knowledge is structured and related.

## Design Principles

1. **Additive by default** - Add new elements, don't modify existing
2. **Backward compatible** - Existing queries continue working
3. **Forward thinking** - Design for future extensions

## Node Schemas

### Speaker

```typescript
interface Speaker {
  id: string;
  name: string;
  aliases: string[];
  transcriptCount: number;
  totalSpeakingTime: number;
}
```

### Concept

```typescript
interface Concept {
  id: string;
  name: string;
  summary: string;
  type: ConceptType;
  complexity: Complexity;
}
```

## Edge Semantics

### Attribution Edges

```
(Speaker)-[:SPOKE]->(Utterance)
```

### Content Edges

```
(Utterance)-[:MENTIONS {salience: 0.8}]->(Concept)
```

### Aggregation Edges

```
(Speaker)-[:DISCUSSES {mention_count: 47}]->(Concept)
```

## Schema Evolution

See [Ontology Evolution](../guides/ontology-evolution) for extension patterns.
