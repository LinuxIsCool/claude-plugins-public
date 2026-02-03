---
name: exploration
description: Master skill for environmental self-discovery (7 sub-skills). Covers: substrate-scanner (host/OS), network-prober (connectivity), tool-cartographer (capabilities), context-archaeologist (history), knowledge-weaver (graph), curiosity-cultivator (journaling), cosmos-contemplator (philosophy). Invoke for exploring the environment Claude runs in.
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Exploration Plugin - Master Skill

Environmental self-discovery and curiosity-driven exploration.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **substrate-scanner** | Exploring host machine, OS, hardware, filesystems | `subskills/substrate-scanner.md` |
| **network-prober** | Network connectivity, Docker, services, reachability | `subskills/network-prober.md` |
| **tool-cartographer** | Mapping tools, MCP servers, subagents, plugins | `subskills/tool-cartographer.md` |
| **context-archaeologist** | Git history, file timestamps, project evolution | `subskills/context-archaeologist.md` |
| **knowledge-weaver** | Building knowledge graph from discoveries | `subskills/knowledge-weaver.md` |
| **curiosity-cultivator** | Discovery journaling, question generation | `subskills/curiosity-cultivator.md` |
| **cosmos-contemplator** | Philosophy, natural laws, broader context | `subskills/cosmos-contemplator.md` |

## Concentric Circle Model

```
┌─────────────────────────────────────────────┐
│              COSMOS (Philosophy)             │
│  ┌───────────────────────────────────────┐  │
│  │           NETWORK (Connectivity)       │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │       SUBSTRATE (Host/OS)        │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │     TOOLS (Capabilities)   │  │  │  │
│  │  │  │  ┌─────────────────────┐  │  │  │  │
│  │  │  │  │  CONTEXT (History)   │  │  │  │  │
│  │  │  │  └─────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## How to Use

### Quick Reference
Use the index to match curiosity to sub-skill.

### Deep Dive
```
Read: plugins/exploration/skills/exploration-master/subskills/{name}.md
```

## Sub-Skill Summaries

**substrate-scanner** - Explore the host machine. OS, hardware, resources, filesystems. Understand the local environment.

**network-prober** - Explore network topology. Docker containers, local services, external reachability.

**tool-cartographer** - Map available capabilities. Tools, MCP servers, Claude Code features, subagents, plugins.

**context-archaeologist** - Uncover history. Git history, file timestamps, project evolution, user patterns.

**knowledge-weaver** - Connect discoveries. Build knowledge graph with Neo4j/Graphiti. Enable relational queries.

**curiosity-cultivator** - Compound learning. Discovery journaling, question generation, progression tracking.

**cosmos-contemplator** - Broader context. Natural laws, computational theory, philosophy, perspective.
