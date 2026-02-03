---
name: airweave
description: Build AI agents with semantic search across 30+ apps. Universal context retrieval layer connecting Stripe, GitHub, Notion, Slack, and more into searchable knowledge bases. Use for RAG, agent tools, multi-tenant search, or unified data access.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# Airweave Mastery

Universal context retrieval for AI agents across apps and databases.

## Territory Map

```
resources/knowledge_graphs/airweave/
├── backend/                      # FastAPI Python backend
│   ├── airweave/
│   │   ├── api/                  # REST endpoints
│   │   ├── search/               # Search operations
│   │   │   ├── operations/       # Query expansion, retrieval, reranking
│   │   │   └── providers/        # LLM providers (OpenAI, Anthropic, etc.)
│   │   ├── integrations/         # 30+ app connectors
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   └── platform/             # Qdrant, Temporal, Redis
│   ├── alembic/                  # Database migrations
│   └── pyproject.toml            # Dependencies
├── frontend/                     # React/TypeScript UI
│   └── src/
│       ├── components/           # ShadCN components
│       ├── pages/                # Collection, source, search UIs
│       └── services/             # API clients
├── mcp/                          # Model Context Protocol server
│   ├── src/
│   │   ├── tools/                # Search tools for AI agents
│   │   └── server.ts             # MCP server implementation
│   └── README.md                 # Deployment guide
├── monke/                        # Connector testing framework
│   ├── bongos/                   # 30+ connector implementations
│   ├── configs/                  # Connector configs (YAML)
│   └── generation/               # Test data generators
├── examples/                     # Tutorials and notebooks
│   ├── quickstart_tutorial.py    # Complete walkthrough
│   ├── intro_to_airweave.ipynb  # Jupyter notebook
│   └── search_concepts.ipynb    # Advanced search
└── docker/                       # Docker Compose configs
```

## Core Capabilities

- **30+ App Integrations**: Airtable, Asana, Notion, GitHub, Slack, Stripe, Zendesk, etc.
- **OAuth2 Multi-Tenant**: Secure authentication with multiple users/orgs
- **Incremental Sync**: Content hashing for efficient updates
- **Semantic Search**: Vector embeddings with Qdrant
- **Hybrid Search**: Combines semantic + keyword (BM25)
- **Query Expansion**: LLM-generated query variations
- **Reranking**: LLM-based result reordering
- **Temporal Relevance**: Recency bias for time-sensitive queries
- **Data Versioning**: Track changes over time
- **MCP Server**: Expose search as tools for AI agents

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React, TypeScript, ShadCN, Vite |
| Backend | FastAPI, Python 3.11+, Pydantic |
| Databases | PostgreSQL (metadata), Qdrant (vectors) |
| Orchestration | Temporal (workflows), Redis (pub/sub) |
| Embeddings | OpenAI, Mistral, FastEmbed (local) |
| LLMs | OpenAI, Anthropic, Cerebras, Groq, Cohere |
| Deployment | Docker Compose, Kubernetes (Helm) |

## Beginner Techniques

### Setup and Configuration

```bash
# Clone and start (self-hosted)
git clone https://github.com/airweave-ai/airweave.git
cd airweave
./start.sh

# Access UI at http://localhost:8080
# API docs at http://localhost:8001/docs
```

### Basic SDK Usage

```python
from airweave import AirweaveSDK

# Initialize client
client = AirweaveSDK(
    api_key="YOUR_API_KEY",
    base_url="https://api.airweave.ai"  # or http://localhost:8001
)

# Create a collection
collection = client.collections.create(name="My Knowledge Base")
collection_id = collection.readable_id

# Add source connection
source = client.source_connections.create(
    name="My Stripe Data",
    short_name="stripe",
    readable_collection_id=collection_id,
    authentication={
        "credentials": {"api_key": "sk_test_..."}
    }
)

# Basic search (semantic by default)
results = client.collections.search(
    readable_id=collection_id,
    query="Find failed payment transactions"
)

for result in results.results:
    print(f"Score: {result['score']}")
    print(f"Content: {result['payload']['md_content'][:200]}")
    print(f"Source: {result['payload']['source_name']}")
```

