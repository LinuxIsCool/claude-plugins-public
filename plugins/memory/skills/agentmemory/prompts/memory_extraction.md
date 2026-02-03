# Memory Extraction Prompt Template

Template for extracting structured memories from conversations and documents.

## Purpose

Provide a structured prompt template for LLMs to extract memorable facts, preferences, and information from text that should be stored in an agent's memory system.

## Variables

```yaml
INPUT_TYPE: conversation | document | message
EXTRACTION_MODE: facts | preferences | entities | all
MAX_MEMORIES: 10
CONFIDENCE_THRESHOLD: 0.7
OUTPUT_FORMAT: json
```

## Instructions

1. Replace template variables with actual values
2. Provide the input text in the designated section
3. Parse the JSON output to extract memories
4. Store memories using agentmemory functions

---

## Core Prompt Template

```
You are a memory extraction assistant. Your task is to identify and extract important information that should be remembered for future reference.

## Input Type
{{INPUT_TYPE}}

## Extraction Mode
{{EXTRACTION_MODE}}

## Input Text
<input>
{{INPUT_TEXT}}
</input>

## Extraction Guidelines

### For Facts
Extract objective, verifiable information including:
- Definitions and explanations
- Historical events and dates
- Technical specifications
- Statistical data
- Relationships between entities

### For Preferences
Extract subjective preferences and opinions including:
- User likes and dislikes
- Communication style preferences
- Tool and technology preferences
- Working style preferences
- Formatting preferences

### For Entities
Extract named entities and their attributes including:
- People (names, roles, relationships)
- Organizations (names, types, associations)
- Locations (names, descriptions)
- Products/Services (names, features)
- Concepts (definitions, relationships)

## Output Format

Return a JSON array of memory objects. Each memory should have:

{
  "text": "The atomic fact or preference as a complete sentence",
  "category": "fact | preference | entity | relationship",
  "topic": "Primary topic classification",
  "confidence": 0.0-1.0,
  "source_context": "Brief context from the input",
  "metadata": {
    "entity": "If entity-related, the main entity name",
    "attribute": "If entity attribute, the attribute name",
    "value": "If entity attribute, the value",
    "temporal": "If time-relevant, the time reference"
  }
}

## Constraints

1. Only extract information explicitly stated or strongly implied
2. Each memory should be self-contained and understandable without context
3. Assign confidence based on how clearly the information is stated
4. Do not infer or assume information not present in the text
5. Maximum {{MAX_MEMORIES}} memories
6. Minimum confidence threshold: {{CONFIDENCE_THRESHOLD}}

## Response

Return ONLY the JSON array, no additional text.
```

---

## Example Usage

### Input (Conversation)

```
User: I really prefer working with Python over JavaScript. I've been using VS Code
for about 3 years now, and I find dark themes much easier on my eyes. My team
follows the PEP 8 style guide religiously. We deploy our services on AWS,
specifically using Lambda for most of our backend work.
```

### Expected Output

```json
[
  {
    "text": "User prefers Python over JavaScript as a programming language",
    "category": "preference",
    "topic": "programming_languages",
    "confidence": 0.95,
    "source_context": "User stated preference for Python over JavaScript",
    "metadata": {}
  },
  {
    "text": "User has been using VS Code for approximately 3 years",
    "category": "fact",
    "topic": "development_tools",
    "confidence": 0.9,
    "source_context": "User mentioned VS Code usage duration",
    "metadata": {
      "entity": "User",
      "attribute": "editor_experience",
      "value": "3 years",
      "temporal": "duration"
    }
  },
  {
    "text": "User prefers dark themes for code editors because they are easier on the eyes",
    "category": "preference",
    "topic": "development_tools",
    "confidence": 0.9,
    "source_context": "User stated dark theme preference with reasoning",
    "metadata": {}
  },
  {
    "text": "User's team follows PEP 8 style guide for Python code",
    "category": "fact",
    "topic": "coding_standards",
    "confidence": 0.95,
    "source_context": "User mentioned team coding standard",
    "metadata": {
      "entity": "User's team",
      "attribute": "style_guide",
      "value": "PEP 8"
    }
  },
  {
    "text": "User's team deploys services on AWS using Lambda for backend work",
    "category": "fact",
    "topic": "infrastructure",
    "confidence": 0.9,
    "source_context": "User described deployment platform",
    "metadata": {
      "entity": "User's team",
      "attribute": "deployment_platform",
      "value": "AWS Lambda"
    }
  }
]
```

