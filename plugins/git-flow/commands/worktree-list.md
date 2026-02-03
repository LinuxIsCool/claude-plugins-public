---
name: worktree-list
description: List all git worktrees and their status
---

# List Worktrees

Show all git worktrees with their status from both git and the registry.

## Instructions

1. **Git worktrees**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py list --format table
   ```

2. **Registry entries**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list --format table
   ```

3. **Cross-reference**:
   - Identify worktrees with active sessions
   - Identify stale worktrees (no recent activity)
   - Identify orphaned worktrees (not in registry)

## Report Format

Show a consolidated view:
- Worktree path
- Branch name
- Status (active, stale, merged, archived)
- Last activity timestamp
- Associated session ID (if known)
