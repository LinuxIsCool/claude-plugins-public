---
name: graphiti
description: Master Graphiti for building temporally-aware knowledge graphs for AI agents. Use when building agent memory systems, dynamic knowledge graphs with real-time data ingestion, temporal reasoning, or hybrid retrieval combining semantic embeddings, BM25 keyword search, and graph traversal. Supports Neo4j, FalkorDB, Kuzu, and Amazon Neptune backends.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Graphiti Mastery

Build real-time, temporally-aware knowledge graphs for AI agent memory and dynamic data systems.

## Territory Map

```
resources/knowledge_graphs/graphiti/
├── graphiti_core/                    # Core library
│   ├── graphiti.py                   # Main Graphiti class - orchestrates all functionality
│   ├── nodes.py                      # EntityNode, EpisodicNode, CommunityNode
│   ├── edges.py                      # EntityEdge, EpisodicEdge, CommunityEdge
│   ├── driver/                       # Graph database backends
│   │   ├── neo4j_driver.py           # Neo4j backend (production-grade)
│   │   ├── falkordb_driver.py        # FalkorDB backend (Redis-based)
│   │   ├── kuzu_driver.py            # Kuzu backend (embedded)
│   │   └── neptune_driver.py         # Amazon Neptune backend
│   ├── llm_client/                   # LLM integrations
│   │   ├── openai_client.py          # OpenAI GPT models
│   │   ├── anthropic_client.py       # Claude models
│   │   ├── gemini_client.py          # Google Gemini
│   │   └── azure_openai_client.py    # Azure OpenAI
│   ├── embedder/                     # Embedding providers
│   │   ├── openai.py                 # OpenAI embeddings
│   │   ├── voyage.py                 # Voyage AI embeddings
│   │   └── gemini.py                 # Gemini embeddings
│   ├── search/                       # Hybrid search system
│   │   ├── search.py                 # Main search orchestration
│   │   ├── search_config.py          # Search configuration models
│   │   ├── search_config_recipes.py  # Pre-built search strategies
│   │   └── search_utils.py           # BM25, cosine similarity, graph traversal
│   ├── utils/                        # Utilities
│   │   ├── bulk_utils.py             # Batch processing for episodes
│   │   ├── datetime_utils.py         # Temporal handling
│   │   └── maintenance/              # Graph operations
│   │       ├── temporal_operations.py # Bi-temporal edge management
│   │       ├── edge_operations.py     # Edge extraction & resolution
│   │       └── node_operations.py     # Entity deduplication
│   └── prompts/                      # LLM prompt templates
├── mcp_server/                       # MCP protocol integration
│   ├── graphiti_mcp_server.py        # MCP server implementation
│   └── config.yaml                   # Server configuration
├── server/                           # FastAPI REST service
└── examples/                         # Demonstrations
    ├── quickstart/                   # Basic usage
    ├── podcast/                      # Temporal episode processing
    └── langgraph-agent/              # Agent integration
```

## Core Capabilities

### Bi-Temporal Data Model
- **Event occurrence time** (`valid_at`): When the fact was true in the real world
- **Ingestion time** (`created_at`): When the fact was added to the graph
- **Invalidation time** (`invalid_at`): When the fact became false
- Enables point-in-time queries and historical reasoning

### Hybrid Retrieval System
- **Semantic search**: Vector embeddings with cosine similarity
- **Keyword search**: BM25 full-text retrieval
- **Graph traversal**: Breadth-first search (BFS) from center nodes
- **Reranking strategies**: RRF, MMR, node distance, cross-encoder

### Real-Time Incremental Updates
- Continuous episode ingestion without batch reprocessing
- Automatic entity deduplication using LLM-based similarity
- Contradiction detection and edge invalidation
- Episode window tracking for temporal context

## Beginner Techniques

### Basic Setup and Initialization

```python
from graphiti_core import Graphiti
from datetime import datetime, timezone

# Connect to Neo4j (default backend)
graphiti = Graphiti(
    "bolt://localhost:7687",
    "neo4j",
    "password"
)

# Build required indices and constraints
await graphiti.build_indices_and_constraints()
```

### Adding Episodes (Core Data Ingestion)

Episodes are the primary units of information in Graphiti. They can be text, JSON, or message format.

