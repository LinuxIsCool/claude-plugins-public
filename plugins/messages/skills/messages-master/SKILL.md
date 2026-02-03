---
name: messages-master
description: Master skill for universal messaging backbone (6 sub-skills). Covers message search, platform imports (Signal, Telegram, Email, Claude Code), Signal integration (signal-cli, backups), content-addressed storage (CID), CLI usage, and MCP tools. Invoke for "search messages", "import messages", "sync signal", "telegram auth", "email sync", CID/DID, or cross-platform message access. (plugin:messages@linuxiscool-claude-plugins)
---

# Messages - Universal Messaging Backbone

Content-addressed message storage with DID-based identity across all platforms.

## Overview

The messages plugin provides a unified local store for messages from any source:
- **Signal** via signal-cli (new messages + Android backup for history)
- **Telegram** exports (JSON) and live API (MTProto)
- **Email** via IMAP (Gmail, Outlook) or file import (.eml, .mbox)
- **Claude Code** conversation logs
- Future: WhatsApp, forum posts, HTTP requests

All messages receive content-addressed identifiers (CIDs) ensuring integrity and deduplication.

## Sub-Skills Index

| Sub-Skill | Use When | File |
|-----------|----------|------|
| **message-search** | Searching messages, finding conversations, querying by platform/kind/time | `subskills/message-search.md` |
| **platform-imports** | Importing from any platform, understanding adapters | `subskills/platform-imports.md` |
| **signal-integration** | Signal setup, signal-cli, linking, backups, historical messages | `subskills/signal-integration.md` |
| **identity-crypto** | Working with CIDs, DIDs, content-addressing, verification | `subskills/identity-crypto.md` |
| **cli-usage** | Using the messages CLI for import, search, stats | `subskills/cli-usage.md` |
| **mcp-tools** | Using MCP server tools for programmatic access | `subskills/mcp-tools.md` |

## Quick Reference

### Data Location

All data stored at `.claude/messages/`:

```
.claude/messages/
├── store/
│   ├── events/           # Append-only JSONL (source of truth)
│   │   └── YYYY/MM/DD/events.jsonl
│   └── content/          # Content-addressed markdown files
│       └── XX/{cid}.md   # Sharded by first 2 chars after prefix
├── views/                # Derived projections
│   ├── threads/
│   └── accounts/
└── search/
    └── index.db          # SQLite FTS5
```

### Message Kinds (Nostr-inspired)

| Range | Category | Examples |
|-------|----------|----------|
| 0-99 | Core | 1=Text, 10=Reaction, 20=Contact |
| 100-199 | Claude Code | 101=UserPrompt, 102=AssistantResponse, 103=SubagentStop |
| 200-249 | Git | 201=Commit, 210=PR, 220=Issue |
| 1000+ | Platform | 1001=WhatsApp, 1002=Signal, 1003=Telegram, 1100=Email |

### CLI Quick Start

```bash
# Signal: Check status and sync
bun plugins/messages/src/cli.ts signal-status
bun plugins/messages/src/cli.ts signal-sync

# Telegram: Auth and import
bun plugins/messages/src/cli.ts telegram-auth
bun plugins/messages/src/cli.ts import telegram-api

# Email: Sync from IMAP
bun plugins/messages/src/cli.ts email-sync

# Claude Code logs
bun plugins/messages/src/cli.ts import logs

# Search messages
bun plugins/messages/src/cli.ts search "authentication"

# Show stats
bun plugins/messages/src/cli.ts stats
```

### MCP Tools Available

When MCP server is active, these tools are exposed:
- `messages_search` - Full-text search with filters
- `messages_recent` - Get recent messages
- `messages_thread` - Get thread messages
- `messages_stats` - Get statistics
- `messages_import_signal` - Sync Signal messages
- `messages_import_telegram` - Import from Telegram API
- `messages_import_email` - Sync from IMAP
- `messages_import_logs` - Import Claude Code logs

## Architecture Principles

### Content-Addressed Storage (CID)

Every message gets a deterministic ID from its content:
```
CID = "msg_" + base58(sha256(canonical({content, kind, created_at, account_id})))
```

Benefits:
- Same content always produces same ID
- Automatic deduplication
- Integrity verification possible
- No central ID authority needed

### Decentralized Identity (DID)

Accounts can have DIDs using the `did:key` method with Ed25519:
```
did:key:z6Mk...
```

Benefits:
- Self-sovereign identity
- Cryptographic verification
- Cross-platform identity linking

### Event Sourcing

All changes are append-only events in JSONL:
```json
{"ts":"2025-12-17T...","op":"message.created","data":{...}}
```

Benefits:
- Complete audit trail
- Time-travel queries possible
- Views can be rebuilt from events

## Related Agents

- **messages:correspondent** - Plugin persona, orchestrates message operations
- **messages:indexer** - Import specialist, bulk operations
- **messages:analyst** - Search and insight extraction
