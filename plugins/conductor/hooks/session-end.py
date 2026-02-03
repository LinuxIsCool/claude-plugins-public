#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Conductor SessionEnd (Stop) hook: Captures session outcomes for feedback loop.

This hook fires on Stop events, capturing:
1. Session duration and basic metrics
2. Tool usage patterns
3. Agent invocations
4. Session summary for pulse update

Outputs brief context for git commits and updates conductor state.
"""

import json
import sys
from datetime import datetime
from pathlib import Path


def extract_session_metrics(transcript_path: Path) -> dict:
    """Extract metrics from the session transcript."""
    metrics = {
        "tool_counts": {},
        "agent_invocations": [],
        "prompt_count": 0,
        "total_tools": 0,
    }

    if not transcript_path or not transcript_path.exists():
        return metrics

    try:
        content = transcript_path.read_text()
        for line in content.strip().split("\n"):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                entry_type = entry.get("type", "")

                if entry_type == "user":
                    metrics["prompt_count"] += 1

                elif entry_type == "assistant":
                    for block in entry.get("message", {}).get("content", []):
                        if block.get("type") == "tool_use":
                            tool_name = block.get("name", "unknown")
                            metrics["tool_counts"][tool_name] = \
                                metrics["tool_counts"].get(tool_name, 0) + 1
                            metrics["total_tools"] += 1

                            # Track agent spawns
                            if tool_name == "Task":
                                agent_type = block.get("input", {}).get("subagent_type", "")
                                if agent_type:
                                    metrics["agent_invocations"].append(agent_type)
            except json.JSONDecodeError:
                continue
    except Exception:
        pass

    return metrics


def generate_session_summary(metrics: dict, duration_mins: float) -> str:
    """Generate a brief summary of the session."""
    parts = []

    if duration_mins > 0:
        if duration_mins < 1:
            parts.append(f"{int(duration_mins * 60)}s")
        elif duration_mins < 60:
            parts.append(f"{int(duration_mins)}m")
        else:
            hours = int(duration_mins // 60)
            mins = int(duration_mins % 60)
            parts.append(f"{hours}h{mins}m")

    if metrics["prompt_count"] > 0:
        parts.append(f"{metrics['prompt_count']} prompts")

    if metrics["total_tools"] > 0:
        parts.append(f"{metrics['total_tools']} tools")

    if metrics["agent_invocations"]:
        unique_agents = len(set(metrics["agent_invocations"]))
        total_agents = len(metrics["agent_invocations"])
        if unique_agents == total_agents:
            parts.append(f"{total_agents} agents")
        else:
            parts.append(f"{total_agents} agents ({unique_agents} unique)")

    return " | ".join(parts) if parts else "Brief session"


def write_session_log(cwd: Path, session_id: str, metrics: dict,
                       start_time: datetime, end_time: datetime) -> None:
    """Write session log to conductor's sessions directory."""
    sessions_dir = cwd / ".claude" / "conductor" / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)

    duration_mins = (end_time - start_time).total_seconds() / 60

    log_file = sessions_dir / f"{end_time.strftime('%Y-%m-%d')}.jsonl"

    log_entry = {
        "session_id": session_id[:8],
        "start": start_time.isoformat(),
        "end": end_time.isoformat(),
        "duration_mins": round(duration_mins, 1),
        "prompts": metrics["prompt_count"],
        "tools": metrics["total_tools"],
        "top_tools": dict(sorted(
            metrics["tool_counts"].items(),
            key=lambda x: x[1],
            reverse=True
        )[:5]),
        "agents": metrics["agent_invocations"],
    }

    try:
        with open(log_file, "a") as f:
            json.dump(log_entry, f)
            f.write("\n")
    except Exception:
        pass


def get_session_start_time(cwd: Path, session_id: str) -> datetime | None:
    """Try to find session start time from logging JSONL."""
    today = datetime.now()
    log_dir = cwd / ".claude" / "logging" / today.strftime("%Y/%m/%d")

    if not log_dir.exists():
        return None

    # Find the session's log file
    for jsonl_file in log_dir.glob(f"*-{session_id[:8]}.jsonl"):
        try:
            first_line = jsonl_file.read_text().split("\n")[0]
            if first_line:
                entry = json.loads(first_line)
                return datetime.fromisoformat(entry.get("ts", "").replace("Z", "+00:00"))
        except Exception:
            continue

    return None


def main():
    """Main hook entry point."""
    try:
        input_data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        input_data = {}

    if not input_data:
        print(json.dumps({}))
        return

    cwd = Path(input_data.get("cwd", ".")).resolve()
    session_id = input_data.get("session_id", "unknown")
    transcript_path = input_data.get("transcript_path", "")

    end_time = datetime.now()
    start_time = get_session_start_time(cwd, session_id) or end_time

    # Extract metrics from transcript
    metrics = {}
    if transcript_path:
        metrics = extract_session_metrics(Path(transcript_path))
    else:
        metrics = {
            "tool_counts": {},
            "agent_invocations": [],
            "prompt_count": 0,
            "total_tools": 0,
        }

    # Write session log
    write_session_log(cwd, session_id, metrics, start_time, end_time)

    # Generate summary for output
    duration_mins = (end_time - start_time).total_seconds() / 60
    summary = generate_session_summary(metrics, duration_mins)

    # Output context for git commit or next session
    # Note: Stop events don't support hookSpecificOutput, use systemMessage instead
    output = {
        "systemMessage": f"Session complete: {summary}"
    }

    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Fail silently - session capture is enhancement, not critical
        print(json.dumps({}))
