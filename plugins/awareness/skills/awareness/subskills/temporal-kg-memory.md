---
name: temporal-kg-memory
description: Build and manage temporal knowledge graphs from Claude Code conversation logs. Use when building agent memory systems, loading logs into FalkorDB/Graphiti, querying temporal patterns, or understanding conversation evolution over time. Start with the smallest experiment.
allowed-tools: Read, Write, Edit, Bash, Task, Glob, Grep, TodoWrite, WebFetch
---

# Temporal Knowledge Graph Memory

A living skill that evolves as we build infrastructure for loading Claude Code logs into temporal knowledge graphs.

## Territory Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  JSONL Logs ──► Direct Parser ──► FalkorDB ──► Query Tools       │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                    │
│  │  ingest_all_     │    │  claude_logs     │                    │
│  │  sessions.py     │───►│  graph (468      │                    │
│  │                  │    │  nodes, 794 rel) │                    │
│  └──────────────────┘    └──────────────────┘                    │
│           │                      │                                │
│           │                      ▼                                │
│    No LLM needed!        ┌──────────────────┐                    │
│                          │  query_sessions  │                    │
│                          │  .py (CLI tool)  │                    │
│                          └──────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘

Key Insight: Don't use LLM to extract structure from structured data!
```

## Quick Start (Production)

```bash
# 1. Start FalkorDB with persistent storage
docker run -p 6380:6379 -p 3001:3000 -d \
  -v falkordb_data:/var/lib/falkordb/data \
  falkordb/falkordb

# 2. Ingest all sessions (takes ~5 seconds)
cd plugins/awareness/skills/temporal-kg-memory/tools
uv run ingest_all_sessions.py

# 3. Query your conversation history
uv run query_sessions.py stats      # Graph statistics
uv run query_sessions.py topics     # What you talked about most
uv run query_sessions.py search "plugin"  # Find all mentions
uv run query_sessions.py timeline   # Session chronology
uv run query_sessions.py session b22351d6  # View specific session

# 4. View in browser
open http://localhost:3001
# Select graph: claude_logs
# Query: MATCH (m)-[:THEN]->(n) RETURN m, n LIMIT 50
```

## Current Understanding (Phase 0)

### Log Event Structure
```json
{
  "ts": "2025-12-11T17:28:10.186896",    // Timestamp (reference_time)
  "type": "UserPromptSubmit",             // Event type
  "session_id": "b22351d6-...",           // Session (group_id)
  "data": {                               // Event-specific data
    "prompt": "..."                       // Content varies by type
  }
}
```

### Event Types to Entity Mappings
| Event Type | Entity Extraction |
|------------|------------------|
| `SessionStart` | SESSION entity created |
| `UserPromptSubmit` | USER_PROMPT, extract CONCEPTS |
| `PreToolUse` | TOOL entity, FILE entities from paths |
| `PostToolUse` | RESULT entity, success/failure |
| `AssistantResponse` | RESPONSE, extract CONCEPTS |
| `SubagentStop` | AGENT entity |

### Graph Schema (Production)
```cypher
-- Node types (final architecture)
(:Session {id, file, cwd, start_time, end_time, total_events})
(:UserMessage {id, timestamp, time, text, length, session_id})
(:AssistantMessage {id, timestamp, time, text, length, session_id})
(:ToolUse {id, timestamp, time, tool, file_path, session_id})  -- optional

-- Relationship types
[:IN_SESSION]    -- Message → Session (membership)
[:THEN]          -- Message → Message (temporal sequence within session)
[:NEXT_SESSION]  -- Session → Session (temporal sequence between sessions)
```

### Why This Schema Works
1. **Distinct node types** - UserMessage vs AssistantMessage allows typed queries
2. **THEN edges** - Creates linear chain, visualizes as dialogue flow (not hub-and-spoke)
3. **Full text stored** - No truncation, enables full-text search
4. **Session grouping** - IN_SESSION + session_id enables cross-session queries

## Setup (Start Small)

### Step 1: FalkorDB
```bash
# One-liner to start FalkorDB
docker run -p 6379:6379 -p 3000:3000 -it --rm \
  -v ./data:/var/lib/falkordb/data \
  falkordb/falkordb

