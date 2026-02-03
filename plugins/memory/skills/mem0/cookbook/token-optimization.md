# Token Optimization with mem0

## Purpose

Achieve the 90% token reduction that mem0 provides over full-context approaches. This guide covers memory-based context injection, relevance filtering, summarization strategies, and cost-efficient architectures.

## Variables

```
TOKEN_REDUCTION_TARGET: 90%
LATENCY_IMPROVEMENT: 91% faster
ACCURACY_IMPROVEMENT: 26% higher than OpenAI Memory
CONTEXT_LIMIT_STRATEGY: selective_injection | summarization | hybrid
```

## Instructions

### The Token Problem

Full-context approaches include the entire conversation history with each request:

| Approach | 10 Turns | 50 Turns | 100 Turns |
|----------|----------|----------|-----------|
| Full Context | ~5K tokens | ~25K tokens | ~50K tokens |
| mem0 Memory | ~500 tokens | ~500 tokens | ~500 tokens |

mem0 maintains **constant token usage** regardless of conversation length.

---

## Memory-Based Context Injection

Replace full conversation history with relevant memory snippets.

### Basic Pattern

```python
from mem0 import Memory
from openai import OpenAI

memory = Memory()
openai_client = OpenAI()

def chat_with_memory_context(
    message: str,
    user_id: str,
    memory_limit: int = 3,
    max_memory_tokens: int = 500
) -> str:
    """Chat using memory context instead of full history."""

    # 1. Retrieve relevant memories (constant token cost)
    relevant_memories = memory.search(
        query=message,
        user_id=user_id,
        limit=memory_limit
    )

    # 2. Build context from memories
    memories_text = "\n".join(
        f"- {m['memory']}"
        for m in relevant_memories.get("results", [])
    )

    # 3. Create minimal prompt with memory context
    system_prompt = f"""You are a helpful AI assistant with memory of past interactions.

Relevant context about the user:
{memories_text if memories_text else "No specific context available."}

Use this context to personalize your response. Be concise and helpful."""

    # 4. Generate response (minimal token usage)
    response = openai_client.chat.completions.create(
        model="gpt-4.1-nano-2025-04-14",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ],
        max_tokens=500
    )

    assistant_response = response.choices[0].message.content

    # 5. Store this exchange for future reference
    memory.add(
        [
            {"role": "user", "content": message},
            {"role": "assistant", "content": assistant_response}
        ],
        user_id=user_id
    )

    return assistant_response
```

### Token Usage Comparison

```python
def calculate_tokens(text: str) -> int:
    """Rough token estimate (1 token ~ 4 chars for English)."""
    return len(text) // 4

# Full context approach
full_history = [
    {"role": "user", "content": "message 1..."},
    {"role": "assistant", "content": "response 1..."},
    # ... 50 exchanges
]
full_context_tokens = sum(calculate_tokens(m["content"]) for m in full_history)
# Result: ~25,000 tokens

# Memory approach
memories = memory.search(query="current question", user_id="user", limit=3)
memory_tokens = sum(calculate_tokens(m["memory"]) for m in memories.get("results", []))
# Result: ~300-500 tokens

# Reduction: 98% fewer tokens
```

---

## Context Injection Strategies

### Strategy 1: Top-K Relevant Memories

Select the top K most relevant memories.

```python
def get_topk_context(memory: Memory, query: str, user_id: str, k: int = 3) -> str:
    """Get top-K most relevant memories."""
    results = memory.search(query=query, user_id=user_id, limit=k)

    if not results.get("results"):
        return ""

    return "\n".join(f"- {m['memory']}" for m in results["results"])

# Usage
context = get_topk_context(memory, "What programming language should I use?", "user", k=5)
```

### Strategy 2: Category-Based Context

Retrieve memories from specific categories.

