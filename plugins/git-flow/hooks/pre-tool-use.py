#!/usr/bin/env python3
"""Git-Flow PreToolUse Hook - Safety net for Write/Edit operations.

Ensures code changes happen on feature branches with worktrees.
Blocks modifications on protected branches (main, develop) unless in worktree.
"""

import json
import os
import subprocess
import sys
from pathlib import Path


def get_git_info() -> dict:
    """Get current git context.

    Returns:
        Dict with branch, is_worktree, is_protected info
    """
    info = {
        "in_git_repo": False,
        "branch": None,
        "is_worktree": False,
        "is_protected": False,
        "git_dir": None,
    }

    # Check if in git repo
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return info

    info["in_git_repo"] = True
    info["git_dir"] = result.stdout.strip()

    # Check if in worktree
    info["is_worktree"] = "worktrees" in info["git_dir"]

    # Get current branch
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        info["branch"] = result.stdout.strip()

    # Check if protected branch
    protected_branches = {"main", "master", "develop", "development"}
    if info["branch"] in protected_branches:
        info["is_protected"] = True

    return info


def is_feature_branch(branch: str) -> bool:
    """Check if branch follows feature branch naming.

    Args:
        branch: Branch name

    Returns:
        True if it's a feature-type branch
    """
    if not branch:
        return False

    prefixes = ["feature/", "fix/", "refactor/", "docs/", "test/", "chore/"]
    return any(branch.startswith(p) for p in prefixes)


def get_tool_info() -> dict:
    """Get information about the tool being called.

    Returns:
        Dict with tool_name and file_path if available
    """
    tool_name = os.environ.get("CLAUDE_TOOL_NAME", "")
    tool_input = os.environ.get("CLAUDE_TOOL_INPUT", "{}")

    try:
        input_data = json.loads(tool_input)
    except json.JSONDecodeError:
        input_data = {}

    return {
        "tool_name": tool_name,
        "file_path": input_data.get("file_path", input_data.get("path", "")),
        "input_data": input_data
    }


def is_excluded_path(file_path: str) -> bool:
    """Check if file path is excluded from branch protection.

    Some files should be editable regardless of branch:
    - .claude/ directory (journal, planning, etc.)
    - .git/ directory internals
    - Temporary files

    Args:
        file_path: Path to file being modified

    Returns:
        True if file is excluded from protection
    """
    if not file_path:
        return False

    excluded_patterns = [
        ".claude/",
        ".git/",
        "/tmp/",
        ".local.",
        "node_modules/",
        "__pycache__/",
        ".env.local",
    ]

    return any(pattern in file_path for pattern in excluded_patterns)


def should_allow() -> tuple[bool, str]:
    """Determine if the tool call should be allowed.

    Returns:
        Tuple of (allowed: bool, reason: str)
    """
    git_info = get_git_info()
    tool_info = get_tool_info()

    # Not in git repo - allow
    if not git_info["in_git_repo"]:
        return True, "Not in a git repository"

    # In worktree - always allow (isolated workspace)
    if git_info["is_worktree"]:
        return True, f"In worktree on branch {git_info['branch']}"

    # On feature branch (not in worktree, but on feature branch) - allow
    if is_feature_branch(git_info["branch"]):
        return True, f"On feature branch {git_info['branch']}"

    # Excluded paths - allow even on protected branches
    if is_excluded_path(tool_info["file_path"]):
        return True, f"File {tool_info['file_path']} is excluded from protection"

    # On protected branch without worktree - block
    if git_info["is_protected"]:
        return False, (
            f"Cannot modify files on protected branch '{git_info['branch']}'. "
            f"Please create a feature branch first:\n\n"
            f"1. Use /git-flow:branch-create to create a worktree with feature branch\n"
            f"2. Or manually: git worktree add .git/worktrees/my-feature feature/my-feature\n\n"
            f"This ensures your changes are isolated and can be reviewed via PR."
        )

    # Default: allow (unprotected branch without worktree)
    return True, f"On branch {git_info['branch']}"


def main():
    """Main hook entry point.

    Outputs JSON with decision and reason.
    Exit code 0 = allow, non-zero = block
    """
    allowed, reason = should_allow()

    result = {
        "decision": "allow" if allowed else "block",
        "reason": reason,
    }

    # Add git context for debugging
    git_info = get_git_info()
    tool_info = get_tool_info()

    result["context"] = {
        "branch": git_info.get("branch"),
        "is_worktree": git_info.get("is_worktree"),
        "is_protected": git_info.get("is_protected"),
        "tool": tool_info.get("tool_name"),
        "file": tool_info.get("file_path"),
    }

    print(json.dumps(result, indent=2))

    if not allowed:
        sys.exit(1)


if __name__ == "__main__":
    main()
