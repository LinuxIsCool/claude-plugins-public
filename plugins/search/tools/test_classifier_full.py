#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Test classifier on full real query set."""
import json
import sys
from pathlib import Path
from collections import Counter

sys.path.insert(0, str(Path(__file__).parent / "rag"))

from classifier import QueryClassifier, QueryType

def main():
    # Load real queries
    queries = json.loads(Path("ecosystem_user_queries.json").read_text())[:40]

    # Load evaluation results to compare
    eval_results = json.loads(Path("real_queries_eval.json").read_text())
    vector_results = {r["query"]: r for r in eval_results["detailed"]["vector"]}

    classifier = QueryClassifier()

    # Track classifications
    type_counts = Counter()
    should_retrieve = []
    should_skip = []

    print("=" * 70)
    print("CLASSIFIER ANALYSIS OF REAL QUERIES")
    print("=" * 70)

    for q in queries:
        text = q["text"]
        result = classifier.classify(text)
        type_counts[result.query_type] += 1

        # Get MRR from vector results
        mrr = vector_results.get(text, {}).get("mrr", 0)

        if result.should_retrieve:
            should_retrieve.append((text, mrr, result))
        else:
            should_skip.append((text, mrr, result))

    # Show classification distribution
    print("\n## CLASSIFICATION DISTRIBUTION")
    print("-" * 40)
    for qt, count in type_counts.most_common():
        pct = 100 * count / len(queries)
        print(f"{qt.value:12s}: {count:3d} ({pct:.0f}%)")

    # Show queries that should be retrieved
    print(f"\n## SHOULD RETRIEVE ({len(should_retrieve)} queries)")
    print("-" * 40)
    for text, mrr, result in should_retrieve:
        status = "✓" if mrr > 0 else "✗"
        print(f"{status} MRR={mrr:.2f} | {text[:60]}")

    # Show queries that should be skipped
    print(f"\n## SHOULD SKIP ({len(should_skip)} queries)")
    print("-" * 40)
    for text, mrr, result in should_skip:
        # For skipped queries, we expect low MRR anyway
        print(f"  {result.query_type.value:10s} | {text[:55]}")

    # Compute adjusted metrics
    # If classifier is correct, we only attempt retrieval on "good" queries
    # This should give us higher MRR on the subset we actually try
    print("\n## ADJUSTED METRICS (classifier-filtered)")
    print("-" * 40)

    if should_retrieve:
        filtered_mrr = sum(mrr for _, mrr, _ in should_retrieve) / len(should_retrieve)
        overall_mrr = sum(mrr for _, mrr, _ in should_retrieve + should_skip) / len(queries)

        print(f"Original MRR (all queries):     {overall_mrr:.3f}")
        print(f"Filtered MRR (retrieve only):   {filtered_mrr:.3f}")
        print(f"Queries filtered out:           {len(should_skip)}/{len(queries)} ({100*len(should_skip)/len(queries):.0f}%)")
        print(f"MRR improvement:                {filtered_mrr/overall_mrr:.1f}x")


if __name__ == "__main__":
    main()
