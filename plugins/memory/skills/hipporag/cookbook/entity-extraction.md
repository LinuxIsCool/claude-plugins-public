# Entity Extraction and Triple Generation

## Purpose

Deep dive into HippoRAG's Open Information Extraction (OpenIE) pipeline that transforms documents into knowledge graph triples. This cookbook covers Named Entity Recognition (NER), RDF triple extraction, batch processing, and custom extraction strategies.

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENIE_MODE` | `online` | Extraction mode: `online` (API), `offline` (local vLLM), `Transformers-offline` |
| `SAVE_OPENIE` | `True` | Persist OpenIE results to disk |
| `FORCE_OPENIE_FROM_SCRATCH` | `False` | Re-extract even if cached results exist |
| `MAX_NEW_TOKENS` | `2048` | Max tokens for extraction responses |
| `RESPONSE_FORMAT` | `{"type": "json_object"}` | Force JSON output from LLM |

## Instructions

### The OpenIE Pipeline

HippoRAG extracts structured knowledge through a two-stage pipeline:

```
Document → NER → Named Entities → Triple Extraction → (S, P, O) Triples
                                                              ↓
                                                    Knowledge Graph
```

**Stage 1: Named Entity Recognition (NER)**
- Input: Raw text passage
- Output: List of named entities (people, places, organizations, concepts)

**Stage 2: Triple Extraction (Relation Extraction)**
- Input: Passage + extracted entities
- Output: RDF triples in (subject, predicate, object) format

### Processing Flow

```python
from hipporag import HippoRAG
from hipporag.information_extraction import OpenIE

# The OpenIE module is initialized internally
hipporag = HippoRAG(save_dir='outputs/extraction_demo', ...)

# When you call index(), OpenIE runs:
# 1. batch_openie() → for each chunk
#    a. ner() → extract entities
#    b. triple_extraction() → extract triples conditioned on entities
```

## Code Examples

### Example 1: Basic Entity and Triple Extraction

```python
from hipporag import HippoRAG

hipporag = HippoRAG(
    save_dir='outputs/openie_demo',
    llm_model_name='gpt-4o-mini',
    embedding_model_name='text-embedding-3-small'
)

# Sample document
document = """
Radio City is India's first private FM radio station and was started on 3 July 2001.
It plays Hindi, English and regional songs.
Radio City recently forayed into New Media in May 2008 with the launch of a music
portal - PlanetRadiocity.com that offers music related news, videos, songs, and
other music-related features.
"""

# Index triggers OpenIE
hipporag.index(docs=[document])

# Inspect extracted OpenIE results
import json
with open(hipporag.openie_results_path, 'r') as f:
    openie_data = json.load(f)

doc_info = openie_data['docs'][0]
print("Extracted Entities:")
for entity in doc_info['extracted_entities']:
    print(f"  - {entity}")

print("\nExtracted Triples:")
for triple in doc_info['extracted_triples']:
    print(f"  ({triple[0]}) --[{triple[1]}]--> ({triple[2]})")
```

**Expected Output:**
```
Extracted Entities:
  - Radio City
  - India
  - 3 July 2001
  - Hindi
  - English
  - May 2008
  - PlanetRadiocity.com

Extracted Triples:
  (Radio City) --[located in]--> (India)
  (Radio City) --[is]--> (private FM radio station)
  (Radio City) --[started on]--> (3 July 2001)
  (Radio City) --[plays songs in]--> (Hindi)
  (Radio City) --[plays songs in]--> (English)
  (Radio City) --[forayed into]--> (New Media)
  (Radio City) --[launched]--> (PlanetRadiocity.com)
  (PlanetRadiocity.com) --[launched in]--> (May 2008)
  (PlanetRadiocity.com) --[is]--> (music portal)
  (PlanetRadiocity.com) --[offers]--> (news)
  (PlanetRadiocity.com) --[offers]--> (videos)
  (PlanetRadiocity.com) --[offers]--> (songs)
