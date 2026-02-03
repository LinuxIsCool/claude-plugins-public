#!/bin/bash
#
# Agent Finder - Interactive fuzzy finder for Claude agent panes
#
# Uses fzf to present a searchable list of Claude agent panes,
# then switches to the selected pane.
#
# Features:
#   - Full statusline display (name, model, context%, cost, summary)
#   - Composite preview: terminal content + prompt/statusline history
#   - ANSI color support for visual richness
#
# Designed to be invoked from:
#   - tmux display-popup (recommended)
#   - Direct shell execution
#   - tmux keybinding
#
# Usage:
#   ./agent-finder.sh              # Interactive fuzzy finder with statuslines
#   ./agent-finder.sh --popup      # Optimized for tmux popup context
#   ./agent-finder.sh --preview    # Include composite preview pane
#   ./agent-finder.sh --simple     # Use simple pane title format
#
# Keybinding example (add to ~/.tmux.conf):
#   bind-key f display-popup -E -w 90% -h 80% "path/to/agent-finder.sh --popup --preview"
#
# Exit codes:
#   0 - Success (selection made or cancelled)
#   1 - Error (dependencies missing, etc.)

set -euo pipefail

# Script directory (for finding agent-scanner.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCANNER="${SCRIPT_DIR}/agent-scanner.sh"
PREVIEW_HELPER="${SCRIPT_DIR}/agent-preview.sh"

# Verify dependencies
if ! command -v fzf &>/dev/null; then
    echo "Error: fzf not found. Install with: sudo apt install fzf" >&2
    exit 1
fi

if ! command -v tmux &>/dev/null; then
    echo "Error: tmux not found" >&2
    exit 1
fi

if [[ ! -x "$SCANNER" ]]; then
    echo "Error: agent-scanner.sh not found or not executable at: $SCANNER" >&2
    exit 1
fi

# Parse arguments
POPUP_MODE=false
PREVIEW_MODE=false
SIMPLE_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --popup)
            POPUP_MODE=true
            shift
            ;;
        --preview)
            PREVIEW_MODE=true
            shift
            ;;
        --simple)
            SIMPLE_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: agent-finder.sh [OPTIONS]"
            echo ""
            echo "Interactive fuzzy finder for Claude agent panes."
            echo ""
            echo "Options:"
            echo "  --popup    Optimized for tmux popup context"
            echo "  --preview  Show composite preview (terminal + history)"
            echo "  --simple   Use simple pane title format instead of statusline"
            echo "  -h, --help Show this help"
            echo ""
            echo "Features:"
            echo "  - Statusline display with name, model, context%, cost"
            echo "  - Composite preview: terminal content + prompt/statusline history"
            echo "  - ANSI colors for visual richness"
            echo ""
            echo "Keybinding example (add to ~/.tmux.conf):"
            echo "  bind-key f display-popup -E -w 90% -h 80% \"${SCRIPT_DIR}/agent-finder.sh --popup --preview\""
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Choose scanner format based on mode
SCAN_FORMAT="statusline"
if [[ "$SIMPLE_MODE" == "true" ]]; then
    SCAN_FORMAT="fzf"
fi

# Get list of Claude agents
AGENTS=$("$SCANNER" --format="$SCAN_FORMAT")

if [[ -z "$AGENTS" ]]; then
    echo "No Claude agents found in tmux panes." >&2
    echo "Agents are identified by pane titles starting with ✳" >&2
    exit 0
fi

# Build fzf options
FZF_OPTS=(
    --ansi
    --no-multi
    --reverse
    --border=rounded
    --border-label=" Claude Agents "
    --prompt="Jump to > "
    --header="Select an agent pane to switch to (ESC to cancel)"
    --header-first
    --height=100%
)

# Add preview if requested
if [[ "$PREVIEW_MODE" == "true" ]]; then
    # Check if composite preview helper exists
    if [[ -x "$PREVIEW_HELPER" ]]; then
        # Composite preview: terminal + history
        FZF_OPTS+=(
            --preview="$PREVIEW_HELPER {}"
            --preview-window=right:60%:wrap
        )
    else
        # Fallback: simple terminal capture
        FZF_OPTS+=(
            --preview="tmux capture-pane -e -t \$(echo {} | sed 's/^\[\\([^]]*\\)\\].*/\\1/') -p -S -20 2>/dev/null | head -30"
            --preview-window=right:50%:wrap
        )
    fi
fi

# Run fzf for selection (force bash for preview commands)
SELECTED=$(echo "$AGENTS" | SHELL=/bin/bash fzf "${FZF_OPTS[@]}") || true

# If nothing selected (ESC pressed), exit gracefully
if [[ -z "$SELECTED" ]]; then
    exit 0
fi

# Extract pane reference from selected line
# Both formats use: [session:window.pane] as prefix
# - Simple: [session:window.pane] ✳ Summary
# - Statusline: [session:window.pane] [Name:id] Model | ctx:X% | ...
PANE_REF=$(echo "$SELECTED" | sed 's/^\[\([^]]*\)\].*/\1/')

if [[ -z "$PANE_REF" ]]; then
    echo "Error: Could not extract pane reference from selection" >&2
    exit 1
fi

# Parse session and window.pane
SESSION_NAME=$(echo "$PANE_REF" | cut -d: -f1)
WINDOW_PANE=$(echo "$PANE_REF" | cut -d: -f2)

# Switch to the selected pane
# tmux select-pane -t target automatically selects the window too
if [[ "$POPUP_MODE" == "true" ]]; then
    # In popup mode, switch-client changes session if needed
    tmux switch-client -t "${SESSION_NAME}:${WINDOW_PANE}"
else
    # Direct mode: select the pane (implicitly selects window)
    tmux select-pane -t "${SESSION_NAME}:${WINDOW_PANE}"
fi

exit 0
