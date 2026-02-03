---
name: embeddings
description: This skill should be used when the user asks about "embedding models", "sentence transformers", "text embeddings", "MTEB benchmarks", "NV-Embed", "GritLM", "BGE", "all-MiniLM", "embedding selection", "embedding dimensions", or needs guidance on choosing and implementing embedding models for semantic search.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Embeddings Skill

Provides expertise on embedding models for semantic search and memory systems - covering model selection, performance tradeoffs, and implementation patterns.

## Overview

Embedding models convert text into dense vector representations for semantic similarity search. Key decision factors:

| Factor | Consideration |
|--------|---------------|
| **Quality** | MTEB benchmark scores, domain fit |
| **Dimensions** | 384 (compact) to 4096 (high-fidelity) |
| **Speed** | Inference latency, batch processing |
| **Memory** | Model size, GPU requirements |
| **Cost** | API pricing vs local compute |

## Model Categories (2026 State of the Art)

### Tier 1: Frontier Models (Highest Quality)

```
Qwen3-8B           4096 dims   16GB GPU    MTEB #1 (70.58 multilingual)
E5-Mistral-7B      4096 dims   14GB GPU    82-90% Top-5 accuracy
NV-Embed-v2        4096 dims   API/Local   Strong retrieval
text-embedding-3   1536/3072   OpenAI API  Production standard
```

**Use when**: Maximum retrieval quality required, GPU available.

### Tier 2: Balanced Models (Quality + Efficiency)

```
Qwen3-4B           2048 dims   8GB GPU     95%+ of 8B quality at 60% cost
EmbeddingGemma-300M 768 dims   600MB       Rivals 2x larger models
BGE-M3             1024 dims   Local/API   Dense+sparse+multi-vector
GritLM-7B          4096 dims   Local GPU   Generative + embedding dual-use
```

**Use when**: Good quality with reasonable resource requirements.

### Tier 3: Lightweight Models (Speed + Efficiency)

```
Qwen3-0.6B         1024 dims   1.2GB       <100ms, 10-15x faster than 8B
all-MiniLM-L6-v2   384 dims    44MB        CPU: 20ms, GPU: 2ms, widely supported
nomic-embed-text   768 dims    Local       Matryoshka support
```

**Use when**: CPU-only, edge deployment, real-time, or latency-critical.

## Model Selection Framework

### Decision Tree

```
Need maximum quality?
├─ Yes → NV-Embed-v2 or text-embedding-3-large
└─ No → Continue

Have GPU available?
├─ Yes → GritLM-7B or BGE-M3
└─ No → Continue

Need multilingual?
├─ Yes → BGE-M3 or text-embedding-3-small
└─ No → all-MiniLM-L6-v2
```

### By Use Case

| Use Case | Recommended | Dimensions |
|----------|-------------|------------|
| Production RAG | text-embedding-3-small | 1536 |
| Research/Multi-hop | NV-Embed-v2 | 4096 |
| Local/Privacy | all-MiniLM-L6-v2 | 384 |
| Multilingual | BGE-M3 | 1024 |
| Edge/Mobile | nomic-embed-text | 768 |

## Implementation Patterns

### Pattern 1: OpenAI Embeddings

```python
from openai import OpenAI

client = OpenAI()

def get_embedding(text: str, model: str = "text-embedding-3-small") -> list[float]:
    response = client.embeddings.create(
        input=text,
        model=model
    )
    return response.data[0].embedding
```

### Pattern 2: Sentence Transformers (Local)

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text: str) -> list[float]:
    return model.encode(text).tolist()

# Batch processing
def get_embeddings(texts: list[str]) -> list[list[float]]:
    return model.encode(texts).tolist()
```

### Pattern 3: HuggingFace Transformers

```python
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained('BAAI/bge-large-en-v1.5')
model = AutoModel.from_pretrained('BAAI/bge-large-en-v1.5')

def get_embedding(text: str) -> list[float]:
    inputs = tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    # Mean pooling
    embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
    return embedding
```

### Pattern 4: Ollama Embeddings (Local Server)

```python
import ollama

def get_embedding(text: str, model: str = "nomic-embed-text") -> list[float]:
    response = ollama.embeddings(model=model, prompt=text)
    return response['embedding']
```

## Framework Integration

### With ChromaDB

```python
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# Custom embedding function
ef = SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="memories",
    embedding_function=ef
)
```

### With mem0

```python
from mem0 import Memory

# OpenAI embeddings (default)
m = Memory()

# Custom HuggingFace embeddings
m = Memory(embedder={
    "provider": "huggingface",
    "config": {"model": "BAAI/bge-large-en-v1.5"}
})

# Ollama embeddings
m = Memory(embedder={
    "provider": "ollama",
    "config": {"model": "nomic-embed-text"}
})
```

### With HippoRAG

```python
from hipporag import HippoRAG

