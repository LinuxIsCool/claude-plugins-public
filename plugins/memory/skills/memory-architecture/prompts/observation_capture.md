# Observation Capture Prompt Template

## Purpose

Template for the PostToolUse hook that captures meaningful observations from tool executions. Observations are distilled summaries of tool activity that form the basis for future memory retrieval. This template defines extraction patterns for different tool types.

## Hook Event

**PostToolUse** - Fires after each tool execution completes, providing tool name, input, and output for observation extraction.

## Template Variables

```yaml
# Capture Configuration
OBSERVE_TOOLS:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - WebFetch

# Importance Weights
TOOL_IMPORTANCE:
  Write: 0.8
  Edit: 0.8
  Bash: 0.7
  Read: 0.6
  Grep: 0.5
  Glob: 0.4
  WebFetch: 0.6

# Extraction Limits
MAX_CONTENT_LENGTH: 500
MAX_ENTITIES: 10
MIN_OUTPUT_LENGTH: 50  # Skip trivial outputs
```

## Observation Schema

```yaml
observation:
  type: string  # file_operation | command_execution | search_result
  tool: string  # Original tool name
  summary: string  # One-line description
  content: string  # Extracted meaningful content
  entities:
    - type: file | function | class | variable | command
      name: string
      context: string
  importance: float  # 0.0 - 1.0
  timestamp: string  # ISO format
  metadata:
    session_id: string
    tool_input: object
    output_length: int
```

## Extraction Templates by Tool

### Read Tool

**Pattern**: File content analysis

```yaml
observation_template:
  type: file_operation
  summary: "Read {{file_path}}: {{content_type}}"
  content_extraction:
    - pattern: "(class|def|function|const|export)\\s+\\w+"
      type: definitions
      max_items: 10
    - pattern: "^#+ .*$"
      type: headings
      max_items: 5
    - pattern: "TODO|FIXME|HACK|XXX"
      type: markers
  entity_extraction:
    - file_path
    - definitions found
    - imports/dependencies
```

**Example Output**:

```markdown
**Observation: Read File**
- Path: src/auth/jwt.ts
- Type: TypeScript module
- Definitions: JwtService (class), validateToken (function), refreshToken (function)
- Key imports: jsonwebtoken, crypto
- Lines: 142
```

### Write Tool

**Pattern**: File creation capture

```yaml
observation_template:
  type: file_operation
  summary: "Created {{file_path}} ({{line_count}} lines)"
  content_extraction:
    - first_lines: 5  # Capture file header
    - exports: true   # Capture exported items
    - type_signature: true  # For typed languages
  entity_extraction:
    - file_path
    - exported_names
    - dependencies
```

**Example Output**:

```markdown
**Observation: File Created**
- Path: src/services/notification.ts
- Lines: 87
- Exports: NotificationService, NotificationType, sendNotification
- Purpose: Push notification service with Firebase integration
```

### Edit Tool

**Pattern**: Code change tracking

```yaml
observation_template:
  type: file_operation
  summary: "Edited {{file_path}}: {{change_description}}"
  content_extraction:
    - old_context: 2 lines  # Lines around old_string
    - new_content: full    # Capture new_string
    - change_type: infer   # add | modify | delete | refactor
  entity_extraction:
    - file_path
    - function_context  # What function was edited
    - symbols_changed
```

**Example Output**:

```markdown
**Observation: Code Edit**
- Path: src/auth/jwt.ts
- Function: validateToken
- Change: Added token expiry validation
- Before: `return decoded`
- After: `if (decoded.exp < Date.now() / 1000) throw new TokenExpiredError(); return decoded`
```

### Bash Tool

**Pattern**: Command execution results

```yaml
observation_template:
  type: command_execution
  summary: "Ran: {{command_preview}}"
  content_extraction:
    - exit_code: true
    - stdout_summary: 100 chars
    - stderr_if_error: true
    - command_type: infer  # build | test | git | npm | docker | other
  skip_commands:
    - ls
    - pwd
    - cd
    - echo
    - cat  # Use Read instead
  entity_extraction:
    - command_name
    - affected_files
    - package_names
```

**Example Output**:

```markdown
**Observation: Command Execution**
- Command: npm run test -- --coverage
- Type: test
- Exit: 0
- Result: 47 tests passed, 2 skipped
- Coverage: 78% statements
```

### Grep Tool

**Pattern**: Search result analysis

```yaml
observation_template:
  type: search_result
  summary: "Searched '{{pattern}}': {{match_count}} matches"
  content_extraction:
    - match_count: true
    - file_distribution: true
    - sample_matches: 3
  skip_if:
    - match_count < 1
    - match_count > 100  # Too broad
  entity_extraction:
    - pattern
    - matched_files
    - matched_symbols
```

**Example Output**:

```markdown
**Observation: Code Search**
- Pattern: `validateToken`
- Matches: 7 across 4 files
- Files: jwt.ts (3), middleware.ts (2), auth.test.ts (2)
- Context: Function calls to JWT validation
```

