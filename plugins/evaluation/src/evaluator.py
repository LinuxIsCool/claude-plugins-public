"""
Core Evaluator - HippoRAG-based evaluation engine.

Provides multi-dimensional quality assessment using knowledge retrieval
to validate and contextualize content.

Supports both HippoRAG (when properly configured) and direct Ollama fallback.
"""

import json
import os
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
import yaml

from .dimensions import (
    DimensionType,
    EvaluationDimension,
    DIMENSION_PROMPTS,
    parse_dimension_response,
)
from .metrics import QualityMetrics, QualityGates


def query_ollama(prompt: str, model: str = "llama3.2", base_url: str = "http://localhost:11434") -> str:
    """
    Query Ollama directly without HippoRAG.

    Fallback for when HippoRAG embedding models aren't available.
    """
    url = f"{base_url}/api/generate"
    data = json.dumps({
        "model": model,
        "prompt": prompt,
        "stream": False,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result.get("response", "")
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        raise RuntimeError(f"Ollama query failed: {e}")


@dataclass
class EvaluationResult:
    """
    Complete evaluation result.

    Contains all dimension scores, aggregated metrics, and metadata.
    """
    id: str
    timestamp: str
    target_type: str  # "briefing", "extraction", "agent_output"
    target_id: str
    dimensions: list[EvaluationDimension]
    metrics: QualityMetrics
    gate_violations: list[str]
    passed: bool
    context: dict = field(default_factory=dict)
    retrieved_docs: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "dimensions": [d.to_dict() for d in self.dimensions],
            "metrics": self.metrics.to_dict(),
            "gate_violations": self.gate_violations,
            "passed": self.passed,
            "context": self.context,
            "retrieved_docs_count": len(self.retrieved_docs),
        }

    def summary(self) -> str:
        """Generate human-readable summary."""
        status = "PASSED" if self.passed else "FAILED"
        lines = [
            f"Evaluation {self.id}: {status}",
            f"Target: {self.target_type} ({self.target_id})",
            f"Overall: {self.metrics.overall:.2f} ({self.metrics.grade})",
            "",
            "Dimensions:",
        ]

        for dim in self.dimensions:
            lines.append(
                f"  {dim.dimension.value}: {dim.score:.2f} ({dim.grade}) - {dim.reasoning[:50]}..."
            )

        if self.gate_violations:
            lines.append("")
            lines.append("Gate Violations:")
            for v in self.gate_violations:
                lines.append(f"  - {v}")

        return "\n".join(lines)


class Evaluator:
    """
    HippoRAG-based evaluator for ecosystem content.

    Uses multi-hop retrieval to find relevant context for evaluation,
    then applies multi-dimensional quality assessment.
    """

    def __init__(
        self,
        save_dir: Optional[str] = None,
        llm_model: str = "ollama/llama3.2",
        embedding_model: str = "ollama/nomic-embed-text",
        llm_base_url: str = "http://localhost:11434",
        embedding_base_url: str = "http://localhost:11434",
        gates: Optional[QualityGates] = None,
    ):
        """
        Initialize the evaluator.

        Args:
            save_dir: Directory for HippoRAG storage (default: .claude/evaluation/hipporag)
            llm_model: LLM model identifier
            embedding_model: Embedding model identifier
            llm_base_url: Base URL for LLM API
            embedding_base_url: Base URL for embedding API
            gates: Quality gates for pass/fail determination
        """
        self.save_dir = save_dir or str(
            Path.home() / "Workspace/claude-plugins/.claude/evaluation/hipporag"
        )
        self.llm_model = llm_model
        self.embedding_model = embedding_model
        self.llm_base_url = llm_base_url
        self.embedding_base_url = embedding_base_url
        self.gates = gates or QualityGates()
        self._hipporag = None

    def _get_hipporag(self):
        """Lazy initialization of HippoRAG."""
        if self._hipporag is None:
            try:
                from hipporag import HippoRAG
                os.makedirs(self.save_dir, exist_ok=True)
                self._hipporag = HippoRAG(
                    save_dir=self.save_dir,
                    llm_model_name=self.llm_model,
                    embedding_model_name=self.embedding_model,
                    llm_base_url=self.llm_base_url,
                    embedding_base_url=self.embedding_base_url,
                )
            except ImportError:
                raise ImportError(
                    "HippoRAG not installed. Run: pip install hipporag"
                )
        return self._hipporag

    def index_knowledge(self, documents: list[str]) -> int:
        """
        Index documents into HippoRAG knowledge base.

        Args:
            documents: List of document texts to index

        Returns:
            Number of documents indexed
        """
        hipporag = self._get_hipporag()
        hipporag.index(docs=documents)
        return len(documents)

    def retrieve_context(self, query: str, num_docs: int = 5) -> list[dict]:
        """
        Retrieve relevant context using HippoRAG multi-hop retrieval.

        Args:
            query: Query to find relevant documents
            num_docs: Number of documents to retrieve

        Returns:
            List of retrieved document dictionaries
        """
        hipporag = self._get_hipporag()
        results = hipporag.retrieve(queries=[query], num_to_retrieve=num_docs)
        return results[0] if results else []

    def evaluate_dimension(
        self,
        content: str,
        dimension: DimensionType,
        context: str = "",
        reference: str = "",
    ) -> EvaluationDimension:
        """
        Evaluate content on a single dimension.

        Args:
            content: Content to evaluate
            dimension: Dimension to assess
            context: Context about intended purpose
            reference: Reference material for accuracy checking

        Returns:
            EvaluationDimension with score and reasoning
        """
        prompt_template = DIMENSION_PROMPTS.get(dimension, "")
        if not prompt_template:
            return EvaluationDimension(
                dimension=dimension,
                score=0.5,
                reasoning="No evaluation prompt available for this dimension",
            )

        prompt = prompt_template.format(
            content=content,
            context=context,
            reference=reference,
        )

        # Try HippoRAG first, fall back to direct Ollama
        response_text = ""
        try:
            hipporag = self._get_hipporag()
            response = hipporag.rag_qa(queries=[prompt])
            response_text = response[0] if response else ""
        except Exception as hippo_error:
            # Fallback: use direct Ollama query
            try:
                response_text = query_ollama(
                    prompt=prompt,
                    model=self.llm_model.replace("ollama/", ""),
                    base_url=self.llm_base_url,
                )
            except Exception as ollama_error:
                # Both failed
                return EvaluationDimension(
                    dimension=dimension,
                    score=0.5,
                    reasoning=f"Evaluation error: HippoRAG: {str(hippo_error)[:50]}, Ollama: {str(ollama_error)[:50]}",
                )

        score, reasoning, evidence = parse_dimension_response(response_text)

        return EvaluationDimension(
            dimension=dimension,
            score=score,
            reasoning=reasoning,
            evidence=evidence,
        )

    def evaluate(
        self,
        content: str,
        target_type: str,
        target_id: str,
        context: str = "",
        dimensions: Optional[list[DimensionType]] = None,
        retrieve_context: bool = True,
    ) -> EvaluationResult:
        """
        Perform full evaluation of content.

        Args:
            content: Content to evaluate
            target_type: Type of target ("briefing", "extraction", "agent_output")
            target_id: Identifier for the target
            context: Context about intended purpose
            dimensions: Dimensions to evaluate (default: all core dimensions)
            retrieve_context: Whether to retrieve supporting context from knowledge base

        Returns:
            Complete EvaluationResult
        """
        eval_id = f"eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{target_id[:8]}"
        timestamp = datetime.now().isoformat()

        # Default dimensions for different target types
        if dimensions is None:
            if target_type == "briefing":
                dimensions = [
                    DimensionType.SIGNAL_TO_NOISE,
                    DimensionType.ACTIONABILITY,
                    DimensionType.RELEVANCE,
                    DimensionType.COHERENCE,
                ]
            elif target_type == "extraction":
                dimensions = [
                    DimensionType.ACCURACY,
                    DimensionType.COMPLETENESS,
                    DimensionType.RELEVANCE,
                    DimensionType.COHERENCE,
                ]
            else:
                dimensions = [
                    DimensionType.SIGNAL_TO_NOISE,
                    DimensionType.ACTIONABILITY,
                    DimensionType.ACCURACY,
                    DimensionType.RELEVANCE,
                ]

        # Retrieve supporting context if enabled
        retrieved_docs = []
        reference = ""
        if retrieve_context:
            try:
                retrieved_docs = self.retrieve_context(content[:500], num_docs=3)
                if retrieved_docs:
                    reference = "\n---\n".join(
                        str(doc) for doc in retrieved_docs[:3]
                    )
            except Exception:
                pass  # Continue without retrieved context

        # Evaluate each dimension
        dimension_results = []
        for dim in dimensions:
            result = self.evaluate_dimension(
                content=content,
                dimension=dim,
                context=context,
                reference=reference,
            )
            dimension_results.append(result)

        # Compute aggregated metrics
        metrics = QualityMetrics.from_dimensions(dimension_results)

        # Check quality gates
        gate_violations = self.gates.check(metrics)
        passed = len(gate_violations) == 0

        return EvaluationResult(
            id=eval_id,
            timestamp=timestamp,
            target_type=target_type,
            target_id=target_id,
            dimensions=dimension_results,
            metrics=metrics,
            gate_violations=gate_violations,
            passed=passed,
            context={"purpose": context},
            retrieved_docs=retrieved_docs,
        )

    def save_result(self, result: EvaluationResult, output_dir: Optional[str] = None):
        """
        Save evaluation result to file.

        Args:
            result: Evaluation result to save
            output_dir: Output directory (default: .claude/evaluation/results)
        """
        output_dir = output_dir or str(
            Path.home() / "Workspace/claude-plugins/.claude/evaluation/results"
        )
        os.makedirs(output_dir, exist_ok=True)

        output_path = Path(output_dir) / f"{result.id}.yaml"
        with open(output_path, "w") as f:
            yaml.dump(result.to_dict(), f, default_flow_style=False)

        return str(output_path)


# Convenience functions for common evaluation patterns

def evaluate_briefing(
    briefing_content: str,
    briefing_id: str,
    session_context: str = "",
) -> EvaluationResult:
    """
    Evaluate a Conductor briefing.

    Args:
        briefing_content: The briefing text to evaluate
        briefing_id: Identifier for the briefing
        session_context: Context about the session

    Returns:
        EvaluationResult with focus on signal-to-noise and actionability
    """
    evaluator = Evaluator()
    return evaluator.evaluate(
        content=briefing_content,
        target_type="briefing",
        target_id=briefing_id,
        context=f"Session briefing for a new Claude instance. {session_context}",
    )


def evaluate_extraction(
    extraction_content: str,
    extraction_id: str,
    source_session: str = "",
) -> EvaluationResult:
    """
    Evaluate an Archivist extraction.

    Args:
        extraction_content: The extraction text to evaluate
        extraction_id: Identifier for the extraction
        source_session: Identifier of the source session

    Returns:
        EvaluationResult with focus on accuracy and completeness
    """
    evaluator = Evaluator()
    return evaluator.evaluate(
        content=extraction_content,
        target_type="extraction",
        target_id=extraction_id,
        context=f"Knowledge extraction from session {source_session}",
    )
