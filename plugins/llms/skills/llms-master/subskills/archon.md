---
name: archon
description: Master Archon for building AI coding assistant knowledge bases with RAG, task management, and MCP integration. Use when building knowledge management systems, RAG pipelines with hybrid search, project/task tracking, or integrating with AI coding assistants via MCP.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Archon Mastery

Command center for AI coding assistants with knowledge base, RAG, and task management.

## Territory Map

```
resources/embeddings/Archon/
├── python/src/
│   ├── server/              # FastAPI backend (port 8181)
│   │   └── api_routes/      # Knowledge, projects, tasks APIs
│   ├── mcp_server/          # MCP server (port 8051)
│   │   └── features/        # RAG, project, task, document tools
│   ├── agents/              # PydanticAI agents
│   └── services/            # Embedding, search, crawling
├── archon-ui-main/          # React frontend (port 3737)
└── migration/               # Database schemas
```

## Core Capabilities

- **Smart web crawling** with sitemap detection, llms.txt support
- **Multi-provider embeddings**: OpenAI, Gemini, Ollama, OpenRouter
- **RAG strategies**: Base vector + Hybrid + Reranking + Agentic RAG
- **Project/Task management** with full lifecycle tracking
- **MCP server** exposing 14+ tools for Claude/Cursor integration

## MCP Tools Available

**RAG Tools:**
- `archon:rag_search_knowledge_base(query, source_id?, match_count?)`
- `archon:rag_search_code_examples(query)`
- `archon:rag_get_available_sources()`
- `archon:rag_read_full_page(page_id)`

**Project Tools:**
- `archon:find_projects(search_query?)`
- `archon:manage_project(action, ...)`

**Task Tools:**
- `archon:find_tasks(search_query?, status?, project_id?)`
- `archon:manage_task(action, ...)`

## Beginner Techniques

### Start Archon Locally
```bash
cp .env.example .env
# Add SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
docker compose up --build -d
# UI: http://localhost:3737
```

### Crawl Documentation
1. Open UI at localhost:3737
2. Go to Knowledge Base
3. Enter documentation URL
4. Click "Crawl" - watches progress in real-time

### Basic RAG Query
```python
# Via MCP or direct API
results = archon.rag_search_knowledge_base(
    query="authentication",
    match_count=5
)
```

## Intermediate Techniques

### Enable RAG Strategies (Stacking)
```bash
# In .env or Settings UI
USE_HYBRID_SEARCH=true    # BM25 + vector
USE_RERANKING=true        # CrossEncoder reordering
USE_AGENTIC_RAG=true      # Code-specific enhancement
```

### Project Workflow Integration
```python
# 1. Create project
project = archon.manage_project(
    action="create",
    name="Auth System",
    description="JWT authentication"
)

# 2. Search relevant docs
docs = archon.rag_search_knowledge_base("JWT authentication")

# 3. Create tasks
task = archon.manage_task(
    action="create",
    project_id=project['id'],
    title="Setup JWT library",
    status="todo"
)
```

### Source Filtering
```python
# Speed up queries by limiting scope
results = archon.rag_search_knowledge_base(
    query="hooks",
    source_id="react-docs-123",
    match_count=10
)
```

## Advanced Techniques

### Multi-Provider Embeddings
Switch providers in Settings UI:
- OpenAI (fastest, best quality)
- Google Gemini (cost-effective)
- Ollama (local, private)
- OpenRouter (fallback support)

### Custom RAG Chains with PydanticAI
```python
# In agents service
from pydantic_ai import Agent

agent = Agent(
    model="gpt-4",
    tools=[archon_search_tool, code_example_tool]
)

response = await agent.run(
    "Build authentication using our docs"
)
```

### Agent Work Orders (CLI Automation)
```bash
# Optional service for automated workflows
claude work -c archon-prime

# Executes: planning → create-branch → execute → create-pr
```

## Architecture

```
Frontend (React, 3737)
    ↓
API Server (FastAPI, 8181)
    ├── Knowledge (crawling, embeddings, RAG)
    ├── Projects & Tasks
    └── MCP Bridge
        ↓
MCP Server (8051)
    ↓
Database (Supabase + PGVector)
```

## Key Patterns

| Pattern | Description |
|---------|-------------|
| Hybrid Search | Semantic + keyword + reranking |
| Source filtering | Scope queries to specific docs |
| RAG stacking | Layer strategies for quality |
| Project context | Link tasks to knowledge |

## When to Use Archon

- Building knowledge bases for AI assistants
- Documentation-driven development
- Project and task tracking with AI context
- Integrating multiple documentation sources
- Custom RAG pipelines with reranking

## Reference Files

- Knowledge API: `python/src/server/api_routes/knowledge_api.py`
- MCP tools: `python/src/mcp_server/features/`
- Architecture: `PRPs/ai_docs/ARCHITECTURE.md`
