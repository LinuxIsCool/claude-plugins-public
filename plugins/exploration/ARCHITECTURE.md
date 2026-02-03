# Sophisticated Exploration Knowledge Graph Architecture

A synthesis of patterns from awareness, knowledge-graphs, llms, and agents plugins, combined with external research on temporal knowledge graphs and LLM-based graph construction.

## Executive Summary

The current exploration graph is **static and manually seeded**. This architecture evolves it into a **living, self-improving temporal knowledge graph** with:

1. **Bi-temporal tracking** - When facts are true vs. when we learned them
2. **LLM-powered entity extraction** - Automatic graph construction from discoveries
3. **Hybrid retrieval** - Graph + vector + keyword search with reranking
4. **Multi-agent construction** - Specialized agents for extraction, linking, validation
5. **Self-improving memory** - Graph that learns from its own queries
6. **Mastery-aware evolution** - Graph sophistication tracks exploration mastery

---

## 1. Bi-Temporal Data Model

From [Zep's temporal knowledge graph architecture](https://arxiv.org/html/2501.13956v1) and Graphiti:

```
Current: (entity)-[relationship]->(entity)

Evolved:  (entity)-[relationship {
            valid_at,      # When fact was true in reality
            created_at,    # When we discovered it
            invalid_at,    # When fact became false (nullable)
            confidence,    # 0.0-1.0 certainty
            source,        # Discovery that created this
            mastery_level  # Exploration depth when discovered
          }]->(entity)
```

### Why This Matters

- **Point-in-time queries**: "What did we know about Docker on day 1?"
- **Knowledge evolution**: Track how understanding deepens
- **Contradiction handling**: New facts automatically invalidate old ones
- **Provenance**: Every fact traceable to source discovery

### Implementation

```cypher
// Create temporal edge
CREATE (neo4j:Container)-[:RUNS_ON {
  valid_at: datetime('2025-12-12'),
  created_at: datetime('2025-12-12T15:55:00'),
  confidence: 0.95,
  source: 'discovery-20251212-initial',
  mastery_level: 0.40
}]->(host:Hardware)

// Query historical state
MATCH (e)-[r]->(target)
WHERE r.created_at <= datetime('2025-12-12')
  AND (r.invalid_at IS NULL OR r.invalid_at > datetime('2025-12-12'))
RETURN e, r, target
```

---

## 2. LLM-Powered Entity Extraction

From [KGGen](https://arxiv.org/html/2502.09956v1) and the knowledge-graphs plugin:

### Multi-Stage Pipeline

```
Discovery Text
     │
     ▼
┌─────────────────────┐
│ Stage 1: Extract    │  LLM extracts entities + relations
│ (per-source)        │  from each discovery
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Stage 2: Aggregate  │  Merge graphs across discoveries
│ (cross-source)      │  with entity resolution
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Stage 3: Cluster    │  "NYC" + "New York" → canonical form
│ (deduplication)     │  LLM-based semantic similarity
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Stage 4: Validate   │  Schema constraints, cardinality
│ (quality)           │  rules, contradiction detection
└─────────────────────┘
     │
     ▼
  Temporal KG
```

### Entity Types (Pydantic Schema)

```python
from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime

class Hardware(BaseModel):
    name: str
    type: Literal["cpu", "gpu", "ram", "storage", "network", "peripheral"]
    vendor: str | None = None
    specs: dict | None = None

class Software(BaseModel):
    name: str
    version: str | None = None
    type: Literal["os", "application", "library", "service", "tool"]

class Container(BaseModel):
    name: str
    image: str
    ports: list[int] = []
    status: Literal["running", "stopped", "unknown"] = "unknown"

class ExplorationEntity(BaseModel):
    """Base class for all exploration entities"""
    id: str
    name: str
    circle: Literal["substrate", "tools", "network", "history", "cosmos"]
    first_seen: datetime
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)

class RunsOn(BaseModel):
    """Relationship: X runs on Y"""
    since: datetime | None = None

class DependsOn(BaseModel):
    """Relationship: X depends on Y"""
    dependency_type: Literal["runtime", "build", "optional"] = "runtime"
```

### Three Operating Modes (from awareness/temporal-kg-memory)

| Mode | Cost | Quality | Speed | Use Case |
|------|------|---------|-------|----------|
| **Direct FalkorDB** | Free | Rule-based | Fastest | Development, structure analysis |
| **Ollama Local** | Free | Good | Medium | Recommended for most use |
| **Cloud API** | ~$0.02/100 | Best | Slow | High-stakes extraction |

---

## 3. Hybrid Retrieval Architecture

From the llms plugin (Graphiti, LightRAG) and [Neo4j best practices](https://neo4j.com/blog/developer/knowledge-graph-extraction-challenges/):

### Four Search Methods

```python
class SearchMethod(Enum):
    BM25 = "keyword"           # Full-text search
    COSINE = "semantic"        # Vector similarity
    BFS = "graph_traversal"    # Breadth-first from anchor
    CYPHER = "structured"      # Direct graph query

class RerankerStrategy(Enum):
    RRF = "reciprocal_rank_fusion"  # Combine rankings
    MMR = "maximal_marginal_relevance"  # Diversity
    CROSS_ENCODER = "llm_rerank"  # LLM judges relevance
    NODE_DISTANCE = "graph_proximity"  # Hop count
```

### Hybrid Search Pipeline

```
Query: "What containers use the GPU?"
         │
         ▼
    ┌────────────────────────────────────────┐
    │         Parallel Retrieval              │
    │  ┌─────────┐ ┌─────────┐ ┌──────────┐  │
    │  │  BM25   │ │ Vector  │ │  Graph   │  │
    │  │ "GPU"   │ │ embed() │ │ 2-hop    │  │
    │  └────┬────┘ └────┬────┘ └────┬─────┘  │
    │       │           │           │        │
    │       └───────────┼───────────┘        │
    │                   ▼                    │
    │         ┌─────────────────┐            │
    │         │  RRF Fusion     │            │
    │         │  (k=60)         │            │
    │         └────────┬────────┘            │
    │                  ▼                     │
    │         ┌─────────────────┐            │
    │         │ Cross-Encoder   │            │
    │         │ Rerank (top 10) │            │
    │         └────────┬────────┘            │
    └──────────────────┼─────────────────────┘
                       ▼
              Ranked Results
```

### FalkorDB + pgvector Hybrid

```sql
-- Store embeddings in PostgreSQL
CREATE TABLE entity_embeddings (
    entity_id TEXT PRIMARY KEY,
    embedding vector(1536),
    content TEXT
);

-- Hybrid search function
CREATE FUNCTION hybrid_search(query_text TEXT, query_embedding vector, k INT)
RETURNS TABLE (entity_id TEXT, score FLOAT) AS $$
WITH semantic AS (
    SELECT entity_id,
           1 - (embedding <=> query_embedding) as sim,
           ROW_NUMBER() OVER (ORDER BY embedding <=> query_embedding) as rank
    FROM entity_embeddings
    ORDER BY embedding <=> query_embedding
    LIMIT k * 2
),
keyword AS (
    SELECT entity_id,
           ts_rank(to_tsvector(content), plainto_tsquery(query_text)) as sim,
           ROW_NUMBER() OVER (ORDER BY ts_rank DESC) as rank
    FROM entity_embeddings
    WHERE to_tsvector(content) @@ plainto_tsquery(query_text)
    LIMIT k * 2
)
SELECT
    COALESCE(s.entity_id, kw.entity_id) as entity_id,
    COALESCE(1.0/(60+s.rank), 0) + COALESCE(1.0/(60+kw.rank), 0) as score
FROM semantic s
FULL OUTER JOIN keyword kw ON s.entity_id = kw.entity_id
ORDER BY score DESC
LIMIT k;
$$ LANGUAGE SQL;
```

---

## 4. Multi-Agent Graph Construction

From the agents plugin (CrewAI, Letta, Mem0):

### Agent Roles

```python
from crewai import Agent, Crew, Task

# Specialized extraction agents
entity_extractor = Agent(
    role="Entity Extractor",
    goal="Extract hardware, software, and service entities from exploration discoveries",
    backstory="Expert at identifying technical components in system descriptions",
    tools=[llm_extract_tool, schema_validator]
)

relationship_analyst = Agent(
    role="Relationship Analyst",
    goal="Identify relationships between entities (runs_on, depends_on, uses)",
    backstory="Systems architect who understands how components connect",
    tools=[graph_query_tool, inference_tool]
)

deduplication_agent = Agent(
    role="Entity Resolver",
    goal="Merge duplicate entities using semantic similarity",
    backstory="Data quality expert focused on canonical representations",
    tools=[embedding_similarity, merge_tool]
)

temporal_tracker = Agent(
    role="Temporal Analyst",
    goal="Track when facts become true/false, detect contradictions",
    backstory="Historian who tracks how understanding evolves",
    tools=[timeline_tool, contradiction_detector]
)

# Orchestrated crew
exploration_crew = Crew(
    agents=[entity_extractor, relationship_analyst, deduplication_agent, temporal_tracker],
    tasks=[extract_task, link_task, dedupe_task, temporal_task],
    process=Process.sequential,
    memory=True  # Crew remembers across sessions
)
```

### Shared Memory Architecture (Letta Pattern)

```python
# Shared knowledge graph context block
graph_context = client.blocks.create(
    label="exploration_graph_state",
    value="""
    Current entities: 43 nodes across 5 circles
    Recent discoveries: Initial exploration 2025-12-12
    Open questions: 7 (3 high priority)
    Mastery levels: substrate=0.55, tools=0.45, network=0.40
    """
)

# All agents share the same context
extractor_agent = client.agents.create(block_ids=[graph_context.id])
linker_agent = client.agents.create(block_ids=[graph_context.id])
# Updates by one agent visible to all
```

---

## 5. Self-Improving Memory

From Mem0 and the awareness plugin's compounding patterns:

### Automatic Fact Extraction

```python
from mem0 import Memory

# Configure with graph backend
memory = Memory.from_config({
    "graph_store": {
        "provider": "falkordb",
        "config": {"host": "localhost", "port": 6380}
    },
    "vector_store": {
        "provider": "pgvector",
        "config": {"connection_string": "postgresql://..."}
    }
})

# Conversations automatically become facts
memory.add([
    {"role": "user", "content": "The Neo4j container uses port 7474"},
    {"role": "assistant", "content": "I've noted that Neo4j runs on port 7474"}
], user_id="exploration", metadata={"circle": "network"})

# Later queries benefit from accumulated knowledge
results = memory.search("What ports are containers using?", user_id="exploration")
# Returns structured facts with graph relationships
```

### Self-Healing Contradictions

```python
# Old fact
memory.add("Claude Code version is 2.0.65")

# New fact (automatically resolves)
memory.add("Claude Code version is 2.0.67")

# Query returns latest with history
results = memory.get_all(user_id="exploration")
# fact: "Claude Code version is 2.0.67"
# history: [{version: "2.0.65", valid_until: "2025-12-12"}, ...]
```

### Query-Driven Improvement

```python
# Track what queries succeed/fail
@on_search
def track_query_quality(query, results, feedback):
    if feedback.helpful:
        # Strengthen paths that led to good results
        for result in results:
            boost_entity_confidence(result.entity_id, delta=0.05)
    else:
        # Flag areas needing more exploration
        add_question(f"Improve understanding of: {query}", priority="medium")
```

---

## 6. Mastery-Aware Evolution

From the awareness plugin's progression framework:

### Graph Sophistication Tracks Mastery

| Mastery Level | Graph Characteristics |
|---------------|----------------------|
| **Stranger (0.0-0.2)** | Basic entities, no relationships |
| **Tourist (0.2-0.4)** | Named entities, direct relationships |
| **Resident (0.4-0.6)** | Typed relationships, some inference |
| **Native (0.6-0.8)** | Temporal tracking, contradiction detection |
| **Cartographer (0.8-1.0)** | Full provenance, multi-hop reasoning |

### Progressive Enhancement

```python
def enhance_graph_for_mastery(circle: str, new_mastery: float):
    """Upgrade graph capabilities as mastery increases"""

    if new_mastery >= 0.4 and not has_typed_relationships(circle):
        # Tourist → Resident: Add relationship types
        upgrade_to_typed_relationships(circle)

    if new_mastery >= 0.6 and not has_temporal_tracking(circle):
        # Resident → Native: Add temporal dimensions
        add_temporal_properties(circle)
        enable_contradiction_detection(circle)

    if new_mastery >= 0.8 and not has_provenance_chains(circle):
        # Native → Cartographer: Full provenance
        enable_provenance_tracking(circle)
        enable_multi_hop_inference(circle)
```

### Feedback Loop

```
Explore → Discover → Add to Graph → Query Graph → Find Gaps → Explore
    ↑                                                            │
    └────────────────────────────────────────────────────────────┘

Each cycle:
1. Increases entity count and relationship density
2. Improves confidence scores through validation
3. Raises mastery level through demonstrated understanding
4. Unlocks more sophisticated graph features
```

---

## 7. Implementation Roadmap

### Phase 1: Temporal Foundation (Current → +1 week)
- [ ] Add temporal properties to existing FalkorDB schema
- [ ] Implement bi-temporal edge creation
- [ ] Create point-in-time query functions
- [ ] Migrate existing 43 nodes to temporal model

### Phase 2: LLM Extraction Pipeline (+1-2 weeks)
- [ ] Implement Pydantic entity schemas
- [ ] Create Ollama-based extraction (free, local)
- [ ] Build entity resolution with embeddings
- [ ] Add schema validation layer

### Phase 3: Hybrid Search (+2-3 weeks)
- [ ] Set up pgvector for entity embeddings
- [ ] Implement RRF fusion search
- [ ] Add cross-encoder reranking (optional)
- [ ] Create graph-aware search (BFS from anchors)

### Phase 4: Multi-Agent Construction (+3-4 weeks)
- [ ] Define CrewAI agents for extraction pipeline
- [ ] Implement Letta shared memory blocks
- [ ] Create agent coordination workflow
- [ ] Add quality feedback loops

### Phase 5: Self-Improvement (+4-5 weeks)
- [ ] Integrate Mem0 for automatic fact extraction
- [ ] Implement query success tracking
- [ ] Add contradiction detection and resolution
- [ ] Create mastery-triggered upgrades

---

## 8. Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Graph DB** | FalkorDB | Fast, Redis-based, OpenCypher |
| **Vector DB** | pgvector | PostgreSQL native, hybrid search |
| **LLM (local)** | Ollama (llama3.2/qwen) | Free, no rate limits |
| **LLM (cloud)** | Claude API | Best quality when needed |
| **Embeddings** | Voyage AI / sentence-transformers | High quality, affordable |
| **Agent Framework** | CrewAI + Letta | Multi-agent + memory |
| **Memory Layer** | Mem0 | Self-improving facts |
| **Orchestration** | Python + asyncio | Native async support |

---

## 9. Success Metrics

### Graph Health
- Entity count by circle (target: 100+ per circle)
- Relationship density (edges/nodes ratio > 3)
- Temporal coverage (% edges with valid_at)
- Confidence distribution (mean > 0.7)

### Query Quality
- Search precision@5 > 0.8
- Query latency p95 < 500ms
- Cross-circle connection discovery rate

### Learning Velocity
- Questions generated per session
- Questions answered per week
- Mastery level progression rate
- Contradiction resolution time

---

## Sources

- [Zep: Temporal Knowledge Graph Architecture](https://arxiv.org/html/2501.13956v1)
- [KGGen: Extracting Knowledge Graphs with LLMs](https://arxiv.org/html/2502.09956v1)
- [Neo4j Knowledge Graph Extraction Challenges](https://neo4j.com/blog/developer/knowledge-graph-extraction-challenges/)
- [Building Production-Ready Graph Systems in 2025](https://medium.com/@claudiubranzan/from-llms-to-knowledge-graphs-building-production-ready-graph-systems-in-2025-2b4aff1ec99a)
- [Best Open Source LLMs for KG Construction 2025](https://www.siliconflow.com/articles/en/best-open-source-LLM-for-Knowledge-Graph-Construction)
- [Frontiers: KG + LLM Fusion Practices](https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2025.1590632/full)

---

*Architecture document created: 2025-12-12*
*Based on synthesis of awareness, knowledge-graphs, llms, and agents plugins*
