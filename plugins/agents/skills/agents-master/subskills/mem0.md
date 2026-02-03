---
name: mem0
description: Self-improving memory layer for AI agents with automatic fact extraction, semantic search, and multi-level context management
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Mem0 Mastery

Mem0 is an intelligent memory layer that enhances AI assistants and agents with persistent, adaptive memory capabilities. It automatically extracts and stores facts from conversations, enabling personalized AI interactions that improve over time. Mem0 supports both managed platform and self-hosted deployments, offering multi-level memory organization (user, session, agent), graph-based relationships, and powerful semantic search.

## Territory Map

Mem0's ecosystem spans multiple dimensions:

- **Core Memory Operations**: Add, search, update, delete, and manage memories with automatic fact extraction
- **Deployment Options**: Managed platform (hosted) or self-hosted open-source with full infrastructure control
- **Storage Backends**: Vector databases (Qdrant, Chroma, Pinecone, etc.), graph stores (Neo4j, Memgraph, Neptune), and history tracking
- **Component Flexibility**: Configurable LLMs, embedders, rerankers, and vector stores
- **Integration Ecosystem**: LangChain, CrewAI, AutoGen, LangGraph, and custom agent frameworks
- **Advanced Features**: Graph memory, async operations, multimodal support, metadata filtering, and reranking

## Core Capabilities

Mem0 delivers production-ready memory management with measurable performance gains:

- **Automatic Memory Extraction**: LLM-powered fact extraction converts conversations into structured, searchable memories
- **Self-Improving Intelligence**: Conflict resolution and memory updates ensure latest information wins
- **Multi-Level Organization**: Scope memories by user_id, agent_id, session_id, or run_id for precise context management
- **Semantic Search**: Natural language queries with vector similarity, metadata filtering, and optional reranking
- **Graph Relationships**: Store entity connections and relationships for multi-hop context recall
- **Performance Excellence**: +26% accuracy over OpenAI Memory, 91% faster responses, 90% lower token usage
- **Platform Flexibility**: Hosted platform with dashboard or self-hosted with complete control
- **Async-First Architecture**: Non-blocking operations for high-throughput production systems

## Beginner Techniques

### Basic Memory Setup (Open Source)

```python
from mem0 import Memory

# Initialize with defaults (OpenAI LLM + embeddings, local Qdrant)
m = Memory()

# Add conversation to memory
messages = [
    {"role": "user", "content": "Hi, I'm Alex. I love basketball and gaming."},
    {"role": "assistant", "content": "Hey Alex! I'll remember your interests."}
]

result = m.add(messages, user_id="alex")
# Result: Automatically extracts facts like "Name is Alex", "Enjoys basketball", "Loves gaming"
```

### Simple Memory Search

```python
# Search memories with natural language
results = m.search("What do you know about me?", user_id="alex")

for memory in results["results"]:
    print(f"Memory: {memory['memory']}")
    print(f"Score: {memory['score']}")
    print(f"Created: {memory['created_at']}")
```

### Platform API Usage

```python
from mem0 import MemoryClient

client = MemoryClient(api_key="your-api-key")

# Add memories
messages = [
    {"role": "user", "content": "I'm planning a trip to Tokyo next month."},
    {"role": "assistant", "content": "Great! I'll remember that for future suggestions."}
]

client.add(messages=messages, user_id="alice")

# Search with filters
results = client.search(
    "What are Alice's travel plans?",
    filters={"user_id": "alice"}
)
```

### List All Memories

```python
# Get all memories for a user
all_memories = m.get_all(user_id="alex")

for memory in all_memories:
    print(memory["memory"])
```

## Intermediate Techniques

### Custom Configuration

```python
from mem0 import Memory

config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {"host": "localhost", "port": 6333}
    },
    "llm": {
        "provider": "openai",
        "config": {"model": "gpt-4.1-mini", "temperature": 0.1}
    },
    "embedder": {
        "provider": "openai",
        "config": {"model": "text-embedding-3-small"}
    },
    "reranker": {
        "provider": "cohere",
        "config": {"model": "rerank-english-v3.0"}
    }
}

memory = Memory.from_config(config)
```

