#!/usr/bin/env python3
"""Worktree Registry - Maps sessions to worktrees.

Stores session→worktree mappings in .claude/git-flow/worktree-registry.json
Supports CRUD operations and state tracking.
"""

import argparse
import fcntl
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


def find_registry_path(cwd: str = ".") -> Path:
    """Find or create registry file location."""
    # Prefer project-level registry
    project_registry = Path(cwd) / ".claude" / "git-flow" / "worktree-registry.json"

    # Fallback to home directory
    home_registry = Path.home() / ".claude" / "git-flow" / "worktree-registry.json"

    # Use project registry if .claude exists, otherwise home
    if (Path(cwd) / ".claude").exists():
        project_registry.parent.mkdir(parents=True, exist_ok=True)
        return project_registry
    else:
        home_registry.parent.mkdir(parents=True, exist_ok=True)
        return home_registry


def load_registry(path: Path) -> dict:
    """Load registry from file with file locking."""
    if not path.exists():
        return {}

    try:
        with open(path, "r") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            data = json.load(f)
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            return data
    except (json.JSONDecodeError, IOError):
        return {}


def save_registry(path: Path, data: dict) -> None:
    """Save registry to file with file locking."""
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        json.dump(data, f, indent=2)
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def now_iso() -> str:
    """Return current time in ISO format."""
    return datetime.now().isoformat()


def register_worktree(
    session_id: str,
    branch_name: str,
    worktree_path: str,
    base_branch: str = "develop",
    created_by: str = "agent",
    cwd: str = "."
) -> dict:
    """Register a new worktree for a session.

    Args:
        session_id: Claude session identifier
        branch_name: Git branch name (e.g., feature/phoenix-a3e-dark-mode)
        worktree_path: Path to worktree directory
        base_branch: Base branch (develop or main)
        created_by: Agent name that created the worktree
        cwd: Current working directory

    Returns:
        The created registry entry
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)

    entry = {
        "worktree_path": worktree_path,
        "branch_name": branch_name,
        "base_branch": base_branch,
        "status": "active",
        "created": now_iso(),
        "created_by": created_by,
        "last_seen": now_iso(),
        "pr_url": None,
        "merged_at": None,
        "commits_count": 0,
        "files_changed": []
    }

    registry[session_id] = entry
    save_registry(path, registry)

    return entry


def get_worktree(session_id: str, cwd: str = ".") -> Optional[dict]:
    """Get worktree info for a session.

    Args:
        session_id: Claude session identifier
        cwd: Current working directory

    Returns:
        Worktree entry or None if not found
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)
    return registry.get(session_id)


def update_worktree(session_id: str, updates: dict, cwd: str = ".") -> Optional[dict]:
    """Update worktree entry.

    Args:
        session_id: Claude session identifier
        updates: Dictionary of fields to update
        cwd: Current working directory

    Returns:
        Updated entry or None if not found
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)

    if session_id not in registry:
        return None

    # Update fields
    registry[session_id].update(updates)
    registry[session_id]["last_seen"] = now_iso()

    save_registry(path, registry)
    return registry[session_id]


def mark_merged(session_id: str, cwd: str = ".") -> Optional[dict]:
    """Mark a worktree as merged.

    Args:
        session_id: Claude session identifier
        cwd: Current working directory

    Returns:
        Updated entry or None if not found
    """
    return update_worktree(session_id, {
        "status": "merged",
        "merged_at": now_iso()
    }, cwd)


def mark_archived(session_id: str, cwd: str = ".") -> Optional[dict]:
    """Mark a worktree as archived.

    Args:
        session_id: Claude session identifier
        cwd: Current working directory

    Returns:
        Updated entry or None if not found
    """
    return update_worktree(session_id, {
        "status": "archived"
    }, cwd)


def list_worktrees(cwd: str = ".", status: Optional[str] = None) -> list[dict]:
    """List all worktrees.

    Args:
        cwd: Current working directory
        status: Filter by status (active, merged, archived, stale)

    Returns:
        List of worktree entries with session_id added
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)

    result = []
    for session_id, entry in registry.items():
        if status is None or entry.get("status") == status:
            entry_with_id = entry.copy()
            entry_with_id["session_id"] = session_id
            result.append(entry_with_id)

    return result


