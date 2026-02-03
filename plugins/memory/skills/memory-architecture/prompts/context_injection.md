# Context Injection Prompt Template

## Purpose

Template for the UserPromptSubmit hook that injects memory context before Claude processes a user prompt. This template defines how retrieved memories are formatted and presented to maximize utility while minimizing context pollution.

## Hook Event

**UserPromptSubmit** - Fires before Claude sees the user's prompt, allowing context injection via `additionalContext` field.

## Template Variables

```yaml
# Memory Sources
HOT_MEMORY: "Recent session context (last 24h)"
WARM_MEMORY: "Relevant past context (1-7 days)"
COLD_MEMORY: "Explicitly retrieved history"

# Format Options
INJECTION_FORMAT: "structured"  # structured | minimal | verbose
MAX_TOKENS: 1000
INCLUDE_SCORES: true
INCLUDE_SOURCES: true

# Presentation
HEADER: "[MEMORY CONTEXT]"
FOOTER: "[END MEMORY]"
SECTION_SEPARATOR: "\n---\n"
```

## Base Template

```
<fill_in_memory_context>
[MEMORY CONTEXT]

## Session Context (Hot Memory)
<hot_memory_section>
- [{{age}}] {{summary}}
  {{#if entities}}Entities: {{entities}}{{/if}}
</hot_memory_section>

## Related Context (Warm Memory)
<warm_memory_section>
{{#each warm_results}}
### [Score: {{score}}]
{{content_preview}}
{{#if metadata}}Source: {{metadata.source}}{{/if}}
{{/each}}
</warm_memory_section>

{{#if cold_results}}
## Historical Context (Cold Memory)
<cold_memory_section>
{{#each cold_results}}
- [{{timestamp}}] {{content_preview}}
{{/each}}
</cold_memory_section>
{{/if}}

[END MEMORY]
</fill_in_memory_context>
```

## Structured Format (Default)

Use when the model benefits from clear organization:

```markdown
[MEMORY CONTEXT]

## Recent Activity (This Session)
- [5m ago] Edited authentication module - added JWT refresh logic
  Files: src/auth/jwt.ts, src/auth/middleware.ts
- [12m ago] Discussed database schema for user preferences
  Entities: UserPreferences, SettingsStore

## Related Past Work (Score > 0.5)
### Memory 1 [Score: 0.72]
Last week we implemented the initial JWT authentication with
access tokens stored in HTTP-only cookies. The refresh token
logic was left as a TODO.
Source: session:abc123

### Memory 2 [Score: 0.58]
Decided to use Redis for session storage due to its atomic
operations and TTL support.
Source: tool:Write

---
*Memories injected: 2 hot, 2 warm | Token estimate: ~350*
[END MEMORY]
```

## Minimal Format

Use when token budget is constrained:

```markdown
[MEMORY]
Recent: JWT refresh logic (5m), DB schema discussion (12m)
Related: JWT auth impl (0.72), Redis session decision (0.58)
[/MEMORY]
```

## Verbose Format

Use when comprehensive context is needed:

```markdown
[MEMORY CONTEXT - COMPREHENSIVE]

## Session Status
- Session ID: abc123
- Duration: 47 minutes
- State: Active
- Events: 23

## Hot Memory (Last 24 Hours)

### Entry 1 (5 minutes ago)
**Summary**: Edited authentication module - added JWT refresh logic
**Files Modified**:
  - src/auth/jwt.ts
  - src/auth/middleware.ts
**Tools Used**: Read, Edit
**Importance**: 0.8

### Entry 2 (12 minutes ago)
**Summary**: Discussed database schema for user preferences
**Key Entities**: UserPreferences, SettingsStore, PostgreSQL
**Decision Made**: Use JSONB column for flexible preference storage
**Importance**: 0.7

## Warm Memory (Semantic Matches)

### Match 1 [Similarity: 0.72]
**Content**:
Last week we implemented the initial JWT authentication with
access tokens stored in HTTP-only cookies. The refresh token
logic was left as a TODO for security review.

Implementation details:
- Access token: 15 min TTL
- Cookie flags: HttpOnly, Secure, SameSite=Strict
- Signing: RS256 with rotating keys

**Metadata**:
- Timestamp: 2026-01-13T14:23:00
- Source: session:abc123
- Access Count: 3
- Last Accessed: 2026-01-15

### Match 2 [Similarity: 0.58]
**Content**:
Decided to use Redis for session storage due to its atomic
operations and TTL support. Considered alternatives:
- PostgreSQL: Too slow for session lookup
- Memory: Not persistent across restarts

**Metadata**:
- Timestamp: 2026-01-10T09:45:00
- Source: decision
- Importance: High

---
**Injection Statistics**:
- Hot memories: 2 of 5
- Warm memories: 2 of 4 candidates (threshold: 0.4)
- Cold memories: 0 (not triggered)
- Total tokens: ~650
- Query complexity: 0.65 (Detailed)

[END MEMORY CONTEXT]
```

