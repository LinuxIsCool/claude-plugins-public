---
description: Start a journaling session or manage journal entries
argument-hint: "[daily|plan|reflect|browse|today|note <title>]"
---

# Journal Command

You are starting a journaling session. Today is !date.

## Arguments

The user invoked: `/journal $ARGUMENTS`

## Session Types

### No Arguments or "today" or "daily"
Open or create today's daily note.

1. Calculate today's date components
2. Ensure directory exists: `.claude/journal/YYYY/MM/DD/`
3. Check if daily note exists: `YYYY-MM-DD.md`
4. If exists, read it and offer to continue
5. If not, create from template with:
   - YAML frontmatter (date, type, tags, links)
   - Day-of-week header
   - Morning Intentions section
   - Log section
   - Evening Reflection section
   - Links to [[YYYY-MM]] and [[YYYY]]

### "plan"
Start a planning session.

1. Read today's daily note (or create it)
2. Ask: What are we planning for? (today, week, month, quarter, project)
3. Use journal-planner skill to guide the session
4. Create appropriate entry with planning template

### "reflect"
Start a reflection session.

1. Read today's daily note (or create it)
2. Ask: What are we reflecting on? (today, week, month, event, project)
3. Use journal-reflector skill to guide the session
4. Add reflection content to appropriate entry

### "browse"
Browse and search the journal.

1. Use journal-browser skill
2. Show recent entries, statistics, or search based on follow-up

### "note <title>"
Create an atomic note with the given title.

1. Generate timestamp (HHMMSS)
2. Slugify title (lowercase, hyphens)
3. Create file: `.claude/journal/YYYY/MM/DD/HHMMSS-slug.md`
4. Use atomic note template
5. Add backlink to today's daily note

### Month name (e.g., "december", "dec")
Open or create that month's note.

### Year (e.g., "2025")
Open or create that year's note.

## Workflow

1. Parse the argument to determine session type
2. Ensure required directory structure exists
3. Check for existing entries
4. Create or open appropriate files
5. Guide the user through the session
6. Maintain links between entries

## Examples

```
/journal              → Opens/creates today's daily note
/journal daily        → Same as above
/journal today        → Same as above
/journal plan         → Starts planning session
/journal reflect      → Starts reflection session
/journal browse       → Browse/search journal
/journal note idea    → Creates atomic note "HHMMSS-idea.md"
/journal december     → Opens December 2025 monthly note
/journal 2025         → Opens 2025 yearly note
```

## Directory Structure

Ensure the journal has this structure:
```
.claude/journal/
├── index.md           # Create if missing
├── YYYY/
│   ├── YYYY.md        # Yearly note
│   ├── MM/
│   │   ├── YYYY-MM.md # Monthly note
│   │   ├── DD/
│   │   │   ├── YYYY-MM-DD.md    # Daily note
│   │   │   └── HHMMSS-title.md  # Atomic notes
```

## Templates

Use the templates defined in journal-writer skill for:
- Daily notes
- Monthly notes
- Yearly notes
- Atomic notes
- Index

## Initialization

If this is the first use (no `.claude/journal/` directory):
1. Create the directory structure
2. Create index.md
3. Create this year's yearly note
4. Create this month's monthly note
5. Create today's daily note
6. Welcome the user to their new journal

## Notes

- Always use ISO 8601 dates (YYYY-MM-DD)
- Timestamps in 24-hour format (HHMMSS)
- Maintain [[wikilinks]] for navigation
- Obsidian-compatible format
- One idea per atomic note
