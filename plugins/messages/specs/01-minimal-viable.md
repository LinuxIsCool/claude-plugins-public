# Minimal Viable Architecture

*Fast path to working messages plugin with content-addressed storage*

## Overview

| Aspect | Decision |
|--------|----------|
| **Timeline** | 2-3 days |
| **Lines of Code** | ~1,720 |
| **CID Algorithm** | SHA-256 + base58 |
| **Identity** | did:key with Ed25519 |
| **Storage** | JSONL events + markdown content |
| **Search** | SQLite FTS5 |

## Core Principles

1. **Ship fast, iterate later** - Get working code before optimization
2. **Simple CIDs** - SHA-256 hash, no IPFS compatibility needed yet
3. **Minimal dependencies** - Just Bun standard library + SQLite
4. **File-based everything** - No external databases or services

---

## File Structure

```
plugins/messages/
├── .claude-plugin/
│   └── plugin.json
├── src/
│   ├── types/
│   │   └── index.ts           # Core interfaces (~200 lines)
│   ├── core/
│   │   ├── cid.ts             # CID generation (~80 lines)
│   │   ├── did.ts             # DID handling (~100 lines)
│   │   ├── store.ts           # Event store (~300 lines)
│   │   └── views.ts           # Materialized views (~200 lines)
│   ├── adapters/
│   │   ├── base.ts            # Adapter interface (~50 lines)
│   │   ├── telegram.ts        # Telegram export parser (~250 lines)
│   │   └── email.ts           # Email import (~200 lines)
│   ├── search/
│   │   └── index.ts           # SQLite FTS5 (~150 lines)
│   └── cli.ts                 # CLI entry point (~200 lines)
├── skills/
│   └── messages-master/
│       └── SKILL.md
└── commands/
    └── messages.md
```

**Total: ~1,720 lines**

---

## Type Definitions

```typescript
// src/types/index.ts

/**
 * Content Identifier - SHA-256 hash of message content
 */
export type CID = string;  // Format: "msg_" + base58(sha256(content))

/**
 * Decentralized Identifier
 */
export type DID = string;  // Format: "did:key:z..." (Ed25519 multibase)

/**
 * Message Kind numbers (Nostr-inspired)
 */
export enum Kind {
  // Core (0-99)
  AccountMetadata = 0,
  TextMessage = 1,
  LongForm = 2,
  Media = 3,
  Reaction = 5,
  Deletion = 6,

  // Claude Code (100-199)
  SessionStart = 100,
  SessionEnd = 101,
  UserPrompt = 102,
  AssistantResponse = 103,
  ToolUse = 104,
  SubagentSpawn = 105,

  // Git (200-249)
  Commit = 200,
  Branch = 201,

  // Platform (1000+)
  Telegram = 1000,
  WhatsApp = 1001,
  Email = 1010,
}

/**
 * Core Message structure
 */
export interface Message {
  // Identity
  id: CID;                      // Content-addressed ID

  // Authorship
  account_id: string;           // Local account reference
  author: {
    did?: DID;                  // Portable identity
    name?: string;              // Display name
    handle?: string;            // Platform handle
  };

  // Temporal
  created_at: number;           // Unix timestamp (original)
  imported_at: number;          // When we received it

  // Classification
  kind: Kind;
  visibility?: "public" | "private" | "direct";

  // Content
  content: string;              // Message body (markdown)
  title?: string;               // Optional title

  // Structure
  refs: {
    thread_id?: string;         // Conversation thread
    reply_to?: CID;             // Parent message
    room_id?: string;           // Channel/group
    mentions?: string[];        // Account IDs
  };

  // Source
  source: {
    platform: string;           // Origin (telegram, claude-code, etc.)
    platform_id?: string;       // ID in source system
    url?: string;               // Source URL
  };

  // Metadata
  tags?: [string, string][];    // Key-value pairs
}

/**
 * Account (identity across platforms)
 */
export interface Account {
  id: string;                   // Local ID
  did?: DID;                    // Portable identity
  name: string;                 // Display name
  avatar?: string;              // Emoji or path

  identities: {
    platform: string;
    handle: string;
    verified?: boolean;
  }[];

  created_at: number;
  stats?: {
    message_count: number;
    last_active?: number;
  };
}

/**
 * Thread (conversation container)
 */
export interface Thread {
  id: string;
  title?: string;
  participants: string[];       // Account IDs
  type: "dm" | "group" | "channel" | "topic";

  source: {
    platform: string;
    platform_id?: string;
  };

  created_at: number;
  last_message_at?: number;
  message_count: number;
}
```

---

## CID Generation

```typescript
// src/core/cid.ts

import { createHash } from "crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  let num = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let result = "";
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)] + result;
    num = num / 58n;
  }
  return result || "1";
}

/**
 * Generate content-addressed ID for a message
 */
export function generateCID(content: string, kind: number, created_at: number): string {
  const payload = JSON.stringify({ content, kind, created_at });
  const hash = createHash("sha256").update(payload).digest();
  return "msg_" + base58Encode(hash).slice(0, 32);
}

/**
 * Verify a CID matches content
 */
export function verifyCID(cid: string, content: string, kind: number, created_at: number): boolean {
  return cid === generateCID(content, kind, created_at);
}
```

