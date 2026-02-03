"""Shared infrastructure for Claude statusline hooks.

Provides common functionality for auto-summary, auto-name, and auto-description hooks:
- Configuration loading (backend selection, API key discovery)
- Context extraction from JSONL logs
- History retrieval (summaries, descriptions)
- AI generation with API or headless backend
- Debug logging utilities
- Registry updates with atomic file locking

This module eliminates ~400 lines of duplication across hooks while keeping
domain-specific logic (prompts, triggers) in the individual hook scripts.
"""

import fcntl
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional


# =============================================================================
# Debug Logging
# =============================================================================

def debug(msg: str, prefix: str = "statusline"):
    """Print debug message to stderr if DEBUG_{PREFIX} is enabled."""
    env_var = f"DEBUG_{prefix.upper()}"
    if os.environ.get(env_var, "").lower() in ("1", "true", "yes"):
        print(f"[{prefix}] {msg}", file=sys.stderr)


# =============================================================================
# Statusline Event Logging
# =============================================================================

def log_statusline_event(
    event_type: str,
    session_id: str,
    value: str,
    success: bool,
    prefix: str = "statusline",
    instances_dir: Path = None
) -> None:
    """Append a statusline event to the JSONL log for historical analysis.

    Args:
        event_type: "name", "description", or "summary"
        session_id: Session UUID
        value: Generated value (empty string if failed)
        success: Whether generation succeeded
        prefix: Debug logging prefix
        instances_dir: Optional path to instances directory. If provided, logs to
                      that directory's statusline.jsonl. This ensures logs stay
                      with the registry (project-local or home).
    """
    from datetime import datetime, timezone

    # Use provided instances_dir, or fall back to home
    if instances_dir:
        log_file = instances_dir / "statusline.jsonl"
    else:
        log_file = Path.home() / ".claude" / "instances" / "statusline.jsonl"
    log_file.parent.mkdir(parents=True, exist_ok=True)

    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "session": session_id[:8] if session_id else "",
        "type": event_type,
        "value": value,
        "ok": success
    }

    try:
        with open(log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
        debug(f"Logged {event_type}: {value[:50] if value else '(empty)'}...", prefix)
    except Exception as e:
        debug(f"Failed to log event: {e}", prefix)


# =============================================================================
# Configuration
# =============================================================================

def get_config(cwd: str, prefix: str = "statusline") -> dict:
    """Load configuration from files or environment.

    Checks (in order of priority):
    1. Project-local: {cwd}/.claude/statusline.conf
    2. User-global: ~/.claude/statusline.conf
    3. Environment: SUMMARY_BACKEND

    Args:
        cwd: Current working directory
        prefix: Debug logging prefix

    Returns:
        Config dict with 'backend' key ('api' or 'headless')
    """
    config = {"backend": "headless"}  # Default to free option

    for loc in [Path(cwd) / ".claude/statusline.conf", Path.home() / ".claude/statusline.conf"]:
        if loc.exists():
            try:
                for line in loc.read_text().strip().split("\n"):
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip().upper()
                        value = value.strip().strip('"').strip("'")
                        if key == "BACKEND":
                            config["backend"] = value.lower()
                debug(f"Config loaded from {loc}", prefix)
                break
            except Exception as e:
                debug(f"Failed to load config from {loc}: {e}", prefix)

    # Environment overrides
    if os.environ.get("SUMMARY_BACKEND"):
        config["backend"] = os.environ["SUMMARY_BACKEND"].lower()
        debug(f"Backend from environment: {config['backend']}", prefix)

    return config


def get_api_key(cwd: str, prefix: str = "statusline") -> str:
    """Find API key from multiple sources.

    Checks (in order of priority):
    1. Environment: ANTHROPIC_API_KEY
    2. Project-local: {cwd}/.claude/anthropic_api_key
    3. User-global: ~/.claude/anthropic_api_key

    Args:
        cwd: Current working directory
        prefix: Debug logging prefix

    Returns:
        API key string or empty string if not found
    """
    # Environment variable (highest priority)
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if key:
        debug("API key found in environment", prefix)
        return key

    # Config files
    for loc in [Path(cwd) / ".claude/anthropic_api_key", Path.home() / ".claude/anthropic_api_key"]:
        if loc.exists():
            key = loc.read_text().strip()
            if key:
                debug(f"API key found in {loc}", prefix)
                return key

    debug("No API key found", prefix)
    return ""


def get_instances_dir(cwd: str) -> Path:
    """Find instances directory.

    Checks (in order of priority):
    1. Project-local: {cwd}/.claude/instances
    2. User-global: ~/.claude/instances

    Args:
        cwd: Current working directory

    Returns:
        Path to instances directory
    """
    for loc in [Path(cwd) / ".claude/instances", Path.home() / ".claude/instances"]:
        if loc.exists():
            return loc
    return Path.home() / ".claude/instances"


def get_agent_name(instances_dir: Path, session_id: str) -> str:
    """Get agent name from registry.

    Args:
        instances_dir: Path to instances directory
        session_id: Session identifier

    Returns:
        Agent name or 'Claude' if not found
    """
    registry = instances_dir / "registry.json"
    if registry.exists():
        try:
            data = json.loads(registry.read_text())
            return data.get(session_id, {}).get("name", "Claude")
        except:
            pass
    return "Claude"


# =============================================================================
# Context Extraction from JSONL Logs
# =============================================================================

def _find_log_file(cwd: str, session_id: str) -> Optional[Path]:
    """Find the JSONL log file for a session.

    Args:
        cwd: Current working directory
        session_id: Session identifier

    Returns:
        Path to log file or None if not found
    """
    log_dir = Path(cwd) / ".claude/logging"
    if not log_dir.exists():
        log_dir = Path.home() / ".claude/logging"

    if not log_dir.exists():
        return None

    short_id = session_id[:8]
    log_files = list(log_dir.rglob(f"*{short_id}*.jsonl"))
    return log_files[0] if log_files else None


def get_recent_messages(cwd: str, session_id: str, limit: int = 6, prefix: str = "statusline") -> list[dict]:
    """Extract recent user/assistant messages from logs.

    Args:
        cwd: Current working directory
        session_id: Session identifier
        limit: Maximum number of messages to return
        prefix: Debug logging prefix

    Returns:
        List of message dicts with 'role' and 'content' keys
    """
    log_file = _find_log_file(cwd, session_id)
    if not log_file:
        return []

    messages = []
    try:
        for line in log_file.read_text().strip().split("\n"):
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("type") == "UserPromptSubmit":
                prompt = entry.get("data", {}).get("prompt", "")
                if prompt:
                    messages.append({"role": "user", "content": prompt[:300]})
            elif entry.get("type") == "AssistantResponse":
                response = entry.get("data", {}).get("response", "")
                if response:
                    messages.append({"role": "assistant", "content": response[:300]})
    except Exception as e:
        debug(f"Error reading log file: {e}", prefix)

    return messages[-limit:] if limit else messages


def get_first_messages(cwd: str, session_id: str, limit: int = 5, prefix: str = "statusline") -> list[dict]:
    """Extract first N user prompts from session (anchors origin/purpose).

    Args:
        cwd: Current working directory
        session_id: Session identifier
        limit: Maximum number of prompts to return
        prefix: Debug logging prefix

    Returns:
        List of message dicts with 'role' and 'content' keys
    """
    log_file = _find_log_file(cwd, session_id)
    if not log_file:
        return []

    prompts = []
    try:
        for line in log_file.read_text().strip().split("\n"):
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("type") == "UserPromptSubmit":
                prompt = entry.get("data", {}).get("prompt", "")
                if prompt:
                    prompts.append({"role": "user", "content": prompt[:300]})
                    if len(prompts) >= limit:
                        break
    except Exception as e:
        debug(f"Error reading log file: {e}", prefix)

    return prompts


def get_recent_user_prompts(cwd: str, session_id: str, limit: int = 20, prefix: str = "statusline") -> list[dict]:
    """Extract most recent N user prompts (current trajectory).

    Args:
        cwd: Current working directory
        session_id: Session identifier
        limit: Maximum number of prompts to return
        prefix: Debug logging prefix

    Returns:
        List of message dicts with 'role' and 'content' keys
    """
    log_file = _find_log_file(cwd, session_id)
    if not log_file:
        return []

    prompts = []
    try:
        for line in log_file.read_text().strip().split("\n"):
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("type") == "UserPromptSubmit":
                prompt = entry.get("data", {}).get("prompt", "")
                if prompt:
                    prompts.append({"role": "user", "content": prompt[:300]})
    except Exception as e:
        debug(f"Error reading log file: {e}", prefix)

    return prompts[-limit:]


def get_latest_response(cwd: str, session_id: str, prefix: str = "statusline") -> str:
    """Get the most recent Claude response.

    Args:
        cwd: Current working directory
        session_id: Session identifier
        prefix: Debug logging prefix

    Returns:
        Most recent response text (truncated to 500 chars) or empty string
    """
    log_file = _find_log_file(cwd, session_id)
    if not log_file:
        return ""

    responses = []
    try:
        for line in log_file.read_text().strip().split("\n"):
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("type") == "AssistantResponse":
                response = entry.get("data", {}).get("response", "")
                if response:
                    responses.append(response)
    except Exception as e:
        debug(f"Error reading log file: {e}", prefix)

    return responses[-1][:500] if responses else ""


def format_messages_for_prompt(messages: list[dict], role_label: str = "User") -> str:
    """Format messages as strings for inclusion in prompts.

    Args:
        messages: List of message dicts with 'role' and 'content'
        role_label: Label to use for user messages

    Returns:
        Formatted string with one message per line
    """
    lines = []
    for msg in messages:
        role = role_label if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


# =============================================================================
# History Retrieval
# =============================================================================

def get_history(instances_dir: Path, session_id: str, subdir: str, limit: int = 3) -> str:
    """Get previous entries from history file for continuity.

    Args:
        instances_dir: Path to instances directory
        session_id: Session identifier
        subdir: Subdirectory name ('summaries' or 'descriptions')
        limit: Maximum number of entries to return

    Returns:
        Newline-separated history entries or empty string
    """
    history_file = instances_dir / subdir / f"{session_id}.history"
    if history_file.exists():
        try:
            lines = history_file.read_text().strip().split("\n")
            return "\n".join(lines[-limit:])
        except:
            pass
    return ""


def get_previous_summaries(instances_dir: Path, session_id: str, limit: int = 3) -> str:
    """Get previous summaries for continuity."""
    return get_history(instances_dir, session_id, "summaries", limit)


def get_previous_descriptions(instances_dir: Path, session_id: str, limit: int = 10) -> str:
    """Get previous descriptions for continuity."""
    return get_history(instances_dir, session_id, "descriptions", limit)


# =============================================================================
# AI Generation (API and Headless Backends)
# =============================================================================

def _generate_api(prompt: str, api_key: str, max_tokens: int = 50, temperature: float = 0.3, prefix: str = "statusline") -> str:
    """Generate text using Anthropic API directly.

    Args:
        prompt: The prompt to send
        api_key: Anthropic API key
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature
        prefix: Debug logging prefix

    Returns:
        Generated text or empty string on error
    """
    debug("Using API backend", prefix)
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "user", "content": prompt}],
        )

        text = msg.content[0].text.strip()
        # Clean up: remove quotes, take first line
        text = text.strip('"').strip("'").split("\n")[0].strip()
        debug(f"API response: {text}", prefix)
        return text
    except Exception as e:
        debug(f"API error: {e}", prefix)
        return ""


