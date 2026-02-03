# Process Registry

*Maintained by: process-cartographer*
*First mapping: 2025-12-13*

## Overview

This document maps the processes observed in the ecosystem—how work flows, where information moves, what triggers what. This is descriptive, not prescriptive: mapping what exists, not what should exist.

**Processes identified**: 9 core processes
**Information pathways**: Multiple, interconnected
**Primary feedback loops**: Learning, reflection, cataloguing

---

## Process Catalogue

### 1. Conversation Lifecycle

The fundamental unit of work in this system.

```
┌──────────────────────────────────────────────────────────────────┐
│  CONVERSATION LIFECYCLE                                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User initiates ──→ Hooks fire ──→ CLAUDE.md loaded              │
│       │              (logging)        │                          │
│       │                               ▼                          │
│       │                        Context established               │
│       │                               │                          │
│       ▼                               ▼                          │
│  User prompt ──────────────────→ Claude processes                │
│       │                               │                          │
│       │                    ┌──────────┴──────────┐               │
│       │                    ▼                     ▼               │
│       │              Tool usage            Subagent spawn        │
│       │                    │                     │               │
│       │                    └──────────┬──────────┘               │
│       │                               ▼                          │
│       │                         Response                         │
│       │                               │                          │
│       └───────────── loop ────────────┘                          │
│                                                                   │
│  Session ends ──→ Logs persisted (.claude/logging/)              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: User initiates conversation
**Output**: Responses, artifacts, logs
**Feedback**: Logs enable historical queries
**Information Flows**:
- CLAUDE.md → Context
- Conversation → Logs
- Logs → Future context (via logging plugin)

---

### 2. Plugin Development

How new capabilities are added to the system.

```
┌──────────────────────────────────────────────────────────────────┐
│  PLUGIN DEVELOPMENT                                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Identify need ──→ Design plugin structure                       │
│       │                    │                                     │
│       │                    ▼                                     │
│       │           Create plugin directory                        │
│       │           plugins/{name}/                                │
│       │                    │                                     │
│       │                    ▼                                     │
│       │           Define plugin.json (or marketplace entry)      │
│       │                    │                                     │
│       │                    ▼                                     │
│       │           Create skills (SKILL.md files)                 │
│       │                    │                                     │
│       │           ┌───────┴───────┐                              │
│       │           ▼               ▼                              │
│       │     Master skill    Sub-skills                           │
│       │     (discoverable)  (progressive)                        │
│       │           │               │                              │
│       │           └───────┬───────┘                              │
│       │                   ▼                                      │
│       │           Clear cache                                    │
│       │           ~/.claude/plugins/cache/{publisher}/{plugin}   │
│       │                   │                                      │
│       │                   ▼                                      │
│       │           Restart Claude Code                            │
│       │                   │                                      │
│       │                   ▼                                      │
│       └────────── Test and iterate ──────────────────────────────┘
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: Capability gap identified
**Output**: New plugin with skills
**Feedback**: Usage reveals what works; iterate
**Bottleneck**: Cache clearing + restart required for changes

---

### 3. Agent Creation

How new agent personas are added to the fleet.