### TypeScript/JavaScript SDK

```typescript
import { AirweaveSDKClient, AirweaveSDKEnvironment } from "@airweave/sdk";

const client = new AirweaveSDKClient({
    apiKey: "YOUR_API_KEY",
    environment: AirweaveSDKEnvironment.Production
});

const collection = await client.collections.create({
    name: "My Knowledge Base"
});

const results = await client.collections.search(
    collection.readableId,
    { query: "customer complaints about billing" }
);
```

### Available Integrations

```python
# Common integrations (use short_name)
SOURCES = {
    "stripe": "Payment data",
    "github": "Repositories, issues, PRs",
    "notion": "Pages and databases",
    "slack": "Messages and threads",
    "jira": "Issues and projects",
    "linear": "Issues and projects",
    "zendesk": "Tickets and articles",
    "gmail": "Emails",
    "google_docs": "Documents",
    "google_drive": "Files",
    "confluence": "Pages and spaces",
    "salesforce": "CRM data",
    "hubspot": "CRM data",
    "airtable": "Bases and tables",
    "asana": "Tasks and projects",
    # ... and 15+ more
}
```

## Intermediate Techniques

### Hybrid Search (Semantic + Keyword)

```python
# Hybrid combines vector similarity with BM25 keyword matching
results = client.collections.search(
    readable_id=collection_id,
    query="customer invoices Q4 2024",
    search_type="hybrid"  # 'neural', 'keyword', or 'hybrid'
)
```

### Query Expansion

```python
# LLM generates query variations for better recall
results = client.collections.search(
    readable_id=collection_id,
    query="technical documentation",
    enable_query_expansion=True,  # Auto-generates 4 variations
    top_k=20
)
```

**How it works** (from `backend/airweave/search/operations/query_expansion.py`):

```python
# Original query: "technical documentation"
# LLM expands to:
alternatives = [
    "engineering documentation and guides",
    "developer reference materials",
    "API specifications and manuals",
    "system architecture documents"
]
# All variants are embedded and searched
```

### Reranking for Better Relevance

```python
# Fetch more candidates, then LLM reranks for precision
results = client.collections.search(
    readable_id=collection_id,
    query="privacy policy violations",
    enable_reranking=True,  # Uses LLM to reorder results
    limit=10  # Returns top 10 after reranking
)
```

**How it works** (from `backend/airweave/search/operations/retrieval.py`):

```python
# Fetch 2x candidates for reranking
RERANK_PREFETCH_MULTIPLIER = 2.0
fetch_limit = limit * RERANK_PREFETCH_MULTIPLIER  # Fetch 20, return 10

# Qdrant retrieves 20 results
# LLM reranks based on query relevance
# Returns top 10 best matches
```

### Recency Bias

```python
# Prioritize recent documents
results = client.collections.search(
    readable_id=collection_id,
    query="critical security bugs",
    recency_bias=0.8,  # 0.0 = ignore time, 1.0 = newest only
    limit=10
)
```

**Temporal decay formula** (from `backend/airweave/search/operations/temporal_relevance.py`):

```python
# Exponential decay based on document age
# newer_docs_score = base_score + recency_bonus
# older_docs_score = base_score - recency_penalty
```

### Advanced Filtering

```python
from airweave import SearchRequest, Filter, FieldCondition, MatchAny

search_request = SearchRequest(
    query="customer feedback",
    filter=Filter(
        must=[
            FieldCondition(
                key="source_name",
                match=MatchAny(any=["Stripe", "Zendesk", "Slack"])
            )
        ]
    ),
    score_threshold=0.7,  # Only high-quality results
    limit=10
)

results = client.collections.search_advanced(
    readable_id=collection_id,
    search_request=search_request
)
```

## Advanced Techniques

