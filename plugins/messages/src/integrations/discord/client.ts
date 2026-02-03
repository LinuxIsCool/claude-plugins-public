/**
 * Discord Client
 *
 * Wrapper around discord.js-selfbot-v13 providing a clean API for:
 * - Token authentication
 * - Connection management
 * - Guild, channel, and message fetching
 * - Event handling
 */

import { EventEmitter } from "events";
import { Client, Message as DMessage, TextChannel, DMChannel, ThreadChannel, Guild, Channel } from "discord.js-selfbot-v13";
import {
  loadAuthState,
  saveAuthState,
  hasSession,
  getSessionInfo,
  clearSession,
  type DiscordAuthState,
} from "./auth-state";
import type {
  DiscordConfig,
  DiscordGuild,
  DiscordChannel,
  DiscordChannelType,
  DiscordThread,
  DiscordMessage,
  DiscordUser,
  DiscordMessageType,
  DiscordEmbed,
  DiscordAttachment,
  DiscordReaction,
  DiscordStatus,
  DiscordConnectionState,
} from "./types";

// Default configuration
const DEFAULT_CONFIG: Required<DiscordConfig> = {
  sessionName: "default",
  authStatePath: undefined as unknown as string,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectBackoff: 1000,
};

/**
 * Discord Client - Self-bot wrapper with clean API
 */
export class DiscordClient extends EventEmitter {
  private config: Required<DiscordConfig>;
  private client: Client | null = null;
  private connectionState: DiscordConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;

  constructor(config: DiscordConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Authenticate with a user token
   *
   * Validates the token by connecting to Discord,
   * then saves the session for future use.
   */
  async authenticate(token: string): Promise<DiscordAuthState> {
    // Create temporary client to validate token
    const tempClient = new Client();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        tempClient.destroy();
        reject(new Error("Authentication timeout - token may be invalid"));
      }, 30000);

      tempClient.once("ready", async () => {
        clearTimeout(timeout);

        if (!tempClient.user) {
          tempClient.destroy();
          reject(new Error("Failed to get user info"));
          return;
        }

        const state: DiscordAuthState = {
          token,
          userId: tempClient.user.id,
          username: tempClient.user.username,
          discriminator: tempClient.user.discriminator || "0",
          createdAt: Date.now(),
        };

        // Save session
        await saveAuthState(this.config.sessionName, state);

        // Clean up temp client
        tempClient.destroy();

        this.emit("authenticated");
        resolve(state);
      });

      tempClient.once("error", (error) => {
        clearTimeout(timeout);
        tempClient.destroy();
        reject(error);
      });

