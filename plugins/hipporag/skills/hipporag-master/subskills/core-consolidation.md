---
name: core-consolidation
description: Master HippoRAG memory consolidation with schema evolution, edge strengthening, contradiction detection, and long-term knowledge management. Use when improving retrieval quality over time, managing memory decay, or evolving knowledge structures.
allowed-tools: Read, Glob, Grep, Bash, WebFetch
---

# HippoRAG Core: Consolidation (Memory Strengthening)

Long-term memory management through schema evolution and edge strengthening.

## Biological Analogy: Systems Consolidation

In the brain, **systems consolidation** transfers memories from hippocampus to neocortex:
- Recently formed memories are hippocampus-dependent
- Repeated reactivation strengthens cortical connections
- Eventually, memories become hippocampus-independent
- This process happens during sleep (replay)

HippoRAG's consolidation mimics this:
- New knowledge enters as raw triples (episodic)
- Repeated access strengthens edge weights (semantic)
- Schema evolves to capture patterns (abstraction)
- Old, unaccessed knowledge decays (forgetting)

```
Consolidation Over Time:

Day 1: Episodic (raw triples)
  (Alice, CEO of, TechCorp) [weight: 1.0]
  (Alice, founded, TechCorp) [weight: 1.0]

Day 30: Partially consolidated
  (Alice, CEO of, TechCorp) [weight: 2.5]  ← Frequently accessed
  (Alice, founded, TechCorp) [weight: 1.2]

Day 90: Consolidated + Schema evolved
  Alice [type: Executive]  ← New type emerged
  (Alice, LEADS, TechCorp) [weight: 4.2]  ← Relation normalized
```

## Territory Map

```
HippoRAG Consolidation Pipeline:

┌─────────────────┐
│  Access Tracking│  Monitor query patterns
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Edge Strengthen │  Boost frequently used edges
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Schema Evolution│  Infer new types/relations
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Contradiction   │  Detect conflicting facts
│   Detection     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Memory Decay    │  Reduce unused edge weights
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Pruning      │  Remove low-weight edges
└─────────────────┘
```

## Beginner Techniques

### Enabling Consolidation

```python
from hipporag import HippoRAG

# Enable automatic consolidation
hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    consolidation_enabled=True,
    consolidation_interval=3600  # Run every hour
)
```

### Manual Consolidation Trigger

```python
# Trigger consolidation manually
await hippo.consolidate()

# With options
await hippo.consolidate(
    strengthen_accessed=True,    # Boost frequently accessed edges
    decay_unused=True,           # Reduce unused edge weights
    prune_weak=False             # Don't delete weak edges yet
)
```

### Viewing Consolidation Stats

```python
# Get consolidation statistics
stats = await hippo.get_consolidation_stats()

print(f"Total edges: {stats['total_edges']}")
print(f"Avg edge weight: {stats['avg_weight']:.2f}")
print(f"Edges strengthened (last run): {stats['edges_strengthened']}")
print(f"Edges decayed (last run): {stats['edges_decayed']}")
print(f"Edges pruned (last run): {stats['edges_pruned']}")
print(f"Schema changes: {stats['schema_changes']}")
```

## Intermediate Techniques

### Access Tracking

```python
# Every search query updates access counts
results = await hippo.search("TechCorp leadership")

# Access counts are updated automatically for:
# - Seed entities (query entities)
# - Traversed edges (PPR walk)
# - Retrieved nodes (top-k results)

# View access patterns
access_log = await hippo.get_access_log(days=7)
for entity, count in access_log['entities'][:10]:
    print(f"  {entity}: {count} accesses")
```

### Edge Strengthening Configuration

```python
from hipporag import ConsolidationConfig

config = ConsolidationConfig(
    # Strengthening parameters
    access_weight_increment=0.1,     # Weight added per access
    access_recency_decay=0.95,       # Recent accesses count more
    max_edge_weight=10.0,            # Cap to prevent runaway

    # Decay parameters
    decay_rate=0.01,                 # Daily decay rate
    decay_threshold=0.1,             # Min weight before pruning

    # Schedule
    interval_hours=24,               # Run daily
    run_at_hour=3                    # Run at 3 AM
)

hippo = HippoRAG(
    backend="neo4j",
    connection="bolt://localhost:7687",
    consolidation_config=config
)
```

### Schema Evolution

