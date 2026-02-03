#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "httpx", "sentence-transformers", "torch"]
# ///
"""
RAG Test Harness - Test retrieval quality against real user prompts.

Usage:
    # 1. Build index from repository
    uv run rag_test.py index --path . --glob "**/*.py,**/*.md"

    # 2. Build contextual index (slower but better retrieval)
    uv run rag_test.py index --path . --glob "**/*.py" --contextual

    # 3. Query the index
    uv run rag_test.py query "how does authentication work"

    # 4. Query with reranking (more accurate)
    uv run rag_test.py query "error handling" --hybrid --rerank

    # 5. Test with sampled user prompts from logs
    uv run rag_test.py sample --count 5

    # 6. Evaluate retrieval quality with LLM-assisted ground truth
    uv run rag_test.py eval --prompts 10 --baseline vector --candidate hybrid

    # 7. Show index statistics
    uv run rag_test.py stats

    # 8. Run ecosystem-specific tests (agents, plugins, processes)
    uv run rag_test.py ecosystem --configs vector hybrid --output results.json

    # 9. List generated ecosystem queries without running tests
    uv run rag_test.py ecosystem --list-queries
"""
import argparse
import json
import random
import sys
from datetime import datetime
from pathlib import Path

# Add rag module to path
sys.path.insert(0, str(Path(__file__).parent))

from rag import (
    Document, RecursiveTextSplitter, ContextualChunker, OllamaEmbedder,
    OllamaGenerator, VectorRetriever, HybridRetriever, RerankingRetriever,
    CrossEncoderReranker, FileIndex, Evaluator, format_metrics, save_evaluation,
    EcosystemQueryGenerator, MultiConfigRunner, format_suite_result, save_suite_result
)


def scan_repository(
    root_path: Path,
    patterns: list[str],
    exclude_patterns: list[str] | None = None,
    max_file_size_kb: int = 500
) -> list[Document]:
    """Scan repository for files matching patterns."""
    exclude_patterns = exclude_patterns or [
        '**/node_modules/**', '**/.venv/**', '**/__pycache__/**',
        '**/.git/**', '**/dist/**', '**/.rag-index/**'
    ]

    documents = []

    for pattern in patterns:
        for file_path in root_path.glob(pattern):
            # Skip excluded
            if any(file_path.match(ep) for ep in exclude_patterns):
                continue

            # Skip large files
            if file_path.stat().st_size > max_file_size_kb * 1024:
                continue

            try:
                content = file_path.read_text(errors='ignore')
                if content.strip():
                    doc = Document(
                        id=str(file_path.relative_to(root_path)),
                        content=content,
                        metadata={
                            'file_path': str(file_path),
                            'relative_path': str(file_path.relative_to(root_path)),
                            'extension': file_path.suffix,
                            'size_bytes': len(content)
                        }
                    )
                    documents.append(doc)
            except Exception as e:
                print(f"  Warning: Could not read {file_path}: {e}")

    return documents


def load_user_prompts(logs_dir: Path, limit: int | None = None) -> list[dict]:
    """Load UserPromptSubmit events from logging JSONL files."""
    prompts = []

    if not logs_dir.exists():
        print(f"Warning: Logs directory not found: {logs_dir}")
        return prompts

    for jsonl_file in logs_dir.rglob("*.jsonl"):
        try:
            with open(jsonl_file) as f:
                for line in f:
                    if not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                        if event.get('type') == 'UserPromptSubmit':
                            prompt_text = event.get('data', {}).get('prompt', '')
                            if prompt_text and len(prompt_text) > 10:
                                prompts.append({
                                    'prompt': prompt_text,
                                    'timestamp': event.get('ts', ''),
                                    'session_id': event.get('session_id', ''),
                                    'log_file': str(jsonl_file)
                                })
                    except json.JSONDecodeError:
                        continue
        except Exception:
            continue

    # Sort by timestamp descending (most recent first)
    prompts.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

    if limit:
        prompts = prompts[:limit]

    return prompts


