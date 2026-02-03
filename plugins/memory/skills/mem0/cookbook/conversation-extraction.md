# Conversation Extraction Patterns

## Purpose

Extract structured memories from conversations using mem0's intelligent fact extraction. This guide covers automatic extraction, custom prompts, user vs agent memory extraction, and memory update logic.

## Variables

```
EXTRACTION_MODE: auto | manual | custom_prompt
MEMORY_SOURCE: user_messages | assistant_messages | both
FACT_FORMAT: json
UPDATE_OPERATIONS: ADD | UPDATE | DELETE | NONE
```

## Instructions

### How Extraction Works

mem0 uses a two-phase extraction process:

1. **Fact Extraction Phase**: LLM extracts facts from conversation
2. **Memory Update Phase**: Compare extracted facts with existing memories, decide ADD/UPDATE/DELETE/NONE

---

## Automatic Extraction

The simplest approach - pass a conversation and let mem0 handle extraction.

### Basic Usage

```python
from mem0 import Memory

memory = Memory()

# Conversation with user and assistant messages
conversation = [
    {"role": "user", "content": "Hi, I'm Sarah. I work as a product manager at Google."},
    {"role": "assistant", "content": "Hello Sarah! Nice to meet you. How can I help you today?"},
    {"role": "user", "content": "I'm building a mobile app and prefer using React Native."},
    {"role": "assistant", "content": "React Native is a great choice for cross-platform development!"},
    {"role": "user", "content": "Yes, and I use Firebase for the backend because it's quick to set up."}
]

# Add conversation - mem0 extracts facts automatically
result = memory.add(conversation, user_id="sarah")

print(result)
# {
#     "results": [
#         {"id": "mem_001", "memory": "Name is Sarah", "event": "ADD"},
#         {"id": "mem_002", "memory": "Works as a product manager at Google", "event": "ADD"},
#         {"id": "mem_003", "memory": "Building a mobile app", "event": "ADD"},
#         {"id": "mem_004", "memory": "Prefers React Native for mobile development", "event": "ADD"},
#         {"id": "mem_005", "memory": "Uses Firebase for backend", "event": "ADD"}
#     ]
# }
```

### Extraction Rules

The extraction process follows these rules:

1. **User messages only for user_id**: When using `user_id`, facts are extracted from user messages
2. **Assistant messages for agent_id**: When using `agent_id` with assistant messages, agent facts are extracted
3. **System messages ignored**: System role messages are never used for fact extraction
4. **Language preservation**: Facts are recorded in the same language as the input

---

## User Memory Extraction

Extract facts about the user from their messages.

### How It Determines User vs Agent Extraction

```python
# User memory extraction triggers when:
# 1. user_id is provided AND
# 2. Messages contain user role content

# This extracts USER facts:
result = memory.add(
    conversation,
    user_id="sarah"  # User-level extraction
)

# This also extracts USER facts:
result = memory.add(
    conversation,
    user_id="sarah",
    session_id="session_123"  # Still user extraction
)
```

### What Gets Extracted for Users

| Category | Example Facts |
|----------|---------------|
| Personal Preferences | "Prefers dark mode", "Likes Python" |
| Personal Details | "Name is Sarah", "Works at Google" |
| Plans & Intentions | "Building a mobile app", "Planning to migrate to AWS" |
| Activity Preferences | "Prefers morning meetings", "Uses VS Code" |
| Health & Wellness | "Vegetarian diet", "Runs 3x weekly" |
| Professional Details | "Product manager", "10 years experience" |
| Miscellaneous | "Favorite book is Dune", "Uses iPhone" |

### Example: User Fact Extraction

```python
conversation = [
    {"role": "user", "content": "I've been a vegetarian for 5 years. My favorite cuisine is Indian food."},
    {"role": "assistant", "content": "That's great! Indian cuisine has many delicious vegetarian options."},
    {"role": "user", "content": "Yes! I especially love paneer dishes. I cook them every weekend."}
]

result = memory.add(conversation, user_id="sarah")

# Extracted facts:
# - "Has been vegetarian for 5 years"
# - "Favorite cuisine is Indian food"
# - "Loves paneer dishes"
# - "Cooks every weekend"
```

---

## Agent Memory Extraction

Extract facts about the AI assistant from its messages. This is useful for tracking agent personas, capabilities mentioned, and hypothetical preferences.

### When Agent Extraction Triggers

```python
# Agent memory extraction triggers when:
# 1. agent_id is provided AND
# 2. Messages contain assistant role content

# This extracts AGENT facts:
result = memory.add(
    conversation,
    agent_id="customer_support_bot"  # Agent-level extraction
)
```

