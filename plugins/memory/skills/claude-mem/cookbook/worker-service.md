# Worker Service: HTTP API on Port 37777

## Purpose

Document the claude-mem worker service HTTP API. The worker service is the central hub for memory operations, providing endpoints for session management, observation storage, search, and context generation.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `WORKER_PORT` | `37777` | Default HTTP API port |
| `WORKER_HOST` | `127.0.0.1` | Localhost binding (security) |
| `WORKER_BASE_URL` | `http://127.0.0.1:37777` | Full base URL |
| `VIEWER_URL` | `http://localhost:37777` | Web viewer UI |
| `DATABASE_PATH` | `~/.claude-mem/claude-mem.db` | SQLite database |
| `CHROMA_PATH` | `~/.claude-mem/chroma/` | Vector database |

## Instructions

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Worker Service (Bun-managed Express server)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ System Routes  │  │ Session Routes │  │ Search Routes  │ │
│  │ /api/health    │  │ /api/sessions  │  │ /api/search    │ │
│  │ /api/readiness │  │ /sessions/:id  │  │ /api/timeline  │ │
│  │ /api/version   │  │                │  │ /api/context   │ │
│  │ /api/admin     │  │                │  │                │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ Settings Routes│  │ Data Routes    │  │ Viewer Routes  │ │
│  │ /api/settings  │  │ /api/obs/:id   │  │ /              │ │
│  │                │  │ /api/obs/batch │  │ /viewer.html   │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Domain Services                                              │
│ • SessionStore (SQLite)                                      │
│ • SearchManager (Chroma + FTS5)                              │
│ • ContextBuilder                                             │
│ • ModeManager                                                │
└─────────────────────────────────────────────────────────────┘
```

### Starting the Worker

The worker is auto-started by hooks, but can be manually controlled:

```bash
# Start worker
bun run ~/.claude/plugins/marketplaces/thedotmack/plugin/worker-service.js

# Check if running
curl http://127.0.0.1:37777/api/health

# Restart via API
curl -X POST http://127.0.0.1:37777/api/admin/restart

# Shutdown via API
curl -X POST http://127.0.0.1:37777/api/admin/shutdown
```

## Code Examples

### System Endpoints

#### Health Check

```bash
curl http://127.0.0.1:37777/api/health
```

Response:
```json
{
  "status": "ok",
  "build": "TEST-008-wrapper-ipc",
  "managed": true,
  "hasIpc": true,
  "platform": "linux",
  "pid": 12345,
  "initialized": true,
  "mcpReady": true
}
```

#### Readiness Check

```bash
curl http://127.0.0.1:37777/api/readiness
```

Response (ready):
```json
{
  "status": "ready",
  "mcpReady": true
}
```

Response (initializing):
```json
{
  "status": "initializing",
  "message": "Worker is still initializing, please retry"
}
```
HTTP Status: 503

#### Version

```bash
curl http://127.0.0.1:37777/api/version
```

Response:
```json
{
  "version": "6.5.0"
}
```

### Session Endpoints

#### Initialize Session

```bash
curl -X POST http://127.0.0.1:37777/api/sessions/init \
  -H "Content-Type: application/json" \
  -d '{
    "contentSessionId": "abc-123-def-456",
    "project": "my-project",
    "prompt": "Fix the authentication bug"
  }'
```

Response:
```json
{
  "sessionDbId": 42,
  "promptNumber": 1,
  "skipped": false
}
```

Response (private content):
```json
{
  "sessionDbId": 42,
  "promptNumber": 1,
  "skipped": true,
  "reason": "private"
}
```

#### Start SDK Agent

```bash
curl -X POST http://127.0.0.1:37777/sessions/42/init \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Fix the authentication bug",
    "promptNumber": 1
  }'
```

Response:
```json
{
  "status": "started",
  "sessionDbId": 42
}
```

#### Store Observation

```bash
curl -X POST http://127.0.0.1:37777/api/sessions/observations \
  -H "Content-Type: application/json" \
  -d '{
    "contentSessionId": "abc-123-def-456",
    "tool_name": "Edit",
    "tool_input": "{\"file_path\": \"/src/auth.ts\", \"old_string\": \"...\", \"new_string\": \"...\"}",
    "tool_response": "File edited successfully",
    "cwd": "/home/user/project"
  }'
