---
name: git-flow
description: Master skill for git worktree-based multi-agent workflow (4 sub-skills). Covers worktree management, branch naming, PR automation, and registry operations. Invoke for feature branch creation, worktree isolation, pull request workflows, or understanding git-flow patterns.
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Git-Flow - Master Skill

Git worktree-based workflow for per-session feature branches and PR automation.

## Philosophy

Each Claude session operates in an isolated git worktree. This provides:
- **Isolation**: Changes don't affect main repo until merged
- **Parallelism**: Multiple agents can work simultaneously
- **Traceability**: Branches tied to session IDs
- **Quality Gates**: PR-based review before merge

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **worktree-ops** | Creating, listing, cleaning up worktrees | `subskills/worktree-ops.md` |
| **branch-naming** | Understanding branch naming conventions | `subskills/branch-naming.md` |
| **pr-workflow** | Creating and managing pull requests | `subskills/pr-workflow.md` |
| **registry-ops** | Working with the worktree registry | `subskills/registry-ops.md` |

## Quick Reference

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/git-flow:feature <description>` | **Primary**: Create branch + worktree + start feature-dev workflow |
| `/git-flow:branch-create [title]` | Create feature branch + worktree only |
| `/git-flow:branch-status` | Check current branch/worktree status |
| `/git-flow:pr-create [title]` | Create pull request |
| `/git-flow:worktree-list` | List all worktrees |
| `/git-flow:worktree-cleanup [branch]` | Clean up stale worktrees |

**Recommended workflow**: Use `/git-flow:feature` for substantial work - it creates isolation AND guides through systematic feature development.

### Task Agent

Use via Task tool:
```
subagent_type: "git-flow:branch-manager"
```

For worktree creation, branch management, and PR preparation.

### CLI Tools

Located in `${CLAUDE_PLUGIN_ROOT}/tools/`:

```bash
# Worktree operations
python3 tools/worktree.py create|list|cleanup|current|is-worktree

# Branch naming
python3 tools/branch.py generate|validate|parse|current|exists

# Registry
python3 tools/registry.py register|get|list|update|archive|cleanup

# PR operations
python3 tools/pr.py create|view|list|merge|close|checks|status
```

## Workflow Overview

```
SessionStart
    │
    ▼
┌─────────────────┐
│ Detect Worktree │──── In worktree? ──► Continue working
└────────┬────────┘
         │ Not in worktree
         ▼
┌─────────────────┐
│ Agent creates   │──── Using /branch-create or branch-manager agent
│ feature branch  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PreToolUse Hook │──── Blocks Write/Edit on main/develop
│ (safety net)    │     if not in worktree or feature branch
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Work in        │
│ worktree       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Stop Hook      │──── Suggests PR if work was done
│ (PR suggestion)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create PR      │──── Using /pr-create or gh CLI
│ (manual)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review + Merge │──── Human or automated review
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cleanup        │──── Archive metadata, delete branch
│ worktree       │
└─────────────────┘
```

## Independence

**This plugin works standalone.** Git is the only hard requirement.

| Dependency | Required? | Fallback |
|------------|-----------|----------|
| Git | Yes | Core functionality |
| `gh` CLI | For PR features only | Clear error if missing |
| Python 3 | Yes | Tools won't run |

## Complementary Plugins (Optional)

These plugins enhance git-flow but are **NOT required**:

| Plugin | Enhancement | Without It |
|--------|-------------|------------|
| **Statusline** | Provides agent names for branch naming | Defaults to "claude" |
| **Autocommit** | Handles commit decisions | You commit manually |
| **Logging** | Operations become searchable | Less observability |
| **Journal** | Link sessions to entries | No narrative linking |

The plugins are like UNIX tools - each does one thing well, can be combined, but don't depend on each other.

## Reading Sub-Skills

To access detailed guidance, read the appropriate sub-skill:

```
Read: ${CLAUDE_PLUGIN_ROOT}/skills/git-flow-master/subskills/worktree-ops.md
Read: ${CLAUDE_PLUGIN_ROOT}/skills/git-flow-master/subskills/branch-naming.md
Read: ${CLAUDE_PLUGIN_ROOT}/skills/git-flow-master/subskills/pr-workflow.md
Read: ${CLAUDE_PLUGIN_ROOT}/skills/git-flow-master/subskills/registry-ops.md
```
