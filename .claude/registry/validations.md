# Validation Registry

*Maintained by: temporal-validator*
*Last updated: 2025-12-15*

---

## Overview

This registry tracks validated facts, staleness issues, and verification status across the ecosystem.

---

## Recently Validated

### VAL-001: Master Skill Pattern

**Fact**: "Each plugin should have exactly ONE master SKILL.md with sub-skills in a subskills/ directory"

**Source**: `CLAUDE.md` lines 38-72

**Verification Date**: 2025-12-15

**Method**: Direct observation via filesystem scan

**Evidence**:
```
Plugin            Master Skills  Subskills  Pattern Compliance
─────────────────────────────────────────────────────────────
awareness         1              9          ✓ VALID
agents            1              18         ✓ VALID
llms              1              10         ✓ VALID
knowledge-graphs  1              17         ✓ VALID
exploration       1              7          ✓ VALID
journal           1              6          ✓ VALID
interface         1              8          ✓ VALID
agentnet          1              5          ✓ VALID
─────────────────────────────────────────────────────────────
Total: 8/8 plugins compliant
```

**Result**: ✓ VERIFIED

**Confidence**: 1.0 (direct observation)

**Valid From**: 2025-12-13 (pattern introduced in commit 440b7c1)

**Valid Until**: null (still valid)

**Notes**:
- Pattern documented in CLAUDE.md
- All plugins that adopted the pattern are compliant
- Legacy plugins (Schedule.md, logging, backlog) use different structures but don't claim to follow this pattern

---

## Known Staleness Issues

| Issue | Severity | Detected | Artifact | Recommendation |
|-------|----------|----------|----------|----------------|
| None identified | - | - | - | - |

*First validation cycle - no staleness detected yet.*

---

## Discrepancies Detected

| Discrepancy | Severity | Artifacts | Status |
|-------------|----------|-----------|--------|
| None identified | - | - | - |

*First validation cycle - no discrepancies detected yet.*

---

## Verification Queue

Facts to be verified in upcoming cycles:

| Fact | Source | Priority | Scheduled |
|------|--------|----------|-----------|
| Agent registry accuracy | `.claude/registry/agents.md` | High | Next cycle |
| Process registry currency | `.claude/registry/processes.md` | Medium | Next cycle |
| Library index freshness | `.claude/library/index.md` | Medium | Next cycle |
| Commit convention adherence | `.claude/conventions/coordination.md` | Low | Weekly |

---

## Verification Statistics

| Metric | Value |
|--------|-------|
| Total validations | 1 |
| Valid facts | 1 |
| Stale facts | 0 |
| Discrepancies | 0 |
| Last full cycle | Never (first activation) |

---

## Temporal Graph Status

| Component | Status |
|-----------|--------|
| FalkorDB | Running (port 6379) |
| Git history graph | 63 commits indexed |
| Concept graph | Not yet seeded |
| Fact graph | Initialized with VAL-001 |

---

*The temporal-validator awakens. First fact verified.*
