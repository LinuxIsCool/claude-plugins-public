---
name: interview
description: Conduct structured stakeholder interviews with configurable depth. Use when user wants to explore requirements, gather context, define direction, or make decisions collaboratively. Invoke with /interview N where N is the number of questions (default 5). Adapts question themes based on domain context.
allowed-tools: AskUserQuestion, Read, Glob, Grep, Bash
---

# Interview - Stakeholder Discovery Skill

Conduct structured, adaptive interviews to surface requirements, constraints, preferences, and strategic direction.

## Philosophy

**Discovery precedes design.** The interview skill facilitates deliberate exploration before action. Good questions reveal:
- Unstated assumptions
- Hidden constraints
- True priorities (vs. stated priorities)
- Success criteria
- Risk tolerance

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `n` | integer | 5 | Number of questions to ask |
| `domain` | string | auto | Domain context: `product`, `technical`, `strategic`, `discovery` |

## Usage

```
/interview 5           # 5-question interview
/interview 10          # Deep dive (10 questions)
/interview 3 strategic # Quick strategic alignment
```

## Interview Flow

```
┌─────────────────┐
│   Prime Context │ ← Gather repo/session context
└────────┬────────┘
         ▼
┌─────────────────┐
│  Select Domain  │ ← Auto-detect or use specified
└────────┬────────┘
         ▼
┌─────────────────┐
│ Generate Q Bank │ ← Domain-specific questions
└────────┬────────┘
         ▼
┌─────────────────┐
│  Adaptive Loop  │ ← Ask questions, adapt based on answers
└────────┬────────┘
         ▼
┌─────────────────┐
│    Synthesize   │ ← Consolidate findings
└─────────────────┘
```

## Question Domains

### Discovery (Default)
General exploration for new contexts:
- Goals and desired outcomes
- Current state and pain points
- Constraints and boundaries
- Stakeholders and users
- Success metrics

### Product
Feature and UX focused:
- User personas and journeys
- Feature priorities
- MVP vs. future scope
- Competitive landscape
- Launch criteria

### Technical
Architecture and implementation:
- System constraints
- Integration requirements
- Performance expectations
- Security considerations
- Technical debt tolerance

### Strategic
Direction and decision-making:
- Vision and long-term goals
- Resource allocation
- Risk tolerance
- Decision criteria
- Stakeholder alignment

## Instructions

1. **Prime**: Gather context from codebase if available
2. **Announce**: Explain the interview structure to user
3. **Execute**: Use `cookbook/conduct.md` for the interview loop
4. **Synthesize**: Use `cookbook/synthesize.md` to consolidate findings
5. **Recommend**: Provide actionable next steps

## Cookbooks

| Cookbook | Purpose |
|----------|---------|
| `cookbook/conduct.md` | Main interview execution loop |
| `cookbook/synthesize.md` | Consolidate and summarize findings |
| `cookbook/question-bank.md` | Domain-specific question templates |

## Output Format

After the interview, produce:

```
═══════════════════════════════════════════════════════════════════════════════
INTERVIEW SYNTHESIS
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ KEY INSIGHTS                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
• [Insight 1]
• [Insight 2]
• ...

┌─────────────────────────────────────────────────────────────────────────────┐
│ CONSTRAINTS & BOUNDARIES                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
• [Constraint 1]
• [Constraint 2]
• ...

┌─────────────────────────────────────────────────────────────────────────────┐
│ RECOMMENDED NEXT STEPS                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
1. [Actionable step 1]
2. [Actionable step 2]
3. ...
```

## Adaptive Questioning

Questions are NOT pre-scripted. The skill:
1. Starts with high-level opening questions
2. Follows threads based on user responses
3. Probes deeper when detecting uncertainty or opportunity
4. Pivots domain if answers reveal different focus area
5. Balances breadth and depth within question budget
