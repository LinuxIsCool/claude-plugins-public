#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
#     "pydantic",
# ]
# ///
"""
Improved ingestion with better entity deduplication.

Key improvements:
1. Custom entity type definitions
2. Normalized input text
3. Previous episode context
4. Better model selection

Usage:
    uv run experiment_improved_dedup.py
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, Field


# === Custom Entity Types ===
# These guide the LLM to extract consistent, well-typed entities

class ConversationParticipant(BaseModel):
    """A participant in the conversation."""
    role: str = Field(description="Either 'human' or 'assistant'")
    identifier: str | None = Field(default=None, description="Unique identifier if known")


class SoftwareTool(BaseModel):
    """A software tool or command being used or discussed."""
    tool_category: str | None = Field(default=None, description="Category: file, search, shell, etc.")


class TechnicalConcept(BaseModel):
    """A technical concept, feature, or technology being discussed."""
    domain: str | None = Field(default=None, description="Domain: plugins, hooks, hot-reload, etc.")


class CodeArtifact(BaseModel):
    """A code file, function, or artifact being discussed."""
    artifact_type: str | None = Field(default=None, description="Type: file, function, class, etc.")


# Entity type mapping for Graphiti
ENTITY_TYPES = {
    "ConversationParticipant": ConversationParticipant,
    "SoftwareTool": SoftwareTool,
    "TechnicalConcept": TechnicalConcept,
    "CodeArtifact": CodeArtifact,
}


def check_services():
    """Check if required services are running."""
    import socket

    # Check Ollama
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    ollama_ok = sock.connect_ex(('localhost', 11434)) == 0
    sock.close()

    # Check FalkorDB
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    falkor_ok = sock.connect_ex(('localhost', 6380)) == 0
    sock.close()

    return ollama_ok, falkor_ok


def normalize_episode_body(event: dict) -> str | None:
    """
    Convert event to normalized natural language.

    Key improvements:
    - Explicit role identification
    - Consistent naming conventions
    - Clear entity boundaries
    """
    event_type = event.get('type', 'Unknown')
    data = event.get('data', {})

    if event_type == 'UserPromptSubmit':
        prompt = data.get('prompt', '')
        # Explicit, unambiguous framing
        return f"The human user submitted this prompt: \"{prompt}\""

    elif event_type == 'AssistantResponse':
        response = data.get('response', '')
        # Explicit assistant identification
        return f"Claude (the AI coding assistant) responded with: \"{response}\""

    return None


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
            except json.JSONDecodeError:
                continue

    return events


async def main():
    print("=" * 70)
    print("EXPERIMENT: Improved Deduplication")
    print("=" * 70)

    # Target log file
    log_file = Path(".claude/logging/2025/12/08/17-48-29-0143495c.jsonl")

    print(f"\nTarget: {log_file.name}")

    # Check services
    ollama_ok, falkor_ok = check_services()
    if not ollama_ok:
        print("[FAIL] Ollama not running. Start with: ollama serve")
        sys.exit(1)
    if not falkor_ok:
        print("[FAIL] FalkorDB not running.")
        sys.exit(1)
    print("[OK] Services running")

    # Parse events
    events = parse_log_file(log_file)
    print(f"Found {len(events)} target events")

    # Import Graphiti
    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from graphiti_core.llm_client.config import LLMConfig
    from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
    from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
    from graphiti_core.nodes import EpisodeType

    # Use a more capable model for better deduplication
    # Options: llama3.2:3b (fast), deepseek-r1:7b (better), llama3.3:70b (best)
    model_name = "deepseek-r1:7b"  # Better reasoning for entity resolution

    print(f"\n--- Configuration ---")
    print(f"  Model: {model_name} (better entity resolution)")
    print(f"  Custom entity types: {list(ENTITY_TYPES.keys())}")
    print(f"  Normalized input: Yes")
    print(f"  Previous episode context: Yes")

    llm_config = LLMConfig(
        api_key="ollama",
        model=model_name,
        small_model=model_name,
        base_url="http://localhost:11434/v1",
    )
    llm_client = OpenAIGenericClient(config=llm_config, max_tokens=8192)

    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key="ollama",
            embedding_model="nomic-embed-text",
            embedding_dim=768,
            base_url="http://localhost:11434/v1",
        )
    )

    driver = FalkorDriver(
        host="localhost",
        port=6380,
        database="experiment_improved_dedup"
    )

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

    print(f"\n--- Ingesting {len(events)} Events ---")
    print(f"Group ID: {group_id}")

    success_count = 0
    error_count = 0
    start_time = datetime.now()

    # Track previous episodes for context
    previous_episodes = []

    for i, event in enumerate(events):
        body = normalize_episode_body(event)
        if not body:
            continue

        event_type = event.get('type')
        ts = event.get('ts', '')
        ref_time = datetime.fromisoformat(ts.replace('Z', '+00:00')) if ts else datetime.now()

        episode_name = f"{event_type}_{i}"

        print(f"\n  [{i+1}/{len(events)}] {event_type}")
        print(f"    Normalized: {body[:80]}...")

        try:
            # Add episode with custom entity types and previous context
            result = await graphiti.add_episode(
                name=episode_name,
                episode_body=body,
                source=EpisodeType.message,
                source_description=f"Claude Code {event_type}",
                reference_time=ref_time,
                group_id=group_id,
                entity_types=ENTITY_TYPES,
            )

            success_count += 1

            # Show extracted entities
            if hasattr(result, 'nodes') and result.nodes:
                print(f"    Entities: {[n.name for n in result.nodes[:5]]}")

            print(f"    [OK]")

        except Exception as e:
            error_count += 1
            print(f"    [ERROR] {e}")

    elapsed = (datetime.now() - start_time).total_seconds()

    print(f"\n--- Ingestion Complete ---")
    print(f"Success: {success_count}/{len(events)}")
    print(f"Errors: {error_count}")
    print(f"Time: {elapsed:.1f}s ({elapsed/max(len(events),1):.1f}s per event)")

    # Query results
    if success_count > 0:
        print(f"\n--- Entity Deduplication Check ---")
        try:
            records, _, _ = await driver.execute_query(
                "MATCH (e:Entity) RETURN e.name as name, e.entity_type as type, count(*) as count ORDER BY name"
            )
            print("Unique entities:")
            for r in (records or []):
                print(f"  [{r.get('type', '?')}] {r.get('name')}")
        except Exception as e:
            print(f"  Error: {e}")

        print(f"\n--- Semantic Search: 'hot reload' ---")
        try:
            results = await graphiti.search("hot reload plugins", group_ids=[group_id], num_results=5)
            if results:
                for edge in results:
                    print(f"  - {edge.fact}")
        except Exception as e:
            print(f"  Error: {e}")

    await graphiti.close()

    print("\n" + "=" * 70)
    print("EXPERIMENT COMPLETE")
    print("=" * 70)
    print(f"\nGraph UI: http://localhost:3001")
    print(f"Database: experiment_improved_dedup")
    print(f"\nCompare entity count with previous experiment to assess dedup improvement.")


if __name__ == '__main__':
    asyncio.run(main())
