# Purpose

Generate embeddings locally using Ollama. Zero API costs, full privacy, and reasonable quality for most use cases. Covers installation, model selection, and production patterns.

## Variables

OLLAMA_API_BASE: http://localhost:11434
DEFAULT_MODEL: nomic-embed-text
ALTERNATIVE_MODELS: mxbai-embed-large, all-minilm, snowflake-arctic-embed
MAX_CONCURRENT_REQUESTS: 10
DEFAULT_TIMEOUT: 60

## Instructions

### Installation

#### Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download

# Start the Ollama server
ollama serve
```

#### Pull Embedding Models

```bash
# Recommended: nomic-embed-text (768 dims, Matryoshka support)
ollama pull nomic-embed-text

# Alternative: mxbai-embed-large (1024 dims, higher quality)
ollama pull mxbai-embed-large

# Lightweight: all-minilm (384 dims, fast)
ollama pull all-minilm

# High quality: snowflake-arctic-embed (various sizes)
ollama pull snowflake-arctic-embed

# List installed models
ollama list
```

### Basic Usage with Python

```python
import ollama

def get_embedding(text: str, model: str = "nomic-embed-text") -> list[float]:
    """Get embedding for a single text."""
    response = ollama.embeddings(
        model=model,
        prompt=text
    )
    return response['embedding']

# Usage
embedding = get_embedding("Machine learning is transforming software.")
print(f"Dimensions: {len(embedding)}")  # 768 for nomic-embed-text
```

### Model Comparison

| Model | Dimensions | Size | Quality | Speed | Notes |
|-------|------------|------|---------|-------|-------|
| nomic-embed-text | 768 | 274MB | Good | Fast | Matryoshka support |
| mxbai-embed-large | 1024 | 670MB | Very Good | Moderate | Best local quality |
| all-minilm | 384 | 46MB | Moderate | Fastest | Minimal footprint |
| snowflake-arctic-embed:335m | 1024 | 670MB | Very Good | Moderate | Enterprise-focused |

### Batch Embedding

```python
import ollama
from typing import List

def get_embeddings_batch(
    texts: List[str],
    model: str = "nomic-embed-text"
) -> List[List[float]]:
    """Get embeddings for multiple texts."""
    embeddings = []
    for text in texts:
        response = ollama.embeddings(model=model, prompt=text)
        embeddings.append(response['embedding'])
    return embeddings

# Usage
texts = ["Document one", "Document two", "Document three"]
embeddings = get_embeddings_batch(texts)
print(f"Generated {len(embeddings)} embeddings")
```

### Concurrent Batch Processing

```python
import ollama
from concurrent.futures import ThreadPoolExecutor
from typing import List
import time

def embed_single(args):
    """Embed a single text (for use with ThreadPoolExecutor)."""
    index, text, model = args
    response = ollama.embeddings(model=model, prompt=text)
    return index, response['embedding']

def get_embeddings_concurrent(
    texts: List[str],
    model: str = "nomic-embed-text",
    max_workers: int = 4,
    show_progress: bool = True
) -> List[List[float]]:
    """Get embeddings with concurrent processing."""
    results = [None] * len(texts)
    args_list = [(i, text, model) for i, text in enumerate(texts)]

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(embed_single, args) for args in args_list]

        for i, future in enumerate(futures):
            index, embedding = future.result()
            results[index] = embedding
            if show_progress and (i + 1) % 100 == 0:
                print(f"Processed {i + 1}/{len(texts)}")

    return results

# Usage
texts = [f"Document {i}" for i in range(1000)]
start = time.time()
embeddings = get_embeddings_concurrent(texts, max_workers=4)
print(f"Embedded {len(texts)} texts in {time.time() - start:.2f}s")
```

### HTTP API Direct Access

```python
import requests
from typing import List

OLLAMA_BASE_URL = "http://localhost:11434"

def get_embedding_http(
    text: str,
    model: str = "nomic-embed-text",
    base_url: str = OLLAMA_BASE_URL
) -> List[float]:
    """Get embedding using HTTP API directly."""
    response = requests.post(
        f"{base_url}/api/embeddings",
        json={
            "model": model,
            "prompt": text
        }
    )
    response.raise_for_status()
    return response.json()['embedding']

# Async version
import aiohttp
import asyncio

