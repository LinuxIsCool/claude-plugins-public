# Purpose

Map Claude Code hook events to memory system operations, enabling automatic memory capture, context injection, and session management. This pattern provides the integration layer between the three-tier memory architecture and Claude Code's event system.

## Variables

```yaml
# Hook Event Types
SUPPORTED_HOOKS:
  - UserPromptSubmit    # Inject context before processing
  - PostToolUse         # Capture observations from tool execution
  - Stop                # Summarize session, update caches
  - SessionEnd          # Batch processing, archival
  - PreCompact          # Emergency archival before context loss

# Hook Script Paths
HOOK_ROOT: "${PLUGIN_ROOT}/hooks"
CONTEXT_INJECTION: "${HOOK_ROOT}/inject_memory_context.py"
OBSERVATION_CAPTURE: "${HOOK_ROOT}/capture_observations.py"
SESSION_SUMMARY: "${HOOK_ROOT}/summarize_session.py"

# Configuration
MEMORY_CONFIG:
  enabled: true
  hot_injection: always
  warm_injection: triggered
  observation_capture: selective
  summary_on_stop: true
```

## Instructions

### 1. Understand Hook-Memory Mapping

Each hook event serves a specific memory function:

| Hook Event | Memory Operation | Tier Affected | Timing |
|------------|------------------|---------------|--------|
| `UserPromptSubmit` | Context injection | Hot, Warm | Before LLM sees prompt |
| `PostToolUse` | Observation capture | Hot, Warm | After each tool completes |
| `Stop` | Session summary | Hot | When agent stops |
| `SessionEnd` | Batch embedding | Warm, Cold | Session cleanup |
| `PreCompact` | Emergency archive | All | Before context loss |

### 2. Configure Hook Registration

Register hooks in your `.claude/settings.local.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "python ${PLUGIN_ROOT}/hooks/inject_memory_context.py"
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "python ${PLUGIN_ROOT}/hooks/capture_observations.py",
        "toolNames": ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "python ${PLUGIN_ROOT}/hooks/summarize_session.py"
      }
    ]
  }
}
```

### 3. Implement UserPromptSubmit Hook (Context Injection)

```python
#!/usr/bin/env python3
"""
UserPromptSubmit hook: Inject memory context before prompt processing.

Input (stdin): JSON with prompt, session info
Output (stdout): JSON with additionalContext field
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# Import from your memory module
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from memory_manager import ThreeTierMemoryManager, get_memory_root


def main():
    # Parse hook input
    input_data = json.loads(sys.stdin.read())
    user_prompt = input_data.get("prompt", "")
    session_id = input_data.get("sessionId", "unknown")

    # Initialize memory manager
    memory = ThreeTierMemoryManager(get_memory_root())

    # Get context to inject
    context = memory.get_context_for_prompt(user_prompt)

    # Build hook output
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context if context else None
        }
    }

    # Log injection for transparency
    if context:
        log_injection(session_id, user_prompt, context)

    print(json.dumps(output))


def log_injection(session_id: str, prompt: str, context: str) -> None:
    """Log what was injected for debugging."""
    log_path = get_memory_root() / "logs" / "injections.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    with log_path.open("a") as f:
        f.write(json.dumps({
            "timestamp": datetime.now().isoformat(),
            "session_id": session_id,
            "prompt_preview": prompt[:100],
            "context_tokens": len(context.split()),
            "context_preview": context[:200]
        }) + "\n")


if __name__ == "__main__":
    main()
```

### 4. Implement PostToolUse Hook (Observation Capture)

