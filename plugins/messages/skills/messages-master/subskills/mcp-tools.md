# MCP Tools Sub-Skill

Model Context Protocol server tools for programmatic message access.

## MCP Server Setup

### Configuration

The MCP server is defined in `.mcp.json`:

```json
{
  "mcpServers": {
    "messages": {
      "command": "bun",
      "args": ["${CLAUDE_PLUGIN_ROOT}/src/server/index.ts"],
      "type": "stdio"
    }
  }
}
```

### Starting the Server

When the messages plugin is loaded, the MCP server starts automatically and exposes tools to Claude.

## Available Tools

### messages_search

Full-text search across all messages.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Max results (default: 20) |
| `offset` | number | No | Skip first N results |
| `platforms` | string[] | No | Filter by platforms |
| `kinds` | number[] | No | Filter by message kinds |
| `since` | number | No | After timestamp (ms) |
| `until` | number | No | Before timestamp (ms) |

**Example:**
```json
{
  "query": "authentication error",
  "limit": 10,
  "platforms": ["claude-code"],
  "kinds": [101, 102]
}
```

**Response:**
```json
{
  "results": [
    {
      "message": {
        "id": "msg_...",
        "content": "...",
        "kind": 102,
        "created_at": 1702800000000,
        "author": { "name": "Claude" },
        "source": { "platform": "claude-code" }
      },
      "score": 2.45
    }
  ],
  "total": 15
}
```

### messages_recent

Get most recent messages.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | number | No | Max messages (default: 20) |
| `platform` | string | No | Filter by platform |

**Example:**
```json
{
  "limit": 5,
  "platform": "telegram"
}
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_...",
      "content": "Latest message...",
      "created_at": 1702900000000,
      "author": { "name": "Alice" },
      "source": { "platform": "telegram" }
    }
  ]
}
```

### messages_thread

Get all messages in a thread.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `thread_id` | string | Yes | Thread identifier |
| `limit` | number | No | Max messages (default: 100) |

**Example:**
```json
{
  "thread_id": "cc_84093758",
  "limit": 50
}
```

**Response:**
```json
{
  "thread_id": "cc_84093758",
  "messages": [
    { "id": "msg_...", "content": "...", "created_at": ... },
    { "id": "msg_...", "content": "...", "created_at": ... }
  ],
  "total": 45
}
```

### messages_stats

Get statistics about stored messages.

**Parameters:** None

**Response:**
```json
{
  "total": 7856,
  "byKind": {
    "UserPrompt": 768,
    "AssistantResponse": 460,
    "SubagentStop": 1198,
    "TelegramText": 5430
  },
  "byPlatform": {
    "claude-code": 2426,
    "telegram": 5430
  },
  "dateRange": {
    "first": 1702080716000,
    "last": 1702851921000
  }
}
```

### messages_import_logs

Import Claude Code conversation logs.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `include_tools` | boolean | No | Include tool use events |
| `include_system` | boolean | No | Include system events |
| `dry_run` | boolean | No | Preview without importing |

**Example:**
```json
{
  "include_tools": false,
  "dry_run": true
}
```

**Response (dry run):**
```json
{
  "preview": true,
  "files": 45,
  "events": 12340,
  "sessions": 89,
  "eventTypes": {
    "UserPromptSubmit": 768,
    "AssistantResponse": 460,
    "SubagentStop": 1198
  }
}
```

**Response (actual import):**
```json
{
  "imported": 2426,
  "duration_ms": 1234
}
```

### messages_import_telegram

Import Telegram JSON export.

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `file_path` | string | Yes | Path to JSON export |
| `dry_run` | boolean | No | Preview without importing |

**Example:**
```json
{
  "file_path": "/home/user/Downloads/result.json",
  "dry_run": false
}
```

**Response:**
```json
{
  "imported": 5432,
  "chats": 15,
  "participants": 28,
  "duration_ms": 2345
}
```

## Usage Patterns

### Search and Analyze

```
1. Use messages_stats to understand data scope
2. Use messages_search for specific queries
3. Use messages_thread for conversation context
```

### Bulk Import

```
1. Use messages_import_logs with dry_run: true
2. Review counts and date ranges
3. Run actual import with dry_run: false
4. Verify with messages_stats
```

### Cross-Platform Research

```
1. Search across all platforms
2. Filter by platform for specifics
3. Use thread view for context
```

## Error Handling

Tools return errors in this format:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

**Common errors:**
- `FILE_NOT_FOUND` - Import file doesn't exist
- `INVALID_FORMAT` - File format not recognized
- `QUERY_EMPTY` - Search query is empty
- `THREAD_NOT_FOUND` - Thread doesn't exist

## Integration Examples

### Agent Searching Past Conversations

```
To find what was discussed about a topic:
1. Call messages_search with the topic query
2. Review results for relevant context
3. Use messages_thread if deeper context needed
```

### Agent Importing New Data

```
To import new conversation data:
1. Call messages_import_logs with dry_run: true
2. Report counts to user for approval
3. Call again with dry_run: false to import
4. Confirm with messages_stats
```
