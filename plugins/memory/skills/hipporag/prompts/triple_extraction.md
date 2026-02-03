# RDF Triple Extraction Prompt

## Purpose

Extract structured RDF (Resource Description Framework) triples from text passages using previously extracted named entities. Each triple represents a relationship as (subject, predicate, object), forming the edges of the HippoRAG knowledge graph.

## Variables

| Variable | Type | Description |
|----------|------|-------------|
| `${passage}` | string | The text passage to extract triples from |
| `${named_entity_json}` | string | JSON object with named entities from NER step |

## Prompt Template

### System Message

```
Your task is to construct an RDF (Resource Description Framework) graph from the given passages and named entity lists.
Respond with a JSON list of triples, with each triple representing a relationship in the RDF graph.

Pay attention to the following requirements:
- Each triple should contain at least one, but preferably two, of the named entities in the list for each passage.
- Clearly resolve pronouns to their specific names to maintain clarity.
```

### One-Shot Example (User)

```
Convert the paragraph into a JSON dict, it has a named entity list and a triple list.
Paragraph:
```
Radio City
Radio City is India's first private FM radio station and was started on 3 July 2001.
It plays Hindi, English and regional songs.
Radio City recently forayed into New Media in May 2008 with the launch of a music portal - PlanetRadiocity.com that offers music related news, videos, songs, and other music-related features.
```

{"named_entities":
    ["Radio City", "India", "3 July 2001", "Hindi", "English", "May 2008", "PlanetRadiocity.com"]
}
```

### One-Shot Example (Assistant)

```json
{"triples": [
        ["Radio City", "located in", "India"],
        ["Radio City", "is", "private FM radio station"],
        ["Radio City", "started on", "3 July 2001"],
        ["Radio City", "plays songs in", "Hindi"],
        ["Radio City", "plays songs in", "English"],
        ["Radio City", "forayed into", "New Media"],
        ["Radio City", "launched", "PlanetRadiocity.com"],
        ["PlanetRadiocity.com", "launched in", "May 2008"],
        ["PlanetRadiocity.com", "is", "music portal"],
        ["PlanetRadiocity.com", "offers", "news"],
        ["PlanetRadiocity.com", "offers", "videos"],
        ["PlanetRadiocity.com", "offers", "songs"]
    ]
}
```

### User Prompt Template

```
Convert the paragraph into a JSON dict, it has a named entity list and a triple list.
Paragraph:
```
${passage}
```

${named_entity_json}
```

## Full Message Array (Python)

```python
from hipporag.prompts.templates.ner import one_shot_ner_paragraph, one_shot_ner_output

ner_conditioned_re_system = """Your task is to construct an RDF (Resource Description Framework) graph from the given passages and named entity lists.
Respond with a JSON list of triples, with each triple representing a relationship in the RDF graph.

Pay attention to the following requirements:
- Each triple should contain at least one, but preferably two, of the named entities in the list for each passage.
- Clearly resolve pronouns to their specific names to maintain clarity.
"""

ner_conditioned_re_frame = """Convert the paragraph into a JSON dict, it has a named entity list and a triple list.
Paragraph:
```
{passage}
```

{named_entity_json}
"""

ner_conditioned_re_input = ner_conditioned_re_frame.format(
    passage=one_shot_ner_paragraph,
    named_entity_json=one_shot_ner_output
)

ner_conditioned_re_output = """{"triples": [
            ["Radio City", "located in", "India"],
            ["Radio City", "is", "private FM radio station"],
            ["Radio City", "started on", "3 July 2001"],
            ["Radio City", "plays songs in", "Hindi"],
            ["Radio City", "plays songs in", "English"],
            ["Radio City", "forayed into", "New Media"],
            ["Radio City", "launched", "PlanetRadiocity.com"],
            ["PlanetRadiocity.com", "launched in", "May 2008"],
            ["PlanetRadiocity.com", "is", "music portal"],
            ["PlanetRadiocity.com", "offers", "news"],
            ["PlanetRadiocity.com", "offers", "videos"],
            ["PlanetRadiocity.com", "offers", "songs"]
    ]
}
"""

prompt_template = [
    {"role": "system", "content": ner_conditioned_re_system},
    {"role": "user", "content": ner_conditioned_re_input},
    {"role": "assistant", "content": ner_conditioned_re_output},
    {"role": "user", "content": "${passage_and_entities}"}  # Rendered via template
]
```

