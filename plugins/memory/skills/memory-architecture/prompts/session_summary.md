# Session Summary Prompt Template

## Purpose

Template for the Stop hook that generates a comprehensive session summary when Claude stops responding. This summary captures the essence of the work done, decisions made, and context that should persist for future sessions. The summary serves both immediate archival and future retrieval needs.

## Hook Event

**Stop** - Fires when Claude completes a response cycle (user stops, task completes, or session ends). Provides access to the conversation transcript for summarization.

## Template Variables

```yaml
# Summary Configuration
SUMMARY_TYPE: "comprehensive"  # comprehensive | brief | structured
MAX_SUMMARY_TOKENS: 500
INCLUDE_DECISIONS: true
INCLUDE_FILES_MODIFIED: true
INCLUDE_COMMANDS_RUN: true
INCLUDE_OPEN_QUESTIONS: true

# Archival Settings
ARCHIVE_TO_WARM: true
ARCHIVE_TO_COLD: true
MIN_EVENTS_TO_ARCHIVE: 3
```

## Summary Schema

```yaml
session_summary:
  session_id: string
  timestamp: string
  duration_minutes: int
  stop_reason: string  # user | completion | error | timeout

  # Core summary
  headline: string     # One-line description
  narrative: string    # 2-3 sentence summary

  # Work artifacts
  files_modified:
    - path: string
      action: created | edited | deleted
      description: string
  commands_executed:
    - command: string
      purpose: string
      outcome: success | failure

  # Knowledge capture
  decisions_made:
    - decision: string
      reasoning: string
      alternatives_considered: list
  problems_solved:
    - problem: string
      solution: string
  open_questions:
    - question: string
      context: string

  # Continuity hints
  next_steps:
    - action: string
      priority: high | medium | low
  blockers:
    - blocker: string
      mitigation: string

  # Metadata
  key_entities: list
  topics: list
  importance: float
```

## Summary Templates

### Comprehensive Summary

Full session capture for important work sessions:

```markdown
# Session Summary: {{session_id}}

**Duration**: {{duration_minutes}} minutes
**Ended**: {{stop_reason}}

## Headline
{{headline}}

## What We Accomplished
{{narrative}}

### Files Modified
{{#each files_modified}}
- **{{action}}**: `{{path}}`
  {{description}}
{{/each}}

### Commands Executed
{{#each commands_executed}}
- `{{command}}`
  Purpose: {{purpose}} | Outcome: {{outcome}}
{{/each}}

## Decisions Made
{{#each decisions_made}}
### {{decision}}
- **Reasoning**: {{reasoning}}
{{#if alternatives_considered}}
- **Alternatives considered**: {{alternatives_considered}}
{{/if}}
{{/each}}

## Problems Solved
{{#each problems_solved}}
- **Problem**: {{problem}}
  **Solution**: {{solution}}
{{/each}}

## Open Questions
{{#each open_questions}}
- {{question}}
  *Context*: {{context}}
{{/each}}

## Next Steps
{{#each next_steps}}
- [{{priority}}] {{action}}
{{/each}}

---
**Topics**: {{topics}}
**Key Entities**: {{key_entities}}
**Session Importance**: {{importance}}
```

### Brief Summary

Minimal summary for quick sessions:

```markdown
**Session {{session_id}}** ({{duration_minutes}}m)
{{headline}}

Modified: {{files_modified_list}}
{{#if decisions_made}}Key decision: {{first_decision}}{{/if}}
{{#if next_steps}}Next: {{first_next_step}}{{/if}}
```

### Structured Summary

Machine-parseable format:

```json
{
  "session_id": "{{session_id}}",
  "timestamp": "{{timestamp}}",
  "duration_minutes": {{duration_minutes}},
  "headline": "{{headline}}",
  "files_modified": [
    {"path": "{{path}}", "action": "{{action}}"}
  ],
  "decisions": ["{{decision}}"],
  "next_steps": ["{{next_step}}"],
  "topics": ["{{topic}}"],
  "importance": {{importance}}
}
```

## Summary Generation Logic

### Transcript Analysis

