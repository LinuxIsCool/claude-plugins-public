#!/bin/bash
#
# Statusline Formatter - Render statusline JSON to colored terminal output
#
# Transforms statusline JSON objects into formatted terminal strings with
# ANSI color codes matching the actual Claude statusline appearance.
#
# Source this file from scripts:
#   source "$SCRIPT_DIR/../lib/statusline-formatter.sh"
#
# Usage:
#   format_statusline "$json"           # Full two-line format
#   format_statusline_oneline "$json"   # Compact one-line format
#   get_latest_statusline "$session_id" # Get latest from JSONL

# ============================================================================
# Configuration
# ============================================================================

STATUSLINE_LOG="${STATUSLINE_LOG:-$HOME/.claude/instances/statusline.jsonl}"

# ============================================================================
# ANSI Color Codes
# ============================================================================

# Reset
RST='\033[0m'

# Colors matching statusline theme
DIM='\033[2m'
BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
MAGENTA='\033[35m'
BLUE='\033[34m'
WHITE='\033[37m'
GREY='\033[90m'

# ============================================================================
# Core Formatting Functions
# ============================================================================

# Format a statusline JSON object to colored two-line output
#
# Usage: format_statusline <json>
#
# Arguments:
#   json - JSON object with statusline fields (from statusline_render event)
#
# Output:
#   Line 1: [Name:id] Model | dir | ctx:X% | $cost | C1:0#5 | duration | branch
#   Line 2: Description: Summary
#
format_statusline() {
    local json="$1"

    # Extract fields from JSON
    local name=$(echo "$json" | jq -r '.name // "?"')
    local short_id=$(echo "$json" | jq -r '.short_id // "?????"')
    local model=$(echo "$json" | jq -r '.model // "?"')
    local cwd=$(echo "$json" | jq -r '.cwd // "?"')
    local ctx=$(echo "$json" | jq -r '.context_pct // 0')
    local cost=$(echo "$json" | jq -r '.cost // "0.00"')
    local pnum=$(echo "$json" | jq -r '.process_num // "?"')
    local agent=$(echo "$json" | jq -r '.agent_session // "0"')
    local prompts=$(echo "$json" | jq -r '.prompt_count // "0"')
    local duration=$(echo "$json" | jq -r '.duration // "0m"')
    local branch=$(echo "$json" | jq -r '.branch // ""')
    local stats=$(echo "$json" | jq -r '.git_stats // ""')
    local dirty=$(echo "$json" | jq -r '.git_dirty // "no"')
    local desc=$(echo "$json" | jq -r '.description // ""' | tr -d '\n')
    local summary=$(echo "$json" | jq -r '.summary // ""' | tr -d '\n')

    # Shorten cwd for display
    local cwd_short=$(basename "$cwd" 2>/dev/null || echo "$cwd")

    # Dirty indicator
    local dirty_mark=""
    [[ "$dirty" == "yes" ]] && dirty_mark="*"

    # Context color (green < 50, yellow 50-80, red > 80)
    local ctx_color="$GREEN"
    if [[ "$ctx" -ge 80 ]]; then
        ctx_color='\033[31m'  # Red
    elif [[ "$ctx" -ge 50 ]]; then
        ctx_color="$YELLOW"
    fi

    # Build line 1 with colors
    printf "${CYAN}[${BOLD}${WHITE}%s${RST}${CYAN}:${GREY}%s${CYAN}]${RST} " "$name" "$short_id"
    printf "${MAGENTA}%s${RST} ${DIM}|${RST} " "$model"
    printf "${BLUE}%s${RST} ${DIM}|${RST} " "$cwd_short"
    printf "${ctx_color}ctx:%d%%${RST} ${DIM}|${RST} " "$ctx"
    printf "${GREEN}\$%s${RST} ${DIM}|${RST} " "$cost"
    printf "${GREY}C%s:%s#%s${RST} ${DIM}|${RST} " "$pnum" "$agent" "$prompts"
    printf "${GREY}%s${RST}" "$duration"

    # Git info if present
    if [[ -n "$branch" ]]; then
        printf " ${DIM}|${RST} ${YELLOW}%s%s${RST}" "$branch" "$dirty_mark"
        [[ -n "$stats" ]] && printf " ${GREY}%s${RST}" "$stats"
    fi
    printf "\n"

    # Build line 2 (description: summary)
    # If both are placeholder, show "Awaiting instructions." in white bold
    if [[ "$desc" == "Awaiting instructions." && "$summary" == "Awaiting instructions." ]]; then
        printf "${BOLD}${WHITE}Awaiting instructions.${RST}\n"
    else
        local line2=""
        if [[ -n "$desc" && "$desc" != "Awaiting instructions." ]]; then
            line2="$desc"
        fi
        if [[ -n "$summary" && "$summary" != "Awaiting instructions." ]]; then
            if [[ -n "$line2" ]]; then
                line2="${line2}: ${summary}"
            else
                line2="$summary"
            fi
        fi

        if [[ -n "$line2" ]]; then
            printf "${DIM}%s${RST}\n" "$line2"
        fi
    fi
}

