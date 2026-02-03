---
name: perf
description: Master skill for Claude Code performance profiling (3 sub-skills). Covers: profiler, analyzer, optimizer. Invoke for profiling sessions, bottleneck analysis, or optimization recommendations.
allowed-tools: Read, Bash, Glob, Grep, Task
---

# Performance Profiling - Master Skill

On-demand performance profiling and optimization for Claude Code.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **profiler** | Starting/stopping profiling sessions, understanding what's captured | `subskills/profiler.md` |
| **analyzer** | Interpreting performance data, identifying bottlenecks | `subskills/analyzer.md` |
| **optimizer** | Generating optimization recommendations, applying fixes | `subskills/optimizer.md` |

## How to Use

### Quick Reference

For brief guidance, use the index above to identify the right sub-skill.

### Deep Dive

To load full sub-skill content:
```
Read the sub-skill file: plugins/perf/skills/perf-master/subskills/{name}.md
```

### Typical Workflow

```
/perf:start [name]     → Begin profiling session
... work normally ...
/perf:stop             → End session, generate report
/perf:report           → View latest report
/perf:history          → Compare with past sessions
```

## Sub-Skill Summaries

### profiler

Guide for running profiling sessions:
- Starting and stopping profiles
- Understanding captured metrics
- Session management
- Data storage locations

### analyzer

Interpreting performance data:
- Reading hook timing breakdowns
- Understanding cache analysis
- Identifying slowest operations
- Correlating with system state

### optimizer

Generating and applying optimizations:
- Cache cleanup recommendations
- Hook consolidation suggestions
- Plugin pruning advice
- Performance best practices

## Key Metrics

| Metric | What It Measures | Source |
|--------|-----------------|--------|
| Hook timing | Execution time of each hook | logging plugin JSONL |
| Cache size | Total plugin cache bytes | ~/.claude/plugins/cache |
| Stale plugins | Caches older than source | mtime comparison |
| Tool duration | Time per tool execution | PreToolUse/PostToolUse |

## Zero Overhead Design

This plugin uses **no runtime hooks**. It:
1. Reads existing data from the logging plugin
2. Scans plugin cache filesystem
3. Analyzes patterns on-demand

No performance impact during normal Claude Code usage.
