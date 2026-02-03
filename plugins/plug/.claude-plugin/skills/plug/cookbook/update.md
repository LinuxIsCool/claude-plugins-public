# Update Plugins Cookbook

Update one or all installed plugins.

## Arguments

- `$1` (optional): Plugin name to update. If omitted, updates all.

## Workflow

1. **Identify**: Target plugin or all plugins
2. **Update**: Git pull for each
3. **Report**: Show update results

## Execution

```bash
PLUGINS_DIR="${HOME}/.claude/plugins"
TARGET="$1"

if [ -n "$TARGET" ]; then
    # Update specific plugin
    PLUGIN_PATH="$PLUGINS_DIR/$TARGET"

    if [ ! -d "$PLUGIN_PATH" ]; then
        echo "Plugin not found: $TARGET"
        exit 1
    fi

    echo "Updating $TARGET..."
    cd "$PLUGIN_PATH"

    # Get current commit
    OLD_COMMIT=$(git rev-parse --short HEAD)

    # Pull updates
    git pull --ff-only

    # Get new commit
    NEW_COMMIT=$(git rev-parse --short HEAD)

    if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
        echo "✓ $TARGET is up to date ($OLD_COMMIT)"
    else
        echo "✓ $TARGET updated: $OLD_COMMIT → $NEW_COMMIT"
    fi
else
    # Update all plugins
    echo "Updating all plugins..."
    echo ""

    for plugin_dir in "$PLUGINS_DIR"/*/; do
        if [ -d "$plugin_dir/.git" ]; then
            name=$(basename "$plugin_dir")
            cd "$plugin_dir"

            OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
            git pull --ff-only 2>/dev/null
            NEW_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

            if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
                echo "  $name: up to date ($OLD_COMMIT)"
            else
                echo "  $name: updated $OLD_COMMIT → $NEW_COMMIT"
            fi
        fi
    done

    echo ""
    echo "✓ Update complete"
fi
```

## Post-Update

After updating:
1. Check for breaking changes in updated plugins
2. Restart Claude Code or fork for immediate activation
3. Consider updating plug-lock.json with new commits