def cmd_index(args):
    """Build search index from repository files."""
    print(f"Building index from {args.path}...")

    # Parse glob patterns
    patterns = args.glob.split(',')
    print(f"  Patterns: {patterns}")

    # Scan files
    root_path = Path(args.path).resolve()
    documents = scan_repository(root_path, patterns)
    print(f"  Found {len(documents)} files")

    if not documents:
        print("Error: No documents found. Check your path and glob patterns.")
        return 1

    # Initialize chunker
    base_chunker = RecursiveTextSplitter(chunk_size=args.chunk_size, chunk_overlap=args.overlap)

    if args.contextual:
        print(f"  Using contextual chunking (LLM-generated descriptions)...")
        generator = OllamaGenerator(model=args.context_model)
        chunker = ContextualChunker(base_chunker, generator)
    else:
        chunker = base_chunker

    embedder = OllamaEmbedder(model=args.model)
    index = FileIndex(args.index_dir)

    # Chunk documents
    print(f"  Chunking with size={args.chunk_size}, overlap={args.overlap}...")
    all_chunks = []
    for i, doc in enumerate(documents):
        if args.contextual and i % 10 == 0:
            print(f"    Processing document {i+1}/{len(documents)}")
        chunks = chunker.chunk(doc)
        all_chunks.extend([c.to_document() for c in chunks])
    print(f"  Created {len(all_chunks)} chunks")

    # Generate embeddings
    print(f"  Generating embeddings with {args.model}...")
    try:
        embeddings = embedder.embed_batch([c.content for c in all_chunks])
    except ConnectionError as e:
        print(f"Error: {e}")
        return 1

    # Save index
    index.save(all_chunks, embeddings, config={
        'chunk_size': args.chunk_size,
        'overlap': args.overlap,
        'model': args.model,
        'contextual': args.contextual,
        'context_model': args.context_model if args.contextual else None,
        'source_path': str(root_path),
        'patterns': patterns,
        'indexed_at': datetime.now().isoformat()
    })

    print(f"Index saved to {args.index_dir}/")
    return 0


def cmd_query(args):
    """Query the search index."""
    index = FileIndex(args.index_dir)

    if not index.exists():
        print(f"Error: Index not found at {args.index_dir}. Run 'index' first.")
        return 1

    # Load index
    documents, embeddings = index.load()
    embedder = OllamaEmbedder(model=args.model)

    # Choose base retriever
    if args.hybrid:
        base_retriever = HybridRetriever(embedder, alpha=args.alpha)
    else:
        base_retriever = VectorRetriever(embedder)

    base_retriever.set_index(documents, embeddings)

    # Wrap with reranker if requested
    if args.rerank:
        print("Loading cross-encoder reranker...")
        reranker = CrossEncoderReranker(model_name=args.rerank_model)
        retriever = RerankingRetriever(base_retriever, reranker, retrieve_k=args.retrieve_k)
    else:
        retriever = base_retriever

    # Search
    print(f"\nQuery: {args.query}\n")
    print(f"Using: {retriever.name} retriever")
    print("=" * 60)

    try:
        results = retriever.search(args.query, k=args.k)
    except ConnectionError as e:
        print(f"Error: {e}")
        return 1

    for i, result in enumerate(results, 1):
        print(f"\n[{i}] Score: {result.score:.4f}")
        print(f"    File: {result.document.metadata.get('relative_path', result.document.id)}")

        # Show reranking info if available
        if 'original_score' in result.metadata:
            print(f"    Original score: {result.metadata['original_score']:.4f}")

        # Show snippet
        content = result.document.content
        # Strip context prefix if present (from contextual chunking)
        if '\n\n' in content and result.document.metadata.get('context'):
            content = content.split('\n\n', 1)[1]
        if len(content) > 300:
            content = content[:300] + "..."
        print(f"    ---")
        for line in content.split('\n')[:10]:
            print(f"    {line}")

    print("\n" + "=" * 60)
    return 0


