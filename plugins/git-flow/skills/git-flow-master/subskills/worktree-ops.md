# Worktree Operations Sub-Skill

Detailed guidance for git worktree management.

## What Are Worktrees?

Git worktrees allow multiple working directories sharing the same `.git` folder. Each worktree:
- Has its own working directory
- Can be on a different branch
- Shares history with main repo
- Is isolated from other worktrees

## Why Use Worktrees?

1. **Parallel Development**: Multiple agents work simultaneously without conflicts
2. **Clean Isolation**: Changes don't accidentally affect main repo
3. **Easy Cleanup**: Delete worktree without affecting shared history
4. **Branch Binding**: Each worktree locked to one branch

## Location Convention

Worktrees are stored in: `.git/worktrees/{sanitized-branch-name}/`

Example:
- Branch: `feature/claude-a3e7b2c1-dark-mode`
- Worktree: `.git/worktrees/feature-claude-a3e7b2c1-dark-mode/`

## Operations

### Create Worktree

```bash
# Using our tool (recommended)
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py create feature/name --base develop

# Using git directly
git worktree add .git/worktrees/feature-name feature/name
```

The tool handles:
1. Creating the branch from base
2. Creating the worktree directory
3. Registering in worktree registry
4. Rollback on failure

### List Worktrees

```bash
# Our tool (formatted)
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py list

# Git native
git worktree list
git worktree list --porcelain  # Machine-readable
```

### Check If In Worktree

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py is-worktree

# Returns "true" or "false"
```

### Get Current Worktree Info

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py current

# Returns JSON with branch_name, worktree_path, etc.
```

### Cleanup Worktree

```bash
# With metadata archival
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py cleanup feature/name

# Force (if uncommitted changes)
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py cleanup feature/name --force

# Skip archival
python3 ${CLAUDE_PLUGIN_ROOT}/tools/worktree.py cleanup feature/name --no-archive
```

## Safety Considerations

1. **Never force-remove** without confirming with user
2. **Always archive metadata** before cleanup
3. **Check for uncommitted changes** before switching
4. **Prune stale references**: `git worktree prune`

## Common Issues

### "fatal: worktree already exists"

The worktree path is already in use. Either:
- Use existing worktree
- Choose different branch name
- Clean up stale worktree first

### "fatal: branch already checked out"

A branch can only be checked out in one worktree at a time. Either:
- Switch to existing worktree
- Create new branch with different name

### Stale Worktree References

If worktree directory was deleted manually:
```bash
git worktree prune
```
