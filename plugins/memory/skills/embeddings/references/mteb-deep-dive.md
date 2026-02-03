# MTEB Benchmark Deep Dive

Detailed analysis of embedding model benchmarks and selection guidance.

## MTEB Overview

MTEB (Massive Text Embedding Benchmark) evaluates embeddings across:
- Retrieval tasks
- Classification
- Clustering
- Pair classification
- Reranking
- Semantic textual similarity (STS)
- Summarization

## Current Leaderboard Analysis (Late 2024)

### Tier 1: Frontier Models

| Model | Avg Score | Retrieval | Dimensions | Size |
|-------|-----------|-----------|------------|------|
| NV-Embed-v2 | ~69 | Excellent | 4096 | 7B |
| Qwen3-Embedding | ~68 | Excellent | Variable | 3B |
| voyage-3 | ~67 | Excellent | 1024 | API |
| text-embedding-3-large | ~65 | Very Good | 3072 | API |

### Tier 2: Balanced Performance

| Model | Avg Score | Retrieval | Dimensions | Size |
|-------|-----------|-----------|------------|------|
| GritLM-7B | ~63 | Very Good | 4096 | 7B |
| BGE-M3 | ~62 | Very Good | 1024 | 1B |
| text-embedding-3-small | ~61 | Good | 1536 | API |
| bge-large-en-v1.5 | ~59 | Good | 1024 | 335M |

### Tier 3: Efficient Models

| Model | Avg Score | Retrieval | Dimensions | Size |
|-------|-----------|-----------|------------|------|
| all-MiniLM-L6-v2 | ~56 | Moderate | 384 | 22M |
| nomic-embed-text | ~55 | Moderate | 768 | 137M |
| Contriever | ~54 | Moderate | 768 | 110M |

## Task-Specific Performance

### Best for Retrieval

1. NV-Embed-v2 - Highest retrieval scores
2. voyage-3 - Excellent, API-based
3. GritLM-7B - Strong open-source option
4. BGE-M3 - Best multilingual retrieval

### Best for Classification

1. text-embedding-3-large
2. Qwen3-Embedding
3. BGE-large-en-v1.5

### Best for Clustering

1. NV-Embed-v2
2. voyage-3
3. text-embedding-3-large

## Model Details

### NV-Embed-v2

```yaml
Provider: NVIDIA
Dimensions: 4096
Max Tokens: 32,768
Architecture: Decoder-only LLM with bidirectional attention
Strengths:
  - Highest overall MTEB score
  - Excellent retrieval performance
  - Long context support
Weaknesses:
  - Large model size (7B parameters)
  - GPU required
  - Higher latency
```

### GritLM-7B

```yaml
Provider: GritLM
Dimensions: 4096
Max Tokens: 4096
Architecture: Dual-mode (generative + embedding)
Strengths:
  - Can generate text AND produce embeddings
  - Strong retrieval performance
  - Open-source
Weaknesses:
  - Large model size
  - GPU required
```

### BGE-M3

```yaml
Provider: BAAI
Dimensions: 1024
Max Tokens: 8192
Architecture: Dense + sparse retrieval
Strengths:
  - Excellent multilingual support
  - Hybrid dense/sparse search
  - Moderate size
Weaknesses:
  - Lower English-only performance vs specialized models
```

### all-MiniLM-L6-v2

```yaml
Provider: Sentence Transformers
Dimensions: 384
Max Tokens: 256
Architecture: Distilled BERT
Strengths:
  - Very fast inference
  - CPU-friendly
  - Small model size (22M)
  - Widely supported
Weaknesses:
  - Lower accuracy
  - Short context window
  - English-focused
```

### text-embedding-3-small

```yaml
Provider: OpenAI
Dimensions: 1536 (or smaller via dimension reduction)
Max Tokens: 8191
Strengths:
  - Easy API access
  - Good balance of quality/cost
  - Dimension reduction option
Weaknesses:
  - API dependency
  - Cost per token
  - No local option
```

## Cost Analysis

### API Models (per 1M tokens)

| Model | Cost | Notes |
|-------|------|-------|
| text-embedding-3-small | $0.02 | Best value |
| text-embedding-3-large | $0.13 | Higher quality |
| voyage-3 | $0.06 | Retrieval focused |

### Local Models (Compute Cost)

| Model | GPU Memory | Throughput |
|-------|------------|------------|
| NV-Embed-v2 | ~14GB | ~100 docs/s |
| GritLM-7B | ~14GB | ~100 docs/s |
| BGE-M3 | ~2GB | ~500 docs/s |
| all-MiniLM-L6-v2 | ~500MB | ~2000 docs/s |

## Selection Guidelines

### By Budget

```
Tight budget + high volume:
  → all-MiniLM-L6-v2 (local) or text-embedding-3-small (API)

Moderate budget:
  → text-embedding-3-small or BGE-M3

Quality priority:
  → text-embedding-3-large or NV-Embed-v2
```

### By Infrastructure

```
CPU only:
  → all-MiniLM-L6-v2, nomic-embed-text

Consumer GPU (8-12GB):
  → BGE-large, bge-m3

Professional GPU (24GB+):
  → NV-Embed-v2, GritLM-7B

API preferred:
  → text-embedding-3-small/large, voyage-3
```

### By Use Case

```
RAG/Retrieval:
  → NV-Embed-v2 (quality) or text-embedding-3-small (balance)

Classification:
  → text-embedding-3-large

Multilingual:
  → BGE-M3 or text-embedding-3-small

Real-time/Low-latency:
  → all-MiniLM-L6-v2
```

## Benchmark Caveats

1. **MTEB is not perfect**: Real-world performance may differ
2. **Domain matters**: General benchmarks may not reflect domain-specific needs
3. **Latency not measured**: MTEB doesn't account for inference speed
4. **Context length varies**: Short vs long document performance differs

## Recommended Evaluation Approach

1. **Start with baseline**: Use text-embedding-3-small or all-MiniLM-L6-v2
2. **Test on YOUR data**: Create evaluation set from actual use case
3. **Measure retrieval quality**: Precision@K, recall@K, MRR
4. **Consider latency**: Time end-to-end retrieval
5. **Scale if needed**: Upgrade only when baseline insufficient

## Additional Resources

- MTEB Leaderboard: https://huggingface.co/spaces/mteb/leaderboard
- Sentence Transformers: https://sbert.net/
- BAAI BGE: https://huggingface.co/BAAI
- NVIDIA NV-Embed: https://huggingface.co/nvidia/NV-Embed-v2
