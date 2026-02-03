# Agentmemory Quickstart Cookbook

Basic CRUD operations for agent memory management using the agentmemory library.

## Purpose

Provide a comprehensive guide to the fundamental create, read, update, and delete operations in agentmemory. This cookbook covers the essential patterns for storing and retrieving memories with ChromaDB or PostgreSQL backends.

## Variables

```yaml
DEFAULT_BACKEND: CHROMA
STORAGE_PATH: ./memory
DEFAULT_N_RESULTS: 20
INCLUDE_EMBEDDINGS: true
SORT_ORDER: desc
```

## Instructions

1. Install agentmemory with your preferred backend
2. Configure environment variables if using PostgreSQL
3. Import the required functions
4. Follow the operation patterns below

## Installation

```bash
# Basic installation (ChromaDB backend)
pip install agentmemory

# With PostgreSQL/Supabase backend
pip install agentmemory[supabase]
```

## Environment Configuration

### ChromaDB (Default)

```bash
# Optional: customize storage path
export STORAGE_PATH="./memory"
```

### PostgreSQL

```bash
export CLIENT_TYPE="POSTGRES"
export POSTGRES_CONNECTION_STRING="postgresql://user:pass@host:5432/dbname"
export POSTGRES_MODEL_NAME="all-MiniLM-L6-v2"
export EMBEDDING_WIDTH="384"
```

---

## Create Operations

### Basic Memory Creation

```python
from agentmemory import create_memory

# Create a simple memory
memory_id = create_memory(
    category="notes",
    text="The meeting is scheduled for 3pm tomorrow",
    id="note_001"  # Optional: auto-generated if omitted
)
```

### Memory with Metadata

```python
from agentmemory import create_memory

# Create memory with rich metadata
memory_id = create_memory(
    category="user_preferences",
    text="User prefers dark mode for all interfaces",
    metadata={
        "type": "preference",
        "confidence": 0.95,
        "source": "explicit_statement",
        "user_id": "user_123"
    }
)
```

### Memory with Custom Embedding

```python
from agentmemory import create_memory
import numpy as np

# Create memory with pre-computed embedding
embedding = np.random.rand(384).tolist()  # Your embedding vector

memory_id = create_memory(
    category="documents",
    text="This document contains important information",
    metadata={"doc_type": "report"},
    embedding=embedding
)
```

### Batch Memory Creation

```python
from agentmemory import create_memory

# Create multiple memories
documents = [
    ("Python is a programming language", {"topic": "programming"}),
    ("Machine learning uses statistical methods", {"topic": "ml"}),
    ("Neural networks are inspired by biology", {"topic": "ml"}),
]

for text, metadata in documents:
    create_memory(
        category="facts",
        text=text,
        metadata=metadata
    )
```

---

## Read Operations

### Get Single Memory by ID

```python
from agentmemory import get_memory

# Retrieve a specific memory
memory = get_memory(
    category="notes",
    id="note_001",
    include_embeddings=False  # Faster when embeddings not needed
)

if memory:
    print(f"Text: {memory['document']}")
    print(f"Metadata: {memory['metadata']}")
    print(f"ID: {memory['id']}")
```

### Get All Memories in Category

```python
from agentmemory import get_memories

# Get memories with default settings (descending order, 20 results)
memories = get_memories(category="notes")

# Get memories with custom settings
memories = get_memories(
    category="user_preferences",
    sort_order="asc",
    n_results=50,
    include_embeddings=False
)

for memory in memories:
    print(f"[{memory['id']}] {memory['document']}")
```

### Filter by Metadata

```python
from agentmemory import get_memories

# Filter by single metadata field
memories = get_memories(
    category="facts",
    filter_metadata={"topic": "ml"}
)

# Filter by multiple metadata fields (AND condition)
memories = get_memories(
    category="user_preferences",
    filter_metadata={
        "type": "preference",
        "source": "explicit_statement"
    }
)
```

### Filter by Text Content

```python
from agentmemory import get_memories

# Get memories containing specific text
memories = get_memories(
    category="notes",
    contains_text="meeting"
)
```

### Check Memory Existence

```python
from agentmemory import memory_exists

# Check if specific memory exists
exists = memory_exists(
    category="notes",
    id="note_001"
)

# Check with metadata filter
exists = memory_exists(
    category="user_preferences",
    id="pref_001",
    includes_metadata={"type": "preference"}
)
```

### Count Memories

```python
from agentmemory import count_memories

# Count all memories in category
total = count_memories(category="notes")

# Count only novel memories
novel_count = count_memories(category="facts", novel=True)

print(f"Total: {total}, Novel: {novel_count}")
```

---

## Update Operations

### Update Text Content

```python
from agentmemory import update_memory

# Update the document text (embedding auto-regenerated)
update_memory(
    category="notes",
    id="note_001",
    text="The meeting is rescheduled to 4pm tomorrow"
)
```

### Update Metadata Only

```python
from agentmemory import update_memory

# Update metadata without changing text
update_memory(
    category="notes",
    id="note_001",
    metadata={
        "status": "confirmed",
        "priority": "high"
    }
)
```

