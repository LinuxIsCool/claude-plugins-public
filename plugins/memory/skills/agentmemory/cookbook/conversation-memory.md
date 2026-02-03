# Conversation Memory Cookbook

Patterns for storing and retrieving conversation history using agentmemory.

## Purpose

Provide comprehensive guidance on implementing conversation memory for AI agents, chatbots, and interactive systems. This cookbook covers message storage, context retrieval, conversation summarization, and multi-turn dialogue management.

## Variables

```yaml
CATEGORY_MESSAGES: conversations
CATEGORY_SUMMARIES: conversation_summaries
CATEGORY_TURNS: conversation_turns
MAX_CONTEXT_MESSAGES: 10
SUMMARY_THRESHOLD: 20
CONTEXT_WINDOW_TOKENS: 4000
```

## Instructions

1. Choose an appropriate memory structure for your use case
2. Implement message storage with proper metadata
3. Set up context retrieval for responses
4. Configure summarization for long conversations

---

## Basic Message Storage

### Store Individual Messages

```python
from agentmemory import create_memory
import time
import uuid

def store_message(
    conversation_id: str,
    role: str,  # "user" | "assistant" | "system"
    content: str,
    metadata: dict = None
):
    """Store a single message in conversation memory."""
    msg_metadata = {
        "conversation_id": conversation_id,
        "role": role,
        "timestamp": time.time(),
        "message_index": get_next_message_index(conversation_id)
    }

    if metadata:
        msg_metadata.update(metadata)

    message_id = f"{conversation_id}_{msg_metadata['message_index']:06d}"

    return create_memory(
        category="conversations",
        text=content,
        metadata=msg_metadata,
        id=message_id
    )

def get_next_message_index(conversation_id: str) -> int:
    """Get the next message index for a conversation."""
    from agentmemory import get_memories

    messages = get_memories(
        category="conversations",
        filter_metadata={"conversation_id": conversation_id},
        n_results=1,
        sort_order="desc"
    )

    if not messages:
        return 0

    return int(messages[0]["metadata"].get("message_index", 0)) + 1
```

### Store Conversation Turn

```python
from agentmemory import create_memory
import time

def store_turn(
    conversation_id: str,
    user_message: str,
    assistant_response: str,
    metadata: dict = None
):
    """Store a complete user-assistant turn."""
    turn_metadata = {
        "conversation_id": conversation_id,
        "timestamp": time.time(),
        "turn_index": get_next_turn_index(conversation_id),
        "user_tokens": len(user_message.split()),
        "assistant_tokens": len(assistant_response.split())
    }

    if metadata:
        turn_metadata.update(metadata)

    # Store as combined turn for efficient retrieval
    turn_text = f"User: {user_message}\n\nAssistant: {assistant_response}"

    turn_id = f"{conversation_id}_turn_{turn_metadata['turn_index']:06d}"

    return create_memory(
        category="conversation_turns",
        text=turn_text,
        metadata=turn_metadata,
        id=turn_id
    )

def get_next_turn_index(conversation_id: str) -> int:
    """Get the next turn index for a conversation."""
    from agentmemory import get_memories

    turns = get_memories(
        category="conversation_turns",
        filter_metadata={"conversation_id": conversation_id},
        n_results=1,
        sort_order="desc"
    )

    if not turns:
        return 0

    return int(turns[0]["metadata"].get("turn_index", 0)) + 1
```

---

## Context Retrieval

### Get Recent Messages

```python
from agentmemory import get_memories

def get_recent_messages(
    conversation_id: str,
    n_messages: int = 10,
    roles: list = None
) -> list:
    """Get the most recent messages from a conversation."""
    filter_meta = {"conversation_id": conversation_id}

    if roles:
        # Note: agentmemory doesn't support OR in metadata filters
        # Fetch all and filter in Python
        pass

    messages = get_memories(
        category="conversations",
        filter_metadata=filter_meta,
        n_results=n_messages,
        sort_order="desc",
        include_embeddings=False
    )

    # Reverse to get chronological order
    messages.reverse()

    if roles:
        messages = [m for m in messages if m["metadata"].get("role") in roles]

    return messages

def format_messages_for_prompt(messages: list) -> str:
    """Format messages into a prompt-ready string."""
    formatted = []

    for msg in messages:
        role = msg["metadata"].get("role", "unknown")
        content = msg["document"]

        if role == "user":
            formatted.append(f"User: {content}")
        elif role == "assistant":
            formatted.append(f"Assistant: {content}")
        elif role == "system":
            formatted.append(f"System: {content}")

    return "\n\n".join(formatted)
```

