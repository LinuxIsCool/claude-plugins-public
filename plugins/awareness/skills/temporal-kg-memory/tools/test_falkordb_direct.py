#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Test FalkorDB directly without Graphiti/LLM overhead.

This validates the graph database is working, bypassing entity extraction
which requires LLM API credits.

Usage:
    uv run test_falkordb_direct.py
"""

import json
from datetime import datetime
from pathlib import Path

from falkordb import FalkorDB


def main():
    print("Connecting to FalkorDB directly (no LLM required)...")

    # Connect
    db = FalkorDB(host='localhost', port=6380)
    g = db.select_graph('claude_logs_direct')

    print("Connected! Creating test graph...")

    # Clear existing data
    try:
        g.query("MATCH (n) DETACH DELETE n")
    except Exception:
        pass

    # Create schema for log events
    # We'll manually structure entities since we're bypassing LLM extraction

    # Parse a real log file
    log_dir = Path(".claude/logging")
    log_files = sorted(log_dir.rglob("*.jsonl"))
    if not log_files:
        print("No log files found")
        return

    log_file = log_files[-1]
    print(f"Using: {log_file}")

    # Parse first 20 events
    events = []
    with open(log_file) as f:
        for i, line in enumerate(f):
            if i >= 20:
                break
            try:
                events.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                continue

    print(f"Parsed {len(events)} events")

    # Get session info
    session_id = events[0].get('session_id', 'unknown')[:8]
    cwd = events[0].get('data', {}).get('cwd', '/unknown')

    # Create session node
    g.query("""
        CREATE (s:Session {
            id: $id,
            cwd: $cwd,
            created_at: $created_at
        })
    """, {'id': session_id, 'cwd': cwd, 'created_at': events[0]['ts']})
    print(f"Created Session: {session_id}")

    # Create event nodes and relationships
    event_count = 0
    tool_count = 0
    prev_event_id = None

    for i, event in enumerate(events):
        event_type = event.get('type', 'Unknown')
        ts = event.get('ts', '')
        data = event.get('data', {})

        # Create event node
        event_id = f"event_{i}"
        g.query("""
            CREATE (e:Event {
                id: $id,
                type: $type,
                timestamp: $ts
            })
        """, {'id': event_id, 'type': event_type, 'ts': ts})
        event_count += 1

        # Link to session
        g.query("""
            MATCH (s:Session {id: $session_id})
            MATCH (e:Event {id: $event_id})
            CREATE (s)-[:CONTAINS]->(e)
        """, {'session_id': session_id, 'event_id': event_id})

        # Link to previous event (temporal sequence)
        if prev_event_id:
            g.query("""
                MATCH (prev:Event {id: $prev_id})
                MATCH (curr:Event {id: $curr_id})
                CREATE (prev)-[:FOLLOWED_BY]->(curr)
            """, {'prev_id': prev_event_id, 'curr_id': event_id})
        prev_event_id = event_id

        # Extract tool information
        if event_type in ('PreToolUse', 'PostToolUse'):
            tool_name = data.get('tool_name', 'Unknown')

            # Create or merge tool node
            g.query("""
                MERGE (t:Tool {name: $name})
            """, {'name': tool_name})

            # Link event to tool
            g.query("""
                MATCH (e:Event {id: $event_id})
                MATCH (t:Tool {name: $tool_name})
                CREATE (e)-[:USES]->(t)
            """, {'event_id': event_id, 'tool_name': tool_name})
            tool_count += 1

            # Extract file paths if present
            tool_input = data.get('tool_input', {})
            if isinstance(tool_input, dict):
                file_path = tool_input.get('file_path') or tool_input.get('path')
                if file_path:
                    # Create file node
                    g.query("""
                        MERGE (f:File {path: $path})
                    """, {'path': file_path})
                    g.query("""
                        MATCH (e:Event {id: $event_id})
                        MATCH (f:File {path: $path})
                        CREATE (e)-[:ACCESSES]->(f)
                    """, {'event_id': event_id, 'path': file_path})

    print(f"Created {event_count} events, {tool_count} tool uses")

    # Query the graph
    print("\n--- Graph Statistics ---")

    result = g.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count")
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} nodes")

    print("\n--- Tools Used ---")
    result = g.query("""
        MATCH (t:Tool)<-[:USES]-(e:Event)
        RETURN t.name as tool, count(e) as usage
        ORDER BY usage DESC
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} uses")

    print("\n--- Files Accessed ---")
    result = g.query("""
        MATCH (f:File)<-[:ACCESSES]-(e:Event)
        RETURN f.path as file, count(e) as accesses
        ORDER BY accesses DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[0]}")

    print("\n--- Event Timeline (first 5) ---")
    result = g.query("""
        MATCH (e:Event)
        RETURN e.type, e.timestamp
        ORDER BY e.timestamp
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[1]}: {row[0]}")

    print("\n--- Tool Usage Patterns ---")
    result = g.query("""
        MATCH (e1:Event)-[:FOLLOWED_BY]->(e2:Event)
        WHERE e1.type = 'PreToolUse' AND e2.type = 'PostToolUse'
        MATCH (e1)-[:USES]->(t:Tool)
        RETURN t.name, count(*) as completions
        ORDER BY completions DESC
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} completions")

    print("\nSuccess! FalkorDB is working.")
    print("View at: http://localhost:3001")
    print("\nNote: This is manual entity extraction. Graphiti automates this with LLM.")


if __name__ == '__main__':
    main()