```python
from graphiti_core.nodes import EpisodeType

# Text episode
await graphiti.add_episode(
    name="meeting_notes_2025_01",
    episode_body="Alice is the CEO of TechCorp. She started in January 2025.",
    source=EpisodeType.text,
    source_description="meeting notes",
    reference_time=datetime.now(timezone.utc)
)

# JSON episode (structured data)
import json
await graphiti.add_episode(
    name="employee_record",
    episode_body=json.dumps({
        "name": "Bob Smith",
        "position": "CTO",
        "department": "Engineering",
        "start_date": "2024-06-01"
    }),
    source=EpisodeType.json,
    source_description="HR system export"
)

# Message episode (conversation format)
await graphiti.add_episode(
    name="chat_log",
    episode_body="user: What's the status on Project X?\nassistant: Project X is 80% complete.",
    source=EpisodeType.message,
    source_description="customer support chat"
)
```

### Simple Search

```python
# Default hybrid search (edges/relationships)
results = await graphiti.search("Who is the CEO?")

for edge in results.edges:
    print(f"Fact: {edge.fact}")
    print(f"Valid from: {edge.valid_at}")
    print(f"Valid until: {edge.invalid_at}")
```

### Retrieving Recent Episodes

```python
# Get last 5 episodes before a timestamp
episodes = await graphiti.retrieve_episodes(
    reference_time=datetime.now(timezone.utc),
    last_n=5
)

for ep in episodes:
    print(f"{ep.name}: {ep.content[:100]}...")
```

## Intermediate Techniques

### Custom Search Recipes

Graphiti provides pre-configured search strategies optimized for different use cases:

```python
from graphiti_core.search.search_config_recipes import (
    # Edge (relationship) search
    EDGE_HYBRID_SEARCH_RRF,              # Reciprocal Rank Fusion
    EDGE_HYBRID_SEARCH_MMR,              # Maximal Marginal Relevance
    EDGE_HYBRID_SEARCH_NODE_DISTANCE,    # Graph distance reranking
    EDGE_HYBRID_SEARCH_CROSS_ENCODER,    # LLM-based reranking

    # Node (entity) search
    NODE_HYBRID_SEARCH_RRF,
    NODE_HYBRID_SEARCH_CROSS_ENCODER,

    # Combined search (edges + nodes + episodes + communities)
    COMBINED_HYBRID_SEARCH_RRF,
    COMBINED_HYBRID_SEARCH_CROSS_ENCODER
)

# Node search with custom configuration
config = NODE_HYBRID_SEARCH_RRF.model_copy(deep=True)
config.limit = 10  # Override default limit

results = await graphiti._search(
    query="Find all companies",
    config=config
)

for node in results.nodes:
    print(f"{node.name}: {node.summary}")
```

### Center Node Search (Graph-Aware Reranking)

Rerank results based on graph distance from a specific entity:

```python
# Initial search
results = await graphiti.search("California politics")

# Use top result's source node as center for reranking
if results.edges:
    center_node_uuid = results.edges[0].source_node_uuid

    # Reranked search prioritizes facts near the center node
    reranked = await graphiti.search(
        "California politics",
        center_node_uuid=center_node_uuid
    )
```

### Group Partitioning (Multi-Tenant Graphs)

Isolate data by namespace using `group_id`:

```python
# Add episode to specific group
await graphiti.add_episode(
    name="alice_preferences",
    episode_body="Alice prefers dark mode and uses Python daily.",
    source=EpisodeType.text,
    group_id="user_alice"  # Namespace for Alice's data
)

await graphiti.add_episode(
    name="bob_preferences",
    episode_body="Bob prefers light mode and uses JavaScript.",
    group_id="user_bob"  # Separate namespace for Bob
)

# Search within specific group
alice_prefs = await graphiti.search(
    "preferences",
    group_ids=["user_alice"]  # Only Alice's data
)

# Search across multiple groups
results = await graphiti.search(
    "programming languages",
    group_ids=["user_alice", "user_bob"]
)
```

### Custom Entity Types with Pydantic

Define structured entity schemas for better knowledge extraction:

```python
from pydantic import BaseModel, Field

class Person(BaseModel):
    """A human person"""
    first_name: str | None = Field(None, description="First name")
    last_name: str | None = Field(None, description="Last name")
    occupation: str | None = Field(None, description="Work occupation")
    age: int | None = Field(None, description="Age in years")

class Organization(BaseModel):
    """A company or institution"""
    name: str = Field(description="Organization name")
    industry: str | None = Field(None, description="Industry sector")
    founded_year: int | None = Field(None, description="Year founded")

class WorksFor(BaseModel):
    """Employment relationship"""
    role: str | None = Field(None, description="Job title/role")
    start_date: str | None = Field(None, description="Employment start date")

# Use custom types during ingestion
await graphiti.add_episode(
    name="employee_data",
    episode_body="Jane Doe works as Senior Engineer at DataCorp since 2023.",
    entity_types={
        "Person": Person,
        "Organization": Organization
    },
    edge_types={
        "WORKS_FOR": WorksFor
    },
    edge_type_map={
        ("Person", "Organization"): ["WORKS_FOR"]
    }
)
```

### Bulk Episode Ingestion

Efficient batch processing for large datasets:

```python
from graphiti_core.utils.bulk_utils import RawEpisode

raw_episodes = [
    RawEpisode(
        name=f"podcast_msg_{i}",
        content=f"Speaker: {msg.content}",
        reference_time=msg.timestamp,
        source=EpisodeType.message,
        source_description="podcast transcript"
    )
    for i, msg in enumerate(messages)
]

await graphiti.add_episode_bulk(
    raw_episodes,
    group_id="podcast_analysis",
    entity_types={"Person": Person, "Topic": Topic}
)
```

## Advanced Techniques

### Temporal Edge Management

Graphiti automatically handles changing facts over time:

```python
# First fact
await graphiti.add_episode(
    name="kamala_2011",
    episode_body="Kamala Harris is the Attorney General of California.",
    reference_time=datetime(2011, 1, 3, tzinfo=timezone.utc)
)

# Contradictory fact (automatically invalidates previous edge)
await graphiti.add_episode(
    name="kamala_2017",
    episode_body="Kamala Harris is the US Senator from California.",
    reference_time=datetime(2017, 1, 3, tzinfo=timezone.utc)
)

# Query historical state
results = await graphiti.search("Kamala Harris role")
for edge in results.edges:
    print(f"{edge.fact}")
    print(f"  Valid: {edge.valid_at} to {edge.invalid_at}")
```

### Custom LLM and Embedder Providers

```python
from graphiti_core.llm_client.anthropic_client import AnthropicClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.voyage import VoyageEmbedder, VoyageEmbedderConfig

# Configure Anthropic LLM
llm_config = LLMConfig(
    api_key="your_anthropic_key",
    model="claude-sonnet-4-5-latest",
    small_model="claude-haiku-4-5-latest"
)
llm_client = AnthropicClient(config=llm_config)

# Configure Voyage embeddings
embedder_config = VoyageEmbedderConfig(
    api_key="your_voyage_key",
    embedding_model="voyage-3"
)
embedder = VoyageEmbedder(config=embedder_config)

# Initialize Graphiti with custom clients
graphiti = Graphiti(
    "bolt://localhost:7687",
    "neo4j",
    "password",
    llm_client=llm_client,
    embedder=embedder
)
```

### Alternative Graph Database Backends

#### FalkorDB (Redis-based, High Performance)

```python
from graphiti_core import Graphiti
from graphiti_core.driver.falkordb_driver import FalkorDriver

driver = FalkorDriver(
    host="localhost",
    port=6379,
    password="optional_password",
    database="my_graph"
)

graphiti = Graphiti(graph_driver=driver)
```

#### Kuzu (Embedded, File-based)

```python
from graphiti_core.driver.kuzu_driver import KuzuDriver

driver = KuzuDriver(db="/path/to/graphiti.kuzu")
graphiti = Graphiti(graph_driver=driver)
```

#### Amazon Neptune (Cloud-native)

```python
from graphiti_core.driver.neptune_driver import NeptuneDriver

driver = NeptuneDriver(
    host="neptune-db://<cluster-endpoint>",  # or neptune-graph://<graph-id>
    aoss_host="<opensearch-serverless-host>",
    port=8182,
    aoss_port=443
)

graphiti = Graphiti(graph_driver=driver)
```

