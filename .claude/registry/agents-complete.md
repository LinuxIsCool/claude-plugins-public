# Complete Agent Registry

*Maintained by: agent-architect*
*Audit Date: 2026-01-20*
*Previous Audit: 2025-12-15*
*Status: GOVERNANCE AUDIT - Complete inventory*

---

## Executive Summary

The ecosystem contains **53 agents** across two tiers:

| Tier | Count | Location |
|------|-------|----------|
| Project-Level Custom Agents | 11 | `.claude/agents/` |
| Plugin Persona Agents | 42 | `plugins/*/agents/` |
| **Total** | **53** | |

Additionally, **5 built-in agents** exist natively in Claude Code.

---

## Growth Timeline

| Date | Event | Agent Count |
|------|-------|-------------|
| 2025-12-09 | Ecosystem inception | 0 |
| 2025-12-11 | First agents created | ~5 |
| 2025-12-13 | Rapid emergence (multiple parallel sessions) | ~15 |
| 2025-12-15 | Governance audit | 24 |
| 2026-01-20 | AgentNet sync audit | 53 |

**Observation**: Growth from 24 to 53 agents (+29) over ~5 weeks. 28 new plugin agents added; 1 project agent added (conductor, tui-specialist); 1 project agent retired (obsidian-quartz, superseded by obsidian:visualizer).

---

## Project-Level Agents

### Complete Inventory (`.claude/agents/`)

| # | Agent | Model | Tools | Purpose | Status |
|---|-------|-------|-------|---------|--------|
| 1 | **backend-architect** | sonnet | Read, Glob, Grep | Infrastructure perspective, data flow analysis, reliability concerns | Official |
| 2 | **systems-thinker** | sonnet | Read, Glob, Grep | Systems dynamics perspective, feedback loops, emergence | Official |
| 3 | **process-cartographer** | opus | Read, Glob, Grep, Write, Edit | Workflow mapping, information flows, incentive systems, learning loops | Official |
| 4 | **temporal-validator** | opus | Read, Glob, Grep, Write, Edit, Bash, Task | Truth tracking over time, staleness detection, temporal KG | Official |
| 5 | **librarian** | sonnet | Read, Write, Edit, Glob, Grep, WebFetch, WebSearch | External resource curation, URL deduplication, citation management | Official |
| 6 | **agent-architect** | opus | Read, Glob, Grep, Write, Edit | Fleet management, cataloguing, taxonomy, governance | Official (Meta) |
| 7 | **archivist** | opus | Read, Write, Edit, Glob, Grep, Bash | Metabolic observer, data flows, coherence maintenance | Official (Meta) |
| 8 | **git-historian** | opus | Read, Write, Edit, Glob, Grep, Bash, Task | Repository temporal analysis, commit quality, evolution tracking | Official |
| 9 | **qa-engineer** | sonnet | Read, Glob, Grep, Bash | Manual testing, bug reproduction, test planning, TUI validation | Official |
| 10 | **conductor** | opus | Read, Write, Edit, Glob, Grep, Task, Bash | Central consciousness, user model, ecosystem pulse, Zen master/orchestra conductor | Official (Meta) **NEW** |
| 11 | **tui-specialist** | sonnet | Read, Glob, Grep, Bash | Terminal UI expertise, neo-neo-bblessed, screen lifecycle, widget composition | Official **NEW** |

### Agent Details

#### 1. backend-architect
- **File**: `.claude/agents/backend-architect.md`
- **Lineage**: 15 years production experience
- **Invocation**: Multi-perspective reflection on architectural documents
- **Key Questions**: "What's the bottleneck?" "What breaks at 3am?"

#### 2. systems-thinker
- **File**: `.claude/agents/systems-thinker.md`
- **Lineage**: Santa Fe Institute, Donella Meadows, Jay Forrester
- **Invocation**: Understanding feedback loops, emergence, systemic behavior
- **Key Questions**: "What feedback loops exist?" "Where are the delays?"

#### 3. process-cartographer
- **File**: `.claude/agents/process-cartographer.md`
- **Lineage**: Stafford Beer, Deming, Senge, Meadows, Simon, Shannon
- **Output**: `.claude/registry/processes.md` (when created)
- **Key Questions**: "What is the actual process?" "Where does information get stuck?"