      tempClient.login(token).catch((error) => {
        clearTimeout(timeout);
        tempClient.destroy();
        reject(error);
      });
    });
  }

  /**
   * Connect to Discord
   *
   * Loads saved session or env token and connects to the Gateway.
   * Emits events: 'connected', 'disconnected', 'error', 'message'
   */
  async connect(): Promise<void> {
    if (this.client) {
      console.log("[discord-client] Already connected or connecting");
      return;
    }

    // Try saved session first, then env token
    const authState = await loadAuthState(this.config.sessionName);
    const envToken = process.env.DISCORD_TOKEN;
    const token = authState?.token || envToken;

    if (!token) {
      throw new Error("No session found. Run authentication first or set DISCORD_TOKEN in .env");
    }

    this.connectionState = "connecting";
    this.intentionalDisconnect = false;

    try {
      this.client = new Client();

      this.setupEventHandlers();

      await this.client.login(token);
    } catch (error) {
      this.connectionState = "disconnected";
      this.client = null;
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    this.intentionalDisconnect = true;

    try {
      this.client.destroy();
    } catch {
      // Ignore errors during disconnect
    }

    this.client = null;
    this.connectionState = "disconnected";
    this.emit("disconnected");
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected";
  }

  /**
   * Get current connection status
   */
  getStatus(): DiscordStatus {
    const sessionInfo = getSessionInfo(this.config.sessionName);

    return {
      state: this.connectionState,
      isAuthenticated: sessionInfo.exists,
      hasSession: hasSession(this.config.sessionName),
      username: sessionInfo.username,
      userId: sessionInfo.userId,
      discriminator: sessionInfo.discriminator,
      guildCount: this.client?.guilds.cache.size,
    };
  }

  /**
   * Get all guilds
   */
  async getGuilds(): Promise<DiscordGuild[]> {
    if (!this.client) {
      throw new Error("Not connected");
    }

    return this.client.guilds.cache.map((guild) => this.transformGuild(guild));
  }

  /**
   * Get channels for a guild (or all DMs if no guildId)
   */
  async getChannels(guildId?: string): Promise<DiscordChannel[]> {
    if (!this.client) {
      throw new Error("Not connected");
    }

    if (guildId) {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error(`Guild not found: ${guildId}`);
      }

      return guild.channels.cache
        .filter((ch) => isTextBasedChannel(ch))
        .map((ch) => this.transformChannel(ch, guild.name));
    }

    // Return DM channels
    return this.client.channels.cache
      .filter((ch) => ch.type === "DM" || ch.type === "GROUP_DM")
      .map((ch) => this.transformChannel(ch as Channel));
  }

  /**
   * Get threads for a channel
   */
  async getThreads(channelId: string): Promise<DiscordThread[]> {
    if (!this.client) {
      throw new Error("Not connected");
    }

    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !("threads" in channel)) {
      return [];
    }

    const textChannel = channel as TextChannel;
    const threads: DiscordThread[] = [];

    // Get active threads
    for (const thread of textChannel.threads.cache.values()) {
      threads.push(this.transformThread(thread, textChannel.name));
    }

    return threads;
  }

  /**
   * Fetch archived threads from a channel
   *
   * Retrieves both public and private archived threads via the Discord API.
   * Supports pagination for channels with many archived threads.
   */
  async fetchArchivedThreads(
    channelId: string,
    options: { type?: "public" | "private"; before?: string; limit?: number } = {}
  ): Promise<{ threads: DiscordThread[]; hasMore: boolean }> {
    if (!this.client) {
      throw new Error("Not connected");
    }

    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !("threads" in channel)) {
      return { threads: [], hasMore: false };
    }

    const textChannel = channel as TextChannel;
    const threads: DiscordThread[] = [];
    let hasMore = false;

    try {
      // Fetch public archived threads by default
      if (!options.type || options.type === "public") {
        const fetchOptions: { before?: Date; limit?: number } = {};
        if (options.before) fetchOptions.before = new Date(parseInt(options.before));
        if (options.limit) fetchOptions.limit = options.limit;

        const publicArchived = await textChannel.threads.fetchArchived(fetchOptions);

        for (const thread of publicArchived.threads.values()) {
          threads.push(this.transformThread(thread, textChannel.name));
        }
        hasMore = publicArchived.hasMore ?? false;
      }

      // Fetch private archived threads if requested
      if (options.type === "private") {
        try {
          const fetchOptions: { before?: Date; limit?: number; fetchAll?: boolean } = {
            fetchAll: true, // Attempt to fetch private threads
          };
          if (options.before) fetchOptions.before = new Date(parseInt(options.before));
          if (options.limit) fetchOptions.limit = options.limit;

          // Note: discord.js-selfbot-v13 may not support private archived threads
          // This is a best-effort attempt
          const privateArchived = await textChannel.threads.fetchArchived(fetchOptions);

          for (const thread of privateArchived.threads.values()) {
            // Only include threads that are actually archived and private
            if (thread.archived) {
              threads.push(this.transformThread(thread, textChannel.name));
            }
          }
          hasMore = privateArchived.hasMore ?? false;
        } catch (err) {
          // Private threads may not be accessible - that's OK
          console.warn(`[discord-client] Cannot fetch private archived threads for ${channelId}`);
        }
      }
    } catch (error) {
      console.error(`[discord-client] Error fetching archived threads for ${channelId}:`, error);
    }

    return { threads, hasMore };
  }

  /**
   * Fetch all archived threads from a channel (handles pagination)
   */
  async fetchAllArchivedThreads(channelId: string): Promise<DiscordThread[]> {
    const allThreads: DiscordThread[] = [];

    // Fetch public archived threads with pagination
    let publicHasMore = true;
    let publicBefore: string | undefined;

    while (publicHasMore) {
      const result = await this.fetchArchivedThreads(channelId, {
        type: "public",
        before: publicBefore,
        limit: 100,
      });

      allThreads.push(...result.threads);
      publicHasMore = result.hasMore;

      if (result.threads.length > 0) {
        // Use the oldest thread's timestamp for pagination
        const oldest = result.threads[result.threads.length - 1];
        publicBefore = String(oldest.createdAt);
      } else {
        break;
      }
    }

    // Fetch private archived threads with pagination
    let privateHasMore = true;
    let privateBefore: string | undefined;

    while (privateHasMore) {
      const result = await this.fetchArchivedThreads(channelId, {
        type: "private",
        before: privateBefore,
        limit: 100,
      });

      allThreads.push(...result.threads);
      privateHasMore = result.hasMore;

      if (result.threads.length > 0) {
        const oldest = result.threads[result.threads.length - 1];
        privateBefore = String(oldest.createdAt);
      } else {
        break;
      }
    }

    return allThreads;
  }

  /**
   * Fetch message history from a channel
   */
  async fetchMessageHistory(
    channelId: string,
    options: { limit?: number; before?: string } = {}
  ): Promise<DiscordMessage[]> {
    if (!this.client) {
      throw new Error("Not connected");
    }

    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !isTextBasedChannel(channel)) {
      throw new Error(`Text channel not found: ${channelId}`);
    }

    const textChannel = channel as TextChannel | DMChannel | ThreadChannel;
    const messages = await textChannel.messages.fetch({
      limit: Math.min(options.limit || 100, 100),
      before: options.before,
    });

    return messages.map((msg) => this.transformMessage(msg));
  }

  /**
   * Get current user info
   */
  getMe(): DiscordUser | null {
    if (!this.client?.user) {
      return null;
    }

    const user = this.client.user;
    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator || "0",
      displayName: user.displayName || undefined,
      avatar: user.avatar || undefined,
      bot: user.bot || false,
      system: user.system || false,
    };
  }

  /**
   * Clear session and force re-authentication
   */
  async logout(): Promise<void> {
    await this.disconnect();
    clearSession(this.config.sessionName);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Set up discord.js event handlers
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    // Remove any existing listeners to prevent accumulation during reconnects
    this.client.removeAllListeners();

    this.client.on("ready", () => {
      this.connectionState = "connected";
      this.reconnectAttempts = 0;
      console.log(`[discord-client] Connected as ${this.client?.user?.tag}`);
      this.emit("connected");
    });

    this.client.on("messageCreate", (message) => {
      this.emit("message", {
        message: this.transformMessage(message),
        isNew: true,
      });
    });

    this.client.on("messageUpdate", (_oldMessage, newMessage) => {
      if (newMessage.partial) return;
      this.emit("message_update", {
        message: this.transformMessage(newMessage as DMessage),
      });
    });

    this.client.on("messageDelete", (message) => {
      this.emit("message_delete", {
        messageId: message.id,
        channelId: message.channelId,
      });
    });

    this.client.on("messageReactionAdd", (reaction, user) => {
      this.emit("reaction_add", {
        channelId: reaction.message.channelId,
        messageId: reaction.message.id,
        userId: user.id,
        emoji: {
          id: reaction.emoji.id || undefined,
          name: reaction.emoji.name || "?",
          animated: reaction.emoji.animated || false,
        },
        type: "add",
      });
    });

    this.client.on("messageReactionRemove", (reaction, user) => {
      this.emit("reaction_remove", {
        channelId: reaction.message.channelId,
        messageId: reaction.message.id,
        userId: user.id,
        emoji: {
          id: reaction.emoji.id || undefined,
          name: reaction.emoji.name || "?",
          animated: reaction.emoji.animated || false,
        },
        type: "remove",
      });
    });

    this.client.on("threadCreate", (thread) => {
      if (!thread.parent) return;
      this.emit("thread_create", this.transformThread(thread, thread.parent.name));
    });

    this.client.on("error", (error) => {
      console.error("[discord-client] Error:", error);
      this.emit("error", error);
    });

    this.client.on("disconnect", () => {
      if (this.intentionalDisconnect) {
        this.connectionState = "disconnected";
        return;
      }

      this.connectionState = "disconnected";
      this.emit("disconnected", { shouldReconnect: this.config.autoReconnect });

      if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.connectionState = "reconnecting";
        this.emit("reconnecting", { attempt: this.reconnectAttempts });

        const delay = this.config.reconnectBackoff * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => {
          this.client = null;
          this.connect().catch((err) => {
            this.emit("error", err);
          });
        }, Math.min(delay, 60000));
      }
    });
  }

  /**
   * Transform discord.js Guild to our format
   */
  private transformGuild(guild: Guild): DiscordGuild {
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.icon || undefined,
      owner: guild.ownerId === this.client?.user?.id,
      memberCount: guild.memberCount,
      features: [...guild.features],
      raw: guild,
    };
  }

  /**
   * Transform discord.js Channel to our format
   */
  private transformChannel(channel: Channel, guildName?: string): DiscordChannel {
    const baseChannel: DiscordChannel = {
      id: channel.id,
      name: getChannelName(channel),
      type: mapChannelType(channel.type),
      raw: channel,
    };

    if ("guildId" in channel && channel.guildId) {
      baseChannel.guildId = channel.guildId as string;
      baseChannel.guildName = guildName;
    }

    if ("topic" in channel) {
      baseChannel.topic = (channel as TextChannel).topic || undefined;
    }

    if ("position" in channel) {
      baseChannel.position = (channel as TextChannel).position;
    }

    if ("parentId" in channel) {
      baseChannel.parentId = (channel as TextChannel).parentId || undefined;
    }

    if ("nsfw" in channel) {
      baseChannel.nsfw = (channel as TextChannel).nsfw;
    }

    if ("lastMessageId" in channel && (channel as TextChannel).lastMessageId) {
      // Discord snowflake timestamp extraction
      const lastMsgId = (channel as TextChannel).lastMessageId!;
      const timestamp = Number(BigInt(lastMsgId) >> 22n) + 1420070400000;
      baseChannel.lastMessageAt = timestamp;
    }

    return baseChannel;
  }

  /**
   * Transform discord.js Thread to our format
   */
  private transformThread(thread: ThreadChannel, parentName?: string): DiscordThread {
    return {
      id: thread.id,
      parentId: thread.parentId || "",
      parentName,
      guildId: thread.guildId || "",
      name: thread.name,
      type: mapThreadType(thread.type),
      ownerId: thread.ownerId || "",
      messageCount: thread.messageCount || undefined,
      memberCount: thread.memberCount || undefined,
      archived: thread.archived || false,
      locked: thread.locked || false,
      createdAt: thread.createdTimestamp || Date.now(),
      lastMessageAt: thread.lastMessageId
        ? Number(BigInt(thread.lastMessageId) >> 22n) + 1420070400000
        : undefined,
      raw: thread,
    };
  }

  /**
   * Transform discord.js Message to our format
   */
  private transformMessage(message: DMessage): DiscordMessage {
    return {
      id: message.id,
      channelId: message.channelId,
      guildId: message.guildId || undefined,
      author: {
        id: message.author.id,
        username: message.author.username,
        discriminator: message.author.discriminator || "0",
        displayName: message.author.displayName || undefined,
        avatar: message.author.avatar || undefined,
        bot: message.author.bot || false,
        system: message.author.system || false,
      },
      content: message.content,
      timestamp: message.createdTimestamp,
      editedAt: message.editedTimestamp || undefined,
      type: mapMessageType(message.type),
      embeds: message.embeds.map((embed) => this.transformEmbed(embed)),
      attachments: [...message.attachments.values()].map((att) => this.transformAttachment(att)),
      reactions: [...message.reactions.cache.values()].map((reaction) => this.transformReaction(reaction)),
      mentions: [...message.mentions.users.values()].map((user) => ({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator || "0",
        displayName: user.displayName || undefined,
        avatar: user.avatar || undefined,
        bot: user.bot || false,
        system: user.system || false,
      })),
      mentionRoles: [...message.mentions.roles.keys()],
      mentionEveryone: message.mentions.everyone,
      replyTo: message.reference
        ? {
            messageId: message.reference.messageId || "",
            channelId: message.reference.channelId || message.channelId,
            guildId: message.reference.guildId || undefined,
          }
        : undefined,
      thread: message.thread
        ? {
            id: message.thread.id,
            name: message.thread.name,
          }
        : undefined,
      pinned: message.pinned,
      tts: message.tts,
      raw: message,
    };
  }

  /**
   * Transform discord.js Embed to our format
   */
  private transformEmbed(embed: DMessage["embeds"][number]): DiscordEmbed {
    return {
      type: embed.type || undefined,
      title: embed.title || undefined,
      description: embed.description || undefined,
      url: embed.url || undefined,
      timestamp: embed.timestamp ? new Date(embed.timestamp).getTime() : undefined,
      color: embed.color || undefined,
      footer: embed.footer
        ? {
            text: embed.footer.text,
            iconUrl: embed.footer.iconURL || undefined,
          }
        : undefined,
      image: embed.image
        ? {
            url: embed.image.url,
            width: embed.image.width || undefined,
            height: embed.image.height || undefined,
          }
        : undefined,
      thumbnail: embed.thumbnail
        ? {
            url: embed.thumbnail.url,
            width: embed.thumbnail.width || undefined,
            height: embed.thumbnail.height || undefined,
          }
        : undefined,
      video: embed.video
        ? {
            url: embed.video.url || "",
            width: embed.video.width || undefined,
            height: embed.video.height || undefined,
          }
        : undefined,
      author: embed.author
        ? {
            name: embed.author.name,
            url: embed.author.url || undefined,
            iconUrl: embed.author.iconURL || undefined,
          }
        : undefined,
      fields: (embed.fields || []).map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline,
      })),
    };
  }

  /**
   * Transform discord.js Attachment to our format
   */
  private transformAttachment(attachment: { id: string; name: string | null; size: number; url: string; proxyURL: string; contentType: string | null; width: number | null; height: number | null; ephemeral: boolean; description: string | null }): DiscordAttachment {
    return {
      id: attachment.id,
      filename: attachment.name || "unknown",
      size: attachment.size,
      url: attachment.url,
      proxyUrl: attachment.proxyURL,
      contentType: attachment.contentType || undefined,
      width: attachment.width || undefined,
      height: attachment.height || undefined,
      ephemeral: attachment.ephemeral || false,
      description: attachment.description || undefined,
    };
  }

  /**
   * Transform discord.js Reaction to our format
   */
  private transformReaction(reaction: { emoji: { id: string | null; name: string | null; animated: boolean | null }; count: number; me: boolean }): DiscordReaction {
    return {
      emoji: {
        id: reaction.emoji.id || undefined,
        name: reaction.emoji.name || "?",
        animated: reaction.emoji.animated || false,
      },
      count: reaction.count,
      me: reaction.me,
    };
  }
}

