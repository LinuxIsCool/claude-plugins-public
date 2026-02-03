---
description: Query HippoRAG knowledge graph using Personalized PageRank
argument-hint: <query>
---

# HippoRAG Query Execution

Execute associative retrieval query using Personalized PageRank over knowledge graph.

## Arguments

- **query** (required): Natural language query

## Instructions

### 1. Parse Query

```
Query: $ARGUMENTS

If no query provided:
  - Prompt user for query
  - Suggest example: "Who founded Apple and where is it headquartered?"
```

### 2. Load Configuration

```python
import yaml

with open('.hipporag/config.yaml') as f:
    config = yaml.safe_load(f)

damping_factor = config['retrieval']['damping_factor']
max_iterations = config['retrieval']['max_iterations']
top_k = config['retrieval']['top_k']
```

### 3. Initialize HippoRAG

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend=config['backend']['type'],
    connection=config['backend']['connection']
)
```

### 4. Extract Query Entities

Identify seed entities for PPR walk:

```python
# Use NER or LLM to extract entities from query
query_entities = await hippo.extract_query_entities(query)

# Example:
# Query: "Who founded Apple and where is it headquartered?"
# Entities: ["Apple"]
```

### 5. Execute Personalized PageRank

```python
# PPR starts from query entities and walks the graph
results = await hippo.search(
    query=query,
    seed_entities=query_entities,
    damping_factor=damping_factor,
    max_iterations=max_iterations,
    top_k=top_k
)

# Results contain:
# - Ranked entities (nodes)
# - Relevant relations (edges)
# - Source passages
```

### 6. Assemble Context

```python
# Collect context from top-scoring nodes and their relations
context_parts = []

for result in results:
    # Add entity description
    context_parts.append(f"Entity: {result.entity}")

    # Add connected relations
    for relation in result.relations:
        context_parts.append(
            f"  - {relation.subject} {relation.predicate} {relation.object}"
        )

    # Add source text if available
    if result.source_text:
        context_parts.append(f"  Source: {result.source_text[:200]}...")

context = "\n".join(context_parts)
```

### 7. Report Results

```
HippoRAG Query Results
━━━━━━━━━━━━━━━━━━━━━━
Query: {query}
Seed Entities: {query_entities}

Retrieved Context (top {top_k} by PPR score):

┌──────────────────────────────────────────────────────────────┐
│ Entity: {entity_1}                           Score: {score}  │
├──────────────────────────────────────────────────────────────┤
│ Relations:                                                   │
│   • {subject} --[{predicate}]--> {object}                   │
│   • {subject} --[{predicate}]--> {object}                   │
│                                                              │
│ Source: {source_excerpt}                                     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Entity: {entity_2}                           Score: {score}  │
├──────────────────────────────────────────────────────────────┤
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘

Multi-hop Path Found:
  {entity_a} → {entity_b} → {entity_c}
  (This demonstrates associative recall across {n} hops)

Statistics:
  Entities visited: {visited_count}
  Relations traversed: {relation_count}
  Query time: {elapsed}ms
```

## Understanding PPR Results

### How Personalized PageRank Works

```
1. Start at seed entities (from query)
   ┌─────┐
   │Query│ → Extract entities → [Apple, iPhone]
   └─────┘

2. Random walk with restart
   ┌──────────────────────────────────────────┐
   │                                          │
   │    Apple ──founded by──> Steve Jobs      │
   │      │                      │            │
   │      │                   cofounded       │
   │   makes                      │           │
   │      │                      ▼            │
   │      ▼                   Pixar           │
   │   iPhone                                 │
   │                                          │
   └──────────────────────────────────────────┘

3. Score nodes by visit frequency
   - Apple: 0.45 (seed entity)
   - iPhone: 0.25 (directly connected)
   - Steve Jobs: 0.18 (one hop)
   - Pixar: 0.08 (two hops, discovered via association)

4. Return top-k by score
```

### Multi-hop Discovery

PPR naturally discovers multi-hop relationships:

```
Query: "What companies did Apple's founder also create?"

Path discovered:
  Apple → (founded by) → Steve Jobs → (cofounded) → Pixar

This multi-hop reasoning emerges naturally from graph structure,
without explicit relationship chaining logic.
```

## Query Optimization Tips

1. **Be specific**: Include known entity names when possible
2. **Multi-hop queries work best**: HippoRAG excels at "X related to Y" queries
3. **Tune damping factor**: Higher (0.9) = deeper walks, Lower (0.7) = closer to seeds
4. **Adjust top_k**: More results = more context but potentially more noise

## Related Sub-Skills

For detailed retrieval mechanics:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/core-retrieval.md
```

For improving retrieval quality:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/core-consolidation.md
```
