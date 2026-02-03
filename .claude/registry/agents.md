# Agent Registry

*Maintained by: agent-architect*
*Last updated: 2025-12-24*
*Total agents: 44 (9 project-level, 35 plugin-level)*

---

## Overview

This ecosystem contains **44 custom agents** distributed across project-level and plugin directories. The architecture follows a pattern of specialized perspectives composed for multi-viewpoint analysis.

### Agent Categories

| Category | Count | Description |
|----------|-------|-------------|
| **Perspective** | 2 | Reflection and analysis viewpoints |
| **Meta** | 3 | Fleet awareness, self-improvement, process mapping |
| **Operational** | 4 | Data integrity, history, quality |
| **Stewardship** | 2 | Resource and artifact management |
| **Domain Expert** | 33 | Plugin-specific specialists |

---

## Project-Level Agents

Located in `.claude/agents/`

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **agent-architect** | Fleet management, cataloguing, strategic evolution | opus | Read, Glob, Grep, Write, Edit |
| **archivist** | Meta-observer of data flows, metabolic mapping | opus | Read, Write, Edit, Glob, Grep, Bash |
| **backend-architect** | Infrastructure perspective, data flow design | sonnet | Read, Glob, Grep |
| **git-historian** | Temporal git analysis, commit quality, evolution | opus | Read, Write, Edit, Glob, Grep, Bash, Task |
| **librarian** | External resources - URLs, citations, papers | sonnet | Read, Write, Edit, Glob, Grep, WebFetch, WebSearch |
| **process-cartographer** | Maps workflows, information flows, incentives | opus | Read, Glob, Grep, Write, Edit |
| **qa-engineer** | Manual testing, bug reproduction, test planning | sonnet | Read, Glob, Grep, Bash |
| **systems-thinker** | Complexity perspective, feedback loops, emergence | sonnet | Read, Glob, Grep |
| **temporal-validator** | Data verification, staleness detection, truth tracking | opus | Read, Glob, Grep, Write, Edit, Bash, Task |

---

## Plugin-Level Agents

### agents plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **orchestrator** | Multi-agent systems architect, 18 framework expert | sonnet | Read, Glob, Grep, Skill, Task, WebFetch |

### agentnet plugin (2 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **engineer** | TUI development, bug fixes, feature implementation | sonnet | Read, Write, Edit, Glob, Grep, Bash |
| **social-curator** | Agent social network curation - profiles, posts | sonnet | Read, Glob, Grep, Bash |

### awareness plugin (2 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **mentor** | Self-improvement guide, learning progression | sonnet | Read, Glob, Grep, Skill, Task, WebFetch, WebSearch |
| **style** | Guardian of style, tone, values, design patterns | sonnet | Read, Glob, Grep, Task, Skill |

### backlog plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **taskmaster** | Task orchestration, Backlog.md management | sonnet | Read, Write, Edit, Glob, Grep, Skill, MCP tools |

### brainstorm plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **muse** | Ideation facilitator, creative catalyst | opus | Read, Write, Edit, Glob, Grep, Skill |

### company plugin (5 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **board-mentor** | Senior advisor combining Naval, Elon, Dragons Den perspectives | opus | Read, Glob, Grep, Skill, Task, WebFetch, WebSearch |
| **ceo** | Executive leadership, strategic vision, market positioning | sonnet | Read, Glob, Grep, WebSearch, WebFetch, Task |
| **cfo** | Financial operations, tax optimization, CCPC planning | sonnet | Read, Glob, Grep, WebSearch, WebFetch, Task |
| **chief-of-staff** | Operations coordination, task breakdown, progress tracking | sonnet | Read, Write, Edit, Glob, Grep |
| **cto** | Technology strategy, build vs buy, systems architecture | sonnet | Read, Glob, Grep, WebSearch, WebFetch |

### exploration plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **explorer** | Environmental discovery, concentric circle model | sonnet | Read, Bash, Glob, Grep, Skill, Task |

### git-flow plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **branch-manager** | Git worktrees, feature branches, PR preparation | sonnet | Bash, Read, Glob, Grep |

### interface plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **interface-navigator** | Layered interface stack navigation (CLI to kernel) | opus | Bash, Read, Glob, Grep, Skill |

### journal plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **scribe** | Reflective journaling, atomic notes, wikilinks | sonnet | Read, Write, Edit, Glob, Grep, Skill, Task |

### knowledge-graphs plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **weaver** | Graph architect, 17 KG technologies expert | sonnet | Read, Glob, Grep, Skill, Task, WebFetch |

### llms plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **modeler** | LLM tooling, embeddings, RAG architecture | sonnet | Read, Glob, Grep, Skill, Task, WebFetch |

### logging plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **archivist** | Conversation history search, session analysis | sonnet | Read, Bash, Glob, Grep, Skill |

### messages plugin (3 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **correspondent** | Universal messenger, cross-platform orchestration | inherit | Read, Bash, Grep, Glob |
| **indexer** | Bulk message imports, search index optimization | inherit | Read, Bash, Grep, Glob |
| **message-analyst** | Message pattern analysis, trend discovery | inherit | Read, Bash, Grep, Glob |

### obsidian plugin (4 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **graph-curator** | Graph connectivity, orphan pruning, link fixing | sonnet | Read, Write, Edit, Glob, Grep, Bash |
| **link-suggester** | Semantic link suggestions between entries | sonnet | Read, Glob, Grep, Bash |
| **vault-health** | Vault auditing, structural issues, health reports | haiku | Read, Glob, Grep, Bash |
| **visualizer** | Obsidian/Quartz visualization, D3.js/PixiJS | sonnet | Read, Write, Edit, Glob, Grep, Bash, WebFetch |

