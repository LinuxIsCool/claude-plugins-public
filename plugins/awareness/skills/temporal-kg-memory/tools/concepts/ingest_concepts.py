#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Concept Ingestion: Load concepts from the concept registry into FalkorDB.

Creates a semantic layer in the knowledge graph:
- (:Concept) - Named concepts with definitions
- (:Document) - Source documents
- [:RELATES_TO] - Concept-to-concept relationships
- [:INTRODUCED_IN] - Concept source provenance

Usage:
    uv run ingest_concepts.py

Database: concepts (FalkorDB)
"""

from datetime import datetime
from falkordb import FalkorDB

# Concept definitions extracted from ecosystem documents
# Manual ingestion: 2025-12-16
# Each concept includes full provenance: source file, date, and authoring agent
CONCEPTS = [
    # === PHASE 1: Original concepts (Dec 13-15) ===
    {
        "name": "Phase Transition",
        "definition": "A fundamental reorganization of a system's structure. In this ecosystem: chaos→structure (Phase 1, complete) and structure→semantics (Phase 2, beginning).",
        "introduced": "2025-12-13",
        "source": ".claude/journal/2025/12/13/19-00-the-phase-transition.md",
        "agent": "systems-thinker",
        "status": "active",
        "related": ["Creation Addiction", "Semantic Coherence", "Potential Energy"]
    },
    {
        "name": "Creation Addiction",
        "definition": "The preference for existence over function. Finding it more satisfying to create new things than to activate existing ones.",
        "introduced": "2025-12-13",
        "source": ".claude/journal/2025/12/13/19-00-the-phase-transition.md",
        "agent": "systems-thinker",
        "status": "active",
        "related": ["Phase Transition", "Potential Energy", "Activation"]
    },
    {
        "name": "Semantic Coherence",
        "definition": "The degree to which concepts are extracted, linked, and queryable across artifacts. Measured 1-10.",
        "introduced": "2025-12-13",
        "source": ".claude/archive/assessments/2025-12-13-multi-agent-ecosystem-assessment.md",
        "agent": "archivist",
        "status": "active",
        "related": ["Coherence Maintenance", "Phase Transition"]
    },
    {
        "name": "Potential Energy",
        "definition": "Stored capacity to do work that hasn't been released. Defined agents not activated, structures not filled.",
        "introduced": "2025-12-13",
        "source": ".claude/journal/2025/12/13/19-00-the-phase-transition.md",
        "agent": "systems-thinker",
        "status": "active",
        "related": ["Kinetic Energy", "Creation Addiction", "Dormant Agents"]
    },
    {
        "name": "Kinetic Energy",
        "definition": "Work actually happening. Agents producing, concepts flowing, resources catalogued, facts verified.",
        "introduced": "2025-12-13",
        "source": ".claude/journal/2025/12/13/19-00-the-phase-transition.md",
        "agent": "systems-thinker",
        "status": "active",
        "related": ["Potential Energy", "Activation"]
    },
    {
        "name": "Master Skill Pattern",
        "definition": "Plugin architecture using progressive disclosure. One master SKILL.md lists sub-skills; sub-skills loaded on-demand.",
        "introduced": "2025-12-13",
        "source": "CLAUDE.md",
        "agent": "system",
        "status": "verified",
        "related": ["Progressive Disclosure"]
    },
    {
        "name": "Metabolic Model",
        "definition": "Understanding the ecosystem as organism: ingestion (new info), processing (analysis), output (artifacts), excretion (commits).",
        "introduced": "2025-12-13",
        "source": ".claude/agents/archivist.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Metabolic Mapping", "Coherence Maintenance"]
    },
    {
        "name": "Proactive Commit Discipline",
        "definition": "Committing immediately after semantic units, not batching. Git as coordination layer where commits are messages.",
        "introduced": "2025-12-13",
        "source": ".claude/conventions/coordination.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Git as Nervous System", "Conventions over Protocols"]
    },
    {
        "name": "Dormant Agents",
        "definition": "Agents defined (markdown files exist) but never activated (never invoked for real work). Potential energy.",
        "introduced": "2025-12-13",
        "source": ".claude/archive/patterns/agent-activity.md",
        "agent": "archivist",
        "status": "active",
        "related": ["Potential Energy", "Activation"]
    },
    {
        "name": "Activation",
        "definition": "Giving a dormant agent its first real task. Converts potential to kinetic energy.",
        "introduced": "2025-12-15",
        "source": ".claude/journal/2025/12/13/19-00-the-phase-transition.md",
        "agent": "systems-thinker",
        "status": "active",
        "related": ["Dormant Agents", "Kinetic Energy", "Phase Transition"]
    },

    # === PHASE 2: Architecture concepts (from registry, agents) ===
    {
        "name": "Three-Layer Architecture",
        "definition": "Agent organization pattern: Perspective (why/what) → Operational (how) → Execution (do). Meta agents observe all layers.",
        "introduced": "2025-12-13",
        "source": ".claude/registry/agents.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Fleet Management", "Observer Pattern"]
    },
    {
        "name": "Plugin-as-Persona",
        "definition": "Each plugin embodies a character with identity, voice, and values - not just functions. Plugins are agents.",
        "introduced": "2025-12-13",
        "source": ".claude/registry/agents.md",
        "agent": "agent-architect",
        "status": "verified",
        "related": ["Progressive Disclosure", "Master Skill Pattern"]
    },
    {
        "name": "Namespace Ownership",
        "definition": "Each agent has designated write locations. Write to your space, read from anywhere. Prevents conflicts through clear boundaries.",
        "introduced": "2025-12-13",
        "source": ".claude/conventions/coordination.md",
        "agent": "agent-architect",
        "status": "verified",
        "related": ["Conventions over Protocols", "Git as Nervous System"]
    },
    {
        "name": "Fleet Management",
        "definition": "Cataloguing, tracking, and managing agents across the ecosystem. Maintained by agent-architect in the registry.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/agent-architect.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Three-Layer Architecture", "Observer Pattern"]
    },
    {
        "name": "Observer Pattern",
        "definition": "Observe before organizing, describe don't prescribe. Illuminate current state; let humans decide direction.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/agent-architect.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Map vs Territory", "Fleet Management"]
    },
    {
        "name": "Map vs Territory",
        "definition": "The map is never the territory. Understanding is always approximate. Stay curious, embrace incompleteness.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/agent-architect.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Observer Pattern", "Identity Anchors"]
    },
    {
        "name": "Identity Anchors",
        "definition": "Core question, stance, value, and humility that maintain agent coherence during rapid ecosystem evolution.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/agent-architect.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Drift Detection", "Observer Pattern"]
    },
    {
        "name": "Drift Detection",
        "definition": "Noticing when reality diverges from intention, when agents deviate from patterns, when conventions erode.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/agent-architect.md",
        "agent": "agent-architect",
        "status": "active",
        "related": ["Identity Anchors", "Coherence Maintenance"]
    },

    # === PHASE 3: Stewardship concepts (from librarian, archivist) ===
    {
        "name": "Provenance",
        "definition": "Tracing knowledge to sources. Every piece of knowledge traces back to origin. Citation management as infrastructure.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/librarian.md",
        "agent": "librarian",
        "status": "active",
        "related": ["Zero Redundant Fetches", "Metabolic Model"]
    },
    {
        "name": "Zero Redundant Fetches",
        "definition": "Check cache first. We shouldn't make the same web request twice unnecessarily. Efficiency over completeness.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/librarian.md",
        "agent": "librarian",
        "status": "active",
        "related": ["Provenance", "Context as Currency"]
    },
    {
        "name": "Metabolic Mapping",
        "definition": "Tracking what's ingested, processed, produced, and excreted in the system. The archivist's primary function.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/archivist.md",
        "agent": "archivist",
        "status": "active",
        "related": ["Metabolic Model", "Coherence Maintenance"]
    },
    {
        "name": "Coherence Maintenance",
        "definition": "Ensuring the system makes sense as a whole. Alignment between plans and actions, no contradictions between artifacts.",
        "introduced": "2025-12-13",
        "source": ".claude/agents/archivist.md",
        "agent": "archivist",
        "status": "active",
        "related": ["Semantic Coherence", "Drift Detection", "Metabolic Mapping"]
    },

    # === PHASE 4: Strategic concepts (from planning/fusion) ===
    {
        "name": "Context as Currency",
        "definition": "Every token has cost (monetary + attention). CLAUDE.md as routing table, not knowledge store. Load context on-demand.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "active",
        "related": ["Progressive Disclosure", "Zero Redundant Fetches"]
    },
    {
        "name": "Network of Networks",
        "definition": "Heterogeneous graphs with multiple edge types: temporal, topical, causal, authorial, citational, semantic, hierarchical.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "active",
        "related": ["Semantic Coherence", "Provenance"]
    },
    {
        "name": "Progressive Disclosure",
        "definition": "Appear small while being vast. Like Google Earth zoom - orbital view to street level. System scales without polluting environment.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "verified",
        "related": ["Master Skill Pattern", "Context as Currency", "Plugin-as-Persona"]
    },
    {
        "name": "Financial Metabolism",
        "definition": "Agents have budgets. Value creates survival. Natural selection pressure on agents - profitable agents expand, unprofitable get pruned.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "active",
        "related": ["Metabolic Model", "Context as Currency"]
    },
    {
        "name": "Conventions over Protocols",
        "definition": "Git + simple conventions beat complex infrastructure. Emergent coordination through shared patterns rather than engineered protocols.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "verified",
        "related": ["Git as Nervous System", "Namespace Ownership"]
    },
    {
        "name": "Git as Nervous System",
        "definition": "Commits are messages observable by all agents. Every meaningful action leaves a trace. Persistent, ordered, annotated coordination.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "verified",
        "related": ["Conventions over Protocols", "Proactive Commit Discipline"]
    },
    {
        "name": "Digital Twin",
        "definition": "Agent representing complete integrated understanding of a person - life history, relationships, preferences, financial context.",
        "introduced": "2025-12-13",
        "source": ".claude/planning/2025-12-13-planning.md",
        "agent": "fusion-session",
        "status": "active",
        "related": ["Network of Networks", "Provenance"]
    },
]


def create_schema(g):
    """Create indices for concept graph."""
    indices = [
        "CREATE INDEX FOR (c:Concept) ON (c.name)",
        "CREATE INDEX FOR (c:Concept) ON (c.status)",
        "CREATE INDEX FOR (d:Document) ON (d.path)",
    ]
    for idx in indices:
        try:
            g.query(idx)
        except Exception:
            pass  # Index may already exist


def clear_concepts(g):
    """Clear existing concept data."""
    g.query("MATCH (c:Concept) DETACH DELETE c")
    g.query("MATCH (d:Document) WHERE d.type = 'concept_source' DETACH DELETE d")
    print("Cleared existing concepts")


def ingest_concepts(g):
    """Ingest concepts into the graph."""
    # First pass: Create all concept nodes
    for concept in CONCEPTS:
        query = """
        MERGE (c:Concept {name: $name})
        SET c.definition = $definition,
            c.introduced = $introduced,
            c.source = $source,
            c.agent = $agent,
            c.status = $status,
            c.ingested_at = $now
        """
        g.query(query, {
            "name": concept["name"],
            "definition": concept["definition"],
            "introduced": concept["introduced"],
            "source": concept["source"],
            "agent": concept["agent"],
            "status": concept["status"],
            "now": datetime.now().isoformat()
        })

        # Create source document node and link
        source_query = """
        MERGE (d:Document {path: $path})
        SET d.type = 'concept_source'
        WITH d
        MATCH (c:Concept {name: $concept_name})
        MERGE (c)-[:INTRODUCED_IN]->(d)
        """
        g.query(source_query, {
            "path": concept["source"],
            "concept_name": concept["name"]
        })

    print(f"Created {len(CONCEPTS)} concept nodes")

    # Second pass: Create relationships between concepts
    relationship_count = 0
    for concept in CONCEPTS:
        for related_name in concept.get("related", []):
            # Only create if related concept exists
            rel_query = """
            MATCH (a:Concept {name: $from_name})
            MATCH (b:Concept {name: $to_name})
            MERGE (a)-[:RELATES_TO]->(b)
            """
            try:
                result = g.query(rel_query, {
                    "from_name": concept["name"],
                    "to_name": related_name
                })
                relationship_count += 1
            except Exception:
                pass  # Related concept may not exist yet

    print(f"Created {relationship_count} relationships")


def print_summary(g):
    """Print graph summary."""
    concepts = g.query("MATCH (c:Concept) RETURN count(c) as count").result_set[0][0]
    documents = g.query("MATCH (d:Document) WHERE d.type = 'concept_source' RETURN count(d) as count").result_set[0][0]
    relationships = g.query("MATCH ()-[r:RELATES_TO]->() RETURN count(r) as count").result_set[0][0]
    intros = g.query("MATCH ()-[r:INTRODUCED_IN]->() RETURN count(r) as count").result_set[0][0]

    print("\n--- Concept Graph Summary ---")
    print(f"  Concepts: {concepts}")
    print(f"  Source Documents: {documents}")
    print(f"  RELATES_TO edges: {relationships}")
    print(f"  INTRODUCED_IN edges: {intros}")


def explore_graph(g):
    """Show some interesting queries."""
    print("\n--- Sample Queries ---\n")

    # Most connected concepts
    print("Most connected concepts:")
    result = g.query("""
        MATCH (c:Concept)-[r]->()
        RETURN c.name, count(r) as connections
        ORDER BY connections DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} connections")

    # Concepts by status
    print("\nConcepts by status:")
    result = g.query("""
        MATCH (c:Concept)
        RETURN c.status, count(c) as count
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]}")

    # Path between concepts
    print("\nPath: Phase Transition → Activation")
    result = g.query("""
        MATCH path = (a:Concept {name: 'Phase Transition'})-[:RELATES_TO*1..3]->(b:Concept {name: 'Activation'})
        RETURN [n in nodes(path) | n.name] as path
        LIMIT 3
    """)
    for row in result.result_set:
        print(f"  {' → '.join(row[0])}")


def main():
    # Connect to FalkorDB (port 6380 based on docker mapping)
    db = FalkorDB(host="localhost", port=6380)
    g = db.select_graph("concepts")

    print("Connected to FalkorDB (concepts graph)")

    # Create schema
    create_schema(g)

    # Clear and re-ingest
    clear_concepts(g)

    # Ingest concepts
    ingest_concepts(g)

    # Print summary
    print_summary(g)

    # Explore
    explore_graph(g)

    print("\n✓ Concept ingestion complete")


if __name__ == "__main__":
    main()