async def get_embedding_async(
    session: aiohttp.ClientSession,
    text: str,
    model: str = "nomic-embed-text",
    base_url: str = OLLAMA_BASE_URL
) -> List[float]:
    """Async embedding request."""
    async with session.post(
        f"{base_url}/api/embeddings",
        json={"model": model, "prompt": text}
    ) as response:
        data = await response.json()
        return data['embedding']

async def get_embeddings_async_batch(
    texts: List[str],
    model: str = "nomic-embed-text",
    max_concurrent: int = 10
) -> List[List[float]]:
    """Async batch embedding with concurrency control."""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def bounded_embed(text: str, index: int, session):
        async with semaphore:
            embedding = await get_embedding_async(session, text, model)
            return index, embedding

    async with aiohttp.ClientSession() as session:
        tasks = [
            bounded_embed(text, i, session)
            for i, text in enumerate(texts)
        ]
        results = await asyncio.gather(*tasks)

    # Sort by original index
    sorted_results = sorted(results, key=lambda x: x[0])
    return [emb for _, emb in sorted_results]

# Usage
async def main():
    texts = ["Text 1", "Text 2", "Text 3"]
    embeddings = await get_embeddings_async_batch(texts)
    print(f"Got {len(embeddings)} embeddings")

asyncio.run(main())
```

### Remote Ollama Server

```python
import ollama

# Connect to remote Ollama server
client = ollama.Client(host='http://remote-server:11434')

def get_embedding_remote(
    text: str,
    model: str = "nomic-embed-text"
) -> list[float]:
    """Get embedding from remote Ollama server."""
    response = client.embeddings(model=model, prompt=text)
    return response['embedding']

# Or set environment variable
# export OLLAMA_HOST=http://remote-server:11434
# Then use ollama.embeddings() as normal
```

### Model Selection by Use Case

#### Recommended: nomic-embed-text

```python
import ollama

# Best general-purpose local model
# Supports Matryoshka representations (truncatable embeddings)

def get_nomic_embedding(
    text: str,
    dimensions: int = 768  # Can truncate to 64, 128, 256, 512
) -> list[float]:
    """Get nomic embedding with optional dimension truncation."""
    response = ollama.embeddings(
        model="nomic-embed-text",
        prompt=text
    )
    embedding = response['embedding']

    # Matryoshka: truncate to desired dimensions
    if dimensions < len(embedding):
        embedding = embedding[:dimensions]

    return embedding

# Full 768 dimensions
full_emb = get_nomic_embedding("Hello world")

# Truncated to 256 dimensions (faster similarity search)
small_emb = get_nomic_embedding("Hello world", dimensions=256)
```

#### High Quality: mxbai-embed-large

```python
import ollama

# Higher quality but larger model
# Best for accuracy-critical applications

def get_mxbai_embedding(text: str) -> list[float]:
    """Get high-quality mxbai embedding."""
    response = ollama.embeddings(
        model="mxbai-embed-large",
        prompt=text
    )
    return response['embedding']

embedding = get_mxbai_embedding("Complex technical documentation")
print(f"Dimensions: {len(embedding)}")  # 1024
```

#### Lightweight: all-minilm

```python
import ollama

# Smallest footprint, fastest inference
# Good for high-throughput, lower-quality requirements

def get_minilm_embedding(text: str) -> list[float]:
    """Get fast lightweight embedding."""
    response = ollama.embeddings(
        model="all-minilm",
        prompt=text
    )
    return response['embedding']

embedding = get_minilm_embedding("Quick embedding")
print(f"Dimensions: {len(embedding)}")  # 384
```

### Error Handling

```python
import ollama
from ollama import ResponseError
import time

def get_embedding_robust(
    text: str,
    model: str = "nomic-embed-text",
    max_retries: int = 3,
    timeout: float = 60.0
) -> list[float]:
    """Get embedding with error handling and retries."""

    for attempt in range(max_retries):
        try:
            response = ollama.embeddings(
                model=model,
                prompt=text
            )
            return response['embedding']

        except ResponseError as e:
            if "model not found" in str(e).lower():
                print(f"Model '{model}' not found. Pulling...")
                ollama.pull(model)
                continue
            raise

        except ConnectionError as e:
            wait_time = 2 ** attempt
            print(f"Connection error (attempt {attempt + 1}). Waiting {wait_time}s...")
            time.sleep(wait_time)

        except Exception as e:
            wait_time = 2 ** attempt
            print(f"Error: {e}. Waiting {wait_time}s...")
            time.sleep(wait_time)

    raise Exception(f"Failed after {max_retries} attempts")

