---
name: integration-llm
description: Master HippoRAG LLM client configuration for OpenAI, Anthropic Claude, and local models via vLLM/Ollama. Covers API setup, model selection, embedding configuration, and cost optimization.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Integration: LLM Configuration

Configuring LLM clients for OpenIE extraction and embeddings.

## LLM Requirements in HippoRAG

HippoRAG uses LLMs for two purposes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Usage in HippoRAG                        │
├─────────────────────────────────┬───────────────────────────────┤
│         Extraction LLM          │       Embedding Model         │
├─────────────────────────────────┼───────────────────────────────┤
│ • OpenIE triple extraction      │ • Entity embeddings           │
│ • Entity typing                 │ • Query embeddings            │
│ • Relation normalization        │ • Similarity search           │
│                                 │                               │
│ Needs: Strong instruction       │ Needs: Semantic similarity    │
│ following, structured output    │ Dense vectors, fast inference │
├─────────────────────────────────┼───────────────────────────────┤
│ Recommended: GPT-4o, Claude     │ Recommended: text-embedding-3 │
│ Sonnet, Llama 70B+              │ small, NV-Embed, GritLM       │
└─────────────────────────────────┴───────────────────────────────┘
```

## Quick Setup

### OpenAI (Recommended)

```python
import os
from hipporag import HippoRAG

os.environ["OPENAI_API_KEY"] = "sk-..."

hippo = HippoRAG(
    backend="kuzu",
    llm_model="gpt-4o-mini",           # For extraction
    embedding_model="text-embedding-3-small"  # For embeddings
)
```

### Anthropic Claude

```python
import os
from hipporag import HippoRAG

os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."

hippo = HippoRAG(
    backend="kuzu",
    llm_provider="anthropic",
    llm_model="claude-sonnet-4-5-latest",
    embedding_provider="openai",        # Anthropic doesn't have embeddings
    embedding_model="text-embedding-3-small"
)
```

### Local Models (Ollama)

```python
from hipporag import HippoRAG

hippo = HippoRAG(
    backend="kuzu",
    llm_provider="ollama",
    llm_model="llama3.3:70b",
    llm_base_url="http://localhost:11434",
    embedding_provider="ollama",
    embedding_model="nomic-embed-text",
    embedding_dim=768
)
```

---

## Extraction LLM Configuration

### OpenAI

```python
from hipporag.llm import OpenAIClient, LLMConfig

config = LLMConfig(
    api_key=os.environ["OPENAI_API_KEY"],
    model="gpt-4o-mini",              # Primary model
    small_model="gpt-4o-mini",        # For simple tasks
    temperature=0.0,                   # Deterministic extraction
    max_tokens=4096,                   # Max output tokens
    timeout=60                         # Request timeout
)

llm_client = OpenAIClient(config=config)

hippo = HippoRAG(
    backend="kuzu",
    llm_client=llm_client
)
```

### Anthropic Claude

```python
from hipporag.llm import AnthropicClient, LLMConfig

config = LLMConfig(
    api_key=os.environ["ANTHROPIC_API_KEY"],
    model="claude-sonnet-4-5-latest",
    small_model="claude-haiku-4-5-latest",
    temperature=0.0,
    max_tokens=4096
)

llm_client = AnthropicClient(config=config)

hippo = HippoRAG(
    backend="kuzu",
    llm_client=llm_client
)
```

### Local vLLM Server

```python
from hipporag.llm import OpenAIGenericClient, LLMConfig

# vLLM exposes OpenAI-compatible API
config = LLMConfig(
    api_key="not-needed",              # vLLM doesn't require key
    model="meta-llama/Llama-3.3-70B-Instruct",
    base_url="http://localhost:8000/v1",
    temperature=0.0
)

llm_client = OpenAIGenericClient(config=config)

hippo = HippoRAG(
    backend="kuzu",
    llm_client=llm_client
)
```

### vLLM Offline Mode (Batch Processing)

For large-scale indexing, vLLM offline mode is 3x faster:

```python
from hipporag.llm import VLLMOfflineClient

