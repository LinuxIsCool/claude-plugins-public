---
name: log-search
description: Search conversation history for past discussions, decisions, and context. Use when you need to recall what was discussed about a topic, find previous solutions, retrieve historical context from past sessions, answer "What did we discuss about X?", get log statistics, or browse specific sessions.
allowed-tools: Bash, Read
---

# Log Search Skill

Search through conversation history to recall past discussions, decisions, and context.

## When to Use

- "What did we discuss about authentication?"
- "Find our previous conversation about the database"
- "When did we work on the refactoring?"
- "What solutions did we try for that bug?"
- "Show me today's conversations"
- "What happened in the last session?"
- "How many sessions have we had?"
- "Find similar discussions about this topic"

## Commands

### Basic Search

```bash
uv run plugins/logging/tools/search_logs.py "your query"
```

### Get Statistics

```bash
uv run plugins/logging/tools/search_logs.py --stats --format text
```

Output:
```
Log Statistics
==================================================
Location: .claude/logging
Total Size: 4.8 MB
Log Files: 21

Date Range: 2025-12-08 to 2025-12-11
Sessions: 21

User Prompts: 58
Assistant Responses: 44
Total Events: 1476
```

### Date Filtering

```bash
# Today's conversations only
uv run plugins/logging/tools/search_logs.py "query" --from today

# Yesterday
uv run plugins/logging/tools/search_logs.py "query" --from yesterday

# Last 7 days
uv run plugins/logging/tools/search_logs.py "query" --from 7d

# Specific date range
uv run plugins/logging/tools/search_logs.py "query" --from 2025-12-08 --to 2025-12-10
```

### Session Browsing

```bash
# All messages from a specific session (most recent first)
uv run plugins/logging/tools/search_logs.py --session b22351d6 --limit 10
```

### Full Content (No Truncation)

```bash
uv run plugins/logging/tools/search_logs.py "query" --full
```

### Conversation Pairs

Show user prompts with their corresponding Claude responses together:

```bash
uv run plugins/logging/tools/search_logs.py "topic" --pairs --format text
```

Output:
```
============================================================
Result 1 (score: 6.5)
Type: ConversationPair
Time: 2025-12-11T10:30:00
Session: b22351d6...
============================================================

[USER]:
Help me debug the authentication flow...

[CLAUDE]:
I analyzed the code and found the issue in the token validation...
```

### Match Highlighting

Highlight matching terms in results:

```bash
uv run plugins/logging/tools/search_logs.py "authentication" --highlight --format text
```

Output shows matching terms in **bold** (markdown) or highlighted (terminal).

### Semantic Search

Use hybrid BM25 + semantic similarity for conceptual matching:

```bash
uv run plugins/logging/tools/search_logs.py "learning from past discussions" --semantic
```

Output includes both scores:
```
Result 1 (score: 0.5525) [BM25: 4.826, Semantic: 0.1051]
```

Semantic search finds conceptually related content even when exact keywords don't match.

### Combined Flags

Flags can be combined for powerful queries:

```bash
# Find conversation pairs about a topic with highlighting
uv run plugins/logging/tools/search_logs.py "refactoring" --pairs --highlight --format text

# Semantic search with full content
uv run plugins/logging/tools/search_logs.py "architectural decisions" --semantic --full

# Today's conversations as pairs
uv run plugins/logging/tools/search_logs.py "query" --from today --pairs
```

## All Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `query` | (required*) | Search terms (*optional with --stats or --session) |
| `--logs-dir` | `.claude/logging` | Path to logs directory |
| `--limit` | 10 | Maximum results |
| `--type` | all | `UserPromptSubmit`, `AssistantResponse`, or `all` |
| `--format` | json | `json` or `text` |
| `--stats` | false | Show statistics instead of searching |
| `--from` | none | Start date filter |
| `--to` | none | End date filter |
| `--session` | none | Filter by session ID (prefix match) |
| `--full` | false | Don't truncate content |
| `--pairs` | false | Show prompt→response pairs together |
| `--highlight` | false | Highlight matching terms |
| `--semantic` | false | Use hybrid BM25+semantic search |

## Search Techniques

### Find What You Asked About

```bash
uv run plugins/logging/tools/search_logs.py "topic" --type UserPromptSubmit
```

### Find Solutions Claude Provided

