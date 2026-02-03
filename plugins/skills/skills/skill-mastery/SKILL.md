---
name: skill-mastery
description: Learning journey for mastering Claude Code skill development. Guides progression from novice to master through exercises, feedback loops, and deliberate practice. Sub-skills (5): foundations, practice-exercises, expert-patterns, master-techniques, self-assessment. Use when learning to create skills, wanting to improve skill quality, or seeking structured skill development training.
allowed-tools: Read, Glob, Grep, Skill
---

# Skill Mastery - Learning Journey

A structured path for becoming excellent at creating Claude Code skills. While `skill-dev` provides technical reference, this skill guides your **learning progression** through deliberate practice.

## Philosophy

Skill creation mastery follows the same principles as any craft:

1. **Learn by doing** - Create skills, not just read about them
2. **Feedback loops** - Assess, iterate, improve
3. **Progressive challenge** - Start simple, increase complexity
4. **Pattern recognition** - Study examples, extract principles
5. **Teach to learn** - Explaining deepens understanding

## Sub-Skills Index

| Sub-Skill | Level | Use When | File |
|-----------|-------|----------|------|
| **foundations** | Novice | Starting your skill development journey | `subskills/foundations.md` |
| **practice-exercises** | Practitioner | Ready to build skills through guided exercises | `subskills/practice-exercises.md` |
| **expert-patterns** | Expert | Mastering advanced patterns and edge cases | `subskills/expert-patterns.md` |
| **master-techniques** | Master | Teaching others, designing skill architectures | `subskills/master-techniques.md` |
| **self-assessment** | All | Evaluating your skills, identifying gaps | `subskills/self-assessment.md` |

## Learning Progression

```
foundations (novice)
    │
    │  "I can create a basic skill with guidance"
    ↓
practice-exercises (practitioner)
    │
    │  "I can create skills independently"
    ↓
expert-patterns (expert)
    │
    │  "I can extend and customize skills for complex needs"
    ↓
master-techniques (master)

    "I can design skill architectures and teach others"
```

## Quick Assessment: Where Are You?

### Novice
- [ ] Haven't created a skill yet
- [ ] Unsure about SKILL.md structure
- [ ] Need guidance for each step

**Start with**: `subskills/foundations.md`

### Practitioner
- [ ] Created 1-3 basic skills
- [ ] Understand frontmatter fields
- [ ] Can write descriptions that trigger correctly

**Start with**: `subskills/practice-exercises.md`

### Expert
- [ ] Created 5+ skills of varying complexity
- [ ] Use progressive disclosure pattern
- [ ] Can debug discovery issues

**Start with**: `subskills/expert-patterns.md`

### Master
- [ ] Designed skill trees for domains
- [ ] Taught others skill development
- [ ] Contributed to skill ecosystem

**Start with**: `subskills/master-techniques.md`

## The Skill Development Loop

```
    ┌──────────────────────────────────────┐
    │                                      │
    ↓                                      │
 STUDY                                     │
 (Read examples, understand patterns)      │
    │                                      │
    ↓                                      │
 CREATE                                    │
 (Build a skill)                           │
    │                                      │
    ↓                                      │
 TEST                                      │
 (Trigger it, verify behavior)             │
    │                                      │
    ↓                                      │
 ASSESS                                    │
 (What worked? What didn't?)               │
    │                                      │
    └──────────────────────────────────────┘
```

## Relationship to skill-dev

| skill-dev | skill-mastery |
|-----------|---------------|
| **What**: Technical reference | **How**: Learning journey |
| Frontmatter fields | When to use which field |
| Pattern definitions | Practice applying patterns |
| Documentation | Exercises and feedback |
| "Here are the tools" | "Here's how to master them" |

**Use together**: Load `skill-dev` for technical details, `skill-mastery` for guided learning.

## Getting Started

### First Time?
```
Read: plugins/skills/skills/skill-mastery/subskills/foundations.md
```

### Know the Basics?
```
Read: plugins/skills/skills/skill-mastery/subskills/practice-exercises.md
```

### Want Feedback?
```
Read: plugins/skills/skills/skill-mastery/subskills/self-assessment.md
```

## Success Metrics

Track your progress with these milestones:

| Milestone | Evidence |
|-----------|----------|
| First skill created | SKILL.md exists and loads |
| First trigger | Skill activates from description |
| First iteration | Improved skill based on feedback |
| First sub-skill | Used progressive disclosure |
| First tree | Designed multi-skill domain |
| First teaching | Helped someone else create a skill |
