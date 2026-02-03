#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Production ingestion: Load ALL Claude Code sessions into a temporal knowledge graph.

Uses direct JSON parsing (no LLM) for:
- Speed: Processes thousands of events in seconds
- Accuracy: No entity duplication
- Determinism: Same input → same output

Graph Schema:
- (:Session) - conversation sessions with metadata
- (:UserMessage) - user prompts
- (:AssistantMessage) - Claude responses
- (:ToolUse) - tool invocations (optional)
- (:AgentExecution) - subagent runs with agent_id
- (:Commit) - git commits
- [:THEN] - temporal sequence within session
- [:IN_SESSION] - message belongs to session
- [:NEXT_SESSION] - temporal link between sessions
- [:SPAWNED] - session spawned agent
- [:LIKELY_BY] - commit likely made by agent (timestamp correlation)

Usage:
    uv run ingest_all_sessions.py [--include-tools] [--include-agents] [--include-commits]
"""

import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from falkordb import FalkorDB


def find_log_files(base_path: Path) -> list[Path]:
    """Find all JSONL log files, sorted by modification time (oldest first)."""
    log_files = list(base_path.rglob("*.jsonl"))
    return sorted(log_files, key=lambda p: p.stat().st_mtime)


def parse_log_file(log_path: Path) -> list[dict]:
    """Parse JSONL log file into events."""
    events = []
    with open(log_path) as f:
        for line in f:
            if line.strip():
                try:
                    events.append(json.loads(line.strip()))
                except json.JSONDecodeError:
                    continue
    return events


def extract_session_info(events: list[dict], log_path: Path) -> dict:
    """Extract session metadata from events."""
    if not events:
        return {}

    first = events[0]
    session_id = first.get('session_id', log_path.stem)[:8]

    # Find SessionStart event for cwd
    cwd = ""
    for e in events:
        if e.get('type') == 'SessionStart':
            cwd = e.get('data', {}).get('cwd', '')
            break

    # Get time range
    timestamps = [e.get('ts', '') for e in events if e.get('ts')]
    start_time = min(timestamps) if timestamps else ''
    end_time = max(timestamps) if timestamps else ''

    return {
        'id': session_id,
        'file': log_path.name,
        'cwd': cwd,
        'start_time': start_time,
        'end_time': end_time,
        'total_events': len(events)
    }


def ingest_session(g, events: list[dict], session_info: dict, include_tools: bool = False):
    """Ingest a single session into the graph."""

    session_id = session_info['id']

    # Create Session node
    g.query("""
        MERGE (s:Session {id: $id})
        SET s.file = $file,
            s.cwd = $cwd,
            s.start_time = $start_time,
            s.end_time = $end_time,
            s.total_events = $total_events
    """, session_info)

    # Process conversation events
    prev_msg_id = None
    stats = {'user_messages': 0, 'assistant_messages': 0, 'tool_uses': 0}

    for i, event in enumerate(events):
        event_type = event.get('type', '')
        ts = event.get('ts', '')
        data = event.get('data', {})
        time_short = ts[11:19] if ts else ''

        if event_type == 'UserPromptSubmit':
            msg_id = f"{session_id}_user_{stats['user_messages']}"
            text = data.get('prompt', '')

            g.query("""
                MERGE (m:UserMessage {id: $id})
                SET m.timestamp = $ts,
                    m.time = $time,
                    m.text = $text,
                    m.length = $length,
                    m.session_id = $session_id
            """, {
                'id': msg_id,
                'ts': ts,
                'time': time_short,
                'text': text,
                'length': len(text),
                'session_id': session_id
            })

            # Link to session
            g.query("""
                MATCH (s:Session {id: $session_id})
                MATCH (m:UserMessage {id: $msg_id})
                MERGE (m)-[:IN_SESSION]->(s)
            """, {'session_id': session_id, 'msg_id': msg_id})

            # Temporal link
            if prev_msg_id:
                g.query("""
                    MATCH (a {id: $prev_id})
                    MATCH (b {id: $curr_id})
                    MERGE (a)-[:THEN]->(b)
                """, {'prev_id': prev_msg_id, 'curr_id': msg_id})

            prev_msg_id = msg_id
            stats['user_messages'] += 1

        elif event_type == 'AssistantResponse':
            msg_id = f"{session_id}_asst_{stats['assistant_messages']}"
            text = data.get('response', '')

            g.query("""
                MERGE (m:AssistantMessage {id: $id})
                SET m.timestamp = $ts,
                    m.time = $time,
                    m.text = $text,
                    m.length = $length,
                    m.session_id = $session_id
            """, {
                'id': msg_id,
                'ts': ts,
                'time': time_short,
                'text': text,
                'length': len(text),
                'session_id': session_id
            })

            # Link to session
            g.query("""
                MATCH (s:Session {id: $session_id})
                MATCH (m:AssistantMessage {id: $msg_id})
                MERGE (m)-[:IN_SESSION]->(s)
            """, {'session_id': session_id, 'msg_id': msg_id})

            # Temporal link
            if prev_msg_id:
                g.query("""
                    MATCH (a {id: $prev_id})
                    MATCH (b {id: $curr_id})
                    MERGE (a)-[:THEN]->(b)
                """, {'prev_id': prev_msg_id, 'curr_id': msg_id})

            prev_msg_id = msg_id
            stats['assistant_messages'] += 1

        elif include_tools and event_type == 'PreToolUse':
            tool_name = data.get('tool_name', 'unknown')
            tool_input = data.get('tool_input', {})

            tool_id = f"{session_id}_tool_{stats['tool_uses']}"

            g.query("""
                MERGE (t:ToolUse {id: $id})
                SET t.timestamp = $ts,
                    t.time = $time,
                    t.tool = $tool,
                    t.session_id = $session_id
            """, {
                'id': tool_id,
                'ts': ts,
                'time': time_short,
                'tool': tool_name,
                'session_id': session_id
            })

            # Extract file path if present
            file_path = tool_input.get('file_path') or tool_input.get('path')
            if file_path:
                g.query("""
                    MATCH (t:ToolUse {id: $tool_id})
                    SET t.file_path = $file_path
                """, {'tool_id': tool_id, 'file_path': file_path})

            stats['tool_uses'] += 1

    return stats


def ingest_agent_executions(g, events: list[dict], session_id: str) -> int:
    """Ingest SubagentStop events as AgentExecution nodes."""
    count = 0
    for event in events:
        if event.get('type') != 'SubagentStop':
            continue

        data = event.get('data', {})
        agent_id = data.get('agent_id')
        if not agent_id:
            continue

        ts = event.get('ts', '')
        time_short = ts[11:19] if ts else ''

        # Create AgentExecution node
        g.query("""
            MERGE (a:AgentExecution {agent_id: $agent_id})
            SET a.timestamp = $ts,
                a.time = $time,
                a.session_id = $session_id,
                a.transcript_path = $transcript_path
        """, {
            'agent_id': agent_id,
            'ts': ts,
            'time': time_short,
            'session_id': session_id,
            'transcript_path': data.get('agent_transcript_path', '')
        })

        # Link to session
        g.query("""
            MATCH (s:Session {id: $session_id})
            MATCH (a:AgentExecution {agent_id: $agent_id})
            MERGE (s)-[:SPAWNED]->(a)
        """, {'session_id': session_id, 'agent_id': agent_id})

        count += 1

    return count


def ingest_git_commits(g, repo_path: Path, since_date: str = "2025-12-01") -> int:
    """Ingest git commits as Commit nodes."""
    result = subprocess.run(
        ["git", "-C", str(repo_path), "log", f"--since={since_date}", "--format=%H|%aI|%s"],
        capture_output=True, text=True
    )

    count = 0
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        parts = line.split('|', 2)
        if len(parts) != 3:
            continue

        commit_hash = parts[0][:8]
        timestamp = parts[1]
        message = parts[2]

        # Normalize timestamp (remove timezone for comparison)
        ts_normalized = timestamp.replace('T', ' ').split('-08:00')[0].split('+')[0]

        g.query("""
            MERGE (c:Commit {hash: $hash})
            SET c.timestamp = $ts,
                c.timestamp_normalized = $ts_norm,
                c.message = $message
        """, {
            'hash': commit_hash,
            'ts': timestamp,
            'ts_norm': ts_normalized,
            'message': message
        })

        count += 1

    return count


def correlate_commits_to_agents(g, window_seconds: int = 120):
    """Create LIKELY_BY edges between commits and agents based on timestamp proximity."""
    # Get all commits and agents
    commits = g.query("MATCH (c:Commit) RETURN c.hash, c.timestamp_normalized").result_set
    agents = g.query("MATCH (a:AgentExecution) RETURN a.agent_id, a.timestamp").result_set

    def parse_ts(ts: str) -> datetime:
        """Parse timestamp to datetime."""
        if not ts:
            return None
        ts = ts.replace('T', ' ').split('.')[0]
        try:
            return datetime.strptime(ts, '%Y-%m-%d %H:%M:%S')
        except:
            return None

    # For each commit, find agents that completed within window before it
    for commit_hash, commit_ts in commits:
        commit_time = parse_ts(commit_ts)
        if not commit_time:
            continue

        for agent_id, agent_ts in agents:
            agent_time = parse_ts(agent_ts)
            if not agent_time:
                continue

            # Agent completed before commit?
            diff = (commit_time - agent_time).total_seconds()
            if 0 <= diff <= window_seconds:
                g.query("""
                    MATCH (c:Commit {hash: $hash}), (a:AgentExecution {agent_id: $agent})
                    MERGE (c)-[:LIKELY_BY {seconds_before: $diff}]->(a)
                """, {'hash': commit_hash, 'agent': agent_id, 'diff': int(diff)})


def link_sessions_temporally(g):
    """Create NEXT_SESSION edges between sessions in chronological order."""
    # Simpler approach: for each session, find the next one by time
    result = g.query("""
        MATCH (s:Session)
        RETURN s.id, s.start_time
        ORDER BY s.start_time
    """)

    sessions = [(row[0], row[1]) for row in result.result_set if row[1]]

    for i in range(len(sessions) - 1):
        curr_id = sessions[i][0]
        next_id = sessions[i + 1][0]
        g.query("""
            MATCH (s1:Session {id: $curr}), (s2:Session {id: $next})
            MERGE (s1)-[:NEXT_SESSION]->(s2)
        """, {'curr': curr_id, 'next': next_id})


def print_summary(g):
    """Print graph statistics and example queries."""
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)

    # Node counts
    print("\n--- Nodes ---")
    result = g.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC")
    total_nodes = 0
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]}")
        total_nodes += row[1]
    print(f"  TOTAL: {total_nodes}")

    # Edge counts
    print("\n--- Relationships ---")
    result = g.query("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC")
    total_edges = 0
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]}")
        total_edges += row[1]
    print(f"  TOTAL: {total_edges}")

    # Session summary
    print("\n--- Sessions ---")
    result = g.query("""
        MATCH (s:Session)
        OPTIONAL MATCH (s)<-[:IN_SESSION]-(m)
        RETURN s.id as session, s.start_time as started, count(m) as messages
        ORDER BY s.start_time
        LIMIT 10
    """)
    for row in result.result_set:
        time_str = row[1][:16] if row[1] else "?"
        print(f"  {row[0]}: {row[2]} messages ({time_str})")

    # Content stats
    print("\n--- Content Statistics ---")
    result = g.query("""
        MATCH (m:UserMessage)
        RETURN 'UserMessage' as type, count(m) as count, sum(m.length) as chars
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} messages, {int(row[2] or 0):,} chars")

    result = g.query("""
        MATCH (m:AssistantMessage)
        RETURN 'AssistantMessage' as type, count(m) as count, sum(m.length) as chars
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} messages, {int(row[2] or 0):,} chars")

    print("\n" + "=" * 60)
    print("EXAMPLE QUERIES")
    print("=" * 60)
    print("""
View in browser: http://localhost:3001
Select graph: claude_logs

# See all sessions
MATCH (s:Session) RETURN s ORDER BY s.start_time

# See a session's dialogue
MATCH (m)-[:IN_SESSION]->(s:Session {id: '0143495c'})
RETURN m ORDER BY m.timestamp

# See dialogue flow with THEN edges
MATCH (m1)-[:THEN]->(m2)
WHERE m1.session_id = '0143495c'
RETURN m1, m2

# Search message content
MATCH (m)
WHERE m.text CONTAINS 'hot reload'
RETURN labels(m)[0] as type, m.time, m.text

# Cross-session: find topics discussed
MATCH (m)
WHERE m.text CONTAINS 'plugin'
RETURN m.session_id, m.time, substring(m.text, 0, 80)
ORDER BY m.timestamp
    """)


def main():
    print("=" * 60)
    print("PRODUCTION INGESTION: All Claude Code Sessions")
    print("=" * 60)

    # Parse args
    include_tools = '--include-tools' in sys.argv
    include_agents = '--include-agents' in sys.argv or '--all' in sys.argv
    include_commits = '--include-commits' in sys.argv or '--all' in sys.argv

    # Find log files
    repo_path = Path("/home/user/Workspace/claude-plugins")
    log_base = repo_path / ".claude/logging"
    print(f"\nSearching: {log_base}")

    log_files = find_log_files(log_base)
    print(f"Found {len(log_files)} log files")

    if not log_files:
        print("No log files found!")
        sys.exit(1)

    # Connect to FalkorDB
    print("\nConnecting to FalkorDB...")
    try:
        db = FalkorDB(host='localhost', port=6380)
        g = db.select_graph('claude_logs')
    except Exception as e:
        print(f"Error: {e}")
        print("Start FalkorDB: docker run -p 6380:6379 -p 3001:3000 -d -v falkordb_data:/var/lib/falkordb/data falkordb/falkordb")
        sys.exit(1)

    # Clear existing data
    print("Clearing existing graph...")
    try:
        g.query("MATCH (n) DETACH DELETE n")
    except:
        pass

    # Process each session
    print(f"\n--- Ingesting {len(log_files)} Sessions ---")
    options = []
    if include_tools:
        options.append("tools")
    if include_agents:
        options.append("agents")
    if include_commits:
        options.append("commits")
    if options:
        print(f"(Including: {', '.join(options)})")

    total_stats = {'sessions': 0, 'user_messages': 0, 'assistant_messages': 0, 'tool_uses': 0, 'agent_executions': 0}

    for i, log_file in enumerate(log_files):
        events = parse_log_file(log_file)
        if not events:
            continue

        session_info = extract_session_info(events, log_file)

        print(f"\n  [{i+1}/{len(log_files)}] {session_info['id']}: {len(events)} events", end="")

        stats = ingest_session(g, events, session_info, include_tools)

        print(f" → {stats['user_messages']}U + {stats['assistant_messages']}A", end="")
        if include_tools:
            print(f" + {stats['tool_uses']}T", end="")

        # Ingest agent executions if requested
        if include_agents:
            agent_count = ingest_agent_executions(g, events, session_info['id'])
            total_stats['agent_executions'] += agent_count
            if agent_count > 0:
                print(f" + {agent_count}Ag", end="")

        print()

        total_stats['sessions'] += 1
        total_stats['user_messages'] += stats['user_messages']
        total_stats['assistant_messages'] += stats['assistant_messages']
        total_stats['tool_uses'] += stats['tool_uses']

    # Link sessions temporally
    print("\nLinking sessions temporally...")
    link_sessions_temporally(g)

    # Ingest git commits if requested
    if include_commits:
        print("\nIngesting git commits...")
        commit_count = ingest_git_commits(g, repo_path, since_date="2025-12-01")
        print(f"  Ingested {commit_count} commits")
        total_stats['commits'] = commit_count

        if include_agents:
            print("\nCorrelating commits to agents...")
            correlate_commits_to_agents(g, window_seconds=120)
            # Count correlations
            result = g.query("MATCH ()-[r:LIKELY_BY]->() RETURN count(r) as count")
            corr_count = result.result_set[0][0] if result.result_set else 0
            print(f"  Created {corr_count} LIKELY_BY correlations")

    # Print summary
    print_summary(g)

    print(f"\n--- Totals ---")
    print(f"  Sessions: {total_stats['sessions']}")
    print(f"  User Messages: {total_stats['user_messages']}")
    print(f"  Assistant Messages: {total_stats['assistant_messages']}")
    if include_tools:
        print(f"  Tool Uses: {total_stats['tool_uses']}")
    if include_agents:
        print(f"  Agent Executions: {total_stats['agent_executions']}")
    if include_commits:
        print(f"  Commits: {total_stats.get('commits', 0)}")


if __name__ == '__main__':
    main()
