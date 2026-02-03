#!/usr/bin/env python3
"""Test harness for statusline prompt iteration.

Allows rapid iteration on prompts without running full Claude Code sessions.

Usage:
    # Preview filled prompt (no API call)
    ./test-prompts.py name --preview --user-prompt "Fix the login bug"

    # Test with mock response (no API call)
    ./test-prompts.py summary --mock "Debugging auth issues"

    # Test against real API with synthetic data
    ./test-prompts.py name --user-prompt "Help me refactor the database"

    # Test description with full context
    ./test-prompts.py description --agent-name "Phoenix" \\
        --first-prompts "Help me redesign the auth system" \\
        --recent-prompts "Now let's add tests"

    # Use a real session's data
    ./test-prompts.py summary --session <session_id>

Environment:
    ANTHROPIC_API_KEY - Required for real API calls
    SUMMARY_BACKEND   - "api" or "headless" (default: api for testing)
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add lib to path
PLUGIN_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PLUGIN_ROOT / "lib"))

from claude_backend import (
    get_config,
    get_api_key,
    get_instances_dir,
    get_agent_name,
    get_recent_messages,
    get_first_messages,
    get_recent_user_prompts,
    get_latest_response,
    get_previous_summaries,
    get_previous_descriptions,
    format_messages_for_prompt,
    generate_with_backend,
    load_prompt_template,
)

# Prompt configurations
PROMPT_CONFIGS = {
    "name": {
        "file": "name.txt",
        "legacy_file": "name-prompt.txt",
        "variables": ["user_prompt"],
        "max_tokens": 20,
        "temperature": 0.7,
        "defaults": {
            "user_prompt": "Help me debug a complex issue in my codebase",
        },
    },
    "summary": {
        "file": "summary.txt",
        "legacy_file": "summary-prompt.txt",
        "variables": ["agent_name", "prev_summaries", "context"],
        "max_tokens": 50,
        "temperature": 0.3,
        "defaults": {
            "agent_name": "Claude",
            "prev_summaries": "(None yet)",
            "context": "User: Help me fix the authentication bug\nAssistant: I'll look into that.",
        },
    },
    "description": {
        "file": "description.txt",
        "legacy_file": "description-prompt.txt",
        "variables": ["agent_name", "first_prompts", "recent_prompts", "prev_descriptions", "prev_summaries", "recent_response"],
        "max_tokens": 30,
        "temperature": 0.3,
        "defaults": {
            "agent_name": "Claude",
            "first_prompts": "User: Help me redesign the authentication system",
            "recent_prompts": "User: Now let's add proper error handling",
            "prev_descriptions": "(First description)",
            "prev_summaries": "(No summaries yet)",
            "recent_response": "I've identified the core issue in the auth flow.",
        },
    },
}


def load_template(prompt_type: str) -> str:
    """Load prompt template from prompts/ directory."""
    config = PROMPT_CONFIGS[prompt_type]
    prompts_dir = PLUGIN_ROOT / "prompts"
    hooks_dir = PLUGIN_ROOT / "hooks"

    # Check locations in order
    locations = [
        prompts_dir / config["file"],
        hooks_dir / config["legacy_file"],
    ]

    for loc in locations:
        if loc.exists():
            return loc.read_text()

    raise FileNotFoundError(f"No template found for {prompt_type}")


def build_prompt(prompt_type: str, variables: dict) -> str:
    """Build filled prompt from template and variables."""
    template = load_template(prompt_type)
    config = PROMPT_CONFIGS[prompt_type]

    # Use defaults for missing variables
    filled = {**config["defaults"], **variables}

    return template.format(**filled)


def load_session_data(session_id: str, cwd: str = ".") -> dict:
    """Load real data from a session."""
    instances_dir = get_instances_dir(cwd)
    agent_name = get_agent_name(instances_dir, session_id)

    return {
        "agent_name": agent_name,
        "prev_summaries": get_previous_summaries(instances_dir, session_id, limit=3) or "(None yet)",
        "context": format_messages_for_prompt(
            get_recent_messages(cwd, session_id, limit=6)
        ) or "(No context)",
        "first_prompts": format_messages_for_prompt(
            get_first_messages(cwd, session_id, limit=5)
        ) or "(No first prompts)",
        "recent_prompts": format_messages_for_prompt(
            get_recent_user_prompts(cwd, session_id, limit=20)
        ) or "(No recent prompts)",
        "prev_descriptions": get_previous_descriptions(instances_dir, session_id, limit=10) or "(First description)",
        "recent_response": get_latest_response(cwd, session_id) or "(No response yet)",
    }


def main():
    parser = argparse.ArgumentParser(
        description="Test statusline prompts without running full hooks",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "prompt_type",
        choices=["name", "summary", "description"],
        help="Which prompt to test",
    )

    parser.add_argument(
        "--preview",
        action="store_true",
        help="Preview filled prompt without calling API",
    )

    parser.add_argument(
        "--mock",
        metavar="RESPONSE",
        help="Return mock response instead of calling API",
    )

    parser.add_argument(
        "--session",
        metavar="SESSION_ID",
        help="Load real data from existing session",
    )

    parser.add_argument(
        "--cwd",
        default=".",
        help="Working directory for session data (default: current)",
    )

    # Variable overrides
    parser.add_argument("--user-prompt", help="Override user_prompt variable")
    parser.add_argument("--agent-name", help="Override agent_name variable")
    parser.add_argument("--prev-summaries", help="Override prev_summaries variable")
    parser.add_argument("--context", help="Override context variable")
    parser.add_argument("--first-prompts", help="Override first_prompts variable")
    parser.add_argument("--recent-prompts", help="Override recent_prompts variable")
    parser.add_argument("--prev-descriptions", help="Override prev_descriptions variable")
    parser.add_argument("--recent-response", help="Override recent_response variable")

    args = parser.parse_args()

    # Build variable overrides from args
    variables = {}
    arg_map = {
        "user_prompt": args.user_prompt,
        "agent_name": args.agent_name,
        "prev_summaries": args.prev_summaries,
        "context": args.context,
        "first_prompts": args.first_prompts,
        "recent_prompts": args.recent_prompts,
        "prev_descriptions": args.prev_descriptions,
        "recent_response": args.recent_response,
    }
    for key, value in arg_map.items():
        if value is not None:
            variables[key] = value

    # Load session data if requested
    if args.session:
        print(f"Loading data from session {args.session[:8]}...", file=sys.stderr)
        session_data = load_session_data(args.session, args.cwd)
        # Session data is base, CLI overrides take precedence
        variables = {**session_data, **variables}

    # Build the prompt
    try:
        prompt = build_prompt(args.prompt_type, variables)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    config = PROMPT_CONFIGS[args.prompt_type]

    # Preview mode - just show the prompt
    if args.preview:
        print("=" * 70)
        print(f"PROMPT PREVIEW: {args.prompt_type}")
        print("=" * 70)
        print(prompt)
        print("=" * 70)
        print(f"Max tokens: {config['max_tokens']}, Temperature: {config['temperature']}")
        print("=" * 70)
        return

    # Mock mode - return fake response
    if args.mock:
        print(f"[MOCK] Input prompt ({len(prompt)} chars)")
        print(f"[MOCK] Response: {args.mock}")
        return

    # Real API call
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY required for API calls", file=sys.stderr)
        print("Use --preview to see prompt without API call", file=sys.stderr)
        sys.exit(1)

    # Default to API backend for testing (faster)
    backend_config = {"backend": os.environ.get("SUMMARY_BACKEND", "api")}

    print(f"[{args.prompt_type}] Generating with {backend_config['backend']} backend...", file=sys.stderr)

    result = generate_with_backend(
        prompt=prompt,
        config=backend_config,
        api_key=api_key,
        max_tokens=config["max_tokens"],
        temperature=config["temperature"],
        prefix="test",
    )

    if result:
        print(f"\nGenerated {args.prompt_type}:")
        print(f"  {result}")
    else:
        print("No result generated", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
