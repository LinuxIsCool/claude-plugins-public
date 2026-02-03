---
name: letta
description: Agent memory system implementing MemGPT's LLM OS pattern for building stateful agents with persistent self-editing memory
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Letta Mastery

Letta (formerly MemGPT) is a platform for building stateful agents with advanced memory management. It implements the "LLM Operating System" architecture from the MemGPT research paper, enabling agents to maintain persistent state, self-edit their memory, and scale beyond context window limitations through a tiered memory hierarchy.

## Territory Map

Letta's architecture centers on managing agent state and memory across multiple tiers:

- **Core Memory (In-Context)**: Self-editable memory blocks in the LLM's context window
- **Recall Memory**: Message history stored outside the context window, retrieved via semantic search
- **Archival Memory**: Long-term knowledge store for facts, documents, and information
- **Agent State**: Persistent configuration including tools, system prompt, and memory blocks
- **Multi-Agent Architecture**: Shared memory blocks and sleep-time agents for background processing

Key directories in the Letta codebase:
- `/letta/agent.py`: Core Agent class implementing the step-based execution loop
- `/letta/schemas/`: Pydantic models for agents, memory, blocks, messages
- `/letta/functions/function_sets/`: Built-in tool sets (memory tools, multi-agent, files)
- `/letta/memory.py`: Memory management and summarization logic
- `/letta/services/`: Manager classes for agents, blocks, messages, tools

## Core Capabilities

### Memory Hierarchy
- **Block-based core memory**: Self-editable in-context memory organized as labeled blocks
- **Semantic recall**: Search conversation history via hybrid text + embedding search
- **Archival storage**: Long-term memory for facts, documents, and persistent knowledge
- **Memory summarization**: Automatic compression of conversation history when context fills

### Self-Editing Context
- Agents can modify their own memory blocks using memory tools
- Line-numbered editing for precise text replacement (Anthropic models)
- Character limits enforced per block with metadata tracking
- Read-only blocks for system-controlled information

### Stateful Agents
- Full agent state persisted to PostgreSQL or SQLite
- Agent File format (`.af`) for portability between deployments
- Perpetual message history with intelligent windowing
- Resume-able streaming for long-running operations

### Tool Integration
- Model Context Protocol (MCP) client support
- Custom Python tools with automatic schema generation
- Composio integration for third-party actions
- Tool rules for structured multi-step workflows

## Beginner Techniques

### Creating a Basic Agent

```python
from letta_client import Letta
import os

# Connect to Letta (Cloud or self-hosted)
client = Letta(api_key=os.getenv("LETTA_API_KEY"))
# For self-hosted: client = Letta(base_url="http://localhost:8283")

# Create agent with memory blocks
agent_state = client.agents.create(
    model="openai/gpt-4o-mini",
    memory_blocks=[
        {
            "label": "persona",
            "value": "I am a helpful coding assistant specialized in Python."
        },
        {
            "label": "human",
            "value": "The user is learning Python and prefers detailed explanations."
        }
    ],
    tools=["web_search"]
)

print(f"Agent created: {agent_state.id}")
```

### Sending Messages

```python
# Send a message to the agent
response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "Hello! Can you help me understand list comprehensions?"
        }
    ]
)

# Print all messages in response
for message in response.messages:
    if message.role == "assistant":
        # Extract text content
        if message.content and len(message.content) > 0:
            print(f"Assistant: {message.content[0].text}")
```

### Inspecting Agent Memory

```python
# Get current agent state
agent = client.agents.get(agent_id=agent_state.id)

# View memory blocks
for block in agent.memory.blocks:
    print(f"\n{block.label}:")
    print(f"  Value: {block.value}")
    print(f"  Limit: {block.limit} chars")
    print(f"  Current: {len(block.value)} chars")
```

## Intermediate Techniques

### Manual Memory Management

```python
# Get a specific memory block
blocks = client.agents.get(agent_id=agent_state.id).memory.blocks
human_block = next(b for b in blocks if b.label == "human")

# Update memory block directly
from letta_client.types import BlockUpdate

client.blocks.update(
    block_id=human_block.id,
    block_update=BlockUpdate(
        value="The user is an experienced Python developer who prefers concise answers."
    )
)
```

### Archival Memory Usage

When you create an agent, it has built-in archival memory tools that allow it to store and retrieve long-term information:

```python
# The agent can use these tools autonomously in conversation:
response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "Remember that I prefer tabs over spaces for indentation."
        }
    ]
)

# The agent will call archival_memory_insert internally
# Later, when relevant, it can search:
# archival_memory_search(query="indentation preferences")
```

### Conversation Search

```python
# Search across the agent's message history
response = client.agents.messages.create(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "What did we discuss about error handling last week?"
        }
    ]
)

# The agent uses conversation_search tool internally to find relevant messages
```

### Attaching Files and Folders

