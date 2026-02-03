# Vault Health Sub-Skill

Audit Obsidian vault for broken links, orphan files, and structural issues.

## Health Checks

### 1. Broken Links

Links pointing to non-existent files:

```bash
#!/bin/bash
# Find all wikilink targets
targets=$(grep -rohP '\[\[([^\]|#]+)' .claude/journal/ | sed 's/\[\[//' | sort -u)

# Check each target
for target in $targets; do
  # Search for matching file
  found=$(find .claude/journal/ -name "${target}.md" -o -name "${target}" 2>/dev/null | head -1)
  if [ -z "$found" ]; then
    echo "BROKEN: [[${target}]]"
  fi
done
```

### 2. Orphan Files

Files with no incoming or outgoing links:

```bash
#!/bin/bash
# Find files with zero wikilinks
for f in .claude/journal/**/*.md; do
  count=$(grep -c '\[\[' "$f" 2>/dev/null || echo 0)
  if [ "$count" -eq 0 ]; then
    echo "ORPHAN: $f"
  fi
done
```

### 3. Missing Parent Links

Journal entries missing body footer:

```bash
# Check for missing parent footer
grep -L '\*Parent:' .claude/journal/**/*.md
```

### 4. Frontmatter Issues

Missing or malformed frontmatter:

```bash
# Files without frontmatter
for f in .claude/journal/**/*.md; do
  if ! head -1 "$f" | grep -q '^---'; then
    echo "NO FRONTMATTER: $f"
  fi
done
```

### 5. Naming Convention Violations

```bash
# Daily entries should be YYYY-MM-DD.md
find .claude/journal/ -name "*.md" | while read f; do
  basename=$(basename "$f" .md)
  dir=$(dirname "$f")

  # Check if in date folder
  if [[ "$dir" =~ /[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
    # Should be either YYYY-MM-DD or HH-MM-*
    if ! [[ "$basename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] && \
       ! [[ "$basename" =~ ^[0-9]{2}-[0-9]{2}- ]]; then
      echo "NAMING: $f"
    fi
  fi
done
```

## Health Report

Generate comprehensive health report:

```python
#!/usr/bin/env python3
"""Vault health checker."""

import re
from pathlib import Path
from collections import defaultdict

def check_vault_health(vault_path: str = ".claude/journal"):
    root = Path(vault_path)
    issues = defaultdict(list)

    # Collect all files and links
    files = set()
    links = defaultdict(list)  # target -> [source files]

    for md in root.rglob("*.md"):
        files.add(md.stem)
        content = md.read_text()

        # Check frontmatter
        if not content.startswith("---"):
            issues["no_frontmatter"].append(str(md))

        # Check parent footer
        if "*Parent:" not in content:
            issues["missing_footer"].append(str(md))

        # Extract links
        for match in re.finditer(r'\[\[([^\]|#]+)', content):
            target = match.group(1)
            links[target].append(str(md))

    # Check for broken links
    for target, sources in links.items():
        if target not in files:
            issues["broken_links"].append(f"[[{target}]] from {sources[0]}")

    # Check for orphans (no incoming links)
    linked_to = set(links.keys())
    for f in files:
        if f not in linked_to:
            # Also check if it has outgoing links
            # True orphan = no incoming AND no outgoing
            pass  # Simplified

    # Report
    print("=== Vault Health Report ===\n")
    for issue_type, items in issues.items():
        print(f"## {issue_type.replace('_', ' ').title()} ({len(items)})")
        for item in items[:10]:  # Limit output
            print(f"  - {item}")
        if len(items) > 10:
            print(f"  ... and {len(items) - 10} more")
        print()

    total = sum(len(v) for v in issues.values())
    print(f"Total issues: {total}")
    return issues

if __name__ == "__main__":
    check_vault_health()
```

## Automated Fixes

### Fix Missing Footers

```python
def add_missing_footer(file_path: Path):
    """Add parent footer to journal entry."""
    content = file_path.read_text()

    if "*Parent:" in content:
        return  # Already has footer

    # Parse date from path
    # .claude/journal/2025/12/17/file.md -> 2025-12-17
    parts = file_path.parts
    try:
        year, month, day = parts[-4], parts[-3], parts[-2]
        date = f"{year}-{month}-{day}"
        monthly = f"{year}-{month}"
        yearly = year
    except:
        return

    footer = f"\n\n---\n\n*Parent: [[{date}]] → [[{monthly}]] → [[{yearly}]]*\n"

    # Append footer
    file_path.write_text(content.rstrip() + footer)
```

### Fix Broken Wikilinks

When a link target doesn't exist, options:
1. **Create stub file** for the target
2. **Remove the link** if it was a typo
3. **Update link** to correct target

```python
def create_stub(target: str, vault_path: str = ".claude/journal"):
    """Create stub file for missing link target."""
    stub_path = Path(vault_path) / f"{target}.md"

    if stub_path.exists():
        return

    stub_content = f"""---
title: {target}
type: stub
created: {datetime.now().isoformat()}
---

# {target}

*This stub was auto-generated. Please add content.*

---

*Parent: [[index]]*
"""
    stub_path.write_text(stub_content)
```

## Integration with Agents

The `obsidian:vault-health` agent runs these checks and can:
1. Generate health report
2. Suggest fixes
3. Apply automated fixes (with confirmation)
4. Track health trends over time

## Best Practices

1. **Run health checks before Quartz builds** - broken links cause build warnings
2. **Fix orphans proactively** - they clutter the graph
3. **Maintain consistent naming** - makes automation reliable
4. **Always include footers** - critical for graph connectivity
