#!/usr/bin/env python3
"""Extract all user prompts from session logs for ToM analysis.

This script processes all session logs and extracts:
1. All user prompts with timestamps and session context
2. Tool usage patterns per session
3. Agent delegation patterns
4. Session timing metadata
"""

import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


def extract_prompts(log_dir: Path) -> dict:
    """Extract all user prompts and patterns from session logs."""
    results = {
        "prompts": [],
        "tool_usage": Counter(),
        "agent_delegations": Counter(),
        "session_hours": Counter(),
        "session_durations": [],
        "total_sessions": 0,
        "total_events": 0,
    }

    log_files = sorted(log_dir.rglob("*.jsonl"))

    for log_file in log_files:
        try:
            session_data = process_session(log_file)
            if session_data:
                results["total_sessions"] += 1
                results["total_events"] += session_data["event_count"]

                # Aggregate prompts
                for prompt in session_data["prompts"]:
                    results["prompts"].append(prompt)

                # Aggregate tool usage
                results["tool_usage"].update(session_data["tools"])

                # Aggregate agent usage
                results["agent_delegations"].update(session_data["agents"])

                # Session timing
                if session_data["start_hour"] is not None:
                    results["session_hours"][session_data["start_hour"]] += 1

                if session_data["duration_minutes"] is not None:
                    results["session_durations"].append(session_data["duration_minutes"])
        except Exception as e:
            print(f"Error processing {log_file}: {e}", file=sys.stderr)

    return results


def process_session(log_file: Path) -> dict | None:
    """Process a single session log file."""
    session_data = {
        "prompts": [],
        "tools": Counter(),
        "agents": Counter(),
        "start_hour": None,
        "duration_minutes": None,
        "event_count": 0,
    }

    start_time = None
    end_time = None

    with open(log_file) as f:
        for line in f:
            try:
                event = json.loads(line.strip())
                session_data["event_count"] += 1

                event_type = event.get("type", "")
                ts = event.get("ts", "")
                data = event.get("data", {})

                # Parse timestamp
                try:
                    event_time = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except:
                    event_time = None

                # Track session boundaries
                if event_type == "SessionStart" and event_time:
                    start_time = event_time
                    session_data["start_hour"] = event_time.hour
                elif event_type == "SessionEnd" and event_time:
                    end_time = event_time

                # Extract user prompts
                if event_type == "UserPromptSubmit":
                    prompt_text = data.get("prompt", "")
                    if prompt_text:
                        session_data["prompts"].append({
                            "text": prompt_text,
                            "timestamp": ts,
                            "session_file": str(log_file),
                        })

                # Track tool usage
                if event_type == "PreToolUse":
                    tool_name = data.get("tool_name", "unknown")
                    session_data["tools"][tool_name] += 1

                # Track agent delegations
                if event_type == "SubagentStop":
                    agent_id = data.get("agent_id", "unknown")
                    # Try to extract agent type from transcript path
                    transcript_path = data.get("agent_transcript_path", "")
                    session_data["agents"][agent_id] += 1

            except json.JSONDecodeError:
                continue

    # Calculate duration
    if start_time and end_time:
        session_data["duration_minutes"] = (end_time - start_time).total_seconds() / 60

    return session_data if session_data["event_count"] > 0 else None


def analyze_prompts(prompts: list) -> dict:
    """Analyze prompts for ToM signals."""
    analysis = {
        "total_prompts": len(prompts),
        "word_count_distribution": [],
        "question_ratio": 0,
        "command_ratio": 0,
        "ultrathink_count": 0,
        "first_person_ratio": 0,
        "keywords": Counter(),
        "unique_words": set(),
    }

    question_count = 0
    command_count = 0
    first_person_count = 0

    # Keywords that signal different dimensions
    keywords_of_interest = [
        # Risk tolerance
        "try", "experiment", "explore", "safe", "careful", "risk",
        # Time horizon
        "quick", "fast", "later", "future", "long-term", "strategic",
        # Collaboration
        "please", "help", "just do", "let me", "show me", "explain",
        # First principles
        "why", "fundamentally", "underlying", "principles", "architecture",
        # Quality
        "clean", "maintainable", "elegant", "simple", "complex",
        # Cognitive style
        "visualize", "diagram", "list", "step by step", "overview",
    ]

    for prompt_data in prompts:
        text = prompt_data["text"]
        words = text.lower().split()
        word_count = len(words)

        analysis["word_count_distribution"].append(word_count)
        analysis["unique_words"].update(words)

        # Check for patterns
        if "?" in text:
            question_count += 1

        if text.strip().lower().startswith(("please", "can you", "could you", "would you")):
            command_count += 1

        if "ultrathink" in text.lower():
            analysis["ultrathink_count"] += 1

        if any(w in ["i", "my", "me", "i'm", "i've", "we", "our"] for w in words):
            first_person_count += 1

        # Track keywords
        for kw in keywords_of_interest:
            if kw in text.lower():
                analysis["keywords"][kw] += 1

    if prompts:
        analysis["question_ratio"] = question_count / len(prompts)
        analysis["command_ratio"] = command_count / len(prompts)
        analysis["first_person_ratio"] = first_person_count / len(prompts)

    analysis["unique_words"] = len(analysis["unique_words"])

    return analysis


def main():
    """Main entry point."""
    log_dir = Path(".claude/logging")

    if not log_dir.exists():
        print(f"Log directory not found: {log_dir}", file=sys.stderr)
        sys.exit(1)

    print("Extracting user prompts from session logs...", file=sys.stderr)
    results = extract_prompts(log_dir)

    print(f"\nProcessed {results['total_sessions']} sessions, {results['total_events']} events", file=sys.stderr)
    print(f"Extracted {len(results['prompts'])} user prompts", file=sys.stderr)

    # Analyze prompts
    prompt_analysis = analyze_prompts(results["prompts"])

    # Create output
    output = {
        "extraction_timestamp": datetime.now().isoformat(),
        "summary": {
            "total_sessions": results["total_sessions"],
            "total_events": results["total_events"],
            "total_prompts": len(results["prompts"]),
            "unique_prompt_words": prompt_analysis["unique_words"],
        },
        "prompt_analysis": {
            "question_ratio": round(prompt_analysis["question_ratio"], 3),
            "command_ratio": round(prompt_analysis["command_ratio"], 3),
            "first_person_ratio": round(prompt_analysis["first_person_ratio"], 3),
            "ultrathink_count": prompt_analysis["ultrathink_count"],
            "avg_word_count": round(sum(prompt_analysis["word_count_distribution"]) / max(len(prompt_analysis["word_count_distribution"]), 1), 1),
            "top_keywords": prompt_analysis["keywords"].most_common(20),
        },
        "tool_usage": results["tool_usage"].most_common(20),
        "session_hours": dict(sorted(results["session_hours"].items())),
        "avg_session_duration_minutes": round(sum(results["session_durations"]) / max(len(results["session_durations"]), 1), 1) if results["session_durations"] else 0,
        "prompts": results["prompts"],  # Full corpus
    }

    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
