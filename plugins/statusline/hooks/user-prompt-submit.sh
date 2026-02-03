#!/bin/bash
#
# Track user prompt submissions per session
# Also ensures session is properly registered (handles continued sessions where SessionStart doesn't fire)
#
# Receives JSON via stdin with:
# - session_id: Unique session identifier
# - cwd: Current working directory
#
# Increments counter in .claude/instances/counts/{session_id}.txt
# Ensures registry entry exists with all required fields

# Source shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/statusline-utils.sh"

# Read JSON input
INPUT=$(cat)

# Parse fields
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Exit if no session ID
if [ -z "$SESSION_ID" ]; then
    exit 0
fi

# Find instances directory (use absolute CWD path, fallback to HOME)
INSTANCES_DIR=""
for loc in "$CWD/.claude/instances" "$HOME/.claude/instances"; do
    if [ -d "$loc" ]; then
        INSTANCES_DIR="$loc"
        break
    fi
done

# Create instances dir if needed (fallback to HOME)
if [ -z "$INSTANCES_DIR" ]; then
    INSTANCES_DIR="$HOME/.claude/instances"
    mkdir -p "$INSTANCES_DIR"
fi

REGISTRY="$INSTANCES_DIR/registry.json"

# Configure JSONL logging to same directory as registry
# This ensures all instance data (registry, summaries, descriptions, logs) stays together
STATUSLINE_LOG="$INSTANCES_DIR/statusline.jsonl"

# Initialize registry if needed
if [ ! -f "$REGISTRY" ]; then
    echo "{}" > "$REGISTRY"
fi

# Check if session is properly registered (has 'created' field)
# If not, this is a continued session - create/update the entry
HAS_CREATED=$(jq -r --arg sid "$SESSION_ID" '.[$sid].created // empty' "$REGISTRY" 2>/dev/null)

