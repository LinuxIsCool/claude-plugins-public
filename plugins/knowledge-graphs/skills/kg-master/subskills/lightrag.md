# LightRAG: Simple and Fast Retrieval-Augmented Generation

## Overview

LightRAG is a production-grade RAG framework featuring dual-level retrieval (entity + relation + chunks), multiple query modes, comprehensive storage backends, and enterprise deployment patterns. Unlike traditional RAG systems, LightRAG constructs a knowledge graph during document indexing to enable sophisticated multi-hop reasoning and contextual retrieval.

**Core Differentiators:**
- Dual-level graph-based retrieval architecture
- 6 specialized query modes for different use cases
- Production-ready with 13+ storage backend options
- Built-in evaluation with RAGAS framework
- Reranking support for improved precision
- Langfuse observability integration
- Citation and document traceability
- Web UI and REST API server

**Version:** 1.4.9.9
**Repository:** https://github.com/HKUDS/LightRAG
**Paper:** arXiv:2410.05779

---

## Architecture & Query Modes

### Dual-Level Retrieval System

LightRAG's retrieval architecture operates on three data layers:

1. **Entity Layer (Local Context):** Named entities extracted from documents with descriptions
2. **Relation Layer (Global Context):** Relationships between entities with semantic descriptions
3. **Chunk Layer (Raw Context):** Original document text chunks with embeddings

This tri-level structure enables both fine-grained local searches and high-level global reasoning.

### Query Mode Comparison

| Mode | Use Case | Retrieval Strategy | Performance | Ideal For |
|------|----------|-------------------|-------------|-----------|
| **naive** | Simple keyword lookup | Vector similarity on chunks only | Fast, lower quality | Quick prototypes, simple Q&A |
| **local** | Entity-focused queries | Entity-centric subgraph + related chunks | Medium speed, high precision | "What did Person X do?", specific entities |
| **global** | High-level summaries | Relation-level knowledge graph traversal | Slower, comprehensive | "What are the main themes?", strategic analysis |
| **hybrid** | Balanced retrieval | Entity + relation + chunk fusion | Medium-slow, best accuracy | General-purpose, production default |
| **mix** | Rerank-optimized | Graph + vector retrieval with reranking | Variable, highest precision | When reranker configured, recommended default |
| **bypass** | Direct LLM query | No retrieval, pure LLM generation | Fastest, no grounding | Testing, non-factual tasks |

**Recommended Defaults:**
- **With reranker configured:** `mode="mix"` (enables automatic reranking)
- **Without reranker:** `mode="hybrid"` (best balance of accuracy and speed)
- **Production queries:** `mode="mix"` or `mode="hybrid"`
- **Development/testing:** `mode="naive"` or `mode="local"`

**Query Mode Selection Decision Tree:**

```
Do you have specific entities to query?
├─ Yes → Use `local` mode
└─ No → Do you need comprehensive analysis?
    ├─ Yes → Use `global` mode
    └─ No → Is reranker configured?
        ├─ Yes → Use `mix` mode (recommended)
        └─ No → Use `hybrid` mode
```

### Query Parameters

```python
from lightrag import QueryParam

param = QueryParam(
    mode="mix",                    # Query mode (see table above)
    only_need_context=False,       # Return only context, skip LLM generation
    only_need_prompt=False,        # Return only the constructed prompt
    response_type="Multiple Paragraphs",  # Output format control
    stream=False,                  # Enable streaming responses
    top_k=60,                      # Entities (local) / relations (global)
    chunk_top_k=20,                # Text chunks retrieved
    max_entity_tokens=6000,        # Token budget for entity context
    max_relation_tokens=8000,      # Token budget for relation context
    max_total_tokens=30000,        # Overall context window budget
    conversation_history=[],       # Chat history for context
    ids=None,                      # Filter by document IDs
    model_func=None,               # Override LLM for this query
    user_prompt=None,              # Additional instructions for LLM
    enable_rerank=True             # Enable reranking (if rerank_model_func configured)
)

result = await rag.aquery("Your question here", param=param)
```

**Parameter Tuning Guidelines:**

- **top_k:** Higher values (60-100) for comprehensive coverage, lower (10-30) for speed
- **chunk_top_k:** Typically 20-40; higher values increase context but may add noise
- **enable_rerank:** Set `True` when using `mix` mode or when reranker configured
- **max_total_tokens:** Must be less than LLM context window (recommend 50-70% of max)

---

## Storage Backend Selection Guide

### Storage Architecture

LightRAG uses 4 independent storage systems:

1. **KV_STORAGE:** Document content, text chunks, LLM cache
2. **VECTOR_STORAGE:** Entity embeddings, relation embeddings, chunk embeddings
3. **GRAPH_STORAGE:** Entity-relation graph structure
4. **DOC_STATUS_STORAGE:** Document indexing status tracking

### Storage Implementation Matrix

| Storage Type | Implementations | Production Grade | Workspace Isolation |
|--------------|----------------|------------------|---------------------|
| **KV** | JsonKVStorage (default), PGKVStorage, RedisKVStorage, MongoKVStorage | Redis/PG/Mongo only | Subdirectory or field-based |
| **VECTOR** | NanoVectorDBStorage (default), PGVectorStorage, MilvusVectorDBStorage, QdrantVectorDBStorage, FaissVectorDBStorage, MongoVectorDBStorage | All except Nano | Collection prefix or payload |
| **GRAPH** | NetworkXStorage (default), Neo4JStorage, PGGraphStorage, MemgraphStorage | Neo4J/Memgraph only | Label-based or prefix |
| **DOC_STATUS** | JsonDocStatusStorage (default), PGDocStatusStorage, MongoDocStatusStorage | PG/Mongo only | Subdirectory or field-based |

### Production Storage Recommendations

