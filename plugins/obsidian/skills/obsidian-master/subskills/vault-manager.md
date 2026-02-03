# Vault Manager Sub-Skill

Manage Obsidian vaults: open, configure, and customize `.obsidian/` settings.

## Vault Locations

### Primary Vault (Repository Root)
```

├── .obsidian/           # Obsidian configuration
│   ├── app.json         # App settings (vim mode, etc.)
│   ├── graph.json       # Graph view configuration
│   ├── workspace.json   # Layout state
│   └── plugins/         # Community plugins (if any)
├── .claude/
│   ├── journal/         # Atomic entries (graph nodes)
│   ├── logging/         # Session logs
│   └── planning/        # Planning documents
└── plugins/             # Claude Code plugins
```

### Opening a Vault

```bash
# Open specific path as vault
xdg-open "obsidian://open?path=/path/to/vault" >/dev/null 2>&1 &

# Open repo root
xdg-open "obsidian://open?path=$(pwd)" >/dev/null 2>&1 &
```

**Important**: Always redirect output and background the process to prevent debug logs from consuming context.

## .obsidian/ Configuration Files

### app.json - Application Settings
```json
{
  "vimMode": true,
  "defaultViewMode": "source",
  "showLineNumber": true,
  "spellcheck": true,
  "strictLineBreaks": true
}
```

### graph.json - Graph View Settings
```json
{
  "search": "",                    // Filter expression
  "showTags": false,               // Show tag nodes
  "showAttachments": false,        // Show image/file nodes
  "hideUnresolved": false,         // Hide broken links
  "showOrphans": true,             // Show unlinked files
  "textFadeMultiplier": 0,         // 0-1, 0 = always show labels
  "nodeSizeMultiplier": 0.48,      // Node scale
  "lineSizeMultiplier": 0.47,      // Edge thickness
  "centerStrength": 0.53,          // Pull to center
  "repelStrength": 15.6,           // Node repulsion
  "linkStrength": 1,               // Edge tension
  "linkDistance": 30               // Target edge length
}
```

### workspace.json - Layout State
Contains current tabs, panes, and open files. Generally managed by Obsidian, not manually edited.

## Graph View Presets

### Journal Focus
```json
{
  "search": "path:.claude/journal/",
  "showOrphans": false,
  "textFadeMultiplier": 0,
  "repelStrength": 15
}
```

### Logging Focus
```json
{
  "search": "path:.claude/logging/",
  "showOrphans": true,
  "repelStrength": 20
}
```

### Full Repository
```json
{
  "search": "",
  "hideUnresolved": true,
  "textFadeMultiplier": 0.3
}
```

## Creating New Vaults

Obsidian vaults are just directories with `.obsidian/` folder:

```bash
mkdir -p /new/vault/.obsidian
echo '{}' > /new/vault/.obsidian/app.json
```

## Plugin Installation

Community plugins go in `.obsidian/plugins/`:
```
.obsidian/plugins/
└── plugin-id/
    ├── main.js
    ├── manifest.json
    └── styles.css
```

## Troubleshooting

### Vault Not Opening
```bash
# Check if Obsidian is installed
which obsidian || echo "Not in PATH"

# Try direct command
obsidian "obsidian://open?path=$(pwd)"
```

### Graph Not Showing Expected Files
1. Check `search` filter in graph.json
2. Verify files have `.md` extension
3. Ensure files aren't in `.obsidianignore`

### Performance with Large Vaults
- Use `search` filter to limit visible nodes
- Reduce `nodeSizeMultiplier` and `lineSizeMultiplier`
- Disable `showOrphans` to reduce node count