def cmd_sample(args):
    """Sample user prompts from logs and show retrieval results."""
    index = FileIndex(args.index_dir)

    if not index.exists():
        print(f"Error: Index not found at {args.index_dir}. Run 'index' first.")
        return 1

    # Load prompts
    logs_dir = Path(args.logs_dir)
    prompts = load_user_prompts(logs_dir)

    if not prompts:
        print(f"No user prompts found in {logs_dir}")
        return 1

    print(f"Found {len(prompts)} user prompts")

    # Sample
    if args.random:
        sample = random.sample(prompts, min(args.count, len(prompts)))
    else:
        sample = prompts[:args.count]

    # Load retriever
    documents, embeddings = index.load()
    embedder = OllamaEmbedder(model=args.model)

    if args.hybrid:
        base_retriever = HybridRetriever(embedder, alpha=args.alpha)
    else:
        base_retriever = VectorRetriever(embedder)

    base_retriever.set_index(documents, embeddings)

    # Wrap with reranker if requested
    if args.rerank:
        print("Loading cross-encoder reranker...")
        reranker = CrossEncoderReranker(model_name=args.rerank_model)
        retriever = RerankingRetriever(base_retriever, reranker, retrieve_k=args.retrieve_k)
    else:
        retriever = base_retriever

    print(f"Using: {retriever.name} retriever")

    # Process each prompt
    for i, prompt_data in enumerate(sample, 1):
        print("\n" + "=" * 70)
        print(f"PROMPT {i}/{len(sample)}")
        print(f"Time: {prompt_data['timestamp'][:19] if prompt_data['timestamp'] else 'unknown'}")
        print(f"Session: {prompt_data['session_id'][:8]}..." if prompt_data['session_id'] else "")
        print("-" * 70)

        # Show prompt (truncated if needed)
        prompt_text = prompt_data['prompt']
        if len(prompt_text) > 500:
            prompt_text = prompt_text[:500] + "..."
        print(f"\n{prompt_text}\n")

        print("-" * 70)
        print("RETRIEVED CONTEXT:")

        try:
            results = retriever.search(prompt_data['prompt'], k=args.k)
        except ConnectionError as e:
            print(f"Error: {e}")
            continue

        for j, result in enumerate(results, 1):
            print(f"\n  [{j}] Score: {result.score:.4f}")
            print(f"      File: {result.document.metadata.get('relative_path', 'unknown')}")

            # Show reranking info if available
            if 'original_score' in result.metadata:
                print(f"      Original: {result.metadata['original_score']:.4f}")

            # Show snippet
            content = result.document.content
            if len(content) > 200:
                content = content[:200] + "..."
            print(f"      ---")
            for line in content.split('\n')[:5]:
                print(f"      {line}")

    print("\n" + "=" * 70)
    print(f"\nProcessed {len(sample)} prompts")
    return 0


def cmd_stats(args):
    """Show index statistics."""
    index = FileIndex(args.index_dir)
    stats = index.get_stats()

    if not stats.get('exists'):
        print(f"Index not found at {args.index_dir}")
        return 1

    print("\nIndex Statistics")
    print("=" * 40)
    print(f"Location: {stats['index_dir']}")
    print(f"Documents: {stats['num_documents']}")
    print(f"Embedding dimensions: {stats['embedding_dim']}")
    print(f"Chunks file: {stats['chunks_size_bytes'] / 1024:.1f} KB")
    print(f"Embeddings file: {stats['embeddings_size_bytes'] / 1024:.1f} KB")

    # Load config if available
    config_file = Path(args.index_dir) / "config.json"
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
        print(f"\nConfiguration:")
        print(f"  Source: {config.get('source_path', 'unknown')}")
        print(f"  Patterns: {config.get('patterns', [])}")
        print(f"  Chunk size: {config.get('chunk_size', 'unknown')}")
        print(f"  Model: {config.get('model', 'unknown')}")
        print(f"  Contextual: {config.get('contextual', False)}")
        print(f"  Indexed at: {config.get('indexed_at', 'unknown')}")

    return 0


def cmd_eval(args):
    """Evaluate retrieval quality with LLM-assisted ground truth."""
    index = FileIndex(args.index_dir)

    if not index.exists():
        print(f"Error: Index not found at {args.index_dir}. Run 'index' first.")
        return 1

    # Load prompts for evaluation
    logs_dir = Path(args.logs_dir)
    all_prompts = load_user_prompts(logs_dir)

    if not all_prompts:
        print(f"No user prompts found in {logs_dir}")
        return 1

    # Sample prompts for evaluation
    if args.random:
        eval_prompts = random.sample(all_prompts, min(args.prompts, len(all_prompts)))
    else:
        eval_prompts = all_prompts[:args.prompts]

    queries = [p['prompt'] for p in eval_prompts]
    print(f"Evaluating on {len(queries)} queries...")

    # Load index
    documents, embeddings = index.load()
    embedder = OllamaEmbedder(model=args.model)

    # Build retrievers
    def make_retriever(strategy: str):
        if strategy == 'vector':
            r = VectorRetriever(embedder)
        elif strategy == 'hybrid':
            r = HybridRetriever(embedder, alpha=args.alpha)
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
        r.set_index(documents, embeddings)
        return r

    baseline = make_retriever(args.baseline)
    candidate = make_retriever(args.candidate) if args.candidate else None

    # Run evaluation
    evaluator = Evaluator()

    if candidate:
        print(f"\nComparing {args.baseline} vs {args.candidate}...")
        baseline_result, candidate_result, comparison = evaluator.compare(
            baseline, candidate, queries,
            k=args.k,
            generate_ground_truth=True
        )

        print(comparison)

        # Save results
        if args.output:
            output_path = Path(args.output)
            save_evaluation(baseline_result, output_path.with_suffix('.baseline.json'))
            save_evaluation(candidate_result, output_path.with_suffix('.candidate.json'))
    else:
        print(f"\nEvaluating {args.baseline}...")
        result = evaluator.evaluate(
            baseline, queries,
            k=args.k,
            generate_ground_truth=True
        )

        print(format_metrics(result.metrics, name=args.baseline))

        if args.output:
            save_evaluation(result, args.output)

    return 0