def _generate_headless(prompt: str, max_tokens: int = 50, temperature: float = 0.3, prefix: str = "statusline", multiline: bool = False) -> str:
    """Generate text using headless Claude CLI.

    Args:
        prompt: The prompt to send
        max_tokens: Maximum tokens to generate (ignored for headless)
        temperature: Sampling temperature (ignored for headless)
        prefix: Debug logging prefix

    Returns:
        Generated text or empty string on error
    """
    debug("Using headless backend", prefix)
    try:
        # Unset ANTHROPIC_API_KEY to force Max subscription usage
        env = os.environ.copy()
        env.pop("ANTHROPIC_API_KEY", None)

        result = subprocess.run(
            [
                "claude",
                "-p",
                prompt,
                "--model",
                "haiku",
                "--no-session-persistence",
                "--tools",
                "",
                "--setting-sources",
                "",  # Disable all settings = no hooks, no plugins (prevents recursion)
            ],
            input="",
            capture_output=True,
            text=True,
            timeout=30,
            env=env,
        )

        if result.returncode != 0:
            debug(f"Headless error: {result.stderr}", prefix)
            return ""

        text = result.stdout.strip()
        # Clean up: remove quotes
        text = text.strip('"').strip("'")
        # For multiline=False (default), take first line only (legacy behavior)
        # For multiline=True, return all lines for JSON parsing
        if not multiline:
            text = text.split("\n")[0].strip()
        debug(f"Headless response: {text}", prefix)
        return text
    except subprocess.TimeoutExpired:
        debug("Headless timeout (30s)", prefix)
        return ""
    except Exception as e:
        debug(f"Headless error: {e}", prefix)
        return ""


