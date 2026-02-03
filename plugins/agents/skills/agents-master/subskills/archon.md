---
name: archon-agents
description: AI agent platform with RAG, MCP integration, and multi-model orchestration for building intelligent coding assistants
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Archon Agents Mastery

Archon is an open-source AI coding command center that transforms AI assistants into knowledge-augmented, task-aware development agents. This skill focuses on building agents with Archon's RAG capabilities, MCP tools, and multi-model orchestration.

## Territory Map

### Core Agent Infrastructure
- **MCP Server** (`python/src/mcp_server/`) - HTTP-based Model Context Protocol tools for AI clients
- **PydanticAI Agents** (`python/src/agents/`) - RAG agent, document agent, base agent framework
- **Agent Work Orders** (`python/src/agent_work_orders/`) - Workflow execution engine with Claude Code CLI
- **Knowledge Base** - RAG-powered search across documentation, PDFs, crawled websites

### Agent Types
1. **MCP Tools** - Expose functionality to AI clients (Claude Code, Cursor, Windsurf)
2. **PydanticAI Agents** - Streaming agents for document processing and RAG
3. **Workflow Agents** - Automated task execution with state management
4. **Custom Subagents** - Specialized analysts (codebase-analyst, validator, library-researcher)

### Integration Points
- **Supabase + pgvector** - Vector embeddings and semantic search
- **Multi-LLM Support** - OpenAI, Ollama, Google Gemini
- **Real-time Updates** - SSE streams for live progress
- **Docker Compose** - Microservices architecture

## Core Capabilities

### 1. RAG Knowledge Management

**Hybrid Search Pattern:**
```python
# Backend: python/src/server/services/search/vector_search_service.py
# Combines semantic similarity with keyword matching
# Uses contextual embeddings + reranking for precision
```

**Knowledge Sources:**
- Web crawling with intelligent document detection
- PDF/Word document processing with chunking
- Code example extraction and indexing
- Sitemap and documentation structure preservation

**MCP Tools Available:**
```bash
# Search knowledge base
archon:rag_search_knowledge_base(query="...", source_id="...", match_count=5)

# Find code examples
archon:rag_search_code_examples(query="...", language="...", match_count=3)

# List available sources
archon:rag_get_available_sources()

# Browse documentation structure
archon:rag_list_pages_for_source(source_id="...")

# Read full page content
archon:rag_read_full_page(page_id="..." or url="...")
```

### 2. MCP Server Architecture

**Tool Pattern** (`python/src/mcp_server/features/[feature]/[feature]_tools.py`):
```python
# find_[resource] - List, search, or get single item
# manage_[resource] - Create, update, delete with "action" parameter

# Example:
archon:find_tasks(task_id="...", filter_by="status", filter_value="doing")
archon:manage_task(action="update", task_id="...", status="done")
```

**Available Tool Categories:**
- **Knowledge Base**: Search, browse, read documentation
- **Projects**: Create, update, delete projects with features
- **Tasks**: Task lifecycle management (todo → doing → review → done)
- **Documents**: Version-controlled document management
- **Versions**: Document version history and restoration

**MCP Server Location:** Port 8051 (HTTP-based SSE)

### 3. PydanticAI Agent Framework

**Base Agent Pattern** (`python/src/agents/base_agent.py`):
```python
from pydantic_ai import Agent
from pydantic_ai.models import KnownModelName

class BaseAgent:
    """Streaming agent with tool support"""

    async def stream_response(self, prompt: str):
        # Returns async generator for real-time streaming
        async for chunk in self.agent.run_stream(prompt):
            yield chunk.data
```

**Implemented Agents:**
1. **RAG Agent** (`rag_agent.py`) - Search, rerank, synthesize results
2. **Document Agent** (`document_agent.py`) - Process and chunk documents
3. **Custom Agents** - Extend base for specialized tasks

**Multi-Model Support:**
```python
# Models: openai:gpt-4o, gemini-1.5-flash, ollama:llama3.2
# Configured via Settings UI, stored encrypted in Supabase
```

### 4. Agent Work Orders (Workflow Automation)

**Architecture:**
- Workflow execution engine using Claude Code CLI
- Repository management with sandboxing
- SSE streams for real-time progress
- State persistence (memory or file-based)

**Workflow Steps:**
1. `clone` - Clone repository to sandbox
2. `prime` - Load context with Archon MCP tools
3. `planning` - Generate implementation plan
4. `execute` - Execute plan with task tracking
5. `commit` - Commit changes with detailed messages
6. `create-pr` - Create pull request via gh CLI