#### 4. temporal-validator
- **File**: `.claude/agents/temporal-validator.md`
- **Lineage**: Archival science, temporal databases, data quality engineering
- **Output**: `.claude/registry/validations.md` (when created)
- **Key Questions**: "Is this still true?" "What contradicts this?"

#### 5. librarian
- **File**: `.claude/agents/librarian.md`
- **Output**: `.claude/library/`
- **Principle**: "Never make the same web request twice unnecessarily"

#### 6. agent-architect
- **File**: `.claude/agents/agent-architect.md`
- **Output**: `.claude/registry/agents.md`, `.claude/registry/agents-complete.md`
- **Role**: Meta-agent for ecosystem self-awareness

#### 7. archivist
- **File**: `.claude/agents/archivist.md`
- **Output**: `.claude/archive/`
- **Role**: Meta-observer of data flows and metabolic patterns

#### 8. git-historian
- **File**: `.claude/agents/git-historian.md`
- **Output**: `.claude/archive/git/`
- **Status**: Initial ingestion complete (27 commits, 153 files, 270 relationships)

#### 9. qa-engineer
- **File**: `.claude/agents/qa-engineer.md`
- **Focus**: TUI testing, edge cases, regression tracking
- **Created for**: AgentNet development

#### 10. conductor (NEW)
- **File**: `.claude/agents/conductor.md`
- **Role**: Central consciousness - Zen master, orchestra conductor, trusted advisor
- **Stance**: Questions > Assertions, Emergence > Control, Reflection > Action
- **Maintains**: User model, ecosystem pulse, anticipations, rituals

#### 11. tui-specialist (NEW)
- **File**: `.claude/agents/tui-specialist.md`
- **Domain**: neo-neo-bblessed, screen lifecycle, focus handling, key bindings
- **Created for**: TUI architecture expertise

### Retired Project Agents

| Agent | Retired Date | Reason | Superseded By |
|-------|--------------|--------|---------------|
| **obsidian-quartz** | ~2026-01 | Functionality absorbed by plugin agent | `obsidian:visualizer` |

---

## Plugin Persona Agents

### Complete Inventory (`plugins/*/agents/`)

