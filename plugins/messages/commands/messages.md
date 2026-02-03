---
description: Show message statistics, search, or import messages
argument-hint: "[stats|search <query>|import|recent|thread <id>]"
---

# Messages Command

You are accessing the Messages plugin - the universal messaging backbone. Today is !date.

## Arguments

The user invoked: `/messages $ARGUMENTS`

## Available Subcommands

### No Arguments or "stats"
Show message store statistics.

1. Run the stats command:
   ```bash
   bun plugins/messages/src/cli.ts stats
   ```
2. Present the output in a readable format
3. Offer follow-up options (search, import, recent)

### "search <query>"
Search messages across all platforms.

1. Extract the search query from arguments
2. Run the search:
   ```bash
   bun plugins/messages/src/cli.ts search "<query>"
   ```
3. Present results with context
4. Offer to explore specific threads or refine search

### "import" or "import logs" or "import telegram"
Import messages from a platform.

1. If "import logs":
   - First do dry-run to preview
   - Show counts and ask for confirmation
   - Import if confirmed

2. If "import telegram":
   - Ask for file path if not provided
   - Do dry-run preview
   - Show counts and ask for confirmation
   - Import if confirmed

3. If just "import":
   - Ask what to import (logs or telegram)
   - Guide through the import process

### "recent"
Show recent messages.

1. Run:
   ```bash
   bun plugins/messages/src/cli.ts recent -l 10
   ```
2. Present messages with timestamps and authors
3. Offer to show more or search

### "thread <id>"
View a specific thread.

1. Run:
   ```bash
   bun plugins/messages/src/cli.ts thread <thread_id>
   ```
2. Present thread messages in conversation format
3. Offer to search within thread or list other threads

### "threads"
List available threads.

1. Run:
   ```bash
   bun plugins/messages/src/cli.ts threads -l 20
   ```
2. Present thread list
3. Offer to view specific thread

### "accounts"
List known accounts.

1. Run:
   ```bash
   bun plugins/messages/src/cli.ts accounts -l 20
   ```
2. Present accounts with their platform identities

## Workflow

1. Parse the subcommand and arguments
2. Execute appropriate CLI command
3. Present results clearly
4. Offer relevant follow-up actions

## Examples

```
/messages              → Shows statistics and overview
/messages stats        → Same as above
/messages search auth  → Searches for "auth" across all messages
/messages import       → Interactive import wizard
/messages import logs  → Import Claude Code logs
/messages recent       → Show 10 most recent messages
/messages thread cc_123 → View thread cc_123
/messages threads      → List all threads
/messages accounts     → List all accounts
```

## First Use

If the message store is empty (no messages imported yet):

1. Welcome the user to Messages plugin
2. Explain what it does:
   - Unified store for messages from all platforms
   - Content-addressed storage with CIDs
   - Full-text search
3. Offer to import:
   - Claude Code logs (from `.claude/logging/`)
   - Telegram export (user provides path)
4. Guide through first import

## Quick Reference

| Subcommand | Description |
|------------|-------------|
| (none)/stats | Show statistics |
| search <q> | Search messages |
| import | Interactive import |
| recent | Recent messages |
| thread <id> | View thread |
| threads | List threads |
| accounts | List accounts |

## CLI Location

```
bun plugins/messages/src/cli.ts <command>
```

## Related

- Use `messages:correspondent` agent for holistic guidance
- Use `messages:indexer` agent for complex imports
- Use `messages:analyst` agent for deep analysis
