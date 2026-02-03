---
name: commit
description: Manually trigger a commit of all pending changes with confirmation
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion
argument-hint: "[--force] [--message <msg>]"
---

# Autocommit: Manual Commit

Manually trigger the autocommit process for all pending changes. Use this when:
- Your message was classified as SKIP but you want to commit anyway
- You want to force a checkpoint commit
- The automatic hook didn't trigger for some reason

## Arguments

The user invoked: `/autocommit:commit $ARGUMENTS`

- `--force`: Skip confirmation, commit immediately
- `--message <msg>`: Use provided message instead of generating one

---

## Workflow

### Phase 1: Check for Changes

```bash
# Get uncommitted changes
git status --porcelain
```

**If no changes**: Report "Working tree is clean. Nothing to commit." and exit.

**If merge/rebase in progress**: Report "Cannot commit during merge/rebase. Please complete or abort first." and exit.

---

### Phase 2: Safety Analysis

Classify each changed file:

**Sensitive (NEVER commit - auto-exclude)**:
- `.env*` files (except `.env.example`, `.env.sample`, `.env.template`)
- Files matching: `secret`, `credential`, `password`, `token`, `api[_-]?key`
- `*.pem`, `*.key` files

**Safe to commit**:
- Everything else

If sensitive files are detected, warn the user and exclude them from the commit.

---

### Phase 3: Determine Scope

Detect the primary scope from changed files:

| Path Pattern | Scope |
|-------------|-------|
| `plugins/{name}/` | `plugin:{name}` |
| `.claude/journal/` | `journal` |
| `.claude/agents/` | `agent` |
| `.claude/registry/` | `registry` |
| `.claude/planning/` | `planning` |
| `.claude/conventions/` | `system` |
| `.claude/social/` | `agentnet` |
| `backlog/` | `backlog` |
| Root `.md` files | `docs` |
| Mixed/unclear | Use most common scope or `misc` |

---

### Phase 4: Generate Commit Message

Generate a commit message following the autocommit convention:

```
[scope] action: one-line summary

Brief description of what changed and why.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Actions**: `create`, `update`, `fix`, `refactor`, `add`, `remove`, `improve`

Choose action based on git status:
- All new files → `create`
- All modified → `update`
- All deleted → `remove`
- Mix → `update` (most common)

---

### Phase 5: Confirmation

Unless `--force` was specified, present the commit plan and ask for confirmation using AskUserQuestion:

**Show**:
1. Files to be committed (with status: M/A/D)
2. Files excluded (if any sensitive files found)
3. Proposed commit message

**Ask**: "Proceed with this commit?"
- Options: "Yes, commit", "Edit message first", "Cancel"

If user selects "Edit message first", ask for the new message.

---

### Phase 6: Execute Commit

```bash
# Stage safe files only (list them explicitly)
git add <safe-file-1> <safe-file-2> ...

# Commit with message (use HEREDOC for proper formatting)
git commit -m "$(cat <<'EOF'
[scope] action: summary

Description

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Show result
git log -1 --oneline
```

---

### Phase 7: Report Result

After successful commit, report:
- Commit hash (short)
- Files committed
- Commit message summary

If commit failed, report the error and suggest next steps.

---

## Example Usage

**Basic commit**:
```
/autocommit:commit
```

Shows changes, generates message, asks for confirmation.

**Force commit without confirmation**:
```
/autocommit:commit --force
```

Commits immediately with auto-generated message.

**Custom message**:
```
/autocommit:commit --message "checkpoint before refactor"
```

Uses provided message (still confirms unless --force).

---

## Example Output

```
## Commit Preview

### Files to Commit (4)

| Status | Path |
|--------|------|
| M | plugins/autocommit/hooks/autocommit.py |
| A | plugins/autocommit/commands/commit.md |
| M | .claude/journal/2025/12/18/2025-12-18.md |
| M | .claude/journal/2025/12/18/07-54-entry.md |

### Excluded (Sensitive)
None

### Proposed Message
```
[plugin:autocommit,journal] update: add manual commit command and journal entries

Added /autocommit:commit command for manual trigger. Updated journal entries.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Proceed with this commit?**
```