def find_by_branch(branch_name: str, cwd: str = ".") -> Optional[dict]:
    """Find worktree by branch name.

    Args:
        branch_name: Git branch name
        cwd: Current working directory

    Returns:
        Worktree entry with session_id or None if not found
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)

    for session_id, entry in registry.items():
        if entry.get("branch_name") == branch_name:
            entry_with_id = entry.copy()
            entry_with_id["session_id"] = session_id
            return entry_with_id

    return None


def cleanup_stale(days: int = 7, cwd: str = ".") -> list[str]:
    """Mark worktrees as stale if not seen in N days.

    Args:
        days: Number of days of inactivity to consider stale
        cwd: Current working directory

    Returns:
        List of session_ids marked as stale
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)

    stale_sessions = []
    cutoff = datetime.now().timestamp() - (days * 24 * 60 * 60)

    for session_id, entry in registry.items():
        if entry.get("status") == "active":
            last_seen = entry.get("last_seen", entry.get("created", ""))
            try:
                last_seen_ts = datetime.fromisoformat(last_seen).timestamp()
                if last_seen_ts < cutoff:
                    registry[session_id]["status"] = "stale"
                    stale_sessions.append(session_id)
            except ValueError:
                pass

    if stale_sessions:
        save_registry(path, registry)

    return stale_sessions


def archive_to_file(session_id: str, cwd: str = ".") -> Optional[Path]:
    """Archive worktree metadata to separate file before deletion.

    Args:
        session_id: Claude session identifier
        cwd: Current working directory

    Returns:
        Path to archive file or None if worktree not found
    """
    path = find_registry_path(cwd)
    registry = load_registry(path)

    if session_id not in registry:
        return None

    entry = registry[session_id]
    branch_name = entry.get("branch_name", session_id)

    # Create archive directory
    archive_dir = path.parent / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)

    # Write archive file
    safe_branch = branch_name.replace("/", "-")
    archive_path = archive_dir / f"{safe_branch}.json"

    archive_data = {
        "session_id": session_id,
        "archived_at": now_iso(),
        **entry
    }

    with open(archive_path, "w") as f:
        json.dump(archive_data, f, indent=2)

    return archive_path


# CLI interface
def main():
    parser = argparse.ArgumentParser(description="Git-flow worktree registry")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # register
    reg_parser = subparsers.add_parser("register", help="Register a worktree")
    reg_parser.add_argument("session_id", help="Session ID")
    reg_parser.add_argument("branch_name", help="Branch name")
    reg_parser.add_argument("worktree_path", help="Worktree path")
    reg_parser.add_argument("--base", default="develop", help="Base branch")
    reg_parser.add_argument("--created-by", default="agent", help="Agent name")

    # get
    get_parser = subparsers.add_parser("get", help="Get worktree info")
    get_parser.add_argument("session_id", help="Session ID")

    # list
    list_parser = subparsers.add_parser("list", help="List worktrees")
    list_parser.add_argument("--status", help="Filter by status")
    list_parser.add_argument("--format", choices=["json", "table"], default="table")

    # update
    upd_parser = subparsers.add_parser("update", help="Update worktree")
    upd_parser.add_argument("session_id", help="Session ID")
    upd_parser.add_argument("--status", help="New status")
    upd_parser.add_argument("--pr-url", help="PR URL")

    # archive
    arc_parser = subparsers.add_parser("archive", help="Archive worktree metadata")
    arc_parser.add_argument("session_id", help="Session ID")

    # cleanup
    cln_parser = subparsers.add_parser("cleanup", help="Mark stale worktrees")
    cln_parser.add_argument("--days", type=int, default=7, help="Days of inactivity")

    args = parser.parse_args()
    cwd = os.getcwd()

    if args.command == "register":
        entry = register_worktree(
            args.session_id,
            args.branch_name,
            args.worktree_path,
            args.base,
            args.created_by,
            cwd
        )
        print(json.dumps(entry, indent=2))

    elif args.command == "get":
        entry = get_worktree(args.session_id, cwd)
        if entry:
            print(json.dumps(entry, indent=2))
        else:
            print(f"No worktree found for session {args.session_id}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "list":
        entries = list_worktrees(cwd, args.status)
        if args.format == "json":
            print(json.dumps(entries, indent=2))
        else:
            if not entries:
                print("No worktrees found")
            else:
                print(f"{'Session':<12} {'Branch':<40} {'Status':<10} {'Created':<20}")
                print("-" * 85)
                for e in entries:
                    sid = e.get("session_id", "")[:10]
                    branch = e.get("branch_name", "")[:38]
                    status = e.get("status", "")
                    created = e.get("created", "")[:19]
                    print(f"{sid:<12} {branch:<40} {status:<10} {created:<20}")

    elif args.command == "update":
        updates = {}
        if args.status:
            updates["status"] = args.status
        if args.pr_url:
            updates["pr_url"] = args.pr_url

        entry = update_worktree(args.session_id, updates, cwd)
        if entry:
            print(json.dumps(entry, indent=2))
        else:
            print(f"No worktree found for session {args.session_id}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "archive":
        archive_path = archive_to_file(args.session_id, cwd)
        if archive_path:
            print(f"Archived to {archive_path}")
        else:
            print(f"No worktree found for session {args.session_id}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "cleanup":
        stale = cleanup_stale(args.days, cwd)
        if stale:
            print(f"Marked {len(stale)} worktrees as stale:")
            for sid in stale:
                print(f"  - {sid}")
        else:
            print("No stale worktrees found")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
