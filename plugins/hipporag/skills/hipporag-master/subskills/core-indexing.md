---
name: core-indexing
description: Master HippoRAG document indexing with OpenIE triple extraction, entity recognition, and knowledge graph construction. Use when ingesting documents, building knowledge graphs, or configuring extraction pipelines.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Core: Indexing (Pattern Separation)

Document ingestion and knowledge graph construction via OpenIE extraction.

## Biological Analogy: Pattern Separation

In the hippocampus, the **Dentate Gyrus** performs pattern separation:
- Takes overlapping, similar inputs
- Creates distinct, separable neural patterns
- Enables precise memory storage without interference

HippoRAG's indexing mimics this:
- Takes overlapping, similar documents
- Creates distinct entity-relation triples
- Enables precise retrieval without confusion

```
Document Text (overlapping)        →    Triples (separated patterns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Alice founded TechCorp in 2020.        (Alice, founded, TechCorp)
She is now the CEO. Bob joined          (Alice, is CEO of, TechCorp)
as CTO in 2021."                        (TechCorp, founded in, 2020)
                                        (Bob, is CTO of, TechCorp)
                                        (Bob, joined, TechCorp)
                                        (Bob, joined in, 2021)
```

## Territory Map

```
HippoRAG Indexing Pipeline:

┌─────────────────┐
│   Documents     │  Raw input (PDF, markdown, text, JSON)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Preprocessing  │  Chunking, cleaning, formatting
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  OpenIE Extract │  LLM-based triple extraction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Entity Linking  │  Resolve entity synonyms
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Graph Building │  Create nodes and edges
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Indexing     │  Build retrieval indices
└─────────────────┘
```

## Beginner Techniques

### Basic Document Indexing

```python
from hipporag import HippoRAG

# Initialize HippoRAG
hippo = HippoRAG(
    backend="kuzu",  # Embedded, zero-config
    llm_model="gpt-4o-mini"
)

# Build indices
await hippo.build_indices_and_constraints()

# Index a single document
await hippo.add_episode(
    name="company_overview",
    episode_body="""
    TechCorp was founded by Alice in 2020. She serves as CEO.
    Bob joined as CTO in 2021. The company is headquartered
    in San Francisco and focuses on AI research.
    """,
    source="company_overview.txt"
)
```

### Batch Document Indexing

```python
from pathlib import Path

# Index a directory of documents
docs_path = Path("./documents")

for doc_file in docs_path.glob("**/*.md"):
    content = doc_file.read_text()
    await hippo.add_episode(
        name=doc_file.stem,
        episode_body=content,
        source=str(doc_file)
    )
    print(f"Indexed: {doc_file.name}")
```

### Viewing Extracted Triples

```python
# After indexing, view what was extracted
entities = await hippo.get_entities(limit=20)
relations = await hippo.get_relations(limit=20)

print("Entities:")
for entity in entities:
    print(f"  - {entity.name} ({entity.type})")

print("\nRelations:")
for rel in relations:
    print(f"  - {rel.subject} --[{rel.predicate}]--> {rel.object}")
```

## Intermediate Techniques

### Custom OpenIE Prompts

HippoRAG uses LLM-based OpenIE. You can customize the extraction prompt:

```python
# Custom extraction prompt for domain-specific content
custom_prompt = """
Extract factual relationships from the following text as triples.
Focus on:
- People and their roles
- Companies and their relationships
- Temporal information (dates, years)
- Location information

Format: (subject, predicate, object)

Text:
{text}

Triples:
"""

hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    llm_model="gpt-4o-mini",
    extraction_prompt=custom_prompt
)
```

### Entity Type Configuration

Define expected entity types for better extraction:

```python
from pydantic import BaseModel, Field

class Person(BaseModel):
    """A human person"""
    name: str = Field(description="Full name")
    role: str | None = Field(None, description="Job title or role")

class Company(BaseModel):
    """A business organization"""
    name: str = Field(description="Company name")
    industry: str | None = Field(None, description="Industry sector")
    founded: int | None = Field(None, description="Year founded")

class Location(BaseModel):
    """A geographical location"""
    name: str = Field(description="Location name")
    type: str | None = Field(None, description="city, country, region")

# Use custom entity types
await hippo.add_episode(
    name="company_doc",
    episode_body=document_text,
    entity_types={
        "Person": Person,
        "Company": Company,
        "Location": Location
    }
)
```