```python
def get_categorized_context(
    memory: Memory,
    query: str,
    user_id: str,
    categories: list = None
) -> dict:
    """Get context organized by category."""
    categories = categories or ["preferences", "projects", "skills"]
    context = {}

    for category in categories:
        # Search with category-specific queries
        category_query = f"{category}: {query}"
        results = memory.search(
            query=category_query,
            user_id=user_id,
            limit=2
        )
        context[category] = results.get("results", [])

    return context

def format_categorized_context(context: dict) -> str:
    """Format categorized context for prompt."""
    sections = []
    for category, memories in context.items():
        if memories:
            memory_text = "\n".join(f"  - {m['memory']}" for m in memories)
            sections.append(f"### {category.title()}\n{memory_text}")

    return "\n\n".join(sections)
```

### Strategy 3: Tiered Context (User + Session)

Combine user-level and session-level context.

```python
def get_tiered_context(
    memory: Memory,
    query: str,
    user_id: str,
    session_id: str = None,
    user_limit: int = 2,
    session_limit: int = 3
) -> str:
    """Get context from both user and session levels."""

    # User-level: stable, long-term context
    user_results = memory.search(
        query=query,
        user_id=user_id,
        limit=user_limit
    )

    context_parts = []

    if user_results.get("results"):
        user_text = "\n".join(f"- {m['memory']}" for m in user_results["results"])
        context_parts.append(f"## User Profile\n{user_text}")

    # Session-level: current conversation context
    if session_id:
        session_results = memory.search(
            query=query,
            user_id=user_id,
            session_id=session_id,
            limit=session_limit
        )

        if session_results.get("results"):
            session_text = "\n".join(f"- {m['memory']}" for m in session_results["results"])
            context_parts.append(f"## Current Session\n{session_text}")

    return "\n\n".join(context_parts)
```

---

## Relevance Filtering

Improve context quality by filtering low-relevance memories.

### Score-Based Filtering

```python
def get_high_relevance_context(
    memory: Memory,
    query: str,
    user_id: str,
    min_score: float = 0.7,
    max_results: int = 5
) -> list:
    """Get only memories above a relevance threshold."""

    results = memory.search(
        query=query,
        user_id=user_id,
        limit=max_results * 2  # Fetch extra to filter
    )

    # Filter by score
    high_relevance = [
        m for m in results.get("results", [])
        if m.get("score", 0) >= min_score
    ]

    return high_relevance[:max_results]
```

### Recency-Weighted Filtering

```python
from datetime import datetime, timedelta

def get_recent_relevant_context(
    memory: Memory,
    query: str,
    user_id: str,
    recency_weight: float = 0.3,
    max_age_days: int = 30
) -> list:
    """Weight memories by both relevance and recency."""

    results = memory.search(query=query, user_id=user_id, limit=10)
    memories = results.get("results", [])

    now = datetime.now()
    scored_memories = []

    for m in memories:
        # Get base relevance score
        relevance = m.get("score", 0.5)

        # Calculate recency score
        created_at = m.get("created_at")
        if created_at:
            age = (now - datetime.fromisoformat(created_at.replace("Z", ""))).days
            recency = max(0, 1 - (age / max_age_days))
        else:
            recency = 0.5

        # Combined score
        combined = (1 - recency_weight) * relevance + recency_weight * recency
        scored_memories.append((combined, m))

    # Sort by combined score
    scored_memories.sort(key=lambda x: x[0], reverse=True)

    return [m for _, m in scored_memories[:5]]
```

---

## Token Budget Management

Ensure memory context stays within token limits.

### Hard Token Limit

```python
def get_context_within_budget(
    memory: Memory,
    query: str,
    user_id: str,
    token_budget: int = 500,
    chars_per_token: int = 4
) -> str:
    """Get as many relevant memories as fit within token budget."""

    results = memory.search(query=query, user_id=user_id, limit=10)
    memories = results.get("results", [])

    context_parts = []
    used_chars = 0
    char_budget = token_budget * chars_per_token

    for m in memories:
        memory_text = f"- {m['memory']}"
        memory_chars = len(memory_text)

        if used_chars + memory_chars <= char_budget:
            context_parts.append(memory_text)
            used_chars += memory_chars
        else:
            break

    return "\n".join(context_parts)
```

