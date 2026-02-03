# Logging Plugin Requirements Document

**Version 0.4.0** | **Last Updated: 2026-01-10**

---

## Overview

This document enumerates all functional and non-functional requirements for the Logging Plugin. Each requirement includes a unique identifier, description, user story, priority level, current status, and acceptance criteria. Requirements are organized hierarchically by feature area.

**Legend:**
- **Priority**: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
- **Status**: ✅ Complete, 🔄 In Progress, 📋 Planned, ⏸️ Deferred

---

## Requirements Matrix

| ID | Requirement | User Story | Priority | Status | Acceptance Criteria |
|----|-------------|------------|----------|--------|---------------------|
| **1.0** | **Event Capture System** | | | | |
| 1.1 | SessionStart hook capture | As a user, I want session starts logged so that I can track when conversations begin | P0 | ✅ Complete | Event written to JSONL with timestamp and session_id |
| 1.2 | SessionEnd hook capture | As a user, I want session ends logged so that I can see conversation boundaries | P0 | ✅ Complete | Event includes duration and final state |
| 1.3 | UserPromptSubmit capture | As a user, I want my prompts recorded so that I can search my questions later | P0 | ✅ Complete | Full prompt text preserved without truncation |
| 1.4 | AssistantResponse capture | As a user, I want Claude's responses logged so that I can recall solutions | P0 | ✅ Complete | Response extracted from transcript, full text preserved |
| 1.5 | PreToolUse capture | As a developer, I want tool invocations logged so that I can audit what actions were taken | P1 | ✅ Complete | Tool name and full input parameters captured |
| 1.6 | PostToolUse capture | As a developer, I want tool results logged so that I can debug tool failures | P1 | ✅ Complete | Tool output captured without truncation |
| 1.7 | SubagentStop capture | As a user, I want subagent interactions logged so that I can review delegated work | P1 | ✅ Complete | Model, tools used, prompt, and full response captured |
| 1.8 | Notification capture | As a user, I want system notifications logged so that I have complete session context | P2 | ✅ Complete | Notification text and timestamp recorded |
| 1.9 | PermissionRequest capture | As a security auditor, I want permission requests logged so that I can review access patterns | P2 | ✅ Complete | Permission type and timestamp recorded |
| 1.10 | PreCompact capture | As a developer, I want context compactions logged so that I can track conversation continuity | P2 | ✅ Complete | Compaction event marks agent_session_num increment |
| **2.0** | **JSONL Storage Layer** | | | | |
| 2.1 | Append-only writes | As a data steward, I want immutable logs so that history cannot be accidentally modified | P0 | ✅ Complete | File opened in append mode ('a'), never rewritten |
| 2.2 | Date-based directory structure | As a user, I want logs organized by date so that I can find specific time periods | P0 | ✅ Complete | Path format: `.claude/logging/YYYY/MM/DD/` |
| 2.3 | Session-prefixed filenames | As a user, I want sessions identifiable by filename so that I can quickly locate conversations | P1 | ✅ Complete | Format: `HH-MM-SS-{session-id-prefix}.jsonl` |
| 2.4 | Complete event schema | As a developer, I want consistent event structure so that parsing is reliable | P0 | ✅ Complete | Each event has type, ts, session_id, data, agent_session_num |
| 2.5 | No data truncation | As a user, I want full content preserved so that I never lose important context | P0 | ✅ Complete | No character limits on any field; full responses stored |
| 2.6 | Graceful error handling | As a user, I want logging failures to be silent so that my work is not interrupted | P1 | ✅ Complete | Exceptions caught; logging never blocks user interaction |
| **3.0** | **Markdown Report Generation** | | | | |
| 3.1 | Live report updates | As a user, I want reports updated in real-time so that I can view sessions while running | P0 | ✅ Complete | Markdown regenerated on UserPromptSubmit, AssistantResponse, Stop |
| 3.2 | Conversation format | As a user, I want reports as conversations so that they read naturally | P1 | ✅ Complete | User/Claude exchanges clearly delineated with headers |
| 3.3 | Emoji timeline markers | As a user, I want visual cues so that I can scan reports quickly | P2 | ✅ Complete | 10 distinct emojis for event types (💫🍄🌲🔨🏰🔵⭐♻🔑🟡) |
| 3.4 | Collapsible sections | As a user, I want long content foldable so that reports remain scannable | P1 | ✅ Complete | `<details>` tags for responses, tool details, subagents |
| 3.5 | Timestamp on every line | As a user, I want precise timing so that I can correlate events | P2 | ✅ Complete | Format: `HH:MM:SS` prefix on all entries |
| 3.6 | Tool aggregation | As a user, I want tools grouped per exchange so that I see what was used together | P2 | ✅ Complete | "N tools: Read, Edit, Bash" summary with expandable details |
| **4.0** | **AI Summary System** | | | | |
| 4.1 | Exchange summaries | As a user, I want brief descriptions so that I can scan session content | P1 | ✅ Complete | 2-7 word Haiku-generated summary per exchange |
| 4.2 | Summary caching | As a cost-conscious user, I want summaries cached so that API calls aren't repeated | P1 | ✅ Complete | `.cache.json` stores hash→summary mappings |
| 4.3 | Graceful degradation | As a user without API key, I want logging to work so that core function is preserved | P0 | ✅ Complete | Missing API key skips summaries; logging continues |
| 4.4 | Lazy Anthropic import | As a user, I want fast hook execution so that my workflow isn't slowed | P2 | ✅ Complete | Anthropic library imported only when summary needed |
| **5.0** | **BM25 Search Engine** | | | | |
| 5.1 | Keyword search | As a user, I want to search by terms so that I can find relevant conversations | P0 | ✅ Complete | BM25 ranking with k1=1.5, b=0.75 parameters |
| 5.2 | Type filtering | As a user, I want to filter by event type so that I can find prompts vs responses | P1 | ✅ Complete | `--type UserPromptSubmit` or `--type AssistantResponse` |
| 5.3 | Date range filtering | As a user, I want to search time periods so that I can find recent or historical content | P1 | ✅ Complete | `--from today`, `--to 2025-12-01` natural language + ISO |
| 5.4 | Session filtering | As a user, I want to browse specific sessions so that I can review one conversation | P1 | ✅ Complete | `--session {id-prefix}` filters to single session |
| 5.5 | Result highlighting | As a user, I want matches highlighted so that I can see why results matched | P2 | ✅ Complete | `--highlight` marks matching terms in output |
| 5.6 | Conversation pairs | As a user, I want prompt+response together so that I see complete exchanges | P1 | ✅ Complete | `--pairs` returns UserPromptSubmit with its AssistantResponse |
| 5.7 | Full content mode | As a user, I want complete text when needed so that I don't miss context | P2 | ✅ Complete | `--full` disables snippet truncation in results |
| 5.8 | Statistics mode | As a user, I want log metrics so that I can understand my usage patterns | P2 | ✅ Complete | `--stats` shows event counts, date ranges, session count |
| 5.9 | JSON output format | As a developer, I want structured output so that I can pipe to other tools | P1 | ✅ Complete | `--format json` returns machine-parseable results |
| 5.10 | Text output format | As a user, I want readable output so that I can review in terminal | P1 | ✅ Complete | `--format text` returns human-friendly summaries |
| 5.11 | Stopword filtering | As a user, I want relevant results so that common words don't pollute search | P2 | ✅ Complete | 58 English stopwords removed from indexing |
| 5.12 | Zero dependencies | As a user, I want immediate functionality so that I don't need to install packages | P0 | ✅ Complete | Pure Python implementation, no external libraries |
| **6.0** | **Semantic Search** | | | | |
| 6.1 | Embedding-based search | As a user, I want conceptual matching so that I can find related content by meaning | P2 | ✅ Complete | `--semantic` enables hybrid BM25+embedding scoring |
| 6.2 | Hybrid scoring | As a user, I want best of both approaches so that keyword and meaning combine | P2 | ✅ Complete | Normalized BM25 + cosine similarity weighted average |
| 6.3 | Fallback embeddings | As a user without sentence-transformers, I want search to work so that semantic is optional | P1 | ✅ Complete | Falls back to simple embedding if library unavailable |
| 6.4 | Zero-dependency semantic | As a user, I want semantic search without numpy so that it works everywhere | P2 | 📋 Planned | Implement pure-Python cosine similarity |
| **7.0** | **Integration & Interfaces** | | | | |
| 7.1 | Obsidian command | As a user, I want visual exploration so that I can use graph view on my logs | P2 | ✅ Complete | `/logging obsidian` opens logs directory as vault |
| 7.2 | log-search skill | As a user, I want natural language search so that I can query conversationally | P1 | ✅ Complete | Skill with full parameter documentation and examples |
| 7.3 | Archivist persona | As a user, I want guided exploration so that I can ask questions about history | P2 | ✅ Complete | `logging:archivist` subagent available via Task tool |
| 7.4 | Plugin manifest | As a developer, I want proper registration so that hooks auto-configure | P0 | ✅ Complete | `plugin.json` with all 10 hooks, skills, commands, agents |
| **8.0** | **Performance & Reliability** | | | | |
| 8.1 | Sub-100ms hook execution | As a user, I want logging invisible so that my workflow isn't delayed | P0 | ✅ Complete | Append-only writes, lazy imports, silent failures |
| 8.2 | Lazy index building | As a user, I want fast logging so that search cost is paid at query time | P1 | ✅ Complete | Index built on search, not on log write |
| 8.3 | Large corpus handling | As a power user, I want search to scale so that months of logs remain searchable | P1 | ✅ Complete | BM25 handles thousands of documents efficiently |
| **9.0** | **Future: Archival & Scale** | | | | |
| 9.1 | Cold storage migration | As a long-term user, I want old logs archived so that active storage stays fast | P3 | 📋 Planned | Move logs older than N days to compressed archive |
| 9.2 | Session summarization | As a user, I want old sessions condensed so that I keep insights without bulk | P3 | 📋 Planned | Generate session summary before archival |
| 9.3 | Storage compression | As a user, I want disk space managed so that logs don't grow unbounded | P3 | 📋 Planned | GZIP compression for archived JSONL files |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Requirements | 42 |
| Complete (✅) | 38 |
| In Progress (🔄) | 0 |
| Planned (📋) | 4 |
| Deferred (⏸️) | 0 |
| **Completion Rate** | **90.5%** |

