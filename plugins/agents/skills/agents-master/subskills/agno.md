---
name: agno
description: Unified agent framework with AgentOS runtime for production multi-agent systems
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Agno Mastery

Agno is an incredibly fast multi-agent framework, runtime and control plane that provides the complete stack for building, running and managing multi-agent systems in production. With performance benchmarks showing 529x faster agent instantiation than LangGraph and 24x lower memory usage, Agno combines a powerful development framework with AgentOS Runtime for secure, stateless production deployment.

## Territory Map

Agno's architecture consists of three core layers:

1. **Framework**: Build agents, multi-agent teams and workflows with memory, knowledge, state, guardrails, HITL, context compression, MCP, A2A and 100+ toolkits
2. **AgentOS Runtime**: Production execution environment with secure, stateless runtime and ready-to-use integration endpoints
3. **AgentOS Control Plane**: Test, monitor and manage AgentOS deployments across environments with full operational visibility

Additional capabilities:
- **Multi-Model Support**: OpenAI, Anthropic Claude, Google Gemini, Meta, Mistral, DeepSeek, Ollama, LlamaCpp
- **Memory Systems**: Short-term, long-term, entity, and culture memory with RAG across 20+ vector stores
- **Knowledge Integration**: Agentic RAG with vector databases (LanceDB, Pinecone, Weaviate, Milvus, PgVector, MongoDB)
- **Tools & Integrations**: 100+ toolkits with MCP and A2A protocol support
- **Database Support**: SQLite, PostgreSQL, MongoDB for session/history storage

## Core Capabilities

- **Extreme Performance**: ~3 microsecond agent instantiation, ~6.6 KB memory footprint
- **Multi-Agent Teams**: Coordinate, collaborate, and delegate modes for agent collaboration
- **Workflows**: Deterministic, stateful, multi-agent programs using pure Python
- **Type Safety**: Structured input/output schemas using Pydantic models
- **Privacy-First**: Runs entirely in your cloud, no external data transmission
- **Model Agnostic**: Plug-and-play LLM integrations across providers
- **Production Ready**: FastAPI runtime with SSE endpoints, horizontal scalability
- **Context Management**: Dynamic instruction injection, compression, and state management

## Beginner Techniques

### Creating a Basic Agent

```python
from agno.agent import Agent
from agno.models.anthropic import Claude

agent = Agent(
    name="Research Assistant",
    model=Claude(id="claude-sonnet-4-5"),
    description="You are a helpful research assistant",
    instructions=["Always provide sources", "Be concise and clear"],
    markdown=True,
)

# Simple execution
response = agent.run("What are the latest AI developments?")
print(response.content)
```

### Agent with Database Persistence

```python
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.anthropic import Claude

agent = Agent(
    name="Persistent Agent",
    model=Claude(id="claude-sonnet-4-5"),
    db=SqliteDb(db_file="agent_sessions.db"),
    add_history_to_context=True,  # Enable conversation memory
    markdown=True,
)

# Each user gets their own session
response = agent.run(
    "Remember that I prefer technical explanations",
    session_id="user_123"
)
```

### Agent with MCP Tools

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.tools.mcp import MCPTools

agent = Agent(
    name="MCP Agent",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[
        MCPTools(
            transport="streamable-http",
            url="https://docs.agno.com/mcp"
        )
    ],
    show_tool_calls=True,
)

response = agent.run("Search for Python best practices")
```

### AgentOS Runtime Setup

```python
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.anthropic import Claude
from agno.os import AgentOS

agent = Agent(
    name="Production Agent",
    model=Claude(id="claude-sonnet-4-5"),
    db=SqliteDb(db_file="agno.db"),
    markdown=True,
)

# Create AgentOS application
agent_os = AgentOS(agents=[agent])
app = agent_os.get_app()

# Serve with FastAPI
if __name__ == "__main__":
    agent_os.serve(app="main:app", reload=True)