```

Response:
```json
{
  "status": "queued",
  "sessionDbId": 42,
  "promptNumber": 1
}
```

#### Request Summary

```bash
curl -X POST http://127.0.0.1:37777/api/sessions/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "contentSessionId": "abc-123-def-456",
    "last_assistant_message": "I have fixed the authentication bug by..."
  }'
```

Response:
```json
{
  "status": "queued",
  "sessionDbId": 42
}
```

### Search Endpoints

#### Unified Search

```bash
# Text search
curl "http://127.0.0.1:37777/api/search?query=authentication&limit=20"

# With filters
curl "http://127.0.0.1:37777/api/search?query=bug&type=observations&obs_type=bugfix&project=my-project"

# Date range
curl "http://127.0.0.1:37777/api/search?query=feature&dateStart=2025-01-01&dateEnd=2025-01-31"
```

Response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "| ID | Date | Type | Title |\n|-----|------|------|-------|\n| 123 | Jan 14 | bugfix | Fixed auth token refresh |"
    }
  ]
}
```

#### Timeline

```bash
# By anchor ID
curl "http://127.0.0.1:37777/api/timeline?anchor=123&depth_before=5&depth_after=5"

# By query (finds best match, then shows timeline)
curl "http://127.0.0.1:37777/api/timeline?query=authentication&depth_before=3&depth_after=3"
```

Response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "## Timeline around #123\n\n### Before\n| ID | Time | Title |\n...\n\n### Anchor\n...\n\n### After\n..."
    }
  ]
}
```

#### Semantic Shortcuts

```bash
# Decisions
curl "http://127.0.0.1:37777/api/decisions?limit=10"

# Changes
curl "http://127.0.0.1:37777/api/changes?limit=10"

# How-it-works explanations
curl "http://127.0.0.1:37777/api/how-it-works?limit=10"
```

### Context Endpoints

#### Context Injection

```bash
# Single project
curl "http://127.0.0.1:37777/api/context/inject?project=my-project"

# Multiple projects (worktree support)
curl "http://127.0.0.1:37777/api/context/inject?projects=main-repo,feature-branch"

# With ANSI colors
curl "http://127.0.0.1:37777/api/context/inject?project=my-project&colors=true"
```

Response (plain text):
```
# Recent Activity - my-project

### Jan 14, 2025

| ID | Time | Type | Title |
|-----|------|------|-------|
| #123 | 3:40 PM | bugfix | Fixed auth token refresh |
| #122 | 3:35 PM | discovery | Found root cause in token validation |

## Most Recent Summary

Fixed the authentication token refresh bug that was causing...
```

#### Recent Context

```bash
curl "http://127.0.0.1:37777/api/context/recent?project=my-project&limit=3"
```

Response:
```json
{
  "content": [
    {
      "type": "text",
      "text": "## Recent Sessions\n\n### Session 42 (Jan 14, 2025)\nSummary: Fixed authentication bug...\n\nObservations:\n- #123: Fixed auth token refresh\n- #122: Found root cause"
    }
  ]
}
```

#### Context Timeline

```bash
curl "http://127.0.0.1:37777/api/context/timeline?anchor=123&depth_before=10&depth_after=10"
```

### Data Endpoints

#### Get Single Observation

```bash
curl "http://127.0.0.1:37777/api/observation/123"
```

Response:
```json
{
  "id": 123,
  "type": "bugfix",
  "title": "Fixed auth token refresh",
  "subtitle": "Token was expiring before refresh window",
  "facts": [
    "Token TTL was 30 minutes",
    "Refresh window was 5 minutes",
    "Changed TTL to 60 minutes"
  ],
  "narrative": "The authentication token was expiring before the refresh window...",
  "concepts": ["authentication", "tokens", "expiry"],
  "files_read": ["/src/auth.ts", "/src/config.ts"],
  "files_modified": ["/src/auth.ts"],
  "created_at": "2025-01-14T15:40:00Z"
}
```

#### Batch Fetch Observations

```bash
curl -X POST "http://127.0.0.1:37777/api/observations/batch" \
  -H "Content-Type: application/json" \
  -d '{"ids": [123, 456, 789]}'
