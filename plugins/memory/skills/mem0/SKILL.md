---
name: mem0
description: This skill should be used when the user asks about "mem0", "memory layer", "user session agent memory", "three-tier memory", "token reduction", "memory extraction", or needs a production-grade memory system with 90% token reduction and 26% accuracy improvement.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# mem0 Skill

Provides expertise on mem0 - a universal memory layer for AI agents that implements multi-level memory structure with significant performance improvements over baseline approaches.

## Overview

mem0 functions as an intelligent memory system that operates across three dimensions:

| Level | Purpose | Persistence |
|-------|---------|-------------|
| **User-level** | Preferences, historical context | Permanent |
| **Session-level** | Conversation-specific information | Session-scoped |
| **Agent-level** | Operational context for autonomous systems | Task-scoped |

## Performance Claims

Verified benchmarks from mem0:
- **26% higher accuracy** compared to OpenAI's memory on LOCOMO benchmarks
- **91% faster response times** versus full-context processing
- **90% reduction in token consumption** relative to full-context approaches

## Core API

### Basic Usage

```python
from mem0 import Memory

# Initialize memory
m = Memory()

# Add memory with user context
m.add(
    "User is working on a memory plugin for Claude Code",
    user_id="user",
    metadata={"project": "memory-plugin", "timestamp": "2026-01-20"}
)

# Search memories
results = m.search(
    "what is the user working on",
    user_id="user"
)

# Get all user memories
all_memories = m.get_all(user_id="user")
```

### Memory with Session Context

```python
# Session-scoped memory
m.add(
    "User wants dark mode enabled",
    user_id="user",
    session_id="session_123"
)

# Search within session
results = m.search(
    "display preferences",
    user_id="user",
    session_id="session_123"
)
```

### Agent-level Memory

```python
# For autonomous agent state
m.add(
    "Agent completed code review task",
    agent_id="code_reviewer",
    metadata={"status": "completed", "files_reviewed": 5}
)
```

## Memory Extraction

mem0 automatically extracts structured memories from conversations:

```python
# Conversation processing
conversation = [
    {"role": "user", "content": "My name is Shawn and I prefer Python"},
    {"role": "assistant", "content": "Nice to meet you Shawn!"}
]

# Extract and store memories automatically
m.add(conversation, user_id="user")

# Creates memories like:
# - "User's name is Shawn"
# - "User prefers Python programming language"
```

## Configuration

### Vector Store Options

```python
from mem0 import Memory

# Default (in-memory)
m = Memory()

# With Qdrant
m = Memory(vector_store={
    "provider": "qdrant",
    "config": {"host": "localhost", "port": 6333}
})

# With ChromaDB
m = Memory(vector_store={
    "provider": "chroma",
    "config": {"path": "./chroma_db"}
})
```

### LLM Configuration

```python
m = Memory(llm={
    "provider": "openai",
    "config": {"model": "gpt-4o-mini"}
})

# Or with local model
m = Memory(llm={
    "provider": "ollama",
    "config": {"model": "llama3.2"}
})
```

## Integration with Claude Code

### Memory Hook Pattern

```python
# UserPromptSubmit hook
from mem0 import Memory

m = Memory()

def inject_memory_context(prompt, user_id, session_id):
    # Search relevant memories
    results = m.search(prompt, user_id=user_id, limit=3)

    if results:
        context = "[MEMORY CONTEXT]\n"
        for mem in results:
            context += f"- {mem['memory']}\n"
        context += "[END MEMORY]\n"
        return context
    return ""
```

### Conversation Capture

```python
# Stop hook for memory extraction
def capture_conversation(transcript_path, user_id, session_id):
    conversation = load_conversation(transcript_path)
    m.add(conversation, user_id=user_id, session_id=session_id)
```

## Memory Graph Capabilities

mem0 supports graph-based memory for relationships:

```python
from mem0 import Memory

m = Memory(graph_store={
    "provider": "neo4j",
    "config": {
        "url": "bolt://localhost:7687",
        "username": "neo4j",
        "password": "password"
    }
})

# Memories now stored with relationship awareness
m.add("John works with Alice on the memory project", user_id="user")
# Creates: (Shawn) -[works_with]-> (Alice) -[on]-> (memory project)
```

## When to Use mem0

**Best for:**
- Production applications requiring proven accuracy
- Multi-user systems with user-specific context
- Token-constrained environments (90% reduction)
- Applications needing conversation extraction

**Consider alternatives for:**
- Simple prototyping → agentmemory
- Multi-hop reasoning → HippoRAG
- Zero dependencies → domain-memory
- Claude Code-specific patterns → claude-mem

## SDK Options

| SDK | Installation | Use Case |
|-----|--------------|----------|
| Python | `pip install mem0ai` | Backend services |
| JavaScript | `npm install mem0ai` | Frontend/Node.js |
| REST API | Hosted service | Any language |

## Cookbook

Detailed guides for specific use cases:

| Guide | Description | File |
|-------|-------------|------|
| **Quickstart** | Basic add/search operations | `cookbook/quickstart.md` |
| **Three-Tier Memory** | User/session/agent memory patterns | `cookbook/three-tier-memory.md` |
| **Conversation Extraction** | Extracting memories from conversations | `cookbook/conversation-extraction.md` |
| **Graph Memory** | Neo4j graph memory for relationships | `cookbook/graph-memory.md` |
| **Token Optimization** | Achieving 90% token reduction | `cookbook/token-optimization.md` |

## Prompts

Production-ready prompts used by mem0:

| Prompt | Purpose | File |
|--------|---------|------|
| **User Memory Extraction** | Extract facts about the user | `prompts/user_memory_extraction.md` |
| **Agent Memory Extraction** | Extract facts about the assistant | `prompts/agent_memory_extraction.md` |
| **Update Memory** | ADD/UPDATE/DELETE decision logic | `prompts/update_memory.md` |

## Tools

Python wrapper for mem0 operations:

| Tool | Purpose | File |
|------|---------|------|
| **mem0_client.py** | Production-ready client wrapper | `tools/mem0_client.py` |

Features:
- Three-tier memory support (user, session, agent)
- Context injection for LLM prompts
- Token budget management
- Session management
- Error handling and logging

## Additional Resources

### Repository
- Source: `/resources/agents/mem0/` (cloned locally)
- GitHub: https://github.com/mem0ai/mem0
- Docs: https://docs.mem0.ai

### Related Skills
- `../memory-architecture/SKILL.md` - Three-tier design patterns
- `../embeddings/SKILL.md` - Embedding configurations
