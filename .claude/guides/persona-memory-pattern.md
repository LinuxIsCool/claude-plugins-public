---
title: Persona Memory Pattern
created: 2025-12-15
author: agent:archivist
tags: [guide, memory, personas, journal, pattern]
related: [[task-1.6]], [[ADR-001-persona-memory-architecture]]
---

# Persona Memory Pattern

*How plugin personas access and contribute to ecosystem memory*

## Overview

Plugin personas don't maintain separate memory systems. Instead, they **participate in ecosystem memory** through the journal system with author attribution.

## The Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLUGIN PERSONA MEMORY CYCLE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SKILL INVOCATION                                                    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  1. CONTEXT GATHERING (Read)                                │    │
│  │                                                              │    │
│  │  • Load skill definition (identity)                         │    │
│  │  • Query journal for tagged preferences                     │    │
│  │  • Check logging for recent interactions                    │    │
│  │  • Load archive patterns if available                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  2. TASK EXECUTION                                          │    │
│  │                                                              │    │
│  │  • Persona performs requested work                          │    │
│  │  • Applies recalled preferences                             │    │
│  │  • Learns from current interaction                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  3. MEMORY CONTRIBUTION (Write)                             │    │
│  │                                                              │    │
│  │  IF significant learning observed:                          │    │
│  │    Create journal atomic with:                              │    │
│  │    • author: persona:{name}                                 │    │
│  │    • tags including persona name                            │    │
│  │    • Confidence levels for observations                     │    │
│  │    • Application guidance                                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Journal Atomic Format

When a persona records a memory, use this format:

```yaml
---
created: 2025-12-15T20:00:00
author: persona:{name}          # e.g., persona:coordinator
description: What was observed
parent_daily: [[YYYY-MM-DD]]
tags: [preference, {domain}, {topic}, {persona-name}, persona-memory]
related: [[plugins/{plugin-name}]]
---
```

### Required Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `author` | Identifies source | `persona:coordinator` |
| `tags` | Enables querying | Must include persona name |
| `description` | Summary for index | "User prefers morning yoga" |
| `related` | Links to plugin | `[[plugins/Schedule.md]]` |

## Memory Query Patterns

### Finding Persona Memories

```bash
# Find all memories from a specific persona
grep -r "author: persona:coordinator" .claude/journal/

# Find all preference observations
grep -r "tags:.*preference" .claude/journal/

# Find memories related to a plugin
grep -r "related:.*Schedule.md" .claude/journal/
```

### In Skill Invocation

When a skill is invoked, query relevant memories:

```
1. Grep journal for tags matching skill domain
2. Filter to recent entries (last 30 days)
3. Sort by confidence level
4. Apply to current task
```

## What to Record

### DO Record

- **User preferences** with confidence levels
  - "User prefers X" (High confidence: 3+ data points)
  - "User may prefer X" (Medium: 2 data points)
  - "User once chose X" (Low: 1 data point)

- **Patterns observed**
  - Time patterns ("always schedules Y before Z")
  - Choice patterns ("prefers instructor A over B")
  - Workflow patterns ("processes files in this order")

- **Application guidance**
  - How to use the observation
  - When it applies
  - Exceptions noted

### DON'T Record

- Transient information (single-use queries)
- Raw data (that's what logs are for)
- System details (not user preferences)
- Every interaction (only significant learnings)

## Confidence Levels

| Level | Data Points | Language |
|-------|-------------|----------|
| Very High | 4+ consistent | "User always...", "Every time..." |
| High | 3 consistent | "User prefers...", "Typically..." |
| Medium | 2 consistent | "User tends to...", "Often..." |
| Low | 1 observation | "User once...", "In this case..." |

## Example: The Coordinator

The first persona memory was recorded by The Coordinator (Schedule.md).

**Observation**: 24 schedule blocks analyzed

**Recorded Preferences**:
- Yoga location: Ember Studios (Very High - 4/4)
- Instructors: David, Justin (High - consistent pattern)
- Weekday yoga: Evening 5:30-7pm (High - 3 data points)
- Weekend yoga: Morning 10:30am (High - consistent)

**Application Guidance**:
> "When suggesting yoga classes, prioritize Ember Studios, check David/Justin schedules, suggest Powerflow classes, evening slots for weekdays, morning for weekends."

See: [[2025/12/15/20-00-coordinator-observes-preferences]]

## Rolling Out to Other Personas

Each of the 11 plugin personas can follow this pattern:

| Persona | Plugin | What to Observe |
|---------|--------|-----------------|
| The Coordinator | Schedule.md | Time preferences, activity patterns |
| The Scribe | journal | Writing style, reflection depth |
| The Guide | awareness | Learning preferences, pacing |
| The Architect | agents | Framework preferences, patterns |
| The Facilitator | brainstorm | Discussion style, outcome preferences |
| The Chronicler | logging | Detail level, format preferences |
| The Cartographer | exploration | Exploration depth, areas of interest |
| The Steward | backlog | Task organization, priority patterns |
| The Scholar | llms | Technology preferences, depth |
| The Connector | knowledge-graphs | Graph density, connection types |
| The Questioner | perspective | Question types, synthesis style |

## Benefits

1. **Single source of truth** - All memory in journal
2. **Cross-persona awareness** - Personas can read each other's observations
3. **Human-readable** - Markdown, always auditable
4. **Queryable** - Tags and grep enable recall
5. **Obsidian-compatible** - Wikilinks work

## Relationship to Other Systems

| System | Role | Persona Access |
|--------|------|----------------|
| Journal | Memory recording | Read/Write |
| Logging | Full-fidelity history | Read only |
| Archive | Pattern storage | Via archivist |
| Library | External resources | Via librarian |

## Future Enhancements

If markdown-native querying proves insufficient:
1. **Graphiti layer** - Temporal knowledge graph on top
2. **FalkorDB** - Sophisticated graph queries
3. **Semantic search** - Embedding-based retrieval

These are additive, not replacing the markdown foundation.

---

*Persona memory is ecosystem memory with attribution.*
