---
description: Browse and search the external plugin catalog
argument-hint: [search query]
---

# Observatory Catalog

Browse the external plugin catalog from davepoon/buildwithclaude and jeremylongshore/claude-code-plugins-plus-skills.

## Arguments

- `$ARGUMENTS` - Optional search query (e.g., "security", "python", "testing")

## Instructions

1. If a search query is provided, search the catalog for matching plugins
2. If no query, show an overview of the catalog

### For Overview (no query)

Read the sources configuration and summarize:
```
Read plugins/observatory/data/sources.yaml
```

Then read both curated catalogs and provide counts:
```
Read plugins/observatory/data/curated/davepoon.yaml
Read plugins/observatory/data/curated/jeremylongshore.yaml
```

Present a summary like:
```
## Plugin Observatory - Catalog Overview

### Sources

| Source | Components |
|--------|------------|
| davepoon/buildwithclaude | 35 agents, 8 commands, 5 hooks |
| jeremylongshore/plugins | 15 plugins, 6 MCP servers |

### Quick Stats
- Total catalog entries: ~60
- Capability domains: 25+

### Browse by Category
- Development: backend, frontend, mobile
- Languages: python, typescript, rust, go
- Quality: security, testing, code-review
- AI/Data: ai-ml, llm-tooling, rag

Use `/observatory:catalog <query>` to search for specific plugins.
```

### For Search (with query)

Search the curated YAML files for the query term:
```bash
grep -i -B2 -A5 "<query>" plugins/observatory/data/curated/*.yaml
```

Present matching plugins with:
- Name and source
- Description
- Capabilities/keywords
- Component type (agent/command/skill/hook/mcp)

Example output:
```
## Search Results for "security"

### 1. security-auditor (davepoon)
**Type**: Agent
**Capabilities**: security-audit

> Review code for vulnerabilities, implement secure authentication,
> and ensure OWASP compliance. Handles JWT, OAuth2, CORS, and encryption.

---

### 2. vulnerability-scan (davepoon)
**Type**: Hook
**Capabilities**: security-audit

> Scan for vulnerabilities on commit
```

## Tips

- Search by capability: "testing", "ai-ml", "devops"
- Search by type: "agent", "mcp"
- Search by language: "python", "rust"
