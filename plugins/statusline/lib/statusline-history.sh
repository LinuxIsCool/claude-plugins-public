#!/bin/bash
#
# Statusline History - Query historical statusline snapshots
#
# Retrieves historical statusline renders from the JSONL log.
# Useful for showing statusline progression over time.
#
# Source this file from scripts:
#   source "$SCRIPT_DIR/../lib/statusline-history.sh"
#
# Usage:
#   get_statusline_history "$session_id" 5    # Get last 5 statuslines
#   get_interleaved_history "$session_id" 10  # Prompts + statuslines interleaved

# ============================================================================
# Configuration
# ============================================================================

STATUSLINE_LOG="${STATUSLINE_LOG:-$HOME/.claude/instances/statusline.jsonl}"

# Source formatter for display functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/statusline-formatter.sh" 2>/dev/null || true

# ANSI colors
DIM='\033[2m'
RST='\033[0m'
GREY='\033[90m'

# ============================================================================
# Core Functions
# ============================================================================

# Get raw statusline history entries as JSON (newest first)
#
# Usage: get_statusline_history_raw <session_id> [limit]
#
# Arguments:
#   session_id - Full or short (8-char) session ID
#   limit      - Max entries to return (default: 10)
#
# Returns:
#   One JSON object per line (full log entries including timestamp)
#   Ordered newest first (reverse chronological)
#
get_statusline_history_raw() {
    local session_id="$1"
    local limit="${2:-10}"
    local short_id="${session_id:0:8}"

    if [[ ! -f "$STATUSLINE_LOG" ]]; then
        return 1
    fi

    # Get last N entries, then reverse to show newest first
    grep "\"type\":\"statusline_render\"" "$STATUSLINE_LOG" 2>/dev/null \
        | grep "\"session\":\"$short_id\"" \
        | tail -"$limit" \
        | tac
}

# Get statusline history formatted for display
#
# Usage: get_statusline_history <session_id> [limit]
#
# Output:
#   Each statusline formatted as two lines with timestamp prefix
#
get_statusline_history() {
    local session_id="$1"
    local limit="${2:-10}"

    get_statusline_history_raw "$session_id" "$limit" | while read -r line; do
        local ts value time_display
        ts=$(echo "$line" | jq -r '.ts // ""' 2>/dev/null)
        value=$(echo "$line" | jq -r '.value' 2>/dev/null)

        if [[ -n "$value" && "$value" != "null" ]]; then
            # Format timestamp
            if [[ -n "$ts" ]]; then
                time_display=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")
            else
                time_display="??:??:??"
            fi

            printf "${DIM}--- %s ---${RST}\n" "$time_display"
            format_statusline "$value"
        fi
    done
}

# Get statusline history in compact one-line format
#
# Usage: get_statusline_history_compact <session_id> [limit]
#
get_statusline_history_compact() {
    local session_id="$1"
    local limit="${2:-10}"

    get_statusline_history_raw "$session_id" "$limit" | while read -r line; do
        local ts value time_display
        ts=$(echo "$line" | jq -r '.ts // ""' 2>/dev/null)
        value=$(echo "$line" | jq -r '.value' 2>/dev/null)

        if [[ -n "$value" && "$value" != "null" ]]; then
            if [[ -n "$ts" ]]; then
                time_display=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")
            else
                time_display="??:??:??"
            fi

            printf "${DIM}[%s]${RST} " "$time_display"
            format_statusline_oneline "$value"
        fi
    done
}

# Get interleaved prompt and statusline history
#
# Usage: get_interleaved_history <session_id> [limit] [cwd]
#
# Shows prompts and statuslines interleaved by timestamp for
# a reverse-chronological view of session activity (newest first).
#
# Output format:
#   [12:35:00] --- statusline snapshot ---
#   [12:34:56] > User prompt here
#   ... (older entries follow)
#
get_interleaved_history() {
    local session_id="$1"
    local limit="${2:-20}"
    local cwd="${3:-$HOME}"
    local short_id="${session_id:0:8}"

    # Source prompt-history if not already sourced
    source "${SCRIPT_DIR}/prompt-history.sh" 2>/dev/null || true

    # Find conversation log
    local log_file
    log_file=$(find_conversation_log "$session_id" "$cwd" 2>/dev/null)

    # Create temp file for merged events
    local tmp_file
    tmp_file=$(mktemp)
    trap "rm -f '$tmp_file'" EXIT

    # Add prompts
    if [[ -n "$log_file" && -f "$log_file" ]]; then
        grep '"type":"UserPromptSubmit"\|"type": "UserPromptSubmit"' "$log_file" 2>/dev/null \
            | jq -c '{ts: .ts, type: "prompt", data: .data.prompt}' 2>/dev/null \
            >> "$tmp_file"
    fi

    # Add statuslines
    if [[ -f "$STATUSLINE_LOG" ]]; then
        grep "\"type\":\"statusline_render\"" "$STATUSLINE_LOG" 2>/dev/null \
            | grep "\"session\":\"$short_id\"" \
            | jq -c '{ts: .ts, type: "statusline", data: .value}' 2>/dev/null \
            >> "$tmp_file"
    fi

    # Sort by timestamp descending (newest first), take top N
    # Using -r for reverse sort, then head for first N entries
    sort -r -t'"' -k4 "$tmp_file" 2>/dev/null | head -"$limit" | while read -r line; do
        local ts type data time_display
        ts=$(echo "$line" | jq -r '.ts // ""' 2>/dev/null)
        type=$(echo "$line" | jq -r '.type // ""' 2>/dev/null)
        data=$(echo "$line" | jq -r '.data' 2>/dev/null)

        # Format timestamp
        if [[ -n "$ts" ]]; then
            time_display=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")
        else
            time_display="??:??:??"
        fi

        case "$type" in
            prompt)
                local prompt="$data"
                if [[ ${#prompt} -gt 80 ]]; then
                    prompt="${prompt:0:77}..."
                fi
                printf "${DIM}[%s]${RST} \033[33m>\033[0m \033[36m%s\033[0m\n" "$time_display" "$prompt"
                ;;
            statusline)
                printf "${DIM}[%s] ───────────────────────────────${RST}\n" "$time_display"
                format_statusline "$data" 2>/dev/null || true
                ;;
        esac
    done

    rm -f "$tmp_file"
}

# Get summary stats for statusline history
#
# Usage: get_statusline_stats <session_id>
#
get_statusline_stats() {
    local session_id="$1"
    local short_id="${session_id:0:8}"

    if [[ ! -f "$STATUSLINE_LOG" ]]; then
        echo "No statusline log found"
        return 1
    fi

    local count first_ts last_ts
    count=$(grep "\"session\":\"$short_id\"" "$STATUSLINE_LOG" 2>/dev/null | grep -c "statusline_render" || echo "0")
    first_ts=$(grep "\"session\":\"$short_id\"" "$STATUSLINE_LOG" 2>/dev/null | head -1 | jq -r '.ts // ""' 2>/dev/null)
    last_ts=$(grep "\"session\":\"$short_id\"" "$STATUSLINE_LOG" 2>/dev/null | tail -1 | jq -r '.ts // ""' 2>/dev/null)

    printf "Renders: %d\n" "$count"
    [[ -n "$first_ts" ]] && printf "First: %s\n" "$(date -d "$first_ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$first_ts")"
    [[ -n "$last_ts" ]] && printf "Last: %s\n" "$(date -d "$last_ts" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "$last_ts")"
}
