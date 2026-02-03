"""
Evaluation Plugin - Automated system evaluation for claude-plugins ecosystem.

Uses HippoRAG for knowledge retrieval and multi-dimensional quality assessment.
"""

from .evaluator import Evaluator, EvaluationResult
from .metrics import QualityMetrics, QualityGates
from .dimensions import EvaluationDimension, score_to_grade

__all__ = [
    "Evaluator",
    "EvaluationResult",
    "QualityMetrics",
    "QualityGates",
    "EvaluationDimension",
    "score_to_grade",
]
