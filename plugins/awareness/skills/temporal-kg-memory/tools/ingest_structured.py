#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Structured ingestion: Parse JSON logs directly into a knowledge graph.

NO LLM REQUIRED - uses the inherent structure of the data.

The log files are structured JSON with known fields:
- ts: timestamp
- type: event type (UserPromptSubmit, AssistantResponse, etc.)
- session_id: unique session identifier
- data: event-specific payload

We create a precise graph schema that reflects this structure:
- (:Session) - conversation sessions
- (:Human) - the user (singleton per session)
- (:Claude) - the assistant (singleton per session)
- (:Event) - individual events with type and timestamp
- (:Content) - the actual prompt/response content

Relationships:
- [:IN_SESSION] - Event belongs to Session
- [:SENT_BY] - Event sent by Human or Claude
- [:FOLLOWED_BY] - Temporal sequence between events
- [:HAS_CONTENT] - Event contains Content

Usage:
    uv run ingest_structured.py [log_file]
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from falkordb import FalkorDB


def create_schema(g):
    """Create indices for efficient querying."""
    # Note: FalkorDB creates indices implicitly, but we can add constraints
    try:
        g.query("CREATE INDEX FOR (s:Session) ON (s.id)")
    except:
        pass
    try:
        g.query("CREATE INDEX FOR (e:Event) ON (e.id)")
    except:
        pass
    try:
        g.query("CREATE INDEX FOR (e:Event) ON (e.timestamp)")
    except:
        pass


def parse_log_file(log_path: Path) -> list[dict]:
    """Parse JSONL log file into events."""
    events = []
    with open(log_path) as f:
        for line_num, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                event = json.loads(line.strip())
                events.append(event)
            except json.JSONDecodeError as e:
                print(f"  Warning: Skipping malformed line {line_num}")
                continue
    return events


def ingest_session(g, events: list[dict], session_name: str):
    """
    Ingest a session's events into the graph using precise structure.

    Graph Schema:

    (:Session {id, name, start_time, cwd})
        |
        +--[:CONTAINS]-->(:Event {id, type, timestamp})
        |                    |
        |                    +--[:SENT_BY]-->(:Human) or (:Claude)
        |                    |
        |                    +--[:HAS_CONTENT]-->(:Content {text, length})
        |                    |
        |                    +--[:FOLLOWED_BY]-->(:Event)  [temporal chain]
        |
        +--[:HAS_PARTICIPANT]-->(:Human {role: "user"})
        +--[:HAS_PARTICIPANT]-->(:Claude {role: "assistant"})
    """

    if not events:
        return

    # Extract session info
    session_id = events[0].get('session_id', 'unknown')[:8]
    start_time = events[0].get('ts', '')
    cwd = events[0].get('data', {}).get('cwd', '')

    print(f"\n  Session: {session_id}")
    print(f"  Events: {len(events)}")

    # Create Session node
    g.query("""
        MERGE (s:Session {id: $id})
        SET s.name = $name,
            s.start_time = $start_time,
            s.cwd = $cwd
    """, {
        'id': session_id,
        'name': session_name,
        'start_time': start_time,
        'cwd': cwd
    })

    # Create singleton participants for this session
    g.query("""
        MATCH (s:Session {id: $session_id})
        MERGE (s)-[:HAS_PARTICIPANT]->(h:Human {session_id: $session_id})
        SET h.role = 'user'
    """, {'session_id': session_id})

    g.query("""
        MATCH (s:Session {id: $session_id})
        MERGE (s)-[:HAS_PARTICIPANT]->(c:Claude {session_id: $session_id})
        SET c.role = 'assistant'
    """, {'session_id': session_id})

    # Process events
    prev_event_id = None
    stats = {'events': 0, 'user_prompts': 0, 'assistant_responses': 0}

    for i, event in enumerate(events):
        event_type = event.get('type', 'Unknown')
        ts = event.get('ts', '')
        data = event.get('data', {})

        event_id = f"{session_id}_{i}"

        # Create Event node
        g.query("""
            MATCH (s:Session {id: $session_id})
            MERGE (e:Event {id: $event_id})
            SET e.type = $type,
                e.timestamp = $ts,
                e.index = $index
            MERGE (s)-[:CONTAINS]->(e)
        """, {
            'session_id': session_id,
            'event_id': event_id,
            'type': event_type,
            'ts': ts,
            'index': i
        })
        stats['events'] += 1

        # Link to sender based on event type
        if event_type == 'UserPromptSubmit':
            prompt = data.get('prompt', '')

            # Link event to Human sender
            g.query("""
                MATCH (e:Event {id: $event_id})
                MATCH (h:Human {session_id: $session_id})
                MERGE (e)-[:SENT_BY]->(h)
            """, {'event_id': event_id, 'session_id': session_id})

            # Create Content node with full text
            content_id = f"{event_id}_content"
            g.query("""
                MATCH (e:Event {id: $event_id})
                MERGE (c:Content {id: $content_id})
                SET c.text = $text,
                    c.length = $length,
                    c.type = 'prompt'
                MERGE (e)-[:HAS_CONTENT]->(c)
            """, {
                'event_id': event_id,
                'content_id': content_id,
                'text': prompt,
                'length': len(prompt)
            })
            stats['user_prompts'] += 1

        elif event_type == 'AssistantResponse':
            response = data.get('response', '')

            # Link event to Claude sender
            g.query("""
                MATCH (e:Event {id: $event_id})
                MATCH (c:Claude {session_id: $session_id})
                MERGE (e)-[:SENT_BY]->(c)
            """, {'event_id': event_id, 'session_id': session_id})

            # Create Content node with full text
            content_id = f"{event_id}_content"
            g.query("""
                MATCH (e:Event {id: $event_id})
                MERGE (c:Content {id: $content_id})
                SET c.text = $text,
                    c.length = $length,
                    c.type = 'response'
                MERGE (e)-[:HAS_CONTENT]->(c)
            """, {
                'event_id': event_id,
                'content_id': content_id,
                'text': response,
                'length': len(response)
            })
            stats['assistant_responses'] += 1

        # Create temporal chain (FOLLOWED_BY)
        if prev_event_id:
            g.query("""
                MATCH (prev:Event {id: $prev_id})
                MATCH (curr:Event {id: $curr_id})
                MERGE (prev)-[:FOLLOWED_BY]->(curr)
            """, {'prev_id': prev_event_id, 'curr_id': event_id})

        prev_event_id = event_id

    print(f"  Created: {stats['events']} events, {stats['user_prompts']} prompts, {stats['assistant_responses']} responses")
    return stats


