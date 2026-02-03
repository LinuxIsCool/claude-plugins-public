# Universal Skill Tree Protocol

Design skill hierarchies with prerequisites, proficiency levels, and relationships.

## Core Concepts

### Skill Relationships

| Relationship | Meaning | Example |
|--------------|---------|---------|
| `requires` | Hard dependency - must have A before B | `hipporag` requires `embeddings` |
| `extends` | Builds upon, enhances | `advanced-git` extends `git-basics` |
| `conflicts_with` | Mutually exclusive | `vim-mode` conflicts with `emacs-mode` |
| `complements` | Works well together | `testing` complements `debugging` |
| `part_of` | Sub-skill relationship | `transcription` part_of `transcript-master` |

### Proficiency Levels

```
novice → practitioner → expert → master
```

| Level | Description | Typical Indicators |
|-------|-------------|-------------------|
| **novice** | Basic awareness, needs guidance | Can use with instructions |
| **practitioner** | Regular usage, some independence | Can use without guidance |
| **expert** | Deep understanding, teaches others | Can extend and customize |
| **master** | Defines best practices | Can design new skills |

## Schema Design

### Skill Node

```yaml
skill:
  id: "hipporag"
  name: "HippoRAG Memory"
  description: "Hippocampal-inspired RAG with knowledge graphs"
  plugin: "memory"
  type: "sub"  # master | sub
  path: "plugins/memory/skills/hipporag/SKILL.md"

  # Relationships
  requires:
    - embeddings
    - vector-search
  extends:
    - basic-rag
  complements:
    - knowledge-graphs

  # Metadata
  proficiency_level: expert
  category: memory
  tags:
    - rag
    - knowledge-graph
    - memory

  # Temporal
  version: "1.0.0"
  created: "2025-01-15"
  updated: "2025-01-20"
```

### Skill Tree

```yaml
skill_tree:
  id: "memory-mastery"
  name: "Memory Systems Mastery"
  version: "1.0.0"
  root: "memory-master"

  nodes:
    - id: "memory-master"
      type: master
      children:
        - agentmemory
        - hipporag
        - mem0
        - embeddings
      prerequisites: []
      proficiency_levels:
        - aware
        - capable
        - fluent
        - master

    - id: "hipporag"
      type: sub
      children:
        - entity-extraction
        - pagerank-tuning
      prerequisites:
        - embeddings
        - vector-search
```

## Learning Paths

### Linear Path
Sequential progression through prerequisites:
```
embeddings → vector-search → basic-rag → hipporag → advanced-rag
```

### Branching Path
Multiple specialization options:
```
                    ┌─→ agentmemory (simple)
embeddings → rag-basics ─┼─→ mem0 (three-tier)
                    └─→ hipporag (knowledge-graph)
```

### Parallel Paths
Independent tracks that complement:
```
Track A: embeddings → vector-search → semantic-search
Track B: graphs → knowledge-graphs → graphiti
                        ↓
               Both feed into: hipporag
```

## Implementation in SKILL.md

### Declaring Prerequisites

In skill frontmatter or body:

```yaml
---
name: hipporag
description: |
  Hippocampal-inspired RAG with knowledge graphs.
  Requires: embeddings, vector-search knowledge.
  Extends: basic-rag patterns.
---

# Prerequisites

This skill assumes familiarity with:
- **embeddings** - Vector embedding concepts
- **vector-search** - Similarity search techniques

Read these first if unfamiliar:
- `plugins/memory/skills/embeddings/SKILL.md`
- `plugins/memory/skills/vector-search/SKILL.md`
```

### Skill Tree Visualization

In master skill:

```markdown
## Learning Progression

```
memory-master
    │
    ├─→ embeddings (foundation)
    │       ↓
    ├─→ vector-search (requires embeddings)
    │       ↓
    ├─→ agentmemory (simple, requires vector-search)
    │       ↓
    ├─→ mem0 (three-tier, requires agentmemory)
    │       ↓
    └─→ hipporag (advanced, requires all above + graphs)
```

## Building a Skill Tree

### Step 1: Identify Skills
List all skills in your domain.

### Step 2: Map Dependencies
For each skill, identify:
- What must you know first? (requires)
- What does this build upon? (extends)
- What conflicts? (conflicts_with)
- What works well together? (complements)

### Step 3: Define Levels
Assign proficiency levels based on complexity.

### Step 4: Create Paths
Design learning progressions:
- Linear for strict dependencies
- Branching for specializations
- Parallel for complementary tracks

### Step 5: Document in Master Skill
Include the tree visualization and path descriptions.

## Gap Analysis

Compare current skills vs. required skills for a goal:

```
Goal: Build production memory system

Required:
  ✅ embeddings (have)
  ✅ vector-search (have)
  ❌ database-design (need)
  ❌ caching-strategies (need)
  ✅ mem0 (have)

Gap: database-design, caching-strategies
Recommendation: Learn database-design first (prereq for caching)
```

## Integration Points

### With knowledge-graphs Plugin
Store skill relationships in a graph database for:
- Semantic similarity queries
- Path finding algorithms
- Relationship visualization

### With memory Plugin
Track proficiency over time:
- Usage frequency
- Success/failure patterns
- Learning progression

### With awareness Plugin
Align with learning progression patterns.
