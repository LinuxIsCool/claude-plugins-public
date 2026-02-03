---
name: skills-explorer
description: Search and explore the 739-skill catalog from jeremylongshore repository with full-text search.
---

# Skills Explorer Sub-Skill

## Purpose

Explore individual skills from the `jeremylongshore/claude-code-plugins-plus-skills` repository using a SQLite database with full-text search capabilities.

## Architecture

The skills catalog uses:
- **SQLite + FTS5**: Full-text search with porter stemming
- **GitHub API**: Incremental indexing via SHA change detection
- **SKILL.md parsing**: Extracts frontmatter metadata (description, allowed-tools)
- **Capability inference**: Auto-tags skills based on keywords and tools

## CLI Commands

### Index Skills from GitHub

```bash
# Full re-index (fetches all 739 skills)
cd plugins/observatory && bun run skills index --full

# Incremental update (only changed skills)
cd plugins/observatory && bun run skills index --incremental
```

### Search Skills

```bash
# Search by keyword
bun run skills search "typescript"
bun run skills search "api backend"
bun run skills search "testing"

# With verbose output
bun run skills search "security" --verbose
```

### Browse by Plugin

```bash
# List all plugins
bun run skills plugins

# Show skills in a specific plugin
bun run skills plugin all-agents
bun run skills plugin feature-dev
```

### Find by Capability

```bash
# Find skills with specific capabilities
bun run skills capability testing
bun run skills capability security-audit
bun run skills capability ai-ml
```

### View Skill Details

```bash
# Show full skill information
bun run skills show jeremylongshore-plugins/all-agents/typescript-expert
```

### Catalog Statistics

```bash
bun run skills stats
```

## Database Schema

Skills are stored in `.claude/observatory/catalog/skills.db`:

| Field | Description |
|-------|-------------|
| id | Unique: `{source}/{plugin}/{skill}` |
| source | Repository identifier |
| plugin_name | Parent plugin directory |
| skill_name | Skill name from frontmatter |
| description | Full description text |
| allowed_tools | JSON array of tool names |
| subskills | JSON array of subskill filenames |
| capabilities | Auto-inferred capability tags |
| git_sha | For incremental update detection |
| last_indexed | ISO timestamp |

## Capability Categories

Skills are auto-tagged with capabilities based on keywords:

**Development**: `backend-development`, `frontend-development`, `api-design`, `database-management`, `devops-cicd`

**Languages**: `python`, `typescript`, `javascript`, `rust`, `go`, `java`, `ruby`, `php`

**Quality**: `code-review`, `testing`, `security-audit`, `performance-optimization`, `debugging`

**AI/Data**: `ai-ml`, `llm-tooling`, `embeddings`, `rag`

**Infrastructure**: `cloud-infrastructure`, `containerization`, `monitoring`

## Example Workflows

### Finding Skills for a Task

1. Search by keyword: `bun run skills search "graphql api"`
2. Browse matching plugins: `bun run skills plugin graphql-architect`
3. View details: `bun run skills show jeremylongshore-plugins/all-agents/graphql-architect`

### Comparing Capabilities

1. Get stats: `bun run skills stats`
2. Find capability coverage: `bun run skills capability testing`
3. Cross-reference with local plugins

### Keeping Catalog Fresh

```bash
# Weekly: incremental update
bun run skills index --incremental

# Monthly: full re-index
bun run skills index --full
```

## Programmatic Access

For agents and scripts, import the database directly:

```typescript
import { SkillsDatabase } from "./src/catalog/skills-db.js";

const db = new SkillsDatabase();
const results = db.search("typescript", { limit: 10 });
const stats = db.getStats();
db.close();
```

## Integration with Gap Analysis

The skills database enhances gap analysis by providing:
1. **Fine-grained matching**: Match local needs to specific skills, not whole plugins
2. **Tool-based discovery**: Find skills that use specific Claude tools
3. **Capability mapping**: Identify skills that fill local capability gaps