```bash
uv run plugins/logging/tools/search_logs.py "topic" --type AssistantResponse
```

### Find Full Exchanges

```bash
uv run plugins/logging/tools/search_logs.py "topic" --pairs --format text
```

### Find Conceptually Related Discussions

```bash
uv run plugins/logging/tools/search_logs.py "memory and learning" --semantic
```

### Find Debugging Sessions

```bash
uv run plugins/logging/tools/search_logs.py "error bug fix debug"
```

### Find Architectural Decisions

```bash
uv run plugins/logging/tools/search_logs.py "architecture design pattern"
```

### Find Work on Specific Files

```bash
uv run plugins/logging/tools/search_logs.py "filename.ts"
```

## Result Format

### Standard Result (JSON)

```json
{
  "score": 8.7686,
  "type": "UserPromptSubmit",
  "content": "Help me debug the authentication flow...",
  "timestamp": "2025-12-11T10:30:00",
  "session_id": "b22351d6-b55f-4ddb-9052-a7ab0e0332ce",
  "log_file": ".claude/logging/2025/12/11/17-24-45-b22351d6.jsonl"
}
```

### Semantic Result (JSON)

```json
{
  "score": 0.5525,
  "bm25_score": 4.826,
  "semantic_score": 0.1051,
  "type": "AssistantResponse",
  "content": "...",
  "timestamp": "2025-12-11T10:30:00",
  "session_id": "b22351d6...",
  "log_file": "..."
}
```

### Conversation Pair Result (JSON)

```json
{
  "score": 6.5,
  "type": "ConversationPair",
  "prompt": {
    "content": "Help me debug...",
    "timestamp": "2025-12-11T10:30:00"
  },
  "response": {
    "content": "I analyzed the code...",
    "timestamp": "2025-12-11T10:30:15"
  },
  "session_id": "b22351d6...",
  "log_file": "..."
}
```

| Field | Description |
|-------|-------------|
| `score` | Relevance (higher = better match, 0 if browsing) |
| `bm25_score` | Keyword match score (with --semantic) |
| `semantic_score` | Embedding similarity (with --semantic) |
| `type` | `UserPromptSubmit`, `AssistantResponse`, or `ConversationPair` |
| `content` | Message text (truncated unless --full) |
| `prompt` / `response` | Sub-objects for conversation pairs |
| `timestamp` | When the message occurred |
| `session_id` | Session identifier |
| `log_file` | Full path to JSONL log |

## Post-Search Workflow

1. **Find interesting result** → note `session_id`
2. **Browse full session** → `--session {id} --limit 20`
3. **See full exchange** → add `--pairs` flag
4. **Read formatted report** → `cat {log_file%.jsonl}.md`
5. **Query raw events** → `jq . {log_file}`

## Example Workflows

### Recall Past Discussion

```bash
# 1. Check stats
uv run plugins/logging/tools/search_logs.py --stats --format text

# 2. Search for topic with pairs
uv run plugins/logging/tools/search_logs.py "authentication" --pairs --limit 5 --format text

# 3. Found interesting exchange, get more context
uv run plugins/logging/tools/search_logs.py --session b22351d6 --pairs --limit 10 --format text
```

### Find Similar Concepts

```bash
# 1. Search semantically for related ideas
uv run plugins/logging/tools/search_logs.py "improving code quality" --semantic --limit 5

# 2. Highlight specific terms
uv run plugins/logging/tools/search_logs.py "refactor test coverage" --highlight --format text
```

### Review Recent Work

```bash
# 1. Today's conversations
uv run plugins/logging/tools/search_logs.py --from today --pairs --format text

# 2. This week's debugging sessions
uv run plugins/logging/tools/search_logs.py "error fix" --from 7d --pairs
```

## Search Modes

| Mode | Flag | Best For |
|------|------|----------|
| Keyword (BM25) | (default) | Exact term matches |
| Semantic | `--semantic` | Conceptual similarity |
| Pairs | `--pairs` | Full conversation context |
| Highlighted | `--highlight` | Seeing where matches occur |

## Notes

- **Semantic search** uses a simple hash-based embedding fallback if sentence-transformers isn't installed
- **Conversation pairs** match prompts with their immediate responses within the same session
- **Highlighting** uses markdown bold for text format, ANSI codes for terminal
- Flags can be combined freely for powerful queries