# Supported embedding models
hippo = HippoRAG(
    embedding_model_name='nvidia/NV-Embed-v2'  # High quality
    # or 'GritLM/GritLM-7B'                    # Balanced
    # or 'facebook/contriever'                 # Lightweight
    # or 'text-embedding-3-small'              # OpenAI
)
```

## Performance Benchmarks

### MTEB Leaderboard Reference (Late 2024)

| Model | Avg Score | Retrieval | Classification |
|-------|-----------|-----------|----------------|
| NV-Embed-v2 | ~69 | High | High |
| text-embedding-3-large | ~65 | High | Moderate |
| BGE-M3 | ~63 | High | Moderate |
| all-MiniLM-L6-v2 | ~56 | Moderate | Moderate |

*Note: Check current MTEB leaderboard for latest rankings.*

### Latency Comparison (2026 Benchmarks)

| Model | Params | CPU (ms) | GPU (ms) | Memory |
|-------|--------|----------|----------|--------|
| all-MiniLM-L6-v2 | 22M | 20 | 2 | 44MB |
| EmbeddingGemma-300M | 300M | 50 | 3 | 600MB |
| Qwen3-0.6B | 600M | 80 | 4 | 1.2GB |
| Qwen3-4B | 4B | 500 | 50 | 8GB |
| E5-Mistral-7B | 7B | 2000 | 200 | 14GB |

**ONNX Optimization**: all-MiniLM-L6-v2 achieves 1.55ms with ONNX quantization.

## Dimension Considerations

### Storage Impact

```
384 dims × 4 bytes = 1.5 KB per embedding
1024 dims × 4 bytes = 4 KB per embedding
4096 dims × 4 bytes = 16 KB per embedding

1M documents:
- 384 dims: ~1.5 GB
- 4096 dims: ~16 GB
```

### Quality vs Size Tradeoff

- **384 dims**: Good for most use cases, fast search
- **768-1024 dims**: Better semantic capture, moderate overhead
- **4096 dims**: Best quality, significant storage/compute

## Repository-Specific Recommendations

### For This Ecosystem

Given the Claude Code plugin context:

1. **Default**: `all-MiniLM-L6-v2` - CPU-friendly, fast, good quality
2. **Quality upgrade**: `text-embedding-3-small` via OpenAI API
3. **Local GPU**: `BGE-M3` for multilingual or `GritLM-7B` for dual-use

### Configuration Pattern

```python
# In plugin config
EMBEDDING_CONFIG = {
    "default": {
        "provider": "sentence-transformers",
        "model": "all-MiniLM-L6-v2",
        "dimensions": 384
    },
    "quality": {
        "provider": "openai",
        "model": "text-embedding-3-small",
        "dimensions": 1536
    },
    "local_gpu": {
        "provider": "transformers",
        "model": "BAAI/bge-m3",
        "dimensions": 1024
    }
}
```

## When to Use This Skill

**Best for:**
- Selecting embedding models for new memory systems
- Optimizing embedding performance
- Migrating between embedding providers
- Understanding quality/cost tradeoffs

**See also:**
- `../vector-search/SKILL.md` - Database integration
- `../memory-architecture/SKILL.md` - System design
- `../mem0/SKILL.md` - mem0 embedding config

## Cookbook

Detailed implementation guides for specific use cases:

| Cookbook | Use When |
|----------|----------|
| `cookbook/quickstart.md` | Getting started with embeddings in 5 minutes |
| `cookbook/model-selection.md` | Choosing the right model for your use case |
| `cookbook/sentence-transformers.md` | Using sentence-transformers library |
| `cookbook/openai-embeddings.md` | Using OpenAI embedding API |
| `cookbook/ollama-embeddings.md` | Local embeddings with Ollama server |
| `cookbook/matryoshka.md` | Multi-resolution Matryoshka embeddings |
| `cookbook/onnx-optimization.md` | 5-10x faster CPU inference with ONNX |
| `cookbook/batch-processing.md` | Large-scale batch embedding pipelines |
| `cookbook/journey-first-logs.md` | Embedding Claude Code JSONL logs for semantic search |

## Prompts

Task-specific instruction templates:

| Prompt | Purpose |
|--------|---------|
| `prompts/embedding_task_instruction.md` | Instructions for retrieval, classification, similarity tasks |

## Tools

Ready-to-use Python utilities:

| Tool | Purpose |
|------|---------|
| `tools/embedding_benchmark.py` | Benchmark models for latency, throughput, quality |
| `tools/embedding_client.py` | Unified client wrapper for all providers |

## Additional Resources

### Reference Files
- `references/mteb-deep-dive.md` - Detailed benchmark analysis

### External
- MTEB Leaderboard: https://huggingface.co/spaces/mteb/leaderboard
- Sentence Transformers: https://sbert.net/