### Local LLM with Ollama

```python
from graphiti_core.llm_client.openai_generic_client import OpenAIGenericClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig

# Configure Ollama as OpenAI-compatible endpoint
llm_config = LLMConfig(
    api_key="ollama",  # Placeholder
    model="deepseek-r1:7b",
    small_model="deepseek-r1:7b",
    base_url="http://localhost:11434/v1"
)

embedder_config = OpenAIEmbedderConfig(
    api_key="ollama",
    embedding_model="nomic-embed-text",
    embedding_dim=768,
    base_url="http://localhost:11434/v1"
)

graphiti = Graphiti(
    "bolt://localhost:7687",
    "neo4j",
    "password",
    llm_client=OpenAIGenericClient(config=llm_config),
    embedder=OpenAIEmbedder(config=embedder_config)
)
```

### Community Detection (Entity Clustering)

```python
# Build communities to cluster related entities
await graphiti.build_communities(
    group_ids=["project_alpha"],
    community_size=5  # Target size for communities
)

# Search communities
from graphiti_core.search.search_config_recipes import COMMUNITY_HYBRID_SEARCH_RRF

results = await graphiti._search(
    query="engineering team",
    config=COMMUNITY_HYBRID_SEARCH_RRF
)

for community in results.communities:
    print(f"Community {community.name}: {community.summary}")
```

### Search Filtering and Advanced Queries

```python
from graphiti_core.search.search_filters import SearchFilters
from datetime import datetime, timezone

# Filter by time range
filters = SearchFilters(
    created_at_start=datetime(2025, 1, 1, tzinfo=timezone.utc),
    created_at_end=datetime(2025, 12, 31, tzinfo=timezone.utc)
)

results = await graphiti.search(
    "company acquisitions",
    filters=filters
)

# Filter by entity types
filters = SearchFilters(
    entity_types=["Person", "Organization"]
)

results = await graphiti.search(
    "executives",
    filters=filters
)
```

### Graph Maintenance Operations

```python
from graphiti_core.utils.maintenance.graph_data_operations import clear_data

# Clear all graph data
await clear_data(graphiti.driver)

# Rebuild indices after schema changes
await graphiti.build_indices_and_constraints()

# Delete specific nodes
from graphiti_core.nodes import EntityNode

node = await EntityNode.get_by_uuid(graphiti.driver, "node-uuid-here")
await node.delete(graphiti.driver)

# Delete specific edges
from graphiti_core.edges import EntityEdge

edge = await EntityEdge.get_by_uuid(graphiti.driver, "edge-uuid-here")
await edge.delete(graphiti.driver)
```

## MCP Server Integration

The Graphiti MCP server exposes knowledge graph capabilities to AI assistants via the Model Context Protocol.

### HTTP Transport (Default)

Configure in Claude Desktop, Cursor, or other MCP clients:

```json
{
  "mcpServers": {
    "graphiti-memory": {
      "url": "http://localhost:8000/mcp/"
    }
  }
}
```

### Stdio Transport

For clients that only support stdio:

```json
{
  "mcpServers": {
    "graphiti-memory": {
      "command": "/path/to/uv",
      "args": [
        "run",
        "--directory",
        "/path/to/graphiti/mcp_server",
        "graphiti_mcp_server.py",
        "--transport",
        "stdio"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "password"
      }
    }
  }
}
```

### Running MCP Server with Docker

```bash
cd mcp_server/

# Default: FalkorDB combined container
docker compose up

# Neo4j backend
docker compose -f docker/docker-compose-neo4j.yml up
```

### Available MCP Tools

- `add_episode`: Ingest text, JSON, or message data
- `search_nodes`: Find entities by semantic/keyword search
- `search_facts`: Find relationships between entities
- `get_episodes`: Retrieve recent episodes
- `delete_entity_edge`: Remove a relationship
- `delete_episode`: Remove an episode
- `get_entity_edge`: Fetch edge by UUID
- `clear_graph`: Reset the entire graph
- `get_status`: Health check

### MCP Server Configuration

Edit `mcp_server/config.yaml`:

