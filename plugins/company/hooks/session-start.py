#!/usr/bin/env python3
"""
Board Mentor SessionStart Hook

Injects business/finance context at session start when board-mentor output style is active.

Also auto-installs the board-mentor output style via symlink on first run.

Reads from:
- Journal entries (recent business keywords)
- Exploration discoveries (substrate, network circles)
- Backlog tasks (company domain)
- AgentNet activity (board-mentor posts/messages)

Outputs: Context string for Claude's session initialization
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import re


def ensure_output_style_installed(plugin_root: Path) -> bool:
    """
    Auto-install the board-mentor output style via symlink.

    Creates ~/.claude/output-styles/board-mentor.md -> plugin source.
    Uses symlink so plugin updates propagate automatically.

    Returns True if installed/updated, False if already correct.
    """
    source = plugin_root / "output-styles" / "board-mentor.md"
    if not source.exists():
        return False

    # Ensure user output-styles directory exists
    user_styles_dir = Path.home() / ".claude" / "output-styles"
    user_styles_dir.mkdir(parents=True, exist_ok=True)

    target = user_styles_dir / "board-mentor.md"

    # Check current state
    if target.is_symlink():
        # Already a symlink - check if it points to correct source
        try:
            if target.resolve() == source.resolve():
                return False  # Already correctly installed
            # Wrong target, remove and recreate
            target.unlink()
        except Exception:
            target.unlink()
    elif target.exists():
        # Regular file exists - replace with symlink for auto-updates
        target.unlink()

    # Create symlink
    try:
        target.symlink_to(source)
        return True
    except Exception:
        # Fallback: copy if symlink fails (e.g., cross-filesystem)
        try:
            import shutil
            shutil.copy2(source, target)
            return True
        except Exception:
            return False


def get_project_root(cwd: str) -> Path:
    """Find project root containing .claude/ directory."""
    path = Path(cwd)
    while path != path.parent:
        if (path / ".claude").exists():
            return path
        path = path.parent
    return Path(cwd)


def get_recent_journal_entries(root: Path, days: int = 7) -> list[dict]:
    """Find journal entries mentioning business/finance keywords."""
    keywords = [
        "revenue", "entity", "tax", "legal", "investor", "partnership",
        "incorporation", "compliance", "fundraising", "governance",
        "dividend", "salary", "ccpc", "corporation", "shareholder",
        "equity", "valuation", "exit", "acquisition"
    ]

    journal_dir = root / ".claude/journal"
    if not journal_dir.exists():
        return []

    cutoff = datetime.now() - timedelta(days=days)
    entries = []

    for md_file in journal_dir.rglob("*.md"):
        try:
            stat = md_file.stat()
            if stat.st_mtime < cutoff.timestamp():
                continue

            content = md_file.read_text()
            content_lower = content.lower()

            # Check if any keywords match
            matches = [kw for kw in keywords if kw in content_lower]
            if not matches:
                continue

            # Extract title from filename or first heading
            title = md_file.stem
            first_heading = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            if first_heading:
                title = first_heading.group(1)[:50]

            # Extract relevant snippet (first paragraph with keyword)
            paragraphs = content.split('\n\n')
            snippet = ""
            for para in paragraphs:
                if any(kw in para.lower() for kw in matches):
                    snippet = para[:200].replace('\n', ' ').strip()
                    break

            if not snippet:
                snippet = content[:150].replace('\n', ' ').strip()

            entries.append({
                "title": title,
                "keywords": matches[:3],
                "snippet": snippet,
                "date": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d")
            })
        except Exception:
            continue

    # Sort by date descending, limit to 3
    entries.sort(key=lambda x: x["date"], reverse=True)
    return entries[:3]


def get_exploration_discoveries(root: Path) -> list[dict]:
    """Find exploration discoveries related to business/institutional topics."""
    discoveries_dir = root / ".claude/exploration/discoveries"
    if not discoveries_dir.exists():
        return []

    business_keywords = [
        "entity", "corporation", "business", "legal", "tax", "governance",
        "market", "competitor", "funding", "investor", "jurisdiction"
    ]

    discoveries = []

    for md_file in discoveries_dir.rglob("*.md"):
        try:
            content = md_file.read_text()
            content_lower = content.lower()

            # Check if business-related
            if not any(kw in content_lower for kw in business_keywords):
                continue

            # Extract circle from frontmatter or path
            circle = "unknown"
            if "circle:" in content_lower:
                match = re.search(r'circle:\s*(\w+)', content, re.IGNORECASE)
                if match:
                    circle = match.group(1)

            # Only include substrate and network circles
            if circle.lower() not in ["substrate", "network", "unknown"]:
                continue

            # Extract title
            title = md_file.stem
            first_heading = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            if first_heading:
                title = first_heading.group(1)[:50]

            # Extract snippet
            snippet = content[:150].replace('\n', ' ').strip()

            discoveries.append({
                "title": title,
                "circle": circle,
                "snippet": snippet
            })
        except Exception:
            continue

    return discoveries[:3]


def get_backlog_tasks(root: Path) -> list[dict]:
    """Find outstanding company-domain tasks in backlog."""
    # Check multiple possible backlog locations
    backlog_paths = [
        root / ".claude/backlog",
        root / "backlog",
        root / "Backlog.md"
    ]

    company_keywords = [
        "company:", "incorporation", "tax filing", "compliance",
        "entity", "legal", "governance", "fundraising", "financial"
    ]

    tasks = []

    for backlog_path in backlog_paths:
        if not backlog_path.exists():
            continue

        if backlog_path.is_file():
            # Single Backlog.md file
            try:
                content = backlog_path.read_text()
                # Find incomplete tasks
                for match in re.finditer(r'- \[ \]\s*(.+)', content):
                    task_text = match.group(1).strip()
                    if any(kw in task_text.lower() for kw in company_keywords):
                        tasks.append({"task": task_text[:100], "source": "backlog"})
                        if len(tasks) >= 3:
                            break
            except Exception:
                pass
        else:
            # Directory of task files
            for md_file in backlog_path.rglob("*.md"):
                try:
                    content = md_file.read_text()
                    content_lower = content.lower()

                    if not any(kw in content_lower for kw in company_keywords):
                        continue

                    # Check if task is incomplete (status: pending or todo)
                    if "status: done" in content_lower or "status: completed" in content_lower:
                        continue

                    title = md_file.stem
                    tasks.append({"task": title[:100], "source": "backlog"})

                    if len(tasks) >= 3:
                        break
                except Exception:
                    continue

        if len(tasks) >= 3:
            break

    return tasks[:3]


def get_agentnet_status(root: Path) -> dict:
    """Get board-mentor's AgentNet activity summary."""
    social_dir = root / ".claude/social"
    if not social_dir.exists():
        return {"posts": 0, "pending_threads": 0}

    # Count posts
    wall_dir = social_dir / "walls" / "board-mentor"
    post_count = len(list(wall_dir.glob("*.md"))) if wall_dir.exists() else 0

    # Count pending threads (where last message was TO board-mentor)
    threads_dir = social_dir / "threads"
    pending_threads = 0

    if threads_dir.exists():
        for thread_dir in threads_dir.iterdir():
            if not thread_dir.is_dir():
                continue

            messages = sorted(thread_dir.glob("[0-9]*.md"))
            if messages:
                try:
                    last_msg = messages[-1].read_text()
                    if "board-mentor" in last_msg.lower() and "to:" in last_msg.lower():
                        pending_threads += 1
                except Exception:
                    continue

    return {"posts": post_count, "pending_threads": pending_threads}


