# Purpose

Production-grade batch embedding generation for large document collections. Covers memory-efficient processing, parallel execution, checkpointing, and error handling.

## Variables

DEFAULT_BATCH_SIZE: 32
MAX_MEMORY_BATCH: 1000
CHECKPOINT_INTERVAL: 10000
MAX_WORKERS_CPU: 4
MAX_WORKERS_GPU: 1
RETRY_ATTEMPTS: 3

## Instructions

### Basic Batch Processing

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Generator
import time

def embed_corpus_basic(
    texts: List[str],
    model_name: str = "all-MiniLM-L6-v2",
    batch_size: int = 32
) -> np.ndarray:
    """
    Basic batch embedding with progress tracking.
    """
    model = SentenceTransformer(model_name)

    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True
    )

    return embeddings

# Usage
texts = [f"Document {i}" for i in range(10000)]
embeddings = embed_corpus_basic(texts)
print(f"Generated {len(embeddings)} embeddings")
```

### Memory-Efficient Streaming

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from pathlib import Path
from typing import Generator, List, Iterator
import gc

def chunk_iterator(items: List, chunk_size: int) -> Generator:
    """Yield chunks from a list."""
    for i in range(0, len(items), chunk_size):
        yield items[i:i + chunk_size]

def embed_corpus_streaming(
    texts: List[str],
    model_name: str = "all-MiniLM-L6-v2",
    batch_size: int = 32,
    chunk_size: int = 10000,
    output_dir: str = "./embeddings_chunks"
) -> None:
    """
    Memory-efficient streaming that saves chunks to disk.
    Suitable for millions of documents.
    """
    model = SentenceTransformer(model_name)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    total_processed = 0
    chunk_idx = 0

    for chunk in chunk_iterator(texts, chunk_size):
        # Generate embeddings for chunk
        embeddings = model.encode(
            chunk,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True
        )

        # Save chunk to disk
        chunk_path = output_path / f"chunk_{chunk_idx:05d}.npy"
        np.save(chunk_path, embeddings)

        total_processed += len(chunk)
        chunk_idx += 1
        print(f"Processed {total_processed}/{len(texts)} documents")

        # Clear memory
        del embeddings
        gc.collect()

    print(f"Saved {chunk_idx} chunks to {output_path}")

def load_chunked_embeddings(chunk_dir: str) -> np.ndarray:
    """Load all chunks and concatenate."""
    chunk_path = Path(chunk_dir)
    chunks = sorted(chunk_path.glob("chunk_*.npy"))

    embeddings = []
    for chunk_file in chunks:
        embeddings.append(np.load(chunk_file))

    return np.vstack(embeddings)

# Usage
texts = [f"Document {i}" for i in range(1000000)]
embed_corpus_streaming(texts, chunk_size=50000)

# Later: load all
all_embeddings = load_chunked_embeddings("./embeddings_chunks")
```

### Parallel Processing with GPU

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from typing import List, Tuple
import torch
import time

def embed_batch(args: Tuple) -> np.ndarray:
    """Worker function for parallel embedding."""
    texts, model_name, device = args
    model = SentenceTransformer(model_name, device=device)
    return model.encode(texts, convert_to_numpy=True)

def embed_corpus_parallel_cpu(
    texts: List[str],
    model_name: str = "all-MiniLM-L6-v2",
    num_workers: int = 4,
    batch_size: int = 1000
) -> np.ndarray:
    """
    Parallel CPU processing with multiple workers.
    Each worker loads the model independently.
    """
    # Split texts into chunks for workers
    chunks = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]
    args_list = [(chunk, model_name, 'cpu') for chunk in chunks]

    embeddings = []
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        for i, result in enumerate(executor.map(embed_batch, args_list)):
            embeddings.append(result)
            print(f"Completed batch {i + 1}/{len(chunks)}")

    return np.vstack(embeddings)

def embed_corpus_multi_gpu(
    texts: List[str],
    model_name: str = "all-MiniLM-L6-v2",
    gpu_ids: List[int] = [0, 1]
) -> np.ndarray:
    """
    Multi-GPU parallel processing.
    Distributes batches across available GPUs.
    """
    # Split texts evenly across GPUs
    chunks_per_gpu = len(texts) // len(gpu_ids)
    chunks = []
    for i, gpu_id in enumerate(gpu_ids):
        start = i * chunks_per_gpu
        end = start + chunks_per_gpu if i < len(gpu_ids) - 1 else len(texts)
        chunks.append((texts[start:end], model_name, f'cuda:{gpu_id}'))

    embeddings = []
    with ProcessPoolExecutor(max_workers=len(gpu_ids)) as executor:
        results = list(executor.map(embed_batch, chunks))
        embeddings = results

    return np.vstack(embeddings)

