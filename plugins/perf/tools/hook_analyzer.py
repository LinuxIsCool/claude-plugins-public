#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Hook execution timing analyzer.

Extracts hook execution times from logging plugin JSONL files.
Correlates PreToolUse/PostToolUse pairs to calculate durations.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# Add lib to path for shared utilities
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from utils import calculate_hook_summary


def find_logging_jsonl(cwd: str, session_id: str | None = None) -> list[Path]:
    """Find logging JSONL files in the project."""
    logging_dir = Path(cwd) / ".claude" / "logging"
    if not logging_dir.exists():
        return []

    jsonl_files = list(logging_dir.rglob("*.jsonl"))

    if session_id:
        # Filter to files containing this session
        matching = [f for f in jsonl_files if session_id[:8] in f.name]
        if matching:
            return matching

    # Return most recent files
    jsonl_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
    return jsonl_files[:10]


def parse_timestamp(ts_str: str) -> datetime | None:
    """Parse ISO timestamp string."""
    try:
        # Handle both formats: with and without microseconds
        if "." in ts_str:
            return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return datetime.fromisoformat(ts_str)
    except (ValueError, TypeError):
        return None


def extract_hook_timings(jsonl_path: Path, start_time: str | None = None, end_time: str | None = None) -> dict:
    """Extract hook execution timings from JSONL file.

    Returns dict with:
    - hooks: dict of hook_type -> list of {name, duration_ms, timestamp}
    - summary: aggregated statistics
    """
    hooks = defaultdict(list)
    start_dt = parse_timestamp(start_time) if start_time else None
    end_dt = parse_timestamp(end_time) if end_time else None

    # Track PreToolUse to correlate with PostToolUse
    pending_tools = {}  # tool_use_id -> {start_time, tool_name}

    try:
        with open(jsonl_path) as f:
            for line in f:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue

                ts = parse_timestamp(event.get("ts", ""))
                if not ts:
                    continue

                # Filter by time window if specified
                if start_dt and ts < start_dt:
                    continue
                if end_dt and ts > end_dt:
                    continue

                event_type = event.get("type", "")
                data = event.get("data", {})

                # SessionStart hooks
                if event_type == "SessionStart":
                    # The hook execution is the time from session start to first prompt
                    hooks["SessionStart"].append({
                        "name": "session_initialization",
                        "timestamp": event.get("ts"),
                        "source": data.get("source", "unknown")
                    })

                # PreToolUse - record start time
                elif event_type == "PreToolUse":
                    tool_use_id = data.get("tool_use_id")
                    tool_name = data.get("tool_name", "unknown")
                    if tool_use_id:
                        pending_tools[tool_use_id] = {
                            "start_time": ts,
                            "tool_name": tool_name
                        }

                # PostToolUse - calculate duration
                elif event_type == "PostToolUse":
                    tool_use_id = data.get("tool_use_id")
                    if tool_use_id and tool_use_id in pending_tools:
                        start_info = pending_tools.pop(tool_use_id)
                        duration = (ts - start_info["start_time"]).total_seconds() * 1000
                        hooks["ToolUse"].append({
                            "name": start_info["tool_name"],
                            "duration_ms": round(duration, 2),
                            "timestamp": event.get("ts")
                        })

                # Stop hooks
                elif event_type == "Stop":
                    hooks["Stop"].append({
                        "name": "assistant_response_complete",
                        "timestamp": event.get("ts")
                    })

    except Exception as e:
        return {"error": str(e), "hooks": {}, "summary": {}}

    # Generate summary using shared utility
    summary = calculate_hook_summary(dict(hooks))

    return {
        "file": str(jsonl_path),
        "hooks": dict(hooks),
        "summary": summary
    }


def analyze_all_hooks(cwd: str, session_id: str | None = None,
                      start_time: str | None = None, end_time: str | None = None) -> dict:
    """Analyze hooks across all relevant JSONL files."""
    files = find_logging_jsonl(cwd, session_id)

    if not files:
        return {
            "error": "No logging JSONL files found. Is the logging plugin active?",
            "hooks": {},
            "summary": {}
        }

    all_hooks = defaultdict(list)

    for jsonl_path in files:
        result = extract_hook_timings(jsonl_path, start_time, end_time)
        if "error" not in result:
            for hook_type, events in result.get("hooks", {}).items():
                all_hooks[hook_type].extend(events)

    # Aggregate summary using shared utility
    summary = calculate_hook_summary(dict(all_hooks))
    summary["files_analyzed"] = len(files)

    return {
        "hooks": dict(all_hooks),
        "summary": summary
    }


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Analyze hook execution timing")
    parser.add_argument("--cwd", default=".", help="Working directory")
    parser.add_argument("--session", help="Session ID to filter")
    parser.add_argument("--start", help="Start time (ISO format)")
    parser.add_argument("--end", help="End time (ISO format)")
    parser.add_argument("--format", choices=["json", "summary"], default="json")

    args = parser.parse_args()

    result = analyze_all_hooks(args.cwd, args.session, args.start, args.end)

    if args.format == "summary":
        print(f"Files analyzed: {result.get('summary', {}).get('files_analyzed', 0)}")
        print(f"Total events: {result.get('summary', {}).get('total_events', 0)}")
        print("\nBy type:")
        for hook_type, stats in result.get("summary", {}).get("by_type", {}).items():
            print(f"  {hook_type}: {stats['count']} events, {stats['total_ms']}ms total, {stats['avg_ms']}ms avg")
    else:
        print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
