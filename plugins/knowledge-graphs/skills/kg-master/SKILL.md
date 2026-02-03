---
name: knowledge-graphs
description: Master skill for knowledge graph technologies (17 sub-skills). Covers: Graphiti, LightRAG, Cognee, KAG, Dgraph, FalkorDB, SPARQL, Logseq, Trilium, Potpie, codebase-digest, Airweave, Memvid, A*Net, KOI-Net. Invoke for graph databases, RAG+KG, temporal graphs, codebase analysis, or knowledge management.
allowed-tools: Read, Skill, Task, Glob, Grep
---

# Knowledge Graphs Plugin - Master Skill

Graph databases, knowledge graph construction, RAG enhancement, and knowledge management.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **graphiti** | Temporal knowledge graphs, agent memory, real-time ingestion | `subskills/graphiti.md` |
| **lightrag** | RAG with knowledge graphs, entity extraction | `subskills/lightrag.md` |
| **cognee** | Knowledge graphs for AI, memory systems | `subskills/cognee.md` |
| **kag** | Knowledge Augmented Generation, domain Q&A, logical reasoning | `subskills/kag.md` |
| **dgraph** | Distributed GraphQL database, ACID transactions | `subskills/dgraph.md` |
| **sparql-query** | RDF/SPARQL queries, semantic web | `subskills/sparql-query.md` |
| **logseq** | Personal knowledge management, networked notes | `subskills/logseq.md` |
| **trilium** | Hierarchical note-taking, knowledge base | `subskills/trilium.md` |
| **potpie** | Code understanding via knowledge graphs | `subskills/potpie.md` |
| **codebase-digest** | Codebase analysis, architecture diagrams, LLM prep | `subskills/codebase-digest.md` |
| **airweave** | Multi-app semantic search (30+ apps), RAG context | `subskills/airweave.md` |
| **memvid** | Video memory and knowledge extraction | `subskills/memvid.md` |
| **astarnet** | A*Net path-based reasoning, multi-hop inference | `subskills/astarnet.md` |
| **koi-net** | Knowledge network protocols | `subskills/koi-net.md` |
| **awesome-knowledge-graph** | KG fundamentals, tools, research papers | `subskills/awesome-knowledge-graph.md` |
| **awesome-graph-universe** | Graph technology ecosystem guide | `subskills/awesome-graph-universe.md` |
| **awesome-tkgc** | Temporal KG completion research | `subskills/awesome-tkgc.md` |

## Quick Selection Guide

### By Use Case

| Need | Sub-Skill |
|------|-----------|
| Graph databases | dgraph, graphiti |
| RAG + Knowledge Graphs | lightrag, kag, cognee |
| Temporal graphs | graphiti, awesome-tkgc |
| Agent memory | graphiti, cognee, airweave |
| Codebase analysis | potpie, codebase-digest |
| Personal knowledge mgmt | logseq, trilium |
| SPARQL/RDF | sparql-query |
| Research/learning | awesome-knowledge-graph, awesome-graph-universe |
| Multi-hop reasoning | astarnet, kag |

### By Technology

| Tech | Sub-Skills |
|------|------------|
| Neo4j | graphiti |
| FalkorDB | graphiti |
| Dgraph | dgraph |
| PostgreSQL | Use llms:pgvector instead |
| SPARQL/RDF | sparql-query |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill.

### Deep Dive
```
Read: plugins/knowledge-graphs/skills/kg-master/subskills/{name}.md
```

## Sub-Skill Summaries

### Graph Databases

**dgraph** - Distributed GraphQL database. Native graph backend. ACID transactions. Horizontal scaling. Full-text, geo, regex search.

**graphiti** - Temporal knowledge graphs. Bi-temporal tracking. Hybrid retrieval. Neo4j/FalkorDB/Kuzu backends.

### RAG + Knowledge Graphs

**lightrag** - Enhance RAG with knowledge graph structure. Entity extraction and linking.

**kag** - Knowledge Augmented Generation. Domain-specific Q&A. Logical reasoning. Schema-constrained KGs.

**cognee** - Knowledge graphs for AI applications. Memory system integration.

### Codebase Analysis

**potpie** - Understand code through knowledge graphs. Entity relationships in code.

**codebase-digest** - CLI for codebase analysis. Directory trees, token counts, 70+ LLM prompts. Architecture diagrams.

### Knowledge Management

**logseq** - Networked PKM. Bidirectional links. Block-based notes. Local-first.

**trilium** - Hierarchical notes. Rich text, code, images. Relations between notes.

### Multi-App Integration

**airweave** - Semantic search across 30+ apps. Stripe, GitHub, Notion, Slack. Universal context retrieval.

### Reasoning & Research

**astarnet** - A* algorithm for KG path reasoning. Multi-hop inference. 2.5M entity scale.

**awesome-knowledge-graph** - Curated KG resources. Tools, papers, datasets.

**awesome-graph-universe** - Complete graph tech ecosystem. Databases, engines, visualization.

**awesome-tkgc** - Temporal KG completion research. 5 methodological stages.

### Specialized

**sparql-query** - RDF query language. Semantic web. Triple stores.

**memvid** - Video knowledge extraction. Memory from video content.

**koi-net** - Knowledge network protocols and standards.
