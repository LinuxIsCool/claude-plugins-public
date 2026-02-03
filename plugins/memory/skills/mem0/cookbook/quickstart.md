# mem0 Quickstart Guide

## Purpose

Get started with mem0 for production-grade AI memory operations. This guide covers installation, basic configuration, and the core add/search/update/delete operations.

## Variables

```
INSTALLATION_METHOD: pip | npm
LLM_PROVIDER: openai | anthropic | ollama | together | groq | aws_bedrock
EMBEDDING_PROVIDER: openai | huggingface | ollama | fastembed | vertexai
VECTOR_STORE: qdrant | chroma | pgvector | pinecone | milvus | faiss
DEFAULT_MODEL: gpt-4.1-nano-2025-04-14
```

## Instructions

### 1. Installation

**Python (recommended for backends):**

```bash
pip install mem0ai
```

**JavaScript/Node.js:**

```bash
npm install mem0ai
```

### 2. Environment Setup

Set your LLM API key:

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

For other providers, set the appropriate key:

```bash
export ANTHROPIC_API_KEY="your-anthropic-key"
export MEM0_API_KEY="your-mem0-platform-key"  # For hosted platform
```

### 3. Basic Initialization

**Default (in-memory, OpenAI):**

```python
from mem0 import Memory

# Initialize with defaults (in-memory vector store, OpenAI LLM)
memory = Memory()
```

**With Configuration:**

```python
from mem0 import Memory

config = {
    "llm": {
        "provider": "openai",
        "config": {
            "model": "gpt-4.1-nano-2025-04-14",
            "temperature": 0.0
        }
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "model": "text-embedding-3-small"
        }
    },
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": "localhost",
            "port": 6333,
            "collection_name": "memories"
        }
    }
}

memory = Memory.from_config(config)
```

---

## Core Operations

### Add Memory

Add memories from strings, single messages, or conversation lists.

```python
# From a string (auto-converted to user message)
result = memory.add(
    "I prefer Python over JavaScript for backend development",
    user_id="user"
)
print(result)
# {"results": [{"id": "abc123", "memory": "Prefers Python over JavaScript for backend development", "event": "ADD"}]}

# From a single message dict
result = memory.add(
    {"role": "user", "content": "My birthday is March 15th"},
    user_id="user"
)

# From a conversation list (recommended)
conversation = [
    {"role": "user", "content": "I'm working on a memory plugin for Claude Code"},
    {"role": "assistant", "content": "That sounds interesting! What features are you building?"},
    {"role": "user", "content": "Auto-extraction of user preferences and session context"}
]

result = memory.add(
    conversation,
    user_id="user",
    metadata={"project": "claude-memory-plugin", "timestamp": "2026-01-20"}
)
```

**Result Structure (v1.1 format):**

```python
{
    "results": [
        {
            "id": "mem_abc123",
            "memory": "Working on a memory plugin for Claude Code",
            "event": "ADD"  # ADD | UPDATE | DELETE | NONE
        },
        {
            "id": "mem_def456",
            "memory": "Building auto-extraction of user preferences and session context",
            "event": "ADD"
        }
    ]
}
```

### Search Memory

Search memories using semantic similarity.

```python
# Basic search
results = memory.search(
    query="What programming languages does the user like?",
    user_id="user"
)
print(results)
# {"results": [{"id": "...", "memory": "Prefers Python over JavaScript...", "score": 0.89}]}

# Search with limit
results = memory.search(
    query="user projects",
    user_id="user",
    limit=5
)

# Search within a session
results = memory.search(
    query="display preferences",
    user_id="user",
    session_id="session_123"
)
```

**Search Result Structure:**

```python
{
    "results": [
        {
            "id": "mem_abc123",
            "memory": "Prefers Python over JavaScript for backend development",
            "score": 0.89,
            "metadata": {"project": "claude-memory-plugin"},
            "created_at": "2026-01-20T09:30:00Z",
            "updated_at": "2026-01-20T09:30:00Z"
        }
    ]
}
```

### Get All Memories

Retrieve all memories for a user or session.

```python
# Get all user memories
all_memories = memory.get_all(user_id="user")

# Get all memories for a specific agent
agent_memories = memory.get_all(agent_id="code_reviewer")

# Get with pagination (Platform API only)
# page_memories = client.get_all(user_id="user", page=1, page_size=10)
```

### Get Single Memory

Retrieve a specific memory by ID.

