# Pragmatic Phased Architecture

*Incremental delivery with working software at each phase*

## Overview

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1** | 3 days | Basic store + Telegram import |
| **Phase 2** | 2 days | CIDs + Email import |
| **Phase 3** | 1.5 days | DIDs + Claude Code adapter |
| **Phase 4** | 2.5 days | TUI browser |
| **Total** | ~9 days | Complete plugin |

## Core Philosophy

1. **Working software over documentation** - Each phase produces usable code
2. **Incremental complexity** - Start simple, add features
3. **Validate early** - Telegram import proves the model works
4. **User feedback** - TUI comes last after core is stable

---

## Phase 1: Foundation + Telegram (3 days)

### Goal
Working message store with Telegram import and basic search.

### Deliverables

```
plugins/messages/
├── .claude-plugin/
│   └── plugin.json
├── src/
│   ├── types/
│   │   └── index.ts           # Core types
│   ├── core/
│   │   └── store.ts           # Simple JSONL store
│   ├── adapters/
│   │   └── telegram.ts        # Telegram export parser
│   ├── search/
│   │   └── fts.ts             # SQLite FTS5
│   └── cli.ts                 # Basic CLI
├── skills/
│   └── messages-master/
│       └── SKILL.md
└── package.json
```

### Types (Simple UUIDs for now)

```typescript
// src/types/index.ts

export interface Message {
  id: string;                   // UUID (upgrade to CID in Phase 2)
  kind: number;
  content: string;

  account_id: string;
  author_name?: string;

  created_at: number;
  imported_at: number;

  thread_id?: string;
  reply_to?: string;

  platform: string;
  platform_id?: string;

  tags?: Record<string, string>;
}

export interface Account {
  id: string;
  name: string;
  platform: string;
  handle?: string;
  created_at: number;
}

export interface Thread {
  id: string;
  title?: string;
  platform: string;
  message_count: number;
  created_at: number;
  last_message_at?: number;
}

// Kind numbers
export const Kind = {
  Text: 1,
  Telegram: 1000,
  Email: 1010,
} as const;
```

### Store (Append-only JSONL)

```typescript
// src/core/store.ts

import { join } from "path";
import type { Message, Account, Thread } from "../types";

const BASE_PATH = ".claude/messages";

export class MessageStore {
  private basePath: string;

  constructor(basePath = BASE_PATH) {
    this.basePath = basePath;
    this.ensureDirs();
  }

  private ensureDirs() {
    const dirs = ["events", "content", "views/threads", "views/accounts", "search"];
    for (const dir of dirs) {
      Bun.spawnSync(["mkdir", "-p", join(this.basePath, dir)]);
    }
  }

  async createMessage(input: Omit<Message, "id" | "imported_at">): Promise<Message> {
    const message: Message = {
      ...input,
      id: crypto.randomUUID(),  // UUID for Phase 1
      imported_at: Date.now(),
    };

    // Append to daily event log
    const today = new Date().toISOString().split("T")[0];
    const eventFile = join(this.basePath, "events", `${today}.jsonl`);
    await Bun.write(eventFile, JSON.stringify({ op: "create", message }) + "\n", { append: true });

    // Write content file
    await this.writeContent(message);

    return message;
  }

  private async writeContent(message: Message) {
    const contentDir = join(this.basePath, "content", message.id.slice(0, 2));
    Bun.spawnSync(["mkdir", "-p", contentDir]);

    const file = join(contentDir, `${message.id}.json`);
    await Bun.write(file, JSON.stringify(message, null, 2));
  }

  async getMessage(id: string): Promise<Message | null> {
    const file = join(this.basePath, "content", id.slice(0, 2), `${id}.json`);
    try {
      return await Bun.file(file).json();
    } catch {
      return null;
    }
  }

  async *listMessages(filter?: { platform?: string; since?: number }): AsyncIterable<Message> {
    const eventFiles = await this.getEventFiles();

    for (const file of eventFiles) {
      const text = await Bun.file(file).text();
      for (const line of text.trim().split("\n")) {
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.op === "create") {
          const msg = event.message as Message;
          if (filter?.platform && msg.platform !== filter.platform) continue;
          if (filter?.since && msg.created_at < filter.since) continue;
          yield msg;
        }
      }
    }
  }

  private async getEventFiles(): Promise<string[]> {
    const eventsDir = join(this.basePath, "events");
    const glob = new Bun.Glob("*.jsonl");
    const files: string[] = [];
    for await (const file of glob.scan(eventsDir)) {
      files.push(join(eventsDir, file));
    }
    return files.sort();
  }
}
```

