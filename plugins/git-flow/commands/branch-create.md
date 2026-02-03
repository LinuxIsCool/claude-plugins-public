---
name: branch-create
description: Create a new feature branch with worktree for isolated development
arguments:
  - name: title
    description: Optional branch title (auto-generated if not provided)
    required: false
---

# Create Feature Branch

Create a new feature branch with an isolated git worktree.

## Context

{{#if title}}
User requested branch title: {{title}}
{{else}}
No explicit title provided - generate one from recent conversation context.
{{/if}}

## Instructions

1. **Check current state**:
   - Run `git status` to check for uncommitted changes
   - Run `python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py is-worktree` to check if already in worktree

2. **Generate branch name**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py generate {{#if title}}--title "{{title}}"{{else}}--context "RECENT_CONVERSATION_CONTEXT"{{/if}}
   ```

3. **Create worktree**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py create BRANCH_NAME --base develop --session-id "$CLAUDE_SESSION_ID"
   ```

4. **Report result**:
   - Show the new branch name
   - Show the worktree path
   - Remind user that they're now in an isolated workspace

## Important Notes

- Worktrees are stored in `.git/worktrees/`
- Changes in worktree don't affect main repository until merged
- Use `/git-flow:pr-create` when ready to submit for review