// ===========================================================================
// Helper Functions
// ===========================================================================

// Channel type string constants (discord.js-selfbot-v13 uses strings)
const TEXT_CHANNEL_TYPES = [
  "GUILD_TEXT",
  "DM",
  "GROUP_DM",
  "GUILD_NEWS",
  "GUILD_PUBLIC_THREAD",
  "GUILD_PRIVATE_THREAD",
  "GUILD_NEWS_THREAD",
  "GUILD_FORUM",
];

/**
 * Check if channel is text-based
 */
function isTextBasedChannel(channel: { type: string }): boolean {
  return TEXT_CHANNEL_TYPES.includes(channel.type);
}

/**
 * Get channel name
 */
function getChannelName(channel: Channel): string {
  if ("name" in channel && (channel as TextChannel).name) {
    return (channel as TextChannel).name;
  }
  if (channel.type === "DM" && "recipient" in channel) {
    return (channel as DMChannel).recipient?.username || "DM";
  }
  return `Channel ${channel.id}`;
}

/**
 * Map discord.js channel type string to our type
 */
function mapChannelType(type: string): DiscordChannelType {
  switch (type) {
    case "GUILD_TEXT":
      return "text";
    case "DM":
      return "dm";
    case "GUILD_VOICE":
      return "voice";
    case "GROUP_DM":
      return "group_dm";
    case "GUILD_CATEGORY":
      return "category";
    case "GUILD_NEWS":
      return "announcement";
    case "GUILD_NEWS_THREAD":
      return "announcement_thread";
    case "GUILD_PUBLIC_THREAD":
      return "public_thread";
    case "GUILD_PRIVATE_THREAD":
      return "private_thread";
    case "GUILD_STAGE_VOICE":
      return "stage";
    case "GUILD_FORUM":
      return "forum";
    default:
      return "unknown";
  }
}

