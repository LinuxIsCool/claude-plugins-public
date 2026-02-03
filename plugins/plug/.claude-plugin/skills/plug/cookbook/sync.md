# Sync Plugins Cookbook

Synchronize installed plugins with plug.lua specification.

## Workflow

1. **Read**: Parse plug.lua specification
2. **Scan**: List currently installed plugins
3. **Compare**: Find missing, extra, and matching
4. **Install**: Clone missing plugins
5. **Remove**: Prompt to remove unlisted plugins
6. **Report**: Show sync summary

## Execution

```bash
PLUGINS_DIR="${HOME}/.claude/plugins"
PLUG_LUA="${HOME}/.claude/plug.lua"

# Check for project-level plug.lua first
if [ -f ".claude/plug.lua" ]; then
    PLUG_LUA=".claude/plug.lua"
fi

if [ ! -f "$PLUG_LUA" ]; then
    echo "No plug.lua found at $PLUG_LUA"
    echo "Create one with your plugin specifications."
    exit 1
fi

echo "Syncing with: $PLUG_LUA"
echo ""

# Parse plug.lua (simple extraction of 'user/repo' patterns)
SPECIFIED=$(grep -oE "'[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+'" "$PLUG_LUA" | tr -d "'" | sort -u)

# Get installed plugins
INSTALLED=$(ls -1 "$PLUGINS_DIR" 2>/dev/null | sort -u)

echo "Specified in plug.lua:"
echo "$SPECIFIED" | sed 's/^/  /'
echo ""

echo "Currently installed:"
echo "$INSTALLED" | sed 's/^/  /'
echo ""

# Find missing (specified but not installed)
for repo in $SPECIFIED; do
    name=$(basename "$repo")
    if [ ! -d "$PLUGINS_DIR/$name" ]; then
        echo "Installing missing: $repo"
        git clone --depth 1 "https://github.com/${repo}.git" "$PLUGINS_DIR/$name"
    fi
done

# Find extra (installed but not specified)
for name in $INSTALLED; do
    found=false
    for repo in $SPECIFIED; do
        if [ "$(basename "$repo")" = "$name" ]; then
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        echo "Extra plugin not in spec: $name"
        echo "  Remove with: rm -rf $PLUGINS_DIR/$name"
    fi
done

echo ""
echo "✓ Sync complete"
```

## Post-Sync

After syncing:
1. Review any "extra" plugins and decide to add to spec or remove
2. Restart Claude Code or fork for immediate activation