```python
from typing import List, Dict, Optional
from dataclasses import dataclass, field


@dataclass
class TranscriptAnalysis:
    """Analysis of conversation transcript."""
    user_messages: List[str] = field(default_factory=list)
    assistant_responses: List[str] = field(default_factory=list)
    tool_uses: List[Dict] = field(default_factory=list)
    files_read: List[str] = field(default_factory=list)
    files_written: List[str] = field(default_factory=list)
    files_edited: List[str] = field(default_factory=list)
    commands_run: List[Dict] = field(default_factory=list)
    errors_encountered: List[str] = field(default_factory=list)


class TranscriptAnalyzer:
    """Analyze conversation transcript for summary generation."""

    def analyze(self, transcript: List[Dict]) -> TranscriptAnalysis:
        """Extract structured information from transcript."""
        analysis = TranscriptAnalysis()

        for entry in transcript:
            entry_type = entry.get("type", "")

            if entry_type == "user":
                analysis.user_messages.append(entry.get("content", ""))

            elif entry_type == "assistant":
                analysis.assistant_responses.append(entry.get("content", ""))

            elif entry_type == "tool_use":
                tool = entry.get("tool", "")
                tool_input = entry.get("input", {})
                tool_output = entry.get("output", "")

                analysis.tool_uses.append({
                    "tool": tool,
                    "input": tool_input,
                    "output": tool_output[:500]  # Truncate long outputs
                })

                # Categorize by tool type
                if tool == "Read":
                    path = tool_input.get("file_path", "")
                    if path:
                        analysis.files_read.append(path)

                elif tool == "Write":
                    path = tool_input.get("file_path", "")
                    if path:
                        analysis.files_written.append(path)

                elif tool == "Edit":
                    path = tool_input.get("file_path", "")
                    if path:
                        analysis.files_edited.append(path)

                elif tool == "Bash":
                    command = tool_input.get("command", "")
                    analysis.commands_run.append({
                        "command": command,
                        "output": tool_output[:200],
                        "success": "error" not in tool_output.lower()
                    })

                # Check for errors
                if "error" in tool_output.lower():
                    analysis.errors_encountered.append(f"{tool}: {tool_output[:100]}")

        return analysis
```

### Summary Generator