```python
# Create a folder for the agent to access
folder = client.folders.create(name="documentation")

# Upload files
with open("api_reference.pdf", "rb") as f:
    job = client.folders.files.upload(
        folder_id=folder.id,
        file=f
    )

# Wait for processing
import time
while True:
    job_status = client.jobs.retrieve(job.id)
    if job_status.status == "completed":
        break
    elif job_status.status == "failed":
        raise Exception(f"Job failed: {job_status.metadata}")
    time.sleep(1)

# Attach folder to agent
client.agents.folders.attach(
    agent_id=agent_state.id,
    folder_id=folder.id
)

# Agent can now use file tools: open_file, search_file, grep_file
```

## Advanced Techniques

### Custom Memory Blocks

```python
# Create custom memory blocks for specialized state
agent_state = client.agents.create(
    model="openai/gpt-4o-mini",
    memory_blocks=[
        {
            "label": "persona",
            "value": "I am a project manager tracking multiple initiatives."
        },
        {
            "label": "human",
            "value": "The user is a team lead managing 5 engineers."
        },
        {
            "label": "active_projects",
            "value": "1. API v2 migration\n2. Mobile app redesign\n3. Database optimization",
            "description": "Current projects being tracked"
        },
        {
            "label": "team_members",
            "value": "Alice (backend), Bob (frontend), Carol (DevOps), David (QA), Eve (design)",
            "description": "Team roster and specializations"
        }
    ]
)
```

### Multi-Agent Shared Memory

Create multiple agents that share memory blocks for coordination:

```python
# Create a shared memory block
shared_block = client.blocks.create(
    label="project_status",
    description="Shared project status visible to all agents",
    value="Sprint 12: In progress\nBlockers: None\nNext release: Dec 15"
)

# Create supervisor agent with shared block
supervisor = client.agents.create(
    model="anthropic/claude-3-5-sonnet-20241022",
    memory_blocks=[
        {"label": "persona", "value": "I am the project supervisor"}
    ],
    block_ids=[shared_block.id]  # Attach existing block
)

# Create worker agent with same shared block
worker = client.agents.create(
    model="openai/gpt-4o-mini",
    memory_blocks=[
        {"label": "persona", "value": "I am a development agent"}
    ],
    block_ids=[shared_block.id]  # Both agents see the same block
)

# When either agent edits the shared block, the other sees the changes
```

### Sleep-time Agents

Sleep-time agents run in the background to handle memory management, allowing your primary agent to focus on tasks:

```python
# Enable sleep-time architecture
agent_state = client.agents.create(
    model="openai/gpt-4o-mini",
    memory_blocks=[
        {"label": "persona", "value": "I am a research assistant"},
        {"label": "human", "value": "The user is a PhD student"}
    ],
    enable_sleeptime=True  # Creates a background agent for memory ops
)

# The primary agent focuses on conversation
# The sleep-time agent handles memory editing in the background
```

### Long-Running Operations with Streaming

```python
# For operations that take time (research, analysis, multi-step workflows)
stream = client.agents.messages.create_stream(
    agent_id=agent_state.id,
    messages=[
        {
            "role": "user",
            "content": "Research the top 10 Python frameworks and create a comparison"
        }
    ],
    stream_tokens=True,
    background=True  # Run in background with resumable streaming
)

# Process stream with reconnection support
run_id = None
last_seq_id = None

for chunk in stream:
    if hasattr(chunk, "run_id") and hasattr(chunk, "seq_id"):
        run_id = chunk.run_id
        last_seq_id = chunk.seq_id
    print(chunk)

# If disconnected, resume from last position
if run_id and last_seq_id:
    for chunk in client.runs.stream(run_id, starting_after=last_seq_id):
        print(chunk)
```

### Agent Serialization and Migration

```python
# Export agent to Agent File format (.af)
schema = client.agents.export_agent_serialized(agent_id=agent_state.id)

# Save to file
with open("my_agent.af", "wb") as f:
    f.write(schema)

# Import agent on different deployment
with open("my_agent.af", "rb") as f:
    imported_agent = client.agents.import_agent_serialized(file=f)

print(f"Agent migrated: {imported_agent.id}")
# All memory, tools, and state are preserved
```

### Model Context Protocol (MCP) Integration

```python
# Add tools from an MCP server
tools = client.tools.list_mcp_tools_by_server(
    mcp_server_name="filesystem"
)

# Add specific MCP tool
file_tool = client.tools.add_mcp_tool(
    mcp_server_name="filesystem",
    mcp_tool_name="read_file"
)

# Attach to agent
client.agents.tool.attach(
    agent_id=agent_state.id,
    tool_id=file_tool.id
)
```

### Custom Agent Types

Letta supports different agent architectures:

```python
# React-style agent (no memory tools, pure react loop)
react_agent = client.agents.create(
    model="openai/gpt-4o-mini",
    agent_type="react_agent",
    tools=["web_search", "calculator"]
)

# Workflow agent (auto-clearing message buffer)
workflow_agent = client.agents.create(
    model="openai/gpt-4o-mini",
    agent_type="workflow_agent",
    tools=["send_email", "create_ticket"]
)

# MemGPT v2 agent (enhanced memory management)
memgpt_agent = client.agents.create(
    model="anthropic/claude-3-5-sonnet-20241022",
    agent_type="memgpt_v2_agent",
    memory_blocks=[
        {"label": "persona", "value": "I am a MemGPT agent"},
        {"label": "human", "value": "User preferences"}
    ]
)
```

## When to Use Letta

### Ideal Use Cases

1. **Stateful Conversational Agents**
   - Customer support bots that remember user context across sessions
   - Personal assistants that build knowledge about user preferences
   - Educational tutors that track student progress

2. **Long-Running Research Agents**
   - Information synthesis across multiple documents
   - Continuous monitoring and summarization tasks
   - Multi-step analysis workflows

3. **Multi-Agent Systems**
   - Coordinated teams with shared context
   - Supervisor-worker architectures
   - Distributed task execution with shared memory

4. **Document-Heavy Applications**
   - Legal document analysis with persistent findings
   - Medical record review with tracked observations
   - Code repositories with accumulated knowledge

5. **Personalized AI Applications**
   - Agents that learn user preferences over time
   - Context-aware recommendations
   - Adaptive behavior based on interaction history

### When to Consider Alternatives

1. **Simple Stateless Queries**: For one-off questions without context, a basic LLM API call is simpler
2. **Real-Time Low Latency**: Letta's memory operations add overhead; use simpler architectures for sub-100ms responses
3. **Pure Function Calling**: If you just need structured outputs, OpenAI's function calling is more direct
4. **Batch Processing**: For offline batch jobs, simpler pipeline tools may be more appropriate

## Key Architectural Concepts

### MemGPT LLM OS Pattern

Letta implements the MemGPT paper's core insights:

1. **Tiered Memory Hierarchy**: Like an OS manages RAM and disk, agents manage in-context (fast) and external (large) memory
2. **Self-Editing Context**: Agents control their context window using tools, not passive RAG
3. **Persistent Agent State**: Full serialization enables true continuity across sessions
4. **Agentic Context Engineering**: The agent decides what to remember, not the developer

### Memory Block Architecture

Blocks are the fundamental unit of in-context memory:

```python
# Block structure
{
    "label": "human",              # Identifier for the block
    "value": "User preferences",   # The actual content
    "description": "User info",    # What this block contains
    "limit": 2000,                 # Character limit
    "read_only": False             # Can agent edit this?
}
```

Agents edit blocks using the `memory` tool with operations:
- `create`: Add new memory blocks
- `str_replace`: Replace text within a block
- `insert`: Insert text at specific lines (line-numbered mode)
- `delete`: Remove a memory block
- `rename`: Change block label or description

### Tool Execution Sandbox

Letta provides sandboxed tool execution:
- Python code execution in isolated environments
- Docker-based sandboxing for untrusted code
- E2B integration for cloud sandboxes
- Composio actions for third-party integrations

### Message Flow

1. **User sends message** → Added to in-context message buffer
2. **Agent generates response** → May include tool calls
3. **Tools execute** → Results returned to agent
4. **Context overflow check** → If needed, summarize old messages
5. **Memory operations** → Agent may edit core memory blocks
6. **Response returned** → All state persisted to database

## Reference Files

Key files in the Letta repository to study:

### Core Agent Logic
- `/letta/agent.py`: Main Agent class, step() execution loop
- `/letta/schemas/agent.py`: AgentState definition and agent types
- `/letta/streaming_interface.py`: Streaming response handling

### Memory System
- `/letta/schemas/memory.py`: Memory and Block classes
- `/letta/schemas/block.py`: Block types and validation
- `/letta/memory.py`: Memory summarization logic
- `/letta/functions/function_sets/base.py`: Core memory tools

### Tool System
- `/letta/functions/functions.py`: Tool loading and execution
- `/letta/functions/schema_generator.py`: Automatic schema generation from Python
- `/letta/services/tool_executor/`: Sandboxed tool execution

### Multi-Agent
- `/letta/groups/`: Multi-agent coordination patterns
- `/letta/functions/function_sets/multi_agent.py`: Inter-agent communication tools

### Data Persistence
- `/letta/services/agent_manager.py`: CRUD operations for agents
- `/letta/services/message_manager.py`: Message storage and retrieval
- `/letta/services/block_manager.py`: Memory block persistence

### Client SDKs
- Python: https://github.com/letta-ai/letta-python
- TypeScript: https://github.com/letta-ai/letta-node

### Documentation
- Official Docs: https://docs.letta.com
- MemGPT Paper: https://arxiv.org/abs/2310.08560
- GitHub: https://github.com/letta-ai/letta
