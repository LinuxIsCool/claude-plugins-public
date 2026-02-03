# Purpose

Select the optimal embedding model for your specific use case. This guide provides a systematic framework for evaluating models across quality, speed, cost, and infrastructure constraints.

## Variables

EVALUATION_METRICS: MTEB_score, latency_ms, memory_mb, cost_per_million_tokens
INFRASTRUCTURE_TYPES: cpu_only, consumer_gpu, professional_gpu, api_only
USE_CASE_CATEGORIES: retrieval, classification, clustering, semantic_similarity, multilingual

## Instructions

### Decision Framework

Use this flowchart to narrow down your model choice:

```
START
  |
  v
[Do you need multilingual support?]
  |
  +--YES--> BGE-M3 (1024 dims, local) or text-embedding-3-small (API)
  |
  +--NO--> Continue
            |
            v
      [Is latency critical (<10ms)?]
            |
            +--YES--> all-MiniLM-L6-v2 (384 dims, 2ms GPU)
            |
            +--NO--> Continue
                      |
                      v
                [Do you have a GPU?]
                      |
                      +--NO--> all-MiniLM-L6-v2 (CPU) or OpenAI API
                      |
                      +--YES--> Continue
                                |
                                v
                          [GPU Memory Available?]
                                |
                                +--<8GB--> Qwen3-0.6B or EmbeddingGemma-300M
                                |
                                +--8-16GB--> Qwen3-4B or BGE-M3
                                |
                                +-->16GB--> Qwen3-8B or E5-Mistral-7B
```

### Model Comparison Matrix

#### Tier 1: Frontier Models (Maximum Quality)

| Model | Dims | MTEB Avg | Retrieval | Params | GPU Req | Latency |
|-------|------|----------|-----------|--------|---------|---------|
| Qwen3-8B | 4096 | 70.58 | Excellent | 8B | 16GB | 200ms |
| E5-Mistral-7B | 4096 | ~68 | Excellent | 7B | 14GB | 180ms |
| NV-Embed-v2 | 4096 | ~69 | Excellent | 7B | 14GB | 150ms |
| voyage-3 | 1024 | ~67 | Excellent | API | - | 50ms |

**When to use**: Research applications, multi-hop reasoning, complex RAG pipelines where accuracy is paramount.

#### Tier 2: Balanced Models (Quality + Efficiency)

| Model | Dims | MTEB Avg | Retrieval | Params | GPU Req | Latency |
|-------|------|----------|-----------|--------|---------|---------|
| Qwen3-4B | 2048 | ~68 | Very Good | 4B | 8GB | 50ms |
| EmbeddingGemma-300M | 768 | ~62 | Good | 300M | 600MB | 10ms |
| BGE-M3 | 1024 | ~62 | Very Good | 1B | 2GB | 25ms |
| text-embedding-3-small | 1536 | ~61 | Good | API | - | 30ms |

**When to use**: Production RAG systems, general-purpose semantic search, balance of quality and cost.

#### Tier 3: Lightweight Models (Speed + Efficiency)

| Model | Dims | MTEB Avg | Retrieval | Params | GPU Req | Latency |
|-------|------|----------|-----------|--------|---------|---------|
| Qwen3-0.6B | 1024 | ~60 | Good | 600M | 1.2GB | 15ms |
| all-MiniLM-L6-v2 | 384 | ~56 | Moderate | 22M | 44MB | 2ms |
| nomic-embed-text | 768 | ~55 | Moderate | 137M | 300MB | 8ms |
| bge-small-en-v1.5 | 384 | ~54 | Moderate | 33M | 66MB | 3ms |

**When to use**: Edge deployment, real-time applications, high-throughput pipelines, CPU-only environments.

### Selection by Use Case

#### Retrieval-Augmented Generation (RAG)

```python
# Production RAG - Balance quality and cost
RECOMMENDED = {
    "api": "text-embedding-3-small",      # $0.02/1M tokens
    "local_cpu": "all-MiniLM-L6-v2",      # Fast, reliable
    "local_gpu": "BGE-M3",                 # Good quality, hybrid search
    "quality_priority": "Qwen3-4B",        # Higher quality
}
```

#### Document Classification

```python
# Classification benefits from larger dimensions
RECOMMENDED = {
    "api": "text-embedding-3-large",       # Best classification
    "local": "Qwen3-Embedding",            # Strong on MTEB classification
    "budget": "all-MiniLM-L6-v2",          # Serviceable
}
```

#### Multilingual Applications

```python
# Multilingual requires specialized models
RECOMMENDED = {
    "best_coverage": "BGE-M3",             # 100+ languages
    "api": "text-embedding-3-small",       # Good multilingual
    "local_efficient": "multilingual-e5-small",  # Lighter weight
}
```

#### Real-Time / Low-Latency

```python
# Sub-10ms latency requirements
RECOMMENDED = {
    "fastest_local": "all-MiniLM-L6-v2",   # 2ms GPU, 20ms CPU
    "fastest_api": "text-embedding-3-small",  # ~30ms network included
    "onnx_optimized": "all-MiniLM-L6-v2",  # 1.5ms with ONNX
}
```