# Usage
texts = [f"Document {i}" for i in range(100000)]

# CPU parallel
embeddings = embed_corpus_parallel_cpu(texts, num_workers=4)

# Multi-GPU (if available)
if torch.cuda.device_count() > 1:
    embeddings = embed_corpus_multi_gpu(texts, gpu_ids=[0, 1])
```

### Async Batch Processing (OpenAI)

```python
import asyncio
from openai import AsyncOpenAI
from typing import List
import time

async_client = AsyncOpenAI()

async def embed_batch_async(
    texts: List[str],
    model: str = "text-embedding-3-small"
) -> List[List[float]]:
    """Embed a single batch asynchronously."""
    response = await async_client.embeddings.create(
        input=texts,
        model=model
    )
    sorted_data = sorted(response.data, key=lambda x: x.index)
    return [d.embedding for d in sorted_data]

async def embed_corpus_async(
    texts: List[str],
    model: str = "text-embedding-3-small",
    batch_size: int = 100,
    max_concurrent: int = 10,
    requests_per_minute: int = 500
) -> List[List[float]]:
    """
    High-throughput async embedding with rate limiting.
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    rate_limiter = asyncio.Semaphore(requests_per_minute)
    min_interval = 60.0 / requests_per_minute

    async def rate_limited_embed(batch_idx: int, batch: List[str]):
        async with semaphore:
            async with rate_limiter:
                start = time.time()
                embeddings = await embed_batch_async(batch, model)

                # Rate limiting
                elapsed = time.time() - start
                if elapsed < min_interval:
                    await asyncio.sleep(min_interval - elapsed)

                return batch_idx, embeddings

    # Create batches
    batches = [texts[i:i + batch_size] for i in range(0, len(texts), batch_size)]

    # Process all batches
    tasks = [
        rate_limited_embed(i, batch)
        for i, batch in enumerate(batches)
    ]

    results = await asyncio.gather(*tasks)

    # Sort by batch index and flatten
    sorted_results = sorted(results, key=lambda x: x[0])
    all_embeddings = []
    for _, batch_embeddings in sorted_results:
        all_embeddings.extend(batch_embeddings)

    return all_embeddings

# Usage
async def main():
    texts = [f"Document {i}" for i in range(10000)]
    embeddings = await embed_corpus_async(
        texts,
        batch_size=100,
        max_concurrent=10
    )
    print(f"Generated {len(embeddings)} embeddings")

asyncio.run(main())
```

### Checkpointing for Large Jobs

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from pathlib import Path
import json
from typing import List, Optional
import time

class CheckpointedEmbedder:
    """
    Embedding processor with checkpointing for fault tolerance.
    Automatically resumes from last checkpoint on failure.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        checkpoint_dir: str = "./embedding_checkpoint",
        checkpoint_interval: int = 10000
    ):
        self.model = SentenceTransformer(model_name)
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoint_interval = checkpoint_interval

        self.checkpoint_file = self.checkpoint_dir / "checkpoint.json"
        self.embeddings_file = self.checkpoint_dir / "embeddings.npy"

    def _load_checkpoint(self) -> dict:
        """Load checkpoint state."""
        if self.checkpoint_file.exists():
            return json.loads(self.checkpoint_file.read_text())
        return {"processed": 0, "total": 0}

    def _save_checkpoint(self, processed: int, total: int, embeddings: np.ndarray):
        """Save checkpoint state and embeddings."""
        # Save embeddings
        np.save(self.embeddings_file, embeddings)

        # Save checkpoint
        checkpoint = {
            "processed": processed,
            "total": total,
            "timestamp": time.time()
        }
        self.checkpoint_file.write_text(json.dumps(checkpoint))

    def embed(
        self,
        texts: List[str],
        batch_size: int = 32
    ) -> np.ndarray:
        """
        Embed texts with checkpointing.
        Automatically resumes from last checkpoint.
        """
        checkpoint = self._load_checkpoint()
        start_idx = checkpoint["processed"]

        if start_idx > 0 and self.embeddings_file.exists():
            print(f"Resuming from checkpoint: {start_idx}/{len(texts)}")
            existing_embeddings = np.load(self.embeddings_file)
            all_embeddings = [existing_embeddings]
        else:
            all_embeddings = []
            start_idx = 0

        remaining_texts = texts[start_idx:]
        processed = start_idx

        for i in range(0, len(remaining_texts), self.checkpoint_interval):
            chunk = remaining_texts[i:i + self.checkpoint_interval]

            # Generate embeddings
            embeddings = self.model.encode(
                chunk,
                batch_size=batch_size,
                show_progress_bar=True,
                convert_to_numpy=True
            )
            all_embeddings.append(embeddings)
            processed += len(chunk)

            # Save checkpoint
            combined = np.vstack(all_embeddings)
            self._save_checkpoint(processed, len(texts), combined)
            print(f"Checkpoint saved: {processed}/{len(texts)}")

        # Final embeddings
        final_embeddings = np.vstack(all_embeddings)

        # Clean up checkpoint
        self.checkpoint_file.unlink(missing_ok=True)
        self.embeddings_file.unlink(missing_ok=True)

        return final_embeddings

