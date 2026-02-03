#!/bin/bash
#
# Pane Identity - Resolve process context to tmux pane information
#
# Provides functions to determine which tmux pane a process is running in
# by walking the process ancestry tree and matching against tmux pane PIDs.
#
# This enables direct session-to-pane correlation, solving the problem of
# multiple Claude sessions in the same directory.
#
# Source this file from scripts:
#   source "$SCRIPT_DIR/../lib/pane-identity.sh"
#
# Usage:
#   pane_info=$(get_current_pane_info)  # "3706660|%44|0:5.0"
#   pane_id=$(get_current_pane_id)      # "%44"
#   pane_ref=$(get_current_pane_ref)    # "0:5.0"

# ============================================================================
# Core Functions
# ============================================================================

# Get full pane info for the current process
#
# Walks the process ancestry tree to find which tmux pane we're running in.
# Returns pipe-delimited: "pane_pid|pane_id|session:window.pane"
#
# Usage: get_current_pane_info
#
# Returns:
#   Pipe-delimited pane info on stdout, or empty string if not in tmux
#
# Example:
#   info=$(get_current_pane_info)
#   # Returns: "3706660|%44|0:5.0"
#
get_current_pane_info() {
    # Check if tmux is available
    if ! command -v tmux &>/dev/null; then
        return 1
    fi

    # Check if we're in a tmux session
    if ! tmux list-sessions &>/dev/null 2>&1; then
        return 1
    fi

    # Get all pane PIDs upfront (single tmux call)
    local pane_pids
    pane_pids=$(tmux list-panes -a -F '#{pane_pid}|#{pane_id}|#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null) || return 1

    # Walk process ancestry to find tmux pane
    local pid=$$
    while [[ $pid -gt 1 ]]; do
        # Check if this PID is a tmux pane
        local match
        match=$(echo "$pane_pids" | grep "^${pid}|")
        if [[ -n "$match" ]]; then
            echo "$match"
            return 0
        fi
        # Move to parent
        pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        [[ -z "$pid" ]] && break
    done

    return 1
}

# Get just the pane_id (%XX format, stable for pane lifetime)
#
# Usage: get_current_pane_id
#
# Returns:
#   Pane ID like "%44" on stdout
#
get_current_pane_id() {
    local info
    info=$(get_current_pane_info) || return 1
    echo "$info" | cut -d'|' -f2
}

# Get just the pane_ref (session:window.pane format)
#
# Usage: get_current_pane_ref
#
# Returns:
#   Pane reference like "0:5.0" on stdout
#
get_current_pane_ref() {
    local info
    info=$(get_current_pane_info) || return 1
    echo "$info" | cut -d'|' -f3
}

# Get pane info for a specific PID (useful for external callers)
#
# Usage: get_pane_info_for_pid <pid>
#
# Arguments:
#   pid - Process ID to trace
#
# Returns:
#   Pipe-delimited pane info on stdout
#
get_pane_info_for_pid() {
    local target_pid="$1"

    if ! command -v tmux &>/dev/null; then
        return 1
    fi

    local pane_pids
    pane_pids=$(tmux list-panes -a -F '#{pane_pid}|#{pane_id}|#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null) || return 1

    local pid="$target_pid"
    while [[ $pid -gt 1 ]]; do
        local match
        match=$(echo "$pane_pids" | grep "^${pid}|")
        if [[ -n "$match" ]]; then
            echo "$match"
            return 0
        fi
        pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
        [[ -z "$pid" ]] && break
    done

    return 1
}

# Lookup pane_id from registry for a given session_id
#
# Usage: get_pane_id_from_registry <session_id>
#
# Arguments:
#   session_id - Claude session UUID
#
# Returns:
#   Pane ID on stdout if stored in registry
#
get_pane_id_from_registry() {
    local session_id="$1"
    local registry="${STATUSLINE_INSTANCES_DIR:-$HOME/.claude/instances}/registry.json"

    if [[ ! -f "$registry" ]]; then
        return 1
    fi

    jq -r --arg sid "$session_id" '.[$sid].pane_id // empty' "$registry" 2>/dev/null
}

# Lookup session_id from registry by pane_id
#
# Usage: get_session_by_pane_id <pane_id>
#
# Arguments:
#   pane_id - Tmux pane ID like "%44"
#
# Returns:
#   Session ID on stdout if found
#
get_session_by_pane_id() {
    local pane_id="$1"
    local registry="${STATUSLINE_INSTANCES_DIR:-$HOME/.claude/instances}/registry.json"

    if [[ ! -f "$registry" ]]; then
        return 1
    fi

    # Find session with matching pane_id, prefer most recent
    jq -r --arg pid "$pane_id" '
        [to_entries[] | select(.value.pane_id == $pid)]
        | sort_by(.value.last_seen) | reverse
        | .[0].key // empty
    ' "$registry" 2>/dev/null
}

# Lookup session_id from registry by pane_ref
#
# Usage: get_session_by_pane_ref <pane_ref>
#
# Arguments:
#   pane_ref - Tmux pane reference like "0:5.0"
#
# Returns:
#   Session ID on stdout if found
#
# Note: pane_ref can change if windows are reordered, so pane_id is preferred
#
get_session_by_pane_ref() {
    local pane_ref="$1"
    local registry="${STATUSLINE_INSTANCES_DIR:-$HOME/.claude/instances}/registry.json"

    if [[ ! -f "$registry" ]]; then
        return 1
    fi

    jq -r --arg pref "$pane_ref" '
        [to_entries[] | select(.value.pane_ref == $pref)]
        | sort_by(.value.last_seen) | reverse
        | .[0].key // empty
    ' "$registry" 2>/dev/null
}
