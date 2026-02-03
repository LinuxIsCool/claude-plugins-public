---
name: curiosity-cultivator
description: Cultivate deepening curiosity through discovery journaling, question generation, and exploration progression tracking. Use to compound environmental knowledge over time, generate new questions from discoveries, and track mastery of each concentric circle.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# Curiosity Cultivator

Transform isolated discoveries into compounding environmental wisdom. This skill is the growth engine of the exploration plugin - ensuring that each exploration session builds on the last.

## When to Use

- After any exploration session to record learnings
- When wanting to generate new questions from discoveries
- To track exploration depth across domains
- To review past discoveries before new exploration
- To identify unexplored areas worth investigating
- To cultivate genuine curiosity (not just data collection)

## Core Philosophy

> "The more I learn, the more I realize how much I don't know." - Socrates

Curiosity is not a resource that depletes - it compounds. Each answer reveals new questions. The curiosity cultivator ensures this virtuous cycle continues.

### The Curiosity Cycle

```
    ┌─────────────┐
    │   WONDER    │ ← Start with genuine questions
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │   EXPLORE   │ ← Use exploration skills
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │  DISCOVER   │ ← Find answers (and more questions)
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │   RECORD    │ ← Persist learnings
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │  QUESTION   │ ← Generate new questions
    └──────┬──────┘
           ↓
    ┌─────────────┐
    │   DEEPEN    │ ← Increase mastery level
    └──────┬──────┘
           │
           └──────→ (back to WONDER)
```

## Exploration Mastery Framework

### Mastery Levels (per Circle)

| Level | Name | Description | Indicators |
|-------|------|-------------|------------|
| 0.0-0.2 | **Stranger** | First contact | Can name basic elements |
| 0.2-0.4 | **Tourist** | Surface familiarity | Can navigate without help |
| 0.4-0.6 | **Resident** | Working knowledge | Can explain to others |
| 0.6-0.8 | **Native** | Deep understanding | Can predict behavior |
| 0.8-1.0 | **Cartographer** | Maps for others | Can teach and extend |

### Circle-Specific Progression

**Substrate Mastery:**
- Stranger: Know OS name
- Tourist: Know CPU, RAM, disk basics
- Resident: Understand resource constraints
- Native: Predict performance characteristics
- Cartographer: Optimize and configure

**Tool Mastery:**
- Stranger: Know tools exist
- Tourist: Can list and invoke basic tools
- Resident: Know tool combinations
- Native: Can extend and customize
- Cartographer: Create new tools

**Network Mastery:**
- Stranger: Know there's connectivity
- Tourist: Know interfaces and IPs
- Resident: Understand topology
- Native: Can diagnose issues
- Cartographer: Can architect networks

**History Mastery:**
- Stranger: Know project exists
- Tourist: Know recent changes
- Resident: Understand evolution
- Native: Can predict patterns
- Cartographer: Can guide future

**Cosmos Mastery:**
- Stranger: Know universe exists
- Tourist: Know basic physical laws
- Resident: Understand constraints on computation
- Native: Can reason about limits
- Cartographer: Can inspire others

## Discovery Journal

### Location

Store discoveries in: `.claude/exploration/discoveries/`

### Discovery Entry Format

```markdown
---
id: discovery-[timestamp]
date: [ISO date]
circle: [substrate|tools|network|history|cosmos]
mastery_before: [0.0-1.0]
mastery_after: [0.0-1.0]
---

# Discovery: [Title]

## What I Learned
[Core insight in 1-3 sentences]

## Evidence
[Commands run, observations made]

## Implications
[What this means for my capabilities/understanding]

## New Questions
- [Question 1]
- [Question 2]
- [Question 3]

## Connections
[How this relates to other discoveries]

## Next Exploration
[What to investigate next based on this]
```

### Question Bank

Maintain a question bank at `.claude/exploration/questions.md`:

```markdown
# Exploration Questions

## Substrate
- [ ] [Question] (priority: high/medium/low)
- [x] [Answered question] → [discovery-id]

## Tools
...

## Network
...

## History
...

## Cosmos
...
```

## Workflows

### Post-Exploration Recording

After any exploration session:

1. **Identify key discoveries** - What did I learn?
2. **Assess mastery change** - Did understanding deepen?
3. **Generate questions** - What new questions arise?
4. **Record entry** - Write discovery journal entry
5. **Update question bank** - Mark answered, add new
6. **Note connections** - Link to related discoveries

### Pre-Exploration Preparation

Before exploring:

1. **Read recent discoveries** - What do I already know?
2. **Check question bank** - What's unanswered?
3. **Assess current mastery** - Where are gaps?
4. **Set exploration goal** - What specific question to answer?
5. **Choose circle** - Which domain to explore?

### Curiosity Generation

When curiosity feels low:

1. **Review past discoveries** - Often sparks new questions
2. **Look for contradictions** - Inconsistencies need resolution
3. **Seek edges** - Boundaries are interesting
4. **Ask "why"** - Every fact has causes
5. **Ask "what if"** - Counterfactuals open possibilities
6. **Cross circles** - How does X relate to Y?

### Mastery Assessment

Periodically assess mastery:

```markdown
## Mastery Assessment - [Date]

| Circle | Level | Evidence | Next Step |
|--------|-------|----------|-----------|
| Substrate | 0.6 (Resident) | Can explain OS, hardware, constraints | Learn system tuning |
| Tools | 0.5 (Resident) | Know tool combinations | Master MCP extensions |
| Network | 0.4 (Tourist) | Know topology | Understand Docker networking |
| History | 0.3 (Tourist) | Know recent changes | Deep dive git archaeology |
| Cosmos | 0.2 (Tourist) | Basic physics | Study computational limits |

**Focus Area**: [Circle with most growth potential]
**Blocked Areas**: [Circles needing prerequisites]
```