```

## Intermediate Techniques

### Multi-Agent Teams with Coordinate Mode

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.models.anthropic import Claude
from agno.team.team import Team
from agno.tools.duckduckgo import DuckDuckGoTools

# Specialized agents
web_agent = Agent(
    name="Web Search Agent",
    role="Handle web search requests and general research",
    model=OpenAIChat(id="gpt-4o"),
    tools=[DuckDuckGoTools()],
    instructions=["Always include sources"],
)

news_agent = Agent(
    name="News Agent",
    role="Handle news requests and current events analysis",
    model=OpenAIChat(id="gpt-4o"),
    tools=[DuckDuckGoTools(search=True, news=True)],
)

# Team with coordinator
research_team = Team(
    name="Reasoning Research Team",
    mode="coordinate",  # Team Leader delegates and synthesizes
    model=Claude(id="claude-sonnet-4-5"),
    members=[web_agent, news_agent],
    description="Expert research team for comprehensive analysis",
    instructions=[
        "Delegate tasks to appropriate team members",
        "Synthesize all findings into coherent response",
    ],
)

response = research_team.print_response(
    "What are the latest developments in quantum computing?"
)
```

### Collaborate Mode Team

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.team.team import Team
from agno.tools.duckduckgo import DuckDuckGoTools

reddit_researcher = Agent(
    name="Reddit Researcher",
    role="Research and summarize Reddit discussions",
    model=OpenAIChat(id="gpt-4o"),
    tools=[DuckDuckGoTools()],
)

hackernews_researcher = Agent(
    name="HackerNews Researcher",
    role="Research and summarize HackerNews posts",
    model=OpenAIChat(id="gpt-4o"),
    tools=[DuckDuckGoTools()],
)

discussion_team = Team(
    name="Discussion Team",
    mode="collaborate",  # Members work together
    model=OpenAIChat(id="gpt-4o"),
    members=[reddit_researcher, hackernews_researcher],
    instructions=["Facilitate collaborative research"],
    success_criteria="The team has reached a consensus.",
    enable_agentic_context=True,
)
```

### Knowledge and RAG Integration

```python
from agno.agent import Agent
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.knowledge.knowledge import Knowledge
from agno.models.openai import OpenAIChat
from agno.vectordb.pgvector import PgVector, SearchType

# Configure vector database
knowledge = Knowledge(
    vector_db=PgVector(
        table_name="documentation",
        db_url="postgresql+psycopg://user:pass@localhost:5432/db",
        search_type=SearchType.hybrid,  # Hybrid search
        embedder=OpenAIEmbedder(id="text-embedding-3-small"),
    ),
)

# Add knowledge sources
knowledge.add_content(
    url="https://example.com/docs/guide.pdf"
)

# Agent with knowledge
agent = Agent(
    model=OpenAIChat(id="gpt-4o"),
    knowledge=knowledge,
    add_knowledge_to_context=True,  # Auto-inject relevant knowledge
    search_knowledge=True,  # Enable semantic search
    markdown=True,
)
```

### Structured Output with Pydantic

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from pydantic import BaseModel, Field
from typing import List

class ResearchReport(BaseModel):
    title: str = Field(..., description="Report title")
    key_findings: List[str] = Field(..., description="Main findings")
    sources: List[str] = Field(..., description="Source URLs")
    confidence_score: float = Field(..., ge=0.0, le=1.0)

agent = Agent(
    name="Structured Researcher",
    model=Claude(id="claude-sonnet-4-5"),
    response_model=ResearchReport,
)

response = agent.run("Research AI safety developments")
# response.content is a ResearchReport instance
print(response.content.title)
print(response.content.key_findings)
```

### Memory-Enabled Agent

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.memory.memory import Memory
from agno.db.postgresql import PostgresDb

agent = Agent(
    name="Memory Agent",
    model=Claude(id="claude-sonnet-4-5"),
    memory=Memory(
        db=PostgresDb(db_url="postgresql://localhost/memory"),
        create_user_memories=True,
        create_session_summary=True,
    ),
    add_history_to_context=True,
    num_history_responses=5,  # Include last 5 exchanges
)

