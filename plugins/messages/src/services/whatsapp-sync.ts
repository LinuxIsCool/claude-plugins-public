/**
 * WhatsApp Sync Service
 *
 * Continuous background sync for WhatsApp messages.
 * Uses Baileys event-driven architecture for real-time message reception.
 *
 * Usage:
 *   const service = getWhatsAppSyncService();
 *   service.on("message", (msg) => console.log(msg));
 *   await service.start();
 */

import { EventEmitter } from "events";
import { createStore } from "../core/store";
import { createSearchIndex } from "../search";
import {
  getWhatsAppClient,
  isWhatsAppAvailable,
  resetWhatsAppClient,
} from "../integrations/whatsapp/client";
import type {
  WhatsAppConfig,
  WhatsAppSyncStats,
  WhatsAppMessage,
} from "../integrations/whatsapp/types";
import { Kind } from "../types";
import type { Message, MessageInput } from "../types";

/**
 * WhatsApp Sync Service
 *
 * Manages continuous synchronization of WhatsApp messages.
 * Emits events: 'message', 'connected', 'disconnected', 'error', 'sync'
 */
export class WhatsAppSyncService extends EventEmitter {
  private config: WhatsAppConfig;
  private running = false;
  private store = createStore();
  private searchIndex = createSearchIndex();
  private stats: WhatsAppSyncStats = {
    mode: "idle",
    messagesProcessed: 0,
    chatsProcessed: 0,
    errors: 0,
    reconnectAttempts: 0,
  };

  // Caches for deduplication
  private seenAccounts = new Set<string>();
  private seenThreads = new Set<string>();
  private myAccountId: string | null = null;
  private myPhone: string | null = null;
  private myName: string | null = null;

  constructor(config: WhatsAppConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Start the sync service
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[whatsapp-sync] Already running");
      return;
    }

    this.running = true;
    this.stats.startedAt = new Date();
    this.stats.mode = "syncing";

    const client = getWhatsAppClient(this.config);

    // Set up event handlers
    client.on("connected", () => {
      console.log("[whatsapp-sync] Connected to WhatsApp");
      this.stats.mode = "realtime";
      this.stats.reconnectAttempts = 0;
      this.emit("connected");
    });

    client.on("disconnected", (info?: { statusCode?: number; shouldReconnect?: boolean }) => {
      console.log("[whatsapp-sync] Disconnected:", info);
      if (info?.shouldReconnect) {
        this.stats.mode = "syncing";
        this.stats.reconnectAttempts++;
      } else {
        this.stats.mode = "stopped";
      }
      this.emit("disconnected", info);
    });

    client.on("reconnecting", (info: { attempt: number }) => {
      console.log(`[whatsapp-sync] Reconnecting (attempt ${info.attempt})...`);
      this.stats.reconnectAttempts = info.attempt;
      this.emit("reconnecting", info);
    });

    client.on("error", (error: Error) => {
      console.error("[whatsapp-sync] Error:", error);
      this.stats.errors++;
      this.emit("error", error);
    });

    client.on("message", async (event: { message: WhatsAppMessage; isNew: boolean }) => {
      await this.handleMessage(event.message, event.isNew);
    });

    // Connect
    console.log("[whatsapp-sync] Starting WhatsApp sync...");

