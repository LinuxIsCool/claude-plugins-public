#!/usr/bin/env python3
"""
Remember - Add knowledge to exploration graph

Unix-style tool: reads from stdin or args, adds to graph.

Usage:
    echo "Neo4j runs on port 7474" | python remember.py
    python remember.py "FalkorDB uses Redis protocol on port 6380"
    python remember.py --circle network "Docker bridge is 172.17.0.1"

For Graphiti patterns: llms:graphiti
For direct Cypher: llms:falkordb
"""

import sys
import argparse
from datetime import datetime
from graphiti_config import get_falkordb, escape_cypher, now_iso, CIRCLES


def remember(text: str, circle: str = "tools", source: str = "user") -> dict:
    """
    Add a discovery to the exploration graph.

    Uses direct FalkorDB insertion (no LLM) following the pattern from
    awareness:temporal-kg-memory - 100x faster for structured additions.
    """
    graph = get_falkordb()
    now = now_iso()
    discovery_id = f"discovery-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}"
    safe_text = escape_cypher(text)

    # Create Discovery node with temporal properties
    query = f"""
    CREATE (d:Discovery {{
        id: '{discovery_id}',
        text: '{safe_text}',
        circle: '{circle}',
        source: '{source}',
        created_at: '{now}',
        valid_at: '{now}'
    }})
    WITH d
    MATCH (c:Circle {{name: '{circle}'}})
    CREATE (d)-[:IN_CIRCLE {{created_at: '{now}'}}]->(c)
    RETURN d.id
    """

    try:
        result = graph.query(query)
        return {
            "id": discovery_id,
            "text": text[:100] + "..." if len(text) > 100 else text,
            "circle": circle,
            "status": "remembered"
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}


def main():
    parser = argparse.ArgumentParser(
        description="Add knowledge to exploration graph",
        epilog="Reads from stdin if no text provided"
    )
    parser.add_argument("text", nargs="*", help="Text to remember")
    parser.add_argument("--circle", "-c", default="tools", choices=CIRCLES,
                       help="Which circle this belongs to")
    parser.add_argument("--source", "-s", default="user",
                       help="Source of this knowledge")
    parser.add_argument("--quiet", "-q", action="store_true",
                       help="Suppress output")
    args = parser.parse_args()

    # Get text from args or stdin
    if args.text:
        text = " ".join(args.text)
    elif not sys.stdin.isatty():
        text = sys.stdin.read().strip()
    else:
        print("Error: No text provided. Use args or pipe to stdin.", file=sys.stderr)
        sys.exit(1)

    if not text:
        print("Error: Empty text.", file=sys.stderr)
        sys.exit(1)

    result = remember(text, circle=args.circle, source=args.source)

    if not args.quiet:
        if result.get("status") == "remembered":
            print(f"Remembered [{result['circle']}]: {result['text']}")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
