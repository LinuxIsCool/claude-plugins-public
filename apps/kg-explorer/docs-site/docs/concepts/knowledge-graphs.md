---
sidebar_position: 1
title: Knowledge Graphs
description: Understanding knowledge graphs and their role in KG Explorer
keywords: [knowledge-graphs, graph-theory, nodes, edges, ontology]
---

# Knowledge Graphs

Knowledge graphs represent information as interconnected **entities** (nodes) and **relationships** (edges).

## Node Types

| Type | Description | Example |
|------|-------------|---------|
| **Speaker** | Voice identity | Dan Shipper |
| **Concept** | Abstract ideas | Transformers, RAG |
| **Utterance** | Speech segments | Individual turns |
| **Belief** | Expressed positions | "Agents need guardrails" |
| **Technique** | Actionable methods | Chain-of-thought |

## Edge Types

| Edge | Direction | Meaning |
|------|-----------|---------|
| DISCUSSES | Speaker -> Concept | Aggregated mentions |
| BELIEVES | Speaker -> Belief | Temporal position |
| RELATED_TO | Concept <-> Concept | Similarity |
| BUILDS_ON | Concept -> Concept | Prerequisite |

## Temporal Knowledge Graphs

KG Explorer uses **bi-temporal** modeling:

- **valid_at**: When the fact was true
- **invalid_at**: When superseded
- **created_at**: When recorded

This enables queries like "What did X believe in January 2024?"

## Next Steps

- [Ontology Design](./ontology-design) - Schema details
- [Recursive Improvement](./recursive-improvement) - Self-improvement
