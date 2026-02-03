---
sidebar_position: 2
title: Quick Start
description: Get up and running with KG Explorer in 5 minutes
keywords: [quickstart, tutorial, getting-started]
---

# Quick Start

Get exploring knowledge graphs in under 5 minutes.

## Start the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## The Explorer Interface

```
+------------------+------------------+
|   Graph View     |   Query Panel    |
+------------------+------------------+
|          Insight Stream             |
+-------------------------------------+
```

## Ingest Your First Data

1. Click **Add Episode** in the toolbar
2. Paste sample text
3. Set metadata and click **Ingest**

## Explore the Graph

- **Scroll**: Zoom in/out
- **Click + Drag**: Pan
- **Click node**: View details

## Run Your First Query

```cypher
MATCH (c:Concept)-[r]->(related)
RETURN c.name, type(r), related.name
LIMIT 10
```

## Next Steps

- [First Query](./first-query) - Deep dive into queries
- [Knowledge Graphs](../concepts/knowledge-graphs) - Understand the theory
