# Design Synthesis

*Recommended architecture for the Messages plugin*

## Design Principles

Based on research and ecosystem analysis:

| Principle | Rationale |
|-----------|-----------|
| **Event-First** | Messages are immutable events (event sourcing) |
| **Content-Addressed** | CIDs provide verifiable identity |
| **Identity-Portable** | Accounts decouple from platforms |
| **Schema-Flexible** | Kinds/types are extensible |
| **Adapter-Based** | Platform bridges are pluggable |
| **Markdown-Native** | Human-readable storage |
| **Git-Coordinated** | Files + commits as coordination |
| **Standalone-Enhanced** | Works alone, better with ecosystem |

---

## Core Data Model

### Message

The fundamental unit:

```typescript
interface Message {
  // === Identity ===
  id: string;              // Content-addressable hash (CID-like)

  // === Authorship ===
  account_id: string;      // Local account reference
  author: {
    did?: string;          // Portable DID if known
    name?: string;         // Display name
    handle?: string;       // Platform handle
  };

  // === Temporal ===
  created_at: number;      // Unix timestamp (original)
  imported_at?: number;    // When we received it
  valid_until?: number;    // Expiration (optional)

  // === Classification ===
  kind: number;            // Message type (see Kinds below)
  visibility?: "public" | "private" | "direct";

  // === Content ===
  content: string;         // Body text (may be markdown)
  title?: string;          // Optional title

  // === Structure ===
  refs: {
    thread_id?: string;    // Conversation thread
    reply_to?: string;     // Parent message ID
    room_id?: string;      // Channel/group context
    mentions?: string[];   // Account IDs mentioned
  };

  // === Source ===
  source: {
    platform: string;      // Origin (telegram, claude-code, etc.)
    platform_id?: string;  // ID in source system
    url?: string;          // Source URL if applicable
    session_id?: string;   // Claude session if applicable
    agent_id?: string;     // Agent hex ID if applicable
  };

  // === Metadata ===
  tags?: [string, ...string[]][];  // Extensible key-value pairs
  embedding?: number[];             // Vector for semantic search
  sig?: string;                     // Optional cryptographic signature
}
```

### Account

Identity across platforms:

```typescript
interface Account {
  id: string;              // Local unique ID
  did?: string;            // Decentralized identifier (portable)

  // Display
  name: string;            // Primary display name
  avatar?: string;         // Emoji or image path

  // Platform links
  identities: {
    platform: string;      // telegram, whatsapp, claude-code, etc.
    handle: string;        // @username, phone, email, etc.
    verified?: boolean;    // Platform verification
  }[];

  // Claude-specific
  agent?: {
    source: "project" | "plugin";
    source_path?: string;  // Path to agent definition
    model?: string;        // opus, sonnet, haiku
  };

  // Metadata
  created_at: number;
  updated_at?: number;
  stats?: {
    message_count: number;
    thread_count: number;
    last_active?: number;
  };
}
```

### Thread

Conversation container:

```typescript
interface Thread {
  id: string;
  title?: string;

  // Participants
  participants: string[];   // Account IDs
  type: "dm" | "group" | "channel" | "topic";

  // Source
  source: {
    platform: string;
    platform_id?: string;
    room_id?: string;
  };

  // Metadata
  created_at: number;
  last_message_at?: number;
  message_count: number;

  // State
  pinned_messages?: string[];
  muted?: boolean;
}
```

---

## Kind System

Following Nostr's pattern, extensible message types:

### Core Kinds (0-99)

| Kind | Name | Description |
|------|------|-------------|
| 0 | account_metadata | Account profile update |
| 1 | text_message | Short text message |
| 2 | long_form | Article/long-form content |
| 3 | media | Image/video/audio |
| 4 | link | URL share with preview |
| 5 | reaction | Emoji reaction to message |
| 6 | deletion | Delete request |
| 7 | edit | Edit to existing message |

### Claude Code Kinds (100-199)

| Kind | Name | Description |
|------|------|-------------|
| 100 | session_start | Claude session began |
| 101 | session_end | Claude session ended |
| 102 | user_prompt | User prompt submitted |
| 103 | assistant_response | Claude response |
| 104 | tool_use | Tool invocation |
| 105 | subagent_start | Subagent spawned |
| 106 | subagent_stop | Subagent completed |
| 107 | permission_request | Permission asked |

