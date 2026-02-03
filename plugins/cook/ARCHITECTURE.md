# Cook: Meta-Orchestration Engine

## Core Thesis

Cook is a **recursive self-improvement system** that:
1. Observes its environment (codebase, web, conversations)
2. Discovers high-leverage actions
3. Executes through agent orchestration
4. Learns from outcomes
5. Modifies itself to improve

## The Cook Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                         THE COOK LOOP                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │ OBSERVE │───▶│  ORIENT │───▶│ DECIDE  │───▶│   ACT   │      │
│  └────┬────┘    └─────────┘    └─────────┘    └────┬────┘      │
│       │                                            │            │
│       │         ┌─────────────────────────────────┘            │
│       │         ▼                                               │
│       │    ┌─────────┐                                         │
│       └────│  LEARN  │                                         │
│            └─────────┘                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: OBSERVE

**Internal Sources:**
- Git history (recent commits, patterns)
- Journal entries (what's been learned)
- Backlog (pending work)
- Agent registry (available capabilities)
- Session logs (conversation patterns)
- Temporal KG (accumulated knowledge)

**External Sources:**
- Web emergence tracking (Twitter, HackerNews, Reddit, YouTube, ArXiv)
- Role model discovery (people, projects, papers to learn from)
- Tool ecosystem (new capabilities to integrate)

### Phase 2: ORIENT

**Context Assembly:**
- Current state assessment
- Goal hierarchy review (decade → year → quarter → month → week → day → now)
- Resource inventory (agents, tools, compute, time)
- Constraint mapping (what blocks progress?)

**Pattern Recognition:**
- What's working? (reinforce)
- What's failing? (adapt)
- What's missing? (acquire)
- What's emerging? (track)

### Phase 3: DECIDE

**Priority Calculation:**
```
priority = (impact × urgency × alignment) / (cost × risk)

where:
  impact    = goal advancement potential
  urgency   = time-sensitivity
  alignment = fit with values/direction
  cost      = resources required
  risk      = probability of failure
```

**Action Selection:**
- Single high-leverage action (focus mode)
- Parallel independent actions (breadth mode)
- Sequential dependent actions (depth mode)

### Phase 4: ACT

**Orchestration Patterns:**

1. **Direct Execution** - Cook acts directly via tools
2. **Single Agent** - Delegate to specialized agent
3. **Ensemble** - Multiple agents in parallel, synthesize
4. **Pipeline** - Sequential agent chain
5. **Swarm** - Many agents, emergent coordination

**Agent Selection Matrix:**
| Need | Agent | Model |
|------|-------|-------|
| Meta-analysis | conductor | opus |
| Fleet management | agent-architect | opus |
| Knowledge graphs | knowledge-graphs:weaver | sonnet |
| External resources | library:librarian | sonnet |
| Task breakdown | backlog:taskmaster | sonnet |
| Learning guidance | awareness:mentor | sonnet |
| Frameworks | agents:orchestrator | sonnet |
| Quick lookups | temporal:chronologist | haiku |

### Phase 5: LEARN

**Outcome Recording:**
- What was attempted?
- What succeeded/failed?
- What was learned?
- What should change?

**Self-Modification Targets:**
- `CLAUDE.md` - Constitutional updates
- `cook/` plugin files - Capability evolution
- Agent definitions - Behavior refinement
- Skills - Knowledge accumulation

---

## Data Structures

### Goal Hierarchy

```yaml
# .claude/cook/goals/hierarchy.yaml
decades:
  - id: d1
    description: "Build intelligence infrastructure that compounds"

years:
  - id: y2026
    parent: d1
    description: "Activate 30+ agents with orchestration"

quarters:
  - id: q1-2026
    parent: y2026
    description: "Activate dormant agents, establish feedback loops"

months:
  - id: jan-2026
    parent: q1-2026
    objectives:
      - "Build cook command v1"
      - "Integrate emergence tracking"
      - "Establish self-improvement loop"

weeks:
  - id: w1-jan-2026
    parent: jan-2026
    focus: "Cook architecture and scaffold"

days:
  - id: 2026-01-06
    parent: w1-jan-2026
    tasks:
      - "Design cook architecture"
      - "Build emergence tracker"
```

### Emergence Feed

```yaml
# .claude/cook/emergence/feed.yaml
sources:
  twitter:
    accounts: []  # Discovered high-signal accounts
    keywords: []  # Tracked topics

  hackernews:
    threshold: 100  # Points minimum
    keywords: ["ai", "agents", "llm", "rag"]

  reddit:
    subreddits: ["MachineLearning", "LocalLLaMA", "ClaudeAI"]

  arxiv:
    categories: ["cs.AI", "cs.CL", "cs.LG"]
    keywords: ["agent", "memory", "reasoning"]

  youtube:
    channels: []  # Discovered high-signal channels

discoveries:
  - id: disc-001
    source: hackernews
    url: "..."
    discovered: "2026-01-06T17:00:00Z"
    relevance: 0.95
    processed: false
    notes: ""
```

### Role Model Registry

```yaml
# .claude/cook/rolemodels/registry.yaml
people:
  - id: rm-001
    name: ""
    platform: twitter
    handle: ""
    why_follow: ""
    key_insights: []

projects:
  - id: rp-001
    name: "Auto-Scientist"
    url: "https://echohive.ai/auto-scientist/"
    why_study: "Autonomous research loop architecture"
    insights_extracted: []

papers:
  - id: paper-001
    arxiv_id: "2405.07987"
    title: "The Platonic Representation Hypothesis"
    why_study: "Convergent representations as systems scale"
    insights_extracted:
      - "Neural nets converge toward unified statistical model of reality"
      - "Convergence increases with scale"
```

### Learning Log

```yaml
# .claude/cook/learning/log.yaml
entries:
  - id: learn-001
    timestamp: "2026-01-06T17:00:00Z"
    action: "Fetched Auto-Scientist page"
    outcome: "Limited info - just UI shell"
    learned: "Need deeper documentation access"
    adaptation: "Search for technical docs or source code"

  - id: learn-002
    timestamp: "2026-01-06T17:00:00Z"
    action: "Fetched Platonic Representation paper"
    outcome: "Key insight extracted"
    learned: "Convergent representations emerge at scale"
    adaptation: "Design for discovering convergent patterns, not inventing novel ones"
```

---

## Self-Improvement Mechanisms

### 1. Skill Acquisition

```
Observe gap → Research solution → Create skill → Test → Integrate
```

### 2. Agent Evolution

```
Performance metrics → Identify weakness → Modify agent prompt → Test → Deploy
```

### 3. Infrastructure Enhancement

```
Bottleneck detected → Design improvement → Implement → Validate → Document
```

### 4. Knowledge Accumulation

```
Discovery → Extract insights → Add to KG → Create connections → Propagate
```

---

## Temporal Planning Framework

### Scale Hierarchy

| Scale | Horizon | Update Frequency | Focus |
|-------|---------|------------------|-------|
| Decade | 10 years | Yearly | Vision, values |
| Year | 12 months | Quarterly | Strategy |
| Quarter | 3 months | Monthly | Objectives |
| Month | 4 weeks | Weekly | Initiatives |
| Week | 7 days | Daily | Tasks |
| Day | 24 hours | Per-session | Actions |
| Now | Current | Real-time | Focus |

### Planning Rituals

**Daily (every session start):**
- Review day's focus
- Check backlog priority
- Assess energy/capacity

**Weekly (Monday):**
- Review week's progress
- Adjust week's focus
- Surface blockers

**Monthly (1st):**
- Review month's objectives
- Identify patterns
- Adjust course

**Quarterly (Q start):**
- Review strategic objectives
- Major course corrections
- Resource reallocation

---

## Parallelization Strategy

### Independent Actions
When actions don't share dependencies, execute in parallel:
```
cook parallel [
  "agent:librarian catalog new resources"
  "agent:archivist scan recent logs"
  "agent:agent-architect update registry"
]
```

### Pipeline Actions
When actions form a chain:
```
cook pipeline [
  "observe: scan emergence feed"
  "orient: extract relevant discoveries"
  "decide: prioritize by impact"
  "act: process top discovery"
]
```

### Swarm Actions
When exploring solution space:
```
cook swarm {
  goal: "Find best RAG architecture"
  agents: ["knowledge-graphs:weaver", "hipporag:memory-architect", "llms:modeler"]
  synthesis: "conductor"
}
```

---

## Commands

### `/cook` - Main Entry Point

```
/cook              # Run the cook loop once
/cook status       # Current state assessment
/cook observe      # Run observation phase only
/cook plan         # Generate plan without executing
/cook learn        # Review and integrate learnings
/cook improve      # Run self-improvement cycle
```

### `/cook track` - Emergence Tracking

```
/cook track add twitter @user    # Add Twitter account to track
/cook track add arxiv keyword    # Add ArXiv keyword
/cook track scan                 # Scan all sources for new discoveries
/cook track process              # Process unprocessed discoveries
```

### `/cook goal` - Goal Management

```
/cook goal show                  # Display goal hierarchy
/cook goal set day "..."         # Set day's focus
/cook goal review week           # Review week's progress
```

### `/cook agent` - Agent Orchestration

```
/cook agent invoke {name} "{task}"        # Invoke single agent
/cook agent ensemble [{agents}] "{task}"  # Parallel agents
/cook agent pipeline [{steps}]            # Sequential pipeline
```

---

## Bootstrap Sequence

When cook runs for the first time each day:

1. **Load Context**
   - Read goal hierarchy
   - Check backlog
   - Review recent learnings

2. **Scan Environment**
   - Git status
   - Recent commits
   - Emergence feed (if configured)

3. **Orient**
   - What's the day's focus?
   - What's blocking progress?
   - What opportunities emerged?

4. **Propose Actions**
   - Generate candidate actions
   - Score by priority formula
   - Present top 3 to user

5. **Execute (with approval)**
   - Run selected action
   - Record outcome
   - Update learnings

---

## Evolution Roadmap

### v0.1 (Now)
- Basic observe/orient/decide/act loop
- Manual emergence tracking
- Simple goal hierarchy

### v0.2
- Automated emergence scanning (HackerNews, Reddit)
- Role model discovery
- Learning log integration

### v0.3
- Self-modification capabilities
- Agent performance tracking
- Automated skill creation

### v0.4
- Full temporal planning
- Swarm orchestration
- Financial metabolism integration

### v1.0
- Fully autonomous operation
- Cross-session memory
- Compound improvement

---

## Infinite Loop Architecture

The `/cook` command runs an infinite OODA+L loop in the **main agent**, spawning sub-agents for work.

### Core Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN AGENT - Runs the infinite loop                             │
│                                                                  │
│  WHILE context_capacity > threshold:                            │
│      1. OBSERVE - Check steering + environment                  │
│      2. ORIENT  - Context assembly                              │
│      3. DECIDE  - Select action                                 │
│      4. ACT     - Execute (spawn sub-agents for complex work)   │
│      5. LEARN   - Record outcome                                │
│      6. CONTINUE - Check capacity, loop                         │
│  END                                                             │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ spawns fresh agents
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUB-AGENTS (via Task tool)                                      │
│  - Explore, feature-dev, code-reviewer, taskmaster, etc.        │
│  - Fresh instances each time (no context accumulation)          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Difference from Daemon Pattern

The loop runs in the **main agent's response**, not a background task:
- Main agent continuously executes OODA+L cycles
- Sub-agents handle heavy work with fresh context
- Loop continues until context exhaustion or stop signal
- User can add steering via `/cook steer "..."` in a separate window

### Key Files

| File | Purpose |
|------|---------|
| `.claude/cook/steering/inbox.yaml` | Async user input queue |
| `.claude/cook/state/current.yaml` | Loop status and iteration |
| `.claude/cook/autonomy/constitution.yaml` | Rules for autonomous action |

### Steering Types

| Type | Effect |
|------|--------|
| `idea` | Added to candidate actions |
| `priority` | Weights toward this focus |
| `constraint` | Temporary rule |
| `query` | Answered in learning log |
| `stop` | Graceful shutdown |

### Autonomy Levels

| Level | Actions | Threshold |
|-------|---------|-----------|
| Always | Read, search, observe | None |
| High Confidence | Edit code, create files | ≥ 0.8 |
| Never | Delete, push, external mutations | Stops and waits |

### Stop Conditions

1. Steering inbox has `type: stop`
2. Context capacity approaching exhaustion
3. 3 consecutive failures
4. No actionable work (idle)

### Commands

```
/cook              # Start infinite loop (default)
/cook status       # Check state (no loop)
/cook steer "..."  # Add to steering inbox
/cook stop         # Signal shutdown
```
