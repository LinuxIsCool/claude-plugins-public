---
name: project-planning
description: Create projects, set up milestones and deliverables
---

# Project Planning Sub-Skill

## When to Use

Use this sub-skill when:
- Creating new projects or opportunities
- Setting up project structure with milestones
- Breaking down work into deliverables
- Defining deadlines and financial terms

## Creating Projects

### Basic Assignment
```
project_create({
  title: "API Integration",
  type: "assignment",
  stage: "active",
  client: "Client Name",
  priority: "high",
  tags: ["backend", "api"]
})
```

### Opportunity with Financials
```
project_create({
  title: "Consulting Proposal",
  type: "opportunity",
  stage: "proposal",
  client: "Potential Client",
  deadline: { date: "2026-03-01", hard: false },
  rate: { type: "hourly", amount: 150, currency: "USD", estimated_hours: 40 }
})
```

## Setting Up Milestones

Milestones represent major phases with deadlines:

```
project_add_milestone({
  project_id: "proj-xxx",
  title: "Phase 1: Design",
  description: "Complete all design mockups",
  deadline: { date: "2026-02-01", hard: true }
})
```

## Adding Deliverables

Deliverables are specific outputs within milestones:

```
project_add_deliverable({
  project_id: "proj-xxx",
  milestone_id: "ms-xxx",
  title: "Homepage mockup",
  description: "High-fidelity homepage design",
  deadline: { date: "2026-01-25", hard: false }
})
```

## Rate Types

| Type | Use Case | Fields |
|------|----------|--------|
| `hourly` | Time-based billing | `amount`, `estimated_hours` |
| `fixed` | Project-based pricing | `amount` |
| `retainer` | Monthly agreements | `amount` (monthly) |
| `equity` | Startup/partnership | `equity_percentage` |

## Project Structure Example

```
Project: Website Redesign
├── Milestone 1: Design (due: 2026-02-01)
│   ├── Deliverable: Homepage mockup
│   ├── Deliverable: About page mockup
│   └── Deliverable: Contact page mockup
├── Milestone 2: Development (due: 2026-03-01)
│   ├── Deliverable: Frontend implementation
│   └── Deliverable: CMS integration
└── Milestone 3: Launch (due: 2026-03-15)
    ├── Deliverable: Testing
    └── Deliverable: Deployment
```

## Best Practices

1. **Start with milestones**: Define major phases before deliverables
2. **Set realistic deadlines**: Include buffer time
3. **Use tags**: Enable easy filtering later
4. **Add client info**: Helps with organization and search
5. **Track financials from start**: Accurate priority calculation