```python
#!/usr/bin/env python3
"""
PostToolUse hook: Capture observations from tool execution.

Input (stdin): JSON with tool name, parameters, output
Output (stdout): JSON with optional feedback
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from memory_manager import ThreeTierMemoryManager, get_memory_root
from observation_extractor import extract_observation


# Tools that generate memorable observations
OBSERVE_TOOLS = {
    "Read": {"importance": 0.6, "extract": "file_content"},
    "Write": {"importance": 0.8, "extract": "file_created"},
    "Edit": {"importance": 0.8, "extract": "code_change"},
    "Bash": {"importance": 0.7, "extract": "command_output"},
    "Grep": {"importance": 0.5, "extract": "search_results"},
    "Glob": {"importance": 0.4, "extract": "file_list"},
}


def main():
    input_data = json.loads(sys.stdin.read())

    tool_name = input_data.get("toolName", "")
    tool_input = input_data.get("toolInput", {})
    tool_output = input_data.get("toolOutput", "")
    session_id = input_data.get("sessionId", "unknown")

    # Check if we should capture this observation
    if tool_name not in OBSERVE_TOOLS:
        print(json.dumps({"hookSpecificOutput": {}}))
        return

    config = OBSERVE_TOOLS[tool_name]

    # Extract meaningful observation
    observation = extract_observation(
        tool_name=tool_name,
        tool_input=tool_input,
        tool_output=tool_output,
        extract_type=config["extract"]
    )

    if observation:
        # Store observation
        memory = ThreeTierMemoryManager(get_memory_root())
        memory.capture_observation(
            content=observation,
            importance=config["importance"],
            source=f"tool:{tool_name}",
            metadata={
                "tool": tool_name,
                "session_id": session_id
            }
        )

    # Return acknowledgment (no modification to flow)
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "captured": bool(observation)
        }
    }))


if __name__ == "__main__":
    main()
```

### 5. Implement Observation Extraction Logic

```python
# observation_extractor.py
"""Extract memorable observations from tool outputs."""

import re
from typing import Optional, Dict, Any


def extract_observation(tool_name: str, tool_input: Dict[str, Any],
                       tool_output: str, extract_type: str) -> Optional[str]:
    """Extract a memorable observation from tool execution."""

    extractors = {
        "file_content": _extract_file_content,
        "file_created": _extract_file_created,
        "code_change": _extract_code_change,
        "command_output": _extract_command_output,
        "search_results": _extract_search_results,
        "file_list": _extract_file_list,
    }

    extractor = extractors.get(extract_type)
    if not extractor:
        return None

    return extractor(tool_input, tool_output)


def _extract_file_content(tool_input: dict, output: str) -> Optional[str]:
    """Extract file reading observation."""
    file_path = tool_input.get("file_path", "")
    if not file_path:
        return None

    # Extract meaningful structure
    lines = output.split("\n")

    # Look for class/function definitions
    definitions = []
    for line in lines[:50]:  # First 50 lines
        if re.match(r'\s*\d+.*?(class |def |function |const |export )', line):
            definitions.append(line.strip())

    if definitions:
        return f"Read {file_path}: Contains {', '.join(definitions[:5])}"

    return f"Read {file_path}: {len(lines)} lines"


def _extract_file_created(tool_input: dict, output: str) -> Optional[str]:
    """Extract file creation observation."""
    file_path = tool_input.get("file_path", "")
    content = tool_input.get("content", "")

    if not file_path:
        return None

    # Summarize what was created
    lines = content.split("\n")
    preview = content[:200] if len(content) > 200 else content

    return f"Created {file_path} ({len(lines)} lines): {preview}..."


def _extract_code_change(tool_input: dict, output: str) -> Optional[str]:
    """Extract code edit observation."""
    file_path = tool_input.get("file_path", "")
    old_string = tool_input.get("old_string", "")
    new_string = tool_input.get("new_string", "")

    if not file_path:
        return None

    # Describe the change
    old_preview = old_string[:50] if len(old_string) > 50 else old_string
    new_preview = new_string[:50] if len(new_string) > 50 else new_string

    return f"Edited {file_path}: Changed '{old_preview}' to '{new_preview}'"


def _extract_command_output(tool_input: dict, output: str) -> Optional[str]:
    """Extract command execution observation."""
    command = tool_input.get("command", "")

    # Skip noisy commands
    skip_patterns = ["ls", "pwd", "echo", "cd"]
    if any(command.strip().startswith(p) for p in skip_patterns):
        return None

    # Extract meaningful output
    output_lines = output.strip().split("\n")
    if len(output_lines) > 5:
        summary = "\n".join(output_lines[:3]) + f"\n... ({len(output_lines)} lines)"
    else:
        summary = output[:300]

    return f"Ran `{command[:100]}`: {summary}"


def _extract_search_results(tool_input: dict, output: str) -> Optional[str]:
    """Extract search results observation."""
    pattern = tool_input.get("pattern", "")
    path = tool_input.get("path", ".")

    # Count matches
    matches = output.strip().split("\n") if output.strip() else []

    if len(matches) == 0:
        return None

    return f"Searched '{pattern}' in {path}: Found {len(matches)} matches"


def _extract_file_list(tool_input: dict, output: str) -> Optional[str]:
    """Extract file listing observation."""
    pattern = tool_input.get("pattern", "*")

    files = output.strip().split("\n") if output.strip() else []

    if len(files) <= 3:
        return None  # Too few to be memorable

    return f"Found {len(files)} files matching '{pattern}'"
```