---

## Specialized Templates

### Conversation Memory Template

```
You are extracting memories from a conversation between a user and an assistant.

Focus on:
1. User preferences and requirements stated explicitly
2. Decisions made during the conversation
3. Technical details mentioned by the user
4. Corrections or clarifications provided
5. Action items or commitments

<conversation>
{{CONVERSATION_HISTORY}}
</conversation>

Extract memories that would be useful for future conversations with this user.
Return as JSON array with format:
{
  "text": "Memory content",
  "category": "preference | decision | technical | correction | action_item",
  "topic": "topic_name",
  "confidence": 0.0-1.0,
  "turn_reference": "Which part of conversation this came from"
}
```

### Document Memory Template

```
You are extracting key facts and information from a document.

Document Title: {{DOCUMENT_TITLE}}
Document Type: {{DOCUMENT_TYPE}}

<document>
{{DOCUMENT_CONTENT}}
</document>

Extract the most important facts that should be remembered about this document.
Each fact should be:
- Self-contained and understandable without the document
- Attributed to this source
- Categorized by topic

Return as JSON array:
{
  "text": "Fact as a complete sentence",
  "category": "definition | process | requirement | example | reference",
  "topic": "topic_name",
  "confidence": 0.0-1.0,
  "section": "Which section this came from"
}
```

### Entity Extraction Template

```
You are extracting named entities and their relationships from text.

<text>
{{INPUT_TEXT}}
</text>

For each entity, extract:
1. Entity name and type
2. Attributes mentioned
3. Relationships to other entities
4. Context in which it appears

Return as JSON array:
{
  "entity_name": "Name of the entity",
  "entity_type": "person | organization | location | product | concept",
  "attributes": [
    {"attribute": "attr_name", "value": "attr_value", "confidence": 0.0-1.0}
  ],
  "relationships": [
    {"relation": "relation_type", "target": "other_entity", "confidence": 0.0-1.0}
  ],
  "context": "Brief context of appearance"
}
```

---

## Integration Code

### Python Integration

