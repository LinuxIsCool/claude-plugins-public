# Observe Sub-Skill

## Purpose

Scan environment for state and opportunities. This is the sensory phase of the OODA loop.

## Internal Sources

### Git State
```bash
git status           # Uncommitted changes
git log --oneline -20 # Recent activity
git diff --stat HEAD~5 # Recent change volume
```

### Journal
```
.claude/journal/YYYY/MM/DD/  # Recent atomics
```
Look for: Recent learnings, open questions, patterns.

### Backlog
```
mcp__plugin_backlog_backlog__task_list
```
Look for: Blocked tasks, overdue items, high-priority pending.

### Agent Registry
```
.claude/registry/agents.md
```
Look for: Dormant agents, capability gaps.

### Session Logs
```
.claude/logging/YYYY/MM/DD/
```
Look for: Recurring patterns, failed attempts, successful strategies.

### Temporal KG
Query FalkorDB for:
- Recent topics
- Cross-session patterns
- Knowledge gaps

## External Sources

### Emergence Feed
```
.claude/cook/emergence/feed.yaml
```
Check for: Unprocessed discoveries, high-relevance items.

### Role Models
```
.claude/cook/rolemodels/registry.yaml
```
Check for: Recent updates from tracked sources.

## Output Format

```yaml
observation:
  timestamp: "ISO-8601"

  internal:
    git:
      uncommitted: true|false
      recent_commits: [...]
      change_velocity: high|medium|low

    backlog:
      blocked: [...]
      overdue: [...]
      high_priority: [...]

    journal:
      recent_themes: [...]
      open_questions: [...]

    agents:
      dormant: [...]
      recently_used: [...]

  external:
    emergence:
      unprocessed_count: N
      high_relevance: [...]

    role_models:
      recent_activity: [...]

  signals:
    opportunities: [...]
    blockers: [...]
    patterns: [...]
```

## Key Questions

1. What changed since last observation?
2. What's blocking progress?
3. What opportunities emerged?
4. What patterns are forming?
5. What's being neglected?
