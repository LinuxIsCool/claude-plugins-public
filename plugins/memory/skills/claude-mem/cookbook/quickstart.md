# Quickstart: Setting Up claude-mem

## Purpose

Get claude-mem running in your Claude Code environment. This guide covers installation, verification, and initial configuration for persistent memory across sessions.

## Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `WORKER_PORT` | `37777` | HTTP API port for worker service |
| `WORKER_HOST` | `127.0.0.1` | Worker service host (localhost only) |
| `DB_PATH` | `~/.claude-mem/claude-mem.db` | SQLite database location |
| `CHROMA_PATH` | `~/.claude-mem/chroma/` | Vector database directory |
| `SETTINGS_PATH` | `~/.claude-mem/settings.json` | Configuration file |

## Instructions

### Step 1: Install from Marketplace

In a Claude Code session:

```
> /plugin marketplace add thedotmack/claude-mem

> /plugin install claude-mem
```

Restart Claude Code after installation.

### Step 2: Verify Installation

Check the worker service is running:

```bash
curl -s http://127.0.0.1:37777/api/health | jq
```

Expected response:

```json
{
  "status": "ok",
  "initialized": true,
  "mcpReady": true,
  "platform": "linux",
  "pid": 12345
}
```

### Step 3: Verify Hooks Are Active

Claude Code hooks are installed automatically. Verify by checking hook registration:

```bash
# Check plugin directory
ls -la ~/.claude/plugins/marketplaces/thedotmack/plugin/hooks/
```

Expected hooks:
- `context-hook.js` (SessionStart)
- `new-hook.js` (UserPromptSubmit)
- `save-hook.js` (PostToolUse)
- `summary-hook.js` (Stop)
- `cleanup-hook.js` (SessionEnd)

### Step 4: View the Web UI

Open the memory viewer in your browser:

```
http://localhost:37777
```

The web viewer shows:
- Real-time memory stream
- Session timeline
- Search interface
- Settings configuration

## Code Examples

### Check Worker Readiness

```bash
# Health check (always responds)
curl http://127.0.0.1:37777/api/health

# Readiness check (503 until initialized)
curl http://127.0.0.1:37777/api/readiness
```

### Get Version

```bash
curl http://127.0.0.1:37777/api/version
```

### View Context Injection Preview

```bash
# Preview what context will be injected for a project
curl "http://127.0.0.1:37777/api/context/inject?project=my-project"
```

### Search Memory

```bash
# Search observations
curl "http://127.0.0.1:37777/api/search?query=authentication&limit=10"

# Get timeline around an observation
curl "http://127.0.0.1:37777/api/timeline?anchor=123&depth_before=5&depth_after=5"
```

## Common Patterns

### Verify Memory Is Being Captured

1. Start a new Claude Code session
2. Perform some work (edit files, run commands)
3. Check the web viewer at `http://localhost:37777`
4. Verify observations appear in the timeline

### Check for Hook Errors

```bash
# View worker logs
tail -f ~/.claude-mem/logs/worker.log

# Check for hook execution errors
grep "ERROR" ~/.claude-mem/logs/worker.log
```

### Restart the Worker Service

```bash
# Via admin API
curl -X POST http://127.0.0.1:37777/api/admin/restart

# Or manually
pkill -f "bun.*worker-service"
bun run ~/.claude/plugins/marketplaces/thedotmack/plugin/worker-service.js
```

## Configuration

Settings are auto-created at `~/.claude-mem/settings.json`:

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
    "fullObservationCount": 3,
    "showPreviousAssistant": true,
    "showMostRecentSummary": true
  },
  "search": {
    "maxResults": 20,
    "minRelevance": 0.3
  },
  "privacy": {
    "excludePatterns": ["<private>", "password", "secret", "api_key"]
  }
}
```

## Troubleshooting

### Worker Not Starting

```bash
# Check if port is in use
lsof -i :37777

# Kill any stale processes
pkill -f "bun.*worker"

# Start fresh
bun run ~/.claude/plugins/marketplaces/thedotmack/plugin/worker-service.js
```

### No Context Appearing

1. Verify hooks are registered in Claude Code
2. Check worker is running and initialized
3. Ensure project name matches (derived from directory name)
4. Check `~/.claude-mem/claude-mem.db` exists and has data

### MCP Server Issues

```bash
# Verify MCP server is configured in Claude Desktop
cat ~/.config/claude/claude_desktop_config.json | jq '.mcpServers["claude-mem"]'
```

## Next Steps

- Read [hook-patterns.md](./hook-patterns.md) for implementing lifecycle hooks
- See [progressive-disclosure.md](./progressive-disclosure.md) for token-efficient search
- Explore [biomimetic-mode.md](./biomimetic-mode.md) for extended sessions
- Review [worker-service.md](./worker-service.md) for HTTP API details
