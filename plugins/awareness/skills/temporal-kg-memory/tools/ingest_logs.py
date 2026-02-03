#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "graphiti-core[falkordb]",
# ]
# ///
"""
Ingest Claude Code logs into a temporal knowledge graph.

Usage:
    # Ingest a single session log
    uv run ingest_logs.py --log-file .claude/logging/2025/12/11/17-24-45-b22351d6.jsonl

    # Ingest all logs from a date
    uv run ingest_logs.py --date 2025-12-11

    # Ingest with custom FalkorDB settings
    uv run ingest_logs.py --log-file ... --host localhost --port 6379 --database claude_logs

    # Dry run (parse only, no ingestion)
    uv run ingest_logs.py --log-file ... --dry-run
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Graphiti imports (will fail gracefully if not installed)
try:
    from graphiti_core import Graphiti
    from graphiti_core.driver.falkordb_driver import FalkorDriver
    from graphiti_core.nodes import EpisodeType
    GRAPHITI_AVAILABLE = True
except ImportError:
    GRAPHITI_AVAILABLE = False


def parse_log_file(log_path: Path) -> list[dict[str, Any]]:
    """Parse JSONL log file into events."""
    events = []
    with open(log_path) as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"Warning: Skipping line {line_num} in {log_path}: {e}", file=sys.stderr)
    return events


def event_to_episode_body(event: dict[str, Any]) -> str | None:
    """
    Convert a log event to natural language for Graphiti entity extraction.

    Returns None for events that shouldn't be ingested.
    """
    event_type = event.get('type', 'Unknown')
    data = event.get('data', {})

    if event_type == 'UserPromptSubmit':
        prompt = data.get('prompt', '')
        if not prompt:
            return None
        # Truncate very long prompts
        if len(prompt) > 2000:
            prompt = prompt[:2000] + "..."
        return f"User asked: {prompt}"

    elif event_type == 'PreToolUse':
        tool = data.get('tool_name', 'unknown')
        tool_input = data.get('tool_input', {})

        # Special handling for common tools
        if tool == 'Read':
            file_path = tool_input.get('file_path', 'unknown')
            return f"Claude is reading file: {file_path}"
        elif tool == 'Write':
            file_path = tool_input.get('file_path', 'unknown')
            return f"Claude is writing to file: {file_path}"
        elif tool == 'Edit':
            file_path = tool_input.get('file_path', 'unknown')
            return f"Claude is editing file: {file_path}"
        elif tool == 'Bash':
            command = tool_input.get('command', '')[:200]
            return f"Claude is running command: {command}"
        elif tool == 'Task':
            description = tool_input.get('description', '')
            subagent_type = tool_input.get('subagent_type', 'general')
            return f"Claude is launching {subagent_type} agent: {description}"
        elif tool == 'Grep':
            pattern = tool_input.get('pattern', '')
            return f"Claude is searching for pattern: {pattern}"
        elif tool == 'Glob':
            pattern = tool_input.get('pattern', '')
            return f"Claude is finding files matching: {pattern}"
        else:
            # Generic tool use
            input_str = json.dumps(tool_input)[:300]
            return f"Claude is using {tool} tool with: {input_str}"

    elif event_type == 'PostToolUse':
        tool = data.get('tool_name', 'unknown')
        response = data.get('tool_response', {})

        # Don't ingest full responses - they're too large
        if isinstance(response, dict):
            if 'stdout' in response:
                output = response.get('stdout', '')[:200]
                return f"Tool {tool} output: {output}"
            elif 'result' in response:
                result = str(response.get('result', ''))[:200]
                return f"Tool {tool} result: {result}"

        return f"Tool {tool} completed"

    elif event_type == 'SessionStart':
        cwd = data.get('cwd', 'unknown')
        return f"Session started in directory: {cwd}"

    elif event_type == 'SubagentStop':
        agent_id = data.get('agent_id', 'unknown')
        return f"Subagent {agent_id} completed its task"

    elif event_type == 'AssistantResponse':
        # These are typically long, skip for now
        return None

    elif event_type == 'Stop':
        return "Session stopped"

    else:
        # Skip unknown event types
        return None


def find_log_files(logs_dir: Path, date: str | None = None) -> list[Path]:
    """Find all log files, optionally filtered by date."""
    if not logs_dir.exists():
        return []

    if date:
        # Parse date and find matching directory
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
            date_dir = logs_dir / str(dt.year) / f"{dt.month:02d}" / f"{dt.day:02d}"
            if date_dir.exists():
                return sorted(date_dir.glob("*.jsonl"))
        except ValueError:
            print(f"Invalid date format: {date}. Use YYYY-MM-DD", file=sys.stderr)
            return []

    # Find all log files
    return sorted(logs_dir.rglob("*.jsonl"))


async def ingest_events(
    graphiti: 'Graphiti',
    events: list[dict[str, Any]],
    session_id: str,
    dry_run: bool = False,
    verbose: bool = False
) -> dict[str, int]:
    """
    Ingest events into Graphiti.

    Returns stats about the ingestion.
    """
    stats = {
        'total': len(events),
        'ingested': 0,
        'skipped': 0,
        'errors': 0
    }

    for i, event in enumerate(events):
        body = event_to_episode_body(event)

        if body is None:
            stats['skipped'] += 1
            continue

        if dry_run:
            if verbose:
                print(f"[DRY RUN] Would ingest: {body[:100]}...")
            stats['ingested'] += 1
            continue

        try:
            await graphiti.add_episode(
                name=f"{event.get('type', 'Event')}_{i}",
                episode_body=body,
                source=EpisodeType.message,
                source_description=f"Claude Code {event.get('type', 'Event')}",
                reference_time=datetime.fromisoformat(event['ts']),
                group_id=session_id
            )
            stats['ingested'] += 1

            if verbose and (i + 1) % 10 == 0:
                print(f"Progress: {i + 1}/{len(events)} events")

        except Exception as e:
            stats['errors'] += 1
            print(f"Error ingesting event {i}: {e}", file=sys.stderr)

    return stats


async def main():
    parser = argparse.ArgumentParser(
        description="Ingest Claude Code logs into a temporal knowledge graph",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Input options
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        '--log-file', '-f',
        type=Path,
        help='Path to a specific log file (.jsonl)'
    )
    input_group.add_argument(
        '--date', '-d',
        type=str,
        help='Ingest all logs from a date (YYYY-MM-DD)'
    )
    input_group.add_argument(
        '--all',
        action='store_true',
        help='Ingest all available logs'
    )

    # FalkorDB options
    parser.add_argument(
        '--host',
        default='localhost',
        help='FalkorDB host (default: localhost)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=6379,
        help='FalkorDB port (default: 6379)'
    )
    parser.add_argument(
        '--database',
        default='claude_logs',
        help='FalkorDB database name (default: claude_logs)'
    )

    # Other options
    parser.add_argument(
        '--logs-dir',
        type=Path,
        default=Path('.claude/logging'),
        help='Base directory for logs (default: .claude/logging)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Parse logs but don\'t ingest (for testing)'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Verbose output'
    )

    args = parser.parse_args()

    # Find log files
    if args.log_file:
        if not args.log_file.exists():
            print(f"Error: Log file not found: {args.log_file}", file=sys.stderr)
            sys.exit(1)
        log_files = [args.log_file]
    else:
        log_files = find_log_files(
            args.logs_dir,
            date=args.date if not args.all else None
        )

    if not log_files:
        print("No log files found", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(log_files)} log file(s)")

    # Initialize Graphiti (unless dry run)
    graphiti = None
    if not args.dry_run:
        if not GRAPHITI_AVAILABLE:
            print("Error: graphiti-core[falkordb] is not installed", file=sys.stderr)
            print("Install with: pip install graphiti-core[falkordb]", file=sys.stderr)
            sys.exit(1)

        if not os.environ.get('OPENAI_API_KEY'):
            print("Warning: OPENAI_API_KEY not set. Entity extraction may fail.", file=sys.stderr)

        try:
            driver = FalkorDriver(
                host=args.host,
                port=args.port,
                database=args.database
            )
            graphiti = Graphiti(graph_driver=driver)
            await graphiti.build_indices_and_constraints()
            print(f"Connected to FalkorDB at {args.host}:{args.port}/{args.database}")
        except Exception as e:
            print(f"Error connecting to FalkorDB: {e}", file=sys.stderr)
            print("Make sure FalkorDB is running: docker run -p 6379:6379 falkordb/falkordb")
            sys.exit(1)

    # Process each log file
    total_stats = {'total': 0, 'ingested': 0, 'skipped': 0, 'errors': 0}

    for log_file in log_files:
        print(f"\nProcessing: {log_file}")

        events = parse_log_file(log_file)
        if not events:
            print(f"  No events found")
            continue

        # Extract session_id from first event or filename
        session_id = events[0].get('session_id', log_file.stem)

        stats = await ingest_events(
            graphiti,
            events,
            session_id,
            dry_run=args.dry_run,
            verbose=args.verbose
        )

        print(f"  Events: {stats['total']}, Ingested: {stats['ingested']}, "
              f"Skipped: {stats['skipped']}, Errors: {stats['errors']}")

        for key in total_stats:
            total_stats[key] += stats[key]

    # Summary
    print(f"\n{'=' * 50}")
    print(f"Total: {total_stats['total']} events")
    print(f"Ingested: {total_stats['ingested']}")
    print(f"Skipped: {total_stats['skipped']}")
    print(f"Errors: {total_stats['errors']}")

    if graphiti:
        await graphiti.close()


if __name__ == '__main__':
    asyncio.run(main())
