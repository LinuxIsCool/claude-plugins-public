---
name: projects
description: Master skill for project management (4 sub-skills). Covers project-planning, deadline-tracking, financial-tracking, pipeline-management. Invoke for project creation, priority review, milestone tracking, or financial summaries.
allowed-tools: Read, Skill, Task, Glob, Grep
---

# Projects - Master Skill

Project and opportunity tracking with real-time priority ranking based on deadline urgency, commitment level, and financial value.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **project-planning** | Creating new projects, setting up milestones and deliverables | `subskills/project-planning.md` |
| **deadline-tracking** | Reviewing deadlines, priority rankings, urgent items | `subskills/deadline-tracking.md` |
| **financial-tracking** | Managing invoices, payments, financial summaries | `subskills/financial-tracking.md` |
| **pipeline-management** | Moving projects through stages, reviewing pipeline health | `subskills/pipeline-management.md` |

## Quick Reference

### Project Types
- **Assignment**: Committed work (contracts, deliverables)
- **Opportunity**: Potential work (proposals, leads)

### Pipeline Stages
```
Lead → Proposal → Negotiation → Active → Delivered → Closed
```

### Priority Factors (default weights)
| Factor | Weight | Description |
|--------|--------|-------------|
| Deadline urgency | 40% | Days until nearest deadline |
| Manual priority | 25% | User-set (critical/high/medium/low) |
| Financial value | 20% | Outstanding or estimated value |
| Recurrence boost | 10% | Proximity to next occurrence |
| Stage modifier | 5% | Active > Negotiation > Lead |

### MCP Tools Available
- `project_create`, `project_list`, `project_get`, `project_update`, `project_delete`, `project_search`
- `project_add_milestone`, `project_add_deliverable`, `project_complete_item`
- `project_transition`
- `project_add_invoice`, `project_mark_paid`, `project_financials`
- `project_timeline`

## Usage Examples

**Create a new assignment:**
```
project_create({
  title: "Website Redesign",
  type: "assignment",
  stage: "active",
  client: "Acme Corp",
  deadline: { date: "2026-02-15", hard: true },
  rate: { type: "fixed", amount: 5000, currency: "USD" }
})
```

**List urgent projects:**
```
project_list({ due_within_days: 7, sort_by: "priority" })
```

**Get financial summary:**
```
project_financials({ stage: "active" })
```

## Integration with Other Plugins

### Schedule Plugin
Link projects to schedule blocks to track time allocation:
```
project_update({
  id: "proj-abc123",
  schedule_blocks: ["block-1", "block-2"]
})
```

### Backlog Plugin
Link projects to backlog tasks for detailed work tracking:
```
project_update({
  id: "proj-abc123",
  backlog_tasks: ["task-42", "task-43"]
})
```

### Messages Plugin
Track client communications by noting thread IDs in project notes.

## Data Storage

Projects are stored as markdown files with YAML frontmatter:
- `.claude/projects/active/` - Active assignments
- `.claude/projects/opportunities/` - Potential work
- `.claude/projects/completed/` - Archived projects