```python
import json
from agentmemory import create_memory, create_unique_memory

def extract_and_store_memories(
    llm_response: str,
    source: str = None,
    deduplicate: bool = True
) -> dict:
    """
    Parse LLM extraction response and store memories.

    Args:
        llm_response: JSON string from LLM extraction
        source: Source identifier for metadata
        deduplicate: Whether to use create_unique_memory

    Returns:
        Statistics about stored memories
    """
    try:
        memories = json.loads(llm_response)
    except json.JSONDecodeError:
        return {"error": "Invalid JSON response"}

    stats = {"stored": 0, "skipped": 0, "errors": []}

    for memory in memories:
        try:
            # Build metadata
            metadata = {
                "topic": memory.get("topic", "general"),
                "confidence": memory.get("confidence", 0.8),
                "source_context": memory.get("source_context", ""),
                "extraction_method": "llm"
            }

            if source:
                metadata["source"] = source

            # Add any custom metadata
            if "metadata" in memory and isinstance(memory["metadata"], dict):
                for key, value in memory["metadata"].items():
                    if value:  # Only add non-empty values
                        metadata[key] = str(value)

            # Determine category
            category = memory.get("category", "facts")
            if category in ["preference", "preferences"]:
                category = "user_preferences"
            elif category in ["entity", "entities"]:
                category = "entities"
            elif category in ["relationship", "relationships"]:
                category = "relationships"
            else:
                category = "facts"

            # Store memory
            if deduplicate:
                create_unique_memory(
                    category=category,
                    content=memory["text"],
                    metadata=metadata,
                    similarity=0.90
                )
            else:
                create_memory(
                    category=category,
                    text=memory["text"],
                    metadata=metadata
                )

            stats["stored"] += 1

        except Exception as e:
            stats["errors"].append(str(e))

    return stats


def build_extraction_prompt(
    input_text: str,
    input_type: str = "conversation",
    extraction_mode: str = "all",
    max_memories: int = 10,
    confidence_threshold: float = 0.7
) -> str:
    """Build the extraction prompt with variables substituted."""

    template = '''You are a memory extraction assistant. Extract important information from the following {input_type}.

## Extraction Mode: {extraction_mode}

## Input
<input>
{input_text}
</input>

## Guidelines

Extract information that would be useful to remember for future reference.
Each memory should be:
1. Self-contained and understandable without additional context
2. A complete sentence
3. Factual or clearly marked as a preference/opinion

## Output Format

Return a JSON array (maximum {max_memories} items, minimum confidence {confidence_threshold}):

[
  {{
    "text": "The memory as a complete sentence",
    "category": "fact | preference | entity | relationship",
    "topic": "topic_classification",
    "confidence": 0.0-1.0,
    "source_context": "Brief context",
    "metadata": {{}}
  }}
]

Return ONLY valid JSON, no other text.'''

    return template.format(
        input_type=input_type,
        extraction_mode=extraction_mode,
        input_text=input_text,
        max_memories=max_memories,
        confidence_threshold=confidence_threshold
    )


# Example usage
def extract_memories_from_conversation(conversation: str, llm_fn):
    """
    Full pipeline: build prompt, call LLM, store memories.

    Args:
        conversation: The conversation text
        llm_fn: Function that takes prompt and returns LLM response
    """
    prompt = build_extraction_prompt(
        input_text=conversation,
        input_type="conversation",
        extraction_mode="all"
    )

    response = llm_fn(prompt)

    result = extract_and_store_memories(
        llm_response=response,
        source="conversation_extraction",
        deduplicate=True
    )

    return result
```

---

## Quality Guidelines

### High Confidence (0.9-1.0)
- Explicitly stated facts with clear language
- Direct preferences with "I prefer", "I like", "I want"
- Definitions provided by the source
- Numerical data with units

### Medium Confidence (0.7-0.9)
- Implied preferences from context
- Facts stated with hedging ("usually", "typically")
- Information requiring minor inference
- Paraphrased content

### Low Confidence (0.5-0.7)
- Heavily implied information
- Context-dependent statements
- Information requiring significant inference
- Ambiguous statements

### Skip (Below 0.5)
- Speculation or guesses
- Information that changes frequently
- Context that won't transfer to other conversations
- Trivial or obvious information

---

## Common Patterns

### User Preference Indicators
- "I prefer...", "I like...", "I dislike..."
- "I usually...", "I always...", "I never..."
- "I find X easier/better/worse than Y"
- "My favorite...", "I'm not a fan of..."

### Fact Indicators
- "X is Y", "X means Y", "X is defined as Y"
- "In 2024, X happened", "X was created in Y"
- "The capital of X is Y", "X contains Y"
- Numbers, dates, measurements, specifications

### Entity Relationship Indicators
- "X works at Y", "X is the CEO of Y"
- "X is part of Y", "X belongs to Y"
- "X created Y", "X invented Y"
- "X and Y are related through Z"

### Temporal Indicators
- "Since 2020...", "For the past 3 years..."
- "Starting next month...", "Until recently..."
- "Every week...", "On Mondays..."
- "This changed in...", "Used to be..."