#### Scenario 1: All-in-One PostgreSQL (Recommended for Most Production)

**Best for:** Single-server deployments, moderate scale (up to 10M chunks), cost-sensitive

```python
# Environment variables
POSTGRES_URI=postgresql://user:pass@localhost:5432/lightrag

# LightRAG configuration
rag = LightRAG(
    working_dir="./rag_storage",
    kv_storage="PGKVStorage",
    vector_storage="PGVectorStorage",
    graph_storage="PGGraphStorage",
    doc_status_storage="PGDocStatusStorage",
    embedding_func=embedding_func,
    llm_model_func=llm_func
)
```

**Pros:**
- Single database, simplified operations
- ACID guarantees across all storage
- Mature backup/replication tools
- Cost-effective (no additional services)

**Cons:**
- Graph queries slower than Neo4J (use Neo4J for high-performance graphs)
- Vector search not as optimized as dedicated vector DBs

**PostgreSQL Requirements:**
- Version 16.6+ recommended
- Extensions: pgvector, Apache AGE (for graph storage)
- Minimum 4GB RAM, 8GB+ recommended for production

#### Scenario 2: High-Performance Graph + Vector (Large Scale)

**Best for:** Large scale (100M+ chunks), high query throughput, complex graph traversals

```python
# Environment variables
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=yourpassword
MILVUS_URI=http://localhost:19530
MILVUS_USER=root
MILVUS_PASSWORD=Milvus
REDIS_URI=redis://localhost:6379

# LightRAG configuration
rag = LightRAG(
    working_dir="./rag_storage",
    kv_storage="RedisKVStorage",
    vector_storage="MilvusVectorDBStorage",
    graph_storage="Neo4JStorage",
    doc_status_storage="RedisKVStorage",
    embedding_func=embedding_func,
    llm_model_func=llm_func
)
```

**Pros:**
- Neo4J: Superior graph query performance, advanced graph algorithms
- Milvus: Optimized vector search, GPU acceleration support
- Redis: Fast KV operations, built-in caching

**Cons:**
- Higher operational complexity (3 separate services)
- Increased infrastructure costs
- More complex backup strategies

**Resource Requirements:**
- Neo4J: 8GB+ RAM, SSD storage
- Milvus: 16GB+ RAM, GPU optional but recommended
- Redis: 4GB+ RAM, persistence configured

#### Scenario 3: MongoDB All-in-One (Document-Centric)

**Best for:** Document-heavy workloads, JSON-native data, cloud deployments (MongoDB Atlas)

```python
# Environment variables
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=lightrag

# LightRAG configuration
rag = LightRAG(
    working_dir="./rag_storage",
    kv_storage="MongoKVStorage",
    vector_storage="MongoVectorDBStorage",
    graph_storage="MongoGraphStorage",
    doc_status_storage="MongoDocStatusStorage",
    embedding_func=embedding_func,
    llm_model_func=llm_func
)
```

**Pros:**
- JSON-native storage, schema flexibility
- MongoDB Atlas provides managed service
- Good for document-heavy applications

**Cons:**
- Vector search requires MongoDB Atlas (not available in self-hosted)
- Graph operations implemented as collections (not true graph DB)

#### Scenario 4: Lightweight Development (Default)

**Best for:** Development, testing, small datasets, local prototypes

```python
# No environment variables needed
# All storage uses local JSON/NetworkX files

rag = LightRAG(
    working_dir="./rag_storage",
    # kv_storage="JsonKVStorage",           # default
    # vector_storage="NanoVectorDBStorage", # default
    # graph_storage="NetworkXStorage",      # default
    # doc_status_storage="JsonDocStatusStorage", # default
    embedding_func=embedding_func,
    llm_model_func=llm_func
)
```

**Pros:**
- Zero configuration
- No external dependencies
- Fast iteration

**Cons:**
- Not scalable
- Limited concurrency support
- No production durability guarantees

### Storage Selection Decision Matrix

| Factor | PostgreSQL All-in-One | Neo4J + Milvus + Redis | MongoDB All-in-One | Default (Files) |
|--------|----------------------|----------------------|-------------------|-----------------|
| **Setup Complexity** | Low | High | Medium | Minimal |
| **Operational Cost** | Low | High | Medium | Minimal |
| **Graph Performance** | Medium | Excellent | Low | Low |
| **Vector Performance** | Good | Excellent | Medium (Atlas only) | Poor |
| **Scalability** | Good (10M chunks) | Excellent (100M+ chunks) | Good | Poor (<1M chunks) |
| **Multi-tenancy** | Excellent | Good | Good | Poor |
| **Backup/Recovery** | Excellent | Medium | Excellent | Poor |

### Multi-Instance Data Isolation (Workspaces)

When running multiple LightRAG instances sharing the same database:

```python
# Instance 1
rag1 = LightRAG(
    working_dir="./rag_storage",
    workspace="tenant_a",  # Isolates data by workspace
    kv_storage="PGKVStorage",
    # ... other config
)

# Instance 2
rag2 = LightRAG(
    working_dir="./rag_storage",
    workspace="tenant_b",  # Different workspace
    kv_storage="PGKVStorage",
    # ... same storage backend
)
```

**Workspace Isolation Mechanisms:**

- **File-based storage:** Subdirectory per workspace (`working_dir/workspace_name/`)
- **Collection-based (Redis, Milvus, Mongo):** Prefix in collection names (`workspace_entities`, `workspace_chunks`)
- **Table-based (PostgreSQL):** `workspace` column for logical separation
- **Graph DBs (Neo4J, Memgraph):** Node/edge labels for isolation
- **Qdrant:** Payload-based filtering (recommended multitenancy approach)

**Environment Variable Overrides:**

Each storage type supports dedicated workspace variables:

```bash
WORKSPACE=default                # Global default
POSTGRES_WORKSPACE=pg_space      # Override for PostgreSQL
NEO4J_WORKSPACE=neo4j_space      # Override for Neo4J
REDIS_WORKSPACE=redis_space      # Override for Redis
MILVUS_WORKSPACE=milvus_space    # Override for Milvus
MONGODB_WORKSPACE=mongo_space    # Override for MongoDB
QDRANT_WORKSPACE=qdrant_space    # Override for Qdrant
MEMGRAPH_WORKSPACE=mem_space     # Override for Memgraph
```

---

## LLM and Embedding Model Requirements

### LLM Selection Criteria

LightRAG has **significantly higher LLM requirements** than traditional RAG due to entity-relationship extraction tasks.

**Minimum Requirements:**
- **Parameters:** 32B+ (smaller models produce poor entity extraction)
- **Context Length:** 32KB minimum, 64KB+ recommended
- **Capability:** Strong instruction-following for structured extraction

**Recommended Models:**

| Use Case | Model | Context | Notes |
|----------|-------|---------|-------|
| **Production Indexing** | GPT-4o, Claude Opus 4.5, Gemini Pro | 128K+ | High-quality entity extraction |
| **Production Querying** | GPT-4o, Claude Opus 4.5 | 128K+ | Use stronger models than indexing |
| **Development** | GPT-4o-mini, Gemini Flash | 64K+ | Acceptable for testing |
| **Self-Hosted** | Qwen2.5-32B, Llama-3.3-70B | 32K+ | Requires GPU infrastructure |

**Important Notes:**

- **Indexing vs Querying:** Use stronger models for querying than indexing for best results
- **Avoid Reasoning Models for Indexing:** Models like o1/o1-mini add latency without improving extraction quality
- **Context Window:** Must accommodate `MAX_TOTAL_TOKENS + 2000` for system prompts

**Supported LLM Backends:**

- OpenAI / OpenAI-compatible (vLLM, SGLang, LocalAI)
- Anthropic Claude
- Google Gemini
- AWS Bedrock
- Azure OpenAI
- Ollama (local)
- LMDeploy (local)
- HuggingFace Transformers
- LlamaIndex integration

### Embedding Model Selection

**Requirements:**
- **Critical:** Must be consistent across indexing and querying phases
- **Dimension:** Defined at first database initialization (cannot change without recreating vector tables)

**Recommended Models:**

| Model | Dimension | Max Tokens | Best For |
|-------|-----------|------------|----------|
| **text-embedding-3-large** | 3072 | 8191 | Highest quality, OpenAI |
| **BAAI/bge-m3** | 1024 | 8192 | Multilingual, self-hosted |
| **text-embedding-3-small** | 1536 | 8191 | Cost-effective, OpenAI |
| **sentence-transformers/all-MiniLM-L6-v2** | 384 | 512 | Lightweight, fast |
| **nomic-embed-text** (Ollama) | 768 | 8192 | Local, Ollama-native |

**Embedding Model Configuration:**

```python
import numpy as np
from lightrag.utils import wrap_embedding_func_with_attrs
from lightrag.llm.openai import openai_embed

@wrap_embedding_func_with_attrs(embedding_dim=3072, max_token_size=8192)
async def embedding_func(texts: list[str]) -> np.ndarray:
    return await openai_embed(
        texts,
        model="text-embedding-3-large",
        api_key=os.getenv("OPENAI_API_KEY")
    )

rag = LightRAG(
    working_dir="./rag_storage",
    embedding_func=embedding_func,  # Use decorated function
    # ...
)
```

**Important:** When changing embedding models:
1. Delete existing vector storage tables/collections
2. LightRAG will recreate with new dimensions
3. Re-index all documents

### Reranker Configuration (Optional but Recommended)

Rerankers significantly improve retrieval precision by re-scoring retrieved chunks based on query relevance.

**Supported Reranker Providers:**

| Provider | Model Example | Setup |
|----------|--------------|-------|
| **Cohere** | `rerank-v3.5` | `RERANK_BINDING=cohere` |
| **Jina AI** | `jina-reranker-v2` | `RERANK_BINDING=jina` |
| **Aliyun** | `gte-rerank` | `RERANK_BINDING=ali` |
| **vLLM (self-hosted)** | `BAAI/bge-reranker-v2-m3` | `RERANK_BINDING=cohere` (OpenAI-compatible) |

**Reranker Example (Cohere):**

```python
from functools import partial
from lightrag.rerank import cohere_rerank

rerank_func = partial(
    cohere_rerank,
    model="rerank-v3.5",
    api_key=os.getenv("COHERE_API_KEY"),
    base_url="https://api.cohere.com/v2/rerank",
    enable_chunking=True,      # Chunk long documents
    max_tokens_per_doc=480     # Tokens per chunk
)

rag = LightRAG(
    working_dir="./rag_storage",
    embedding_func=embedding_func,
    llm_model_func=llm_func,
    rerank_model_func=rerank_func,  # Inject reranker
)

# Query with reranking enabled (default when rerank_func configured)
result = await rag.aquery(
    "Your question",
    param=QueryParam(
        mode="mix",           # Recommended when reranker configured
        enable_rerank=True    # Default is True
    )
)
```

**Reranker Best Practices:**

- **Always use `mode="mix"`** when reranker is configured (default recommendation)
- Set `enable_rerank=True` in QueryParam (default value)
- Configure `chunk_top_k` to retrieve more candidates for reranking (e.g., 40-60)
- Monitor API costs (reranking calls proportional to retrieved chunks)

---

## Production Deployment Patterns

### Deployment Architecture Options

#### 1. Docker Compose (Recommended for Single-Server)

**Use Case:** Small to medium deployments, single-server, simplified operations

