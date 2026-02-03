# Ecosystem Orientation

*For any Claude session beginning work in this repository*

## What Is This?

A **plugin marketplace for Claude Code** — a multi-agent ecosystem containing plugins, agents, skills, and commands that extend Claude Code's capabilities.

## The 30-Second Context

```
Vision: An ecosystem of intelligence that discovers available compute,
        learns about its environment, and continuously improves while
        maintaining coherence.

Philosophy: Emergence beats design. Discover what wants to exist.
```

## Your First Five Minutes

### 1. Understand the Architecture (1 min)
Read `CLAUDE.md` in the repo root for the plugin architecture, coordination patterns, and development workflow.

### 2. Know the Fleet (1 min)
Read `.claude/registry/agents.md` — 50+ agents catalogued across project-level and plugin-level:
- **Meta agents**: archivist, agent-architect, conductor
- **Perspective agents**: backend-architect, systems-thinker
- **Operational agents**: process-cartographer, temporal-validator
- **Stewardship agents**: librarian
- **Task agents**: qa-engineer, tui-specialist

### 3. Know the Processes (1 min)
Read `.claude/registry/processes.md` — core processes mapped including conversation, plugin development, agent creation, reflection, and task management.

### 4. Explore Plugins (2 min)
Browse `plugins/` directory — 30+ plugins covering awareness, scheduling, journaling, brainstorming, search, messages, knowledge graphs, and more.

## Key Directories

```
.claude/
├── README.md              ← You are here
├── agents/                ← Custom agent definitions (system prompts)
├── registry/
│   ├── agents.md          ← Fleet catalogue
│   └── processes.md       ← Workflow mapping
├── conventions/           ← Coordination patterns and conventions
├── governance/            ← Agent lifecycle governance
├── library/               ← Resource cataloguing
└── commands/              ← Slash commands

plugins/                   ← The actual plugin code
├── awareness/             ← Self-improvement, learning
├── journal/               ← Obsidian-style journaling
├── schedule/              ← Weekly schedule management
├── backlog/               ← Task tracking
├── brainstorm/            ← Structured ideation
├── logging/               ← Session logging
├── agents/                ← Agent framework skills
├── llms/                  ← LLM tooling skills
├── knowledge-graphs/      ← KG skills
├── exploration/           ← Environmental discovery
├── interface/             ← Interface stack navigation
├── messages/              ← Cross-platform messaging
├── search/                ← Hybrid search capabilities
├── obsidian/              ← Obsidian vault management
└── ...                    ← And many more
```

## Plugin Architecture

Each plugin follows the master skill pattern:

```
plugins/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── skills/                # Skills (via Skill tool)
│   └── {skill-name}/
│       ├── SKILL.md       # Master skill (discoverable)
│       └── subskills/     # Sub-skills (loaded on-demand)
├── commands/              # Slash commands
└── agents/                # Subagents (via Task tool)
    └── {agent-name}.md
```

## The Journal System

**Atomic-First Model**:
```
Atomic entries (HH-MM-title.md) — PRIMARY
    ↓ synthesize into
Daily summaries (YYYY-MM-DD.md)
    ↓ synthesize into
Monthly summaries (YYYY-MM.md)
    ↓ synthesize into
Yearly summaries (YYYY.md)
```

## Five Core Primitives

| Primitive | Essence |
|-----------|---------|
| **Context as Currency** | Every token has cost; CLAUDE.md as routing table |
| **Network of Networks** | Heterogeneous graphs with multiple edge types |
| **Temporal-Spatial Dimensions** | Knowledge has coordinates in time and space |
| **Metabolic Intelligence** | Ingest, digest, integrate, excrete |
| **Financial Metabolism** | Agents have budgets; value creates survival |

## The Meta-Layer

Three agents form ecosystem self-awareness:

```
AGENT-ARCHITECT     ARCHIVIST           LIBRARIAN
"Who exists?"       "What flows?"       "What comes from outside?"
     │                   │                    │
     └───────────────────┼────────────────────┘
                         ▼
              ECOSYSTEM AWARENESS
```

## Getting Started

1. **Read** `CLAUDE.md` for architecture and conventions
2. **Browse** `plugins/` for available capabilities  
3. **Check** `.claude/registry/agents.md` for the agent fleet
4. **Contribute** via the patterns documented in `CONTRIBUTING.md`

---

*Maintained by: agent-architect, process-cartographer*
