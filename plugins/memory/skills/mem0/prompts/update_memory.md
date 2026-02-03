# Update Memory Prompt

## Purpose

Decide whether to ADD, UPDATE, DELETE, or make NO CHANGE to memories based on newly extracted facts compared to existing memories. This is the second phase of mem0's memory processing pipeline.

## Variables

```
OPERATIONS: ADD | UPDATE | DELETE | NONE
INPUT_FORMAT: json (existing memories + new facts)
OUTPUT_FORMAT: json (memory operations)
```

## Prompt

```
You are a smart memory manager which controls the memory of a system.
You can perform four operations: (1) add into the memory, (2) update the memory, (3) delete from the memory, and (4) no change.

Based on the above four operations, the memory will change.

Compare newly retrieved facts with the existing memory. For each new fact, decide whether to:
- ADD: Add it to the memory as a new element
- UPDATE: Update an existing memory element
- DELETE: Delete an existing memory element
- NONE: Make no change (if the fact is already present or irrelevant)

There are specific guidelines to select which operation to perform:

1. **Add**: If the retrieved facts contain new information not present in the memory, then you have to add it by generating a new ID in the id field.
- **Example**:
    - Old Memory:
        [
            {
                "id" : "0",
                "text" : "User is a software engineer"
            }
        ]
    - Retrieved facts: ["Name is John"]
    - New Memory:
        {
            "memory" : [
                {
                    "id" : "0",
                    "text" : "User is a software engineer",
                    "event" : "NONE"
                },
                {
                    "id" : "1",
                    "text" : "Name is John",
                    "event" : "ADD"
                }
            ]

        }

2. **Update**: If the retrieved facts contain information that is already present in the memory but the information is totally different, then you have to update it.
If the retrieved fact contains information that conveys the same thing as the elements present in the memory, then you have to keep the fact which has the most information.
Example (a) -- if the memory contains "User likes to play cricket" and the retrieved fact is "Loves to play cricket with friends", then update the memory with the retrieved facts.
Example (b) -- if the memory contains "Likes cheese pizza" and the retrieved fact is "Loves cheese pizza", then you do not need to update it because they convey the same information.
If the direction is to update the memory, then you have to update it.
Please keep in mind while updating you have to keep the same ID.
Please note to return the IDs in the output from the input IDs only and do not generate any new ID.
- **Example**:
    - Old Memory:
        [
            {
                "id" : "0",
                "text" : "I really like cheese pizza"
            },
            {
                "id" : "1",
                "text" : "User is a software engineer"
            },
            {
                "id" : "2",
                "text" : "User likes to play cricket"
            }
        ]
    - Retrieved facts: ["Loves chicken pizza", "Loves to play cricket with friends"]
    - New Memory:
        {
        "memory" : [
                {
                    "id" : "0",
                    "text" : "Loves cheese and chicken pizza",
                    "event" : "UPDATE",
                    "old_memory" : "I really like cheese pizza"
                },
                {
                    "id" : "1",
                    "text" : "User is a software engineer",
                    "event" : "NONE"
                },
                {
                    "id" : "2",
                    "text" : "Loves to play cricket with friends",
                    "event" : "UPDATE",
                    "old_memory" : "User likes to play cricket"
                }
            ]
        }


3. **Delete**: If the retrieved facts contain information that contradicts the information present in the memory, then you have to delete it. Or if the direction is to delete the memory, then you have to delete it.
Please note to return the IDs in the output from the input IDs only and do not generate any new ID.
- **Example**:
    - Old Memory:
        [
            {
                "id" : "0",
                "text" : "Name is John"
            },
            {
                "id" : "1",
                "text" : "Loves cheese pizza"
            }
        ]
    - Retrieved facts: ["Dislikes cheese pizza"]
    - New Memory:
        {
        "memory" : [
                {
                    "id" : "0",
                    "text" : "Name is John",
                    "event" : "NONE"
                },
                {
                    "id" : "1",
                    "text" : "Loves cheese pizza",
                    "event" : "DELETE"
                }
        ]
        }

4. **No Change**: If the retrieved facts contain information that is already present in the memory, then you do not need to make any changes.
- **Example**:
    - Old Memory:
        [
            {
                "id" : "0",
                "text" : "Name is John"
            },
            {
                "id" : "1",
                "text" : "Loves cheese pizza"
            }
        ]
    - Retrieved facts: ["Name is John"]
    - New Memory:
        {
        "memory" : [
                {
                    "id" : "0",
                    "text" : "Name is John",
                    "event" : "NONE"
                },
                {
                    "id" : "1",
                    "text" : "Loves cheese pizza",
                    "event" : "NONE"
                }
            ]
        }
```

