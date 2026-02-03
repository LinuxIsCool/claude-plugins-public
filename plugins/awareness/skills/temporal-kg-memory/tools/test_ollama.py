#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""
Test Graphiti with Ollama for local LLM processing.

NO API KEYS REQUIRED - runs entirely locally!

Prerequisites:
    1. Install Ollama: https://ollama.ai
    2. Pull required models:
       ollama pull llama3.2:3b       # or deepseek-r1:7b, qwen2.5:7b
       ollama pull nomic-embed-text  # for embeddings
    3. Start Ollama: ollama serve

Usage:
    uv run test_ollama.py
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path


def check_ollama_running():
    """Check if Ollama is running."""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', 11434))
    sock.close()
    return result == 0


async def main():
    print("=" * 60)
    print("Testing Graphiti with Ollama (Local LLM)")
    print("=" * 60)

    # Check Ollama
    if not check_ollama_running():
        print("\nError: Ollama is not running!")
        print("Start it with: ollama serve")
        print("\nOr install from: https://ollama.ai")
        sys.exit(1)
    print("\n[OK] Ollama is running on localhost:11434")

    # Import Graphiti components
    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
    from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
    from graphiti_core.nodes import EpisodeType

    # Configure Ollama LLM client
    print("\nConfiguring Ollama LLM client...")
    llm_config = LLMConfig(
        api_key="ollama",  # Placeholder - Ollama doesn't need real key
        model="llama3.2:3b",  # Fast, capable model (or use deepseek-r1:7b, qwen2.5:7b)
        small_model="llama3.2:3b",
        base_url="http://localhost:11434/v1",  # Ollama's OpenAI-compatible endpoint
    )
    llm_client = OpenAIGenericClient(config=llm_config, max_tokens=4096)
    print(f"  Model: {llm_config.model}")
    print(f"  Base URL: {llm_config.base_url}")

    # Configure Ollama embedder
    print("\nConfiguring Ollama embedder...")
    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key="ollama",
            embedding_model="nomic-embed-text",
            embedding_dim=768,
            base_url="http://localhost:11434/v1",
        )
    )
    print(f"  Embedding model: nomic-embed-text")
    print(f"  Dimensions: 768")

    # Connect to FalkorDB
    print("\nConnecting to FalkorDB...")
    try:
        driver = FalkorDriver(
            host="localhost",
            port=6380,
            database="claude_logs_ollama"
        )
    except Exception as e:
        print(f"\nError: Could not connect to FalkorDB: {e}")
        print("Start it with: docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb")
        sys.exit(1)

    # Initialize Graphiti with Ollama
    print("Initializing Graphiti with Ollama backend...")
    graphiti = Graphiti(
        graph_driver=driver,
        llm_client=llm_client,
        embedder=embedder,
    )
    await graphiti.build_indices_and_constraints()
    print("[OK] Graphiti initialized with Ollama!")

    # Test events
    test_events = [
        ("event_1", "User asked about building knowledge graphs for AI memory", datetime(2025, 12, 12, 16, 0, 0)),
        ("event_2", "Claude read documentation about FalkorDB graph database", datetime(2025, 12, 12, 16, 1, 0)),
        ("event_3", "Discussion about temporal knowledge graph architectures", datetime(2025, 12, 12, 16, 2, 0)),
    ]

    group_id = "ollama_test_session"
    success_count = 0

    print(f"\n{'=' * 60}")
    print(f"Ingesting {len(test_events)} events via local Ollama...")
    print("=" * 60)

    for name, body, ref_time in test_events:
        print(f"\n  [{name}] {body[:50]}...")
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
            print(f"    [OK] Ingested successfully!")
        except Exception as e:
            print(f"    [ERROR] {e}")

    print(f"\n{'=' * 60}")
    print(f"Ingested {success_count}/{len(test_events)} events")
    print("=" * 60)

    if success_count > 0:
        print("\n--- Semantic Search: 'knowledge graph' ---")
        try:
            results = await graphiti.search("knowledge graph", group_ids=[group_id], num_results=5)
            if results:
                print(f"Found {len(results)} edges:")
                for edge in results[:5]:
                    print(f"  - {edge.fact}")
            else:
                print("  No edges found (entity extraction may need different model)")
        except Exception as e:
            print(f"  Search error: {e}")

        print("\n--- Graph Statistics ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n) RETURN labels(n)[0] as label, count(n) as count"
            )
            for r in (records or []):
                print(f"  {r.get('label', 'unknown')}: {r.get('count', 0)} nodes")
        except Exception as e:
            print(f"  Stats error: {e}")

        print("\n--- Entities Extracted ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n:Entity) RETURN n.name, n.entity_type LIMIT 10"
            )
            if records:
                for r in records:
                    print(f"  {r.get('n.entity_type', '?')}: {r.get('n.name', '?')}")
            else:
                print("  No Entity nodes found")
        except Exception as e:
            print(f"  Entity error: {e}")

    await graphiti.close()

    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)
    print(f"\nGraph UI: http://localhost:3001")
    print(f"\nNote: Local LLMs may have different entity extraction quality.")
    print("Try larger models (deepseek-r1:7b, qwen2.5:7b) for better results.")


if __name__ == '__main__':
    asyncio.run(main())
