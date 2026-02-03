/**
 * KDE Connect SMS Sync Service
 *
 * Provides continuous real-time sync and historic import for SMS messages.
 * Uses D-Bus signal monitoring via the KdeConnectClient.
 *
 * Usage:
 *   const sync = new KdeConnectSyncService();
 *   await sync.start();
 *   // ... service runs, emitting 'message' events
 *   await sync.stop();
 *
 * For historic import:
 *   for await (const message of sync.importHistoric()) {
 *     console.log(message);
 *   }
 */

import { EventEmitter } from "events";
import {
  getKdeConnectClient,
  KdeConnectClient,
} from "../integrations/kdeconnect/client";
import type {
  KdeConnectMessage,
  KdeConnectImportStats,
  KdeConnectImportOptions,
  KdeConnectDevice,
} from "../integrations/kdeconnect/types";
import {
  createAccountId,
  createThreadId,
  createPlatformMessageId,
  formatPhoneDisplay,
  SELF_ACCOUNT_ID,
} from "../integrations/kdeconnect/ids";
import { MessageStore } from "../core/store";
import { SearchIndex } from "../search/index";
import type { MessageInput, Message } from "../types";
import { Kind } from "../types";

// =============================================================================
// Configuration
// =============================================================================

export interface KdeConnectSyncConfig {
  /** Specific device ID (auto-detect if not provided) */
  deviceId?: string;
  /** Polling interval for fallback mode (ms). Default: 60000 */
  pollInterval?: number;
  /** Max reconnect attempts before stopping. Default: 10 */
  maxReconnectAttempts?: number;
  /** Backoff base in ms for reconnect. Default: 1000 */
  reconnectBackoff?: number;
  /** Timeout for message retrieval per thread (ms). Default: 15000 */
  messageTimeout?: number;
}

export interface KdeConnectSyncStats {
  mode: "monitoring" | "importing" | "polling" | "stopped";
  messagesProcessed: number;
  conversationsProcessed: number;
  errors: number;
  startedAt?: Date;
  lastSync?: Date;
  reconnectAttempts: number;
  device?: KdeConnectDevice;
}

// =============================================================================
// Sync Service
// =============================================================================

/**
 * KDE Connect SMS Sync Service
 *
 * Emits events:
 * - 'message' (message: Message) - when a message is stored
 * - 'error' (error: Error) - on processing errors
 * - 'connected' (device: KdeConnectDevice) - when monitoring starts
 * - 'disconnected' - when monitoring stops
 * - 'sync' (stats: { count: number }) - after sync batch completes
 */
export class KdeConnectSyncService extends EventEmitter {
  private config: Required<KdeConnectSyncConfig>;
  private client: KdeConnectClient;
  private store: MessageStore;
  private searchIndex: SearchIndex;
  private stats: KdeConnectSyncStats;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private deviceId: string | null = null;
  private seenAccounts = new Set<string>();
  private seenThreads = new Set<string>();

  // Store bound handlers so they can be removed later (prevents memory leak)
  private boundHandlers: {
    conversationUpdated?: (data: { threadId: number; messages: KdeConnectMessage[] }) => void;
    monitorStopped?: (data: { code: number }) => void;
    error?: (err: Error) => void;
  } = {};

  constructor(config?: KdeConnectSyncConfig) {
    super();

    this.config = {
      deviceId: config?.deviceId || "",
      pollInterval: config?.pollInterval || 60000,
      maxReconnectAttempts: config?.maxReconnectAttempts || 10,
      reconnectBackoff: config?.reconnectBackoff || 1000,
      messageTimeout: config?.messageTimeout || 15000,
    };

    this.client = getKdeConnectClient();
    this.store = new MessageStore();
    this.searchIndex = new SearchIndex();

    this.stats = {
      mode: "stopped",
      messagesProcessed: 0,
      conversationsProcessed: 0,
      errors: 0,
      reconnectAttempts: 0,
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start real-time monitoring
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[kdeconnect-sync] Already running");
      return;
    }

    this.running = true;
    this.stats.startedAt = new Date();
    this.stats.reconnectAttempts = 0;

    // Get device
    let device: KdeConnectDevice | null = null;
    if (this.config.deviceId) {
      device = await this.client.getDevice(this.config.deviceId);
    } else {
      device = await this.client.getDefaultDevice();
    }

    if (!device) {
      throw new Error(
        "No KDE Connect device available. " +
          "Ensure device is paired, reachable, and has SMS permissions."
      );
    }

    this.deviceId = device.id;
    this.stats.device = device;
    this.client.selectDevice(device.id);

    console.log(`[kdeconnect-sync] Using device: ${device.name} (${device.id})`);

    // Ensure self account exists
    await this.store.getOrCreateAccount({
      id: SELF_ACCOUNT_ID,
      name: "Me (SMS)",
      identities: [{ platform: "sms", handle: "self" }],
      is_self: true,
    });
    this.seenAccounts.add(SELF_ACCOUNT_ID);

    // Start signal monitoring
    this.startMonitoring();

    this.stats.mode = "monitoring";
    this.emit("connected", device);
  }