---

## Burndown by Feature Area

| Feature Area | Total | Complete | Remaining | % Done |
|--------------|-------|----------|-----------|--------|
| Event Capture (1.x) | 10 | 10 | 0 | 100% |
| JSONL Storage (2.x) | 6 | 6 | 0 | 100% |
| Markdown Reports (3.x) | 6 | 6 | 0 | 100% |
| AI Summaries (4.x) | 4 | 4 | 0 | 100% |
| BM25 Search (5.x) | 12 | 12 | 0 | 100% |
| Semantic Search (6.x) | 4 | 3 | 1 | 75% |
| Integration (7.x) | 4 | 4 | 0 | 100% |
| Performance (8.x) | 3 | 3 | 0 | 100% |
| Archival (9.x) | 3 | 0 | 3 | 0% |
| **Total** | **42** | **38** | **4** | **90.5%** |

---

## Priority Distribution

| Priority | Count | Complete | Completion |
|----------|-------|----------|------------|
| P0 (Critical) | 10 | 10 | 100% |
| P1 (High) | 15 | 15 | 100% |
| P2 (Medium) | 14 | 13 | 93% |
| P3 (Low) | 3 | 0 | 0% |

---

## Next Sprint Recommendations

The four remaining requirements fall into two categories:

**Quick Win (1 requirement):**
- **6.4 Zero-dependency semantic**: Implement pure-Python cosine similarity to remove numpy requirement. Estimated: 2-4 hours.

**Strategic Investment (3 requirements):**
- **9.1-9.3 Archival system**: Design and implement cold storage, summarization, and compression. Estimated: 1-2 sprints. Consider deferring until log volume becomes a user-reported issue.

---

*For implementation details and code-level specifications, see `specs/logging-plugin-spec.md`.*
