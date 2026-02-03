#!/usr/bin/env bash
# refresh-plugins.sh - Clear cache and trigger rebuild via headless Claude
#
# Usage:
#   ./refresh-plugins.sh              # Refresh all plugins
#   ./refresh-plugins.sh awareness    # Refresh specific plugin
#
# This clears the cache then runs a minimal headless Claude instance
# which triggers cache rebuild. For plugins with dev-mode.sh, it also
# runs their sync command to ensure proper cache population.
#
# Other running instances will see the fresh cache on their next plugin access.

set -euo pipefail

PLUGIN="${1:-}"
CACHE_BASE="$HOME/.claude/plugins/cache"
MARKETPLACE="linuxiscool-claude-plugins"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Plugin Cache Refresh"
echo "===================="

# Step 1: Clear cache
if [[ -z "$PLUGIN" ]]; then
    echo "Clearing all plugin caches..."
    rm -rf "$CACHE_BASE/$MARKETPLACE/"
    echo "  Cleared: $CACHE_BASE/$MARKETPLACE/"
else
    echo "Clearing cache for: $PLUGIN"
    rm -rf "$CACHE_BASE/$MARKETPLACE/$PLUGIN/"
    echo "  Cleared: $CACHE_BASE/$MARKETPLACE/$PLUGIN/"
fi

# Step 2: Trigger cache rebuild via headless Claude
# The --setting-sources "" prevents recursive hook issues
echo ""
echo "Triggering cache rebuild via headless Claude..."
claude -p "exit" --setting-sources "" --output-format text 2>/dev/null || true

# Step 3: Run dev-mode.sh sync for plugins that have it
# Some plugins (like voice) need explicit syncing because Claude's
# headless rebuild doesn't always populate their cache properly
echo ""
echo "Checking for plugins with dev-mode.sh..."

sync_plugin() {
    local plugin_name="$1"
    local dev_mode_script="$SCRIPT_DIR/$plugin_name/tools/dev-mode.sh"

    if [[ -x "$dev_mode_script" ]]; then
        echo "  Running dev-mode.sh sync for $plugin_name..."
        bash "$dev_mode_script" sync 2>&1 | sed 's/^/    /'
    fi
}

if [[ -z "$PLUGIN" ]]; then
    # Sync all plugins with dev-mode.sh
    for plugin_dir in "$SCRIPT_DIR"/*/; do
        plugin_name=$(basename "$plugin_dir")
        sync_plugin "$plugin_name"
    done
else
    # Sync specific plugin if it has dev-mode.sh
    sync_plugin "$PLUGIN"
fi

echo ""
echo "Done! Plugin cache has been refreshed."
echo "Other running Claude instances should see the updated plugins."
