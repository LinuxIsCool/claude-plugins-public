#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Test query classifier on known queries."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "rag"))

from classifier import QueryClassifier, QueryType

# Known good queries (should retrieve)
GOOD_QUERIES = [
    "What is the registry?",
    "What does the awareness plugin do?",
    "How do hooks work in Claude Code?",
    "What agents are available?",
    "Explain the journal system",
]

# Known bad queries (should NOT retrieve)
BAD_QUERIES = [
    "Where is it?",  # Context-dependent
    "How do I interact with it?",  # Context-dependent
    "Can you make the statusline bold?",  # Action request
    "Why is agent renaming not working right now?",  # Debugging
    "Can you create an engineering subagent?",  # Action request
    "It's working now. Can you explain?",  # Context-dependent
    "What does this imply for our repository?",  # Context-dependent
]

# Edge cases (tricky)
EDGE_CASES = [
    ("Are you aware of agentnet?", True),  # Has entity name, should retrieve
    ("Did the registration hook fire?", False),  # Debugging
    ("Can you journal about our work today?", False),  # Action request
    ("What subagents do you have available?", True),  # Knowledge query
]


def test_classifier():
    classifier = QueryClassifier()

    print("=" * 60)
    print("QUERY CLASSIFIER TEST")
    print("=" * 60)

    # Test good queries
    print("\n## GOOD QUERIES (should retrieve)")
    print("-" * 40)
    good_correct = 0
    for query in GOOD_QUERIES:
        result = classifier.classify(query)
        correct = result.should_retrieve
        good_correct += int(correct)
        status = "✓" if correct else "✗"
        print(f"{status} {query[:40]:40s} → {result.query_type.value:10s} ({result.confidence:.2f})")
        if not correct:
            print(f"   Reason: {result.reason}")

    # Test bad queries
    print("\n## BAD QUERIES (should NOT retrieve)")
    print("-" * 40)
    bad_correct = 0
    for query in BAD_QUERIES:
        result = classifier.classify(query)
        correct = not result.should_retrieve
        bad_correct += int(correct)
        status = "✓" if correct else "✗"
        print(f"{status} {query[:40]:40s} → {result.query_type.value:10s} ({result.confidence:.2f})")
        if not correct:
            print(f"   Reason: {result.reason}")

    # Test edge cases
    print("\n## EDGE CASES")
    print("-" * 40)
    edge_correct = 0
    for query, expected in EDGE_CASES:
        result = classifier.classify(query)
        correct = result.should_retrieve == expected
        edge_correct += int(correct)
        status = "✓" if correct else "✗"
        expected_str = "retrieve" if expected else "skip"
        actual_str = "retrieve" if result.should_retrieve else "skip"
        print(f"{status} {query[:40]:40s}")
        print(f"   Expected: {expected_str}, Got: {actual_str} ({result.query_type.value})")
        print(f"   Reason: {result.reason}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    total = len(GOOD_QUERIES) + len(BAD_QUERIES) + len(EDGE_CASES)
    correct = good_correct + bad_correct + edge_correct
    print(f"Good queries:  {good_correct}/{len(GOOD_QUERIES)}")
    print(f"Bad queries:   {bad_correct}/{len(BAD_QUERIES)}")
    print(f"Edge cases:    {edge_correct}/{len(EDGE_CASES)}")
    print(f"Total:         {correct}/{total} ({100*correct/total:.0f}%)")


if __name__ == "__main__":
    test_classifier()
