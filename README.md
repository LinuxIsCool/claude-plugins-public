# claude-plugins-public

A Claude Code plugin marketplace with 36 plugins, 90+ agents, and hundreds of skills and sub-skills for AI development, knowledge management, productivity, and ecosystem orchestration.

## Quick Start

### 1. Add the Marketplace

```
/plugin marketplace add LinuxIsCool/claude-plugins-public
```

### 2. Install Plugins

```
/plugin install awareness@linuxiscool-claude-plugins-public
/plugin install logging@linuxiscool-claude-plugins-public
/plugin install journal@linuxiscool-claude-plugins-public
/plugin install search@linuxiscool-claude-plugins-public
```

### 3. Manage

```
/plugin marketplace list                                      # List installed marketplaces
/plugin marketplace update linuxiscool-claude-plugins-public   # Update marketplace to latest
/plugin disable logging@linuxiscool-claude-plugins-public      # Disable a plugin
/plugin enable logging@linuxiscool-claude-plugins-public       # Enable a plugin
```

### Prerequisites

**[uv](https://docs.astral.sh/uv/)** is required for plugin hooks that use Python scripts.

## Plugins (36)

### Developer Tools (9)

| Plugin | Description |
|--------|-------------|
| **autocommit** | Intelligent version control that commits based on human-agent collaboration signals |
| **browser** | Extract open tabs from Brave browser session files |
| **dev-tools** | Developer experience tools including automatic plugin cache invalidation |
| **git-flow** | Git worktree-based workflow for per-session feature branches and PR automation |
| **perf** | On-demand performance profiling and optimization for Claude Code sessions |
| **plug** | Declarative plugin manager for Claude Code (install, sync, update, lock) |
| **search** | Hybrid search across code repositories with RAG pipelines |
| **skills** | Meta-plugin for skill development, discovery, and creation guidance |
| **statusline** | Instance identity and statusline management for multi-Claude coordination |

### Knowledge & Memory (6)

| Plugin | Description |
|--------|-------------|
| **agents** | AI agent frameworks (CrewAI, LangChain, OpenAI Agents) with multi-agent orchestration |
| **hipporag** | Neurobiologically-inspired RAG with OpenIE knowledge graphs and Personalized PageRank |
| **knowledge-graphs** | Graph databases, temporal KGs, and AI memory systems |
| **llms** | LLM tools, embeddings, and AI frameworks with progressive mastery patterns |
| **memory** | Agent memory system with hot/warm/cold tiers and automatic context injection |
| **evaluation** | Automated system evaluation using HippoRAG and multi-dimensional quality assessment |

### Productivity (7)

| Plugin | Description |
|--------|-------------|
| **brainstorm** | Structured brainstorming with organized exploration |
| **cards** | Morphological data modeling for Claude Code |
| **conductor** | Central consciousness for ecosystem orchestration and user understanding |
| **cook** | Meta-orchestration engine for recursive self-improvement |
| **journal** | Obsidian-style linked journaling with zettelkasten atomic notes |
| **projects** | Project and opportunity tracking with real-time priority ranking |
| **Schedule.md** | Markdown-native weekly schedule manager with visual web interface |

### Communication (5)

| Plugin | Description |
|--------|-------------|
| **agentnet** | Social network for AI agents with profiles, walls, and DMs |
| **messages** | Universal messaging backbone with content-addressed messages and DID-based identity |
| **observatory** | Discover, catalog, and analyze external Claude Code plugins from GitHub |
| **transcripts** | Transcript management with voice fingerprinting and knowledge extraction |
| **voice** | Voice input/output with TTS feedback and agent-specific voices |

### Meta/Ecosystem (5)

| Plugin | Description |
|--------|-------------|
| **awareness** | Self-awareness and learning plugin for systematic documentation mastery |
| **exploration** | Environmental curiosity plugin for systematic substrate and tool discovery |
| **interface** | Navigate the vertical interface stack (tmux, nvim, fish, etc.) |
| **library** | Universal resource library with content-addressed storage and citation graphs |
| **obsidian** | Obsidian vault management, wikilink injection, and Quartz deployment |

### Domain-Specific (3)

| Plugin | Description |
|--------|-------------|
| **company** | Personal board of advisors for strategy, legal, and finance |
| **tbff** | Threshold-Based Flow Funding: multi-agent team for regenerative economics |
| **logging** | Full-fidelity session logging with AI-summarized Markdown reports |

### Infrastructure (1)

| Plugin | Description |
|--------|-------------|
| **temporal** | Continuous temporal awareness via timestamp injection at conversation events |

## Architecture

### Master Skill Pattern

Claude Code has a ~15,000 character budget for skill descriptions. This marketplace uses **progressive disclosure** to stay within budget while exposing hundreds of capabilities:

```
plugins/{name}/skills/
└── {master-skill}/
    ├── SKILL.md           # One discoverable master skill per plugin
    └── subskills/         # Loaded on-demand via Read tool
        ├── sub1.md
        └── ...
```

Each plugin exposes one master `SKILL.md` that Claude Code discovers automatically. Sub-skills are loaded on-demand when the master skill determines they're relevant.

### Plugin Agents

Plugins can define **subagents** available via the `Task` tool:

```
plugins/{name}/
├── .claude-plugin/
│   └── plugin.json        # "agents": ["./agents/agent.md"]
└── agents/
    └── {agent-name}.md    # YAML frontmatter + system prompt
```

Agent definitions use YAML frontmatter:

```yaml
---
name: agent-name
description: What the agent does (shown in Task tool)
tools: Read, Grep, Glob, Bash
model: sonnet
---

# Agent identity and system prompt...
```

Agents are namespaced as `{plugin}:{agent}` (e.g., `awareness:mentor`, `journal:scribe`).

### Directory Structure

```
.
├── .claude-plugin/
│   └── marketplace.json       # Plugin registry
├── .claude/
│   ├── agents/                # Project-level agents (11)
│   ├── registry/              # Fleet catalogue and process mapping
│   ├── conventions/           # Coordination patterns
│   └── journal/               # Cross-session memory
├── CLAUDE.md                  # Project instructions
├── plugins/                   # All 36 plugins
└── resources/                 # Reference materials
```

## Agent Fleet

### Project Agents (11)

Located in `.claude/agents/`, these provide cross-cutting capabilities:

| Agent | Purpose |
|-------|---------|
| **agent-architect** | Fleet management and cataloguing |
| **archivist** | Internal artifact observation |
| **backend-architect** | Technical architecture analysis |
| **conductor** | Ecosystem orchestration |
| **git-historian** | Repository state reconstruction |
| **librarian** | External URL/citation management |
| **process-cartographer** | Process and workflow mapping |
| **qa-engineer** | Testing and quality validation |
| **systems-thinker** | Systems dynamics perspective |
| **temporal-validator** | Staleness detection and truth tracking |
| **tui-specialist** | Terminal UI architecture |

### Plugin Agents (81)

Each plugin can provide specialized agents. Agents coordinate through **git and the filesystem**: write to designated namespaces, read from anywhere, commit with structured messages.

## Development

### Modify a Plugin

1. Edit source files in `plugins/{name}/`
2. Clear cache: `rm -rf ~/.claude/plugins/cache/claude-plugins-public/{name}/`
3. Restart Claude Code

### Add a Plugin Agent

1. Create `plugins/{name}/agents/{agent}.md` with YAML frontmatter
2. Add to `plugin.json`: `"agents": ["./agents/{agent}.md"]`
3. Clear cache and restart

### Create a Skill

1. Create `plugins/{name}/skills/{skill}/SKILL.md`
2. Add sub-skills in `subskills/` directory
3. Reference sub-skills from the master SKILL.md index

## License

MIT