### Telegram Adapter

```typescript
// src/adapters/telegram.ts

import type { Message, Account, Thread } from "../types";
import { Kind } from "../types";
import { MessageStore } from "../core/store";

interface TelegramExport {
  name: string;
  type: string;
  id: number;
  messages: {
    id: number;
    type: string;
    date: string;
    from: string;
    from_id: string;
    text: string | { type: string; text: string }[];
  }[];
}

export async function* importTelegram(
  filePath: string,
  store: MessageStore
): AsyncGenerator<Message> {
  const data: TelegramExport = await Bun.file(filePath).json();
  const threadId = `tg_${data.id}`;

  for (const msg of data.messages) {
    if (msg.type !== "message") continue;

    let content = "";
    if (typeof msg.text === "string") {
      content = msg.text;
    } else if (Array.isArray(msg.text)) {
      content = msg.text.map(t => typeof t === "string" ? t : t.text).join("");
    }

    if (!content.trim()) continue;

    const message = await store.createMessage({
      kind: Kind.Telegram,
      content,
      account_id: `tg_${msg.from_id}`,
      author_name: msg.from,
      created_at: new Date(msg.date).getTime(),
      thread_id: threadId,
      platform: "telegram",
      platform_id: String(msg.id),
    });

    yield message;
  }
}
```

### Search

```typescript
// src/search/fts.ts

import { Database } from "bun:sqlite";
import type { Message } from "../types";

export class SearchIndex {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        id UNINDEXED,
        content,
        author_name,
        platform,
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

  index(message: Message) {
    this.db.run(
      `INSERT OR REPLACE INTO messages_fts VALUES (?, ?, ?, ?)`,
      [message.id, message.content, message.author_name || "", message.platform]
    );

    this.db.run(
      `INSERT OR REPLACE INTO messages_meta VALUES (?, ?, ?, ?, ?)`,
      [message.id, message.kind, message.created_at, message.thread_id || null, JSON.stringify(message)]
    );
  }

  search(query: string, limit = 20): Message[] {
    const rows = this.db.query(`
      SELECT m.data FROM messages_fts f
      JOIN messages_meta m ON f.id = m.id
      WHERE messages_fts MATCH ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(query, limit) as { data: string }[];

    return rows.map(r => JSON.parse(r.data));
  }
}
```

### CLI

```typescript
// src/cli.ts

import { parseArgs } from "util";
import { MessageStore } from "./core/store";
import { SearchIndex } from "./search/fts";
import { importTelegram } from "./adapters/telegram";

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    file: { type: "string", short: "f" },
    limit: { type: "string", short: "l" },
  },
  allowPositionals: true,
});

const [cmd, ...args] = positionals;
const store = new MessageStore();
const search = new SearchIndex(".claude/messages/search/index.db");

switch (cmd) {
  case "import": {
    const [platform] = args;
    if (platform === "telegram" && values.file) {
      let count = 0;
      for await (const msg of importTelegram(values.file, store)) {
        search.index(msg);
        count++;
        if (count % 100 === 0) console.log(`Imported ${count}...`);
      }
      console.log(`Done: ${count} messages`);
    }
    break;
  }

  case "search": {
    const results = search.search(args.join(" "), Number(values.limit) || 20);
    for (const msg of results) {
      const date = new Date(msg.created_at).toISOString().slice(0, 16);
      console.log(`[${date}] ${msg.author_name}: ${msg.content.slice(0, 80)}`);
    }
    break;
  }

  case "list": {
    let count = 0;
    for await (const msg of store.listMessages()) {
      if (count++ >= (Number(values.limit) || 20)) break;
      const date = new Date(msg.created_at).toISOString().slice(0, 16);
      console.log(`[${date}] ${msg.author_name}: ${msg.content.slice(0, 80)}`);
    }
    break;
  }

  default:
    console.log(`
Messages CLI - Phase 1

Commands:
  import telegram -f <file>   Import Telegram export
  search <query>              Search messages
  list [-l N]                 List recent messages
`);
}
```

### Phase 1 Validation

Run these commands to verify:

```bash
# Import a Telegram export
bun src/cli.ts import telegram -f ~/Downloads/telegram_export.json