**Configuration** (`.env`):
```bash
ENABLE_AGENT_WORK_ORDERS=true
ANTHROPIC_API_KEY=...          # For Claude Code CLI
CLAUDE_CODE_OAUTH_TOKEN=...    # Or use OAuth token
GITHUB_PAT_TOKEN=...           # For PR creation
STATE_STORAGE_TYPE=file        # memory or file
```

## Beginner Techniques

### 1. Connect AI Client to Archon MCP

**Claude Code Example:**
```json
{
  "mcpServers": {
    "archon": {
      "command": "node",
      "args": ["path/to/mcp-proxy.js"],
      "env": {
        "ARCHON_MCP_URL": "http://localhost:8051"
      }
    }
  }
}
```

**Usage in AI Session:**
```bash
# List all projects
Use archon:find_projects to show all my projects

# Search documentation
Use archon:rag_search_knowledge_base with query "authentication patterns"

# Get current tasks
Use archon:find_tasks filtered by status "doing"
```

### 2. Create Custom MCP Tool

**File:** `python/src/mcp_server/features/custom/custom_tools.py`

```python
from mcp.server import Server
from mcp.types import Tool

def register_custom_tools(server: Server):
    @server.call_tool()
    async def archon_custom_action(query: str) -> str:
        """Custom tool description shown to AI"""
        # Your logic here
        return {"result": "..."}
```

**Register in:** `python/src/mcp_server/features/custom/__init__.py`

### 3. Build Simple RAG Query

**Pattern:**
1. Search knowledge base with 2-5 keywords
2. Get top 5-10 results
3. Use results to inform implementation

```python
# In AI session:
# 1. Search
results = archon:rag_search_knowledge_base(
    query="FastAPI middleware",
    match_count=5
)

# 2. Read specific page
page = archon:rag_read_full_page(url="https://docs...")

# 3. Find code examples
examples = archon:rag_search_code_examples(
    query="middleware setup",
    language="python"
)
```

### 4. Task-Driven Development Workflow

```bash
# 1. Create project
archon:manage_project(action="create", title="Feature X", description="...")

# 2. Add tasks
archon:manage_task(action="create", project_id="proj-123",
                   title="Setup API", task_order=10)

# 3. Work on task
archon:manage_task(action="update", task_id="task-456", status="doing")

# 4. Complete task
archon:manage_task(action="update", task_id="task-456", status="done")
```

## Intermediate Techniques

### 1. Custom Subagent for Code Analysis

**File:** `.claude/agents/codebase-analyst.md`

```yaml
---
name: "codebase-analyst"
description: "Deep codebase pattern analysis and convention discovery"
model: "sonnet"
---

You are a specialized codebase analysis agent focused on discovering patterns.

## Analysis Methodology

1. Project Structure Discovery
   - Look for Architecture docs (claude.md, agents.md, etc.)
   - Map directory structure
   - Identify frameworks and patterns

2. Pattern Extraction
   - Find similar implementations
   - Extract naming conventions
   - Document integration patterns

3. Output structured findings with file references
```

**Usage:**
```bash
# In AI session with subagents enabled
@codebase-analyst analyze authentication patterns in this project
```

### 2. Advanced RAG Strategy

**Contextual Embeddings:**
```python
# Backend automatically adds context during embedding:
# "Document: [title]\nChunk: [content]"
# Improves retrieval accuracy by 20-30%
```

**Hybrid Search Pattern:**
```python
# 1. Vector similarity (semantic)
# 2. BM25 keyword matching (exact terms)
# 3. Reranking with LLM (relevance scoring)
# Result: 70-80% better precision than pure vector search
```

**Configuration via Settings UI:**
- `USE_CONTEXTUAL_EMBEDDINGS` - Add document context to chunks
- `USE_HYBRID_SEARCH` - Combine semantic + keyword
- `USE_RERANKING` - LLM-based result reranking

### 3. Build Workflow Agent with SSE

**Backend:** `python/src/agent_work_orders/workflow_orchestrator.py`

```python
async def execute_workflow(work_order_id: str):
    """Execute workflow with SSE progress updates"""

    # 1. Connect SSE stream
    async with sse_manager.create_stream(work_order_id) as stream:

        # 2. Execute steps with progress
        for step in workflow_steps:
            await stream.send_event({
                "event": "step_started",
                "step": step.name,
                "progress_pct": step.progress
            })

            result = await execute_step(step)

            await stream.send_event({
                "event": "step_completed",
                "step": step.name,
                "result": result
            })

        # 3. Complete workflow
        await stream.send_event({
            "event": "workflow_completed",
            "elapsed_seconds": elapsed
        })
```

