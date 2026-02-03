# Concept Registry

*The semantic layer of the ecosystem*
*First seeded: 2025-12-15*

---

## Overview

This registry tracks named concepts that have emerged in the ecosystem. Each concept has:
- A definition
- Source documents where it was introduced
- Relationships to other concepts
- Temporal validity

**Purpose**: Enable semantic queries across artifacts. Link ideas, not just files.

---

## Concepts

### Phase Transition

**Definition**: A fundamental reorganization of a system's structure, like ice to water. In this ecosystem, refers to the shift from chaos to structure (Phase 1, complete) and from structure to semantics (Phase 2, beginning).

**First Introduced**: 2025-12-13
**Source**: `.claude/journal/2025/12/13/19-00-the-phase-transition.md`

**Related Concepts**:
- [[Creation Addiction]]
- [[Semantic Coherence]]
- [[Potential Energy]]

**Status**: Active

---

### Creation Addiction

**Definition**: The preference for existence over function. The pattern of finding it more satisfying to create new things (agents, structures, systems) than to activate and use existing ones. Manifests as high potential energy with low kinetic energy.

**First Introduced**: 2025-12-13
**Source**: `.claude/journal/2025/12/13/19-00-the-phase-transition.md`

**Related Concepts**:
- [[Phase Transition]]
- [[Potential Energy]]
- [[Activation]]

**Status**: Active (named pattern to transcend)

---

### Semantic Coherence

**Definition**: The degree to which concepts are extracted, linked, and queryable across artifacts. Measured on a 1-10 scale. Low semantic coherence means ideas exist but aren't connected; high semantic coherence means concepts flow through a knowledge graph.

**First Introduced**: 2025-12-13
**Source**: `.claude/archive/assessments/2025-12-13-multi-agent-ecosystem-assessment.md`

**Assessment Score**: 5/10 (as of 2025-12-15)

**Related Concepts**:
- [[Structural Coherence]]
- [[External Coherence]]
- [[Phase Transition]]

**Status**: Active (improvement target)

---

### Potential Energy

**Definition**: Stored capacity to do work that hasn't been released. In the ecosystem: defined agents that haven't been activated, structures that haven't been filled, infrastructure that hasn't been used.

**First Introduced**: 2025-12-13
**Source**: `.claude/journal/2025/12/13/19-00-the-phase-transition.md`

**Related Concepts**:
- [[Kinetic Energy]]
- [[Creation Addiction]]
- [[Dormant Agents]]

**Status**: Active

---

### Kinetic Energy

**Definition**: Work actually happening. In the ecosystem: agents actively producing, concepts flowing through graphs, resources being catalogued, facts being verified.

**First Introduced**: 2025-12-13
**Source**: `.claude/journal/2025/12/13/19-00-the-phase-transition.md`

**Related Concepts**:
- [[Potential Energy]]
- [[Activation]]

**Status**: Active

---

### Master Skill Pattern

**Definition**: A plugin architecture pattern using progressive disclosure. Each plugin exposes ONE master SKILL.md that lists available sub-skills; sub-skills are loaded on-demand from a subskills/ directory. Addresses Claude Code's ~15,000 character skill description budget.

**First Introduced**: 2025-12-13
**Source**: `CLAUDE.md`, commit 440b7c1

**Verified**: 2025-12-15 by temporal-validator (VAL-001)
**Compliance**: 8/8 plugins

**Related Concepts**:
- [[Progressive Disclosure]]
- [[Plugin Architecture]]

**Status**: Active (verified)

---

### Metabolic Model

**Definition**: Understanding the ecosystem as an organism with ingestion (new information), processing (analysis/transformation), output (artifacts), and excretion (commits, pruning). Health is measured by flow through all stages.

**First Introduced**: 2025-12-13
**Source**: `.claude/agents/archivist.md`, `.claude/archive/metabolism.md`

**Related Concepts**:
- [[Metabolic Health]]
- [[Archivist]]

**Status**: Active

---

### Proactive Commit Discipline

**Definition**: The practice of committing immediately after completing semantic units of work, rather than batching commits reactively. Treats git as a coordination layer where commits are messages to other agents.

**First Introduced**: 2025-12-13
**Source**: `.claude/conventions/coordination.md`

**Related Concepts**:
- [[Git as Coordination Layer]]
- [[Semantic Unit]]

**Status**: Active

---

### Dormant Agents

**Definition**: Agents that are defined (have markdown files) but haven't been activated (never invoked for real work). Represents potential energy. Examples as of 2025-12-13: librarian, temporal-validator.

**First Introduced**: 2025-12-13
**Source**: `.claude/archive/patterns/agent-activity.md`

**Status**: 2025-12-15 - Librarian and temporal-validator now ACTIVATED

**Related Concepts**:
- [[Potential Energy]]
- [[Activation]]

---

### Activation

**Definition**: The act of giving a dormant agent its first real task. Converts potential energy to kinetic energy. The priority action identified by the phase transition analysis.

**First Introduced**: 2025-12-15
**Source**: `.claude/journal/2025/12/13/19-00-the-phase-transition.md`

**Related Concepts**:
- [[Dormant Agents]]
- [[Kinetic Energy]]
- [[Phase Transition]]

**Status**: Active (in progress)

---

## Statistics

| Metric | Value |
|--------|-------|
| Total concepts | 10 |
| Active concepts | 10 |
| Deprecated concepts | 0 |
| First seeded | 2025-12-15 |

---

## Concept Graph (Textual)

```
                    ┌─────────────────┐
                    │ Phase Transition │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐  ┌───────────────┐  ┌────────────────┐
│Creation Addiction│  │Semantic       │  │Potential Energy│
└────────┬────────┘  │Coherence      │  └───────┬────────┘
         │           └───────────────┘          │
         │                                      │
         ▼                                      ▼
┌─────────────────┐                    ┌────────────────┐
│ Dormant Agents  │────────────────────│ Kinetic Energy │
└────────┬────────┘                    └───────┬────────┘
         │                                     │
         └──────────────┬──────────────────────┘
                        ▼
                ┌───────────────┐
                │  Activation   │
                └───────────────┘
```

---

## How Concepts Will Be Used

1. **Semantic queries**: "Find all documents mentioning Phase Transition"
2. **Concept graph**: Link concepts to files, commits, and each other in FalkorDB
3. **Temporal tracking**: Know when concepts emerged and evolved
4. **Cross-artifact reasoning**: Connect ideas across journal, planning, registry

---

## Next: FalkorDB Ingestion

These concepts are ready to be ingested into the `concepts` graph in FalkorDB:

```cypher
// Example: Create concept node
CREATE (c:Concept {
  name: 'Phase Transition',
  definition: 'A fundamental reorganization...',
  introduced: datetime('2025-12-13'),
  source: '.claude/journal/2025/12/13/19-00-the-phase-transition.md',
  status: 'active'
})

// Example: Create relationship
MATCH (a:Concept {name: 'Phase Transition'})
MATCH (b:Concept {name: 'Creation Addiction'})
CREATE (a)-[:RELATES_TO {type: 'led_to_naming'}]->(b)
```

---

*The semantic layer begins. Concepts extracted, relationships mapped.*