HippoRAG can evolve its schema based on patterns:

```python
# Enable schema evolution
await hippo.enable_schema_evolution()

# The system will:
# 1. Cluster similar entities → Infer new types
# 2. Cluster similar relations → Normalize predicates
# 3. Detect hierarchies → Create type hierarchies

# View evolved schema
schema = await hippo.get_schema()

print("Entity Types:")
for etype in schema['entity_types']:
    print(f"  {etype.name}: {etype.count} entities")
    print(f"    Examples: {', '.join(etype.examples[:3])}")

print("\nRelation Types:")
for rtype in schema['relation_types']:
    print(f"  {rtype.name}: {rtype.count} edges")
    print(f"    Source: {rtype.source_types}")
    print(f"    Target: {rtype.target_types}")
```

### Contradiction Detection

```python
# Detect contradictory facts
contradictions = await hippo.detect_contradictions()

for c in contradictions:
    print(f"Contradiction found:")
    print(f"  Fact 1: {c.fact1} (source: {c.source1})")
    print(f"  Fact 2: {c.fact2} (source: {c.source2})")
    print(f"  Type: {c.type}")  # e.g., 'temporal', 'logical'

# Resolve contradictions
for c in contradictions:
    if c.type == 'temporal':
        # Keep more recent fact, invalidate older
        await hippo.invalidate_edge(
            c.older_edge_id,
            reason="superseded",
            valid_until=c.newer_edge.valid_from
        )
```

## Advanced Techniques

### Memory Replay (Sleep-like Consolidation)

Inspired by hippocampal replay during sleep:

```python
async def memory_replay(hippo, replay_count=100):
    """
    Simulate memory replay for consolidation.
    Re-activates important patterns to strengthen them.
    """
    # Get most accessed entities
    hot_entities = await hippo.get_hot_entities(limit=20)

    for _ in range(replay_count):
        # Random walk from hot entities (simulates replay)
        seed = random.choice(hot_entities)
        await hippo.search(
            f"Information about {seed.name}",
            consolidation_mode=True  # Track but don't return
        )

    # Run consolidation to process replays
    await hippo.consolidate()
```

### Temporal Edge Management

```python
from datetime import datetime, timedelta

# HippoRAG supports bi-temporal edges:
# - valid_from: When the fact became true
# - valid_until: When the fact became false (if known)
# - created_at: When we learned this fact
# - updated_at: When we last modified this edge

# Invalidate outdated fact
await hippo.invalidate_edge(
    edge_id="uuid-of-old-ceo-edge",
    valid_until=datetime(2023, 6, 1),
    reason="Alice stepped down as CEO"
)

# Query historical state
results = await hippo.search(
    "TechCorp leadership",
    valid_at=datetime(2022, 1, 1)  # Who was CEO in 2022?
)

# View edge history
history = await hippo.get_edge_history(entity="Alice")
for edge in history:
    print(f"{edge.fact}")
    print(f"  Valid: {edge.valid_from} to {edge.valid_until}")
    print(f"  Status: {'current' if edge.is_current else 'historical'}")
```

### Progressive Schema Refinement

```python
# Define schema refinement rules
refinements = [
    # Merge similar relation types
    {
        "type": "merge_relations",
        "sources": ["is CEO of", "leads", "heads", "runs"],
        "target": "LEADS",
        "conditions": {"source_type": "Person", "target_type": "Organization"}
    },

    # Create type hierarchy
    {
        "type": "create_hierarchy",
        "parent": "Organization",
        "children": ["Company", "Startup", "NonProfit"]
    },

    # Infer entity types from relations
    {
        "type": "infer_type",
        "relation": "FOUNDED",
        "source_type": "Person",
        "target_type": "Organization"
    }
]

await hippo.apply_schema_refinements(refinements)
```

### Forgetting Curve Implementation