# Format statusline to compact one-line format (for fzf selection list)
#
# Usage: format_statusline_oneline <json> <pane_ref>
#
# Output:
#   [Name:id] Model | ctx:X% | $cost | Description: Summary
#
format_statusline_oneline() {
    local json="$1"
    local pane_ref="${2:-}"

    local name=$(echo "$json" | jq -r '.name // "?"')
    local short_id=$(echo "$json" | jq -r '.short_id // "?????"')
    local model=$(echo "$json" | jq -r '.model // "?"')
    local ctx=$(echo "$json" | jq -r '.context_pct // 0')
    local cost=$(echo "$json" | jq -r '.cost // "0.00"')
    local desc=$(echo "$json" | jq -r '.description // ""' | tr -d '\n')
    local summary=$(echo "$json" | jq -r '.summary // ""' | tr -d '\n')

    # Context color
    local ctx_color="$GREEN"
    if [[ "$ctx" -ge 80 ]]; then
        ctx_color='\033[31m'
    elif [[ "$ctx" -ge 50 ]]; then
        ctx_color="$YELLOW"
    fi

    # Pane ref prefix if provided
    if [[ -n "$pane_ref" ]]; then
        printf "${GREY}[%s]${RST} " "$pane_ref"
    fi

    printf "${CYAN}[${BOLD}${WHITE}%s${RST}${CYAN}:${GREY}%s${CYAN}]${RST} " "$name" "$short_id"
    printf "${MAGENTA}%s${RST} " "$model"
    printf "${DIM}|${RST} ${ctx_color}ctx:%d%%${RST} " "$ctx"
    printf "${DIM}|${RST} ${GREEN}\$%s${RST}" "$cost"

    # Add summary/description
    local task=""
    if [[ -n "$desc" && "$desc" != "Awaiting instructions." ]]; then
        task="$desc"
    fi
    if [[ -n "$summary" && "$summary" != "Awaiting instructions." ]]; then
        if [[ -n "$task" ]]; then
            task="${task}: ${summary}"
        else
            task="$summary"
        fi
    fi

    if [[ -n "$task" ]]; then
        printf " ${DIM}|${RST} ${WHITE}%s${RST}" "$task"
    fi
    printf "\n"
}

# Get the latest statusline for a session from JSONL log
#
# Usage: get_latest_statusline <session_id>
#
# Arguments:
#   session_id - Full or short (8-char) session ID
#
# Returns:
#   JSON object with statusline value on stdout, empty if not found
#
get_latest_statusline() {
    local session_id="$1"
    local short_id="${session_id:0:8}"

    if [[ ! -f "$STATUSLINE_LOG" ]]; then
        return 1
    fi

    # Find most recent statusline_render for this session
    grep "\"type\":\"statusline_render\"" "$STATUSLINE_LOG" 2>/dev/null \
        | grep "\"session\":\"$short_id\"" \
        | tail -1 \
        | jq -r '.value // empty' 2>/dev/null
}

# Get formatted statusline for a session (ready to display)
#
# Usage: get_formatted_statusline <session_id> [oneline]
#
# Arguments:
#   session_id - Full or short session ID
#   oneline    - If "oneline", use compact format
#
get_formatted_statusline() {
    local session_id="$1"
    local format="${2:-full}"

    local json
    json=$(get_latest_statusline "$session_id")

    if [[ -z "$json" || "$json" == "null" ]]; then
        return 1
    fi

    if [[ "$format" == "oneline" ]]; then
        format_statusline_oneline "$json"
    else
        format_statusline "$json"
    fi
}
