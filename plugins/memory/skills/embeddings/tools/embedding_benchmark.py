#!/usr/bin/env python3
"""
Embedding Model Benchmark Tool

Comprehensive benchmarking for embedding models across multiple dimensions:
- Latency (single and batch)
- Throughput (documents per second)
- Memory usage
- Quality metrics (retrieval, similarity)

Usage:
    python embedding_benchmark.py --models all-MiniLM-L6-v2 bge-base-en-v1.5
    python embedding_benchmark.py --provider openai --model text-embedding-3-small
    python embedding_benchmark.py --provider ollama --model nomic-embed-text
    python embedding_benchmark.py --full-suite
"""

import argparse
import gc
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, List, Literal, Optional

import numpy as np

# Conditional imports for different providers
try:
    from sentence_transformers import SentenceTransformer, util
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    import ollama
    HAS_OLLAMA = True
except ImportError:
    HAS_OLLAMA = False


@dataclass
class BenchmarkResult:
    """Results from a single benchmark run."""
    model_name: str
    provider: str
    dimensions: int

    # Latency metrics (milliseconds)
    latency_single_ms: float
    latency_batch_8_ms: float
    latency_batch_32_ms: float
    latency_batch_128_ms: float

    # Throughput metrics (documents per second)
    throughput_batch_32: float
    throughput_batch_128: float

    # Memory metrics (MB)
    model_memory_mb: float
    peak_memory_mb: float

    # Quality metrics (optional)
    similarity_accuracy: Optional[float] = None
    retrieval_mrr: Optional[float] = None

    # Metadata
    timestamp: str = ""
    device: str = "cpu"
    notes: str = ""


@dataclass
class BenchmarkConfig:
    """Configuration for benchmark runs."""
    warmup_iterations: int = 3
    latency_iterations: int = 10
    throughput_samples: int = 1000
    batch_sizes: List[int] = None
    device: str = "cpu"
    include_quality: bool = True

    def __post_init__(self):
        if self.batch_sizes is None:
            self.batch_sizes = [1, 8, 32, 128]


# Test datasets
SIMILARITY_PAIRS = [
    ("The weather is beautiful today", "It's a lovely sunny day"),
    ("Machine learning uses algorithms", "AI relies on computational methods"),
    ("Python is a programming language", "Python is used for coding"),
    ("The cat sits on the mat", "A feline rests on a rug"),
    ("I love eating pizza", "Pizza is my favorite food"),
]

RETRIEVAL_CORPUS = [
    "Python is a high-level programming language known for its readability.",
    "Machine learning algorithms learn patterns from data to make predictions.",
    "Docker containers provide isolated environments for applications.",
    "Git is a distributed version control system for tracking code changes.",
    "APIs enable different software systems to communicate with each other.",
    "Database indexes improve query performance by organizing data efficiently.",
    "Neural networks are inspired by biological brain structures.",
    "Cloud computing provides on-demand access to computing resources.",
    "Kubernetes orchestrates containerized applications at scale.",
    "REST APIs use HTTP methods for client-server communication.",
]

RETRIEVAL_QUERIES = [
    ("What programming language is easy to read?", 0),  # Python
    ("How do AI systems learn?", 1),  # Machine learning
    ("How do I isolate my application environment?", 2),  # Docker
    ("How do I track code changes?", 3),  # Git
    ("How do systems talk to each other?", 4),  # APIs
]


def get_memory_usage() -> float:
    """Get current process memory usage in MB."""
    try:
        import psutil
        return psutil.Process().memory_info().rss / (1024 * 1024)
    except ImportError:
        return 0.0


def generate_test_texts(n: int) -> List[str]:
    """Generate test texts for benchmarking."""
    templates = [
        "This is document number {} containing sample text for embedding.",
        "Document {} discusses various topics related to machine learning.",
        "The {} entry in our corpus covers software engineering practices.",
        "Entry number {} provides information about data processing.",
        "Text {} explores concepts in natural language processing.",
    ]
    return [templates[i % len(templates)].format(i) for i in range(n)]


