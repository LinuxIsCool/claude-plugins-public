# Purpose

Guide to using OpenAI's embedding API for production applications. Covers model selection, API usage, batching strategies, and cost optimization.

## Variables

API_BASE_URL: https://api.openai.com/v1
MODELS_AVAILABLE: text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
DEFAULT_MODEL: text-embedding-3-small
MAX_BATCH_SIZE: 2048
MAX_TOKENS_PER_REQUEST: 8191
RATE_LIMIT_TPM: 1000000

## Instructions

### Installation and Setup

```bash
# Install the OpenAI Python client
pip install openai

# Set your API key (recommended: environment variable)
export OPENAI_API_KEY="sk-..."
```

### Basic Usage

```python
from openai import OpenAI

client = OpenAI()  # Uses OPENAI_API_KEY env var

def get_embedding(text: str, model: str = "text-embedding-3-small") -> list[float]:
    """Get embedding for a single text."""
    response = client.embeddings.create(
        input=text,
        model=model
    )
    return response.data[0].embedding

# Usage
embedding = get_embedding("Machine learning is transforming software.")
print(f"Dimensions: {len(embedding)}")  # 1536 for text-embedding-3-small
```

### Model Comparison

| Model | Dimensions | Max Tokens | Cost/1M tokens | MTEB Avg |
|-------|------------|------------|----------------|----------|
| text-embedding-3-small | 1536 | 8191 | $0.02 | ~61 |
| text-embedding-3-large | 3072 | 8191 | $0.13 | ~65 |
| text-embedding-ada-002 | 1536 | 8191 | $0.10 | ~58 |

**Recommendation**: Use `text-embedding-3-small` for most use cases. It offers the best cost-to-quality ratio.

### Batch Embedding

```python
from openai import OpenAI
from typing import List

client = OpenAI()

def get_embeddings_batch(
    texts: List[str],
    model: str = "text-embedding-3-small"
) -> List[List[float]]:
    """Get embeddings for multiple texts in a single API call."""
    response = client.embeddings.create(
        input=texts,
        model=model
    )
    # Sort by index to maintain order
    sorted_data = sorted(response.data, key=lambda x: x.index)
    return [d.embedding for d in sorted_data]

# Usage
texts = [
    "First document about Python programming.",
    "Second document about machine learning.",
    "Third document about data science."
]
embeddings = get_embeddings_batch(texts)
print(f"Got {len(embeddings)} embeddings")
```

### Dimension Reduction

OpenAI's v3 models support native dimension reduction via the `dimensions` parameter.

```python
from openai import OpenAI

client = OpenAI()

def get_embedding_with_dimensions(
    text: str,
    model: str = "text-embedding-3-small",
    dimensions: int = 1536
) -> list[float]:
    """Get embedding with custom dimensions (v3 models only)."""
    response = client.embeddings.create(
        input=text,
        model=model,
        dimensions=dimensions
    )
    return response.data[0].embedding

# Reduce to 256 dimensions for storage efficiency
small_embedding = get_embedding_with_dimensions(
    "Hello world",
    model="text-embedding-3-small",
    dimensions=256
)
print(f"Dimensions: {len(small_embedding)}")  # 256

# Quality vs Size tradeoffs
sizes = [256, 512, 1024, 1536]
for dim in sizes:
    emb = get_embedding_with_dimensions("Test", dimensions=dim)
    storage_kb = len(emb) * 4 / 1024
    print(f"{dim} dims: {storage_kb:.2f} KB per document")
```

**Dimension Reduction Quality Impact:**

| Dimensions | Relative Quality | Storage |
|------------|------------------|---------|
| 256 | ~90% | 1 KB |
| 512 | ~95% | 2 KB |
| 1024 | ~98% | 4 KB |
| 1536 | 100% | 6 KB |

### Rate Limiting and Retry Logic

```python
from openai import OpenAI
from tenacity import retry, wait_exponential, stop_after_attempt
import time

client = OpenAI()

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=60),
    stop=stop_after_attempt(6)
)
def get_embedding_with_retry(text: str, model: str = "text-embedding-3-small"):
    """Get embedding with automatic retry on rate limits."""
    return client.embeddings.create(
        input=text,
        model=model
    ).data[0].embedding

# Alternative: Manual rate limiting
class RateLimitedEmbedder:
    def __init__(self, requests_per_minute: int = 500):
        self.client = OpenAI()
        self.min_interval = 60.0 / requests_per_minute
        self.last_request = 0

    def get_embedding(self, text: str, model: str = "text-embedding-3-small"):
        # Wait if needed
        elapsed = time.time() - self.last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)

        self.last_request = time.time()
        return self.client.embeddings.create(
            input=text,
            model=model
        ).data[0].embedding

embedder = RateLimitedEmbedder(requests_per_minute=500)
```