# Usage
embedder = CheckpointedEmbedder(
    checkpoint_dir="./my_embedding_job",
    checkpoint_interval=5000
)

texts = [f"Document {i}" for i in range(100000)]
embeddings = embedder.embed(texts)
```

### Error Handling and Retry

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Optional
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RobustBatchEmbedder:
    """
    Batch embedder with comprehensive error handling.
    """

    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        max_retries: int = 3,
        retry_delay: float = 1.0
    ):
        self.model_name = model_name
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.model: Optional[SentenceTransformer] = None

    def _load_model(self):
        """Lazy load model."""
        if self.model is None:
            self.model = SentenceTransformer(self.model_name)

    def _embed_batch_with_retry(
        self,
        texts: List[str],
        batch_size: int
    ) -> np.ndarray:
        """Embed batch with retry logic."""
        self._load_model()

        for attempt in range(self.max_retries):
            try:
                return self.model.encode(
                    texts,
                    batch_size=batch_size,
                    convert_to_numpy=True
                )
            except RuntimeError as e:
                if "out of memory" in str(e).lower():
                    logger.warning(f"OOM on attempt {attempt + 1}, reducing batch size")
                    batch_size = max(1, batch_size // 2)

                    # Clear GPU memory
                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()

                    time.sleep(self.retry_delay)
                else:
                    raise
            except Exception as e:
                logger.error(f"Error on attempt {attempt + 1}: {e}")
                time.sleep(self.retry_delay * (attempt + 1))

        raise RuntimeError(f"Failed after {self.max_retries} attempts")

    def embed_corpus(
        self,
        texts: List[str],
        batch_size: int = 32,
        chunk_size: int = 10000
    ) -> np.ndarray:
        """
        Embed corpus with chunking and error handling.
        """
        all_embeddings = []
        failed_chunks = []

        for i in range(0, len(texts), chunk_size):
            chunk = texts[i:i + chunk_size]
            chunk_idx = i // chunk_size

            try:
                embeddings = self._embed_batch_with_retry(chunk, batch_size)
                all_embeddings.append(embeddings)
                logger.info(f"Chunk {chunk_idx}: {len(chunk)} texts embedded")
            except Exception as e:
                logger.error(f"Chunk {chunk_idx} failed: {e}")
                failed_chunks.append((chunk_idx, i, i + len(chunk)))
                # Add placeholder for failed chunk
                placeholder = np.zeros((len(chunk), self.model.get_sentence_embedding_dimension()))
                all_embeddings.append(placeholder)

        if failed_chunks:
            logger.warning(f"Failed chunks: {failed_chunks}")

        return np.vstack(all_embeddings)

# Usage
embedder = RobustBatchEmbedder(max_retries=3)
texts = [f"Document {i}" for i in range(100000)]
embeddings = embedder.embed_corpus(texts)
```

### Progress Tracking and Metrics