---

## DID Generation

```typescript
// src/core/did.ts

import { generateKeyPairSync, sign, verify } from "crypto";

const MULTICODEC_ED25519_PUB = new Uint8Array([0xed, 0x01]);

/**
 * Generate a new DID with keypair
 */
export function generateDID(): { did: DID; privateKey: Buffer } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  const pubKeyRaw = publicKey.export({ type: "spki", format: "der" }).slice(-32);
  const multicodecKey = Buffer.concat([MULTICODEC_ED25519_PUB, pubKeyRaw]);
  const multibase = "z" + base58Encode(multicodecKey);

  return {
    did: `did:key:${multibase}`,
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }),
  };
}

/**
 * Sign content with DID private key
 */
export function signWithDID(content: string, privateKey: Buffer): string {
  const signature = sign(null, Buffer.from(content), {
    key: privateKey,
    format: "der",
    type: "pkcs8",
  });
  return base58Encode(signature);
}
```

---

## Event Store

```typescript
// src/core/store.ts

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { generateCID } from "./cid";
import type { Message, Account, Thread } from "../types";

const BASE_PATH = ".claude/messages";

interface Event {
  ts: string;
  op: "create" | "update" | "delete";
  entity: "message" | "account" | "thread";
  data: Message | Account | Thread;
}

export class MessageStore {
  private basePath: string;

  constructor(basePath = BASE_PATH) {
    this.basePath = basePath;
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const dirs = [
      "store/events",
      "store/content",
      "views/threads",
      "views/accounts",
      "views/timeline",
      "search",
    ];
    for (const dir of dirs) {
      const path = join(this.basePath, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
  }

  /**
   * Append event to daily log
   */
  private appendEvent(event: Event): void {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const eventDir = join(this.basePath, "store/events", String(year), month, day);
    if (!existsSync(eventDir)) {
      mkdirSync(eventDir, { recursive: true });
    }

    const eventFile = join(eventDir, "events.jsonl");
    appendFileSync(eventFile, JSON.stringify(event) + "\n");
  }

  /**
   * Create a new message
   */
  async createMessage(input: Omit<Message, "id" | "imported_at">): Promise<Message> {
    const id = generateCID(input.content, input.kind, input.created_at);
    const message: Message = {
      ...input,
      id,
      imported_at: Date.now(),
    };

    // Append to event log
    this.appendEvent({
      ts: new Date().toISOString(),
      op: "create",
      entity: "message",
      data: message,
    });

    // Write content file
    this.writeContentFile(message);

    // Update views
    await this.updateViews(message);

    return message;
  }

  /**
   * Write message as markdown content file
   */
  private writeContentFile(message: Message): void {
    const prefix = message.id.slice(4, 6);  // First 2 chars after "msg_"
    const contentDir = join(this.basePath, "store/content", prefix);
    if (!existsSync(contentDir)) {
      mkdirSync(contentDir, { recursive: true });
    }

    const frontmatter = {
      id: message.id,
      kind: message.kind,
      account_id: message.account_id,
      created_at: message.created_at,
      source: message.source,
      refs: message.refs,
      tags: message.tags,
    };

    const content = `---
${Object.entries(frontmatter)
  .filter(([_, v]) => v !== undefined)
  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
  .join("\n")}
---

${message.content}
`;

    const file = join(contentDir, `${message.id}.md`);
    Bun.write(file, content);
  }

  /**
   * Update materialized views
   */
  private async updateViews(message: Message): Promise<void> {
    // Update thread view
    if (message.refs.thread_id) {
      await this.updateThreadView(message);
    }

    // Update timeline
    await this.updateTimelineView(message);

    // Update search index
    await this.indexMessage(message);
  }

  // ... additional view update methods
}
```

---

## Telegram Adapter

