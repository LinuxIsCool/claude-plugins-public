#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Claude Code logging hook. Logs to JSONL, generates Markdown reports.

Performance optimization: The anthropic library is NOT declared as a dependency
to avoid uv validation overhead (~100ms) on every hook invocation. The import
is lazy (inside summarize()) and already handles ImportError gracefully - if
anthropic isn't available, summarization is skipped silently.
"""

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

EMOJIS = {
    "SessionStart": "💫",
    "SessionEnd": "⭐",
    "UserPromptSubmit": "🍄",
    "PreToolUse": "🔨",
    "PostToolUse": "🏰",
    "PermissionRequest": "🔑",
    "Notification": "🟡",
    "PreCompact": "♻",
    "Stop": "🟢",
    "SubagentStop": "🔵",
    "AssistantResponse": "🌲",
}


def get_agent_session_from_jsonl(jsonl_path: Path, source: str) -> int:
    """Derive agent session counter directly from JSONL file.

    This is the elegant approach - single source of truth, no state file needed.
    Counts SessionStart events with source="compact" or source="clear".

    Args:
        jsonl_path: Path to the session's JSONL file
        source: Source of current event ("startup", "compact", "clear", "resume")

    Returns:
        Number of context resets (0 for fresh session, 1+ after compactions)
    """
    count = 0

    if jsonl_path.exists():
        try:
            content = jsonl_path.read_text()
            # Count existing compact/clear events
            count = content.count('"source": "compact"') + content.count('"source": "clear"')
        except OSError:
            pass

    # If this event is a compact/clear, add 1 (it hasn't been logged yet)
    if source in ("compact", "clear"):
        count += 1

    return count


def get_paths(cwd, sid, ts):
    """Get log file paths, reusing existing timestamp prefix or creating new."""
    base = Path(cwd) / ".claude/logging" / ts.strftime("%Y/%m/%d")
    base.mkdir(parents=True, exist_ok=True)
    existing = list(base.glob(f"*-{sid[:8]}.jsonl"))
    prefix = existing[0].stem.rsplit("-", 1)[0] if existing else ts.strftime("%H-%M-%S")
    return base / f"{prefix}-{sid[:8]}.jsonl", base / f"{prefix}-{sid[:8]}.md"


def get_response(transcript_path):
    """Extract last assistant response from Claude's transcript."""
    try:
        for line in reversed(Path(transcript_path).read_text().strip().split("\n")):
            if line.strip():
                entry = json.loads(line)
                if entry.get("type") == "assistant":
                    for block in entry.get("message", {}).get("content", []):
                        if block.get("type") == "text":
                            return block.get("text", "")
    except:
        pass
    return ""


def get_subagent_info(transcript_path):
    """Extract model, tools, and response from subagent transcript (multi-line JSONL)."""
    try:
        lines = Path(transcript_path).read_text().strip().split("\n")
        model, tools, responses = "", [], []

        for line in lines:
            if not line.strip():
                continue
            data = json.loads(line)

            # Get model from first entry
            if not model:
                m = data.get("message", {}).get("model", "")
                if "opus" in m:
                    model = "opus"
                elif "sonnet" in m:
                    model = "sonnet"
                elif "haiku" in m:
                    model = "haiku"

            # Extract tools and text from all entries
            for block in data.get("message", {}).get("content", []):
                if block.get("type") == "tool_use":
                    name = block.get("name", "?")
                    inp = block.get("input", {})
                    preview = ""
                    for k in ("file_path", "pattern", "query", "command"):
                        if k in inp:
                            preview = str(inp[k])
                            break
                    tools.append(f"- {name} `{preview}`" if preview else f"- {name}")
                elif block.get("type") == "text":
                    text = block.get("text", "").strip()
                    if text:
                        responses.append(text)

        return {"model": model, "tools": tools, "response": "\n\n".join(responses)}
    except:
        return {"model": "", "tools": [], "response": ""}


def tool_preview(data):
    """Extract preview string from tool input."""
    inp = data.get("tool_input", {})
    if isinstance(inp, str):
        return inp
    for k in ("file_path", "pattern", "query", "command"):
        if k in inp:
            return str(inp[k])
    return ""


def quote(text):
    """Convert text to markdown blockquote."""
    return "\n".join(f"> {line}" for line in text.split("\n"))


def get_cache_path(jsonl_path):
    """Get path to summary cache file."""
    return jsonl_path.with_suffix(".cache.json")


def load_cache(cache_path):
    """Load summary cache from disk."""
    try:
        return json.loads(cache_path.read_text()) if cache_path.exists() else {}
    except:
        return {}


def save_cache(cache_path, cache):
    """Save summary cache to disk."""
    try:
        cache_path.write_text(json.dumps(cache, indent=2))
    except:
        pass


def text_hash(text):
    """Generate a short hash for cache key."""
    return hashlib.md5(text.encode()).hexdigest()[:12]


