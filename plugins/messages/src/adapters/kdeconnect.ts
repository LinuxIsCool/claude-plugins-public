/**
 * KDE Connect SMS Adapter
 *
 * Imports SMS messages from KDE Connect into the unified message store.
 * Transforms KDE Connect-specific data structures to the unified Message format.
 *
 * Usage:
 *   const stats = await importKdeConnect(store, { deviceId: "abc123" });
 */

import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import {
  getKdeConnectClient,
  getKdeConnectStatus as getClientStatus,
  isKdeConnectAvailable as checkClientAvailable,
} from "../integrations/kdeconnect/client";
import type {
  KdeConnectConversation,
  KdeConnectStatus,
  KdeConnectImportOptions,
  KdeConnectImportStats,
} from "../integrations/kdeconnect/types";
import {
  createAccountId,
  createThreadId as createThreadIdBase,
  createPlatformMessageId,
  formatPhoneDisplay,
  SELF_ACCOUNT_ID,
} from "../integrations/kdeconnect/ids";

// =============================================================================
// Re-exports
// =============================================================================

export { checkClientAvailable as isKdeConnectAvailable };

/**
 * Get KDE Connect status
 */
export async function getKdeConnectStatus(): Promise<KdeConnectStatus> {
  return getClientStatus();
}

// =============================================================================
// Local Helpers (wrapping shared module for adapter-specific interfaces)
// =============================================================================

/**
 * Create thread ID from conversation object
 * Wrapper around shared createThreadId for adapter convenience
 */
function createThreadId(conversation: KdeConnectConversation): string {
  return createThreadIdBase(conversation.threadId, conversation.addresses);
}

// =============================================================================
// Conversation Listing
// =============================================================================

/**
 * List all SMS conversations from KDE Connect
 */
export async function listKdeConnectConversations(
  deviceId?: string
): Promise<KdeConnectConversation[]> {
  const client = getKdeConnectClient();

  // Get default device if not specified
  let targetDeviceId = deviceId;
  if (!targetDeviceId) {
    const defaultDevice = await client.getDefaultDevice();
    if (!defaultDevice) {
      throw new Error(
        "No KDE Connect device available. " +
          "Ensure device is paired and reachable."
      );
    }
    targetDeviceId = defaultDevice.id;
  }

  client.selectDevice(targetDeviceId);

  // Request all conversations
  await client.requestAllConversations(targetDeviceId);

  // Get conversations with metadata from activeConversations
  const rawConversations = await client.getActiveConversations(targetDeviceId);

  // Transform to KdeConnectConversation format
  return rawConversations.map((conv) => ({
    threadId: conv.threadId,
    addresses: conv.addresses.map((addr) => (addr.startsWith("+") ? addr : `+${addr}`)),
    displayName: formatPhoneDisplay(conv.addresses[0] || "Unknown"),
    isMultiTarget: conv.isMultitarget || conv.addresses.length > 1,
    lastMessage: conv.body,
    lastMessageDate: conv.date,
    lastMessageType: conv.type,  // 1=incoming, 2=outgoing
    isRead: conv.isRead,
  }));
}

// =============================================================================
// Count / Dry Run
// =============================================================================

/**
 * Count SMS messages (dry run)
 * Returns estimated counts without importing
 */
export async function countKdeConnectMessages(
  options: KdeConnectImportOptions = {}
): Promise<{
  conversations: number;
  estimatedMessages: number;
  conversationDetails: Array<{
    threadId: number;
    addresses: string[];
    displayName: string;
  }>;
}> {
  const conversations = await listKdeConnectConversations(options.deviceId);

  // Filter conversations if specific threads requested
  let filtered = conversations;
  if (options.threadIds?.length) {
    filtered = filtered.filter((c) =>
      options.threadIds!.includes(c.threadId)
    );
  }

  // Estimate messages (we don't know exact count without fetching)
  // Use message count if available, otherwise estimate 50 per conversation
  const estimatedMessages = filtered.reduce(
    (sum, c) => sum + (c.messageCount || 50),
    0
  );

  return {
    conversations: filtered.length,
    estimatedMessages,
    conversationDetails: filtered.map((c) => ({
      threadId: c.threadId,
      addresses: c.addresses,
      displayName: c.displayName || formatPhoneDisplay(c.addresses[0] || "Unknown"),
    })),
  };
}

// =============================================================================
// Import
// =============================================================================

