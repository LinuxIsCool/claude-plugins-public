/**
 * Fast bulk SMS import - bypasses slow iteration
 */
import { getKdeConnectClient } from "../src/integrations/kdeconnect/client";
import { createStore } from "../src/core/store";
import { createSearchIndex } from "../src/search/index";
import { Kind } from "../src/types/index";
import {
  createAccountId,
  createThreadId,
  formatPhoneDisplay,
  SELF_ACCOUNT_ID,
  createPlatformMessageId,
} from "../src/integrations/kdeconnect/ids";

async function main() {
  const client = getKdeConnectClient();
  const store = createStore();
  const search = createSearchIndex();

  console.log("Getting conversations (phone should be warmed up)...");
  const start = Date.now();

  // Get device
  const device = await client.getDefaultDevice();
  if (!device) {
    console.error("No device available");
    process.exit(1);
  }
  client.selectDevice(device.id);
  console.log(`Using device: ${device.name}`);

  // Get conversations directly (no long wait if phone is active)
  const convos = await client.getActiveConversations();
  console.log(`Got ${convos.length} conversations in ${Date.now() - start}ms`);

  if (convos.length === 0) {
    console.log("No conversations found. Phone may need to wake up.");
    console.log("Try running: kdeconnect-cli --refresh && sleep 15");
    process.exit(1);
  }

  // Ensure self account exists
  await store.getOrCreateAccount({
    id: SELF_ACCOUNT_ID,
    name: "Me (SMS)",
    identities: [{ platform: "sms", handle: "self" }],
    is_self: true,
  });

  console.log("Storing messages...");
  const storeStart = Date.now();
  let imported = 0;
  let skipped = 0;
  const messages = [];

  for (const conv of convos) {
    if (!conv.body) {
      skipped++;
      continue;
    }

    const addresses = conv.addresses.map((a) =>
      a.startsWith("+") ? a : "+" + a
    );
    const threadId = createThreadId(conv.threadId, addresses);
    const isGroup = conv.isMultitarget || addresses.length > 1;

    // Create thread
    await store.getOrCreateThread({
      id: threadId,
      title: formatPhoneDisplay(addresses[0] || "Unknown"),
      type: isGroup ? "group" : "dm",
      participants: [SELF_ACCOUNT_ID],
      source: { platform: "sms", platform_id: String(conv.threadId) },
    });

    // Create account for sender
    const accountId = createAccountId(addresses[0]);
    await store.getOrCreateAccount({
      id: accountId,
      name: formatPhoneDisplay(addresses[0]),
      identities: [{ platform: "sms", handle: addresses[0] }],
    });

    // Store message
    const isOutgoing = conv.type === 2;
    const msg = await store.createMessage({
      kind: Kind.SMS,
      content: conv.body,
      account_id: isOutgoing ? SELF_ACCOUNT_ID : accountId,
      author: {
        name: isOutgoing ? "Me" : formatPhoneDisplay(addresses[0]),
        handle: addresses[0],
      },
      created_at: conv.date,
      refs: { thread_id: threadId },
      source: {
        platform: "sms",
        platform_id: createPlatformMessageId(
          conv.threadId,
          conv.threadId * 1000000
        ),
      },
      tags: [
        ["direction", isOutgoing ? "outgoing" : "incoming"],
        ["message_type", "sms"],
        ["phone_number", addresses[0]],
      ],
    });

    messages.push(msg);
    imported++;
    if (imported % 100 === 0) console.log(`  Stored ${imported}...`);
  }

  console.log(
    `Stored ${imported} messages in ${Date.now() - storeStart}ms (${skipped} skipped)`
  );

  // Batch index at the end
  console.log("Indexing...");
  const indexStart = Date.now();
  for (const msg of messages) {
    search.index(msg);
  }
  console.log(`Indexed ${messages.length} messages in ${Date.now() - indexStart}ms`);

  console.log(`\nTotal time: ${Date.now() - start}ms`);
  console.log(`Speed: ${Math.round((imported / (Date.now() - start)) * 1000)} messages/sec`);
}

main().catch(console.error);
