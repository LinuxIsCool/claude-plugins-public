#!/bin/bash
#
# Claude Code Statusline - Instance Identity Display
#
# Displays: [Name:id] Model X.X | dir | ctx:N% | $X.XX | ID:A#N Tm | branch +X/-Y
#           Description: Summary | ✳ Pane Title (Claude's internal task summary)
#
# Session tracking format: Cx:A#N
#   Cx = Claude process number (spawn order: C1, C2, C3...)
#   A  = Agent session (context resets: derived from JSONL, counts compact/clear events)
#   N  = Prompt count (persists across context compaction)
#
# Architecture:
# - Process number: Assigned on first registration, stored in registry, monotonic counter
# - Agent session: Derived directly from JSONL by counting compact/clear events
# - Both are elegant single-source-of-truth approaches
#
# Branch color: blue=clean, red=dirty
#
# Receives JSON from Claude Code via stdin with:
# - session_id: Unique session identifier
# - model.display_name: Current model
# - workspace.current_dir: Working directory
# - context_window.*: Token usage
# - cost.total_cost_usd: Session cost
#
# Install: Copy to ~/.claude/statusline.sh and chmod +x
# Configure in ~/.claude/settings.json:
# {
#   "statusLine": {
#     "type": "command",
#     "command": "~/.claude/statusline.sh"
#   }
# }

# Verify jq is available (required for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo "Claude | jq required but not installed"
    exit 0
fi

