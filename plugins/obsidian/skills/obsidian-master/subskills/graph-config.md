# Graph Configuration Sub-Skill

Configure Obsidian's graph view: filters, forces, colors, and appearance.

## Configuration File

Location: `.obsidian/graph.json`

## Filter Settings

### search (string)
Filter which nodes appear in the graph.

```json
{"search": "path:.claude/journal/"}     // Only journal files
{"search": "tag:#daily"}                 // Only files with #daily tag
{"search": "path:plugins/"}              // Only plugin files
{"search": "-path:node_modules/"}        // Exclude node_modules
{"search": "file:2025-12"}               // Files containing "2025-12"
```

**Combine filters:**
```json
{"search": "path:.claude/ -path:.claude/logging/"}
```

### showTags (boolean)
Show tag nodes (files with `#tags`). Default: `false`

### showAttachments (boolean)
Show image and file attachments. Default: `false`

### hideUnresolved (boolean)
Hide links to non-existent files. Default: `false`

### showOrphans (boolean)
Show files with no links. Default: `true`

## Appearance Settings

### textFadeMultiplier (0-1)
Controls when node labels appear:
- `0` = Always show labels (recommended for journal)
- `1` = Only show on zoom/hover
- `0.5` = Fade based on zoom level

### nodeSizeMultiplier (0-1)
Node size scaling. Default: ~0.48

### lineSizeMultiplier (0-1)
Edge thickness. Default: ~0.47

## Force Simulation Settings

Obsidian uses D3.js force-directed layout:

### centerStrength (0-1)
Pull toward center. Higher = tighter cluster.
- `0.3` = Loose, spread out
- `0.5` = Balanced (recommended)
- `0.8` = Tight central cluster

### repelStrength (0-20)
Node repulsion force. Higher = more spacing.
- `5` = Nodes overlap
- `10` = Normal spacing
- `15-20` = Well separated (recommended for dense graphs)

### linkStrength (0-1)
Edge tension. Higher = connected nodes stay closer.
- `0.3` = Loose connections
- `1.0` = Tight connections (default)

### linkDistance (10-100)
Target edge length in pixels.
- `30` = Compact (default)
- `50` = Medium
- `80` = Spread out

## Color Groups

Define colors for nodes matching queries:

```json
{
  "colorGroups": [
    {
      "query": "path:.claude/journal/2025/12/",
      "color": {"a": 1, "rgb": 5025616}
    },
    {
      "query": "tag:#daily",
      "color": {"a": 1, "rgb": 14701138}
    }
  ]
}
```

**RGB format**: Decimal integer (not hex). Convert:
- `#4C9F70` → `5025616`
- `#E0522E` → `14701138`

```python
# Convert hex to Obsidian RGB
int("4C9F70", 16)  # → 5025616
```

## Presets

### Journal-Focused (Recommended)
```json
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
```

### Full Repository Overview
```json
{
  "search": "-path:node_modules/ -path:.git/",
  "showTags": true,
  "hideUnresolved": true,
  "showOrphans": false,
  "textFadeMultiplier": 0.5,
  "repelStrength": 12,
  "centerStrength": 0.4
}
```

### Logging Sessions
```json
{
  "search": "path:.claude/logging/",
  "showOrphans": true,
  "textFadeMultiplier": 0,
  "repelStrength": 20,
  "linkDistance": 50
}
```

### Dense Knowledge Graph
```json
{
  "search": "",
  "hideUnresolved": false,
  "showOrphans": true,
  "textFadeMultiplier": 0,
  "nodeSizeMultiplier": 0.3,
  "lineSizeMultiplier": 0.3,
  "repelStrength": 25,
  "centerStrength": 0.6
}
```

## Applying Configuration

### Via File Edit
```bash
# Edit directly
cat > .obsidian/graph.json << 'EOF'
{
  "search": "path:.claude/journal/",
  "textFadeMultiplier": 0,
  "repelStrength": 15
}
EOF
```

### Via Obsidian UI
1. Open graph view (Ctrl+G)
2. Click gear icon (⚙️) in top-right
3. Adjust sliders and filters
4. Changes auto-save to graph.json

## Troubleshooting

### Graph is Empty
- Check `search` filter isn't too restrictive
- Ensure files have `.md` extension
- Verify vault path is correct

### Labels Not Showing
- Set `textFadeMultiplier: 0`
- Zoom in (labels appear at higher zoom)

### Nodes Overlapping
- Increase `repelStrength` (try 15-20)
- Increase `linkDistance` (try 50)
- Decrease `centerStrength` (try 0.3)

### Performance Slow
- Add restrictive `search` filter
- Set `showOrphans: false`
- Reduce node/line size multipliers