### What Gets Extracted for Agents

| Category | Example Facts |
|----------|---------------|
| Stated Preferences | "Enjoys discussing technology" |
| Mentioned Capabilities | "Can help with code review" |
| Hypothetical Activities | "Would recommend Python for beginners" |
| Personality Traits | "Maintains a professional tone" |
| Task Approaches | "Breaks down complex problems step-by-step" |
| Knowledge Areas | "Specializes in cloud architecture" |

### Example: Agent Fact Extraction

```python
conversation = [
    {"role": "user", "content": "What's your favorite programming language?"},
    {"role": "assistant", "content": "I find Python particularly elegant for its readability. I also appreciate TypeScript for web development."},
    {"role": "user", "content": "Can you help me with database design?"},
    {"role": "assistant", "content": "Absolutely! Database design is one of my specialties. I recommend starting with normalization principles."}
]

result = memory.add(conversation, agent_id="code_mentor")

# Extracted facts:
# - "Finds Python elegant for readability"
# - "Appreciates TypeScript for web development"
# - "Database design is one of the specialties"
# - "Recommends starting with normalization principles"
```

---

## Memory Update Logic

When new facts are extracted, mem0 compares them against existing memories and decides the appropriate action.

### Update Operations

| Operation | When Used | Example |
|-----------|-----------|---------|
| **ADD** | New information not in memory | "Prefers React Native" (new) |
| **UPDATE** | Existing memory needs modification | "Likes cheese pizza" -> "Likes cheese and chicken pizza" |
| **DELETE** | New info contradicts existing | "Is vegetarian" conflicts with "Eats beef regularly" |
| **NONE** | Information already exists | "Name is Sarah" (already stored) |

### Update Decision Examples

```python
# Scenario 1: ADD - New information
# Existing: [{"id": "0", "text": "Works at Google"}]
# New fact: "Uses React Native"
# Result: ADD new memory with id "1"

# Scenario 2: UPDATE - Enhanced information
# Existing: [{"id": "0", "text": "Likes pizza"}]
# New fact: "Loves pepperoni pizza with extra cheese"
# Result: UPDATE id "0" -> "Loves pepperoni pizza with extra cheese"

# Scenario 3: DELETE - Contradictory information
# Existing: [{"id": "0", "text": "Prefers Android phones"}]
# New fact: "Recently switched to iPhone and loves it"
# Result: DELETE id "0" (contradiction)

# Scenario 4: NONE - Duplicate information
# Existing: [{"id": "0", "text": "Name is Sarah"}]
# New fact: "Name is Sarah"
# Result: NONE (already exists)
```

### Observing Update Events

```python
conversation = [
    {"role": "user", "content": "I switched from Android to iPhone last month and I love it!"}
]

result = memory.add(conversation, user_id="sarah")

# If "Prefers Android" was previously stored:
# {
#     "results": [
#         {"id": "mem_007", "memory": "Switched to iPhone", "event": "ADD"},
#         {"id": "mem_003", "memory": "Prefers Android phones", "event": "DELETE"}
#     ]
# }
```

---

## Custom Extraction Prompts

Override the default extraction prompt for specialized use cases.

### Setting Custom Prompt

```python
from mem0 import Memory

custom_prompt = """You are a Technical Skills Extractor.
Focus ONLY on extracting technical skills, tools, and technologies mentioned.

Extract facts in this format:
- Programming languages used
- Frameworks and libraries mentioned
- Tools and platforms used
- Technical preferences stated

Return as JSON: {"facts": ["skill1", "skill2", ...]}

Following is the conversation:
"""

config = {
    "custom_fact_extraction_prompt": custom_prompt,
    "llm": {
        "provider": "openai",
        "config": {"model": "gpt-4.1-nano-2025-04-14"}
    }
}

memory = Memory.from_config(config)

conversation = [
    {"role": "user", "content": "I use Python with FastAPI for my APIs. For the frontend, I prefer React with TypeScript."},
    {"role": "assistant", "content": "That's a solid stack!"},
    {"role": "user", "content": "I deploy everything on AWS using Docker and Kubernetes."}
]

result = memory.add(conversation, user_id="developer_123")

# More focused extraction:
# - "Uses Python for backend"
# - "Uses FastAPI framework"
# - "Prefers React for frontend"
# - "Uses TypeScript"
# - "Deploys on AWS"
# - "Uses Docker and Kubernetes"
```

### Custom Update Memory Prompt

