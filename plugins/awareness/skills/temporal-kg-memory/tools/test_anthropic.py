#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
#     "anthropic",
# ]
# ///
"""
Test using Anthropic instead of OpenAI for entity extraction.

Usage:
    ANTHROPIC_API_KEY=... uv run test_anthropic.py
"""

import asyncio
import os
import sys
from datetime import datetime


async def main():
    anthropic_key = os.environ.get('ANTHROPIC_API_KEY')
    if not anthropic_key:
        print("Error: ANTHROPIC_API_KEY required")
        print("(OpenAI rate limits prevented testing)")
        sys.exit(1)

    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from graphiti_core.llm_client.anthropic_client import AnthropicClient
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.nodes import EpisodeType

    print("Configuring Graphiti with Anthropic...")

    # Configure Anthropic client
    llm_config = LLMConfig(
        api_key=anthropic_key,
        model="claude-3-5-haiku-latest"  # Fast and cheap
    )
    llm_client = AnthropicClient(config=llm_config)

    # Connect to FalkorDB
    print("Connecting to FalkorDB...")
    driver = FalkorDriver(host="localhost", port=6380, database="claude_logs_anthropic")

    graphiti = Graphiti(
        graph_driver=driver,
        llm_client=llm_client
    )
    await graphiti.build_indices_and_constraints()
    print("Connected!")

    # Test events
    test_events = [
        ("event_1", "User asked about building knowledge graphs for AI memory systems", datetime(2025, 12, 12, 15, 0, 0)),
        ("event_2", "Claude read the FalkorDB documentation and explained sparse matrix storage", datetime(2025, 12, 12, 15, 1, 0)),
        ("event_3", "User and Claude discussed temporal knowledge graph architectures", datetime(2025, 12, 12, 15, 2, 0)),
    ]

    group_id = "test_anthropic_session"
    success_count = 0

    print(f"\nIngesting {len(test_events)} events...")
    for name, body, ref_time in test_events:
        print(f"  {name}: {body[:50]}...")
        try:
            await graphiti.add_episode(
                name=name,
                episode_body=body,
                source=EpisodeType.message,
                source_description="Claude Code test",
                reference_time=ref_time,
                group_id=group_id
            )
            success_count += 1
            print(f"    Success!")
            await asyncio.sleep(1)  # Small delay between requests
        except Exception as e:
            print(f"    Error: {e}")

    print(f"\nIngested {success_count}/{len(test_events)} events")

    if success_count > 0:
        print("\n--- Searching for 'knowledge graph' ---")
        try:
            results = await graphiti.search("knowledge graph", group_ids=[group_id], num_results=5)
            if results:
                print(f"Found {len(results)} edges:")
                for edge in results[:5]:
                    print(f"  - {edge.fact}")
            else:
                print("No edges found")
        except Exception as e:
            print(f"Search error: {e}")

        print("\n--- Graph Statistics ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n) RETURN labels(n)[0] as label, count(n) as count"
            )
            for r in (records or []):
                print(f"  {r.get('label', 'unknown')}: {r.get('count', 0)} nodes")
        except Exception as e:
            print(f"Stats error: {e}")

        print("\n--- All Entities ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n:Entity) RETURN n.name, n.entity_type LIMIT 10"
            )
            for r in (records or []):
                print(f"  {r.get('n.entity_type', '?')}: {r.get('n.name', '?')}")
        except Exception as e:
            print(f"Entity error: {e}")

    await graphiti.close()
    print("\nDone! View graph at http://localhost:3001")


if __name__ == '__main__':
    asyncio.run(main())
