#!/usr/bin/env python3
"""
Instance Registry - Track Claude instances across sessions

Stores instance metadata in .claude/instances/registry.json
Enables multi-instance coordination and historical tracking.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


def get_instances_dir() -> Path:
    """Get the instances directory, creating if needed."""
    # Look for .claude in current dir or parents
    cwd = Path.cwd()
    for parent in [cwd] + list(cwd.parents):
        claude_dir = parent / ".claude"
        if claude_dir.exists():
            instances_dir = claude_dir / "instances"
            instances_dir.mkdir(exist_ok=True)
            return instances_dir

    # Fallback to home directory
    home_claude = Path.home() / ".claude" / "instances"
    home_claude.mkdir(parents=True, exist_ok=True)
    return home_claude


def get_registry_path() -> Path:
    """Get path to registry.json."""
    return get_instances_dir() / "registry.json"


def load_registry() -> dict:
    """Load the instance registry."""
    path = get_registry_path()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def save_registry(registry: dict):
    """Save the instance registry."""
    path = get_registry_path()
    path.write_text(json.dumps(registry, indent=2, default=str))


def now_iso() -> str:
    """Get current timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


def register_instance(
    session_id: str,
    name: str,
    task: str = "",
    model: str = "",
    cwd: str = ""
) -> dict:
    """
    Register or update an instance in the registry.

    Args:
        session_id: Unique session identifier
        name: Human-readable instance name (e.g., "Explorer")
        task: Description of what this instance is working on
        model: Model identifier (e.g., "claude-opus-4-5")
        cwd: Current working directory

    Returns:
        The registered instance data
    """
    registry = load_registry()

    now = now_iso()

    if session_id in registry:
        # Update existing
        registry[session_id].update({
            "name": name,
            "task": task or registry[session_id].get("task", ""),
            "model": model or registry[session_id].get("model", ""),
            "cwd": cwd or registry[session_id].get("cwd", ""),
            "last_seen": now,
            "status": "active"
        })
    else:
        # Create new
        registry[session_id] = {
            "name": name,
            "task": task,
            "model": model,
            "cwd": cwd,
            "created": now,
            "last_seen": now,
            "status": "active"
        }

    save_registry(registry)
    return registry[session_id]


def get_instance(session_id: str) -> Optional[dict]:
    """Get instance data by session ID."""
    registry = load_registry()
    return registry.get(session_id)


def get_instance_name(session_id: str, default: str = "Claude") -> str:
    """Get instance name, with fallback default."""
    instance = get_instance(session_id)
    if instance:
        return instance.get("name", default)
    return default


def find_by_name(name: str) -> Optional[tuple[str, dict]]:
    """Find an instance by name. Returns (session_id, data) or None."""
    registry = load_registry()
    for session_id, data in registry.items():
        if data.get("name", "").lower() == name.lower():
            return (session_id, data)
    return None


def list_instances(status: Optional[str] = None) -> list[tuple[str, dict]]:
    """
    List all instances, optionally filtered by status.

    Args:
        status: Filter by status ("active", "inactive", None for all)

    Returns:
        List of (session_id, data) tuples, sorted by last_seen desc
    """
    registry = load_registry()
    instances = list(registry.items())

    if status:
        instances = [(sid, data) for sid, data in instances
                     if data.get("status") == status]

    # Sort by last_seen descending
    instances.sort(key=lambda x: x[1].get("last_seen", ""), reverse=True)
    return instances


def list_active() -> list[tuple[str, dict]]:
    """List only active instances."""
    return list_instances(status="active")


def mark_inactive(session_id: str):
    """Mark an instance as inactive."""
    registry = load_registry()
    if session_id in registry:
        registry[session_id]["status"] = "inactive"
        registry[session_id]["last_seen"] = now_iso()
        save_registry(registry)


def update_last_seen(session_id: str):
    """Update the last_seen timestamp for an instance."""
    registry = load_registry()
    if session_id in registry:
        registry[session_id]["last_seen"] = now_iso()
        save_registry(registry)


def cleanup_stale(hours: int = 24):
    """Mark instances not seen in the last N hours as inactive."""
    from datetime import timedelta

    registry = load_registry()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    for session_id, data in registry.items():
        if data.get("status") == "active":
            last_seen_str = data.get("last_seen", "")
            try:
                last_seen = datetime.fromisoformat(last_seen_str.replace("Z", "+00:00"))
                if last_seen < cutoff:
                    registry[session_id]["status"] = "inactive"
            except (ValueError, TypeError):
                pass

    save_registry(registry)


class InstanceRegistry:
    """Object-oriented interface to the instance registry."""

    def register(self, session_id: str, name: str, task: str = "",
                 model: str = "", cwd: str = "") -> dict:
        return register_instance(session_id, name, task, model, cwd)

    def get(self, session_id: str) -> Optional[dict]:
        return get_instance(session_id)

    def get_name(self, session_id: str, default: str = "Claude") -> str:
        return get_instance_name(session_id, default)

    def find_by_name(self, name: str) -> Optional[tuple[str, dict]]:
        return find_by_name(name)

    def list_all(self) -> list[tuple[str, dict]]:
        return list_instances()

    def list_active(self) -> list[tuple[str, dict]]:
        return list_active()

    def mark_inactive(self, session_id: str):
        mark_inactive(session_id)

    def update_last_seen(self, session_id: str):
        update_last_seen(session_id)

    def cleanup_stale(self, hours: int = 24):
        cleanup_stale(hours)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Instance Registry CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Register command
    reg_parser = subparsers.add_parser("register", help="Register an instance")
    reg_parser.add_argument("session_id", help="Session ID")
    reg_parser.add_argument("name", help="Instance name")
    reg_parser.add_argument("--task", default="", help="Task description")
    reg_parser.add_argument("--model", default="", help="Model ID")
    reg_parser.add_argument("--cwd", default="", help="Working directory")

    # List command
    list_parser = subparsers.add_parser("list", help="List instances")
    list_parser.add_argument("--active", action="store_true", help="Only active")
    list_parser.add_argument("--json", action="store_true", help="JSON output")

    # Get command
    get_parser = subparsers.add_parser("get", help="Get instance by ID")
    get_parser.add_argument("session_id", help="Session ID (or prefix)")

    args = parser.parse_args()

    if args.command == "register":
        result = register_instance(
            args.session_id, args.name, args.task, args.model, args.cwd
        )
        print(json.dumps(result, indent=2))

    elif args.command == "list":
        instances = list_active() if args.active else list_instances()
        if args.json:
            print(json.dumps(dict(instances), indent=2))
        else:
            print(f"{'ID':<12} {'Name':<15} {'Status':<10} {'Task'}")
            print("-" * 60)
            for sid, data in instances:
                short_id = sid[:8] if len(sid) > 8 else sid
                name = data.get("name", "Unknown")[:14]
                status = data.get("status", "?")[:9]
                task = data.get("task", "")[:30]
                print(f"{short_id:<12} {name:<15} {status:<10} {task}")

    elif args.command == "get":
        # Support prefix matching
        registry = load_registry()
        matches = [(sid, data) for sid, data in registry.items()
                   if sid.startswith(args.session_id)]
        if matches:
            for sid, data in matches:
                print(json.dumps({sid: data}, indent=2))
        else:
            print(f"No instance found matching: {args.session_id}")

    else:
        parser.print_help()
