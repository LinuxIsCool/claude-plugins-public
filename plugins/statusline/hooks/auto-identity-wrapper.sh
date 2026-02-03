#!/bin/bash
#
# Wrapper for auto-identity.py - unified name/description/summary generator
# This single hook replaces three separate hooks, reducing subprocess spawns from 3 to 1.
#

# Read stdin into variable
INPUT=$(cat)

# Debug output if DEBUG_IDENTITY is set
if [ -n "$DEBUG_IDENTITY" ]; then
    echo "[identity-wrapper] Input length: ${#INPUT}" >&2
fi

# Pass via environment variable to the Python script
export HOOK_INPUT="$INPUT"

# Run the script (from same directory as this wrapper)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
uv run "${SCRIPT_DIR}/auto-identity.py"