```

### Example 2: Direct OpenIE Access

```python
from hipporag.information_extraction import OpenIE
from hipporag.llm.openai_gpt import CacheOpenAI
from hipporag.utils.config_utils import BaseConfig

# Initialize LLM
config = BaseConfig(llm_name='gpt-4o-mini')
llm = CacheOpenAI(global_config=config)

# Create OpenIE instance
openie = OpenIE(llm_model=llm)

# Process a single passage
passage = "Albert Einstein developed the theory of relativity in 1905."
chunk_key = "test_chunk_001"

# Step 1: Named Entity Recognition
ner_result = openie.ner(chunk_key=chunk_key, passage=passage)
print(f"NER Result: {ner_result.unique_entities}")
# ['Albert Einstein', '1905', 'theory of relativity']

# Step 2: Triple Extraction (using NER output)
triple_result = openie.triple_extraction(
    chunk_key=chunk_key,
    passage=passage,
    named_entities=ner_result.unique_entities
)
print(f"Triples: {triple_result.triples}")
# [['Albert Einstein', 'developed', 'theory of relativity'],
#  ['theory of relativity', 'developed in', '1905']]
```

### Example 3: Batch Processing with Progress

```python
from hipporag.information_extraction import OpenIE
from hipporag.llm.openai_gpt import CacheOpenAI
from hipporag.utils.config_utils import BaseConfig
from hipporag.utils.misc_utils import compute_mdhash_id

config = BaseConfig(llm_name='gpt-4o-mini')
llm = CacheOpenAI(global_config=config)
openie = OpenIE(llm_model=llm)

# Prepare batch of documents
documents = [
    "Marie Curie discovered polonium in 1898.",
    "Isaac Newton formulated the laws of motion.",
    "Charles Darwin proposed the theory of evolution."
]

# Create chunk info dict (matches HippoRAG's internal format)
chunks = {}
for doc in documents:
    chunk_id = compute_mdhash_id(doc, prefix="chunk-")
    chunks[chunk_id] = {'content': doc}

# Batch process with threading
ner_results, triple_results = openie.batch_openie(chunks)

# Results are dictionaries keyed by chunk_id
for chunk_id, ner_res in ner_results.items():
    triple_res = triple_results[chunk_id]
    print(f"\nDocument: {chunks[chunk_id]['content'][:50]}...")
    print(f"  Entities: {ner_res.unique_entities}")
    print(f"  Triples: {triple_res.triples}")
```

### Example 4: Handling Extraction Errors

```python
from hipporag.utils.misc_utils import NerRawOutput, TripleRawOutput

# NerRawOutput structure
"""
@dataclass
class NerRawOutput:
    chunk_id: str
    response: str  # Raw LLM response
    metadata: dict  # Includes tokens, cache_hit, errors
    unique_entities: List[str]
"""

# TripleRawOutput structure
"""
@dataclass
class TripleRawOutput:
    chunk_id: str
    response: str
    metadata: dict
    triples: List[List[str]]  # [[subj, pred, obj], ...]
"""

# Check for extraction errors
ner_result = openie.ner(chunk_key="chunk_1", passage="Some text")

if 'error' in ner_result.metadata:
    print(f"NER failed: {ner_result.metadata['error']}")
    # Fallback: empty entities
    entities = []
else:
    entities = ner_result.unique_entities
    print(f"Extracted {len(entities)} entities")

# Check token usage
print(f"Prompt tokens: {ner_result.metadata.get('prompt_tokens', 0)}")
print(f"Completion tokens: {ner_result.metadata.get('completion_tokens', 0)}")
print(f"Cache hit: {ner_result.metadata.get('cache_hit', False)}")
```

### Example 5: Custom Extraction with Different LLMs

```python
from hipporag import HippoRAG
from hipporag.utils.config_utils import BaseConfig

# Using OpenAI GPT-4o for higher quality extraction
config_openai = BaseConfig(
    llm_name='gpt-4o',  # More capable model
    llm_base_url=None,  # Use OpenAI API
    max_new_tokens=4096,
    temperature=0  # Deterministic extraction
)