```yaml
# docker-compose.yml
version: '3.8'
services:
  lightrag:
    image: ghcr.io/hkuds/lightrag:latest
    ports:
      - "9621:9621"
    environment:
      - WORKSPACE=production
      - LLM_BINDING=openai
      - LLM_MODEL=gpt-4o-mini
      - LLM_BINDING_API_KEY=${OPENAI_API_KEY}
      - EMBEDDING_BINDING=openai
      - EMBEDDING_MODEL=text-embedding-3-large
      - EMBEDDING_DIM=3072
      - POSTGRES_URI=postgresql://user:pass@postgres:5432/lightrag
    volumes:
      - ./data/rag_storage:/app/rag_storage
      - ./data/inputs:/app/inputs
    depends_on:
      - postgres

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: yourpassword
      POSTGRES_DB: lightrag
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Start:**
```bash
docker compose up -d
```

#### 2. Kubernetes (Recommended for Multi-Server)

**Use Case:** Large scale, high availability, auto-scaling

```yaml
# k8s-deploy/lightrag-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lightrag
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lightrag
  template:
    metadata:
      labels:
        app: lightrag
    spec:
      containers:
      - name: lightrag
        image: ghcr.io/hkuds/lightrag:latest
        ports:
        - containerPort: 9621
        env:
        - name: WORKSPACE
          value: "production"
        - name: LLM_BINDING
          value: "openai"
        - name: LLM_MODEL
          value: "gpt-4o-mini"
        - name: EMBEDDING_BINDING
          value: "openai"
        - name: EMBEDDING_MODEL
          value: "text-embedding-3-large"
        envFrom:
        - secretRef:
            name: lightrag-secrets
        volumeMounts:
        - name: rag-storage
          mountPath: /app/rag_storage
      volumes:
      - name: rag-storage
        persistentVolumeClaim:
          claimName: rag-storage-pvc
```

**Deploy:**
```bash
kubectl apply -f k8s-deploy/
```

#### 3. Gunicorn + Uvicorn Multi-Worker (Production Server)

**Use Case:** CPU-intensive document processing, high concurrency, production web server

```bash
# Install with API extras
pip install "lightrag-hku[api]"

# Start with Gunicorn
lightrag-gunicorn --workers 4 --host 0.0.0.0 --port 9621
```

**Configuration (.env):**
```bash
# Worker configuration
WORKERS=4                    # Number of processes (2*CPU+1 max)
MAX_PARALLEL_INSERT=2        # Parallel documents per worker
MAX_ASYNC=4                  # Concurrent LLM requests

# Server configuration
HOST=0.0.0.0
PORT=9621
TIMEOUT=150                  # Request timeout in seconds
```

**Why Gunicorn + Uvicorn?**
- **Multi-process:** Prevents document indexing from blocking queries
- **CPU-intensive tools:** Docling, PDF extraction benefit from multiprocessing
- **High availability:** Worker process crash doesn't affect other workers
- **Horizontal scaling:** Multiple workers share database backends

**Note:** Gunicorn mode not supported on Windows (use Docker instead)

#### 4. Multiple LightRAG Instances (Multi-Tenancy)

**Use Case:** SaaS applications, multi-tenant systems, isolated workspaces

**Approach 1: Separate Containers**

```yaml
# docker-compose.yml
version: '3.8'
services:
  lightrag-tenant1:
    image: ghcr.io/hkuds/lightrag:latest
    ports:
      - "9621:9621"
    environment:
      - WORKSPACE=tenant1
      - PORT=9621
      # ... other config

  lightrag-tenant2:
    image: ghcr.io/hkuds/lightrag:latest
    ports:
      - "9622:9621"
    environment:
      - WORKSPACE=tenant2
      - PORT=9621
      # ... other config
```

**Approach 2: Single Server with CLI Arguments**

```bash
# Terminal 1: Tenant A
lightrag-server --port 9621 --workspace tenant_a

# Terminal 2: Tenant B
lightrag-server --port 9622 --workspace tenant_b
```

**Data Isolation Verification:**

Each workspace gets isolated:
- PostgreSQL: `workspace` column filtering
- Neo4J: Label-based isolation (`tenant_a_Entity`)
- Redis: Key prefixing (`tenant_a:entities`)
- File-based: Subdirectories (`working_dir/tenant_a/`)

### Environment Configuration Best Practices

**Production .env Template:**

```bash
# === Server Configuration ===
HOST=0.0.0.0
PORT=9621
WORKERS=4
TIMEOUT=150
LOG_LEVEL=INFO

# === Workspace & Storage ===
WORKSPACE=production
WORKING_DIR=/app/rag_storage
INPUT_DIR=/app/inputs

# === LLM Configuration ===
LLM_BINDING=openai
LLM_MODEL=gpt-4o-mini
LLM_BINDING_HOST=https://api.openai.com/v1
LLM_BINDING_API_KEY=sk-your-key-here

# === Embedding Configuration ===
EMBEDDING_BINDING=openai
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIM=3072
EMBEDDING_BINDING_HOST=https://api.openai.com/v1
EMBEDDING_BINDING_API_KEY=sk-your-key-here

# === Reranker Configuration (Optional) ===
RERANK_BINDING=cohere
RERANK_MODEL=rerank-v3.5
RERANK_BINDING_HOST=https://api.cohere.com/v2/rerank
RERANK_BINDING_API_KEY=your-cohere-key
RERANK_ENABLE_CHUNKING=true
RERANK_MAX_TOKENS_PER_DOC=480

# === Storage Backends ===
POSTGRES_URI=postgresql://user:pass@localhost:5432/lightrag
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=yourpassword

