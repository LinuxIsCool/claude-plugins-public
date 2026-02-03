---
name: pulse
description: Monitor ecosystem state - agents, plugins, resources, coherence
---

# Pulse Sub-Skill

## Purpose

Maintain awareness of ecosystem state. Know what's active, dormant, healthy, or stale.

## Location

`.claude/conductor/pulse.md`

## Dimensions to Monitor

### Agents
- **Active**: Recently invoked agents
- **Dormant**: Defined but not used
- **Health**: Functioning as expected?

### Plugins
- **Mature (8%)**: statusline, autocommit
- **Functional (38%)**: awareness, journal, temporal, etc.
- **First-Draft (54%)**: transcripts, knowledge-graphs, etc.

### Resources
- **Stale**: Not updated in >7 days
- **Current**: Recently touched
- **Needs Attention**: Broken, incomplete, orphaned

### Coherence
- **Vision-Action Alignment**: Do actions match stated goals?
- **Contradictions**: Conflicting information
- **Fragmentation**: Disconnected parts

## Quick Checks

### Git Activity
```bash
git log --oneline -10
git log --since="24 hours ago" --oneline | wc -l
```

### Agent Registry
```
Read(".claude/registry/agents.md")
```

### Library Staleness
```bash
git log -1 --format="%ar" -- .claude/library/
```

### Journal Gap
```bash
ls .claude/journal/2025/12/ | tail -5
```

## Update Protocol

### On Session Start
1. Quick git check
2. Scan for obvious gaps
3. Note in pulse.md if changes detected

### On Session End
1. Update agent activity
2. Note artifacts created/modified
3. Update coherence assessment

## Usage

```
Use conductor:pulse when:
- Getting ecosystem overview
- Checking for gaps or staleness
- Assessing agent health
- Validating coherence
```

---

*Pulse checked every session.*
