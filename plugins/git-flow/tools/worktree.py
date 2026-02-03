#!/usr/bin/env python3
"""Git Worktree Operations - Create, list, and manage worktrees.

Provides atomic worktree + branch creation and cleanup operations.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Import registry from same package
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))
from registry import (
    register_worktree,
    get_worktree,
    update_worktree,
    mark_archived,
    archive_to_file,
    find_by_branch,
)


def get_repo_root() -> Path:
    """Get the repository root directory."""
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        raise RuntimeError("Not in a git repository")
    return Path(result.stdout.strip())


def sanitize_branch_name(name: str) -> str:
    """Sanitize branch name for filesystem safety.

    Args:
        name: Raw branch name

    Returns:
        Sanitized name safe for filesystem and git
    """
    # Replace slashes with hyphens for path safety
    safe = name.replace("/", "-")
    # Only allow alphanumeric, hyphens, underscores
    safe = re.sub(r"[^a-zA-Z0-9_-]", "-", safe)
    # Collapse multiple hyphens
    safe = re.sub(r"-+", "-", safe)
    # Trim to reasonable length
    safe = safe[:60]
    return safe.strip("-")


def get_worktree_path(branch_name: str) -> Path:
    """Get the worktree path for a branch name.

    Worktrees are stored in .git/worktrees/{sanitized-branch-name}/

    Args:
        branch_name: Git branch name (e.g., feature/phoenix-a3e-dark-mode)

    Returns:
        Path to worktree directory
    """
    repo_root = get_repo_root()
    safe_name = sanitize_branch_name(branch_name)
    return repo_root / ".git" / "worktrees" / safe_name


def is_worktree(path: Path = None) -> bool:
    """Check if a path is inside a git worktree.

    Args:
        path: Path to check (defaults to current directory)

    Returns:
        True if path is inside a worktree
    """
    cwd = str(path) if path else None
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        capture_output=True,
        text=True,
        cwd=cwd
    )
    if result.returncode != 0:
        return False

    git_dir = result.stdout.strip()
    # Worktrees have .git files pointing to .git/worktrees/*/
    return "worktrees" in git_dir


def get_current_worktree() -> Optional[dict]:
    """Get information about the current worktree.

    Returns:
        Dict with worktree info or None if not in a worktree
    """
    if not is_worktree():
        return None

    # Get current branch
    branch_result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True
    )
    branch = branch_result.stdout.strip() if branch_result.returncode == 0 else ""

    # Get git directory (worktree path)
    git_dir_result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        capture_output=True,
        text=True
    )
    git_dir = git_dir_result.stdout.strip()

    # Get worktree root
    worktree_result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True
    )
    worktree_root = worktree_result.stdout.strip()

    return {
        "branch_name": branch,
        "worktree_path": git_dir,
        "worktree_root": worktree_root,
        "is_worktree": True
    }


def create_worktree(
    branch_name: str,
    base_branch: str = "develop",
    session_id: str = None,
    created_by: str = "agent"
) -> dict:
    """Create a git worktree with a new feature branch.

    Atomically:
    1. Creates the branch from base
    2. Creates the worktree
    3. Registers in the registry

    Args:
        branch_name: Full branch name (e.g., feature/phoenix-a3e-dark-mode)
        base_branch: Base branch to create from (develop or main)
        session_id: Claude session ID for registry
        created_by: Agent name for attribution

    Returns:
        Dict with worktree info including path

    Raises:
        RuntimeError: If worktree creation fails
    """
    repo_root = get_repo_root()
    worktree_path = get_worktree_path(branch_name)

    # Validate path doesn't escape
    if not str(worktree_path).startswith(str(repo_root)):
        raise ValueError(f"Invalid worktree path: {worktree_path}")

    # Check if branch already exists
    branch_check = subprocess.run(
        ["git", "rev-parse", "--verify", branch_name],
        capture_output=True,
        text=True
    )
    branch_exists = branch_check.returncode == 0

    # Check if worktree already exists
    worktree_check = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        capture_output=True,
        text=True
    )
    worktree_exists = str(worktree_path) in worktree_check.stdout

    if worktree_exists:
        # Return existing worktree info
        return {
            "branch_name": branch_name,
            "worktree_path": str(worktree_path),
            "action": "exists",
            "message": f"Worktree already exists at {worktree_path}"
        }

    try:
        # Step 1: Create branch if it doesn't exist
        if not branch_exists:
            create_branch = subprocess.run(
                ["git", "branch", branch_name, base_branch],
                capture_output=True,
                text=True
            )
            if create_branch.returncode != 0:
                raise RuntimeError(f"Failed to create branch: {create_branch.stderr}")

        # Step 2: Create worktree
        # Note: git worktree add creates the directory
        worktree_path.parent.mkdir(parents=True, exist_ok=True)
        create_wt = subprocess.run(
            ["git", "worktree", "add", str(worktree_path), branch_name],
            capture_output=True,
            text=True
        )
        if create_wt.returncode != 0:
            # Rollback: delete branch if we created it
            if not branch_exists:
                subprocess.run(["git", "branch", "-D", branch_name])
            raise RuntimeError(f"Failed to create worktree: {create_wt.stderr}")

        # Step 3: Register in registry
        if session_id:
            register_worktree(
                session_id=session_id,
                branch_name=branch_name,
                worktree_path=str(worktree_path),
                base_branch=base_branch,
                created_by=created_by
            )

        return {
            "branch_name": branch_name,
            "worktree_path": str(worktree_path),
            "base_branch": base_branch,
            "action": "created",
            "message": f"Created worktree at {worktree_path}"
        }

    except Exception as e:
        # Cleanup on failure
        if worktree_path.exists():
            subprocess.run(["git", "worktree", "remove", "--force", str(worktree_path)])
        raise RuntimeError(f"Worktree creation failed: {e}")


def list_worktrees() -> list[dict]:
    """List all git worktrees.

    Returns:
        List of worktree info dicts
    """
    result = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return []

    worktrees = []
    current = {}

    for line in result.stdout.strip().split("\n"):
        if not line:
            if current:
                worktrees.append(current)
                current = {}
            continue

        if line.startswith("worktree "):
            current["path"] = line[9:]
        elif line.startswith("HEAD "):
            current["head"] = line[5:]
        elif line.startswith("branch "):
            current["branch"] = line[7:]
        elif line == "bare":
            current["bare"] = True
        elif line == "detached":
            current["detached"] = True

    if current:
        worktrees.append(current)

    return worktrees


def cleanup_worktree(
    branch_name: str,
    session_id: str = None,
    force: bool = False,
    archive: bool = True
) -> dict:
    """Remove a worktree and optionally delete the branch.

    Args:
        branch_name: Git branch name
        session_id: Session ID for registry update
        force: Force removal even if branch not merged
        archive: Archive metadata before deletion

    Returns:
        Dict with cleanup result
    """
    worktree_path = get_worktree_path(branch_name)

    # Archive metadata first if requested
    if archive and session_id:
        archive_path = archive_to_file(session_id)
        archived_to = str(archive_path) if archive_path else None
    else:
        archived_to = None

    # Remove worktree
    remove_args = ["git", "worktree", "remove"]
    if force:
        remove_args.append("--force")
    remove_args.append(str(worktree_path))

    remove_result = subprocess.run(
        remove_args,
        capture_output=True,
        text=True
    )

    worktree_removed = remove_result.returncode == 0

    # Delete branch
    delete_args = ["git", "branch"]
    if force:
        delete_args.append("-D")
    else:
        delete_args.append("-d")
    delete_args.append(branch_name)

    delete_result = subprocess.run(
        delete_args,
        capture_output=True,
        text=True
    )

    branch_deleted = delete_result.returncode == 0

    # Update registry
    if session_id:
        mark_archived(session_id)

    # Prune stale worktree references
    subprocess.run(["git", "worktree", "prune"])

    return {
        "branch_name": branch_name,
        "worktree_removed": worktree_removed,
        "branch_deleted": branch_deleted,
        "archived_to": archived_to,
        "action": "cleaned",
        "message": f"Cleaned up {branch_name}"
    }


def switch_to_worktree(worktree_path: str) -> dict:
    """Switch the current working directory to a worktree.

    Note: This returns the path; actual directory change must be
    handled by the caller (e.g., by exporting to CLAUDE_ENV_FILE).

    Args:
        worktree_path: Path to worktree

    Returns:
        Dict with switch info
    """
    path = Path(worktree_path)
    if not path.exists():
        raise ValueError(f"Worktree path does not exist: {worktree_path}")

    # Verify it's a valid worktree
    git_check = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        capture_output=True,
        text=True,
        cwd=str(path)
    )
    if git_check.returncode != 0:
        raise ValueError(f"Not a valid git worktree: {worktree_path}")

    # Get branch name
    branch_result = subprocess.run(
        ["git", "branch", "--show-current"],
        capture_output=True,
        text=True,
        cwd=str(path)
    )
    branch = branch_result.stdout.strip()

    return {
        "worktree_path": str(path),
        "branch_name": branch,
        "action": "switch",
        "message": f"Switch to worktree: {branch}"
    }


# CLI interface
def main():
    parser = argparse.ArgumentParser(description="Git worktree operations")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # create
    create_parser = subparsers.add_parser("create", help="Create worktree")
    create_parser.add_argument("branch_name", help="Branch name")
    create_parser.add_argument("--base", default="develop", help="Base branch")
    create_parser.add_argument("--session-id", help="Session ID for registry")
    create_parser.add_argument("--created-by", default="agent", help="Agent name")

    # list
    list_parser = subparsers.add_parser("list", help="List worktrees")
    list_parser.add_argument("--format", choices=["json", "table"], default="table")

    # cleanup
    clean_parser = subparsers.add_parser("cleanup", help="Remove worktree")
    clean_parser.add_argument("branch_name", help="Branch name")
    clean_parser.add_argument("--session-id", help="Session ID for registry")
    clean_parser.add_argument("--force", action="store_true", help="Force removal")
    clean_parser.add_argument("--no-archive", action="store_true", help="Skip archiving")

    # current
    current_parser = subparsers.add_parser("current", help="Get current worktree info")

    # is-worktree
    check_parser = subparsers.add_parser("is-worktree", help="Check if in worktree")

    args = parser.parse_args()

    if args.command == "create":
        try:
            result = create_worktree(
                args.branch_name,
                args.base,
                args.session_id,
                args.created_by
            )
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)

    elif args.command == "list":
        worktrees = list_worktrees()
        if args.format == "json":
            print(json.dumps(worktrees, indent=2))
        else:
            if not worktrees:
                print("No worktrees found")
            else:
                print(f"{'Path':<60} {'Branch':<40}")
                print("-" * 102)
                for wt in worktrees:
                    path = wt.get("path", "")[:58]
                    branch = wt.get("branch", "refs/heads/").replace("refs/heads/", "")[:38]
                    print(f"{path:<60} {branch:<40}")

    elif args.command == "cleanup":
        try:
            result = cleanup_worktree(
                args.branch_name,
                args.session_id,
                args.force,
                not args.no_archive
            )
            print(json.dumps(result, indent=2))
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)

    elif args.command == "current":
        info = get_current_worktree()
        if info:
            print(json.dumps(info, indent=2))
        else:
            print(json.dumps({"is_worktree": False}))

    elif args.command == "is-worktree":
        if is_worktree():
            print("true")
            sys.exit(0)
        else:
            print("false")
            sys.exit(1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
