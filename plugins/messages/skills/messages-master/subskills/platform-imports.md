# Platform Imports Sub-Skill

Import messages from external platforms into the unified store.

## Supported Platforms

| Platform | Status | Adapter | Source Format |
|----------|--------|---------|---------------|
| Claude Code | Ready | `logging` | `.claude/logging/*.jsonl` |
| Telegram | Ready | `telegram` | JSON export |
| Telegram API | Ready | `telegram-api` | Live MTProto API (DM-first) |
| Signal | Ready | `signal` | signal-cli (CLI mode) |
| Email (IMAP) | Ready | `email-imap` | Live IMAP (Gmail, etc.) |
| Email (files) | Ready | `email` | .eml directory or .mbox |
| WhatsApp | Planned | - | - |

**Note**: For Signal historical messages, see `subskills/signal-integration.md` - requires Android backup decryption.

## Claude Code Logs Import

### What Gets Imported
- **UserPromptSubmit** events → Kind 101 (UserPrompt)
- **AssistantResponse** events → Kind 102 (AssistantResponse)
- **SubagentStop** events → Kind 103 (SubagentStop)

### Optional Events (with flags)
- Tool use events (with `--include-tools`)
- System events (with `--include-system`)

### Import Command

```bash
# Basic import (prompts and responses only)
bun plugins/messages/src/cli.ts import logs

# Include tool use events
bun plugins/messages/src/cli.ts import logs --include-tools

# Include system events
bun plugins/messages/src/cli.ts import logs --include-system

# Dry run (preview without importing)
bun plugins/messages/src/cli.ts import logs --dry-run
```

### Dry Run Output
```
Claude Code Logs Summary:
  Files: 45
  Events: 12,340
  Sessions: 89
  Date Range: 2025-12-08 to 2025-12-17

Event Types:
  UserPromptSubmit: 768
  AssistantResponse: 460
  SubagentStop: 1198
  ToolUse: 8914
```

### Data Mapping

| Log Field | Message Field |
|-----------|---------------|
| `ts` | `created_at` |
| `event_type` | `kind` (mapped) |
| `content` | `content` |
| `session_id` | `source.session_id` |
| `agent_id` | `source.agent_id` |

## Telegram Import

### Export from Telegram Desktop

1. Open Telegram Desktop
2. Go to Settings → Advanced → Export Telegram data
3. Select chats to export
4. Choose JSON format
5. Export

### Import Command

```bash
# Import from file
bun plugins/messages/src/cli.ts import telegram -f ~/Downloads/result.json

# Dry run first
bun plugins/messages/src/cli.ts import telegram -f ~/Downloads/result.json --dry-run
```

### Dry Run Output
```
Telegram Export Summary:
  Chats: 15
  Messages: 5,432
  Participants: 28

Participants: Alice, Bob, Charlie, ...
```

### What Gets Imported
- Text messages
- Media captions
- Replies (linked via `refs.reply_to`)
- Participants (as accounts)
- Chat groups (as threads)

### Data Mapping

| Telegram Field | Message Field |
|----------------|---------------|
| `date` | `created_at` |
| `text` | `content` |
| `from` | `author.name` |
| `from_id` | `account_id` |
| `reply_to_message_id` | `refs.reply_to` |

## Telegram API Import (Live Sync)

The `telegram-api` adapter syncs directly from Telegram via the MTProto API.

### Authentication

```bash
# One-time authentication
bun plugins/messages/src/cli.ts telegram-auth
```

### Import Commands

```bash
# Import last 30 days (default)
bun plugins/messages/src/cli.ts import telegram-api

# Import last 90 days
bun plugins/messages/src/cli.ts import telegram-api --since 90
```

### DM-First Sync Strategy

**User DMs always sync regardless of the `--since` date filter.**

This is intentional:
- 1-on-1 relationships are high-value and should never be filtered
- Even dormant DMs (months old) are imported
- Groups and channels respect the date filter to avoid noise

This prevents the common issue where important but dormant contacts get missed during incremental syncs.

## Creating Custom Adapters

### Adapter Interface

```typescript
// Generator pattern for streaming imports
async function* importMyPlatform(
  sourcePath: string,
  store: MessageStore
): AsyncGenerator<Message> {
  // Read source data
  const data = await readSource(sourcePath);

  for (const item of data.items) {
    // Map to MessageInput
    const input: MessageInput = {
      content: item.text,
      kind: Kind.Text,
      created_at: item.timestamp,
      account_id: item.userId,
      author: {
        name: item.userName,
      },
      refs: {
        thread_id: item.channelId,
      },
      source: {
        platform: "my-platform",
        platform_id: item.id,
      },
      visibility: "private",
      tags: [],
    };

    // Store and yield
    const message = await store.createMessage(input);
    yield message;
  }
}
```

### Best Practices

1. **Use generators** for memory efficiency with large exports
2. **Map to standard kinds** when possible (1=Text, 10=Reaction)
3. **Preserve platform IDs** in `source.platform_id`
4. **Link replies** via `refs.reply_to`
5. **Create threads** for conversations/channels
6. **Create accounts** for participants

## Import Progress

Imports show progress during execution:
```
Importing from ~/Downloads/result.json...
Imported 100 messages...
Imported 200 messages...
...
Done! Imported 5,432 messages.
```

## Deduplication

CIDs ensure automatic deduplication:
- Same content + timestamp + author = same CID
- Re-importing won't create duplicates
- Safe to import overlapping exports