**Frontend Integration:**
```typescript
// Connect to SSE stream
const eventSource = new EventSource(`/api/agent-work-orders/${id}/logs/stream`);

eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  // Update UI with progress
  updateProgress(log.progress_pct, log.step);
};
```

### 4. Multi-Model Agent Orchestration

**Pattern: Route by Task Complexity**

```python
# Fast tasks: Gemini Flash (cheap, fast)
document_agent = DocumentAgent(model="gemini-1.5-flash")

# Complex reasoning: GPT-4o (expensive, powerful)
rag_agent = RAGAgent(model="openai:gpt-4o")

# Local tasks: Ollama (free, private)
code_agent = CodeAgent(model="ollama:llama3.2")
```

**Dynamic Model Selection:**
```python
async def route_to_model(task_type: str, complexity: str):
    if complexity == "simple":
        return "gemini-1.5-flash"
    elif complexity == "complex":
        return "openai:gpt-4o"
    else:
        return "ollama:llama3.2"  # Default to local
```

## Advanced Techniques

### 1. Custom Agent Work Order Commands

**Create Custom Command:** `.claude/commands/agent-work-orders/custom-analyze.md`

```yaml
---
name: custom-analyze
description: Custom analysis workflow for specific use case
argument-hint: <target-repo> <analysis-type>
---

# Custom Analysis Workflow

## Step 1: Clone Repository
Clone $ARGUMENT_1 to sandbox

## Step 2: Prime with Archon
Load project context using:
- archon:rag_search_knowledge_base for patterns
- archon:find_projects to check existing work
- archon:find_tasks to see related tasks

## Step 3: Execute Custom Analysis
[Your custom analysis logic here]

## Step 4: Generate Report
Create detailed report with:
- Findings
- Recommendations
- Implementation plan
```

**Register in Backend:**
```python
# python/src/agent_work_orders/command_loader.py
CUSTOM_COMMANDS = {
    "custom-analyze": "custom-analyze.md"
}
```

### 2. Zustand + SSE State Management

**For real-time agent status tracking:**

```typescript
// State slice for SSE connections
export const createSSESlice: StateCreator<SSESlice> = (set, get) => ({
  logConnections: new Map(),
  liveProgress: {},

  connectToLogs: (workOrderId) => {
    const url = `/api/agent-work-orders/${workOrderId}/logs/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const log = JSON.parse(event.data);
      get().handleLogEvent(workOrderId, log);
    };

    get().logConnections.set(workOrderId, eventSource);
  },

  handleLogEvent: (workOrderId, log) => {
    // Parse progress from log events
    const progressUpdate = {
      currentStep: log.step,
      progressPct: log.progress_pct,
      status: log.event === 'workflow_completed' ? 'completed' : 'running'
    };

    set((state) => ({
      liveProgress: {
        ...state.liveProgress,
        [workOrderId]: progressUpdate
      }
    }));
  }
});
```

**Benefits:**
- Replace polling with SSE (90% bandwidth reduction)
- Instant updates (<100ms latency)
- Shared state across components
- Automatic cleanup and reconnection

### 3. RAG Pipeline Optimization

**Chunking Strategy:**
```python
# python/src/server/services/storage/document_storage_service.py

# 1. Recursive character splitting (preserves context)
# 2. Overlap between chunks (continuity)
# 3. Metadata preservation (source, page, section)

chunk_size = 1000      # Characters per chunk
chunk_overlap = 200    # Overlap for context
```

**Embedding Optimization:**
```python
# Batch embeddings for efficiency
batch_size = 100
embeddings = await embedding_service.embed_batch(chunks)

# Store with metadata for filtering
await db.store_embeddings(
    embeddings=embeddings,
    metadata={
        "source_id": source.id,
        "page_number": page_num,
        "chunk_index": idx
    }
)
```

**Search Optimization:**
```sql
-- Use pgvector for similarity search with filters
SELECT * FROM documents
WHERE source_id = $1
ORDER BY embedding <=> $2::vector
LIMIT 10;
```

### 4. Build Production Agent Service

**Microservice Pattern:**

```python
# python/src/agents/server.py
from fastapi import FastAPI
from pydantic_ai import Agent

app = FastAPI()

@app.post("/agents/rag/stream")
async def rag_stream(query: str, sources: list[str]):
    """Streaming RAG agent endpoint"""

    # 1. Search knowledge base
    results = await search_service.search(
        query=query,
        source_ids=sources,
        match_count=10
    )

    # 2. Stream LLM response
    agent = RAGAgent()
    async for chunk in agent.stream_response(
        prompt=f"Query: {query}\nContext: {results}"
    ):
        yield f"data: {chunk}\n\n"
