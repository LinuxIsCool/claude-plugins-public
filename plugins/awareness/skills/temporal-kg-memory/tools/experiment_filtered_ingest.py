#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""
Experiment: Filtered ingestion of UserPromptSubmit and AssistantResponse events only.

This script:
- Ingests ONLY UserPromptSubmit and AssistantResponse events
- Does NOT truncate any data
- Uses Ollama for local LLM processing (no API costs)
- Targets a specific session for controlled experiment

Usage:
    uv run experiment_filtered_ingest.py
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


def check_falkordb_running():
    """Check if FalkorDB is running."""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', 6380))
    sock.close()
    return result == 0


def parse_log_file(log_path: Path) -> list[dict]:
    """Parse JSONL log file, returning only target event types."""
    TARGET_TYPES = {'UserPromptSubmit', 'AssistantResponse'}
    events = []

    with open(log_path) as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                event = json.loads(line.strip())
                if event.get('type') in TARGET_TYPES:
                    events.append(event)
            except json.JSONDecodeError as e:
                print(f"  Warning: Skipping malformed JSON at line {line_num}: {e}")
                continue

    return events


def event_to_episode_body(event: dict) -> str:
    """
    Convert event to natural language for entity extraction.

    IMPORTANT: No truncation - full content preserved.
    """
    event_type = event.get('type', 'Unknown')
    data = event.get('data', {})

    if event_type == 'UserPromptSubmit':
        prompt = data.get('prompt', '')
        # NO TRUNCATION - full content
        return f"User asked: {prompt}"

    elif event_type == 'AssistantResponse':
        response = data.get('response', '')
        # NO TRUNCATION - full content
        return f"Claude responded: {response}"

    return None


async def main():
    print("=" * 70)
    print("EXPERIMENT: Filtered Ingestion (UserPromptSubmit + AssistantResponse)")
    print("=" * 70)

    # Target log file (first substantive session)
    log_file = Path(".claude/logging/2025/12/08/17-48-29-0143495c.jsonl")

    print(f"\nTarget: {log_file.name}")
    print(f"Date: 2025-12-08")

    # Check services
    print("\n--- Service Checks ---")
    if not check_ollama_running():
        print("[FAIL] Ollama is not running!")
        print("Start with: ollama serve")
        sys.exit(1)
    print("[OK] Ollama running on localhost:11434")

    if not check_falkordb_running():
        print("[FAIL] FalkorDB is not running!")
        print("Start with: docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb")
        sys.exit(1)
    print("[OK] FalkorDB running on localhost:6380")

    # Parse events
    print("\n--- Parsing Log File ---")
    events = parse_log_file(log_file)
    print(f"Found {len(events)} target events (UserPromptSubmit + AssistantResponse)")

    # Calculate total content size
    total_chars = 0
    for event in events:
        body = event_to_episode_body(event)
        if body:
            total_chars += len(body)
    print(f"Total content size: {total_chars:,} characters (NO TRUNCATION)")

    # Preview events
    print("\n--- Event Preview ---")
    for i, event in enumerate(events):
        etype = event.get('type')
        ts = event.get('ts', '')[:19]
        body = event_to_episode_body(event)
        print(f"  [{i+1}] {ts} | {etype} | {len(body)} chars")

    # Import Graphiti components
    print("\n--- Initializing Graphiti with Ollama ---")
    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
    from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
    from graphiti_core.nodes import EpisodeType

    # Configure Ollama LLM
    llm_config = LLMConfig(
        api_key="ollama",
        model="llama3.2:3b",
        small_model="llama3.2:3b",
        base_url="http://localhost:11434/v1",
    )
    llm_client = OpenAIGenericClient(config=llm_config, max_tokens=8192)
    print(f"  LLM: {llm_config.model}")

    # Configure Ollama embedder
    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key="ollama",
            embedding_model="nomic-embed-text",
            embedding_dim=768,
            base_url="http://localhost:11434/v1",
        )
    )
    print(f"  Embedder: nomic-embed-text (768 dim)")

    # Connect to FalkorDB
    driver = FalkorDriver(
        host="localhost",
        port=6380,
        database="experiment_filtered_v1"
    )
    print(f"  Database: experiment_filtered_v1")

    # Initialize Graphiti
    graphiti = Graphiti(
        graph_driver=driver,
        llm_client=llm_client,
        embedder=embedder,
    )
    await graphiti.build_indices_and_constraints()
    print("[OK] Graphiti initialized")

    # Get session info
    session_id = events[0].get('session_id', 'unknown')[:8]
    group_id = f"session_{session_id}"

    # Ingest events
    print(f"\n--- Ingesting {len(events)} Events ---")
    print(f"Group ID: {group_id}")
    print()

    success_count = 0
    error_count = 0
    start_time = datetime.now()

    for i, event in enumerate(events):
        body = event_to_episode_body(event)
        if not body:
            continue

        event_type = event.get('type')
        ts = event.get('ts', '')
        ref_time = datetime.fromisoformat(ts.replace('Z', '+00:00')) if ts else datetime.now()

        episode_name = f"{event_type}_{i}"

        print(f"  [{i+1}/{len(events)}] {event_type} ({len(body)} chars)...", end=" ", flush=True)

        try:
            await graphiti.add_episode(
                name=episode_name,
                episode_body=body,
                source=EpisodeType.message,
                source_description=f"Claude Code {event_type}",
                reference_time=ref_time,
                group_id=group_id
            )
            success_count += 1
            print("[OK]")
        except Exception as e:
            error_count += 1
            print(f"[ERROR] {e}")

    elapsed = (datetime.now() - start_time).total_seconds()

    print(f"\n--- Ingestion Complete ---")
    print(f"Success: {success_count}/{len(events)}")
    print(f"Errors: {error_count}")
    print(f"Time: {elapsed:.1f} seconds ({elapsed/len(events):.1f}s per event)")

    # Query results
    if success_count > 0:
        print(f"\n--- Graph Statistics ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC"
            )
            for r in (records or []):
                print(f"  {r.get('label', 'unknown')}: {r.get('count', 0)} nodes")
        except Exception as e:
            print(f"  Stats error: {e}")

        print(f"\n--- Entities Extracted ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (n:Entity) RETURN n.name as name, n.entity_type as type LIMIT 20"
            )
            if records:
                for r in records:
                    print(f"  [{r.get('type', '?')}] {r.get('name', '?')}")
            else:
                print("  No Entity nodes found")
        except Exception as e:
            print(f"  Entity error: {e}")

        print(f"\n--- Semantic Search: 'hot reload' ---")
        try:
            results = await graphiti.search("hot reload plugins", group_ids=[group_id], num_results=10)
            if results:
                print(f"Found {len(results)} edges:")
                for edge in results:
                    print(f"  - {edge.fact}")
            else:
                print("  No edges found")
        except Exception as e:
            print(f"  Search error: {e}")

        print(f"\n--- Semantic Search: 'subagent' ---")
        try:
            results = await graphiti.search("subagent tool", group_ids=[group_id], num_results=10)
            if results:
                print(f"Found {len(results)} edges:")
                for edge in results:
                    print(f"  - {edge.fact}")
            else:
                print("  No edges found")
        except Exception as e:
            print(f"  Search error: {e}")

    await graphiti.close()

    print("\n" + "=" * 70)
    print("EXPERIMENT COMPLETE")
    print("=" * 70)
    print(f"\nGraph UI: http://localhost:3001")
    print(f"Database: experiment_filtered_v1")


if __name__ == '__main__':
    asyncio.run(main())
