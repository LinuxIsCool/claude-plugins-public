# Graph Memory with Neo4j

## Purpose

Use mem0's graph memory capabilities to store and query relationship-aware memories using Neo4j. Graph memory enables entity extraction, relationship tracking, and contextual queries that understand how entities connect.

## Variables

```
GRAPH_PROVIDER: neo4j
NEO4J_URL: bolt://localhost:7687
NEO4J_DATABASE: neo4j
SIMILARITY_THRESHOLD: 0.7
EMBEDDING_STORAGE: node_properties
```

## Instructions

### Prerequisites

1. **Neo4j Database**: Running instance (local or cloud)
2. **Additional Dependencies**:

```bash
pip install mem0ai langchain-neo4j rank-bm25
```

---

## Configuration

### Basic Graph Memory Setup

```python
from mem0 import Memory

config = {
    "graph_store": {
        "provider": "neo4j",
        "config": {
            "url": "bolt://localhost:7687",
            "username": "neo4j",
            "password": "your-password",
            "database": "neo4j"  # Optional, defaults to "neo4j"
        }
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "model": "text-embedding-3-small",
            "embedding_dims": 1536
        }
    },
    "llm": {
        "provider": "openai",
        "config": {
            "model": "gpt-4.1-nano-2025-04-14"
        }
    },
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": "localhost",
            "port": 6333,
            "collection_name": "memories"
        }
    }
}

memory = Memory.from_config(config)
```

### With Custom Graph LLM

```python
config = {
    "graph_store": {
        "provider": "neo4j",
        "config": {
            "url": "bolt://localhost:7687",
            "username": "neo4j",
            "password": "password",
            "database": "neo4j"
        },
        "llm": {
            "provider": "openai",
            "config": {
                "model": "gpt-4o"  # Use more capable model for graph operations
            }
        },
        "threshold": 0.8,  # Similarity threshold for entity matching
        "custom_prompt": "Focus on technical relationships and dependencies"
    },
    # ... embedder and vector_store config
}
```

---

## How Graph Memory Works

### 1. Entity Extraction

When you add a memory, mem0 extracts entities and their types:

```python
# Input
memory.add(
    "Shawn works with Alice on the memory plugin project. Alice is a senior engineer.",
    user_id="user"
)

# Extracted entities:
# - Shawn (person)
# - Alice (person, senior engineer)
# - memory plugin project (project)
```

### 2. Relationship Establishment

Relationships are established between entities:

```
(Shawn) -[WORKS_WITH]-> (Alice)
(Shawn) -[WORKS_ON]-> (memory plugin project)
(Alice) -[WORKS_ON]-> (memory plugin project)
(Alice) -[IS_A]-> (senior engineer)
```

### 3. Graph Storage

Entities become nodes, relationships become edges:

```cypher
CREATE (user:Person {name: "user", user_id: "user"})
CREATE (alice:Person {name: "alice", user_id: "user"})
CREATE (project:Project {name: "memory_plugin_project", user_id: "user"})
CREATE (user)-[:WORKS_WITH]->(alice)
CREATE (user)-[:WORKS_ON]->(project)
CREATE (alice)-[:WORKS_ON]->(project)
```

---

## Basic Operations

### Adding Graph Memories

```python
from mem0 import Memory

memory = Memory.from_config(config)

# Add memory with relationships
result = memory.add(
    "I started working at Anthropic last month. I'm on the Claude team with Bob and Carol.",
    user_id="user"
)

print(result)
# {
#     "results": [
#         {"id": "mem_001", "memory": "Started working at Anthropic last month", "event": "ADD"},
#         {"id": "mem_002", "memory": "On the Claude team", "event": "ADD"},
#         {"id": "mem_003", "memory": "Works with Bob and Carol", "event": "ADD"}
#     ],
#     "relations": {
#         "added_entities": [...],
#         "deleted_entities": []
#     }
# }
```

### Searching with Graph Context

```python
# Search returns both vector results and graph relationships
results = memory.search(
    query="Who does Shawn work with?",
    user_id="user"
)

# Results include relationship context
# [
#     {"source": "user", "relationship": "WORKS_WITH", "destination": "bob"},
#     {"source": "user", "relationship": "WORKS_WITH", "destination": "carol"},
#     {"source": "user", "relationship": "WORKS_AT", "destination": "anthropic"}
# ]
```

### Getting All Graph Relationships

```python
# Get all relationships for a user
relationships = memory.graph.get_all(
    filters={"user_id": "user"},
    limit=100
)

for rel in relationships:
    print(f"{rel['source']} --[{rel['relationship']}]--> {rel['target']}")

# Output:
# user --[WORKS_AT]--> anthropic
# user --[WORKS_ON]--> claude_team
# user --[WORKS_WITH]--> bob
# user --[WORKS_WITH]--> carol
```

