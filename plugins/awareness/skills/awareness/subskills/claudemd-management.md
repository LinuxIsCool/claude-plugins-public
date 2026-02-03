---
sub-skill: claudemd-management
parent: awareness
created: 2026-01-08
description: Managing CLAUDE.md evolution through validation, versioning, and A/B experiments
---

# CLAUDE.md Management Sub-Skill

Managing the evolution of CLAUDE.md through validation, versioning, and data-driven iteration.

## Overview

CLAUDE.md is the **enforcement layer + knowledge map** for the ecosystem. Every word loads in every session—changes have multiplicative impact. This sub-skill provides infrastructure for intentional, measurable CLAUDE.md evolution.

## Philosophy

CLAUDE.md is NOT minimized content. It is:
- **Enforcement layer**: "BEFORE X, READ Y" rules ensure agents have context
- **Knowledge map**: Routes to deeper documentation
- **Identity anchor**: Ecosystem values, prohibitions, personality
- **Context multiplier**: Budget every word carefully

## Workspace Location

```
.claude/claudemd/
├── README.md               # Full documentation
├── versions/               # Version registry
├── experiments/            # A/B testing
├── analysis/               # Metrics extraction
├── validation/             # Validation scripts
└── state/                  # Current state tracking
```

## Core Workflows

### 1. Validating CLAUDE.md

Run validation before any change:

```bash
python .claude/claudemd/validation/validate.py CLAUDE.md
```

**Validators run:**
| Validator | What It Checks |
|-----------|----------------|
| `word_count` | Total words against 800-1200 target |
| `reference_integrity` | Referenced files exist |
| `agent_listing` | Agent coverage (informational) |
| `prohibited_patterns` | Hardcoded data, stale dates |
| `required_sections` | Coordination, ecosystem, journal, plugin |
| `enforcement_rules` | BEFORE/READ patterns |
| `style` | Imperative language, avoid softeners |

**Interpreting Results:**
- PASS/FAIL per validator
- Metrics (word count, coverage percentages)
- Issues with severity (ERROR, WARNING, INFO)
- Suggestions for fixes

### 2. Creating a New Version

When making significant CLAUDE.md changes:

```bash
# 1. Copy current to versions/
cp CLAUDE.md .claude/claudemd/versions/v001-description.md

# 2. Create metadata
cat > .claude/claudemd/versions/v001-description.yaml << 'EOF'
version: v001
name: description
created: 2026-01-08T14:00:00
author: agent-name
parent: v000-baseline
changes:
  - Description of change 1
  - Description of change 2
word_count: 1050
hypothesis: "What improvement do you expect?"
EOF

# 3. Update state
# Edit .claude/claudemd/state/active.yaml
```

**Version naming**: `v{NNN}-{kebab-case-description}.md`

### 3. Running A/B Experiments

For data-driven CLAUDE.md improvements:

**Step 1: Design Experiment**
```yaml
# .claude/claudemd/experiments/exp-001-preamble.yaml
id: exp-001
name: preamble-test
hypothesis: "Adding identity preamble improves agent coherence"
status: active

versions:
  control: v000-baseline
  treatment: v001-add-preamble

metrics:
  primary: session_coherence
  secondary: [error_rate, agent_invocation_count]
```

**Step 2: Collect Data**
Run sessions with each version. Metrics auto-collected in `.claude/logging/`.

**Step 3: Analyze Results**
```bash
python .claude/claudemd/analysis/extract_metrics.py --days 7 --output metrics.yaml
```

**Step 4: Conclude**
Update experiment with results and decision.

### 4. Extracting Session Metrics

```bash
# Last 7 days, aggregate only
python .claude/claudemd/analysis/extract_metrics.py --days 7 --aggregate-only

# Full session details
python .claude/claudemd/analysis/extract_metrics.py --days 14 --output report.yaml

# Specific session
python .claude/claudemd/analysis/extract_metrics.py --session abc123
```

**Metrics available:**
- Session duration
- Tool usage frequency
- Agent invocations
- Error rate
- Todo completion signals
- CLAUDE.md version correlation

## Rules Configuration

Validation rules in `.claude/claudemd/validation/rules.yaml`:

```yaml
word_count:
  warning_threshold: 1500
  error_threshold: 3000
  target_range: [800, 1200]

required_sections:
  - coordination
  - ecosystem orientation
  - journal entries
  - plugin architecture

prohibited_patterns:
  - pattern: '\d+ agents'
    message: "Avoid hardcoded agent counts"
```

Customize thresholds and patterns as ecosystem evolves.

## Best Practices

### Content Guidelines

**DO include in CLAUDE.md:**
- Identity/philosophy preamble (50-100 words)
- Absolute prohibitions (no truncation, no mock data)
- Enforcement rules (BEFORE X, READ Y)
- Quick-start routes to key documents
- Plugin/agent/skill architecture essentials

**DON'T include:**
- Hardcoded counts (agents, skills, plugins)
- Specific dates in prose
- Content that belongs in referenced docs
- Redundant information

### Version Control

- Create version for every significant change
- Document hypothesis behind changes
- Run validation before and after changes
- Link changes to sessions/experiments

### Experiment Design

- Define clear hypothesis
- Choose measurable metrics
- Run sufficient sessions per version
- Document conclusions and rationale

## Quick Commands

```bash
# Validate current CLAUDE.md
python .claude/claudemd/validation/validate.py CLAUDE.md

# List versions
ls -la .claude/claudemd/versions/

# Check active version
cat .claude/claudemd/state/active.yaml

# Extract metrics
python .claude/claudemd/analysis/extract_metrics.py --days 7 --aggregate-only

# View validation rules
cat .claude/claudemd/validation/rules.yaml
```

## Enforcement Patterns

CLAUDE.md should enforce context acquisition through patterns like:

```markdown
**BEFORE creating journal entries**, read:
`plugins/journal/skills/journal-master/subskills/journal-writer.md`

**BEFORE developing plugins**, read:
- Plugin structure skill: `/plugin-dev:plugin-structure`
- Hook development skill: `/plugin-dev:hook-development`

**BEFORE creating agents**, read:
- Agent creation skill in awareness plugin
- `.claude/registry/agents.md` for existing patterns
```

This ensures agents acquire context before action—content removed from CLAUDE.md isn't lost if enforcement routes agents to it.

## Integration Points

| Component | Role |
|-----------|------|
| `awareness:style` agent | Reviews CLAUDE.md changes for tone/identity |
| `cook:self-improver` agent | Proposes CLAUDE.md improvements |
| `archivist` agent | Tracks CLAUDE.md as ecosystem artifact |
| `temporal-validator` agent | Checks for staleness in CLAUDE.md |

## Troubleshooting

**Validation shows many path warnings?**
The reference integrity check may flag paths in code examples. Review warnings—code block examples are false positives.

**Word count too high?**
Extract detailed content to referenced documents. CLAUDE.md should route, not store.

**Experiments inconclusive?**
May need more sessions per version, clearer hypothesis, or more discriminating metrics.

## See Also

- `.claude/claudemd/README.md` - Full workspace documentation
- `.claude/planning/2025-12-13-fusion.md` - Vision for CLAUDE.md
- `.claude/planning/2025-12-24-2026-strategy-roadmap.md` - Roadmap context
- `awareness:style` agent - For identity/tone review