```

Response:
```json
[
  {
    "id": 123,
    "type": "bugfix",
    "title": "Fixed auth token refresh",
    ...
  },
  {
    "id": 456,
    "type": "feature",
    "title": "Added OAuth2 support",
    ...
  },
  {
    "id": 789,
    "type": "discovery",
    "title": "Explored PKCE flow",
    ...
  }
]
```

### Settings Endpoints

#### Get Settings

```bash
curl "http://127.0.0.1:37777/api/settings"
```

Response:
```json
{
  "hooks": {
    "sessionStart": true,
    "userPromptSubmit": true,
    "postToolUse": true,
    "stop": true,
    "sessionEnd": true
  },
  "context": {
    "observationCount": 50,
    "sessionCount": 5,
    "fullObservationCount": 3
  },
  "mode": "standard"
}
```

#### Update Settings

```bash
curl -X POST "http://127.0.0.1:37777/api/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "endless",
    "context": {
      "observationCount": 100
    }
  }'
```

### Admin Endpoints

#### Restart Worker

```bash
curl -X POST "http://127.0.0.1:37777/api/admin/restart"
```

Response:
```json
{
  "status": "restarting"
}
```

#### Shutdown Worker

```bash
curl -X POST "http://127.0.0.1:37777/api/admin/shutdown"
```

Response:
```json
{
  "status": "shutting_down"
}
```

## Common Patterns

### Pattern 1: Wait for Worker Ready

```typescript
async function waitForWorkerReady(
  port: number,
  timeoutMs: number = 30000
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 100;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/readiness`);
      if (response.ok) {
        return; // Worker is ready
      }
    } catch {
      // Worker not yet responding
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Worker not ready after ${timeoutMs}ms`);
}
```

### Pattern 2: Error Handling

```typescript
async function callWorkerAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `http://127.0.0.1:37777${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Worker service not running');
    }
    throw error;
  }
}
```

### Pattern 3: Streaming Response Handling

```typescript
async function streamContextInject(project: string): Promise<void> {
  const response = await fetch(
    `http://127.0.0.1:37777/api/context/inject?project=${project}`
  );

  if (!response.ok) {
    throw new Error(`Context injection failed: ${response.status}`);
  }

  // Response is plain text, not JSON
  const text = await response.text();
  console.log(text);
}
```

### Pattern 4: Batch Operations

```typescript
// Always batch multiple ID fetches
async function fetchMultipleObservations(ids: number[]): Promise<Observation[]> {
  // GOOD: Single request for all IDs
  const response = await fetch('http://127.0.0.1:37777/api/observations/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });

  return await response.json();
}

// BAD: Multiple requests
async function fetchMultipleObservationsBad(ids: number[]): Promise<Observation[]> {
  const results = [];
  for (const id of ids) {
    const response = await fetch(`http://127.0.0.1:37777/api/observation/${id}`);
    results.push(await response.json());
  }
  return results;
}
```

## API Reference Summary

### System Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (always responds) |
| GET | `/api/readiness` | Readiness check (503 until initialized) |
| GET | `/api/version` | Get worker version |
| POST | `/api/admin/restart` | Restart worker service |
| POST | `/api/admin/shutdown` | Shutdown worker service |

### Session Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions/init` | Initialize session |
| POST | `/sessions/:id/init` | Start SDK agent for session |
| POST | `/api/sessions/observations` | Store observation |
| POST | `/api/sessions/summarize` | Request session summary |

### Search Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search` | Unified search |
| GET | `/api/timeline` | Get timeline around anchor |
| GET | `/api/decisions` | Search for decisions |
| GET | `/api/changes` | Search for changes |
| GET | `/api/how-it-works` | Search for explanations |
| GET | `/api/search/observations` | Search observations (legacy) |
| GET | `/api/search/sessions` | Search sessions |
| GET | `/api/search/prompts` | Search user prompts |
| GET | `/api/search/by-concept` | Search by concept |
| GET | `/api/search/by-file` | Search by file path |
| GET | `/api/search/by-type` | Search by observation type |
| GET | `/api/search/help` | Get API documentation |

### Context Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/inject` | Get context injection string |
| GET | `/api/context/recent` | Get recent context |
| GET | `/api/context/timeline` | Get context timeline |
| GET | `/api/context/preview` | Preview context for settings |
| GET | `/api/timeline/by-query` | Timeline from search query |

### Data Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/observation/:id` | Get single observation |
| POST | `/api/observations/batch` | Batch fetch observations |

### Settings Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get current settings |
| POST | `/api/settings` | Update settings |

## See Also

- [quickstart.md](./quickstart.md) - Installation and setup
- [hook-patterns.md](./hook-patterns.md) - How hooks call the API
- [progressive-disclosure.md](./progressive-disclosure.md) - Search workflow patterns
