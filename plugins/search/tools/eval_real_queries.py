#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "httpx"]
# ///
"""Evaluate retrieval on real user queries."""
import json
import sys
from pathlib import Path
from dataclasses import dataclass

sys.path.insert(0, str(Path(__file__).parent))

from rag import (
    FileIndex, OllamaEmbedder, OllamaGenerator,
    VectorRetriever, HybridRetriever
)
from rag.judge import RelevanceJudge
from rag.metrics import MetricsCalculator, AggregateMetrics

@dataclass
class QueryResult:
    query: str
    top_docs: list[str]
    relevance_scores: dict[str, int]
    mrr: float
    precision_at_5: float

def evaluate_retriever(retriever, queries: list[dict], judge: RelevanceJudge, k: int = 5):
    """Evaluate retriever on queries with LLM judging."""
    results = []
    calculator = MetricsCalculator(k_values=[1, 3, 5])

    total_mrr = 0.0
    total_p5 = 0.0

    for i, q in enumerate(queries):
        query_text = q["text"]
        print(f"[{i+1}/{len(queries)}] {query_text[:50]}...")

        # Get retrieval results
        search_results = retriever.search(query_text, k=k)

        # Judge relevance
        relevance_scores = {}
        relevant_ids = set()

        for r in search_results:
            doc_id = r.document.id
            judgment = judge.judge(query_text, r)
            score = judgment.score
            relevance_scores[doc_id] = score
            if score >= 2:  # Threshold for "relevant" (0-2 scale: 2=highly relevant)
                relevant_ids.add(doc_id)

        # Calculate metrics
        metrics = calculator.compute(
            query_text,
            search_results,
            relevant_ids,
            relevance_scores
        )

        # MRR: 1/rank of first relevant
        mrr = metrics.reciprocal_rank
        p5 = metrics.precision_at_k.get(5, 0.0)

        total_mrr += mrr
        total_p5 += p5

        rel_count = sum(1 for s in relevance_scores.values() if s >= 3)
        print(f"  -> {rel_count}/5 relevant, MRR={mrr:.3f}, P@5={p5:.3f}")

        results.append(QueryResult(
            query=query_text,
            top_docs=[r.document.id for r in search_results],
            relevance_scores=relevance_scores,
            mrr=mrr,
            precision_at_5=p5
        ))

    avg_mrr = total_mrr / len(queries) if queries else 0
    avg_p5 = total_p5 / len(queries) if queries else 0

    return results, avg_mrr, avg_p5

def main():
    # Load queries
    queries_file = Path("ecosystem_user_queries.json")
    queries = json.loads(queries_file.read_text())
    print(f"Loaded {len(queries)} real user queries")

    # Use subset for evaluation
    eval_queries = queries[:40]
    print(f"Evaluating on first {len(eval_queries)} queries")

    # Load index
    index = FileIndex(".rag-index")
    documents, embeddings = index.load()
    print(f"Loaded {len(documents)} documents")

    # Setup components
    embedder = OllamaEmbedder(model="nomic-embed-text")
    generator = OllamaGenerator(model="llama3.2:3b")
    judge = RelevanceJudge(generator=generator)

    # Create retrievers
    vector = VectorRetriever(embedder)
    vector.set_index(documents, embeddings)

    hybrid = HybridRetriever(embedder, alpha=0.5)
    hybrid.set_index(documents, embeddings)

    # Evaluate
    print("\n=== Vector Retrieval ===")
    vec_results, vec_mrr, vec_p5 = evaluate_retriever(vector, eval_queries, judge)

    print("\n=== Hybrid Retrieval ===")
    hyb_results, hyb_mrr, hyb_p5 = evaluate_retriever(hybrid, eval_queries, judge)

    # Summary
    print("\n" + "=" * 60)
    print("REAL USER QUERIES EVALUATION")
    print("=" * 60)
    print(f"{'Config':<20} {'MRR':>10} {'P@5':>10}")
    print("-" * 40)
    print(f"{'vector':<20} {vec_mrr:>10.3f} {vec_p5:>10.3f}")
    print(f"{'hybrid':<20} {hyb_mrr:>10.3f} {hyb_p5:>10.3f}")
    print("=" * 60)

    # Save results
    output = {
        "query_count": len(eval_queries),
        "vector": {"mrr": vec_mrr, "p5": vec_p5},
        "hybrid": {"mrr": hyb_mrr, "p5": hyb_p5},
        "detailed": {
            "vector": [{"query": r.query, "mrr": r.mrr, "p5": r.precision_at_5} for r in vec_results],
            "hybrid": [{"query": r.query, "mrr": r.mrr, "p5": r.precision_at_5} for r in hyb_results]
        }
    }
    Path("real_queries_eval.json").write_text(json.dumps(output, indent=2))
    print("\nSaved detailed results to real_queries_eval.json")

if __name__ == "__main__":
    main()
