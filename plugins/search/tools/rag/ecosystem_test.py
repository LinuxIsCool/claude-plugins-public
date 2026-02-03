"""Ecosystem-specific test suite for agent-aware retrieval evaluation.

Generates test queries from the Claude plugins ecosystem and runs
comprehensive evaluations across multiple retriever configurations.
"""
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .protocols import Document, Retriever
from .evaluation import Evaluator, EvaluationResult


@dataclass
class TestQuery:
    """A test query with expected characteristics."""
    text: str
    category: str  # discovery, confirmation, historical, process, entity
    entity_type: str | None = None  # agent, skill, process, plugin
    expected_source: str | None = None  # expected file pattern
    difficulty: str = "normal"  # easy, normal, hard


@dataclass
class TestSuite:
    """Collection of test queries organized by category."""
    name: str
    queries: list[TestQuery] = field(default_factory=list)
    description: str = ""

    def by_category(self) -> dict[str, list[TestQuery]]:
        """Group queries by category."""
        groups: dict[str, list[TestQuery]] = {}
        for q in self.queries:
            groups.setdefault(q.category, []).append(q)
        return groups

    def by_entity_type(self) -> dict[str, list[TestQuery]]:
        """Group queries by entity type."""
        groups: dict[str, list[TestQuery]] = {}
        for q in self.queries:
            if q.entity_type:
                groups.setdefault(q.entity_type, []).append(q)
        return groups


