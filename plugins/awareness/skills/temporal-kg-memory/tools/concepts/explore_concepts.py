#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Explore the Concept Knowledge Graph.

Query patterns for the semantic layer.

Usage:
    uv run explore_concepts.py
"""

from falkordb import FalkorDB


def main():
    db = FalkorDB(host="localhost", port=6380)
    g = db.select_graph("concepts")

    print("=" * 60)
    print("CONCEPT KNOWLEDGE GRAPH EXPLORER")
    print("=" * 60)

    # Overview
    print("\n📊 OVERVIEW\n")
    concepts = g.query("MATCH (c:Concept) RETURN count(c)").result_set[0][0]
    docs = g.query("MATCH (d:Document) RETURN count(d)").result_set[0][0]
    rels = g.query("MATCH ()-[r:RELATES_TO]->() RETURN count(r)").result_set[0][0]
    print(f"  Concepts: {concepts}")
    print(f"  Documents: {docs}")
    print(f"  Relationships: {rels}")

    # All concepts with definitions
    print("\n📚 ALL CONCEPTS\n")
    result = g.query("""
        MATCH (c:Concept)
        RETURN c.name, c.definition, c.status
        ORDER BY c.name
    """)
    for row in result.result_set:
        status_icon = "✓" if row[2] == "verified" else "○"
        print(f"  {status_icon} {row[0]}")
        print(f"    {row[1][:80]}...")
        print()

    # Concept network
    print("\n🔗 CONCEPT NETWORK\n")
    result = g.query("""
        MATCH (c:Concept)-[r:RELATES_TO]->(related:Concept)
        RETURN c.name, collect(related.name) as related
        ORDER BY c.name
    """)
    for row in result.result_set:
        related = ", ".join(row[1]) if row[1] else "(none)"
        print(f"  {row[0]} → {related}")

    # Source documents
    print("\n📄 SOURCE DOCUMENTS\n")
    result = g.query("""
        MATCH (c:Concept)-[:INTRODUCED_IN]->(d:Document)
        RETURN d.path, collect(c.name) as concepts
        ORDER BY d.path
    """)
    for row in result.result_set:
        print(f"  {row[0]}")
        for concept in row[1]:
            print(f"    - {concept}")

    # Central concepts (most connected)
    print("\n⭐ CENTRAL CONCEPTS (most connected)\n")
    result = g.query("""
        MATCH (c:Concept)-[r]-()
        RETURN c.name, count(r) as degree
        ORDER BY degree DESC
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} connections")

    # Concept paths
    print("\n🛤️ CONCEPT PATHS\n")

    # Phase Transition → Kinetic Energy
    print("  Phase Transition → Kinetic Energy:")
    result = g.query("""
        MATCH path = (a:Concept {name: 'Phase Transition'})-[:RELATES_TO*1..4]->(b:Concept {name: 'Kinetic Energy'})
        RETURN [n in nodes(path) | n.name] as path
        LIMIT 3
    """)
    for row in result.result_set:
        print(f"    {' → '.join(row[0])}")

    # Creation Addiction → Activation
    print("\n  Creation Addiction → Activation:")
    result = g.query("""
        MATCH path = (a:Concept {name: 'Creation Addiction'})-[:RELATES_TO*1..3]->(b:Concept {name: 'Activation'})
        RETURN [n in nodes(path) | n.name] as path
        LIMIT 3
    """)
    for row in result.result_set:
        print(f"    {' → '.join(row[0])}")

    # Semantic queries
    print("\n🔍 SEMANTIC QUERIES\n")

    # Concepts introduced on Dec 13
    print("  Concepts from Dec 13:")
    result = g.query("""
        MATCH (c:Concept)
        WHERE c.introduced STARTS WITH '2025-12-13'
        RETURN c.name, c.introduced
    """)
    for row in result.result_set:
        print(f"    {row[0]} ({row[1]})")

    # Verified concepts
    print("\n  Verified concepts:")
    result = g.query("""
        MATCH (c:Concept {status: 'verified'})
        RETURN c.name
    """)
    for row in result.result_set:
        print(f"    ✓ {row[0]}")

    print("\n" + "=" * 60)
    print("Semantic layer active. Concepts queryable.")
    print("=" * 60)


if __name__ == "__main__":
    main()
