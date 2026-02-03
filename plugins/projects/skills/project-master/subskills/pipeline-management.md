---
name: pipeline-management
description: Move projects through stages, review pipeline health
---

# Pipeline Management Sub-Skill

## When to Use

Use this sub-skill when:
- Moving projects through pipeline stages
- Reviewing pipeline health
- Converting opportunities to assignments
- Closing out completed projects

## Pipeline Stages

```
Lead → Proposal → Negotiation → Active → Delivered → Closed
```

| Stage | Description | Priority Modifier |
|-------|-------------|-------------------|
| Lead | Initial inquiry, potential interest | 0.4 |
| Proposal | Preparing/sent proposal | 0.6 |
| Negotiation | Discussing terms, scope, pricing | 0.8 |
| Active | Work in progress | 1.0 |
| Delivered | Work complete, awaiting final payment | 0.9 |
| Closed | Fully complete, archived | 0.0 |

## Transitioning Stages

```
project_transition({
  id: "proj-xxx",
  stage: "active",
  notes: "Contract signed, starting January 15"
})
```

Transition notes are appended to project notes with timestamp.

## Stage Transition Effects

### Lead → Proposal
- Indicates serious follow-up
- Consider adding deadline for proposal submission

### Proposal → Negotiation
- They're interested
- May need to update financial terms

### Negotiation → Active
- **sets `started_at` timestamp**
- Type typically changes to "assignment"
- Add milestones and deliverables

### Active → Delivered
- Work complete
- Focus on final invoicing
- Higher priority if outstanding payments

### Delivered → Closed
- All payments received
- **File moves to `completed/` directory**
- Priority drops to 0

## Pipeline Review

List by stage:
```
project_list({ stage: "negotiation" })
project_list({ stage: "active" })
```

List opportunities (leads + proposals):
```
project_list({ type: "opportunity" })
```

## Converting Opportunity to Assignment

When an opportunity becomes committed work:

```
project_update({
  id: "proj-xxx",
  type: "assignment"
})

project_transition({
  id: "proj-xxx",
  stage: "active",
  notes: "Contract signed"
})
```

## Pipeline Health Indicators

### Healthy Pipeline
- Mix of stages (leads feeding into active work)
- Opportunities converting to assignments
- Delivered projects moving to closed

### Warning Signs
- Many leads, few conversions
- Too many active projects (capacity issue)
- Delivered projects stuck (payment issues)

## Best Practices

1. **Review pipeline weekly**: Ensure flow through stages
2. **Add notes on transition**: Context for future reference
3. **Close promptly**: Don't let delivered projects linger
4. **Track conversion rate**: Opportunities → Assignments