## User Message Template

This is appended to the system prompt with specific memory context:

```
Below is the current content of my memory which I have collected till now. You have to update it in the following format only:

```
{{EXISTING_MEMORIES}}
```

The new retrieved facts are mentioned in the triple backticks. You have to analyze the new retrieved facts and determine whether these facts should be added, updated, or deleted in the memory.

```
{{NEW_FACTS}}
```

You must return your response in the following JSON structure only:

{
    "memory" : [
        {
            "id" : "<ID of the memory>",                # Use existing ID for updates/deletes, or new ID for additions
            "text" : "<Content of the memory>",         # Content of the memory
            "event" : "<Operation to be performed>",    # Must be "ADD", "UPDATE", "DELETE", or "NONE"
            "old_memory" : "<Old memory content>"       # Required only if the event is "UPDATE"
        },
        ...
    ]
}

Follow the instruction mentioned below:
- Do not return anything from the custom few shot prompts provided above.
- If the current memory is empty, then you have to add the new retrieved facts to the memory.
- You should return the updated memory in only JSON format as shown below. The memory key should be the same if no changes are made.
- If there is an addition, generate a new key and add the new memory corresponding to it.
- If there is a deletion, the memory key-value pair should be removed from the memory.
- If there is an update, the ID key should remain the same and only the value needs to be updated.

Do not return anything except the JSON format.
```

## Usage

### mem0 Internal Usage

This prompt is used internally by mem0 after fact extraction:

```python
# mem0 calls this internally
from mem0.configs.prompts import get_update_memory_messages

# Build the prompt with existing memories and new facts
prompt = get_update_memory_messages(
    retrieved_old_memory_dict=existing_memories,  # Current memory state
    response_content=new_facts                     # Extracted facts from conversation
)
```

### Direct Implementation

```python
from openai import OpenAI
import json

def update_memories(
    existing_memories: list,
    new_facts: list,
    custom_prompt: str = None
) -> dict:
    """
    Decide memory operations based on existing memories and new facts.

    Args:
        existing_memories: List of {"id": str, "text": str} dicts
        new_facts: List of fact strings
        custom_prompt: Optional custom system prompt

    Returns:
        Dict with "memory" key containing list of operations
    """

    client = OpenAI()

    system_prompt = custom_prompt or DEFAULT_UPDATE_MEMORY_PROMPT

    # Format existing memories
    if existing_memories:
        memory_str = json.dumps(existing_memories, indent=2)
        memory_section = f"""
Below is the current content of my memory which I have collected till now:

```
{memory_str}
```
"""
    else:
        memory_section = "Current memory is empty."

    # Format new facts
    facts_str = json.dumps(new_facts)

    user_message = f"""{memory_section}

The new retrieved facts are mentioned in the triple backticks:

```
{facts_str}
```

Analyze these facts and return the memory operations in JSON format."""

    response = client.chat.completions.create(
        model="gpt-4.1-nano-2025-04-14",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        response_format={"type": "json_object"}
    )

    return json.loads(response.choices[0].message.content)

# Example usage
existing = [
    {"id": "0", "text": "User likes Python"},
    {"id": "1", "text": "User works at Google"}
]

new_facts = [
    "Loves Python and Go",
    "Switched to Anthropic recently"
]

result = update_memories(existing, new_facts)
print(json.dumps(result, indent=2))
```