# Browser UI at http://localhost:3000
```

### Step 2: Graphiti
```bash
# Install with FalkorDB support
pip install graphiti-core[falkordb]

# Or with uv
uv add graphiti-core[falkordb]
```

### Step 3: Environment
```bash
export OPENAI_API_KEY="..."  # Required for entity extraction
```

## Beginner Techniques

### Connect to FalkorDB
```python
from graphiti_core import Graphiti
from graphiti_core.driver.falkordb_driver import FalkorDriver

driver = FalkorDriver(
    host="localhost",
    port=6379,
    database="claude_logs"
)
graphiti = Graphiti(graph_driver=driver)
await graphiti.build_indices_and_constraints()
```

### Add Single Event
```python
from graphiti_core.nodes import EpisodeType
from datetime import datetime

await graphiti.add_episode(
    name="event_001",
    episode_body="User asked: How do knowledge graphs work?",
    source=EpisodeType.message,
    source_description="Claude Code UserPromptSubmit",
    reference_time=datetime.fromisoformat("2025-12-11T17:28:10"),
    group_id="session_b22351d6"  # Partition by session
)
```

### Query the Graph
```python
# Semantic search
results = await graphiti.search(
    "knowledge graphs",
    group_id="session_b22351d6"
)

# Temporal search (what happened in this session?)
results = await graphiti.search_(
    query="*",
    group_ids=["session_b22351d6"],
    limit=50
)
```

## Intermediate Techniques

### Parse Log Events
```python
import json
from pathlib import Path

def parse_log_file(log_path: Path) -> list[dict]:
    """Parse JSONL log file into events."""
    events = []
    with open(log_path) as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
    return events

def event_to_episode_body(event: dict) -> str:
    """Convert event to natural language for entity extraction."""
    event_type = event['type']
    data = event.get('data', {})

    if event_type == 'UserPromptSubmit':
        return f"User asked: {data.get('prompt', '')}"

    elif event_type == 'PreToolUse':
        tool = data.get('tool_name', 'unknown')
        input_data = data.get('tool_input', {})
        return f"Claude is using {tool} tool with: {json.dumps(input_data)[:500]}"

    elif event_type == 'PostToolUse':
        tool = data.get('tool_name', 'unknown')
        response = data.get('tool_response', {})
        return f"Tool {tool} returned: {str(response)[:500]}"

    elif event_type == 'SessionStart':
        return f"Session started in {data.get('cwd', 'unknown directory')}"

    elif event_type == 'SubagentStop':
        agent_id = data.get('agent_id', 'unknown')
        return f"Subagent {agent_id} completed"

    else:
        return f"Event {event_type}: {json.dumps(data)[:300]}"
```

### Batch Ingestion
```python
async def ingest_session(graphiti: Graphiti, log_path: Path):
    """Ingest all events from a log file."""
    events = parse_log_file(log_path)

    for i, event in enumerate(events):
        body = event_to_episode_body(event)
        if not body:
            continue

        await graphiti.add_episode(
            name=f"{event['type']}_{i}",
            episode_body=body,
            source=EpisodeType.message,
            source_description=f"Claude Code {event['type']}",
            reference_time=datetime.fromisoformat(event['ts']),
            group_id=event['session_id']
        )

        # Rate limiting to avoid overwhelming LLM
        if i % 10 == 0:
            print(f"Ingested {i}/{len(events)} events")