def generate_with_backend(
    prompt: str,
    config: dict,
    api_key: str,
    max_tokens: int = 50,
    temperature: float = 0.3,
    prefix: str = "statusline",
    multiline: bool = False
) -> str:
    """Generate text using configured backend.

    Automatically falls back to headless if API backend is selected but no key is available.

    Args:
        prompt: The prompt to send
        config: Config dict with 'backend' key
        api_key: API key (required for API backend)
        max_tokens: Maximum tokens to generate
        temperature: Sampling temperature
        prefix: Debug logging prefix
        multiline: If True, return full response (for JSON parsing). Default False for legacy single-line.

    Returns:
        Generated text or empty string on error
    """
    # Debug: Show full prompt when DEBUG_{PREFIX} is enabled
    env_var = f"DEBUG_{prefix.upper()}"
    if os.environ.get(env_var, "").lower() in ("1", "true", "yes"):
        print(f"\n{'='*70}", file=sys.stderr)
        print(f"[{prefix}] PROMPT PREVIEW (max_tokens={max_tokens}, temp={temperature})", file=sys.stderr)
        print(f"{'='*70}", file=sys.stderr)
        print(prompt, file=sys.stderr)
        print(f"{'='*70}\n", file=sys.stderr)

    backend = config.get("backend", "headless")

    if backend == "api":
        if not api_key:
            debug("API backend selected but no API key - falling back to headless", prefix)
            return _generate_headless(prompt, max_tokens, temperature, prefix, multiline)
        return _generate_api(prompt, api_key, max_tokens, temperature, prefix)
    else:
        return _generate_headless(prompt, max_tokens, temperature, prefix, multiline)


