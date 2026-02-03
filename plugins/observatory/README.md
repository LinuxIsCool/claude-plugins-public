# Plugin Observatory

Discover, catalog, and analyze external Claude Code plugins from GitHub marketplaces.

## Overview

The Plugin Observatory helps you explore the broader Claude Code plugin ecosystem by:

1. **Cataloging** external plugins from community repositories
2. **Analyzing gaps** between your local plugins and what's available externally
3. **Recommending** plugins to enhance your capabilities

## Sources

Currently tracking two major plugin repositories:

| Source | Components |
|--------|------------|
| [davepoon/buildwithclaude](https://github.com/davepoon/buildwithclaude) | 117 agents, 175 commands, 28 hooks, 50 plugins |
| [jeremylongshore/claude-code-plugins-plus-skills](https://github.com/jeremylongshore/claude-code-plugins-plus-skills) | 739 skills, 270+ plugins, 21 MCP servers |

## Commands

### Browse the Catalog

```
/observatory:catalog [search query]
```

Examples:
- `/observatory:catalog` - Show catalog overview
- `/observatory:catalog security` - Search for security-related plugins
- `/observatory:catalog python` - Find Python specialist agents

### Analyze Capability Gaps

```
/observatory:gaps [--detail | --summary]
```

Compares your local plugins against the external catalog to identify missing capabilities.

## Skills

The observatory skill (`observatory`) provides guidance for:
- Browsing and searching the catalog
- Running gap analysis
- Understanding capability domains

### Sub-Skills

| Sub-Skill | Purpose |
|-----------|---------|
| `catalog-browser` | Browse and search external plugins |
| `gap-analyzer` | Compare local vs external capabilities |

## Data Structure

```
plugins/observatory/
├── data/
│   ├── sources.yaml              # Repository configuration
│   └── curated/
│       ├── davepoon.yaml         # Curated catalog entries
│       └── jeremylongshore.yaml
├── src/
│   ├── catalog/                  # Catalog loading & search
│   └── analysis/                 # Gap detection
├── skills/observatory/           # Skill definitions
└── commands/                     # Slash commands
```

## Capability Domains

The observatory tracks plugins across these domains:

**Development**: backend, frontend, mobile, api-design, database, devops-cicd

**Languages**: python, typescript, rust, go, java, ruby, php, c-cpp

**Quality**: code-review, testing, security-audit, debugging, performance

**AI/Data**: ai-ml, llm-tooling, embeddings, rag, data-engineering

**Business**: project-management, documentation, scheduling, finance

**Infrastructure**: cloud, containerization, monitoring, networking

**Specialized**: blockchain-web3, game-development, research, accessibility

## Future Phases

This is Phase 1 (MVP). Future enhancements include:

- **Phase 2**: Git sparse checkout for full plugin caching
- **Phase 3**: Sandbox evaluation workflow
- **Phase 4**: Automated integration pipeline

## Contributing

To add new sources or update curated catalogs:

1. Edit `data/sources.yaml` to add new repositories
2. Create a new YAML file in `data/curated/` following the existing format
3. Run gap analysis to verify the changes
