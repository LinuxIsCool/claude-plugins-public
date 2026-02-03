# Agent Deprecation Queue

*Maintained by: agent-architect*
*Last updated: 2025-12-15*

---

## Active Deprecations

*None currently.*

---

## Deprecation Log

### 2025-12-15: Initial Audit

During the initial governance audit, a file `.claude/agents/awareness:mentor.md` was reported in the first glob scan, but subsequent verification showed it does not exist. This was likely a caching artifact or filesystem ghost.

**Outcome**: No actual deprecation required.

---

## Completed Deprecations

*None.*

---

## Notes

Deprecation queue follows the process defined in `.claude/governance/agent-lifecycle.md`:

1. **Phase 1: Review** (7 days) - Flag and document
2. **Phase 2: Soft Deprecation** (14 days) - Add notice, stop recommending
3. **Phase 3: Archive** (Permanent) - Move to archive, preserve history

For clear redundancies (exact duplicates), skip directly to Phase 3.