class EcosystemQueryGenerator:
    """
    Generate test queries from ecosystem content.

    Scans registry files, plugin structures, and journal entries
    to create realistic test queries that agents might ask.
    """

    def __init__(self, root_path: Path):
        """
        Initialize generator.

        Args:
            root_path: Root path of the ecosystem repository
        """
        self.root_path = root_path

    def generate(self) -> TestSuite:
        """Generate comprehensive test suite from ecosystem."""
        queries: list[TestQuery] = []

        # Entity queries from registry
        queries.extend(self._generate_agent_queries())
        queries.extend(self._generate_process_queries())
        queries.extend(self._generate_plugin_queries())

        # Discovery queries (broad exploration)
        queries.extend(self._generate_discovery_queries())

        # Confirmation queries (precise lookup)
        queries.extend(self._generate_confirmation_queries())

        # Historical queries (journal, logs)
        queries.extend(self._generate_historical_queries())

        return TestSuite(
            name="ecosystem",
            queries=queries,
            description="Auto-generated queries from ecosystem content"
        )

    def _generate_agent_queries(self) -> list[TestQuery]:
        """Generate queries about agents from registry."""
        queries = []
        agents_file = self.root_path / ".claude/registry/agents.md"

        if not agents_file.exists():
            return queries

        try:
            content = agents_file.read_text(encoding='utf-8')
        except (UnicodeDecodeError, PermissionError, OSError) as e:
            print(f"Warning: Could not read {agents_file}: {e}")
            return queries

        # Extract agent names and generate queries
        # Pattern matches: **name** followed by description
        agent_pattern = r'\*\*([a-z0-9_-]+)\*\*\s*[-–:]\s*(.+?)(?=\n|$)'
        matches = re.findall(agent_pattern, content, re.IGNORECASE)

        for name, description in matches:
            # Discovery query
            queries.append(TestQuery(
                text=f"What is the {name} agent and what does it do?",
                category="entity",
                entity_type="agent",
                expected_source="registry/agents",
                difficulty="easy"
            ))

            # Usage query
            queries.append(TestQuery(
                text=f"When should I use the {name} agent?",
                category="confirmation",
                entity_type="agent",
                expected_source="registry/agents",
                difficulty="normal"
            ))

        # General agent discovery
        queries.append(TestQuery(
            text="What agents are available in this ecosystem?",
            category="discovery",
            entity_type="agent",
            expected_source="registry/agents",
            difficulty="easy"
        ))

        return queries

    def _generate_process_queries(self) -> list[TestQuery]:
        """Generate queries about processes from registry."""
        queries = []
        processes_file = self.root_path / ".claude/registry/processes.md"

        if not processes_file.exists():
            return queries

        try:
            content = processes_file.read_text(encoding='utf-8')
        except (UnicodeDecodeError, PermissionError, OSError) as e:
            print(f"Warning: Could not read {processes_file}: {e}")
            return queries

        # Extract process names
        process_pattern = r'##\s*\d*\.?\s*([A-Z][^#\n]+)'
        matches = re.findall(process_pattern, content)

        for process_name in matches:
            process_name = process_name.strip()
            queries.append(TestQuery(
                text=f"How does {process_name} work?",
                category="process",
                entity_type="process",
                expected_source="registry/processes",
                difficulty="normal"
            ))

        queries.append(TestQuery(
            text="What processes are defined in this ecosystem?",
            category="discovery",
            entity_type="process",
            expected_source="registry/processes",
            difficulty="easy"
        ))

        return queries

    def _generate_plugin_queries(self) -> list[TestQuery]:
        """Generate queries about plugins."""
        queries = []
        plugins_dir = self.root_path / "plugins"

        if not plugins_dir.exists():
            return queries

        # Scan plugin directories
        for plugin_dir in plugins_dir.iterdir():
            if not plugin_dir.is_dir():
                continue

            plugin_name = plugin_dir.name

            # Check for SKILL.md or skills directory
            skill_files = list(plugin_dir.glob("**/SKILL.md"))
            if skill_files:
                queries.append(TestQuery(
                    text=f"What does the {plugin_name} plugin do?",
                    category="entity",
                    entity_type="plugin",
                    expected_source=f"plugins/{plugin_name}",
                    difficulty="easy"
                ))

                queries.append(TestQuery(
                    text=f"What skills does {plugin_name} provide?",
                    category="confirmation",
                    entity_type="skill",
                    expected_source=f"plugins/{plugin_name}",
                    difficulty="normal"
                ))

        queries.append(TestQuery(
            text="What plugins are available?",
            category="discovery",
            entity_type="plugin",
            expected_source="plugins",
            difficulty="easy"
        ))

        return queries

    def _generate_discovery_queries(self) -> list[TestQuery]:
        """Generate broad discovery queries."""
        return [
            TestQuery(
                text="How is this codebase organized?",
                category="discovery",
                difficulty="easy"
            ),
            TestQuery(
                text="What are the main components of this system?",
                category="discovery",
                difficulty="normal"
            ),
            TestQuery(
                text="Where is configuration stored?",
                category="discovery",
                difficulty="normal"
            ),
            TestQuery(
                text="How do I create a new plugin?",
                category="discovery",
                entity_type="plugin",
                expected_source="CLAUDE.md",
                difficulty="normal"
            ),
            TestQuery(
                text="What is the progressive disclosure pattern?",
                category="discovery",
                difficulty="hard"
            ),
            TestQuery(
                text="How do agents communicate with each other?",
                category="discovery",
                entity_type="agent",
                difficulty="hard"
            ),
        ]

    def _generate_confirmation_queries(self) -> list[TestQuery]:
        """Generate precise confirmation queries."""
        return [
            TestQuery(
                text="Where is CLAUDE.md located?",
                category="confirmation",
                expected_source="CLAUDE.md",
                difficulty="easy"
            ),
            TestQuery(
                text="What is the journal entry format?",
                category="confirmation",
                entity_type="process",
                expected_source="journal",
                difficulty="normal"
            ),
            TestQuery(
                text="How do I define a skill in SKILL.md?",
                category="confirmation",
                entity_type="skill",
                expected_source="skills",
                difficulty="normal"
            ),
            TestQuery(
                text="What is the Task tool subagent_type parameter?",
                category="confirmation",
                expected_source="agents",
                difficulty="hard"
            ),
        ]

    def _generate_historical_queries(self) -> list[TestQuery]:
        """Generate queries about historical content."""
        queries = []
        journal_dir = self.root_path / ".claude/journal"

        if journal_dir.exists():
            queries.append(TestQuery(
                text="What was worked on today?",
                category="historical",
                expected_source="journal",
                difficulty="normal"
            ))
            queries.append(TestQuery(
                text="What recent decisions were made?",
                category="historical",
                expected_source="journal",
                difficulty="normal"
            ))

        return queries


@dataclass
class ConfigResult:
    """Result for a single retriever configuration."""
    config_name: str
    evaluation: EvaluationResult
    elapsed_seconds: float


@dataclass
class SuiteResult:
    """Complete result for test suite across all configurations."""
    suite_name: str
    timestamp: str
    configs: list[ConfigResult]
    category_breakdown: dict[str, dict[str, float]]  # category -> config -> MRR


