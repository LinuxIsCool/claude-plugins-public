#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Temporal plugin hook: Injects timestamps into Claude's context at key events.

This hook fires on SessionStart, UserPromptSubmit, Stop, and SessionEnd,
providing Claude with continuous temporal awareness throughout conversations.
"""

import argparse
import json
import sys
from datetime import datetime
import time


def get_temporal_context():
    """Generate comprehensive temporal context."""
    now = datetime.now()

    # Determine period of day
    hour = now.hour
    if 5 <= hour < 12:
        period = "morning"
    elif 12 <= hour < 17:
        period = "afternoon"
    elif 17 <= hour < 21:
        period = "evening"
    else:
        period = "night"

    return {
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "time": now.strftime("%H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "weekday": now.strftime("%A"),
        "timezone": time.tzname[time.daylight] if time.daylight else time.tzname[0],
        "week_number": now.isocalendar()[1],
        "period": period,
        "hour": hour,
        "is_weekend": now.weekday() >= 5,
    }


def format_timestamp(event: str, ctx: dict) -> str:
    """Format timestamp for injection into Claude's context."""
    ts = ctx["timestamp"]  # Full date + time: YYYY-MM-DD HH:MM:SS
    tz = ctx["timezone"]

    # All events include full date+time for self-contained timestamps
    if event == "SessionStart":
        return f"[{ts} {tz}] SessionStart - {ctx['weekday']} ({ctx['period']})"
    elif event == "SessionEnd":
        return f"[{ts} {tz}] SessionEnd"
    elif event == "UserPromptSubmit":
        return f"[{ts} {tz}] UserPromptSubmit"
    elif event == "Stop":
        return f"[{ts} {tz}] Stop"
    else:
        return f"[{ts} {tz}] {event}"


def main():
    parser = argparse.ArgumentParser(description="Inject timestamp into Claude context")
    parser.add_argument("-e", "--event", required=True, help="Hook event name")
    args = parser.parse_args()

    # Read hook input from stdin
    try:
        input_data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        input_data = {}

    # Generate temporal context
    ctx = get_temporal_context()
    timestamp_str = format_timestamp(args.event, ctx)

    # Output JSON with context for Claude to see
    # Note: hookSpecificOutput only supports PreToolUse, UserPromptSubmit, PostToolUse
    # For other events (Stop, SessionStart, SessionEnd), use systemMessage instead
    if args.event in ("PreToolUse", "UserPromptSubmit", "PostToolUse"):
        output = {
            "hookSpecificOutput": {
                "hookEventName": args.event,
                "additionalContext": timestamp_str
            }
        }
    else:
        output = {
            "systemMessage": timestamp_str
        }

    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Fail silently - temporal awareness is enhancement, not critical
        pass
