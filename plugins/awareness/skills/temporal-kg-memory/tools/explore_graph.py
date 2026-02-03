#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""Explore the contents of the experiment graph."""

import asyncio
import sys
from graphiti_core.driver.falkordb_driver import FalkorDriver


async def explore_graph(database: str = "experiment_filtered_v1"):
    driver = FalkorDriver(host="localhost", port=6380, database=database)

    print(f"=== Exploring Graph: {database} ===\n")

    # Count all node types
    print("--- Node Counts by Label ---")
    records, _, _ = await driver.execute_query(
        "MATCH (n) RETURN labels(n) as labels, count(n) as count ORDER BY count DESC"
    )
    total_nodes = 0
    for r in (records or []):
        count = r.get('count', 0)
        total_nodes += count
        print(f"  {r.get('labels')}: {count}")
    print(f"  TOTAL: {total_nodes} nodes")

    # Count all edges
    print("\n--- Edge Counts by Type ---")
    records, _, _ = await driver.execute_query(
        "MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC"
    )
    total_edges = 0
    for r in (records or []):
        count = r.get('count', 0)
        total_edges += count
        print(f"  {r.get('type')}: {count}")
    print(f"  TOTAL: {total_edges} edges")

    # Show all RELATES_TO facts (the semantic relationships)
    print("\n--- All Semantic Facts (RELATES_TO edges) ---")
    records, _, _ = await driver.execute_query(
        "MATCH ()-[r:RELATES_TO]->() RETURN r.fact as fact ORDER BY r.created_at"
    )
    for i, r in enumerate(records or [], 1):
        fact = r.get('fact', 'No fact')
        print(f"  {i}. {fact}")

    # Show Episode nodes (the ingested events)
    print("\n--- Episode Nodes (Ingested Events) ---")
    records, _, _ = await driver.execute_query(
        "MATCH (e:Episodic) RETURN e.name as name, e.source_description as source, e.created_at as created ORDER BY e.created_at LIMIT 15"
    )
    for r in (records or []):
        print(f"  {r.get('name')}: {r.get('source')}")

    # Show Entity nodes if any
    print("\n--- Entity Nodes ---")
    records, _, _ = await driver.execute_query(
        "MATCH (e:Entity) RETURN e.name as name, e.entity_type as type LIMIT 20"
    )
    if records:
        for r in records:
            print(f"  [{r.get('type')}] {r.get('name')}")
    else:
        print("  (No Entity nodes - relationships stored directly on edges)")

    await driver.close()


if __name__ == '__main__':
    db = sys.argv[1] if len(sys.argv) > 1 else "experiment_filtered_v1"
    asyncio.run(explore_graph(db))