# Direct GPU access, no HTTP overhead
llm_client = VLLMOfflineClient(
    model="meta-llama/Llama-3.3-70B-Instruct",
    tensor_parallel_size=4,            # Use 4 GPUs
    gpu_memory_utilization=0.9,
    max_model_len=32768
)

hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    llm_client=llm_client
)

# Process documents in batch
await hippo.add_episode_bulk(documents, batch_size=100)
```

### Ollama

```python
from hipporag.llm import OllamaClient

llm_client = OllamaClient(
    model="llama3.3:70b",
    host="http://localhost:11434",
    options={
        "num_ctx": 32768,              # Context window
        "temperature": 0.0
    }
)

hippo = HippoRAG(
    backend="kuzu",
    llm_client=llm_client
)
```

---

## Embedding Configuration

### OpenAI Embeddings

```python
from hipporag.embedder import OpenAIEmbedder, EmbedderConfig

config = EmbedderConfig(
    api_key=os.environ["OPENAI_API_KEY"],
    model="text-embedding-3-small",    # or text-embedding-3-large
    embedding_dim=1536,                 # 1536 for small, 3072 for large
    batch_size=100                      # Batch embedding requests
)

embedder = OpenAIEmbedder(config=config)

hippo = HippoRAG(
    backend="kuzu",
    embedder=embedder
)
```

### Voyage AI Embeddings

```python
from hipporag.embedder import VoyageEmbedder, EmbedderConfig

config = EmbedderConfig(
    api_key=os.environ["VOYAGE_API_KEY"],
    model="voyage-3",
    embedding_dim=1024
)

embedder = VoyageEmbedder(config=config)
```

### Local Embeddings (Ollama)

```python
from hipporag.embedder import OllamaEmbedder, EmbedderConfig

config = EmbedderConfig(
    model="nomic-embed-text",
    host="http://localhost:11434",
    embedding_dim=768
)

embedder = OllamaEmbedder(config=config)
```

### NVIDIA NV-Embed-v2 (High Quality)

```python
from hipporag.embedder import NVIDIAEmbedder, EmbedderConfig

config = EmbedderConfig(
    api_key=os.environ["NVIDIA_API_KEY"],
    model="nvidia/nv-embed-v2",
    embedding_dim=4096
)

embedder = NVIDIAEmbedder(config=config)
```

---

## Model Selection Guide

### Extraction Model Recommendations

| Use Case | Model | Cost | Quality |
|----------|-------|------|---------|
| **Production (cloud)** | GPT-4o-mini | $$ | Excellent |
| **High quality** | GPT-4o | $$$$ | Best |
| **Anthropic** | Claude Sonnet | $$$ | Excellent |
| **Self-hosted** | Llama 3.3 70B | $ (compute) | Very Good |
| **Resource-constrained** | Qwen2.5 32B | $ | Good |

### Embedding Model Recommendations

| Use Case | Model | Dimensions | Quality |
|----------|-------|------------|---------|
| **General purpose** | text-embedding-3-small | 1536 | Very Good |
| **Best quality** | text-embedding-3-large | 3072 | Excellent |
| **Self-hosted** | nomic-embed-text | 768 | Good |
| **Multilingual** | BAAI/bge-m3 | 1024 | Excellent |
| **Code** | voyage-code-2 | 1024 | Excellent |

### Don't Use These for Extraction

| Model | Reason |
|-------|--------|
| o1, o1-mini | Reasoning models add latency, no quality gain |
| GPT-3.5-turbo | Poor structured output |
| Small local models (<7B) | Insufficient for complex extraction |

---

## Cost Optimization

### Batch Processing

```python
# Process documents in batches to reduce API calls
await hippo.add_episode_bulk(
    documents,
    batch_size=20,           # Combine into fewer API calls
    max_concurrency=5        # Parallel requests
)
```

### Caching

```python
# Enable LLM response caching
hippo = HippoRAG(
    backend="kuzu",
    llm_cache_enabled=True,
    llm_cache_path="./llm_cache/"
)

# Subsequent identical extractions will use cache
```

### Tiered Model Usage

```python
from hipporag.llm import TieredLLMClient