class SentenceTransformerBenchmark:
    """Benchmark wrapper for sentence-transformers models."""

    def __init__(self, model_name: str, device: str = "cpu"):
        if not HAS_SENTENCE_TRANSFORMERS:
            raise ImportError("sentence-transformers not installed")

        self.model_name = model_name
        self.device = device
        self.model = SentenceTransformer(model_name, device=device)
        self.dimensions = self.model.get_sentence_embedding_dimension()

    def encode(self, texts: List[str]) -> np.ndarray:
        return self.model.encode(texts, convert_to_numpy=True)

    def encode_single(self, text: str) -> np.ndarray:
        return self.model.encode([text], convert_to_numpy=True)[0]


class OpenAIBenchmark:
    """Benchmark wrapper for OpenAI embeddings."""

    def __init__(self, model_name: str = "text-embedding-3-small"):
        if not HAS_OPENAI:
            raise ImportError("openai not installed")

        self.model_name = model_name
        self.client = OpenAI()

        # Get dimensions
        test_response = self.client.embeddings.create(
            input="test",
            model=model_name
        )
        self.dimensions = len(test_response.data[0].embedding)

    def encode(self, texts: List[str]) -> np.ndarray:
        response = self.client.embeddings.create(input=texts, model=self.model_name)
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return np.array([d.embedding for d in sorted_data])

    def encode_single(self, text: str) -> np.ndarray:
        response = self.client.embeddings.create(input=[text], model=self.model_name)
        return np.array(response.data[0].embedding)


class OllamaBenchmark:
    """Benchmark wrapper for Ollama embeddings."""

    def __init__(self, model_name: str = "nomic-embed-text"):
        if not HAS_OLLAMA:
            raise ImportError("ollama not installed")

        self.model_name = model_name

        # Get dimensions
        test_response = ollama.embeddings(model=model_name, prompt="test")
        self.dimensions = len(test_response["embedding"])

    def encode(self, texts: List[str]) -> np.ndarray:
        embeddings = []
        for text in texts:
            response = ollama.embeddings(model=self.model_name, prompt=text)
            embeddings.append(response["embedding"])
        return np.array(embeddings)

    def encode_single(self, text: str) -> np.ndarray:
        response = ollama.embeddings(model=self.model_name, prompt=text)
        return np.array(response["embedding"])


def benchmark_latency(
    encoder: Callable[[List[str]], np.ndarray],
    texts: List[str],
    warmup: int = 3,
    iterations: int = 10
) -> float:
    """Measure average latency in milliseconds."""
    # Warmup
    for _ in range(warmup):
        encoder(texts)

    # Measure
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        encoder(texts)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        times.append(elapsed)

    return np.mean(times)


def benchmark_throughput(
    encoder: Callable[[List[str]], np.ndarray],
    num_samples: int,
    batch_size: int
) -> float:
    """Measure throughput in documents per second."""
    texts = generate_test_texts(num_samples)

    start = time.perf_counter()
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        encoder(batch)
    elapsed = time.perf_counter() - start

    return num_samples / elapsed


def evaluate_similarity_quality(
    encode_single: Callable[[str], np.ndarray],
    pairs: List[tuple] = SIMILARITY_PAIRS
) -> float:
    """Evaluate similarity quality on test pairs."""
    correct = 0
    total = len(pairs)

    for text1, text2 in pairs:
        emb1 = encode_single(text1)
        emb2 = encode_single(text2)

        # Normalize
        emb1 = emb1 / np.linalg.norm(emb1)
        emb2 = emb2 / np.linalg.norm(emb2)

        similarity = np.dot(emb1, emb2)

        # Expect high similarity for paired texts
        if similarity > 0.5:
            correct += 1

    return correct / total