```python
class SessionSummaryGenerator:
    """Generate session summaries from transcript analysis."""

    def __init__(self, summary_type: str = "comprehensive"):
        self.summary_type = summary_type

    def generate(self, analysis: TranscriptAnalysis,
                 session_metadata: Dict) -> Dict:
        """Generate session summary from analysis."""

        summary = {
            "session_id": session_metadata.get("session_id", "unknown"),
            "timestamp": session_metadata.get("timestamp"),
            "duration_minutes": session_metadata.get("duration_minutes", 0),
            "stop_reason": session_metadata.get("stop_reason", "unknown")
        }

        # Generate headline
        summary["headline"] = self._generate_headline(analysis)

        # Generate narrative
        summary["narrative"] = self._generate_narrative(analysis)

        # Extract file modifications
        summary["files_modified"] = self._extract_file_modifications(analysis)

        # Extract command executions
        summary["commands_executed"] = self._extract_commands(analysis)

        # Extract decisions (from assistant responses)
        summary["decisions_made"] = self._extract_decisions(analysis)

        # Extract open questions (from user messages)
        summary["open_questions"] = self._extract_open_questions(analysis)

        # Suggest next steps
        summary["next_steps"] = self._suggest_next_steps(analysis)

        # Extract entities and topics
        summary["key_entities"] = self._extract_entities(analysis)
        summary["topics"] = self._extract_topics(analysis)

        # Calculate importance
        summary["importance"] = self._calculate_importance(analysis)

        return summary

    def _generate_headline(self, analysis: TranscriptAnalysis) -> str:
        """Generate one-line headline for the session."""
        parts = []

        if analysis.files_written:
            parts.append(f"Created {len(analysis.files_written)} files")

        if analysis.files_edited:
            parts.append(f"Edited {len(analysis.files_edited)} files")

        if analysis.commands_run:
            successful = sum(1 for c in analysis.commands_run if c.get("success"))
            parts.append(f"Ran {successful} commands")

        if not parts:
            # Fallback to first user message
            if analysis.user_messages:
                return analysis.user_messages[0][:80]
            return "Session completed"

        return "; ".join(parts)

    def _generate_narrative(self, analysis: TranscriptAnalysis) -> str:
        """Generate 2-3 sentence narrative summary."""
        sentences = []

        # What was the main ask?
        if analysis.user_messages:
            first_ask = analysis.user_messages[0][:100]
            sentences.append(f"The session focused on: {first_ask}")

        # What was accomplished?
        accomplishments = []
        if analysis.files_written:
            accomplishments.append(f"created {', '.join(analysis.files_written[-3:])}")
        if analysis.files_edited:
            accomplishments.append(f"modified {', '.join(analysis.files_edited[-3:])}")

        if accomplishments:
            sentences.append(f"Accomplished: {'; '.join(accomplishments)}.")

        # Any issues?
        if analysis.errors_encountered:
            sentences.append(f"Encountered {len(analysis.errors_encountered)} errors during execution.")

        return " ".join(sentences)

    def _extract_file_modifications(self, analysis: TranscriptAnalysis) -> List[Dict]:
        """Extract file modifications with descriptions."""
        modifications = []

        for path in analysis.files_written:
            modifications.append({
                "path": path,
                "action": "created",
                "description": self._describe_file_action("created", path, analysis)
            })

        for path in analysis.files_edited:
            modifications.append({
                "path": path,
                "action": "edited",
                "description": self._describe_file_action("edited", path, analysis)
            })

        return modifications

    def _describe_file_action(self, action: str, path: str,
                              analysis: TranscriptAnalysis) -> str:
        """Generate description for file action."""
        # Find relevant tool use
        for tool_use in analysis.tool_uses:
            if tool_use.get("input", {}).get("file_path") == path:
                if action == "created":
                    content = tool_use.get("input", {}).get("content", "")
                    lines = len(content.split("\n"))
                    return f"New file with {lines} lines"
                elif action == "edited":
                    old = tool_use.get("input", {}).get("old_string", "")[:30]
                    new = tool_use.get("input", {}).get("new_string", "")[:30]
                    return f"Changed '{old}...' to '{new}...'"
        return action.capitalize()

    def _extract_commands(self, analysis: TranscriptAnalysis) -> List[Dict]:
        """Extract significant command executions."""
        commands = []

        for cmd in analysis.commands_run:
            command_str = cmd.get("command", "")

            # Skip trivial commands
            if any(command_str.strip().startswith(p)
                   for p in ["ls", "pwd", "cd", "echo"]):
                continue

            commands.append({
                "command": command_str[:100],
                "purpose": self._infer_command_purpose(command_str),
                "outcome": "success" if cmd.get("success") else "failure"
            })

        return commands[:10]  # Limit to 10 commands

    def _infer_command_purpose(self, command: str) -> str:
        """Infer purpose of a command."""
        purpose_patterns = {
            "npm install": "Install dependencies",
            "npm run": "Run script",
            "git ": "Version control",
            "pytest": "Run tests",
            "npm test": "Run tests",
            "docker": "Container operation",
            "make": "Build project",
            "pip install": "Install Python package"
        }

        for pattern, purpose in purpose_patterns.items():
            if pattern in command:
                return purpose

        return "Execute command"

    def _extract_decisions(self, analysis: TranscriptAnalysis) -> List[Dict]:
        """Extract decisions from assistant responses."""
        decisions = []

        decision_keywords = [
            "decided to", "choosing", "going with",
            "the solution is", "will use", "implementing"
        ]

        for response in analysis.assistant_responses:
            for keyword in decision_keywords:
                if keyword in response.lower():
                    # Extract sentence containing decision
                    sentences = response.split(".")
                    for sentence in sentences:
                        if keyword in sentence.lower():
                            decisions.append({
                                "decision": sentence.strip()[:200],
                                "reasoning": "Based on conversation context"
                            })
                            break
                    break

        return decisions[:5]  # Limit to 5 decisions

    def _extract_open_questions(self, analysis: TranscriptAnalysis) -> List[Dict]:
        """Extract unanswered questions from user messages."""
        questions = []

        for msg in analysis.user_messages[-3:]:  # Last 3 messages
            if "?" in msg:
                questions.append({
                    "question": msg[:200],
                    "context": "From user message"
                })

        return questions

    def _suggest_next_steps(self, analysis: TranscriptAnalysis) -> List[Dict]:
        """Suggest next steps based on session activity."""
        next_steps = []

        # If tests weren't run
        test_commands = [c for c in analysis.commands_run
                         if "test" in c.get("command", "")]
        if analysis.files_edited and not test_commands:
            next_steps.append({
                "action": "Run tests to verify changes",
                "priority": "high"
            })

        # If there were errors
        if analysis.errors_encountered:
            next_steps.append({
                "action": "Address errors from previous commands",
                "priority": "high"
            })

        # If files were created
        if analysis.files_written:
            next_steps.append({
                "action": "Review and test new files",
                "priority": "medium"
            })

        return next_steps

    def _extract_entities(self, analysis: TranscriptAnalysis) -> List[str]:
        """Extract key entities mentioned in session."""
        entities = set()

        # Add file paths
        entities.update(analysis.files_written[:5])
        entities.update(analysis.files_edited[:5])

        return list(entities)[:10]

    def _extract_topics(self, analysis: TranscriptAnalysis) -> List[str]:
        """Extract topics/themes from session."""
        topics = set()

        # Infer from file paths
        for path in analysis.files_written + analysis.files_edited:
            if "auth" in path.lower():
                topics.add("authentication")
            if "test" in path.lower():
                topics.add("testing")
            if "config" in path.lower():
                topics.add("configuration")

        # Infer from commands
        for cmd in analysis.commands_run:
            command = cmd.get("command", "")
            if "docker" in command:
                topics.add("containers")
            if "git" in command:
                topics.add("version-control")

        return list(topics)

    def _calculate_importance(self, analysis: TranscriptAnalysis) -> float:
        """Calculate session importance score."""
        score = 0.0

        # File modifications are important
        score += len(analysis.files_written) * 0.15
        score += len(analysis.files_edited) * 0.1

        # Commands add importance
        score += len(analysis.commands_run) * 0.05

        # Errors reduce importance (might be exploratory)
        score -= len(analysis.errors_encountered) * 0.05

        return min(1.0, max(0.0, score))
```

