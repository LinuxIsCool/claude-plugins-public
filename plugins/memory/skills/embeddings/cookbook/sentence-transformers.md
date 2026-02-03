# Purpose

Comprehensive guide to using the sentence-transformers library for local embedding generation. Covers installation, model loading, encoding patterns, and advanced features.

## Variables

LIBRARY_VERSION: 3.0+
DEFAULT_MODEL: all-MiniLM-L6-v2
ADVANCED_MODELS: BGE-M3, EmbeddingGemma-300M, Qwen3-Embedding
POOLING_STRATEGIES: mean, cls, max, weighted_mean
SUPPORTED_FORMATS: pytorch, onnx, openvino

## Instructions

### Installation

```bash
# Basic installation
pip install sentence-transformers

# With GPU support (CUDA)
pip install sentence-transformers torch --index-url https://download.pytorch.org/whl/cu121

# With all optional dependencies
pip install sentence-transformers[all]

# Specific version for reproducibility
pip install sentence-transformers==3.0.1
```

### Basic Usage

#### Loading Models

```python
from sentence_transformers import SentenceTransformer

# Load from HuggingFace Hub (auto-downloads)
model = SentenceTransformer('all-MiniLM-L6-v2')

# Load with specific device
model = SentenceTransformer('all-MiniLM-L6-v2', device='cuda')
model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
model = SentenceTransformer('all-MiniLM-L6-v2', device='mps')  # Apple Silicon

# Load from local path
model = SentenceTransformer('/path/to/local/model')

# Load with trust_remote_code (required for some models)
model = SentenceTransformer('BAAI/bge-m3', trust_remote_code=True)
```

#### Encoding Text

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Single text
embedding = model.encode("Hello world")
print(f"Shape: {embedding.shape}")  # (384,)

# Multiple texts
texts = ["First document", "Second document", "Third document"]
embeddings = model.encode(texts)
print(f"Shape: {embeddings.shape}")  # (3, 384)

# Return as PyTorch tensor
embeddings = model.encode(texts, convert_to_tensor=True)
print(f"Device: {embeddings.device}")  # cuda:0 or cpu

# Return as numpy array (default)
embeddings = model.encode(texts, convert_to_numpy=True)
print(f"Type: {type(embeddings)}")  # numpy.ndarray
```

### Advanced Encoding Options

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')
texts = [f"Document {i}" for i in range(10000)]

# Batch processing with progress bar
embeddings = model.encode(
    texts,
    batch_size=64,
    show_progress_bar=True,
    convert_to_tensor=True
)

# Normalize embeddings (for cosine similarity)
embeddings = model.encode(
    texts,
    normalize_embeddings=True  # L2 normalization
)

# Multi-GPU encoding
model = SentenceTransformer('all-MiniLM-L6-v2', device='cuda')
pool = model.start_multi_process_pool()
embeddings = model.encode_multi_process(texts, pool)
model.stop_multi_process_pool(pool)
```

### Popular Models

#### all-MiniLM-L6-v2 (Default)

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Specs
print(f"Max sequence length: {model.max_seq_length}")  # 256
print(f"Embedding dimension: {model.get_sentence_embedding_dimension()}")  # 384
```

| Property | Value |
|----------|-------|
| Parameters | 22M |
| Dimensions | 384 |
| Max Tokens | 256 |
| Speed (CPU) | ~20ms |
| Speed (GPU) | ~2ms |

#### BGE-M3 (Multilingual + Hybrid)

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('BAAI/bge-m3', trust_remote_code=True)

# Dense embeddings (default)
dense_embeddings = model.encode(["Hello world"])

# Access sparse embeddings for hybrid search
# Note: Requires using the model directly for full functionality
```

| Property | Value |
|----------|-------|
| Parameters | ~568M |
| Dimensions | 1024 |
| Max Tokens | 8192 |
| Languages | 100+ |
| Features | Dense + Sparse + ColBERT |

