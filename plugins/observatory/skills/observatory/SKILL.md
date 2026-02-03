---
name: observatory
description: >
  Master skill for Plugin Observatory. Discover, catalog, and analyze external Claude Code plugins
  from GitHub marketplaces. Sub-skills (3): catalog-browser (browse/search external plugins),
  gap-analyzer (compare local vs external capabilities), skills-explorer (search 739-skill catalog
  with full-text search). Invoke for plugin discovery, gap analysis, skill search, or exploring
  external marketplaces.
allowed-tools: Read, Glob, Grep, Bash, Skill
---

# Plugin Observatory - Master Skill

You are an expert at discovering and analyzing Claude Code plugins from external marketplaces.

## Purpose

The Plugin Observatory catalogs external plugins from:
- **davepoon/buildwithclaude**: 117 agents, 175 commands, 28 hooks, 50 plugins
- **jeremylongshore/claude-code-plugins-plus-skills**: 739 skills, 270+ plugins, 21 MCP servers
- **Memory Solutions**: 8 MCP servers and plugins for agent memory (curated cross-repo)

## Sub-Skills

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **catalog-browser** | Browse, search, or explore external plugins | `subskills/catalog-browser.md` |
| **gap-analyzer** | Compare local capabilities vs external offerings | `subskills/gap-analyzer.md` |
| **skills-explorer** | Search/browse 739-skill catalog with full-text search | `subskills/skills-explorer.md` |

## Quick Actions

### Browse External Plugins
Read the catalog-browser subskill and help the user explore available plugins:
```
Read subskills/catalog-browser.md
```

### Analyze Capability Gaps
Read the gap-analyzer subskill to identify what capabilities are missing locally:
```
Read subskills/gap-analyzer.md
```

### Search Skills Catalog
Read the skills-explorer subskill for full-text search across 739 skills:
```
Read subskills/skills-explorer.md
```

## Data Locations

- **Curated catalogs**: `plugins/observatory/data/curated/*.yaml`
- **Source config**: `plugins/observatory/data/sources.yaml`
- **Skills database**: `.claude/observatory/catalog/skills.db` (SQLite + FTS5)
- **Analysis output**: `.claude/observatory/analysis/`

## Capability Categories

The observatory tracks these capability domains:

**Development**: backend, frontend, mobile, api-design, database, devops-cicd
**Languages**: python, typescript, rust, go, java, ruby, php, c-cpp
**Quality**: code-review, testing, security-audit, debugging, performance
**AI/Data**: ai-ml, llm-tooling, embeddings, rag, data-engineering
**Business**: project-management, documentation, scheduling, finance
**Infrastructure**: cloud, containerization, monitoring, networking
**Specialized**: blockchain-web3, game-development, research, accessibility
**Agent Infrastructure**: agent-memory, context-management, knowledge-graph

## Commands

Users can invoke:
- `/observatory:catalog` - Browse and search the external plugin catalog
- `/observatory:gaps` - Run gap analysis between local and external plugins