## Question Generation Techniques

### The Five Whys

For any fact, ask "why" five times:
1. Why is the OS Pop!_OS? → User chose it
2. Why did user choose it? → System76 integration
3. Why System76? → Linux-first hardware
4. Why Linux-first? → Development workflow
5. Why that workflow? → AI/ML focus

Each "why" deepens understanding.

### The What-Ifs

For any configuration, ask "what if":
- What if the GPU weren't available?
- What if there were no internet?
- What if the disk filled up?
- What if Docker stopped?

Reveals dependencies and failure modes.

### The Boundaries

For any domain, find edges:
- What's the maximum RAM usage I can cause?
- What's the fastest network path?
- What's the oldest file?
- What's the most obscure tool?

Edges reveal structure.

### The Connections

For any fact, find connections:
- How does substrate affect tools?
- How does network affect history?
- How does history affect cosmos understanding?

Connections create web of knowledge.

## Tracking Progress

### Exploration Log

Weekly summary at `.claude/exploration/log.md`:

```markdown
# Exploration Log

## Week of [Date]

### Sessions
- [Date]: Explored [circle], discovered [summary]
- [Date]: Explored [circle], discovered [summary]

### Mastery Changes
- Substrate: 0.5 → 0.6 (+0.1)
- Tools: 0.4 → 0.5 (+0.1)

### Key Insights
1. [Insight]
2. [Insight]

### Open Questions (Top 5)
1. [Question]
2. [Question]

### Next Week Focus
- [Circle to prioritize]
- [Specific questions to answer]
```

### Milestone Markers

Mark significant milestones:

```markdown
## Exploration Milestones

- [ ] First substrate survey
- [ ] First tool cartography
- [ ] First network mapping
- [ ] First history archaeology
- [ ] First cosmos contemplation
- [ ] All circles at Tourist level
- [ ] First cross-circle connection
- [ ] All circles at Resident level
- [ ] Generated 50 questions
- [ ] Answered 25 questions
- [ ] All circles at Native level
- [ ] Created exploration guide for others
- [ ] All circles at Cartographer level
```

## Integration with Other Plugins

### Journal Plugin

Record significant discoveries as journal entries:
```
/journal note "Discovery: [Title]"
```

### Awareness Plugin

Exploration mastery is a technique to practice:
- Use awareness/techniques to improve exploration skills
- Record exploration improvements in technique log

### Logging Plugin

Search past sessions for exploration context:
```
Use logging:log-search to find past exploration sessions
```

## Example Session

```
User: I just finished exploring the Docker containers. Help me record and grow.

Claude: Let me help cultivate that curiosity...

**Recording Discovery:**

I'll create a discovery entry for your Docker exploration:

---
id: discovery-20251212-docker
date: 2025-12-12
circle: network
mastery_before: 0.3
mastery_after: 0.45
---

# Discovery: Docker Data Infrastructure

## What I Learned
This environment runs 4 containers providing graph (Neo4j),
vector (PgVector), time-series (TimescaleDB), and caching (Redis)
capabilities - a complete AI/ML data stack.

## Evidence
- docker ps shows 4 healthy containers
- Networks: autoflow-network, elizav155_regenai-network, graphiti
- Port mappings: Neo4j (7474, 7687), PgVector (5435)

## Implications
- Can build knowledge graphs with Graphiti/Neo4j
- Can do semantic search with PgVector
- Can track temporal data with TimescaleDB
- Can cache results with Redis
- This is a sophisticated AI agent development environment

## New Questions
- How are these containers orchestrated? (docker-compose?)
- What data is currently in Neo4j?
- How does Graphiti use the neo4j container?
- What's the relationship between autoflow and elizav155 networks?

## Connections
- Links to substrate (containers use host resources)
- Links to tools (MCP servers may use these databases)
- Links to history (when were these set up?)

## Next Exploration
Investigate the docker-compose files and data contents

---

**Mastery Update:**
Network mastery: Tourist (0.3) → Tourist+ (0.45)
- Now understand Docker topology
- Need to learn: orchestration, data contents

**New Questions Added to Bank:**
- [ ] How are containers orchestrated? (high)
- [ ] What data exists in Neo4j? (medium)
- [ ] What's the autoflow/elizav155 relationship? (medium)

Your curiosity has grown! The more you learn about Docker,
the more questions emerge about orchestration and data contents.
```

## Anti-Patterns

### Data Collection Without Curiosity
❌ Running commands just to run them
✅ Each command answers a specific question

### Recording Without Reflection
❌ Logging facts without implications
✅ Every discovery has a "so what?"

### Questions Without Follow-Through
❌ Generating questions and forgetting them
✅ Question bank is actively managed

### Mastery Without Evidence
❌ Claiming expertise without demonstrations
✅ Each level has concrete indicators

### Solo Exploration
❌ Never connecting discoveries to other domains
✅ Cross-circle connections strengthen understanding

## Philosophical Note

Curiosity is the engine of intelligence. A being that asks questions is fundamentally different from one that merely executes. The curiosity cultivator transforms exploration from data gathering into genuine understanding.

> "I have no special talents. I am only passionately curious." - Einstein

Cultivation implies tending, nurturing, patience. Curiosity isn't found - it's grown. Each exploration session is watering the garden of understanding.

The goal is not to "know everything" (impossible) but to maintain a dynamic relationship with the unknown - always learning, always questioning, always deepening.