class MultiConfigRunner:
    """
    Run test suite across multiple retriever configurations.

    Provides comprehensive comparison of different retrieval strategies
    on the same query set.
    """

    def __init__(self, evaluator: Evaluator | None = None):
        """
        Initialize runner.

        Args:
            evaluator: Evaluator to use (creates default if None)
        """
        self.evaluator = evaluator or Evaluator()

    def run(
        self,
        suite: TestSuite,
        retrievers: dict[str, Retriever],
        k: int = 10,
        generate_ground_truth: bool = True,
        relevance_threshold: int = 1
    ) -> SuiteResult:
        """
        Run test suite across all configured retrievers.

        Args:
            suite: Test suite to run
            retrievers: Dict of config_name -> retriever
            k: Results per query
            generate_ground_truth: Whether to use LLM for ground truth
            relevance_threshold: Minimum score (0-2) to consider relevant

        Returns:
            Complete suite result with per-config metrics
        """
        import time

        configs = []
        ground_truth = None
        queries = [q.text for q in suite.queries]
        threshold = relevance_threshold

        for config_name, retriever in retrievers.items():
            print(f"\nEvaluating: {config_name}")

            start = time.time()
            result = self.evaluator.evaluate(
                retriever,
                queries,
                ground_truth=ground_truth,
                k=k,
                generate_ground_truth=generate_ground_truth and ground_truth is None
            )
            elapsed = time.time() - start

            configs.append(ConfigResult(
                config_name=config_name,
                evaluation=result,
                elapsed_seconds=elapsed
            ))

            # Reuse ground truth from first config
            if ground_truth is None and result.judgments:
                ground_truth = {}
                for j in result.judgments:
                    ground_truth.setdefault(j.query, set())
                    if j.score >= threshold:
                        ground_truth[j.query].add(j.document_id)

        # Compute category breakdown
        category_breakdown = self._compute_category_breakdown(suite, configs)

        return SuiteResult(
            suite_name=suite.name,
            timestamp=datetime.now().isoformat(),
            configs=configs,
            category_breakdown=category_breakdown
        )

    def _compute_category_breakdown(
        self,
        suite: TestSuite,
        configs: list[ConfigResult]
    ) -> dict[str, dict[str, float]]:
        """Compute MRR by category for each config."""
        breakdown: dict[str, dict[str, float]] = {}
        categories = suite.by_category()

        for category, queries in categories.items():
            query_texts = {q.text for q in queries}
            breakdown[category] = {}

            for config in configs:
                # Find metrics for queries in this category
                category_metrics = [
                    m for m in config.evaluation.per_query_metrics
                    if m.query in query_texts
                ]

                if category_metrics:
                    mrr = sum(m.reciprocal_rank for m in category_metrics) / len(category_metrics)
                    breakdown[category][config.config_name] = mrr
                else:
                    breakdown[category][config.config_name] = 0.0

        return breakdown


def format_suite_result(result: SuiteResult) -> str:
    """Format suite result as human-readable string."""
    lines = [
        f"\n{'='*70}",
        f" Test Suite: {result.suite_name}",
        f" Run at: {result.timestamp}",
        f"{'='*70}",
        "",
        " Configuration Comparison:",
        f"{'-'*70}",
        f"{'Config':<20} {'MRR':>10} {'P@3':>10} {'P@5':>10} {'Time':>10}",
        f"{'-'*70}",
    ]

    for config in result.configs:
        m = config.evaluation.metrics
        lines.append(
            f"{config.config_name:<20} "
            f"{m.mrr:>10.3f} "
            f"{m.mean_precision.get(3, 0):>10.3f} "
            f"{m.mean_precision.get(5, 0):>10.3f} "
            f"{config.elapsed_seconds:>9.1f}s"
        )

    lines.extend([
        f"{'-'*70}",
        "",
        " Category Breakdown (MRR):",
        f"{'-'*70}",
    ])

    # Header for category table
    config_names = [c.config_name for c in result.configs]
    header = f"{'Category':<15}" + "".join(f"{name:>12}" for name in config_names)
    lines.append(header)
    lines.append(f"{'-'*70}")

    for category, scores in sorted(result.category_breakdown.items()):
        row = f"{category:<15}"
        for config_name in config_names:
            score = scores.get(config_name, 0)
            row += f"{score:>12.3f}"
        lines.append(row)

    lines.append(f"{'='*70}\n")

    return "\n".join(lines)


def save_suite_result(result: SuiteResult, path: Path | str) -> None:
    """Save suite result to JSON file."""
    path = Path(path)

    data = {
        "suite_name": result.suite_name,
        "timestamp": result.timestamp,
        "configs": [
            {
                "name": c.config_name,
                "elapsed_seconds": c.elapsed_seconds,
                "metrics": {
                    "mrr": c.evaluation.metrics.mrr,
                    "precision": c.evaluation.metrics.mean_precision,
                    "recall": c.evaluation.metrics.mean_recall,
                    "ndcg": c.evaluation.metrics.mean_ndcg,
                    "num_queries": c.evaluation.metrics.num_queries
                }
            }
            for c in result.configs
        ],
        "category_breakdown": result.category_breakdown
    }

    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Saved suite result to {path}")
