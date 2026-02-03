"""
Quality Metrics - Aggregated quality measurements and gates.

Provides thresholds for quality gates and regression detection.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from .dimensions import EvaluationDimension, DimensionType, score_to_grade


@dataclass
class QualityGates:
    """
    Hard limits for quality metrics.

    If any gate is violated, evaluation fails.
    """
    min_signal_to_noise: float = 0.6
    min_actionability: float = 0.5
    min_accuracy: float = 0.7
    min_relevance: float = 0.6
    min_overall: float = 0.6

    def check(self, metrics: "QualityMetrics") -> list[str]:
        """
        Check if metrics pass all gates.

        Only checks dimensions that were actually evaluated (not None).

        Returns:
            List of violation messages (empty if all pass)
        """
        violations = []

        if metrics.signal_to_noise is not None and metrics.signal_to_noise < self.min_signal_to_noise:
            violations.append(
                f"Signal-to-noise ({metrics.signal_to_noise:.2f}) below "
                f"minimum ({self.min_signal_to_noise:.2f})"
            )

        if metrics.actionability is not None and metrics.actionability < self.min_actionability:
            violations.append(
                f"Actionability ({metrics.actionability:.2f}) below "
                f"minimum ({self.min_actionability:.2f})"
            )

        if metrics.accuracy is not None and metrics.accuracy < self.min_accuracy:
            violations.append(
                f"Accuracy ({metrics.accuracy:.2f}) below "
                f"minimum ({self.min_accuracy:.2f})"
            )

        if metrics.relevance is not None and metrics.relevance < self.min_relevance:
            violations.append(
                f"Relevance ({metrics.relevance:.2f}) below "
                f"minimum ({self.min_relevance:.2f})"
            )

        if metrics.overall < self.min_overall:
            violations.append(
                f"Overall score ({metrics.overall:.2f}) below "
                f"minimum ({self.min_overall:.2f})"
            )

        return violations


@dataclass
class QualityMetrics:
    """
    Aggregated quality metrics from evaluation.

    Computed from individual dimension scores.
    All dimensions are Optional - only evaluated dimensions are set.
    """
    signal_to_noise: Optional[float] = None
    actionability: Optional[float] = None
    relevance: Optional[float] = None
    coherence: Optional[float] = None
    accuracy: Optional[float] = None
    completeness: Optional[float] = None

    # Weights for overall score computation
    _weights: dict = field(default_factory=lambda: {
        "signal_to_noise": 0.25,
        "actionability": 0.25,
        "relevance": 0.20,
        "coherence": 0.15,
        "accuracy": 0.10,
        "completeness": 0.05,
    })

    @property
    def overall(self) -> float:
        """Compute weighted overall score."""
        total_weight = 0.0
        weighted_sum = 0.0

        for dim, weight in self._weights.items():
            value = getattr(self, dim, None)
            if value is not None:
                weighted_sum += value * weight
                total_weight += weight

        if total_weight == 0:
            return 0.0

        return weighted_sum / total_weight

    @property
    def grade(self) -> str:
        """Convert overall score to letter grade."""
        return score_to_grade(self.overall)

    @classmethod
    def from_dimensions(cls, dimensions: list[EvaluationDimension]) -> "QualityMetrics":
        """Create metrics from a list of dimension evaluations.

        Only dimensions that were actually evaluated are set; others remain None.
        This allows gate checks to skip dimensions that weren't assessed.
        """
        dim_map = {d.dimension: d.score for d in dimensions}

        return cls(
            signal_to_noise=dim_map.get(DimensionType.SIGNAL_TO_NOISE, None),
            actionability=dim_map.get(DimensionType.ACTIONABILITY, None),
            relevance=dim_map.get(DimensionType.RELEVANCE, None),
            coherence=dim_map.get(DimensionType.COHERENCE, None),
            accuracy=dim_map.get(DimensionType.ACCURACY),
            completeness=dim_map.get(DimensionType.COMPLETENESS),
        )

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "signal_to_noise": self.signal_to_noise,
            "actionability": self.actionability,
            "relevance": self.relevance,
            "coherence": self.coherence,
            "accuracy": self.accuracy,
            "completeness": self.completeness,
            "overall": self.overall,
            "grade": self.grade,
        }


@dataclass
class RegressionWarning:
    """Warning when metrics degrade from baseline."""
    metric: str
    baseline_value: float
    current_value: float
    change_percent: float
    message: str


def check_regression(
    current: QualityMetrics,
    baseline: QualityMetrics,
    threshold: float = 0.1
) -> list[RegressionWarning]:
    """
    Check for regression from baseline metrics.

    Args:
        current: Current evaluation metrics
        baseline: Baseline metrics to compare against
        threshold: Percentage degradation to trigger warning (default 10%)

    Returns:
        List of regression warnings
    """
    warnings = []
    metrics_to_check = [
        ("signal_to_noise", "Signal-to-Noise"),
        ("actionability", "Actionability"),
        ("relevance", "Relevance"),
        ("coherence", "Coherence"),
        ("accuracy", "Accuracy"),
        ("completeness", "Completeness"),
        ("overall", "Overall"),
    ]

    for attr, name in metrics_to_check:
        current_val = getattr(current, attr, None)
        baseline_val = getattr(baseline, attr, None)

        if current_val is None or baseline_val is None:
            continue

        if baseline_val > 0:
            change = (baseline_val - current_val) / baseline_val
            if change > threshold:
                warnings.append(RegressionWarning(
                    metric=attr,
                    baseline_value=baseline_val,
                    current_value=current_val,
                    change_percent=change * 100,
                    message=f"{name} degraded by {change*100:.1f}% "
                            f"({baseline_val:.2f} -> {current_val:.2f})"
                ))

    return warnings
