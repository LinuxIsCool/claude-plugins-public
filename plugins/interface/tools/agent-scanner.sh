#!/bin/bash
#
# Agent Scanner - Extract Claude agent panes from tmux
#
# Discovers Claude Code instances by scanning tmux pane titles.
# Claude Code sets pane titles via escape sequences with format: "✳ Summary"
#
# Output format (tab-separated):
#   session:window.pane \t pane_id \t pane_title
#
# The ✳ prefix indicates a Claude agent; other panes (nvim, fish, etc.)
# have titles like "nvim /path" or "fish /path".
#
# Usage:
#   ./agent-scanner.sh              # Scan all sessions for Claude agents
#   ./agent-scanner.sh --session=X  # Scan specific session only
#   ./agent-scanner.sh --all        # Include non-Claude panes too
#   ./agent-scanner.sh --format=fzf # Output formatted for fzf selection
#   ./agent-scanner.sh --format=statusline  # Output with full statusline
#
# Exit codes:
#   0 - Success (found agents or not)
#   1 - Error (not in tmux, etc.)

set -euo pipefail

# Script directory for sourcing libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Statusline library paths (from statusline plugin)
STATUSLINE_LIB="${SCRIPT_DIR}/../../statusline/lib"

# Source statusline libraries if available (for statusline format)
source_statusline_libs() {
    if [[ -d "$STATUSLINE_LIB" ]]; then
        source "${STATUSLINE_LIB}/session-resolver.sh" 2>/dev/null || true
        source "${STATUSLINE_LIB}/statusline-formatter.sh" 2>/dev/null || true
        return 0
    fi
    return 1
}

# Verify tmux is available
if ! command -v tmux &>/dev/null; then
    echo "Error: tmux not found" >&2
    exit 1
fi

if ! tmux list-sessions &>/dev/null; then
    echo "Error: No tmux sessions found" >&2
    exit 1
fi

# Parse arguments
SESSION_FILTER=""
INCLUDE_ALL=false
OUTPUT_FORMAT="tsv"

while [[ $# -gt 0 ]]; do
    case $1 in
        --session=*)
            SESSION_FILTER="${1#*=}"
            shift
            ;;
        --all)
            INCLUDE_ALL=true
            shift
            ;;
        --format=*)
            OUTPUT_FORMAT="${1#*=}"
            shift
            ;;
        -h|--help)
            echo "Usage: agent-scanner.sh [OPTIONS]"
            echo ""
            echo "Scans tmux panes for Claude agent instances."
            echo ""
            echo "Options:"
            echo "  --session=NAME  Scan specific session only"
            echo "  --all           Include non-Claude panes"
            echo "  --format=FORMAT Output format: tsv (default), fzf, statusline"
            echo "  -h, --help      Show this help"
            echo ""
            echo "Output (tsv format):"
            echo "  session:window.pane \\t pane_id \\t pane_title"
            echo ""
            echo "Output (fzf format):"
            echo "  [session:window.pane] ✳ Summary Text"
            echo ""
            echo "Output (statusline format):"
            echo "  Two-line statusline with colors from JSONL log"
            echo "  Falls back to pane title if statusline unavailable"
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Build pane list command
if [[ -n "$SESSION_FILTER" ]]; then
    # Validate session exists
    if ! tmux has-session -t "$SESSION_FILTER" 2>/dev/null; then
        echo "Error: Session '$SESSION_FILTER' not found" >&2
        exit 1
    fi
    PANES=$(tmux list-panes -t "$SESSION_FILTER" -a -F '#{session_name}:#{window_index}.#{pane_index}	#{pane_id}	#{pane_title}' 2>/dev/null) || true
else
    PANES=$(tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index}	#{pane_id}	#{pane_title}' 2>/dev/null) || true
fi

# Claude agent pattern: title starts with ✳
CLAUDE_PATTERN='^✳'

# Source statusline libs if using statusline format
STATUSLINE_LIBS_LOADED=false
if [[ "$OUTPUT_FORMAT" == "statusline" ]]; then
    if source_statusline_libs; then
        STATUSLINE_LIBS_LOADED=true
    fi
fi

# Process panes
echo "$PANES" | while IFS=$'\t' read -r pane_ref pane_id pane_title; do
    # Skip if we couldn't parse the line
    [[ -z "$pane_ref" ]] && continue

    # Filter for Claude agents unless --all specified
    if [[ "$INCLUDE_ALL" != "true" ]]; then
        if ! echo "$pane_title" | grep -qE "$CLAUDE_PATTERN"; then
            continue
        fi
    fi

    # Output based on format
    case "$OUTPUT_FORMAT" in
        fzf)
            # Format for fzf: [pane_ref] pane_title
            # The pane_id is embedded in the pane_ref for later extraction
            printf '[%s] %s\n' "$pane_ref" "$pane_title"
            ;;
        statusline)
            # Full statusline format with colors
            # Try to resolve session and get statusline, fallback to pane title
            if [[ "$STATUSLINE_LIBS_LOADED" == "true" ]]; then
                session_id=$(resolve_session "$pane_ref" 2>/dev/null) || session_id=""
                if [[ -n "$session_id" ]]; then
                    statusline_json=$(get_latest_statusline "$session_id" 2>/dev/null) || statusline_json=""
                    if [[ -n "$statusline_json" && "$statusline_json" != "null" ]]; then
                        # Output pane ref as hidden prefix for extraction, then formatted statusline
                        printf '\033[90m[%s]\033[0m ' "$pane_ref"
                        format_statusline_oneline "$statusline_json"
                        continue
                    fi
                fi
            fi
            # Fallback: use pane title
            printf '\033[90m[%s]\033[0m %s\n' "$pane_ref" "$pane_title"
            ;;
        *)
            # Default TSV format
            printf '%s\t%s\t%s\n' "$pane_ref" "$pane_id" "$pane_title"
            ;;
    esac
done

# Exit successfully even if no agents found (empty output is valid)
exit 0