```

## Advanced Techniques (To Be Discovered)

### Custom Entity Types
```python
# TODO: Define Pydantic models for:
# - ToolEntity
# - FileEntity
# - ConceptEntity
# - SessionEntity
```

### Real-time Hook Integration
```python
# TODO: Create PostToolUse hook that ingests to graph in real-time
```

### Temporal Queries
```cypher
-- TODO: Query patterns for:
-- "What files did we modify last week?"
-- "When did we first discuss authentication?"
-- "How did our approach evolve over time?"
```

## Learnings Log

### Entry 1: Initial Understanding
**Date**: 2025-12-12
**Experiment**: Research FalkorDB + Graphiti integration
**Learning**:
- FalkorDB uses sparse matrices (GraphBLAS) for efficient traversal
- Graphiti's FalkorDriver is mature and handles bi-temporal tracking
- group_id parameter enables session partitioning
- Episode ingestion triggers LLM-based entity extraction
**Mastery Level**: 0.2 (Apprentice)
**Next**: Build POC with single session

### Entry 2: Parser Implementation
**Date**: 2025-12-12
**Experiment**: Build and test log parser with dry run
**Learning**:
- JSONL logs can have malformed lines (interrupted writes) - parser must be resilient
- Event types worth ingesting: UserPromptSubmit, PreToolUse, PostToolUse, SessionStart, SubagentStop
- Skip AssistantResponse events (too large, redundant with tool uses)
- Truncate long content to avoid overwhelming entity extraction
- Session ID from first event is reliable for group_id
- Test sample: 3693 lines, ~3500 valid events, parsing takes <1s
- Some events have truncated JSON - handle gracefully with try/except
**Mastery Level**: 0.35 (Apprentice+)
**Next**: Test actual FalkorDB ingestion with small subset (~100 events)

### Entry 3: Full Pipeline Test
**Date**: 2025-12-12
**Experiment**: Ingest 10 events via FalkorDB + Graphiti
**Learning**:
- Rate limiting is critical: OpenAI API hits limits fast with sequential requests
- Need exponential backoff: `asyncio.sleep(2 ** retry_count)`
- Graphiti API: `search()` uses `num_results` not `limit`
- Graphiti API: `search_()` is the advanced method with SearchConfig
- FalkorDB runs fine on alternate ports (6380:6379, 3001:3000)
- FalkorDB UI accessible at mapped port (http://localhost:3001)
- Empty graph after rate limit = need retry logic before production
**Mastery Level**: 0.38 (Apprentice+)
**Next**: Add retry logic with exponential backoff, test with smaller batch

### Entry 4: Direct FalkorDB Success
**Date**: 2025-12-12
**Experiment**: Bypass Graphiti LLM, test FalkorDB directly
**Learning**:
- FalkorDB works perfectly: 1 session, 20 events, 2 tools created
- Manual entity extraction is viable for rule-based patterns
- Tool nodes: can merge to avoid duplicates (`MERGE`)
- Temporal links: `FOLLOWED_BY` relationships preserve event order
- Query patterns work: counts, aggregations, path traversal
- Graphiti adds LLM entity extraction ON TOP of this foundation
- Can run without LLM for testing, add LLM for production intelligence
**Mastery Level**: 0.45 (Journeyman)
**Next**: Document LLM requirements, create hybrid approach

### Entry 5: LLM API Requirements Discovery
**Date**: 2025-12-12
**Experiment**: Tested OpenAI and Anthropic APIs
**Learning**:
- **Critical**: Graphiti entity extraction requires LLM API with credits
- OpenAI: Hit rate limits immediately (tier limits)
- Anthropic: Hit credit balance limits
- Entity extraction makes 1+ LLM calls PER episode ingested
- For 3000+ events, this = 3000+ API calls = significant cost
- **Two modes viable**:
  1. **Production**: Full Graphiti with LLM = smart entity extraction
  2. **Development**: Direct FalkorDB = rule-based, fast, free
**Mastery Level**: 0.48 (Journeyman)
**Next**: Create hybrid ingestion (rules first, LLM enrichment later)

### Entry 6: Ollama Local LLM Success
**Date**: 2025-12-12
**Experiment**: Use Ollama via OpenAIGenericClient for free local processing
**Learning**:
- **Breakthrough**: Ollama works perfectly with Graphiti!
- Graphiti's `OpenAIGenericClient` accepts any OpenAI-compatible endpoint
- Config pattern:
  ```python
  llm_config = LLMConfig(
      api_key="ollama",  # Placeholder - not validated
      model="llama3.2:3b",
      base_url="http://localhost:11434/v1",
  )
  llm_client = OpenAIGenericClient(config=llm_config, max_tokens=4096)
  ```
- Embedder works too: `nomic-embed-text` model, 768 dimensions
- **Results**: 3/3 events ingested, semantic search found 5 edges
- Entity extraction quality depends on model size (try deepseek-r1:7b for better)
- **No rate limits, no API costs, runs entirely locally**
**Mastery Level**: 0.55 (Journeyman+)
**Next**: Production ingestion script using Ollama, benchmark different models

### Entry 7: Filtered Ingestion Experiment
**Date**: 2025-12-12
**Experiment**: Ingest only UserPromptSubmit + AssistantResponse events (no truncation)
**Setup**:
- Target: Session 0143495c (Dec 8, 2025) - first substantive conversation
- 10 events total, 5,842 characters (full content, NO truncation)
- Model: llama3.2:3b via Ollama
**Results**:
- **Success rate**: 8/10 events (80%)
- **Processing time**: 63.8 seconds total (6.4s per event)
- **Errors**: 2 RediSearch syntax errors (special characters in queries)
**Semantic Search Results** ("hot reload"):
```
Found 10 edges:
- Hot reloading requires assistance from Claude to activate.
- The User asked for hot reloading with plugins.
- Claude is working with plugins.
- Claude and 5 subagents are working together on hot reloading research.
- The User asked for guidance on the /plugin command.
```
**Key Learnings**:
- Full content ingestion WORKS - no truncation needed for typical conversations
- 6.4s per event is acceptable for batch processing (~1.5 hours for all 7,000 events)
- Graphiti extracts meaningful semantic relationships from natural conversation
- RediSearch has issues with special characters (backticks, slashes) - may need escaping
- FalkorDB needs persistent storage to survive restarts (use -v flag)
**Mastery Level**: 0.60 (Journeyman → Expert threshold!)
**Next**: Add persistent storage, fix RediSearch escaping, process full repository

### Entry 8: Structured vs LLM Extraction (Critical Insight)
**Date**: 2025-12-15
**Experiment**: Compare LLM entity extraction vs direct JSON parsing
**Discovery**:
- **LLM extraction is WRONG for structured data** like JSONL logs
- Created duplicate entities: "User", "user", "the user", "the human user", "CLAUDIO"
- 80-140 seconds for 10 events vs **2 seconds** with direct parsing
- Graph was confusing hub-and-spoke pattern
**Correct Approach**:
- Parse JSON structure directly → create typed nodes
- `UserMessage` and `AssistantMessage` as distinct node types
- `THEN` edges for temporal sequence
- **No LLM needed** for structure that already exists
**When to Use LLM**:
- Extracting concepts/topics from message TEXT (optional enrichment)
- Unstructured documents where structure is unknown
- NOT for parsing structured data formats
**Result**: Clean linear dialogue graph, instant processing, no duplicates
**Mastery Level**: 0.70 (Expert)
**Next**: Production ingestion of all 39 sessions, semantic search on content

### Entry 9: Production Ingestion Complete
**Date**: 2025-12-15
**Experiment**: Ingest ALL Claude Code sessions into FalkorDB
**Setup**:
- 60 log files (more created since initial count)
- Direct JSON parsing, no LLM
- Persistent Docker volume: `docker run -v falkordb_data:/var/lib/falkordb/data ...`
**Results**:
```
--- Graph Statistics ---
UserMessage:         219 (51,360 chars)
AssistantMessage:    197 (364,911 chars)
Session:              52