### YAML Configuration

```yaml
# config.yaml
vector_store:
  provider: qdrant
  config:
    host: localhost
    port: 6333

llm:
  provider: azure_openai
  config:
    deployment_name: gpt-4.1-mini

embedder:
  provider: ollama
  config:
    model: nomic-embed-text

reranker:
  provider: cohere
  config:
    model: rerank-english-v3.0
```

```python
from mem0 import Memory

memory = Memory.from_config_file("config.yaml")
```

### Advanced Metadata Filtering

```python
# Platform API: Complex filtering with logical operators
results = client.search(
    "food preferences",
    filters={
        "AND": [
            {"user_id": "alice"},
            {"categories": {"contains": "diet"}},
            {"created_at": {"gte": "2024-07-01", "lte": "2024-12-31"}}
        ]
    }
)

# OSS: Basic field filters
memories = m.search(
    "food preferences",
    user_id="alice",
    filters={"categories": {"contains": "diet"}}
)
```

### Multi-Agent Memory Organization

```python
# Store memories scoped to specific agents and sessions
m.add(
    messages=[{"role": "user", "content": "I prefer vegetarian food"}],
    user_id="alice",
    agent_id="diet-assistant",
    run_id="consultation-001"
)

# Retrieve memories for specific contexts
all_user_memories = m.get_all(user_id="alice")
agent_memories = m.get_all(user_id="alice", agent_id="diet-assistant")
session_memories = m.get_all(user_id="alice", run_id="consultation-001")
```

### Memory Update and Delete

```python
# Update a specific memory
updated = m.update(
    memory_id="mem_123abc",
    data="I prefer Italian cuisine"
)

# Delete a single memory
m.delete(memory_id="mem_123abc")

# Delete all memories for a scope
m.delete_all(user_id="alice", agent_id="diet-assistant")
```

### Memory History Tracking

```python
# Get change history for audit trails
history = m.history(memory_id="mem_123abc")

for change in history:
    print(f"Version: {change['version']}")
    print(f"Updated: {change['updated_at']}")
    print(f"Content: {change['memory']}")
```

## Advanced Techniques

### Graph Memory with Neo4j

Graph memory enables relationship-aware recall by storing entity connections alongside vector embeddings:

```python
import os
from mem0 import Memory

config = {
    "graph_store": {
        "provider": "neo4j",
        "config": {
            "url": os.environ["NEO4J_URL"],
            "username": os.environ["NEO4J_USERNAME"],
            "password": os.environ["NEO4J_PASSWORD"],
            "database": "neo4j"
        }
    }
}

memory = Memory.from_config(config)

# Add conversation with entities and relationships
conversation = [
    {"role": "user", "content": "Alice met Bob at GraphConf 2025 in San Francisco."},
    {"role": "assistant", "content": "Great! Logging that connection."}
]

memory.add(conversation, user_id="demo-user")

# Search returns vector results + graph relationships
results = memory.search(
    "Who did Alice meet at GraphConf?",
    user_id="demo-user",
    limit=3,
    rerank=True
)

# Results include 'relations' array with connected entities
for hit in results["results"]:
    print(f"Memory: {hit['memory']}")
    if "relations" in hit:
        print(f"Related: {hit['relations']}")
```

### Async Memory Operations

Use AsyncMemory for non-blocking operations in FastAPI, background workers, or async frameworks:

```python
import asyncio
from mem0 import AsyncMemory
from openai import AsyncOpenAI

async_memory = AsyncMemory()
async_openai = AsyncOpenAI()

async def chat_with_memories(message: str, user_id: str = "default_user") -> str:
    # Search memories asynchronously
    search_result = await async_memory.search(query=message, user_id=user_id, limit=3)
    relevant_memories = search_result["results"]
    memories_str = "\n".join(f"- {entry['memory']}" for entry in relevant_memories)

    # Generate response with context
    system_prompt = f"You are a helpful AI. Use these memories:\n{memories_str}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message}
    ]

    response = await async_openai.chat.completions.create(
        model="gpt-4.1-nano-2025-04-14",
        messages=messages
    )

    assistant_response = response.choices[0].message.content

    # Store new conversation
    messages.append({"role": "assistant", "content": assistant_response})
    await async_memory.add(messages, user_id=user_id)

    return assistant_response

# Run async function
response = asyncio.run(chat_with_memories("What are my hobbies?", "alex"))
```

### FastAPI Integration

```python
from fastapi import FastAPI, HTTPException
from mem0 import AsyncMemory

app = FastAPI()
memory = AsyncMemory()

@app.post("/memories/")
async def add_memory(messages: list, user_id: str):
    try:
        result = await memory.add(messages=messages, user_id=user_id)
        return {"status": "success", "data": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/memories/search")
async def search_memories(query: str, user_id: str, limit: int = 10):
    try:
        result = await memory.search(query=query, user_id=user_id, limit=limit)
        return {"status": "success", "data": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

### Concurrent Batch Operations

```python
import asyncio
from mem0 import AsyncMemory

