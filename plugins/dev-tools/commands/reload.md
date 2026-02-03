---
description: Clear plugin cache to reload changes (requires restart)
allowed-tools: Bash
args: plugin_name
---

# Reload Plugin

Clear the cache for a specific plugin or all local plugins.

## Usage

```
/dev-tools:reload obsidian      # Clear specific plugin
/dev-tools:reload all           # Clear all local plugin caches
```

## Execution

```bash
PLUGIN_NAME="${1:-}"
CACHE_BASE="$HOME/.claude/plugins/cache"
PLUGINS_DIR="$(pwd)/plugins"

if [ -z "$PLUGIN_NAME" ]; then
    echo "Usage: /dev-tools:reload <plugin_name|all>"
    echo ""
    echo "Available local plugins:"
    ls -1 "$PLUGINS_DIR" 2>/dev/null | grep -v "^$" || echo "  (none found)"
    exit 0
fi

cleared=0

if [ "$PLUGIN_NAME" = "all" ]; then
    echo "Clearing cache for all local plugins..."
    for plugin in "$PLUGINS_DIR"/*; do
        if [ -d "$plugin" ]; then
            name=$(basename "$plugin")
            for source in "$CACHE_BASE"/*; do
                if [ -d "$source/$name" ]; then
                    rm -rf "$source/$name"
                    echo "  Cleared: $name"
                    cleared=$((cleared + 1))
                fi
            done
        fi
    done
else
    echo "Clearing cache for plugin: $PLUGIN_NAME"
    for source in "$CACHE_BASE"/*; do
        if [ -d "$source/$PLUGIN_NAME" ]; then
            rm -rf "$source/$PLUGIN_NAME"
            echo "  Cleared: $source/$PLUGIN_NAME"
            cleared=$((cleared + 1))
        fi
    done
fi

if [ $cleared -eq 0 ]; then
    echo "No cache found for '$PLUGIN_NAME'"
else
    echo ""
    echo "Cache cleared. Restart Claude Code to apply changes."
fi
```

## After Clearing

You still need to restart Claude Code for changes to take effect. The cache clearing just ensures the next session loads fresh code.

## Tip

The dev-tools plugin automatically clears caches when you Edit/Write plugin files. This command is for manual clearing when needed.