```typescript
// src/adapters/telegram.ts

import type { Message, Account, Thread } from "../types";
import { Kind } from "../types";

interface TelegramExport {
  name: string;
  type: string;
  id: number;
  messages: TelegramMessage[];
}

interface TelegramMessage {
  id: number;
  type: string;
  date: string;
  from: string;
  from_id: string;
  text: string | { type: string; text: string }[];
}

/**
 * Import messages from Telegram JSON export
 */
export async function* importTelegramExport(
  filePath: string,
  store: MessageStore
): AsyncGenerator<Message> {
  const data: TelegramExport = JSON.parse(await Bun.file(filePath).text());

  // Create thread for this chat
  const thread: Thread = {
    id: `tg_${data.id}`,
    title: data.name,
    participants: [],
    type: data.type === "personal_chat" ? "dm" : "group",
    source: { platform: "telegram", platform_id: String(data.id) },
    created_at: Date.now(),
    message_count: data.messages.length,
  };

  // Track accounts
  const accounts = new Map<string, Account>();

  for (const msg of data.messages) {
    // Extract text content
    let content = "";
    if (typeof msg.text === "string") {
      content = msg.text;
    } else if (Array.isArray(msg.text)) {
      content = msg.text.map(t => typeof t === "string" ? t : t.text).join("");
    }

    if (!content) continue;

    // Get or create account
    const accountId = `tg_${msg.from_id}`;
    if (!accounts.has(accountId)) {
      accounts.set(accountId, {
        id: accountId,
        name: msg.from,
        identities: [{ platform: "telegram", handle: msg.from }],
        created_at: Date.now(),
      });
    }

    const message: Omit<Message, "id" | "imported_at"> = {
      kind: Kind.Telegram,
      content,
      account_id: accountId,
      author: { name: msg.from, handle: msg.from },
      created_at: new Date(msg.date).getTime(),
      refs: { thread_id: thread.id },
      source: {
        platform: "telegram",
        platform_id: String(msg.id),
      },
    };

    yield await store.createMessage(message);
  }
}
```

---

## SQLite FTS5 Search

```typescript
// src/search/index.ts

import { Database } from "bun:sqlite";
import type { Message } from "../types";

export class SearchIndex {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id,
        content,
        account_name,
        platform,
        tags,
        tokenize='porter'
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS messages_meta (
        id TEXT PRIMARY KEY,
        kind INTEGER,
        created_at INTEGER,
        thread_id TEXT,
        data TEXT
      )
    `);
  }

  index(message: Message): void {
    this.db.run(
      `INSERT OR REPLACE INTO messages_fts (id, content, account_name, platform, tags)
       VALUES (?, ?, ?, ?, ?)`,
      [
        message.id,
        message.content,
        message.author.name || "",
        message.source.platform,
        message.tags?.map(([k, v]) => `${k}:${v}`).join(" ") || "",
      ]
    );

    this.db.run(
      `INSERT OR REPLACE INTO messages_meta (id, kind, created_at, thread_id, data)
       VALUES (?, ?, ?, ?, ?)`,
      [
        message.id,
        message.kind,
        message.created_at,
        message.refs.thread_id || null,
        JSON.stringify(message),
      ]
    );
  }

  search(query: string, limit = 50): Message[] {
    const rows = this.db.query(`
      SELECT m.data
      FROM messages_fts f
      JOIN messages_meta m ON f.id = m.id
      WHERE messages_fts MATCH ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(query, limit) as { data: string }[];

    return rows.map(r => JSON.parse(r.data));
  }
}
```

---

## CLI Interface

```typescript
// src/cli.ts

import { parseArgs } from "util";
import { MessageStore } from "./core/store";
import { SearchIndex } from "./search";
import { importTelegramExport } from "./adapters/telegram";

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    file: { type: "string", short: "f" },
    limit: { type: "string", short: "l" },
  },
  allowPositionals: true,
});

const [command, ...args] = positionals;
const store = new MessageStore();
const search = new SearchIndex(".claude/messages/search/index.db");

switch (command) {
  case "import": {
    const [platform] = args;
    if (platform === "telegram" && values.file) {
      let count = 0;
      for await (const msg of importTelegramExport(values.file, store)) {
        search.index(msg);
        count++;
        if (count % 100 === 0) console.log(`Imported ${count} messages...`);
      }
      console.log(`Done. Imported ${count} messages.`);
    }
    break;
  }

  case "search": {
    const query = args.join(" ");
    const results = search.search(query, Number(values.limit) || 20);
    for (const msg of results) {
      console.log(`[${new Date(msg.created_at).toISOString()}] ${msg.author.name}: ${msg.content.slice(0, 100)}`);
    }
    break;
  }

  case "thread": {
    const [threadId] = args;
    // ... show thread messages
    break;
  }

  default:
    console.log(`
Messages CLI

Commands:
  import telegram --file <export.json>  Import Telegram export
  search <query>                        Search messages
  thread <id>                           View thread
  timeline                              Show recent messages
`);
}
```

---

## What This Gets You

| Feature | Status |
|---------|--------|
| Content-addressed messages | Yes (SHA-256 CIDs) |
| DID-based identity | Yes (did:key Ed25519) |
| Telegram import | Yes |
| Email import | Basic |
| Full-text search | Yes (SQLite FTS5) |
| CLI interface | Yes |
| TUI browser | No (Phase 2) |
| Agent-to-agent | No (Phase 3) |
| IPFS compatibility | No (not needed yet) |

---

## Upgrade Path

This minimal architecture is designed for easy extension:

1. **CIDs**: Swap SHA-256 for CIDv1 with multicodec
2. **DIDs**: Add DID Document resolution
3. **Storage**: Add optional Merkle DAG
4. **Search**: Add vector embeddings for semantic search
5. **Adapters**: Add more platforms
6. **TUI**: Add Ink-based terminal interface

The core abstractions (Message, Account, Thread, Store, Adapter) remain stable.
