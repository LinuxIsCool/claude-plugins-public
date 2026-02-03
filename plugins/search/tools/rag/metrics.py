"""Information retrieval metrics for RAG evaluation.

Implements standard IR metrics:
- Precision@K: Fraction of top-K results that are relevant
- Recall@K: Fraction of relevant docs found in top-K
- MRR: Mean Reciprocal Rank - average of 1/rank of first relevant result
- NDCG@K: Normalized Discounted Cumulative Gain - position-weighted relevance
"""
from dataclasses import dataclass, field
import math
from .protocols import SearchResult


@dataclass
class EvaluationMetrics:
    """Computed metrics for a single query."""
    query: str
    precision_at_k: dict[int, float] = field(default_factory=dict)  # k -> precision
    recall_at_k: dict[int, float] = field(default_factory=dict)     # k -> recall
    reciprocal_rank: float = 0.0
    ndcg_at_k: dict[int, float] = field(default_factory=dict)       # k -> ndcg


@dataclass
class AggregateMetrics:
    """Aggregated metrics across multiple queries."""
    num_queries: int = 0
    mean_precision: dict[int, float] = field(default_factory=dict)
    mean_recall: dict[int, float] = field(default_factory=dict)
    mrr: float = 0.0
    mean_ndcg: dict[int, float] = field(default_factory=dict)


class MetricsCalculator:
    """
    Calculate information retrieval metrics.

    Computes metrics comparing retrieval results against ground truth
    relevance judgments.
    """

    def __init__(self, k_values: list[int] | None = None):
        """
        Initialize metrics calculator.

        Args:
            k_values: List of K values for @K metrics (default: [1, 3, 5, 10])
        """
        self.k_values = k_values or [1, 3, 5, 10]

    def compute(
        self,
        query: str,
        results: list[SearchResult],
        relevant_ids: set[str],
        relevance_scores: dict[str, int] | None = None
    ) -> EvaluationMetrics:
        """
        Compute metrics for a single query.

        Args:
            query: The query string
            results: Ranked search results
            relevant_ids: Set of relevant document IDs (ground truth)
            relevance_scores: Optional dict of doc_id -> relevance score (0-2) for NDCG

        Returns:
            Computed metrics
        """
        metrics = EvaluationMetrics(query=query)

        # Extract result IDs in ranked order
        result_ids = [r.document.id for r in results]

        # Binary relevance for precision/recall
        is_relevant = [doc_id in relevant_ids for doc_id in result_ids]

        # Precision@K and Recall@K
        for k in self.k_values:
            if k <= len(results):
                relevant_in_k = sum(is_relevant[:k])
                metrics.precision_at_k[k] = relevant_in_k / k
                metrics.recall_at_k[k] = (
                    relevant_in_k / len(relevant_ids)
                    if relevant_ids else 0.0
                )
            else:
                # When k exceeds results, use all available results
                relevant_in_all = sum(is_relevant)
                metrics.precision_at_k[k] = relevant_in_all / len(results) if results else 0.0
                metrics.recall_at_k[k] = (
                    relevant_in_all / len(relevant_ids) if relevant_ids else 0.0
                )

        # Reciprocal Rank (1/rank of first relevant result)
        metrics.reciprocal_rank = 0.0
        for i, rel in enumerate(is_relevant):
            if rel:
                metrics.reciprocal_rank = 1.0 / (i + 1)
                break

        # NDCG@K (with graded relevance if available)
        if relevance_scores:
            gains = [relevance_scores.get(doc_id, 0) for doc_id in result_ids]
        else:
            gains = [1 if rel else 0 for rel in is_relevant]

        for k in self.k_values:
            metrics.ndcg_at_k[k] = self._ndcg(gains[:k], relevance_scores, relevant_ids, k)

        return metrics

    def _ndcg(
        self,
        gains: list[int],
        relevance_scores: dict[str, int] | None,
        relevant_ids: set[str],
        k: int
    ) -> float:
        """Compute NDCG@K."""
        if not gains:
            return 0.0

        # DCG: sum of gain / log2(position + 1)
        dcg = sum(
            g / math.log2(i + 2)  # +2 because positions are 1-indexed
            for i, g in enumerate(gains)
        )

        # Ideal DCG: best possible ordering
        if relevance_scores:
            ideal_gains = sorted(relevance_scores.values(), reverse=True)[:k]
        else:
            ideal_gains = [1] * min(len(relevant_ids), k)

        idcg = sum(
            g / math.log2(i + 2)
            for i, g in enumerate(ideal_gains)
        )

        return dcg / idcg if idcg > 0 else 0.0

    def aggregate(self, all_metrics: list[EvaluationMetrics]) -> AggregateMetrics:
        """
        Aggregate metrics across multiple queries.

        Args:
            all_metrics: List of per-query metrics

        Returns:
            Aggregated metrics with means
        """
        if not all_metrics:
            return AggregateMetrics()

        n = len(all_metrics)
        agg = AggregateMetrics(num_queries=n)

        # Mean Precision@K
        for k in self.k_values:
            values = [m.precision_at_k.get(k, 0) for m in all_metrics]
            agg.mean_precision[k] = sum(values) / n

        # Mean Recall@K
        for k in self.k_values:
            values = [m.recall_at_k.get(k, 0) for m in all_metrics]
            agg.mean_recall[k] = sum(values) / n

        # MRR
        agg.mrr = sum(m.reciprocal_rank for m in all_metrics) / n

        # Mean NDCG@K
        for k in self.k_values:
            values = [m.ndcg_at_k.get(k, 0) for m in all_metrics]
            agg.mean_ndcg[k] = sum(values) / n

        return agg


