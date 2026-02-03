---
description: Open the logging directory in Obsidian as a vault
---

# Open Logs in Obsidian

Open the conversation log directory in Obsidian for visual exploration, graph view, and search.

## What This Does

Opens `.claude/logging/` as an Obsidian vault, allowing you to:
- Browse session logs visually
- Use Obsidian's graph view to see connections
- Search across all conversation history
- Use Obsidian's backlinks and outline features

## Execution

Run the following command to open Obsidian:

```bash
# Get the absolute path to the logging directory
LOGGING_DIR="$(pwd)/.claude/logging"

# Check if the directory exists
if [ -d "$LOGGING_DIR" ]; then
    echo "Opening $LOGGING_DIR in Obsidian..."
    # Suppress all output and background to prevent Obsidian's debug logs from consuming context
    xdg-open "obsidian://open?path=$LOGGING_DIR" >/dev/null 2>&1 &
    echo "Obsidian should now be opening with your logs."
    echo "Tip: Press Ctrl+G for graph view"
else
    echo "Logging directory not found at: $LOGGING_DIR"
    echo "Have you used Claude Code logging in this project?"
fi
```

## After Opening

Once Obsidian opens:

1. **First time**: Obsidian will ask to "Trust author and enable plugins" or "Restricted mode" - either works for viewing logs
2. **Graph view**: Press `Ctrl+G` to see all sessions as nodes
3. **Search**: Press `Ctrl+Shift+F` to search across all logs
4. **Daily notes**: Each session is timestamped - browse by date in the file tree

## Tips

- The logs are organized by date: `YYYY/MM/DD/HH-MM-SS-{session}.md`
- Each `.md` file is a human-readable conversation log
- The `.jsonl` files contain the raw data (source of truth)
- Collapsible `<details>` sections may not render in Obsidian's reading view - use edit mode

## Troubleshooting

**Obsidian not installed?**
```bash
# Check if obsidian is available
which obsidian || echo "Obsidian not found in PATH"

# On Linux, install via:
# - AppImage from https://obsidian.md/download
# - Snap: sudo snap install obsidian --classic
# - Flatpak: flatpak install flathub md.obsidian.Obsidian
```

**xdg-open not working?**
```bash
# Try opening directly
obsidian "obsidian://open?path=$(pwd)/.claude/logging"
```
