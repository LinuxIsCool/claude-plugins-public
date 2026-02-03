# Install Plugin Cookbook

Install a Claude Code plugin from GitHub.

## Arguments

- `$1`: Repository in `username/repo` format

## Workflow

1. **Validate**: Check repository format
2. **Check**: Verify not already installed
3. **Clone**: Clone repository to plugins directory
4. **Verify**: Confirm plugin.json exists
5. **Report**: Show success and reload instructions

## Execution

```bash
REPO="$1"
NAME=$(basename "$REPO")
PLUGINS_DIR="${HOME}/.claude/plugins"
TARGET="${PLUGINS_DIR}/${NAME}"

# Validate format
if [[ ! "$REPO" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$ ]]; then
    echo "Error: Invalid repository format. Use 'username/repo'"
    exit 1
fi

# Check if already installed
if [ -d "$TARGET" ]; then
    echo "Plugin '$NAME' is already installed at $TARGET"
    exit 0
fi

# Create plugins directory if needed
mkdir -p "$PLUGINS_DIR"

# Clone repository
echo "Installing $REPO..."
git clone --depth 1 "https://github.com/${REPO}.git" "$TARGET"

# Verify plugin structure
if [ ! -f "$TARGET/.claude-plugin/plugin.json" ]; then
    echo "Warning: No plugin.json found. This may not be a valid Claude Code plugin."
fi

echo ""
echo "✓ Installed: $NAME"
echo "  Location: $TARGET"
echo ""
echo "To activate, restart Claude Code or fork a new session."
```

## Post-Install

After installation:
1. Add to `plug.lua` if not already listed
2. Restart Claude Code or use fork-terminal for immediate activation
