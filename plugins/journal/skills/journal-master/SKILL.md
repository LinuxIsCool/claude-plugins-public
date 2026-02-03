---
name: journal
description: Master skill for Obsidian-style journaling (6 sub-skills). Covers: journal-writer, journal-planner, journal-reflector, journal-browser, journal-linker, journal-aggregator. Invoke for daily entries, planning, reflection, searching entries, managing wikilinks, or generating summaries.
allowed-tools: Read, Write, Edit, Glob, Grep, Task
---

# Journal Plugin - Master Skill

Obsidian-style linked journaling with zettelkasten atomic notes.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **journal-writer** | Creating entries, daily/monthly/yearly, atomic notes, capturing thoughts | `subskills/journal-writer.md` |
| **journal-planner** | Planning, goals, intentions, roadmaps, forward-looking entries | `subskills/journal-planner.md` |
| **journal-reflector** | Reflection, retrospectives, lessons learned, reviews | `subskills/journal-reflector.md` |
| **journal-browser** | Searching entries, navigation, finding by date/tag | `subskills/journal-browser.md` |
| **journal-linker** | Wikilinks, backlinks, knowledge graph connections | `subskills/journal-linker.md` |
| **journal-aggregator** | Summaries, patterns, reports, synthesis across entries | `subskills/journal-aggregator.md` |

## Quick Selection Guide

| User Intent | Sub-Skill |
|-------------|-----------|
| "I want to journal" | journal-writer |
| "Let me plan/set goals" | journal-planner |
| "Time to reflect/review" | journal-reflector |
| "Find my old notes about..." | journal-browser |
| "Link these ideas together" | journal-linker |
| "Summarize this week/month" | journal-aggregator |

## Journal Structure

```
.claude/journal/
├── index.md                    # Master index
├── YYYY/
│   ├── YYYY.md                 # Yearly summary (synthesized)
│   └── MM/
│       ├── YYYY-MM.md          # Monthly summary (synthesized)
│       └── DD/
│           ├── YYYY-MM-DD.md   # Daily summary (synthesized)
│           └── HH-MM-title.md  # Atomic entries (PRIMARY)
```

**Key principle**: Atomic entries (`HH-MM-title.md`) are the PRIMARY unit.
Daily/monthly/yearly are SYNTHESIZED from atomics.

**Critical**: Entries MUST go in TODAY's date folder. Use current date, not event date.

## How to Use

### Quick Reference
Match user intent to sub-skill using the guide above.

### Deep Dive
```
Read: plugins/journal/skills/journal-master/subskills/{name}.md
```

## Sub-Skill Summaries

**journal-writer** - Create entries in .claude/journal/. Daily, monthly, yearly entries. Atomic zettelkasten notes. Obsidian-compatible markdown with wikilinks.

**journal-planner** - Forward-looking entries. Goals, intentions, roadmaps. Planning sessions. Future-oriented thinking.

**journal-reflector** - Backward-looking entries. Retrospectives, lessons learned. Reviews and introspection. Extract insights from experience.

**journal-browser** - Navigate and search the journal. Find entries by date, tag, or content. Browse structure. Overview of contents.

**journal-linker** - Manage wikilinks and backlinks. Build knowledge graph. Find related entries. Maintain link integrity.

**journal-aggregator** - Summarize over time periods. Extract patterns. Generate reports. Synthesize insights. Update index pages.
