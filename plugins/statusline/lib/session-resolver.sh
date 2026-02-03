#!/bin/bash
#
# Session Resolver - Map tmux panes to Claude session IDs
#
# Resolves a tmux pane to the corresponding Claude session_id using:
#   1. Direct pane_id lookup (preferred, stored during session-start)
#   2. CWD-based matching (fallback for legacy sessions)
#
# Source this file from scripts:
#   source "$SCRIPT_DIR/../lib/session-resolver.sh"
#
# Dependencies:
#   - jq for JSON parsing
#   - tmux for pane information
#
# Usage:
#   session_id=$(resolve_session "main:0.0")      # Uses pane_id first, then CWD
#   session_id=$(resolve_session_by_pane "%44")   # Direct pane_id lookup
#   session_id=$(resolve_session_by_cwd "/path")  # CWD-based fallback

# ============================================================================
# Configuration
# ============================================================================

STATUSLINE_INSTANCES_DIR="${STATUSLINE_INSTANCES_DIR:-$HOME/.claude/instances}"

# ============================================================================
# Core Resolution Functions
# ============================================================================

# Resolve a tmux pane reference to a Claude session_id
#
# Uses a two-stage resolution strategy:
#   1. Direct pane_id lookup (fast, accurate for sessions started after pane tracking)
#   2. CWD-based matching (fallback for legacy sessions without pane_id)
#
# Usage: resolve_session <pane_ref>
#
# Arguments:
#   pane_ref - tmux pane reference in format "session:window.pane"
#
# Returns:
#   Session ID on stdout if found, empty string if not
#
# Example:
#   session_id=$(resolve_session "main:0.0")
#
resolve_session() {
    local pane_ref="$1"
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"

    # Get the pane's unique ID (%XX format)
    local pane_id
    pane_id=$(tmux display-message -t "$pane_ref" -p '#{pane_id}' 2>/dev/null) || pane_id=""

    # Strategy 1: Direct pane_id lookup (preferred)
    if [[ -n "$pane_id" && -f "$registry" ]]; then
        local session_id
        session_id=$(jq -r --arg pid "$pane_id" '
            [to_entries[] | select(.value.pane_id == $pid)]
            | sort_by(.value.last_seen) | reverse
            | .[0].key // empty
        ' "$registry" 2>/dev/null)

        if [[ -n "$session_id" ]]; then
            echo "$session_id"
            return 0
        fi
    fi

    # Strategy 2: Fall back to CWD-based matching (for legacy sessions)
    local pane_cwd
    pane_cwd=$(tmux display-message -t "$pane_ref" -p '#{pane_current_path}' 2>/dev/null) || return 1

    if [[ -z "$pane_cwd" ]]; then
        return 1
    fi

    resolve_session_by_cwd "$pane_cwd"
}

# Resolve directly by pane_id (%XX format)
#
# Usage: resolve_session_by_pane <pane_id>
#
# Arguments:
#   pane_id - Tmux pane ID like "%44"
#
# Returns:
#   Session ID on stdout if found
#
resolve_session_by_pane() {
    local pane_id="$1"
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"

    if [[ ! -f "$registry" ]]; then
        return 1
    fi

    jq -r --arg pid "$pane_id" '
        [to_entries[] | select(.value.pane_id == $pid)]
        | sort_by(.value.last_seen) | reverse
        | .[0].key // empty
    ' "$registry" 2>/dev/null
}

# Resolve a working directory path to a Claude session_id
#
# Searches registry.json for a session matching the given cwd.
# Matching strategies (in order of preference):
#   1. Exact match
#   2. Session CWD is subdirectory of target (session started in subdir, pane at parent)
#   3. Target CWD is subdirectory of session (pane navigated into subdir)
#
# Returns the most recently active session if multiple match.
#
# Usage: resolve_session_by_cwd <path>
#
# Arguments:
#   path - Absolute path to working directory
#
# Returns:
#   Session ID on stdout if found, empty string if not
#
resolve_session_by_cwd() {
    local target_cwd="$1"
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"

    if [[ ! -f "$registry" ]]; then
        return 1
    fi

    # Normalize the path (expand ~ if present, resolve symlinks)
    target_cwd=$(realpath -m "$target_cwd" 2>/dev/null || echo "$target_cwd")

    # Find matching session by cwd with flexible matching
    # Matches: exact, session in subdir of pane, or pane in subdir of session
    # Sorted by last_seen (most recent first)
    jq -r --arg cwd "$target_cwd" --arg home "$HOME" '
        [
            to_entries[]
            | select(.value.cwd)
            | {key, ncwd: (.value.cwd | gsub("^~"; $home)), last: .value.last_seen}
            | . as $x
            | select(
                $x.ncwd == $cwd or
                ($x.ncwd | startswith($cwd + "/")) or
                ($cwd | startswith($x.ncwd + "/"))
            )
        ]
        | sort_by(.last) | reverse
        | .[0].key // empty
    ' "$registry" 2>/dev/null
}

# Get session data for a session_id
#
# Usage: get_session_data <session_id>
#
# Returns:
#   JSON object with session data on stdout
#
get_session_data() {
    local session_id="$1"
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"

    if [[ ! -f "$registry" ]]; then
        echo "{}"
        return 1
    fi

    jq -r --arg sid "$session_id" '.[$sid] // {}' "$registry" 2>/dev/null
}

# Get all active sessions as JSON array
#
# Usage: get_active_sessions
#
# Returns:
#   JSON array of {session_id, name, cwd, task, model, ...} objects
#
get_active_sessions() {
    local registry="${STATUSLINE_INSTANCES_DIR}/registry.json"

    if [[ ! -f "$registry" ]]; then
        echo "[]"
        return
    fi

    jq -r '
        to_entries
        | map(select(.value.status == "active"))
        | map({session_id: .key} + .value)
    ' "$registry" 2>/dev/null || echo "[]"
}
