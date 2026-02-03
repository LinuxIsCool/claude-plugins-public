---
description: View profiling history and performance trends
argument-hint: ""
---

# Performance History

You are viewing the history of profiling sessions and identifying performance trends.

## Instructions

1. **List all sessions**:
   ```bash
   ls -lt .claude/perf/sessions/*.json 2>/dev/null
   ```

2. **Read session metadata** for each session:
   - Profile name
   - Start/end times
   - Status (active/completed)

3. **Read history file** if it exists:
   ```bash
   cat .claude/perf/history.jsonl 2>/dev/null | tail -20
   ```

4. **Analyze trends**:
   - Compare key metrics across sessions
   - Identify regressions (metrics getting worse)
   - Note improvements

5. **Present findings** in a clear table format:
   ```
   | Profile | Date | Duration | Hook Events | Cache Size | Stale |
   |---------|------|----------|-------------|------------|-------|
   | baseline | Dec 18 | 12m | 32 | 180 MB | 0 |
   | my-session | Dec 19 | 15m | 47 | 243 MB | 2 |
   ```

6. **Highlight changes**:
   - Cache grew 63 MB (+35%)
   - 2 plugins became stale
   - Hook events increased (more activity)

## Example Output

```
Performance History

Sessions: 3 completed, 0 active

| Profile | Date | Events | Cache | Stale |
|---------|------|--------|-------|-------|
| baseline | Dec 18 | 32 | 180 MB | 0 |
| feature-x | Dec 18 | 45 | 210 MB | 1 |
| my-session | Dec 19 | 47 | 243 MB | 2 |

Trends:
- Cache size increasing (+63 MB over 2 days)
- Stale plugin count increasing
- Recommendation: Run /dev-tools:reload all
```

## No History

If no sessions exist:
```
No profiling sessions found.

Run /perf:start to begin your first profiling session.
```