### MCP Server Integration

```json
// Claude Desktop config (~/.claude/mcp.json)
{
  "mcpServers": {
    "airweave-search": {
      "command": "npx",
      "args": ["airweave-mcp-search"],
      "env": {
        "AIRWEAVE_API_KEY": "your-api-key",
        "AIRWEAVE_COLLECTION": "your-collection-id",
        "AIRWEAVE_BASE_URL": "https://api.airweave.ai"
      }
    }
  }
}
```

**MCP Tool Usage** (from `mcp/README.md`):

```typescript
// AI agent can now use natural language:
// "Search for customer feedback about pricing"
// "Find documents related to API documentation"
// "Look up information about data privacy policies"

// Tool parameters (from mcp/src/tools/search.ts):
interface SearchParams {
  query: string;                    // Required
  response_type?: "raw" | "completion";  // AI-generated answer
  limit?: number;                   // Max results (1-1000)
  offset?: number;                  // Pagination
  recency_bias?: number;            // 0..1
  score_threshold?: number;         // Min similarity
  search_method?: "hybrid" | "neural" | "keyword";
  expansion_strategy?: "auto" | "llm" | "no_expansion";
  enable_reranking?: boolean;
  enable_query_interpretation?: boolean;
}
```

### Custom Connector Development

```python
# From monke/bongos/base_bongo.py
from abc import ABC, abstractmethod
from typing import Any, Dict, List

class BaseBongo(ABC):
    """Base class for connector implementations."""

    def __init__(self, credentials: Dict[str, Any]):
        self.credentials = credentials
        self.created_entities = []

    @abstractmethod
    async def create_entities(self) -> List[Dict[str, Any]]:
        """Fetch data from external API."""
        pass

    @abstractmethod
    async def update_entities(self) -> List[Dict[str, Any]]:
        """Handle incremental updates."""
        pass

    @abstractmethod
    async def delete_entities(self) -> List[str]:
        """Handle deletions."""
        pass
```

**Example: GitHub Connector Config** (from `monke/configs/github.yaml`):

```yaml
name: "GitHub Connector"
description: "Sync GitHub repos, issues, PRs"

connector:
  name: "github"
  type: "github"
  auth_mode: composio
  config_fields:
    repo_name: "owner/repo"
    branch: "main"

test_flow:
  steps:
    - cleanup
    - create       # Fetch from GitHub API
    - sync         # First sync (full)
    - verify
    - update       # Incremental changes
    - sync         # Second sync (incremental)
    - verify
```

### Search Pipeline Architecture

**Operations executed in sequence** (from `backend/airweave/search/`):

```python
# 1. QueryInterpretation: Extract filters from natural language
# "Find Stripe invoices from last month"
# → filter: {source_name: "Stripe", date_range: "last_month"}

# 2. QueryExpansion: Generate semantic variations (if enabled)
# "technical docs" → ["API reference", "developer guides", ...]

# 3. EmbedQuery: Convert queries to vectors
# Uses OpenAI, Mistral, or FastEmbed

# 4. UserFilter: Apply explicit filters

# 5. TemporalRelevance: Calculate recency decay (if recency_bias > 0)

# 6. Retrieval: Search Qdrant with embeddings + filters
# Hybrid search combines dense + sparse vectors

# 7. Reranking: LLM reorders results (if enabled)

# 8. GenerateAnswer: Create AI response (if response_type="completion")
```

**Retrieval Implementation** (from `backend/airweave/search/operations/retrieval.py`):