## Archival Logic

```python
def should_archive(summary: Dict) -> bool:
    """Determine if session should be archived."""
    # Always archive if files were modified
    if summary.get("files_modified"):
        return True

    # Archive if decisions were made
    if summary.get("decisions_made"):
        return True

    # Archive if importance is high enough
    if summary.get("importance", 0) >= 0.3:
        return True

    # Skip trivial sessions
    return False
```

## Usage Example

Complete hook implementation:

```python
#!/usr/bin/env python3
"""Stop hook for session summary generation."""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from summary_generator import TranscriptAnalyzer, SessionSummaryGenerator
from memory_manager import ThreeTierMemoryManager, get_memory_root


def main():
    input_data = json.loads(sys.stdin.read())

    session_id = input_data.get("sessionId", "unknown")
    transcript = input_data.get("transcript", [])
    stop_reason = input_data.get("stopReason", "user")

    # Analyze transcript
    analyzer = TranscriptAnalyzer()
    analysis = analyzer.analyze(transcript)

    # Generate summary
    generator = SessionSummaryGenerator(summary_type="comprehensive")
    summary = generator.generate(analysis, {
        "session_id": session_id,
        "timestamp": datetime.now().isoformat(),
        "stop_reason": stop_reason
    })

    # Archive to memory
    memory = ThreeTierMemoryManager(get_memory_root())

    # Add to hot memory cache
    memory.hot.add_session_summary(
        summary=summary["headline"],
        session_id=session_id
    )

    # Archive to cold if significant
    if should_archive(summary):
        memory.cold.archive(
            content=format_for_archive(summary),
            source=f"session:{session_id}"
        )

    output = {
        "hookSpecificOutput": {
            "hookEventName": "Stop",
            "summary_generated": True,
            "headline": summary["headline"],
            "archived": should_archive(summary)
        }
    }
    print(json.dumps(output))


def format_for_archive(summary: Dict) -> str:
    """Format summary for cold archive."""
    lines = [
        f"# Session: {summary['session_id']}",
        f"**{summary['headline']}**",
        "",
        summary.get("narrative", ""),
        "",
        "## Files Modified"
    ]

    for f in summary.get("files_modified", []):
        lines.append(f"- {f['action']}: {f['path']}")

    if summary.get("decisions_made"):
        lines.append("\n## Decisions")
        for d in summary["decisions_made"]:
            lines.append(f"- {d['decision']}")

    return "\n".join(lines)


if __name__ == "__main__":
    main()
```
