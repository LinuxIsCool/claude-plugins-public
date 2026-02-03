"""Shared utilities for perf plugin.

Consolidates common functions used across multiple tools.
"""

import os
from pathlib import Path


def get_plugin_cache_dir() -> Path:
    """Get the Claude Code plugin cache directory."""
    return Path.home() / ".claude" / "plugins" / "cache"


def get_local_plugins_dir(cwd: str | None = None) -> Path:
    """Get the local plugins directory.

    Args:
        cwd: Working directory. If None, uses CWD env var or os.getcwd()
    """
    if cwd is None:
        cwd = os.environ.get('CWD', os.getcwd())
    return Path(cwd) / "plugins"


def get_newest_mtime(directory: Path) -> float:
    """Get the newest modification time of any file in a directory tree.

    Returns 0.0 if directory doesn't exist or has no files.
    """
    newest = 0.0
    try:
        for f in directory.rglob('*'):
            if f.is_file():
                mtime = f.stat().st_mtime
                if mtime > newest:
                    newest = mtime
    except (OSError, PermissionError):
        pass
    return newest


def get_directory_size(directory: Path) -> int:
    """Get total size of all files in a directory tree.

    Returns 0 if directory doesn't exist or can't be read.
    """
    total = 0
    try:
        for f in directory.rglob('*'):
            if f.is_file():
                total += f.stat().st_size
    except (OSError, PermissionError):
        pass
    return total


def count_files(directory: Path) -> int:
    """Count files in a directory tree.

    Returns 0 if directory doesn't exist or can't be read.
    """
    count = 0
    try:
        for f in directory.rglob('*'):
            if f.is_file():
                count += 1
    except (OSError, PermissionError):
        pass
    return count


def format_size(bytes_val: int) -> str:
    """Format bytes as human-readable size."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} TB"


def calculate_hook_summary(hooks: dict) -> dict:
    """Calculate aggregated statistics for hook events.

    Args:
        hooks: Dict mapping hook_type -> list of event dicts

    Returns:
        Summary dict with total_events and by_type breakdown
    """
    summary = {
        "total_events": sum(len(v) for v in hooks.values()),
        "by_type": {}
    }

    for hook_type, events in hooks.items():
        durations = [e.get("duration_ms", 0) for e in events if "duration_ms" in e]
        summary["by_type"][hook_type] = {
            "count": len(events),
            "total_ms": round(sum(durations), 2) if durations else 0,
            "avg_ms": round(sum(durations) / len(durations), 2) if len(durations) > 0 else 0,
            "max_ms": round(max(durations), 2) if len(durations) > 0 else 0
        }

    return summary
