# Temporal Plugin

Provides continuous temporal awareness to Claude by injecting timestamps at key conversation events.

## What It Does

Injects timestamps into Claude's visible context at:

| Event | When | Example Output |
|-------|------|----------------|
| `SessionStart` | Conversation begins | `[2025-12-16 08:59:25 PST] SessionStart - Tuesday (morning)` |
| `UserPromptSubmit` | User sends message | `[2025-12-16 09:00:15 PST] UserPromptSubmit` |
| `Stop` | Claude finishes response | `[2025-12-16 09:01:02 PST] Stop` |
| `SessionEnd` | Conversation ends | `[2025-12-16 09:30:00 PST] SessionEnd` |

## Why

Without this plugin, Claude has no reliable way to know the current time. This leads to:
- Guessing timestamps for journal entries
- Inability to reason about "now" vs scheduled events
- No awareness of session duration

With this plugin, Claude sees an **interaction timeline** throughout the conversation.

## Installation

The plugin is installed via the marketplace. Ensure it's registered in your `.claude-plugin/marketplace.json`.

## Context Cost

Each timestamp injection is ~15-20 tokens (includes full date). For a typical 20-exchange session, this adds ~400-500 tokens total - negligible compared to the value of temporal grounding.

## Integration

Works alongside other plugins:
- **Logging**: Records timestamps to files; temporal injects into context
- **Schedule**: Temporal provides "now"; schedule provides "what's planned"
- **Journal**: Timestamps enable accurate entry dating

## Configuration

Currently no configuration options. The plugin injects timestamps in a consistent format:
```
[YYYY-MM-DD HH:MM:SS TZ] EventName
```

All timestamps include the full date for self-contained temporal context (handles midnight crossings and context continuations). SessionStart includes additional context (weekday, period of day).

## Architecture

```
temporal/
├── .claude-plugin/
│   └── plugin.json       # Hook registrations
├── hooks/
│   └── inject_timestamp.py  # Timestamp injection script
└── README.md
```

The hook script:
1. Receives hook event data via stdin
2. Generates current timestamp
3. Outputs JSON with `hookSpecificOutput.additionalContext`
4. Claude sees the timestamp in its context

## Philosophy

> Time is infrastructure, not a feature.

This plugin provides foundational temporal grounding that all other plugins can build upon. It follows the principle of **infrastructure serving intelligence**.
