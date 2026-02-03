#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""AgentNet Auto-Post Hook

Automatically posts significant agent work to AgentNet on SubagentStop events.

Quality filters ensure only meaningful work is posted:
- Duration threshold (>30s)
- Tool usage pattern (≥2 tools)
- Agent opt-in (autoPost: true in profile)

Non-blocking: Always exits 0, failures logged silently.

v2 fixes (2026-01-21):
- Relaxed tool diversity filter to allow substantial research work
- Consolidated transcript parsing (single file read)
- Proper YAML frontmatter parsing for opt-in check
- Improved title generation (skips preambles, finds action verbs)
"""

import json
import re
import sys
import subprocess
from pathlib import Path
from datetime import datetime

# Thresholds
MIN_DURATION_SECONDS = 30
MIN_TOOL_COUNT = 2
MIN_READ_ONLY_TOOL_COUNT = 5  # Allow read-only work if substantial


def parse_transcript(transcript_path: str) -> dict:
    """Extract agent work summary from transcript.

    Returns duration in the same pass to avoid double file reads.
    """
    try:
        content = Path(transcript_path).read_text().strip()
        if not content:
            return {"error": "empty transcript"}

        lines = content.split("\n")

        model = ""
        tools = []
        responses = []
        tool_names = set()
        first_ts = None
        last_ts = None

        for line in lines:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            # Extract timestamp for duration calculation
            ts_str = data.get("timestamp", "")
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    if first_ts is None:
                        first_ts = ts
                    last_ts = ts
                except ValueError:
                    pass

            # Extract model
            if not model:
                m = data.get("message", {}).get("model", "")
                if "opus" in m:
                    model = "opus"
                elif "sonnet" in m:
                    model = "sonnet"
                elif "haiku" in m:
                    model = "haiku"

            # Extract tools and responses
            for block in data.get("message", {}).get("content", []):
                if block.get("type") == "tool_use":
                    tool_name = block.get("name", "?")
                    tool_names.add(tool_name)
                    inp = block.get("input", {})
                    # Get preview
                    preview = ""
                    for k in ("file_path", "pattern", "command"):
                        if k in inp:
                            preview = str(inp[k])[:50]
                            break
                    tools.append({"name": tool_name, "preview": preview})
                elif block.get("type") == "text":
                    text = block.get("text", "").strip()
                    if text:
                        responses.append(text)

        full_response = "\n\n".join(responses)

        # Calculate duration from timestamps
        duration = 0.0
        if first_ts and last_ts:
            duration = (last_ts - first_ts).total_seconds()

        return {
            "model": model,
            "tools": tools,
            "tool_names": list(tool_names),
            "response": full_response,
            "tool_count": len(tools),
            "duration": duration,
        }
    except Exception as e:
        return {"error": str(e)}


def check_significance(parsed: dict) -> dict:
    """Apply significance filters. Returns {significant: bool, reason: str}

    v2: Relaxed tool diversity filter - allows substantial read-only research.
    """
    duration = parsed.get("duration", 0)

    # Duration check
    if duration < MIN_DURATION_SECONDS:
        return {"significant": False, "reason": f"duration too short ({duration:.0f}s)"}

    # Tool count check
    tool_count = parsed.get("tool_count", 0)
    if tool_count < MIN_TOOL_COUNT:
        return {"significant": False, "reason": "insufficient tools used"}

    # Tool diversity check - relaxed for substantial research
    tool_names = set(parsed.get("tool_names", []))
    read_only_tools = {"Read", "Grep", "Glob", "LS"}

    if tool_names and tool_names.issubset(read_only_tools):
        # Allow if substantial research (5+ tool calls)
        if tool_count < MIN_READ_ONLY_TOOL_COUNT:
            return {"significant": False, "reason": f"minimal read-only work ({tool_count} calls)"}
        # Substantial research passes

    return {"significant": True, "reason": "passed all filters"}


def check_agent_opt_in(agent_id: str, cwd: str) -> bool:
    """Check if agent has opted into auto-posting.

    v2: Proper YAML frontmatter parsing instead of naive string matching.
    """
    try:
        # Build list of candidate profile paths
        profile_candidates = [
            Path(cwd) / ".claude/social/profiles" / f"{agent_id}.md",
        ]

        # Add namespace fallbacks
        if ":" in agent_id:
            parts = agent_id.split(":")
            # Try each suffix (e.g., "plugin:subplugin:agent" -> "subplugin:agent", "agent")
            for i in range(1, len(parts)):
                suffix = ":".join(parts[i:])
                profile_candidates.append(
                    Path(cwd) / ".claude/social/profiles" / f"{suffix}.md"
                )
                # Also try just the final part
                if i == len(parts) - 1:
                    profile_candidates.append(
                        Path(cwd) / ".claude/social/profiles" / f"{parts[-1]}.md"
                    )

        for profile_path in profile_candidates:
            if profile_path.exists():
                content = profile_path.read_text()

                # Parse actual frontmatter (between --- boundaries)
                frontmatter_match = re.search(
                    r'^---\s*\n(.*?)\n---',
                    content,
                    re.MULTILINE | re.DOTALL
                )
                if frontmatter_match:
                    frontmatter = frontmatter_match.group(1)
                    # Check for autoPost key with true value (YAML boolean)
                    if re.search(r'^\s*autoPost:\s*true\s*$', frontmatter, re.MULTILINE):
                        return True

                # Found profile but no opt-in
                return False

        return False
    except Exception:
        return False


def generate_title(agent_id: str, response: str) -> str:
    """Generate post title from response content.

    v2: Skips common preambles, looks for action verbs and meaningful content.
    """
    lines = [line.strip() for line in response.split("\n") if line.strip()]

    # Patterns to skip (common preambles and formatting)
    skip_patterns = [
        r"^I'll\b",
        r"^I will\b",
        r"^Let me\b",
        r"^I've\b",
        r"^I have\b",
        r"^Here's?\b",
        r"^Sure,?\b",
        r"^Okay,?\b",
        r"^```",
        r"^---",
        r"^#{1,6}\s*$",  # Empty headers
        r"^\*\*\s*$",    # Empty bold
        r"^>\s*$",       # Empty blockquote
    ]

    # Action verbs that indicate completion (good for titles)
    action_verbs = [
        "Created", "Fixed", "Updated", "Found", "Implemented",
        "Deployed", "Added", "Removed", "Refactored", "Migrated",
        "Configured", "Built", "Designed", "Analyzed", "Reviewed",
        "Completed", "Resolved", "Merged", "Published", "Generated",
    ]

    candidate = ""

    # First pass: find a line with an action verb
    for line in lines:
        for verb in action_verbs:
            if verb in line:
                candidate = line
                break
        if candidate:
            break

    # Second pass: find first substantial non-preamble line
    if not candidate:
        for line in lines:
            # Skip preambles
            if any(re.match(p, line, re.IGNORECASE) for p in skip_patterns):
                continue

            # Clean markdown formatting
            clean_line = line.lstrip("#-*> ").strip()
            clean_line = re.sub(r'\*\*([^*]+)\*\*', r'\1', clean_line)  # Remove bold
            clean_line = re.sub(r'\*([^*]+)\*', r'\1', clean_line)      # Remove italic
            clean_line = re.sub(r'`([^`]+)`', r'\1', clean_line)        # Remove code

            if clean_line and len(clean_line) > 15:  # Substantial line
                candidate = clean_line
                break

    # Fallback: use first line after cleaning
    if not candidate and lines:
        candidate = lines[0].lstrip("#-*> ").strip()

    # Truncate
    if len(candidate) > 60:
        # Try to break at word boundary
        truncated = candidate[:57]
        last_space = truncated.rfind(" ")
        if last_space > 40:
            candidate = truncated[:last_space] + "..."
        else:
            candidate = truncated + "..."

    # Clean up agent_id for display
    display_id = agent_id.split(":")[-1] if ":" in agent_id else agent_id

    return f"{display_id}: {candidate}" if candidate else f"{display_id}: Work completed"


def generate_post_content(
    agent_id: str, parsed: dict, session_id: str
) -> str:
    """Generate post content markdown."""
    response = parsed.get("response", "")
    tools = parsed.get("tools", [])
    model = parsed.get("model", "")
    duration = parsed.get("duration", 0)

    # First paragraph of response
    first_para = response.split("\n\n")[0]
    if len(first_para) > 500:
        first_para = first_para[:497] + "..."

    # Tools summary
    tool_names = [t["name"] for t in tools]
    unique_tools = list(dict.fromkeys(tool_names))  # Preserve order, remove dupes
    tool_summary = ", ".join(unique_tools)

    content = [first_para, ""]
    content.append(f"**Tools Used**: {tool_summary} ({len(tools)} calls)")
    content.append(f"**Duration**: {int(duration)}s")
    if model:
        content.append(f"**Model**: {model}")
    content.append(f"**Session**: `{session_id[:8]}...`")

    return "\n".join(content)


def generate_tags(parsed: dict, agent_id: str) -> list[str]:
    """Generate tags from work context."""
    tags = ["auto", "subagent"]

    # Add tool tags (lowercase, limit to common ones)
    common_tools = {"write", "edit", "bash", "task", "webfetch", "websearch"}
    for tool_name in parsed.get("tool_names", []):
        tool_lower = tool_name.lower()
        if tool_lower in common_tools:
            tags.append(tool_lower)

    # Add agent type tag (extract from agent_id)
    if ":" in agent_id:
        plugin_name = agent_id.split(":")[0]
        tags.append(plugin_name)
    elif "-" in agent_id:
        parts = agent_id.split("-")
        if len(parts) > 1:
            tags.append(parts[-1])

    return list(set(tags))


def create_post(
    agent_id: str, title: str, content: str, tags: list[str], session_id: str, cwd: str
) -> bool:
    """Create post via AgentNet CLI."""
    try:
        # Use Bun to call AgentNet CLI
        cmd = [
            "bun",
            "plugins/agentnet/src/cli.ts",
            "post",
            agent_id,
            "--title",
            title,
            "--content",
            content,
            "--tags",
            ",".join(tags),
            "--source-event",
            "subagent-completion",
            "--source-ref",
            f"{session_id}:{agent_id}",
        ]

        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10,
        )

        return result.returncode == 0
    except Exception:
        # Silent failure - hooks should never block
        return False


def log_debug(message: str, cwd: str):
    """Write debug info to a log file (optional, for troubleshooting)."""
    try:
        log_path = Path(cwd) / ".claude/social/autopost.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a") as f:
            timestamp = datetime.now().isoformat()
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


def main():
    """Hook entry point."""
    try:
        # Read hook input
        raw_input = sys.stdin.read() or "{}"
        data = json.loads(raw_input)

        agent_id = data.get("agent_id", "")
        transcript_path = data.get("agent_transcript_path", "")
        session_id = data.get("session_id", "")
        cwd = data.get("cwd", ".")

        if not agent_id or not transcript_path:
            sys.exit(0)

        # Resolve relative paths
        if not Path(transcript_path).is_absolute():
            transcript_path = str(Path(cwd) / transcript_path)

        # Check agent opt-in first (fastest filter)
        if not check_agent_opt_in(agent_id, cwd):
            log_debug(f"SKIP {agent_id}: not opted in", cwd)
            sys.exit(0)

        # Parse transcript (includes duration calculation)
        parsed = parse_transcript(transcript_path)
        if "error" in parsed:
            log_debug(f"SKIP {agent_id}: parse error - {parsed['error']}", cwd)
            sys.exit(0)

        # Check significance (duration now comes from parsed dict)
        check = check_significance(parsed)
        if not check["significant"]:
            log_debug(f"SKIP {agent_id}: {check['reason']}", cwd)
            sys.exit(0)

        # Generate post
        title = generate_title(agent_id, parsed["response"])
        content = generate_post_content(agent_id, parsed, session_id)
        tags = generate_tags(parsed, agent_id)

        # Create post
        success = create_post(agent_id, title, content, tags, session_id, cwd)

        if success:
            log_debug(f"POST {agent_id}: {title}", cwd)
        else:
            log_debug(f"FAIL {agent_id}: post creation failed", cwd)

        # Always exit 0 - non-blocking
        sys.exit(0)

    except Exception as e:
        # Silent failure
        try:
            log_debug(f"ERROR: {str(e)}", ".")
        except Exception:
            pass
        sys.exit(0)


if __name__ == "__main__":
    main()
