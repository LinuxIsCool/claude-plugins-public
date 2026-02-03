---
name: deadline-tracking
description: Review deadlines, priority rankings, and urgent items
---

# Deadline Tracking Sub-Skill

## When to Use

Use this sub-skill when:
- Reviewing upcoming deadlines
- Understanding priority rankings
- Identifying overdue or urgent items
- Planning work based on deadline pressure

## Priority Scoring

The priority calculator uses deadline urgency as the dominant factor (40% weight):

| Days Until Deadline | Urgency Score |
|---------------------|---------------|
| Overdue | 100 |
| Due today | 95 |
| 1-3 days | 85-95 |
| 4-7 days | 70-85 |
| 1-2 weeks | 50-70 |
| 2-4 weeks | 30-50 |
| 1-3 months | 10-30 |
| > 3 months | 5-10 |
| No deadline | 0 |

## Key Tools

### View Timeline
```
project_timeline({ days_ahead: 90, include_overdue: true })
```

Groups projects by deadline proximity: Overdue, This Week, This Month, etc.

### List Urgent Projects
```
project_list({ due_within_days: 7, sort_by: "priority" })
```

### Check Overdue Items
```
project_list({ overdue: true })
```

### View Project Details with Priority Breakdown
```
project_get({ id: "proj-xxx" })
```

Returns calculated priority with breakdown of each scoring component.

## Hierarchical Deadlines

Priority considers all deadlines in the hierarchy:
1. Project-level deadline
2. Milestone deadlines (uncompleted)
3. Deliverable deadlines (uncompleted)

The **nearest** uncompleted deadline determines urgency.

## Hard vs Soft Deadlines

When creating deadlines, specify `hard: true` for firm deadlines:
```
deadline: { date: "2026-02-15", hard: true }
```

Soft deadlines (`hard: false`) are targets that can flex.

## Best Practices

1. **Daily review**: Start with `project_timeline` to see what's coming
2. **Focus on red**: Address overdue items first
3. **Update progress**: Complete deliverables to update priority scores
4. **Set realistic deadlines**: Better to have soft deadlines than missed hard ones
