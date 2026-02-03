#!/bin/bash
#
# Agent Preview - Composite preview for agent-finder
#
# Generates a preview pane showing:
#   1. Terminal content (top section)
#   2. Separator line
#   3. Alternating user prompts and statusline history (bottom section)
#
# Usage:
#   ./agent-preview.sh "[pane_ref] statusline text..."
#
# The pane_ref is extracted from the bracketed prefix.

set -euo pipefail

# Script directory for sourcing libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Statusline library paths
STATUSLINE_LIB="${SCRIPT_DIR}/../../statusline/lib"

# ANSI colors
DIM='\033[2m'
BOLD='\033[1m'
RST='\033[0m'
CYAN='\033[36m'
YELLOW='\033[33m'
GREY='\033[90m'

# Source statusline libraries
source_libs() {
    if [[ -d "$STATUSLINE_LIB" ]]; then
        source "${STATUSLINE_LIB}/session-resolver.sh" 2>/dev/null || true
        source "${STATUSLINE_LIB}/statusline-history.sh" 2>/dev/null || true
        source "${STATUSLINE_LIB}/prompt-history.sh" 2>/dev/null || true
        return 0
    fi
    return 1
}

# Extract pane_ref from selected line
# Format: [session:window.pane] text...
extract_pane_ref() {
    local line="$1"
    echo "$line" | sed 's/^\[\([^]]*\)\].*/\1/'
}

# Main preview function
main() {
    local selected="$1"

    if [[ -z "$selected" ]]; then
        echo "No selection"
        exit 0
    fi

    # Extract pane reference
    local pane_ref
    pane_ref=$(extract_pane_ref "$selected")

    if [[ -z "$pane_ref" ]]; then
        echo "Could not extract pane reference"
        exit 0
    fi

    # Get terminal height for proportional display
    local term_height="${FZF_PREVIEW_LINES:-30}"
    local terminal_lines=$((term_height / 2))
    local history_lines=$((term_height - terminal_lines - 3))

    # Section 1: Terminal content (with ANSI colors)
    printf "${BOLD}${CYAN}Terminal${RST}\n"
    printf "${DIM}────────────────────────────────────────────────────${RST}\n"
    tmux capture-pane -e -t "$pane_ref" -p -S -"$terminal_lines" 2>/dev/null \
        | head -"$terminal_lines" \
        || echo "${GREY}(unable to capture pane)${RST}"

    # Section 2: Separator
    echo ""
    printf "${DIM}════════════════════════════════════════════════════${RST}\n"
    printf "${BOLD}${YELLOW}Session History${RST}\n"
    printf "${DIM}────────────────────────────────────────────────────${RST}\n"

    # Source libraries for history
    if ! source_libs; then
        echo "${GREY}(statusline libraries not available)${RST}"
        exit 0
    fi

    # Resolve session from pane
    local session_id
    session_id=$(resolve_session "$pane_ref" 2>/dev/null) || session_id=""

    if [[ -z "$session_id" ]]; then
        echo "${GREY}(session not resolved - no history available)${RST}"
        exit 0
    fi

    # Get pane's working directory for prompt history
    local pane_cwd
    pane_cwd=$(tmux display-message -t "$pane_ref" -p '#{pane_current_path}' 2>/dev/null) || pane_cwd="$HOME"

    # Section 3: Interleaved history (prompts and statuslines)
    get_interleaved_history "$session_id" "$history_lines" "$pane_cwd" 2>/dev/null \
        || echo "${GREY}(no history available)${RST}"
}

# Entry point
main "${1:-}"
