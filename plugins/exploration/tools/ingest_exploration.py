#!/usr/bin/env python3
"""
Ingest Exploration Data - Direct Parsing (No LLM)

Converts structured exploration data to graph nodes using direct parsing.
Follows the pattern from awareness:temporal-kg-memory:

    "LLM extraction is WRONG for structured data.
     Direct parsing: 2 seconds for 10 events.
     LLM extraction: 80-140 seconds, with duplicates."

This tool handles:
- JSON discovery files
- Exploration session logs
- Mastery progression updates
- Question bank management

Usage:
    python ingest_exploration.py discovery.json
    python ingest_exploration.py --session exploration-20251215.jsonl
    python ingest_exploration.py --mastery mastery.md
    cat discoveries/*.json | python ingest_exploration.py --stdin

For LLM-powered extraction of unstructured text, use Graphiti:
    See llms:graphiti for add_episode() patterns
"""

import sys
import json
import argparse
import re
from datetime import datetime
from pathlib import Path
from graphiti_config import (
    get_falkordb, escape_cypher, now_iso,
    CIRCLES, ENTITY_TYPES, get_mastery_level
)


def ingest_discovery(data: dict, graph) -> dict:
    """
    Ingest a structured discovery into the graph.

    Expected format:
    {
        "circle": "network",
        "summary": "Found Neo4j container running",
        "entities": [
            {"name": "Neo4j", "type": "container", "properties": {"port": 7474}}
        ],
        "questions": ["What data is in Neo4j?"],
        "timestamp": "2025-12-15T10:00:00Z"
    }
    """
    now = now_iso()
    discovery_id = f"discovery-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}"

    circle = data.get("circle", "tools")
    summary = escape_cypher(data.get("summary", ""))
    timestamp = data.get("timestamp", now)

    stats = {"entities": 0, "questions": 0, "relationships": 0}

    # Create Discovery node
    query = f"""
    CREATE (d:Discovery {{
        id: '{discovery_id}',
        text: '{summary}',
        circle: '{circle}',
        created_at: '{now}',
        valid_at: '{timestamp}'
    }})
    WITH d
    MATCH (c:Circle {{name: '{circle}'}})
    CREATE (d)-[:IN_CIRCLE {{created_at: '{now}'}}]->(c)
    RETURN d.id
    """
    graph.query(query)

    # Create Entity nodes (direct parsing - no LLM)
    for entity in data.get("entities", []):
        name = escape_cypher(entity.get("name", ""))
        etype = entity.get("type", "unknown")
        entity_id = f"entity-{name.lower().replace(' ', '-')}"

        # Build properties
        props = entity.get("properties", {})
        props_parts = [f"e.{k} = '{escape_cypher(str(v))}'" for k, v in props.items()]
        props_set = ", ".join(props_parts) if props_parts else ""

        query = f"""
        MERGE (e:Entity {{name: '{name}'}})
        ON CREATE SET e.id = '{entity_id}',
                     e.entity_type = '{etype}',
                     e.circle = '{circle}',
                     e.first_seen = '{now}'
                     {', ' + props_set if props_set else ''}
        WITH e
        MATCH (d:Discovery {{id: '{discovery_id}'}})
        CREATE (d)-[:FOUND {{created_at: '{now}'}}]->(e)
        WITH e
        MATCH (c:Circle {{name: '{circle}'}})
        MERGE (e)-[:IN_CIRCLE]->(c)
        RETURN e.id
        """
        try:
            graph.query(query)
            stats["entities"] += 1
        except Exception as e:
            print(f"Warning: Failed to create entity {name}: {e}", file=sys.stderr)

    # Create Question nodes
    for question_text in data.get("questions", []):
        question_id = f"q-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        safe_question = escape_cypher(question_text)

        query = f"""
        CREATE (q:Question {{
            id: '{question_id}',
            text: '{safe_question}',
            circle: '{circle}',
            status: 'open',
            priority: 'medium',
            created_at: '{now}'
        }})
        WITH q
        MATCH (d:Discovery {{id: '{discovery_id}'}})
        CREATE (d)-[:RAISED {{created_at: '{now}'}}]->(q)
        WITH q
        MATCH (c:Circle {{name: '{circle}'}})
        CREATE (q)-[:IN_CIRCLE {{created_at: '{now}'}}]->(c)
        RETURN q.id
        """
        try:
            graph.query(query)
            stats["questions"] += 1
        except Exception as e:
            print(f"Warning: Failed to create question: {e}", file=sys.stderr)

    return {"discovery_id": discovery_id, "stats": stats}