def evaluate_retrieval_quality(
    encoder: Callable[[List[str]], np.ndarray],
    corpus: List[str] = RETRIEVAL_CORPUS,
    queries: List[tuple] = RETRIEVAL_QUERIES
) -> float:
    """Evaluate retrieval quality using MRR (Mean Reciprocal Rank)."""
    corpus_embeddings = encoder(corpus)
    corpus_embeddings = corpus_embeddings / np.linalg.norm(
        corpus_embeddings, axis=1, keepdims=True
    )

    reciprocal_ranks = []

    for query, expected_idx in queries:
        query_embedding = encoder([query])[0]
        query_embedding = query_embedding / np.linalg.norm(query_embedding)

        similarities = corpus_embeddings @ query_embedding
        ranked_indices = np.argsort(similarities)[::-1]

        # Find rank of expected document
        rank = np.where(ranked_indices == expected_idx)[0][0] + 1
        reciprocal_ranks.append(1 / rank)

    return np.mean(reciprocal_ranks)


def run_benchmark(
    model_name: str,
    provider: Literal["sentence-transformers", "openai", "ollama"],
    config: BenchmarkConfig
) -> BenchmarkResult:
    """Run full benchmark suite for a model."""
    print(f"\nBenchmarking: {model_name} ({provider})")
    print("-" * 50)

    # Initialize model
    initial_memory = get_memory_usage()

    if provider == "sentence-transformers":
        benchmark = SentenceTransformerBenchmark(model_name, config.device)
    elif provider == "openai":
        benchmark = OpenAIBenchmark(model_name)
    elif provider == "ollama":
        benchmark = OllamaBenchmark(model_name)
    else:
        raise ValueError(f"Unknown provider: {provider}")

    model_memory = get_memory_usage() - initial_memory
    print(f"  Model loaded: {benchmark.dimensions} dimensions, {model_memory:.1f} MB")

    # Generate test data
    test_texts = generate_test_texts(config.throughput_samples)

    # Latency benchmarks
    print("  Running latency benchmarks...")
    latency_1 = benchmark_latency(
        benchmark.encode, test_texts[:1],
        config.warmup_iterations, config.latency_iterations
    )
    latency_8 = benchmark_latency(
        benchmark.encode, test_texts[:8],
        config.warmup_iterations, config.latency_iterations
    )
    latency_32 = benchmark_latency(
        benchmark.encode, test_texts[:32],
        config.warmup_iterations, config.latency_iterations
    )
    latency_128 = benchmark_latency(
        benchmark.encode, test_texts[:128],
        config.warmup_iterations, config.latency_iterations
    )

    print(f"    Latency (batch=1): {latency_1:.2f} ms")
    print(f"    Latency (batch=32): {latency_32:.2f} ms")

    # Throughput benchmarks
    print("  Running throughput benchmarks...")
    throughput_32 = benchmark_throughput(benchmark.encode, config.throughput_samples, 32)
    throughput_128 = benchmark_throughput(benchmark.encode, config.throughput_samples, 128)

    print(f"    Throughput (batch=32): {throughput_32:.0f} docs/s")
    print(f"    Throughput (batch=128): {throughput_128:.0f} docs/s")

    # Memory
    peak_memory = get_memory_usage()

    # Quality benchmarks (optional)
    similarity_acc = None
    retrieval_mrr = None

    if config.include_quality:
        print("  Running quality benchmarks...")
        similarity_acc = evaluate_similarity_quality(benchmark.encode_single)
        retrieval_mrr = evaluate_retrieval_quality(benchmark.encode)
        print(f"    Similarity accuracy: {similarity_acc:.2%}")
        print(f"    Retrieval MRR: {retrieval_mrr:.4f}")

    # Cleanup
    del benchmark
    gc.collect()

    return BenchmarkResult(
        model_name=model_name,
        provider=provider,
        dimensions=benchmark.dimensions if 'benchmark' in dir() else 0,
        latency_single_ms=latency_1,
        latency_batch_8_ms=latency_8,
        latency_batch_32_ms=latency_32,
        latency_batch_128_ms=latency_128,
        throughput_batch_32=throughput_32,
        throughput_batch_128=throughput_128,
        model_memory_mb=model_memory,
        peak_memory_mb=peak_memory,
        similarity_accuracy=similarity_acc,
        retrieval_mrr=retrieval_mrr,
        timestamp=datetime.now().isoformat(),
        device=config.device
    )


