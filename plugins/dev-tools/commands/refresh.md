---
description: Clear plugin cache and trigger rebuild (updates all Claude instances)
allowed-tools: Bash
args: plugin_name
---

# Refresh Plugins

Clear the cache and trigger a rebuild so all running Claude instances see the updates.

## Usage

```
/dev-tools:refresh              # Refresh all plugins
/dev-tools:refresh awareness    # Refresh specific plugin
```

## How It Works

1. Clears the plugin cache
2. Spawns a headless Claude instance to rebuild the cache
3. Other running instances read from the refreshed cache

## Execution

```bash
PLUGIN_NAME="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Use the refresh script
bash "$SCRIPT_DIR/tools/refresh-plugins.sh" "$PLUGIN_NAME"
```

## Note

This is more thorough than `/dev-tools:reload` because it also triggers the cache rebuild. Use this when you want changes to propagate to other running Claude instances.
