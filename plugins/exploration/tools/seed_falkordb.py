#!/usr/bin/env python3
"""
Seed the Exploration Knowledge Graph in FalkorDB

FalkorDB uses Redis protocol with GRAPH.QUERY command.
Browser available at http://localhost:3001

Usage:
    python seed_falkordb.py [--host HOST] [--port PORT]
"""

import os
import argparse

FALKOR_HOST = os.environ.get("FALKORDB_HOST", "localhost")
FALKOR_PORT = int(os.environ.get("FALKORDB_PORT", "6380"))
GRAPH_NAME = "exploration"


def get_client():
    """Get FalkorDB client."""
    try:
        from falkordb import FalkorDB
        return FalkorDB(host=FALKOR_HOST, port=FALKOR_PORT)
    except ImportError:
        print("Installing falkordb...")
        import subprocess
        subprocess.run(["uv", "pip", "install", "falkordb"], check=True)
        from falkordb import FalkorDB
        return FalkorDB(host=FALKOR_HOST, port=FALKOR_PORT)


def create_exploration_graph(db):
    """Create and populate the exploration knowledge graph."""
    graph = db.select_graph(GRAPH_NAME)

    # Clear existing data
    try:
        graph.query("MATCH (n) DETACH DELETE n")
        print("Cleared existing graph data")
    except Exception as e:
        print(f"Note: {e}")

    # Create circles
    circles_query = """
    CREATE (substrate:Circle {name: 'substrate', description: 'Machine, OS, hardware', mastery: 0.55})
    CREATE (tools:Circle {name: 'tools', description: 'Claude Code, MCP, plugins', mastery: 0.45})
    CREATE (network:Circle {name: 'network', description: 'Connectivity, containers', mastery: 0.40})
    CREATE (history:Circle {name: 'history', description: 'Git, evolution, decisions', mastery: 0.35})
    CREATE (cosmos:Circle {name: 'cosmos', description: 'Natural laws, physics', mastery: 0.25})
    RETURN substrate, tools, network, history, cosmos
    """
    graph.query(circles_query)
    print("Created 5 circles")

    # Create substrate entities
    substrate_query = """
    CREATE (host:Entity:Hardware {id: 'hw-host', name: 'Lenovo 90UT', role: 'desktop', vendor: 'Lenovo'})
    CREATE (cpu:Entity:Hardware {id: 'hw-cpu', name: 'Intel i7-13700F', cores: 16, threads: 24, max_mhz: 5200})
    CREATE (gpu:Entity:Hardware {id: 'hw-gpu', name: 'NVIDIA RTX 4070', vram_gb: 12, driver: '580.82'})
    CREATE (ram:Entity:Hardware {id: 'hw-ram', name: 'System RAM', total_gb: 32, available_gb: 24})
    CREATE (storage:Entity:Hardware {id: 'hw-storage', name: 'NVMe SSD', size_gb: 929, used_percent: 75})
    CREATE (os:Entity:Software {id: 'sw-os', name: 'Pop!_OS 22.04', base: 'Ubuntu', vendor: 'System76'})
    CREATE (kernel:Entity:Software {id: 'sw-kernel', name: 'Linux 6.17.4'})
    CREATE (claude:Entity:Software {id: 'sw-claude', name: 'Claude Code 2.0.67', sessions: 79})
    CREATE (python:Entity:Software {id: 'sw-python', name: 'Python 3.13.2', manager: 'uv'})
    CREATE (tmux:Entity:Software {id: 'term-tmux', name: 'tmux'})
    CREATE (alacritty:Entity:Software {id: 'term-alacritty', name: 'Alacritty', colorterm: 'truecolor'})

    // Hardware relationships
    CREATE (cpu)-[:PART_OF]->(host)
    CREATE (gpu)-[:PART_OF]->(host)
    CREATE (ram)-[:PART_OF]->(host)
    CREATE (storage)-[:PART_OF]->(host)
    CREATE (os)-[:RUNS_ON]->(host)
    CREATE (kernel)-[:PART_OF]->(os)
    CREATE (claude)-[:RUNS_IN]->(tmux)
    CREATE (tmux)-[:RUNS_IN]->(alacritty)

    // Link to substrate circle
    WITH host, cpu, gpu, ram, storage, os, kernel, claude, python, tmux, alacritty
    MATCH (c:Circle {name: 'substrate'})
    CREATE (host)-[:IN_CIRCLE]->(c)
    CREATE (cpu)-[:IN_CIRCLE]->(c)
    CREATE (gpu)-[:IN_CIRCLE]->(c)
    CREATE (ram)-[:IN_CIRCLE]->(c)
    CREATE (storage)-[:IN_CIRCLE]->(c)
    CREATE (os)-[:IN_CIRCLE]->(c)
    CREATE (kernel)-[:IN_CIRCLE]->(c)
    CREATE (claude)-[:IN_CIRCLE]->(c)
    CREATE (python)-[:IN_CIRCLE]->(c)
    CREATE (tmux)-[:IN_CIRCLE]->(c)
    CREATE (alacritty)-[:IN_CIRCLE]->(c)

    RETURN count(*) as created
    """
    graph.query(substrate_query)
    print("Created substrate entities")

    # Create network entities
    network_query = """
    CREATE (neo4j:Entity:Container {id: 'container-neo4j', name: 'graphiti-neo4j', image: 'neo4j:5.26', port_http: 7474, port_bolt: 7687})
    CREATE (pgvector:Entity:Container {id: 'container-pgvector', name: 'regenai-postgres', image: 'pgvector', port: 5435})
    CREATE (redis:Entity:Container {id: 'container-redis', name: 'autoflow-redis', image: 'redis:7-alpine'})
    CREATE (timescale:Entity:Container {id: 'container-timescale', name: 'autoflow-timescaledb', image: 'timescaledb'})
    CREATE (falkor:Entity:Container {id: 'container-falkor', name: 'falkordb', image: 'falkordb/falkordb', port_browser: 3001, port_redis: 6380})
    CREATE (wifi:Entity:Network {id: 'net-wifi', name: 'wlo1', ip: '192.168.1.251', net_type: 'wifi'})
    CREATE (docker:Entity:Network {id: 'net-docker', name: 'docker0', ip: '172.17.0.1', net_type: 'bridge'})
    CREATE (location:Entity:Location {id: 'loc-city', name: 'Vancouver, BC', country: 'Canada', timezone: 'America/Vancouver', lat: 49.25, lon: -123.12})

    WITH neo4j, pgvector, redis, timescale, falkor, wifi, docker, location
    MATCH (c:Circle {name: 'network'})
    CREATE (neo4j)-[:IN_CIRCLE]->(c)
    CREATE (pgvector)-[:IN_CIRCLE]->(c)
    CREATE (redis)-[:IN_CIRCLE]->(c)
    CREATE (timescale)-[:IN_CIRCLE]->(c)
    CREATE (falkor)-[:IN_CIRCLE]->(c)
    CREATE (wifi)-[:IN_CIRCLE]->(c)
    CREATE (docker)-[:IN_CIRCLE]->(c)
    CREATE (location)-[:IN_CIRCLE]->(c)

    RETURN count(*) as created
    """
    graph.query(network_query)
    print("Created network entities")

    # Create tool entities
    tools_query = """
    CREATE (awareness:Entity:Plugin {id: 'plugin-awareness', name: 'awareness', skills: 7, purpose: 'self-improvement'})
    CREATE (exploration:Entity:Plugin {id: 'plugin-exploration', name: 'exploration', skills: 7, purpose: 'environmental-literacy'})
    CREATE (journal:Entity:Plugin {id: 'plugin-journal', name: 'journal', skills: 6, purpose: 'knowledge-management'})
    CREATE (logging:Entity:Plugin {id: 'plugin-logging', name: 'logging', skills: 2, purpose: 'observability'})
    CREATE (schedule:Entity:Plugin {id: 'plugin-schedule', name: 'schedule', skills: 2, purpose: 'time-management'})
    CREATE (backlog:Entity:Plugin {id: 'plugin-backlog', name: 'backlog', skills: 2, purpose: 'task-management'})
    CREATE (agents:Entity:Plugin {id: 'plugin-agents', name: 'agents', skills: 15, purpose: 'agent-frameworks'})
    CREATE (llms:Entity:Plugin {id: 'plugin-llms', name: 'llms', skills: 10, purpose: 'llm-patterns'})
    CREATE (mcp_schedule:Entity:MCP {id: 'mcp-schedule', name: 'schedule-mcp', tools: 9})
    CREATE (mcp_backlog:Entity:MCP {id: 'mcp-backlog', name: 'backlog-mcp'})
    CREATE (mcp_playwright:Entity:MCP {id: 'mcp-playwright', name: 'playwright-mcp', purpose: 'browser-automation'})

    // Plugin relationships
    CREATE (exploration)-[:COMPLEMENTS]->(awareness)

    WITH awareness, exploration, journal, logging, schedule, backlog, agents, llms, mcp_schedule, mcp_backlog, mcp_playwright
    MATCH (c:Circle {name: 'tools'})
    CREATE (awareness)-[:IN_CIRCLE]->(c)
    CREATE (exploration)-[:IN_CIRCLE]->(c)
    CREATE (journal)-[:IN_CIRCLE]->(c)
    CREATE (logging)-[:IN_CIRCLE]->(c)
    CREATE (schedule)-[:IN_CIRCLE]->(c)
    CREATE (backlog)-[:IN_CIRCLE]->(c)
    CREATE (agents)-[:IN_CIRCLE]->(c)
    CREATE (llms)-[:IN_CIRCLE]->(c)
    CREATE (mcp_schedule)-[:IN_CIRCLE]->(c)
    CREATE (mcp_backlog)-[:IN_CIRCLE]->(c)
    CREATE (mcp_playwright)-[:IN_CIRCLE]->(c)

    RETURN count(*) as created
    """
    graph.query(tools_query)
    print("Created tool entities")

    # Create cross-circle connections
    cross_query = """
    MATCH (neo4j:Entity {id: 'container-neo4j'})
    MATCH (pgvector:Entity {id: 'container-pgvector'})
    MATCH (redis:Entity {id: 'container-redis'})
    MATCH (timescale:Entity {id: 'container-timescale'})
    MATCH (falkor:Entity {id: 'container-falkor'})
    MATCH (host:Entity {id: 'hw-host'})
    MATCH (storage:Entity {id: 'hw-storage'})
    MATCH (claude:Entity {id: 'sw-claude'})
    MATCH (gpu:Entity {id: 'hw-gpu'})
    MATCH (mcp_playwright:Entity {id: 'mcp-playwright'})
    MATCH (mcp_schedule:Entity {id: 'mcp-schedule'})
    MATCH (schedule:Entity {id: 'plugin-schedule'})
    MATCH (exploration:Entity {id: 'plugin-exploration'})

    CREATE (neo4j)-[:RUNS_ON]->(host)
    CREATE (pgvector)-[:RUNS_ON]->(host)
    CREATE (redis)-[:RUNS_ON]->(host)
    CREATE (timescale)-[:RUNS_ON]->(host)
    CREATE (falkor)-[:RUNS_ON]->(host)
    CREATE (neo4j)-[:USES]->(storage)
    CREATE (pgvector)-[:USES]->(storage)
    CREATE (claude)-[:CAN_USE]->(gpu)
    CREATE (mcp_playwright)-[:PART_OF]->(claude)
    CREATE (schedule)-[:USES]->(mcp_schedule)
    CREATE (exploration)-[:USES]->(neo4j)
    CREATE (exploration)-[:USES]->(falkor)

    RETURN count(*) as connections
    """
    graph.query(cross_query)
    print("Created cross-circle connections")

    # Create questions
    questions_query = """
    CREATE (q1:Question {id: 'q-docker-orch', text: 'How are Docker containers orchestrated?', priority: 'high', status: 'open', circle: 'network'})
    CREATE (q2:Question {id: 'q-neo4j-data', text: 'What data exists in Neo4j?', priority: 'high', status: 'open', circle: 'network'})
    CREATE (q3:Question {id: 'q-mcp-unused', text: 'What MCP tools are available but unused?', priority: 'high', status: 'open', circle: 'tools'})
    CREATE (q4:Question {id: 'q-graphiti-rel', text: 'How does Graphiti use Neo4j?', priority: 'high', status: 'open', circle: 'network'})
    CREATE (q5:Question {id: 'q-agent-diff', text: 'How do the 15+ agent framework skills differ?', priority: 'high', status: 'open', circle: 'tools'})
    CREATE (q6:Question {id: 'q-decisions', text: 'What were the key decision points in project evolution?', priority: 'high', status: 'open', circle: 'history'})
    CREATE (q7:Question {id: 'q-landauer', text: 'What are the Landauer limits for this hardware?', priority: 'medium', status: 'open', circle: 'cosmos'})

    WITH q1, q2, q3, q4, q5, q6, q7
    MATCH (neo4j:Entity {id: 'container-neo4j'})
    MATCH (agents:Entity {id: 'plugin-agents'})
    MATCH (mcp_schedule:Entity {id: 'mcp-schedule'})
    MATCH (network:Circle {name: 'network'})
    MATCH (tools:Circle {name: 'tools'})
    MATCH (history:Circle {name: 'history'})
    MATCH (cosmos:Circle {name: 'cosmos'})

    CREATE (q1)-[:ABOUT]->(neo4j)
    CREATE (q2)-[:ABOUT]->(neo4j)
    CREATE (q4)-[:ABOUT]->(neo4j)
    CREATE (q3)-[:ABOUT]->(mcp_schedule)
    CREATE (q5)-[:ABOUT]->(agents)

    CREATE (q1)-[:IN_CIRCLE]->(network)
    CREATE (q2)-[:IN_CIRCLE]->(network)
    CREATE (q4)-[:IN_CIRCLE]->(network)
    CREATE (q3)-[:IN_CIRCLE]->(tools)
    CREATE (q5)-[:IN_CIRCLE]->(tools)
    CREATE (q6)-[:IN_CIRCLE]->(history)
    CREATE (q7)-[:IN_CIRCLE]->(cosmos)

    RETURN count(*) as questions
    """
    graph.query(questions_query)
    print("Created questions")

    # Create initial discovery
    discovery_query = """
    CREATE (d:Discovery {
        id: 'discovery-20251212-initial',
        date: '2025-12-12',
        summary: 'Initial exploration: Lenovo i7-13700F/RTX 4070/32GB on Pop!_OS. Docker: Neo4j, PgVector, TimescaleDB, Redis, FalkorDB. Claude Code 2.0.67 with 10 plugins. Location: Vancouver, BC.',
        mastery_delta: 0.4,
        session_type: 'initialization'
    })

    WITH d
    MATCH (c:Circle)
    CREATE (d)-[:EXPLORED]->(c)

    WITH d
    MATCH (e:Entity)
    CREATE (d)-[:DISCOVERED]->(e)

    RETURN d.id
    """
    graph.query(discovery_query)
    print("Created initial discovery")

    return graph