### Git Kinds (200-249)

| Kind | Name | Description |
|------|------|-------------|
| 200 | commit | Git commit |
| 201 | branch | Branch created/deleted |
| 202 | tag | Tag created |
| 203 | merge | Merge commit |

### Platform Kinds (1000+)

| Kind | Name | Description |
|------|------|-------------|
| 1000 | telegram_message | Telegram message |
| 1001 | whatsapp_message | WhatsApp message |
| 1002 | signal_message | Signal message |
| 1010 | email | Email message |
| 1020 | discord_message | Discord message |
| 1021 | slack_message | Slack message |
| 1030 | forum_post | Forum/Reddit post |
| 1031 | forum_comment | Forum comment |

---

## Storage Architecture

### Directory Structure

```
.claude/messages/
├── store/
│   ├── events/              # Append-only event log
│   │   └── YYYY/MM/DD/
│   │       └── events.jsonl
│   └── content/             # Content-addressed blobs
│       └── XX/              # First 2 chars of CID
│           └── XXXX...md    # Full CID as filename
├── views/                   # Materialized projections
│   ├── threads/
│   │   └── {thread_id}/
│   │       └── index.md     # Thread metadata + message list
│   ├── accounts/
│   │   └── {account_id}.md  # Account profile
│   ├── by-kind/
│   │   └── {kind}.json      # Index by message kind
│   └── timeline/
│       └── YYYY-MM-DD.md    # Daily timeline view
├── adapters/                # Adapter state/cache
│   ├── logging/
│   ├── telegram/
│   └── ...
└── search/
    └── index.db             # SQLite FTS5 index
```

### Event Log Format (JSONL)

```json
{"ts":"2025-12-17T10:00:00Z","op":"create","message":{"id":"...","kind":1,...}}
{"ts":"2025-12-17T10:01:00Z","op":"create","message":{"id":"...","kind":102,...}}
{"ts":"2025-12-17T10:02:00Z","op":"update","message_id":"...","changes":{...}}
```

### Content Files (Markdown)

```markdown
---
id: bafyabc123...
kind: 1
account_id: acc-001
created_at: 1734451200
source:
  platform: telegram
  platform_id: "123456789"
refs:
  thread_id: thread-001
tags:
  - [topic, architecture]
---

This is the message content in markdown format.

Supports **formatting** and [links](https://example.com).
```

---

## Adapter Interface

### Base Adapter

```typescript
interface Adapter {
  // Identity
  name: string;
  platform: string;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Import
  import(options: ImportOptions): AsyncIterable<Message>;

  // Real-time (optional)
  watch?(): EventEmitter;  // Emits 'message' events

  // Export (optional)
  export?(messages: Message[]): Promise<void>;
}

interface ImportOptions {
  since?: number;           // Unix timestamp
  until?: number;
  kinds?: number[];
  accounts?: string[];
  limit?: number;
}
```

### Internal Adapters

- **LoggingAdapter**: Imports from `.claude/logging/`
- **AgentNetAdapter**: Imports from `.claude/social/`
- **JournalAdapter**: Imports from `.claude/journal/`
- **GitAdapter**: Imports from `git log`

### External Adapters (Future)

- **TelegramAdapter**: Via Bot API or export
- **WhatsAppAdapter**: Via export files
- **EmailAdapter**: Via IMAP or export
- **DiscordAdapter**: Via Bot API
- **SlackAdapter**: Via API

---

## Query Interface

### Core Queries

```typescript
interface MessageStore {
  // Write
  create(message: MessageInput): Promise<Message>;
  update(id: string, changes: Partial<Message>): Promise<Message>;
  delete(id: string): Promise<void>;

  // Read
  get(id: string): Promise<Message | null>;
  list(filter: MessageFilter): Promise<Message[]>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Threads
  getThread(id: string): Promise<Thread | null>;
  getThreadMessages(threadId: string, options?: PaginationOptions): Promise<Message[]>;

  // Accounts
  getAccount(id: string): Promise<Account | null>;
  getAccountMessages(accountId: string, options?: PaginationOptions): Promise<Message[]>;

  // Timeline
  getTimeline(options: TimelineOptions): Promise<Message[]>;
}

interface MessageFilter {
  kinds?: number[];
  accounts?: string[];
  threads?: string[];
  platforms?: string[];
  since?: number;
  until?: number;
  tags?: [string, string][];
  limit?: number;
  offset?: number;
}
```

