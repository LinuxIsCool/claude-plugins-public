# PR Workflow Sub-Skill

Detailed guidance for pull request management.

## Prerequisites

1. **GitHub CLI**: Must be installed and authenticated
   ```bash
   gh auth status  # Check status
   gh auth login   # If not authenticated
   ```

2. **On Feature Branch**: PRs target feature branches → develop
3. **Commits Ready**: Work should be committed before PR

## Creating Pull Requests

### Basic PR Creation

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py create \
  --title "Feature: Dark Mode Toggle" \
  --base develop
```

### With Full Options

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py create \
  --title "Feature: Dark Mode Toggle" \
  --body "Adds theme switching to settings panel" \
  --base develop \
  --draft \
  --label "enhancement" \
  --assignee "username"
```

### Using gh Directly

```bash
gh pr create \
  --title "Feature: Dark Mode Toggle" \
  --body "..." \
  --base develop
```

## PR Body Template

Generated automatically includes:

```markdown
## Summary
- Feature additions
- Bug fixes
- Other changes

## Files Changed
Total: N files
- `directory/`: file1, file2, +N more

## Test Plan
- [ ] Tests pass locally
- [ ] Manual testing completed
- [ ] Documentation updated (if needed)
```

## Viewing PR Status

```bash
# Current branch's PR
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py view

# Specific branch
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py view --branch feature/name
```

Returns:
- PR number, title, URL
- State (open, closed, merged)
- Draft status
- Mergeable status
- Review decision

## Listing PRs

```bash
# Open PRs
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py list

# With filters
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py list \
  --state open \
  --base develop \
  --author username \
  --limit 10
```

## CI/CD Checks

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py checks

# Output includes:
# - Individual check names and states
# - Summary: total, passed, failed, pending
# - all_passed flag
```

## Adding Reviewers

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py add-reviewers user1 user2
```

## Merging PRs

```bash
# Squash merge (default)
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py merge

# With options
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py merge \
  --method squash \     # merge, squash, or rebase
  --no-delete \         # Keep branch after merge
  --admin               # Admin merge (bypass protections)
```

## Closing Without Merging

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/pr.py close --comment "Superseded by #123"
```

## PR Flow Diagram

```
feature/branch
     │
     ▼
┌─────────────┐
│ Create PR   │ gh pr create --base develop
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ CI Checks   │ Automated tests run
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Code Review │ Human or agent review
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Address     │ Push fixes, respond to comments
│ Feedback    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Merge       │ gh pr merge --squash
└──────┬──────┘
       │
       ▼
develop
```

## develop → main Promotion

This is a **manual human trigger** (not automated).

When develop has accumulated features ready for release:

```bash
git checkout main
git merge develop
git push origin main
```

Or via PR:
```bash
gh pr create --base main --head develop --title "Release v1.x.x"
```

## Registry Integration

The PR tool automatically:
- Updates registry with PR URL when created
- Marks worktree as merged when PR merges
- Stores commit count and changed files