---

## Graph Operations Detail

### Entity Extraction Process

```python
# The LLM extracts entities using this tool schema:
EXTRACT_ENTITIES_TOOL = {
    "type": "function",
    "function": {
        "name": "extract_entities",
        "description": "Extract entities and their types from the text.",
        "parameters": {
            "type": "object",
            "properties": {
                "entities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "entity": {"type": "string"},
                            "entity_type": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
}

# Example extraction:
# Input: "Alice uses Python and PostgreSQL for her projects"
# Output: {
#     "entities": [
#         {"entity": "Alice", "entity_type": "person"},
#         {"entity": "Python", "entity_type": "programming_language"},
#         {"entity": "PostgreSQL", "entity_type": "database"}
#     ]
# }
```

### Relationship Establishment Process

```python
# The LLM establishes relationships using this tool schema:
RELATIONS_TOOL = {
    "type": "function",
    "function": {
        "name": "establish_relationships",
        "description": "Establish relationships among entities.",
        "parameters": {
            "type": "object",
            "properties": {
                "entities": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "source": {"type": "string"},
                            "relationship": {"type": "string"},
                            "destination": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
}

# Example:
# {
#     "entities": [
#         {"source": "alice", "relationship": "uses", "destination": "python"},
#         {"source": "alice", "relationship": "uses", "destination": "postgresql"}
#     ]
# }
```

### Graph Memory Update/Delete

```python
# The system can also update or delete relationships:
DELETE_MEMORY_TOOL_GRAPH = {
    "type": "function",
    "function": {
        "name": "delete_graph_memory",
        "description": "Delete the relationship between two nodes.",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {"type": "string"},
                "relationship": {"type": "string"},
                "destination": {"type": "string"}
            }
        }
    }
}

# When contradictory information is added:
# "Alice stopped using PostgreSQL and switched to MongoDB"
# -> Deletes: (alice)-[uses]->(postgresql)
# -> Adds: (alice)-[uses]->(mongodb)
```

---

## Advanced Graph Patterns

### Multi-Hop Relationship Queries

Query relationships that span multiple hops:

```python
# Direct Neo4j query for multi-hop
query = """
MATCH (user:__Entity__ {name: $user_name, user_id: $user_id})
      -[r1]->(intermediate)
      -[r2]->(target)
RETURN user.name AS source,
       type(r1) AS rel1,
       intermediate.name AS intermediate,
       type(r2) AS rel2,
       target.name AS target
LIMIT 10
"""

# Example result: Find what technologies are used by people Shawn works with
# user -> WORKS_WITH -> alice -> USES -> python
```

### Entity Similarity Search

Nodes store embeddings for semantic similarity:

```python
# Find entities similar to a query
query = """
MATCH (n:__Entity__ {user_id: $user_id})
WHERE n.embedding IS NOT NULL
WITH n, vector.similarity.cosine(n.embedding, $query_embedding) AS similarity
WHERE similarity >= $threshold
RETURN n.name AS entity, similarity
ORDER BY similarity DESC
LIMIT 10
"""
```

### Neighborhood Exploration

Get the full context around an entity:

```python
def get_entity_neighborhood(memory, entity_name: str, user_id: str, depth: int = 2):
    """Get all entities within N hops of a source entity."""

    query = f"""
    MATCH path = (source:__Entity__ {{name: $entity_name, user_id: $user_id}})
          -[*1..{depth}]-(connected)
    RETURN DISTINCT
        source.name AS source,
        [r IN relationships(path) | type(r)] AS relationship_path,
        connected.name AS connected_entity
    LIMIT 50
    """

    return memory.graph.graph.query(
        query,
        params={"entity_name": entity_name, "user_id": user_id}
    )

# Usage
neighborhood = get_entity_neighborhood(memory, "user", "user", depth=2)
```

---

## Graph + Vector Hybrid Search

mem0 combines graph and vector search for comprehensive results.