# Using local vLLM for offline extraction
config_vllm = BaseConfig(
    llm_name='meta-llama/Llama-3-8B-Instruct',
    llm_base_url='http://localhost:8000/v1',  # vLLM server
    openie_mode='online'  # Still uses LLM API
)

# Using Azure OpenAI
config_azure = BaseConfig(
    llm_name='gpt-4o-mini',
    azure_endpoint='https://your-resource.openai.azure.com/'
)

hipporag_openai = HippoRAG(global_config=config_openai, save_dir='outputs/gpt4o')
hipporag_vllm = HippoRAG(global_config=config_vllm, save_dir='outputs/llama')
```

### Example 6: Offline Batch Extraction (Pre-processing)

```python
from hipporag import HippoRAG
from hipporag.utils.config_utils import BaseConfig

# For large corpora, pre-extract OpenIE results offline
config = BaseConfig(
    openie_mode='offline',  # Use vLLM offline batch
    skip_graph=True,  # Don't build graph yet
    save_openie=True  # Save results for later
)

hipporag = HippoRAG(global_config=config, save_dir='outputs/preprocess')

# This only runs OpenIE and saves results
# (Will raise assertion after completion)
try:
    hipporag.pre_openie(docs=large_corpus)
except AssertionError:
    print("OpenIE pre-processing complete")

# Later, run full indexing with cached OpenIE
config_online = BaseConfig(
    openie_mode='online',
    force_openie_from_scratch=False  # Use cached results
)
hipporag_final = HippoRAG(global_config=config_online, save_dir='outputs/preprocess')
hipporag_final.index(docs=large_corpus)
```

## Common Patterns

### Pattern 1: Entity Type Filtering

```python
def filter_entities_by_type(entities: list, keep_types: set) -> list:
    """
    Filter extracted entities by semantic type.
    HippoRAG doesn't type entities, so this uses heuristics.
    """
    import re

    filtered = []
    for entity in entities:
        # Date patterns
        if re.match(r'\d{1,2}\s+\w+\s+\d{4}', entity):
            if 'DATE' in keep_types:
                filtered.append(entity)
        # Numeric
        elif re.match(r'^\d+$', entity):
            if 'NUMBER' in keep_types:
                filtered.append(entity)
        # Likely proper noun (capitalized)
        elif entity[0].isupper():
            if 'ENTITY' in keep_types:
                filtered.append(entity)
        else:
            if 'OTHER' in keep_types:
                filtered.append(entity)

    return filtered

# Usage
entities = ['Albert Einstein', '1905', 'Germany', 'physics', '26']
filtered = filter_entities_by_type(entities, {'ENTITY', 'DATE'})
# ['Albert Einstein', '1905', 'Germany']
```

### Pattern 2: Triple Quality Validation

```python
from hipporag.utils.llm_utils import filter_invalid_triples

def validate_triples(triples: list) -> list:
    """
    Validate and clean extracted triples.
    """
    # Built-in filtering removes malformed triples
    valid = filter_invalid_triples(triples)

    # Additional custom validation
    cleaned = []
    for triple in valid:
        subj, pred, obj = triple

        # Skip if subject or object is empty
        if not subj.strip() or not obj.strip():
            continue

        # Skip self-referential triples
        if subj.lower() == obj.lower():
            continue

        # Normalize predicate
        pred = pred.lower().strip()

        cleaned.append([subj, pred, obj])

    return cleaned

# Usage
raw_triples = [
    ['Einstein', 'was', 'Einstein'],  # Self-referential
    ['', 'born in', 'Germany'],  # Empty subject
    ['Einstein', 'DEVELOPED', 'Relativity']  # Valid
]
valid = validate_triples(raw_triples)
# [['Einstein', 'developed', 'Relativity']]
```

### Pattern 3: Caching and Incremental Extraction

```python
import os
import json

def get_cached_openie(save_dir: str, llm_name: str) -> dict:
    """
    Load cached OpenIE results if available.
    """
    safe_llm_name = llm_name.replace('/', '_')
    path = os.path.join(save_dir, f'openie_results_ner_{safe_llm_name}.json')

    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {'docs': [], 'avg_ent_chars': 0, 'avg_ent_words': 0}

