#!/usr/bin/env bun
/**
 * Fast Samsung SMS import - imports messages then batch-indexes
 */
import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import { createStore } from "../src/core/store";
import { createSearchIndex } from "../src/search/index";
import { Kind } from "../src/types";
import {
  createAccountId,
  createThreadId,
  createPlatformMessageId,
  formatPhoneDisplay,
  SELF_ACCOUNT_ID,
} from "../src/integrations/kdeconnect/ids";

const BACKUP_PATH = process.argv[2] || "/tmp/sms_extracted";

async function main() {
  console.log("Fast Samsung SMS Import");
  console.log("=======================");

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

  // Initialize store
  const store = createStore();

  // Create self account
  await store.getOrCreateAccount({
    id: SELF_ACCOUNT_ID,
    name: "Me (SMS)",
    identities: [{ platform: "sms", handle: "self" }],
    is_self: true,
  });

  // Pre-create all unique accounts and threads
  console.log("Creating accounts and threads...");
  const accountStart = Date.now();
  const seenAddresses = new Set<string>();

  for (const msg of allMessages) {
    if (!seenAddresses.has(msg.address)) {
      seenAddresses.add(msg.address);
      const accountId = createAccountId(msg.address);
      const threadId = createThreadId(0, [msg.address]);

      await store.getOrCreateAccount({
        id: accountId,
        name: formatPhoneDisplay(msg.address),
        identities: [{ platform: "sms", handle: msg.address }],
      });

      await store.getOrCreateThread({
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
  const storedMessages: Awaited<ReturnType<typeof store.createMessage>>[] = [];

  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i];
    const threadId = createThreadId(0, [msg.address]);
    const accountId = createAccountId(msg.address);
    const isOutgoing = msg.type === "2";

    const stored = await store.createMessage({
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