# Search
bun src/cli.ts search "meeting"

# List recent
bun src/cli.ts list -l 10
```

---

## Phase 2: CIDs + Email (2 days)

### Changes

1. **Replace UUID with CID** in message creation
2. **Add content verification**
3. **Email adapter** (IMAP or .eml files)

### CID Upgrade

```typescript
// src/core/cid.ts

import { createHash } from "crypto";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Encode(bytes: Uint8Array): string {
  let num = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  let result = "";
  while (num > 0n) {
    result = BASE58[Number(num % 58n)] + result;
    num /= 58n;
  }
  return result || "1";
}

export function generateCID(content: string, kind: number, created_at: number): string {
  const payload = JSON.stringify({ content, kind, created_at });
  const hash = createHash("sha256").update(payload).digest();
  return "msg_" + base58Encode(hash).slice(0, 32);
}

export function verifyCID(cid: string, content: string, kind: number, created_at: number): boolean {
  return cid === generateCID(content, kind, created_at);
}
```

### Store Update

```typescript
// Update in store.ts

import { generateCID } from "./cid";

async createMessage(input: Omit<Message, "id" | "imported_at">): Promise<Message> {
  const message: Message = {
    ...input,
    id: generateCID(input.content, input.kind, input.created_at),  // CID instead of UUID
    imported_at: Date.now(),
  };
  // ... rest unchanged
}
```

### Email Adapter

```typescript
// src/adapters/email.ts

import { simpleParser } from "mailparser";
import type { Message } from "../types";
import { Kind } from "../types";
import { MessageStore } from "../core/store";

export async function* importEmlFiles(
  dirPath: string,
  store: MessageStore
): AsyncGenerator<Message> {
  const glob = new Bun.Glob("*.eml");

  for await (const file of glob.scan(dirPath)) {
    const content = await Bun.file(`${dirPath}/${file}`).text();
    const parsed = await simpleParser(content);

    const message = await store.createMessage({
      kind: Kind.Email,
      content: parsed.text || parsed.html || "",
      account_id: `email_${parsed.from?.value[0]?.address || "unknown"}`,
      author_name: parsed.from?.value[0]?.name,
      created_at: parsed.date?.getTime() || Date.now(),
      platform: "email",
      platform_id: parsed.messageId || file,
      tags: {
        subject: parsed.subject || "",
      },
    });

    yield message;
  }
}
```

---

## Phase 3: DIDs + Claude Code (1.5 days)

### Changes

1. **Add DID support** to accounts
2. **Claude Code logging adapter**
3. **Agent identity integration**

### DID Implementation

```typescript
// src/core/did.ts

import { generateKeyPairSync } from "crypto";

const MULTICODEC_ED25519 = new Uint8Array([0xed, 0x01]);

export function generateDID(): { did: string; privateKey: Buffer } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubRaw = publicKey.export({ type: "spki", format: "der" }).slice(-32);
  const multikey = Buffer.concat([Buffer.from(MULTICODEC_ED25519), pubRaw]);
  const did = `did:key:z${base58Encode(multikey)}`;

  return { did, privateKey: privateKey.export({ type: "pkcs8", format: "der" }) };
}
```

### Logging Adapter

```typescript
// src/adapters/logging.ts

import type { Message } from "../types";
import { MessageStore } from "../core/store";

const Kind = {
  UserPrompt: 102,
  AssistantResponse: 103,
  ToolUse: 104,
};

interface LogEvent {
  ts: string;
  type: string;
  session_id: string;
  data: Record<string, unknown>;
}

