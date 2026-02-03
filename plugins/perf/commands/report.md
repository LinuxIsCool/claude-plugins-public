---
description: View performance profile report
argument-hint: "[profile-name]"
---

# View Performance Report

You are viewing a performance profile report.

## Arguments

The user invoked: `/perf:report $ARGUMENTS`

If a profile name is provided, show that specific report.
If no argument, show the most recent report.

## Instructions

1. **Find reports directory**:
   ```bash
   ls -lt .claude/perf/reports/*.md 2>/dev/null | head -10
   ```

2. **If profile name provided**: Look for matching report
   ```bash
   ls .claude/perf/reports/ | grep "PROFILE_NAME"
   ```

3. **Read and display the report**:
   - Read the full markdown report
   - Present it to the user in a clear format
   - Highlight key findings and recommendations

4. **If no reports found**:
   - Inform user no reports exist yet
   - Suggest running `/perf:start` to begin a profiling session

## Example

```
# Performance Profile: my-session

Session: abc12345
Duration: 2025-12-19T15:30:00 to 2025-12-19T15:45:23

## Summary
- Hook Executions: 47 events (1,234ms cumulative)
- Cache Size: 243 MB (11,518 files)
- Stale Plugins: 2

## Recommendations
1. [HIGH] Clear stale plugin caches
   Run: /dev-tools:reload all
```
