# Master Techniques - Teaching and Architecture

Mastery means designing skill systems and teaching others.

## Learning Objectives

By the end of this level, you will:
- Design skill architectures for entire domains
- Teach skill development effectively
- Contribute to the skill ecosystem
- Evolve skills based on usage patterns

## The Master's Role

Masters don't just create skills - they:
- **Architect** skill systems for organizations
- **Mentor** others in skill development
- **Evolve** the practice through innovation
- **Contribute** back to the ecosystem

## Domain Architecture

### Step 1: Domain Analysis

Before creating skills, understand the domain:

```
Domain: [Your Area]

Core Workflows:
1. [Primary workflow]
2. [Secondary workflow]
3. [Tertiary workflow]

Pain Points:
- [What's tedious?]
- [What's error-prone?]
- [What requires expertise?]

Existing Tools:
- [What already exists?]
- [What's missing?]
```

### Step 2: Skill Mapping

Map domain needs to potential skills:

```
┌─────────────────────────────────────────────┐
│              Domain: DevOps                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │  Build  │    │ Deploy  │    │ Monitor │ │
│  └────┬────┘    └────┬────┘    └────┬────┘ │
│       │              │              │       │
│  ┌────┴────┐    ┌────┴────┐   ┌────┴────┐  │
│  │ docker- │    │ k8s-    │   │ log-    │  │
│  │ builder │    │ deployer│   │ analyzer│  │
│  └─────────┘    └─────────┘   └─────────┘  │
│                                             │
│  Cross-cutting: [security-scanner]          │
└─────────────────────────────────────────────┘
```

### Step 3: Dependency Graph

Identify skill relationships:

```yaml
skill_architecture:
  domain: devops

  foundation_skills:
    - git-basics
    - docker-basics
    - kubernetes-concepts

  intermediate_skills:
    - docker-builder:
        requires: [docker-basics]
    - k8s-deployer:
        requires: [kubernetes-concepts, docker-basics]

  advanced_skills:
    - pipeline-orchestrator:
        requires: [docker-builder, k8s-deployer]
        complements: [security-scanner]

  cross_cutting:
    - security-scanner:
        complements: [all]
```

### Exercise: Architect a Domain

Choose a domain you're expert in:

1. Document 3-5 core workflows
2. Identify 5-7 potential skills
3. Map dependencies and relationships
4. Create a visual architecture diagram
5. Prioritize: which skills first?

## Teaching Skill Development

### The Teaching Framework

```
SHOW → DO → REVIEW → EXTEND
```

1. **SHOW**: Demonstrate a complete skill
2. **DO**: Learner creates similar skill with guidance
3. **REVIEW**: Critique and refine together
4. **EXTEND**: Learner tackles new challenge independently

### Common Teaching Scenarios

#### Scenario 1: Complete Beginner

**Approach**:
1. Start with "hello world" skill
2. Explain mental model (onboarding guide)
3. Focus on description writing
4. One concept at a time

**Don't**:
- Overwhelm with frontmatter options
- Introduce progressive disclosure early
- Expect debugging skills

#### Scenario 2: Experienced Developer, New to Skills

**Approach**:
1. Show complete, working skill
2. Explain discovery mechanism
3. Connect to existing mental models (plugins, middleware)
4. Encourage experimentation

**Don't**:
- Assume they understand LLM reasoning
- Skip description importance
- Rush to advanced patterns

#### Scenario 3: Has Created Basic Skills

**Approach**:
1. Review their existing skills
2. Identify improvement opportunities
3. Introduce one advanced pattern
4. Pair on refactoring

**Don't**:
- Criticize without alternatives
- Introduce multiple patterns at once
- Assume they know the "why"

### Exercise: Teaching Session

Conduct a teaching session (real or simulated):

1. Assess learner's current level
2. Choose appropriate starting point
3. Guide them through creating a skill
4. Review and provide feedback
5. Document what worked/didn't

## Ecosystem Contribution

### Ways to Contribute

1. **Publish Skills**: Share useful skills publicly
2. **Document Patterns**: Write about what you've learned
3. **Review Others' Skills**: Provide constructive feedback
4. **Build Tools**: Create skill development infrastructure
5. **Teach**: Help others level up

### Skill Publishing Checklist

Before publishing:

- [ ] Skill works in multiple environments
- [ ] Description is clear and accurate
- [ ] Instructions handle edge cases
- [ ] Examples included for complex outputs
- [ ] No hardcoded paths or assumptions
- [ ] License and attribution clear
- [ ] Documentation complete

### Exercise: Publish a Skill

1. Choose your best skill
2. Generalize it (remove project-specific details)
3. Add comprehensive documentation
4. Test in a fresh environment
5. Share with the community

## Skill Evolution

### Usage Pattern Analysis

Track how skills are used:

```
Skill: commit-crafter
Period: Last 30 days

Invocations: 47
- Direct (/commit-crafter): 12
- Auto-triggered: 35

Trigger Phrases Observed:
- "write commit message" (18)
- "commit this" (9)
- "what should I commit" (5)
- [unexpected] "commit changes" (3)

Failure Patterns:
- Empty diff: 4 times
- Merge commits: 2 times (not handled)
```

### Evolution Actions

Based on usage:
1. **Add trigger phrases** users actually say
2. **Handle failure modes** you're seeing
3. **Remove unused features**
4. **Split overgrown skills**
5. **Merge underused skills**

### Exercise: Evolve a Skill

1. Analyze usage of an existing skill (or simulate)
2. Identify improvement opportunities
3. Implement one evolution
4. Measure impact

## Checkpoint: Master Completion

You've achieved mastery when you:

- [ ] Can architect skill systems for new domains
- [ ] Successfully teach others skill development
- [ ] Have contributed to the skill ecosystem
- [ ] Evolve skills based on usage data
- [ ] Others seek your guidance on skill design

## The Master's Mindset

Mastery is not a destination but a practice:

- **Stay curious**: New patterns emerge constantly
- **Stay humble**: There's always more to learn
- **Stay generous**: Share what you know
- **Stay critical**: Question your assumptions

## Next Steps

Assess your overall progress:

```
Read: plugins/skills/skills/skill-mastery/subskills/self-assessment.md
```

Dive deep into any technical area:

```
Skill: skill-dev
```
