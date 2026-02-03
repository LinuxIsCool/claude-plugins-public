# Building Knowledge Graphs with HippoRAG

## Purpose

Understand how HippoRAG constructs knowledge graphs from documents using Open Information Extraction (OpenIE). This cookbook covers the graph construction pipeline, edge types, node management, and techniques for inspecting and manipulating the knowledge graph.

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IS_DIRECTED_GRAPH` | `False` | Whether graph edges are directed |
| `SYNONYMY_EDGE_TOPK` | `2047` | Max neighbors for synonymy edge search |
| `SYNONYMY_EDGE_SIM_THRESHOLD` | `0.8` | Similarity threshold for synonymy edges |
| `FORCE_INDEX_FROM_SCRATCH` | `False` | Rebuild entire index from scratch |
| `FORCE_OPENIE_FROM_SCRATCH` | `False` | Re-run entity/triple extraction |

## Instructions

### Understanding the Graph Structure

HippoRAG builds a heterogeneous graph with three types of nodes and multiple edge types:

```
                    ┌─────────────────────────────────────────┐
                    │          HippoRAG Knowledge Graph       │
                    └─────────────────────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
     ┌──────▼──────┐           ┌───────▼───────┐          ┌───────▼───────┐
     │   Passage   │           │    Entity     │          │     Fact      │
     │    Nodes    │           │    Nodes      │          │  (Triples)    │
     └──────┬──────┘           └───────┬───────┘          └───────┬───────┘
            │                          │                          │
            │ passage-entity edges     │ entity-entity edges      │ stored in
            └──────────────────────────┤ (from triples)           │ fact_embedding_store
                                       │                          │
                                       │ synonymy edges           │
                                       │ (similar entities)       │
                                       └──────────────────────────┘
```

### Node Types

1. **Passage Nodes**: Original document chunks with hash IDs
2. **Entity Nodes**: Named entities extracted via NER
3. **Fact Nodes**: Stored as (subject, predicate, object) triples

### Edge Types

1. **Fact Edges**: Connect entities mentioned in the same triple
2. **Passage-Entity Edges**: Link passages to their extracted entities
3. **Synonymy Edges**: Connect similar entities based on embedding similarity

### Graph Construction Pipeline

```python
from hipporag import HippoRAG
from hipporag.utils.config_utils import BaseConfig

# Custom configuration for graph construction
config = BaseConfig(
    llm_name='gpt-4o-mini',
    embedding_model_name='text-embedding-3-small',
    is_directed_graph=False,
    synonymy_edge_topk=2047,
    synonymy_edge_sim_threshold=0.8,
    save_openie=True  # Save OpenIE results for inspection
)

hipporag = HippoRAG(global_config=config, save_dir='outputs/kg_demo')

# Index documents - triggers full graph construction
documents = [
    "Marie Curie discovered polonium and radium.",
    "Polonium was named after Poland, Curie's homeland.",
    "The Curies won the Nobel Prize in Physics in 1903.",
    "Radium was used in early cancer treatments.",
    "Pierre Curie collaborated with Marie on radioactivity research."
]

hipporag.index(docs=documents)
```

## Code Examples

### Example 1: Inspecting the Knowledge Graph

```python
import igraph as ig

# Access the internal graph object
graph = hipporag.graph

# Basic graph statistics
print(f"Total nodes: {graph.vcount()}")
print(f"Total edges: {graph.ecount()}")
print(f"Is directed: {graph.is_directed()}")

# Get detailed breakdown
info = hipporag.get_graph_info()
print(f"\nGraph Statistics:")
print(f"  Phrase (entity) nodes: {info['num_phrase_nodes']}")
print(f"  Passage nodes: {info['num_passage_nodes']}")
print(f"  Extracted triples: {info['num_extracted_triples']}")
print(f"  Synonymy edges: {info['num_synonymy_triples']}")
print(f"  Passage-entity edges: {info['num_triples_with_passage_node']}")
```

### Example 2: Exploring Nodes and Edges

```python
# Get all entity nodes
entity_store = hipporag.entity_embedding_store
entity_ids = entity_store.get_all_ids()
print(f"Entities: {len(entity_ids)}")