def print_summary(graph):
    """Print graph statistics."""
    # Count nodes
    result = graph.query("MATCH (n) RETURN labels(n)[0] as type, count(n) as count ORDER BY count DESC")
    print("\n=== Graph Summary ===")
    print("\nNode counts:")
    for record in result.result_set:
        print(f"  {record[0]}: {record[1]}")

    # Count relationships
    result = graph.query("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC")
    print("\nRelationship counts:")
    for record in result.result_set:
        print(f"  {record[0]}: {record[1]}")

    # Total
    result = graph.query("MATCH (n) RETURN count(n) as nodes")
    nodes = result.result_set[0][0]
    result = graph.query("MATCH ()-[r]->() RETURN count(r) as rels")
    rels = result.result_set[0][0]
    print(f"\nTotal: {nodes} nodes, {rels} relationships")


def main():
    global FALKOR_HOST, FALKOR_PORT

    parser = argparse.ArgumentParser(description="Seed FalkorDB Exploration Graph")
    parser.add_argument("--host", default=FALKOR_HOST, help="FalkorDB host")
    parser.add_argument("--port", type=int, default=FALKOR_PORT, help="FalkorDB port")
    args = parser.parse_args()

    FALKOR_HOST = args.host
    FALKOR_PORT = args.port

    print(f"Connecting to FalkorDB at {FALKOR_HOST}:{FALKOR_PORT}...")

    db = get_client()
    graph = create_exploration_graph(db)
    print_summary(graph)

    print(f"\n✓ Exploration graph seeded in FalkorDB!")
    print(f"  Browser: http://localhost:3001")
    print(f"  Graph name: {GRAPH_NAME}")
    print(f"\n  Try these queries in the browser:")
    print(f"    MATCH (n)-[r]->(m) RETURN n, r, m")
    print(f"    MATCH (c:Circle)<-[:IN_CIRCLE]-(e) RETURN c, e")
    print(f"    MATCH p=(e1)-[*1..2]-(e2) WHERE e1.name = 'Claude Code 2.0.67' RETURN p")


if __name__ == "__main__":
    main()
