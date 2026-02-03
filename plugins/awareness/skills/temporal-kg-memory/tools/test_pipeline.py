#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""
Minimal pipeline test: Ingest 10 events, query results.

Usage:
    OPENAI_API_KEY=... uv run test_pipeline.py

This validates the full pipeline before larger ingestion.
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path


async def main():
    # Check for API key
    if not os.environ.get('OPENAI_API_KEY'):
        print("Error: OPENAI_API_KEY environment variable required")
        print("Graphiti uses LLM for entity extraction")
        sys.exit(1)

    # Import Graphiti
    try:
        from graphiti_core import Graphiti
        from graphiti_core.driver.falkordb_driver import FalkorDriver
        from graphiti_core.nodes import EpisodeType
    except ImportError as e:
        print(f"Error: Could not import graphiti: {e}")
        print("Install with: pip install graphiti-core[falkordb]")
        sys.exit(1)

    # Connect to FalkorDB (on alternate port 6380)
    print("Connecting to FalkorDB on port 6380...")
    try:
        driver = FalkorDriver(
            host="localhost",
            port=6380,
            database="claude_logs_test"
        )
        graphiti = Graphiti(graph_driver=driver)
        await graphiti.build_indices_and_constraints()
        print("Connected and indices built!")
    except Exception as e:
        print(f"Error connecting to FalkorDB: {e}")
        print("Make sure FalkorDB is running: docker run -p 6380:6379 -d falkordb/falkordb")
        sys.exit(1)

    # Find a log file
    log_dir = Path(".claude/logging")
    log_files = sorted(log_dir.rglob("*.jsonl"))
    if not log_files:
        print("No log files found in .claude/logging/")
        sys.exit(1)

    log_file = log_files[-1]  # Most recent
    print(f"Using log file: {log_file}")

    # Parse first 50 events (to find 10 good ones)
    events = []
    with open(log_file) as f:
        for i, line in enumerate(f):
            if i >= 50:
                break
            try:
                events.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                continue

    print(f"Parsed {len(events)} events")

    # Filter to interesting events
    interesting_types = {'UserPromptSubmit', 'PreToolUse', 'SessionStart'}
    filtered = [e for e in events if e.get('type') in interesting_types][:10]

    print(f"Selected {len(filtered)} events for ingestion:")
    for e in filtered:
        print(f"  - {e['type']}: {e['ts']}")

    # Ingest events
    print("\nIngesting events (this uses LLM for entity extraction)...")
    session_id = filtered[0].get('session_id', 'test_session')

    for i, event in enumerate(filtered):
        event_type = event.get('type', 'Unknown')
        data = event.get('data', {})

        # Build episode body
        if event_type == 'UserPromptSubmit':
            prompt = data.get('prompt', '')[:500]
            body = f"User asked: {prompt}"
        elif event_type == 'PreToolUse':
            tool = data.get('tool_name', 'unknown')
            if tool == 'Read':
                body = f"Claude is reading file: {data.get('tool_input', {}).get('file_path', 'unknown')}"
            elif tool == 'Bash':
                body = f"Claude is running command: {data.get('tool_input', {}).get('command', '')[:100]}"
            else:
                body = f"Claude is using {tool} tool"
        elif event_type == 'SessionStart':
            body = f"Session started in: {data.get('cwd', 'unknown')}"
        else:
            body = f"Event: {event_type}"

        print(f"  [{i+1}/{len(filtered)}] Ingesting: {body[:60]}...")

        try:
            await graphiti.add_episode(
                name=f"test_{event_type}_{i}",
                episode_body=body,
                source=EpisodeType.message,
                source_description=f"Claude Code {event_type}",
                reference_time=datetime.fromisoformat(event['ts']),
                group_id=session_id
            )
        except Exception as e:
            print(f"    Error: {e}")

    print("\nIngestion complete! Now querying...")

    # Query the graph
    print("\n--- Semantic Search: 'file' ---")
    try:
        results = await graphiti.search("file", group_ids=[session_id], limit=5)
        if results.edges:
            for edge in results.edges[:5]:
                print(f"  Fact: {edge.fact}")
        else:
            print("  No results found")
    except Exception as e:
        print(f"  Error: {e}")

    print("\n--- Semantic Search: 'command' ---")
    try:
        results = await graphiti.search("command", group_ids=[session_id], limit=5)
        if results.edges:
            for edge in results.edges[:5]:
                print(f"  Fact: {edge.fact}")
        else:
            print("  No results found")
    except Exception as e:
        print(f"  Error: {e}")

    # Get graph stats
    print("\n--- Graph Statistics ---")
    try:
        # Direct query to FalkorDB
        records, _, _ = await driver.execute_query(
            "MATCH (n) RETURN labels(n)[0] as label, COUNT(n) as count"
        )
        if records:
            for r in records:
                print(f"  {r['label']}: {r['count']} nodes")
    except Exception as e:
        print(f"  Error getting stats: {e}")

    await graphiti.close()
    print("\nPipeline test complete!")
    print(f"\nView graph at: http://localhost:3001")


if __name__ == '__main__':
    asyncio.run(main())