def format_results_table(results: List[BenchmarkResult]) -> str:
    """Format results as ASCII table."""
    header = (
        f"{'Model':<30} | {'Dims':>6} | {'Lat(1)':>8} | {'Lat(32)':>8} | "
        f"{'Thrpt':>8} | {'Memory':>8} | {'MRR':>6}"
    )
    separator = "-" * len(header)

    lines = [separator, header, separator]

    for r in results:
        mrr_str = f"{r.retrieval_mrr:.4f}" if r.retrieval_mrr else "N/A"
        line = (
            f"{r.model_name:<30} | {r.dimensions:>6} | {r.latency_single_ms:>7.1f}ms | "
            f"{r.latency_batch_32_ms:>7.1f}ms | {r.throughput_batch_32:>6.0f}/s | "
            f"{r.model_memory_mb:>6.0f}MB | {mrr_str:>6}"
        )
        lines.append(line)

    lines.append(separator)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark embedding models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python embedding_benchmark.py --models all-MiniLM-L6-v2 bge-base-en-v1.5
    python embedding_benchmark.py --provider openai --model text-embedding-3-small
    python embedding_benchmark.py --provider ollama --model nomic-embed-text
    python embedding_benchmark.py --full-suite --output results.json
        """
    )

    parser.add_argument(
        "--models",
        nargs="+",
        default=["all-MiniLM-L6-v2"],
        help="Sentence-transformer model names to benchmark"
    )
    parser.add_argument(
        "--provider",
        choices=["sentence-transformers", "openai", "ollama"],
        default="sentence-transformers",
        help="Embedding provider"
    )
    parser.add_argument(
        "--model",
        help="Specific model name (for openai/ollama providers)"
    )
    parser.add_argument(
        "--device",
        default="cpu",
        choices=["cpu", "cuda", "mps"],
        help="Device for sentence-transformers"
    )
    parser.add_argument(
        "--full-suite",
        action="store_true",
        help="Run full benchmark suite with multiple models"
    )
    parser.add_argument(
        "--no-quality",
        action="store_true",
        help="Skip quality evaluation"
    )
    parser.add_argument(
        "--output",
        help="Output JSON file for results"
    )

    args = parser.parse_args()

    config = BenchmarkConfig(
        device=args.device,
        include_quality=not args.no_quality
    )

    results = []

    if args.full_suite:
        # Run comprehensive benchmark suite
        models_to_test = [
            ("all-MiniLM-L6-v2", "sentence-transformers"),
            ("bge-small-en-v1.5", "sentence-transformers"),
            ("bge-base-en-v1.5", "sentence-transformers"),
        ]

        if HAS_OPENAI and os.getenv("OPENAI_API_KEY"):
            models_to_test.append(("text-embedding-3-small", "openai"))

        if HAS_OLLAMA:
            models_to_test.append(("nomic-embed-text", "ollama"))

        for model_name, provider in models_to_test:
            try:
                result = run_benchmark(model_name, provider, config)
                results.append(result)
            except Exception as e:
                print(f"  ERROR: {e}")

    elif args.provider in ["openai", "ollama"]:
        model = args.model or (
            "text-embedding-3-small" if args.provider == "openai"
            else "nomic-embed-text"
        )
        result = run_benchmark(model, args.provider, config)
        results.append(result)

    else:
        for model_name in args.models:
            try:
                result = run_benchmark(model_name, "sentence-transformers", config)
                results.append(result)
            except Exception as e:
                print(f"  ERROR benchmarking {model_name}: {e}")

    # Display results
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)
    print(format_results_table(results))

    # Save to JSON if requested
    if args.output:
        output_path = Path(args.output)
        with open(output_path, "w") as f:
            json.dump([asdict(r) for r in results], f, indent=2)
        print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()