### Dynamic Budget Allocation

```python
class TokenBudgetManager:
    """Manage token budgets across context components."""

    def __init__(self, total_budget: int = 4000):
        self.total_budget = total_budget
        self.allocations = {
            "system_prompt": 0.15,   # 15% for instructions
            "memory_context": 0.25,  # 25% for memories
            "user_input": 0.20,      # 20% for user message
            "response": 0.40         # 40% for response
        }

    def get_memory_budget(self) -> int:
        return int(self.total_budget * self.allocations["memory_context"])

    def get_response_budget(self) -> int:
        return int(self.total_budget * self.allocations["response"])

    def allocate(self, component: str) -> int:
        return int(self.total_budget * self.allocations.get(component, 0))

# Usage
budget = TokenBudgetManager(total_budget=4000)
memory_context = get_context_within_budget(
    memory, query, user_id,
    token_budget=budget.get_memory_budget()
)
```

---

## Compression Techniques

### Memory Summarization

Summarize multiple memories into a compact form.

```python
from openai import OpenAI

def summarize_memories(
    memories: list,
    max_tokens: int = 200,
    openai_client: OpenAI = None
) -> str:
    """Summarize multiple memories into a compact context."""

    if not memories:
        return ""

    openai_client = openai_client or OpenAI()

    # Format memories for summarization
    memories_text = "\n".join(f"- {m['memory']}" for m in memories)

    response = openai_client.chat.completions.create(
        model="gpt-4.1-nano-2025-04-14",
        messages=[
            {
                "role": "system",
                "content": "Summarize the following facts about a user into a brief, coherent paragraph. Preserve all key information."
            },
            {
                "role": "user",
                "content": f"Facts:\n{memories_text}"
            }
        ],
        max_tokens=max_tokens
    )

    return response.choices[0].message.content
```

### Selective Detail Retention

Keep detailed information for recent memories, compress older ones.

```python
def get_compressed_context(
    memory: Memory,
    query: str,
    user_id: str,
    recent_count: int = 2,
    compressed_count: int = 5
) -> str:
    """Get recent memories in detail, compress older ones."""

    results = memory.search(query=query, user_id=user_id, limit=recent_count + compressed_count)
    memories = results.get("results", [])

    if not memories:
        return ""

    # Recent memories in full detail
    recent = memories[:recent_count]
    older = memories[recent_count:]

    context_parts = []

    if recent:
        recent_text = "\n".join(f"- {m['memory']}" for m in recent)
        context_parts.append(f"Recent:\n{recent_text}")

    if older:
        # Compress older memories
        older_summary = summarize_memories(older, max_tokens=100)
        context_parts.append(f"Background: {older_summary}")

    return "\n\n".join(context_parts)
```

---

## Production Architecture

### Optimized Chat Implementation

