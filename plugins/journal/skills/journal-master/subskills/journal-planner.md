---
name: journal-planner
description: Planning-focused journaling for goals, intentions, roadmaps, and forward-looking entries. Use when the user wants to plan, set goals, create roadmaps, define intentions, or think about the future.
allowed-tools: Read, Write, Edit, Glob
---

# Journal Planner

Create planning-focused journal entries for goals, intentions, roadmaps, and forward-looking thought.

## When to Use

- User wants to plan or set goals
- Starting a new project or initiative
- Defining intentions for a period (day, week, month, year)
- Creating a roadmap or timeline
- Thinking about what comes next

## Planning Entry Types

### 1. Daily Intentions

Add to daily note's "Morning Intentions" section:

```markdown
## Morning Intentions

### Today's Focus
[One main thing to accomplish]

### Top 3 Priorities
1.
2.
3.

### Time Blocks
- [ ] 09:00-12:00:
- [ ] 13:00-17:00:
- [ ] Evening:

### Energy Allocation
- Deep work:
- Meetings:
- Admin:
```

### 2. Weekly Planning

Create atomic note: `HHMMSS-week-NN-plan.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "Week NN Plan"
type: atomic
tags: [planning, weekly]
links: []
created: YYYY-MM-DDTHH:MM:SS
---

# Week NN Plan (Mon DD - Sun DD)

## Theme


## Goals
- [ ]
- [ ]
- [ ]

## Projects
### [Project 1]
- [ ]

### [Project 2]
- [ ]

## Habits to Track
- [ ] Mon Tue Wed Thu Fri Sat Sun

## Appointments
-

## Notes
-

---
*Links: [[YYYY-MM-DD]] | [[YYYY-MM]]*
```

### 3. Monthly Goals

Add to monthly note or create atomic planning note:

```markdown
## Monthly Goals

### Theme: [Monthly Theme]

### Outcomes
By end of month, I will have:
1.
2.
3.

### Key Results
- [ ] KR1:
- [ ] KR2:
- [ ] KR3:

### Projects
| Project | Status | Target |
|---------|--------|--------|
|         |        |        |

### Habits
-

### Learning
-
```

### 4. Quarterly Planning

Create atomic note: `HHMMSS-YYYY-QN-plan.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "YYYY Q[N] Plan"
type: atomic
tags: [planning, quarterly]
links: [[YYYY]]
created: YYYY-MM-DDTHH:MM:SS
---

# YYYY Q[N] Plan

## Quarter Theme


## 90-Day Outcomes
1.
2.
3.

## OKRs

### Objective 1:
- [ ] KR1:
- [ ] KR2:
- [ ] KR3:

### Objective 2:
- [ ] KR1:
- [ ] KR2:

## Projects

| Project | Priority | Outcome | Deadline |
|---------|----------|---------|----------|
|         |          |         |          |

## Monthly Breakdown

### Month 1
-

### Month 2
-

### Month 3
-

## Resources Needed
-

## Risks
-

---
*Links: [[YYYY]]*
```

### 5. Annual Planning

Add to yearly note:

```markdown
## Annual Plan

### Vision Statement
[What does success look like at year end?]

### Word of the Year
[One word to guide decisions]

### Annual Goals
1.
2.
3.

### Life Areas
| Area | Current | Target | Actions |
|------|---------|--------|---------|
| Health |  |  |  |
| Career |  |  |  |
| Relationships |  |  |  |
| Finance |  |  |  |
| Learning |  |  |  |
| Creative |  |  |  |

### Quarterly Themes
- Q1:
- Q2:
- Q3:
- Q4:

### Anti-Goals
[What will I NOT do this year?]
-
```

### 6. Project Planning

Create atomic note: `HHMMSS-project-name-plan.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "Project: [Name]"
type: atomic
tags: [planning, project]
links: []
created: YYYY-MM-DDTHH:MM:SS
---

# Project: [Name]

## Overview
**Purpose**:
**Outcome**:
**Deadline**:

## Success Criteria
- [ ]
- [ ]

## Milestones
1. [ ] Milestone 1 - [Date]
2. [ ] Milestone 2 - [Date]
3. [ ] Milestone 3 - [Date]

## Tasks
- [ ]
- [ ]

## Dependencies
-

## Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
|      |            |        |            |

## Resources
-

## Notes
-

---
*Links: [[YYYY-MM-DD]]*
```

## Planning Frameworks

### SMART Goals
- **S**pecific: What exactly?
- **M**easurable: How will I know?
- **A**chievable: Is it realistic?
- **R**elevant: Why does it matter?
- **T**ime-bound: By when?

### OKRs (Objectives & Key Results)
- Objective: Qualitative, inspiring goal
- Key Results: 3-5 measurable outcomes

### Eisenhower Matrix
```
        Urgent      Not Urgent
       ┌───────────┬───────────┐
Import │ DO        │ SCHEDULE  │
       ├───────────┼───────────┤
Not    │ DELEGATE  │ ELIMINATE │
       └───────────┴───────────┘
```

### Time Boxing
Allocate fixed time periods to activities, not open-ended.

### 1-3-5 Rule
Each day: 1 big thing, 3 medium things, 5 small things.

## Prompts for Planning

### Daily
- What's the ONE thing that would make today great?
- What would I regret NOT doing today?
- What deserves my best energy?

### Weekly
- What must happen this week?
- What did last week teach me about this week?
- Where am I overcommitted?

### Monthly
- What theme defines this month?
- What habits will I build?
- What will I learn?

### Quarterly/Annual
- What would make this [quarter/year] transformative?
- What am I tolerating that needs to change?
- What's the highest leverage activity?

## Workflow

1. **Check existing plans** - Don't duplicate
2. **Choose appropriate scope** - Daily vs weekly vs quarterly
3. **Use frameworks** - SMART, OKRs, etc. where helpful
4. **Link to context** - Connect to daily notes, yearly themes
5. **Set review dates** - Plans need follow-up

## Notes

- Planning without reflection is incomplete
- Over-planning is procrastination
- The best plan is one you'll actually follow
- Review and adjust plans regularly