### 6. Implement Stop Hook (Session Summary)

```python
#!/usr/bin/env python3
"""
Stop hook: Summarize the session and update memory caches.

Input (stdin): JSON with session data, transcript summary
Output (stdout): JSON acknowledgment
"""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from memory_manager import ThreeTierMemoryManager, get_memory_root


def main():
    input_data = json.loads(sys.stdin.read())

    session_id = input_data.get("sessionId", "unknown")
    transcript = input_data.get("transcript", [])
    stop_reason = input_data.get("stopReason", "user")

    memory = ThreeTierMemoryManager(get_memory_root())

    # Generate session summary
    summary = generate_session_summary(transcript)

    # Update hot memory with session summary
    if summary:
        memory.hot.add_session_summary(
            summary=summary,
            session_id=session_id,
            stop_reason=stop_reason
        )

    # Archive to cold if significant session
    if is_significant_session(transcript):
        memory.cold.archive(
            content=format_for_archive(transcript, summary),
            source=f"session:{session_id}"
        )

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "Stop",
            "summarized": bool(summary),
            "archived": is_significant_session(transcript)
        }
    }))


def generate_session_summary(transcript: list) -> str:
    """Generate a concise summary of the session."""
    if not transcript:
        return ""

    # Extract key actions
    actions = []
    files_modified = set()
    commands_run = []

    for entry in transcript:
        if entry.get("type") == "tool_use":
            tool = entry.get("tool", "")
            if tool in ["Write", "Edit"]:
                path = entry.get("input", {}).get("file_path", "")
                if path:
                    files_modified.add(path)
            elif tool == "Bash":
                cmd = entry.get("input", {}).get("command", "")
                if cmd and not cmd.startswith(("ls", "pwd", "cd")):
                    commands_run.append(cmd[:50])

    summary_parts = []

    if files_modified:
        summary_parts.append(f"Modified: {', '.join(list(files_modified)[:5])}")

    if commands_run:
        summary_parts.append(f"Commands: {'; '.join(commands_run[:3])}")

    return " | ".join(summary_parts) if summary_parts else "Conversation session"


def is_significant_session(transcript: list) -> bool:
    """Determine if session is worth archiving."""
    if not transcript:
        return False

    # Count meaningful tool uses
    tool_uses = sum(1 for e in transcript if e.get("type") == "tool_use")

    # Archive if session had substantial activity
    return tool_uses >= 3


def format_for_archive(transcript: list, summary: str) -> str:
    """Format session for cold archive."""
    lines = [
        f"Session Summary: {summary}",
        f"Timestamp: {datetime.now().isoformat()}",
        "---",
    ]

    for entry in transcript:
        if entry.get("type") == "user":
            lines.append(f"User: {entry.get('content', '')[:200]}")
        elif entry.get("type") == "assistant":
            lines.append(f"Assistant: {entry.get('content', '')[:200]}")

    return "\n".join(lines)


if __name__ == "__main__":
    main()
```

### 7. Implement PreCompact Hook (Emergency Archive)

