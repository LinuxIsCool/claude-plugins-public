---
name: claude-mem
description: This skill should be used when the user asks about "claude-mem", "Claude Code memory plugin", "progressive disclosure memory", "biomimetic memory", "endless mode", "memory hooks pattern", or needs to implement Claude Code-native memory with 10x token savings.
version: 0.1.0
allowed-tools: Read, Glob, Grep, Bash
---

# claude-mem Skill

Provides expertise on claude-mem - a Claude Code plugin implementing persistent memory with progressive disclosure, achieving ~10x token savings through smart filtering.

## Overview

claude-mem is a production Claude Code plugin that automatically captures, compresses, and injects relevant context. Key innovations:

| Feature | Description |
|---------|-------------|
| **5 Lifecycle Hooks** | SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd |
| **Progressive Disclosure** | 3-layer workflow for token efficiency |
| **Worker Service** | HTTP API on port 37777 with web viewer |
| **Hybrid Search** | Chroma vectors + SQLite full-text |
| **Biomimetic Mode** | Natural decay patterns for extended sessions |

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Claude Code Session                              │
├─────────────────────────────────────────────────┤
│ SessionStart → Load recent context               │
│ UserPromptSubmit → Inject relevant memories      │
│ PostToolUse → Capture observations               │
│ Stop → Summarize exchange                        │
│ SessionEnd → Persist and index                   │
└─────────────────────────────────────────────────┘
                    ↕
┌─────────────────────────────────────────────────┐
│ Worker Service (port 37777)                      │
├─────────────────────────────────────────────────┤
│ SQLite: sessions, observations, summaries        │
│ Chroma: semantic vector search                   │
│ Web UI: session viewer and search                │
└─────────────────────────────────────────────────┘
```

## Progressive Disclosure Pattern

The key innovation - 3-layer workflow achieving ~10x token savings:

### Layer 1: Search (50-100 tokens)
```
Compact index with IDs only
→ Filter candidates before details
```

### Layer 2: Timeline (200-500 tokens)
```
Chronological context around results
→ Understand temporal relationships
```

### Layer 3: get_observations (500-1000 tokens)
```
Full details only for filtered IDs
→ Load specific memories on demand
```

**Formula**: Filter before fetching = massive token savings

## Hook Implementations

### SessionStart Hook

```python
# Load recent context on session start
def session_start_hook(session_id):
    recent = get_recent_sessions(limit=3)
    if recent:
        return {
            "systemMessage": format_session_context(recent)
        }
```

### UserPromptSubmit Hook

```python
# Inject relevant memories before processing
def user_prompt_hook(prompt, session_id):
    # Search for relevant memories
    results = search_memories(prompt, limit=5)

    if results:
        return {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": format_memories(results)
            }
        }
```

### PostToolUse Hook

```python
# Capture observations from tool use
def post_tool_hook(tool_name, tool_input, tool_response):
    observation = {
        "type": "tool_use",
        "tool": tool_name,
        "input": summarize(tool_input),
        "output": summarize(tool_response),
        "timestamp": datetime.now().isoformat()
    }
    store_observation(observation)
```

### Stop Hook

```python
# Summarize exchange on completion
def stop_hook(session_id, transcript_path):
    exchange = load_exchange(transcript_path)
    summary = compress_with_ai(exchange)
    store_summary(session_id, summary)
```

### SessionEnd Hook

```python
# Persist and index on session end
def session_end_hook(session_id):
    # Generate embeddings for new observations
    pending = get_unindexed_observations(session_id)
    for obs in pending:
        embedding = generate_embedding(obs["content"])
        store_embedding(obs["id"], embedding)
```

## mem-search Skill

Built-in skill for natural language memory queries:

```
/mem-search "what files did I edit yesterday"
/mem-search "conversations about authentication"
/mem-search "recent errors and how I fixed them"
```

## Biomimetic Memory (Endless Mode)

For extended sessions, implements natural decay:

- Recent memories: High weight, immediate access
- Older memories: Decay factor reduces relevance
- Very old: Archive with explicit retrieval only

```python
def calculate_relevance(memory, query):
    base_score = semantic_similarity(memory, query)
    age_hours = (datetime.now() - memory.timestamp).total_seconds() / 3600

    # Exponential decay
    decay_factor = math.exp(-age_hours / 24)  # 24-hour half-life

    return base_score * decay_factor
```

## Configuration

Settings in `~/.claude-mem/settings.json`:

```json
{
  "hooks": {
    "sessionStart": true,
    "userPromptSubmit": true,
    "postToolUse": true,
    "stop": true,
    "sessionEnd": true
  },
  "search": {
    "maxResults": 5,
    "minRelevance": 0.3
  },
  "storage": {
    "dbPath": "~/.claude-mem/memory.db",
    "chromaPath": "~/.claude-mem/chroma"
  },
  "privacy": {
    "excludePatterns": ["<private>", "password", "secret"]
  }
}
```

## Privacy Features

Exclude sensitive content:

```markdown
<private>
This content will not be stored in memory
API_KEY=sk-...
</private>
```

## When to Use claude-mem Patterns

**Best for:**
- Claude Code plugin development
- Progressive disclosure patterns
- Hook-based memory architecture
- Session-scoped memory needs

**Consider alternatives for:**
- Multi-user systems → mem0
- Multi-hop reasoning → HippoRAG
- Zero dependencies → domain-memory
- Blockchain archival → lumera-memory

## Installation

```bash
# Clone the plugin
git clone https://github.com/thedotmack/claude-mem ~/.claude/plugins/claude-mem

# Start worker service
bun run ~/.claude/plugins/claude-mem/worker/index.ts
```

## Additional Resources

### Reference Files
- `references/hook-patterns.md` - Detailed hook implementations
- `references/progressive-disclosure.md` - Token optimization strategies
- `references/worker-api.md` - HTTP API documentation

### Repository
- Source: `/.research/claude-mem/` (cloned locally)
- GitHub: https://github.com/thedotmack/claude-mem

### Related Skills
- `../memory-architecture/SKILL.md` - Three-tier design
- `../vector-search/SKILL.md` - Chroma integration