def query_examples(g):
    """Show example queries on the structured graph."""

    print("\n" + "=" * 60)
    print("EXAMPLE QUERIES")
    print("=" * 60)

    # 1. Session overview
    print("\n--- Sessions ---")
    result = g.query("""
        MATCH (s:Session)
        OPTIONAL MATCH (s)-[:CONTAINS]->(e:Event)
        RETURN s.id as session, s.start_time as started, count(e) as events
        ORDER BY s.start_time
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[2]} events (started {row[1][:19]})")

    # 2. Conversation flow
    print("\n--- Conversation Flow (first 5) ---")
    result = g.query("""
        MATCH (e:Event)-[:HAS_CONTENT]->(c:Content)
        MATCH (e)-[:SENT_BY]->(sender)
        RETURN labels(sender)[0] as sender, c.type as type,
               substring(c.text, 0, 60) as preview
        ORDER BY e.timestamp
        LIMIT 5
    """)
    for row in result.result_set:
        print(f"  [{row[0]}] {row[2]}...")

    # 3. Content statistics
    print("\n--- Content Statistics ---")
    result = g.query("""
        MATCH (c:Content)
        RETURN c.type as type, count(c) as count, sum(c.length) as total_chars
    """)
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]} items, {row[2]} total characters")

    # 4. Full-text search (manual, since we have the content)
    print("\n--- Search: 'hot reload' ---")
    result = g.query("""
        MATCH (e:Event)-[:HAS_CONTENT]->(c:Content)
        WHERE toLower(c.text) CONTAINS 'hot reload'
        MATCH (e)-[:SENT_BY]->(sender)
        RETURN labels(sender)[0] as sender, substring(c.text, 0, 80) as preview
        LIMIT 3
    """)
    for row in result.result_set:
        print(f"  [{row[0]}] {row[1]}...")

    # 5. Graph statistics
    print("\n--- Graph Statistics ---")
    result = g.query("MATCH (n) RETURN labels(n)[0] as label, count(n) as count ORDER BY count DESC")
    for row in result.result_set:
        print(f"  {row[0]}: {row[1]}")

    result = g.query("MATCH ()-[r]->() RETURN type(r) as type, count(r) as count ORDER BY count DESC")
    print("\n  Relationships:")
    for row in result.result_set:
        print(f"    {row[0]}: {row[1]}")


def main():
    print("=" * 60)
    print("STRUCTURED INGESTION (No LLM Required)")
    print("=" * 60)

    # Default to test file or accept argument
    if len(sys.argv) > 1:
        log_file = Path(sys.argv[1])
    else:
        log_file = Path(".claude/logging/2025/12/08/17-48-29-0143495c.jsonl")

    print(f"\nSource: {log_file.name}")

    if not log_file.exists():
        print(f"Error: File not found: {log_file}")
        sys.exit(1)

    # Connect to FalkorDB
    print("\nConnecting to FalkorDB...")
    try:
        db = FalkorDB(host='localhost', port=6380)
        g = db.select_graph('structured_logs')
    except Exception as e:
        print(f"Error: Could not connect to FalkorDB: {e}")
        print("Start with: docker run -p 6380:6379 -p 3001:3000 -d falkordb/falkordb")
        sys.exit(1)

    print("[OK] Connected to FalkorDB (graph: structured_logs)")

    # Clear existing data for clean experiment
    print("\nClearing existing graph data...")
    try:
        g.query("MATCH (n) DETACH DELETE n")
    except:
        pass

    # Create schema
    create_schema(g)

    # Parse and ingest
    print("\nParsing log file...")
    events = parse_log_file(log_file)
    print(f"Parsed {len(events)} events")

    # Filter to conversation events only
    conversation_events = [
        e for e in events
        if e.get('type') in ('UserPromptSubmit', 'AssistantResponse', 'SessionStart')
    ]
    print(f"Conversation events: {len(conversation_events)}")

    print("\n--- Ingesting ---")
    ingest_session(g, events, log_file.stem)

    # Run example queries
    query_examples(g)

    print("\n" + "=" * 60)
    print("COMPLETE")
    print("=" * 60)
    print(f"\nView graph: http://localhost:3001")
    print(f"Select graph: structured_logs")
    print(f"\nTry this query:")
    print("  MATCH (h:Human)<-[:SENT_BY]-(e:Event)-[:HAS_CONTENT]->(c:Content)")
    print("  RETURN e.timestamp, c.text LIMIT 10")


if __name__ == '__main__':
    main()