    try {
      await client.connect();

      // Wait for connection
      if (!client.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 120000);

          client.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });

          client.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      // Get user info
      const me = client.getMe();
      if (me) {
        this.myAccountId = this.createAccountId(me.jid);
        this.myPhone = me.phone;
        this.myName = me.name;

        // Create self account
        await this.store.getOrCreateAccount({
          id: this.myAccountId,
          name: me.name || "Me (WhatsApp)",
          identities: [{ platform: "whatsapp", handle: me.phone }],
          is_self: true,
        });
        this.seenAccounts.add(this.myAccountId);
      }

      console.log("[whatsapp-sync] Sync service started");
      this.emit("sync", { count: 0, mode: "realtime" });
    } catch (error) {
      this.running = false;
      this.stats.mode = "stopped";
      throw error;
    }
  }

  /**
   * Stop the sync service
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.stats.mode = "stopped";

    const client = getWhatsAppClient(this.config);
    await client.disconnect();

    console.log("[whatsapp-sync] Sync service stopped");
    this.emit("stopped", this.stats);
  }

  /**
   * Get current statistics
   */
  getStats(): WhatsAppSyncStats {
    return { ...this.stats };
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.running;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: WhatsAppMessage, _isNew: boolean): Promise<void> {
    try {
      // Skip messages without text content
      if (!msg.text && !msg.caption) {
        return;
      }

      const content = msg.text || msg.caption || "";

      // Determine sender
      const isOutgoing = msg.fromMe;
      const senderAccountId = isOutgoing
        ? this.myAccountId!
        : this.createAccountId(msg.senderJid);

      // Create sender account if needed
      if (!this.seenAccounts.has(senderAccountId)) {
        await this.store.getOrCreateAccount({
          id: senderAccountId,
          name: msg.senderName || this.extractPhone(msg.senderJid),
          identities: [{ platform: "whatsapp", handle: this.extractPhone(msg.senderJid) }],
        });
        this.seenAccounts.add(senderAccountId);
      }

      // Determine chat type
      let chatType: "dm" | "group" | "broadcast" = "dm";
      if (msg.chatId.includes("@g.us")) {
        chatType = "group";
      } else if (msg.chatId.includes("@broadcast")) {
        chatType = "broadcast";
      }

      // Create thread if needed
      const threadId = this.createThreadId(msg.chatId, chatType);
      if (!this.seenThreads.has(threadId)) {
        await this.store.getOrCreateThread({
          id: threadId,
          title: this.extractPhone(msg.chatId),
          type: chatType === "dm" ? "dm" : chatType === "group" ? "group" : "channel",
          participants: [this.myAccountId!],
          source: {
            platform: "whatsapp",
            platform_id: msg.chatId,
          },
        });
        this.seenThreads.add(threadId);
        this.stats.chatsProcessed++;
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.WhatsApp,
        content,
        account_id: senderAccountId,
        author: {
          name: isOutgoing ? (this.myName || "Me") : (msg.senderName || this.extractPhone(msg.senderJid)),
          handle: isOutgoing ? this.myPhone! : this.extractPhone(msg.senderJid),
        },
        created_at: msg.timestamp,
        refs: {
          thread_id: threadId,
          reply_to: msg.quotedMessageId
            ? this.createMessageId(msg.timestamp, msg.quotedMessageId)
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

      // Store message
      const message = await this.store.createMessage(input);
      this.stats.messagesProcessed++;
      this.stats.lastSync = new Date();

      // Index for search
      this.searchIndex.index(message);

      // Emit event
      this.emit("message", message);
    } catch (error) {
      console.error("[whatsapp-sync] Error processing message:", error);
      this.stats.errors++;
      this.emit("error", error);
    }
  }

  /**
   * Create account ID from JID
   */
  private createAccountId(jid: string): string {
    const phone = jid.split("@")[0].split(":")[0];
    return `whatsapp_${phone}`;
  }

  /**
   * Create thread ID
   */
  private createThreadId(chatId: string, type: "dm" | "group" | "broadcast"): string {
    const normalized = chatId.split("@")[0].replace(/[^a-zA-Z0-9-]/g, "_");

    if (type === "group") {
      return `whatsapp_group_${normalized}`;
    } else if (type === "broadcast") {
      return `whatsapp_broadcast_${normalized}`;
    }
    return `whatsapp_dm_${normalized}`;
  }

  /**
   * Create message ID
   */
  private createMessageId(timestamp: number, messageKey: string): string {
    const normalized = messageKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
    return `whatsapp_${timestamp}_${normalized}`;
  }

  /**
   * Extract phone from JID
   */
  private extractPhone(jid: string): string {
    if (!jid) return "Unknown";
    return jid.split("@")[0].split(":")[0];
  }
}

// ===========================================================================
// Singleton
// ===========================================================================

let syncServiceInstance: WhatsAppSyncService | null = null;

/**
 * Get or create WhatsApp sync service instance
 */
export function getWhatsAppSyncService(config?: WhatsAppConfig): WhatsAppSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new WhatsAppSyncService(config);
  }
  return syncServiceInstance;
}

/**
 * Reset the sync service (useful for testing)
 */
export function resetWhatsAppSyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.stop().catch(() => {});
    syncServiceInstance = null;
  }
  resetWhatsAppClient();
}

// Re-export availability check
export { isWhatsAppAvailable };