### Incremental Indexing

Add documents incrementally without reprocessing:

```python
# Check if document was already indexed
if not await hippo.is_indexed(source="new_doc.md"):
    await hippo.add_episode(
        name="new_doc",
        episode_body=content,
        source="new_doc.md"
    )

# Update existing document (re-extracts triples)
await hippo.update_episode(
    source="existing_doc.md",
    episode_body=updated_content
)
```

### Handling Large Documents

For documents exceeding context limits:

```python
from hipporag.utils import chunk_document

# Chunk large document
chunks = chunk_document(
    text=large_document,
    chunk_size=4000,  # tokens
    overlap=200       # token overlap between chunks
)

# Index each chunk with source tracking
for i, chunk in enumerate(chunks):
    await hippo.add_episode(
        name=f"large_doc_chunk_{i}",
        episode_body=chunk,
        source="large_document.pdf",
        metadata={"chunk_index": i, "total_chunks": len(chunks)}
    )
```

## Advanced Techniques

### Parallel Batch Processing

```python
import asyncio
from hipporag.utils import RawEpisode

# Prepare batch of documents
raw_episodes = [
    RawEpisode(
        name=f"doc_{i}",
        content=doc_content,
        source=doc_path
    )
    for i, (doc_content, doc_path) in enumerate(documents)
]

# Process in parallel batches
await hippo.add_episode_bulk(
    raw_episodes,
    batch_size=10,           # Process 10 at a time
    max_concurrency=5,       # 5 parallel LLM calls
    progress_callback=lambda i, n: print(f"Progress: {i}/{n}")
)
```

### Custom Relation Types

Define domain-specific relation types:

```python
from pydantic import BaseModel, Field

class EmployedBy(BaseModel):
    """Employment relationship"""
    role: str | None = Field(None, description="Job title")
    start_date: str | None = Field(None, description="Start date")
    end_date: str | None = Field(None, description="End date")

class AcquiredBy(BaseModel):
    """Acquisition relationship"""
    date: str | None = Field(None, description="Acquisition date")
    amount: str | None = Field(None, description="Deal value")

# Configure edge types
await hippo.add_episode(
    name="business_news",
    episode_body=news_text,
    edge_types={
        "EMPLOYED_BY": EmployedBy,
        "ACQUIRED_BY": AcquiredBy
    },
    edge_type_map={
        ("Person", "Company"): ["EMPLOYED_BY"],
        ("Company", "Company"): ["ACQUIRED_BY"]
    }
)
```

### Quality Assessment

Monitor extraction quality:

```python
# Get extraction statistics
stats = await hippo.get_extraction_stats()

print(f"Total documents: {stats['documents']}")
print(f"Total entities: {stats['entities']}")
print(f"Total relations: {stats['relations']}")
print(f"Avg triples per doc: {stats['avg_triples_per_doc']:.1f}")
print(f"Entity types: {stats['entity_types']}")
print(f"Relation types: {stats['relation_types']}")

# Validate a sample
sample_triples = await hippo.get_sample_triples(n=10)
for triple in sample_triples:
    print(f"  ({triple.subject}, {triple.predicate}, {triple.object})")
    print(f"    Source: {triple.source}")
```

### Entity Resolution and Deduplication

Handle entity synonyms and duplicates:

```python
# HippoRAG includes automatic entity resolution
# Configure similarity threshold for merging
hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    entity_resolution_threshold=0.85  # Cosine similarity threshold
)

# Manual entity merging
await hippo.merge_entities(
    source_entities=["Apple Inc.", "Apple Computer", "Apple"],
    target_entity="Apple Inc."
)

# View entity clusters
clusters = await hippo.get_entity_clusters()
for cluster in clusters:
    print(f"Cluster: {cluster.canonical}")
    for variant in cluster.variants:
        print(f"  - {variant}")
```

### Offline/Batch Mode with vLLM

