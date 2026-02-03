---
name: agentmemory
description: This skill should be used when the user asks about "agentmemory", "elizaOS memory", "ChromaDB memory", "Postgres vector memory", "semantic memory search", or needs to implement simple vector-based memory with ChromaDB or PostgreSQL backends.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Agentmemory Skill

Provides expertise on the elizaOS/agentmemory library - a Python library for easy-to-use agent memory with semantic search, document storage, and knowledge graphing.

## Overview

Agentmemory is designed for rapid prototyping of intelligent systems with persistent, searchable memory capabilities. It supports two backend options:

- **ChromaDB** (default): Local vector database for rapid prototyping
- **PostgreSQL**: Enterprise deployment via Supabase with pgvector extension

## Core API

### Basic Usage

```python
from agentmemory import create_memory, search_memory, get_memories

# Store a memory
create_memory(
    category="conversation",
    text="User prefers dark mode for all interfaces",
    metadata={"type": "preference", "confidence": 0.9}
)

# Search memories by semantic similarity
results = search_memory(
    category="conversation",
    query="display settings",
    n_results=5
)

# Get all memories in a category
all_memories = get_memories(category="conversation")
```

### Memory Structure

Each memory contains:
- **id**: Unique identifier
- **document**: Text content (embedded for semantic search)
- **metadata**: Key-value pairs for filtering
- **embedding**: Vector representation (optional in results)

### Key Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `create_memory(category, text, metadata)` | Store new memory | Category name, text content, optional metadata |
| `search_memory(category, query, n_results)` | Semantic search | Category, query text, max results |
| `get_memories(category)` | Get all memories | Category name |
| `update_memory(id, text, metadata)` | Update existing | Memory ID, new text/metadata |
| `delete_memory(category, id)` | Delete memory | Category, memory ID |
| `create_unique_memory(category, text, ...)` | Deduplicated insert | Prevents similar duplicates |

### Unique Memory Handling

Prevent duplicates with similarity threshold:

```python
from agentmemory import create_unique_memory

# Only creates if no similar memory exists (threshold 0.0-1.0)
create_unique_memory(
    category="facts",
    text="The capital of France is Paris",
    similarity_threshold=0.85  # Rejects if >85% similar exists
)
```

## Backend Configuration

### ChromaDB (Default)

No configuration needed - works out of the box:

```python
from agentmemory import create_memory
# Uses local ChromaDB storage automatically
```

### PostgreSQL with Supabase

For production deployments:

```python
import os
os.environ['AGENTMEMORY_BACKEND'] = 'supabase'
os.environ['SUPABASE_URL'] = 'https://your-project.supabase.co'
os.environ['SUPABASE_KEY'] = 'your-service-role-key'

from agentmemory import create_memory
# Now uses PostgreSQL with pgvector
```

## Integration Patterns

### With Claude Code

Use agentmemory in hooks for automatic context capture:

```python
# In a PostToolUse hook
from agentmemory import create_memory, search_memory

def capture_tool_use(tool_name, tool_input, tool_response):
    create_memory(
        category="tool_usage",
        text=f"Used {tool_name}: {tool_input}",
        metadata={"tool": tool_name, "timestamp": datetime.now().isoformat()}
    )

def get_relevant_context(prompt):
    memories = search_memory(
        category="tool_usage",
        query=prompt,
        n_results=3
    )
    return "\n".join([m["document"] for m in memories])
```

### With LangChain

```python
from langchain.memory import VectorStoreRetrieverMemory
from agentmemory import get_client

# Use agentmemory's ChromaDB client with LangChain
retriever = get_client().as_retriever()
memory = VectorStoreRetrieverMemory(retriever=retriever)
```

## Performance Characteristics

| Operation | Typical Latency |
|-----------|-----------------|
| `create_memory` | <10ms |
| `search_memory` (1000 docs) | <50ms |
| `get_memories` | <20ms |

## When to Use Agentmemory

**Best for:**
- Rapid prototyping
- Simple semantic search needs
- Single-machine deployments
- Python-first projects

**Consider alternatives for:**
- Multi-hop reasoning → HippoRAG
- Three-tier memory → mem0
- Zero dependencies → domain-memory
- Permanent archival → lumera-memory

## Installation

```bash
pip install agentmemory

# For Supabase backend
pip install agentmemory[supabase]
```

## Additional Resources

### Cookbooks
Comprehensive guides for common use cases:

| Cookbook | Description | Path |
|----------|-------------|------|
| **Quickstart** | Basic CRUD operations | `cookbook/quickstart.md` |
| **Semantic Search** | Advanced search patterns | `cookbook/semantic-search.md` |
| **Conversation Memory** | Storing chat history | `cookbook/conversation-memory.md` |
| **Knowledge Base** | Building a KB with RAG | `cookbook/knowledge-base.md` |
| **Deduplication** | Using create_unique_memory | `cookbook/deduplication.md` |

### Prompt Templates
Templates for LLM-assisted memory operations:

| Template | Description | Path |
|----------|-------------|------|
| **Memory Extraction** | Extract memories from text | `prompts/memory_extraction.md` |
| **Search Query** | Generate optimized queries | `prompts/search_query.md` |

### Tools
Command-line and programmatic interfaces:

| Tool | Description | Path |
|------|-------------|------|
| **CLI Client** | Python CLI for all operations | `tools/agentmemory_client.py` |

### Source Reference
- Source: `/.research/agentmemory/` (cloned locally)
- GitHub: https://github.com/elizaOS/agentmemory

### Related Skills
- `../embeddings/SKILL.md` - Embedding model selection
- `../vector-search/SKILL.md` - Vector database comparisons
