---
name: organize
description: Analyze uncommitted changes and organize them into semantic commits
allowed-tools: Bash, Read, Glob, Grep
argument-hint: "[--dry-run] [--scope <scope>]"
---

# Autocommit Organize

Analyze uncommitted changes and organize them into structured, semantic commits following the [scope] action: description format.

## Arguments

The user invoked: `/autocommit:organize $ARGUMENTS`

- `--dry-run`: Show commit plan without executing
- `--scope <scope>`: Only organize files matching this scope (e.g., `journal`, `plugin:autocommit`)

## Workflow Overview

1. **Discovery**: Get all uncommitted changes
2. **Analysis**: Classify files by namespace and safety
3. **Grouping**: Group files into semantic units
4. **Planning**: Generate commit plan with rich messages
5. **Approval**: Present plan and get user approval
6. **Execution**: Create commits (unless dry-run)
7. **Summary**: Report results

---

## Phase 1: Discovery

Run these commands to gather uncommitted changes:

```bash
# Get porcelain status (machine-readable)
git status --porcelain

# Get status summary
git status --short

# Check for merge/rebase in progress
git status | head -5
```

**If no uncommitted changes**: Report "Working tree is clean. No changes to organize." and exit.

**If merge/rebase in progress**: Report "Cannot organize during merge/rebase. Please complete or abort first." and exit.

---

## Phase 2: Analysis

For each changed file, determine:

### 2a. Namespace Classification

| Path Pattern | Scope |
|-------------|-------|
| `plugins/{name}/` | `plugin:{name}` |
| `.claude/journal/` | `journal` |
| `.claude/agents/` | `agent` |
| `.claude/registry/` | `registry` |
| `.claude/planning/` | `planning` |
| `.claude/conventions/` | `system` |
| `.claude/tools/` | `system` |
| `backlog/` | `backlog` |
| Root-level `.md` files | `docs` |
| Root-level config files | `config` |
| Other `.claude/` files | `system` |
| Everything else | Infer from directory structure |

### 2b. Safety Classification

**Sensitive (NEVER commit)**:
- `.env*` files
- Files matching: `secret`, `credential`, `password`, `token`, `api[_-]?key`
- `*.pem`, `*.key` files

**Large (WARN if >5MB)**:
- Binary files
- Log files
- Data dumps

**Gitignore suggestions**:
- `node_modules/` - npm dependencies
- `__pycache__/`, `*.pyc` - Python bytecode
- `.venv/`, `venv/` - Virtual environments
- `.DS_Store` - macOS metadata
- `.idea/`, `.vscode/` - IDE settings
- `dist/`, `build/` - Build artifacts

### 2c. Gather Metadata

For each file:
```bash
# Get modification time
stat -c %Y {filepath} 2>/dev/null || stat -f %m {filepath} 2>/dev/null

# Get file size
stat -c %s {filepath} 2>/dev/null || stat -f %z {filepath} 2>/dev/null
```

---

## Phase 3: Grouping

Group files into semantic units using these signals (in priority order):

### Signal 1: Same Namespace (Priority: HIGH)
Files in the same namespace should generally be grouped together:
- All files in `plugins/statusline/` → one `[statusline]` commit
- All files in `.claude/journal/2025/12/17/` → one `[journal]` commit

### Signal 2: Same Action Type (Priority: MEDIUM)
Detect action type from git status codes:
- `A` (added) → `create` or `add`
- `M` (modified) → `update` or `fix` or `refactor`
- `D` (deleted) → `remove`
- `R` (renamed) → `refactor`
- `??` (untracked) → `create`

### Signal 3: Temporal Proximity (Priority: MEDIUM)
Files modified within ~10 minutes of each other likely belong together.

### Signal 4: Logical Coupling (Priority: LOW)
Files that reference each other (imports, wikilinks) should be grouped.

### Grouping Rules

**DO group**:
- Files in same plugin directory
- Related tests and implementations
- Documentation and its subject
- Files with same scope AND action

**DON'T group**:
- Different plugins together
- Mixed actions (fix + feature) unless clearly related
- Sensitive files (filter these out)
- Unrelated namespaces

### Anti-patterns to Avoid

- **Giant commits**: If a group has >15 files, consider splitting
- **Orphan files**: Single-file commits are OK for atomic changes
- **Cross-cutting concerns**: If files touch many namespaces, split by namespace

---

## Phase 4: Planning

For each group, generate a commit entry:

### Determine Scope
Use the namespace classification from Phase 2.

### Determine Action
Based on git status codes and diff content:
- All new files → `create`
- Bug fixes (keywords: fix, bug, error, issue) → `fix`
- New features (keywords: add, implement, new) → `feature` or `add`
- Refactoring → `refactor`
- Updates → `update`
- Documentation only → `docs`

### Generate Description
- Be specific: "add organize command" not "update files"
- Keep under 50 characters for the first line
- Focus on WHAT changed, not HOW

### Generate Rich Message Body

For significant commits, include:

```
## Context
[2-4 sentences: What problem was being solved?]

## Insights
- [Key learnings or discoveries]
- [Non-obvious gotchas]

## Changes
[Technical summary of modifications]

## Third Mind Notes
[Observations about the work: why this approach, what was considered]

---
Session: {session-id from environment or registry}
Agent: {agent name from statusline registry, or "Claude"}
```