### Semantic Context Retrieval

```python
from agentmemory import search_memory

def get_relevant_context(
    conversation_id: str,
    query: str,
    n_results: int = 5,
    max_distance: float = 0.5
) -> list:
    """Retrieve semantically relevant messages for a query."""
    results = search_memory(
        category="conversations",
        search_text=query,
        n_results=n_results,
        filter_metadata={"conversation_id": conversation_id},
        max_distance=max_distance,
        include_embeddings=False
    )

    return results

def get_relevant_turns(
    conversation_id: str,
    query: str,
    n_results: int = 3
) -> list:
    """Retrieve relevant conversation turns for context."""
    results = search_memory(
        category="conversation_turns",
        search_text=query,
        n_results=n_results,
        filter_metadata={"conversation_id": conversation_id},
        include_embeddings=False
    )

    return results
```

### Hybrid Context (Recent + Relevant)

```python
from agentmemory import get_memories, search_memory

def get_hybrid_context(
    conversation_id: str,
    current_query: str,
    n_recent: int = 5,
    n_relevant: int = 3,
    relevance_threshold: float = 0.4
) -> dict:
    """
    Get both recent messages and semantically relevant past messages.
    Useful for maintaining conversational flow while surfacing relevant history.
    """
    # Recent messages for immediate context
    recent = get_memories(
        category="conversations",
        filter_metadata={"conversation_id": conversation_id},
        n_results=n_recent,
        sort_order="desc",
        include_embeddings=False
    )
    recent.reverse()  # Chronological order

    recent_ids = {m["id"] for m in recent}

    # Relevant messages from history
    relevant = search_memory(
        category="conversations",
        search_text=current_query,
        n_results=n_relevant * 2,  # Over-fetch for deduplication
        filter_metadata={"conversation_id": conversation_id},
        max_distance=1.0 - relevance_threshold,
        include_embeddings=False
    )

    # Deduplicate and limit
    relevant = [r for r in relevant if r["id"] not in recent_ids][:n_relevant]

    return {
        "recent": recent,
        "relevant": relevant,
        "combined": format_hybrid_context(recent, relevant)
    }

def format_hybrid_context(recent: list, relevant: list) -> str:
    """Format hybrid context for prompt injection."""
    parts = []

    if relevant:
        parts.append("=== Relevant Past Context ===")
        for msg in relevant:
            role = msg["metadata"].get("role", "unknown")
            parts.append(f"{role.title()}: {msg['document']}")
        parts.append("")

    if recent:
        parts.append("=== Recent Conversation ===")
        for msg in recent:
            role = msg["metadata"].get("role", "unknown")
            parts.append(f"{role.title()}: {msg['document']}")

    return "\n".join(parts)
```

---

## Conversation Summarization

### Store Summary

```python
from agentmemory import create_memory, get_memories
import time

def store_conversation_summary(
    conversation_id: str,
    summary: str,
    turn_range: tuple,  # (start_turn, end_turn)
    summary_type: str = "rolling"  # "rolling" | "final" | "topic"
):
    """Store a conversation summary."""
    summary_id = f"{conversation_id}_summary_{turn_range[0]}_{turn_range[1]}"

    return create_memory(
        category="conversation_summaries",
        text=summary,
        metadata={
            "conversation_id": conversation_id,
            "summary_type": summary_type,
            "start_turn": turn_range[0],
            "end_turn": turn_range[1],
            "timestamp": time.time()
        },
        id=summary_id
    )

def get_conversation_summaries(
    conversation_id: str,
    summary_type: str = None
) -> list:
    """Retrieve summaries for a conversation."""
    filter_meta = {"conversation_id": conversation_id}

    if summary_type:
        filter_meta["summary_type"] = summary_type

    return get_memories(
        category="conversation_summaries",
        filter_metadata=filter_meta,
        sort_order="asc",
        include_embeddings=False
    )
```

### Rolling Summarization