```python
class HybridMemorySearch:
    """Combine graph and vector search for comprehensive results."""

    def __init__(self, memory: Memory):
        self.memory = memory

    def search(self, query: str, user_id: str, limit: int = 10) -> dict:
        """Search both vector store and graph."""

        # Vector search
        vector_results = self.memory.search(
            query=query,
            user_id=user_id,
            limit=limit
        )

        # Graph search (if enabled)
        graph_results = []
        if self.memory.enable_graph:
            graph_results = self.memory.graph.search(
                query=query,
                filters={"user_id": user_id},
                limit=limit
            )

        return {
            "memories": vector_results.get("results", []),
            "relationships": graph_results,
            "combined_context": self._merge_results(
                vector_results.get("results", []),
                graph_results
            )
        }

    def _merge_results(self, memories: list, relationships: list) -> str:
        """Merge vector and graph results into context string."""
        context_parts = []

        if memories:
            memory_text = "\n".join(f"- {m['memory']}" for m in memories)
            context_parts.append(f"## Memories\n{memory_text}")

        if relationships:
            rel_text = "\n".join(
                f"- {r['source']} {r['relationship']} {r['destination']}"
                for r in relationships
            )
            context_parts.append(f"## Relationships\n{rel_text}")

        return "\n\n".join(context_parts)

# Usage
hybrid = HybridMemorySearch(memory)
results = hybrid.search("Who does the user work with on AI projects?", "user")
print(results["combined_context"])
```

---

## Graph Schema and Indexing

### Node Properties

Every entity node has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Entity name (lowercase, underscored) |
| `user_id` | string | Owner user ID |
| `agent_id` | string | Optional agent ID |
| `run_id` | string | Optional run ID |
| `embedding` | vector | Embedding for similarity search |
| `created` | timestamp | Creation timestamp |
| `mentions` | integer | Number of times entity mentioned |

### Automatic Indexing

mem0 creates these indexes automatically:

```cypher
-- Single property index for user_id lookups
CREATE INDEX entity_single IF NOT EXISTS
FOR (n:__Entity__)
ON (n.user_id)

-- Composite index for name + user_id (Enterprise Edition)
CREATE INDEX entity_composite IF NOT EXISTS
FOR (n:__Entity__)
ON (n.name, n.user_id)
```

---

## Deleting Graph Data

### Delete All User Graph Data

```python
# Delete all graph data for a user
memory.graph.delete_all(filters={"user_id": "user"})

# Delete with additional filters
memory.graph.delete_all(filters={
    "user_id": "user",
    "agent_id": "code_assistant"
})
```

### Reset Entire Graph

```python
# WARNING: Deletes all nodes and relationships
memory.graph.reset()
```

---

## Performance Considerations

### Similarity Threshold

Adjust the threshold for entity matching:

```python
config = {
    "graph_store": {
        "provider": "neo4j",
        "config": {...},
        "threshold": 0.9  # Higher = stricter matching, fewer false merges
    }
}

# Lower threshold (0.6-0.7): More entity merging, may conflate similar names
# Higher threshold (0.8-0.9): Less merging, may create duplicate entities
```

### Entity Normalization

Entities are normalized before storage:

```python
# "Alice Smith" -> "alice_smith"
# "React Native" -> "react_native"
# Relationships: "works with" -> "works_with"
```

### Batch Operations

For large imports, consider batching:

```python
def batch_add_to_graph(memory, items: list, user_id: str, batch_size: int = 10):
    """Add items in batches to avoid overloading."""
    results = []

    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        combined_text = "\n".join(batch)

        result = memory.add(
            combined_text,
            user_id=user_id,
            metadata={"batch_index": i // batch_size}
        )
        results.append(result)

    return results
```

---

## Common Graph Patterns

### Team/Organization Modeling

```python
# Add team structure
memory.add(
    """
    The engineering team at Anthropic includes:
    - Alice leads the Claude Core team
    - Bob and Carol report to Alice
    - Dave works on the Safety team, separate from Claude Core
    """,
    user_id="org_admin"
)

# Resulting graph structure:
# (alice) -[LEADS]-> (claude_core_team)
# (bob) -[REPORTS_TO]-> (alice)
# (carol) -[REPORTS_TO]-> (alice)
# (bob) -[MEMBER_OF]-> (claude_core_team)
# (carol) -[MEMBER_OF]-> (claude_core_team)
# (dave) -[MEMBER_OF]-> (safety_team)
```

### Technology Stack Modeling

```python
# Add project tech stack
memory.add(
    """
    The memory plugin uses:
    - Python with FastAPI for the backend
    - PostgreSQL with pgvector for vector storage
    - Redis for caching
    - React with TypeScript for the frontend
    """,
    user_id="user"
)

# Query: What technologies does the memory plugin use?
# Returns all USES relationships from memory_plugin
```

### Knowledge Domain Modeling

```python
# Add domain knowledge
memory.add(
    """
    mem0 is a memory layer for AI agents.
    It supports vector stores like Qdrant, Chroma, and Pinecone.
    The graph store uses Neo4j for relationship tracking.
    mem0 achieves 90% token reduction compared to full context.
    """,
    user_id="learner"
)
```

---

## Next Steps

- [Token Optimization](./token-optimization.md) - Achieve 90% token reduction
- [Quickstart](./quickstart.md) - Basic mem0 setup
- [Three-Tier Memory](./three-tier-memory.md) - User, session, and agent memory
