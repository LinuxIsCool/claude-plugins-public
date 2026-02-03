#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Memory plugin hook: Injects hot and warm memory context into prompts.

This hook fires on UserPromptSubmit, providing Claude with relevant
context from recent interactions (hot memory) and semantically similar
past interactions (warm memory).

Architecture:
- Uses MemoryBridge for production mode (3-tier with semantic search)
- Falls back to JSONL mode if production system not initialized
- NEVER fails - returns empty context on any error

Hook events supported:
- UserPromptSubmit: Inject context before Claude processes prompt
"""

import argparse
import json
import sys
from pathlib import Path

# Add lib to path for bridge import
_hook_dir = Path(__file__).parent
_lib_dir = _hook_dir.parent / "lib"
if str(_lib_dir) not in sys.path:
    sys.path.insert(0, str(_lib_dir))


def get_bridge():
    """Get the memory bridge with lazy import."""
    try:
        from bridge import get_bridge as _get_bridge
        return _get_bridge()
    except ImportError:
        return None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description="Inject memory context into prompts")
    parser.add_argument("-e", "--event", required=True, help="Hook event name")
    args = parser.parse_args()

    if args.event != "UserPromptSubmit":
        # Only process UserPromptSubmit events
        return

    # Read hook input from stdin
    try:
        input_data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        return

    prompt = input_data.get("prompt", "")
    if not prompt:
        return

    # Get context from bridge
    context = ""
    bridge = get_bridge()
    if bridge:
        context = bridge.get_context(prompt)

    # Output context if we have any
    if context:
        output = {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context
            }
        }
        print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Hooks should NEVER fail loudly
        pass
