#!/usr/bin/env python3
"""
Exploration Discovery Capture Hook

Automatically captures significant discoveries from tool outputs.
Designed to run as a Claude Code PostToolUse hook.

This follows the pattern from awareness:temporal-kg-memory:
- Direct parsing (no LLM) for structured outputs
- Filter for significant content only
- Non-blocking (failures don't interrupt Claude)

Usage as Claude Code hook (.claude/settings.json):
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": ["python plugins/exploration/hooks/capture_discoveries.py"]
      }
    ]
  }
}

Or via Claude Agent SDK:
    from claude_agent_sdk import ClaudeAgentOptions, HookMatcher

    options = ClaudeAgentOptions(
        hooks={
            "PostToolUse": [
                HookMatcher(matcher="Bash", hooks=[capture_discovery])
            ]
        }
    )
"""

import sys
import os
import json
import re
from pathlib import Path

# Add tools directory to path
TOOLS_DIR = Path(__file__).parent.parent / "tools"
sys.path.insert(0, str(TOOLS_DIR))

# Patterns that indicate discoverable information
DISCOVERY_PATTERNS = [
    # System information
    (r'(running|listening|active)\s+on\s+port\s+(\d+)', 'network'),
    (r'version\s+[:\s]*([0-9]+\.[0-9]+[^\s]*)', 'tools'),
    (r'(container|docker)\s+\w+\s+(running|up)', 'network'),

    # Hardware
    (r'(nvidia|amd|intel)\s+[\w\s]+\d+', 'substrate'),
    (r'(\d+)\s*(gb|mb|tb)\s*(ram|memory|vram|storage)', 'substrate'),

    # Services
    (r'(neo4j|postgres|redis|falkordb|qdrant)\s+[\w\s]*(:?\d+)?', 'network'),

    # Configuration
    (r'(enabled|disabled|configured)\s*[:\s]+\s*(\w+)', 'tools'),
]

# Minimum content length to consider
MIN_CONTENT_LENGTH = 20

# Maximum discoveries per hook invocation (prevent spam)
MAX_DISCOVERIES = 3


def extract_discoveries(tool_output: str, tool_name: str) -> list[dict]:
    """
    Extract discoverable facts from tool output using pattern matching.

    No LLM - direct parsing only (per awareness:temporal-kg-memory insight).
    """
    discoveries = []

    if not tool_output or len(tool_output) < MIN_CONTENT_LENGTH:
        return discoveries

    output_lower = tool_output.lower()

    for pattern, circle in DISCOVERY_PATTERNS:
        matches = re.findall(pattern, output_lower, re.IGNORECASE)
        if matches:
            # Extract the relevant portion around the match
            for match in matches[:MAX_DISCOVERIES]:
                if isinstance(match, tuple):
                    match_text = " ".join(str(m) for m in match if m)
                else:
                    match_text = str(match)

                # Find context around the match
                match_start = output_lower.find(match_text.lower())
                if match_start >= 0:
                    # Get surrounding context (up to 100 chars each side)
                    start = max(0, match_start - 50)
                    end = min(len(tool_output), match_start + len(match_text) + 50)
                    context = tool_output[start:end].strip()

                    # Clean up the context
                    context = re.sub(r'\s+', ' ', context)

                    discoveries.append({
                        "text": context,
                        "circle": circle,
                        "source": f"hook:{tool_name}",
                        "pattern": pattern
                    })

    return discoveries[:MAX_DISCOVERIES]


def save_discovery(discovery: dict) -> bool:
    """
    Save a discovery to the exploration graph.

    Uses the remember.py tool for consistency.
    """
    try:
        from graphiti_config import get_falkordb, escape_cypher, now_iso
        from datetime import datetime

        graph = get_falkordb()
        now = now_iso()
        discovery_id = f"hook-{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}"

        safe_text = escape_cypher(discovery["text"])
        circle = discovery["circle"]
        source = discovery.get("source", "hook")

        query = f"""
        CREATE (d:Discovery {{
            id: '{discovery_id}',
            text: '{safe_text}',
            circle: '{circle}',
            source: '{source}',
            created_at: '{now}',
            valid_at: '{now}',
            auto_captured: true
        }})
        WITH d
        MATCH (c:Circle {{name: '{circle}'}})
        CREATE (d)-[:IN_CIRCLE {{created_at: '{now}'}}]->(c)
        RETURN d.id
        """

        graph.query(query)
        return True

    except Exception as e:
        # Non-blocking: log but don't fail
        print(f"Hook warning: {e}", file=sys.stderr)
        return False


def main():
    """
    Hook entry point.

    Reads tool output from environment or stdin, extracts discoveries,
    saves to graph. Always exits 0 (non-blocking).
    """
    # Get tool information from environment (Claude Code hook convention)
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "unknown")
    tool_output = os.environ.get("CLAUDE_TOOL_OUTPUT", "")

    # Fall back to stdin if no environment variable
    if not tool_output and not sys.stdin.isatty():
        tool_output = sys.stdin.read()

    if not tool_output:
        sys.exit(0)

    # Extract and save discoveries
    discoveries = extract_discoveries(tool_output, tool_name)

    saved = 0
    for discovery in discoveries:
        if save_discovery(discovery):
            saved += 1

    if saved > 0:
        print(f"Captured {saved} discoveries from {tool_name}", file=sys.stderr)

    # Always exit 0 - hooks should never block Claude
    sys.exit(0)


if __name__ == "__main__":
    main()
