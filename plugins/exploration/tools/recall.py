#!/usr/bin/env python3
"""
Recall - Search exploration knowledge graph

Unix-style tool: query as args, results to stdout.

Usage:
    python recall.py "database ports"
    python recall.py --circle network "containers"
    python recall.py --type entity "Neo4j"
    python recall.py --limit 5 "GPU"

For Graphiti hybrid search: llms:graphiti
For Cypher patterns: llms:falkordb
"""

import sys
import argparse
from graphiti_config import get_falkordb, CIRCLES


def recall(query: str, circle: str = None, node_type: str = None, limit: int = 10) -> list:
    """
    Search the exploration graph.

    Uses direct Cypher for fast keyword search.
    For semantic search, use Graphiti (see llms:graphiti).
    """
    graph = get_falkordb()
    query_lower = query.lower()
    results = []

    # Build Cypher query based on filters
    if node_type == "discovery":
        cypher = """
        MATCH (d:Discovery)
        RETURN d.id as id, d.text as text, d.circle as circle,
               'discovery' as type, d.created_at as created_at
        """
    elif node_type == "entity":
        cypher = """
        MATCH (e:Entity)
        OPTIONAL MATCH (e)-[:IN_CIRCLE]->(c:Circle)
        RETURN e.id as id, e.name as text, c.name as circle,
               e.entity_type as type, e.first_seen as created_at
        """
    elif node_type == "question":
        cypher = """
        MATCH (q:Question)
        RETURN q.id as id, q.text as text, q.circle as circle,
               'question' as type, q.status as created_at
        """
    else:
        # Search all types
        cypher = """
        MATCH (d:Discovery)
        RETURN d.id as id, d.text as text, d.circle as circle,
               'discovery' as type, d.created_at as created_at
        UNION
        MATCH (e:Entity)
        OPTIONAL MATCH (e)-[:IN_CIRCLE]->(c:Circle)
        RETURN e.id as id, e.name as text, c.name as circle,
               COALESCE(e.entity_type, 'entity') as type, e.first_seen as created_at
        UNION
        MATCH (q:Question)
        RETURN q.id as id, q.text as text, q.circle as circle,
               'question' as type, q.status as created_at
        """

    result = graph.query(cypher)

    # Filter and score results
    for row in result.result_set:
        node_id, text, node_circle, node_type_val, created_at = row

        if not text:
            continue

        # Apply circle filter
        if circle and node_circle != circle:
            continue

        # Score by term match
        text_lower = text.lower()
        score = sum(1 for term in query_lower.split() if term in text_lower)

        if score > 0:
            results.append({
                "id": node_id,
                "text": text,
                "circle": node_circle or "unknown",
                "type": node_type_val or "unknown",
                "score": score,
                "created_at": created_at
            })

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def main():
    parser = argparse.ArgumentParser(
        description="Search exploration knowledge graph"
    )
    parser.add_argument("query", nargs="+", help="Search query")
    parser.add_argument("--circle", "-c", choices=CIRCLES,
                       help="Filter by circle")
    parser.add_argument("--type", "-t", choices=["discovery", "entity", "question"],
                       help="Filter by node type")
    parser.add_argument("--limit", "-l", type=int, default=10,
                       help="Maximum results")
    parser.add_argument("--json", "-j", action="store_true",
                       help="Output as JSON")
    args = parser.parse_args()

    query = " ".join(args.query)
    results = recall(query, circle=args.circle, node_type=args.type, limit=args.limit)

    if args.json:
        import json
        print(json.dumps(results, indent=2))
    else:
        if not results:
            print(f"No results for: {query}")
            sys.exit(0)

        print(f"Found {len(results)} results for: {query}\n")
        for r in results:
            print(f"[{r['circle']}:{r['type']}] {r['text']}")
            if r.get('created_at'):
                print(f"  created: {r['created_at']}")
            print()


if __name__ == "__main__":
    main()
