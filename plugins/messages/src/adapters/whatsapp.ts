/**
 * WhatsApp Adapter
 *
 * Imports messages from WhatsApp via Baileys (WhatsApp Web API).
 * Supports QR code authentication and real-time sync.
 *
 * Prerequisites:
 * 1. Run `whatsapp-auth` to authenticate via QR code
 * 2. Session is saved for future syncs
 */

import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import {
  getWhatsAppClient,
  isWhatsAppAvailable,
  getWhatsAppStatus as getClientStatus,
} from "../integrations/whatsapp/client";
import type {
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppSyncOptions,
  WhatsAppImportStats,
  WhatsAppStatus,
} from "../integrations/whatsapp/types";

// Re-export availability check
export { isWhatsAppAvailable };

/**
 * Get WhatsApp configuration and connection status
 */
export function getWhatsAppStatus(sessionName = "default"): WhatsAppStatus {
  return getClientStatus(sessionName);
}

/**
 * Create account ID from WhatsApp JID
 * Format: whatsapp_{phone_number}
 */
function createAccountId(jid: string): string {
  // JID format: 1234567890@s.whatsapp.net or 1234567890:0@s.whatsapp.net
  const phone = jid.split("@")[0].split(":")[0];
  return `whatsapp_${phone}`;
}

/**
 * Create thread ID from WhatsApp chat
 * Format: whatsapp_{type}_{id}
 */
function createThreadId(chatId: string, type: "dm" | "group" | "broadcast"): string {
  // Normalize chat ID (remove special chars)
  const normalized = chatId.split("@")[0].replace(/[^a-zA-Z0-9-]/g, "_");

  if (type === "group") {
    return `whatsapp_group_${normalized}`;
  } else if (type === "broadcast") {
    return `whatsapp_broadcast_${normalized}`;
  }
  return `whatsapp_dm_${normalized}`;
}

/**
 * Create message ID from WhatsApp message
 * Format: whatsapp_{timestamp}_{message_key}
 */
function createMessageId(timestamp: number, messageKey: string): string {
  const normalized = messageKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  return `whatsapp_${timestamp}_${normalized}`;
}

/**
 * Extract phone number from JID for display
 */
function extractPhone(jid: string): string {
  if (!jid) return "Unknown";
  return jid.split("@")[0].split(":")[0];
}

/**
 * Count WhatsApp messages (dry run)
 * Returns chat count and estimated message count
 */