```python
custom_update_prompt = """You are a memory manager for technical skills.

When comparing new facts with existing memories:
- ADD: New skill or tool not previously recorded
- UPDATE: Skill level changed or new details about existing skill
- DELETE: User explicitly states they no longer use something
- NONE: Skill already recorded with same details

Always preserve skill proficiency levels when available.
"""

config = {
    "custom_update_memory_prompt": custom_update_prompt,
    "llm": {
        "provider": "openai",
        "config": {"model": "gpt-4.1-nano-2025-04-14"}
    }
}

memory = Memory.from_config(config)
```

---

## Raw Memory (Skip Extraction)

For cases where you want to store memories directly without LLM extraction.

```python
# Add memory without fact extraction
result = memory.add(
    "User mentioned they prefer morning standup meetings",
    user_id="sarah",
    infer=False  # Skip LLM extraction
)

# The text is stored as-is without transformation
# {
#     "results": [
#         {
#             "id": "mem_010",
#             "memory": "User mentioned they prefer morning standup meetings",
#             "event": "ADD"
#         }
#     ]
# }
```

### When to Use Raw Memory

| Use Case | Recommendation |
|----------|----------------|
| Storing pre-processed facts | `infer=False` |
| Storing structured data | `infer=False` |
| Storing exact quotes | `infer=False` |
| Processing natural conversation | `infer=True` (default) |
| Extracting insights from dialogue | `infer=True` (default) |

---

## Extraction from Different Message Formats

### String Input

```python
# String is converted to user message
memory.add(
    "I prefer Python for data science",
    user_id="sarah"
)
# Equivalent to: [{"role": "user", "content": "I prefer Python..."}]
```

### Single Message Dict

```python
# Single message dict
memory.add(
    {"role": "user", "content": "I'm learning Rust"},
    user_id="sarah"
)
```

### Conversation List

```python
# Full conversation
memory.add(
    [
        {"role": "system", "content": "You are a helpful assistant"},  # Ignored
        {"role": "user", "content": "I need help with Python"},
        {"role": "assistant", "content": "I'd be happy to help!"},
        {"role": "user", "content": "I'm building a web scraper"}
    ],
    user_id="sarah"
)
```

---

## Batch Conversation Processing

Process multiple conversations efficiently.

```python
from mem0 import Memory
from typing import List, Dict

memory = Memory()

def process_conversation_batch(
    conversations: List[List[Dict]],
    user_id: str,
    session_prefix: str = "batch"
) -> List[dict]:
    """Process multiple conversations with unique session IDs."""
    results = []

    for idx, conversation in enumerate(conversations):
        session_id = f"{session_prefix}_{idx}"

        result = memory.add(
            conversation,
            user_id=user_id,
            session_id=session_id,
            metadata={"batch_index": idx}
        )
        results.append({
            "session_id": session_id,
            "extraction_result": result
        })

    return results

# Usage
conversations = [
    [
        {"role": "user", "content": "I work in fintech"},
        {"role": "assistant", "content": "Interesting field!"}
    ],
    [
        {"role": "user", "content": "I use Python for trading algorithms"},
        {"role": "assistant", "content": "Python is popular in quant finance"}
    ]
]

batch_results = process_conversation_batch(
    conversations,
    user_id="trader_01",
    session_prefix="trading_session"
)
```

---

## Integration with Claude Code Hooks

Example hook integration for automatic memory extraction.

```python
# UserPromptSubmit hook - inject memory context
def on_user_prompt(prompt: str, user_id: str, session_id: str) -> str:
    """Inject relevant memories into user prompt."""
    results = memory.search(query=prompt, user_id=user_id, limit=3)

    if results.get("results"):
        context = "\n".join(f"- {m['memory']}" for m in results["results"])
        return f"[MEMORY CONTEXT]\n{context}\n[END MEMORY]\n\n{prompt}"

    return prompt

# Stop hook - extract memories from completed conversation
def on_stop(transcript_path: str, user_id: str, session_id: str):
    """Extract memories from completed conversation."""
    conversation = load_conversation_from_transcript(transcript_path)

    if conversation:
        memory.add(
            conversation,
            user_id=user_id,
            session_id=session_id,
            metadata={"source": "claude_code_session"}
        )
```

---

## Next Steps

- [Graph Memory](./graph-memory.md) - Neo4j graph memory for relationships
- [Token Optimization](./token-optimization.md) - Achieve 90% token reduction
- [User Memory Extraction Prompt](../prompts/user_memory_extraction.md) - Full extraction prompt
- [Update Memory Prompt](../prompts/update_memory.md) - Memory update decision prompt