def ingest_session(file_path: Path, graph) -> dict:
    """
    Ingest an exploration session log (JSONL format).

    Follows awareness:temporal-kg-memory pattern:
    - Typed nodes (Discovery, ToolOutput, etc.)
    - THEN edges for temporal sequence
    - No LLM extraction
    """
    stats = {"events": 0, "discoveries": 0}
    previous_id = None

    with open(file_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue

            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue

            event_type = event.get("type", "unknown")
            timestamp = event.get("timestamp", now_iso())
            event_id = f"event-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

            # Create event node based on type
            if event_type == "discovery":
                result = ingest_discovery(event.get("data", {}), graph)
                current_id = result["discovery_id"]
                stats["discoveries"] += 1
            else:
                # Generic event node
                content = escape_cypher(json.dumps(event.get("data", {})))
                query = f"""
                CREATE (e:ExplorationEvent {{
                    id: '{event_id}',
                    type: '{event_type}',
                    content: '{content}',
                    created_at: '{timestamp}'
                }})
                RETURN e.id
                """
                graph.query(query)
                current_id = event_id

            # Create THEN edge for temporal sequence
            if previous_id:
                query = f"""
                MATCH (prev {{id: '{previous_id}'}})
                MATCH (curr {{id: '{current_id}'}})
                CREATE (prev)-[:THEN {{created_at: '{timestamp}'}}]->(curr)
                """
                try:
                    graph.query(query)
                except Exception:
                    pass  # Nodes might be different types

            previous_id = current_id
            stats["events"] += 1

    return stats


def ingest_mastery(file_path: Path, graph) -> dict:
    """
    Ingest mastery levels from markdown file.

    Expected format in mastery.md:
    ## Circle Mastery
    | Circle | Score | Level |
    |--------|-------|-------|
    | substrate | 0.55 | resident |
    """
    stats = {"circles_updated": 0}
    now = now_iso()

    content = file_path.read_text()

    # Parse markdown table
    table_pattern = r'\|\s*(\w+)\s*\|\s*([\d.]+)\s*\|\s*(\w+)\s*\|'
    matches = re.findall(table_pattern, content)

    for circle, score_str, level in matches:
        if circle.lower() in CIRCLES:
            try:
                score = float(score_str)
                query = f"""
                MATCH (c:Circle {{name: '{circle.lower()}'}})
                SET c.mastery = {score},
                    c.mastery_level = '{level}',
                    c.mastery_updated = '{now}'
                RETURN c.name
                """
                graph.query(query)
                stats["circles_updated"] += 1
            except (ValueError, Exception) as e:
                print(f"Warning: Failed to update {circle}: {e}", file=sys.stderr)

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Ingest exploration data using direct parsing (no LLM)"
    )
    parser.add_argument("file", nargs="?", help="JSON file to ingest")
    parser.add_argument("--session", help="JSONL session log to ingest")
    parser.add_argument("--mastery", help="Mastery markdown file to ingest")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin")
    parser.add_argument("--quiet", "-q", action="store_true", help="Suppress output")
    args = parser.parse_args()

    graph = get_falkordb()

    if args.stdin:
        # Read JSON objects from stdin
        data = json.load(sys.stdin)
        if isinstance(data, list):
            for item in data:
                result = ingest_discovery(item, graph)
                if not args.quiet:
                    print(f"Ingested: {result['discovery_id']}")
        else:
            result = ingest_discovery(data, graph)
            if not args.quiet:
                print(f"Ingested: {result['discovery_id']}")

    elif args.session:
        stats = ingest_session(Path(args.session), graph)
        if not args.quiet:
            print(f"Session ingested: {stats['events']} events, {stats['discoveries']} discoveries")

    elif args.mastery:
        stats = ingest_mastery(Path(args.mastery), graph)
        if not args.quiet:
            print(f"Mastery updated: {stats['circles_updated']} circles")

    elif args.file:
        with open(args.file) as f:
            data = json.load(f)

        if isinstance(data, list):
            for item in data:
                result = ingest_discovery(item, graph)
                if not args.quiet:
                    print(f"Ingested: {result['discovery_id']}")
        else:
            result = ingest_discovery(data, graph)
            if not args.quiet:
                print(f"Ingested: {result['discovery_id']}")
                print(f"  Entities: {result['stats']['entities']}")
                print(f"  Questions: {result['stats']['questions']}")

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