def merge_openie_results(existing: dict, new_docs: list) -> dict:
    """
    Merge new extraction results with cached results.
    """
    existing_ids = {doc['idx'] for doc in existing['docs']}
    for doc in new_docs:
        if doc['idx'] not in existing_ids:
            existing['docs'].append(doc)
    return existing
```

### Pattern 4: Extraction Statistics

```python
def analyze_extraction_quality(openie_data: dict) -> dict:
    """
    Compute statistics on extraction quality.
    """
    docs = openie_data['docs']

    total_entities = sum(len(d['extracted_entities']) for d in docs)
    total_triples = sum(len(d['extracted_triples']) for d in docs)

    # Entity coverage
    docs_with_entities = sum(1 for d in docs if d['extracted_entities'])
    docs_with_triples = sum(1 for d in docs if d['extracted_triples'])

    # Average per document
    avg_entities = total_entities / len(docs) if docs else 0
    avg_triples = total_triples / len(docs) if docs else 0

    # Triple diversity (unique predicates)
    all_predicates = [t[1] for d in docs for t in d['extracted_triples']]
    unique_predicates = len(set(all_predicates))

    return {
        'total_docs': len(docs),
        'total_entities': total_entities,
        'total_triples': total_triples,
        'docs_with_entities': docs_with_entities,
        'docs_with_triples': docs_with_triples,
        'avg_entities_per_doc': round(avg_entities, 2),
        'avg_triples_per_doc': round(avg_triples, 2),
        'unique_predicates': unique_predicates,
        'avg_entity_length_chars': openie_data.get('avg_ent_chars', 0),
        'avg_entity_length_words': openie_data.get('avg_ent_words', 0)
    }

# Usage
stats = analyze_extraction_quality(openie_data)
print(json.dumps(stats, indent=2))
```

### Pattern 5: Domain-Specific Entity Post-Processing

```python
def postprocess_entities_for_domain(entities: list, domain: str) -> list:
    """
    Apply domain-specific entity normalization.
    """
    processed = []

    for entity in entities:
        normalized = entity.strip()

        if domain == 'biomedical':
            # Normalize gene names, diseases, etc.
            normalized = normalized.upper() if len(normalized) <= 5 else normalized

        elif domain == 'legal':
            # Normalize case citations
            import re
            normalized = re.sub(r'v\.?\s+', 'v. ', normalized)

        elif domain == 'finance':
            # Normalize company names
            normalized = normalized.replace(' Inc.', '').replace(' Corp.', '')

        processed.append(normalized)

    return list(dict.fromkeys(processed))  # Deduplicate
```

## Troubleshooting

### Common Extraction Issues

1. **No entities extracted**: Check if passage is too short or contains no named entities
2. **Malformed JSON response**: LLM may truncate output; increase `max_new_tokens`
3. **Missing triples**: Entities may be extracted but no clear relations found
4. **Duplicate entities**: Use `unique_entities` field which deduplicates

### Debugging Extraction

```python
# Enable verbose logging
import logging
logging.getLogger('hipporag').setLevel(logging.DEBUG)

# Check raw LLM response
ner_result = openie.ner(chunk_key="test", passage="Sample text")
print(f"Raw response: {ner_result.response}")
print(f"Metadata: {ner_result.metadata}")

# Verify JSON parsing
import re
pattern = r'\{[^{}]*"named_entities"\s*:\s*\[[^\]]*\][^{}]*\}'
match = re.search(pattern, ner_result.response, re.DOTALL)
if match:
    print(f"Parsed JSON: {match.group()}")
else:
    print("JSON parsing failed")
```

### API Rate Limiting

```python
from hipporag.utils.config_utils import BaseConfig

# Configure retry behavior for rate limits
config = BaseConfig(
    max_retry_attempts=5,  # Retry on rate limit errors
    # Add delays between batches in batch_openie
)
```
