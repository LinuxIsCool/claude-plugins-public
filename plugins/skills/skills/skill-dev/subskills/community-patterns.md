# Community Skill Patterns

Patterns from BuildWithClaude registry and jeremylongshore/claude-code-plugins-plus-skills.

## BuildWithClaude Registry

Source: https://www.buildwithclaude.com/skills

### Notable Skills

| Skill | Pattern | Key Feature |
|-------|---------|-------------|
| **Artifacts Builder** | Creation + Deployment | Builds React artifacts, bundles to single HTML |
| **Changelog Generator** | Git Analysis | Transforms commits to user-friendly notes |
| **Design Philosophy Creator** | Document Generation | Museum-quality PDFs with meticulous craft |
| **File Organizer** | Analysis + Transformation | Analyzes folders, proposes hierarchies |
| **Invoice Organizer** | Data Extraction + Filing | Extracts vendor/date/amount, organizes by category |

### Common Themes

1. **Pristine Craftsmanship** - Emphasis on expert-level execution
2. **Batch Processing** - Handle multiple items efficiently
3. **User Approval Gates** - Confirm before destructive operations
4. **Output Preservation** - Keep originals while organizing copies

## claude-code-plugins-plus-skills Repository

Source: https://github.com/jeremylongshore/claude-code-plugins-plus-skills

### Scale
- **270+ plugins**
- **739 skills**
- **17,000+ files**

### Repository Structure

```
plugins/
├── mcp/              # MCP server plugins (~2%)
├── [category]/       # AI instruction plugins (~98%)
└── saas-packs/       # SaaS skill packs

marketplace/          # Astro website
packages/            # CLI, validator, analytics
```

### Plugin Categories

| Category | Count | Examples |
|----------|-------|----------|
| Development | 834 | fullstack-engineer, code-review |
| Productivity | 533 | file-organizer, task-manager |
| Security | 96 | access-control-auditor |
| AI/ML | 71 | model-trainer, embeddings |

### Skills Standard (6767-b)

The repository defines a comprehensive skills standard:

**Required Frontmatter:**
```yaml
---
name: skill-name          # Required
description: ...          # Required
allowed-tools: ...        # Required for marketplace
version: 1.0.0            # Required for marketplace
author: Name <email>      # Required for marketplace
license: MIT              # Required for marketplace
tags: [category]          # Recommended
---
```

**Body Requirements:**
- Under 500 lines
- Imperative voice
- `{baseDir}` for paths
- 2-3 concrete examples
- 4+ errors with solutions
- One-level-deep references

### Plugin Structure Pattern

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/
│   └── *.md
├── agents/
│   └── *.md
└── skills/
    └── skill-name/
        └── SKILL.md
```

### Validation Commands

```bash
# Full validation
./scripts/validate-all-plugins.sh

# Quick test
./scripts/quick-test.sh

# Schema validation
python3 scripts/validate-skills-schema.py
```

## Pattern: Skill Adapter

Many plugins include a `skill-adapter` pattern:

```
plugin-name/
└── skills/
    └── skill-adapter/
        ├── SKILL.md
        ├── scripts/
        ├── references/
        └── assets/
```

**Purpose**: Adapt existing plugin functionality to skill interface.

## Pattern: Two Catalog System

| File | Purpose | Edit? |
|------|---------|-------|
| `marketplace.extended.json` | Source of truth | Yes |
| `marketplace.json` | CLI-compatible | Never |

Run `pnpm run sync-marketplace` after editing extended.

## Pattern: SaaS Packs

Bundled skills for specific SaaS platforms:

```
saas-packs/
├── notion-pack/
├── slack-pack/
├── github-pack/
└── stripe-pack/
```

Each pack provides:
- API integration skills
- Common workflow skills
- Platform-specific patterns

## Lessons from Scale

### 1. Naming Matters
With 739 skills, descriptive names prevent confusion:
- `pdf-processing` not `helper`
- `git-commit-generator` not `git-tool`

### 2. Category Organization
Group by function:
- Development, Productivity, Security, AI/ML

### 3. Validation Pipeline
Automated checks prevent broken skills:
- Schema validation
- Frontmatter checks
- Reference resolution

### 4. Documentation Standards
Consistent structure across all skills:
- Same sections
- Same voice
- Same example format

### 5. Version Control
Semantic versioning for skill evolution:
- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes
