# Registry Operations Sub-Skill

Detailed guidance for worktree registry management.

## What Is The Registry?

The worktree registry maps Claude sessions to worktrees:
- **Location**: `.claude/git-flow/worktree-registry.json`
- **Purpose**: Track worktree lifecycles, enable cleanup
- **Persistence**: JSON file with file locking for concurrency

## Registry Schema

```json
{
  "session-id-here": {
    "worktree_path": ".git/worktrees/feature-name/",
    "branch_name": "feature/claude-a3e7b2c1-title",
    "base_branch": "develop",
    "status": "active",
    "created": "2025-12-17T15:30:00",
    "created_by": "claude",
    "last_seen": "2025-12-17T16:45:00",
    "pr_url": "https://github.com/org/repo/pull/123",
    "merged_at": null,
    "commits_count": 5,
    "files_changed": ["src/file1.py", "src/file2.py"]
  }
}
```

## Status Values

| Status | Meaning |
|--------|---------|
| `active` | Worktree in use |
| `stale` | No activity for 7+ days |
| `merged` | PR was merged |
| `archived` | Metadata archived, worktree removed |

## Operations

### Register New Worktree

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py register \
  SESSION_ID \
  "feature/claude-id-title" \
  ".git/worktrees/feature-claude-id-title/" \
  --base develop \
  --created-by claude
```

### Get Worktree Info

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py get SESSION_ID
```

### List All Worktrees

```bash
# All
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list

# By status
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list --status active
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list --status stale

# As JSON
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py list --format json
```

### Update Worktree

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py update SESSION_ID \
  --status active \
  --pr-url "https://github.com/org/repo/pull/123"
```

### Archive Worktree Metadata

Before deleting, archive metadata to `.claude/git-flow/archive/`:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py archive SESSION_ID
```

Creates: `.claude/git-flow/archive/feature-claude-id-title.json`

### Mark Stale Worktrees

Identify worktrees inactive for N days:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/registry.py cleanup --days 7
```

## File Locking

The registry uses `fcntl.flock()` for concurrent access:
- **Shared lock (LOCK_SH)**: For reads
- **Exclusive lock (LOCK_EX)**: For writes

This prevents corruption when multiple agents access simultaneously.

## Archive Format

Archived metadata includes additional fields:

```json
{
  "session_id": "original-session-id",
  "archived_at": "2025-12-17T17:00:00",
  "worktree_path": "...",
  "branch_name": "...",
  // ... all original fields
}
```

## Cross-Referencing

### Find By Branch

```python
# In Python:
from registry import find_by_branch
entry = find_by_branch("feature/claude-id-title")
```

No CLI equivalent yet - use `list` with grep:
```bash
python3 tools/registry.py list --format json | jq '.[] | select(.branch_name == "feature/name")'
```

### Session ↔ Branch Mapping

The registry enables:
- Finding which session created a branch
- Finding which branch a session uses
- Tracking session activity across restarts

## Staleness Detection

Sessions are marked stale when:
- `last_seen` timestamp > N days old
- Status is still `active`

The `cleanup` command:
1. Scans all active entries
2. Compares `last_seen` to current time
3. Marks old entries as `stale`
4. Does NOT delete anything (just marks)

## Integration With Worktree Operations

When using worktree tools:

1. **Create**: Automatically registers in registry
2. **Update**: `last_seen` updated on SessionStart
3. **PR Create**: `pr_url` stored in registry
4. **Merge**: Status changed to `merged`
5. **Cleanup**: Archives then marks `archived`