For large-scale indexing, use vLLM offline mode:

```python
from hipporag import HippoRAG
from hipporag.llm import VLLMOfflineClient

# Configure vLLM offline client (3x faster than online)
llm_client = VLLMOfflineClient(
    model="meta-llama/Llama-3.3-70B-Instruct",
    tensor_parallel_size=4,  # Use 4 GPUs
    gpu_memory_utilization=0.9
)

hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    llm_client=llm_client
)

# Batch process documents (offline mode is ideal for this)
await hippo.add_episode_bulk(documents, batch_size=100)
```

## OpenIE Deep Dive

### How LLM-based OpenIE Works

```
1. Input Text:
   "Elon Musk founded SpaceX in 2002. The company launched
    Falcon 9 in 2010 from Cape Canaveral."

2. LLM Prompt (simplified):
   "Extract factual triples (subject, predicate, object) from:
    {text}"

3. LLM Output:
   (Elon Musk, founded, SpaceX)
   (SpaceX, founded in, 2002)
   (SpaceX, launched, Falcon 9)
   (Falcon 9, launched in, 2010)
   (Falcon 9, launched from, Cape Canaveral)

4. Post-processing:
   - Entity typing (Elon Musk → Person, SpaceX → Company)
   - Relation normalization (founded/started → FOUNDED)
   - Embedding generation for entities
```

### Triple Quality Factors

| Factor | Good | Bad |
|--------|------|-----|
| **Specificity** | (Alice, CEO of, TechCorp) | (Alice, related to, TechCorp) |
| **Atomicity** | One fact per triple | Multiple facts merged |
| **Completeness** | All key facts extracted | Important facts missed |
| **Correctness** | Facts match source text | Hallucinated facts |

### Improving Extraction Quality

1. **Use stronger LLM**: GPT-4o > GPT-4o-mini for complex domains
2. **Domain-specific prompts**: Customize for your content type
3. **Entity types**: Define expected types to guide extraction
4. **Few-shot examples**: Add examples to extraction prompt
5. **Post-processing**: Validate and filter low-confidence triples

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Few triples extracted | Weak LLM or poor prompt | Use stronger model, improve prompt |
| Wrong entity types | Missing type configuration | Define entity types explicitly |
| Duplicate entities | No entity resolution | Enable entity_resolution_threshold |
| Slow indexing | Sequential processing | Use batch mode, increase concurrency |
| Out of memory | Large documents | Chunk documents before indexing |
| API rate limits | Too many concurrent calls | Reduce max_concurrency, add delays |

## Performance Optimization

### Indexing Speed

```python
# Optimize for speed
hippo = HippoRAG(
    backend="falkordb",              # Fast Redis-based backend
    llm_model="gpt-4o-mini",         # Faster model for extraction
    batch_size=20,                   # Larger batches
    max_concurrency=10,              # More parallel calls
    entity_resolution_threshold=0    # Disable resolution for speed
)
```

### Indexing Quality

```python
# Optimize for quality
hippo = HippoRAG(
    backend="neo4j",
    llm_model="gpt-4o",              # Stronger model
    batch_size=5,                    # Smaller batches, more attention
    max_concurrency=3,               # Fewer parallel calls
    entity_resolution_threshold=0.8, # Enable resolution
    validate_triples=True            # Post-validation
)
```

## Reference

### Key Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `llm_model` | gpt-4o-mini | Model for triple extraction |
| `batch_size` | 10 | Documents per batch |
| `max_concurrency` | 5 | Parallel LLM calls |
| `chunk_size` | 4000 | Tokens per chunk for large docs |
| `entity_resolution_threshold` | 0.85 | Similarity for entity merging |

### Supported Document Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Markdown | .md | Full support including code blocks |
| Plain text | .txt | Direct processing |
| PDF | .pdf | Requires pypdf or pdfplumber |
| JSON | .json | Expects text field or array of texts |
| HTML | .html | Converted to markdown first |

## Related Sub-Skills

- **core-retrieval**: Query the indexed knowledge graph
- **core-consolidation**: Improve graph quality over time
- **integration-llm**: Configure LLM clients for extraction
- **integration-backends**: Choose and configure graph database
