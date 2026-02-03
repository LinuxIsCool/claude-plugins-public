---
description: Index documents into HippoRAG knowledge graph using OpenIE extraction
argument-hint: <path> [format]
---

# HippoRAG Document Indexing

Extract entities and relations from documents using OpenIE, then build knowledge graph.

## Arguments

- **path** (required): Document path, file, or directory
- **format**: `markdown` | `pdf` | `text` | `json` (auto-detect if not specified)

## Instructions

### 1. Parse Arguments

```
Arguments: $ARGUMENTS

Parse format: "<path> [format]"
Examples:
  - "docs/" → Index all documents in docs/
  - "paper.pdf" → Index single PDF
  - "notes.md markdown" → Index markdown explicitly
```

### 2. Validate Input

```bash
# Check path exists
if [ ! -e "$path" ]; then
    echo "Error: Path does not exist: $path"
    exit 1
fi

# List files to process
if [ -d "$path" ]; then
    find "$path" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" -o -name "*.json" \)
else
    echo "$path"
fi
```

### 3. Load HippoRAG Configuration

```python
import yaml

with open('.hipporag/config.yaml') as f:
    config = yaml.safe_load(f)

backend = config['backend']['type']
connection = config['backend']['connection']
extraction_model = config['extraction']['model']
batch_size = config['extraction']['batch_size']
```

### 4. Initialize HippoRAG

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend=backend,
    connection=connection,
    llm_model=extraction_model
)

await hippo.build_indices_and_constraints()
```

### 5. Process Documents

For each document:

#### a. Load Document Content

```python
def load_document(path: str, format: str = None) -> str:
    if format is None:
        format = detect_format(path)

    if format == 'markdown':
        return load_markdown(path)
    elif format == 'pdf':
        return load_pdf(path)  # Requires pypdf or pdfplumber
    elif format == 'text':
        return load_text(path)
    elif format == 'json':
        return load_json(path)
```

#### b. Extract Triples via OpenIE

```python
# HippoRAG uses LLM-based OpenIE
triples = await hippo.extract_triples(
    text=document_content,
    source=document_path
)

# Example output:
# [
#   ("Alice", "is CEO of", "TechCorp"),
#   ("Alice", "founded", "TechCorp"),
#   ("TechCorp", "headquartered in", "San Francisco")
# ]
```

#### c. Build Knowledge Graph

```python
# Add nodes for entities
for subject, predicate, object in triples:
    await hippo.add_entity(subject)
    await hippo.add_entity(object)
    await hippo.add_relation(subject, predicate, object, source=document_path)
```

### 6. Batch Processing

For directories with many files:

```python
from hipporag.utils import batch_process

results = await batch_process(
    documents=document_paths,
    hippo=hippo,
    batch_size=batch_size,
    progress_callback=lambda i, n: print(f"Processing {i}/{n}")
)
```

### 7. Report Statistics

```
HippoRAG Indexing Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━
Documents processed: {count}
Entities extracted: {entity_count}
Relations created: {relation_count}
Processing time: {elapsed}s

Sample entities:
  - {entity_1} ({type})
  - {entity_2} ({type})
  - {entity_3} ({type})

Sample relations:
  - {subject} --[{predicate}]--> {object}
  - {subject} --[{predicate}]--> {object}

Next steps:
  /hipporag-query <query>  - Query the knowledge graph
```

## OpenIE Extraction Details

HippoRAG's OpenIE extracts structured triples from unstructured text:

```
Input Text:
"Apple Inc. was founded by Steve Jobs in 1976. The company is
headquartered in Cupertino and is known for the iPhone."

Extracted Triples:
┌─────────────┬─────────────────┬─────────────┐
│ Subject     │ Predicate       │ Object      │
├─────────────┼─────────────────┼─────────────┤
│ Apple Inc.  │ founded by      │ Steve Jobs  │
│ Apple Inc.  │ founded in      │ 1976        │
│ Apple Inc.  │ headquartered in│ Cupertino   │
│ Apple Inc.  │ known for       │ iPhone      │
└─────────────┴─────────────────┴─────────────┘
```

## Quality Tips

1. **Document quality matters**: Clean, well-structured text yields better triples
2. **Batch similar documents**: Domain-specific batches improve extraction consistency
3. **Review sample triples**: Check extraction quality on a subset before full indexing
4. **Tune extraction prompts**: For domain-specific content, customize OpenIE prompts

## Related Sub-Skills

For detailed indexing mechanics:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/core-indexing.md
```

For LLM configuration:
```
Read: plugins/hipporag/skills/hipporag-master/subskills/integration-llm.md
```