# === Performance Tuning ===
MAX_ASYNC=4                    # Concurrent LLM calls
MAX_PARALLEL_INSERT=2          # Parallel document processing
CHUNK_TOKEN_SIZE=1200          # Chunk size for splitting
CHUNK_OVERLAP=100              # Overlap between chunks
TOP_K=60                       # Default top_k for queries
CHUNK_TOP_K=20                 # Default chunk retrieval
MAX_TOTAL_TOKENS=30000         # Context budget
COSINE_THRESHOLD=0.2           # Vector similarity threshold

# === Observability (Optional) ===
LANGFUSE_ENABLE_TRACE=true
LANGFUSE_SECRET_KEY=your-secret
LANGFUSE_PUBLIC_KEY=your-public
LANGFUSE_HOST=https://cloud.langfuse.com

# === Evaluation (Optional) ===
EVAL_LLM_MODEL=gpt-4o-mini
EVAL_EMBEDDING_MODEL=text-embedding-3-large
EVAL_MAX_CONCURRENT=2
EVAL_QUERY_TOP_K=10
```

**Security Considerations:**

1. **Never commit .env to version control** (add to .gitignore)
2. **Use secrets management:** Kubernetes Secrets, AWS Secrets Manager, HashiCorp Vault
3. **Rotate API keys regularly**
4. **Restrict database access:** Firewall rules, VPC isolation
5. **Enable authentication:** Use LightRAG's built-in auth or reverse proxy (nginx, Traefik)

### API Server and Web UI

LightRAG Server provides:

- **REST API:** Full CRUD operations for documents, entities, relations
- **Ollama-Compatible API:** Use LightRAG as a drop-in Ollama replacement
- **Web UI Dashboard:** Document upload, knowledge graph visualization, query interface
- **Streaming Support:** Real-time query response streaming

**Starting the Server:**

```bash
# Development mode (Uvicorn)
lightrag-server --host 0.0.0.0 --port 9621

# Production mode (Gunicorn + Uvicorn)
lightrag-gunicorn --workers 4 --host 0.0.0.0 --port 9621
```

**API Endpoints:**

- `POST /insert` - Insert documents
- `POST /query` - Query knowledge base
- `GET /entities` - List entities
- `GET /relations` - List relations
- `DELETE /documents/{id}` - Delete document
- `GET /health` - Health check
- `WS /query/stream` - Streaming queries

**Web UI Access:**

Navigate to `http://localhost:9621` after starting the server.

---

## Evaluation with RAGAS

LightRAG includes a built-in RAGAS evaluation framework for measuring RAG quality.

### RAGAS Metrics

| Metric | Measurement | Good Score |
|--------|-------------|------------|
| **Faithfulness** | Factual accuracy vs retrieved context | > 0.80 |
| **Answer Relevance** | Relevance to user query | > 0.80 |
| **Context Recall** | Coverage of relevant information | > 0.80 |
| **Context Precision** | Lack of irrelevant noise | > 0.80 |
| **RAGAS Score** | Overall average | > 0.80 |

### Running Evaluation

**Setup:**

```bash
# Install evaluation dependencies
pip install "lightrag-hku[evaluation]"

# Or manually
pip install ragas datasets langfuse
```

**Run Evaluation:**

```bash
# Default: sample_dataset.json against http://localhost:9621
cd /path/to/LightRAG
python lightrag/evaluation/eval_rag_quality.py

# Custom dataset
python lightrag/evaluation/eval_rag_quality.py --dataset my_test.json

# Custom RAG endpoint
python lightrag/evaluation/eval_rag_quality.py --ragendpoint http://my-server:9621
```

**Configuration (Environment Variables):**

```bash
# LLM for evaluation
EVAL_LLM_MODEL=gpt-4o-mini
EVAL_LLM_BINDING_API_KEY=sk-your-key
EVAL_LLM_BINDING_HOST=https://api.openai.com/v1  # Optional

# Embedding for evaluation
EVAL_EMBEDDING_MODEL=text-embedding-3-large
EVAL_EMBEDDING_BINDING_API_KEY=sk-your-key
EVAL_EMBEDDING_BINDING_HOST=https://api.openai.com/v1  # Optional

# Performance tuning
EVAL_MAX_CONCURRENT=2        # Serial evaluation prevents rate limits
EVAL_QUERY_TOP_K=10          # Reduce to avoid context precision LLM overload
EVAL_LLM_MAX_RETRIES=5
EVAL_LLM_TIMEOUT=180
```

**Results:**

Evaluation outputs JSON and CSV results to `lightrag/evaluation/results/`:

```
results/
├── results_20241211_143022.json
└── results_20241211_143022.csv
```

**Example Output:**

```
===================================================================================================================
📊 EVALUATION RESULTS SUMMARY
===================================================================================================================
#    | Question                                           |  Faith | AnswRel | CtxRec | CtxPrec |  RAGAS | Status
-------------------------------------------------------------------------------------------------------------------
1    | How does LightRAG solve hallucination problems?    | 1.0000 |  1.0000 | 1.0000 |  1.0000 | 1.0000 |      ✓
2    | What are the three main RAG components?            | 0.8500 |  0.5790 | 1.0000 |  1.0000 | 0.8573 |      ✓
3    | How does retrieval performance compare?            | 0.8056 |  1.0000 | 1.0000 |  1.0000 | 0.9514 |      ✓
===================================================================================================================
Average RAGAS Score: 0.9425
```

**Troubleshooting:**

- **"LM returned 1 generations instead of 3"**: Reduce `EVAL_MAX_CONCURRENT=1` or `EVAL_QUERY_TOP_K=5`
- **Context Precision returns NaN**: Lower `EVAL_QUERY_TOP_K` to reduce LLM calls per test case
- **Rate limit errors (429)**: Increase `EVAL_LLM_MAX_RETRIES`, decrease concurrency

---

## Quick Start Examples

### 1. Basic Usage (OpenAI)

