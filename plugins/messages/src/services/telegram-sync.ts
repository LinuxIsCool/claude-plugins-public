/**
 * Telegram Sync Service
 *
 * Continuous background sync of Telegram messages using GramJS event handlers.
 * Monitors all chats: DMs, groups, and channels.
 *
 * Usage:
 *   import { TelegramSyncService } from "./services/telegram-sync";
 *   const sync = new TelegramSyncService();
 *   await sync.start();
 *   // ... later
 *   sync.stop();
 *
 * Architecture:
 * - Uses GramJS addEventHandler for real-time push
 * - NewMessage event fires for all incoming and outgoing messages
 * - No polling needed - pure event-driven
 * - Reconnects automatically on disconnect
 */

import { EventEmitter } from "events";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Api } from "telegram/tl";
import { MessageStore } from "../core/store";
import { SearchIndex } from "../search/index";
import type { MessageInput, Message } from "../types";
import { Kind } from "../types";
import {
  loadCredentials,
  loadSession,
  TelegramCredentials,
} from "../integrations/telegram/client";

/**
 * Sync service configuration
 */
export interface TelegramSyncConfig {
  /** Connection retry attempts. Default: 5 */
  connectionRetries?: number;
  /** Max reconnect attempts before giving up. Default: 10 */
  maxReconnectAttempts?: number;
  /** Backoff base in ms for reconnect. Default: 1000 */
  reconnectBackoff?: number;
}

/**
 * Sync service statistics
 */
export interface TelegramSyncStats {
  mode: "connected" | "disconnected" | "reconnecting";
  messagesProcessed: number;
  errors: number;
  lastSync?: Date;
  startedAt?: Date;
  reconnectAttempts: number;
  dialogsLoaded: number;
}

/**
 * Dialog (chat) information cache
 */
interface DialogCache {
  id: string;
  title: string;
  type: "user" | "group" | "channel";
}

/**
 * Create account ID from Telegram user ID
 */
function createAccountId(userId: string): string {
  return `telegram_${userId}`;
}

/**
 * Create thread ID from dialog ID and type
 */
function createThreadId(dialogId: string, type: string): string {
  return `telegram_${type}_${dialogId}`;
}

/**
 * Telegram Sync Service
 *
 * Provides continuous real-time message sync from Telegram.
 * Emits events: 'message', 'error', 'connected', 'disconnected', 'sync'
 */
export class TelegramSyncService extends EventEmitter {
  private config: Required<TelegramSyncConfig>;
  private store: MessageStore;
  private searchIndex: SearchIndex;
  private client: TelegramClient | null = null;
  private credentials: TelegramCredentials;
  private running = false;
  private stats: TelegramSyncStats;
  private dialogs: Map<string, DialogCache> = new Map();
  private myUserId: string = "";
  private myName: string = "";
  private myAccountId: string = "";
  private seenAccounts = new Set<string>();
  private seenThreads = new Set<string>();

  constructor(config?: TelegramSyncConfig) {
    super();

    this.credentials = loadCredentials();

    this.config = {
      connectionRetries: config?.connectionRetries ?? 5,
      maxReconnectAttempts: config?.maxReconnectAttempts ?? 10,
      reconnectBackoff: config?.reconnectBackoff ?? 1000,
    };

    this.store = new MessageStore();
    this.searchIndex = new SearchIndex();

    this.stats = {
      mode: "disconnected",
      messagesProcessed: 0,
      errors: 0,
      reconnectAttempts: 0,
      dialogsLoaded: 0,
    };
  }

  /**
   * Start the sync service
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[telegram-sync] Already running");
      return;
    }

    this.running = true;
    this.stats.startedAt = new Date();
    this.stats.reconnectAttempts = 0;

    await this.connect();
  }

  /**
   * Stop the sync service
   */
  async stop(): Promise<void> {
    this.running = false;
    this.stats.mode = "disconnected";

    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.client = null;
    }