### Large-Scale Batch Processing

```python
from openai import OpenAI
from typing import List, Generator
import time

client = OpenAI()

def chunk_list(lst: List, chunk_size: int) -> Generator:
    """Split list into chunks."""
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]

def embed_large_corpus(
    texts: List[str],
    model: str = "text-embedding-3-small",
    batch_size: int = 100,
    requests_per_minute: int = 500
) -> List[List[float]]:
    """
    Embed large corpus with rate limiting and progress tracking.

    Args:
        texts: List of texts to embed
        model: OpenAI model name
        batch_size: Texts per API call (max 2048)
        requests_per_minute: Rate limit
    """
    all_embeddings = []
    min_interval = 60.0 / requests_per_minute
    total_batches = (len(texts) + batch_size - 1) // batch_size

    for i, batch in enumerate(chunk_list(texts, batch_size)):
        start_time = time.time()

        response = client.embeddings.create(
            input=batch,
            model=model
        )

        # Sort by index
        sorted_data = sorted(response.data, key=lambda x: x.index)
        batch_embeddings = [d.embedding for d in sorted_data]
        all_embeddings.extend(batch_embeddings)

        # Progress
        print(f"Batch {i + 1}/{total_batches} complete ({len(all_embeddings)}/{len(texts)} texts)")

        # Rate limiting
        elapsed = time.time() - start_time
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)

    return all_embeddings

# Usage
texts = [f"Document {i}" for i in range(10000)]
embeddings = embed_large_corpus(texts, batch_size=100)
```

### Async Embedding

```python
import asyncio
from openai import AsyncOpenAI
from typing import List

async_client = AsyncOpenAI()

async def get_embedding_async(text: str, model: str = "text-embedding-3-small"):
    """Async embedding for a single text."""
    response = await async_client.embeddings.create(
        input=text,
        model=model
    )
    return response.data[0].embedding

async def get_embeddings_parallel(
    texts: List[str],
    model: str = "text-embedding-3-small",
    max_concurrent: int = 10
) -> List[List[float]]:
    """Get embeddings with controlled parallelism."""
    semaphore = asyncio.Semaphore(max_concurrent)

    async def bounded_embed(text: str, index: int):
        async with semaphore:
            embedding = await get_embedding_async(text, model)
            return index, embedding

    tasks = [bounded_embed(text, i) for i, text in enumerate(texts)]
    results = await asyncio.gather(*tasks)

    # Sort by original index
    sorted_results = sorted(results, key=lambda x: x[0])
    return [emb for _, emb in sorted_results]

# Usage
async def main():
    texts = ["Text 1", "Text 2", "Text 3"]
    embeddings = await get_embeddings_parallel(texts, max_concurrent=5)
    print(f"Got {len(embeddings)} embeddings")

asyncio.run(main())
```

### Cost Estimation

```python
import tiktoken

def estimate_embedding_cost(
    texts: List[str],
    model: str = "text-embedding-3-small"
) -> dict:
    """Estimate cost for embedding a list of texts."""

    # Cost per 1M tokens
    costs = {
        "text-embedding-3-small": 0.02,
        "text-embedding-3-large": 0.13,
        "text-embedding-ada-002": 0.10
    }

    # Get tokenizer
    encoding = tiktoken.encoding_for_model(model)

    # Count tokens
    total_tokens = sum(len(encoding.encode(text)) for text in texts)

    # Calculate cost
    cost_per_token = costs[model] / 1_000_000
    estimated_cost = total_tokens * cost_per_token

    return {
        "model": model,
        "total_texts": len(texts),
        "total_tokens": total_tokens,
        "avg_tokens_per_text": total_tokens / len(texts),
        "estimated_cost_usd": round(estimated_cost, 4),
        "cost_per_million_tokens": costs[model]
    }

# Usage
texts = ["Your documents here..."] * 10000
estimate = estimate_embedding_cost(texts)
print(f"Estimated cost: ${estimate['estimated_cost_usd']}")
print(f"Total tokens: {estimate['total_tokens']:,}")
```