```python
from mem0 import Memory
from openai import OpenAI
from typing import Optional
import time

class OptimizedMemoryChat:
    """Production-ready chat with 90% token reduction."""

    def __init__(
        self,
        memory_config: dict = None,
        memory_limit: int = 5,
        token_budget: int = 500,
        model: str = "gpt-4.1-nano-2025-04-14"
    ):
        self.memory = Memory.from_config(memory_config) if memory_config else Memory()
        self.openai = OpenAI()
        self.memory_limit = memory_limit
        self.token_budget = token_budget
        self.model = model

    def chat(
        self,
        message: str,
        user_id: str,
        session_id: Optional[str] = None
    ) -> dict:
        """Process a chat message with optimized memory context."""

        start_time = time.time()

        # 1. Get optimized context
        context = self._get_optimized_context(message, user_id, session_id)

        # 2. Build prompt
        system_prompt = self._build_system_prompt(context)

        # 3. Generate response
        response = self.openai.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ]
        )

        assistant_response = response.choices[0].message.content

        # 4. Store exchange
        self.memory.add(
            [
                {"role": "user", "content": message},
                {"role": "assistant", "content": assistant_response}
            ],
            user_id=user_id,
            session_id=session_id
        )

        elapsed = time.time() - start_time

        return {
            "response": assistant_response,
            "context_tokens": self._estimate_tokens(context),
            "total_tokens": response.usage.total_tokens,
            "latency_ms": int(elapsed * 1000)
        }

    def _get_optimized_context(
        self,
        query: str,
        user_id: str,
        session_id: Optional[str]
    ) -> str:
        """Get optimized memory context."""

        # User-level memories
        user_results = self.memory.search(
            query=query,
            user_id=user_id,
            limit=self.memory_limit
        )

        context_parts = []

        if user_results.get("results"):
            user_memories = [
                m for m in user_results["results"]
                if m.get("score", 0) >= 0.6  # Filter low relevance
            ]
            if user_memories:
                text = "\n".join(f"- {m['memory']}" for m in user_memories[:3])
                context_parts.append(f"User context:\n{text}")

        # Session-level memories
        if session_id:
            session_results = self.memory.search(
                query=query,
                user_id=user_id,
                session_id=session_id,
                limit=3
            )
            if session_results.get("results"):
                text = "\n".join(f"- {m['memory']}" for m in session_results["results"])
                context_parts.append(f"Current session:\n{text}")

        return "\n\n".join(context_parts)

    def _build_system_prompt(self, context: str) -> str:
        """Build optimized system prompt."""
        base_prompt = "You are a helpful AI assistant."

        if context:
            return f"{base_prompt}\n\n{context}"

        return base_prompt

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count."""
        return len(text) // 4

# Usage
chat = OptimizedMemoryChat(
    memory_limit=5,
    token_budget=500
)

result = chat.chat(
    message="What programming language should I use for my project?",
    user_id="user",
    session_id="session_001"
)

print(f"Response: {result['response']}")
print(f"Context tokens: {result['context_tokens']}")
print(f"Total tokens: {result['total_tokens']}")
print(f"Latency: {result['latency_ms']}ms")
```

---

## Benchmarks

### Token Usage Comparison

| Scenario | Full Context | mem0 | Reduction |
|----------|--------------|------|-----------|
| 10 messages | 2,500 | 350 | 86% |
| 50 messages | 12,500 | 400 | 97% |
| 100 messages | 25,000 | 450 | 98% |
| 500 messages | 125,000 | 500 | 99.6% |

### Cost Savings Example

At $0.01 per 1K tokens:

| Messages/Day | Full Context | mem0 | Monthly Savings |
|--------------|--------------|------|-----------------|
| 1,000 | $375 | $15 | $360 |
| 10,000 | $3,750 | $150 | $3,600 |
| 100,000 | $37,500 | $1,500 | $36,000 |

---

## Common Pitfalls

### Pitfall 1: Over-Retrieval

```python
# BAD: Too many memories increase token usage
results = memory.search(query=query, user_id=user_id, limit=20)

# GOOD: Limit to most relevant
results = memory.search(query=query, user_id=user_id, limit=3)
```

### Pitfall 2: No Relevance Filtering

```python
# BAD: Include all results regardless of relevance
memories = results.get("results", [])

# GOOD: Filter by relevance score
memories = [m for m in results.get("results", []) if m.get("score", 0) >= 0.7]
```

### Pitfall 3: Verbose Memory Storage

```python
# BAD: Store entire conversations as single memories
memory.add(full_conversation_transcript, user_id="user", infer=False)

# GOOD: Let mem0 extract key facts
memory.add(conversation_messages, user_id="user", infer=True)
```

---

## Next Steps

- [Quickstart](./quickstart.md) - Basic mem0 setup
- [Conversation Extraction](./conversation-extraction.md) - Extract memories from conversations
- [Graph Memory](./graph-memory.md) - Neo4j graph memory