  /**
   * Stop the sync service
   */
  async stop(): Promise<void> {
    this.running = false;
    this.stats.mode = "stopped";

    // Clear polling timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Remove event listeners from client (prevents memory leak)
    this.removeClientListeners();

    // Stop the signal monitor
    this.client.stopSignalMonitor();
    this.emit("disconnected");
    console.log("[kdeconnect-sync] Stopped");
  }

  /**
   * Remove event listeners from client
   */
  private removeClientListeners(): void {
    if (this.boundHandlers.conversationUpdated) {
      this.client.off("conversationUpdated", this.boundHandlers.conversationUpdated);
    }
    if (this.boundHandlers.monitorStopped) {
      this.client.off("monitorStopped", this.boundHandlers.monitorStopped);
    }
    if (this.boundHandlers.error) {
      this.client.off("error", this.boundHandlers.error);
    }
    this.boundHandlers = {};
  }

  /**
   * Get sync statistics
   */
  getStats(): KdeConnectSyncStats {
    return { ...this.stats };
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ===========================================================================
  // Real-Time Monitoring
  // ===========================================================================

  private startMonitoring(): void {
    if (!this.deviceId) return;

    // Remove any existing listeners first (prevents duplicates on reconnect)
    this.removeClientListeners();

    // Clear poll timer if switching from polling mode
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Start client's signal monitor
    this.client.startSignalMonitor(this.deviceId);

    // Create and store bound handlers so they can be removed later
    this.boundHandlers.conversationUpdated = this.handleConversationUpdate.bind(this);
    this.boundHandlers.monitorStopped = this.handleMonitorStopped.bind(this);
    this.boundHandlers.error = (err: Error) => {
      this.stats.errors++;
      this.emit("error", err);
    };

    // Listen for events
    this.client.on("conversationUpdated", this.boundHandlers.conversationUpdated);
    this.client.on("monitorStopped", this.boundHandlers.monitorStopped);
    this.client.on("error", this.boundHandlers.error);

    this.stats.mode = "monitoring";
    console.log("[kdeconnect-sync] Real-time monitoring started");
  }

  private async handleConversationUpdate(data: {
    threadId: number;
    messages: KdeConnectMessage[];
  }): Promise<void> {
    if (!this.running) return;

    // Reset reconnect attempts on successful message receipt
    // This confirms the monitor is working after reconnection
    if (this.stats.reconnectAttempts > 0) {
      console.log("[kdeconnect-sync] Monitor stable, resetting reconnect counter");
      this.stats.reconnectAttempts = 0;
    }

    try {
      const stored = await this.processMessages(data.threadId, data.messages);
      this.stats.lastSync = new Date();
      this.emit("sync", { count: stored.length });
    } catch (err) {
      console.error("[kdeconnect-sync] Error processing update:", err);
      this.stats.errors++;
      this.emit("error", err);
    }
  }

  private async handleMonitorStopped(data: { code: number }): Promise<void> {
    if (!this.running) return;

    console.log(`[kdeconnect-sync] Monitor stopped with code ${data.code}`);
    this.stats.reconnectAttempts++;

    if (this.stats.reconnectAttempts > this.config.maxReconnectAttempts) {
      console.log("[kdeconnect-sync] Max reconnect attempts reached, falling back to polling");
      this.startPolling();
      return;
    }

    // Exponential backoff
    const backoff =
      this.config.reconnectBackoff * Math.pow(2, this.stats.reconnectAttempts - 1);
    console.log(
      `[kdeconnect-sync] Reconnecting in ${backoff}ms (attempt ${this.stats.reconnectAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, backoff));

    if (this.running) {
      this.startMonitoring();
    }
  }

  // ===========================================================================
  // Fallback Polling
  // ===========================================================================

  private startPolling(): void {
    this.stats.mode = "polling";
    console.log(
      `[kdeconnect-sync] Starting polling mode (interval: ${this.config.pollInterval}ms)`
    );

    this.pollTimer = setInterval(async () => {
      if (!this.running) return;

      try {
        const count = await this.pollForNewMessages();
        if (count > 0) {
          this.emit("sync", { count });
        }
      } catch (err) {
        console.error("[kdeconnect-sync] Poll error:", err);
        this.stats.errors++;
      }
    }, this.config.pollInterval);
  }

  private async pollForNewMessages(): Promise<number> {
    // Get all conversations
    const conversations = await this.client.getActiveConversations(this.deviceId!);
    let totalProcessed = 0;

    for (const conv of conversations) {
      try {
        const messages = await this.client.getMessages(conv.threadId, this.deviceId!, {
          timeout: this.config.messageTimeout,
        });

        if (messages.length > 0) {
          const stored = await this.processMessages(conv.threadId, messages);
          totalProcessed += stored.length;
        }
      } catch (err) {
        console.error(`[kdeconnect-sync] Failed to poll thread ${conv.threadId}:`, err);
        this.stats.errors++;
      }
    }

    if (totalProcessed > 0) {
      this.stats.lastSync = new Date();
    }

    return totalProcessed;
  }

  // ===========================================================================
  // Historic Import
  // ===========================================================================

  /**
   * Import historic messages from all conversations
   * Yields messages as they are imported
   */
  async *importHistoric(
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

    this.stats.mode = "importing";

    // Get device
    let deviceId = options.deviceId || this.config.deviceId || this.deviceId;
    if (!deviceId) {
      const device = await this.client.getDefaultDevice();
      if (!device) {
        throw new Error("No KDE Connect device available");
      }
      deviceId = device.id;
    }

    this.client.selectDevice(deviceId);

    // Start signal monitor for message retrieval
    if (!this.client.isMonitorRunning()) {
      this.client.startSignalMonitor(deviceId);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log("[kdeconnect-sync] Starting historic import...");

    // Ensure self account
    if (!this.seenAccounts.has(SELF_ACCOUNT_ID)) {
      await this.store.getOrCreateAccount({
        id: SELF_ACCOUNT_ID,
        name: "Me (SMS)",
        identities: [{ platform: "sms", handle: "self" }],
        is_self: true,
      });
      this.seenAccounts.add(SELF_ACCOUNT_ID);
      stats.accounts++;
    }

    // Get conversations
    console.log("[kdeconnect-sync] Fetching conversation list...");
    await this.client.requestAllConversations(deviceId);
    const conversations = await this.client.getActiveConversations(deviceId);
    console.log(`[kdeconnect-sync] Found ${conversations.length} conversations`);

    // Filter if specific threads requested
    let targetConversations = conversations;
    if (options.threadIds?.length) {
      targetConversations = conversations.filter((c) =>
        options.threadIds!.includes(c.threadId)
      );
    }

    // Process each conversation
    for (const conv of targetConversations) {
      try {
        stats.conversations++;
        this.stats.conversationsProcessed++;

        // Create thread if not seen
        const threadId = createThreadId(conv.threadId, conv.addresses);
        if (!this.seenThreads.has(threadId)) {
          const isGroup = conv.addresses.length > 1;
          const title = isGroup
            ? `Group (${conv.addresses.length})`
            : formatPhoneDisplay(conv.addresses[0] || "Unknown");

          await this.store.getOrCreateThread({
            id: threadId,
            title,
            type: isGroup ? "group" : "dm",
            participants: [SELF_ACCOUNT_ID],
            source: {
              platform: "sms",
              platform_id: String(conv.threadId),
            },
          });
          this.seenThreads.add(threadId);
        }

        // Create accounts for addresses
        for (const address of conv.addresses) {
          const accountId = createAccountId(address);
          if (!this.seenAccounts.has(accountId)) {
            await this.store.getOrCreateAccount({
              id: accountId,
              name: formatPhoneDisplay(address),
              identities: [{ platform: "sms", handle: address }],
            });
            this.seenAccounts.add(accountId);
            stats.accounts++;
          }
        }

        // Get messages for this conversation
        console.log(`[kdeconnect-sync] Fetching messages for thread ${conv.threadId}...`);
        const messages = await this.client.getMessages(conv.threadId, deviceId, {
          since: options.since,
          timeout: this.config.messageTimeout,
        });

        console.log(
          `[kdeconnect-sync] Thread ${conv.threadId}: received ${messages.length} messages`
        );

        // Process and store messages
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

            // Build and store message
            const isOutgoing = msg.type === 2;
            const senderAccountId = isOutgoing
              ? SELF_ACCOUNT_ID
              : createAccountId(msg.address);

            const input: MessageInput = {
              kind: Kind.SMS,
              content: msg.body,
              account_id: senderAccountId,
              author: {
                name: isOutgoing ? "Me" : formatPhoneDisplay(msg.address),
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
                ["message_type", "sms"],
                ["phone_number", msg.address],
                ["source", "kdeconnect"],
              ],
            };

            const message = await this.store.createMessage(input);
            this.searchIndex.index(message);
            stats.messages++;
            this.stats.messagesProcessed++;

            yield message;
          } catch (err) {
            console.error(`[kdeconnect-sync] Failed to store message:`, err);
            stats.errors++;
          }
        }
      } catch (err) {
        console.error(`[kdeconnect-sync] Failed to process thread ${conv.threadId}:`, err);
        stats.errors++;
      }
    }

    this.stats.mode = this.running ? "monitoring" : "stopped";
    console.log(
      `[kdeconnect-sync] Import complete: ${stats.messages} messages from ${stats.conversations} conversations`
    );

    return stats;
  }

  // ===========================================================================
  // Message Processing
  // ===========================================================================

  private async processMessages(
    threadId: number,
    messages: KdeConnectMessage[]
  ): Promise<Message[]> {
    const results: Message[] = [];

    // Get conversation metadata for thread ID generation
    const conv = await this.client.getConversation(threadId, this.deviceId!);
    if (!conv) {
      console.warn(`[kdeconnect-sync] Could not get metadata for thread ${threadId}`);
      return results;
    }

    const unifiedThreadId = createThreadId(threadId, conv.addresses);

    // Ensure thread exists
    if (!this.seenThreads.has(unifiedThreadId)) {
      const isGroup = conv.addresses.length > 1;
      await this.store.getOrCreateThread({
        id: unifiedThreadId,
        title: conv.displayName || formatPhoneDisplay(conv.addresses[0] || "Unknown"),
        type: isGroup ? "group" : "dm",
        participants: [SELF_ACCOUNT_ID],
        source: {
          platform: "sms",
          platform_id: String(threadId),
        },
      });
      this.seenThreads.add(unifiedThreadId);
    }

    // Ensure accounts exist
    for (const address of conv.addresses) {
      const accountId = createAccountId(address);
      if (!this.seenAccounts.has(accountId)) {
        await this.store.getOrCreateAccount({
          id: accountId,
          name: formatPhoneDisplay(address),
          identities: [{ platform: "sms", handle: address }],
        });
        this.seenAccounts.add(accountId);
      }
    }

    // Process each message
    for (const msg of messages) {
      try {
        const isOutgoing = msg.type === 2;
        const senderAccountId = isOutgoing
          ? SELF_ACCOUNT_ID
          : createAccountId(msg.address);

        const input: MessageInput = {
          kind: Kind.SMS,
          content: msg.body,
          account_id: senderAccountId,
          author: {
            name: isOutgoing ? "Me" : formatPhoneDisplay(msg.address),
            handle: msg.address,
          },
          created_at: msg.date,
          refs: {
            thread_id: unifiedThreadId,
          },
          source: {
            platform: "sms",
            platform_id: createPlatformMessageId(msg.threadId, msg.id),
          },
          tags: [
            ["direction", isOutgoing ? "outgoing" : "incoming"],
            ["message_type", "sms"],
            ["phone_number", msg.address],
            ["source", "kdeconnect-live"],
          ],
        };

        const message = await this.store.createMessage(input);
        this.searchIndex.index(message);
        this.stats.messagesProcessed++;
        results.push(message);

        this.emit("message", message);
      } catch (err) {
        console.error(`[kdeconnect-sync] Failed to store message:`, err);
        this.stats.errors++;
      }
    }

    return results;
  }
}

// =============================================================================
// Singleton
// =============================================================================

let syncServiceInstance: KdeConnectSyncService | null = null;

/**
 * Get or create the global sync service instance
 */
export function getKdeConnectSyncService(
  config?: KdeConnectSyncConfig
): KdeConnectSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new KdeConnectSyncService(config);
  }
  return syncServiceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export async function resetKdeConnectSyncService(): Promise<void> {
  if (syncServiceInstance) {
    await syncServiceInstance.stop();
    syncServiceInstance = null;
  }
}
