---
description: Start a performance profiling session
argument-hint: "[profile-name]"
---

# Start Performance Profiling

You are starting a performance profiling session.

## Arguments

The user invoked: `/perf:start $ARGUMENTS`

If a profile name was provided, use it. Otherwise, generate one based on the current date/time.

## Instructions

1. **Create session directory** if it doesn't exist:
   ```bash
   mkdir -p .claude/perf/sessions
   ```

2. **Record session start** by creating a session file:
   ```bash
   # Generate session metadata
   echo '{"profile_name": "NAME", "start_time": "ISO_TIMESTAMP", "session_id": "$SESSION_ID", "cwd": "CWD", "status": "active"}' > .claude/perf/sessions/PROFILE_NAME.json
   ```

3. **Confirm to user**:
   - Profile name
   - Start time
   - Session ID (first 8 chars)
   - What will be captured (hook timing from logging, cache analysis)

4. **Remind user** to run `/perf:stop` when done to generate the report.

## Example Output

```
Performance profiling started.

Profile: my-session
Session: abc12345
Started: 2025-12-19T15:30:00

Capturing:
- Hook execution timing (from logging plugin)
- Plugin cache health
- Startup breakdown

Run /perf:stop when finished to generate report.
```

## Notes

- This plugin uses ZERO runtime hooks - it analyzes existing logging data
- No performance overhead during the profiling session
- The logging plugin must be active for hook timing data