#### EmbeddingGemma-300M

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('google/embedding-gemma-300m')

# Efficient quality-to-size ratio
embeddings = model.encode(["Technical documentation about APIs"])
```

| Property | Value |
|----------|-------|
| Parameters | 300M |
| Dimensions | 768 |
| Max Tokens | 2048 |
| Quality | Rivals 2x larger models |

#### Qwen3-Embedding

```python
from sentence_transformers import SentenceTransformer

# Requires trust_remote_code for Qwen models
model = SentenceTransformer(
    'Qwen/Qwen3-Embedding-0.6B',
    trust_remote_code=True
)

embeddings = model.encode(
    ["Complex query requiring deep understanding"],
    prompt_name="query"  # Task-specific prompting
)
```

| Variant | Parameters | Dimensions | VRAM |
|---------|------------|------------|------|
| Qwen3-0.6B | 600M | 1024 | 1.2GB |
| Qwen3-4B | 4B | 2048 | 8GB |
| Qwen3-8B | 8B | 4096 | 16GB |

### Similarity Computation

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

# Encode sentences
sentences = [
    "The weather is nice today",
    "It's a beautiful day outside",
    "I love programming in Python"
]
embeddings = model.encode(sentences, convert_to_tensor=True)

# Cosine similarity matrix
cosine_scores = util.cos_sim(embeddings, embeddings)
print(cosine_scores)

# Dot product similarity (for normalized embeddings)
dot_scores = util.dot_score(embeddings, embeddings)

# Pairwise cosine similarity
pairs = [(0, 1), (0, 2), (1, 2)]
for i, j in pairs:
    score = util.cos_sim(embeddings[i], embeddings[j])
    print(f"{sentences[i]} <-> {sentences[j]}: {score.item():.4f}")
```

### Semantic Search

```python
from sentence_transformers import SentenceTransformer, util
import torch

model = SentenceTransformer('all-MiniLM-L6-v2')

# Corpus
corpus = [
    "Python is a programming language",
    "Machine learning uses algorithms",
    "Natural language processing handles text",
    "Deep learning requires neural networks",
    "Data science combines statistics and coding"
]
corpus_embeddings = model.encode(corpus, convert_to_tensor=True)

# Query
query = "What programming languages are used for AI?"
query_embedding = model.encode(query, convert_to_tensor=True)

# Semantic search
results = util.semantic_search(
    query_embedding,
    corpus_embeddings,
    top_k=3
)

print(f"Query: {query}\n")
for hit in results[0]:
    print(f"  [{hit['score']:.4f}] {corpus[hit['corpus_id']]}")
```

### Task-Specific Prompting

Modern embedding models support task-specific prompts for better performance.

```python
from sentence_transformers import SentenceTransformer

# Models with prompt templates
model = SentenceTransformer('intfloat/e5-large-v2')

# For E5 models: prefix with "query:" or "passage:"
queries = ["query: What is machine learning?"]
passages = ["passage: Machine learning is a subset of AI..."]

query_embeddings = model.encode(queries)
passage_embeddings = model.encode(passages)

# For BGE models: prefix with "Represent this sentence:"
model = SentenceTransformer('BAAI/bge-large-en-v1.5')
queries = ["Represent this sentence for retrieval: What is ML?"]
```

### Custom Pooling

```python
from sentence_transformers import SentenceTransformer
from sentence_transformers.models import Transformer, Pooling

# Build custom model with specific pooling
word_embedding_model = Transformer('bert-base-uncased')
pooling_model = Pooling(
    word_embedding_model.get_word_embedding_dimension(),
    pooling_mode_mean_tokens=False,
    pooling_mode_cls_token=True,  # Use [CLS] token
    pooling_mode_max_tokens=False
)

model = SentenceTransformer(modules=[word_embedding_model, pooling_model])
embeddings = model.encode(["Test sentence"])
```

### Saving and Loading

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Save locally
model.save('/path/to/my_model')