```python
class Retrieval(SearchOperation):
    """Execute vector similarity search in Qdrant."""

    RERANK_PREFETCH_MULTIPLIER = 2.0

    async def execute(self, context, state, ctx):
        # Get embeddings from state
        dense_embeddings = state.get("dense_embeddings")
        sparse_embeddings = state.get("sparse_embeddings")
        filter_dict = state.get("filter")
        decay_config = state.get("decay_config")

        # Determine search method
        search_method = self._get_search_method()  # hybrid/neural/keyword

        # Calculate fetch limit (2x if reranking enabled)
        has_reranking = context.reranking is not None
        fetch_limit = self._calculate_fetch_limit(has_reranking)

        # Execute search
        if is_bulk:
            results = await destination.bulk_search(
                query_vectors=dense_embeddings,
                limit=fetch_limit,
                filter_conditions=filter_conditions,
                sparse_vectors=sparse_embeddings,
                search_method=search_method,
                decay_config=decay_config
            )
        else:
            results = await destination.search(
                query_vector=dense_embeddings[0],
                limit=fetch_limit,
                filter=filter_dict,
                sparse_vector=sparse_embeddings[0],
                search_method=search_method,
                decay_config=decay_config
            )

        # Deduplicate and paginate
        deduplicated = self._deduplicate_results(results)
        paginated = self._apply_pagination(deduplicated)

        state["results"] = paginated
```

### Multi-Tenancy and Authentication

```python
# OAuth2 flow for app integrations
# Each user has separate credentials per source

# From backend/airweave/api/auth.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    token = credentials.credentials
    # Validate JWT token
    payload = decode_token(token)
    user = await get_user_by_id(payload["user_id"])
    return user

# Collections are scoped to organizations
# API keys are encrypted in PostgreSQL
# Temporal workflows run with user context
```

### Data Sync with Temporal

```python
# Temporal workflow orchestrates sync jobs
# Handles retries, state persistence, long-running tasks

# Workflow steps:
# 1. Fetch data from external API (GitHub, Stripe, etc.)
# 2. Transform to standard entity format
# 3. Compute content hash for deduplication
# 4. Generate embeddings (batch processing)
# 5. Upsert to Qdrant (vector DB)
# 6. Update PostgreSQL metadata
# 7. Mark sync job complete

# Incremental sync:
# - Store cursor/timestamp from last sync
# - Only fetch new/updated records
# - Use content hash to detect changes
# - Delete entities removed from source
```

### AI-Generated Answers

```python
# Return AI-processed response instead of raw results
answer = client.collections.search(
    readable_id=collection_id,
    query="What are our customer refund policies?",
    response_type="completion",  # "raw" for results, "completion" for AI answer
    enable_reranking=True
)

print(answer.completion)  # AI-generated answer with citations
```

**How it works** (from `backend/airweave/search/operations/generate_answer.py`):

```python
# 1. Retrieve top results from vector search
# 2. Extract relevant snippets
# 3. Prompt LLM with context:
#    "Based on these documents, answer: {query}"
# 4. Stream or return complete answer
# 5. Include source citations
```

## Search Strategy Matrix

| Use Case | Search Type | Expansion | Reranking | Recency Bias |
|----------|-------------|-----------|-----------|--------------|
| Exact keyword match | keyword | no_expansion | false | 0.0 |
| Semantic similarity | neural | auto | true | 0.0 |
| Balanced precision/recall | hybrid | auto | true | 0.0 |
| Time-sensitive queries | hybrid | auto | true | 0.7-0.9 |
| Exploratory search | neural | llm | true | 0.0 |
| High-precision retrieval | neural | no_expansion | true | 0.0 |

## When to Use Airweave

- **Multi-App RAG**: Search across GitHub, Notion, Slack, Stripe in one query
- **Agent Context Retrieval**: Provide AI agents with live data from 30+ apps
- **Unified Search**: Single API for heterogeneous data sources
- **Multi-Tenant Apps**: SaaS with per-user OAuth to external services
- **Incremental Sync**: Keep embeddings fresh without full re-indexing
- **Hybrid Search**: Combine semantic understanding with keyword precision
- **Time-Aware Search**: Prioritize recent documents over old ones

## Reference Files

