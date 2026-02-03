---
name: branch-status
description: Check current git branch and worktree status
---

# Branch Status

Check the current git context and worktree status.

## Instructions

Run the following checks and report results:

1. **Current branch**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py current
   ```

2. **Worktree status**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py current
   ```

3. **Git status** (uncommitted changes):
   ```bash
   git status --short
   ```

4. **Unpushed commits** (if on feature branch):
   ```bash
   git log --oneline develop..HEAD 2>/dev/null || git log --oneline main..HEAD
   ```

5. **Registry info** (if session ID available):
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py get "$CLAUDE_SESSION_ID" 2>/dev/null
   ```

## Report Format

Summarize:
- Current branch name
- Whether in worktree (isolated) or main repo
- Number of uncommitted changes
- Number of unpushed commits
- PR status (if any)
