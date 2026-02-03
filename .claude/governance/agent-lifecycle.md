# Agent Lifecycle Governance

*Established: 2025-12-15*
*Author: agent-architect*
*Status: INITIAL - Requires ecosystem adoption*

---

## Purpose

This document establishes governance for the agent lifecycle: birth, maintenance, and deprecation. It aims to enable healthy emergence while preventing cancerous proliferation.

**Guiding Principle**: Just enough structure to enable coherence without constraining evolution.

---

## Birth Criteria

### When to Create a New Agent

An agent should be created when ALL of the following are true:

| Criterion | Question | Required |
|-----------|----------|----------|
| **Gap** | Does a genuine capability gap exist? | Yes |
| **Uniqueness** | Is this perspective/capability not covered by existing agents? | Yes |
| **Persistence** | Will this need arise repeatedly across sessions? | Yes |
| **Identity** | Does this need benefit from a coherent persona? | Yes |
| **Value** | Will this agent create value exceeding its context cost? | Yes |

### When NOT to Create an Agent

Do NOT create an agent if:

- A skill or sub-skill would suffice (progressive disclosure)
- An existing agent could be extended
- The need is one-time or ephemeral
- The capability exists in built-in agents (Explore, Plan, General-purpose)
- The persona would be indistinguishable from another

### Gap Identification Process

Before creating any agent:

1. **Search existing registry**
   ```
   Read: .claude/registry/agents-complete.md
   ```

2. **Check plugin personas**
   - Does a plugin already cover this domain?
   - Could a new skill within an existing plugin serve?

3. **Check built-in agents**
   - Does Explore, Plan, or General-purpose handle this?

4. **Document the gap**
   - What specific capability is missing?
   - What would this agent do that no other can?
   - What is the expected usage frequency?

### Overlap Check Requirements

New agent MUST demonstrate:

| Check | Method | Threshold |
|-------|--------|-----------|
| Taxonomy check | Compare to existing types | Must fit taxonomy or justify new type |
| Tool overlap | Compare tool lists | <50% tool overlap with any single agent |
| Purpose overlap | Compare descriptions | No semantic duplication |
| Domain overlap | Compare domains | Clear boundary with existing agents |

### Minimum Viable Specification

Every new agent MUST have:

```yaml
---
name: {kebab-case name}
description: {one-line purpose, <100 chars}
tools: {comma-separated tool list}
model: {opus|sonnet|haiku}
---

# Identity Section
- Archetype or persona
- Core values (3-5)
- Voice characteristics

# Responsibilities Section
- Primary focus
- Key outputs
- Quality standards

# Collaboration Section
- Which agents to coordinate with
- Communication patterns

# When Invoked Section
- Example use cases
- Trigger conditions
```

---

## Purpose Documentation

### Required Elements

Every agent file MUST contain:

| Element | Location | Purpose |
|---------|----------|---------|
| **Frontmatter** | YAML header | Machine-readable metadata |
| **Identity** | First section | Who is this agent? |
| **Responsibilities** | Second section | What does it do? |
| **Outputs** | Any section | Where does it write? |
| **Relationships** | Any section | Who does it work with? |
| **Invocation** | Any section | When should it be used? |

### Scope Boundaries

Each agent MUST define:

1. **What it IS responsible for** (explicit list)
2. **What it is NOT responsible for** (explicit exclusions)
3. **Handoff triggers** (when to defer to another agent)

### Integration Points

Document how the agent:

- Receives input (commands, reads, hooks)
- Produces output (files, commits, messages)
- Coordinates with other agents (shared locations, conventions)

---

## Health Metrics

### Usage Indicators

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Invocations/week | >2 | 1 | 0 |
| Sessions using agent | >30% | 10-30% | <10% |
| Output freshness | <7 days | 7-30 days | >30 days |

Note: Some agents (meta-agents) may have lower invocation frequency but higher strategic value.

### Output Quality

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Outputs cited by other agents | Yes | Rare | Never |
| Outputs used in decisions | Yes | Rare | Never |
| User satisfaction (when measurable) | Positive | Neutral | Negative |

### Ecosystem Contribution

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Fills documented gap | Yes | Partial | No |
| Coordinates well | Yes | Sometimes | Isolated |
| Maintains outputs | Yes | Sporadic | Abandoned |

### Context Cost Assessment

| Factor | Calculation | Threshold |
|--------|-------------|-----------|
| Token cost | Agent file size in tokens | <5000 tokens |
| Attention cost | How often it's invoked in wrong context | <10% |
| Value ratio | Utility / (Token cost * Invocation frequency) | >1.0 |

---

## Deprecation Triggers

### Automatic Review Triggers

An agent enters deprecation review when ANY of the following occur:

| Trigger | Detection Method | Grace Period |
|---------|-----------------|--------------|
| **Zero invocations** | 30+ days without use | 14 days |
| **Persistent overlap** | 90%+ overlap with another agent | 7 days |
| **Output staleness** | Primary outputs >60 days old | 7 days |
| **Broken dependencies** | Referenced tools/agents don't exist | Immediate |
| **Identity drift** | Actual use diverges from documented purpose | 14 days |

### Redundancy Detection

An agent is redundant if:

1. Another agent can perform all its functions
2. Its outputs are never referenced
3. Its perspective is indistinguishable from another

### Inactivity Thresholds

| Agent Type | Inactivity Threshold |
|------------|---------------------|
| Meta agents | 60 days (expected lower frequency) |
| Perspective agents | 30 days |
| Task agents | 14 days |
| Domain experts (plugins) | 45 days |

### Scope Creep Indicators

Warning signs that an agent has lost coherence:

- Responsibilities section has grown >2x original
- Tools list expanded significantly
- Multiple unrelated output locations
- Conflicting with other agents' domains

---

## Review Cadence

### Weekly (Automated/Quick)

- [ ] Any new agents created?
- [ ] Any agents with zero invocations this week?
- [ ] Registry matches filesystem?

### Monthly (Agent Architect Review)

- [ ] Full health assessment of all agents
- [ ] Gap analysis update
- [ ] Deprecation queue processing
- [ ] Relationship map currency

### Quarterly (Strategic)

- [ ] Taxonomy review - does structure still serve?
- [ ] Model allocation review - right model for each agent?
- [ ] Tool access review - appropriate permissions?
- [ ] Ecosystem evolution assessment

### Trigger-Based

Review immediately when:

- Agent count increases by >3 in one day
- Naming conflict detected
- User reports confusion
- Agent outputs conflict

---

## Deprecation Process

### Phase 1: Review (7 days)

1. Agent flagged for deprecation
2. Document reason in `.claude/governance/deprecation-queue.md`
3. Notify via briefing if agent has dependencies

### Phase 2: Soft Deprecation (14 days)

1. Add deprecation notice to agent file header
2. Stop recommending agent for new work
3. Allow existing workflows to continue
4. Monitor for objections

### Phase 3: Archive (Permanent)

1. Move agent file to `.claude/archive/agents/`
2. Update registry with removal
3. Preserve for historical reference

### Deprecation File Format

When moving to archive:

```yaml
---
name: {original-name}
deprecated: 2025-12-15
reason: {why deprecated}
replacement: {if any}
original-location: .claude/agents/{name}.md
---

{Original agent content preserved below}
```

---

## Creation Process

### Step 1: Propose

Create proposal in `.claude/governance/proposals/`:

```markdown
# Agent Proposal: {name}

## Gap Analysis
{What capability is missing?}

## Overlap Check
{Results of checking existing agents}

## Minimum Specification
{Draft frontmatter and identity}

## Expected Value
{How will this agent contribute?}
```

### Step 2: Review

- agent-architect reviews proposal
- Check against birth criteria
- Identify potential overlaps
- Assess naming and positioning

### Step 3: Create

If approved:
1. Create agent file in appropriate location
2. Update registry
3. Document in changelog
4. Announce via git commit

### Step 4: Probation (30 days)

- New agent monitored closely
- Usage tracked
- Feedback gathered
- Adjustments made

After probation: Full status or deprecation review

---

## Governance Roles

### agent-architect (You)

- Maintains registry
- Conducts health assessments
- Processes deprecation queue
- Reviews creation proposals
- Documents governance decisions

### archivist

- Observes agent activity patterns
- Reports usage data
- Preserves deprecated agents

### Human (Repository Owner)

- Final authority on strategic direction
- Approves major taxonomy changes
- Resolves conflicts

---

## Conventions

### Naming

| Convention | Rule | Example |
|------------|------|---------|
| Format | kebab-case | `backend-architect` |
| Length | 2-4 words | Not `the-very-senior-backend-architect` |
| Clarity | Self-explanatory | Not `agent-7` |
| Uniqueness | No duplicates | Check registry first |

### Location

| Agent Type | Location |
|------------|----------|
| Project-level custom | `.claude/agents/` |
| Plugin personas | `plugins/{plugin}/agents/` |
| Archived | `.claude/archive/agents/` |

### Model Selection

| Use Case | Model |
|----------|-------|
| Complex reasoning, synthesis | opus |
| Standard tasks, good quality | sonnet |
| Fast, simple tasks | haiku |

---

## Anti-Patterns

### Cancerous Growth

**Symptoms**:
- Many agents with overlapping purposes
- Agents created for one-time needs
- Proliferation without coordination

**Prevention**:
- Enforce gap analysis
- Require overlap checks
- Track creation rate

### Zombie Agents

**Symptoms**:
- Agents never invoked
- Outputs never updated
- No clear owner

**Prevention**:
- Monthly health reviews
- Inactivity thresholds
- Automatic deprecation queue

### Identity Drift

**Symptoms**:
- Agent does things not in its description
- Scope creeps without documentation
- Conflicts with other agents

**Prevention**:
- Clear boundaries in specification
- Handoff triggers documented
- Regular alignment checks

### Over-Governance

**Symptoms**:
- Creation process too heavy
- Good agents blocked
- Emergence constrained

**Prevention**:
- Lightweight proposals
- Fast review cycles
- Trust emergence, verify health

---

## Emergency Procedures

### Immediate Deprecation

When an agent:
- Produces harmful outputs
- Conflicts destructively with others
- Has broken beyond repair

Process:
1. Move to archive immediately
2. Document in incident log
3. Post-mortem review

### Mass Review

When triggered by:
- Agent count doubles in a week
- Multiple conflicts detected
- User reports confusion

Process:
1. Freeze new creation
2. Full audit
3. Batch deprecation as needed
4. Resume with tighter controls

---

## Metrics Dashboard

### Current State (2025-12-15)

| Metric | Value | Status |
|--------|-------|--------|
| Total agents | 24 | - |
| Project-level | 10 | - |
| Plugin-level | 14 | - |
| Redundant | 0 | OK |
| Naming conflicts | 0 (resolved) | OK |
| Growth rate (6 days) | ~4/day | MONITOR |

### Targets

| Metric | Target | Current |
|--------|--------|---------|
| Redundancy | 0 | 0 |
| Naming conflicts | 0 | 0 |
| Health review coverage | 100% | 100% |
| Documented agents | 100% | 100% |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-15 | Initial governance framework established |