# Source shared utilities (resolve symlinks to find actual plugin location)
SCRIPT_PATH="${BASH_SOURCE[0]}"
while [ -L "$SCRIPT_PATH" ]; do
    SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ "$SCRIPT_PATH" != /* ]] && SCRIPT_PATH="$SCRIPT_DIR/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
source "$SCRIPT_DIR/../lib/statusline-utils.sh"

# Read JSON input
input=$(cat)

# Log raw Claude input for historical analysis
log_claude_input() {
    local ts
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local sid=$(echo "$input" | jq -r '.session_id // "unknown"')
    local short_session="${sid:0:8}"
    mkdir -p "$(dirname "$STATUSLINE_LOG")"
    # Compact the input JSON and embed it
    local compact_input=$(echo "$input" | jq -c '.')
    echo "{\"ts\":\"$ts\",\"session\":\"$short_session\",\"type\":\"claude_input\",\"value\":$compact_input,\"ok\":true}" >> "$STATUSLINE_LOG"
}

log_claude_input

# Parse fields with jq
SESSION_ID=$(echo "$input" | jq -r '.session_id // "unknown"')
SHORT_ID=$(echo "$SESSION_ID" | cut -c1-5)
MODEL=$(echo "$input" | jq -r '.model.display_name // "Claude"')
CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // ""')
# Show full path, shortened with ~ for home
CWD_DISPLAY=$(echo "$CURRENT_DIR" | sed "s|^$HOME|~|")

# Context window percentage - simple calculation from cache tokens
CTX_SIZE=$(echo "$input" | jq -r '.context_window.context_window_size // 200000')
CURRENT_INPUT=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
CACHE_CREATION=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
CACHE_READ=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')

# Total tokens from current_usage
TOTAL_TOKENS=$((CURRENT_INPUT + CACHE_CREATION + CACHE_READ))

if [ "$CTX_SIZE" -gt 0 ] && [ "$TOTAL_TOKENS" -gt 0 ]; then
    PCT=$((TOTAL_TOKENS * 100 / CTX_SIZE))
else
    PCT=0
fi

# Cost
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
COST_FMT=$(printf "%.2f" "$COST")

# Look up instance name from registry
# Check multiple locations for the registry (project-local first, then global)
# Use CURRENT_DIR from input, not shell CWD, to ensure consistency with hooks
REGISTRY=""
for loc in "${CURRENT_DIR}/.claude/instances/registry.json" "$HOME/.claude/instances/registry.json"; do
    if [ -f "$loc" ]; then
        REGISTRY="$loc"
        break
    fi
done

# Configure JSONL logging to same directory as registry
# This ensures all instance data (registry, summaries, descriptions, logs) stays together
if [ -n "$REGISTRY" ]; then
    STATUSLINE_LOG="$(dirname "$REGISTRY")/statusline.jsonl"
fi

# Get instance name and process number from registry
REGISTERED_NAME=""
PROCESS_NUM=""
if [ -n "$REGISTRY" ] && command -v jq &> /dev/null; then
    REGISTERED_NAME=$(jq -r --arg sid "$SESSION_ID" '.[$sid].name // empty' "$REGISTRY" 2>/dev/null)
    PROCESS_NUM=$(jq -r --arg sid "$SESSION_ID" '.[$sid].process_number // empty' "$REGISTRY" 2>/dev/null)

    # Auto-register session if process_number is missing (race condition fix)
    if [ -z "$PROCESS_NUM" ] && [ "$SESSION_ID" != "unknown" ]; then
        INSTANCES_DIR=$(dirname "$REGISTRY")
        COUNTER_FILE="$INSTANCES_DIR/process_counter.txt"

        # Atomically get next process number
        if [ -f "$COUNTER_FILE" ]; then
            PROCESS_NUM=$(cat "$COUNTER_FILE" 2>/dev/null)
            PROCESS_NUM=$((PROCESS_NUM + 1))
        else
            PROCESS_NUM=1
        fi
        echo "$PROCESS_NUM" > "$COUNTER_FILE"

        # Register in registry (atomic with flock)
        # CRITICAL: Preserve existing name and created timestamp - only add missing fields
        TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        update_registry "$REGISTRY" \
            --arg sid "$SESSION_ID" \
            --arg ts "$TIMESTAMP" \
            --arg cwd "$CURRENT_DIR" \
            --argjson pnum "$PROCESS_NUM" \
            '.[$sid] = ((.[$sid] // {}) + {
              "cwd": $cwd,
              "last_seen": $ts,
              "status": "active",
              "process_number": $pnum
            }) | .[$sid].name = (.[$sid].name // "Claude") | .[$sid].created = (.[$sid].created // $ts)'

        # Log the auto-registration
        log_statusline "auto_register" "$SESSION_ID" "process=$PROCESS_NUM"
    fi
fi

# Determine display name
if [ -n "$REGISTERED_NAME" ] && [[ ! "$REGISTERED_NAME" =~ ^Claude- ]] && [ "$REGISTERED_NAME" != "Claude" ]; then
    # Custom name set - use it
    NAME="$REGISTERED_NAME"
else
    # No custom name - default to "Claude"
    NAME="Claude"
fi

# ANSI colors (optional, comment out for plain text)
# Reset
RST="\033[0m"
# Styles
BOLD="\033[1m"
DIM="\033[2m"
# Colors
CYAN="\033[36m"
YELLOW="\033[33m"
GREEN="\033[32m"
WHITE="\033[97m"

# Context color based on usage
if [ "$PCT" -lt 50 ]; then
    CTX_COLOR="$GREEN"
elif [ "$PCT" -lt 80 ]; then
    CTX_COLOR="$YELLOW"
else
    CTX_COLOR="\033[31m"  # Red
fi

# Extract short model name (Opus 4.5, Sonnet 4, Haiku 3.5, etc.)
# Check if model contains a known name, then extract it with version
if echo "$MODEL" | grep -qE '(Opus|Sonnet|Haiku)'; then
    MODEL_SHORT=$(echo "$MODEL" | sed -E 's/.*(Opus|Sonnet|Haiku)( [0-9.]+)?.*/\1\2/')
else
    MODEL_SHORT="Claude"
fi

# Backfill model to registry if missing (atomic with flock)
if [ -n "$REGISTRY" ] && [ -n "$SESSION_ID" ] && [ "$SESSION_ID" != "unknown" ]; then
    STORED_MODEL=$(jq -r --arg sid "$SESSION_ID" '.[$sid].model // empty' "$REGISTRY" 2>/dev/null)
    if [ -z "$STORED_MODEL" ] && [ -n "$MODEL" ] && [ "$MODEL" != "Claude" ]; then
        update_registry "$REGISTRY" \
            --arg sid "$SESSION_ID" \
            --arg model "$MODEL" \
            '.[$sid].model = $model'
        # Log model detection
        log_statusline "model" "$SESSION_ID" "$MODEL"
    fi
