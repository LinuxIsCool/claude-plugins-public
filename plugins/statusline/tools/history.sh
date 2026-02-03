#!/bin/bash
#
# Statusline History Viewer
#
# View and replay historic statuslines from the JSONL log.
#
# Usage:
#   history.sh                    # Show latest statusline
#   history.sh list [N]           # List last N statuslines (default 10)
#   history.sh show <index>       # Show statusline at index (from list)
#   history.sh session <id>       # Show all statuslines for session
#   history.sh timeline           # Show session timeline with key events
#
# Log location: ~/.claude/instances/statusline.jsonl

LOG_FILE="$HOME/.claude/instances/statusline.jsonl"

if [ ! -f "$LOG_FILE" ]; then
    echo "No statusline log found at $LOG_FILE"
    exit 1
fi

# Render a statusline from JSON
render_statusline() {
    local json="$1"
    local ts=$(echo "$json" | jq -r '.ts // ""')
    local v=$(echo "$json" | jq -r '.value')

    local name=$(echo "$v" | jq -r '.name // "?"')
    local short_id=$(echo "$v" | jq -r '.short_id // "?????"')
    local model=$(echo "$v" | jq -r '.model // "?"')
    local cwd=$(echo "$v" | jq -r '.cwd // "?"')
    local ctx=$(echo "$v" | jq -r '.context_pct // 0')
    local cost=$(echo "$v" | jq -r '.cost // "0.00"')
    local pnum=$(echo "$v" | jq -r '.process_num // "?"')
    local agent=$(echo "$v" | jq -r '.agent_session // "0"')
    local prompts=$(echo "$v" | jq -r '.prompt_count // "0"')
    local duration=$(echo "$v" | jq -r '.duration // "0m"')
    local branch=$(echo "$v" | jq -r '.branch // ""')
    local stats=$(echo "$v" | jq -r '.git_stats // ""')
    local dirty=$(echo "$v" | jq -r '.git_dirty // "no"')
    local desc=$(echo "$v" | jq -r '.description // ""' | tr -d '\n')
    local summary=$(echo "$v" | jq -r '.summary // ""' | tr -d '\n')

    # Format timestamp
    local time_display=""
    if [ -n "$ts" ]; then
        time_display=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")
    fi

    # Shorten cwd for display
    local cwd_short=$(basename "$cwd")

    # Dirty indicator
    local dirty_mark=""
    [ "$dirty" = "yes" ] && dirty_mark="*"

    # Build line 1
    echo "[$name:$short_id] $model | $cwd_short | ctx:${ctx}% | \$${cost} | C${pnum}:${agent}#${prompts} | ${duration} | ${branch}${dirty_mark} ${stats}"

    # Build line 2
    if [ -n "$desc" ] || [ -n "$summary" ]; then
        local line2=""
        if [ -n "$desc" ] && [ "$desc" != "Awaiting instructions." ]; then
            line2="$desc"
        fi
        if [ -n "$summary" ] && [ "$summary" != "Awaiting instructions." ]; then
            if [ -n "$line2" ]; then
                line2="${line2}: ${summary}"
            else
                line2="$summary"
            fi
        fi
        [ -n "$line2" ] && echo "$line2"
    fi

    # Show timestamp (convert to local time)
    [ -n "$time_display" ] && echo "  @ $time_display"
}

# List recent statuslines
list_statuslines() {
    local count="${1:-10}"
    echo "=== Last $count Statuslines ==="
    echo ""

    grep '"type":"statusline_render"' "$LOG_FILE" | tail -n "$count" | nl -ba | while read idx line; do
        local ts=$(echo "$line" | jq -r '.ts // ""')
        local session=$(echo "$line" | jq -r '.session // ""')
        local name=$(echo "$line" | jq -r '.value.name // "?"')
        local ctx=$(echo "$line" | jq -r '.value.context_pct // 0')
        local prompts=$(echo "$line" | jq -r '.value.prompt_count // "0"')
        local time_display=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")

        printf "%3d. [%s] %-12s ctx:%2d%% #%-3s @ %s\n" "$idx" "$session" "$name" "$ctx" "$prompts" "$time_display"
    done
}

# Show statusline at index
show_at_index() {
    local index="$1"
    local json=$(grep '"type":"statusline_render"' "$LOG_FILE" | tail -n 100 | sed -n "${index}p")

    if [ -z "$json" ]; then
        echo "No statusline at index $index"
        exit 1
    fi

    echo "=== Statusline #$index ==="
    echo ""
    render_statusline "$json"
}

# Show all statuslines for a session
show_session() {
    local session="$1"
    echo "=== Session $session ==="
    echo ""

    grep '"type":"statusline_render"' "$LOG_FILE" | grep "\"session\":\"$session\"" | while read line; do
        render_statusline "$line"
        echo "---"
    done
}

# Show timeline of key events
show_timeline() {
    echo "=== Session Timeline ==="
    echo ""

    grep -v '"type":"statusline_render"\|"type":"claude_input"' "$LOG_FILE" | tail -20 | while read line; do
        local ts=$(echo "$line" | jq -r '.ts')
        local session=$(echo "$line" | jq -r '.session')
        local type=$(echo "$line" | jq -r '.type')
        local value=$(echo "$line" | jq -r '.value' | head -c 60)
        local local_time=$(date -d "$ts" "+%H:%M:%S" 2>/dev/null || echo "${ts:11:8}")
        echo "$local_time [$session] $type: $value"
    done
}

# Main
case "${1:-}" in
    list)
        list_statuslines "${2:-10}"
        ;;
    show)
        if [ -z "$2" ]; then
            echo "Usage: history.sh show <index>"
            exit 1
        fi
        show_at_index "$2"
        ;;
    session)
        if [ -z "$2" ]; then
            echo "Usage: history.sh session <session_id>"
            exit 1
        fi
        show_session "$2"
        ;;
    timeline)
        show_timeline
        ;;
    *)
        # Default: show latest
        echo "=== Latest Statusline ==="
        echo ""
        json=$(grep '"type":"statusline_render"' "$LOG_FILE" | tail -1)
        render_statusline "$json"
        echo ""
        echo "Use 'history.sh list' to see more, 'history.sh timeline' for events"
        ;;
esac