# Agent remembers across sessions
agent.run("My name is Alice", session_id="user_1")
agent.run("What's my name?", session_id="user_1")  # Recalls "Alice"
```

## Advanced Techniques

### Python Workflows for Deterministic Control

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.workflow.workflow import Workflow, RunResponse
from agno.tools.duckduckgo import DuckDuckGoTools
from pydantic import BaseModel

class ResearchState(BaseModel):
    topic: str = ""
    findings: list = []
    analyzed: bool = False

class ResearchWorkflow(Workflow):
    description: str = "Multi-step research and analysis workflow"

    researcher: Agent = Agent(
        name="Researcher",
        role="Research specialist",
        model=Claude(id="claude-sonnet-4-5"),
        tools=[DuckDuckGoTools()],
    )

    analyst: Agent = Agent(
        name="Analyst",
        role="Analysis specialist",
        model=Claude(id="claude-sonnet-4-5"),
    )

    def run(self, topic: str, **kwargs) -> RunResponse:
        # Step 1: Research
        logger.info(f"Researching topic: {topic}")
        research_result = self.researcher.run(
            f"Research the following topic: {topic}",
            stream=False
        )

        # Step 2: Conditional logic
        if "insufficient" in research_result.content.lower():
            logger.warning("Insufficient data, requesting more research")
            research_result = self.researcher.run(
                f"Do deeper research on: {topic}",
                stream=False
            )

        # Step 3: Analysis
        logger.info("Analyzing findings")
        analysis_result = self.analyst.run(
            f"Analyze these findings: {research_result.content}",
            stream=False
        )

        # Step 4: Cache intermediate results
        self.session_state["research"] = research_result.content
        self.session_state["analysis"] = analysis_result.content

        return RunResponse(
            content=analysis_result.content,
            event="workflow_complete"
        )

# Execute workflow
workflow = ResearchWorkflow()
response = workflow.run(topic="quantum computing breakthroughs")
```

### Advanced Team with Editor Pattern

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.team.team import Team
from agno.tools.duckduckgo import DuckDuckGoTools

searcher = Agent(
    name="Search Specialist",
    role="Expert at finding relevant information",
    model=OpenAIChat(id="gpt-4o"),
    tools=[DuckDuckGoTools()],
    instructions=["Find authoritative sources", "Verify information"],
)

writer = Agent(
    name="Content Writer",
    role="Expert at crafting compelling articles",
    model=OpenAIChat(id="gpt-4o"),
    instructions=[
        "Write in clear, engaging style",
        "Use provided research only",
        "Include citations",
    ],
)

editor = Team(
    name="Editorial Team",
    mode="coordinate",
    model=OpenAIChat(id="gpt-4o"),
    members=[searcher, writer],
    description="Senior editor coordinating the content creation process",
    instructions=[
        "Delegate research to the search specialist",
        "Delegate drafting to the content writer",
        "Review, proofread, and enhance the final article",
        "Ensure high editorial standards",
    ],
)

response = editor.print_response(
    "Write an article about AI agents in production"
)
```

### RAG with MongoDB

```python
from agno.agent import Agent
from agno.knowledge.pdf_url import PDFUrlKnowledgeBase
from agno.vectordb.mongodb import MongoDb
from agno.embedder.openai import OpenAIEmbedder
from agno.models.anthropic import Claude

vector_db = MongoDb(
    collection_name="vector-embeddings",
    db_url="mongodb://localhost:27017",
    database="agno",
    search_index_name="vector-search",
    embedder=OpenAIEmbedder(id="text-embedding-3-small"),
)

knowledge_base = PDFUrlKnowledgeBase(
    urls=[
        "https://example.com/manual.pdf",
        "https://example.com/guide.pdf",
    ],
    vector_db=vector_db,
)