fi

# Read user prompt count (default to 0 for new sessions)
MSG_COUNT="0"
COUNTS_DIR=$(dirname "$REGISTRY")/counts
COUNT_FILE="$COUNTS_DIR/${SESSION_ID}.txt"
if [ -f "$COUNT_FILE" ]; then
    MSG_COUNT=$(cat "$COUNT_FILE" 2>/dev/null)
fi

# Derive agent session (compaction counter) directly from JSONL
# This is the elegant approach - single source of truth, no state file needed
AGENT_SESSION="0"

if [ -d "$CURRENT_DIR/.claude/logging" ]; then
    # Find this session's JSONL file (uses first 8 chars of session_id)
    SESSION_PREFIX="${SESSION_ID:0:8}"
    JSONL_FILE=$(find "$CURRENT_DIR/.claude/logging" -type f -name "*-${SESSION_PREFIX}.jsonl" 2>/dev/null | head -1)

    if [ -f "$JSONL_FILE" ]; then
        # Count SessionStart events with source="compact" or source="clear"
        # These indicate context resets within the same session
        # Note: grep -c outputs "0" for no matches but exits with code 1,
        # so we capture output first, then default if empty
        AGENT_SESSION=$(grep -cE '"source":\s*"(compact|clear)"' "$JSONL_FILE" 2>/dev/null)
        [ -z "$AGENT_SESSION" ] && AGENT_SESSION="0"
    fi
fi

# Calculate session duration (default to 0m for new sessions)
DURATION="0m"
if [ -n "$REGISTRY" ] && [ -n "$SESSION_ID" ]; then
    CREATED=$(jq -r --arg sid "$SESSION_ID" '.[$sid].created // empty' "$REGISTRY" 2>/dev/null)
    if [ -n "$CREATED" ]; then
        # Convert ISO timestamp to epoch
        CREATED_EPOCH=$(date -d "$CREATED" +%s 2>/dev/null)
        NOW_EPOCH=$(date +%s)
        if [ -n "$CREATED_EPOCH" ]; then
            DIFF=$((NOW_EPOCH - CREATED_EPOCH))
            HOURS=$((DIFF / 3600))
            MINS=$(((DIFF % 3600) / 60))
            if [ "$HOURS" -gt 0 ]; then
                DURATION="${HOURS}h${MINS}m"
            else
                DURATION="${MINS}m"
            fi
        fi
    fi
fi

