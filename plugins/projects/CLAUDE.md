# Projects Plugin - Agent Instructions

You have access to the Projects plugin for tracking projects and opportunities with real-time priority ranking.

## Getting Started

The plugin needs to be initialized first. Check with `project_list` - if it returns "Projects not initialized", run:

```
project_init({ default_currency: "USD" })
```

## Priority Model

Projects are ranked 0-100 based on deadline-dominant priority:

| Factor | Weight | Description |
|--------|--------|-------------|
| Deadline urgency | 40% | Days until nearest deadline (overdue = 100) |
| Manual priority | 25% | User-set level (critical/high/medium/low) |
| Financial value | 20% | Outstanding or estimated value (log scale) |
| Recurrence boost | 15% | Boost for recurring items approaching due date |

**Stage acts as a scale factor** (not weighted):
- Active: 100% of score
- Delivered: 95%
- Negotiation: 90%
- Proposal: 80%
- Lead: 70%
- Closed: 0%

## Project Types

- **Assignment**: Committed work (contracts, deliverables, active engagements)
- **Opportunity**: Potential work (proposals, leads, prospects)

## Pipeline Stages

```
Lead → Proposal → Negotiation → Active → Delivered → Closed
```

## MCP Tools Reference

### Core Operations
| Tool | Purpose |
|------|---------|
| `project_create` | Create project with title, type, stage, deadline, rate |
| `project_list` | List/filter by type, stage, priority, tags, client |
| `project_get` | Get full project details with priority breakdown |
| `project_update` | Update any project fields |
| `project_delete` | Delete a project |
| `project_search` | Search by text across title, description, notes |

### Milestones & Deliverables
| Tool | Purpose |
|------|---------|
| `project_add_milestone` | Add milestone with deadline |
| `project_add_deliverable` | Add deliverable to milestone |
| `project_complete_item` | Mark milestone/deliverable complete |

### Pipeline
| Tool | Purpose |
|------|---------|
| `project_transition` | Move to new stage with optional notes |

### Financial
| Tool | Purpose |
|------|---------|
| `project_add_invoice` | Add invoice (must match project currency) |
| `project_mark_paid` | Mark invoice as paid |
| `project_financials` | Get totals: invoiced, received, outstanding |

### Timeline
| Tool | Purpose |
|------|---------|
| `project_timeline` | View grouped by deadline proximity |

## Common Workflows

### Start of Day
```
project_timeline({ include_overdue: true })
project_list({ due_within_days: 7 })
```

### Create New Client Project
```
project_create({
  title: "Website Redesign",
  type: "assignment",
  stage: "active",
  client: "Acme Corp",
  deadline: { date: "2026-03-01", hard: true },
  rate: { type: "fixed", amount: 10000, currency: "USD" }
})
```

### Convert Opportunity to Assignment
```
project_update({ id: "proj-xxx", type: "assignment" })
project_transition({ id: "proj-xxx", stage: "active", notes: "Contract signed" })
```

### Track Payment
```
project_add_invoice({ project_id: "proj-xxx", amount: 5000, description: "Phase 1" })
# Later when paid:
project_mark_paid({ project_id: "proj-xxx", invoice_id: "inv-xxx" })
```

## Data Storage

Projects are stored as markdown files with YAML frontmatter:
- `.claude/projects/active/` - Active assignments
- `.claude/projects/opportunities/` - Potential work
- `.claude/projects/completed/` - Archived projects

Files automatically move between directories based on type and stage.

## Currency Enforcement

All invoices for a project must use the same currency. If you need multi-currency support, create separate projects per currency.

## Integration Points

Projects can reference:
- `schedule_blocks` - Link to Schedule.md time blocks
- `backlog_tasks` - Link to Backlog.md tasks
- `related_projects` - Link to other projects
