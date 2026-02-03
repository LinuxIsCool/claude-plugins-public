---
name: pr-create
description: Create a pull request for the current feature branch
arguments:
  - name: title
    description: Optional PR title (auto-generated if not provided)
    required: false
---

# Create Pull Request

Create a GitHub pull request for the current feature branch.

## Prerequisites

- Must be on a feature branch (not main/develop)
- GitHub CLI (`gh`) must be authenticated
- Branch should have commits to merge

## Context

{{#if title}}
User provided PR title: {{title}}
{{else}}
Generate title from recent commits or branch name.
{{/if}}

## Instructions

1. **Check prerequisites**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py status
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/branch.py current
   ```

2. **Check for existing PR**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py view
   ```

3. **Gather commit info**:
   ```bash
   git log --oneline develop..HEAD
   git diff --stat develop..HEAD
   ```

4. **Create PR**:
   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py create \
     --title "{{#if title}}{{title}}{{else}}AUTO_TITLE{{/if}}" \
     --base develop
   ```

5. **Report result**:
   - Show PR URL
   - Show PR number
   - Mention next steps (review, CI checks)

## PR Body Template

The PR body will include:
- Summary of changes (from commits)
- Files changed
- Test plan checklist