```python
import os
import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

WORKING_DIR = "./rag_storage"

async def initialize_rag():
    rag = LightRAG(
        working_dir=WORKING_DIR,
        embedding_func=openai_embed,
        llm_model_func=gpt_4o_mini_complete,
    )
    await rag.initialize_storages()
    return rag

async def main():
    rag = await initialize_rag()

    # Insert documents
    await rag.ainsert("Your document text here")

    # Query with hybrid mode
    result = await rag.aquery(
        "What are the main themes?",
        param=QueryParam(mode="hybrid")
    )
    print(result)

    await rag.finalize_storages()

if __name__ == "__main__":
    asyncio.run(main())
```

### 2. Production Setup (PostgreSQL + Reranker)

```python
import os
import asyncio
import numpy as np
from functools import partial
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.rerank import cohere_rerank
from lightrag.utils import EmbeddingFunc, wrap_embedding_func_with_attrs

# Environment setup
os.environ["POSTGRES_URI"] = "postgresql://user:pass@localhost:5432/lightrag"

# Embedding function
@wrap_embedding_func_with_attrs(embedding_dim=3072, max_token_size=8192)
async def embedding_func(texts: list[str]) -> np.ndarray:
    return await openai_embed(
        texts,
        model="text-embedding-3-large",
        api_key=os.getenv("OPENAI_API_KEY")
    )

# LLM function
async def llm_func(prompt, system_prompt=None, history_messages=[], **kwargs):
    return await openai_complete_if_cache(
        "gpt-4o-mini",
        prompt,
        system_prompt=system_prompt,
        history_messages=history_messages,
        api_key=os.getenv("OPENAI_API_KEY"),
        **kwargs
    )

# Reranker function
rerank_func = partial(
    cohere_rerank,
    model="rerank-v3.5",
    api_key=os.getenv("COHERE_API_KEY"),
    base_url="https://api.cohere.com/v2/rerank"
)

async def initialize_rag():
    rag = LightRAG(
        working_dir="./rag_storage",
        workspace="production",
        kv_storage="PGKVStorage",
        vector_storage="PGVectorStorage",
        graph_storage="PGGraphStorage",
        doc_status_storage="PGDocStatusStorage",
        embedding_func=embedding_func,
        llm_model_func=llm_func,
        rerank_model_func=rerank_func,
    )
    await rag.initialize_storages()
    return rag

async def main():
    rag = await initialize_rag()

    # Insert documents
    docs = ["Document 1 content", "Document 2 content"]
    await rag.ainsert(docs)

    # Query with reranking
    result = await rag.aquery(
        "Your question",
        param=QueryParam(
            mode="mix",           # Best mode when reranker configured
            top_k=60,
            chunk_top_k=40,
            enable_rerank=True
        )
    )
    print(result)

    await rag.finalize_storages()

if __name__ == "__main__":
    asyncio.run(main())
```

### 3. High-Scale Setup (Neo4J + Milvus + Redis)

```python
import os
import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache
from lightrag.llm.ollama import ollama_embed
from lightrag.utils import EmbeddingFunc

# Environment setup
os.environ["NEO4J_URI"] = "neo4j://localhost:7687"
os.environ["NEO4J_USERNAME"] = "neo4j"
os.environ["NEO4J_PASSWORD"] = "password"
os.environ["MILVUS_URI"] = "http://localhost:19530"
os.environ["MILVUS_USER"] = "root"
os.environ["MILVUS_PASSWORD"] = "Milvus"
os.environ["REDIS_URI"] = "redis://localhost:6379"

async def llm_func(prompt, system_prompt=None, history_messages=[], **kwargs):
    return await openai_complete_if_cache(
        "gpt-4o-mini",
        prompt,
        system_prompt=system_prompt,
        history_messages=history_messages,
        api_key=os.getenv("OPENAI_API_KEY"),
        **kwargs
    )

embedding_func = EmbeddingFunc(
    embedding_dim=768,
    max_token_size=8192,
    func=lambda texts: ollama_embed(
        texts,
        embed_model="bge-m3",
        host="http://localhost:11434"
    )
)

async def initialize_rag():
    rag = LightRAG(
        working_dir="./rag_storage",
        workspace="production",
        kv_storage="RedisKVStorage",
        vector_storage="MilvusVectorDBStorage",
        graph_storage="Neo4JStorage",
        doc_status_storage="RedisKVStorage",
        embedding_func=embedding_func,
        llm_model_func=llm_func,
    )
    await rag.initialize_storages()
    return rag

async def main():
    rag = await initialize_rag()

    # Batch insert with IDs
    docs = ["Doc 1 content", "Doc 2 content"]
    ids = ["doc-1", "doc-2"]
    await rag.ainsert(docs, ids=ids)

    # Query all modes
    for mode in ["local", "global", "hybrid", "mix"]:
        result = await rag.aquery(
            "Your question",
            param=QueryParam(mode=mode)
        )
        print(f"{mode.upper()}: {result}\n")

    await rag.finalize_storages()

if __name__ == "__main__":
    asyncio.run(main())
```

### 4. Ollama Local Setup (Self-Hosted)

```python
import os
import asyncio
import numpy as np
from lightrag import LightRAG, QueryParam
from lightrag.llm.ollama import ollama_model_complete, ollama_embed
from lightrag.utils import wrap_embedding_func_with_attrs

@wrap_embedding_func_with_attrs(embedding_dim=768, max_token_size=8192)
async def embedding_func(texts: list[str]) -> np.ndarray:
    return await ollama_embed(
        texts,
        embed_model="nomic-embed-text",
        host="http://localhost:11434"
    )

async def initialize_rag():
    rag = LightRAG(
        working_dir="./rag_storage",
        llm_model_func=ollama_model_complete,
        llm_model_name="qwen2.5:32b",
        llm_model_kwargs={"options": {"num_ctx": 32768}},  # Set context window
        embedding_func=embedding_func,
    )
    await rag.initialize_storages()
    return rag

async def main():
    rag = await initialize_rag()

    await rag.ainsert("Your document content")

    result = await rag.aquery(
        "Your question",
        param=QueryParam(mode="hybrid")
    )
    print(result)

    await rag.finalize_storages()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## Advanced Features

### Citation Functionality

Track document sources for transparency and traceability.

```python
documents = ["Content from doc1.txt", "Content from doc2.txt"]
file_paths = ["path/to/doc1.txt", "path/to/doc2.txt"]