def cmd_ecosystem(args):
    """Run ecosystem-specific retrieval tests."""
    index = FileIndex(args.index_dir)

    if not index.exists():
        print(f"Error: Index not found at {args.index_dir}. Run 'index' first.")
        return 1

    # Generate test queries from ecosystem
    print(f"Generating test queries from {args.path}...")
    root_path = Path(args.path).resolve()
    generator = EcosystemQueryGenerator(root_path)
    suite = generator.generate()

    print(f"Generated {len(suite.queries)} test queries:")
    for category, queries in suite.by_category().items():
        print(f"  {category}: {len(queries)} queries")

    if args.list_queries:
        print("\nQueries by category:")
        for category, queries in suite.by_category().items():
            print(f"\n  [{category.upper()}]")
            for q in queries[:5]:  # Show first 5 per category
                print(f"    - {q.text[:60]}...")
        return 0

    # Load index
    documents, embeddings = index.load()
    embedder = OllamaEmbedder(model=args.model)

    # Build retrievers based on selected configs
    retrievers = {}

    if 'vector' in args.configs:
        r = VectorRetriever(embedder)
        r.set_index(documents, embeddings)
        retrievers['vector'] = r

    if 'hybrid' in args.configs:
        r = HybridRetriever(embedder, alpha=args.alpha)
        r.set_index(documents, embeddings)
        retrievers['hybrid'] = r

    if 'hybrid+rerank' in args.configs:
        base = HybridRetriever(embedder, alpha=args.alpha)
        base.set_index(documents, embeddings)
        print("Loading cross-encoder reranker...")
        reranker = CrossEncoderReranker(model_name=args.rerank_model)
        retrievers['hybrid+rerank'] = RerankingRetriever(
            base, reranker, retrieve_k=args.retrieve_k
        )

    if not retrievers:
        print("Error: No valid configurations selected.")
        return 1

    # Run evaluation
    runner = MultiConfigRunner()
    result = runner.run(
        suite,
        retrievers,
        k=args.k,
        generate_ground_truth=not args.no_judge
    )

    # Display results
    print(format_suite_result(result))

    # Save results
    if args.output:
        save_suite_result(result, args.output)

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="RAG Test Harness - Test retrieval quality",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Global options
    parser.add_argument('--index-dir', default='.rag-index',
                        help='Index directory (default: .rag-index)')
    parser.add_argument('--model', default='nomic-embed-text',
                        help='Ollama embedding model (default: nomic-embed-text)')

    subparsers = parser.add_subparsers(dest='command', required=True)

    # index command
    index_parser = subparsers.add_parser('index', help='Build search index')
    index_parser.add_argument('--path', default='.', help='Repository path')
    index_parser.add_argument('--glob', default='**/*.py,**/*.md,**/*.js,**/*.ts',
                              help='Glob patterns (comma-separated)')
    index_parser.add_argument('--chunk-size', type=int, default=512,
                              help='Chunk size in characters')
    index_parser.add_argument('--overlap', type=int, default=50,
                              help='Chunk overlap in characters')
    index_parser.add_argument('--contextual', action='store_true',
                              help='Use contextual chunking (LLM-generated descriptions)')
    index_parser.add_argument('--context-model', default='qwen2.5-coder:1.5b',
                              help='Ollama model for generating context')

    # query command
    query_parser = subparsers.add_parser('query', help='Query the index')
    query_parser.add_argument('query', help='Search query')
    query_parser.add_argument('-k', type=int, default=5, help='Number of results')
    query_parser.add_argument('--hybrid', action='store_true',
                              help='Use hybrid (BM25 + vector) retrieval')
    query_parser.add_argument('--alpha', type=float, default=0.5,
                              help='Hybrid alpha: keyword vs semantic weight')
    query_parser.add_argument('--rerank', action='store_true',
                              help='Apply cross-encoder reranking')
    query_parser.add_argument('--rerank-model', default='cross-encoder/ms-marco-MiniLM-L-6-v2',
                              help='Cross-encoder model for reranking')
    query_parser.add_argument('--retrieve-k', type=int, default=50,
                              help='Candidates to retrieve before reranking')

    # sample command
    sample_parser = subparsers.add_parser('sample',
                                          help='Test with sampled user prompts')
    sample_parser.add_argument('--logs-dir', default='.claude/logging',
                               help='Logging directory')
    sample_parser.add_argument('--count', type=int, default=5,
                               help='Number of prompts to sample')
    sample_parser.add_argument('-k', type=int, default=3,
                               help='Results per prompt')
    sample_parser.add_argument('--random', action='store_true',
                               help='Random sample (default: most recent)')
    sample_parser.add_argument('--hybrid', action='store_true',
                               help='Use hybrid retrieval')
    sample_parser.add_argument('--alpha', type=float, default=0.5,
                               help='Hybrid alpha weight')
    sample_parser.add_argument('--rerank', action='store_true',
                               help='Apply cross-encoder reranking')
    sample_parser.add_argument('--rerank-model', default='cross-encoder/ms-marco-MiniLM-L-6-v2',
                               help='Cross-encoder model for reranking')
    sample_parser.add_argument('--retrieve-k', type=int, default=50,
                               help='Candidates to retrieve before reranking')

    # eval command
    eval_parser = subparsers.add_parser('eval',
                                        help='Evaluate retrieval quality')
    eval_parser.add_argument('--logs-dir', default='.claude/logging',
                             help='Logging directory for prompts')
    eval_parser.add_argument('--prompts', type=int, default=10,
                             help='Number of prompts for evaluation')
    eval_parser.add_argument('-k', type=int, default=10,
                             help='Results to retrieve per query')
    eval_parser.add_argument('--baseline', default='vector',
                             choices=['vector', 'hybrid'],
                             help='Baseline retrieval strategy')
    eval_parser.add_argument('--candidate', default=None,
                             choices=['vector', 'hybrid'],
                             help='Candidate strategy to compare (optional)')
    eval_parser.add_argument('--alpha', type=float, default=0.5,
                             help='Hybrid alpha weight')
    eval_parser.add_argument('--random', action='store_true',
                             help='Random sample (default: most recent)')
    eval_parser.add_argument('--output', type=str, default=None,
                             help='Save evaluation results to JSON')

    # stats command
    subparsers.add_parser('stats', help='Show index statistics')

    # ecosystem command
    eco_parser = subparsers.add_parser('ecosystem',
                                        help='Run ecosystem-specific retrieval tests')
    eco_parser.add_argument('--path', default='.',
                            help='Repository path to scan for ecosystem content')
    eco_parser.add_argument('--configs', nargs='+',
                            default=['vector', 'hybrid', 'hybrid+rerank'],
                            choices=['vector', 'hybrid', 'hybrid+rerank'],
                            help='Retriever configurations to test')
    eco_parser.add_argument('-k', type=int, default=10,
                            help='Results per query')
    eco_parser.add_argument('--alpha', type=float, default=0.5,
                            help='Hybrid alpha weight')
    eco_parser.add_argument('--rerank-model', default='cross-encoder/ms-marco-MiniLM-L-6-v2',
                            help='Cross-encoder model for reranking')
    eco_parser.add_argument('--retrieve-k', type=int, default=50,
                            help='Candidates to retrieve before reranking')
    eco_parser.add_argument('--no-judge', action='store_true',
                            help='Skip LLM-assisted ground truth generation')
    eco_parser.add_argument('--list-queries', action='store_true',
                            help='List generated queries and exit')
    eco_parser.add_argument('--output', type=str, default=None,
                            help='Save results to JSON file')

    args = parser.parse_args()

    commands = {
        'index': cmd_index,
        'query': cmd_query,
        'sample': cmd_sample,
        'eval': cmd_eval,
        'stats': cmd_stats,
        'ecosystem': cmd_ecosystem
    }

    return commands[args.command](args)


if __name__ == '__main__':
    sys.exit(main() or 0)