/**
 * Map thread type string
 */
function mapThreadType(type: string): DiscordThread["type"] {
  switch (type) {
    case "GUILD_PUBLIC_THREAD":
      return "public_thread";
    case "GUILD_PRIVATE_THREAD":
      return "private_thread";
    case "GUILD_NEWS_THREAD":
      return "announcement_thread";
    default:
      return "public_thread";
  }
}

/**
 * Map discord.js MessageType to our type
 */
function mapMessageType(type: string | null): DiscordMessageType {
  if (!type) return "default";

  const typeStr = String(type).toUpperCase();

  const mapping: Record<string, DiscordMessageType> = {
    "DEFAULT": "default",
    "RECIPIENT_ADD": "recipient_add",
    "RECIPIENT_REMOVE": "recipient_remove",
    "CALL": "call",
    "CHANNEL_NAME_CHANGE": "channel_name_change",
    "CHANNEL_ICON_CHANGE": "channel_icon_change",
    "CHANNEL_PINNED_MESSAGE": "pins_add",
    "GUILD_MEMBER_JOIN": "guild_member_join",
    "USER_PREMIUM_GUILD_SUBSCRIPTION": "boost",
    "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1": "boost_tier_1",
    "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2": "boost_tier_2",
    "USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3": "boost_tier_3",
    "CHANNEL_FOLLOW_ADD": "channel_follow_add",
    "GUILD_DISCOVERY_DISQUALIFIED": "guild_discovery_disqualified",
    "GUILD_DISCOVERY_REQUALIFIED": "guild_discovery_requalified",
    "GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING": "guild_discovery_grace_period_initial_warning",
    "GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING": "guild_discovery_grace_period_final_warning",
    "THREAD_CREATED": "thread_created",
    "REPLY": "reply",
    "CHAT_INPUT_COMMAND": "chat_input_command",
    "THREAD_STARTER_MESSAGE": "thread_starter_message",
    "GUILD_INVITE_REMINDER": "guild_invite_reminder",
    "CONTEXT_MENU_COMMAND": "context_menu_command",
    "AUTO_MODERATION_ACTION": "auto_moderation_action",
    "ROLE_SUBSCRIPTION_PURCHASE": "role_subscription_purchase",
    "INTERACTION_PREMIUM_UPSELL": "interaction_premium_upsell",
    "STAGE_START": "stage_start",
    "STAGE_END": "stage_end",
    "STAGE_SPEAKER": "stage_speaker",
    "STAGE_TOPIC": "stage_topic",
    "GUILD_APPLICATION_PREMIUM_SUBSCRIPTION": "guild_application_premium_subscription",
  };

  return mapping[typeStr] || "unknown";
}