# View entity content
for eid in entity_ids[:10]:
    row = entity_store.get_row(eid)
    print(f"  {row['content']}")

# Get all passages
chunk_store = hipporag.chunk_embedding_store
chunk_ids = chunk_store.get_all_ids()
print(f"\nPassages: {len(chunk_ids)}")

# View facts (triples)
fact_store = hipporag.fact_embedding_store
fact_ids = fact_store.get_all_ids()
print(f"\nFacts: {len(fact_ids)}")

for fid in fact_ids[:5]:
    row = fact_store.get_row(fid)
    triple = eval(row['content'])  # Stored as string representation
    print(f"  {triple[0]} --[{triple[1]}]--> {triple[2]}")
```

### Example 3: Accessing OpenIE Results

```python
import json
import os

# Load saved OpenIE results
openie_path = hipporag.openie_results_path
if os.path.exists(openie_path):
    with open(openie_path, 'r') as f:
        openie_data = json.load(f)

    print(f"Processed documents: {len(openie_data['docs'])}")
    print(f"Avg entity chars: {openie_data['avg_ent_chars']}")
    print(f"Avg entity words: {openie_data['avg_ent_words']}")

    # Inspect individual documents
    for doc in openie_data['docs'][:2]:
        print(f"\nPassage: {doc['passage'][:60]}...")
        print(f"  Entities: {doc['extracted_entities']}")
        print(f"  Triples:")
        for triple in doc['extracted_triples']:
            print(f"    {triple}")
```

### Example 4: Graph Visualization with igraph

```python
import igraph as ig
import matplotlib.pyplot as plt

# Prepare graph for visualization
graph = hipporag.graph

# Get node labels (content)
labels = []
for v in graph.vs:
    node_id = v['name']
    if node_id.startswith('entity-'):
        content = hipporag.entity_embedding_store.get_row(node_id)['content']
        labels.append(content[:20])
    elif node_id.startswith('chunk-'):
        labels.append('DOC')
    else:
        labels.append(node_id[:10])

# Color nodes by type
colors = []
for v in graph.vs:
    node_id = v['name']
    if node_id.startswith('entity-'):
        colors.append('lightblue')
    elif node_id.startswith('chunk-'):
        colors.append('lightgreen')
    else:
        colors.append('gray')

# Plot (for small graphs)
if graph.vcount() < 100:
    layout = graph.layout('fr')  # Fruchterman-Reingold
    ig.plot(
        graph,
        layout=layout,
        vertex_label=labels,
        vertex_color=colors,
        vertex_size=30,
        edge_arrow_size=0.5,
        bbox=(800, 600)
    )
```

### Example 5: Querying Graph Neighbors

```python
from hipporag.utils.misc_utils import compute_mdhash_id

# Find an entity node
entity_name = "marie curie"
entity_key = compute_mdhash_id(entity_name, prefix="entity-")

# Check if entity exists in graph
if entity_key in hipporag.node_name_to_vertex_idx:
    vertex_idx = hipporag.node_name_to_vertex_idx[entity_key]
    vertex = graph.vs[vertex_idx]

    # Get neighbors
    neighbors = graph.neighbors(vertex_idx)
    print(f"Neighbors of '{entity_name}':")
    for n_idx in neighbors:
        n_id = graph.vs[n_idx]['name']
        if n_id.startswith('entity-'):
            content = hipporag.entity_embedding_store.get_row(n_id)['content']
            print(f"  Entity: {content}")
        elif n_id.startswith('chunk-'):
            content = hipporag.chunk_embedding_store.get_row(n_id)['content']
            print(f"  Passage: {content[:50]}...")
```

### Example 6: Finding Entity Relationships

```python
# Map entities to their source documents
ent_to_chunks = hipporag.ent_node_to_chunk_ids

# Find documents mentioning a specific entity
target_entity_key = compute_mdhash_id("radium", prefix="entity-")
if target_entity_key in ent_to_chunks:
    chunk_ids = ent_to_chunks[target_entity_key]
    print(f"Documents mentioning 'radium':")
    for cid in chunk_ids:
        content = hipporag.chunk_embedding_store.get_row(cid)['content']
        print(f"  - {content}")
