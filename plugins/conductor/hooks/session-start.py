#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Conductor SessionStart hook: Provides lightweight context continuity.

This hook fires on SessionStart, checking:
1. Recent git activity (commits since last session)
2. Obvious gaps (journal, library staleness)
3. Conductor state (if user model exists)

Outputs brief context for Claude without invoking the full Conductor agent.
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_git_command(args: list[str], cwd: Path) -> str:
    """Run a git command and return output."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=2,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def get_recent_commits(cwd: Path) -> int:
    """Get count of commits in last 24 hours."""
    output = run_git_command(
        ["log", "--since=24 hours ago", "--oneline"],
        cwd
    )
    if not output:
        return 0
    return len(output.split("\n"))


def check_journal_gap(cwd: Path) -> int:
    """Check days since last journal entry."""
    journal_base = cwd / ".claude" / "journal"
    if not journal_base.exists():
        return -1

    today = datetime.now().date()

    # Find most recent journal entry by scanning year/month/day structure
    try:
        # Get all year folders
        years = sorted([d for d in journal_base.iterdir() if d.is_dir() and d.name.isdigit()], reverse=True)
        if not years:
            return -1

        for year_dir in years:
            # Get all month folders in this year
            months = sorted([d for d in year_dir.iterdir() if d.is_dir() and d.name.isdigit()], reverse=True)
            for month_dir in months:
                # Get all day folders in this month
                days = sorted([d for d in month_dir.iterdir() if d.is_dir() and d.name.isdigit()], reverse=True)
                if days:
                    # Found the most recent entry
                    year = int(year_dir.name)
                    month = int(month_dir.name)
                    day = int(days[0].name)
                    latest_date = datetime(year, month, day).date()
                    return (today - latest_date).days

        return -1
    except Exception:
        return -1


def check_conductor_state(cwd: Path) -> dict:
    """Check if Conductor state exists and is populated."""
    conductor_path = cwd / ".claude" / "conductor"
    user_model = conductor_path / "user-model.md"
    pulse = conductor_path / "pulse.md"

    state = {
        "exists": conductor_path.exists(),
        "user_model": user_model.exists(),
        "pulse": pulse.exists(),
    }

    # Check if user model is bootstrapped
    if user_model.exists():
        try:
            content = user_model.read_text()
            state["bootstrapped"] = "total_observations: 0" not in content
        except Exception:
            state["bootstrapped"] = False
    else:
        state["bootstrapped"] = False

    return state


def get_top_anticipation(cwd: Path, threshold: float = 0.7) -> tuple[str, float] | None:
    """Get the highest-confidence anticipation above threshold.

    Returns (interest, confidence) tuple or None if none found.
    """
    import re

    anticipations_path = cwd / ".claude" / "conductor" / "anticipations.md"
    if not anticipations_path.exists():
        return None

    try:
        content = anticipations_path.read_text()

        # Find the "Likely Next Interests" table section
        # Format: | Interest | Confidence | Basis |
        pattern = r'\|\s*([^|]+)\s*\|\s*(0\.\d+)\s*\|'
        matches = re.findall(pattern, content)

        best = None
        best_conf = 0.0

        for interest, conf_str in matches:
            try:
                conf = float(conf_str)
                if conf >= threshold and conf > best_conf:
                    best = interest.strip()
                    best_conf = conf
            except ValueError:
                continue

        if best:
            return (best, best_conf)
        return None
    except Exception:
        return None


def generate_context(cwd: Path) -> str:
    """Generate brief session context."""
    parts = []

    # Git activity
    commits = get_recent_commits(cwd)
    if commits > 0:
        parts.append(f"{commits} commit{'s' if commits != 1 else ''} in last 24h")

    # Journal gap
    gap = check_journal_gap(cwd)
    if gap > 3:
        parts.append(f"Journal gap: {gap} days")

    # Conductor state
    state = check_conductor_state(cwd)
    if state["exists"]:
        if not state["bootstrapped"]:
            parts.append("User model awaiting bootstrap")

    # High-confidence anticipation
    anticipation = get_top_anticipation(cwd, threshold=0.7)
    if anticipation:
        interest, conf = anticipation
        parts.append(f"Anticipation: {interest}? ({conf})")

    if not parts:
        return ""

    return " | ".join(parts)


def main():
    """Main hook entry point."""
    # Read hook input from stdin
    try:
        input_data = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        input_data = {}

    # Get working directory (from input or current)
    cwd = Path(input_data.get("session", {}).get("cwd", ".")).resolve()

    # Generate context
    context = generate_context(cwd)

    if not context:
        # No context to add - silent success
        print(json.dumps({}))
        return

    # Output context for Claude
    # Note: SessionStart events don't support hookSpecificOutput, use systemMessage instead
    output = {
        "systemMessage": f"Conductor: {context}"
    }

    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Fail silently - context is enhancement, not critical
        print(json.dumps({}))