### Cost Analysis

#### API Models (per 1M tokens)

| Model | Cost | Dimensions | Notes |
|-------|------|------------|-------|
| text-embedding-3-small | $0.02 | 1536 | Best value API |
| text-embedding-3-large | $0.13 | 3072 | Premium quality |
| voyage-3 | $0.06 | 1024 | Retrieval optimized |
| voyage-3-lite | $0.02 | 512 | Budget option |

#### Local Models (Compute Cost Estimate)

| Model | GPU Hours/1M docs | Estimated Cost* |
|-------|-------------------|-----------------|
| all-MiniLM-L6-v2 | 0.14 | $0.03 |
| BGE-M3 | 0.56 | $0.12 |
| Qwen3-4B | 2.8 | $0.60 |
| Qwen3-8B | 5.6 | $1.20 |

*Based on $0.21/GPU-hour (AWS g4dn.xlarge spot)

### Infrastructure Requirements

#### CPU-Only Deployment

```python
# Best options for CPU-only
models = [
    {
        "name": "all-MiniLM-L6-v2",
        "memory": "44MB",
        "latency": "20ms",
        "throughput": "200 docs/s (batch=32)"
    },
    {
        "name": "all-MiniLM-L6-v2 + ONNX",
        "memory": "35MB",
        "latency": "1.5ms",
        "throughput": "2000 docs/s (batch=32)"
    },
    {
        "name": "nomic-embed-text",
        "memory": "300MB",
        "latency": "50ms",
        "throughput": "80 docs/s (batch=32)"
    }
]
```

#### Consumer GPU (8-12GB VRAM)

```python
# RTX 3080/4080 or similar
models = [
    {
        "name": "Qwen3-4B",
        "vram": "8GB",
        "latency": "50ms",
        "quality": "High"
    },
    {
        "name": "BGE-M3",
        "vram": "2GB",
        "latency": "25ms",
        "quality": "Good"
    },
    {
        "name": "EmbeddingGemma-300M",
        "vram": "600MB",
        "latency": "10ms",
        "quality": "Good (for size)"
    }
]
```

#### Professional GPU (24GB+ VRAM)

```python
# A100, H100, RTX 4090
models = [
    {
        "name": "Qwen3-8B",
        "vram": "16GB",
        "latency": "200ms",
        "quality": "State-of-the-art"
    },
    {
        "name": "NV-Embed-v2",
        "vram": "14GB",
        "latency": "150ms",
        "quality": "Excellent retrieval"
    },
    {
        "name": "E5-Mistral-7B",
        "vram": "14GB",
        "latency": "180ms",
        "quality": "Excellent general"
    }
]
```

### Dimension Tradeoffs

| Dimensions | Storage/doc | Quality Impact | Recommended For |
|------------|-------------|----------------|-----------------|
| 384 | 1.5 KB | Baseline | General use, speed priority |
| 768 | 3 KB | +5-10% | Better semantic capture |
| 1024 | 4 KB | +10-15% | Multilingual, complex queries |
| 1536 | 6 KB | +15-20% | Classification, API default |
| 4096 | 16 KB | +20-30% | Research, maximum quality |

**Storage Impact at Scale:**
```
1M documents:
  384 dims  → 1.5 GB
  1024 dims → 4 GB
  4096 dims → 16 GB

10M documents:
  384 dims  → 15 GB
  1024 dims → 40 GB
  4096 dims → 160 GB
```

### Recommendation Summary

| Scenario | Model | Why |
|----------|-------|-----|
| Starting out | all-MiniLM-L6-v2 | Fast, free, good baseline |
| Production API | text-embedding-3-small | Reliable, cost-effective |
| Quality priority | Qwen3-4B or text-embedding-3-large | Best MTEB scores |
| Multilingual | BGE-M3 | 100+ languages, hybrid search |
| Edge/Mobile | all-MiniLM-L6-v2 + ONNX | Tiny footprint, fast |
| Research | NV-Embed-v2 or Qwen3-8B | Maximum capability |

## Performance Characteristics

### Benchmark Methodology

All benchmarks measured on:
- CPU: Intel Xeon 8375C (AWS c6i.xlarge)
- GPU: NVIDIA A10 (AWS g5.xlarge)
- Batch sizes: 1, 8, 32, 128
- Sequence length: 128 tokens average

### Latency vs Quality Tradeoff

```
Quality (MTEB Score)
^
|        Qwen3-8B *
|    NV-Embed-v2 *    * E5-Mistral-7B
|           Qwen3-4B *
|    BGE-M3 *    * text-embedding-3-small
|
| all-MiniLM-L6-v2 *
|
+---------------------------------> Latency (log scale)
     1ms    10ms   100ms   1000ms
```

## Next Steps

- **Implementation**: Choose your model, then see the appropriate cookbook:
  - `cookbook/sentence-transformers.md` for local models
  - `cookbook/openai-embeddings.md` for API models
  - `cookbook/ollama-embeddings.md` for Ollama-based deployment
- **Optimization**: See `cookbook/onnx-optimization.md` for CPU speedup
- **Evaluation**: Use `tools/embedding_benchmark.py` to test on your data