```python
from agentmemory import get_memories, create_memory

def should_summarize(conversation_id: str, threshold: int = 20) -> bool:
    """Check if conversation needs summarization."""
    turns = get_memories(
        category="conversation_turns",
        filter_metadata={"conversation_id": conversation_id},
        n_results=1000,
        include_embeddings=False
    )

    summaries = get_memories(
        category="conversation_summaries",
        filter_metadata={"conversation_id": conversation_id},
        n_results=1000,
        include_embeddings=False
    )

    # Get last summarized turn
    last_summarized = 0
    for summary in summaries:
        end_turn = summary["metadata"].get("end_turn", 0)
        last_summarized = max(last_summarized, end_turn)

    unsummarized_count = sum(
        1 for t in turns
        if t["metadata"].get("turn_index", 0) > last_summarized
    )

    return unsummarized_count >= threshold

def get_turns_for_summarization(
    conversation_id: str,
    start_turn: int = 0,
    max_turns: int = 20
) -> list:
    """Get turns that need summarization."""
    all_turns = get_memories(
        category="conversation_turns",
        filter_metadata={"conversation_id": conversation_id},
        n_results=1000,
        sort_order="asc",
        include_embeddings=False
    )

    return [
        t for t in all_turns
        if t["metadata"].get("turn_index", 0) >= start_turn
    ][:max_turns]

def create_rolling_summary(
    conversation_id: str,
    summarize_fn,  # Function that takes text and returns summary
    batch_size: int = 10
):
    """Create rolling summaries for a conversation."""
    # Get last summarized turn
    summaries = get_memories(
        category="conversation_summaries",
        filter_metadata={
            "conversation_id": conversation_id,
            "summary_type": "rolling"
        },
        n_results=1,
        sort_order="desc"
    )

    start_turn = 0
    if summaries:
        start_turn = summaries[0]["metadata"].get("end_turn", 0) + 1

    # Get turns to summarize
    turns = get_turns_for_summarization(
        conversation_id,
        start_turn=start_turn,
        max_turns=batch_size
    )

    if not turns:
        return None

    # Combine turn texts
    turns_text = "\n\n".join([t["document"] for t in turns])

    # Generate summary
    summary_text = summarize_fn(turns_text)

    # Store summary
    end_turn = max(t["metadata"].get("turn_index", 0) for t in turns)

    return store_conversation_summary(
        conversation_id=conversation_id,
        summary=summary_text,
        turn_range=(start_turn, end_turn),
        summary_type="rolling"
    )
```

---

## Multi-Conversation Management

### Conversation Registry

```python
from agentmemory import create_memory, get_memories, search_memory
import time
import uuid

def create_conversation(
    user_id: str = None,
    title: str = None,
    metadata: dict = None
) -> str:
    """Create a new conversation and return its ID."""
    conversation_id = str(uuid.uuid4())[:8]

    conv_metadata = {
        "conversation_id": conversation_id,
        "created_at": time.time(),
        "updated_at": time.time(),
        "message_count": 0,
        "status": "active"
    }

    if user_id:
        conv_metadata["user_id"] = user_id

    if metadata:
        conv_metadata.update(metadata)

    # Store conversation record
    create_memory(
        category="conversation_registry",
        text=title or f"Conversation {conversation_id}",
        metadata=conv_metadata,
        id=conversation_id
    )

    return conversation_id

def get_user_conversations(
    user_id: str,
    status: str = None,
    n_results: int = 20
) -> list:
    """Get all conversations for a user."""
    filter_meta = {"user_id": user_id}

    if status:
        filter_meta["status"] = status

    return get_memories(
        category="conversation_registry",
        filter_metadata=filter_meta,
        n_results=n_results,
        sort_order="desc",
        include_embeddings=False
    )

def search_conversations(
    user_id: str,
    query: str,
    n_results: int = 5
) -> list:
    """Search across all user conversations."""
    # Search in conversation turns
    results = search_memory(
        category="conversation_turns",
        search_text=query,
        n_results=n_results * 2,
        include_embeddings=False
    )

    # Get unique conversation IDs
    conv_ids = set()
    filtered_results = []

    for result in results:
        conv_id = result["metadata"].get("conversation_id")
        if conv_id and conv_id not in conv_ids:
            conv_ids.add(conv_id)
            filtered_results.append(result)

            if len(filtered_results) >= n_results:
                break

    return filtered_results
```

### Conversation State Management

```python
from agentmemory import get_memory, update_memory
import time

def update_conversation_state(
    conversation_id: str,
    increment_messages: bool = False,
    status: str = None,
    custom_metadata: dict = None
):
    """Update conversation metadata."""
    conv = get_memory("conversation_registry", conversation_id)

    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found")

    new_metadata = conv["metadata"].copy()
    new_metadata["updated_at"] = time.time()

    if increment_messages:
        new_metadata["message_count"] = new_metadata.get("message_count", 0) + 1

    if status:
        new_metadata["status"] = status

    if custom_metadata:
        new_metadata.update(custom_metadata)

    update_memory(
        category="conversation_registry",
        id=conversation_id,
        metadata=new_metadata
    )

def close_conversation(conversation_id: str, final_summary: str = None):
    """Mark conversation as closed and optionally store final summary."""
    update_conversation_state(
        conversation_id,
        status="closed"
    )

    if final_summary:
        # Get turn count
        from agentmemory import get_memories

        turns = get_memories(
            category="conversation_turns",
            filter_metadata={"conversation_id": conversation_id},
            n_results=1,
            sort_order="desc"
        )

        end_turn = 0
        if turns:
            end_turn = turns[0]["metadata"].get("turn_index", 0)

        store_conversation_summary(
            conversation_id=conversation_id,
            summary=final_summary,
            turn_range=(0, end_turn),
            summary_type="final"
        )
```