# Use cheaper model for simple tasks, better model for complex
client = TieredLLMClient(
    simple_model="gpt-4o-mini",        # Entity typing, simple extraction
    complex_model="gpt-4o",            # Complex document extraction
    complexity_threshold=0.7           # Switch at this complexity
)
```

### Cost Estimation

```python
# Estimate indexing cost before processing
estimate = await hippo.estimate_indexing_cost(
    documents=documents,
    extraction_model="gpt-4o-mini",
    embedding_model="text-embedding-3-small"
)

print(f"Documents: {estimate['document_count']}")
print(f"Est. tokens: {estimate['total_tokens']:,}")
print(f"Extraction cost: ${estimate['extraction_cost']:.2f}")
print(f"Embedding cost: ${estimate['embedding_cost']:.2f}")
print(f"Total est. cost: ${estimate['total_cost']:.2f}")
```

---

## Rate Limiting

### OpenAI Rate Limits

```python
from hipporag import HippoRAG

# Configure for rate limits
hippo = HippoRAG(
    backend="kuzu",
    max_concurrent_llm_calls=5,        # Parallel requests
    llm_retry_count=3,                 # Retries on rate limit
    llm_retry_delay=1.0                # Base delay (exponential backoff)
)
```

### Semaphore Control

```python
import os

# Control concurrency via environment variable
os.environ["SEMAPHORE_LIMIT"] = "5"    # Max concurrent LLM calls

# Tune based on your API tier:
# OpenAI Tier 1 (free): 1-2
# OpenAI Tier 2: 5-10
# OpenAI Tier 3+: 10-20
# Anthropic default: 5-8
# Local Ollama: 1-5 (based on VRAM)
```

---

## Local Model Setup

### Ollama Setup

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.3:70b           # Extraction model
ollama pull nomic-embed-text       # Embedding model

# Start server (default port 11434)
ollama serve
```

### vLLM Server Setup

```bash
# Install vLLM
pip install vllm

# Start server
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-3.3-70B-Instruct \
    --tensor-parallel-size 4 \
    --port 8000
```

### vLLM + TEI (Text Embeddings Inference)

```yaml
# docker-compose.yml
version: '3.8'
services:
  vllm:
    image: vllm/vllm-openai:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 4
              capabilities: [gpu]
    ports:
      - "8000:8000"
    command: >
      --model meta-llama/Llama-3.3-70B-Instruct
      --tensor-parallel-size 4

  embeddings:
    image: ghcr.io/huggingface/text-embeddings-inference:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    ports:
      - "8080:80"
    command: >
      --model-id BAAI/bge-m3
      --max-client-batch-size 128
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid API key | Check API key env var |
| 429 Rate Limited | Too many requests | Reduce SEMAPHORE_LIMIT |
| Timeout | Model too slow | Increase timeout, use faster model |
| Poor extraction | Weak model | Use stronger model (GPT-4o) |
| Missing embeddings | Provider mismatch | Ensure embedding provider configured |
| OOM on local | Model too large | Use quantized model, reduce batch size |

## Reference

### Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Voyage
VOYAGE_API_KEY=voyage-...

# NVIDIA
NVIDIA_API_KEY=nvapi-...

# Rate limiting
SEMAPHORE_LIMIT=5

# Local models
OLLAMA_HOST=http://localhost:11434
VLLM_BASE_URL=http://localhost:8000/v1
```

### Model Pricing Reference (as of 2025)

| Model | Input ($/1M tokens) | Output ($/1M tokens) |
|-------|---------------------|----------------------|
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4o | $2.50 | $10.00 |
| claude-sonnet-4-5 | $3.00 | $15.00 |
| text-embedding-3-small | $0.02 | N/A |
| text-embedding-3-large | $0.13 | N/A |

## Related Sub-Skills

- **core-indexing**: Uses LLM for triple extraction
- **integration-backends**: Stores embeddings in graph database
- **comparison-graphrag**: Different approaches have different LLM costs
- **recipes-use-cases**: Cost considerations for different use cases