if [ -z "$HAS_CREATED" ]; then
    # Session missing or incomplete - this is a continued session
    # Try to find actual creation time from JSONL log filename
    SESSION_PREFIX="${SESSION_ID:0:8}"
    ACTUAL_CREATED=""

    # Search for JSONL file in project and home logging directories
    for LOG_DIR in "$CWD/.claude/logging" "$HOME/.claude/logging"; do
        if [ -d "$LOG_DIR" ]; then
            JSONL_FILE=$(find "$LOG_DIR" -type f -name "*-${SESSION_PREFIX}.jsonl" 2>/dev/null | head -1)
            if [ -n "$JSONL_FILE" ]; then
                # Extract timestamp from filename: YYYY/MM/DD/HH-MM-SS-xxxxxxxx.jsonl
                # Example: 2025/12/18/09-24-12-85279a1f.jsonl
                FILENAME=$(basename "$JSONL_FILE")
                DATE_PATH=$(dirname "$JSONL_FILE" | grep -oE '[0-9]{4}/[0-9]{2}/[0-9]{2}$')
                TIME_PART=$(echo "$FILENAME" | grep -oE '^[0-9]{2}-[0-9]{2}-[0-9]{2}')

                if [ -n "$DATE_PATH" ] && [ -n "$TIME_PART" ]; then
                    # Parse: 2025/12/18 and 09-24-12
                    YEAR=$(echo "$DATE_PATH" | cut -d'/' -f1)
                    MONTH=$(echo "$DATE_PATH" | cut -d'/' -f2)
                    DAY=$(echo "$DATE_PATH" | cut -d'/' -f3)
                    HOUR=$(echo "$TIME_PART" | cut -d'-' -f1)
                    MIN=$(echo "$TIME_PART" | cut -d'-' -f2)
                    SEC=$(echo "$TIME_PART" | cut -d'-' -f3)

                    # Convert local time to UTC (assuming PDT = UTC-7 for now)
                    # For proper conversion, we'd use: date -u -d "..." but this is simpler
                    LOCAL_TS="${YEAR}-${MONTH}-${DAY}T${HOUR}:${MIN}:${SEC}"
                    ACTUAL_CREATED=$(TZ=UTC date -u -d "TZ=\"America/Los_Angeles\" ${LOCAL_TS}" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null)
                fi
                break
            fi
        fi
    done

    # Fallback to current time if we couldn't find the log
    TIMESTAMP="${ACTUAL_CREATED:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
    DIR_NAME=$(basename "$CWD" 2>/dev/null || echo "unknown")

    # Get existing name if any, else default
    EXISTING_NAME=$(jq -r --arg sid "$SESSION_ID" '.[$sid].name // empty' "$REGISTRY" 2>/dev/null)
    NAME="${EXISTING_NAME:-Claude}"

    # Get existing model if any
    EXISTING_MODEL=$(jq -r --arg sid "$SESSION_ID" '.[$sid].model // empty' "$REGISTRY" 2>/dev/null)

    # For continued sessions, DON'T assign a process_number
    # This avoids assigning incorrect numbers that don't reflect actual spawn order
    # The statusline will show "C?" for these sessions
    EXISTING_PNUM=$(jq -r --arg sid "$SESSION_ID" '.[$sid].process_number // empty' "$REGISTRY" 2>/dev/null)

    # Only assign process_number if SessionStart already set one
    # Continued sessions get marked with "continued": true instead
    if [ -n "$EXISTING_PNUM" ]; then
        # Update entry preserving existing process_number (atomic with flock)
        update_registry "$REGISTRY" \
            --arg sid "$SESSION_ID" \
            --arg name "$NAME" \
            --arg cwd "$CWD" \
            --arg ts "$TIMESTAMP" \
            --arg dir "$DIR_NAME" \
            --arg model "$EXISTING_MODEL" \
            --argjson pnum "$EXISTING_PNUM" \
            '.[$sid] = ((.[$sid] // {}) + {
              "name": (if .[$sid].name then .[$sid].name else $name end),
              "task": ("Working in " + $dir),
              "model": (if .[$sid].model then .[$sid].model else $model end),
              "cwd": $cwd,
              "created": $ts,
              "last_seen": $ts,
              "status": "active",
              "process_number": $pnum
            })'
    else
        # Continued session without process_number - mark as continued (atomic with flock)
        update_registry "$REGISTRY" \
            --arg sid "$SESSION_ID" \
            --arg name "$NAME" \
            --arg cwd "$CWD" \
            --arg ts "$TIMESTAMP" \
            --arg dir "$DIR_NAME" \
            --arg model "$EXISTING_MODEL" \
            '.[$sid] = ((.[$sid] // {}) + {
              "name": (if .[$sid].name then .[$sid].name else $name end),
              "task": ("Working in " + $dir),
              "model": (if .[$sid].model then .[$sid].model else $model end),
              "cwd": $cwd,
              "created": $ts,
              "last_seen": $ts,
              "status": "active",
              "continued": true
            })'
    fi
fi

# Update last_seen for existing sessions (atomic with flock)
update_registry "$REGISTRY" \
    --arg sid "$SESSION_ID" \
    --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    'if .[$sid] then .[$sid].last_seen = $ts | .[$sid].status = "active" else . end'

# Create required directories
COUNTS_DIR="$INSTANCES_DIR/counts"
SUMMARIES_DIR="$INSTANCES_DIR/summaries"
DESCRIPTIONS_DIR="$INSTANCES_DIR/descriptions"
mkdir -p "$COUNTS_DIR" "$SUMMARIES_DIR" "$DESCRIPTIONS_DIR"

# Initialize summary/description if missing
SUMMARY_FILE="$SUMMARIES_DIR/${SESSION_ID}.txt"
if [ ! -f "$SUMMARY_FILE" ]; then
    echo "Awaiting instructions." > "$SUMMARY_FILE"
fi

DESCRIPTION_FILE="$DESCRIPTIONS_DIR/${SESSION_ID}.txt"
if [ ! -f "$DESCRIPTION_FILE" ]; then
    echo "Awaiting instructions." > "$DESCRIPTION_FILE"
fi

# Increment counter
COUNT_FILE="$COUNTS_DIR/${SESSION_ID}.txt"
if [ -f "$COUNT_FILE" ]; then
    COUNT=$(cat "$COUNT_FILE")
    COUNT=$((COUNT + 1))
else
    COUNT=1
fi

echo "$COUNT" > "$COUNT_FILE"

# Log prompt count
log_statusline "prompt_count" "$SESSION_ID" "$COUNT"

exit 0
