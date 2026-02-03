#!/usr/bin/env bash
# Voice Hook Wrapper
# Ensures bun is available and env is loaded

# Add bun to PATH
export PATH="$HOME/.bun/bin:$PATH"

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the TypeScript hook with bun
exec bun run "$SCRIPT_DIR/voice-hook.ts" "$@"
