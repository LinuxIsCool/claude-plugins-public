---
name: journal-aggregator
description: Aggregate and summarize journal entries over time periods. Use when creating summaries, extracting patterns, generating reports, synthesizing insights across entries, or updating index pages.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Journal Aggregator

Aggregate and summarize journal entries to extract patterns, generate reports, and synthesize insights across time periods.

## When to Use

- Creating summaries of a time period
- Extracting patterns from journal entries
- Generating reports or overviews
- Synthesizing insights across multiple entries
- Updating index pages
- Preparing for reflection sessions

## Aggregation Types

### 1. Timeline Aggregation

Chronological summary of what happened.

```markdown
## December 2025 Timeline

### Week 49 (Dec 1-7)
- **Dec 1**: Started project X, met with team
- **Dec 3**: Completed milestone 1
- **Dec 5**: Weekly review - feeling productive

### Week 50 (Dec 8-14)
- **Dec 8**: ...
```

### 2. Theme Aggregation

Group entries by topic or theme.

```markdown
## Themes in Q4 2025

### Productivity
- [[2025-10-15]]: Discovered time-blocking technique
- [[2025-11-02]]: Experimented with Pomodoro
- [[2025-12-01]]: Settled on hybrid approach

### Learning
- [[2025-10-22]]: Started Rust course
- [[2025-11-15]]: Completed first project
- [[2025-12-10]]: Reflections on progress

### Health
- ...
```

### 3. Highlights Aggregation

Best moments and key achievements.

```markdown
## 2025 Highlights

### Professional
1. Launched project X (March)
2. Promoted to senior role (June)
3. Completed certification (September)

### Personal
1. Traveled to Japan (April)
2. Ran first marathon (August)
3. Started meditation habit (October)

### Learning
1. Mastered TypeScript
2. Read 24 books
3. Learned basic Japanese
```

### 4. Lessons Aggregation

What was learned over time.

```markdown
## Lessons Learned - 2025

### About Work
1. "Deep work requires boundaries" - [[2025-03-15]]
2. "Meetings should be last resort" - [[2025-06-22]]

### About Life
1. "Sleep is non-negotiable" - [[2025-02-10]]
2. "Relationships require presence" - [[2025-08-05]]

### About Learning
1. "Consistency beats intensity" - [[2025-04-18]]
```

### 5. Progress Aggregation

Tracking metrics and goals over time.

```markdown
## Q4 Goal Progress

| Goal | Oct | Nov | Dec | Status |
|------|-----|-----|-----|--------|
| Read 3 books | 1 | 1 | 1 | ✅ |
| Exercise 4x/week | 3.5 | 4.2 | 3.8 | ⚠️ |
| Ship feature X | 30% | 70% | 100% | ✅ |

### Trend Analysis
- Exercise consistency improving
- Reading on track
- Feature X completed ahead of schedule
```

### 6. Mood/Energy Aggregation

Patterns in emotional and physical state.

```markdown
## December Energy Patterns

### Weekly Averages
| Week | Energy | Mood | Focus |
|------|--------|------|-------|
| 49 | 7.2 | Good | 6.8 |
| 50 | 6.5 | Mixed | 7.0 |
| 51 | 8.0 | Great | 8.5 |

### Observations
- Energy dips mid-week
- Focus highest in mornings
- Mood correlates with exercise
```

### 7. Tag Aggregation

Group by tags used.

```markdown
## Tag Cloud - December 2025

### Most Used
- #planning (15 entries)
- #reflection (12 entries)
- #project/alpha (10 entries)
- #learning (8 entries)

### By Category
**Projects**: #project/alpha (10), #project/beta (5)
**Activities**: #meeting (7), #deep-work (6)
**Emotions**: #grateful (8), #frustrated (3)
```

## Aggregation Process

### Step 1: Collect Entries

```bash
# List all daily notes for a month
ls .claude/journal/2025/12/*/*.md

# Or search by tag
grep -l "#reflection" .claude/journal/2025/**/*.md
```

### Step 2: Extract Data

From each entry, extract:
- Date/timestamp
- Type (daily, atomic, etc.)
- Tags
- Key sections (intentions, reflections, etc.)
- Metrics (mood, energy if present)
- Links

### Step 3: Categorize

Group extracted data by:
- Time period (week, month)
- Theme/tag
- Type of content
- Metric type

### Step 4: Synthesize

For each category:
- Identify patterns
- Note outliers
- Calculate averages/totals
- Extract key insights

### Step 5: Generate Output

Create summary document with:
- Clear structure
- Links to source entries
- Visual elements (tables, lists)
- Insights and patterns

## Output Formats

### Summary Note

Create atomic note: `HHMMSS-PERIOD-summary.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "[Period] Summary"
type: atomic
tags: [summary, aggregation]
period: "YYYY-MM"
entries_count: N
created: YYYY-MM-DDTHH:MM:SS
---

# [Period] Summary

## Overview
[High-level summary]

## By the Numbers
- Entries: N
- Days journaled: N
- Atomic notes: N

## Key Themes
1. Theme A
2. Theme B

## Highlights
- ...

## Lessons
- ...

## Looking Forward
- ...

---
*Source: N entries from [[YYYY-MM]]*
```

### Index Update

Update `index.md` with:
```markdown
## Recent Summaries
- [[HHMMSS-december-summary|December 2025]]
- [[HHMMSS-q4-summary|Q4 2025]]
```

### Standalone Report

For sharing or archiving:
```markdown
# [Title] Report
Generated: YYYY-MM-DD

[Full report content without wiki links]
```

## Aggregation Prompts

### Weekly
- What were the main themes this week?
- What's one thing I accomplished?
- What's one thing I learned?
- What pattern do I notice?

### Monthly
- How did this month's reality compare to my intentions?
- What themes emerged that I didn't plan?
- What habits are forming?
- What needs attention next month?

### Quarterly
- Am I on track for my annual goals?
- What's working? What isn't?
- What would I tell my start-of-quarter self?
- What should I double down on?

### Annual
- What defined this year?
- How did I grow?
- What am I most proud of?
- What would I do differently?

## Automation Patterns

### End of Week
1. Read all daily notes from the week
2. Extract wins, challenges, lessons
3. Create weekly summary atomic note
4. Update weekly review in monthly note

### End of Month
1. Read all weekly summaries
2. Read monthly note (goals, themes)
3. Compare intentions vs reality
4. Create monthly summary
5. Update yearly note

### End of Quarter/Year
1. Read all monthly summaries
2. Aggregate metrics and progress
3. Identify macro patterns
4. Create quarterly/annual summary

## Notes

- Aggregation surfaces patterns invisible day-to-day
- Link summaries to source entries for traceability
- Balance comprehensiveness with readability
- Aggregation is preparation for reflection
- Automated aggregation saves time but loses nuance
- The best insights often emerge from manual review
