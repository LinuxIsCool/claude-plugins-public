---
name: llms
description: Master skill for LLM tools, embeddings, and knowledge systems (10 sub-skills). Covers: Graphiti, FalkorDB, pgvector, Claude/OpenAI/Llama cookbooks, Anthropic courses, Archon RAG, ElizaOS. Invoke for vector databases, knowledge graphs, RAG pipelines, API patterns, or model fine-tuning.
allowed-tools: Read, Skill, Task, Glob, Grep
---

# LLMs Plugin - Master Skill

LLM tools, vector databases, knowledge graphs, and API patterns.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **graphiti** | Temporal knowledge graphs, agent memory, real-time ingestion | `subskills/graphiti.md` |
| **falkordb** | Ultra-fast graph database, OpenCypher queries, agent memory | `subskills/falkordb.md` |
| **pgvector** | Vector similarity search in PostgreSQL, HNSW/IVFFlat indexes | `subskills/pgvector.md` |
| **pgvector-python** | pgvector with Django, SQLAlchemy, SQLModel, asyncpg | `subskills/pgvector-python.md` |
| **claude-cookbooks** | Claude API patterns, RAG, tool use, Skills API, sub-agents | `subskills/claude-cookbooks.md` |
| **openai-cookbook** | OpenAI patterns, embeddings, function calling, 23+ vector DBs | `subskills/openai-cookbook.md` |
| **anthropic-courses** | Official Anthropic courses, prompt engineering, evaluations | `subskills/anthropic-courses.md` |
| **llama-cookbook** | Llama 3/4 models, fine-tuning, LoRA/FSDP, tool calling | `subskills/llama-cookbook.md` |
| **archon** | RAG pipelines, hybrid search, MCP integration, task management | `subskills/archon.md` |
| **elizaos** | ElizaOS multi-agent TypeScript, plugins, client integrations | `subskills/elizaos.md` |

## Quick Selection Guide

### By Use Case

| Need | Sub-Skill |
|------|-----------|
| Vector search in Postgres | pgvector, pgvector-python |
| Knowledge graphs | graphiti, falkordb |
| RAG pipelines | archon, claude-cookbooks, openai-cookbook |
| Claude API patterns | claude-cookbooks, anthropic-courses |
| OpenAI API patterns | openai-cookbook |
| Llama models | llama-cookbook |
| Agent memory | graphiti, falkordb |
| Multi-agent systems | elizaos |

### By Database

| Database | Sub-Skills |
|----------|------------|
| PostgreSQL | pgvector, pgvector-python |
| FalkorDB | falkordb, graphiti |
| Neo4j | graphiti |
| Kuzu | graphiti |

## How to Use

### Quick Reference
Use the index above to identify the right sub-skill.

### Deep Dive
```
Read: plugins/llms/skills/llms-master/subskills/{name}.md
```

## Sub-Skill Summaries

### Vector Databases

**pgvector** - PostgreSQL extension for vector similarity search. HNSW and IVFFlat indexes. L2, inner product, cosine distance metrics. Hybrid search with SQL.

**pgvector-python** - Python integrations for pgvector. Django, SQLAlchemy, SQLModel, Psycopg, asyncpg, Peewee ORMs. RAG system patterns.

### Knowledge Graphs

**graphiti** - Temporal knowledge graphs for AI agents. Bi-temporal tracking. Hybrid retrieval (semantic + BM25 + graph). Neo4j, FalkorDB, Kuzu backends.

**falkordb** - Ultra-fast graph database using GraphBLAS sparse matrices. OpenCypher queries. Optimized for LLM agent memory.

### API Cookbooks

**claude-cookbooks** - Official Anthropic cookbook. 50+ production examples. RAG, tool use, sub-agents, extended thinking, Skills API.

**openai-cookbook** - OpenAI API patterns. 80+ examples. Embeddings, function calling, agents, fine-tuning. Integrates with 23+ vector DBs.

**anthropic-courses** - Official Anthropic courses. API fundamentals, prompt engineering, evaluations, tool use. 27+ interactive notebooks.

**llama-cookbook** - Meta's Llama guide. Llama 3/4 inference, fine-tuning with LoRA/FSDP, RAG, tool calling. 25+ end-to-end examples.

### RAG & Agents

**archon** - AI coding assistant knowledge bases. RAG with hybrid search. Task management. MCP integration.

**elizaos** - ElizaOS multi-agent framework. TypeScript monorepo. Plugin architecture. Discord/Telegram/Twitter integrations.
