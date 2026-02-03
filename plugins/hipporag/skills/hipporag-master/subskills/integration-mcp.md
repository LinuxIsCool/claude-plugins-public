---
name: integration-mcp
description: Master HippoRAG MCP server integration for Claude Code ecosystem. Covers server setup, tool exposure, memory augmentation patterns, and continuous context from conversations.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Integration: MCP Server

Integrating HippoRAG with Claude Code via Model Context Protocol.

## Overview

The Model Context Protocol (MCP) allows HippoRAG to expose tools that Claude Code can use directly:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code + HippoRAG                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Claude Code                    MCP Server                      │
│  ┌─────────────┐               ┌─────────────┐                 │
│  │             │    MCP        │  HippoRAG   │                 │
│  │   Agent     │◄─────────────►│   Server    │                 │
│  │             │   Protocol    │             │                 │
│  └─────────────┘               └──────┬──────┘                 │
│                                       │                         │
│                                       ▼                         │
│                               ┌─────────────┐                  │
│                               │ Graph DB    │                  │
│                               └─────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start HippoRAG MCP Server

```bash
# Install HippoRAG with MCP support
pip install hipporag[mcp]

# Start MCP server
hipporag-mcp-server --backend kuzu --port 8000
```

### 2. Configure Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "hipporag-memory": {
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

### 3. Use HippoRAG Tools in Claude Code

Once configured, Claude Code can use:

- `hipporag_add_episode` - Store new information
- `hipporag_search` - Query the knowledge graph
- `hipporag_get_entities` - List entities
- `hipporag_get_status` - Check system status

---

## MCP Server Configuration

### Basic Server Setup

```bash
# Start with default settings (Kuzu backend)
hipporag-mcp-server

# With Neo4j backend
hipporag-mcp-server \
    --backend neo4j \
    --connection "bolt://localhost:7687" \
    --username neo4j \
    --password your_password

# With custom port and host
hipporag-mcp-server \
    --host 0.0.0.0 \
    --port 9000
```

### Configuration File

Create `hipporag-mcp-config.yaml`:

```yaml
server:
  host: "0.0.0.0"
  port: 8000
  transport: "http"          # or "stdio" for stdio transport

database:
  backend: "neo4j"
  connection: "bolt://localhost:7687"
  username: "neo4j"
  password: "${NEO4J_PASSWORD}"

llm:
  provider: "openai"
  model: "gpt-4o-mini"
  api_key: "${OPENAI_API_KEY}"

embedding:
  provider: "openai"
  model: "text-embedding-3-small"
  dimension: 1536

hipporag:
  damping_factor: 0.85
  top_k: 20
  consolidation_enabled: true
  consolidation_interval: 3600

# Custom entity types for extraction
entity_types:
  - name: "Person"
    description: "A human individual"
  - name: "Organization"
    description: "A company, institution, or group"
  - name: "Concept"
    description: "An abstract idea or topic"
  - name: "Project"
    description: "A work effort or initiative"
```

Start with config:

```bash
hipporag-mcp-server --config hipporag-mcp-config.yaml
```

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  hipporag-mcp:
    image: hipporag/mcp-server:latest
    ports:
      - "8000:8000"
    environment:
      - BACKEND=neo4j
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USERNAME=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - neo4j

  neo4j:
    image: neo4j:5.26-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
    volumes:
      - neo4j_data:/data

volumes:
  neo4j_data:
```

---

## Available MCP Tools

### `hipporag_add_episode`

Store new information in the knowledge graph.

```
Tool: hipporag_add_episode
Parameters:
  - content (string, required): The information to store
  - source (string, optional): Source identifier
  - group_id (string, optional): Namespace for multi-tenant isolation

Example:
  "Add this to memory: Alice joined TechCorp as CTO in 2024.
   She previously worked at Google on ML infrastructure."
```

### `hipporag_search`

Query the knowledge graph using PPR.

```
Tool: hipporag_search
Parameters:
  - query (string, required): Natural language query
  - top_k (integer, optional): Number of results (default: 20)
  - group_id (string, optional): Filter by namespace

Example:
  "Search memory: Who is Alice and where does she work?"
```

### `hipporag_get_entities`

List entities in the knowledge graph.

```
Tool: hipporag_get_entities
Parameters:
  - type (string, optional): Filter by entity type
  - limit (integer, optional): Max results (default: 50)
  - group_id (string, optional): Filter by namespace

Example:
  "List all Person entities in memory"
```

### `hipporag_get_relations`

List relationships in the knowledge graph.

```
Tool: hipporag_get_relations
Parameters:
  - entity (string, optional): Filter by entity
  - type (string, optional): Filter by relation type
  - limit (integer, optional): Max results (default: 50)

Example:
  "Show all relationships involving Alice"
```

### `hipporag_get_status`

Check system health and statistics.

```
Tool: hipporag_get_status
Parameters: none

Returns:
  - backend: Database type
  - connected: Connection status
  - entity_count: Number of entities
  - relation_count: Number of relations
  - last_consolidation: Timestamp
```

### `hipporag_delete_entity`

Remove an entity and its relations.

```
Tool: hipporag_delete_entity
Parameters:
  - name (string, required): Entity to delete

Example:
  "Delete entity 'OldProject' from memory"
```

### `hipporag_clear_graph`

Clear all data (use with caution).

```
Tool: hipporag_clear_graph
Parameters:
  - confirm (boolean, required): Must be true