### Glob Tool

**Pattern**: File discovery

```yaml
observation_template:
  type: search_result
  summary: "Found {{count}} files matching '{{pattern}}'"
  content_extraction:
    - file_count: true
    - directory_distribution: true
    - file_types: true
  skip_if:
    - file_count < 3  # Too few to be interesting
  entity_extraction:
    - pattern
    - directories
    - file_extensions
```

**Example Output**:

```markdown
**Observation: File Discovery**
- Pattern: src/**/*.test.ts
- Found: 23 files
- Directories: auth (8), services (10), utils (5)
```

### WebFetch Tool

**Pattern**: Web content retrieval

```yaml
observation_template:
  type: web_retrieval
  summary: "Fetched {{url_domain}}: {{topic}}"
  content_extraction:
    - title: true
    - main_headings: 5
    - key_points: 3
  entity_extraction:
    - url
    - domain
    - technologies_mentioned
    - version_numbers
```

**Example Output**:

```markdown
**Observation: Web Fetch**
- URL: docs.github.com/en/actions/...
- Topic: GitHub Actions workflow syntax
- Key points: workflow triggers, job definitions, action references
```

## Filtering Logic

Decide when to capture vs. skip:

```python
def should_capture(tool_name: str, tool_input: dict,
                   tool_output: str) -> bool:
    """Determine if tool execution should be captured."""

    # Skip trivial tools
    if tool_name in ["Glob"] and len(tool_output.split("\n")) < 3:
        return False

    # Skip noisy bash commands
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        skip_prefixes = ["ls", "pwd", "cd", "echo", "cat", "head", "tail"]
        if any(command.strip().startswith(p) for p in skip_prefixes):
            return False

    # Skip empty outputs
    if len(tool_output.strip()) < 50:
        return False

    # Skip failed reads (file not found)
    if tool_name == "Read" and "Error" in tool_output:
        return False

    return True
```

## Importance Calculation

```python
def calculate_importance(tool_name: str, tool_input: dict,
                         tool_output: str) -> float:
    """Calculate observation importance score."""

    base_importance = {
        "Write": 0.8,
        "Edit": 0.8,
        "Bash": 0.7,
        "Read": 0.6,
        "WebFetch": 0.6,
        "Grep": 0.5,
        "Glob": 0.4
    }.get(tool_name, 0.5)

    # Boost for significant operations
    if tool_name in ["Write", "Edit"]:
        file_path = tool_input.get("file_path", "")
        # Boost for config/important files
        if any(p in file_path for p in ["config", "package.json", ".env"]):
            base_importance = min(1.0, base_importance + 0.1)

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        # Boost for build/deploy commands
        if any(c in command for c in ["build", "deploy", "migrate", "test"]):
            base_importance = min(1.0, base_importance + 0.1)

    return base_importance
```

## Output Template

Hook script output format:

```python
def format_hook_output(observation: dict, captured: bool) -> dict:
    """Format output for PostToolUse hook."""

    return {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "observation": observation if captured else None,
            "captured": captured,
            "skip_reason": None if captured else "filtered"
        }
    }
```

## Usage Example

Complete hook implementation:

```python
#!/usr/bin/env python3
"""PostToolUse hook for observation capture."""

import json
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from observation_extractor import ObservationExtractor
from memory_manager import ThreeTierMemoryManager, get_memory_root


def main():
    # Parse input
    input_data = json.loads(sys.stdin.read())

    tool_name = input_data.get("toolName", "")
    tool_input = input_data.get("toolInput", {})
    tool_output = input_data.get("toolOutput", "")
    session_id = input_data.get("sessionId", "unknown")

    # Initialize extractor
    extractor = ObservationExtractor()

    # Check if we should capture
    if not extractor.should_capture(tool_name, tool_input, tool_output):
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "captured": False,
                "reason": "filtered"
            }
        }
        print(json.dumps(output))
        return

    # Extract observation
    observation = extractor.extract(tool_name, tool_input, tool_output)
    observation["session_id"] = session_id
    observation["timestamp"] = datetime.now().isoformat()

    # Store in memory
    memory = ThreeTierMemoryManager(get_memory_root())
    memory.capture_observation(
        content=observation["summary"],
        importance=observation["importance"],
        source=f"tool:{tool_name}",
        metadata=observation
    )

    # Return acknowledgment
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "captured": True,
            "observation_summary": observation["summary"]
        }
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
```

## Entity Extraction Patterns

Common patterns for extracting entities from tool outputs:

```python
ENTITY_PATTERNS = {
    "file_path": r'[\w/.-]+\.(py|ts|js|tsx|jsx|md|json|yaml|yml|toml|sql)',
    "function_def": r'(?:def|function|const|let|var)\s+(\w+)',
    "class_def": r'class\s+(\w+)',
    "import": r'(?:from|import)\s+([\w.]+)',
    "command": r'^[\w-]+(?=\s)',
    "version": r'v?\d+\.\d+(?:\.\d+)?',
    "url": r'https?://[\w./%-]+',
}
```
