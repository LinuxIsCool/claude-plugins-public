"""
CLI for Evaluation Plugin.

Provides commands for evaluating briefings, extractions, and managing baselines.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .evaluator import Evaluator, evaluate_briefing, evaluate_extraction
from .metrics import QualityGates, check_regression, QualityMetrics


console = Console()


@click.group()
def cli():
    """Evaluation plugin - automated quality assessment for claude-plugins ecosystem."""
    pass


@cli.command()
@click.argument("content_file", type=click.Path(exists=True))
@click.option("--type", "-t", "target_type",
              type=click.Choice(["briefing", "extraction", "agent_output"]),
              default="briefing", help="Type of content to evaluate")
@click.option("--id", "-i", "target_id", default=None,
              help="Identifier for the content (default: filename)")
@click.option("--context", "-c", default="",
              help="Context about the content's purpose")
@click.option("--output", "-o", type=click.Path(),
              help="Output file for results (default: stdout)")
@click.option("--save/--no-save", default=True,
              help="Save results to .claude/evaluation/results/")
def evaluate(content_file: str, target_type: str, target_id: Optional[str],
             context: str, output: Optional[str], save: bool):
    """
    Evaluate content from a file.

    Example:
        eval evaluate briefing.md --type briefing --context "Morning session briefing"
    """
    content_path = Path(content_file)
    content = content_path.read_text()
    target_id = target_id or content_path.stem

    console.print(f"[bold]Evaluating {target_type}:[/bold] {target_id}")
    console.print()

    try:
        evaluator = Evaluator()
        result = evaluator.evaluate(
            content=content,
            target_type=target_type,
            target_id=target_id,
            context=context,
        )
    except ImportError as e:
        console.print(f"[red]Error:[/red] {e}")
        console.print("[yellow]Install HippoRAG with:[/yellow] pip install hipporag")
        sys.exit(1)

    # Display results
    _display_result(result)

    # Save if requested
    if save:
        output_path = evaluator.save_result(result)
        console.print(f"\n[dim]Results saved to: {output_path}[/dim]")

    # Write to output file if specified
    if output:
        with open(output, "w") as f:
            json.dump(result.to_dict(), f, indent=2)

    # Exit with error code if evaluation failed
    sys.exit(0 if result.passed else 1)


@cli.command()
@click.argument("briefing_file", type=click.Path(exists=True))
@click.option("--session", "-s", default="", help="Session context")
def briefing(briefing_file: str, session: str):
    """
    Evaluate a Conductor briefing.

    Focuses on signal-to-noise ratio and actionability.

    Example:
        eval briefing conductor-briefing.md --session "Morning session"
    """
    content = Path(briefing_file).read_text()
    briefing_id = Path(briefing_file).stem

    console.print("[bold]Evaluating Conductor Briefing[/bold]")
    console.print()

    try:
        result = evaluate_briefing(content, briefing_id, session)
    except ImportError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    _display_result(result)
    sys.exit(0 if result.passed else 1)


@cli.command()
@click.argument("extraction_file", type=click.Path(exists=True))
@click.option("--source", "-s", default="", help="Source session identifier")
def extraction(extraction_file: str, source: str):
    """
    Evaluate an Archivist extraction.

    Focuses on accuracy and completeness.

    Example:
        eval extraction session-4349eb9c-extraction.md --source 4349eb9c
    """
    content = Path(extraction_file).read_text()
    extraction_id = Path(extraction_file).stem

    console.print("[bold]Evaluating Archivist Extraction[/bold]")
    console.print()

    try:
        result = evaluate_extraction(content, extraction_id, source)
    except ImportError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)

    _display_result(result)
    sys.exit(0 if result.passed else 1)


@cli.command()
@click.argument("documents", nargs=-1, type=click.Path(exists=True))
@click.option("--dir", "-d", "doc_dir", type=click.Path(exists=True),
              help="Directory of documents to index")
def index(documents: tuple, doc_dir: Optional[str]):
    """
    Index documents into HippoRAG knowledge base.

    Documents are used to provide context during evaluation.

    Example:
        eval index doc1.md doc2.md --dir ./knowledge/
    """
    docs = []

    # Collect documents from arguments
    for doc_path in documents:
        content = Path(doc_path).read_text()
        docs.append(content)
        console.print(f"  [dim]Added: {doc_path}[/dim]")

    # Collect documents from directory
    if doc_dir:
        dir_path = Path(doc_dir)
        for file_path in dir_path.glob("**/*.md"):
            content = file_path.read_text()
            docs.append(content)
            console.print(f"  [dim]Added: {file_path}[/dim]")

    if not docs:
        console.print("[yellow]No documents to index[/yellow]")
        return

    console.print(f"\n[bold]Indexing {len(docs)} documents...[/bold]")

    try:
        evaluator = Evaluator()
        count = evaluator.index_knowledge(docs)
        console.print(f"[green]Successfully indexed {count} documents[/green]")
    except ImportError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@cli.command()
@click.argument("baseline_file", type=click.Path(exists=True))
@click.argument("current_file", type=click.Path(exists=True))
@click.option("--threshold", "-t", default=0.1, type=float,
              help="Regression threshold (default: 0.1 = 10%)")
def compare(baseline_file: str, current_file: str, threshold: float):
    """
    Compare current evaluation against baseline.

    Detects regression from established quality baseline.

    Example:
        eval compare baseline-metrics.json current-metrics.json --threshold 0.1
    """
    try:
        with open(baseline_file) as f:
            baseline_data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        console.print(f"[red]Error reading baseline file:[/red] {e}")
        sys.exit(1)

    try:
        with open(current_file) as f:
            current_data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        console.print(f"[red]Error reading current file:[/red] {e}")
        sys.exit(1)

    baseline = QualityMetrics(
        signal_to_noise=baseline_data.get("signal_to_noise", 0),
        actionability=baseline_data.get("actionability", 0),
        relevance=baseline_data.get("relevance", 0),
        coherence=baseline_data.get("coherence", 0),
        accuracy=baseline_data.get("accuracy"),
        completeness=baseline_data.get("completeness"),
    )

    current = QualityMetrics(
        signal_to_noise=current_data.get("signal_to_noise", 0),
        actionability=current_data.get("actionability", 0),
        relevance=current_data.get("relevance", 0),
        coherence=current_data.get("coherence", 0),
        accuracy=current_data.get("accuracy"),
        completeness=current_data.get("completeness"),
    )

    warnings = check_regression(current, baseline, threshold)

    # Display comparison table
    table = Table(title="Quality Comparison")
    table.add_column("Metric", style="cyan")
    table.add_column("Baseline", justify="right")
    table.add_column("Current", justify="right")
    table.add_column("Change", justify="right")

    for metric in ["signal_to_noise", "actionability", "relevance",
                   "coherence", "accuracy", "completeness", "overall"]:
        b_val = getattr(baseline, metric, None)
        c_val = getattr(current, metric, None)
        if b_val is None or c_val is None:
            continue

        change = ((c_val - b_val) / b_val * 100) if b_val > 0 else 0
        change_str = f"{change:+.1f}%"
        change_style = "green" if change >= 0 else "red"

        table.add_row(
            metric.replace("_", " ").title(),
            f"{b_val:.2f}",
            f"{c_val:.2f}",
            f"[{change_style}]{change_str}[/{change_style}]"
        )

    console.print(table)

    # Display warnings
    if warnings:
        console.print("\n[bold red]Regression Warnings:[/bold red]")
        for w in warnings:
            console.print(f"  [red]![/red] {w.message}")
        sys.exit(1)
    else:
        console.print("\n[bold green]No regression detected[/bold green]")
        sys.exit(0)


@cli.command()
def gates():
    """Show current quality gates."""
    g = QualityGates()

    table = Table(title="Quality Gates")
    table.add_column("Gate", style="cyan")
    table.add_column("Minimum", justify="right")

    table.add_row("Signal-to-Noise", f"{g.min_signal_to_noise:.2f}")
    table.add_row("Actionability", f"{g.min_actionability:.2f}")
    table.add_row("Accuracy", f"{g.min_accuracy:.2f}")
    table.add_row("Relevance", f"{g.min_relevance:.2f}")
    table.add_row("Overall", f"{g.min_overall:.2f}")

    console.print(table)


def _display_result(result):
    """Display evaluation result in a nice format."""
    # Status panel
    status_color = "green" if result.passed else "red"
    status_text = "PASSED" if result.passed else "FAILED"

    console.print(Panel(
        f"[bold {status_color}]{status_text}[/bold {status_color}] - "
        f"Overall: {result.metrics.overall:.2f} ({result.metrics.grade})",
        title=f"Evaluation {result.id}",
    ))

    # Dimensions table
    table = Table(title="Dimension Scores")
    table.add_column("Dimension", style="cyan")
    table.add_column("Score", justify="right")
    table.add_column("Grade", justify="center")
    table.add_column("Reasoning", max_width=50)

    for dim in result.dimensions:
        score_color = "green" if dim.score >= 0.7 else "yellow" if dim.score >= 0.5 else "red"
        table.add_row(
            dim.dimension.value.replace("_", " ").title(),
            f"[{score_color}]{dim.score:.2f}[/{score_color}]",
            dim.grade,
            dim.reasoning[:50] + "..." if len(dim.reasoning) > 50 else dim.reasoning,
        )

    console.print(table)

    # Gate violations
    if result.gate_violations:
        console.print("\n[bold red]Gate Violations:[/bold red]")
        for v in result.gate_violations:
            console.print(f"  [red]X[/red] {v}")


if __name__ == "__main__":
    cli()