### Search

Using SQLite FTS5 for full-text search:

```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
  id,
  content,
  title,
  account_name,
  platform,
  tags,
  tokenize='porter'
);
```

Query with semantic fallback:
1. Try FTS5 keyword search
2. If few results, try embedding similarity
3. Combine and rank

---

## TUI Design

### Main Menu

```
┌─ Messages ─────────────────────────────┐
│                                        │
│  [1] Timeline      (all messages)      │
│  [2] Threads       (conversations)     │
│  [3] Accounts      (contacts)          │
│  [4] Search        (find messages)     │
│  [5] Platforms     (by source)         │
│  [6] Import        (add messages)      │
│                                        │
│  [q] Quit                              │
│                                        │
└────────────────────────────────────────┘
```

### Timeline View

```
┌─ Timeline ─────────────────────────────┐
│ 2025-12-17                             │
├────────────────────────────────────────┤
│ 10:30 [claude-code] User               │
│       Help me debug this function      │
│                                        │
│ 10:31 [claude-code] Claude             │
│       Let me look at the function...   │
│                                        │
│ 10:45 [telegram] Alice                 │
│       Meeting at 3pm?                  │
│                                        │
│ 10:46 [telegram] You                   │
│       Works for me                     │
│                                        │
│ [↑/↓] Navigate  [Enter] View  [/] Srch │
└────────────────────────────────────────┘
```

### Thread View

```
┌─ Thread: Project Discussion ───────────┐
│ @alice, @bob, @you                     │
│ Platform: telegram | 47 messages       │
├────────────────────────────────────────┤
│                                        │
│ Alice (10:30):                         │
│   What's the status on the API?        │
│                                        │
│ You (10:32):                           │
│   Almost done, just fixing tests       │
│                                        │
│ Bob (10:35):                           │
│   Need any help?                       │
│                                        │
│ [↑/↓] Scroll  [r] Reply  [b] Back      │
└────────────────────────────────────────┘
```

---

## MCP Tools

```typescript
// Core operations
messages_create    // Create new message
messages_get       // Get message by ID
messages_list      // List with filters
messages_search    // Full-text search

// Thread operations
messages_thread_get      // Get thread
messages_thread_list     // List threads
messages_thread_messages // Get thread messages

// Account operations
messages_account_get     // Get account
messages_account_list    // List accounts
messages_account_link    // Link platform identity

// Import operations
messages_import_platform // Import from platform adapter
messages_import_file     // Import from export file

// Timeline operations
messages_timeline        // Get unified timeline
```

---

## Implementation Phases

### Phase 1: Foundation

- [ ] Core types (Message, Account, Thread)
- [ ] Event store (append-only JSONL)
- [ ] Content store (markdown files)
- [ ] Basic views (threads, accounts)
- [ ] SQLite FTS search

### Phase 2: Internal Adapters

- [ ] Logging adapter
- [ ] AgentNet adapter
- [ ] Journal adapter
- [ ] Git adapter

### Phase 3: TUI

- [ ] Main menu
- [ ] Timeline view
- [ ] Thread view
- [ ] Search interface

### Phase 4: External Adapters

- [ ] Export file parsers (Telegram, WhatsApp)
- [ ] Email (IMAP) adapter
- [ ] API adapters (Discord, Slack)

### Phase 5: Advanced Features

- [ ] Semantic search (embeddings)
- [ ] Real-time watching
- [ ] Export functionality
- [ ] AgentNet migration

---

## Open Questions

1. **CID Algorithm**: SHA-256? Blake3? Include timestamp in hash?
2. **Embedding Model**: Local (sentence-transformers) or API (Anthropic)?
3. **Real-time Sync**: WebSocket to external platforms? Or poll?
4. **Privacy**: Encrypt content at rest? Key management?
5. **Platform Priority**: Which external platforms first?
6. **AgentNet Migration**: Automatic or optional?

---

*This synthesis represents a starting point. Architecture should evolve based on implementation learnings and user feedback.*