/**
 * Import SMS messages from KDE Connect
 *
 * Yields messages as they are imported, returns final statistics.
 *
 * Note: Phase 1 implementation has limited message retrieval.
 * Full message sync will be available in Phase 2 with D-Bus signal support.
 */
export async function* importKdeConnect(
  store: MessageStore,
  options: KdeConnectImportOptions = {}
): AsyncGenerator<Message, KdeConnectImportStats> {
  const stats: KdeConnectImportStats = {
    messages: 0,
    conversations: 0,
    accounts: 0,
    skipped: 0,
    errors: 0,
    dateRange: {},
  };

  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  const client = getKdeConnectClient();

  // Get device
  let deviceId = options.deviceId;
  if (!deviceId) {
    const defaultDevice = await client.getDefaultDevice();
    if (!defaultDevice) {
      throw new Error(
        "No KDE Connect device available. " +
          "Ensure device is paired and reachable."
      );
    }
    deviceId = defaultDevice.id;
  }

  client.selectDevice(deviceId);
  console.log(`[kdeconnect-adapter] Using device: ${deviceId}`);

  // Get self account (the phone owner)
  if (!seenAccounts.has(SELF_ACCOUNT_ID)) {
    await store.getOrCreateAccount({
      id: SELF_ACCOUNT_ID,
      name: "Me (SMS)",
      identities: [{ platform: "sms", handle: "self" }],
      is_self: true,
    });
    seenAccounts.add(SELF_ACCOUNT_ID);
    stats.accounts++;
  }

  // Get all conversations
  console.log("[kdeconnect-adapter] Fetching conversations...");
  const conversations = await listKdeConnectConversations(deviceId);
  console.log(`[kdeconnect-adapter] Found ${conversations.length} conversations`);

  // Filter conversations if specific threads requested
  let targetConversations = conversations;
  if (options.threadIds?.length) {
    targetConversations = targetConversations.filter((c) =>
      options.threadIds!.includes(c.threadId)
    );
  }

  // Process each conversation
  for (const conversation of targetConversations) {
    const threadId = createThreadId(conversation);

    // Create thread if not seen
    if (!seenThreads.has(threadId)) {
      const isGroup = conversation.isMultiTarget;
      const title =
        conversation.displayName ||
        (isGroup
          ? `Group (${conversation.addresses.length})`
          : formatPhoneDisplay(conversation.addresses[0] || "Unknown"));

      await store.getOrCreateThread({
        id: threadId,
        title,
        type: isGroup ? "group" : "dm",
        participants: [SELF_ACCOUNT_ID],
        source: {
          platform: "sms",
          platform_id: String(conversation.threadId),
        },
      });
      seenThreads.add(threadId);
      stats.conversations++;
    }

    // Create accounts for each address in conversation
    for (let i = 0; i < conversation.addresses.length; i++) {
      const address = conversation.addresses[i];
      const accountId = createAccountId(address);

      if (!seenAccounts.has(accountId)) {
        // Use displayName for first address, otherwise format phone
        const name = i === 0 ? conversation.displayName : formatPhoneDisplay(address);
        await store.getOrCreateAccount({
          id: accountId,
          name,
          identities: [{ platform: "sms", handle: address }],
        });
        seenAccounts.add(accountId);
        stats.accounts++;
      }
    }

    // Use the lastMessage data from activeConversations directly
    // Signal-based retrieval (getMessages) doesn't work reliably as phones don't
    // respond to requestConversation with signals unless actively interacting
    // This gives us one message per conversation - the most recent one
    const messages = conversation.lastMessage ? [{
      id: conversation.threadId * 1000000,  // Generate pseudo-ID
      threadId: conversation.threadId,
      address: conversation.addresses[0] || "",
      body: conversation.lastMessage,
      date: conversation.lastMessageDate || Date.now(),
      type: conversation.lastMessageType || 1,  // 1=incoming, 2=outgoing
      read: conversation.isRead ? 1 : 0,
    }] : [];

    // Process each message
    for (const msg of messages) {
      try {
        // Apply date filters
        if (options.since && msg.date < options.since.getTime()) {
          stats.skipped++;
          continue;
        }
        if (options.until && msg.date > options.until.getTime()) {
          stats.skipped++;
          continue;
        }

        // Track date range
        const msgDate = new Date(msg.date);
        if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
          stats.dateRange.earliest = msgDate;
        }
        if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
          stats.dateRange.latest = msgDate;
        }

        // Determine sender
        const isOutgoing = msg.type === 2;
        const senderAccountId = isOutgoing
          ? SELF_ACCOUNT_ID
          : createAccountId(msg.address);

        // Build message input
        // Note: contactName and attachments may not be available when using
        // activeConversations fallback (only have lastMessage data)
        const contactName = "contactName" in msg ? (msg as { contactName?: string }).contactName : undefined;
        const attachments = "attachments" in msg ? (msg as { attachments?: unknown[] }).attachments : undefined;

        const input: MessageInput = {
          kind: Kind.SMS,
          content: msg.body,
          account_id: senderAccountId,
          author: {
            name: isOutgoing
              ? "Me"
              : (contactName || formatPhoneDisplay(msg.address)),
            handle: msg.address,
          },
          created_at: msg.date,
          refs: {
            thread_id: threadId,
          },
          source: {
            platform: "sms",
            platform_id: createPlatformMessageId(msg.threadId, msg.id),
          },
          tags: [
            ["direction", isOutgoing ? "outgoing" : "incoming"],
            ["message_type", attachments ? "mms" : "sms"],
            ["phone_number", msg.address],
          ],
        };

        // Store message
        const message = await store.createMessage(input);
        stats.messages++;
        yield message;
      } catch (err) {
        console.error(
          `[kdeconnect-adapter] Failed to store message ${msg.id}:`,
          err
        );
        stats.errors++;
      }
    }
  }

  console.log(
    `[kdeconnect-adapter] Import complete: ` +
      `${stats.messages} messages from ${stats.conversations} conversations`
  );

  return stats;
}

