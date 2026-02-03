#!/usr/bin/env python3
"""Git Branch Naming - Generate and validate branch names.

Uses headless Haiku for intelligent branch title generation from context.
Integrates with statusline for agent name resolution.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional


def get_agent_info() -> dict:
    """Get agent info from statusline registry.

    Returns:
        Dict with agent_name and agent_id, or defaults if not found
    """
    # Try to read from statusline registry
    registry_paths = [
        Path.home() / ".claude" / "statusline" / "registry.json",
        Path(".claude") / "statusline" / "registry.json",
    ]

    session_id = os.environ.get("CLAUDE_SESSION_ID", "")

    for registry_path in registry_paths:
        if registry_path.exists():
            try:
                with open(registry_path, "r") as f:
                    registry = json.load(f)

                # Look for current session
                if session_id and session_id in registry:
                    entry = registry[session_id]
                    return {
                        "agent_name": entry.get("agent_name", "claude"),
                        "agent_id": session_id[:8] if session_id else "unknown",
                        "session_id": session_id
                    }

                # Look for most recent active entry
                active_entries = [
                    (sid, e) for sid, e in registry.items()
                    if e.get("status") == "active"
                ]
                if active_entries:
                    # Sort by last_seen, most recent first
                    active_entries.sort(
                        key=lambda x: x[1].get("last_seen", ""),
                        reverse=True
                    )
                    sid, entry = active_entries[0]
                    return {
                        "agent_name": entry.get("agent_name", "claude"),
                        "agent_id": sid[:8],
                        "session_id": sid
                    }

            except (json.JSONDecodeError, IOError):
                pass

    # Fallback to environment or defaults
    return {
        "agent_name": os.environ.get("CLAUDE_AGENT_NAME", "claude"),
        "agent_id": session_id[:8] if session_id else "unknown",
        "session_id": session_id
    }


def sanitize_branch_title(title: str) -> str:
    """Sanitize a title for use in branch name.

    Args:
        title: Raw title string

    Returns:
        Sanitized title safe for git branch names
    """
    # Lowercase
    safe = title.lower()
    # Replace spaces and special chars with hyphens
    safe = re.sub(r"[^a-z0-9]+", "-", safe)
    # Collapse multiple hyphens
    safe = re.sub(r"-+", "-", safe)
    # Trim length (leave room for prefix)
    safe = safe[:40]
    # Strip leading/trailing hyphens
    return safe.strip("-")


def generate_branch_title_with_haiku(context: str) -> Optional[str]:
    """Generate a branch title using headless Haiku.

    Args:
        context: Conversation context or task description

    Returns:
        Generated branch title or None if generation fails
    """
    prompt = f"""CLASSIFIER FUNCTION - NOT AN ASSISTANT

Generate a short branch title (2-5 words) for a git feature branch.
The title should describe what this work session is about.

Do NOT explain. Do NOT add extra text. Output ONLY the branch title.
Use lowercase-with-hyphens format.

Examples:
Context: "Adding dark mode toggle to settings page"
Output: dark-mode-toggle

Context: "Fix authentication bug where users can't log in"
Output: fix-auth-login-bug

Context: "Implement user profile API endpoints"
Output: user-profile-api

Context: "Refactoring the database connection pooling"
Output: db-connection-refactor

---

