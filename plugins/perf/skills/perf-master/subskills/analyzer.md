# Analyzer Sub-Skill

Interpreting performance data and identifying bottlenecks.

## Reading Performance Reports

Reports are structured markdown with these sections:

### Summary Section

Quick overview of key metrics:
- **Hook Executions**: Total count and cumulative time
- **Cache Size**: Total bytes and file count
- **Stale Plugins**: Count of out-of-date caches

### Hook Performance Table

| Hook Type | Count | Avg (ms) | Max (ms) | Total (ms) |
|-----------|-------|----------|----------|------------|
| SessionStart | 1 | 230 | 230 | 230 |
| ToolUse | 47 | 45 | 120 | 2115 |

**Interpretation:**
- High `Total` = cumulative impact on session
- High `Max` = individual slow operation worth investigating
- High `Avg` = consistent slowness in that hook type

### Slowest Operations

Lists the top 5 slowest individual operations:

1. **stale_cache_detector** (SessionStart): 230ms
2. **Read** (ToolUse): 120ms
3. **Bash** (ToolUse): 89ms

**Action**: Investigate the slowest operations first for maximum impact.

## Identifying Bottlenecks

### Startup Bottlenecks

Look for SessionStart hooks with high duration:
- `stale_cache_detector.py`: Scans all plugins - slow if many plugins
- `session-start.sh`: Registry updates - slow if registry is large
- `auto-identity.py`: API call for naming - intentionally async

**Red flags:**
- Any SessionStart hook > 100ms
- Total startup time > 500ms

### Cache Bottlenecks

Look for cache analysis warnings:
- **Stale plugins**: Force Claude Code to use outdated code
- **Large cache**: > 200MB may slow cache operations
- **Many files**: > 10,000 files increases scan time

### Tool Execution Bottlenecks

Look for ToolUse timings:
- **Read**: Large files or many files slow reads
- **Bash**: Long-running commands or slow scripts
- **Write**: Large writes or many small writes

## Correlation Analysis

### Time Window Correlation

When analyzing, note the time window:
- Start time vs first hook event
- Gaps between operations
- Clustering of slow operations

### Cross-Session Comparison

Use `/perf:history` to compare metrics across sessions:

| Metric | Session 1 | Session 2 | Delta |
|--------|-----------|-----------|-------|
| Cache Size | 180 MB | 243 MB | +35% |
| Stale Count | 0 | 2 | +2 |
| Avg Hook Time | 35ms | 48ms | +37% |

**Regression indicators:**
- Cache size increasing without cleanup
- Stale count > 0 (should always be 0)
- Average times increasing

## Using the Analyst Agent

For deep investigation, invoke the `perf:analyst` agent:

```
Task: Investigate why SessionStart hooks are taking 500ms and recommend fixes
```

The analyst agent will:
1. Read raw JSONL data
2. Trace through hook implementations
3. Identify root causes
4. Propose specific optimizations