# Auto-pull model if needed
embedding = get_embedding_robust("Test text")
```

### Health Check

```python
import requests

def check_ollama_health(base_url: str = "http://localhost:11434") -> dict:
    """Check Ollama server health and available models."""
    try:
        # Check if server is running
        response = requests.get(f"{base_url}/api/tags")
        response.raise_for_status()
        models = response.json().get('models', [])

        # Check for embedding models
        embedding_models = [
            m['name'] for m in models
            if any(x in m['name'].lower() for x in ['embed', 'minilm', 'nomic'])
        ]

        return {
            "status": "healthy",
            "server_url": base_url,
            "total_models": len(models),
            "embedding_models": embedding_models
        }

    except requests.ConnectionError:
        return {
            "status": "unhealthy",
            "error": "Cannot connect to Ollama server",
            "suggestion": "Run 'ollama serve' to start the server"
        }

# Usage
health = check_ollama_health()
print(health)
```

### Integration with Vector Databases

#### ChromaDB

```python
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
import ollama

class OllamaEmbeddingFunction(EmbeddingFunction):
    """Custom Ollama embedding function for ChromaDB."""

    def __init__(self, model: str = "nomic-embed-text"):
        self.model = model

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for doc in input:
            response = ollama.embeddings(model=self.model, prompt=doc)
            embeddings.append(response['embedding'])
        return embeddings

# Usage
client = chromadb.PersistentClient(path="./chroma_ollama")
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=OllamaEmbeddingFunction()
)

collection.add(
    documents=["Doc 1", "Doc 2"],
    ids=["id1", "id2"]
)
```

#### LangChain

```python
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

# Create Ollama embeddings
embeddings = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url="http://localhost:11434"
)

# Use with Chroma
vectorstore = Chroma.from_documents(
    documents=docs,
    embedding=embeddings,
    persist_directory="./chroma_langchain"
)
```

### Docker Deployment

```dockerfile
# Dockerfile for Ollama embedding service
FROM ollama/ollama:latest

# Pull embedding models at build time
RUN ollama serve & sleep 5 && \
    ollama pull nomic-embed-text && \
    ollama pull mxbai-embed-large

EXPOSE 11434

CMD ["ollama", "serve"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  ollama_data:
```

```bash
# Start with GPU support
docker-compose up -d

# Pull models
docker exec -it <container_id> ollama pull nomic-embed-text
```

## Performance Characteristics

### Throughput by Model

| Model | CPU (docs/s) | GPU (docs/s) | VRAM |
|-------|--------------|--------------|------|
| all-minilm | 150 | 800 | 200MB |
| nomic-embed-text | 80 | 500 | 600MB |
| mxbai-embed-large | 40 | 300 | 1.5GB |
| snowflake-arctic-embed:335m | 35 | 280 | 1.5GB |

*Benchmarked with sequence length ~100 tokens*

### Latency

| Model | CPU (ms) | GPU (ms) |
|-------|----------|----------|
| all-minilm | 7 | 1.5 |
| nomic-embed-text | 15 | 3 |
| mxbai-embed-large | 30 | 5 |

### Resource Usage

```bash
# Monitor Ollama resource usage
# CPU/Memory
ps aux | grep ollama

# GPU (if NVIDIA)
nvidia-smi

# Or use Ollama's built-in info
curl http://localhost:11434/api/show -d '{"name": "nomic-embed-text"}'
```

### Optimization Tips

1. **Use GPU if available** - 5-10x faster than CPU
2. **Batch concurrent requests** - Use ThreadPoolExecutor or async
3. **Choose appropriate model** - all-minilm for speed, mxbai for quality
4. **Keep server running** - Model loading is expensive
5. **Use Matryoshka** - Truncate nomic embeddings for faster search

## Next Steps

- **Model Selection**: See `cookbook/model-selection.md` for choosing models
- **Matryoshka**: See `cookbook/matryoshka.md` for dimension truncation
- **Batch Processing**: See `cookbook/batch-processing.md` for large-scale pipelines
- **Benchmarking**: Use `tools/embedding_benchmark.py` to compare models
