#!/bin/bash
# Git-Flow Session Start Hook
# Detects worktree context and injects branch information

set -e

# Get script directory for relative imports
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if we're in a git repository
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    exit 0
fi

# Check if we're in a worktree (not main repo)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
IS_WORKTREE=false
if [[ "$GIT_DIR" == *"worktrees"* ]]; then
    IS_WORKTREE=true
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

# Build context message
CONTEXT=""

if [ "$IS_WORKTREE" = true ]; then
    WORKTREE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

    CONTEXT="Git-Flow Worktree Context:
- Working in git worktree (isolated workspace)
- Branch: $CURRENT_BRANCH
- Worktree root: $WORKTREE_ROOT

This session is operating in an isolated worktree. Changes made here are on branch '$CURRENT_BRANCH' and will not affect the main repository until merged."

elif [ -n "$CURRENT_BRANCH" ]; then
    # Check if branch looks like a feature branch
    if [[ "$CURRENT_BRANCH" == feature/* ]] || [[ "$CURRENT_BRANCH" == fix/* ]]; then
        CONTEXT="Git-Flow Branch Context:
- On feature branch: $CURRENT_BRANCH
- Not in a worktree (working in main repository)

Consider using a worktree for isolated work. Use /git-flow:worktree-create to set one up."
    fi
fi

# Output context if we have any
if [ -n "$CONTEXT" ]; then
    # Format for Claude Code hook output
    cat << EOF
$CONTEXT
EOF
fi

# Update registry last_seen if we have a session ID
if [ -n "$CLAUDE_SESSION_ID" ]; then
    # Run registry update in background to not block
    (
        cd "$PLUGIN_ROOT"
        python3 tools/registry.py update "$CLAUDE_SESSION_ID" --status active 2>/dev/null || true
    ) &
fi

exit 0