// ===========================================================================
// Singleton Instance
// ===========================================================================

let clientInstance: DiscordClient | null = null;

/**
 * Get or create Discord client instance
 */
export function getDiscordClient(config?: DiscordConfig): DiscordClient {
  if (!clientInstance) {
    clientInstance = new DiscordClient(config);
  }
  return clientInstance;
}

/**
 * Reset the singleton (useful for testing or re-auth)
 */
export function resetDiscordClient(): void {
  if (clientInstance) {
    clientInstance.disconnect().catch(() => {});
    clientInstance = null;
  }
}

/**
 * Check if Discord is available (has session or env token)
 */
export function isDiscordAvailable(sessionName = "default"): boolean {
  return hasSession(sessionName) || !!getDiscordTokenFromEnv();
}

/**
 * Get Discord token from environment variable
 */
export function getDiscordTokenFromEnv(): string | undefined {
  return process.env.DISCORD_TOKEN;
}

/**
 * Get Discord status without connecting
 */
export function getDiscordStatus(sessionName = "default"): DiscordStatus {
  const sessionInfo = getSessionInfo(sessionName);
  const hasEnvToken = !!getDiscordTokenFromEnv();

  return {
    state: "disconnected",
    isAuthenticated: sessionInfo.exists || hasEnvToken,
    hasSession: sessionInfo.exists,
    username: sessionInfo.username,
    userId: sessionInfo.userId,
    discriminator: sessionInfo.discriminator,
  };
}