# =============================================================================
# Prompt Template Loading
# =============================================================================

def _parse_prompt_config(config_path: Path) -> dict:
    """Parse prompts/config.yaml to get active versions.

    Simple parser that extracts active versions without full YAML dependency.
    Expected format:
        active:
          name: 1_ecosystem_aware
          description: 1_plugin_role
          summary: 1_feature_level

    Returns:
        Dict mapping prompt name to active version string
    """
    result = {}
    if not config_path.exists():
        return result

    try:
        content = config_path.read_text()
        in_active = False
        for line in content.splitlines():
            stripped = line.strip()
            if stripped == "active:":
                in_active = True
                continue
            if in_active and stripped and not stripped.startswith("#"):
                if ":" in stripped and line.startswith("  "):
                    key, value = stripped.split(":", 1)
                    result[key.strip()] = value.strip()
                elif not line.startswith("  "):
                    # Exited active block
                    break
    except:
        pass

    return result


def _extract_prompt_content(content: str) -> str:
    """Extract prompt content from markdown file with YAML frontmatter.

    Format:
        ---
        key: value
        ...
        ---
        Actual prompt content here

    Returns:
        The content after the second '---' delimiter, or full content if no frontmatter
    """
    if not content.startswith("---"):
        return content.strip()

    # Find the second ---
    lines = content.split("\n")
    delimiter_count = 0
    content_start = 0

    for i, line in enumerate(lines):
        if line.strip() == "---":
            delimiter_count += 1
            if delimiter_count == 2:
                content_start = i + 1
                break

    if delimiter_count >= 2:
        return "\n".join(lines[content_start:]).strip()

    return content.strip()


