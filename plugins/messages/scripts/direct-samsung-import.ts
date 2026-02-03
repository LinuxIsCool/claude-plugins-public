#!/usr/bin/env bun
/**
 * Direct Samsung SMS import - bypasses slow account/thread lookups
 *
 * This script writes directly to the event log without checking for existence,
 * which is safe because:
 * 1. Message IDs are content-addressed (CIDs) so duplicates are deduplicated
 * 2. Account/thread events with same IDs are idempotent in consumers
 */
import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import { createSearchIndex } from "../src/search/index";
import { Kind } from "../src/types";
import type { Message, MessageInput, Account, Thread } from "../src/types";
import { getClaudePath } from "../../../lib/paths";
import {
  createAccountId,
  createThreadId,
  createPlatformMessageId,
  formatPhoneDisplay,
  SELF_ACCOUNT_ID,
} from "../src/integrations/kdeconnect/ids";
import { createHash } from "node:crypto";

const BACKUP_PATH = process.argv[2] || "/tmp/sms_extracted";

// Content ID generation (matching store.ts)
function createCID(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// Direct event file writer
class DirectEventWriter {
  private eventsDir: string;
  private eventsFile: string;
  private contentDir: string;

  constructor() {
    const baseDir = getClaudePath("messages/store");
    this.eventsDir = path.join(baseDir, "events");
    this.contentDir = path.join(baseDir, "content");

    // Create today's event file path
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dayDir = path.join(this.eventsDir, String(year), month, day);
    fs.mkdirSync(dayDir, { recursive: true });
    fs.mkdirSync(this.contentDir, { recursive: true });
    this.eventsFile = path.join(dayDir, "events.jsonl");
  }

  appendEvent(event: Record<string, unknown>): void {
    fs.appendFileSync(this.eventsFile, JSON.stringify(event) + "\n");
  }

  writeContent(cid: string, data: unknown): void {
    const contentPath = path.join(this.contentDir, cid);
    if (!fs.existsSync(contentPath)) {
      fs.writeFileSync(contentPath, JSON.stringify(data));
    }
  }

  createAccount(input: { id: string; name: string; identities: Array<{ platform: string; handle: string }>; is_self?: boolean }): Account {
    const account: Account = {
      ...input,
      is_self: input.is_self ?? false,
      created_at: Date.now(),
    };
    this.appendEvent({
      ts: new Date().toISOString(),
      op: "account.created",
      data: account,
    });
    return account;
  }

  createThread(input: { id: string; title: string; type: string; participants: string[]; source: { platform: string; platform_id: string } }): Thread {
    const thread: Thread = {
      ...input,
      type: input.type as "dm" | "group" | "channel",
      created_at: Date.now(),
      message_count: 0,
    };
    this.appendEvent({
      ts: new Date().toISOString(),
      op: "thread.created",
      data: thread,
    });
    return thread;
  }

  createMessage(input: MessageInput): Message {
    const cid = createCID(JSON.stringify({
      kind: input.kind,
      content: input.content,
      created_at: input.created_at,
      source: input.source,
    }));

    const message: Message = {
      id: cid,
      kind: input.kind,
      content: input.content,
      account_id: input.account_id,
      author: input.author,
      created_at: input.created_at,
      imported_at: Date.now(),
      refs: input.refs ?? {},
      source: input.source,
      tags: input.tags ?? [],
    };

    // Write content file
    this.writeContent(cid, message);

    // Append event
    this.appendEvent({
      ts: new Date().toISOString(),
      op: "message.created",
      data: message,
    });

    return message;
  }
}

async function main() {
  console.log("Direct Samsung SMS Import");
  console.log("=========================");

  // Find backup files
  const telephonyPath = path.join(BACKUP_PATH, "apps/com.android.providers.telephony/d_f");
  const files = fs.readdirSync(telephonyPath)
    .filter(f => f.endsWith("_sms_backup"))
    .map(f => path.join(telephonyPath, f))
    .sort();

  console.log(`Found ${files.length} backup files`);

  // Parse all messages first
  console.log("Parsing backup files...");
  const parseStart = Date.now();
  const allMessages: Array<{
    address: string;
    body: string;
    date: number;
    type: string;
  }> = [];

  for (const file of files) {
    const compressed = fs.readFileSync(file);
    const decompressed = zlib.inflateSync(compressed);
    const messages = JSON.parse(decompressed.toString("utf-8"));
    allMessages.push(...messages.map((m: Record<string, string>) => ({
      address: m.address.startsWith("+") ? m.address : "+" + m.address,
      body: m.body,
      date: parseInt(m.date),
      type: m.type,
    })));
  }
  console.log(`Parsed ${allMessages.length} messages in ${Date.now() - parseStart}ms`);

  // Initialize direct writer
  const writer = new DirectEventWriter();

  // Create self account
  writer.createAccount({
    id: SELF_ACCOUNT_ID,
    name: "Me (SMS)",
    identities: [{ platform: "sms", handle: "self" }],
    is_self: true,
  });

  // Create all unique accounts and threads
  console.log("Creating accounts and threads...");
  const accountStart = Date.now();
  const seenAddresses = new Set<string>();

  for (const msg of allMessages) {
    if (!seenAddresses.has(msg.address)) {
      seenAddresses.add(msg.address);
      const accountId = createAccountId(msg.address);
      const threadId = createThreadId(0, [msg.address]);

      writer.createAccount({
        id: accountId,
        name: formatPhoneDisplay(msg.address),
        identities: [{ platform: "sms", handle: msg.address }],
      });

      writer.createThread({
        id: threadId,
        title: formatPhoneDisplay(msg.address),
        type: "dm",
        participants: [SELF_ACCOUNT_ID],
        source: { platform: "sms", platform_id: threadId },
      });
    }
  }
  console.log(`Created ${seenAddresses.size} accounts/threads in ${Date.now() - accountStart}ms`);

  // Store all messages
  console.log("Storing messages...");
  const storeStart = Date.now();
  const storedMessages: Message[] = [];

  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i];
    const threadId = createThreadId(0, [msg.address]);
    const accountId = createAccountId(msg.address);
    const isOutgoing = msg.type === "2";

    const stored = writer.createMessage({
      kind: Kind.SMS,
      content: msg.body,
      account_id: isOutgoing ? SELF_ACCOUNT_ID : accountId,
      author: {
        name: isOutgoing ? "Me" : formatPhoneDisplay(msg.address),
        handle: msg.address,
      },
      created_at: msg.date,
      refs: { thread_id: threadId },
      source: {
        platform: "sms",
        platform_id: createPlatformMessageId(msg.date, msg.date),
      },
      tags: [
        ["direction", isOutgoing ? "outgoing" : "incoming"],
        ["message_type", "sms"],
        ["phone_number", msg.address],
      ],
    });

    storedMessages.push(stored);

    if ((i + 1) % 1000 === 0) {
      const rate = Math.round((i + 1) * 1000 / (Date.now() - storeStart));
      console.log(`  ${i + 1}/${allMessages.length} (${rate} msg/sec)`);
    }
  }
  console.log(`Stored ${storedMessages.length} messages in ${Date.now() - storeStart}ms`);
  console.log(`Store rate: ${Math.round(storedMessages.length * 1000 / (Date.now() - storeStart))} msg/sec`);

  // Batch index for search
  console.log("Indexing for search...");
  const indexStart = Date.now();
  const search = createSearchIndex();

  for (let i = 0; i < storedMessages.length; i++) {
    search.index(storedMessages[i]);
    if ((i + 1) % 2000 === 0) {
      console.log(`  Indexed ${i + 1}/${storedMessages.length}`);
    }
  }
  console.log(`Indexed ${storedMessages.length} messages in ${Date.now() - indexStart}ms`);
  console.log(`Index rate: ${Math.round(storedMessages.length * 1000 / (Date.now() - indexStart))} msg/sec`);

  console.log("\n=== Summary ===");
  console.log(`Total messages: ${storedMessages.length}`);
  console.log(`Unique contacts: ${seenAddresses.size}`);
  console.log(`Total time: ${((Date.now() - parseStart) / 1000).toFixed(1)}s`);
}

main().catch(console.error);
