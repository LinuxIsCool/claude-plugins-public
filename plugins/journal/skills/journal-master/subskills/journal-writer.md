---
name: journal-writer
description: Create atomic journal entries in .claude/journal/. Atomic entries are the PRIMARY unit—daily/monthly/yearly notes are SYNTHESIZED from atomics. Each atomic entry has mandatory author and relational fields for DNA-spiral graph rendering.
allowed-tools: Read, Write, Edit, Glob, Bash
---

# Journal Writer

Create atomic journal entries in `.claude/journal/` using Obsidian-compatible markdown. Atomic entries are the **primary unit**—higher-level summaries (daily, monthly, yearly) are synthesized from atomics.

## Core Principle: Atomic First

```
Atomic entries (primary)
    ↓ synthesize into
Daily summaries
    ↓ synthesize into
Monthly summaries
    ↓ synthesize into
Yearly summaries
```

**You don't write daily entries—you write atomic entries that get synthesized into daily summaries.**

## Directory Structure

```
.claude/journal/
├── index.md
├── YYYY/
│   ├── YYYY.md                    # Synthesized from monthlies
│   └── MM/
│       ├── YYYY-MM.md             # Synthesized from dailies
│       └── DD/
│           ├── YYYY-MM-DD.md      # Synthesized from atomics
│           ├── HH-MM-title.md     # Atomic entry (PRIMARY)
│           ├── HH-MM-title.md     # Atomic entry
│           └── ...
```

## Atomic Entry Template (PRIMARY)

**Filename**: `HH-MM-slugified-title.md` (e.g., `14-30-subagent-exploration.md`)

```markdown
---
id: YYYY-MM-DD-HHMM
title: "Entry Title"
type: atomic
created: YYYY-MM-DDTHH:MM:SS
author: agent-name-or-user        # MANDATORY: who wrote this
description: "Brief description"   # MANDATORY: one-line summary
tags: [tag1, tag2]
parent_daily: [[YYYY-MM-DD]]       # MANDATORY: links UP to daily
related: []                        # Other atomic entries this connects to
---

# Entry Title

[Content - one focused idea/moment/discovery per entry]

## Context

[What prompted this entry]

## Insights

[Key takeaways]

---
*Parent: [[YYYY-MM-DD]]*
```

### Mandatory Fields for Atomic Entries

| Field | Purpose | Example |
|-------|---------|---------|
| `created` | **When file was created** (NOT event time) | `2025-12-15T14:30:00` |
| `author` | Who/what created this entry | `claude-opus-4`, `user`, `backend-architect` |
| `title` | Entry title | `"Subagent Exploration"` |
| `description` | One-line summary | `"Discovered CLI supports custom system prompts"` |
| `tags` | Categorization | `[subagents, cli, discovery]` |
| `parent_daily` | Link UP to **TODAY's** daily note | `[[2025-12-15]]` |
| `related` | Links to related atomics | `[[14-45-agent-architecture]]` |

### Optional Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `references_date` | Date of event being documented (if different from created) | `2025-12-13` |
| `session` | Session ID for traceability | `2025-12-15-10-30-abc123` |

## Daily Note Template (SYNTHESIZED)

Daily notes are synthesized from atomic entries, not written directly.

```markdown
---
date: YYYY-MM-DD
type: daily
created: YYYY-MM-DDTHH:MM:SS
synthesized: true
parent_monthly: [[YYYY-MM]]
prev_day: [[YYYY-MM-DD]]              # TEMPORAL NAV: yesterday's date
next_day: [[YYYY-MM-DD]]              # TEMPORAL NAV: tomorrow's date
children:
  - [[HH-MM-title]]
  - [[HH-MM-title]]
tags: [daily]
---

# YYYY-MM-DD Day-of-Week

← [[YYYY-MM-DD]] · **[[YYYY-MM]]** · [[YYYY-MM-DD]] →

---

## Summary

[Synthesized from atomic entries below]

## Atomic Entries

- [[HH-MM-first-entry]] — description
- [[HH-MM-second-entry]] — description
- ...

## Themes

[Patterns across today's atomics]

---
*Parent: [[YYYY-MM]]*
```

## Monthly Note Template (SYNTHESIZED)

```markdown
---
month: YYYY-MM
type: monthly
created: YYYY-MM-DDTHH:MM:SS
synthesized: true
parent_yearly: [[YYYY]]
prev_month: [[YYYY-MM]]               # TEMPORAL NAV: previous month
next_month: [[YYYY-MM]]               # TEMPORAL NAV: next month
children:
  - [[YYYY-MM-DD]]
  - [[YYYY-MM-DD]]
tags: [monthly]
themes: []
---

# YYYY Month-Name

← [[YYYY-MM]] · **[[YYYY]]** · [[YYYY-MM]] →

---

## Summary

[Synthesized from daily notes]

## Daily Notes

- [[YYYY-MM-DD]] — summary
- [[YYYY-MM-DD]] — summary

## Themes

[Patterns across the month]

## Key Atomics

[Standout atomic entries worth highlighting]

---
*Parent: [[YYYY]]*
```