```python
# Get a specific memory
single_memory = memory.get(memory_id="mem_abc123")
```

### Update Memory

Update an existing memory's text content.

```python
# Update memory text
result = memory.update(
    memory_id="mem_abc123",
    data="Prefers Python and Go for backend development"
)
```

### Delete Memory

Delete a specific memory or all memories.

```python
# Delete single memory
memory.delete(memory_id="mem_abc123")

# Delete all memories for a user
memory.delete_all(user_id="user")

# Delete all memories for an agent
memory.delete_all(agent_id="code_reviewer")
```

### Memory History

View the change history of a specific memory.

```python
# Get memory history
history = memory.history(memory_id="mem_abc123")
# Returns list of previous versions with timestamps
```

---

## Complete Chat Example

Integrate memory into a chat application.

```python
from openai import OpenAI
from mem0 import Memory

openai_client = OpenAI()
memory = Memory()

def chat_with_memories(message: str, user_id: str = "default_user") -> str:
    """Chat with memory-augmented context."""

    # 1. Retrieve relevant memories
    relevant_memories = memory.search(query=message, user_id=user_id, limit=3)
    memories_str = "\n".join(
        f"- {entry['memory']}"
        for entry in relevant_memories.get("results", [])
    )

    # 2. Build system prompt with memory context
    system_prompt = f"""You are a helpful AI assistant. Use the following memories about the user to personalize your responses.

User Memories:
{memories_str if memories_str else "No relevant memories found."}

Answer the user's question based on the query and any relevant memories."""

    # 3. Generate response
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message}
    ]
    response = openai_client.chat.completions.create(
        model="gpt-4.1-nano-2025-04-14",
        messages=messages
    )
    assistant_response = response.choices[0].message.content

    # 4. Store conversation in memory for future use
    messages.append({"role": "assistant", "content": assistant_response})
    memory.add(messages, user_id=user_id)

    return assistant_response

# Usage
def main():
    print("Chat with AI (type 'exit' to quit)")
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == 'exit':
            print("Goodbye!")
            break
        response = chat_with_memories(user_input, user_id="demo_user")
        print(f"AI: {response}")

if __name__ == "__main__":
    main()
```

---

## Common Patterns

### Raw Memory Addition (Skip LLM Extraction)

Add memories directly without LLM extraction:

```python
# Add raw memory without fact extraction
result = memory.add(
    "User prefers dark mode interfaces",
    user_id="user",
    infer=False  # Skip LLM extraction, store as-is
)
```

### Custom Metadata

Attach custom metadata to memories:

```python
result = memory.add(
    "User is building a memory plugin",
    user_id="user",
    metadata={
        "source": "conversation",
        "confidence": 0.95,
        "project": "claude-memory-plugin",
        "tags": ["development", "ai", "memory"]
    }
)
```

### Session Scoping

Scope memories to specific sessions:

```python
# Add session-specific memory
memory.add(
    "User wants to discuss API design today",
    user_id="user",
    session_id="session_20260120_morning"
)

# Search within session
results = memory.search(
    query="discussion topics",
    user_id="user",
    session_id="session_20260120_morning"
)
```

---

## Error Handling

```python
from mem0.exceptions import ValidationError

try:
    # At least one of user_id, agent_id, or run_id is required
    result = memory.add("Some memory")  # Will raise error
except ValidationError as e:
    print(f"Validation error: {e.message}")
    print(f"Error code: {e.error_code}")
    print(f"Suggestion: {e.suggestion}")
```

---

## Platform Client (Hosted Service)

For the hosted mem0 platform:

```python
from mem0 import MemoryClient

# Initialize with API key
client = MemoryClient(api_key="your-mem0-api-key")

# Same operations with async support
result = client.add(
    "User prefers Python",
    user_id="user"
)

# Async operations available
import asyncio
from mem0 import AsyncMemoryClient

async def async_example():
    async with AsyncMemoryClient(api_key="your-api-key") as client:
        result = await client.add("Memory content", user_id="user")
        search_results = await client.search("query", user_id="user")
        return search_results

# Run async
results = asyncio.run(async_example())
```

---

## Next Steps

- [Three-Tier Memory](./three-tier-memory.md) - User, session, and agent memory patterns
- [Conversation Extraction](./conversation-extraction.md) - Extract memories from conversations
- [Graph Memory](./graph-memory.md) - Neo4j graph memory for relationships
- [Token Optimization](./token-optimization.md) - Achieve 90% token reduction
