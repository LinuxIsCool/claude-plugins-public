# Performance Profiling Plugin

On-demand performance profiling and optimization for Claude Code sessions.

## Features

- **Hook Timing Analysis**: Measure execution time of SessionStart, UserPromptSubmit, Stop hooks
- **Cache Health**: Analyze plugin cache size, staleness, and impact
- **Startup Breakdown**: Understand what's slowing down Claude Code startup
- **Historical Tracking**: Compare performance over time, detect regressions
- **Optimization Recommendations**: Get actionable suggestions to improve performance

## Quick Start

```bash
# Start a profiling session
/perf:start my-session

# Work normally...

# Stop and generate report
/perf:stop

# View latest report
/perf:report

# Compare with history
/perf:history
```

## Commands

| Command | Description |
|---------|-------------|
| `/perf:start [name]` | Begin profiling session |
| `/perf:stop` | End session, generate report |
| `/perf:report [id]` | View profile report |
| `/perf:history` | List sessions, show trends |

## How It Works

This plugin uses **zero runtime hooks** for minimal overhead. Instead of instrumenting every operation, it:

1. Reads existing data from the **logging plugin** (hook events, timestamps)
2. Scans the **plugin cache** for health metrics
3. Analyzes patterns to identify bottlenecks
4. Generates recommendations based on observed performance

## Data Storage

```
.claude/perf/
├── sessions/           # Session metadata
├── reports/            # Generated markdown reports
└── history.jsonl       # Historical metrics for regression detection
```

## Analyst Agent

Use the `perf:analyst` agent for autonomous performance investigation:

```
Task: Analyze my Claude Code performance and identify optimization opportunities
```

## Integration

Complementary to other plugins:
- **logging**: Provides hook timing data
- **dev-tools**: Cache invalidation triggers profiling attention
- **awareness**: Optimization patterns become learnings