async def batch_operations():
    memory = AsyncMemory()

    # Execute multiple operations concurrently
    tasks = [
        memory.add(
            messages=[{"role": "user", "content": f"Message {i}"}],
            user_id=f"user_{i}"
        )
        for i in range(5)
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Task {i} failed: {result}")
        else:
            print(f"Task {i} completed: {result}")
```

### CrewAI Integration

```python
from mem0 import MemoryClient
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool

client = MemoryClient()

# Create agent with memory
search_tool = SerperDevTool()
travel_agent = Agent(
    role="Personalized Travel Planner Agent",
    goal="Plan personalized travel itineraries",
    backstory="You are a seasoned travel planner with attention to detail.",
    allow_delegation=False,
    memory=True,
    tools=[search_tool]
)

# Create task
planning_task = Task(
    description="Find places to live, eat, and visit in San Francisco.",
    expected_output="A detailed list of places in San Francisco.",
    agent=travel_agent
)

# Setup crew with Mem0 integration
crew = Crew(
    agents=[travel_agent],
    tasks=[planning_task],
    process=Process.sequential,
    memory=True,
    memory_config={
        "provider": "mem0",
        "config": {"user_id": "crew_user_1"}
    }
)

result = crew.kickoff()
```

### LangChain Tools Integration

```python
from langchain_core.tools import StructuredTool
from mem0 import MemoryClient
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

client = MemoryClient()

class Message(BaseModel):
    role: str = Field(description="Role of message sender")
    content: str = Field(description="Content of message")

class AddMemoryInput(BaseModel):
    messages: List[Message]
    user_id: str
    metadata: Optional[Dict[str, Any]] = None

def add_memory(messages: List[Message], user_id: str, metadata: Optional[Dict[str, Any]] = None):
    """Add messages to memory with metadata."""
    message_dicts = [msg.dict() for msg in messages]
    return client.add(message_dicts, user_id=user_id, metadata=metadata)

add_tool = StructuredTool(
    name="add_memory",
    description="Add new messages to memory with associated metadata",
    func=add_memory,
    args_schema=AddMemoryInput
)

# Use with any LangChain agent
```

### Custom Fact Extraction

```python
config = {
    "llm": {
        "provider": "openai",
        "config": {
            "model": "gpt-4.1-mini",
            "temperature": 0.1
        }
    },
    "custom_prompt": """
Extract only critical business information from conversations:
- Customer pain points
- Feature requests
- Budget constraints
- Decision makers
- Timeline requirements
"""
}

memory = Memory.from_config(config)
```

### Reranker-Enhanced Search

```python
from mem0 import Memory

config = {
    "reranker": {
        "provider": "cohere",
        "config": {"model": "rerank-english-v3.0"}
    }
}

memory = Memory.from_config(config)

# Search with reranking for improved precision
results = memory.search(
    "What are my dietary restrictions?",
    user_id="alice",
    limit=10,
    rerank=True
)
```

### Multimodal Memory Support

```python
# Store image-based memories
messages = [
    {
        "role": "user",
        "content": [
            {"type": "text", "text": "Here's my favorite artwork"},
            {"type": "image_url", "image_url": {"url": "https://example.com/art.jpg"}}
        ]
    },
    {"role": "assistant", "content": "Beautiful! I'll remember this."}
]

memory.add(messages, user_id="art_collector")
```

## When to Use Mem0

Mem0 excels in scenarios requiring persistent, context-aware AI interactions:

**Ideal Use Cases:**
- **Customer Support Systems**: Maintain conversation history, track open issues, and provide personalized assistance
- **AI Assistants**: Create context-rich conversations that adapt to user preferences over time
- **Multi-Agent Systems**: Share knowledge between specialized agents while maintaining user context
- **Healthcare Applications**: Track patient preferences, history, and care continuity
- **Educational Platforms**: Personalize learning paths based on student progress and preferences
- **Gaming & Interactive Systems**: Create adaptive environments that remember player behavior
- **Productivity Tools**: Build assistants that learn user workflows and preferences

**When Graph Memory Adds Value:**
- Multi-actor conversations requiring entity relationship tracking
- Compliance or auditing needs demanding connection transparency
- Agent teams needing shared context without memory duplication
- Complex domain knowledge with interconnected entities

**When to Use Async Operations:**
- FastAPI or async web services
- High-throughput batch processing
- Background workers processing memory operations
- Applications mixing memory with other async APIs

**Platform vs Self-Hosted Decision:**
- Use **Platform** for: Managed infrastructure, automatic scaling, dashboard visibility, rapid deployment
- Use **Self-Hosted** for: Full infrastructure control, offline requirements, custom provider modifications, strict data sovereignty

## Reference Files

Key documentation locations in the Mem0 resource directory:

**Core Documentation:**
- `resources/agents/mem0/README.md` - Project overview and quick start
- `resources/agents/mem0/docs/open-source/overview.mdx` - Self-hosting overview
- `resources/agents/mem0/docs/open-source/python-quickstart.mdx` - Quick start guide
- `resources/agents/mem0/docs/open-source/configuration.mdx` - Component configuration

**Memory Operations:**
- `resources/agents/mem0/docs/core-concepts/memory-operations/add.mdx` - Adding memories
- `resources/agents/mem0/docs/core-concepts/memory-operations/search.mdx` - Searching memories
- `resources/agents/mem0/docs/api-reference/memory/` - Complete API reference

**Advanced Features:**
- `resources/agents/mem0/docs/open-source/features/graph-memory.mdx` - Graph memory setup
- `resources/agents/mem0/docs/open-source/features/async-memory.mdx` - Async operations
- `resources/agents/mem0/docs/open-source/features/overview.mdx` - All features overview

**Integration Guides:**
- `resources/agents/mem0/docs/integrations/crewai.mdx` - CrewAI integration
- `resources/agents/mem0/docs/integrations/langchain-tools.mdx` - LangChain tools

**Cookbooks & Examples:**
- `resources/agents/mem0/cookbooks/customer-support-chatbot.ipynb` - Support chatbot example
- `resources/agents/mem0/cookbooks/mem0-autogen.ipynb` - AutoGen integration

**Component Configuration:**
- `resources/agents/mem0/docs/components/llms/overview.mdx` - LLM providers
- `resources/agents/mem0/docs/components/embedders/overview.mdx` - Embedder options
- `resources/agents/mem0/docs/components/vectordbs/overview.mdx` - Vector database options