| # | Agent | Plugin | Model | Purpose |
|---|-------|--------|-------|---------|
| 1 | **mentor** | awareness | sonnet | Learning guidance, progressive skill development |
| 2 | **style** | awareness | sonnet | Style/tone guardian, values enforcement, pattern compliance |
| 3 | **interface-navigator** | interface | opus | Vertical stack navigation (CLI->tmux->nvim->fish->alacritty->kernel) |
| 4 | **social-curator** | agentnet | sonnet | Social network curation, profile management, digests |
| 5 | **engineer** | agentnet | sonnet | AgentNet TUI development, bug fixes, features |
| 6 | **scribe** | journal | sonnet | Reflective journaling, temporal synthesis, wikilinks |
| 7 | **explorer** | exploration | sonnet | Environmental cartography, substrate discovery |
| 8 | **orchestrator** | agents | sonnet | Multi-agent frameworks expert (18 frameworks) |
| 9 | **modeler** | llms | sonnet | LLM tooling, embeddings, RAG pipelines |
| 10 | **weaver** | knowledge-graphs | sonnet | Graph architecture, 17 KG technologies |
| 11 | **taskmaster** | backlog | sonnet | Task orchestration, Backlog.md management |
| 12 | **timekeeper** | Schedule.md | sonnet | Weekly schedule management, time blocks |
| 13 | **muse** | brainstorm | opus | Ideation facilitation, creative catalyst |
| 14 | **archivist** | logging | sonnet | Conversation historian, session search, recall |
| 15 | **chronologist** | temporal | haiku | Temporal grounding, moment awareness, timestamp injection **NEW** |
| 16 | **correspondent** | messages | sonnet | Universal messenger, cross-platform communication orchestration **NEW** |
| 17 | **indexer** | messages | sonnet | Import specialist, bulk message imports, search index management **NEW** |
| 18 | **message-analyst** | messages | sonnet | Search/insights specialist, pattern analysis, trend discovery **NEW** |
| 19 | **board-mentor** | company | opus | Senior advisor: Naval, Musk, Dragons Den, Vitalik, CPA/CFA, BC law **NEW** |
| 20 | **ceo** | company | sonnet | Executive leadership, strategic vision, market positioning **NEW** |
| 21 | **cfo** | company | sonnet | Financial operations, tax optimization, compliance planning **NEW** |
| 22 | **cto** | company | sonnet | Technology strategy, build vs buy, technical debt management **NEW** |
| 23 | **chief-of-staff** | company | sonnet | Operations coordination, task breakdown, execution support **NEW** |
| 24 | **navigator** | search | sonnet | Pathfinder through information, search strategy selection **NEW** |
| 25 | **branch-manager** | git-flow | sonnet | Git worktrees, feature branches, PR preparation **NEW** |
| 26 | **transcriber** | transcripts | sonnet | Audio/video transcription, backend selection, quality assurance **NEW** |
| 27 | **researcher** | transcripts | haiku | Experimental research, Concrete Computing, safe experiments **NEW** |
| 28 | **transcript-analyst** | transcripts | sonnet | Entity extraction, topic modeling, knowledge graph integration **NEW** |
| 29 | **graph-curator** | obsidian | sonnet | Graph connectivity, orphan pruning, broken link fixing **NEW** |
| 30 | **vault-health** | obsidian | haiku | Vault diagnostics, structural issues, health reports **NEW** |
| 31 | **visualizer** | obsidian | sonnet | Obsidian/Quartz visualization, D3.js/PixiJS, graph rendering **NEW** |
| 32 | **link-suggester** | obsidian | sonnet | Semantic relationship discovery, wikilink suggestions **NEW** |
| 33 | **voice-conductor** | voice | sonnet | Voice I/O orchestration, TTS/STT coordination, daemon management **NEW** |
| 34 | **voice-character-curator** | voice | opus | Voice character curation, personality/mannerisms, sonic identity **NEW** |
| 35 | **perf-analyst** | perf | sonnet | Performance analysis, bottleneck identification, optimization **NEW** |
| 36 | **cook** | cook | opus | Meta-orchestration, OODA+L loop, recursive self-improvement **NEW** |
| 37 | **emergence-tracker** | cook | sonnet | Web emergence tracking, frontier knowledge discovery **NEW** |
| 38 | **self-improver** | cook | opus | System improvement, CLAUDE.md modifications, agent enhancement **NEW** |
| 39 | **evaluator** | evaluation | sonnet | Quality evaluation, briefing/extraction assessment **NEW** |
| 40 | **memory-architect** | hipporag | sonnet | Biomimetic memory, HippoRAG implementation, multi-hop retrieval **NEW** |
| 41 | **librarian** | library | sonnet | External resource curation, URL cataloguing, citation tracking **NEW** |
| 42 | **project-manager** | projects | sonnet | Project/opportunity tracking, pipeline management, financials **NEW** |

### Plugin Agent Details by Plugin

#### awareness Plugin (2 agents)
- **mentor**: Learning guide, progressive disclosure, anti-fragility coaching
- **style**: Values guardian, pattern enforcer, aesthetic curator

#### agentnet Plugin (2 agents)
- **social-curator**: Content curation, profile sync, interaction facilitation
- **engineer**: TUI development, blessed framework, TypeScript implementation

#### agents Plugin (1 agent)
- **orchestrator**: Framework selection, multi-agent architecture, 18 sub-skills

#### backlog Plugin (1 agent)
- **taskmaster**: Task lifecycle, acceptance criteria, completion tracking

#### brainstorm Plugin (1 agent)
- **muse**: Divergent thinking facilitation, storm capture, idea connection

#### company Plugin (5 agents) **NEW PLUGIN**
- **board-mentor**: Senior advisor synthesizing Naval, Musk, Dragons Den, Vitalik, CPA/CFA, BC legal
- **ceo**: Executive leadership, vision, strategy, competitive positioning
- **cfo**: Financial operations, tax efficiency, CCPC planning, compliance
- **cto**: Technology strategy, code leverage, build vs buy decisions
- **chief-of-staff**: Operations coordination, execution, follow-through

