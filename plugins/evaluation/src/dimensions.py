"""
Evaluation Dimensions - Multi-dimensional quality assessment.

Each dimension represents a specific aspect of quality that can be
measured and scored independently.
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Optional


def score_to_grade(score: float) -> str:
    """Convert numeric score (0.0-1.0) to letter grade."""
    if score >= 0.9:
        return "A"
    elif score >= 0.8:
        return "B"
    elif score >= 0.7:
        return "C"
    elif score >= 0.6:
        return "D"
    else:
        return "F"


class DimensionType(Enum):
    """Types of evaluation dimensions."""
    SIGNAL_TO_NOISE = "signal_to_noise"
    ACTIONABILITY = "actionability"
    ACCURACY = "accuracy"
    RELEVANCE = "relevance"
    COMPLETENESS = "completeness"
    COHERENCE = "coherence"


@dataclass
class EvaluationDimension:
    """
    A single evaluation dimension with its score and reasoning.

    Attributes:
        dimension: The type of dimension being measured
        score: Score from 0.0 to 1.0
        reasoning: Explanation for the score
        evidence: Optional supporting evidence
    """
    dimension: DimensionType
    score: float
    reasoning: str
    evidence: Optional[str] = None

    def __post_init__(self):
        if not 0.0 <= self.score <= 1.0:
            raise ValueError(f"Score must be between 0.0 and 1.0, got {self.score}")

    @property
    def grade(self) -> str:
        """Convert score to letter grade."""
        return score_to_grade(self.score)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "dimension": self.dimension.value,
            "score": self.score,
            "grade": self.grade,
            "reasoning": self.reasoning,
            "evidence": self.evidence,
        }


# Prompts for LLM-based dimension scoring
DIMENSION_PROMPTS = {
    DimensionType.SIGNAL_TO_NOISE: """
Evaluate the signal-to-noise ratio of this content.

Signal = Information that is directly useful, actionable, or provides genuine insight
Noise = Filler text, redundant information, obvious statements, or irrelevant tangents

Content to evaluate:
{content}

Context (what this content is supposed to achieve):
{context}

Score from 0.0 (all noise) to 1.0 (pure signal).
Provide your reasoning and specific examples of signal vs noise.

Response format:
SCORE: <float>
REASONING: <explanation>
EVIDENCE: <specific examples>
""",

    DimensionType.ACTIONABILITY: """
Evaluate how actionable this content is.

Actionable = Provides clear next steps, specific recommendations, or concrete guidance
Non-actionable = Vague suggestions, theoretical discussion, or unclear direction

Content to evaluate:
{content}

Context (intended purpose):
{context}

Score from 0.0 (not actionable) to 1.0 (immediately actionable).
Identify specific actionable items or explain why they're missing.

Response format:
SCORE: <float>
REASONING: <explanation>
EVIDENCE: <specific actionable items or gaps>
""",

    DimensionType.ACCURACY: """
Evaluate the accuracy of this content.

Consider:
- Factual correctness based on available evidence
- Consistency with source material
- Appropriate confidence levels for uncertain information

Content to evaluate:
{content}

Reference material (if available):
{reference}

Score from 0.0 (inaccurate) to 1.0 (completely accurate).
Note any factual errors or unsupported claims.

Response format:
SCORE: <float>
REASONING: <explanation>
EVIDENCE: <errors found or verification notes>
""",

    DimensionType.RELEVANCE: """
Evaluate the relevance of this content to its intended purpose.

Content to evaluate:
{content}

Intended purpose:
{context}

Score from 0.0 (completely irrelevant) to 1.0 (highly relevant).
Identify relevant vs irrelevant sections.

Response format:
SCORE: <float>
REASONING: <explanation>
EVIDENCE: <relevant and irrelevant sections>
""",

    DimensionType.COMPLETENESS: """
Evaluate the completeness of this content.

Consider:
- Are all expected elements present?
- Are there obvious gaps or missing information?
- Is the depth appropriate for the context?

Content to evaluate:
{content}

Expected scope:
{context}

Score from 0.0 (incomplete) to 1.0 (comprehensive).
List any missing elements.

Response format:
SCORE: <float>
REASONING: <explanation>
EVIDENCE: <missing elements or completeness notes>
""",

    DimensionType.COHERENCE: """
Evaluate the coherence and organization of this content.

Consider:
- Logical flow and structure
- Clear connections between ideas
- Consistent terminology and framing

Content to evaluate:
{content}

Score from 0.0 (incoherent) to 1.0 (perfectly coherent).
Note any structural issues.

Response format:
SCORE: <float>
REASONING: <explanation>
EVIDENCE: <structural issues or strengths>
""",
}


def parse_dimension_response(response: str) -> tuple[float, str, str]:
    """
    Parse LLM response for dimension evaluation.

    Uses regex to extract score even if followed by other text.

    Returns:
        Tuple of (score, reasoning, evidence)
    """
    lines = response.strip().split('\n')
    score = 0.5  # default
    reasoning = ""
    evidence = ""

    current_field = None
    for line in lines:
        line = line.strip()
        if line.startswith("SCORE:"):
            # Use regex to extract first float from the line
            score_text = line.replace("SCORE:", "").strip()
            match = re.search(r'(\d+\.?\d*)', score_text)
            if match:
                try:
                    score = float(match.group(1))
                    score = max(0.0, min(1.0, score))  # clamp to [0, 1]
                except ValueError:
                    pass  # Keep default 0.5
            current_field = None
        elif line.startswith("REASONING:"):
            reasoning = line.replace("REASONING:", "").strip()
            current_field = "reasoning"
        elif line.startswith("EVIDENCE:"):
            evidence = line.replace("EVIDENCE:", "").strip()
            current_field = "evidence"
        elif current_field == "reasoning":
            reasoning += " " + line
        elif current_field == "evidence":
            evidence += " " + line

    return score, reasoning.strip(), evidence.strip()