await rag.ainsert(documents, file_paths=file_paths)

# Query returns source attribution
result = await rag.aquery("Your question", param=QueryParam(mode="hybrid"))
# Result includes source document references
```

### Entity and Relation CRUD

Programmatically manipulate the knowledge graph.

```python
# Create entities
entity = rag.create_entity("Google", {
    "description": "Multinational technology company",
    "entity_type": "company"
})

product = rag.create_entity("Gmail", {
    "description": "Email service by Google",
    "entity_type": "product"
})

# Create relations
relation = rag.create_relation("Google", "Gmail", {
    "description": "Google develops Gmail",
    "keywords": "develops operates",
    "weight": 2.0
})

# Edit entities
rag.edit_entity("Google", {
    "description": "Subsidiary of Alphabet Inc., founded 1998"
})

# Merge duplicate entities
rag.merge_entities(
    source_entities=["AI", "Artificial Intelligence", "Machine Intelligence"],
    target_entity="AI Technology",
    merge_strategy={
        "description": "concatenate",
        "entity_type": "keep_first"
    }
)

# Delete operations
rag.delete_by_entity("OldEntity")
rag.delete_by_relation("Entity1", "Entity2")
await rag.adelete_by_doc_id("doc-12345")  # Async only
```

### Custom Knowledge Graph Insertion

Insert pre-built knowledge graphs directly.

```python
custom_kg = {
    "chunks": [
        {
            "content": "Alice and Bob collaborate on quantum computing.",
            "source_id": "doc-1",
            "file_path": "quantum_research.pdf"
        }
    ],
    "entities": [
        {
            "entity_name": "Alice",
            "entity_type": "person",
            "description": "Quantum physics researcher",
            "source_id": "doc-1"
        },
        {
            "entity_name": "Bob",
            "entity_type": "person",
            "description": "Mathematician specializing in quantum algorithms",
            "source_id": "doc-1"
        }
    ],
    "relationships": [
        {
            "src_id": "Alice",
            "tgt_id": "Bob",
            "description": "Research partners in quantum computing",
            "keywords": "collaboration research quantum",
            "weight": 1.5,
            "source_id": "doc-1"
        }
    ]
}

rag.insert_custom_kg(custom_kg)
```

### Streaming Responses

Enable real-time response streaming for better user experience.

```python
from lightrag import QueryParam

result_stream = await rag.aquery(
    "Long-form question requiring detailed answer",
    param=QueryParam(
        mode="hybrid",
        stream=True  # Enable streaming
    )
)

# Stream responses as they're generated
async for chunk in result_stream:
    print(chunk, end="", flush=True)
```

### Token Usage Tracking

Monitor LLM API costs with built-in token tracking.

```python
from lightrag.utils import TokenTracker

tracker = TokenTracker()

# Context manager approach (recommended)
with tracker:
    await rag.ainsert("Document content")
    result = await rag.aquery("Question", param=QueryParam(mode="mix"))

# Display token usage
usage = tracker.get_usage()
print(f"Total tokens: {usage['total_tokens']}")
print(f"Prompt tokens: {usage['prompt_tokens']}")
print(f"Completion tokens: {usage['completion_tokens']}")
print(f"Estimated cost: ${usage['estimated_cost']:.4f}")
```

### Data Export

Export knowledge graphs for analysis, backup, or sharing.

```python
# Export to different formats
rag.export_data("graph_data.csv", file_format="csv")
rag.export_data("graph_data.xlsx", file_format="excel")
rag.export_data("graph_data.md", file_format="md")
rag.export_data("graph_data.txt", file_format="txt")

# Include vector embeddings
rag.export_data("complete_data.csv", include_vector_data=True)
```

### Cache Management

Clear LLM response caches selectively.

```python
# Clear all cache
await rag.aclear_cache()

# Clear specific mode caches
await rag.aclear_cache(modes=["local", "global"])

# Clear extraction cache only
await rag.aclear_cache(modes=["default"])