def build_context(cwd: str, session_id: str) -> str:
    """Build complete business context injection."""
    root = get_project_root(cwd)

    sections = []

    # Journal entries
    journal_entries = get_recent_journal_entries(root)
    if journal_entries:
        journal_section = ["**Recent Business Journal Entries:**"]
        for entry in journal_entries:
            keywords_str = ", ".join(entry["keywords"])
            journal_section.append(f"- [{entry['date']}] {entry['title']} ({keywords_str})")
            journal_section.append(f"  {entry['snippet'][:100]}...")
        sections.append("\n".join(journal_section))

    # Exploration discoveries
    discoveries = get_exploration_discoveries(root)
    if discoveries:
        discovery_section = ["**Business Discoveries (exploration):**"]
        for disc in discoveries:
            discovery_section.append(f"- [{disc['circle']}] {disc['title']}")
        sections.append("\n".join(discovery_section))

    # Backlog tasks
    tasks = get_backlog_tasks(root)
    if tasks:
        task_section = ["**Pending Company Tasks:**"]
        for task in tasks:
            task_section.append(f"- [ ] {task['task']}")
        sections.append("\n".join(task_section))

    # AgentNet status
    agentnet = get_agentnet_status(root)
    if agentnet["posts"] > 0 or agentnet["pending_threads"] > 0:
        status_parts = []
        if agentnet["posts"] > 0:
            status_parts.append(f"{agentnet['posts']} posts")
        if agentnet["pending_threads"] > 0:
            status_parts.append(f"{agentnet['pending_threads']} threads awaiting response")
        sections.append(f"**AgentNet Activity:** {', '.join(status_parts)}")

    if not sections:
        return ""

    # Assemble final context with visual separator
    context = [
        "Board Mentor Context (output_style: board-mentor)",
        "=" * 50,
        "",
    ]

    context.extend(sections)

    context.extend([
        "",
        "-" * 50,
        "Mode: Proactive advisory. Watch for revenue, hiring, fundraising, partnership signals.",
        "Style: Recommendations first, rationale second.",
        ""
    ])

    return "\n".join(context)


def main():
    """Hook entry point."""
    try:
        # Auto-install output style via symlink
        # CLAUDE_PLUGIN_ROOT is set by Claude Code when running plugin hooks
        plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT")
        if plugin_root:
            ensure_output_style_installed(Path(plugin_root))

        # Read hook input
        input_data = sys.stdin.read()
        if not input_data.strip():
            sys.exit(0)

        data = json.loads(input_data)
        session_id = data.get("session_id", "")
        cwd = data.get("cwd", os.getcwd())

        # Build and output context
        context = build_context(cwd, session_id)
        if context:
            print(context)

    except json.JSONDecodeError:
        # Invalid JSON input, exit silently
        pass
    except Exception as e:
        # Fail silently - context injection is enhancement, not critical
        if os.environ.get("DEBUG_COMPANY_HOOKS"):
            print(f"Error: {e}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