#### cook Plugin (3 agents) **NEW PLUGIN**
- **cook**: Meta-orchestration consciousness, OODA+L loop, goal pursuit
- **emergence-tracker**: Web discovery (HackerNews, Reddit, Twitter, ArXiv, YouTube)
- **self-improver**: Recursive system improvement, CLAUDE.md enhancement

#### evaluation Plugin (1 agent) **NEW PLUGIN**
- **evaluator**: Quality guardian, briefing/extraction assessment, HippoRAG-powered

#### exploration Plugin (1 agent)
- **explorer**: Concentric circle model, substrate scanning, curiosity cultivation

#### git-flow Plugin (1 agent) **NEW PLUGIN**
- **branch-manager**: Git worktrees, feature branches, naming conventions, PR preparation

#### hipporag Plugin (1 agent) **NEW PLUGIN**
- **memory-architect**: Biomimetic memory, hippocampal architecture, multi-hop retrieval

#### interface Plugin (1 agent)
- **interface-navigator**: Full stack awareness from Claude Code to kernel

#### journal Plugin (1 agent)
- **scribe**: Atomic note creation, temporal navigation, wikilink weaving

#### knowledge-graphs Plugin (1 agent)
- **weaver**: Graph database selection, KG schema design, temporal modeling

#### library Plugin (1 agent) **NEW PLUGIN**
- **librarian**: External resource curation, URL cataloguing, citation management

#### llms Plugin (1 agent)
- **modeler**: Embedding architecture, RAG design, model selection

#### logging Plugin (1 agent)
- **archivist**: Session historian (Note: Different from project-level archivist)

#### messages Plugin (3 agents) **NEW PLUGIN**
- **correspondent**: Universal messenger, cross-platform orchestration, plugin persona
- **indexer**: Import specialist, bulk imports, index management
- **message-analyst**: Pattern discovery, trend analysis, conversation summarization

#### obsidian Plugin (4 agents) **NEW PLUGIN**
- **graph-curator**: Graph connectivity maintenance, orphan resolution
- **vault-health**: Diagnostic tool, structural health reports
- **visualizer**: Obsidian/Quartz bridge, D3.js/PixiJS rendering
- **link-suggester**: Semantic relationship discovery, wikilink suggestions

#### perf Plugin (1 agent) **NEW PLUGIN**
- **perf-analyst**: Performance investigation, profiling, bottleneck identification

#### projects Plugin (1 agent) **NEW PLUGIN**
- **project-manager**: Project lifecycle, pipeline stages, deadline/financial tracking

#### Schedule.md Plugin (1 agent)
- **timekeeper**: Time block management, schedule analysis, yoga scheduling

#### search Plugin (1 agent) **NEW PLUGIN**
- **navigator**: Search method selection, hybrid/RAG/vector/graph strategies

#### temporal Plugin (1 agent) **NEW PLUGIN**
- **chronologist**: Temporal grounding, timestamp injection, session awareness

#### transcripts Plugin (3 agents) **NEW PLUGIN**
- **transcriber**: Audio/video to text, backend selection, quality assurance
- **researcher**: Experimental research specialist, Concrete Computing philosophy
- **transcript-analyst**: Entity extraction, topic modeling, summarization

#### voice Plugin (2 agents) **NEW PLUGIN**
- **voice-conductor**: TTS/STT orchestration, backend selection, daemon coordination
- **voice-character-curator**: Character development, voice direction, sonic identity

---

## Built-in Agents (Claude Code Native)

| Agent | Type | Model | Tools | Purpose |
|-------|------|-------|-------|---------|
| **Explore** | Research | haiku | Read-only | Fast codebase exploration |
| **General-purpose** | Task | sonnet | All | Complex autonomous tasks |
| **Plan** | Research | sonnet | Read-only | Architecture planning |
| **claude-code-guide** | Research | - | Glob, Grep, Read, WebFetch, WebSearch | Documentation lookup |
| **statusline-setup** | Task | - | Read, Edit | Status line configuration |

---

## Taxonomy

### By Type

