# CLI Usage Sub-Skill

Command-line interface for the messages plugin.

## Location

```bash
bun plugins/messages/src/cli.ts <command> [options]
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `signal-live` | Continuous live Signal sync |
| `gmail-live` | Continuous live Gmail sync (multi-account) |
| `telegram-live` | Continuous live Telegram sync (all chats) |
| `signal-sync` | One-time Signal sync |
| `email-sync` | One-time email IMAP sync |
| `import telegram` | Import Telegram JSON export |
| `import telegram-api` | Import from Telegram API |
| `import logs` | Import Claude Code logs |
| `search <query>` | Search messages |
| `recent` | Show recent messages |
| `thread <id>` | Show thread messages |
| `threads` | List all threads |
| `accounts` | List all accounts |
| `stats` | Show statistics |

## Live Sync Commands

### Signal Live Sync

```bash
# Start continuous sync (runs until Ctrl+C)
SIGNAL_PHONE='+1234567890' bun plugins/messages/src/cli.ts signal-live

# Run in background via tmux
tmux new-session -d -s signal-sync "SIGNAL_PHONE='+1234567890' bun plugins/messages/src/cli.ts signal-live"
```

**Features:**
- Dual-mode: daemon (TCP 7583) or CLI polling fallback
- 30-second poll interval in CLI mode
- Automatic reconnection with exponential backoff

### Gmail Live Sync

```bash
# Start continuous sync for all configured Gmail accounts
bun plugins/messages/src/cli.ts gmail-live

# Run in background
tmux new-session -d -s gmail-sync "bun plugins/messages/src/cli.ts gmail-live"
```

**Required environment variables:**
```bash
IMAP_<PREFIX>_HOST=imap.gmail.com
IMAP_<PREFIX>_USER=email@domain.com
IMAP_<PREFIX>_PASSWORD=app_password
```

**Features:**
- Multi-account support (all IMAP_*_HOST vars detected)
- IMAP IDLE for real-time push notifications
- Polling fallback (30s) if IDLE fails
- Gmail IDLE restart every 25 minutes (Gmail limit: 29min)

### Telegram Live Sync

```bash
# Start continuous sync for all chats
bun plugins/messages/src/cli.ts telegram-live

# Run in background
tmux new-session -d -s telegram-sync "bun plugins/messages/src/cli.ts telegram-live"
```

**Required:** Run `telegram-auth` first to create session.

**Features:**
- Event-driven (GramJS addEventHandler) - no polling needed
- Monitors DMs, groups, and channels
- Automatic reconnection with exponential backoff
- Shows dialog count and message direction

## Import Commands

### Import Telegram

```bash
# Basic import
bun plugins/messages/src/cli.ts import telegram -f ~/Downloads/result.json

# Preview first (dry run)
bun plugins/messages/src/cli.ts import telegram -f ~/Downloads/result.json --dry-run
```

**Options:**
- `-f, --file <path>` - Path to Telegram JSON export (required)
- `--dry-run` - Preview without importing

### Import Claude Code Logs

```bash
# Basic import (prompts and responses)
bun plugins/messages/src/cli.ts import logs

# Include tool use events
bun plugins/messages/src/cli.ts import logs --include-tools

# Include system events
bun plugins/messages/src/cli.ts import logs --include-system

# Preview first
bun plugins/messages/src/cli.ts import logs --dry-run
```

**Options:**
- `--include-tools` - Include tool use events
- `--include-system` - Include system events
- `--dry-run` - Preview without importing

## Search Commands

### Search Messages

```bash
# Basic search
bun plugins/messages/src/cli.ts search "authentication"

# With platform filter
bun plugins/messages/src/cli.ts search "meeting" -p telegram

# With result limit
bun plugins/messages/src/cli.ts search "error" -l 50
```

**Options:**
- `-p, --platform <name>` - Filter by platform
- `-l, --limit <n>` - Limit results (default: 20)

**Output:**
```
Searching for: "authentication"

[2025-12-12 23:10:18] claude-code | AssistantResponse
  Claude: Now I can synthesize a comprehensive answer...
  Score: 2.45 | ID: msg_CCpXi3K1QRPXuD4Sdc...

[2025-12-12 02:38:43] claude-code | AssistantResponse
  Claude: ## Assessment: Awareness Plugin Progress...
  Score: 1.83 | ID: msg_9ai9WVToeR1AgkKTVC...

Found 15 results.
```

### Recent Messages

```bash
# Default (20 recent)
bun plugins/messages/src/cli.ts recent

# With limit
bun plugins/messages/src/cli.ts recent -l 10

# Filter by platform
bun plugins/messages/src/cli.ts recent -p claude-code -l 5
```

**Options:**
- `-l, --limit <n>` - Number of messages (default: 20)
- `-p, --platform <name>` - Filter by platform

## Thread & Account Commands

### View Thread

```bash
bun plugins/messages/src/cli.ts thread cc_84093758
```

**Output:**
```
Thread: cc_84093758

[2025-12-17 09:15:23] User:
  Can you help me with the messages plugin?

[2025-12-17 09:15:45] Claude:
  I'd be happy to help! The messages plugin provides...

Showing 25 messages.
```

### List Threads

```bash
# Default (20 threads)
bun plugins/messages/src/cli.ts threads

# With limit
bun plugins/messages/src/cli.ts threads -l 50
```

**Output:**
```
Threads:

cc_84093758
  Title: (untitled)
  Type: conversation | Platform: claude-code
  Messages: 45

tg_chat_123456
  Title: Family Group
  Type: group | Platform: telegram
  Messages: 1,234
```

### List Accounts

```bash
# Default (20 accounts)
bun plugins/messages/src/cli.ts accounts

# With limit
bun plugins/messages/src/cli.ts accounts -l 100
```

**Output:**
```
Accounts:

user: User
  Platforms: claude-code

claude: Claude
  Platforms: claude-code

alice: Alice Smith
  Platforms: telegram
  DID: did:key:z6Mk...
```

## Statistics

```bash
bun plugins/messages/src/cli.ts stats
```

**Output:**
```
Messages Statistics
==================
Total Messages: 7,856

By Kind:
  UserPrompt: 768
  AssistantResponse: 460
  SubagentStop: 1,198
  TelegramText: 5,430

By Platform:
  claude-code: 2,426
  telegram: 5,430

Date Range:
  First: 2025-12-08 23:11:56
  Last: 2025-12-17 21:05:21
```

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help |
| `-l, --limit <n>` | Limit results |
| `-p, --platform <name>` | Filter by platform |
| `--dry-run` | Preview without changes |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid arguments, file not found, etc.) |

## Examples

### Full Import Workflow

```bash
# 1. Preview Claude Code logs
bun plugins/messages/src/cli.ts import logs --dry-run

# 2. Import if looks good
bun plugins/messages/src/cli.ts import logs

# 3. Check stats
bun plugins/messages/src/cli.ts stats

# 4. Search imported content
bun plugins/messages/src/cli.ts search "specific topic"
```

### Cross-Platform Search

```bash
# Search across all platforms
bun plugins/messages/src/cli.ts search "project update"

# Narrow to specific platform
bun plugins/messages/src/cli.ts search "project update" -p telegram
```

### Thread Exploration

```bash
# List recent threads
bun plugins/messages/src/cli.ts threads -l 10

# View specific thread
bun plugins/messages/src/cli.ts thread cc_84093758

# Search within thread context
bun plugins/messages/src/cli.ts search "error" -p claude-code
```
