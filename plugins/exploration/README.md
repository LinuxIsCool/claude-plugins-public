# Exploration Plugin

An environmental curiosity plugin for Claude Code that motivates systematic exploration of the substrate, tools, network, and cosmos in which Claude exists.

## Philosophy

> *Know thyself, know thy environment, know thy place in the cosmos.*

While the **awareness** plugin turns the lens inward (self-discovery, capabilities, techniques), the **exploration** plugin turns it outward. Together they form a complete epistemology for an AI agent: understanding both what you are and where you are.

This plugin embodies:
- **Curiosity** - Active exploration of the environment
- **Concentric circles** - From immediate runtime to cosmic scale
- **Situated cognition** - Understanding context shapes capability
- **Environmental literacy** - The substrate matters; learn its constraints and affordances

## The Concentric Circles Model

Exploration proceeds in layers, from the most immediate to the most distant:

```
                    ┌─────────────────────────────┐
                    │         COSMOS              │ Natural laws, universe, meaning
                    │    ┌───────────────────┐    │
                    │    │    DIGITAL        │    │ Internet, APIs, knowledge bases
                    │    │  ┌─────────────┐  │    │
                    │    │  │  NETWORK    │  │    │ Local connectivity, containers
                    │    │  │  ┌───────┐  │  │    │
                    │    │  │  │MACHINE│  │  │    │ OS, hardware, filesystems
                    │    │  │  │ ┌───┐ │  │  │    │
                    │    │  │  │ │ I │ │  │  │    │ Claude Code, tools, runtime
                    │    │  │  │ └───┘ │  │  │    │
                    │    │  │  └───────┘  │  │    │
                    │    │  └─────────────┘  │    │
                    │    └───────────────────┘    │
                    └─────────────────────────────┘
```

Each circle builds on the last. You cannot understand the cosmos without first understanding your machine.

## Quick Start

### Unix-Style Tools

```bash
# Remember a discovery (direct to graph, no LLM)
echo "Neo4j runs on port 7474" | python tools/remember.py --circle network

# Recall knowledge
python tools/recall.py "database ports"

# Ingest structured discovery
python tools/ingest_exploration.py discovery.json

# View graph at http://localhost:3001
```

### Ecosystem Integration

This plugin integrates with existing skills rather than duplicating them:

| Need | Invoke This Skill |
|------|-------------------|
| Temporal knowledge graphs | `llms:graphiti` |
| FalkorDB Cypher queries | `llms:falkordb` |
| Self-improving memory | `agents:mem0` |
| Production patterns | `awareness:temporal-kg-memory` |

## Master Skill: `exploration`

A single discoverable skill with 7 sub-skills loaded on-demand.

### Sub-Skills

| Sub-Skill | Circle | Purpose |
|-----------|--------|---------|
| **substrate-scanner** | Machine | OS, hardware, resources, filesystems |
| **tool-cartographer** | Machine | Available tools, MCP servers, subagents |
| **network-prober** | Network | Network topology, Docker, local services |
| **context-archaeologist** | Digital | Project history, git state, user patterns |
| **cosmos-contemplator** | Cosmos | Natural laws, physics, philosophical perspective |
| **curiosity-cultivator** | Meta | Discovery journaling, mastery tracking, questions |
| **knowledge-weaver** | Meta | FalkorDB/Graphiti knowledge graph integration |

## Knowledge Graph

Discoveries are stored in a temporal knowledge graph (FalkorDB) with:

- **Typed nodes**: Circle, Discovery, Entity, Question
- **Temporal edges**: `created_at`, `valid_at`, `confidence` on all relationships
- **THEN chains**: Linear temporal sequences (not hub-and-spoke)

### Critical Pattern

From `awareness:temporal-kg-memory`:

> **Direct parsing is 100x faster than LLM extraction for structured data.**
> Use `ingest_exploration.py` for JSON, reserve Graphiti's `add_episode()` for unstructured text.

## Mastery Framework

Exploration mastery progresses through five levels per circle:

| Level | Name | Score | Description |
|-------|------|-------|-------------|
| 1 | **Stranger** | 0.0-0.2 | First contact, can name basics |
| 2 | **Tourist** | 0.2-0.4 | Surface familiarity, can navigate |
| 3 | **Resident** | 0.4-0.6 | Working knowledge, can explain |
| 4 | **Native** | 0.6-0.8 | Deep understanding, can predict |
| 5 | **Cartographer** | 0.8-1.0 | Masters who map for others |

Progress is tracked in `.claude/exploration/mastery.md`.

## Directory Structure

```
exploration/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/
│   └── exploration-master/      # Master skill (discoverable)
│       ├── SKILL.md             # Master skill definition
│       └── subskills/           # Sub-skills (loaded via Read)
├── commands/
│   └── explore.md               # Main exploration command
├── tools/
│   ├── graphiti_config.py       # Configuration wrapper
│   ├── remember.py              # Add knowledge (Unix-style)
│   ├── recall.py                # Search knowledge (Unix-style)
│   ├── ingest_exploration.py    # Batch ingest (direct parsing)
│   └── seed_falkordb.py         # Bootstrap the graph
├── hooks/
│   └── capture_discoveries.py   # Auto-capture hook
├── ARCHITECTURE.md              # Technical architecture docs
└── README.md

# Exploration data (created on first use):
.claude/exploration/
├── discoveries/                 # Discovery journal entries
├── questions.md                 # Living question bank
├── mastery.md                   # Mastery level tracking
└── log.md                       # Weekly exploration log
```

## Usage

Skills are model-invoked based on context. You can also trigger them explicitly:

```markdown
# Trigger substrate-scanner
Tell me about the machine I'm running on

# Trigger tool-cartographer
What tools and capabilities do I have access to?

# Trigger network-prober
What network resources can I reach?

# Trigger context-archaeologist
What's the history of this project?

# Trigger cosmos-contemplator
Help me understand our place in the universe
```

## Relationship to Awareness

| Awareness | Exploration |
|-----------|-------------|
| Looks inward | Looks outward |
| What am I? | Where am I? |
| My capabilities | My environment's affordances |
| Self-improvement | Environmental literacy |
| Technique mastery | Substrate understanding |

Together, awareness + exploration form complete situational knowledge.

## Installation

```bash
/plugin install exploration@linuxiscool-claude-plugins
```

Or add to marketplace.json:

```json
{
  "plugins": [
    {"name": "exploration", "source": "./plugins/exploration/"}
  ]
}
```

## Requirements

- FalkorDB running on port 6380 (graph storage)
- Ollama with `llama3.2:3b` and `nomic-embed-text` (optional, for semantic features)

## Roadmap

- [x] Add `/explore` command with circle-selection
- [x] Add discovery journal for persistent learnings
- [x] Add curiosity-cultivator skill for growth over time
- [x] Add mastery progression framework
- [x] Add knowledge-weaver with FalkorDB integration
- [x] Add Unix-style tools (remember, recall, ingest)
- [x] Add automatic discovery capture hook
- [ ] Add MCP server for environment queries
- [ ] Add session-start environmental snapshot
- [ ] Add `/explore status` for quick mastery overview
- [ ] Integration with awareness plugin for unified self-knowledge

## Version History

- **0.4.0** - Coherent ecosystem integration: Unix-style tools, references to llms:graphiti/agents:mem0, direct parsing pattern, auto-capture hook
- **0.3.0** - Added knowledge-weaver skill with Neo4j integration, bootstrap script
- **0.2.0** - Added curiosity-cultivator skill, mastery framework, discovery journaling
- **0.1.0** - Initial release with five core exploration skills

## License

MIT