export async function* importLogging(
  logDir: string,
  store: MessageStore
): AsyncGenerator<Message> {
  const glob = new Bun.Glob("**/*.jsonl");

  for await (const file of glob.scan(logDir)) {
    const text = await Bun.file(`${logDir}/${file}`).text();

    for (const line of text.trim().split("\n")) {
      if (!line) continue;
      const event: LogEvent = JSON.parse(line);

      const msg = eventToMessage(event);
      if (msg) {
        yield await store.createMessage(msg);
      }
    }
  }
}

function eventToMessage(event: LogEvent): Omit<Message, "id" | "imported_at"> | null {
  switch (event.type) {
    case "UserPromptSubmit":
      return {
        kind: Kind.UserPrompt,
        content: String(event.data.prompt || ""),
        account_id: "user",
        author_name: "User",
        created_at: new Date(event.ts).getTime(),
        platform: "claude-code",
        platform_id: event.session_id,
        tags: { session: event.session_id },
      };

    // ... handle other event types

    default:
      return null;
  }
}
```

---

## Phase 4: TUI Browser (2.5 days)

### Technology
- **Ink** - React for CLIs
- **ink-select-input** - Menu selection
- **ink-text-input** - Search input

### Main App

```typescript
// src/tui/app.tsx

import React, { useState } from "react";
import { render, Box, Text } from "ink";
import SelectInput from "ink-select-input";
import { Timeline } from "./timeline";
import { ThreadView } from "./thread";
import { SearchView } from "./search";

type View = "menu" | "timeline" | "threads" | "search";

function App() {
  const [view, setView] = useState<View>("menu");

  if (view === "menu") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Messages</Text>
        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: "[1] Timeline", value: "timeline" },
              { label: "[2] Threads", value: "threads" },
              { label: "[3] Search", value: "search" },
              { label: "[q] Quit", value: "quit" },
            ]}
            onSelect={item => {
              if (item.value === "quit") process.exit(0);
              setView(item.value as View);
            }}
          />
        </Box>
      </Box>
    );
  }

  if (view === "timeline") {
    return <Timeline onBack={() => setView("menu")} />;
  }

  if (view === "search") {
    return <SearchView onBack={() => setView("menu")} />;
  }

  return null;
}

render(<App />);
```

### Timeline View

```typescript
// src/tui/timeline.tsx

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { MessageStore } from "../core/store";

interface Props {
  onBack: () => void;
}

export function Timeline({ onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const store = new MessageStore();
    const load = async () => {
      const msgs: Message[] = [];
      for await (const msg of store.listMessages()) {
        msgs.push(msg);
        if (msgs.length >= 50) break;
      }
      setMessages(msgs.reverse());
    };
    load();
  }, []);

  useInput((input, key) => {
    if (input === "q" || key.escape) onBack();
    if (key.upArrow) setSelected(Math.max(0, selected - 1));
    if (key.downArrow) setSelected(Math.min(messages.length - 1, selected + 1));
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Timeline</Text>
      <Text dimColor>[↑/↓] Navigate  [q] Back</Text>
      <Box marginTop={1} flexDirection="column">
        {messages.map((msg, i) => (
          <Box key={msg.id}>
            <Text inverse={i === selected}>
              {new Date(msg.created_at).toLocaleTimeString().slice(0, 5)}{" "}
              <Text color="cyan">[{msg.platform}]</Text>{" "}
              <Text bold>{msg.author_name}</Text>:{" "}
              {msg.content.slice(0, 60)}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

---

## Phase Deliverables Summary

| Phase | Feature | Tests |
|-------|---------|-------|
| 1 | Store + Telegram + Search | Import 1000 msgs, search |
| 2 | CIDs + Email | Verify CIDs, import .eml |
| 3 | DIDs + Claude Code | Identity, log import |
| 4 | TUI | All views navigable |

---

## Upgrade Path After Phase 4

Once all phases complete, the plugin has a solid foundation for:

1. **Merkle DAG** - Add thread verification
2. **Signatures** - Sign messages with DIDs
3. **More adapters** - Discord, Slack, WhatsApp
4. **MCP server** - Expose as tools
5. **Vector search** - Add embeddings

The pragmatic approach lets you ship value early and iterate based on real usage.