---

## Phase 5: Present Plan

Display the commit plan in this format:

```
## Commit Plan

Found N uncommitted files across M namespaces.

### Proposed Commits (X commits)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [scope] action: description
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files (N):
  M path/to/file1.ts
  A path/to/file2.ts
  ...

Reasoning: [Why these files are grouped]

Message preview:
```
[scope] action: description

## Context
...
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. [scope] action: description
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...

---

### Warnings

[List any sensitive files filtered, large files, gitignore suggestions]

---

**Total**: X commits, N files

**Options**:
- Type "yes" or "y" to execute all commits
- Type "no" or "n" to cancel
- Type numbers like "1,3" to execute only those commits
- Type "skip 2" to execute all except commit 2
- Type "edit" to modify the plan
```

---

## Phase 6: Execution

If user approves (and not `--dry-run`):

For each approved commit:

1. **Stage files**:
   ```bash
   git add {file1} {file2} ...
   ```

2. **Create commit** with HEREDOC for proper formatting:
   ```bash
   git commit -m "$(cat <<'EOF'
   [scope] action: description

   ## Context
   ...

   ---
   Session: {session-id}
   Agent: {agent-name}

   Co-Authored-By: {agent-name} <agent@claude-ecosystem>
   EOF
   )"
   ```

3. **Capture commit hash**:
   ```bash
   git rev-parse --short HEAD
   ```

4. **Log to autocommit.log**:
   ```bash
   echo "[$(date -Iseconds)] ORGANIZE - {hash} - {first-line-of-message}" >> .claude/autocommit.log
   ```

---

## Phase 7: Summary

After execution, report:

```
## Results

Created N commits:

  {hash1} [scope1] action1: description1
  {hash2} [scope2] action2: description2
  ...

Working tree status: [clean | M files remaining]

### Next Steps
- Review with: git log -N
- Push with: git push
```

If any commits failed, report the errors and which files remain uncommitted.

---

## Handling Arguments

### --dry-run

Skip Phase 6 (execution). Show the plan and exit.

```
## Dry Run Complete

The plan above shows what WOULD be committed.
Run `/autocommit:organize` without --dry-run to execute.
```

### --scope <scope>

In Phase 2, filter to only files matching the specified scope.

Example: `/autocommit:organize --scope journal`
- Only analyzes `.claude/journal/` files
- Other namespaces are ignored (not filtered out, just not analyzed)

---

## Ecosystem Integration (Best-Effort)

### Statusline Integration

Check for agent name:
```bash
# Try to read from registry
cat .claude/instances/registry.json 2>/dev/null | grep -A5 "\"$CLAUDE_SESSION_ID\"" | grep '"name"'
```

If not available, use `CLAUDE_SESSION_ID` prefix or "Claude".

### Session ID

Available in environment as `CLAUDE_SESSION_ID` or from hook context.

### Logging Integration

If `.claude/logging/` exists, recent context is available. Not strictly required.

---

## Error Handling

| Scenario | Action |
|----------|--------|
| No uncommitted changes | Exit gracefully |
| Merge in progress | Abort with message |
| All files sensitive | Warn, nothing to commit |
| Commit fails | Log error, continue with others |
| User cancels | Exit without committing |
| Invalid scope filter | Show available scopes |

---

## Example Session

```
User: /autocommit:organize

Claude: Let me analyze your uncommitted changes...

[Runs git status, analyzes files]

## Commit Plan

Found 12 uncommitted files across 3 namespaces.

### Proposed Commits (3 commits)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [journal] add: Dec 17 entries
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files (4):
  M .claude/journal/2025/12/17/2025-12-17.md
  A .claude/journal/2025/12/17/10-30-planning.md
  A .claude/journal/2025/12/17/14-15-notes.md
  M .claude/journal/2025/12/17/README.md

Reasoning: Journal namespace, same day entries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. [plugin:autocommit] create: organize command
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files (2):
  A plugins/autocommit/commands/organize.md
  M plugins/autocommit/README.md

Reasoning: New feature in autocommit plugin

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. [plugin:agentnet] update: TUI improvements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Files (6):
  M plugins/agentnet/src/ui/main-menu.ts
  M plugins/agentnet/src/ui/feed-view.ts
  M plugins/agentnet/src/ui/wall-view.ts
  M plugins/agentnet/src/ui/agent-list.ts
  M plugins/agentnet/src/ui/message-view.ts
  M plugins/agentnet/skills/agentnet-master/SKILL.md

Reasoning: Related UI modifications in agentnet plugin

---

**Total**: 3 commits, 12 files

Approve? (yes/no/edit/1,2,3):

User: yes

Claude: Executing commit plan...

  a3edb0d [journal] add: Dec 17 entries
  b4c2e1f [plugin:autocommit] create: organize command
  c5d3f2a [plugin:agentnet] update: TUI improvements

## Results

Created 3 commits. Working tree is clean.

Next steps:
- Review with: git log -3
- Push with: git push
```

---

## Notes

- This command runs in interactive Claude, not headless
- User approval is always required before commits (unless --dry-run)
- Safety patterns match those in autocommit.py hook
- Follows coordination conventions from `.claude/conventions/coordination.md`
- Rich commit messages follow the "third mind" format from autocommit-conventions skill