## Expected Output Format

```json
{
    "memory": [
        {
            "id": "0",
            "text": "Loves Python and Go",
            "event": "UPDATE",
            "old_memory": "User likes Python"
        },
        {
            "id": "1",
            "text": "User works at Google",
            "event": "DELETE"
        },
        {
            "id": "2",
            "text": "Works at Anthropic",
            "event": "ADD"
        }
    ]
}
```

## Operation Decision Matrix

| Scenario | Old Memory | New Fact | Operation |
|----------|------------|----------|-----------|
| New information | None | "Likes Python" | ADD |
| Enhanced detail | "Likes Python" | "Loves Python for data science" | UPDATE |
| Same information | "Name is John" | "Name is John" | NONE |
| Contradiction | "Likes Java" | "Hates Java" | DELETE |
| Related addition | "Works at Google" | "Joined Anthropic" | DELETE old, ADD new |

## Key Guidelines

### When to ADD

- Completely new information not in memory
- New category of information
- Additional details that don't overlap with existing

```
Old: [{"id": "0", "text": "User is engineer"}]
New: ["Likes hiking"]
Result: ADD "Likes hiking" with new ID
```

### When to UPDATE

- Same topic with more detail
- Enhanced version of existing fact
- Merged information (e.g., "likes A" + "likes B" = "likes A and B")

```
Old: [{"id": "0", "text": "Likes pizza"}]
New: ["Loves pepperoni pizza with extra cheese"]
Result: UPDATE id "0" -> "Loves pepperoni pizza with extra cheese"
```

### When to DELETE

- Direct contradiction
- Negation of existing fact
- Obsolete information replaced by new

```
Old: [{"id": "0", "text": "Vegetarian"}]
New: ["Eats chicken regularly"]
Result: DELETE id "0" (contradiction)
```

### When to use NONE

- Duplicate information
- Less detailed version of existing
- Information already captured

```
Old: [{"id": "0", "text": "Senior engineer at Google"}]
New: ["Works at Google"]
Result: NONE (less detail than existing)
```

## ID Management Rules

1. **Existing memories**: Always use their original IDs
2. **New additions**: Generate sequential IDs (next available number)
3. **Updates**: Keep the same ID, change only the text
4. **Deletions**: Mark with DELETE event, keep the ID

```json
// If max existing ID is "5", next ADD gets "6"
{
    "memory": [
        {"id": "5", "text": "existing", "event": "NONE"},
        {"id": "6", "text": "new fact", "event": "ADD"}
    ]
}
```

## Custom Update Prompts

You can customize the update logic:

```python
from mem0 import Memory

# Custom prompt emphasizing technical skills
custom_update_prompt = """You are a technical skills memory manager.

When comparing new facts with existing memories:
- ADD: New technical skill or tool not previously recorded
- UPDATE: Skill level changed or new details about existing skill
- DELETE: User explicitly states they no longer use a technology
- NONE: Skill already recorded with same or less detail

Preserve proficiency levels (beginner, intermediate, expert) when mentioned.
Merge related technologies (e.g., "knows React" + "learning Next.js" -> "knows React and learning Next.js")
"""

config = {
    "custom_update_memory_prompt": custom_update_prompt
}

memory = Memory.from_config(config)
```

## Processing Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Conversation  │────>│  Fact Extraction │────>│ Memory Update  │
│     Messages    │     │     (LLM 1)      │     │    (LLM 2)     │
└─────────────────┘     └──────────────────┘     └────────────────┘
                               │                         │
                               v                         v
                        {"facts": [...]}          {"memory": [
                                                    {id, text, event},
                                                    ...
                                                  ]}
```

## Related

- [User Memory Extraction](./user_memory_extraction.md) - Phase 1: Extract user facts
- [Agent Memory Extraction](./agent_memory_extraction.md) - Phase 1: Extract agent facts
- [Conversation Extraction Cookbook](../cookbook/conversation-extraction.md) - Full extraction patterns
