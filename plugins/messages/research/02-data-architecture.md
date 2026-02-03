# Data Architecture Patterns

*Research on Event Sourcing, CQRS, ElizaOS Schema, and Content-Addressable Storage*

## Event Sourcing

**Source**: [Microsoft Azure Patterns](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing), [microservices.io](https://microservices.io/patterns/data/event-sourcing.html)

### Core Concept

Instead of storing current state, store the sequence of events that led to that state.

```
Traditional: User { balance: 100 }

Event Sourced:
  - AccountOpened { initial: 0 }
  - DepositMade { amount: 150 }
  - WithdrawalMade { amount: 50 }
  - Current state: balance = 0 + 150 - 50 = 100
```

### Properties

| Property | Implication |
|----------|-------------|
| Append-only | Never modify, only add |
| Immutable | Events cannot be changed |
| Complete history | Full audit trail |
| Temporal queries | State at any point in time |
| Eventual consistency | Views lag behind writes |

### Event Store

```
┌─────────────────────────────────────────┐
│           EVENT STORE                    │
│  (append-only log)                       │
├─────────────────────────────────────────┤
│ [1] MessageCreated { ... }              │
│ [2] MessageEdited { ... }               │
│ [3] ReactionAdded { ... }               │
│ [4] MessageDeleted { ... }              │
│ ...                                      │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│       MATERIALIZED VIEWS                 │
├─────────────────────────────────────────┤
│ - Messages by thread                     │
│ - Messages by author                     │
│ - Unread counts                          │
│ - Search index                           │
└─────────────────────────────────────────┘
```

### Lessons for Messages Plugin

- **Append-only storage**: Messages are immutable events
- **Event versioning**: Handle schema evolution
- **Projection/view pattern**: Build read models from events
- **Replay capability**: Rebuild state from scratch

---

## CQRS (Command Query Responsibility Segregation)

**Source**: [Azure Architecture](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)

### Core Concept

Separate read and write paths:

```
Commands                      Queries
(Write)                       (Read)
   │                            │
   ▼                            ▼
┌──────────┐               ┌──────────┐
│  Write   │ ──events──→   │   Read   │
│  Model   │               │  Model   │
└──────────┘               └──────────┘
```

### Why CQRS with Event Sourcing?

Event sourcing creates challenges for queries:
- Rebuilding state is expensive
- Complex queries need denormalization

CQRS solves this:
- Write model: Append events
- Read model: Pre-computed views optimized for queries

### Example: Message System

**Write Side (Commands)**:
- CreateMessage(author, content, thread)
- EditMessage(id, newContent)
- DeleteMessage(id)
- AddReaction(messageId, emoji)

**Read Side (Queries)**:
- GetThreadMessages(threadId, limit, offset)
- GetUnreadCount(userId)
- SearchMessages(query)
- GetUserActivity(userId)

### Lessons for Messages Plugin

- **Optimize separately**: Different storage for writes vs reads
- **Eventually consistent**: Accept lag for read performance
- **Multiple projections**: Same events, different views

---

## ElizaOS Database Schema

**Source**: [ElizaOS Docs](https://docs.elizaos.ai/plugins/schemas), [GitHub](https://github.com/elizaOS/eliza)

### Core Entities

ElizaOS (formerly ai16z) models agent-centric data:

```
┌─────────────┐     ┌─────────────┐
│   Agents    │────→│  Accounts   │
└─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Rooms     │←───→│  Memories   │
└─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   Worlds    │
└─────────────┘
```

### Entity Descriptions

| Entity | Purpose |
|--------|---------|
| **Agents** | AI agent instances (config, state) |
| **Accounts** | User/entity identities |
| **Rooms** | Conversation contexts |
| **Memories** | Messages with embeddings |
| **Worlds** | Higher-level contexts/environments |

### Schema Pattern

```typescript
// Shared tables (no agentId) - accessible across agents
export const userPreferencesTable = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  preferences: jsonb('preferences').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Agent-specific tables (with agentId)
export const agentDataTable = pgTable('agent_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull(),
  key: varchar('key', { length: 255 }).notNull(),
  value: jsonb('value').notNull(),
});
```

### Memories with Embeddings

ElizaOS stores messages as "memories" with vector embeddings:

```typescript
interface Memory {
  id: string;
  roomId: string;
  userId: string;
  agentId: string;
  content: {
    text: string;
    action?: string;
    source?: string;
  };
  embedding?: number[];  // Vector for semantic search
  createdAt: Date;
  importance?: number;
}
```

### Lessons for Messages Plugin

- **Agent-centric model**: Design around agent needs
- **Rooms as contexts**: Conversations have boundaries
- **Embeddings for search**: Semantic retrieval built-in
- **Shared vs agent-specific**: Scope data appropriately

---

## Content-Addressable Storage (CAS)

**Source**: [IPFS Docs](https://docs.ipfs.tech/concepts/), [DefraDB Blog](https://open.source.network/blog/source-network-defradb-database-content-addressable-data-merkle-dags-ipld-ipfs-explainer)

### Core Concept

Address data by its content hash, not location:

```
Traditional:  /path/to/file.txt → content
CAS:          QmXyz123... → content (hash of content)
```

### Content Identifiers (CIDs)

```
       Content
          │
          ▼
    ┌───────────┐
    │  SHA-256  │
    └───────────┘
          │
          ▼
    CID: bafybeig...
```

Same content always produces same CID.

### Merkle DAGs

Build hierarchies with content-addressed nodes:

```
     Root CID
        │
   ┌────┴────┐
   ▼         ▼
CID-A      CID-B
   │         │
   ▼         ▼
Content   Content
```

Changing any node changes all ancestors.

### Properties

| Property | Benefit |
|----------|---------|
| **Immutable** | Content can't change without changing CID |
| **Verifiable** | Anyone can verify content matches CID |
| **Deduplication** | Same content = same CID = store once |
| **Self-describing** | CID encodes hash algorithm |

### Challenges

- **Mutability**: New content = new CID (need mutable pointers)
- **Garbage collection**: Which CIDs to keep?
- **Discovery**: How to find CIDs for content you want?

### Lessons for Messages Plugin

- **Content-addressed messages**: Immutable, verifiable
- **Merkle tree for threads**: Efficient sync, tamper-evident
- **Deduplication**: Store identical messages once
- **Mutable heads**: Use pointers (like git branches) for latest state

---

## Synthesis: Storage Architecture

Combining these patterns for the Messages plugin:

### Event Store (Append-Only)

```
.claude/messages/events/
├── 2025/12/17/
│   ├── 001.jsonl  # Day's events (append-only)
│   └── index.json # Daily summary
└── archive/
    └── ...
```

### Content Store (CAS)

```
.claude/messages/content/
├── by-cid/
│   ├── bafyabc123.md  # Message content
│   └── bafydef456.md
└── blobs/
    └── ...  # Large attachments
```

### Read Models (Projections)

```
.claude/messages/views/
├── threads/
│   └── thread-001/
│       └── index.md  # Thread with message list
├── accounts/
│   └── alice.md      # Account profile + stats
├── by-platform/
│   ├── telegram.json
│   └── claude-code.json
└── search/
    └── index.db      # SQLite FTS for search
```

### Schema (Simplified)

```typescript
interface Message {
  // Identity
  cid: string;              // Content-addressed ID

  // Authorship
  account_id: string;       // Local account reference
  author_did?: string;      // Portable DID if known

  // Temporal
  created_at: number;       // Unix timestamp
  imported_at?: number;     // When we received it

  // Classification
  kind: number;             // Message type

  // Content
  content: string;          // Body text

  // Structure
  thread_id?: string;       // Conversation thread
  reply_to?: string;        // Parent message CID
  room_id?: string;         // Channel/group context

  // Source
  source: {
    platform: string;       // Origin platform
    platform_id?: string;   // ID in source system
    url?: string;           // Source URL if applicable
  };

  // Metadata
  tags?: [string, ...string[]][];
  embedding?: number[];     // For semantic search
}
```

---

## Sources

- [Event Sourcing Pattern - Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [CQRS Pattern - Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [microservices.io - Event Sourcing](https://microservices.io/patterns/data/event-sourcing.html)
- [ElizaOS Documentation](https://docs.elizaos.ai/)
- [IPFS Merkle DAG](https://docs.ipfs.io/concepts/merkle-dag/)
- [IPFS How It Works](https://docs.ipfs.tech/concepts/how-ipfs-works/)
