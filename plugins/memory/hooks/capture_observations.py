#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Memory plugin hook: Captures observations from tool use and responses.

This hook fires on PostToolUse and Stop events to capture:
- Tool inputs and outputs for future context
- Assistant responses for hot memory cache
- Session summaries for warm memory indexing

Architecture:
- Uses MemoryBridge for production mode (3-tier with semantic search)
- Falls back to JSONL mode if production system not initialized
- NEVER fails - silently captures or does nothing

Hook events supported:
- PostToolUse: Capture tool usage for context
- Stop: Capture assistant response and update hot cache
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add lib to path for bridge import
_hook_dir = Path(__file__).parent
_lib_dir = _hook_dir.parent / "lib"
if str(_lib_dir) not in sys.path:
    sys.path.insert(0, str(_lib_dir))


# Importance weights by tool type
TOOL_IMPORTANCE = {
    "Write": 0.8,   # High - file creation
    "Edit": 0.7,    # High - file modification
    "Bash": 0.6,    # Medium-high - command execution
    "Task": 0.7,    # High - subagent work
    "Read": 0.3,    # Low - just reading
    "Grep": 0.4,    # Medium-low - search
    "Glob": 0.3,    # Low - pattern matching
    "WebFetch": 0.5, # Medium - web access
    "WebSearch": 0.5, # Medium - web search
}

# Skip these noisy tools
SKIP_TOOLS = {"TodoWrite", "KillShell", "TaskOutput", "AskUserQuestion"}


def get_bridge():
    """Get the memory bridge with lazy import."""
    try:
        from bridge import get_bridge as _get_bridge
        return _get_bridge()
    except ImportError:
        return None
    except Exception:
        return None


def extract_tool_observation(data: dict) -> dict | None:
    """Extract meaningful observation from tool use event."""
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    # Skip noisy tools
    if tool_name in SKIP_TOOLS:
        return None

    importance = TOOL_IMPORTANCE.get(tool_name, 0.5)

    # Extract based on tool type
    if tool_name == "Read":
        file_path = tool_input.get("file_path", "")
        if file_path:
            return {
                "content": f"Read file: {file_path}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"file_path": file_path, "type": "file_read"}
            }

    elif tool_name == "Write":
        file_path = tool_input.get("file_path", "")
        if file_path:
            return {
                "content": f"Wrote file: {file_path}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"file_path": file_path, "type": "file_write"}
            }

    elif tool_name == "Edit":
        file_path = tool_input.get("file_path", "")
        if file_path:
            return {
                "content": f"Edited file: {file_path}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"file_path": file_path, "type": "file_edit"}
            }

    elif tool_name == "Bash":
        command = tool_input.get("command", "")
        if command:
            # Store full command in metadata, display version may be shorter
            display_cmd = command if len(command) <= 200 else f"{command[:197]}..."
            return {
                "content": f"Ran command: {display_cmd}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"command": command, "type": "command"}
            }

    elif tool_name == "Task":
        description = tool_input.get("description", "")
        subagent_type = tool_input.get("subagent_type", "general")
        if description:
            return {
                "content": f"Launched {subagent_type} agent: {description}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"agent_type": subagent_type, "type": "subagent"}
            }

    elif tool_name in ("WebFetch", "WebSearch"):
        url = tool_input.get("url", "") or tool_input.get("query", "")
        if url:
            return {
                "content": f"Web {tool_name}: {url[:100]}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"url": url, "type": "web"}
            }

    elif tool_name == "Grep":
        pattern = tool_input.get("pattern", "")
        if pattern:
            return {
                "content": f"Searched for: {pattern}",
                "importance": importance,
                "source": f"tool:{tool_name}",
                "metadata": {"pattern": pattern, "type": "search"}
            }

    return None


def extract_response_observation(data: dict, transcript_path: str) -> dict | None:
    """Extract observation from assistant response."""
    response = ""
    try:
        if transcript_path:
            transcript = Path(transcript_path)
            if transcript.exists():
                for line in reversed(transcript.read_text().strip().split("\n")):
                    if line.strip():
                        entry = json.loads(line)
                        if entry.get("type") == "assistant":
                            for block in entry.get("message", {}).get("content", []):
                                if block.get("type") == "text":
                                    response = block.get("text", "")
                                    break
                        if response:
                            break
    except (json.JSONDecodeError, OSError):
        pass

    if response:
        # Store full response in metadata, display version may be shorter
        display_response = response if len(response) <= 500 else f"{response[:497]}..."
        return {
            "content": display_response,
            "importance": 0.6,  # Medium importance for responses
            "source": "response",
            "metadata": {"type": "assistant_response", "full_response": response}
        }

    return None


def main():
    parser = argparse.ArgumentParser(description="Capture observations for memory")
    parser.add_argument("-e", "--event", required=True, help="Hook event name")
    args = parser.parse_args()

    # Read hook input from stdin
    try:
        input_data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return

    bridge = get_bridge()
    if not bridge:
        return

    if args.event == "PostToolUse":
        observation = extract_tool_observation(input_data)
        if observation:
            bridge.capture(
                content=observation["content"],
                importance=observation["importance"],
                source=observation["source"],
                metadata=observation.get("metadata")
            )

    elif args.event == "Stop":
        transcript_path = input_data.get("transcript_path", "")
        observation = extract_response_observation(input_data, transcript_path)
        if observation:
            bridge.capture(
                content=observation["content"],
                importance=observation["importance"],
                source=observation["source"],
                metadata=observation.get("metadata")
            )


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Hooks should NEVER fail loudly
        pass