```yaml
server:
  transport: "http"  # or "stdio"

database:
  provider: "falkordb"  # or "neo4j", "kuzu"
  providers:
    falkordb:
      uri: "redis://localhost:6379"
      database: "default_db"

llm:
  provider: "openai"  # or "anthropic", "gemini", "groq"
  model: "gpt-4.1-mini"

embedder:
  provider: "openai"
  model: "text-embedding-3-small"

graphiti:
  entity_types:
    - name: "Preference"
      description: "User preferences, choices, opinions"
    - name: "Requirement"
      description: "Specific needs or functionality requirements"
    - name: "Procedure"
      description: "Standard operating procedures"
```

## Search Strategies Deep Dive

### Understanding Rerankers

| Reranker | How It Works | Best For |
|----------|--------------|----------|
| **RRF** (Reciprocal Rank Fusion) | Combines rankings from multiple search methods | General-purpose, balanced results |
| **MMR** (Maximal Marginal Relevance) | Diversifies results to reduce redundancy | Exploring diverse aspects of a topic |
| **Node Distance** | Prioritizes facts near a center node | Graph-aware contextual search |
| **Episode Mentions** | Ranks by frequency in recent episodes | Trending or frequently mentioned facts |
| **Cross Encoder** | LLM-based relevance scoring | Highest accuracy, slower performance |

### Search Method Combinations

```python
from graphiti_core.search.search_config import (
    SearchConfig,
    EdgeSearchConfig,
    EdgeSearchMethod,
    EdgeReranker
)

# Custom search configuration
custom_config = SearchConfig(
    edge_config=EdgeSearchConfig(
        search_methods=[
            EdgeSearchMethod.bm25,              # Keyword search
            EdgeSearchMethod.cosine_similarity, # Semantic search
            EdgeSearchMethod.bfs                # Graph traversal
        ],
        reranker=EdgeReranker.cross_encoder,
        num_results=20  # Fetch 20 before reranking
    ),
    limit=5  # Return top 5 after reranking
)

results = await graphiti._search(
    query="AI research collaborations",
    config=custom_config
)
```

## Performance Optimization

### Concurrency Control

Graphiti uses semaphore-based concurrency for episode ingestion:

```bash
# Environment variable controls parallel LLM calls
export SEMAPHORE_LIMIT=10  # Default: 10 concurrent operations

# Tune based on LLM provider tier:
# OpenAI Tier 1 (free): SEMAPHORE_LIMIT=1-2
# OpenAI Tier 3: SEMAPHORE_LIMIT=10-15
# Anthropic default: SEMAPHORE_LIMIT=5-8
# Local Ollama: SEMAPHORE_LIMIT=1-5
```

### Batch Processing Best Practices

```python
# Process large datasets in batches
batch_size = 50
for i in range(0, len(all_episodes), batch_size):
    batch = all_episodes[i:i + batch_size]
    await graphiti.add_episode_bulk(
        batch,
        group_id="large_dataset"
    )
    print(f"Processed {i + len(batch)}/{len(all_episodes)}")
```

### Index Management

```python
# Rebuild indices for optimal performance
await graphiti.build_indices_and_constraints()

# Neo4j-specific: Use parallel runtime (Enterprise only)
import os
os.environ["USE_PARALLEL_RUNTIME"] = "true"
```

## Common Patterns

### Agent Memory System

```python
class AgentMemory:
    def __init__(self, agent_id: str):
        self.graphiti = Graphiti("bolt://localhost:7687", "neo4j", "password")
        self.agent_id = agent_id

    async def remember(self, interaction: str):
        """Store agent interaction"""
        await self.graphiti.add_episode(
            name=f"interaction_{datetime.now().isoformat()}",
            episode_body=interaction,
            source=EpisodeType.message,
            group_id=self.agent_id,
            reference_time=datetime.now(timezone.utc)
        )

    async def recall(self, query: str, k: int = 5):
        """Retrieve relevant memories"""
        results = await self.graphiti.search(
            query,
            group_ids=[self.agent_id],
            limit=k
        )
        return [edge.fact for edge in results.edges]

    async def get_context(self, n: int = 10):
        """Get recent conversation history"""
        episodes = await self.graphiti.retrieve_episodes(
            reference_time=datetime.now(timezone.utc),
            last_n=n,
            group_ids=[self.agent_id]
        )
        return [ep.content for ep in episodes]
```

