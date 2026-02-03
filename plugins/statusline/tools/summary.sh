#!/bin/bash
#
# Update conversation summary for statusline display
#
# Usage: summary.sh <session_id> "5-10 word summary"
#        summary.sh <session_id> --history   # Show last 20 summaries
#
# The summary should be a concise reflection of the session (5-10 words).
# Written in first person from the agent's perspective.
# No truncation - the LLM is responsible for keeping it concise.
#
# Stores history in .claude/instances/summaries/{session_id}.history
# Current summary in .claude/instances/summaries/{session_id}.txt

SESSION_ID="$1"
SUMMARY="$2"

if [ -z "$SESSION_ID" ]; then
    echo "Usage: summary.sh <session_id> \"comprehensive summary\""
    echo "       summary.sh <session_id> --history"
    exit 1
fi

# Find summaries directory
SUMMARIES_DIR=""
for loc in ".claude/instances/summaries" "$HOME/.claude/instances/summaries"; do
    parent=$(dirname "$loc")
    if [ -d "$parent" ]; then
        mkdir -p "$loc"
        SUMMARIES_DIR="$loc"
        break
    fi
done

if [ -z "$SUMMARIES_DIR" ]; then
    mkdir -p "$HOME/.claude/instances/summaries"
    SUMMARIES_DIR="$HOME/.claude/instances/summaries"
fi

HISTORY_FILE="$SUMMARIES_DIR/${SESSION_ID}.history"
CURRENT_FILE="$SUMMARIES_DIR/${SESSION_ID}.txt"

# Show history if requested
if [ "$SUMMARY" = "--history" ]; then
    if [ -f "$HISTORY_FILE" ]; then
        TOTAL=$(wc -l < "$HISTORY_FILE")
        echo "Summary history ($TOTAL entries, showing last 20):"
        echo "---"
        tail -20 "$HISTORY_FILE"
    else
        echo "No history yet"
    fi
    exit 0
fi

if [ -z "$SUMMARY" ]; then
    echo "Usage: summary.sh <session_id> \"comprehensive summary\""
    exit 1
fi

# Append to history (no truncation - LLM manages length)
echo "$SUMMARY" >> "$HISTORY_FILE"

# Write current summary
echo "$SUMMARY" > "$CURRENT_FILE"

# Show context for Claude
echo "Summary updated."
echo ""
echo "=== CURRENT ==="
echo "${SUMMARY:0:200}"
echo ""
echo "=== PREVIOUS SUMMARIES (last 20, use for long-term memory context) ==="
# Show previous entries (excluding the one we just added)
if [ -f "$HISTORY_FILE" ]; then
    TOTAL=$(wc -l < "$HISTORY_FILE")
    if [ "$TOTAL" -gt 1 ]; then
        head -n $((TOTAL - 1)) "$HISTORY_FILE" | tail -20
    else
        echo "(first summary)"
    fi
fi