agent = Agent(
    name="Document Expert",
    model=Claude(id="claude-sonnet-4-5"),
    knowledge=knowledge_base,
    show_tool_calls=True,
    search_knowledge=True,
)
```

### RAG with LanceDB and Hybrid Search

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.knowledge.pdf_url import PDFUrlKnowledgeBase
from agno.vectordb.lancedb import LanceDb
from agno.vectordb.search import SearchType

vector_db = LanceDb(
    table_name="recipes",
    uri="./lancedb",
    search_type=SearchType.hybrid,  # Keyword + semantic
)

knowledge_base = PDFUrlKnowledgeBase(
    urls=["https://example.com/recipes.pdf"],
    vector_db=vector_db,
)

# Load knowledge
knowledge_base.load()

agent = Agent(
    model=OpenAIChat(id="gpt-4o"),
    knowledge=knowledge_base,
    search_knowledge=True,
    markdown=True,
)

response = agent.run("What's a good Thai curry recipe?")
```

### MCP Integration Patterns

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.tools.mcp import MCPTools, MultiMCPTools

# Single MCP Server
filesystem_agent = Agent(
    name="Filesystem Agent",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[
        MCPTools(
            command="npx",
            args=["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
        )
    ],
    markdown=True,
)

# Multiple MCP Servers
multi_agent = Agent(
    name="Multi-Tool Agent",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[
        MultiMCPTools(
            servers={
                "github": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-github"],
                    "env": {"GITHUB_TOKEN": "ghp_..."},
                },
                "filesystem": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
                },
            }
        )
    ],
)

# Anthropic Native MCP (Claude only)
agent = Agent(
    model=Claude(id="claude-sonnet-4-5"),
    mcp_servers=[
        {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {"GITHUB_TOKEN": "ghp_..."},
        }
    ],
)
```

### Context Management and Guardrails

```python
from agno.agent import Agent
from agno.models.anthropic import Claude

agent = Agent(
    name="Guarded Agent",
    model=Claude(id="claude-sonnet-4-5"),
    # Dynamic context injection
    additional_context="Current date: {current_date}",
    # Context window management
    respect_context_window=True,
    # Guardrails
    prevent_prompt_injection=True,
    prevent_hallucinations=True,
    # Response formatting
    markdown=True,
    structured_outputs=True,
)
```

### AgentOS Production Deployment

```python
from agno.agent import Agent
from agno.team.team import Team
from agno.workflow.workflow import Workflow
from agno.models.anthropic import Claude
from agno.db.postgresql import PostgresDb
from agno.os import AgentOS
import uvicorn

# Define agents
agent1 = Agent(
    name="Agent 1",
    model=Claude(id="claude-sonnet-4-5"),
    db=PostgresDb(db_url="postgresql://localhost/agents"),
)

team1 = Team(
    name="Team 1",
    members=[agent1],
    mode="coordinate",
    model=Claude(id="claude-sonnet-4-5"),
)

workflow1 = Workflow(name="Workflow 1")

# Create AgentOS with all components
agent_os = AgentOS(
    agents=[agent1],
    teams=[team1],
    workflows=[workflow1],
    # Production settings
    enable_cors=True,
    cors_origins=["https://app.example.com"],
    # Monitoring
    enable_metrics=True,
    # Security
    api_key="your-api-key",
)

app = agent_os.get_app()

if __name__ == "__main__":
    # Production server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        workers=4,  # Multiple workers
        log_level="info",
    )
```

### Custom Tools Development

```python
from agno.tools import Toolkit
from agno.utils.log import logger

class CustomResearchToolkit(Toolkit):
    def __init__(self):
        super().__init__(name="custom_research")
        self.register(self.search_database)
        self.register(self.analyze_data)

    def search_database(self, query: str) -> str:
        """Search internal database for information.

        Args:
            query: Search query string

        Returns:
            Search results as formatted string
        """
        logger.info(f"Searching database for: {query}")
        # Custom implementation
        results = self._perform_search(query)
        return f"Found {len(results)} results for '{query}'"

    def analyze_data(self, data: dict) -> dict:
        """Analyze provided data and return insights.

        Args:
            data: Dictionary containing data to analyze

        Returns:
            Analysis results as dictionary
        """
        logger.info("Analyzing data")
        # Custom analysis logic
        return {"insights": [], "confidence": 0.85}

# Use custom toolkit
agent = Agent(
    name="Research Agent",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[CustomResearchToolkit()],
    show_tool_calls=True,
)
```

### Multi-Model Strategy

```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.models.anthropic import Claude
from agno.models.google import Gemini