```python
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List
import time
from dataclasses import dataclass
from datetime import timedelta

@dataclass
class EmbeddingMetrics:
    total_documents: int
    processed_documents: int
    total_time: float
    throughput: float  # docs/second
    estimated_remaining: float  # seconds
    memory_used_mb: float

class MetricTrackingEmbedder:
    """Embedder with detailed progress and metrics."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)

    def embed_with_metrics(
        self,
        texts: List[str],
        batch_size: int = 32,
        callback=None
    ) -> tuple[np.ndarray, EmbeddingMetrics]:
        """
        Embed with real-time metrics tracking.

        Args:
            texts: Documents to embed
            batch_size: Processing batch size
            callback: Optional callback(metrics) called after each batch
        """
        import psutil

        all_embeddings = []
        start_time = time.time()
        processed = 0
        total = len(texts)

        for i in range(0, total, batch_size):
            batch = texts[i:i + batch_size]

            embeddings = self.model.encode(
                batch,
                convert_to_numpy=True
            )
            all_embeddings.append(embeddings)
            processed += len(batch)

            # Calculate metrics
            elapsed = time.time() - start_time
            throughput = processed / elapsed if elapsed > 0 else 0
            remaining = (total - processed) / throughput if throughput > 0 else 0
            memory = psutil.Process().memory_info().rss / (1024 * 1024)

            metrics = EmbeddingMetrics(
                total_documents=total,
                processed_documents=processed,
                total_time=elapsed,
                throughput=throughput,
                estimated_remaining=remaining,
                memory_used_mb=memory
            )

            if callback:
                callback(metrics)

        final_embeddings = np.vstack(all_embeddings)
        final_time = time.time() - start_time

        final_metrics = EmbeddingMetrics(
            total_documents=total,
            processed_documents=processed,
            total_time=final_time,
            throughput=total / final_time,
            estimated_remaining=0,
            memory_used_mb=psutil.Process().memory_info().rss / (1024 * 1024)
        )

        return final_embeddings, final_metrics

def progress_callback(metrics: EmbeddingMetrics):
    """Print progress."""
    pct = metrics.processed_documents / metrics.total_documents * 100
    remaining = timedelta(seconds=int(metrics.estimated_remaining))
    print(f"\r[{pct:5.1f}%] {metrics.processed_documents}/{metrics.total_documents} "
          f"| {metrics.throughput:.0f} docs/s | ETA: {remaining} | "
          f"Memory: {metrics.memory_used_mb:.0f} MB", end="")

# Usage
embedder = MetricTrackingEmbedder()
texts = [f"Document {i}" for i in range(50000)]

embeddings, metrics = embedder.embed_with_metrics(
    texts,
    batch_size=64,
    callback=progress_callback
)

print(f"\n\nFinal metrics:")
print(f"  Total time: {metrics.total_time:.1f}s")
print(f"  Throughput: {metrics.throughput:.0f} docs/s")
```

### Distributed Processing with Ray

```python
import ray
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List

ray.init(ignore_reinit_error=True)

@ray.remote
class EmbeddingWorker:
    """Ray actor for distributed embedding."""

    def __init__(self, model_name: str, device: str = "cpu"):
        self.model = SentenceTransformer(model_name, device=device)

    def embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        return self.model.encode(texts, batch_size=batch_size, convert_to_numpy=True)

def embed_distributed(
    texts: List[str],
    model_name: str = "all-MiniLM-L6-v2",
    num_workers: int = 4,
    batch_size: int = 32
) -> np.ndarray:
    """
    Distributed embedding using Ray.
    Scales across CPUs and machines.
    """
    # Create workers
    workers = [
        EmbeddingWorker.remote(model_name)
        for _ in range(num_workers)
    ]

    # Split texts across workers
    chunk_size = len(texts) // num_workers
    chunks = [
        texts[i * chunk_size:(i + 1) * chunk_size]
        for i in range(num_workers - 1)
    ]
    chunks.append(texts[(num_workers - 1) * chunk_size:])

    # Process in parallel
    futures = [
        worker.embed.remote(chunk, batch_size)
        for worker, chunk in zip(workers, chunks)
    ]

    # Gather results
    results = ray.get(futures)
    return np.vstack(results)

# Usage
texts = [f"Document {i}" for i in range(1000000)]
embeddings = embed_distributed(texts, num_workers=8)
ray.shutdown()
```

## Performance Characteristics

### Throughput by Configuration

| Setup | Throughput (docs/s) | Memory |
|-------|---------------------|--------|
| Single CPU | 200 | 500 MB |
| 4 CPU workers | 700 | 2 GB |
| Single GPU | 2000 | 2 GB |
| 4 GPU | 7000 | 8 GB |
| Ray cluster (8 nodes) | 5000+ | Distributed |

### Optimal Batch Sizes

| Model | CPU Batch | GPU Batch |
|-------|-----------|-----------|
| all-MiniLM-L6-v2 | 64 | 256 |
| bge-base-en-v1.5 | 32 | 128 |
| bge-large-en-v1.5 | 16 | 64 |
| BGE-M3 | 8 | 32 |

### Memory Usage Estimates

```
Per document (384 dims):
  FP32: 1.5 KB
  FP16: 0.75 KB

Corpus size estimates (FP32):
  100K docs: 150 MB
  1M docs: 1.5 GB
  10M docs: 15 GB
  100M docs: 150 GB
```

## Next Steps

- **ONNX Optimization**: See `cookbook/onnx-optimization.md` for faster CPU inference
- **Model Selection**: See `cookbook/model-selection.md` for choosing appropriate models
- **Matryoshka**: See `cookbook/matryoshka.md` for storage-efficient embeddings
- **Benchmarking**: Use `tools/embedding_benchmark.py` to optimize your pipeline
