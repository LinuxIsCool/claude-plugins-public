---
name: obsidian-master
description: Master skill for Obsidian vault management and visualization (6 sub-skills). Covers vault-manager, wikilink-injector, graph-config, quartz-pipeline, vault-health, link-patterns. Invoke for vault operations, graph configuration, wikilink automation, or Quartz deployment.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Task
---

# Obsidian Master Skill

Comprehensive Obsidian integration for Claude Code: vault management, automatic wikilink injection, graph configuration presets, and Quartz static site deployment.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **vault-manager** | Opening vaults, configuring .obsidian/ settings, managing vault state | `subskills/vault-manager.md` |
| **wikilink-injector** | Understanding auto-injection patterns, manual link insertion, link syntax | `subskills/wikilink-injector.md` |
| **graph-config** | Configuring graph view presets, filters, colors, forces, appearance | `subskills/graph-config.md` |
| **quartz-pipeline** | Building Quartz sites, deploying to GitHub Pages, customizing themes | `subskills/quartz-pipeline.md` |
| **vault-health** | Checking for broken links, orphan files, naming conventions | `subskills/vault-health.md` |
| **link-patterns** | Journal wikilink conventions, temporal hierarchy, cross-referencing | `subskills/link-patterns.md` |

## Quick Reference

### Vault Location
The primary vault is at the repository root (where `.obsidian/` is located).

Configuration stored in `.obsidian/`:
- `app.json` - Application settings
- `graph.json` - Graph view configuration
- `workspace.json` - Layout and open files

### Wikilink Syntax
```markdown
[[target]]              # Basic link
[[target|alias]]        # Link with display text
[[target#heading]]      # Link to specific heading
[[folder/target]]       # Link with path (rarely needed)
```

### Graph Configuration Keys
```json
{
  "search": "path:.claude/journal/",  // Filter nodes
  "showTags": false,
  "textFadeMultiplier": 0,            // 0 = always show labels
  "nodeSizeMultiplier": 0.48,
  "repelStrength": 15.6,              // Higher = more spread
  "centerStrength": 0.53,
  "linkDistance": 30
}
```

### Automatic Wikilink Injection

The PostToolUse hook automatically injects wikilinks when:
- **Write/Edit** touches files in `.claude/journal/`
- **Write/Edit** touches files in `.claude/planning/`
- **Write/Edit** touches files in `.claude/logging/`

Injection patterns:
- Daily entries link to parent monthly: `[[2025-12]]`
- Atomic entries link to parent daily: `[[2025-12-17]]`
- Cross-references use `[[filename]]` without path

## Usage

1. **Open vault**: Use `/obsidian:vault` command
2. **Configure graph**: Read `subskills/graph-config.md` then edit `.obsidian/graph.json`
3. **Check health**: Spawn `obsidian:vault-health` agent
4. **Deploy to web**: Read `subskills/quartz-pipeline.md`

## Agents Available

| Agent | Subagent Type | Purpose |
|-------|--------------|---------|
| Graph Curator | `obsidian:graph-curator` | Maintain graph connectivity, prune orphans |
| Link Suggester | `obsidian:link-suggester` | Suggest missing wikilinks between related content |
| Vault Health | `obsidian:vault-health` | Audit broken links, naming issues, structure |
| Visualizer | `obsidian:visualizer` | Quartz deployment, graph rendering, D3/PixiJS |

## Integration Points

### With Journal Plugin
Journal creates atomic entries → Obsidian visualizes as graph nodes → Wikilinks form edges

### With Logging Plugin
Log sessions are markdown → Can be opened as vault → Graph shows session relationships

### With Knowledge-Graphs Plugin
FalkorDB temporal knowledge → Bridge to Quartz content index → Web-accessible graph views