```python
from math import exp

class ForgettingCurve:
    """
    Ebbinghaus forgetting curve for edge decay.
    Retention = e^(-t/S) where S is stability
    """

    def __init__(self, initial_stability=30):  # 30 days
        self.initial_stability = initial_stability

    def calculate_retention(self, days_since_access, access_count):
        # Stability increases with access count
        stability = self.initial_stability * (1 + 0.5 * access_count)
        return exp(-days_since_access / stability)

    def should_prune(self, edge, threshold=0.1):
        retention = self.calculate_retention(
            edge.days_since_access,
            edge.access_count
        )
        return retention < threshold

# Apply forgetting curve to consolidation
curve = ForgettingCurve()

async def consolidate_with_forgetting(hippo):
    edges = await hippo.get_all_edges()

    for edge in edges:
        retention = curve.calculate_retention(
            edge.days_since_access,
            edge.access_count
        )

        # Update edge weight based on retention
        new_weight = edge.initial_weight * retention
        await hippo.update_edge_weight(edge.id, new_weight)

        # Prune if below threshold
        if curve.should_prune(edge):
            await hippo.prune_edge(edge.id)
```

### Community Detection for Schema

```python
# Use graph clustering to discover entity communities
communities = await hippo.detect_communities(
    algorithm="louvain",
    resolution=1.0
)

for community in communities:
    print(f"\nCommunity {community.id}:")
    print(f"  Size: {len(community.entities)}")
    print(f"  Top entities: {', '.join(community.top_entities[:5])}")
    print(f"  Suggested type: {community.suggested_type}")

# Optionally apply community labels as entity types
for community in communities:
    if community.coherence > 0.7:  # High coherence threshold
        await hippo.apply_community_type(
            community.id,
            type_name=community.suggested_type
        )
```

## Consolidation Strategies

### Strategy 1: Frequency-Based

```python
# Strengthen edges based purely on access frequency
config = ConsolidationConfig(
    strategy="frequency",
    access_weight_increment=0.2,
    decay_rate=0,  # No decay
)
```

### Strategy 2: Recency-Weighted

```python
# Recent accesses count more than old ones
config = ConsolidationConfig(
    strategy="recency",
    recency_halflife_days=7,  # Halves every 7 days
    max_recency_bonus=2.0
)
```

### Strategy 3: Importance-Based

```python
# Weight by semantic importance, not just access
config = ConsolidationConfig(
    strategy="importance",
    use_pagerank_importance=True,  # Global PageRank
    use_type_importance=True,      # Some types matter more
    type_weights={
        "Person": 1.2,
        "Organization": 1.1,
        "Date": 0.8
    }
)
```

### Strategy 4: Adaptive

```python
# Combine strategies based on graph state
config = ConsolidationConfig(
    strategy="adaptive",
    # Early phase: build connections
    early_phase_days=30,
    early_decay_rate=0,
    early_strengthen_rate=0.3,
    # Mature phase: maintain and prune
    mature_decay_rate=0.05,
    mature_strengthen_rate=0.1,
    mature_prune_threshold=0.1
)
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Retrieval quality degrades | Over-pruning | Increase decay_threshold |
| Important facts pruned | Insufficient access | Add to protected entities list |
| Schema too coarse | Low clustering resolution | Increase resolution parameter |
| Contradictions persist | Detection disabled | Enable contradiction_detection |
| Memory bloat | No pruning | Enable decay and pruning |

## Best Practices

1. **Start without pruning**: Let the graph grow before enabling decay
2. **Monitor access patterns**: Hot entities should be strengthened
3. **Review schema changes**: Validate automated type inference
4. **Handle contradictions**: Don't ignore detected conflicts
5. **Backup before pruning**: Keep snapshots of pre-pruned state
6. **Tune for domain**: Different domains need different decay rates

## Reference

### Consolidation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `access_weight_increment` | 0.1 | Weight added per access |
| `decay_rate` | 0.01 | Daily decay rate for unused edges |
| `decay_threshold` | 0.1 | Weight below which edges are pruned |
| `max_edge_weight` | 10.0 | Maximum edge weight cap |
| `consolidation_interval` | 86400 | Seconds between consolidation runs |

### Schema Evolution Operations

| Operation | Description | When to Use |
|-----------|-------------|-------------|
| `merge_relations` | Combine similar predicates | Normalize vocabulary |
| `infer_type` | Derive entity types from patterns | Bootstrap schema |
| `create_hierarchy` | Build type hierarchies | Organize entity types |
| `split_type` | Divide overly broad types | Refine granularity |

## Related Sub-Skills

- **core-indexing**: Create the triples that consolidation strengthens
- **core-retrieval**: Queries that drive access patterns
- **integration-backends**: Database support for consolidation operations
- **recipes-use-cases**: Long-running memory system patterns