```
┌──────────────────────────────────────────────────────────────────┐
│  AGENT CREATION                                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Identify need ──→ Design persona                                │
│  (gap in fleet)         │                                        │
│       │                 ├── Voice/character                      │
│       │                 ├── Domain expertise                     │
│       │                 ├── Responsibilities                     │
│       │                 └── Relationships to others              │
│       │                         │                                │
│       │                         ▼                                │
│       │                 Write agent definition                   │
│       │                 .claude/agents/{name}.md                 │
│       │                         │                                │
│       │                         ├── YAML frontmatter             │
│       │                         │   (name, description,          │
│       │                         │    tools, model)               │
│       │                         │                                │
│       │                         └── System prompt                │
│       │                             (persona, voice,             │
│       │                              methods)                    │
│       │                                 │                        │
│       │                                 ▼                        │
│       │                         Update registry                  │
│       │                         .claude/registry/agents.md       │
│       │                                 │                        │
│       │                                 ▼                        │
│       └──────────────────────── Test invocation ─────────────────┘
│                                                                   │
│  Agent available next session (or via direct CLI invocation)     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: Perspective gap, capability need
**Output**: Agent definition file, registry entry
**Feedback**: Agent usage patterns reveal refinement needs
**Key Decision Point**: Model selection (opus for complex, sonnet for standard, haiku for fast)

---

### 4. Multi-Persona Reflection

How multiple perspectives are composed on a document.

```
┌──────────────────────────────────────────────────────────────────┐
│  MULTI-PERSONA REFLECTION                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Document exists ──→ /reflect-on command invoked                 │
│  (planning note,         │                                       │
│   fusion document)       ▼                                       │
│                    Discover personas                             │
│                    .claude/agents/*.md                           │
│                          │                                       │
│                          ▼                                       │
│                    For each persona:                             │
│                          │                                       │
│                    ┌─────┴─────┐                                 │
│                    ▼           ▼                                 │
│              Read persona   Read document                        │
│                    │           │                                 │
│                    └─────┬─────┘                                 │
│                          ▼                                       │
│                    Embody perspective                            │
│                          │                                       │
│                          ▼                                       │
│                    Write reflection                              │
│                    .claude/perspectives/{persona}/reflections/   │
│                                                                   │
│                    [Repeat for each persona]                     │
│                          │                                       │
│                          ▼                                       │
│                    (Optional) Synthesize perspectives            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: `/reflect-on {document}` command
**Output**: Reflection files in per-persona namespaces
**Information Flow**: Document → Persona filter → Perspective output
**Value**: Same information, multiple lenses

---

### 5. Resource Acquisition (Librarian Process)

How external resources enter and are managed.

```
┌──────────────────────────────────────────────────────────────────┐
│  RESOURCE ACQUISITION                                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  URL encountered ──→ Check cache                                 │
│  (WebFetch,              │                                       │
│   WebSearch,       ┌─────┴─────┐                                 │
│   user provides)   ▼           ▼                                 │
│               Cache hit    Cache miss                            │
│                   │            │                                 │
│                   │            ▼                                 │
│                   │       Fetch resource                         │
│                   │            │                                 │
│                   │            ▼                                 │
│                   │       Extract metadata                       │
│                   │       (title, domain, date)                  │
│                   │            │                                 │
│                   │            ▼                                 │
│                   │       Catalogue                              │
│                   │       .claude/library/urls/                  │
│                   │            │                                 │
│                   │            ▼                                 │
│                   │       Cache content                          │
│                   │       .claude/library/.cache/                │
│                   │            │                                 │
│                   └─────┬──────┘                                 │
│                         ▼                                        │
│                   Return resource                                │
│                         │                                        │
│                         ▼                                        │
│                   Link to related resources                      │
│                   (same domain, topic, session)                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: External resource needed
**Output**: Catalogued, cached resource
**Feedback Loop**: Access patterns inform future caching
**Principle**: "Never fetch the same resource twice unnecessarily"
**Current State**: Structure exists but not yet activated

---

### 6. Artifact Observation (Archivist Process)

How internal artifacts are tracked and patterns surfaced.

```
┌──────────────────────────────────────────────────────────────────┐
│  ARTIFACT OBSERVATION                                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Artifact created/modified ──→ Archivist observes               │
│  (any file in ecosystem)             │                           │
│                                      ▼                           │
│                              Classify artifact                   │
│                              (planning, reflection,              │
│                               code, config, etc.)                │
│                                      │                           │
│                                      ▼                           │
│                              Trace connections                   │
│                              - What triggered this?              │
│                              - What does it relate to?           │
│                              - What session created it?          │
│                                      │                           │
│                                      ▼                           │
│                              Update metabolic map                │
│                              .claude/archive/metabolism.md       │
│                                      │                           │
│                                      ▼                           │
│                              Detect patterns                     │
│                              - Temporal rhythms                  │
│                              - Topic clusters                    │
│                              - Agent activity                    │
│                                      │                           │
│                                      ▼                           │
│                              Surface insights                    │
│                              .claude/archive/patterns/           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: Any artifact change
**Output**: Metabolic maps, pattern observations
**Feedback Loop**: Patterns inform future organization
**Current State**: Agent defined, output structure exists, not yet activated

---

### 7. Task Management (Backlog Process)

How work is tracked and prioritized.

```
┌──────────────────────────────────────────────────────────────────┐
│  TASK MANAGEMENT                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Task identified ──→ Create task                                 │
│  (user request,        backlog/                                  │
│   discovered need)         │                                     │
│                            ├── Title                             │
│                            ├── Description                       │
│                            ├── Acceptance criteria               │
│                            ├── Priority                          │
│                            └── Labels                            │
│                                │                                 │
│                                ▼                                 │
│                          Task in backlog                         │
│                          (To Do)                                 │
│                                │                                 │
│                                ▼                                 │
│                          Pick up task                            │
│                          (In Progress)                           │
│                                │                                 │
│                          ┌─────┴─────┐                           │
│                          ▼           ▼                           │
│                    TodoWrite    Implementation                   │
│                    tracking          │                           │
│                          │           │                           │
│                          └─────┬─────┘                           │
│                                ▼                                 │
│                          Complete task                           │
│                          (Done)                                  │
│                                │                                 │
│                                ▼                                 │
│                          Archive                                 │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: Work identified
**Output**: Tracked, completed work
**Feedback**: Completion patterns inform estimation
**Tools**: backlog plugin MCP tools, TodoWrite for in-session tracking

---

### 8. Knowledge Graph Construction (Temporal-Validator Process)

How information is tracked for validity over time.

```
┌──────────────────────────────────────────────────────────────────┐
│  KNOWLEDGE GRAPH CONSTRUCTION                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Information enters ──→ Extract facts/claims                     │
│  (file, conversation,         │                                  │
│   web resource)               ▼                                  │
│                         Create fact nodes                        │
│                         (content, source, timestamp)             │
│                                │                                  │
│                                ▼                                  │
│                         Link to related facts                    │
│                         (edges with temporal validity)           │
│                                │                                  │
│                                ▼                                  │
│                         Store in graph                           │
│                         (FalkorDB via Graphiti)                  │
│                                │                                  │
│                    ┌───────────┴───────────┐                     │
│                    ▼                       ▼                     │
│              Periodic scan          On-demand query              │
│              (detect staleness)     ("Is this still true?")      │
│                    │                       │                     │
│                    ▼                       ▼                     │
│              Flag stale facts        Return validity             │
│                    │                       │                     │
│                    └───────────┬───────────┘                     │
│                                ▼                                  │
│                         Update validations                       │
│                         .claude/registry/validations.md          │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: Information enters system / validation request
**Output**: Temporal knowledge graph, validity assessments
**Infrastructure**: FalkorDB + Graphiti (via temporal-kg-memory skill)
**Current State**: Infrastructure tested, full activation pending

---

### 9. Historical Archaeology (Archivist + Librarian Collaboration)

How historical data is recovered and backfilled into the journal.

```
┌──────────────────────────────────────────────────────────────────┐
│  HISTORICAL ARCHAEOLOGY                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Trigger: "Backfill the journal"                                │
│                │                                                 │
│                ▼                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            SOURCE DISCOVERY (PARALLEL)                   │    │
│  ├──────────────────────┬──────────────────────────────────┤    │
│  │      ARCHIVIST       │         LIBRARIAN                │    │
│  │   (Internal)         │        (External)                │    │
│  ├──────────────────────┼──────────────────────────────────┤    │
│  │ • .claude/logging/   │ • URLs from session logs         │    │
│  │ • git log            │ • WebFetch calls                 │    │
│  │ • .claude/planning/  │ • Documentation referenced       │    │
│  │ • .claude/storms/    │ • Papers/APIs mentioned          │    │
│  │ • backlog/           │                                  │    │
│  └──────────────────────┴──────────────────────────────────┘    │
│                │                        │                        │
│                └────────────┬───────────┘                        │
│                             ▼                                    │
│                   TEMPORAL INDEX CONSTRUCTION                    │
│                   (What happened when)                           │
│                             │                                    │
│                             ▼                                    │
│                   EVENT SIGNIFICANCE FILTERING                   │
│                   - New plugin created?                          │
│                   - Major decision made?                         │
│                   - Architecture established?                    │
│                   - Discovery documented?                        │
│                             │                                    │
│                             ▼                                    │
│                   ATOMIC ENTRY GENERATION                        │
│                   - HH-MM-title.md per event                     │
│                   - Backdate to source timestamp                 │
│                   - author: user | claude-X | agent-name         │
│                   - parent_daily: [[YYYY-MM-DD]]                 │
│                   - related: horizontal links                    │
│                             │                                    │
│                             ▼                                    │
│                   DAILY SYNTHESIS                                │
│                   .claude/journal/YYYY/MM/DD/YYYY-MM-DD.md       │
│                             │                                    │
│                             ▼                                    │
│                   MONTHLY/YEARLY PROPAGATION                     │
│                   Update parent summaries                        │
│                             │                                    │
│                             ▼                                    │
│                   DNA SPIRAL EXTENDS BACKWARD                    │
│                   Historical depth in graph view                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Trigger**: User request or scheduled archaeology session
**Actors**: Archivist (internal), Librarian (external) - collaborative
**Output**: Historical atomic entries, synthesized daily/monthly notes
**Value**: Journal gains temporal depth; graph shows true history

#### Source Inventory

| Source | Location | Data Type | Agent |
|--------|----------|-----------|-------|
| Session logs | `.claude/logging/` | Timestamped conversations | Archivist |
| Git commits | `git log` | Implementation history | Archivist |
| Planning docs | `.claude/planning/` | Strategic thinking | Archivist |
| Storms | `.claude/storms/` | Brainstorm sessions | Archivist |
| URLs fetched | Session logs | External resources | Librarian |
| Documentation | Web | Reference material | Librarian |

#### Current Historical Scope

| Date | Sessions | Planning Docs | Est. Atomics |
|------|----------|---------------|--------------|
| Dec 8 | 17 | 1 | ~10-15 |
| Dec 11 | 10 | 6 | ~15-20 |
| Dec 12 | 15 | 0 | ~10-15 |
| Dec 13 | 5+ | 4 | 5 (created) |

#### Atomic Generation Rules

1. **One atomic per significant event**
2. **Timestamp from source** (session log, git commit, file creation)
3. **Author determination**: user, claude-opus-4, claude-sonnet, agent-name
4. **Mandatory fields**: parent_daily, description, tags, related

**Current State**: Process designed, awaiting archivist/librarian activation

---

## Cross-Process Information Flows

```
                         ┌─────────────────┐
                         │  Conversations  │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │  Logs    │  │ Artifacts│  │Resources │
             │ (logging)│  │(archivist)│ │(librarian)│
             └────┬─────┘  └────┬─────┘  └────┬─────┘
                  │             │             │
                  └──────────┬──┴──┬──────────┘
                             │     │
                             ▼     ▼
                      ┌────────────────┐
                      │ Knowledge Graph │
                      │  (temporal-    │
                      │   validator)   │
                      └───────┬────────┘
                              │
                              ▼
                      ┌────────────────┐
                      │  Validated     │
                      │  Understanding │
                      └────────────────┘
```

---

## Observations

### Feedback Loops Identified

| Loop | Type | Speed |
|------|------|-------|
| Conversation → Logs → Future Context | Reinforcing | Slow (cross-session) |
| Usage → Pattern Detection → Improvement | Reinforcing | Medium |
| Staleness Detection → Invalidation | Balancing | Medium |
| Agent Creation → Usage → Refinement | Reinforcing | Slow |

### Bottlenecks Observed

1. **Cache clearing** for plugin development (manual step)
2. **Session boundary** for new agents (available next session)
3. **Infrastructure activation** for librarian, archivist, temporal-validator (defined but not running)

### Information Not Yet Flowing

- Librarian not cataloguing URLs
- Archivist not observing artifacts
- Temporal-validator not tracking validity
- These agents are **defined** but **dormant**

### Process Gaps

| Missing Process | Impact |
|-----------------|--------|
| Automated staleness alerts | Information decays silently |
| Cross-agent coordination protocol | Agents work in isolation |
| Resource-to-knowledge pipeline | URLs fetched but not connected to KG |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-13 | Initial process mapping |
| 2025-12-13 | Added Process 9: Historical Archaeology (Archivist + Librarian collaboration) |
