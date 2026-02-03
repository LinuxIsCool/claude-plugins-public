# Named Entity Recognition Prompt

## Purpose

Extract named entities from text passages for knowledge graph construction in HippoRAG. This prompt identifies people, places, organizations, dates, concepts, and other salient entities that will become nodes in the knowledge graph.

## Variables

| Variable | Type | Description |
|----------|------|-------------|
| `${passage}` | string | The text passage to extract entities from |

## Prompt Template

### System Message

```
Your task is to extract named entities from the given paragraph.
Respond with a JSON list of entities.
```

### One-Shot Example (User)

```
Radio City
Radio City is India's first private FM radio station and was started on 3 July 2001.
It plays Hindi, English and regional songs.
Radio City recently forayed into New Media in May 2008 with the launch of a music portal - PlanetRadiocity.com that offers music related news, videos, songs, and other music-related features.
```

### One-Shot Example (Assistant)

```json
{"named_entities":
    ["Radio City", "India", "3 July 2001", "Hindi", "English", "May 2008", "PlanetRadiocity.com"]
}
```

### User Prompt

```
${passage}
```

## Full Message Array (Python)

```python
ner_system = """Your task is to extract named entities from the given paragraph.
Respond with a JSON list of entities.
"""

one_shot_ner_paragraph = """Radio City
Radio City is India's first private FM radio station and was started on 3 July 2001.
It plays Hindi, English and regional songs.
Radio City recently forayed into New Media in May 2008 with the launch of a music portal - PlanetRadiocity.com that offers music related news, videos, songs, and other music-related features."""

one_shot_ner_output = """{"named_entities":
    ["Radio City", "India", "3 July 2001", "Hindi", "English", "May 2008", "PlanetRadiocity.com"]
}
"""

prompt_template = [
    {"role": "system", "content": ner_system},
    {"role": "user", "content": one_shot_ner_paragraph},
    {"role": "assistant", "content": one_shot_ner_output},
    {"role": "user", "content": "${passage}"}
]
```

## Entity Types to Extract

| Type | Examples | Notes |
|------|----------|-------|
| **Person** | Albert Einstein, Marie Curie | Full names preferred |
| **Organization** | NASA, Apple Inc., UNESCO | Include common abbreviations |
| **Location** | Paris, Mount Everest, Pacific Ocean | Geographic entities |
| **Date/Time** | 3 July 2001, May 2008, 1905 | Various formats accepted |
| **Work** | Theory of Relativity, Mona Lisa | Creative/scientific works |
| **Concept** | New Media, quantum mechanics | Abstract but important concepts |
| **Product/Service** | PlanetRadiocity.com, iPhone | Brand names, services |
| **Language** | Hindi, English, Spanish | Languages mentioned |
| **Event** | World War II, Nobel Prize | Historical or notable events |

## Response Format

### Expected JSON Structure

```json
{
  "named_entities": [
    "Entity 1",
    "Entity 2",
    "Entity 3"
  ]
}
```

### Parsing the Response

```python
import re
import json

def extract_ner_from_response(response: str) -> list:
    """
    Parse NER JSON response from LLM.
    """
    # Pattern to match the JSON structure
    pattern = r'\{[^{}]*"named_entities"\s*:\s*\[[^\]]*\][^{}]*\}'
    match = re.search(pattern, response, re.DOTALL)

    if match is None:
        return []

    try:
        parsed = json.loads(match.group())
        return parsed.get("named_entities", [])
    except json.JSONDecodeError:
        # Fallback: try eval for malformed JSON
        try:
            return eval(match.group())["named_entities"]
        except:
            return []
```

## Quality Guidelines

### Entity Selection Criteria

**Include:**
- Proper nouns (capitalized names)
- Dates and temporal references
- Specific locations (cities, countries, landmarks)
- Organization and company names
- Product and service names
- Important concepts that will connect to other passages

**Exclude:**
- Generic nouns (e.g., "company", "person", "city")
- Pronouns (he, she, it, they)
- Common adjectives or verbs
- Duplicate entities (case-insensitive)

### Handling Edge Cases

```python
# Post-processing for entity deduplication
def deduplicate_entities(entities: list) -> list:
    """Remove duplicates while preserving order."""
    seen = set()
    unique = []
    for entity in entities:
        normalized = entity.strip().lower()
        if normalized not in seen:
            seen.add(normalized)
            unique.append(entity.strip())
    return unique

# Example usage in HippoRAG
extracted_entities = extract_ner_from_response(llm_response)
unique_entities = list(dict.fromkeys(extracted_entities))  # Preserves order
```

## Example Extractions

### Input 1: Scientific Text

```
Albert Einstein developed the theory of general relativity in 1915.
The theory describes gravity as the curvature of spacetime caused by mass and energy.
Einstein was working at the Prussian Academy of Sciences in Berlin when he published this groundbreaking work.
```

### Output 1

```json
{
  "named_entities": [
    "Albert Einstein",
    "1915",
    "general relativity",
    "Prussian Academy of Sciences",
    "Berlin"
  ]
}
```

### Input 2: Business News

```
Apple Inc. announced the new iPhone 15 at their September 2023 event in Cupertino, California.
CEO Tim Cook presented the device, which features a new A17 chip designed in partnership with TSMC.
```

### Output 2

```json
{
  "named_entities": [
    "Apple Inc.",
    "iPhone 15",
    "September 2023",
    "Cupertino",
    "California",
    "Tim Cook",
    "A17",
    "TSMC"
  ]
}
```

### Input 3: Historical Text

```
The Battle of Waterloo was fought on June 18, 1815, near Waterloo in present-day Belgium.
Napoleon Bonaparte was defeated by the Duke of Wellington and Prussian Marshal Blücher.
This battle marked the end of the Napoleonic Wars.
```

### Output 3

```json
{
  "named_entities": [
    "Battle of Waterloo",
    "June 18, 1815",
    "Waterloo",
    "Belgium",
    "Napoleon Bonaparte",
    "Duke of Wellington",
    "Prussian Marshal Blücher",
    "Napoleonic Wars"
  ]
}
```

## Error Handling

### Common LLM Response Issues

1. **Truncated JSON**: Response cut off mid-entity

```python
from hipporag.utils.llm_utils import fix_broken_generated_json

def safe_parse_ner(response: str) -> list:
    """Handle truncated or malformed responses."""
    # Try fixing broken JSON first
    fixed = fix_broken_generated_json(response)
    return extract_ner_from_response(fixed)
```

2. **Empty Response**: No entities found

```python
def handle_empty_ner(entities: list, passage: str) -> list:
    """Fallback when NER returns no entities."""
    if not entities:
        # Log for debugging
        logger.warning(f"No entities extracted from: {passage[:50]}...")
        # Could implement simple regex fallback for proper nouns
    return entities
```

3. **Over-extraction**: Too many entities

```python
def limit_entities(entities: list, max_entities: int = 20) -> list:
    """Limit number of entities to prevent noise."""
    if len(entities) > max_entities:
        # Keep first N entities (usually most relevant)
        return entities[:max_entities]
    return entities
```

## Performance Notes

- **Token efficiency**: Short system prompt reduces input tokens
- **One-shot learning**: Single example provides format without excessive tokens
- **JSON mode**: Enable `response_format: {"type": "json_object"}` for reliable parsing
- **Batch processing**: HippoRAG processes NER in parallel via ThreadPoolExecutor