def load_prompt_template(script_dir: Path, template_name: str, default_template: str) -> str:
    """Load prompt template from file or use default.

    Checks (in order of priority):
    1. Versioned prompts: {plugin_root}/prompts/{short_name}/{version}.md (from config.yaml)
    2. Legacy prompts directory: {plugin_root}/prompts/{short_name}.txt
    3. Same directory as calling script: {script_dir}/{template_name}
    4. User-global: ~/.claude/{template_name}
    5. Fallback to provided default

    Args:
        script_dir: Directory of the calling script (typically hooks/)
        template_name: Name of template file (e.g., 'summary-prompt.txt')
        default_template: Default template string if no file found

    Returns:
        Template string (frontmatter stripped if present)
    """
    # Derive short name: "summary-prompt.txt" -> "summary"
    short_name = template_name.replace("-prompt.txt", "").replace(".txt", "")

    # Plugin root is parent of script_dir (hooks/ -> plugin/)
    plugin_root = script_dir.parent
    prompts_dir = plugin_root / "prompts"

    # Try versioned prompt first (from config.yaml)
    config_path = prompts_dir / "config.yaml"
    active_versions = _parse_prompt_config(config_path)

    if short_name in active_versions:
        version = active_versions[short_name]
        versioned_path = prompts_dir / short_name / f"{version}.md"
        if versioned_path.exists():
            try:
                content = versioned_path.read_text()
                template = _extract_prompt_content(content)
                if template:
                    return template
            except:
                pass

    # Fall back to legacy locations
    legacy_locations = [
        prompts_dir / f"{short_name}.txt",  # Legacy: prompts/ directory
        script_dir / template_name,  # Legacy: hooks/ directory
        Path.home() / ".claude" / template_name,  # User override
    ]

    for loc in legacy_locations:
        if loc.exists():
            try:
                template = loc.read_text().strip()
                if template:
                    return template
            except:
                pass

    return default_template


# =============================================================================
# Storage Operations
# =============================================================================

def update_registry_task(
    instances_dir: Path,
    session_id: str,
    task: str,
    prefix: str = "statusline"
) -> bool:
    """Update the task field in registry.json with atomic file locking.

    Uses fcntl file locking to prevent race conditions from concurrent hooks.

    Args:
        instances_dir: Path to instances directory
        session_id: Session identifier
        task: New task description
        prefix: Debug logging prefix

    Returns:
        True on success, False on error
    """
    registry = instances_dir / "registry.json"
    if not registry.exists():
        debug(f"Registry not found: {registry}", prefix)
        return False

    try:
        with open(registry, "r+") as f:
            # Acquire exclusive lock (blocks until available)
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                data = json.load(f)

                if session_id not in data:
                    debug(f"Session {session_id} not in registry", prefix)
                    return False

                # Update task field
                data[session_id]["task"] = task

                # Rewind and truncate before writing
                f.seek(0)
                f.truncate()
                json.dump(data, f, indent=2)
                debug(f"Updated registry task: {session_id[:8]} -> {task}", prefix)
                return True
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except Exception as e:
        debug(f"Registry update failed: {e}", prefix)
        return False


def write_with_history(
    instances_dir: Path,
    session_id: str,
    subdir: str,
    content: str,
    prefix: str = "statusline"
) -> bool:
    """Write content to current file and append to history.

    Args:
        instances_dir: Path to instances directory
        session_id: Session identifier
        subdir: Subdirectory name ('summaries' or 'descriptions')
        content: Content to write
        prefix: Debug logging prefix

    Returns:
        True on success, False on error
    """
    try:
        target_dir = instances_dir / subdir
        target_dir.mkdir(parents=True, exist_ok=True)

        current_file = target_dir / f"{session_id}.txt"
        history_file = target_dir / f"{session_id}.history"

        current_file.write_text(content)
        with open(history_file, "a") as f:
            f.write(content + "\n")

        debug(f"Wrote to {subdir}/{session_id}.txt", prefix)
        return True
    except Exception as e:
        debug(f"Write error: {e}", prefix)
        return False


# =============================================================================
# Hook Input Parsing
# =============================================================================

def parse_hook_input(prefix: str = "statusline") -> dict:
    """Parse hook input from stdin or environment.

    Claude Code passes hook data as JSON via stdin, but uv run scripts
    may need to read from HOOK_INPUT environment variable instead.

    Args:
        prefix: Debug logging prefix

    Returns:
        Parsed dict or empty dict on error
    """
    raw_input = ""
    try:
        if not sys.stdin.isatty():
            raw_input = sys.stdin.read()
        if not raw_input:
            raw_input = os.environ.get("HOOK_INPUT", "")
        data = json.loads(raw_input or "{}")
        return data
    except Exception as e:
        debug(f"Failed to parse input: {e}", prefix)
        return {}
