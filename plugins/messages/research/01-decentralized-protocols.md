# Decentralized Messaging Protocols

*Research on Nostr, ATProtocol, ActivityPub, and Matrix*

## Nostr (Notes and Other Stuff Transmitted by Relays)

**Source**: [nostr.how](https://nostr.how/en/the-protocol), [GitHub NIPs](https://github.com/nostr-protocol/nips)

### Core Architecture

Nostr is radically simple - two components only:
- **Clients**: User interfaces for reading/writing
- **Relays**: WebSocket servers that store and forward events

No blockchain, no consensus, no tokens. Just cryptographic signatures and dumb pipes.

### Event Structure

Every piece of data in Nostr is a JSON event:

```json
{
  "id": "<sha256 hash of serialized event>",
  "pubkey": "<author's public key>",
  "created_at": 1234567890,
  "kind": 1,
  "tags": [
    ["e", "<event_id>", "<relay>"],
    ["p", "<pubkey>"]
  ],
  "content": "Hello, world!",
  "sig": "<schnorr signature>"
}
```

### Event Kinds

| Kind | Description |
|------|-------------|
| 0 | User metadata (profile) |
| 1 | Short text notes |
| 3 | Follow lists |
| 4 | Encrypted DMs (deprecated) |
| 5 | Event deletion requests |
| 7 | Reactions |
| 14 | Private DMs (NIP-17) |
| 23 | Long-form articles |
| 9734/9735 | Zaps (Lightning payments) |

### Client-Relay Protocol

```
Client → Relay: ["EVENT", <event>]           # Publish
Client → Relay: ["REQ", <sub_id>, <filter>]  # Subscribe
Client → Relay: ["CLOSE", <sub_id>]          # Unsubscribe

Relay → Client: ["EVENT", <sub_id>, <event>] # Deliver
Relay → Client: ["EOSE", <sub_id>]           # End of stored events
Relay → Client: ["OK", <event_id>, <bool>]   # Ack/Nack
```

### Lessons for Messages Plugin

- **Simplicity**: One universal event type handles everything
- **Self-verification**: Events are signed, any relay can be used
- **Tag-based linking**: `["e", id]` and `["p", pubkey]` create graphs
- **Extensibility**: New kinds don't break old clients
- **No server state**: Relays don't need to understand content

---

## ATProtocol (Authenticated Transfer Protocol)

**Source**: [Bluesky docs](https://atproto.com/), AT Protocol specification

### Core Concepts

ATProtocol separates concerns:
- **Identity**: DIDs (Decentralized Identifiers) are portable
- **Data**: Repositories are signed Merkle trees
- **Federation**: Relays aggregate, App Views index
- **Schema**: Lexicons define types

### Identity Model

```
DID (did:plc:xyz123...) ←→ Handle (@user.bsky.social)
     ↓
  Repository (user's data)
     ↓
  Collections (app.bsky.feed.post, etc.)
     ↓
  Records (individual posts, likes, etc.)
```

Users own their DID. Handles are DNS-verified aliases. Hosting can move; identity stays.

### Repository Structure

Every user has a signed Merkle tree:

```
Repository Root
├── Collection: app.bsky.feed.post
│   ├── record/1 → {text: "Hello", ...}
│   └── record/2 → {text: "World", ...}
├── Collection: app.bsky.graph.follow
│   └── record/abc → {subject: "did:plc:other"}
└── ... other collections
```

### Lexicons (Schema System)

```json
{
  "lexicon": 1,
  "id": "app.bsky.feed.post",
  "defs": {
    "main": {
      "type": "record",
      "record": {
        "type": "object",
        "required": ["text", "createdAt"],
        "properties": {
          "text": {"type": "string", "maxLength": 300},
          "createdAt": {"type": "string", "format": "datetime"}
        }
      }
    }
  }
}
```

### Lessons for Messages Plugin

- **Portable identity**: Accounts aren't tied to platforms
- **Merkle tree verification**: History is tamper-evident
- **Schema evolution**: Lexicons allow forward/backward compatibility
- **Collection-based organization**: Messages grouped by type

---

## ActivityPub

**Source**: [W3C Spec](https://www.w3.org/TR/activitypub/), [Wikipedia](https://en.wikipedia.org/wiki/ActivityPub)

### Core Model

Three concepts:
- **Actors**: Users, groups, applications (have inbox/outbox)
- **Activities**: Actions (Create, Update, Delete, Follow, Like, etc.)
- **Objects**: Content being acted on (Note, Article, Image, etc.)

### Inbox/Outbox Pattern

```
Actor A                    Actor B
[Outbox] ─── POST ───→ [Inbox]
    ↑                      ↓
 Client                 Server
 writes                 reads
```

- **Outbox**: What an actor has sent
- **Inbox**: What others have sent to the actor

### Activity Wrapper

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "actor": "https://example.com/users/alice",
  "object": {
    "type": "Note",
    "content": "Hello, world!"
  },
  "to": ["https://example.com/users/bob"]
}
```

### Federation

Servers push activities to remote inboxes:
1. Actor creates activity in outbox
2. Server determines recipients
3. Server POSTs to recipient inboxes
4. Recipient servers deliver to local users

### Lessons for Messages Plugin

- **Activity wrapping**: Separate action from content
- **Inbox/outbox semantics**: Clear message flow
- **JSON-LD context**: Extensible vocabulary
- **Async delivery**: Federation is eventually consistent

---

## Matrix Protocol

**Source**: [matrix.org](https://matrix.org/), [Matrix Spec](https://spec.matrix.org/)

### Core Architecture

Matrix is about rooms and events:
- **Homeservers**: Host accounts, run algorithms
- **Rooms**: Shared state machines
- **Events**: Immutable, ordered in DAG
- **Federation**: DAG replication

### Room Event DAG

Events form a directed acyclic graph:

```
    [E1] ←── [E2] ←── [E3]
      ↑        ↑        ↑
      └── [E4] ─┴── [E5] ┘
              ↑
          [E6]
```

- Events reference parents (creates ordering)
- Forks happen (parallel submissions)
- State resolution merges forks

### Event Structure

```json
{
  "room_id": "!room:example.com",
  "event_id": "$event123",
  "type": "m.room.message",
  "sender": "@alice:example.com",
  "origin_server_ts": 1234567890,
  "content": {
    "msgtype": "m.text",
    "body": "Hello, world!"
  },
  "auth_events": ["$auth1", "$auth2"],
  "prev_events": ["$prev1"]
}
```

### State Resolution

When events conflict:
1. Collect all events up to a point
2. Apply deterministic algorithm
3. Result is same regardless of order received

### Lessons for Messages Plugin

- **Event DAG**: No central authority for ordering
- **Room-based conversations**: Natural threading
- **State events vs timeline**: Metadata vs content
- **Eventual consistency**: Sync without coordination

---

## Synthesis: Universal Event Structure

Combining lessons from all protocols, a universal message might look like:

```typescript
interface UniversalMessage {
  // Identity (from ATProtocol)
  id: string;          // Content-addressable hash
  author: string;      // DID or public key

  // Temporal (from Nostr)
  created_at: number;  // Unix timestamp

  // Classification (from Nostr)
  kind: number;        // Extensible type

  // Relationships (from Matrix)
  refs: {
    thread?: string;   // Conversation thread
    reply_to?: string; // Specific message
    room?: string;     // Context/channel
  };

  // Content (from ActivityPub)
  content: string;     // The message body

  // Metadata (flexible)
  tags: [string, ...string[]][];  // Key-value pairs

  // Verification (from Nostr)
  sig?: string;        // Optional signature

  // Source tracking (ecosystem-specific)
  source: {
    platform: string;  // telegram, whatsapp, claude-code, etc.
    platform_id?: string;
    imported_at?: string;
  };
}
```

This structure can represent:
- Chat messages (kind=1, content=text)
- Emails (kind=10, content=body, tags=[["subject", "..."], ["from", "..."]])
- Claude Code events (kind=100, content=data, source.platform="claude-code")
- URL reads (kind=20, content=extracted, tags=[["url", "..."]])
- Forum posts (kind=30, content=body, refs.thread=topic_id)

---

## Sources

- [The Nostr Protocol](https://nostr.how/en/the-protocol)
- [Nostr NIPs](https://github.com/nostr-protocol/nips)
- [W3C ActivityPub](https://www.w3.org/TR/activitypub/)
- [Matrix.org](https://matrix.org/)
- [Matrix Specification](https://spec.matrix.org/latest/)
- [ATProtocol](https://atproto.com/)
