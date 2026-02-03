---
description: Open repository root as Obsidian vault with graph view guidance
---

# Open Obsidian Vault

Open the repository as an Obsidian vault for visual exploration of journal entries, logs, and documentation.

## What This Does

Opens the repository root in Obsidian, providing:
- **Graph view** of all markdown files with wikilinks
- **File explorer** for browsing journal entries
- **Search** across all content
- **Backlinks** panel showing connections

## Execution

```bash
# Open repository root as vault
VAULT_PATH="$(pwd)"

if [ -d "$VAULT_PATH/.obsidian" ]; then
    echo "Opening $VAULT_PATH in Obsidian..."
    xdg-open "obsidian://open?path=$VAULT_PATH" >/dev/null 2>&1 &
    echo "Obsidian is opening."
    echo ""
    echo "Quick tips:"
    echo "  Ctrl+G     - Open graph view"
    echo "  Ctrl+O     - Quick open file"
    echo "  Ctrl+Shift+F - Search all files"
    echo ""
    echo "Graph settings are in .obsidian/graph.json"
    echo "Current filter: $(grep -o '"search": "[^"]*"' .obsidian/graph.json 2>/dev/null || echo 'none')"
else
    echo "No .obsidian/ folder found at: $VAULT_PATH"
    echo ""
    echo "Creating minimal Obsidian configuration..."
    mkdir -p "$VAULT_PATH/.obsidian"
    cat > "$VAULT_PATH/.obsidian/app.json" << 'EOF'
{
  "vimMode": false,
  "showLineNumber": true,
  "strictLineBreaks": true
}
EOF
    cat > "$VAULT_PATH/.obsidian/graph.json" << 'EOF'
{
  "search": "path:.claude/journal/",
  "showTags": false,
  "showAttachments": false,
  "hideUnresolved": false,
  "showOrphans": false,
  "textFadeMultiplier": 0,
  "nodeSizeMultiplier": 0.48,
  "lineSizeMultiplier": 0.47,
  "centerStrength": 0.53,
  "repelStrength": 15.6,
  "linkStrength": 1,
  "linkDistance": 30
}
EOF
    echo "Created .obsidian/ with default settings"
    echo "Opening vault..."
    xdg-open "obsidian://open?path=$VAULT_PATH" >/dev/null 2>&1 &
fi
```

## Graph View Presets

After opening, you can switch graph filters by editing `.obsidian/graph.json`:

### Journal Only (Default)
```json
{"search": "path:.claude/journal/"}
```

### Logs Only
```json
{"search": "path:.claude/logging/"}
```

### Full Repository
```json
{"search": "-path:node_modules/ -path:.git/"}
```

## Troubleshooting

**Obsidian not opening?**
```bash
# Check if available
which obsidian || flatpak list | grep obsidian

# Direct command
obsidian "obsidian://open?path=$(pwd)"
```

**Graph view empty?**
- Check the `search` filter in graph settings (gear icon)
- Ensure files have `.md` extension
- Verify files contain `[[wikilinks]]`

**Labels not showing?**
- Set `textFadeMultiplier` to `0` in graph settings
- Or zoom in (labels appear at higher zoom)