## Yearly Note Template (SYNTHESIZED)

```markdown
---
year: YYYY
type: yearly
created: YYYY-MM-DDTHH:MM:SS
synthesized: true
prev_year: [[YYYY]]                   # TEMPORAL NAV: previous year
next_year: [[YYYY]]                   # TEMPORAL NAV: next year
children:
  - [[YYYY-MM]]
  - [[YYYY-MM]]
tags: [yearly]
themes: []
---

# YYYY

← [[YYYY]] · [[YYYY]] →

---

## Summary

[Synthesized from monthly notes]

## Monthly Notes

- [[YYYY-01]] — summary
- [[YYYY-02]] — summary
- ...

## Themes

[Patterns across the year]

```

## The DNA Spiral Effect

When rendered in Obsidian's force-directed graph:

```
                    ╭──── [[2025]] ────╮
                   ╱                    ╲
           [[2025-11]]              [[2025-12]]
              │                          │
    ╭─────────┼─────────╮      ╭─────────┼─────────╮
    │         │         │      │         │         │
[[12]]    [[13]]    [[14]]  [[12]]    [[13]]    [[14]]
   │╲        │╲        │      │         │╲
   │ ╲       │ ╲       │      │         │ ╲
  ⚫ ⚫     ⚫ ⚫     ⚫      ⚫        ⚫ ⚫ ⚫
  atomics   atomics  atomic  atomic    atomics

The bidirectional links (child→parent, parent→child) create
the spiral/helix structure in force-directed layout.
```

## Creating Entries

### CRITICAL: Use TODAY's Date

**Entries ALWAYS go in TODAY's folder**, regardless of what you're writing about.

```bash
# ALWAYS get current date for the folder path
TODAY=$(date +%Y/%m/%d)        # e.g., 2025/12/15
DAILY_DATE=$(date +%Y-%m-%d)   # e.g., 2025-12-15
NOW=$(date +%H-%M)             # e.g., 14-30
```

### Create Atomic Entry (Primary Action)

```bash
# 1. Get current date/time (MUST use actual current values)
TODAY=$(date +%Y/%m/%d)
NOW=$(date +%H-%M)
title_slug="subagent-exploration"
filename="${NOW}-${title_slug}.md"

# 2. Create directory if it doesn't exist (IMPORTANT!)
mkdir -p ".claude/journal/${TODAY}"

# 3. Create file path using TODAY's date
path=".claude/journal/${TODAY}/${filename}"

# 4. Create with mandatory fields
# - created: NOW (when file is created, not event time)
# - author: who is writing
# - description: one line
# - parent_daily: link UP (using today's date)
# - tags
```

### Documenting Past Events

If you're writing about something that happened on a different day:
- **File location**: Still use TODAY's folder
- **`created` field**: Use NOW (actual file creation time)
- **Add `references_date` field**: The date the event occurred
- **In content**: Mention "On [date], ..." or "Reflecting on [date]..."

```yaml
---
created: 2025-12-15T10:30:00     # When this file was created
references_date: 2025-12-13      # When the event happened
title: "Reflection on Dec 13 Architecture"
---
```

This preserves temporal accuracy while keeping the journal structure correct.

### Synthesize Daily from Atomics

```python
# 1. List all atomics in day directory
atomics = glob(".claude/journal/2025/12/13/[0-9][0-9]-[0-9][0-9]-*.md")

# 2. Read each atomic's frontmatter
# 3. Generate summary from descriptions
# 4. Create daily note with children list
# 5. Link each atomic's parent_daily to this daily
```

### Synthesize Monthly from Dailies

```python
# 1. List all daily notes in month
dailies = glob(".claude/journal/2025/12/*/YYYY-MM-DD.md")

# 2. Read each daily's summary
# 3. Generate monthly summary
# 4. Create monthly note with children list
```

## Relational Fields

### Upward Links (Mandatory)

| Entry Type | Links To | Field |
|------------|----------|-------|
| Atomic | Daily | `parent_daily: [[YYYY-MM-DD]]` |
| Daily | Monthly | `parent_monthly: [[YYYY-MM]]` |
| Monthly | Yearly | `parent_yearly: [[YYYY]]` |

### Temporal Navigation Links (Mandatory for Summary Notes)

| Entry Type | Previous | Next |
|------------|----------|------|
| Daily | `prev_day: [[YYYY-MM-DD]]` | `next_day: [[YYYY-MM-DD]]` |
| Monthly | `prev_month: [[YYYY-MM]]` | `next_month: [[YYYY-MM]]` |
| Yearly | `prev_year: [[YYYY]]` | `next_year: [[YYYY]]` |

**Notes**:
- Links to non-existent notes are valid (Obsidian will show them as unresolved)
- Handle month/year boundaries: Dec 31 links to Jan 1 of next year
- These links enable keyboard-style navigation through time

