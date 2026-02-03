---
description: Stop performance profiling and generate report
argument-hint: ""
---

# Stop Performance Profiling

You are stopping the active profiling session and generating a performance report.

## Instructions

1. **Find active session**:
   ```bash
   # Look for active session file
   ls -la .claude/perf/sessions/*.json 2>/dev/null
   ```
   Read the session file to get profile_name, start_time, session_id.

2. **Run hook analyzer** to extract timing data:
   ```bash
   uv run plugins/perf/tools/hook_analyzer.py --cwd . --format json > /tmp/hook_analysis.json
   ```

3. **Run cache analyzer** to check cache health:
   ```bash
   uv run plugins/perf/tools/cache_analyzer.py --cwd . --check-staleness --format json > /tmp/cache_analysis.json
   ```

4. **Generate performance report**:
   ```bash
   uv run plugins/perf/tools/report_generator.py \
     --hook-data /tmp/hook_analysis.json \
     --cache-data /tmp/cache_analysis.json \
     --session-id "SESSION_ID" \
     --profile-name "PROFILE_NAME" \
     --start-time "START_TIME" \
     --end-time "$(date -Iseconds)" \
     --cwd "$(pwd)" \
     --output-dir .claude/perf/reports
   ```

5. **Update session file** to mark as completed:
   ```bash
   # Update status to "completed" and add end_time
   ```

6. **Append to history** for regression tracking:
   ```bash
   # Append summary metrics to .claude/perf/history.jsonl
   ```

7. **Display report** to user with key findings and recommendations.

## Example Output

```
Performance Profile Complete: my-session

Duration: 15m 23s
Hook Events: 47 (1,234ms cumulative)
Cache: 243 MB (2 stale plugins)

Top Findings:
1. [HIGH] 2 stale plugin caches detected
   Action: /dev-tools:reload all

2. [MEDIUM] ToolUse hooks averaging 45ms
   Slowest: Read (89ms), Bash (67ms)

Full report: .claude/perf/reports/my-session-2025-12-19-15-45-23.md
```

## Cleanup

After generating the report:
- Clean up temp files (/tmp/hook_analysis.json, /tmp/cache_analysis.json)
- Keep session file for history (don't delete)