Example:
  "Clear all memory data" (requires confirmation)
```

---

## Memory Augmentation Patterns

### Pattern 1: Conversation Memory

Store conversation context for continuity:

```python
# In a Claude Code workflow or hook

# After each significant conversation turn
await mcp_call("hipporag_add_episode", {
    "content": f"User asked: {user_query}\nAssistant responded: {response_summary}",
    "source": f"conversation_{session_id}",
    "group_id": user_id
})

# Before generating response, retrieve relevant context
context = await mcp_call("hipporag_search", {
    "query": user_query,
    "top_k": 10,
    "group_id": user_id
})
```

### Pattern 2: Project Knowledge Base

Build project-specific memory:

```python
# Index project documentation
for doc in project_docs:
    await mcp_call("hipporag_add_episode", {
        "content": doc.content,
        "source": doc.path,
        "group_id": "project_alpha"
    })

# Query project knowledge
results = await mcp_call("hipporag_search", {
    "query": "How does authentication work in this project?",
    "group_id": "project_alpha"
})
```

### Pattern 3: Learning Journal

Track learning across sessions:

```python
# After learning something new
await mcp_call("hipporag_add_episode", {
    "content": f"""
    Learned: {topic}
    Key points:
    - {point1}
    - {point2}
    Related to: {related_topics}
    """,
    "source": "learning_journal",
    "group_id": "learning"
})

# Later, recall related learning
results = await mcp_call("hipporag_search", {
    "query": "What have I learned about {topic}?",
    "group_id": "learning"
})
```

### Pattern 4: Entity Tracking

Track important entities across conversations:

```python
# Track a new entity
await mcp_call("hipporag_add_episode", {
    "content": f"""
    New contact: {name}
    Role: {role}
    Organization: {org}
    Met on: {date}
    Context: {how_we_met}
    """,
    "source": "contacts",
    "group_id": "network"
})

# Query network
results = await mcp_call("hipporag_search", {
    "query": f"Who do I know at {company}?",
    "group_id": "network"
})
```

---

## Claude Code Plugin Integration

### Creating a Memory-Aware Skill

```markdown
---
name: memory-assisted-research
description: Research with memory augmentation
allowed-tools: Read, Glob, Grep, WebFetch, hipporag_search, hipporag_add_episode
---

# Memory-Assisted Research

Before starting research:
1. Query memory for existing knowledge on the topic
2. Identify gaps in current understanding

During research:
1. Store key findings in memory
2. Link new information to existing knowledge

After research:
1. Synthesize findings with memory context
2. Store synthesis for future reference
```

### Creating a Memory Hook

```markdown
---
event: Stop
description: Store conversation insights in memory
---

# Post-Conversation Memory Hook

After significant conversations, extract and store:
1. Key decisions made
2. New information learned
3. Action items identified
4. Questions raised

Use hipporag_add_episode to store insights.
```

---

## Multi-Tenant Memory

### Namespace Isolation

```python
# User A's memory
await mcp_call("hipporag_add_episode", {
    "content": "Alice prefers dark mode",
    "group_id": "user_alice"
})

# User B's memory (isolated)
await mcp_call("hipporag_add_episode", {
    "content": "Bob prefers light mode",
    "group_id": "user_bob"
})

# Query only User A's memory
results = await mcp_call("hipporag_search", {
    "query": "preferences",
    "group_id": "user_alice"
})
# Returns only Alice's preferences
```

### Project Isolation

```json
{
  "mcpServers": {
    "project-alpha-memory": {
      "url": "http://localhost:8000/mcp/",
      "config": {
        "group_id": "project_alpha"
      }
    },
    "project-beta-memory": {
      "url": "http://localhost:8000/mcp/",
      "config": {
        "group_id": "project_beta"
      }
    }
  }
}
```

---

## Stdio Transport

For clients that prefer stdio over HTTP:

### Configuration

```json
{
  "mcpServers": {
    "hipporag-memory": {
      "command": "hipporag-mcp-server",
      "args": ["--transport", "stdio", "--backend", "kuzu"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### With UV (Python package manager)

```json
{
  "mcpServers": {
    "hipporag-memory": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/path/to/hipporag",
        "hipporag-mcp-server",
        "--transport",
        "stdio"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Tools not appearing | MCP not connected | Check server URL, restart Claude Code |
| Connection refused | Server not running | Start hipporag-mcp-server |
| Timeout errors | Slow backend | Check Neo4j/FalkorDB status |
| Empty results | No data indexed | Add episodes first |
| Wrong namespace | group_id mismatch | Verify group_id consistency |

### Debug Logging

```bash
# Enable debug logging
hipporag-mcp-server --log-level debug

# View MCP traffic
export MCP_DEBUG=1
hipporag-mcp-server
```

---

## Reference

### Environment Variables

```bash
# Server
HIPPORAG_MCP_HOST=0.0.0.0
HIPPORAG_MCP_PORT=8000

# Database
HIPPORAG_BACKEND=kuzu
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Health Check

```bash
curl http://localhost:8000/health
# {"status": "healthy", "backend": "neo4j", "entities": 1234}
```

## Related Sub-Skills

- **integration-backends**: Database configuration for MCP server
- **integration-llm**: LLM configuration for extraction
- **core-retrieval**: Understanding PPR results from search
- **recipes-use-cases**: Memory-augmented application patterns
