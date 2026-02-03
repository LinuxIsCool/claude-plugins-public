---
name: worktree-cleanup
description: Clean up stale or merged worktrees
arguments:
  - name: branch
    description: Specific branch to clean up (optional, defaults to stale worktrees)
    required: false
---

# Worktree Cleanup

Clean up worktrees that are no longer needed.

## Context

{{#if branch}}
User requested cleanup of branch: {{branch}}
{{else}}
Clean up stale worktrees (inactive for 7+ days) or merged branches.
{{/if}}

## Safety Checks

Before cleaning up any worktree:
1. Check if branch has unpushed commits
2. Check if branch has uncommitted changes
3. Check if PR was merged
4. Archive metadata to `.claude/git-flow/archive/`

## Instructions

1. **List candidates**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list --status stale
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list --status merged
   ```

2. **For each candidate**:
   - Verify it's safe to remove
   - Archive metadata
   - Remove worktree
   - Delete branch (if merged or confirmed)

3. **Cleanup specific branch** (if provided):
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py cleanup "{{branch}}" --archive
   ```

4. **Prune git worktree references**:
   ```bash
   git worktree prune
   ```

## Confirmation Required

Always confirm with user before:
- Deleting unmerged branches
- Removing worktrees with uncommitted changes
- Force-removing worktrees