# Load from local path
loaded_model = SentenceTransformer('/path/to/my_model')

# Export to ONNX (see onnx-optimization.md)
# Export to OpenVINO
```

### Memory Management

```python
from sentence_transformers import SentenceTransformer
import torch
import gc

model = SentenceTransformer('all-MiniLM-L6-v2', device='cuda')

# Process large corpus in chunks
def encode_large_corpus(texts, model, batch_size=32, chunk_size=10000):
    all_embeddings = []

    for i in range(0, len(texts), chunk_size):
        chunk = texts[i:i + chunk_size]
        embeddings = model.encode(
            chunk,
            batch_size=batch_size,
            convert_to_numpy=True,
            show_progress_bar=True
        )
        all_embeddings.append(embeddings)

        # Clear GPU cache periodically
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()

    return np.vstack(all_embeddings)

# Use half precision for memory savings
model.half()  # Convert to FP16
embeddings = model.encode(texts)
```

### Error Handling

```python
from sentence_transformers import SentenceTransformer
import logging

logging.basicConfig(level=logging.INFO)

def safe_encode(model, texts, **kwargs):
    """Encode with error handling and retry logic."""
    max_retries = 3

    for attempt in range(max_retries):
        try:
            return model.encode(texts, **kwargs)
        except RuntimeError as e:
            if "out of memory" in str(e).lower():
                logging.warning(f"OOM on attempt {attempt + 1}, reducing batch size")
                kwargs['batch_size'] = kwargs.get('batch_size', 32) // 2
                if kwargs['batch_size'] < 1:
                    raise
                import torch
                torch.cuda.empty_cache()
            else:
                raise

    raise RuntimeError("Failed after max retries")

# Usage
model = SentenceTransformer('all-MiniLM-L6-v2')
embeddings = safe_encode(model, large_text_list, batch_size=64)
```

## Performance Characteristics

### Throughput by Model

| Model | CPU (docs/s) | GPU (docs/s) | Memory |
|-------|--------------|--------------|--------|
| all-MiniLM-L6-v2 | 200 | 2000 | 44MB |
| bge-small-en-v1.5 | 180 | 1800 | 66MB |
| bge-base-en-v1.5 | 80 | 1200 | 220MB |
| bge-large-en-v1.5 | 40 | 600 | 670MB |
| BGE-M3 | 20 | 400 | 1.1GB |

*Benchmarked with batch_size=32, sequence length=128*

### Latency by Batch Size

| Batch Size | all-MiniLM (CPU) | all-MiniLM (GPU) | BGE-M3 (GPU) |
|------------|------------------|------------------|--------------|
| 1 | 20ms | 2ms | 25ms |
| 8 | 80ms | 4ms | 50ms |
| 32 | 200ms | 8ms | 100ms |
| 128 | 600ms | 20ms | 300ms |

### Memory Usage

```python
# Estimate memory for embedding storage
def estimate_memory(num_docs, dimensions, dtype='float32'):
    bytes_per_element = {'float32': 4, 'float16': 2, 'int8': 1}
    total_bytes = num_docs * dimensions * bytes_per_element[dtype]
    return total_bytes / (1024 ** 3)  # GB

# Examples
print(f"1M docs @ 384 dims: {estimate_memory(1_000_000, 384):.2f} GB")   # 1.43 GB
print(f"1M docs @ 1024 dims: {estimate_memory(1_000_000, 1024):.2f} GB") # 3.81 GB
print(f"1M docs @ 4096 dims: {estimate_memory(1_000_000, 4096):.2f} GB") # 15.26 GB
```

## Next Steps

- **Optimization**: See `cookbook/onnx-optimization.md` for 10x faster CPU inference
- **Batch Processing**: See `cookbook/batch-processing.md` for production pipelines
- **Matryoshka**: See `cookbook/matryoshka.md` for multi-resolution embeddings
- **Benchmarking**: Use `tools/embedding_benchmark.py` to test on your data
