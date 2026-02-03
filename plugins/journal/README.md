# Journal Plugin

An Obsidian-style linked journal for Claude Code with zettelkasten atomic notes.

## Features

- **Temporal hierarchy**: Yearly, monthly, daily, and atomic timestamped entries
- **Wikilinks**: `[[note-title]]` linking between entries
- **YAML frontmatter**: Rich metadata for each entry type
- **Multiple journaling styles**: Stream of consciousness, bullet journal, structured reflection
- **Planning & reflection**: Dedicated skills for forward-looking and retrospective thinking
- **Aggregation**: Summarize patterns across time periods

## Directory Structure

```
.claude/journal/
├── index.md                      # Master index
├── 2025/
│   ├── 2025.md                   # Yearly note
│   ├── 12/
│   │   ├── 2025-12.md            # Monthly note
│   │   ├── 11/
│   │   │   ├── 2025-12-11.md     # Daily note
│   │   │   └── 143022-insight.md # Atomic note
```

## Entry Types

| Type | Format | Purpose |
|------|--------|---------|
| Yearly | `YYYY.md` | Vision, themes, annual retrospective |
| Monthly | `YYYY-MM.md` | Monthly goals, progress tracking |
| Daily | `YYYY-MM-DD.md` | Daily intentions, reflections |
| Atomic | `HHMMSS-title.md` | Zettelkasten atomic notes |

## Master Skill: `journal`

A single discoverable skill with 6 sub-skills loaded on-demand.

### Sub-Skills

| Sub-Skill | Purpose |
|-----------|---------|
| **journal-writer** | Create journal entries (daily, atomic, structured) |
| **journal-planner** | Planning-focused entries (goals, roadmaps, intentions) |
| **journal-reflector** | Reflection-focused entries (retrospectives, lessons learned) |
| **journal-linker** | Manage wikilinks and backlinks |
| **journal-aggregator** | Summarize patterns over time periods |
| **journal-browser** | Navigate and search the journal |

## Usage

```
/journal              # Start a journaling session
/journal daily        # Create/open today's daily note
/journal plan         # Planning session
/journal reflect      # Reflection session
```

## Obsidian Compatibility

Entries use standard Obsidian conventions:
- `[[wikilinks]]` for internal links
- `#tags` for categorization
- YAML frontmatter for metadata
- Backlinks tracked in frontmatter

Open `.claude/journal/` in Obsidian for a visual graph view of your thoughts.

## Plugin Directory Structure

```
journal/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   └── journal-master/          # Master skill (discoverable)
│       ├── SKILL.md             # Master skill definition
│       └── subskills/           # Sub-skills (loaded via Read)
│           ├── journal-writer.md
│           ├── journal-planner.md
│           ├── journal-reflector.md
│           ├── journal-linker.md
│           ├── journal-aggregator.md
│           └── journal-browser.md
├── commands/
│   └── journal.md               # /journal command
└── README.md
```
