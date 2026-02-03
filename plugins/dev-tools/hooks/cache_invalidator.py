#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Automatic plugin cache invalidation.

PostToolUse hook that clears plugin caches when source files are edited.
This removes the manual "clear cache" step from plugin development.

Triggers on Write/Edit to files matching:
- plugins/{plugin-name}/**/*
- .claude-plugin/**/*
"""

import json
import os
import re
import shutil
import sys
from pathlib import Path


def get_plugin_cache_dir() -> Path:
    """Get the Claude Code plugin cache directory."""
    return Path.home() / ".claude" / "plugins" / "cache"


def extract_plugin_name(file_path: str) -> str | None:
    """Extract plugin name from file path.

    Matches:
    - plugins/{name}/... → {name}
    - {name}/.claude-plugin/... → {name}
    """
    # Pattern: plugins/{name}/...
    match = re.search(r'plugins/([^/]+)/', file_path)
    if match:
        return match.group(1)

    # Pattern: {dir}/.claude-plugin/...
    if '/.claude-plugin/' in file_path:
        # Get the directory containing .claude-plugin
        parts = file_path.split('/.claude-plugin/')
        if parts:
            return Path(parts[0]).name

    return None


def is_dev_mode(plugin_cache: Path) -> bool:
    """Check if plugin is in dev mode (cache contains symlinks).

    Dev mode = version directory is a symlink to source.
    This enables hot-reload for hook-based plugins.
    """
    if not plugin_cache.exists():
        return False

    # Check if any version directory is a symlink
    for item in plugin_cache.iterdir():
        if item.is_symlink():
            return True
    return False


def find_cache_to_clear(plugin_name: str) -> list[Path]:
    """Find all cache directories for a plugin.

    Skips plugins in dev mode (symlinked caches) to preserve hot-reload.
    """
    cache_base = get_plugin_cache_dir()
    caches_to_clear = []

    if not cache_base.exists():
        return []

    # Search through all cache sources (linuxiscool-claude-plugins, etc.)
    for source_dir in cache_base.iterdir():
        if source_dir.is_dir():
            plugin_cache = source_dir / plugin_name
            if plugin_cache.exists():
                # Skip if in dev mode (preserves symlinks for hot-reload)
                if is_dev_mode(plugin_cache):
                    print(f"Plugin '{plugin_name}' in dev mode - cache preserved for hot-reload")
                    continue
                caches_to_clear.append(plugin_cache)

    return caches_to_clear


def clear_caches(caches: list[Path]) -> list[str]:
    """Clear the specified cache directories."""
    cleared = []
    for cache_path in caches:
        try:
            shutil.rmtree(cache_path)
            cleared.append(str(cache_path))
        except Exception:
            pass
    return cleared


def main():
    """PostToolUse hook entry point."""
    try:
        raw = sys.stdin.read()
        if not raw:
            return
        data = json.loads(raw)
    except (json.JSONDecodeError, IOError):
        return

    # Get the file path that was modified
    tool_input = data.get('tool_input', {})
    if isinstance(tool_input, str):
        return

    file_path = tool_input.get('file_path', '')
    if not file_path:
        return

    # Check if this is a plugin file
    plugin_name = extract_plugin_name(file_path)
    if not plugin_name:
        return

    # Don't clear cache for dev-tools itself (avoid infinite loop on first edit)
    if plugin_name == 'dev-tools':
        return

    # Find and clear caches
    caches = find_cache_to_clear(plugin_name)
    if not caches:
        return

    cleared = clear_caches(caches)

    if cleared:
        # Output feedback - this will appear in hook results
        print(f"Plugin cache cleared for '{plugin_name}'. Restart Claude Code to apply changes.")


if __name__ == "__main__":
    main()