```

## Common Patterns

### Pattern 1: Rebuilding Graph from Scratch

```python
# Force complete rebuild
config = BaseConfig(
    force_index_from_scratch=True,
    force_openie_from_scratch=True
)
hipporag = HippoRAG(global_config=config, save_dir='outputs/fresh_index')
hipporag.index(docs=documents)
```

### Pattern 2: Adjusting Synonymy Edges

```python
# Stricter synonymy matching (fewer, higher-quality edges)
config = BaseConfig(
    synonymy_edge_sim_threshold=0.9,  # Higher threshold
    synonymy_edge_topk=100  # Fewer candidates
)

# More permissive matching (more connections)
config_permissive = BaseConfig(
    synonymy_edge_sim_threshold=0.7,
    synonymy_edge_topk=5000
)
```

### Pattern 3: Exporting Graph for External Analysis

```python
# Export to various formats
graph = hipporag.graph

# GraphML (for Gephi, Cytoscape)
graph.write_graphml('knowledge_graph.graphml')

# Edge list
graph.write_edgelist('edges.txt')

# Adjacency matrix (for small graphs)
import numpy as np
adj_matrix = np.array(graph.get_adjacency().data)
np.save('adjacency.npy', adj_matrix)

# Export as NetworkX graph
import networkx as nx

nx_graph = nx.Graph()
for e in graph.es:
    source = graph.vs[e.source]['name']
    target = graph.vs[e.target]['name']
    nx_graph.add_edge(source, target, weight=e['weight'])
```

### Pattern 4: Custom Node Attributes

```python
# Add custom attributes to graph nodes
for v in graph.vs:
    node_id = v['name']
    if node_id.startswith('entity-'):
        v['node_type'] = 'entity'
        v['embedding_dim'] = hipporag.entity_embedding_store.get_embedding(node_id).shape[0]
    elif node_id.startswith('chunk-'):
        v['node_type'] = 'passage'
        v['text_length'] = len(hipporag.chunk_embedding_store.get_row(node_id)['content'])

# Save with custom attributes
graph.write_pickle('graph_with_attributes.pickle')
```

### Pattern 5: Subgraph Extraction

```python
# Extract subgraph around specific entities
def extract_ego_graph(graph, center_name, radius=2):
    """Extract k-hop neighborhood around a node."""
    if center_name not in hipporag.node_name_to_vertex_idx:
        return None

    center_idx = hipporag.node_name_to_vertex_idx[center_name]

    # Get k-hop neighbors
    neighbors = set([center_idx])
    frontier = set([center_idx])

    for _ in range(radius):
        new_frontier = set()
        for v in frontier:
            new_frontier.update(graph.neighbors(v))
        neighbors.update(new_frontier)
        frontier = new_frontier

    # Induce subgraph
    subgraph = graph.subgraph(list(neighbors))
    return subgraph

# Example usage
entity_key = compute_mdhash_id("nobel prize", prefix="entity-")
subgraph = extract_ego_graph(graph, entity_key, radius=2)
if subgraph:
    print(f"Subgraph: {subgraph.vcount()} nodes, {subgraph.ecount()} edges")
```

## Troubleshooting

### Graph Construction Issues

1. **No edges created**: Check if OpenIE extracted valid triples
2. **Too many synonymy edges**: Increase `synonymy_edge_sim_threshold`
3. **Missing entities**: Verify NER is extracting entities correctly
4. **Graph file corruption**: Delete `graph.pickle` and rebuild

### Debugging Graph State

```python
# Verify graph consistency
print(f"Graph nodes: {graph.vcount()}")
print(f"Entity store: {len(hipporag.entity_embedding_store.get_all_ids())}")
print(f"Chunk store: {len(hipporag.chunk_embedding_store.get_all_ids())}")

# Expected: graph nodes = entities + chunks
expected = (len(hipporag.entity_embedding_store.get_all_ids()) +
            len(hipporag.chunk_embedding_store.get_all_ids()))
print(f"Expected nodes: {expected}")
```
