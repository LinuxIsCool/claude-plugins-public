---
name: journal-linker
description: Manage wikilinks and backlinks in the journal. Use when creating connections between notes, building a knowledge graph, finding related entries, or maintaining link integrity.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Journal Linker

Manage [[wikilinks]] and backlinks to create a connected knowledge graph in the journal.

## When to Use

- Creating connections between notes
- Finding notes related to a topic
- Checking for broken links
- Building out the connection graph
- Discovering implicit connections

## Wikilink Syntax

### Basic Link
```markdown
[[note-title]]
```

### Link with Alias
```markdown
[[note-title|display text]]
```

### Link to Heading
```markdown
[[note-title#heading]]
```

### Block Reference
```markdown
[[note-title#^block-id]]
```

## Link Conventions

### Temporal Links
```markdown
[[2025]]              # Year
[[2025-12]]           # Month
[[2025-12-11]]        # Day
[[143022-my-idea]]    # Atomic note
```

### Hierarchical Links
Every entry should link to its parent:
- Daily → `[[YYYY-MM]]` and `[[YYYY]]`
- Monthly → `[[YYYY]]`
- Atomic → `[[YYYY-MM-DD]]`

### Thematic Links
Link to related concepts:
```markdown
Related: [[productivity]], [[planning]], [[retrospective]]
```

### See Also Section
```markdown
## See Also
- [[related-note-1]]
- [[related-note-2]]
```

## Link Management

### Adding Links to Existing Notes

When you discover a connection:
1. Read the source note
2. Add the link in appropriate section (Related, See Also, or inline)
3. Consider adding a backlink in the target note

### Backlink Pattern in Frontmatter

```yaml
---
links:
  - target: "[[other-note]]"
    context: "mentioned in discussion of X"
  - target: "[[another-note]]"
    context: "shares theme Y"
---
```

Or simpler:
```yaml
links: ["[[note-1]]", "[[note-2]]"]
```

### Finding Linkable Content

Search for mentions that should be links:

```bash
# Find mentions of a term that aren't already linked
grep -r "productivity" .claude/journal/ | grep -v "\[\[productivity\]\]"
```

### Checking for Broken Links

1. Extract all `[[...]]` patterns
2. Check if target files exist
3. Report missing targets

```bash
# Extract all wikilinks
grep -ohE '\[\[[^\]]+\]\]' .claude/journal/**/*.md | sort -u
```

## Link Discovery

### Implicit Connections

Find notes that mention similar concepts but aren't linked:

1. **Tag overlap**: Notes with same tags likely relate
2. **Temporal proximity**: Notes from same day/week
3. **Keyword matching**: Similar terms in content
4. **Project association**: Same project tag

### Suggested Links

When reading a note, suggest potential links based on:
- Mentioned dates → link to that date's daily note
- Mentioned projects → link to project notes
- Mentioned concepts → link to concept notes
- Mentioned people → link to people notes (if they exist)

## Link Visualization

### Manual Graph (in index.md)

```markdown
## Knowledge Graph

### Clusters
- **Planning**: [[weekly-planning]], [[monthly-goals]], [[annual-review]]
- **Projects**: [[project-a]], [[project-b]]
- **Learning**: [[book-notes]], [[course-notes]]

### Highly Connected
- [[productivity]] (15 links)
- [[reflection]] (12 links)
- [[planning]] (10 links)
```

### Obsidian Graph

The journal is Obsidian-compatible. Opening `.claude/journal/` in Obsidian provides:
- Visual graph view
- Automatic backlink tracking
- Local graph for each note

## Link Types

### Structural Links
- Parent/child (daily→monthly→yearly)
- Sequence (week 1→week 2)
- Index links

### Semantic Links
- Related concepts
- Contrasting ideas
- Examples/instances

### Temporal Links
- "Continued from [[previous-note]]"
- "See follow-up [[later-note]]"

### Reference Links
- Source citations
- External references

## Maintenance Tasks

### Weekly Link Audit
1. Review notes created this week
2. Check for orphan notes (no incoming links)
3. Add missing hierarchical links
4. Look for implicit connections to make explicit

### Monthly Link Health
1. Check for broken links
2. Identify highly connected vs isolated notes
3. Update index.md with recent additions
4. Review tag consistency

## Templates with Link Sections

### Standard Link Section
```markdown
## Links

### Related
- [[related-1]]
- [[related-2]]

### From
*Backlinks will appear here in Obsidian*
```

### Atomic Note Links
```markdown
---
*Links: [[YYYY-MM-DD]] | [[parent-concept]]*
```

## Workflow

### When Creating Notes
1. Add hierarchical link (to parent time period)
2. Add 1-3 semantic links (related concepts)
3. Update frontmatter `links` array

### When Editing Notes
1. Look for unlinkified mentions
2. Add relevant links inline
3. Update Related section if needed

### When Reviewing
1. Check orphan status
2. Strengthen weak connections
3. Break apart overly connected notes

## Commands

### Find Orphans
Notes with no incoming links:
```bash
# List all notes
# For each, check if any other note links to it
# Report those with zero incoming links
```

### Link Count
```bash
grep -ohE '\[\[[^\]]+\]\]' .claude/journal/**/*.md | sort | uniq -c | sort -rn
```

### Broken Links
Extract links, check existence, report missing.

## Notes

- Links create value through connection
- Prefer explicit links over implicit relationships
- Balance: not everything needs linking
- Orphan notes are opportunities, not failures
- The graph emerges over time - don't force it