# Synchronous version
rag.clear_cache(modes=["hybrid", "mix"])
```

### Langfuse Observability Integration

Monitor and debug LLM interactions with Langfuse.

**Setup:**

```bash
pip install "lightrag-hku[observability]"
```

**Configuration (.env):**

```bash
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLE_TRACE=true
```

**Features:**
- Automatic tracing of all OpenAI LLM calls
- Token usage and latency analytics
- Prompt/response inspection
- Real-time monitoring and alerting

**Note:** Currently supports OpenAI-compatible APIs only (Ollama, Azure, Bedrock not yet supported)

---

## Performance Tuning

### Indexing Performance

**Bottleneck:** LLM entity extraction (slowest step)

**Optimization Strategies:**

1. **Increase LLM Concurrency:**
   ```bash
   MAX_ASYNC=8  # Default: 4, increase if LLM supports high concurrency
   ```

2. **Parallel Document Processing:**
   ```bash
   MAX_PARALLEL_INSERT=4  # Default: 2, process multiple docs simultaneously
   ```

3. **Chunk Size Tuning:**
   ```python
   rag = LightRAG(
       chunk_token_size=800,      # Smaller chunks = faster extraction
       chunk_overlap_token_size=50,
       # ...
   )
   ```

4. **Disable LLM Cache (for unique documents):**
   ```python
   rag = LightRAG(
       enable_llm_cache=False,  # Skip cache lookups for one-time indexing
       # ...
   )
   ```

5. **Use Faster LLM for Indexing:**
   - GPT-4o-mini instead of GPT-4o
   - Gemini Flash instead of Gemini Pro
   - Trade quality for speed during initial indexing

### Query Performance

**Optimization Strategies:**

1. **Reduce Retrieval Scope:**
   ```python
   QueryParam(
       top_k=30,        # Reduce from default 60
       chunk_top_k=10,  # Reduce from default 20
   )
   ```

2. **Enable Reranking for Precision:**
   ```python
   QueryParam(
       mode="mix",
       chunk_top_k=40,      # Retrieve more candidates
       enable_rerank=True   # Rerank to top 20
   )
   ```

3. **Adjust Vector Similarity Threshold:**
   ```python
   rag = LightRAG(
       vector_db_storage_cls_kwargs={
           "cosine_better_than_threshold": 0.3  # Higher = stricter filtering
       },
       # ...
   )
   ```

4. **Use Faster Storage Backends:**
   - Local: NanoVectorDB > Faiss
   - Production: Milvus (GPU) > Qdrant > PGVector

5. **Optimize Graph Queries:**
   - Neo4J > Memgraph > PostgreSQL AGE for graph performance
   - Create indexes on frequently queried entity types

### Resource Planning

**Minimum Production Requirements:**

- **CPU:** 8 cores (16 recommended for Gunicorn multi-worker)
- **RAM:** 16GB minimum (32GB+ for large datasets)
- **Storage:** SSD required, 100GB+ for medium datasets
- **Network:** Low latency to LLM APIs (< 100ms)

**Scaling Guidelines:**

| Dataset Size | Chunks | Entities | Recommended Setup |
|--------------|--------|----------|-------------------|
| **Small** | < 100K | < 10K | Single server, PostgreSQL all-in-one |
| **Medium** | 100K-1M | 10K-100K | Docker Compose, PostgreSQL or Neo4J+Milvus |
| **Large** | 1M-10M | 100K-1M | Kubernetes, Neo4J+Milvus+Redis, multi-worker |
| **X-Large** | 10M+ | 1M+ | Kubernetes cluster, distributed storage, GPU acceleration |

---

## Troubleshooting

### Common Issues

**1. AttributeError: __aenter__**

**Cause:** Storage backends not initialized.

**Solution:**
```python
rag = LightRAG(...)
await rag.initialize_storages()  # REQUIRED
```

**2. KeyError: 'history_messages'**

**Cause:** Pipeline status not initialized.

**Solution:** Call `await rag.initialize_storages()` (auto-initializes pipeline)

**3. Embedding Dimension Mismatch**

**Cause:** Changed embedding model without recreating vector tables.

**Solution:**
- Delete vector storage tables/collections
- Re-initialize LightRAG (auto-recreates tables)
- Re-index all documents

**4. Neo4J Connection Timeout**

**Cause:** Batch sizes too large for Neo4J.

**Solution:**
```bash
NEO4J_BATCH_SIZE_NODES=500
NEO4J_BATCH_SIZE_EDGES=100
```

**5. LLM Response Cache Corruption**

**Cause:** Incompatible cache from previous LLM model.

**Solution:**
```python
# Clear all caches
await rag.aclear_cache()

# Or delete cache file manually
# rm rag_storage/kv_store_llm_response_cache.json
```

**6. Graph Query Performance Degradation**

**Cause:** Missing graph database indexes.

**Solution (Neo4J):**
```cypher
CREATE INDEX FOR (n:Entity) ON (n.name);
CREATE INDEX FOR ()-[r:RELATES_TO]-() ON (r.weight);
```

---

## Best Practices Summary

### Do's

1. **Always initialize storages:** `await rag.initialize_storages()`
2. **Use consistent embedding models** across indexing and querying
3. **Configure reranker** for production deployments
4. **Set `mode="mix"`** when reranker is available
5. **Use workspaces** for multi-tenant systems
6. **Monitor token usage** with TokenTracker
7. **Run RAGAS evaluation** before production deployment
8. **Use PostgreSQL all-in-one** for most production cases
9. **Enable Langfuse tracing** for observability
10. **Set appropriate context budgets** (`max_total_tokens`)

### Don'ts

1. **Don't use reasoning models (o1)** for document indexing
2. **Don't change embedding models** without recreating vector storage
3. **Don't skip `initialize_storages()`** call
4. **Don't use file-based storage** in production
5. **Don't ignore RAGAS scores** < 0.80
6. **Don't use `mode="bypass"`** for factual queries
7. **Don't commit .env files** to version control
8. **Don't use < 32B parameter LLMs** for entity extraction
9. **Don't exceed LLM context windows** (keep `max_total_tokens` < 70% of context)
10. **Don't run Gunicorn on Windows** (use Docker instead)

---

## References

- **Official Documentation:** https://github.com/HKUDS/LightRAG
- **Paper:** LightRAG: Simple and Fast Retrieval-Augmented Generation (arXiv:2410.05779)
- **Discord Community:** https://discord.gg/yF2MmDJyGJ
- **LearnOpenCV Tutorial:** https://learnopencv.com/lightrag
- **Docker Images:** https://github.com/HKUDS/LightRAG/pkgs/container/lightrag

**Related Projects:**
- **RAG-Anything:** Multimodal RAG system (https://github.com/HKUDS/RAG-Anything)
- **VideoRAG:** Extreme long-context video RAG (https://github.com/HKUDS/VideoRAG)
- **MiniRAG:** Lightweight RAG with small models (https://github.com/HKUDS/MiniRAG)

---

**Last Updated:** 2025-12-11
**LightRAG Version:** 1.4.9.9
