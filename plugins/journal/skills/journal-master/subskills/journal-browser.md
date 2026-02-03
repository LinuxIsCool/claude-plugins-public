---
name: journal-browser
description: Navigate, search, and explore the journal. Use when looking for past entries, searching content, finding entries by date or tag, browsing the journal structure, or getting an overview of journal contents.
allowed-tools: Read, Glob, Grep, Bash
---

# Journal Browser

Navigate, search, and explore the journal to find past entries, discover patterns, and understand journal contents.

## When to Use

- Looking for a past entry
- Searching for content by keyword
- Finding entries by date or tag
- Browsing journal structure
- Getting an overview of contents
- Finding recent activity

## Browse Operations

### List Recent Entries

```bash
# Most recently modified files
ls -lt .claude/journal/**/*.md | head -20

# Today's entries
ls .claude/journal/$(date +%Y)/$(date +%m)/$(date +%d)/

# This week's daily notes
find .claude/journal/$(date +%Y)/$(date +%m)/ -name "*.md" -mtime -7
```

### View Journal Structure

```bash
# Tree view
tree .claude/journal/ -L 3

# Count entries by type
find .claude/journal/ -name "*.md" | wc -l
```

### Get Statistics

```markdown
## Journal Statistics

- **Total entries**: [count]
- **Daily notes**: [count]
- **Monthly notes**: [count]
- **Yearly notes**: [count]
- **Atomic notes**: [count]
- **Date range**: [first] to [last]
- **Most active month**: [month]
```

## Search Operations

### Keyword Search

```bash
# Basic search
grep -r "keyword" .claude/journal/

# Case insensitive
grep -ri "keyword" .claude/journal/

# With context
grep -ri -C 2 "keyword" .claude/journal/

# Files only
grep -rl "keyword" .claude/journal/
```

### Tag Search

```bash
# Find all entries with a tag
grep -rl "#planning" .claude/journal/

# Find entries with multiple tags
grep -rl "#planning" .claude/journal/ | xargs grep -l "#reflection"
```

### Date Search

```bash
# Specific date
cat .claude/journal/2025/12/11/2025-12-11.md

# Date range (all December)
ls .claude/journal/2025/12/**/*.md

# Specific week
ls .claude/journal/2025/12/0[8-9]/*.md .claude/journal/2025/12/1[0-4]/*.md
```

### Type Search

```bash
# Find daily notes
grep -rl "type: daily" .claude/journal/

# Find atomic notes
grep -rl "type: atomic" .claude/journal/

# Find reflections
grep -rl "#reflection" .claude/journal/
```

### Link Search

```bash
# Find notes linking to a specific note
grep -rl "\[\[2025-12-11\]\]" .claude/journal/

# Find all wikilinks
grep -ohE '\[\[[^\]]+\]\]' .claude/journal/**/*.md | sort -u
```

## Navigation Patterns

### Today's Context

1. Open today's daily note
2. List atomic notes from today
3. Show linked entries

### Week Overview

1. List this week's daily notes
2. Show completed items
3. Summarize themes

### Month Overview

1. Open monthly note
2. List all daily notes
3. Count atomic notes
4. Show tag distribution

### Search by Memory

"I wrote something about X last week"
1. Search for keywords
2. Filter by date range
3. Show context

## Query Examples

### Recent Activity

```bash
# What did I write about this week?
find .claude/journal/$(date +%Y)/$(date +%m)/ -name "*.md" -mtime -7 -exec basename {} \;
```

### Find Related

```bash
# All notes mentioning "productivity"
grep -rl "productivity" .claude/journal/ | head -10
```

### Track a Project

```bash
# All entries tagged with project
grep -rl "#project/alpha" .claude/journal/
```

### Review Decisions

```bash
# Find decision entries
grep -rl "## Decision:" .claude/journal/
```

### Find Questions

```bash
# Entries with open questions
grep -rl "?" .claude/journal/ | xargs grep -l "#question"
```

## Output Formats

### Simple List

```markdown
## Search Results: "keyword"

1. [[2025-12-11]] - Daily note mentioning keyword
2. [[143022-idea]] - Atomic note about keyword
3. [[2025-12]] - Monthly note with keyword in goals
```

### With Context

```markdown
## Search Results: "keyword"

### [[2025-12-11]]
> ...context around **keyword** match...

### [[143022-idea]]
> ...another match with **keyword**...
```

### Structured Query Result

```markdown
## Query: Tag #planning, Date December 2025

| Date | Title | Type |
|------|-------|------|
| 2025-12-01 | Week 48 Plan | atomic |
| 2025-12-08 | Week 49 Plan | atomic |
| 2025-12-11 | Daily note | daily |
```

## Common Queries

### "What did I do yesterday?"
1. Get yesterday's date
2. Open yesterday's daily note
3. List atomic notes from yesterday

### "What are my current goals?"
1. Open this month's monthly note
2. Read Goals section
3. Check progress indicators

### "What did I learn recently?"
1. Search for `## What I Learned` or `#learning`
2. Filter to last 7-30 days
3. List findings

### "How was my mood this week?"
1. Read daily notes from this week
2. Extract mood/energy data
3. Summarize pattern

### "What's linked to X?"
1. Search for `[[X]]`
2. List all files containing link
3. Show context of each link

## Tips

### Speed Up Search
- Use `grep -l` to list files only (faster)
- Narrow path when you know timeframe
- Use `head` to limit results

### Find Patterns
- Search for section headers (`## Lessons`)
- Search for frontmatter fields (`mood:`)
- Combine searches with pipes

### Navigate Efficiently
- Start with index.md
- Use temporal hierarchy (year→month→day)
- Follow wikilinks

## Integration

### With Aggregator
Found relevant entries → aggregate into summary

### With Linker
Found related entries → create explicit links

### With Reflector
Found past entries → use in reflection

## Notes

- Search is for finding, aggregation is for synthesizing
- Good file naming makes browsing easier
- Tags enable powerful filtering
- Consistent structure enables consistent queries
- The journal grows in value as it grows in size
