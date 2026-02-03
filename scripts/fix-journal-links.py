#!/usr/bin/env python3
"""
Fix journal parent links to only link one level up.

Changes:
- Atomic entries (HH-MM-*.md): *Parent: [[YYYY-MM-DD]]*
- Daily entries (YYYY-MM-DD.md): *Parent: [[YYYY-MM]]*
- Monthly entries (YYYY-MM.md): *Parent: [[YYYY]]*
- Yearly entries: no parent link

Also fixes *Children: lines to not include parent refs.
"""

import re
from pathlib import Path

JOURNAL_ROOT = Path(".claude/journal")

def get_entry_type(filepath: Path) -> str:
    """Determine entry type from filename."""
    name = filepath.name

    # Yearly: YYYY.md (exactly 4 digits)
    if re.match(r'^\d{4}\.md$', name):
        return 'yearly'

    # Monthly: YYYY-MM.md (7 chars)
    if re.match(r'^\d{4}-\d{2}\.md$', name):
        return 'monthly'

    # Daily: YYYY-MM-DD.md (10 chars)
    if re.match(r'^\d{4}-\d{2}-\d{2}\.md$', name):
        return 'daily'

    # Atomic: HH-MM-*.md
    if re.match(r'^\d{2}-\d{2}-.+\.md$', name):
        return 'atomic'

    return 'unknown'

def get_parent_date(filepath: Path, entry_type: str) -> str:
    """Extract the appropriate parent date from filepath."""
    parts = filepath.parts

    if entry_type == 'atomic':
        # Parent is daily: YYYY-MM-DD from path .../YYYY/MM/DD/
        # Find the date parts from path
        for i, part in enumerate(parts):
            if re.match(r'^\d{4}$', part) and i + 2 < len(parts):
                year = part
                month = parts[i + 1]
                day = parts[i + 2]
                if re.match(r'^\d{2}$', month) and re.match(r'^\d{2}$', day):
                    return f"{year}-{month}-{day}"
        return None

    elif entry_type == 'daily':
        # Parent is monthly: YYYY-MM
        match = re.match(r'^(\d{4})-(\d{2})-\d{2}\.md$', filepath.name)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return None

    elif entry_type == 'monthly':
        # Parent is yearly: YYYY
        match = re.match(r'^(\d{4})-\d{2}\.md$', filepath.name)
        if match:
            return match.group(1)
        return None

    return None

def fix_parent_line(content: str, entry_type: str, parent_date: str) -> str:
    """Fix the *Parent: line in content."""

    if entry_type == 'yearly':
        # Remove parent line entirely for yearly
        content = re.sub(r'\n?\*Parent:.*\*\n?', '\n', content)
        return content

    if not parent_date:
        return content

    # Pattern to match various parent line formats
    parent_patterns = [
        r'\*Parent:\s*\[\[.+?\]\](?:\s*→\s*\[\[.+?\]\])*\s*\*',  # *Parent: [[x]] → [[y]] → [[z]]*
        r'\*Parent:\s*\[\[.+?\]\](?:\s*->\s*\[\[.+?\]\])*\s*\*',  # *Parent: [[x]] -> [[y]] -> [[z]]*
    ]

    new_parent = f"*Parent: [[{parent_date}]]*"

    for pattern in parent_patterns:
        if re.search(pattern, content):
            content = re.sub(pattern, new_parent, content)
            return content

    return content

def fix_children_line(content: str) -> str:
    """Remove parent references from *Children: lines."""
    # Pattern: *Children: [[...]]* where it includes parent refs
    # We want to keep only the actual children links

    # This is less common, but clean up if present
    # Just remove the whole line pattern that has parent arrows
    content = re.sub(r'\*Children:.*→.*\*\n?', '', content)

    return content

def process_file(filepath: Path, dry_run: bool = False) -> tuple[bool, str]:
    """Process a single journal file. Returns (changed, message)."""

    entry_type = get_entry_type(filepath)
    if entry_type == 'unknown':
        return False, f"SKIP (unknown type): {filepath.name}"

    parent_date = get_parent_date(filepath, entry_type)

    try:
        content = filepath.read_text()
        original = content

        # Fix parent line
        content = fix_parent_line(content, entry_type, parent_date)

        # Fix children line if needed
        content = fix_children_line(content)

        if content != original:
            if not dry_run:
                filepath.write_text(content)
            return True, f"FIXED ({entry_type}): {filepath.name} -> parent: {parent_date}"
        else:
            return False, f"OK ({entry_type}): {filepath.name}"

    except Exception as e:
        return False, f"ERROR: {filepath.name}: {e}"

def main():
    """Main entry point."""
    import sys

    dry_run = '--dry-run' in sys.argv
    verbose = '--verbose' in sys.argv or '-v' in sys.argv

    if dry_run:
        print("DRY RUN - no files will be modified\n")

    # Find all journal files (exclude nested .claude directories)
    journal_files = []
    for md_file in JOURNAL_ROOT.rglob("*.md"):
        # Skip files in nested .claude directories (logging artifacts)
        rel_path = md_file.relative_to(JOURNAL_ROOT)
        if '.claude' in str(rel_path):
            continue
        journal_files.append(md_file)

    print(f"Found {len(journal_files)} journal files\n")

    fixed_count = 0
    for filepath in sorted(journal_files):
        changed, message = process_file(filepath, dry_run)
        if changed:
            fixed_count += 1
            print(f"  {message}")
        elif verbose:
            print(f"  {message}")

    print(f"\n{'Would fix' if dry_run else 'Fixed'}: {fixed_count} files")

if __name__ == "__main__":
    main()