    this.emit("disconnected");
    console.log("[telegram-sync] Stopped");
  }

  /**
   * Get sync statistics
   */
  getStats(): TelegramSyncStats {
    return { ...this.stats };
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  private async connect(): Promise<void> {
    try {
      console.log("[telegram-sync] Connecting to Telegram...");

      // Load session
      const sessionString = loadSession();
      if (!sessionString) {
        throw new Error(
          "No session found. Run 'bun plugins/messages/src/cli.ts telegram-auth' first."
        );
      }

      // Create client
      const session = new StringSession(sessionString);
      this.client = new TelegramClient(
        session,
        this.credentials.apiId,
        this.credentials.apiHash,
        {
          connectionRetries: this.config.connectionRetries,
        }
      );

      await this.client.connect();

      // Verify authorization
      if (!(await this.client.isUserAuthorized())) {
        throw new Error("Session expired. Run 'telegram-auth' again.");
      }

      // Get self info
      const me = await this.client.getMe();
      if (me instanceof Api.User) {
        this.myUserId = me.id.toString();
        this.myName = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.username || "Me";
        this.myAccountId = createAccountId(this.myUserId);

        // Ensure self account exists
        await this.store.getOrCreateAccount({
          id: this.myAccountId,
          name: this.myName,
          identities: [{ platform: "telegram", handle: this.myUserId }],
        });
        this.seenAccounts.add(this.myAccountId);
      }

      // Load dialogs for context
      await this.loadDialogs();

      // Set up message handler
      this.client.addEventHandler(
        (event: NewMessageEvent) => this.handleNewMessage(event),
        new NewMessage({})
      );

      this.stats.mode = "connected";
      this.stats.reconnectAttempts = 0;
      console.log(`[telegram-sync] Connected as ${this.myName} (${this.myUserId})`);
      this.emit("connected", { mode: "event" });

    } catch (err) {
      console.error("[telegram-sync] Connection failed:", err);
      this.stats.errors++;
      this.emit("error", err);

      // Try reconnect
      await this.handleReconnect();
    }
  }

  private async loadDialogs(): Promise<void> {
    if (!this.client) return;

    try {
      console.log("[telegram-sync] Loading dialogs...");

      for await (const dialog of this.client.iterDialogs({})) {
        const id = dialog.id?.toString() || "";
        if (!id) continue;

        let type: "user" | "group" | "channel" = "user";
        if (dialog.isGroup) {
          type = "group";
        } else if (dialog.isChannel) {
          type = "channel";
        }

        this.dialogs.set(id, {
          id,
          title: dialog.title || "Unknown",
          type,
        });
      }

      this.stats.dialogsLoaded = this.dialogs.size;
      console.log(`[telegram-sync] Loaded ${this.dialogs.size} dialogs`);
    } catch (err) {
      console.error("[telegram-sync] Failed to load dialogs:", err);
    }
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private async handleNewMessage(event: NewMessageEvent): Promise<void> {
    if (!this.running || !event.message) return;

    try {
      const msg = event.message;

      // Skip empty messages
      if (!msg.text?.trim()) return;

      // Determine direction
      const isOutgoing = msg.out || false;

      // Get chat info
      let chatId = "";
      let chatTitle = "Unknown";
      let chatType: "user" | "group" | "channel" = "user";

      if (msg.peerId) {
        if (msg.peerId instanceof Api.PeerUser) {
          chatId = msg.peerId.userId.toString();
          chatType = "user";
        } else if (msg.peerId instanceof Api.PeerChat) {
          chatId = msg.peerId.chatId.toString();
          chatType = "group";
        } else if (msg.peerId instanceof Api.PeerChannel) {
          chatId = msg.peerId.channelId.toString();
          chatType = "channel";
        }
      }

      // Use cached dialog info if available
      const dialog = this.dialogs.get(chatId);
      if (dialog) {
        chatTitle = dialog.title;
        chatType = dialog.type;
      }

      // Get sender info
      let senderId = "";
      let senderName = "Unknown";

      if (msg.fromId) {
        if (msg.fromId instanceof Api.PeerUser) {
          senderId = msg.fromId.userId.toString();
        } else if (msg.fromId instanceof Api.PeerChannel) {
          senderId = msg.fromId.channelId.toString();
        }
      } else if (isOutgoing) {
        senderId = this.myUserId;
        senderName = this.myName;
      }

      // Try to get sender name from cache or API
      if (senderId && senderId !== this.myUserId && senderName === "Unknown") {
        try {
          if (this.client) {
            const entity = await this.client.getEntity(senderId);
            if (entity instanceof Api.User) {
              senderName = [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.username || "Unknown";
            } else if (entity instanceof Api.Channel || entity instanceof Api.Chat) {
              senderName = entity.title || "Unknown";
            }
          }
        } catch {
          // Ignore entity fetch errors
        }
      }

      // For outgoing messages, sender is self
      if (isOutgoing) {
        senderId = this.myUserId;
        senderName = this.myName;
      }

      // Process the message
      const message = await this.processMessage({
        id: msg.id,
        text: msg.text,
        date: new Date(msg.date * 1000),
        senderId,
        senderName,
        isOutgoing,
        chatId,
        chatTitle,
        chatType,
        replyToMsgId: msg.replyTo?.replyToMsgId,
      });

      if (message) {
        this.stats.messagesProcessed++;
        this.stats.lastSync = new Date();
        this.emit("message", message);
        this.emit("sync", { count: 1, mode: "event" });
      }
    } catch (err) {
      console.error("[telegram-sync] Error handling message:", err);
      this.stats.errors++;
      this.emit("error", err);
    }
  }

  private async processMessage(data: {
    id: number;
    text: string;
    date: Date;
    senderId: string;
    senderName: string;
    isOutgoing: boolean;
    chatId: string;
    chatTitle: string;
    chatType: "user" | "group" | "channel";
    replyToMsgId?: number;
  }): Promise<Message | null> {
    const {
      id,
      text,
      date,
      senderId,
      senderName,
      isOutgoing,
      chatId,
      chatTitle,
      chatType,
    } = data;

    // Ensure sender account exists
    const senderAccountId = isOutgoing ? this.myAccountId : createAccountId(senderId);

    if (!this.seenAccounts.has(senderAccountId)) {
      await this.store.getOrCreateAccount({
        id: senderAccountId,
        name: senderName,
        identities: [{ platform: "telegram", handle: senderId }],
      });
      this.seenAccounts.add(senderAccountId);
    }

    // Ensure thread exists
    const threadId = createThreadId(chatId, chatType);

    if (!this.seenThreads.has(threadId)) {
      await this.store.getOrCreateThread({
        id: threadId,
        title: chatTitle,
        type: chatType === "user" ? "dm" : "group",
        participants: [this.myAccountId],
        source: {
          platform: "telegram",
          platform_id: chatId,
        },
      });
      this.seenThreads.add(threadId);
    }

    // Build message input
    const input: MessageInput = {
      kind: Kind.Telegram,
      content: text,
      account_id: senderAccountId,
      author: {
        name: senderName,
        handle: senderId,
      },
      created_at: date,
      refs: {
        thread_id: threadId,
        reply_to: data.replyToMsgId ? `telegram_msg_${data.replyToMsgId}` : undefined,
      },
      source: {
        platform: "telegram",
        platform_id: `msg_${id}`,
      },
      tags: [
        ["direction", isOutgoing ? "outgoing" : "incoming"],
        ["source", "live"],
        ["chat_type", chatType],
      ],
    };

    // Create message
    const message = await this.store.createMessage(input);

    // Index for search
    this.searchIndex.index(message);

    return message;
  }

  // ===========================================================================
  // Reconnection Logic
  // ===========================================================================

  private async handleReconnect(): Promise<void> {
    if (!this.running) return;

    this.stats.mode = "reconnecting";
    this.stats.reconnectAttempts++;

    if (this.stats.reconnectAttempts > this.config.maxReconnectAttempts) {
      console.log("[telegram-sync] Max reconnect attempts reached, giving up");
      this.stats.mode = "disconnected";
      return;
    }

    const backoff =
      this.config.reconnectBackoff * Math.pow(2, this.stats.reconnectAttempts - 1);
    console.log(
      `[telegram-sync] Reconnecting in ${backoff}ms (attempt ${this.stats.reconnectAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, backoff));

    if (!this.running) return;

    // Clean up old client
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // Ignore
      }
      this.client = null;
    }

    // Reconnect
    await this.connect();
  }
}

/**
 * Singleton instance for global access
 */
let syncService: TelegramSyncService | null = null;

/**
 * Get or create the global sync service instance
 */
export function getTelegramSyncService(
  config?: TelegramSyncConfig
): TelegramSyncService {
  if (!syncService) {
    syncService = new TelegramSyncService(config);
  }
  return syncService;
}

/**
 * Reset the singleton (for testing)
 */
export async function resetTelegramSyncService(): Promise<void> {
  if (syncService) {
    await syncService.stop();
    syncService = null;
  }
}