```python
#!/usr/bin/env python3
"""
PreCompact hook: Archive context before it's compacted/lost.

This hook fires when Claude Code is about to compact the conversation
context, which could result in losing valuable information.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from memory_manager import ThreeTierMemoryManager, get_memory_root


def main():
    input_data = json.loads(sys.stdin.read())

    context_to_compact = input_data.get("contextToCompact", "")
    session_id = input_data.get("sessionId", "unknown")
    compact_reason = input_data.get("reason", "token_limit")

    memory = ThreeTierMemoryManager(get_memory_root())

    # Extract key information before compaction
    extracted = extract_key_information(context_to_compact)

    # Store in warm memory for near-term retrieval
    for item in extracted:
        embedding = memory._get_embedding(item["content"])
        memory.warm.store(
            content=item["content"],
            embedding=embedding,
            importance=item["importance"],
            metadata={
                "source": "precompact",
                "session_id": session_id,
                "compact_reason": compact_reason
            }
        )

    # Archive full context to cold storage
    memory.cold.archive(
        content=f"[PreCompact Archive]\n{context_to_compact}",
        source=f"precompact:{session_id}"
    )

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreCompact",
            "items_preserved": len(extracted)
        }
    }))


def extract_key_information(context: str) -> list:
    """Extract key information from context before compaction."""
    extracted = []

    # Extract file modifications
    import re
    file_pattern = r'(?:Created|Edited|Modified)\s+([/\w.-]+)'
    for match in re.finditer(file_pattern, context):
        extracted.append({
            "content": f"File operation: {match.group(0)}",
            "importance": 0.7
        })

    # Extract code blocks
    code_blocks = re.findall(r'```\w*\n(.*?)```', context, re.DOTALL)
    for block in code_blocks[:5]:  # Limit to 5 blocks
        if len(block) > 50:  # Skip trivial blocks
            extracted.append({
                "content": f"Code: {block[:500]}",
                "importance": 0.6
            })

    # Extract decisions/conclusions
    decision_patterns = [
        r'(?:decided|choosing|going with|the solution is)\s+(.+?)(?:\.|$)',
        r'(?:the issue was|problem was|root cause)\s+(.+?)(?:\.|$)'
    ]
    for pattern in decision_patterns:
        for match in re.finditer(pattern, context, re.IGNORECASE):
            extracted.append({
                "content": f"Decision: {match.group(0)}",
                "importance": 0.8
            })

    return extracted


if __name__ == "__main__":
    main()
```

## When to Use This Pattern

Use hook integration when:

- **Building a persistent memory system** for Claude Code
- **Automatic context continuity** is desired across sessions
- **You need to capture tool outputs** for future reference
- **Session summaries** help with long-running projects
- **Emergency archival** is needed before context loss

Avoid when:

- Memory is purely user-controlled (no automation)
- Hook latency is a concern (each hook adds ~10-50ms)
- Simpler skill-based retrieval is sufficient

## Trade-offs and Considerations

### Latency Impact

| Hook | Typical Latency | Impact |
|------|-----------------|--------|
| UserPromptSubmit | 20-50ms | Before prompt processing |
| PostToolUse | 10-30ms | After each tool (cumulative) |
| Stop | 50-100ms | At session end (not blocking) |
| PreCompact | 100-200ms | Before compaction (critical) |

### Error Handling

Hooks should fail gracefully to avoid blocking the main flow:

```python
def safe_hook_execution(func):
    """Decorator for safe hook execution."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            # Log error but don't block
            log_error(f"Hook error: {e}")
            return {"hookSpecificOutput": {"error": str(e)}}
    return wrapper
```

### Memory Pressure

Monitor hook memory usage to prevent runaway growth:

```python
def check_hook_health() -> dict:
    """Check memory system health."""
    memory_root = get_memory_root()

    warm_db = memory_root / "warm.db"
    cold_index = memory_root / "cold_fts.db"

    return {
        "warm_size_mb": warm_db.stat().st_size / 1_000_000 if warm_db.exists() else 0,
        "cold_size_mb": cold_index.stat().st_size / 1_000_000 if cold_index.exists() else 0,
        "status": "healthy"  # Add checks as needed
    }
```

### Selective Capture

Configure which tools trigger observation capture:

```yaml
observation_config:
  # High-value tools (always capture)
  always_capture:
    - Write
    - Edit

  # Medium-value (capture if significant output)
  conditional_capture:
    - Bash
    - Grep
    min_output_length: 100

  # Low-value (skip by default)
  skip:
    - Glob
    - Read  # Too noisy for large files
```