---

## Context Window Management

### Token-Aware Context Selection

```python
from agentmemory import get_memories

def estimate_tokens(text: str) -> int:
    """Rough token estimation (words * 1.3)."""
    return int(len(text.split()) * 1.3)

def get_context_within_limit(
    conversation_id: str,
    token_limit: int = 4000,
    include_summaries: bool = True
) -> dict:
    """Get as much context as possible within token limit."""
    result = {
        "summaries": [],
        "recent_turns": [],
        "total_tokens": 0
    }

    remaining_tokens = token_limit

    # First, include summaries (most compressed form)
    if include_summaries:
        summaries = get_memories(
            category="conversation_summaries",
            filter_metadata={"conversation_id": conversation_id},
            sort_order="asc",
            include_embeddings=False
        )

        for summary in summaries:
            tokens = estimate_tokens(summary["document"])
            if tokens <= remaining_tokens:
                result["summaries"].append(summary)
                remaining_tokens -= tokens

    # Then, add recent turns
    turns = get_memories(
        category="conversation_turns",
        filter_metadata={"conversation_id": conversation_id},
        n_results=100,
        sort_order="desc",
        include_embeddings=False
    )

    for turn in turns:
        tokens = estimate_tokens(turn["document"])
        if tokens <= remaining_tokens:
            result["recent_turns"].insert(0, turn)  # Maintain order
            remaining_tokens -= tokens
        else:
            break

    result["total_tokens"] = token_limit - remaining_tokens
    return result

def format_bounded_context(context: dict) -> str:
    """Format token-bounded context for prompt."""
    parts = []

    if context["summaries"]:
        parts.append("=== Conversation Summary ===")
        for s in context["summaries"]:
            parts.append(s["document"])
        parts.append("")

    if context["recent_turns"]:
        parts.append("=== Recent Exchange ===")
        for t in context["recent_turns"]:
            parts.append(t["document"])

    return "\n".join(parts)
```

---

## Event-Based Memory

### Track Conversation Events

```python
from agentmemory import create_event, get_events
import time

def log_conversation_event(
    conversation_id: str,
    event_type: str,
    details: str,
    metadata: dict = None
):
    """Log an event related to a conversation."""
    event_metadata = {
        "conversation_id": conversation_id,
        "event_type": event_type,
        "timestamp": time.time()
    }

    if metadata:
        event_metadata.update(metadata)

    return create_event(
        text=details,
        metadata=event_metadata
    )

def get_conversation_events(
    conversation_id: str,
    event_type: str = None,
    n_results: int = 50
) -> list:
    """Get events for a conversation."""
    filter_meta = {"conversation_id": conversation_id}

    if event_type:
        filter_meta["event_type"] = event_type

    return get_events(
        filter_metadata=filter_meta,
        n_results=n_results
    )

# Usage examples
log_conversation_event(
    "conv_001",
    "topic_change",
    "User shifted from billing questions to technical support"
)

log_conversation_event(
    "conv_001",
    "sentiment_shift",
    "User sentiment changed from frustrated to satisfied",
    metadata={"sentiment_score": 0.8}
)
```

---

## Complete Conversation Agent