def summarize(text, context, cache, cache_path):
    """Generate 2-7 word summary using Haiku, with caching."""
    if not text or len(text.strip()) < 10:
        return ""

    key = text_hash(text)
    if key in cache:
        return cache[key]

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return ""

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        prompt = f"""Generate a 2-7 word summary of this {context}.

Text:
{text[:500]}

Requirements:
- 2-7 words ONLY
- No punctuation at end
- Focus on the key action or topic
- Return ONLY the summary, nothing else

Examples:
- Fix database connection bug
- Search for config files
- Explain authentication flow
- Add user validation

Summary:"""

        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=30,
            temperature=0.3,
            messages=[{"role": "user", "content": prompt}],
        )

        summary = msg.content[0].text.strip().strip('"').strip("'").strip(".")
        summary = summary.split("\n")[0].strip()

        # Validate length
        words = summary.split()
        if len(words) > 7:
            summary = " ".join(words[:7])

        cache[key] = summary
        save_cache(cache_path, cache)
        return summary
    except:
        return ""


def generate_markdown(jsonl_path, md_path, sid):
    """Generate markdown report from JSONL source."""
    try:
        events = [
            json.loads(l) for l in jsonl_path.read_text().strip().split("\n") if l
        ]
    except:
        return
    if not events:
        return

    # Load summary cache
    cache_path = get_cache_path(jsonl_path)
    cache = load_cache(cache_path)

    # First pass: build agent_id -> prompt mapping from Task tool calls
    agent_prompts = {}
    tool_use_prompts = {}
    for e in events:
        d = e.get("data", {})
        if e["type"] == "PreToolUse" and d.get("tool_name") == "Task":
            tool_use_id = d.get("tool_use_id", "")
            task_prompt = d.get("tool_input", {}).get("prompt", "")
            if tool_use_id and task_prompt:
                tool_use_prompts[tool_use_id] = task_prompt
        elif e["type"] == "PostToolUse" and d.get("tool_name") == "Task":
            tool_use_id = d.get("tool_use_id", "")
            agent_id = d.get("tool_response", {}).get("agentId", "")
            if agent_id and tool_use_id in tool_use_prompts:
                agent_prompts[agent_id] = tool_use_prompts[tool_use_id]

    # Get agent session from first event
    agent_session = events[0].get("agent_session", 0)

    # Build session label: shortid:agent format
    session_label = f"{sid[:8]}:{agent_session}"

    lines = [
        f"# Session {session_label}",
        f"**ID:** `{sid}`",
        f"**Agent Session:** {agent_session} (context resets)",
        f"**Started:** {events[0]['ts'][:19].replace('T', ' ')}",
        "",
        "---",
        "",
    ]

    # Second pass: process events into exchanges (prompt → stop cycles)
    prompt = tools = tool_details = subagents = None

    for e in events:
        t, d, ts = e["type"], e.get("data", {}), e["ts"][11:19]

        if t == "UserPromptSubmit":
            # Start new exchange
            prompt, tools, tool_details, subagents = (
                (ts, d.get("prompt", "")),
                Counter(),
                [],
                [],
            )

        elif t == "PreToolUse" and prompt:
            name, preview = d.get("tool_name", "?"), tool_preview(d)
            # Skip PreToolUse for AskUserQuestion - we render full Q&A in PostToolUse
            if name != "AskUserQuestion":
                tool_details.append(f"- {name} `{preview}`" if preview else f"- {name}")

        elif t == "PostToolUse" and prompt:
            tool_name = d.get("tool_name", "?")
            tools[tool_name] += 1

            # Render AskUserQuestion Q&A inline with tool details
            if tool_name == "AskUserQuestion":
                tool_response = d.get("tool_response", {})
                answers = tool_response.get("answers", {})
                questions = tool_response.get("questions", [])

                for q_obj in questions:
                    question = q_obj.get("question", "")
                    header = q_obj.get("header", "")
                    answer = answers.get(question, "")

                    if question and answer:
                        label = f"**{header}:** " if header else ""
                        tool_details.append(f"- 💬 {label}{question}")
                        # Indent answer lines to nest under the question
                        for line in answer.split("\n"):
                            tool_details.append(f"  > {line}")

        elif t == "SubagentStop" and prompt is not None:
            # Collect subagent info for this exchange
            agent_id = d.get("agent_id", "?")
            transcript = d.get("agent_transcript_path", "")
            info = get_subagent_info(transcript) if transcript else {}
            info["task_prompt"] = agent_prompts.get(agent_id, "")
            subagents.append({"ts": ts, "id": agent_id, **info})

        elif t == "AssistantResponse":
            # Complete the exchange
            if prompt:
                ts_prompt, text = prompt
                user_summary = summarize(text, "user request", cache, cache_path)
                user_label = (
                    f"`{ts_prompt}` 🍄 User: {user_summary}"
                    if user_summary
                    else f"`{ts_prompt}` 🍄 User"
                )
                lines.extend(["", "---", "", user_label, quote(text), ""])

                if tools:
                    summary = ", ".join(f"{n} ({c})" for n, c in tools.most_common())
                    lines.extend(
                        [
                            "<details>",
                            f"<summary>📦 {sum(tools.values())} tools: {summary}</summary>",
                            "",
                            *tool_details,
                            "",
                            "</details>",
                            "",
                        ]
                    )

                if subagents:
                    for sa in subagents:
                        model_tag = f" ({sa['model']})" if sa.get("model") else ""
                        sa_summary = summarize(
                            sa.get("response", ""), "agent response", cache, cache_path
                        )
                        sa_label = (
                            f"`{sa['ts']}` 🔵 Subagent {sa['id']}{model_tag}: {sa_summary}"
                            if sa_summary
                            else f"`{sa['ts']}` 🔵 Subagent {sa['id']}{model_tag}"
                        )
                        lines.extend(
                            ["<details>", f"<summary>{sa_label}</summary>", ""]
                        )
                        if sa.get("task_prompt"):
                            lines.extend(["**Prompt:**", quote(sa["task_prompt"]), ""])
                        if sa.get("tools"):
                            lines.append(f"**Tools:** {len(sa['tools'])}")
                            lines.extend(sa["tools"])
                            lines.append("")
                        if sa.get("response"):
                            lines.extend(["**Response:**", quote(sa["response"]), ""])
                        lines.extend(["</details>", ""])

                prompt = None

            response = d.get("response", "")
            claude_summary = summarize(
                response, "assistant response", cache, cache_path
            )
            claude_label = (
                f"`{ts}` 🌲 Claude: {claude_summary}"
                if claude_summary
                else f"`{ts}` 🌲 Claude"
            )
            lines.extend(
                [
                    "<details>",
                    f"<summary>{claude_label}</summary>",
                    "",
                    quote(response),
                    "",
                    "</details>",
                    "",
                ]
            )

        elif t == "SubagentStop" and prompt is None:
            # Subagent outside of an exchange (e.g., session startup)
            agent_id = d.get("agent_id", "?")
            transcript = d.get("agent_transcript_path", "")
            info = get_subagent_info(transcript) if transcript else {}
            model_tag = f" ({info['model']})" if info.get("model") else ""
            sa_summary = summarize(
                info.get("response", ""), "agent response", cache, cache_path
            )
            sa_label = (
                f"`{ts}` 🔵 Subagent {agent_id}{model_tag}: {sa_summary}"
                if sa_summary
                else f"`{ts}` 🔵 Subagent {agent_id}{model_tag}"
            )

            if info.get("tools") or info.get("response"):
                lines.extend(["<details>", f"<summary>{sa_label}</summary>", ""])
                if info.get("tools"):
                    lines.append(f"**Tools:** {len(info['tools'])}")
                    lines.extend(info["tools"])
                    lines.append("")
                if info.get("response"):
                    lines.extend(["**Response:**", quote(info["response"]), ""])
                lines.extend(["</details>", ""])
            else:
                lines.append(sa_label)

        elif t in ("SessionStart", "SessionEnd", "Notification"):
            info = d.get("source") or d.get("message") or ""
            lines.append(f"`{ts}` {EMOJIS.get(t, '•')} {t} {info}".rstrip())

    md_path.write_text("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-e", required=True)
    event = ap.parse_args().e

    data = json.loads(sys.stdin.read() or "{}") if sys.stdin else {}
    if not data:
        return

    cwd, sid, ts = (
        data.get("cwd") or ".",
        data.get("session_id", "unknown"),
        datetime.now(),
    )
    jsonl, md = get_paths(cwd, sid, ts)

    # Derive agent session counter from JSONL (tracks compactions within session)
    # This is elegant: single source of truth, no state file needed
    source = data.get("source", "unknown") if event == "SessionStart" else "unknown"
    agent_session = get_agent_session_from_jsonl(jsonl, source)

    # Append to JSONL (source of truth)
    with open(jsonl, "a") as f:
        log_entry = {
            "ts": ts.isoformat(),
            "type": event,
            "session_id": sid,
            "agent_session": agent_session,
            "data": data,
        }
        json.dump(log_entry, f, default=str)
        f.write("\n")

        # Capture assistant response on Stop (append before closing file)
        if event == "Stop" and data.get("transcript_path"):
            response = get_response(data["transcript_path"])
            if response:
                json.dump(
                    {
                        "ts": ts.isoformat(),
                        "type": "AssistantResponse",
                        "session_id": sid,
                        "agent_session": agent_session,
                        "data": {"response": response},
                    },
                    f,
                    default=str,
                )
                f.write("\n")

    # Regenerate markdown on key events
    if event in (
        "SessionStart",
        "UserPromptSubmit",
        "Stop",
        "SessionEnd",
        "SubagentStop",
        "Notification",
    ):
        generate_markdown(jsonl, md, sid)


if __name__ == "__main__":
    try:
        main()
    except:
        pass