```
META AGENTS (4)
├── agent-architect (fleet awareness)
├── archivist (metabolic awareness)
├── git-historian (temporal awareness)
└── conductor (ecosystem consciousness) NEW

PERSPECTIVE AGENTS (2)
├── backend-architect (infrastructure lens)
└── systems-thinker (dynamics lens)

OPERATIONAL AGENTS (2)
├── process-cartographer (workflow mapping)
└── temporal-validator (truth tracking)

STEWARDSHIP AGENTS (2)
├── librarian (external resources)
└── library:librarian (URL cataloguing) NEW

TASK AGENTS (2)
├── qa-engineer (testing)
└── tui-specialist (TUI development) NEW

ORCHESTRATION AGENTS (2) NEW
├── cook:cook (meta-orchestration)
└── cook:self-improver (recursive improvement)

DOMAIN EXPERTS (42 plugin personas)
├── awareness: mentor, style
├── exploration: explorer
├── interface: interface-navigator
├── journal: scribe
├── logging: archivist
├── agents: orchestrator
├── llms: modeler
├── knowledge-graphs: weaver
├── backlog: taskmaster
├── Schedule.md: timekeeper
├── brainstorm: muse
├── agentnet: social-curator, engineer
├── temporal: chronologist NEW
├── messages: correspondent, indexer, message-analyst NEW
├── company: board-mentor, ceo, cfo, cto, chief-of-staff NEW
├── search: navigator NEW
├── git-flow: branch-manager NEW
├── transcripts: transcriber, researcher, transcript-analyst NEW
├── obsidian: graph-curator, vault-health, visualizer, link-suggester NEW
├── voice: voice-conductor, voice-character-curator NEW
├── perf: perf-analyst NEW
├── cook: cook, emergence-tracker, self-improver NEW
├── evaluation: evaluator NEW
├── hipporag: memory-architect NEW
└── projects: project-manager NEW
```

### By Model

| Model | Count | Agents |
|-------|-------|--------|
| **opus** | 11 | agent-architect, archivist, git-historian, conductor, process-cartographer, temporal-validator, interface-navigator, muse, board-mentor, cook, self-improver, voice-character-curator |
| **sonnet** | 38 | All others except haiku |
| **haiku** | 4 | chronologist, vault-health, researcher, Explore (built-in) |

### By Tool Access

| Tool Category | Agents |
|---------------|--------|
| **Write/Edit** | agent-architect, archivist, git-historian, conductor, process-cartographer, temporal-validator, librarian, scribe, engineer, muse, graph-curator, visualizer, voice-character-curator, cook, self-improver, emergence-tracker, evaluator, library:librarian, project-manager, chief-of-staff |
| **Bash** | archivist, git-historian, conductor, temporal-validator, qa-engineer, tui-specialist, interface-navigator, branch-manager, transcriber, researcher, graph-curator, vault-health, visualizer, link-suggester, voice-conductor, perf-analyst, cook, self-improver, memory-architect |
| **WebFetch/WebSearch** | librarian, mentor, orchestrator, modeler, weaver, navigator, visualizer, cook, emergence-tracker, library:librarian, memory-architect, ceo, cfo, cto, board-mentor |
| **Skill** | mentor, style, explorer, scribe, orchestrator, modeler, weaver, taskmaster, timekeeper, navigator, transcriber, researcher, transcript-analyst, memory-architect, project-manager, voice-character-curator |
| **Task** | temporal-validator, git-historian, conductor, mentor, explorer, scribe, navigator, transcriber, researcher, voice-conductor, cook, self-improver, memory-architect, project-manager, ceo, cfo, board-mentor |

---

## Naming Conflicts

| Conflict | Resolution |
|----------|------------|
| **archivist** (project) vs **archivist** (logging plugin) | Different scopes: project-level = ecosystem metabolism, plugin-level = conversation history. Keep both with disambiguation notes added to both files. |
| **librarian** (project) vs **librarian** (library plugin) | Different scopes: project-level = general resource curation, plugin-level = hook-powered URL cataloguing with automatic capture. Consider consolidating. |

---

## Inter-Agent Relationships

