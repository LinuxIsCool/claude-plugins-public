#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Cross-session query tool for Claude Code temporal knowledge graph.

Demonstrates the power of unified graph storage:
- Search across all conversations
- Find topic evolution over time
- Identify patterns in user requests
- Track what Claude worked on
- Trace commits to agent executions

Usage:
    uv run query_sessions.py [command] [args]

Commands:
    search <term>     - Search all messages for a term
    topics            - Show most discussed topics
    timeline          - Show session timeline
    session <id>      - Show dialogue for a session
    stats             - Show graph statistics
    recent            - Show recent conversations
    commit <hash>     - Find which agent likely made a commit
    agents            - List all agent executions
"""

import sys
from falkordb import FalkorDB


def connect():
    """Connect to FalkorDB."""
    try:
        db = FalkorDB(host='localhost', port=6380)
        return db.select_graph('claude_logs')
    except Exception as e:
        print(f"Error: Could not connect to FalkorDB: {e}")
        print("Start with: docker run -p 6380:6379 -p 3001:3000 -d -v falkordb_data:/var/lib/falkordb/data falkordb/falkordb")
        sys.exit(1)


def cmd_search(g, term: str):
    """Search all messages for a term."""
    print(f"\n=== Searching for: '{term}' ===\n")

    # Search user messages
    result = g.query("""
        MATCH (m:UserMessage)
        WHERE toLower(m.text) CONTAINS toLower($term)
        RETURN m.session_id as session, m.time as time,
               substring(m.text, 0, 100) as preview
        ORDER BY m.timestamp
    """, {'term': term})

    user_matches = list(result.result_set)

    # Search assistant messages
    result = g.query("""
        MATCH (m:AssistantMessage)
        WHERE toLower(m.text) CONTAINS toLower($term)
        RETURN m.session_id as session, m.time as time,
               substring(m.text, 0, 100) as preview
        ORDER BY m.timestamp
    """, {'term': term})

    asst_matches = list(result.result_set)

    print(f"--- User Messages ({len(user_matches)} matches) ---")
    for row in user_matches[:10]:
        preview = row[2].replace('\n', ' ')[:80]
        print(f"  [{row[0]}] {row[1]} | {preview}...")

    print(f"\n--- Assistant Messages ({len(asst_matches)} matches) ---")
    for row in asst_matches[:10]:
        preview = row[2].replace('\n', ' ')[:80]
        print(f"  [{row[0]}] {row[1]} | {preview}...")

    print(f"\nTotal: {len(user_matches)} user + {len(asst_matches)} assistant = {len(user_matches) + len(asst_matches)} matches")


def cmd_topics(g):
    """Show most discussed topics based on common keywords."""
    print("\n=== Topic Analysis ===\n")

    keywords = [
        'plugin', 'hook', 'schedule', 'yoga', 'graph', 'falkordb',
        'graphiti', 'ollama', 'embedding', 'session', 'logging',
        'mcp', 'skill', 'awareness', 'journal', 'backlog', 'test',
        'error', 'fix', 'debug', 'docker', 'api', 'typescript', 'python'
    ]

    print("--- Keyword Frequency (User Messages) ---")
    results = []
    for kw in keywords:
        result = g.query("""
            MATCH (m:UserMessage)
            WHERE toLower(m.text) CONTAINS toLower($kw)
            RETURN count(m) as count
        """, {'kw': kw})
        count = result.result_set[0][0] if result.result_set else 0
        if count > 0:
            results.append((kw, count))

    results.sort(key=lambda x: -x[1])
    for kw, count in results[:15]:
        bar = '█' * min(count, 30)
        print(f"  {kw:15} {count:3} {bar}")


def cmd_timeline(g):
    """Show session timeline."""
    print("\n=== Session Timeline ===\n")

    result = g.query("""
        MATCH (s:Session)
        OPTIONAL MATCH (s)<-[:IN_SESSION]-(m)
        WITH s, count(m) as msg_count
        RETURN s.id as id, s.start_time as started,
               s.cwd as cwd, msg_count
        ORDER BY s.start_time
    """)

    for row in result.result_set:
        time_str = row[1][:16] if row[1] else "?"
        cwd_short = row[2].split('/')[-1] if row[2] else "?"
        print(f"  {row[0]} | {time_str} | {row[3]:3} msgs | {cwd_short}")


def cmd_session(g, session_id: str):
    """Show dialogue for a specific session."""
    print(f"\n=== Session: {session_id} ===\n")

    # Get session info
    result = g.query("""
        MATCH (s:Session {id: $id})
        RETURN s.start_time, s.cwd, s.total_events
    """, {'id': session_id})

    if result.result_set:
        row = result.result_set[0]
        print(f"Started: {row[0]}")
        print(f"Directory: {row[1]}")
        print(f"Total Events: {row[2]}")

    # Get dialogue
    print("\n--- Dialogue ---")
    result = g.query("""
        MATCH (m)-[:IN_SESSION]->(s:Session {id: $id})
        RETURN labels(m)[0] as type, m.time as time, m.text as text
        ORDER BY m.timestamp
    """, {'id': session_id})

    for row in result.result_set:
        msg_type = "USER" if row[0] == "UserMessage" else "CLAUDE"
        preview = row[2][:200].replace('\n', ' ') if row[2] else ""
        print(f"\n[{row[1]}] {msg_type}:")
        print(f"  {preview}{'...' if len(row[2] or '') > 200 else ''}")


def cmd_stats(g):
    """Show graph statistics."""
    print("\n=== Graph Statistics ===\n")

    # Node counts
    print("--- Nodes ---")
    result = g.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC")
    total = 0
    for row in result.result_set:
        print(f"  {row[0]:20} {row[1]:5}")
        total += row[1]
    print(f"  {'TOTAL':20} {total:5}")

    # Edge counts
    print("\n--- Relationships ---")
    result = g.query("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC")
    total = 0
    for row in result.result_set:
        print(f"  {row[0]:20} {row[1]:5}")
        total += row[1]
    print(f"  {'TOTAL':20} {total:5}")

    # Content stats
    print("\n--- Content ---")
    result = g.query("""
        MATCH (m:UserMessage)
        RETURN count(m) as count, sum(m.length) as chars
    """)
    if result.result_set:
        row = result.result_set[0]
        print(f"  User messages:      {row[0]:5} ({int(row[1] or 0):,} chars)")

    result = g.query("""
        MATCH (m:AssistantMessage)
        RETURN count(m) as count, sum(m.length) as chars
    """)
    if result.result_set:
        row = result.result_set[0]
        print(f"  Assistant messages: {row[0]:5} ({int(row[1] or 0):,} chars)")


def cmd_recent(g):
    """Show recent conversations."""
    print("\n=== Recent Conversations ===\n")

    result = g.query("""
        MATCH (m:UserMessage)
        RETURN m.session_id as session, m.timestamp as ts,
               substring(m.text, 0, 80) as preview
        ORDER BY m.timestamp DESC
        LIMIT 10
    """)

    for row in result.result_set:
        time_str = row[1][11:19] if row[1] else "?"
        preview = row[2].replace('\n', ' ')
        print(f"  [{row[0]}] {time_str} | {preview}...")


def cmd_commit(g, commit_hash: str):
    """Find which agent likely made a commit."""
    print(f"\n=== Commit: {commit_hash} ===\n")

    # Find commit
    result = g.query("""
        MATCH (c:Commit)
        WHERE c.hash STARTS WITH $hash
        RETURN c.hash, c.timestamp, c.message
    """, {'hash': commit_hash})

    if not result.result_set:
        print(f"Commit not found. Run ingestion with --include-commits first.")
        return

    row = result.result_set[0]
    print(f"Hash: {row[0]}")
    print(f"Time: {row[1]}")
    print(f"Message: {row[2]}")

    # Find correlated agents
    result = g.query("""
        MATCH (c:Commit)-[r:LIKELY_BY]->(a:AgentExecution)
        WHERE c.hash STARTS WITH $hash
        RETURN a.agent_id, a.session_id, a.timestamp, r.seconds_before
        ORDER BY r.seconds_before
    """, {'hash': commit_hash})

    if result.result_set:
        print(f"\n--- Likely Agent(s) ---")
        for row in result.result_set:
            print(f"  Agent: {row[0]} (session {row[1]})")
            print(f"    Completed: {row[2]} ({row[3]}s before commit)")
            print(f"    Transcript: ~/.claude/projects/.../agent-{row[0]}.jsonl")
    else:
        print(f"\n  No agent correlation found (agent completed >120s before commit)")


def cmd_agents(g):
    """List all agent executions."""
    print("\n=== Agent Executions ===\n")

    result = g.query("""
        MATCH (a:AgentExecution)
        OPTIONAL MATCH (s:Session)-[:SPAWNED]->(a)
        RETURN a.agent_id, a.timestamp, s.id as session
        ORDER BY a.timestamp DESC
        LIMIT 30
    """)

    if not result.result_set:
        print("No agents found. Run ingestion with --include-agents first.")
        return

    print(f"{'Agent ID':<12} {'Time':<10} {'Session':<10}")
    print("-" * 40)
    for row in result.result_set:
        time_str = row[1][11:19] if row[1] else "?"
        print(f"{row[0]:<12} {time_str:<10} {row[2] or '?':<10}")

    # Summary
    result = g.query("MATCH (a:AgentExecution) RETURN count(a)")
    total = result.result_set[0][0] if result.result_set else 0
    print(f"\nTotal agent executions: {total}")


def cmd_help():
    """Show help."""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        cmd_help()
        sys.exit(0)

    cmd = sys.argv[1].lower()
    g = connect()

    if cmd == 'search' and len(sys.argv) > 2:
        cmd_search(g, ' '.join(sys.argv[2:]))
    elif cmd == 'topics':
        cmd_topics(g)
    elif cmd == 'timeline':
        cmd_timeline(g)
    elif cmd == 'session' and len(sys.argv) > 2:
        cmd_session(g, sys.argv[2])
    elif cmd == 'stats':
        cmd_stats(g)
    elif cmd == 'recent':
        cmd_recent(g)
    elif cmd == 'commit' and len(sys.argv) > 2:
        cmd_commit(g, sys.argv[2])
    elif cmd == 'agents':
        cmd_agents(g)
    else:
        cmd_help()


if __name__ == '__main__':
    main()
