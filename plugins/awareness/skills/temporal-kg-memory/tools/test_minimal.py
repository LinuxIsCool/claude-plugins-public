#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""
Minimal test: 3 events with retry logic.

Usage:
    OPENAI_API_KEY=... uv run test_minimal.py
"""

import asyncio
import os
import sys
from datetime import datetime


async def ingest_with_retry(graphiti, name, body, ref_time, group_id, max_retries=5):
    """Ingest with exponential backoff."""
    from graphiti_core.nodes import EpisodeType

    for attempt in range(max_retries):
        try:
            await graphiti.add_episode(
                name=name,
                episode_body=body,
                source=EpisodeType.message,
                source_description="Claude Code test",
                reference_time=ref_time,
                group_id=group_id
            )
            return True
        except Exception as e:
            error_msg = str(e).lower()
            if 'rate limit' in error_msg or 'too many' in error_msg:
                wait_time = 2 ** attempt  # 1, 2, 4, 8, 16 seconds
                print(f"    Rate limited, waiting {wait_time}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait_time)
            else:
                print(f"    Error: {e}")
                return False
    print(f"    Failed after {max_retries} retries")
    return False


async def main():
    if not os.environ.get('OPENAI_API_KEY'):
        print("Error: OPENAI_API_KEY required")
        sys.exit(1)

    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver

    print("Connecting to FalkorDB...")
    driver = FalkorDriver(host="localhost", port=6380, database="claude_logs_minimal")
    graphiti = Graphiti(graph_driver=driver)
    await graphiti.build_indices_and_constraints()
    print("Connected!")

    # Just 3 simple test events
    test_events = [
        ("event_1", "User asked about knowledge graphs", datetime(2025, 12, 12, 15, 0, 0)),
        ("event_2", "Claude searched for files in the plugins directory", datetime(2025, 12, 12, 15, 1, 0)),
        ("event_3", "User discussed temporal memory systems", datetime(2025, 12, 12, 15, 2, 0)),
    ]

    group_id = "test_session_minimal"
    success_count = 0

    print(f"\nIngesting {len(test_events)} events with retry logic...")
    for name, body, ref_time in test_events:
        print(f"  {name}: {body[:50]}...")
        if await ingest_with_retry(graphiti, name, body, ref_time, group_id):
            success_count += 1
            print(f"    Success!")
        # Small delay between requests
        await asyncio.sleep(1)

    print(f"\nIngested {success_count}/{len(test_events)} events")

    if success_count > 0:
        print("\n--- Querying graph ---")
        try:
            results = await graphiti.search("knowledge", group_ids=[group_id], num_results=5)
            if results:
                print(f"Found {len(results)} edges:")
                for edge in results[:5]:
                    print(f"  - {edge.fact}")
            else:
                print("No results found")
        except Exception as e:
            print(f"Search error: {e}")

        # Direct graph stats
        print("\n--- Graph Stats ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n) RETURN labels(n)[0] as label, count(n) as count"
            )
            for r in (records or []):
                print(f"  {r.get('label', 'unknown')}: {r.get('count', 0)} nodes")
        except Exception as e:
            print(f"Stats error: {e}")

    await graphiti.close()
    print("\nDone! View at http://localhost:3001")


if __name__ == '__main__':
    asyncio.run(main())