### Update Both Text and Metadata

```python
from agentmemory import update_memory

# Full update
update_memory(
    category="user_preferences",
    id="pref_001",
    text="User prefers light mode during day, dark mode at night",
    metadata={
        "type": "preference",
        "confidence": 0.98,
        "updated_reason": "user clarification"
    }
)
```

### Update with Custom Embedding

```python
from agentmemory import update_memory

# Update with pre-computed embedding
update_memory(
    category="documents",
    id="doc_001",
    text="Updated document content",
    embedding=new_embedding_vector
)
```

---

## Delete Operations

### Delete Single Memory

```python
from agentmemory import delete_memory

# Delete by ID
delete_memory(
    category="notes",
    id="note_001"
)
```

### Delete by Document Content

```python
from agentmemory import delete_memories

# Delete memories containing specific text
delete_memories(
    category="notes",
    document="meeting"  # Matches documents containing "meeting"
)
```

### Delete by Metadata

```python
from agentmemory import delete_memories

# Delete memories matching metadata
delete_memories(
    category="user_preferences",
    metadata={"type": "deprecated"}
)
```

### Delete Similar Memories

```python
from agentmemory import delete_similar_memories

# Delete memories similar to given content
deleted = delete_similar_memories(
    category="facts",
    content="Python is a programming language",
    similarity_threshold=0.90  # Delete if >90% similar
)

print(f"Deleted similar memories: {deleted}")
```

### Wipe Category

```python
from agentmemory import wipe_category

# Delete entire category
wipe_category("temporary_notes")
```

### Wipe All Memories

```python
from agentmemory import wipe_all_memories

# Delete everything (use with caution)
wipe_all_memories()
```

---

## Memory Structure Reference

Each memory object contains:

```python
{
    "id": "memory_id_string",
    "document": "The text content of the memory",
    "metadata": {
        "created_at": 1705000000.0,  # Unix timestamp
        "updated_at": 1705000000.0,  # Unix timestamp
        # ... custom metadata fields
    },
    "embedding": [0.1, 0.2, ...],  # Optional: 384-dim vector
    "distance": 0.15  # Only in search results
}
```

---

## Common Patterns

### Initialize and Populate

```python
from agentmemory import create_memory, wipe_category

def initialize_knowledge_base(category, items):
    """Wipe and repopulate a category."""
    wipe_category(category)

    for item in items:
        create_memory(
            category=category,
            text=item["text"],
            metadata=item.get("metadata", {})
        )

# Usage
knowledge = [
    {"text": "Paris is the capital of France", "metadata": {"topic": "geography"}},
    {"text": "The Eiffel Tower is in Paris", "metadata": {"topic": "landmarks"}},
]
initialize_knowledge_base("world_facts", knowledge)
```

### Safe Memory Update

```python
from agentmemory import get_memory, update_memory, create_memory

def upsert_memory(category, id, text, metadata=None):
    """Create or update memory."""
    existing = get_memory(category, id)

    if existing:
        update_memory(category, id, text=text, metadata=metadata)
    else:
        create_memory(category, text, metadata=metadata or {}, id=id)

# Usage
upsert_memory("notes", "daily_001", "Today's summary", {"type": "daily"})
```

### Memory with Automatic Cleanup

```python
from agentmemory import create_memory, get_memories, delete_memory
import time

def create_expiring_memory(category, text, ttl_seconds, metadata=None):
    """Create memory with TTL."""
    metadata = metadata or {}
    metadata["expires_at"] = time.time() + ttl_seconds
    return create_memory(category, text, metadata)

def cleanup_expired(category):
    """Remove expired memories."""
    memories = get_memories(category, n_results=1000)
    now = time.time()

    for memory in memories:
        expires_at = memory["metadata"].get("expires_at")
        if expires_at and float(expires_at) < now:
            delete_memory(category, memory["id"])
```

---

## Error Handling

```python
from agentmemory import get_memory, update_memory

def safe_update(category, id, text=None, metadata=None):
    """Update with existence check."""
    memory = get_memory(category, id)

    if memory is None:
        raise ValueError(f"Memory {id} not found in {category}")

    if text is None and metadata is None:
        raise ValueError("Must provide text or metadata to update")

    update_memory(category, id, text=text, metadata=metadata)
```

---

## Performance Considerations

| Operation | Typical Latency | Notes |
|-----------|-----------------|-------|
| `create_memory` | <10ms | Includes embedding generation |
| `get_memory` | <5ms | Direct ID lookup |
| `get_memories` | <20ms | Depends on n_results |
| `search_memory` | <50ms | For ~1000 documents |
| `update_memory` | <10ms | May regenerate embedding |
| `delete_memory` | <5ms | Single deletion |
| `wipe_category` | <100ms | Bulk operation |

### Optimization Tips

1. **Exclude embeddings** when not needed: `include_embeddings=False`
2. **Limit results** with appropriate `n_results`
3. **Use metadata filters** to reduce search space
4. **Batch operations** for bulk inserts
5. **Pre-compute embeddings** if you have a custom embedding model
