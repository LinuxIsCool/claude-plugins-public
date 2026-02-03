"""LLM-based relevance judgment for evaluation.

Uses LLMs to generate ground truth relevance scores for query-document pairs,
enabling automated evaluation without manual annotation.
"""
import logging
from dataclasses import dataclass
from .protocols import SearchResult
from .ollama_generator import OllamaGenerator

logger = logging.getLogger(__name__)


@dataclass
class RelevanceJudgment:
    """A relevance judgment for a query-document pair."""
    query: str
    document_id: str
    score: int  # 0=not relevant, 1=somewhat relevant, 2=highly relevant
    explanation: str


RELEVANCE_PROMPT = """You are a search relevance evaluator. Given a user query and a document, rate how relevant the document is to answering the query.

Query: {query}

Document:
{document}

Rate the relevance on a 0-2 scale:
- 0: Not relevant - The document does not help answer the query
- 1: Somewhat relevant - The document contains some useful information but doesn't fully answer the query
- 2: Highly relevant - The document directly answers or is essential for answering the query

Respond with ONLY a JSON object in this format:
{{"score": <0-2>, "explanation": "<brief explanation>"}}"""


class RelevanceJudge:
    """
    Judge query-document relevance using an LLM.

    This enables automated evaluation by having an LLM act as a surrogate
    for human relevance judgments. While not perfect, LLM judges show
    strong correlation with human assessments for search evaluation.
    """

    def __init__(
        self,
        generator: OllamaGenerator | None = None,
        max_doc_chars: int = 2000
    ):
        """
        Initialize relevance judge.

        Args:
            generator: LLM generator for judging (creates default if None)
            max_doc_chars: Maximum document characters to include in prompt
        """
        self.generator = generator or OllamaGenerator(
            model="llama3.2:3b"  # Balanced size/capability for judgment
        )
        self.max_doc_chars = max_doc_chars

    def judge(self, query: str, result: SearchResult) -> RelevanceJudgment:
        """
        Judge relevance of a single result.

        Args:
            query: User query
            result: Search result to judge

        Returns:
            Relevance judgment with score and explanation
        """
        doc_content = result.document.content
        if len(doc_content) > self.max_doc_chars:
            doc_content = doc_content[:self.max_doc_chars] + "\n...[truncated]..."

        prompt = RELEVANCE_PROMPT.format(
            query=query,
            document=doc_content
        )

        try:
            response = self.generator.generate(prompt, max_tokens=200)
            judgment = self._parse_judgment(response)
        except (ConnectionError, TimeoutError, OSError) as e:
            # Log and fallback on LLM unavailability
            logger.warning(f"Relevance judgment failed for {result.document.id}: {e}")
            judgment = {"score": 1, "explanation": f"Judgment failed: {e}"}

        return RelevanceJudgment(
            query=query,
            document_id=result.document.id,
            score=judgment["score"],
            explanation=judgment["explanation"]
        )

    def judge_batch(
        self,
        query: str,
        results: list[SearchResult],
        show_progress: bool = True
    ) -> list[RelevanceJudgment]:
        """
        Judge relevance of multiple results.

        Args:
            query: User query
            results: Search results to judge
            show_progress: Whether to print progress

        Returns:
            List of relevance judgments
        """
        judgments = []
        total = len(results)

        for i, result in enumerate(results):
            if show_progress and i % 5 == 0:
                print(f"Judging result {i+1}/{total}")

            judgments.append(self.judge(query, result))

        return judgments

    def _parse_judgment(self, response: str) -> dict:
        """Parse LLM response into judgment dict."""
        import json
        import re

        # Try direct JSON parse
        try:
            # Find JSON object in response
            match = re.search(r'\{[^}]+\}', response, re.DOTALL)
            if match:
                data = json.loads(match.group())
                score = int(data.get("score", 1))
                score = max(0, min(2, score))  # Clamp to 0-2
                return {
                    "score": score,
                    "explanation": str(data.get("explanation", ""))
                }
        except (json.JSONDecodeError, ValueError):
            pass

        # Fallback: extract score from text
        for s in [2, 1, 0]:
            if str(s) in response:
                return {"score": s, "explanation": response[:200]}

        return {"score": 1, "explanation": "Could not parse judgment"}


class GroundTruthBuilder:
    """
    Build ground truth datasets for evaluation.

    Creates sets of (query, relevant_doc_ids) pairs using LLM judgments.
    """

    def __init__(self, judge: RelevanceJudge | None = None):
        """
        Initialize ground truth builder.

        Args:
            judge: Relevance judge to use (creates default if None)
        """
        self.judge = judge or RelevanceJudge()

    def build_from_results(
        self,
        queries: list[str],
        results_per_query: dict[str, list[SearchResult]],
        relevance_threshold: int = 1
    ) -> dict[str, set[str]]:
        """
        Build ground truth from search results.

        Args:
            queries: List of evaluation queries
            results_per_query: Search results for each query
            relevance_threshold: Minimum score to consider relevant (0-2)

        Returns:
            Dict mapping query to set of relevant document IDs
        """
        ground_truth = {}

        for query in queries:
            results = results_per_query.get(query, [])
            if not results:
                ground_truth[query] = set()
                continue

            judgments = self.judge.judge_batch(query, results, show_progress=True)

            relevant_ids = {
                j.document_id
                for j in judgments
                if j.score >= relevance_threshold
            }

            ground_truth[query] = relevant_ids
            print(f"Query: '{query[:50]}...' -> {len(relevant_ids)}/{len(results)} relevant")

        return ground_truth
