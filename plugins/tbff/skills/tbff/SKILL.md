---
name: tbff
description: Master skill for Threshold-Based Flow Funding. Sub-skills (4): orientation, mechanics, data-tools, notebooks. Invoke for TBFF context, data access, notebook development, and project understanding.
allowed-tools: Read, Skill, Task, Glob, Grep, Bash
---

# TBFF - Master Skill

## Overview

Threshold-Based Flow Funding (TBFF) is a mechanism for creating conditions for abundance through networked flow funding with threshold-based overflow dynamics.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **orientation** | New to TBFF, need context, starting a session | `subskills/orientation.md` |
| **mechanics** | Need details on thresholds, flows, pools | `subskills/mechanics.md` |
| **data-tools** | Working with experiment data, Python/JSON access | `subskills/data-tools.md` |
| **notebooks** | Managing Marimo notebooks, interactive exploration | `subskills/notebooks.md` |

## Data Access

### Quick Data Check
```bash
python3 plugins/tbff/skills/tbff/data/loader.py
```

### Data Files
| File | Contents | Records |
|------|----------|---------|
| `data/people.json` | Participants with thresholds | 37 |
| `data/networks.json` | Network entities | 3 |
| `data/experiments.json` | Funded experiments | 12 |
| `data/pool.json` | Community pool status | 1 |
| `data/rules.json` | Simple rules | 26 |
| `data/schema.md` | Full schema documentation | - |

### Python Access
```python
import sys
sys.path.insert(0, 'plugins/tbff/skills/tbff/data')
from loader import load_all, pool_health

data = load_all()
print(f"Participants: {data['people']['count']}")
```

## Notebooks

Marimo notebooks live in `plugins/tbff/skills/tbff/notebooks/`:

| Notebook | Purpose |
|----------|---------|
| `01-data-exploration.py` | Explore experiment data interactively |

### Run a Notebook
```bash
cd plugins/tbff/skills/tbff
marimo edit notebooks/01-data-exploration.py
```

## Quick Reference

### The Team

| Agent | Domain | Invoke For |
|-------|--------|------------|
| `tbff:myco-civic` | Biological metaphors, token engineering | Mechanism design through nature's lens |
| `tbff:frontend-engineer` | Web, TypeScript, visualization | Interfaces, Sankey diagrams, UX |
| `tbff:systems-data-scientist` | Python, Marimo, Panel, simulation | Prototyping, mechanism discovery |
| `tbff:grassroots-economist` | Economics, essays, clarity | First-principles, simplification |
| `tbff:project-manager` | Shipping, coordination | Priorities, blockers, deadlines |
| `tbff:liaison` | Ecosystem, infrastructure | Plugin health, agent orchestration |
| `tbff:marimo-specialist` | Reactive notebooks, WASM, browser Python | Marimo architecture, UI widgets, deployment |

### Key Documents

- **Requirements Transcript**: `.claude/transcripts/staging/2026-01-22-tbff-christina-dylan-jeff.md`
- **Micropunk Transcript**: `.claude/transcripts/staging/2026-01-29-tbff-mycopunks.md`
- **Project File**: `.claude/projects/opportunities/proj-ec14153c-tbff.md`
- **Convergence Map**: `.claude/planning/tbff-convergence-map.md`

### Demo Status

**Thursday, January 29, 2026** - Demo completed successfully. Micropunk convergence call brought together TBFF, ZK Network, Holons, and Federation.

## Deep Dive

Load sub-skills for detailed context:

```
Read subskills/orientation.md  → Full project context and vision
Read subskills/mechanics.md    → Technical mechanism details
Read subskills/data-tools.md   → Python/JSON data access patterns
Read subskills/notebooks.md    → Marimo notebook management
```
