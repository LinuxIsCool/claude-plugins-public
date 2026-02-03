#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Automatic wikilink injection for Obsidian graph connectivity.

PostToolUse hook that injects parent wikilinks into journal entries
when Write/Edit tools modify files in .claude/journal/, .claude/planning/,
or .claude/logging/.

Key insight: Obsidian graph view only crawls links in the body, not frontmatter.
So we inject a footer pattern that's both human-readable and graph-visible:

    ---
    *Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path


def parse_date_from_path(file_path: Path) -> tuple[str, str, str] | None:
    """Extract year, month, day from journal path structure.

    Expected: .claude/journal/YYYY/MM/DD/filename.md
    Returns: (year, month, day) or None if not a dated path
    """
    parts = file_path.parts

    # Find the pattern YYYY/MM/DD in the path
    for i, part in enumerate(parts):
        if re.match(r'^\d{4}$', part) and i + 2 < len(parts):
            year = part
            month = parts[i + 1] if re.match(r'^\d{2}$', parts[i + 1]) else None
            day = parts[i + 2] if month and re.match(r'^\d{2}$', parts[i + 2]) else None

            if year and month and day:
                return (year, month, day)

    return None


def is_daily_entry(file_path: Path, year: str, month: str, day: str) -> bool:
    """Check if file is a daily entry (YYYY-MM-DD.md)."""
    expected_name = f"{year}-{month}-{day}.md"
    return file_path.name == expected_name


def is_atomic_entry(file_path: Path) -> bool:
    """Check if file is an atomic entry (HH-MM-*.md)."""
    return bool(re.match(r'^\d{2}-\d{2}-', file_path.name))


def build_footer(year: str, month: str, day: str) -> str:
    """Build the parent wikilink footer."""
    date_link = f"{year}-{month}-{day}"
    month_link = f"{year}-{month}"
    year_link = year

    return f"\n---\n\n*Parent: [[{date_link}]] → [[{month_link}]] → [[{year_link}]]*\n"


def has_footer(content: str) -> bool:
    """Check if content already has a parent footer."""
    # Match the exact footer pattern: *Parent: [[YYYY-MM-DD]] → [[YYYY-MM]] → [[YYYY]]*
    return bool(re.search(r'\*Parent: \[\[\d{4}-\d{2}-\d{2}\]\] → \[\[\d{4}-\d{2}\]\] → \[\[\d{4}\]\]\*', content))


def inject_wikilinks(file_path: Path) -> bool:
    """Inject wikilinks into a journal file if needed.

    Returns True if file was modified, False otherwise.
    """
    if not file_path.exists():
        return False

    if file_path.suffix != '.md':
        return False

    # Only process journal, planning, logging files
    path_str = str(file_path)
    if not any(marker in path_str for marker in ['.claude/journal/', '.claude/planning/', '.claude/logging/']):
        return False

    content = file_path.read_text()

    # Already has footer
    if has_footer(content):
        return False

    # Parse date from path
    date_parts = parse_date_from_path(file_path)
    if not date_parts:
        return False

    year, month, day = date_parts

    # Build and append footer
    footer = build_footer(year, month, day)

    # Remove trailing whitespace, add footer
    new_content = content.rstrip() + footer

    file_path.write_text(new_content)
    return True


def get_file_path_from_tool_input(data: dict) -> Path | None:
    """Extract file path from PostToolUse data."""
    tool_input = data.get('tool_input', {})

    # Handle string input (shouldn't happen for Write/Edit but be safe)
    if isinstance(tool_input, str):
        return None

    # Write tool uses 'file_path'
    # Edit tool uses 'file_path'
    # NotebookEdit uses 'notebook_path'
    for key in ('file_path', 'notebook_path'):
        if key in tool_input:
            return Path(tool_input[key])

    return None


def main():
    """PostToolUse hook entry point."""
    # Read hook data from stdin
    try:
        raw = sys.stdin.read()
        if not raw:
            return
        data = json.loads(raw)
    except (json.JSONDecodeError, IOError):
        return

    # Only process successful tool uses
    tool_response = data.get('tool_response', {})
    if isinstance(tool_response, dict) and tool_response.get('is_error'):
        return

    # Get the file that was modified
    file_path = get_file_path_from_tool_input(data)
    if not file_path:
        return

    # Inject wikilinks
    modified = inject_wikilinks(file_path)

    # Silent success - no output to avoid consuming context
    if modified:
        # Could log to a file if debugging needed
        pass


if __name__ == "__main__":
    main()