| Feature | File |
|---------|------|
| Quick start | `examples/quickstart_tutorial.py` |
| Search concepts | `examples/search_concepts.ipynb` |
| MCP server | `mcp/README.md` |
| Query expansion | `backend/airweave/search/operations/query_expansion.py` |
| Retrieval logic | `backend/airweave/search/operations/retrieval.py` |
| Temporal relevance | `backend/airweave/search/operations/temporal_relevance.py` |
| Reranking | `backend/airweave/search/operations/reranking.py` |
| Connector base | `monke/bongos/base_bongo.py` |
| GitHub connector | `monke/configs/github.yaml` |
| API routes | `backend/airweave/api/v1/` |
| Frontend UI | `frontend/src/pages/` |
| Docker setup | `docker/docker-compose.yml` |
| Python SDK | `backend/airweave/schemas/` (Pydantic models) |

## Common Patterns

### Pattern 1: Multi-Source Knowledge Base

```python
# Connect multiple sources to one collection
sources = ["stripe", "zendesk", "slack", "notion"]

for source_type in sources:
    client.source_connections.create(
        name=f"My {source_type.title()} Data",
        short_name=source_type,
        readable_collection_id=collection_id,
        authentication={
            "credentials": get_credentials(source_type)
        }
    )

# Search across all sources
results = client.collections.search(
    readable_id=collection_id,
    query="customer complaints about billing errors",
    search_type="hybrid",
    enable_reranking=True
)
```

### Pattern 2: Agent Tool with MCP

```python
# MCP exposes search as a tool for Claude/GPT
# Agent decides when to search based on user query

# User: "Find my Stripe customer data for john@example.com"
# Agent uses MCP tool:
search({
  query: "john@example.com customer data",
  response_type: "raw",
  enable_query_interpretation: true  # Extracts filters
})

# Returns structured results
# Agent formats for user
```

### Pattern 3: Continuous Sync

```python
# Set up automatic incremental sync
# Temporal runs periodic workflows

# Initial full sync: Fetches all data
# Subsequent syncs: Only new/updated records
# Content hashing detects unchanged docs (skip embed)
# Cursor-based pagination for large datasets
```

### Pattern 4: Semantic + Metadata Filtering

```python
# Combine vector similarity with structured filters
from airweave import SearchRequest, Filter, FieldCondition, MatchAny, Range

search_request = SearchRequest(
    query="critical security vulnerabilities",
    filter=Filter(
        must=[
            FieldCondition(
                key="source_name",
                match=MatchAny(any=["GitHub", "Jira"])
            ),
            FieldCondition(
                key="created_at",
                range=Range(
                    gte="2024-01-01",
                    lte="2024-12-31"
                )
            )
        ]
    ),
    search_type="hybrid",
    enable_reranking=True,
    limit=20
)

results = client.collections.search_advanced(
    readable_id=collection_id,
    search_request=search_request
)
```

## Performance Optimization

```python
# Tune search for speed vs. quality tradeoffs

# Fast search (keyword only, no LLM)
results = client.collections.search(
    readable_id=collection_id,
    query="API documentation",
    search_type="keyword",
    expansion_strategy="no_expansion",
    enable_reranking=False,
    limit=10
)

# High-quality search (all features)
results = client.collections.search(
    readable_id=collection_id,
    query="API documentation",
    search_type="hybrid",
    expansion_strategy="llm",
    enable_reranking=True,
    score_threshold=0.8,
    limit=10
)

# Balanced (recommended default)
results = client.collections.search(
    readable_id=collection_id,
    query="API documentation",
    search_type="hybrid",
    enable_query_expansion=True,
    enable_reranking=True,
    limit=10
)
```

## Deployment Modes

```bash
# Development (Docker Compose)
./start.sh
# Services: frontend, backend, postgres, qdrant, temporal, redis

# Production (Kubernetes)
helm upgrade --install airweave ./helm/airweave \
  --set image.tag=v1.0.0 \
  --set ingress.enabled=true

# MCP Server (Local)
npx airweave-mcp-search

# MCP Server (Hosted)
# Deployed to Azure Kubernetes Service
# Available at https://mcp.airweave.ai
```
