---
name: journal-reflector
description: Reflection-focused journaling for retrospectives, lessons learned, reviews, and backward-looking entries. Use when the user wants to reflect, review, conduct retrospectives, extract lessons, or think about what happened.
allowed-tools: Read, Write, Edit, Glob
---

# Journal Reflector

Create reflection-focused journal entries for retrospectives, lessons learned, reviews, and backward-looking thought.

## When to Use

- User wants to reflect or review
- End of day, week, month, quarter, year
- After completing a project or milestone
- Processing an experience or event
- Extracting lessons learned
- Conducting a retrospective

## Reflection Entry Types

### 1. Daily Evening Reflection

Add to daily note's "Evening Reflection" section:

```markdown
## Evening Reflection

### What went well?
-

### What didn't go well?
-

### What did I learn?
-

### What am I grateful for?
1.
2.
3.

### How did I feel today?
Energy: [1-10]
Mood: [word]
Focus: [1-10]

### Tomorrow I will...
-
```

### 2. Weekly Review

Create atomic note: `HHMMSS-week-NN-review.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "Week NN Review"
type: atomic
tags: [reflection, weekly, review]
links: []
created: YYYY-MM-DDTHH:MM:SS
---

# Week NN Review (Mon DD - Sun DD)

## Accomplishments
-

## Challenges
-

## Lessons Learned
-

## Incomplete Items
- [ ] → [where it goes]

## Energy Patterns
| Day | Energy | Notes |
|-----|--------|-------|
| Mon |        |       |
| Tue |        |       |
| Wed |        |       |
| Thu |        |       |
| Fri |        |       |

## Highlights
-

## Lowlights
-

## Questions to Sit With
-

## Next Week Focus
-

---
*Links: [[YYYY-MM-DD]] | [[YYYY-MM]]*
```

### 3. Monthly Review

Add to monthly note or create atomic note:

```markdown
## Monthly Review

### Goals Progress
| Goal | Status | Notes |
|------|--------|-------|
|      |        |       |

### Wins
1.
2.
3.

### Challenges
1.
2.

### Lessons
-

### Themes That Emerged
-

### What I'm Proud Of
-

### What I'd Do Differently
-

### Gratitude
-

### Next Month Focus
-
```

### 4. Quarterly Review

Create atomic note: `HHMMSS-YYYY-QN-review.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "YYYY Q[N] Review"
type: atomic
tags: [reflection, quarterly, review]
links: [[YYYY]]
created: YYYY-MM-DDTHH:MM:SS
---

# YYYY Q[N] Review

## Quarter Summary
[2-3 sentence overview]

## OKR/Goal Review
| Objective | Target | Actual | Score |
|-----------|--------|--------|-------|
|           |        |        |   /10 |

## Projects Completed
-

## Projects Incomplete
- [ ] Reason:

## Major Wins
1.
2.
3.

## Biggest Challenges
1.
2.

## Key Lessons
1.
2.
3.

## Personal Growth
-

## What Surprised Me
-

## What I'm Grateful For
-

## Energy & Wellbeing Trends
-

## Time Audit
| Category | Estimated | Actual | Notes |
|----------|-----------|--------|-------|
| Deep work |  |  |  |
| Meetings |  |  |  |
| Learning |  |  |  |
| Rest |  |  |  |

## Next Quarter Adjustments
-

---
*Links: [[YYYY]]*
```

### 5. Annual Review

Add to yearly note:

```markdown
## Annual Review

### Year in One Sentence


### Theme That Emerged


### By the Numbers
- Books read:
- Projects completed:
- New skills:
- [Custom metrics]:

### Major Milestones
| Month | Milestone |
|-------|-----------|
| Jan   |           |
| Feb   |           |
| ...   |           |

### Proudest Accomplishments
1.
2.
3.

### Biggest Disappointments
1.
2.

### Lessons of the Year
1.
2.
3.

### What I Started
-

### What I Stopped
-

### What I Continued
-

### Relationships
- Strengthened:
- New:
- Faded:

### Health & Energy
-

### Financial
-

### What I Would Tell January-Me
-

### Gratitude
-

### Looking Ahead
-
```

### 6. Project Retrospective

Create atomic note: `HHMMSS-project-name-retro.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "Retro: [Project Name]"
type: atomic
tags: [reflection, retrospective, project]
links: []
created: YYYY-MM-DDTHH:MM:SS
---

# Retrospective: [Project Name]

## Summary
**Duration**: [start] to [end]
**Outcome**: [success/partial/failed]
**One-line summary**:

## What Went Well
-

## What Didn't Go Well
-

## What I Learned
-

## What I Would Do Differently
-

## Key Decisions & Their Outcomes
| Decision | Outcome | Lesson |
|----------|---------|--------|
|          |         |        |

## People & Collaboration
-

## Technical Learnings
-

## Process Learnings
-

## Would I Do This Again?
[Yes/No] Because:

## Artifacts to Keep
-

---
*Links: [[YYYY-MM-DD]]*
```

### 7. Experience/Event Reflection

Create atomic note: `HHMMSS-event-name.md`

```markdown
---
id: YYYY-MM-DD-HHMMSS
title: "[Event/Experience Name]"
type: atomic
tags: [reflection, experience]
links: []
created: YYYY-MM-DDTHH:MM:SS
---

# [Event/Experience Name]

## What Happened
[Objective description]

## How I Felt
[Emotional response]

## What I Noticed
[Observations]

## What This Means
[Interpretation]

## What I Learned
[Lessons]

## What I'll Do Differently
[Action items]

## Questions This Raises
[Open questions]

---
*Links: [[YYYY-MM-DD]]*
```

## Reflection Frameworks

### Start-Stop-Continue
- **Start**: What should I begin doing?
- **Stop**: What should I stop doing?
- **Continue**: What should I keep doing?

### 4 Ls Retrospective
- **Liked**: What did I enjoy?
- **Learned**: What did I learn?
- **Lacked**: What was missing?
- **Longed for**: What do I wish for?

### Rose-Thorn-Bud
- **Rose**: Highlight, success
- **Thorn**: Challenge, difficulty
- **Bud**: Opportunity, potential

### WWW (What Went Well)
- What went well?
- What didn't go well?
- What will I do differently?

### ORID (Objective-Reflective-Interpretive-Decisional)
- **O**: What happened? (facts)
- **R**: How do I feel about it? (emotions)
- **I**: What does this mean? (insights)
- **D**: What will I do? (actions)

## Reflection Prompts

### Daily
- What moment am I most proud of?
- What drained my energy?
- What's one thing I'd do over?

### Weekly
- What patterns do I notice?
- What am I avoiding?
- What surprised me?

### Monthly
- Am I still aligned with my goals?
- What habits are serving me? Not serving me?
- What needs more attention?

### Quarterly/Annual
- How have I grown?
- What beliefs have changed?
- What would I tell my past self?

### After Experiences
- What just happened?
- How do I feel about it?
- What will I remember from this?
- What will I do with this?

## Workflow

1. **Create quiet space** - Reflection needs presence
2. **Choose appropriate timeframe** - Match reflection to scope
3. **Be honest** - Self-deception defeats the purpose
4. **Balance positive/negative** - Include wins and challenges
5. **Extract actionable insights** - Reflection should inform action
6. **Link to plans** - Connect lessons to future intentions

## Notes

- Reflection without action is rumination
- The best reflection is regular, not occasional
- Written reflection is more powerful than mental
- Uncomfortable truths are the most valuable
- Gratitude amplifies positive reflection
