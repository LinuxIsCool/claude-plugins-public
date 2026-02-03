# Wikilink Injector Sub-Skill

Automatic and manual wikilink injection for Obsidian graph connectivity.

## How Automatic Injection Works

The `PostToolUse` hook triggers on Write/Edit operations to:
- `.claude/journal/**/*.md`
- `.claude/planning/**/*.md`
- `.claude/logging/**/*.md`

### Injection Rules

#### Journal Files

**Daily entries** (`YYYY-MM-DD.md`):
```markdown
---
parent_monthly: [[2025-12]]
prev_day: [[2025-12-16]]
next_day: [[2025-12-18]]
---

... content ...

---
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

**Atomic entries** (`HH-MM-*.md`):
```markdown
---
parent_daily: [[2025-12-17]]
---

... content ...

---
*Parent: [[2025-12-17]] → [[2025-12]] → [[2025]]*
```

#### Planning Files
```markdown
... content with references ...

---
See also: [[2025-12-17]], [[related-topic]]
```

### Why Body Footer Matters

Obsidian's graph view **only crawls links in the body**, not frontmatter:
- `parent_daily: [[2025-12-17]]` in frontmatter → **NOT visible** in graph
- `*Parent: [[2025-12-17]]*` in body → **Visible** in graph

Always include the footer pattern for graph connectivity.

## Wikilink Syntax Reference

### Basic Links
```markdown
[[page-name]]              # Link to page-name.md
[[Page Name]]              # Link to "Page Name.md" (case-sensitive)
```

### Aliased Links
```markdown
[[page-name|Display Text]] # Shows "Display Text", links to page-name.md
[[2025-12-17|Today]]       # Shows "Today", links to daily entry
```

### Heading Links
```markdown
[[page-name#Section]]      # Links to specific heading
[[page-name#^blockid]]     # Links to specific block (if using block IDs)
```

### Path Links (Avoid)
```markdown
[[folder/subfolder/page]]  # Works but fragile - breaks on rename
```

Obsidian resolves links by filename across the vault, so paths are rarely needed.

## Manual Injection Patterns

### Cross-Referencing Entries
When an atomic entry discusses another session:
```markdown
Related work in [[13-00-log-archaeology-and-obsidian-command]].
```

### Concept Linking
When introducing a concept that deserves its own node:
```markdown
This follows the [[master-skill-pattern]] established in the awareness plugin.
```

### Temporal References
```markdown
Continued from [[2025-12-16]].
See [[2025-12]] monthly summary.
```

## Detection and Validation

### Find Missing Links
```bash
# Files without any wikilinks
grep -L '\[\[' .claude/journal/**/*.md
```

### Find Broken Links
```bash
# Extract all wikilink targets
grep -ohP '\[\[([^\]|]+)' .claude/journal/**/*.md | sort -u

# Compare against existing files
# (Obsidian shows broken links in red)
```

### Link Density Analysis
```bash
# Count links per file
for f in .claude/journal/**/*.md; do
  count=$(grep -o '\[\[' "$f" | wc -l)
  echo "$count $f"
done | sort -rn | head -20
```

## Hook Configuration

The PostToolUse hook in `plugin.json`:
```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit|NotebookEdit",
    "hooks": [{
      "type": "command",
      "command": "uv run ${CLAUDE_PLUGIN_ROOT}/hooks/wikilink_injector.py"
    }]
  }]
}
```

The hook receives tool context via stdin, including:
- `tool_name`: Which tool was used
- `tool_input`: File path and content
- `tool_response`: Success/failure

## Best Practices

1. **Always include body footer** for graph visibility
2. **Link to dates** (`[[2025-12-17]]`) not paths (`[[.claude/journal/...]]`)
3. **Create concept notes** for frequently referenced ideas
4. **Use aliases** for better readability: `[[technical-name|Human Name]]`
5. **Don't over-link** - link to related content, not every noun