**IMPORTANT**: Temporal nav links MUST appear in the body content, not just frontmatter!
- Graph visualizers (Quartz, Obsidian) only crawl links in the body
- Frontmatter fields are metadata, not navigable links
- Use the nav bar pattern: `← [[prev]] · **[[parent]]** · [[next]] →`

### Downward Links (In Synthesis)

| Entry Type | Lists | Field |
|------------|-------|-------|
| Yearly | Monthlies | `children: [[[YYYY-MM]], ...]` |
| Monthly | Dailies | `children: [[[YYYY-MM-DD]], ...]` |
| Daily | Atomics | `children: [[[HH-MM-title]], ...]` |

### Horizontal Links (Optional)

Atomics can link to related atomics:
```yaml
related:
  - [[14-45-agent-architecture]]
  - [[15-20-process-mapping]]
```

## Workflow

### Writing (Create Atomics)

1. **Capture thought** → Create atomic entry
2. **Mandatory fields**: author, created, description, parent_daily, tags
3. **One idea per entry** (zettelkasten principle)
4. **Link related atomics** in `related` field

### Synthesis (Aggregate Up)

1. **End of day**: Synthesize atomics → daily
2. **End of month**: Synthesize dailies → monthly
3. **End of year**: Synthesize monthlies → yearly
4. **Update children lists** in parent notes

## Author Field Values

| Author | When to Use |
|--------|-------------|
| `user` | User wrote this directly |
| `claude-opus-4` | Opus model in Claude Code |
| `claude-sonnet` | Sonnet model |
| `backend-architect` | Agent persona reflection |
| `systems-thinker` | Agent persona reflection |
| `process-cartographer` | Process mapping agent |
| `{agent-name}` | Any custom agent |

## Tags

Common tags:
- `#atomic`, `#daily`, `#monthly`, `#yearly`
- `#discovery`, `#insight`, `#decision`, `#question`
- `#agent/{name}`, `#project/{name}`, `#theme/{name}`

## Notes

- **Atomic first**: Always create atomics; synthesize summaries later
- **HH-MM format**: Use hyphens for readability (`14-30`, not `1430`)
- **Slugify titles**: lowercase, hyphens, no special chars
- **One idea per atomic**: Keep entries focused
- **Link liberally**: Connections create the DNA spiral
- **Author is mandatory**: Track provenance

## Common Mistakes (AVOID THESE)

### 1. Wrong Date Folder
```
❌ WRONG: Writing on Dec 15 but putting file in .claude/journal/2025/12/13/
✅ RIGHT: Always use TODAY's date: .claude/journal/2025/12/15/
```

### 2. Backdating `created` Field
```
❌ WRONG: created: 2025-12-13T17:00:00 (when actually writing on Dec 15)
✅ RIGHT: created: 2025-12-15T10:30:00 (actual creation time)
         references_date: 2025-12-13 (if documenting past event)
```

### 3. Wrong `parent_daily` Link
```
❌ WRONG: parent_daily: [[2025-12-13]] (when file is in 2025/12/15/)
✅ RIGHT: parent_daily: [[2025-12-15]] (matches folder location)
```

### 4. Inconsistent Filename Format
```
❌ WRONG: 151500-title.md (HHMMSS format)
✅ RIGHT: 15-15-title.md (HH-MM format with hyphens)
```

### 5. Forgetting to Create Directory
```bash
# Always ensure directory exists before writing
mkdir -p ".claude/journal/$(date +%Y/%m/%d)"
```

### Pre-Flight Checklist

Before creating a journal entry:
1. [ ] `TODAY=$(date +%Y/%m/%d)` - Get current date
2. [ ] `mkdir -p ".claude/journal/${TODAY}"` - Ensure folder exists
3. [ ] Filename uses `HH-MM-title.md` format
4. [ ] `created` field uses actual NOW timestamp
5. [ ] `parent_daily` matches the folder's date
6. [ ] If documenting past event, add `references_date` field
7. [ ] **Footer present**: End with `*Parent: [[YYYY-MM-DD]]*` (one level up only)

### Body Links for Graph Connectivity

**CRITICAL**: Wikilinks in YAML frontmatter are NOT crawled by graph visualizers.

For full graph connectivity, ensure these appear in the **body** (not just frontmatter):

| Entry Type | Body Requirement |
|------------|------------------|
| Atomic | Footer: `*Parent: [[YYYY-MM-DD]]*` |
| Daily | Nav bar: `← [[prev-day]] · **[[YYYY-MM]]** · [[next-day]] →` |
| Daily | Footer: `*Parent: [[YYYY-MM]]*` |
| Monthly | Nav bar: `← [[prev-month]] · **[[YYYY]]** · [[next-month]] →` |
| Monthly | Footer: `*Parent: [[YYYY]]*` |
| Yearly | Nav bar: `← [[prev-year]] · [[next-year]] →` (no parent) |

**Principle**: Each entry links only ONE level up. The graph connectivity flows through the hierarchy:
```
atomic → daily → monthly → yearly
```

Without body links, entries appear as isolated nodes in Quartz/Obsidian graphs.
