---
name: status
description: Show autocommit status, pending changes, and recent decisions
allowed-tools: Bash, Read, Glob
argument-hint: "[--log] [--config]"
---

# Autocommit Status

Show the current autocommit status including:
1. Whether autocommit is enabled
2. Current uncommitted changes (with safety analysis)
3. Recent autocommit decisions from the log

## Instructions

### Basic Status

Run these commands to gather status information:

1. **Check for uncommitted changes:**
   ```bash
   git status --short
   ```

2. **Read recent autocommit log entries:**
   ```bash
   tail -20 .claude/autocommit.log 2>/dev/null || echo "No autocommit log found"
   ```

3. **Check configuration:**
   ```bash
   cat .claude/autocommit.conf 2>/dev/null || echo "No custom config (using defaults)"
   ```

### Analyze and Report

After gathering the data, provide a summary:

1. **Pending Changes**: List uncommitted files with safety classification:
   - SAFE: `.claude/**`, `*.md`, `docs/**`, `tests/**`
   - CAUTION: `src/**`, `lib/**`, `plugins/**`
   - SENSITIVE: `.env*`, `*secret*`, `*credential*`

2. **Recent Activity**: Show last 5 autocommit decisions from the log

3. **Configuration Status**: Report enabled/disabled and backend setting

### With Arguments

If `--log` is specified, show more log entries (last 50).

If `--config` is specified, show full configuration including defaults.

## Example Output

```
## Autocommit Status

**Enabled**: Yes
**Backend**: headless (Max subscription)

### Pending Changes (3 files)

| Status | Path | Classification |
|--------|------|----------------|
| M | plugins/autocommit/hooks/autocommit.py | CAUTION |
| A | .claude/journal/2025/12/17/entry.md | SAFE |
| M | src/utils.ts | CAUTION |

### Recent Decisions

- [09:45:00] COMMIT a3edb0d - [agent:Phoenix] update: improve hooks
- [09:30:15] SKIP - User requested changes
- [09:15:00] COMMIT b2c1d0e - [agent:Explorer] create: new feature

### Next Action

User's next message will trigger commit analysis if it signals approval.
```