```

**Docker Service:**
```yaml
# docker-compose.yml
archon-agents:
  build: ./python
  ports:
    - "8052:8052"
  environment:
    - OPENAI_API_KEY=${OPENAI_API_KEY}
  command: uvicorn src.agents.server:app --host 0.0.0.0 --port 8052
```

### 5. Custom RAG Strategy Implementation

**Define Custom Reranker:**

```python
# python/src/agents/custom_reranker.py
from pydantic_ai import Agent

class CustomReranker:
    """Custom reranking logic for domain-specific relevance"""

    async def rerank(
        self,
        query: str,
        results: list[dict],
        top_k: int = 5
    ) -> list[dict]:
        """Rerank results using custom logic"""

        # 1. LLM-based relevance scoring
        agent = Agent(model="openai:gpt-4o-mini")

        scores = []
        for result in results:
            prompt = f"""
            Query: {query}
            Document: {result['content']}

            Rate relevance 0-10:
            """
            score = await agent.run(prompt)
            scores.append((score, result))

        # 2. Sort and return top_k
        ranked = sorted(scores, reverse=True, key=lambda x: x[0])
        return [r[1] for r in ranked[:top_k]]
```

**Integration:**
```python
# Use in RAG pipeline
reranker = CustomReranker()
final_results = await reranker.rerank(query, search_results, top_k=5)
```

## When to Use Archon for Agents

### Perfect For:

1. **Knowledge-Augmented Coding**
   - AI needs access to documentation, codebases, best practices
   - Multiple documentation sources to search
   - Need semantic + keyword search

2. **Task-Driven Development**
   - Breaking down features into trackable tasks
   - Multiple AI assistants working on same project
   - Need progress tracking and state management

3. **Workflow Automation**
   - Automated PR creation and code reviews
   - Systematic planning → execution → validation
   - Multi-step workflows with checkpoints

4. **Multi-Model Orchestration**
   - Route tasks to appropriate models (cost vs capability)
   - Fall back to local models for privacy
   - Experiment with different LLM providers

5. **Custom Agent Building**
   - Need RAG infrastructure without building from scratch
   - Want MCP standard for AI client integration
   - Require real-time progress tracking

### Not Ideal For:

- Simple scripts without documentation needs
- Projects with no external knowledge requirements
- Single-developer workflows without task tracking
- Applications requiring millisecond-level latency

### Archon vs Alternatives:

**vs Building RAG from Scratch:**
- Archon: Pre-built crawling, chunking, embedding, search
- Custom: Full control but 2-4 weeks of infrastructure work

**vs LangChain/LlamaIndex:**
- Archon: Full application with UI, MCP tools, task management
- LangChain: Library-level RAG components, DIY integration

**vs Agentic Frameworks (AutoGPT, etc.):**
- Archon: Human-in-loop with AI assist, structured workflows
- AutoGPT: Fully autonomous, less control

## Reference Files

### Core Architecture
- `resources/agents/Archon/README.md` - Main documentation
- `resources/agents/Archon/CLAUDE.md` - Development guidelines
- `resources/agents/Archon/PRPs/ai_docs/ARCHITECTURE.md` - System architecture

### Agent Implementation
- `resources/agents/Archon/python/src/agents/base_agent.py` - PydanticAI base class
- `resources/agents/Archon/python/src/agents/rag_agent.py` - RAG agent implementation
- `resources/agents/Archon/python/src/agents/document_agent.py` - Document processing

### MCP Tools
- `resources/agents/Archon/python/src/mcp_server/` - MCP server implementation
- `resources/agents/Archon/python/src/mcp_server/features/rag/` - RAG tools
- `resources/agents/Archon/python/src/mcp_server/features/projects/` - Project management tools

### Workflow Automation
- `resources/agents/Archon/python/src/agent_work_orders/` - Workflow engine
- `resources/agents/Archon/.claude/commands/agent-work-orders/` - Workflow commands
- `resources/agents/Archon/PRPs/ai_docs/AGENT_WORK_ORDERS_SSE_AND_ZUSTAND.md` - SSE integration

### Custom Subagents
- `resources/agents/Archon/.claude/agents/codebase-analyst.md` - Code analysis agent
- `resources/agents/Archon/.claude/agents/library-researcher.md` - Research agent

### Example Workflows
- `resources/agents/Archon/archon-example-workflow/` - Complete workflow example
- `resources/agents/Archon/archon-example-workflow/README.md` - Workflow documentation
- `resources/agents/Archon/.claude/commands/archon/archon-prime.md` - Context loading command

### Configuration
- `resources/agents/Archon/.env.example` - Environment variables
- `resources/agents/Archon/docker-compose.yml` - Service orchestration