### Caching Embeddings

```python
import hashlib
import json
from pathlib import Path
from openai import OpenAI

client = OpenAI()

class CachedEmbedder:
    """Embedding client with disk cache to avoid redundant API calls."""

    def __init__(
        self,
        cache_dir: str = ".embedding_cache",
        model: str = "text-embedding-3-small"
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.model = model

    def _cache_key(self, text: str) -> str:
        """Generate cache key from text and model."""
        content = f"{self.model}:{text}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _cache_path(self, key: str) -> Path:
        return self.cache_dir / f"{key}.json"

    def get_embedding(self, text: str) -> list[float]:
        """Get embedding, using cache if available."""
        key = self._cache_key(text)
        cache_path = self._cache_path(key)

        # Check cache
        if cache_path.exists():
            return json.loads(cache_path.read_text())

        # Generate embedding
        response = client.embeddings.create(
            input=text,
            model=self.model
        )
        embedding = response.data[0].embedding

        # Cache result
        cache_path.write_text(json.dumps(embedding))

        return embedding

# Usage
embedder = CachedEmbedder()
# First call: API request
emb1 = embedder.get_embedding("Hello world")
# Second call: from cache
emb2 = embedder.get_embedding("Hello world")
```

### Error Handling

```python
from openai import OpenAI, APIError, RateLimitError, APIConnectionError
import time

client = OpenAI()

def get_embedding_robust(
    text: str,
    model: str = "text-embedding-3-small",
    max_retries: int = 3
) -> list[float]:
    """Get embedding with comprehensive error handling."""

    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                input=text,
                model=model
            )
            return response.data[0].embedding

        except RateLimitError as e:
            wait_time = 2 ** attempt * 5  # Exponential backoff
            print(f"Rate limited. Waiting {wait_time}s...")
            time.sleep(wait_time)

        except APIConnectionError as e:
            wait_time = 2 ** attempt
            print(f"Connection error. Waiting {wait_time}s...")
            time.sleep(wait_time)

        except APIError as e:
            if e.status_code >= 500:
                # Server error, retry
                wait_time = 2 ** attempt
                print(f"Server error. Waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                # Client error, don't retry
                raise

    raise Exception(f"Failed after {max_retries} attempts")
```

### Integration with Vector Databases

#### ChromaDB

```python
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

# Create embedding function
openai_ef = OpenAIEmbeddingFunction(
    api_key="sk-...",  # Or use OPENAI_API_KEY env var
    model_name="text-embedding-3-small"
)

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection(
    name="documents",
    embedding_function=openai_ef
)

# Add documents (embeddings generated automatically)
collection.add(
    documents=["Doc 1", "Doc 2"],
    ids=["id1", "id2"]
)
```

#### Pinecone

```python
from pinecone import Pinecone
from openai import OpenAI

pc = Pinecone(api_key="...")
index = pc.Index("my-index")
openai_client = OpenAI()

def embed_and_upsert(texts: list, ids: list):
    response = openai_client.embeddings.create(
        input=texts,
        model="text-embedding-3-small"
    )
    vectors = [
        {"id": id, "values": data.embedding}
        for id, data in zip(ids, response.data)
    ]
    index.upsert(vectors=vectors)
```

## Performance Characteristics

### Latency

| Operation | Typical Latency |
|-----------|-----------------|
| Single embedding | 50-100ms |
| Batch of 10 | 100-200ms |
| Batch of 100 | 200-400ms |
| Batch of 1000 | 500-1000ms |

*Network latency varies by region*

### Throughput Limits

| Tier | Tokens Per Minute | Requests Per Minute |
|------|-------------------|---------------------|
| Free | 150,000 | 500 |
| Tier 1 | 1,000,000 | 500 |
| Tier 2 | 2,000,000 | 500 |
| Tier 3+ | 10,000,000+ | 5000+ |

### Cost Optimization Tips

1. **Use dimension reduction** when quality permits (512 dims often sufficient)
2. **Batch requests** to minimize overhead
3. **Cache embeddings** for repeated texts
4. **Use text-embedding-3-small** unless you need maximum quality
5. **Truncate long texts** to avoid wasted tokens

## Next Steps

- **Local Alternative**: See `cookbook/ollama-embeddings.md` for free local embeddings
- **Batch Processing**: See `cookbook/batch-processing.md` for large-scale pipelines
- **Unified Client**: See `tools/embedding_client.py` for provider-agnostic code
