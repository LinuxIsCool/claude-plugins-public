#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Analyze what a perfect classifier could achieve."""
import json
from pathlib import Path

def main():
    # Load evaluation results
    eval_results = json.loads(Path("real_queries_eval.json").read_text())
    vector_results = eval_results["detailed"]["vector"]

    # Categorize by whether retrieval actually helped
    successful = [(r["query"], r["mrr"]) for r in vector_results if r["mrr"] > 0]
    failed = [(r["query"], r["mrr"]) for r in vector_results if r["mrr"] == 0]

    print("=" * 70)
    print("PERFECT CLASSIFIER ANALYSIS")
    print("=" * 70)

    print(f"\n## QUERIES WHERE RETRIEVAL WORKED ({len(successful)})")
    print("-" * 50)
    for q, mrr in sorted(successful, key=lambda x: -x[1]):
        print(f"MRR={mrr:.2f} | {q[:60]}")

    print(f"\n## QUERIES WHERE RETRIEVAL FAILED ({len(failed)})")
    print("-" * 50)
    for q, mrr in failed[:15]:  # Show first 15
        print(f"{q[:65]}")
    if len(failed) > 15:
        print(f"... and {len(failed) - 15} more")

    # Metrics
    print("\n## METRIC ANALYSIS")
    print("-" * 50)

    original_mrr = sum(r["mrr"] for r in vector_results) / len(vector_results)
    perfect_mrr = sum(mrr for _, mrr in successful) / len(successful) if successful else 0

    print(f"Total queries:              {len(vector_results)}")
    print(f"Successful retrievals:      {len(successful)} ({100*len(successful)/len(vector_results):.0f}%)")
    print(f"Failed retrievals:          {len(failed)} ({100*len(failed)/len(vector_results):.0f}%)")
    print()
    print(f"Original MRR (all):         {original_mrr:.3f}")
    print(f"Perfect filter MRR:         {perfect_mrr:.3f}")
    print(f"Best possible improvement:  {perfect_mrr/original_mrr:.1f}x")

    # What % of queries could theoretically be answered?
    print("\n## CONCLUSION")
    print("-" * 50)
    print(f"""
Only {len(successful)}/40 queries ({100*len(successful)/len(vector_results):.0f}%) can be successfully answered
by the current RAG system. Even a perfect classifier would only achieve
MRR {perfect_mrr:.2f} by filtering to just these queries.

The fundamental issue is that most real user queries are:
1. Context-dependent (require conversation history)
2. Action requests (not information-seeking)
3. Too vague/compound for current chunking

Improving retrieval quality on the {len(successful)} answerable queries
is more impactful than better classification.
""")


if __name__ == "__main__":
    main()
