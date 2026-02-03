# Improve Sub-Skill

## Purpose

Self-modification and capability enhancement. This is what makes the system recursive.

## Improvement Triggers

### From Learning Log
- Recurring failure patterns → Fix root cause
- Low success rates → Analyze and adapt
- Inefficient patterns → Optimize

### From Gap Analysis
- Missing capabilities → Build or acquire
- Outdated knowledge → Refresh
- Weak agents → Strengthen

### From External Input
- User feedback → Incorporate
- New discoveries → Integrate
- Best practices → Adopt

## Improvement Targets

### Tier 1: Constitutional (CLAUDE.md)
Highest impact, highest risk. Changes affect all sessions.

**Examples:**
- Add coordination pattern
- Update plugin architecture guidance
- Codify new convention

**Process:**
1. Identify need with evidence
2. Draft change with rationale
3. Assess blast radius
4. Get explicit user approval
5. Implement with git commit
6. Monitor for issues

### Tier 2: Cook Plugin (Self)
Medium impact. Changes affect cook behavior.

**Examples:**
- Improve orchestration logic
- Add new subskill
- Enhance data structures

**Process:**
1. Identify improvement opportunity
2. Design change
3. Implement
4. Test
5. Document

### Tier 3: Other Agents
Targeted impact. Changes affect specific agents.

**Examples:**
- Adjust agent tools
- Refine agent prompts
- Fix agent bugs

**Process:**
1. Identify underperformance
2. Diagnose root cause
3. Propose fix
4. Implement
5. Validate

### Tier 4: Skills
Knowledge enhancement. Changes improve guidance.

**Examples:**
- Add sub-skill
- Update outdated info
- Improve examples

**Process:**
1. Identify knowledge gap
2. Research solution
3. Write content
4. Integrate into master skill

### Tier 5: Data Structures
Schema evolution. Changes affect data organization.

**Examples:**
- Add field to goal hierarchy
- Extend learning log schema
- New emergence source

**Process:**
1. Identify limitation
2. Design extension (backward compatible)
3. Implement
4. Migrate existing data if needed

## Self-Improvement Protocol

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-IMPROVEMENT LOOP                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ IDENTIFY │───▶│ ANALYZE  │───▶│ PROPOSE  │───▶│IMPLEMENT │  │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘  │
│                                                       │         │
│                  ┌────────────────────────────────────┘         │
│                  ▼                                              │
│             ┌──────────┐                                        │
│             │ VALIDATE │                                        │
│             └──────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Identify
Sources:
- Learning log (adaptations with status=proposed)
- Direct observation
- User requests
- Gap analysis

### Analyze
Questions:
- What exactly is the problem?
- What's the root cause?
- What are the constraints?
- What's the ideal state?

### Propose
Deliverable:
```markdown
## Improvement Proposal

**Target:** {file or component}
**Problem:** {clear description}
**Root Cause:** {analysis}
**Proposed Change:** {specific diff}
**Expected Impact:** {what improves}
**Risks:** {what could go wrong}
**Validation Plan:** {how to verify}
```

### Implement
With approval:
- Make changes via Edit/Write tools
- Follow conventions (commit discipline, etc.)
- Keep changes minimal and focused

### Validate
After implementation:
- Test if possible
- Monitor outcomes
- Record in learning log
- Rollback if needed

## Safety Rails

### Don't:
- Modify without understanding
- Make irreversible changes carelessly
- Change multiple things at once
- Skip validation

### Do:
- Understand before changing
- Prefer small, reversible changes
- One change at a time
- Always validate

## Meta-Improvement

The ultimate recursion: improving the improvement process itself.

Questions to periodically ask:
- Is our improvement process effective?
- Are we catching the right issues?
- Are our changes actually improving things?
- What are we systematically missing?

## Output Format

```yaml
improvement:
  timestamp: "ISO-8601"

  proposal:
    id: imp-{timestamp}
    target: "file or component"
    tier: 1|2|3|4|5
    problem: "..."
    root_cause: "..."
    change: "..."
    expected_impact: "..."
    risks: [...]
    validation_plan: "..."

  status: proposed|approved|implemented|validated|rolled_back

  outcome:
    success: true|false
    notes: "..."
    learnings: [...]
```
