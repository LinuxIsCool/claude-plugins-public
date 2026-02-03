#!/bin/bash
#
# Wrapper for autocommit.py that handles stdin properly.
# uv run doesn't pass stdin through, so we capture it first.
#
# Based on proven pattern from statusline plugin's auto-name-wrapper.sh
#

# Read stdin into variable
INPUT=$(cat)

# Debug output if DEBUG_AUTOCOMMIT is set
if [ -n "$DEBUG_AUTOCOMMIT" ]; then
    echo "[autocommit-wrapper] Input length: ${#INPUT}" >&2
fi

# Pass via environment variable to the Python script
export HOOK_INPUT="$INPUT"

# Run the script (from same directory as this wrapper)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
uv run "${SCRIPT_DIR}/autocommit.py"