Context: {context[:500]}
Output:"""

    try:
        result = subprocess.run(
            [
                "claude",
                "-p", prompt,
                "--model", "haiku",
                "--max-turns", "1",
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            title = result.stdout.strip()
            # Clean up any markdown or extra formatting
            title = title.replace("```", "").strip()
            # Take first line only
            title = title.split("\n")[0].strip()
            # Validate it looks reasonable
            if title and len(title) < 60 and "-" in title or len(title.split()) <= 5:
                return sanitize_branch_title(title)

    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return None


def generate_fallback_title() -> str:
    """Generate a fallback branch title based on timestamp.

    Returns:
        Timestamp-based branch title
    """
    from datetime import datetime
    now = datetime.now()
    return f"work-{now.strftime('%m%d-%H%M')}"


def generate_branch_name(
    context: str = "",
    agent_name: str = None,
    agent_id: str = None,
    title: str = None,
    prefix: str = "feature"
) -> dict:
    """Generate a full branch name.

    Format: {prefix}/{agent_name}-{agent_id}-{title}

    Args:
        context: Conversation context for title generation
        agent_name: Agent name (auto-detected if not provided)
        agent_id: Agent ID (auto-detected if not provided)
        title: Explicit title (auto-generated if not provided)
        prefix: Branch prefix (feature, fix, refactor, etc.)

    Returns:
        Dict with branch_name and component parts
    """
    # Get agent info if not provided
    if agent_name is None or agent_id is None:
        info = get_agent_info()
        agent_name = agent_name or info["agent_name"]
        agent_id = agent_id or info["agent_id"]

    # Sanitize agent name
    agent_name = sanitize_branch_title(agent_name)
    if not agent_name:
        agent_name = "claude"

    # Ensure agent_id is short
    agent_id = agent_id[:8] if agent_id else "unknown"

    # Generate or use provided title
    if title:
        branch_title = sanitize_branch_title(title)
    elif context:
        generated = generate_branch_title_with_haiku(context)
        branch_title = generated if generated else generate_fallback_title()
    else:
        branch_title = generate_fallback_title()

    # Construct full branch name
    branch_name = f"{prefix}/{agent_name}-{agent_id}-{branch_title}"

    return {
        "branch_name": branch_name,
        "prefix": prefix,
        "agent_name": agent_name,
        "agent_id": agent_id,
        "title": branch_title,
    }


def validate_branch_name(branch_name: str) -> dict:
    """Validate a branch name follows our conventions.

    Args:
        branch_name: Branch name to validate

    Returns:
        Dict with valid flag and any issues
    """
    issues = []

    # Check basic format
    if "/" not in branch_name:
        issues.append("Missing prefix separator (should be prefix/name)")

    # Check for valid prefix
    valid_prefixes = ["feature", "fix", "refactor", "docs", "test", "chore"]
    prefix = branch_name.split("/")[0] if "/" in branch_name else ""
    if prefix not in valid_prefixes:
        issues.append(f"Invalid prefix '{prefix}' (expected: {', '.join(valid_prefixes)})")

    # Check for agent-id pattern
    name_part = branch_name.split("/", 1)[1] if "/" in branch_name else branch_name
    if not re.match(r"^[a-z0-9]+-[a-z0-9]+-", name_part):
        issues.append("Missing agent-id pattern (expected: name-id-title)")

    # Check for invalid characters
    if not re.match(r"^[a-z0-9/_-]+$", branch_name):
        issues.append("Contains invalid characters (only lowercase, numbers, hyphens, underscores, slashes)")

    # Check length
    if len(branch_name) > 100:
        issues.append(f"Too long ({len(branch_name)} chars, max 100)")

    return {
        "valid": len(issues) == 0,
        "branch_name": branch_name,
        "issues": issues
    }


def branch_exists(branch_name: str) -> bool:
    """Check if a branch already exists.

    Args:
        branch_name: Branch name to check

    Returns:
        True if branch exists
    """
    result = subprocess.run(
        ["git", "rev-parse", "--verify", branch_name],
        capture_output=True,
        text=True
    )
    return result.returncode == 0


def get_current_branch() -> Optional[str]:
    """Get the current branch name.

    Returns:
        Branch name or None if detached HEAD
    """
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        branch = result.stdout.strip()
        return branch if branch else None
    return None


def parse_branch_name(branch_name: str) -> Optional[dict]:
    """Parse a branch name into components.

    Args:
        branch_name: Branch name to parse

    Returns:
        Dict with components or None if invalid format
    """
    # Expected format: prefix/agent-id-title
    match = re.match(
        r"^([a-z]+)/([a-z0-9]+)-([a-z0-9]+)-(.+)$",
        branch_name
    )

    if not match:
        return None

    return {
        "branch_name": branch_name,
        "prefix": match.group(1),
        "agent_name": match.group(2),
        "agent_id": match.group(3),
        "title": match.group(4),
    }


# CLI interface
def main():
    parser = argparse.ArgumentParser(description="Git branch naming utilities")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # generate
    gen_parser = subparsers.add_parser("generate", help="Generate branch name")
    gen_parser.add_argument("--context", "-c", help="Context for title generation")
    gen_parser.add_argument("--title", "-t", help="Explicit title")
    gen_parser.add_argument("--agent-name", help="Agent name")
    gen_parser.add_argument("--agent-id", help="Agent ID")
    gen_parser.add_argument(
        "--prefix",
        default="feature",
        choices=["feature", "fix", "refactor", "docs", "test", "chore"],
        help="Branch prefix"
    )

    # validate
    val_parser = subparsers.add_parser("validate", help="Validate branch name")
    val_parser.add_argument("branch_name", help="Branch name to validate")

    # parse
    parse_parser = subparsers.add_parser("parse", help="Parse branch name")
    parse_parser.add_argument("branch_name", help="Branch name to parse")

    # current
    cur_parser = subparsers.add_parser("current", help="Get current branch")

    # exists
    exists_parser = subparsers.add_parser("exists", help="Check if branch exists")
    exists_parser.add_argument("branch_name", help="Branch name to check")

    # agent-info
    agent_parser = subparsers.add_parser("agent-info", help="Get agent info")

    args = parser.parse_args()

    if args.command == "generate":
        result = generate_branch_name(
            context=args.context or "",
            agent_name=args.agent_name,
            agent_id=args.agent_id,
            title=args.title,
            prefix=args.prefix
        )
        print(json.dumps(result, indent=2))

    elif args.command == "validate":
        result = validate_branch_name(args.branch_name)
        print(json.dumps(result, indent=2))
        if not result["valid"]:
            sys.exit(1)

    elif args.command == "parse":
        result = parse_branch_name(args.branch_name)
        if result:
            print(json.dumps(result, indent=2))
        else:
            print(json.dumps({"error": "Invalid branch name format"}))
            sys.exit(1)

    elif args.command == "current":
        branch = get_current_branch()
        if branch:
            print(json.dumps({"branch": branch}))
        else:
            print(json.dumps({"branch": None, "detached": True}))

    elif args.command == "exists":
        exists = branch_exists(args.branch_name)
        print(json.dumps({"branch_name": args.branch_name, "exists": exists}))
        sys.exit(0 if exists else 1)

    elif args.command == "agent-info":
        info = get_agent_info()
        print(json.dumps(info, indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
