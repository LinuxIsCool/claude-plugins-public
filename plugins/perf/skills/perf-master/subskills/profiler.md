# Profiler Sub-Skill

Guide for running performance profiling sessions.

## Starting a Session

Use `/perf:start [name]` to begin profiling:

```bash
/perf:start my-feature
```

This creates a session file at `.claude/perf/sessions/my-feature.json` containing:
- Profile name
- Start timestamp
- Session ID
- Working directory
- Status (active)

## What Gets Captured

The perf plugin captures metrics from multiple sources:

### Hook Timing (from logging plugin)

The logging plugin records all hook events to JSONL. Perf analyzes:
- SessionStart hooks (startup impact)
- PreToolUse/PostToolUse pairs (tool execution time)
- UserPromptSubmit hooks (per-prompt overhead)
- Stop hooks (response completion overhead)

### Cache Analysis (from filesystem)

Direct filesystem inspection of `~/.claude/plugins/cache/`:
- Total size and file count
- Per-plugin breakdown
- Staleness detection (source newer than cache)

## Stopping a Session

Use `/perf:stop` to end profiling and generate a report:

```bash
/perf:stop
```

This:
1. Runs hook_analyzer.py on logging JSONL
2. Runs cache_analyzer.py on plugin cache
3. Generates markdown report
4. Saves to `.claude/perf/reports/`
5. Updates history for regression tracking

## Session Files

```
.claude/perf/
├── sessions/
│   ├── my-feature.json        # Session metadata
│   └── baseline.json
├── reports/
│   ├── my-feature-2025-12-19.md
│   └── baseline-2025-12-18.md
└── history.jsonl              # Aggregated metrics over time
```

## Best Practices

1. **Name sessions descriptively**: Use names like `baseline`, `after-optimization`, `with-new-plugin`
2. **Profile representative work**: Include typical operations during the session
3. **Compare before/after**: Use `/perf:history` to detect regressions
4. **Run multiple times**: Performance varies; multiple samples give better data

## Troubleshooting

### No hook timing data

Ensure the logging plugin is active. Check for `.claude/logging/` directory.

### Empty reports

Verify the session was started before the work you want to profile.

### Stale session

If you forgot to stop a session, it will show as "active" in history. You can manually edit the session JSON to mark it completed.
