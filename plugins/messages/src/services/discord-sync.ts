/**
 * Discord Sync Service
 *
 * Continuous background sync for Discord messages.
 * Uses discord.js-selfbot-v13 for real-time message reception.
 *
 * Usage:
 *   const service = getDiscordSyncService();
 *   service.on("message", (msg) => console.log(msg));
 *   await service.start();
 */

import { EventEmitter } from "events";
import { createStore } from "../core/store";
import { createSearchIndex } from "../search";
import {
  getDiscordClient,
  isDiscordAvailable,
  resetDiscordClient,
} from "../integrations/discord/client";
import type {
  DiscordConfig,
  DiscordSyncStats,
  DiscordMessage,
  DiscordThread,
  MessageEvent,
  ReactionEvent,
} from "../integrations/discord/types";
import { Kind } from "../types";
import type { MessageInput } from "../types";

/**
 * Discord Sync Service
 *
 * Manages continuous synchronization of Discord messages.
 * Emits events: 'message', 'connected', 'disconnected', 'error', 'sync'
 */
export class DiscordSyncService extends EventEmitter {
  private config: DiscordConfig;
  private running = false;
  private store = createStore();
  private searchIndex = createSearchIndex();
  private stats: DiscordSyncStats = {
    mode: "idle",
    messagesProcessed: 0,
    channelsProcessed: 0,
    threadsProcessed: 0,
    guildsProcessed: 0,
    errors: 0,
    reconnectAttempts: 0,
  };

  // Caches for deduplication
  private seenAccounts = new Set<string>();
  private seenThreads = new Set<string>();
  private myAccountId: string | null = null;
  private myUsername: string | null = null;
  private myDiscriminator: string | null = null;

  constructor(config: DiscordConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Start the sync service
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[discord-sync] Already running");
      return;
    }

    this.running = true;
    this.stats.startedAt = new Date();
    this.stats.mode = "syncing";

    const client = getDiscordClient(this.config);

    // Set up event handlers
    this.setupClientHandlers(client);

    // Connect
    console.log("[discord-sync] Starting Discord sync...");

    try {
      await client.connect();

      // Wait for connection
      if (!client.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connection timeout"));
          }, 60000);

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
        this.myAccountId = this.createAccountId(me.id);
        this.myUsername = me.username;
        this.myDiscriminator = me.discriminator;

