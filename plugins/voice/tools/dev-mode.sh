#!/usr/bin/env bash
# dev-mode.sh - Fast development workflow for voice plugin
#
# Claude Code validates and rebuilds plugin caches on startup,
# so symlinks don't persist. Instead, this script provides fast
# cache refresh operations.
#
# Usage:
#   ./dev-mode.sh sync     # Fast-copy source to cache (instant update)
#   ./dev-mode.sh watch    # Watch source files and auto-sync
#   ./dev-mode.sh status   # Check current cache state
#
# The 'sync' command copies hook and src files to cache, enabling
# changes to take effect on next hook invocation without full restart.
#
# What syncs without restart:
#   - hooks/voice-hook.ts     Main hook logic
#   - src/adapters/tts/*.ts   TTS backends
#   - src/identity/*.ts       Voice resolution
#   - src/ports/*.ts          Port interfaces
#
# What still requires restart:
#   - .claude-plugin/plugin.json  (skills, commands, agents declarations)
#   - New skill files
#   - New command files
#   - Agent markdown files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$SCRIPT_DIR"
CACHE_BASE="$HOME/.claude/plugins/cache/linuxiscool-claude-plugins/voice"
VERSION="0.1.0"
CACHE_DIR="$CACHE_BASE/$VERSION"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_status() {
    echo "Voice Plugin Development Status"
    echo "================================"
    echo ""
    echo "Source: $SOURCE_DIR"
    echo "Cache:  $CACHE_DIR"
    echo ""

    if [[ ! -d "$CACHE_DIR" ]]; then
        echo -e "Status: ${RED}NO CACHE${NC}"
        echo "  Cache directory doesn't exist."
        echo "  The plugin may not be installed, or cache was cleared."
        echo ""
        echo "Run './dev-mode.sh sync' to create/update cache."
        return
    fi

    # Compare source and cache timestamps
    local src_hooks_ts="$SOURCE_DIR/hooks/voice-hook.ts"
    local cache_hooks_ts="$CACHE_DIR/hooks/voice-hook.ts"

    if [[ -f "$src_hooks_ts" && -f "$cache_hooks_ts" ]]; then
        local src_mtime cache_mtime
        src_mtime=$(stat -c %Y "$src_hooks_ts" 2>/dev/null || stat -f %m "$src_hooks_ts")
        cache_mtime=$(stat -c %Y "$cache_hooks_ts" 2>/dev/null || stat -f %m "$cache_hooks_ts")

        if [[ "$src_mtime" -gt "$cache_mtime" ]]; then
            echo -e "Status: ${YELLOW}STALE${NC}"
            echo "  Source is newer than cache."
            echo "  Run './dev-mode.sh sync' to update."
        else
            echo -e "Status: ${GREEN}SYNCED${NC}"
            echo "  Cache matches source."
        fi
    else
        echo -e "Status: ${YELLOW}UNKNOWN${NC}"
        echo "  Could not compare timestamps."
    fi

    echo ""
    echo "Last cache update:"
    ls -la "$CACHE_DIR/hooks/voice-hook.ts" 2>/dev/null | awk '{print "  " $6, $7, $8}'
}

sync_cache() {
    echo "Syncing voice plugin to cache..."
    echo ""

    # Create cache directory if missing
    if [[ ! -d "$CACHE_DIR" ]]; then
        echo "  Creating cache directory..."
        mkdir -p "$CACHE_DIR"
    fi

    # Sync hooks (the main hot-reload target)
    echo "  Syncing hooks/..."
    mkdir -p "$CACHE_DIR/hooks"
    cp -r "$SOURCE_DIR/hooks/"* "$CACHE_DIR/hooks/"

    # Sync src (TTS adapters, identity resolution)
    echo "  Syncing src/..."
    mkdir -p "$CACHE_DIR/src"
    cp -r "$SOURCE_DIR/src/"* "$CACHE_DIR/src/"

    # Sync package files (for bun to resolve imports)
    echo "  Syncing package files..."
    for f in package.json tsconfig.json bun.lock bun.lockb; do
        if [[ -f "$SOURCE_DIR/$f" ]]; then
            cp "$SOURCE_DIR/$f" "$CACHE_DIR/"
        fi
    done

    # Also sync plugin.json (needed for Claude to recognize hooks)
    echo "  Syncing plugin config..."
    mkdir -p "$CACHE_DIR/.claude-plugin"
    cp -r "$SOURCE_DIR/.claude-plugin/"* "$CACHE_DIR/.claude-plugin/"

    # Sync agents (subagents via Task tool)
    if [[ -d "$SOURCE_DIR/agents" ]]; then
        echo "  Syncing agents/..."
        mkdir -p "$CACHE_DIR/agents"
        cp -r "$SOURCE_DIR/agents/"* "$CACHE_DIR/agents/"
    fi

    echo ""
    echo -e "${GREEN}Sync complete!${NC}"
    echo ""
    echo "Changes to hooks/, src/, and agents/ take effect on next invocation."
    echo "No restart needed for TTS/voice changes."
}

watch_and_sync() {
    echo "Watching voice plugin source for changes..."
    echo "Press Ctrl+C to stop."
    echo ""

    # Check if inotifywait is available
    if ! command -v inotifywait &> /dev/null; then
        echo -e "${RED}Error: inotifywait not found${NC}"
        echo "Install with: sudo apt install inotify-tools"
        exit 1
    fi

    # Initial sync
    sync_cache

    echo ""
    echo -e "${CYAN}Watching for changes...${NC}"
    echo ""

    # Watch and sync (hooks, src, agents)
    inotifywait -m -r -e modify,create,delete "$SOURCE_DIR/hooks" "$SOURCE_DIR/src" "$SOURCE_DIR/agents" 2>/dev/null | while read -r directory events filename; do
        echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $events: $filename"
        sync_cache
    done
}

case "${1:-status}" in
    sync)
        sync_cache
        ;;
    watch)
        watch_and_sync
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {sync|watch|status}"
        echo ""
        echo "Commands:"
        echo "  sync    Fast-copy source files to cache"
        echo "  watch   Watch source and auto-sync on change"
        echo "  status  Check current cache state"
        exit 1
        ;;
esac
