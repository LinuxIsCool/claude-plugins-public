#!/usr/bin/env python3
"""Git-Flow Stop Hook - PR suggestion on session end.

Analyzes work done during session and suggests PR creation if appropriate.
"""

import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def get_git_info() -> dict:
    """Get current git context.

    Returns:
        Dict with branch and worktree info
    """
    info = {
        "in_git_repo": False,
        "branch": None,
        "is_worktree": False,
        "is_feature_branch": False,
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

    # Check if in worktree
    git_dir = result.stdout.strip()
    info["is_worktree"] = "worktrees" in git_dir

    # Get current branch
    result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        info["branch"] = result.stdout.strip()

    # Check if feature branch
    if info["branch"]:
        prefixes = ["feature/", "fix/", "refactor/", "docs/", "test/", "chore/"]
        info["is_feature_branch"] = any(info["branch"].startswith(p) for p in prefixes)

    return info


def get_unpushed_commits(base_branch: str = "develop") -> list[dict]:
    """Get commits not yet pushed to remote.

    Args:
        base_branch: Base branch to compare against

    Returns:
        List of commit info dicts
    """
    # First try to get commits ahead of origin
    result = subprocess.run(
        ["git", "log", f"origin/{base_branch}..HEAD", "--oneline", "--format=%h|%s|%an"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        # Fallback: compare to local base branch
        result = subprocess.run(
            ["git", "log", f"{base_branch}..HEAD", "--oneline", "--format=%h|%s|%an"],
            capture_output=True,
            text=True
        )

    if result.returncode != 0:
        return []

    commits = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("|", 2)
        if len(parts) >= 2:
            commits.append({
                "hash": parts[0],
                "message": parts[1],
                "author": parts[2] if len(parts) > 2 else "unknown"
            })

    return commits


def get_changed_files(base_branch: str = "develop") -> list[str]:
    """Get files changed since base branch.

    Args:
        base_branch: Base branch to compare against

    Returns:
        List of changed file paths
    """
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{base_branch}...HEAD"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return []

    return [f for f in result.stdout.strip().split("\n") if f]


def has_uncommitted_changes() -> bool:
    """Check for uncommitted changes.

    Returns:
        True if there are uncommitted changes
    """
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True
    )
    return bool(result.stdout.strip())


def get_pr_status(branch: str) -> dict:
    """Check if PR already exists for branch.

    Args:
        branch: Branch name

    Returns:
        Dict with PR info or None
    """
    try:
        result = subprocess.run(
            ["gh", "pr", "view", branch, "--json", "number,state,url,title"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
        pass

    return None


def update_registry(session_id: str, updates: dict) -> None:
    """Update registry entry for session.

    Args:
        session_id: Session ID
        updates: Dict of fields to update
    """
    script_dir = Path(__file__).parent
    registry_script = script_dir.parent / "tools" / "registry.py"

    if not registry_script.exists():
        return

    # Build update command
    cmd = ["python3", str(registry_script), "update", session_id]

    if "status" in updates:
        cmd.extend(["--status", updates["status"]])
    if "pr_url" in updates:
        cmd.extend(["--pr-url", updates["pr_url"]])

    try:
        subprocess.run(cmd, capture_output=True, timeout=5)
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass


def generate_pr_suggestion(
    branch: str,
    commits: list[dict],
    files: list[str],
    existing_pr: dict = None
) -> str:
    """Generate PR suggestion message.

    Args:
        branch: Current branch name
        commits: List of unpushed commits
        files: List of changed files
        existing_pr: Existing PR info if any

    Returns:
        Suggestion message string
    """
    if existing_pr:
        return (
            f"PR already exists for this branch:\n"
            f"  {existing_pr.get('title', 'Untitled')}\n"
            f"  {existing_pr.get('url', '')}\n"
            f"  Status: {existing_pr.get('state', 'unknown')}\n\n"
            f"Use /git-flow:pr-update to push latest changes."
        )

    if not commits:
        if has_uncommitted_changes():
            return (
                f"You have uncommitted changes on branch '{branch}'.\n"
                f"Consider committing your work before ending the session."
            )
        return ""

    # Build suggestion
    commit_count = len(commits)
    file_count = len(files)

    message = (
        f"Session Summary for branch '{branch}':\n"
        f"  Commits: {commit_count}\n"
        f"  Files changed: {file_count}\n"
    )

    # Show recent commits
    if commits:
        message += "\nRecent commits:\n"
        for c in commits[:5]:
            message += f"  - {c['hash']}: {c['message'][:60]}\n"
        if len(commits) > 5:
            message += f"  ... and {len(commits) - 5} more\n"

    # PR suggestion
    if commit_count >= 1:
        message += (
            f"\nReady to create a PR?\n"
            f"  Use: /git-flow:pr-create\n"
            f"  Or: gh pr create --base develop\n"
        )

    return message


def main():
    """Main hook entry point."""
    session_id = os.environ.get("CLAUDE_SESSION_ID", "")
    git_info = get_git_info()

    # Not in git repo - nothing to do
    if not git_info["in_git_repo"]:
        return

    # Not on feature branch - nothing to do
    if not git_info["is_feature_branch"]:
        return

    branch = git_info["branch"]

    # Determine base branch
    base_branch = "develop"
    if "main" in branch or "master" in branch:
        base_branch = "main"

    # Get work summary
    commits = get_unpushed_commits(base_branch)
    files = get_changed_files(base_branch)
    existing_pr = get_pr_status(branch)

    # Update registry if we have session ID
    if session_id:
        update_registry(session_id, {
            "commits_count": len(commits),
            "files_changed": files[:20],  # Limit stored files
        })

        if existing_pr and existing_pr.get("url"):
            update_registry(session_id, {
                "pr_url": existing_pr["url"]
            })

    # Generate and output suggestion
    suggestion = generate_pr_suggestion(branch, commits, files, existing_pr)

    if suggestion:
        print(suggestion)


if __name__ == "__main__":
    main()