        // Create self account
        await this.store.getOrCreateAccount({
          id: this.myAccountId,
          name: me.displayName || me.username,
          identities: [{ platform: "discord", handle: `${me.username}#${me.discriminator}` }],
          is_self: true,
        });
        this.seenAccounts.add(this.myAccountId);
      }

      // Count guilds
      const guilds = await client.getGuilds();
      this.stats.guildsProcessed = guilds.length;

      console.log(`[discord-sync] Connected to ${guilds.length} guilds`);
      console.log("[discord-sync] Sync service started");
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

    // Disconnect the client (singleton will be reused on next start)
    const client = getDiscordClient(this.config);
    await client.disconnect();

    console.log("[discord-sync] Sync service stopped");
    this.emit("stopped", this.stats);
  }

  /**
   * Get current statistics
   */
  getStats(): DiscordSyncStats {
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
   * Set up Discord client event handlers
   *
   * Attaches handlers for all client events. Updates stats and re-emits
   * events for external listeners. Uses the singleton pattern for lifecycle
   * management (same pattern as WhatsApp sync service).
   */
  private setupClientHandlers(client: ReturnType<typeof getDiscordClient>): void {
    // Connected - client is ready
    client.on("connected", () => {
      console.log("[discord-sync] Connected to Discord");
      this.stats.mode = "realtime";
      this.stats.reconnectAttempts = 0;
      this.emit("connected");
    });

    // Disconnected - connection lost
    client.on("disconnected", (info?: { statusCode?: number; shouldReconnect?: boolean }) => {
      console.log("[discord-sync] Disconnected:", info);
      if (info?.shouldReconnect) {
        this.stats.mode = "syncing";
      } else {
        this.stats.mode = "stopped";
      }
      this.emit("disconnected", info);
    });

    // Reconnecting - auto-reconnect in progress
    client.on("reconnecting", (info: { attempt: number }) => {
      console.log(`[discord-sync] Reconnecting (attempt ${info.attempt})...`);
      this.stats.reconnectAttempts = info.attempt;
      this.emit("reconnecting", info);
    });

    // Error - client error occurred
    client.on("error", (error: Error) => {
      console.error("[discord-sync] Error:", error);
      this.stats.errors++;
      this.emit("error", error);
    });

    // Message - new message received
    client.on("message", async (event: MessageEvent) => {
      await this.handleMessage(event.message, event.isNew);
    });

    // Message Update - message edited
    client.on("message_update", async (event: { message: DiscordMessage }) => {
      // Treat updates as new messages for indexing
      await this.handleMessage(event.message, false);
    });

    // Message Delete - message deleted
    client.on("message_delete", (event: { messageId: string; channelId: string }) => {
      // Log deletes - could mark messages as deleted in future
      console.log(`[discord-sync] Message deleted: ${event.messageId} in ${event.channelId}`);
      this.emit("message_delete", event);
    });

    // Reaction Add - reaction added to message
    client.on("reaction_add", async (event: ReactionEvent) => {
      await this.handleReaction(event);
    });

    // Reaction Remove - reaction removed from message
    client.on("reaction_remove", async (event: ReactionEvent) => {
      await this.handleReaction(event);
    });

    // Thread Create - new thread created
    client.on("thread_create", async (thread: DiscordThread) => {
      await this.handleThread(thread);
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(msg: DiscordMessage, _isNew: boolean): Promise<void> {
    try {
      // Build content from message + embeds + attachments
      let content = msg.content;

      // Add embed content if no text
      if (!content && msg.embeds.length > 0) {
        const embed = msg.embeds[0];
        content = [
          embed.title,
          embed.description,
          embed.fields?.map((f) => `**${f.name}**: ${f.value}`).join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n");
      }

      // Add attachment info if no other content
      if (!content && msg.attachments.length > 0) {
        content = msg.attachments.map((a) => `[${a.filename}](${a.url})`).join("\n");
      }

      // Skip messages with no content
      if (!content) {
        return;
      }

      // Determine sender (compare prefixed IDs to avoid string manipulation errors)
      const senderAccountId = this.createAccountId(msg.author.id);
      const isOutgoing = senderAccountId === this.myAccountId;

      // Create sender account if needed
      if (!this.seenAccounts.has(senderAccountId)) {
        await this.store.getOrCreateAccount({
          id: senderAccountId,
          name: msg.author.displayName || msg.author.username,
          identities: [
            {
              platform: "discord",
              handle: `${msg.author.username}#${msg.author.discriminator}`,
            },
          ],
        });
        this.seenAccounts.add(senderAccountId);
      }

      // Determine thread type and ID
      const threadId = this.createThreadId(msg);
      if (!this.seenThreads.has(threadId)) {
        await this.store.getOrCreateThread({
          id: threadId,
          title: this.getThreadTitle(msg),
          type: msg.guildId ? "group" : "dm",
          participants: [this.myAccountId!],
          source: {
            platform: "discord",
            platform_id: msg.channelId,
            room_id: msg.guildId,
          },
        });
        this.seenThreads.add(threadId);
        this.stats.channelsProcessed++;
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.Discord,
        content,
        account_id: senderAccountId,
        author: {
          name: isOutgoing
            ? this.myUsername || "Me"
            : msg.author.displayName || msg.author.username,
          handle: `${msg.author.username}#${msg.author.discriminator}`,
        },
        created_at: msg.timestamp,
        refs: {
          thread_id: threadId,
          reply_to: msg.replyTo?.messageId
            ? this.createReplyRef(msg.replyTo.messageId)
            : undefined,
          room_id: msg.guildId,
          mentions: msg.mentions.map((m) => this.createAccountId(m.id)),
        },
        source: {
          platform: "discord",
          platform_id: msg.id,
          url: this.buildMessageUrl(msg),
        },
        tags: this.buildMessageTags(msg, isOutgoing),
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
      console.error("[discord-sync] Error processing message:", error);
      this.stats.errors++;
      this.emit("error", error);
    }
  }

  /**
   * Handle reaction event
   */
  private async handleReaction(event: ReactionEvent): Promise<void> {
    // For now, just log reactions - could store as separate messages
    // with Kind.Reaction in the future
    console.log(
      `[discord-sync] Reaction ${event.type}: ${event.emoji.name} on ${event.messageId}`
    );
  }

  /**
   * Handle thread creation
   */
  private async handleThread(thread: DiscordThread): Promise<void> {
    const threadId = `discord_thread_${thread.id}`;

    if (!this.seenThreads.has(threadId)) {
      await this.store.getOrCreateThread({
        id: threadId,
        title: thread.name,
        type: "topic",
        participants: [this.myAccountId!],
        source: {
          platform: "discord",
          platform_id: thread.id,
          room_id: thread.parentId, // Parent channel reference
        },
      });
      this.seenThreads.add(threadId);
      this.stats.threadsProcessed++;
    }
  }

  /**
   * Create account ID from user ID
   */
  private createAccountId(userId: string): string {
    return `discord_${userId}`;
  }

  /**
   * Create thread ID from message
   */
  private createThreadId(msg: DiscordMessage): string {
    // Check if message is in a thread
    if (msg.thread) {
      return `discord_thread_${msg.thread.id}`;
    }

    // DM or group DM
    if (!msg.guildId) {
      return `discord_dm_${msg.channelId}`;
    }

    // Server channel
    return `discord_channel_${msg.channelId}`;
  }

  /**
   * Get thread title from message
   */
  private getThreadTitle(msg: DiscordMessage): string {
    if (msg.thread) {
      return msg.thread.name;
    }
    // For channels, we'd need channel name - use ID for now
    return `Channel ${msg.channelId}`;
  }

  /**
   * Create reply reference
   */
  private createReplyRef(messageId: string): string {
    return `discord_msg_${messageId}`;
  }

  /**
   * Build message URL
   */
  private buildMessageUrl(msg: DiscordMessage): string {
    if (msg.guildId) {
      return `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`;
    }
    return `https://discord.com/channels/@me/${msg.channelId}/${msg.id}`;
  }

  /**
   * Build message tags
   */
  private buildMessageTags(
    msg: DiscordMessage,
    isOutgoing: boolean
  ): [string, string][] {
    const tags: [string, string][] = [
      ["direction", isOutgoing ? "outgoing" : "incoming"],
      ["message_type", msg.type],
    ];

    if (msg.guildId) {
      tags.push(["guild_id", msg.guildId]);
    }

    tags.push(["channel_id", msg.channelId]);

    if (msg.pinned) {
      tags.push(["pinned", "true"]);
    }

    if (msg.embeds.length > 0) {
      tags.push(["has_embed", "true"]);
    }

    if (msg.attachments.length > 0) {
      tags.push(["attachments", msg.attachments.length.toString()]);
    }

    // Add reactions as tags
    for (const reaction of msg.reactions) {
      tags.push(["reaction", `${reaction.emoji.name}:${reaction.count}`]);
    }

    return tags;
  }
}

// ===========================================================================
// Singleton
// ===========================================================================

let syncServiceInstance: DiscordSyncService | null = null;

/**
 * Get or create Discord sync service instance
 */
export function getDiscordSyncService(config?: DiscordConfig): DiscordSyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new DiscordSyncService(config);
  }
  return syncServiceInstance;
}

/**
 * Reset the sync service (useful for testing)
 */
export function resetDiscordSyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.stop().catch(() => {});
    syncServiceInstance = null;
  }
  resetDiscordClient();
}

// Re-export availability check
export { isDiscordAvailable };