## Triple Structure

### Anatomy of a Triple

```
[Subject, Predicate, Object]
   │         │         │
   │         │         └── Target entity or value
   │         └──────────── Relationship type (verb/preposition)
   └────────────────────── Source entity
```

### Predicate Types

| Category | Examples | Use Case |
|----------|----------|----------|
| **Relational** | `located in`, `part of`, `member of` | Hierarchical/spatial |
| **Temporal** | `started on`, `born in`, `died on` | Time relationships |
| **Descriptive** | `is`, `has`, `known as` | Attributes/types |
| **Action** | `founded`, `directed`, `wrote` | Agent-action-patient |
| **Possessive** | `owns`, `has`, `contains` | Ownership/containment |

## Response Format

### Expected JSON Structure

```json
{
  "triples": [
    ["subject1", "predicate1", "object1"],
    ["subject2", "predicate2", "object2"]
  ]
}
```

### Parsing the Response

```python
import re
import json

def extract_triples_from_response(response: str) -> list:
    """
    Parse triple extraction JSON response from LLM.
    """
    pattern = r'\{[^{}]*"triples"\s*:\s*\[[^\]]*\][^{}]*\}'
    match = re.search(pattern, response, re.DOTALL)

    if match is None:
        return []

    try:
        parsed = json.loads(match.group())
        return parsed.get("triples", [])
    except json.JSONDecodeError:
        try:
            return eval(match.group())["triples"]
        except:
            return []
```

## Quality Guidelines

### Triple Extraction Rules

**Best Practices:**
1. **Use named entities**: At least one endpoint should be from the NER list
2. **Resolve pronouns**: "He invented X" becomes "[Person Name] invented X"
3. **Normalize predicates**: Use consistent verb forms (present tense, lowercase)
4. **Avoid redundancy**: Don't repeat the same relationship with different wording

**Avoid:**
- Generic subjects like "it", "this", "the company"
- Overly long predicates (keep under 5 words)
- Triples that don't add meaningful relationships
- Self-referential triples (subject == object)

### Predicate Normalization

```python
def normalize_predicate(predicate: str) -> str:
    """
    Normalize predicate for consistent graph edges.
    """
    pred = predicate.lower().strip()

    # Common normalizations
    normalizations = {
        'was born in': 'born in',
        'was founded in': 'founded in',
        'is located in': 'located in',
        'was directed by': 'directed by',
        'is known as': 'known as',
        'is a': 'is',
        'is an': 'is',
    }

    return normalizations.get(pred, pred)
```

## Example Extractions

### Input 1: Biographical Text

**Passage:**
```
Albert Einstein was born in Ulm, Germany, in 1879. He developed the theory
of special relativity in 1905 while working at the Swiss Patent Office in Bern.
Einstein later received the Nobel Prize in Physics in 1921 for explaining the
photoelectric effect.
```

**Named Entities:**
```json
{"named_entities": ["Albert Einstein", "Ulm", "Germany", "1879", "1905",
                    "Swiss Patent Office", "Bern", "Nobel Prize in Physics", "1921"]}
```

**Output:**
```json
{"triples": [
    ["Albert Einstein", "born in", "Ulm"],
    ["Ulm", "located in", "Germany"],
    ["Albert Einstein", "born in", "1879"],
    ["Albert Einstein", "developed", "theory of special relativity"],
    ["theory of special relativity", "developed in", "1905"],
    ["Albert Einstein", "worked at", "Swiss Patent Office"],
    ["Swiss Patent Office", "located in", "Bern"],
    ["Albert Einstein", "received", "Nobel Prize in Physics"],
    ["Nobel Prize in Physics", "awarded in", "1921"],
    ["Albert Einstein", "explained", "photoelectric effect"]
]}
```