# Git info: project root, branch, dirty state, and diff stats
BRANCH=""
PROJECT_ROOT=""
GIT_DIRTY=""
GIT_STATS=""
if command -v git &> /dev/null && git rev-parse --git-dir &> /dev/null; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    PROJECT_ROOT=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)

    # Check if workspace is dirty
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        GIT_DIRTY="yes"
    fi

    # Get diff stats (insertions/deletions) including untracked files
    # Use HEAD to include both staged and unstaged changes
    DIFF_STAT=$(git diff --shortstat HEAD 2>/dev/null)
    INSERTIONS=0
    DELETIONS=0
    if [ -n "$DIFF_STAT" ]; then
        # Parse: " 3 files changed, 45 insertions(+), 12 deletions(-)"
        INSERTIONS=$(echo "$DIFF_STAT" | grep -oP '\d+(?= insertion)' || echo "0")
        DELETIONS=$(echo "$DIFF_STAT" | grep -oP '\d+(?= deletion)' || echo "0")
        [ -z "$INSERTIONS" ] && INSERTIONS="0"
        [ -z "$DELETIONS" ] && DELETIONS="0"
    fi

    # Add lines from untracked files to insertions count
    UNTRACKED_LINES=$(git status --porcelain 2>/dev/null | grep "^??" | cut -c4- | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    [ -n "$UNTRACKED_LINES" ] && INSERTIONS=$((INSERTIONS + UNTRACKED_LINES))

    if [ "$INSERTIONS" != "0" ] || [ "$DELETIONS" != "0" ]; then
        GIT_STATS="+${INSERTIONS}/-${DELETIONS}"
    fi
fi

# Read conversation summary if available (create with default if missing)
SUMMARY=""
SUMMARY_DIR=$(dirname "$REGISTRY")/summaries
SUMMARY_FILE="$SUMMARY_DIR/${SESSION_ID}.txt"
if [ -f "$SUMMARY_FILE" ]; then
    SUMMARY=$(cat "$SUMMARY_FILE" 2>/dev/null)
fi
if [ -z "$SUMMARY" ]; then
    SUMMARY="Awaiting instructions."
    mkdir -p "$SUMMARY_DIR"
    echo "$SUMMARY" > "$SUMMARY_FILE"
fi

# Read agent description if available (create with default if missing)
DESCRIPTION=""
DESCRIPTION_DIR=$(dirname "$REGISTRY")/descriptions
DESCRIPTION_FILE="$DESCRIPTION_DIR/${SESSION_ID}.txt"
if [ -f "$DESCRIPTION_FILE" ]; then
    DESCRIPTION=$(cat "$DESCRIPTION_FILE" 2>/dev/null)
fi
if [ -z "$DESCRIPTION" ]; then
    DESCRIPTION="Awaiting instructions."
    mkdir -p "$DESCRIPTION_DIR"
    echo "$DESCRIPTION" > "$DESCRIPTION_FILE"
fi

# Read pane title from tmux (Claude Code's internal task summary with ✳ prefix)
# This is set internally by Claude Code and provides a complementary view of current work
# IMPORTANT: Use -t "$TMUX_PANE" to target THIS Claude's pane, not the currently focused pane.
# Without -t, tmux returns the title of whatever pane happens to be focused, which causes
# cross-contamination (showing other Claude instances' titles or shell command lines).
PANE_TITLE=""
if command -v tmux &> /dev/null && [ -n "$TMUX" ]; then
    if [ -n "$TMUX_PANE" ]; then
        PANE_TITLE=$(tmux display-message -t "$TMUX_PANE" -p '#{pane_title}' 2>/dev/null)
    else
        # Fallback if TMUX_PANE not set (shouldn't happen in normal Claude Code execution)
        PANE_TITLE=$(tmux display-message -p '#{pane_title}' 2>/dev/null)
    fi
fi

# Output the statusline
# Format: [Name:id] Model | dir | ctx:N% | $X.XX | #N Tm | branch +X/-Y
#         summary on next line
MAGENTA="\033[35m"
BLUE="\033[34m"
RED="\033[31m"

# Extract last directory from path for bold emphasis
CWD_PARENT=$(dirname "$CWD_DISPLAY")
CWD_LAST=$(basename "$CWD_DISPLAY")
if [ "$CWD_PARENT" = "." ] || [ "$CWD_PARENT" = "$CWD_DISPLAY" ]; then
    CWD_FORMATTED="${BOLD}${CWD_LAST}${RST}"
else
    CWD_FORMATTED="${DIM}${CWD_PARENT}/${RST}${BOLD}${CWD_LAST}${RST}"
fi

# Build the first line
LINE1="${CYAN}[${BOLD}${NAME}${RST}${CYAN}:${SHORT_ID}]${RST} ${YELLOW}${MODEL_SHORT}${RST} | ${CWD_FORMATTED} | ${CTX_COLOR}ctx:${PCT}%${RST} | ${GREEN}\$${COST_FMT}${RST}"

# Add session tracking: Cx:A#N format
# Format: C<process_num>:<agent_session>#<prompt_count>
# Process number is spawn order (C1, C2, C3...), agent_session is compaction count
# Continued sessions (SessionStart never fired) show "C?:" to indicate unknown spawn order
if [ -n "$PROCESS_NUM" ]; then
    SESSION_TRACK="C${PROCESS_NUM}:${AGENT_SESSION}#${MSG_COUNT}"
else
    # No process number - this is a continued session (SessionStart didn't fire)
    # Show "C?" to indicate unknown spawn order, still show agent session and prompt count
    SESSION_TRACK="C?:${AGENT_SESSION}#${MSG_COUNT}"
fi

LINE1="${LINE1} | ${MAGENTA}${SESSION_TRACK}${RST}"
if [ -n "$DURATION" ]; then
    LINE1="${LINE1} | ${DIM}${DURATION}${RST}"
fi

# Add git info: project:branch (blue=clean, red=dirty, always bold) and diff stats
if [ -n "$BRANCH" ]; then
    GIT_DISPLAY="${PROJECT_ROOT}:${BRANCH}"
    if [ -n "$GIT_DIRTY" ]; then
        LINE1="${LINE1} | ${BOLD}${RED}${GIT_DISPLAY}${RST}"
    else
        LINE1="${LINE1} | ${BOLD}${BLUE}${GIT_DISPLAY}${RST}"
    fi
    if [ -n "$GIT_STATS" ]; then
        LINE1="${LINE1} ${DIM}${GIT_STATS}${RST}"
    fi
fi

echo -e "$LINE1"

# Second line: "Description: Summary | ✳ Pane Title" format
# Shows agent arc + current focus + Claude's internal task summary
if [ -n "$DESCRIPTION" ] || [ -n "$SUMMARY" ] || [ -n "$PANE_TITLE" ]; then
    LINE2=""

    # Check if both are placeholders (fresh instance) - show only "Awaiting instructions."
    if [ "$DESCRIPTION" = "Awaiting instructions." ] && [ "$SUMMARY" = "Awaiting instructions." ]; then
        echo -e "${BOLD}${WHITE}Awaiting instructions.${RST}"
    else
        # Build content line with description bold, summary not bold
        if [ -n "$DESCRIPTION" ] && [ "$DESCRIPTION" != "Awaiting instructions." ]; then
            LINE2="${BOLD}${WHITE}${DESCRIPTION}${RST}"
        fi
        if [ -n "$SUMMARY" ] && [ "$SUMMARY" != "Awaiting instructions." ]; then
            if [ -n "$LINE2" ]; then
                LINE2="${LINE2}${WHITE}: ${SUMMARY}${RST}"
            else
                LINE2="${WHITE}${SUMMARY}${RST}"
            fi
        fi

        # Append pane title (Claude's internal task summary) if available
        # The ✳ emoji is included as-is from the pane title
        if [ -n "$PANE_TITLE" ] && [ "$PANE_TITLE" != "bash" ] && [ "$PANE_TITLE" != "fish" ]; then
            if [ -n "$LINE2" ]; then
                LINE2="${LINE2} ${DIM}|${RST} ${CYAN}${PANE_TITLE}${RST}"
            else
                LINE2="${CYAN}${PANE_TITLE}${RST}"
            fi
        fi
        [ -n "$LINE2" ] && echo -e "$LINE2"
    fi
fi

# Log complete statusline state for historical analysis
# This captures ALL data displayed in the statusline
log_statusline_state() {
    local ts
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local short_session="${SESSION_ID:0:8}"
    mkdir -p "$(dirname "$STATUSLINE_LOG")"

    # Escape values for JSON
    local name_escaped=$(echo "$NAME" | sed 's/"/\\"/g')
    local model_escaped=$(echo "$MODEL_SHORT" | sed 's/"/\\"/g')
    local cwd_escaped=$(echo "$CWD_DISPLAY" | sed 's/"/\\"/g')
    local branch_escaped=$(echo "$BRANCH" | sed 's/"/\\"/g')
    local summary_escaped=$(echo "$SUMMARY" | sed 's/"/\\"/g' | tr '\n' ' ')
    local desc_escaped=$(echo "$DESCRIPTION" | sed 's/"/\\"/g' | tr '\n' ' ')
    local pane_title_escaped=$(echo "$PANE_TITLE" | sed 's/"/\\"/g' | tr '\n' ' ')

    cat >> "$STATUSLINE_LOG" << JSONEOF
{"ts":"$ts","session":"$short_session","type":"statusline_render","value":{"name":"$name_escaped","short_id":"$SHORT_ID","model":"$model_escaped","cwd":"$cwd_escaped","context_pct":$PCT,"cost":"$COST_FMT","process_num":"${PROCESS_NUM:-?}","agent_session":"$AGENT_SESSION","prompt_count":"$MSG_COUNT","duration":"$DURATION","branch":"$branch_escaped","git_stats":"$GIT_STATS","git_dirty":"${GIT_DIRTY:-no}","description":"$desc_escaped","summary":"$summary_escaped","pane_title":"$pane_title_escaped"},"ok":true}
JSONEOF
}

log_statusline_state
