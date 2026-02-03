#!/usr/bin/env python3
"""
Path resolution utilities for the memory plugin.

CRITICAL: All memory data must be anchored to the git repository root.
Never use relative paths like ".claude/memory/" - they resolve differently
depending on the current working directory, causing data fragmentation.

This module mirrors the TypeScript lib/paths.ts pattern.
"""

import subprocess
from pathlib import Path
from functools import lru_cache


@lru_cache(maxsize=1)
def get_repo_root() -> Path:
    """
    Find the git repository root.

    Cached for performance - repository root doesn't change during execution.

    Returns:
        Path to the git repository root, or current working directory if not in a repo.
    """
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--show-toplevel'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            return Path(result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # Fallback: try to find .claude directory by traversing up
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        if (parent / ".claude").is_dir():
            return parent

    return cwd


def get_claude_path(subpath: str = "") -> Path:
    """
    Get a path within the .claude/ directory.

    Args:
        subpath: Optional path relative to .claude/ (e.g., "memory", "memory/warm.db")

    Returns:
        Absolute path to the specified location within .claude/

    Examples:
        get_claude_path()                 -> /repo/.claude
        get_claude_path("memory")         -> /repo/.claude/memory
        get_claude_path("memory/warm.db") -> /repo/.claude/memory/warm.db
    """
    base = get_repo_root() / ".claude"
    if subpath:
        return base / subpath
    return base


def get_memory_path(subpath: str = "") -> Path:
    """
    Get a path within the .claude/memory/ directory.

    Convenience wrapper around get_claude_path.

    Args:
        subpath: Optional path relative to .claude/memory/

    Returns:
        Absolute path to the specified location within .claude/memory/

    Examples:
        get_memory_path()           -> /repo/.claude/memory
        get_memory_path("warm.db")  -> /repo/.claude/memory/warm.db
        get_memory_path("hot")      -> /repo/.claude/memory/hot
    """
    return get_claude_path(f"memory/{subpath}" if subpath else "memory")


def ensure_memory_dirs() -> Path:
    """
    Ensure the memory directory structure exists.

    Creates:
        .claude/memory/
        .claude/memory/hot/
        .claude/memory/cold/

    Returns:
        Path to the memory root directory.
    """
    memory_root = get_memory_path()
    memory_root.mkdir(parents=True, exist_ok=True)
    (memory_root / "hot").mkdir(exist_ok=True)
    (memory_root / "cold").mkdir(exist_ok=True)
    return memory_root


if __name__ == "__main__":
    # Test the path resolution
    print(f"Repo root: {get_repo_root()}")
    print(f"Claude path: {get_claude_path()}")
    print(f"Memory path: {get_memory_path()}")
    print(f"Warm DB: {get_memory_path('warm.db')}")