export async function countWhatsAppMessages(
  options: WhatsAppSyncOptions = {}
): Promise<{
  chats: number;
  estimatedMessages: number;
  chatDetails: Array<{ id: string; name: string; type: string }>;
}> {
  const client = getWhatsAppClient();

  // Need to connect to get chat list
  if (!client.isConnected()) {
    await client.connect();

    // Wait a bit for chats to sync
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const chats = await client.getChats();

  // Filter chats based on options
  let filtered = chats;

  if (options.chatTypes?.length) {
    filtered = filtered.filter((c) => options.chatTypes!.includes(c.type));
  }

  if (options.chats?.length) {
    filtered = filtered.filter((c) => options.chats!.includes(c.id));
  }

  if (options.skipArchived) {
    filtered = filtered.filter((c) => !c.isArchived);
  }

  // Estimate messages based on chat count (rough estimate)
  // In practice, messages come via real-time events
  const estimatedMessages = filtered.length * 100;

  return {
    chats: filtered.length,
    estimatedMessages,
    chatDetails: filtered.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
  };
}

/**
 * List WhatsApp chats
 */
export async function listWhatsAppChats(): Promise<WhatsAppChat[]> {
  const client = getWhatsAppClient();

  if (!client.isConnected()) {
    await client.connect();
    // Wait for initial sync
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return client.getChats();
}

/**
 * Import messages from WhatsApp
 *
 * This uses an event-driven approach:
 * 1. Connects to WhatsApp (or uses existing session)
 * 2. Receives messages via real-time events
 * 3. Yields messages as they arrive
 *
 * For historical messages, WhatsApp Web has limitations - it primarily
 * syncs messages that are currently visible in the app.
 */
export async function* importWhatsApp(
  store: MessageStore,
  options: WhatsAppSyncOptions = {}
): AsyncGenerator<Message, WhatsAppImportStats> {
  const stats: WhatsAppImportStats = {
    messages: 0,
    chats: 0,
    accounts: 0,
    skipped: 0,
    errors: 0,
    dateRange: {},
  };

  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  const client = getWhatsAppClient();

  // Connect if not already connected
  if (!client.isConnected()) {
    console.log("[whatsapp-adapter] Connecting to WhatsApp...");

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Connection timeout - scan QR code faster or run whatsapp-auth first"));
      }, 120000); // 2 minute timeout

      client.once("connected", () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      client.connect().catch(reject);
    });

    console.log("[whatsapp-adapter] Connected!");

    // Wait for initial sync
    console.log("[whatsapp-adapter] Waiting for initial chat sync...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Get current user info
  const me = client.getMe();
  if (!me) {
    throw new Error("Could not get current user info - make sure you're authenticated");
  }

  const myAccountId = createAccountId(me.jid);
  const myPhone = me.phone;

  // Create self account
  await store.getOrCreateAccount({
    id: myAccountId,
    name: me.name || "Me (WhatsApp)",
    identities: [{ platform: "whatsapp", handle: myPhone }],
    is_self: true,
  });
  seenAccounts.add(myAccountId);
  stats.accounts++;

  // Get all chats
  const chats = await client.getChats();
  console.log(`[whatsapp-adapter] Found ${chats.length} chats`);

  // Filter chats based on options
  let filteredChats = chats;

  if (options.chatTypes?.length) {
    filteredChats = filteredChats.filter((c) => options.chatTypes!.includes(c.type));
  }

  if (options.chats?.length) {
    filteredChats = filteredChats.filter((c) => options.chats!.includes(c.id));
  }

  if (options.skipArchived) {
    filteredChats = filteredChats.filter((c) => !c.isArchived);
  }

  // Create threads for each chat
  for (const chat of filteredChats) {
    const threadId = createThreadId(chat.id, chat.type);

    if (!seenThreads.has(threadId)) {
      await store.getOrCreateThread({
        id: threadId,
        title: chat.name,
        type: chat.type === "dm" ? "dm" : chat.type === "group" ? "group" : "channel",
        participants: [myAccountId],
        source: {
          platform: "whatsapp",
          platform_id: chat.id,
        },
      });
      seenThreads.add(threadId);
      stats.chats++;
    }
  }

  // Set up message handler for real-time messages
  const messageQueue: WhatsAppMessage[] = [];
  let resolveWait: (() => void) | null = null;

  const handleMessage = (event: { message: WhatsAppMessage; isNew: boolean }) => {
    const { message } = event;

    // Filter by chat if specified
    if (options.chats?.length && !options.chats.includes(message.chatId)) {
      return;
    }

    // Filter by date if specified
    if (options.since && message.timestamp < options.since.getTime()) {
      return;
    }

    if (options.until && message.timestamp > options.until.getTime()) {
      return;
    }

    messageQueue.push(message);

    // Wake up the generator if it's waiting
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  client.on("message", handleMessage);

  try {
    // Process messages as they arrive
    const startTime = Date.now();
    const timeout = options.realtimeTimeout || 30000; // Default 30 seconds
    const realtime = options.realtime ?? false;

    console.log(
      `[whatsapp-adapter] Listening for messages... (${realtime ? "continuous" : `${timeout / 1000}s`})`
    );

    while (true) {
      // Process all queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift()!;

        // Skip messages without text content
        if (!msg.text && !msg.caption) {
          stats.skipped++;
          continue;
        }

        const content = msg.text || msg.caption || "";

        // Track date range
        const msgDate = new Date(msg.timestamp);
        if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
          stats.dateRange.earliest = msgDate;
        }
        if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
          stats.dateRange.latest = msgDate;
        }

        // Determine sender account
        const isOutgoing = msg.fromMe;
        const senderAccountId = isOutgoing ? myAccountId : createAccountId(msg.senderJid);

        // Create sender account if not seen
        if (!seenAccounts.has(senderAccountId)) {
          await store.getOrCreateAccount({
            id: senderAccountId,
            name: msg.senderName || extractPhone(msg.senderJid),
            identities: [{ platform: "whatsapp", handle: extractPhone(msg.senderJid) }],
          });
          seenAccounts.add(senderAccountId);
          stats.accounts++;
        }

        // Ensure thread exists
        const chat = filteredChats.find((c) => c.id === msg.chatId);
        const chatType = chat?.type || "dm";
        const threadId = createThreadId(msg.chatId, chatType);

        if (!seenThreads.has(threadId)) {
          await store.getOrCreateThread({
            id: threadId,
            title: chat?.name || extractPhone(msg.chatId),
            type: chatType === "dm" ? "dm" : chatType === "group" ? "group" : "channel",
            participants: [myAccountId],
            source: {
              platform: "whatsapp",
              platform_id: msg.chatId,
            },
          });
          seenThreads.add(threadId);
          stats.chats++;
        }

        // Build message input
        const input: MessageInput = {
          kind: Kind.WhatsApp,
          content,
          account_id: senderAccountId,
          author: {
            name: isOutgoing ? me.name : (msg.senderName || extractPhone(msg.senderJid)),
            handle: isOutgoing ? myPhone : extractPhone(msg.senderJid),
          },
          created_at: msg.timestamp,
          refs: {
            thread_id: threadId,
            reply_to: msg.quotedMessageId
              ? createMessageId(msg.timestamp, msg.quotedMessageId)
              : undefined,
          },
          source: {
            platform: "whatsapp",
            platform_id: msg.id,
          },
          tags: [
            ["direction", isOutgoing ? "outgoing" : "incoming"],
            ["message_type", msg.messageType],
          ],
        };

        try {
          const message = await store.createMessage(input);
          stats.messages++;
          yield message;
        } catch (error) {
          console.warn(`[whatsapp-adapter] Failed to store message ${msg.id}:`, error);
          stats.errors++;
        }
      }

      // Check if we should stop
      if (!realtime && Date.now() - startTime > timeout) {
        break;
      }

      // Wait for more messages
      await new Promise<void>((resolve) => {
        resolveWait = resolve;
        // Check again after 1 second even if no messages
        setTimeout(resolve, 1000);
      });
    }
  } finally {
    client.off("message", handleMessage);
  }

  console.log(
    `[whatsapp-adapter] Import complete: ${stats.messages} messages from ${stats.chats} chats`
  );

  return stats;
}

/**
 * Start continuous WhatsApp sync
 *
 * This is a convenience wrapper that runs importWhatsApp in realtime mode.
 */
export async function startWhatsAppSync(
  store: MessageStore,
  options: Omit<WhatsAppSyncOptions, "realtime"> = {}
): Promise<{ stop: () => void; stats: () => WhatsAppImportStats }> {
  let stopped = false;
  let currentStats: WhatsAppImportStats = {
    messages: 0,
    chats: 0,
    accounts: 0,
    skipped: 0,
    errors: 0,
    dateRange: {},
  };

  const syncOptions: WhatsAppSyncOptions = {
    ...options,
    realtime: true,
    realtimeTimeout: Infinity,
  };

  // Run sync in background
  (async () => {
    try {
      const generator = importWhatsApp(store, syncOptions);

      for await (const _message of generator) {
        if (stopped) break;
        // Stats are updated inside the generator
      }

      // Generator completed - stats are returned
    } catch (error) {
      if (!stopped) {
        console.error("[whatsapp-adapter] Sync error:", error);
      }
    }
  })();

  return {
    stop: () => {
      stopped = true;
    },
    stats: () => currentStats,
  };
}
