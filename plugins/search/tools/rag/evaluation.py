"""Evaluation framework for RAG retrieval quality.

Provides tools to evaluate and compare retrieval strategies using
LLM-assisted ground truth generation and standard IR metrics.
"""
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from .protocols import Retriever, SearchResult
from .judge import RelevanceJudge, RelevanceJudgment, GroundTruthBuilder
from .metrics import MetricsCalculator, EvaluationMetrics, AggregateMetrics, format_metrics, format_comparison


@dataclass
class EvaluationResult:
    """Complete evaluation result for a retrieval strategy."""
    strategy_name: str
    metrics: AggregateMetrics
    per_query_metrics: list[EvaluationMetrics]
    ground_truth_coverage: float  # Fraction of queries with relevant docs
    judgments: list[RelevanceJudgment] | None = None


class Evaluator:
    """
    Evaluate retrieval strategies against ground truth.

    Supports two modes:
    1. Provided ground truth: Use pre-defined relevant doc sets
    2. LLM-assisted: Generate ground truth using LLM judgments

    The evaluator can compare multiple strategies on the same queries.
    """

    def __init__(
        self,
        judge: RelevanceJudge | None = None,
        calculator: MetricsCalculator | None = None
    ):
        """
        Initialize evaluator.

        Args:
            judge: Relevance judge for LLM-assisted evaluation
            calculator: Metrics calculator (creates default if None)
        """
        self.judge = judge
        self.calculator = calculator or MetricsCalculator()

    def evaluate(
        self,
        retriever: Retriever,
        queries: list[str],
        ground_truth: dict[str, set[str]] | None = None,
        k: int = 10,
        generate_ground_truth: bool = False,
        store_judgments: bool = True
    ) -> EvaluationResult:
        """
        Evaluate a retriever on a set of queries.

        Args:
            retriever: Retriever to evaluate
            queries: List of test queries
            ground_truth: Optional pre-defined relevant doc sets per query
            k: Number of results to retrieve per query
            generate_ground_truth: If True and no ground_truth, use LLM to generate
            store_judgments: Whether to store individual judgments in result

        Returns:
            Evaluation result with metrics
        """
        # Collect results for all queries
        results_per_query: dict[str, list[SearchResult]] = {}
        for query in queries:
            results_per_query[query] = retriever.search(query, k=k)

        # Generate ground truth if needed
        judgments = []
        relevance_scores: dict[str, dict[str, int]] = {}

        if ground_truth is None and generate_ground_truth:
            if self.judge is None:
                self.judge = RelevanceJudge()

            builder = GroundTruthBuilder(self.judge)
            ground_truth = builder.build_from_results(
                queries, results_per_query, relevance_threshold=1
            )

            # Also collect relevance scores for NDCG
            for query in queries:
                query_judgments = self.judge.judge_batch(
                    query, results_per_query[query], show_progress=False
                )
                relevance_scores[query] = {
                    j.document_id: j.score for j in query_judgments
                }
                judgments.extend(query_judgments)

        elif ground_truth is None:
            # No ground truth and not generating - use empty sets
            ground_truth = {q: set() for q in queries}

        # Compute metrics per query
        per_query_metrics = []
        for query in queries:
            results = results_per_query[query]
            relevant_ids = ground_truth.get(query, set())
            scores = relevance_scores.get(query)

            metrics = self.calculator.compute(query, results, relevant_ids, scores)
            per_query_metrics.append(metrics)

        # Aggregate metrics
        aggregate = self.calculator.aggregate(per_query_metrics)

        # Compute coverage
        queries_with_relevant = sum(
            1 for q in queries if ground_truth.get(q)
        )
        coverage = queries_with_relevant / len(queries) if queries else 0.0

        return EvaluationResult(
            strategy_name=retriever.name,
            metrics=aggregate,
            per_query_metrics=per_query_metrics,
            ground_truth_coverage=coverage,
            judgments=judgments if store_judgments else None
        )

    def compare(
        self,
        baseline: Retriever,
        candidate: Retriever,
        queries: list[str],
        ground_truth: dict[str, set[str]] | None = None,
        k: int = 10,
        generate_ground_truth: bool = False
    ) -> tuple[EvaluationResult, EvaluationResult, str]:
        """
        Compare two retrievers on the same queries.

        Args:
            baseline: Baseline retriever
            candidate: Candidate retriever to compare
            queries: Test queries
            ground_truth: Optional pre-defined ground truth
            k: Number of results per query
            generate_ground_truth: If True, use LLM to generate ground truth

        Returns:
            Tuple of (baseline_result, candidate_result, comparison_string)
        """
        # Evaluate baseline first (generates ground truth if needed)
        baseline_result = self.evaluate(
            baseline, queries, ground_truth,
            k=k, generate_ground_truth=generate_ground_truth
        )

        # Use same ground truth for candidate
        if generate_ground_truth and ground_truth is None:
            # Extract ground truth from baseline judgments
            inferred_gt: dict[str, set[str]] = {}
            if baseline_result.judgments:
                for j in baseline_result.judgments:
                    if j.query not in inferred_gt:
                        inferred_gt[j.query] = set()
                    if j.score >= 1:
                        inferred_gt[j.query].add(j.document_id)
                ground_truth = inferred_gt

        candidate_result = self.evaluate(
            candidate, queries, ground_truth,
            k=k, generate_ground_truth=False
        )

        comparison = format_comparison(
            baseline_result.metrics,
            candidate_result.metrics,
            baseline_name=baseline.name,
            candidate_name=candidate.name
        )

        return baseline_result, candidate_result, comparison


def save_evaluation(result: EvaluationResult, path: Path | str) -> None:
    """
    Save evaluation result to JSON file.

    Args:
        result: Evaluation result to save
        path: Output file path
    """
    path = Path(path)

    data = {
        "strategy_name": result.strategy_name,
        "ground_truth_coverage": result.ground_truth_coverage,
        "metrics": {
            "num_queries": result.metrics.num_queries,
            "mrr": result.metrics.mrr,
            "precision": result.metrics.mean_precision,
            "recall": result.metrics.mean_recall,
            "ndcg": result.metrics.mean_ndcg
        },
        "per_query": [
            {
                "query": m.query,
                "reciprocal_rank": m.reciprocal_rank,
                "precision": m.precision_at_k,
                "recall": m.recall_at_k,
                "ndcg": m.ndcg_at_k
            }
            for m in result.per_query_metrics
        ]
    }

    if result.judgments:
        data["judgments"] = [
            {
                "query": j.query,
                "document_id": j.document_id,
                "score": j.score,
                "explanation": j.explanation
            }
            for j in result.judgments
        ]

    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Saved evaluation to {path}")


def load_ground_truth(path: Path | str) -> dict[str, set[str]]:
    """
    Load ground truth from JSON file.

    Expected format:
    {
        "query1": ["doc_id1", "doc_id2"],
        "query2": ["doc_id3"]
    }

    Args:
        path: Path to ground truth file

    Returns:
        Dict mapping query to set of relevant doc IDs
    """
    path = Path(path)

    with open(path) as f:
        data = json.load(f)

    return {
        query: set(doc_ids)
        for query, doc_ids in data.items()
    }