// =============================================================================
// Send SMS (Phase 3)
// =============================================================================

/**
 * Send an SMS message via KDE Connect
 * Note: This is a Phase 3 feature - basic implementation only
 */
export async function sendSms(
  phoneNumber: string,
  message: string,
  deviceId?: string
): Promise<void> {
  const client = getKdeConnectClient();

  // Get device
  let targetDeviceId = deviceId;
  if (!targetDeviceId) {
    const defaultDevice = await client.getDefaultDevice();
    if (!defaultDevice) {
      throw new Error(
        "No KDE Connect device available. " +
          "Ensure device is paired and reachable."
      );
    }
    targetDeviceId = defaultDevice.id;
  }

  await client.sendSms(phoneNumber, message, targetDeviceId);
}

// =============================================================================
// Sync Service Integration (Phase 2)
// =============================================================================

import {
  KdeConnectSyncService,
  getKdeConnectSyncService,
  resetKdeConnectSyncService,
  type KdeConnectSyncConfig,
  type KdeConnectSyncStats,
} from "../services/kdeconnect-sync";

export {
  KdeConnectSyncService,
  getKdeConnectSyncService,
  resetKdeConnectSyncService,
  type KdeConnectSyncConfig,
  type KdeConnectSyncStats,
};

/**
 * Start real-time SMS sync
 * Monitors for new messages and stores them automatically
 */
export async function startSmsSync(
  config?: KdeConnectSyncConfig
): Promise<KdeConnectSyncService> {
  const service = getKdeConnectSyncService(config);
  await service.start();
  return service;
}

/**
 * Stop real-time SMS sync
 */
export async function stopSmsSync(): Promise<void> {
  await resetKdeConnectSyncService();
}

/**
 * Import all historic SMS messages and then continue with live sync
 * This is the combined "import → live" flow
 */
export async function* importAndSync(
  _store: MessageStore,
  options: KdeConnectImportOptions & { continueWithLiveSync?: boolean } = {}
): AsyncGenerator<Message, KdeConnectImportStats & { syncStarted: boolean }> {
  const service = getKdeConnectSyncService({
    deviceId: options.deviceId,
    messageTimeout: 15000,
  });

  // Run historic import
  const stats = yield* service.importHistoric(options);

  // Optionally continue with live sync
  const syncStarted = options.continueWithLiveSync ?? false;
  if (syncStarted) {
    console.log("[kdeconnect-adapter] Switching to live sync mode...");
    await service.start();
  }

  return {
    ...stats,
    syncStarted,
  };
}

/**
 * Get sync service statistics
 */
export function getSyncStats(): KdeConnectSyncStats | null {
  try {
    const service = getKdeConnectSyncService();
    return service.getStats();
  } catch {
    return null;
  }
}