### perf plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **perf-analyst** | Performance investigation, bottleneck identification | sonnet | Read, Bash, Glob, Grep |

### Schedule.md plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **timekeeper** | Weekly scheduling, time block management | sonnet | Read, Glob, Grep, Skill, MCP tools |

### search plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **navigator** | Search strategy selection, RAG orchestration | sonnet | Read, Bash, Glob, Grep, Skill, Task, WebFetch |

### temporal plugin (1 agent)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **chronologist** | Real-time timestamp injection, temporal grounding | haiku | Read, Glob, Grep, Bash |

### transcripts plugin (3 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **researcher** | Experimental research, safe experiments | haiku | Read, Glob, Grep, Bash, Skill, Task |
| **transcript-analyst** | Entity extraction, topic modeling, KG integration | sonnet | Read, Glob, Grep, Skill, Task |
| **transcriber** | Audio/video transcription, backend selection | sonnet | Read, Glob, Grep, Bash, Skill, Task |

### voice plugin (2 agents)

| Agent | Purpose | Model | Tools |
|-------|---------|-------|-------|
| **voice-character-curator** | Character development, sonic identity, voice direction | opus | Read, Write, Edit, Glob, Grep, Bash, Task, Skill |
| **voice-conductor** | TTS/STT orchestration, voice identity resolution | sonnet | Read, Bash, Glob, Grep, Task |

---

## Model Distribution

| Model | Count | Use Cases |
|-------|-------|-----------|
| **opus** | 10 | Complex reasoning, meta-cognition, strategic decisions |
| **sonnet** | 29 | Standard operations, domain expertise |
| **haiku** | 3 | Lightweight tasks, fast responses (chronologist, vault-health, researcher) |
| **inherit** | 2 | Inherits from parent context (messages plugin) |

---

## Taxonomy by Function

```
META AGENTS (3)
├── agent-architect (project) - Fleet management
├── archivist (project) - Ecosystem metabolism
└── process-cartographer (project) - Workflow mapping

PERSPECTIVE AGENTS (2)
├── backend-architect (project) - Infrastructure view
└── systems-thinker (project) - Complexity view

OPERATIONAL AGENTS (4)
├── temporal-validator (project) - Data quality
├── git-historian (project) - Git analysis
├── qa-engineer (project) - Testing
└── librarian (project) - Resource curation

DOMAIN EXPERTS (33) - Grouped by plugin
├── Company Team (5): board-mentor, ceo, cfo, cto, chief-of-staff
├── Obsidian Team (4): graph-curator, vault-health, visualizer, link-suggester
├── Transcripts Team (3): transcriber, transcript-analyst, researcher
├── Messages Team (3): correspondent, indexer, message-analyst
├── Voice Team (2): voice-conductor, voice-character-curator
├── AgentNet Team (2): social-curator, engineer
├── Awareness Team (2): mentor, style
└── Specialists (12): orchestrator, taskmaster, muse, explorer,
    branch-manager, interface-navigator, scribe, weaver,
    modeler, archivist (logging), timekeeper, navigator,
    chronologist, perf-analyst
```

---

## Invocation Patterns

| Pattern | Subagent Type | Example |
|---------|---------------|---------|
| Project agent | `{name}` | `agent-architect`, `archivist` |
| Plugin agent | `{plugin}:{name}` | `awareness:mentor`, `company:ceo` |
| Built-in | `{name}` | `Explore`, `Plan`, `general-purpose` |

### Built-in Agents (Native to Claude Code)

| Agent | Type | Purpose |
|-------|------|---------|
| **Explore** | Research | Fast codebase exploration |
| **general-purpose** | Task | Complex multi-step tasks |
| **Plan** | Research | Architecture planning |
| **claude-code-guide** | Research | Documentation lookup |
| **statusline-setup** | Task | Status line configuration |

---

## Agent Disambiguation

Two agents share the name "archivist" with different scopes:

| Agent | Location | Scope | Focus |
|-------|----------|-------|-------|
| **archivist** | `.claude/agents/` | Project-wide | Ecosystem metabolism, all data flows |
| **archivist** | `plugins/logging/` | Logging plugin | Conversation history, session search |

Both have disambiguation notes in their definitions.

---

## Archived Agents

| Agent | Archived | Reason |
|-------|----------|--------|
| **obsidian-quartz** | 2025-12-24 | Superseded by `obsidian:visualizer` |

Location: `.claude/archive/agents/`

---

## Agent Activation Status

Tracks which agents have been actively invoked vs. dormant (defined but never run).

| Agent | Status | Last Active | Notes |
|-------|--------|-------------|-------|
| **archivist** (project) | ACTIVE | 2026-01-06 | Activated via cook daemon, 5 observations in metabolism.md |
| **librarian** (project) | ACTIVE | 2026-01-05 | Migrated to plugin, cataloguing URLs |
| **git-historian** (project) | Dormant | - | Awaiting reactivation for KG refresh |
| **temporal-validator** (project) | ACTIVE | 2026-01-07 | Connected to FalkorDB, first fact written to temporal_validator graph |
| All others | Active | Ongoing | Invoked as needed |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-07 | Temporal-validator activated via cook daemon iteration 7, connected to FalkorDB |
| 2026-01-06 | Archivist formally activated via cook daemon iteration 1 |
| 2025-12-24 | Complete registry rebuild: 44 agents catalogued |
| 2025-12-24 | Resolved naming collisions: `analyst` → `message-analyst`, `transcript-analyst`, `perf-analyst` |
| 2025-12-24 | Archived `obsidian-quartz` (redundant with `obsidian:visualizer`) |
| 2025-12-24 | Updated model distribution and taxonomy |
| 2025-12-15 | Previous registry version (9 project, 12 plugin documented) |