### Input 2: Film Information

**Passage:**
```
The Old Guard (1960) is a French comedy film directed by Gilles Grangier.
The film stars Jean Gabin and was released in theaters across France.
Grangier directed over 50 films during his career.
```

**Named Entities:**
```json
{"named_entities": ["The Old Guard", "1960", "Gilles Grangier", "Jean Gabin", "France"]}
```

**Output:**
```json
{"triples": [
    ["The Old Guard", "is", "French comedy film"],
    ["The Old Guard", "released in", "1960"],
    ["The Old Guard", "directed by", "Gilles Grangier"],
    ["The Old Guard", "stars", "Jean Gabin"],
    ["The Old Guard", "released in", "France"],
    ["Gilles Grangier", "directed", "over 50 films"]
]}
```

### Input 3: Geographic Information

**Passage:**
```
Montebello is a small town in Rockland County, New York.
The town is located along the Hudson River valley and was incorporated in 1986.
Erik Hort was born in Montebello.
```

**Named Entities:**
```json
{"named_entities": ["Montebello", "Rockland County", "New York", "Hudson River", "1986", "Erik Hort"]}
```

**Output:**
```json
{"triples": [
    ["Montebello", "is", "small town"],
    ["Montebello", "located in", "Rockland County"],
    ["Rockland County", "located in", "New York"],
    ["Montebello", "located along", "Hudson River"],
    ["Montebello", "incorporated in", "1986"],
    ["Erik Hort", "born in", "Montebello"]
]}
```

## Triple Validation

### Validation Function

```python
from hipporag.utils.llm_utils import filter_invalid_triples

def validate_triples(triples: list) -> list:
    """
    Validate extracted triples for knowledge graph.
    """
    # Built-in HippoRAG validation
    valid = filter_invalid_triples(triples)

    cleaned = []
    for triple in valid:
        if len(triple) != 3:
            continue

        subj, pred, obj = triple

        # Skip if subject or object is empty/whitespace
        if not subj.strip() or not obj.strip():
            continue

        # Skip self-referential triples
        if subj.lower().strip() == obj.lower().strip():
            continue

        # Skip if predicate is too long (likely malformed)
        if len(pred.split()) > 6:
            continue

        cleaned.append([subj.strip(), pred.strip().lower(), obj.strip()])

    return cleaned
```

### Common Validation Rules

| Rule | Example Rejected | Reason |
|------|------------------|--------|
| Empty subject | `["", "is", "city"]` | No meaningful subject |
| Empty object | `["Paris", "is", ""]` | No meaningful object |
| Self-reference | `["Paris", "same as", "Paris"]` | No information gain |
| Too long predicate | `["X", "is known to have been", "Y"]` | Likely malformed |
| Non-list format | `"Einstein born Germany"` | Wrong structure |

## Error Handling

### Handling Malformed Responses

```python
from hipporag.utils.llm_utils import fix_broken_generated_json

def safe_parse_triples(response: str, passage: str) -> list:
    """
    Safely parse triple extraction response with fallbacks.
    """
    # Try normal parsing first
    triples = extract_triples_from_response(response)

    if triples:
        return validate_triples(triples)

    # Try fixing broken JSON
    fixed_response = fix_broken_generated_json(response)
    triples = extract_triples_from_response(fixed_response)

    if triples:
        return validate_triples(triples)

    # Log failure for debugging
    logger.warning(f"Failed to extract triples from: {passage[:50]}...")
    return []
```

## Performance Considerations

- **Conditioned extraction**: Using NER results improves triple quality
- **Token efficiency**: Compact JSON format reduces output tokens
- **Parallel processing**: HippoRAG batches triple extraction with ThreadPoolExecutor
- **Caching**: Results are cached to avoid re-extraction on re-indexing