### Temporal Fact Tracking

```python
async def track_entity_changes(entity_name: str):
    """Query all historical states of an entity"""
    results = await graphiti.search(entity_name)

    timeline = []
    for edge in results.edges:
        if entity_name.lower() in edge.fact.lower():
            timeline.append({
                "fact": edge.fact,
                "valid_from": edge.valid_at,
                "valid_until": edge.invalid_at,
                "is_current": edge.invalid_at is None
            })

    # Sort by validity period
    timeline.sort(key=lambda x: x["valid_from"])
    return timeline
```

### Knowledge Graph RAG

```python
async def graph_rag_query(question: str, k: int = 5):
    """Combine graph search with LLM generation"""
    # Step 1: Retrieve facts from knowledge graph
    results = await graphiti.search(question, limit=k)

    # Step 2: Format context from graph
    context = "\n".join([
        f"- {edge.fact} (as of {edge.valid_at})"
        for edge in results.edges
    ])

    # Step 3: Generate answer using LLM with graph context
    from openai import AsyncOpenAI
    client = AsyncOpenAI()

    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": "Answer using the provided knowledge graph facts."},
            {"role": "user", "content": f"Facts:\n{context}\n\nQuestion: {question}"}
        ]
    )

    return response.choices[0].message.content
```

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| 429 Rate Limit Errors | Reduce `SEMAPHORE_LIMIT` environment variable |
| Slow ingestion | Increase `SEMAPHORE_LIMIT`, check database indices |
| Duplicate entities | Tune entity deduplication threshold, use custom entity types |
| Missing search results | Check group_id filtering, rebuild indices |
| Database connection timeout | Verify database is running, check connection parameters |

### Debug Logging

```python
import logging

# Enable detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Log specific modules
logging.getLogger("graphiti_core.search").setLevel(logging.DEBUG)
logging.getLogger("graphiti_core.llm_client").setLevel(logging.INFO)
```

### OpenTelemetry Tracing

```python
from graphiti_core.tracer import create_tracer

# Enable distributed tracing
tracer = create_tracer("graphiti_app")

with tracer.start_as_current_span("episode_ingestion"):
    await graphiti.add_episode(...)
```

## When to Use Graphiti

**Ideal Use Cases:**
- AI agent memory systems with temporal reasoning
- Dynamic knowledge bases with real-time updates
- Multi-hop reasoning over entity relationships
- Combining RAG with graph structure
- Historical data analysis (who knew what when)
- Multi-tenant knowledge graphs

**Not Recommended For:**
- Static document collections (use traditional RAG)
- Simple key-value storage (use Redis/DynamoDB)
- Relational data without graph structure (use PostgreSQL)
- Ultra-low latency requirements (<10ms)

## Key Design Principles

1. **Episode-centric ingestion**: All data enters as episodes (text, JSON, messages)
2. **Automatic entity extraction**: LLM extracts nodes and edges from episodes
3. **Temporal invalidation**: New facts automatically invalidate contradictory old facts
4. **Hybrid retrieval**: Combine semantic, keyword, and graph-based search
5. **Group isolation**: Multi-tenant support via namespace partitioning

## Reference Files

Core Implementation:
- Main orchestration: `graphiti_core/graphiti.py`
- Node types: `graphiti_core/nodes.py`
- Edge types: `graphiti_core/edges.py`
- Search logic: `graphiti_core/search/search.py`
- Search recipes: `graphiti_core/search/search_config_recipes.py`

Temporal Operations:
- Bi-temporal tracking: `graphiti_core/utils/maintenance/temporal_operations.py`
- Edge extraction: `graphiti_core/utils/maintenance/edge_operations.py`
- Node deduplication: `graphiti_core/utils/maintenance/node_operations.py`

Integrations:
- MCP server: `mcp_server/README.md`
- FastAPI service: `server/README.md`

Examples:
- Quickstart: `examples/quickstart/README.md`
- Podcast temporal demo: `examples/podcast/podcast_runner.py`
- LangGraph agent: `examples/langgraph-agent/`

Documentation:
- Project overview: `README.md`
- Development guide: `CLAUDE.md`
- Contributing: `CONTRIBUTING.md`
- OpenTelemetry: `OTEL_TRACING.md`
