#!/bin/bash
#
# Prompt History - Extract user prompts from conversation JSONL logs
#
# Retrieves the actual text of user prompts submitted during a Claude session.
# Prompts are stored in conversation logs at:
#   ~/.claude/logging/YYYY/MM/DD/HH-MM-SS-{session_prefix}.jsonl
#
# Source this file from scripts:
#   source "$SCRIPT_DIR/../lib/prompt-history.sh"
#
# Usage:
#   get_prompts "$session_id" 5          # Get last 5 prompts
#   get_formatted_prompts "$session_id"  # Get formatted for display

# ============================================================================
# Configuration
# ============================================================================

LOGGING_DIR="${LOGGING_DIR:-$HOME/.claude/logging}"
LOGGING_DIR_PROJECT="${LOGGING_DIR_PROJECT:-.claude/logging}"

# ANSI colors
PROMPT_COLOR='\033[36m'  # Cyan
PROMPT_PREFIX='\033[33m' # Yellow
RST='\033[0m'
DIM='\033[2m'

# ============================================================================
# Core Functions
# ============================================================================

# Find the conversation JSONL file for a session
#
# Usage: find_conversation_log <session_id> [cwd]
#
# Arguments:
#   session_id - Full or short (8-char) session ID
#   cwd        - Optional: project directory to search first
#
# Returns:
#   Path to JSONL file on stdout, empty if not found
#
find_conversation_log() {
    local session_id="$1"
    local cwd="${2:-$HOME}"
    local short_id="${session_id:0:8}"

    # Search in project first, then home
    local search_dirs=()
    [[ -d "$cwd/$LOGGING_DIR_PROJECT" ]] && search_dirs+=("$cwd/$LOGGING_DIR_PROJECT")
    [[ -d "$LOGGING_DIR" ]] && search_dirs+=("$LOGGING_DIR")

    for dir in "${search_dirs[@]}"; do
        # Find JSONL file matching session prefix
        # Filename format: HH-MM-SS-{8char}.jsonl
        local found
        found=$(find "$dir" -type f -name "*-${short_id}.jsonl" 2>/dev/null | head -1)
        if [[ -n "$found" ]]; then
            echo "$found"
            return 0
        fi
    done

    return 1
}

# Get user prompts from a session's conversation log
#
# Usage: get_prompts <session_id> [limit] [cwd]
#
# Arguments:
#   session_id - Full or short session ID
#   limit      - Max number of prompts to return (default: 10)
#   cwd        - Optional: project directory
#
# Returns:
#   One prompt per line on stdout
#
get_prompts() {
    local session_id="$1"
    local limit="${2:-10}"
    local cwd="${3:-$HOME}"

    local log_file
    log_file=$(find_conversation_log "$session_id" "$cwd")

    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        return 1
    fi

    # Extract prompts from UserPromptSubmit events
    # Format: {"type": "UserPromptSubmit", "data": {"prompt": "..."}}
    grep '"type":"UserPromptSubmit"\|"type": "UserPromptSubmit"' "$log_file" 2>/dev/null \
        | jq -r '.data.prompt // empty' 2>/dev/null \
        | tail -"$limit"
}

# Get prompts formatted for display with timestamps
#
# Usage: get_formatted_prompts <session_id> [limit] [cwd]
#
# Output format:
#   [12:34:56] > What is the meaning of life?
#
get_formatted_prompts() {
    local session_id="$1"
    local limit="${2:-10}"
    local cwd="${3:-$HOME}"

    local log_file
    log_file=$(find_conversation_log "$session_id" "$cwd")

    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        return 1
    fi

    # Extract prompts with timestamps
    grep '"type":"UserPromptSubmit"\|"type": "UserPromptSubmit"' "$log_file" 2>/dev/null \
        | tail -"$limit" \
        | while read -r line; do
            local ts prompt time_display
            ts=$(echo "$line" | jq -r '.ts // ""' 2>/dev/null)
            prompt=$(echo "$line" | jq -r '.data.prompt // ""' 2>/dev/null)

            if [[ -n "$prompt" ]]; then
                # Format timestamp to local time
                if [[ -n "$ts" ]]; then
                    time_display=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")
                else
                    time_display="??:??:??"
                fi

                # Truncate long prompts for display
                if [[ ${#prompt} -gt 80 ]]; then
                    prompt="${prompt:0:77}..."
                fi

                printf "${DIM}[%s]${RST} ${PROMPT_PREFIX}>${RST} ${PROMPT_COLOR}%s${RST}\n" "$time_display" "$prompt"
            fi
        done
}

# Get prompts formatted with minimal decoration
#
# Usage: get_simple_prompts <session_id> [limit] [cwd]
#
# Output format:
#   > What is the meaning of life?
#
get_simple_prompts() {
    local session_id="$1"
    local limit="${2:-10}"
    local cwd="${3:-$HOME}"

    get_prompts "$session_id" "$limit" "$cwd" | while read -r prompt; do
        # Truncate long prompts
        if [[ ${#prompt} -gt 100 ]]; then
            prompt="${prompt:0:97}..."
        fi
        printf "${PROMPT_PREFIX}>${RST} ${PROMPT_COLOR}%s${RST}\n" "$prompt"
    done
}

# Count total prompts in a session
#
# Usage: count_prompts <session_id> [cwd]
#
count_prompts() {
    local session_id="$1"
    local cwd="${2:-$HOME}"

    local log_file
    log_file=$(find_conversation_log "$session_id" "$cwd")

    if [[ -z "$log_file" || ! -f "$log_file" ]]; then
        echo "0"
        return
    fi

    grep -c '"type":"UserPromptSubmit"\|"type": "UserPromptSubmit"' "$log_file" 2>/dev/null || echo "0"
}
