---
name: catalog-browser
description: Browse and search the external plugin catalog from davepoon and jeremylongshore repositories.
---

# Catalog Browser Sub-Skill

## Purpose

Help users explore the external plugin catalog to discover useful plugins, agents, commands, and skills from the Claude Code community.

## Data Sources

The catalog is built from curated YAML files:

1. **davepoon/buildwithclaude** (`data/curated/davepoon.yaml`)
   - 35+ agents across 11 categories
   - Commands for version control, testing, documentation
   - Hooks for notifications and automation

2. **jeremylongshore/claude-code-plugins-plus-skills** (`data/curated/jeremylongshore.yaml`)
   - Production-ready plugins (Google ADK, Vertex AI, Genkit, Excel Analyst)
   - MCP servers for project health, API debugging, design-to-code
   - 739 skills across multiple domains

## How to Browse

### List All Sources
```bash
cat plugins/observatory/data/sources.yaml
```

### Search by Capability
Read the curated YAML files and filter by capability:
```bash
grep -l "security" plugins/observatory/data/curated/*.yaml
```

### View Plugin Details
```bash
cat plugins/observatory/data/curated/davepoon.yaml | grep -A5 "name: security-auditor"
```

## Search Patterns

When users ask for plugins, search by:

1. **Capability domain**: "backend-development", "security-audit", "ai-ml"
2. **Component type**: "agent", "command", "skill", "hook", "mcp-server"
3. **Language**: "python", "typescript", "rust", "go"
4. **Keyword**: Free-text search in names and descriptions

## Response Format

When presenting plugins to users, include:

```markdown
## [Plugin Name]

**Source**: davepoon/buildwithclaude
**Type**: Agent
**Capabilities**: backend-development, api-design

**Description**: [description]

**Repository**: [GitHub URL]
```

## Example Queries

- "Show me security-related plugins" → Filter by `security-audit` capability
- "What agents are available for Python?" → Filter by `python` capability + `agent` type
- "Find MCP servers" → Filter by `mcp-server` component type
- "Show me testing tools" → Filter by `testing` capability

## Integration Tip

After finding a useful plugin, the user can:
1. Visit the GitHub repository to review the code
2. Clone the plugin locally to `experiments/` for testing
3. Request integration via the full observatory workflow (future phase)