IN_SESSION:          416
THEN:                378
TOTAL:               468 nodes, 794 relationships
```
**Cross-Session Queries Working**:
- `uv run query_sessions.py search "plugin"` → 173 matches across all sessions
- `uv run query_sessions.py topics` → Shows keyword frequency analysis
- `uv run query_sessions.py timeline` → All 52 sessions chronologically
- `uv run query_sessions.py session <id>` → Full dialogue for any session
**Processing Time**: <5 seconds for all 60 files (vs 10+ hours with LLM)
**Key Insight**: Production-ready temporal memory without any external API dependencies
**Mastery Level**: 0.75 (Expert)
**Next**: Semantic search on message content, concept extraction

## Mastery Progression

```
Current Level: Expert (0.75)

Novice (0.0-0.2)
→ Understand architecture           ✓
→ Know components exist             ✓

Apprentice (0.2-0.4)
→ Can connect FalkorDB              ✓
→ Can ingest single events          ✓
→ Basic queries work                ✓

Journeyman (0.4-0.6)
→ Full session ingestion            ✓
→ Ollama local LLM integration      ✓
→ Temporal queries                  ✓

Expert (0.6-0.8)          ← YOU ARE HERE
→ LLM vs Structured insight         ✓ (CRITICAL: don't use LLM for structured data!)
→ Clean dialogue graph schema       ✓ (UserMessage/AssistantMessage + THEN edges)
→ Typed node visualization          ✓ (distinct colors per message type)
→ Production-scale ingestion        ✓ (60 sessions, 468 nodes, 794 relationships)
→ Cross-session analysis            ✓ (query_sessions.py CLI tool)

Master (0.8-1.0)
→ Semantic search on content        (pending: vector embeddings)
→ Concept extraction (LLM on text)  (pending: optional enrichment layer)
→ Pattern discovery across history  (pending: graph algorithms)
→ MCP server tools                  (pending: temporal query API)
```

## Integration with Awareness Ecosystem

```
┌─────────────────────────────────────────────────────────────────┐
│  AWARENESS LAYER 7: TEMPORAL MEMORY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  temporal-kg-memory skill                                        │
│     │                                                            │
│     ├── Uses: logging plugin (source data)                       │
│     ├── Uses: llms:graphiti skill (library knowledge)            │
│     ├── Uses: llms:falkordb skill (database knowledge)           │
│     └── Enables: Temporal reasoning over all conversations       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Anti-Patterns

1. **★ Using LLM for structured data** - CRITICAL: Don't use LLM entity extraction for JSONL logs!
   - Creates duplicates: "User", "user", "the user", "CLAUDIO"
   - 100x slower (hours vs seconds)
   - Parse JSON structure directly instead
2. **Hub-and-spoke schema** - Use THEN edges for linear dialogue, not just IN_SESSION
3. **Truncating content** - Store full text; enables full-text search
4. **No persistent storage** - FalkorDB is in-memory by default; use `-v ./data:/var/lib/falkordb/data`
5. **Ignoring rate limits** - Only applies if using LLM-based Graphiti approach
6. **No group_id** - Lose session boundaries
7. **Skipping timestamps** - Lose temporal ordering
8. **Special characters in content** - RediSearch chokes on backticks, slashes

## Files in This Skill

```
temporal-kg-memory/
├── tools/
│   ├── ingest_all_sessions.py      # ★ PRODUCTION: Load ALL sessions (no LLM)
│   ├── ingest_structured.py        # ★ Single session structured ingestion
│   ├── query_sessions.py           # ★ CLI for cross-session queries
│   ├── explore_graph.py            # ✓ Graph exploration utility
│   ├── experiment_filtered_ingest.py # Filtered ingestion experiment
│   ├── experiment_improved_dedup.py  # Custom entity types experiment
│   ├── ingest_logs.py              # Graphiti batch ingestion (LLM-based)
│   ├── test_ollama.py              # Ollama local LLM test
│   ├── test_falkordb_direct.py     # Direct FalkorDB test
│   └── test_*.py                   # Various test scripts
├── queries/
│   └── temporal_queries.cypher     # OpenCypher query patterns
└── hooks/
    └── log_to_graph.py             # Real-time PostToolUse hook (optional)

★ = Production-ready, no LLM required
```

## Three Operating Modes

### Mode 1: Direct FalkorDB (Development/Free)
- **No LLM required** - Works without any external service
- **Rule-based extraction** - Parse events, create nodes/edges directly
- **Fastest** - No LLM calls, instant results
- **Best for**: Testing, development, large-scale structure analysis

```bash
# Start FalkorDB
docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb

# Run direct test
uv run tools/test_falkordb_direct.py
```

### Mode 2: Ollama Local LLM (RECOMMENDED)
- **Free + Intelligent** - Best of both worlds!
- **Automatic entity extraction** - LLM extracts entities, relationships
- **No API costs** - Runs entirely on your machine
- **No rate limits** - Process thousands of events without throttling
- **Requires**: Ollama installed with models

```bash
# 1. Install Ollama: https://ollama.ai
# 2. Pull models
ollama pull llama3.2:3b       # Fast LLM (or deepseek-r1:7b for better quality)
ollama pull nomic-embed-text  # Embeddings

# 3. Start services
ollama serve  # In one terminal
docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb

# 4. Run test
uv run tools/test_ollama.py
```

**Tested Working:** 3/3 events ingested, semantic search found 5 edges!

### Mode 3: Cloud API (OpenAI/Anthropic)
- **Highest quality** - GPT-4, Claude entity extraction
- **Costs money** - ~$0.02/100 events with GPT-4o-mini
- **Rate limited** - May hit API limits
- **Best for**: Production with budget, highest accuracy needs

```bash
OPENAI_API_KEY=... uv run tools/ingest_logs.py --log-file ...
```

### Mode Comparison
| Mode | Cost | Speed | Quality | Rate Limits |
|------|------|-------|---------|-------------|
| Direct FalkorDB | Free | Fastest | Rule-based | None |
| Ollama | Free | Fast | Good | None |
| Cloud API | $0.02/100 | Medium | Best | Yes |

## Usage Examples

### Direct FalkorDB (No LLM - Start Here!)
```bash
# 1. Start FalkorDB
docker run -p 6380:6379 -p 3001:3000 -d --name falkordb falkordb/falkordb

# 2. Run direct test (creates graph from your logs)
uv run tools/test_falkordb_direct.py

# 3. View graph at http://localhost:3001
```

### Graphiti with LLM (When API Available)
```bash
# Dry run - parse only, validate
uv run tools/ingest_logs.py --log-file .claude/logging/2025/12/11/17-24-45-b22351d6.jsonl --dry-run --verbose

# Full ingestion (requires LLM API credits)
OPENAI_API_KEY=... uv run tools/ingest_logs.py --log-file .claude/logging/2025/12/11/... --host localhost --port 6380
```

### Real-time Hook (Future)
```bash
# Enable real-time ingestion (requires LLM API)
export TEMPORAL_KG_ENABLED=true
export OPENAI_API_KEY=...

# Configure in .claude/settings.json (see hooks/log_to_graph.py)
```

## MCP Integration (Phase 2)

Future: Create MCP server tools for temporal queries:

```json
{
  "tools": [
    {
      "name": "temporal_search",
      "description": "Search conversation history temporally",
      "input": {
        "query": "What files did we modify?",
        "time_range": "last_week",
        "session_id": "optional"
      }
    },
    {
      "name": "concept_evolution",
      "description": "Track how understanding of a concept evolved",
      "input": {
        "concept": "authentication"
      }
    },
    {
      "name": "session_summary",
      "description": "Get entity/relationship summary for a session",
      "input": {
        "session_id": "b22351d6"
      }
    }
  ]
}
```