## Conditional Injection Rules

Define when to inject each section:

```python
# Pseudocode for injection logic
def should_inject_hot(session_context):
    return len(session_context.hot_memory) > 0

def should_inject_warm(query, warm_results):
    # Only inject warm memory for complex queries
    triggers = [
        "?" in query,                          # Question
        len(query.split()) > 10,               # Complex
        any(temporal in query.lower()          # Temporal reference
            for temporal in ["yesterday", "last", "before"]),
        has_file_reference(query),             # File mentioned
    ]
    return any(triggers) and len(warm_results) > 0

def should_inject_cold(query):
    # Cold memory requires explicit trigger
    explicit_triggers = [
        "full history" in query.lower(),
        "what did we" in query.lower(),
        "search memory" in query.lower(),
    ]
    return any(explicit_triggers)
```

## Score Display Guidelines

When showing relevance scores:

| Score Range | Display | Interpretation |
|-------------|---------|----------------|
| 0.8 - 1.0 | High confidence | Direct match |
| 0.6 - 0.8 | Good match | Relevant context |
| 0.4 - 0.6 | Moderate | Possibly useful |
| < 0.4 | Don't display | Below threshold |

## Token Budget Management

```python
def allocate_token_budget(total_budget: int, query_complexity: float):
    """Allocate tokens across memory tiers."""

    # Base allocation
    hot_budget = int(total_budget * 0.3)   # 30% for hot
    warm_budget = int(total_budget * 0.5)  # 50% for warm
    cold_budget = int(total_budget * 0.2)  # 20% for cold

    # Adjust for complexity
    if query_complexity > 0.7:
        # Complex query needs more context
        warm_budget = int(total_budget * 0.6)
        hot_budget = int(total_budget * 0.25)
        cold_budget = int(total_budget * 0.15)
    elif query_complexity < 0.3:
        # Simple query needs less
        hot_budget = int(total_budget * 0.5)
        warm_budget = int(total_budget * 0.3)
        cold_budget = 0

    return {
        "hot": hot_budget,
        "warm": warm_budget,
        "cold": cold_budget
    }
```

## Error Handling Template

When memory retrieval fails:

```markdown
[MEMORY CONTEXT]

*Memory retrieval partially failed*
- Hot memory: Available (3 entries)
- Warm memory: Unavailable (embedding service timeout)
- Cold memory: Not queried

Proceeding with hot memory only.

## Recent Context
- [3m ago] Working on authentication module
- [15m ago] Discussed JWT implementation
- [22m ago] Read security documentation

[END MEMORY]
```

## Transparency Metadata

Always include injection metadata for debugging:

```markdown
[Memory: 2 hot, 2 warm (0.72, 0.58) | ~400 tokens | Level: standard]
```

Or in structured format:

```json
{
  "injection_metadata": {
    "hot_count": 2,
    "warm_count": 2,
    "warm_scores": [0.72, 0.58],
    "cold_count": 0,
    "token_estimate": 400,
    "disclosure_level": "standard",
    "query_complexity": 0.55,
    "latency_ms": 45
  }
}
```

## Usage Example

Complete hook implementation:

```python
#!/usr/bin/env python3
"""UserPromptSubmit hook for memory context injection."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
from memory_manager import ThreeTierMemoryManager, get_memory_root
from progressive_disclosure import ProgressiveDisclosureController


def main():
    # Parse input
    input_data = json.loads(sys.stdin.read())
    prompt = input_data.get("prompt", "")

    # Initialize memory system
    memory = ThreeTierMemoryManager(get_memory_root())
    disclosure = ProgressiveDisclosureController(memory)

    # Get context at appropriate disclosure level
    context = disclosure.get_context(prompt)

    # Format output
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context if context else None
        }
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
```