```python
from agentmemory import (
    create_memory, get_memories, search_memory,
    update_memory, delete_memory
)
import time
import uuid

class ConversationMemory:
    """Complete conversation memory management."""

    def __init__(self, conversation_id: str = None, user_id: str = None):
        self.conversation_id = conversation_id or str(uuid.uuid4())[:8]
        self.user_id = user_id
        self._initialize_conversation()

    def _initialize_conversation(self):
        """Initialize conversation if new."""
        from agentmemory import get_memory

        existing = get_memory("conversation_registry", self.conversation_id)

        if not existing:
            metadata = {
                "conversation_id": self.conversation_id,
                "created_at": time.time(),
                "updated_at": time.time(),
                "message_count": 0,
                "turn_count": 0,
                "status": "active"
            }

            if self.user_id:
                metadata["user_id"] = self.user_id

            create_memory(
                category="conversation_registry",
                text=f"Conversation {self.conversation_id}",
                metadata=metadata,
                id=self.conversation_id
            )

    def add_message(self, role: str, content: str, metadata: dict = None):
        """Add a message to the conversation."""
        msg_count = self._get_message_count()

        msg_metadata = {
            "conversation_id": self.conversation_id,
            "role": role,
            "timestamp": time.time(),
            "message_index": msg_count
        }

        if metadata:
            msg_metadata.update(metadata)

        message_id = f"{self.conversation_id}_{msg_count:06d}"

        create_memory(
            category="conversations",
            text=content,
            metadata=msg_metadata,
            id=message_id
        )

        self._update_message_count(msg_count + 1)
        return message_id

    def add_turn(self, user_message: str, assistant_response: str):
        """Add a complete turn to the conversation."""
        turn_count = self._get_turn_count()

        turn_text = f"User: {user_message}\n\nAssistant: {assistant_response}"

        turn_metadata = {
            "conversation_id": self.conversation_id,
            "turn_index": turn_count,
            "timestamp": time.time()
        }

        turn_id = f"{self.conversation_id}_turn_{turn_count:06d}"

        create_memory(
            category="conversation_turns",
            text=turn_text,
            metadata=turn_metadata,
            id=turn_id
        )

        self._update_turn_count(turn_count + 1)
        return turn_id

    def get_context(
        self,
        current_query: str = None,
        n_recent: int = 5,
        n_relevant: int = 3,
        token_limit: int = None
    ) -> str:
        """Get conversation context for response generation."""
        # Get recent messages
        recent = get_memories(
            category="conversation_turns",
            filter_metadata={"conversation_id": self.conversation_id},
            n_results=n_recent,
            sort_order="desc",
            include_embeddings=False
        )
        recent.reverse()

        # Get relevant context if query provided
        relevant = []
        if current_query:
            recent_ids = {m["id"] for m in recent}
            all_relevant = search_memory(
                category="conversation_turns",
                search_text=current_query,
                n_results=n_relevant * 2,
                filter_metadata={"conversation_id": self.conversation_id},
                include_embeddings=False
            )
            relevant = [r for r in all_relevant if r["id"] not in recent_ids][:n_relevant]

        # Format context
        parts = []

        if relevant:
            parts.append("=== Relevant History ===")
            for r in relevant:
                parts.append(r["document"])
            parts.append("")

        if recent:
            parts.append("=== Recent Conversation ===")
            for r in recent:
                parts.append(r["document"])

        context = "\n".join(parts)

        # Truncate if needed
        if token_limit:
            words = context.split()
            max_words = int(token_limit / 1.3)
            if len(words) > max_words:
                context = " ".join(words[:max_words]) + "..."

        return context

    def search(self, query: str, n_results: int = 5) -> list:
        """Search conversation history."""
        return search_memory(
            category="conversation_turns",
            search_text=query,
            n_results=n_results,
            filter_metadata={"conversation_id": self.conversation_id},
            include_embeddings=False
        )

    def _get_message_count(self) -> int:
        from agentmemory import get_memory

        conv = get_memory("conversation_registry", self.conversation_id)
        return conv["metadata"].get("message_count", 0) if conv else 0

    def _get_turn_count(self) -> int:
        from agentmemory import get_memory

        conv = get_memory("conversation_registry", self.conversation_id)
        return conv["metadata"].get("turn_count", 0) if conv else 0

    def _update_message_count(self, count: int):
        from agentmemory import get_memory

        conv = get_memory("conversation_registry", self.conversation_id)
        if conv:
            metadata = conv["metadata"].copy()
            metadata["message_count"] = count
            metadata["updated_at"] = time.time()
            update_memory("conversation_registry", self.conversation_id, metadata=metadata)

    def _update_turn_count(self, count: int):
        from agentmemory import get_memory

        conv = get_memory("conversation_registry", self.conversation_id)
        if conv:
            metadata = conv["metadata"].copy()
            metadata["turn_count"] = count
            metadata["updated_at"] = time.time()
            update_memory("conversation_registry", self.conversation_id, metadata=metadata)


# Usage
memory = ConversationMemory(user_id="user_123")

# Add turns as conversation progresses
memory.add_turn(
    "What's the weather like?",
    "I don't have access to real-time weather data."
)

memory.add_turn(
    "Can you help me with Python?",
    "Of course! What would you like help with?"
)

# Get context for next response
context = memory.get_context(
    current_query="How do I read a file?",
    n_recent=3,
    n_relevant=2
)

# Search history
results = memory.search("Python")
```