def format_metrics(metrics: AggregateMetrics, name: str = "Results") -> str:
    """
    Format metrics as human-readable string.

    Args:
        metrics: Aggregated metrics to format
        name: Name for this evaluation run

    Returns:
        Formatted string
    """
    lines = [
        f"\n{'='*60}",
        f" {name} ({metrics.num_queries} queries)",
        f"{'='*60}",
        "",
        " Precision@K:",
    ]

    for k, v in sorted(metrics.mean_precision.items()):
        lines.append(f"   P@{k}: {v:.3f}")

    lines.extend([
        "",
        " Recall@K:",
    ])

    for k, v in sorted(metrics.mean_recall.items()):
        lines.append(f"   R@{k}: {v:.3f}")

    lines.extend([
        "",
        f" MRR: {metrics.mrr:.3f}",
        "",
        " NDCG@K:",
    ])

    for k, v in sorted(metrics.mean_ndcg.items()):
        lines.append(f"   NDCG@{k}: {v:.3f}")

    lines.append(f"{'='*60}\n")

    return "\n".join(lines)


def format_comparison(
    baseline: AggregateMetrics,
    candidate: AggregateMetrics,
    baseline_name: str = "Baseline",
    candidate_name: str = "Candidate"
) -> str:
    """
    Format side-by-side comparison of two evaluation runs.

    Args:
        baseline: Baseline metrics
        candidate: Candidate metrics
        baseline_name: Name for baseline
        candidate_name: Name for candidate

    Returns:
        Formatted comparison string
    """
    lines = [
        f"\n{'='*70}",
        f" Comparison: {baseline_name} vs {candidate_name}",
        f"{'='*70}",
        f"{'Metric':<15} {baseline_name:>15} {candidate_name:>15} {'Delta':>15}",
        f"{'-'*70}",
    ]

    # Precision@K
    for k in sorted(baseline.mean_precision.keys()):
        b = baseline.mean_precision[k]
        c = candidate.mean_precision[k]
        delta = c - b
        sign = "+" if delta > 0 else ""
        lines.append(f"{'P@'+str(k):<15} {b:>15.3f} {c:>15.3f} {sign+f'{delta:.3f}':>15}")

    lines.append(f"{'-'*70}")

    # Recall@K
    for k in sorted(baseline.mean_recall.keys()):
        b = baseline.mean_recall[k]
        c = candidate.mean_recall[k]
        delta = c - b
        sign = "+" if delta > 0 else ""
        lines.append(f"{'R@'+str(k):<15} {b:>15.3f} {c:>15.3f} {sign+f'{delta:.3f}':>15}")

    lines.append(f"{'-'*70}")

    # MRR
    b = baseline.mrr
    c = candidate.mrr
    delta = c - b
    sign = "+" if delta > 0 else ""
    lines.append(f"{'MRR':<15} {b:>15.3f} {c:>15.3f} {sign+f'{delta:.3f}':>15}")

    lines.append(f"{'-'*70}")

    # NDCG@K
    for k in sorted(baseline.mean_ndcg.keys()):
        b = baseline.mean_ndcg[k]
        c = candidate.mean_ndcg[k]
        delta = c - b
        sign = "+" if delta > 0 else ""
        lines.append(f"{'NDCG@'+str(k):<15} {b:>15.3f} {c:>15.3f} {sign+f'{delta:.3f}':>15}")

    lines.append(f"{'='*70}\n")

    return "\n".join(lines)
