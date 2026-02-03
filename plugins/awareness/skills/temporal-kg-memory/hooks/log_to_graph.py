#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""
Real-time hook to ingest Claude Code events into temporal knowledge graph.

This hook can be configured to run on PostToolUse events to capture
tool usage in real-time.

Configuration (in .claude/settings.json):
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          "uv run plugins/awareness/skills/temporal-kg-memory/hooks/log_to_graph.py"
        ]
      }
    ]
  }
}

Note: This hook is OPTIONAL and meant for future use when real-time
ingestion is desired. Batch ingestion via ingest_logs.py is simpler
for initial exploration.
"""

import asyncio
import json
import os
import sys
from datetime import datetime


async def ingest_event(event_data: dict) -> dict:
    """
    Ingest a single event into the temporal knowledge graph.

    Returns a result dict for the hook response.
    """
    # Check if Graphiti is available
    try:
        from graphiti_core import Graphiti
        from graphiti_core.driver.falkordb_driver import FalkorDriver
        from graphiti_core.nodes import EpisodeType
    except ImportError:
        return {
            "decision": "approve",
            "reason": "Graphiti not installed, skipping ingestion"
        }

    # Check for required environment variables
    if not os.environ.get('OPENAI_API_KEY'):
        return {
            "decision": "approve",
            "reason": "OPENAI_API_KEY not set, skipping ingestion"
        }

    # Check if real-time ingestion is enabled
    if not os.environ.get('TEMPORAL_KG_ENABLED', '').lower() == 'true':
        return {
            "decision": "approve",
            "reason": "Real-time ingestion disabled (set TEMPORAL_KG_ENABLED=true to enable)"
        }

    # Get configuration
    host = os.environ.get('FALKORDB_HOST', 'localhost')
    port = int(os.environ.get('FALKORDB_PORT', '6379'))
    database = os.environ.get('FALKORDB_DATABASE', 'claude_logs')

    # Convert event to episode body
    tool_name = event_data.get('tool_name', 'unknown')
    tool_input = event_data.get('tool_input', {})
    tool_response = event_data.get('tool_response', {})
    session_id = event_data.get('session_id', 'unknown')

    # Build episode body based on tool type
    if tool_name == 'Read':
        file_path = tool_input.get('file_path', 'unknown')
        body = f"Claude read file: {file_path}"
    elif tool_name == 'Write':
        file_path = tool_input.get('file_path', 'unknown')
        body = f"Claude wrote to file: {file_path}"
    elif tool_name == 'Edit':
        file_path = tool_input.get('file_path', 'unknown')
        body = f"Claude edited file: {file_path}"
    elif tool_name == 'Bash':
        command = tool_input.get('command', '')[:200]
        body = f"Claude ran command: {command}"
    elif tool_name == 'Task':
        description = tool_input.get('description', '')
        subagent_type = tool_input.get('subagent_type', 'general')
        body = f"Claude launched {subagent_type} agent: {description}"
    else:
        body = f"Claude used {tool_name} tool"

    try:
        # Connect to FalkorDB
        driver = FalkorDriver(host=host, port=port, database=database)
        graphiti = Graphiti(graph_driver=driver)

        # Ingest the event
        await graphiti.add_episode(
            name=f"{tool_name}_{datetime.now().isoformat()}",
            episode_body=body,
            source=EpisodeType.message,
            source_description=f"Claude Code PostToolUse hook",
            reference_time=datetime.now(),
            group_id=session_id
        )

        await graphiti.close()

        return {
            "decision": "approve",
            "reason": f"Ingested {tool_name} event to temporal KG"
        }

    except Exception as e:
        # Don't block the conversation on ingestion failures
        return {
            "decision": "approve",
            "reason": f"Ingestion failed (non-blocking): {str(e)[:100]}"
        }


def main():
    """Main hook entry point."""
    # Read event from stdin
    try:
        event_json = sys.stdin.read()
        event = json.loads(event_json)
    except json.JSONDecodeError as e:
        print(json.dumps({
            "decision": "approve",
            "reason": f"Invalid JSON input: {e}"
        }))
        return

    # Extract the data we need
    hook_event_name = event.get('hook_event_name', '')

    if hook_event_name != 'PostToolUse':
        # Only process PostToolUse events
        print(json.dumps({
            "decision": "approve",
            "reason": "Not a PostToolUse event"
        }))
        return

    # Run the async ingestion
    result = asyncio.run(ingest_event(event))
    print(json.dumps(result))


if __name__ == '__main__':
    main()
