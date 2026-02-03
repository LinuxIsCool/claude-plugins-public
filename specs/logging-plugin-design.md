# Logging Plugin Design Document

**Version 0.4.0** | **Status: Production Ready**

---

## Vision

The Logging Plugin serves as Claude Code's institutional memory—a complete, searchable archive of every conversation, decision, and discovery made across sessions. Where other systems truncate to save space, we preserve everything. Where others summarize and lose nuance, we maintain full fidelity. This is memory that compounds.

## The Problem

Developers working with Claude Code accumulate tremendous value in their conversations: debugging sessions reveal root causes, architectural discussions crystallize patterns, and exploratory dialogues surface insights. Yet when a session ends, this knowledge dissipates. Teams find themselves re-solving problems, re-explaining context, and losing the thread of long-running projects.

The fundamental issue isn't technical—it's philosophical. Most logging systems treat data as expendable, truncating "for performance" or summarizing "for clarity." Each compromise silently destroys information that might prove essential tomorrow.

## Our Solution

The Logging Plugin captures every interaction as an append-only event stream in JSONL format, simultaneously generating human-readable Markdown reports with AI-summarized exchanges. A pure-Python BM25 search engine indexes this history, enabling natural queries like "What did we discuss about authentication?" or "Find our debugging sessions from last week."

The architecture follows a simple principle: **JSONL is the source of truth; everything else derives from it.** Markdown reports can be regenerated. Search indexes can be rebuilt. The event log itself is immutable.

## Architecture Overview

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Capture** | 10 Hook Events | Intercept all interaction types: prompts, responses, tool use, subagents |
| **Storage** | Append-Only JSONL | Immutable event stream, one JSON object per line, organized by date |
| **Presentation** | Live Markdown | Human-readable reports regenerated on each key event |
| **Intelligence** | AI Summaries | 2-7 word Haiku-generated summaries for rapid scanning, cached to avoid API costs |
| **Retrieval** | BM25 Search | Zero-dependency keyword search with filtering, highlighting, and conversation pairing |

## Design Philosophy

Three principles guide every implementation decision.

**Never truncate data.** Storage is cheap; lost context is expensive. The logging system captures full tool inputs, complete responses, and entire subagent transcripts. If a user needs to understand what happened six months ago, the answer exists in complete form.

**Lazy over eager.** Logging happens on every event—it must be fast. Search happens on explicit request—it can be slower. Therefore, we build indexes at query time rather than write time. The first search is slower, but logging never blocks.

**Graceful degradation.** The plugin works without an API key (no summaries), without embeddings (BM25 suffices), and without external tools (CLI search is complete). Each layer adds value independently; no single dependency can break the system.

## Current Capabilities

The plugin delivers complete logging infrastructure with mature search capabilities. Every hook event in Claude Code is captured—from session lifecycle through tool execution to subagent interactions. The search system supports type filtering (find only user prompts or only responses), date ranges (natural language like "yesterday" or ISO dates), session isolation (browse a specific conversation), and conversation pairing (see prompts with their responses together).

| Feature Area | Completion | Notes |
|--------------|------------|-------|
| Event Capture | 100% | All 10 hook types implemented |
| JSONL Storage | 100% | Append-only, date-organized |
| Markdown Reports | 100% | Live regeneration, collapsible sections |
| AI Summaries | 100% | Haiku-powered, cached |
| BM25 Search | 100% | Full-featured keyword search |
| Semantic Search | 80% | Implemented, requires optional numpy |

## Roadmap to 100%

Two enhancements would complete the vision:

- **Semantic search promotion**: Currently optional due to numpy dependency. Making embeddings work zero-dependency (or documenting the tradeoff clearly) would unlock conceptual search for all users.
- **Archival strategy**: As log directories grow, a principled approach to cold storage—compression, summarization of ancient sessions, migration to separate storage—would ensure the system scales gracefully over years.

## Integration Points

The Logging Plugin is foundational infrastructure. The Awareness plugin draws on it for reflection. The Journal plugin synthesizes patterns from it. Knowledge graphs can be populated from its event streams. Any component that needs to answer "what happened?" starts here.

The plugin exposes three interfaces: direct Python tool invocation for scripts, a `/log-search` skill for natural language queries, and an Archivist persona for guided historical exploration. A single `/logging obsidian` command opens the entire archive as an Obsidian vault for visual exploration.

---

*The complete technical specification, including JSONL schemas, BM25 algorithm parameters, and detailed commit history, is available in `specs/logging-plugin-spec.md`.*
