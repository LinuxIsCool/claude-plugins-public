---
sidebar_position: 1
title: System Overview
description: High-level architecture of KG Explorer
keywords: [architecture, system, overview]
---

# System Overview

KG Explorer's layered architecture.

## Architecture

```
┌─────────────────────────────────────────┐
│           CLIENT LAYER                   │
│  Graph UI │ Query UI │ CLI              │
├─────────────────────────────────────────┤
│           API LAYER                      │
│  GraphQL │ REST │ WebSocket             │
├─────────────────────────────────────────┤
│           SERVICE LAYER                  │
│  Ingestion │ Query │ Insight │ Agent   │
├─────────────────────────────────────────┤
│           KNOWLEDGE LAYER                │
│  Graphiti │ Custom Extensions           │
├─────────────────────────────────────────┤
│           STORAGE LAYER                  │
│  FalkorDB │ Vector │ Full-Text         │
└─────────────────────────────────────────┘
```

## Components

### FalkorDB
- Cypher queries
- Vector similarity
- Graph traversal

### Graphiti
- Bi-temporal tracking
- Entity resolution
- Hybrid retrieval

## Data Flow

1. Client submits episode
2. Ingestion service processes
3. Graphiti extracts entities
4. FalkorDB stores graph
5. WebSocket emits updates

## Deployment

- **Development**: Single Docker container
- **Production**: Distributed with replicas

## Next Steps

- [Data Pipeline](./data-pipeline) - Ingestion details
- [Agent System](./agent-system) - Improvement agents