# Fast agent for quick tasks
fast_agent = Agent(
    name="Quick Responder",
    model=OpenAIChat(id="gpt-4o-mini"),
)

# Reasoning agent for complex analysis
reasoning_agent = Agent(
    name="Deep Thinker",
    model=OpenAIChat(id="o1"),
    reasoning=True,
)

# Multimodal agent for vision tasks
vision_agent = Agent(
    name="Vision Specialist",
    model=Claude(id="claude-sonnet-4-5"),
    multimodal=True,
)

# Long-context agent for document analysis
context_agent = Agent(
    name="Document Analyst",
    model=Gemini(id="gemini-2.0-flash-exp"),
)
```

## When to Use Agno

**Ideal for:**
- Production multi-agent systems requiring extreme performance
- Applications needing privacy-first architecture with local deployment
- Complex workflows combining autonomous agents with deterministic logic
- Teams wanting unified framework + runtime + control plane
- Projects requiring 20+ vector store integrations for RAG
- Systems needing multi-model flexibility across providers
- Applications with strict memory and performance constraints
- Teams building MCP-integrated tool ecosystems
- Production deployments requiring horizontal scalability
- Workflows needing persistent state and resumability

**Choose over other frameworks when:**
- Performance is critical (529x faster instantiation than LangGraph)
- Memory efficiency matters (24x lower footprint than LangGraph)
- You need production runtime out of the box (AgentOS)
- Privacy and data sovereignty are non-negotiable
- You want pure Python workflows without DSLs
- You need comprehensive observability and monitoring
- Model-agnostic architecture is required
- Fast iteration and deployment cycles are essential

**Not ideal for:**
- Simple single-agent chatbots (overhead not justified)
- Projects locked into LangChain ecosystem
- Teams requiring visual workflow builders
- Applications needing JavaScript/TypeScript (Python only)
- Ultra-minimal resource environments (embedded systems)

## Reference Files

Since the local resource directory is empty, refer to official documentation:

**Primary Resources:**
- GitHub: https://github.com/agno-agi/agno
- Documentation: https://docs.agno.com/introduction
- Agent Framework: https://www.agno.com/agent-framework
- AgentOS: https://www.agno.com/agent-os
- PyPI Package: https://pypi.org/project/agno/

**Key Documentation:**
- Multi-Agent Systems: https://docs.agno.com/introduction/multi-agent-systems
- Team Coordination: https://docs.agno.com/teams/coordinate
- Knowledge & RAG: https://docs.agno.com/agents/knowledge
- MCP Integration: https://docs.agno.com/basics/tools/mcp/overview
- Workflows: https://docs.agno.com/basics/workflows

**Code Examples:**
- GitHub Cookbook: https://github.com/agno-agi/agno/tree/main/cookbook
- Team Workflows: https://docs.agno.com/examples/workflows/team-workflow
- Traditional RAG: https://docs.agno.com/examples/concepts/knowledge/rag/traditional-rag-pgvector
- MCP Tools: https://github.com/agno-agi/agno/tree/main/cookbook/tools/mcp

**Community:**
- Discussion Forum: https://community.agno.com
- Discord: Available via documentation
- LLM Context File: llms-full.txt provided in repository

**Installation:**
```bash
pip install agno
pip install 'agno[pgvector]'  # With PgVector support
pip install 'agno[lancedb]'   # With LanceDB support
pip install 'agno[mongodb]'   # With MongoDB support
```

**Performance Benchmarks:**
- Agent instantiation: ~3 microseconds
- Memory footprint: ~6.6 KB per agent
- 529x faster than LangGraph
- 57x faster than PydanticAI
- 70x faster than CrewAI

**Key Features:**
- 100+ integrated toolkits
- 20+ vector database connectors
- Multi-model support (OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, Ollama)
- MCP and A2A protocol support
- FastAPI production runtime with SSE endpoints
- Horizontal scalability and stateless architecture
- Privacy-first with local deployment
- 35,917+ GitHub stars
- Apache-2.0 license