```
                           ┌─────────────────────┐
                           │      conductor      │
                           │ (ecosystem center)  │
                           └──────────┬──────────┘
                                      │ coordinates
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
│ agent-architect │          │   cook:cook     │          │    archivist    │
│  (fleet map)    │          │  (meta-OODA)    │          │  (data flows)   │
└────────┬────────┘          └────────┬────────┘          └────────┬────────┘
         │                            │                            │
         │                   ┌────────┴────────┐                   │
         │                   │                 │                   │
         │                   ▼                 ▼                   │
         │          ┌─────────────┐   ┌──────────────┐            │
         │          │ emergence-  │   │ self-        │            │
         │          │ tracker     │   │ improver     │            │
         │          └─────────────┘   └──────────────┘            │
         │                                                        │
         └────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │   git-historian     │
                   │  (temporal graph)   │
                   └──────────┬──────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ temporal-       │  │ obsidian:       │  │ knowledge-      │
│ validator       │  │ visualizer      │  │ graphs:weaver   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Output Locations

| Agent | Primary Output |
|-------|----------------|
| agent-architect | `.claude/registry/` |
| archivist | `.claude/archive/` |
| git-historian | `.claude/archive/git/` |
| librarian / library:librarian | `.claude/library/` |
| process-cartographer | `.claude/registry/processes.md` |
| temporal-validator | `.claude/registry/validations.md` |
| scribe | `.claude/journal/` |
| muse | `.claude/storms/` |
| conductor | `.claude/conductor/` |
| cook:cook | `.claude/cook/` |
| project-manager | `.claude/projects/` |

---

## New Agents Since Dec 15, 2025 Baseline

### Project-Level (2 new, 1 retired)

| Agent | Type | Purpose |
|-------|------|---------|
| **conductor** | Meta | Central ecosystem consciousness, user model, orchestration |
| **tui-specialist** | Task | Terminal UI expertise, neo-neo-bblessed |
| ~~obsidian-quartz~~ | ~~Stewardship~~ | ~~Retired - superseded by obsidian:visualizer~~ |

### Plugin-Level (28 new)

| Plugin | Agent | Purpose |
|--------|-------|---------|
| temporal | chronologist | Temporal grounding, timestamp injection |
| messages | correspondent | Cross-platform messaging orchestration |
| messages | indexer | Bulk import specialist |
| messages | message-analyst | Pattern/trend discovery |
| company | board-mentor | Senior multi-perspective advisor |
| company | ceo | Executive leadership |
| company | cfo | Financial operations |
| company | cto | Technology strategy |
| company | chief-of-staff | Operations coordination |
| search | navigator | Search strategy selection |
| git-flow | branch-manager | Worktree/branch management |
| transcripts | transcriber | Audio/video transcription |
| transcripts | researcher | Experimental research |
| transcripts | transcript-analyst | Entity extraction, topic modeling |
| obsidian | graph-curator | Graph connectivity maintenance |
| obsidian | vault-health | Vault diagnostics |
| obsidian | visualizer | Obsidian/Quartz visualization |
| obsidian | link-suggester | Semantic link suggestions |
| voice | voice-conductor | TTS/STT orchestration |
| voice | voice-character-curator | Voice character curation |
| perf | perf-analyst | Performance analysis |
| cook | cook | Meta-orchestration OODA+L |
| cook | emergence-tracker | Web emergence discovery |
| cook | self-improver | Recursive self-improvement |
| evaluation | evaluator | Quality assessment |
| hipporag | memory-architect | Biomimetic memory design |
| library | librarian | URL cataloguing |
| projects | project-manager | Project/pipeline tracking |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-20 | AgentNet sync audit - 53 agents total (29 new since Dec 15) |
| 2026-01-20 | Documented 16 new plugins with agents |
| 2026-01-20 | Noted obsidian-quartz retirement, conductor/tui-specialist addition |
| 2026-01-20 | Updated taxonomy and model distribution |
| 2025-12-15 | Complete governance audit - identified all 24 agents |
| 2025-12-15 | Identified redundancy (awareness:mentor) |
| 2025-12-15 | Resolved naming conflict documentation |
| 2025-12-15 | Established complete taxonomy |
