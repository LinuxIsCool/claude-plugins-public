/**
 * Discord Integration Types
 *
 * Type definitions for Discord messaging via discord.js-selfbot-v13.
 * Full user account access for DMs, servers, and threads.
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Discord client configuration
 */
export interface DiscordConfig {
  /** Session name for auth state storage (default: "default") */
  sessionName?: string;
  /** Override auth state storage path */
  authStatePath?: string;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectBackoff?: number;
}

/**
 * Environment variable configuration
 */
export interface DiscordEnvConfig {
  /** DISCORD_TOKEN - User token override */
  token?: string;
  /** DISCORD_SESSION - Session name override */
  sessionName?: string;
}

// =============================================================================
// Guilds & Channels
// =============================================================================

/**
 * Discord guild (server)
 */
export interface DiscordGuild {
  /** Snowflake ID */
  id: string;
  /** Server name */
  name: string;
  /** Icon hash */
  icon?: string;
  /** Is user the owner */
  owner: boolean;
  /** Member count */
  memberCount?: number;
  /** Server features */
  features: string[];
  /** Raw discord.js guild object */
  raw?: unknown;
}

/**
 * Discord channel
 */
export interface DiscordChannel {
  /** Snowflake ID */
  id: string;
  /** Guild ID (undefined for DMs) */
  guildId?: string;
  /** Guild name (for convenience) */
  guildName?: string;
  /** Channel name */
  name: string;
  /** Channel type */
  type: DiscordChannelType;
  /** Channel topic/description */
  topic?: string;
  /** Position in channel list */
  position?: number;
  /** Parent category ID */
  parentId?: string;
  /** NSFW flag */
  nsfw?: boolean;
  /** Last message timestamp (unix ms) */
  lastMessageAt?: number;
  /** Raw discord.js channel object */
  raw?: unknown;
}

/**
 * Channel types
 */
export type DiscordChannelType =
  | "text"
  | "dm"
  | "voice"
  | "group_dm"
  | "category"
  | "announcement"
  | "announcement_thread"
  | "public_thread"
  | "private_thread"
  | "stage"
  | "forum"
  | "unknown";

/**
 * Discord thread
 */
export interface DiscordThread {
  /** Snowflake ID */
  id: string;
  /** Parent channel ID */
  parentId: string;
  /** Parent channel name */
  parentName?: string;
  /** Guild ID */
  guildId: string;
  /** Thread name */
  name: string;
  /** Thread type */
  type: "public_thread" | "private_thread" | "announcement_thread";
  /** Thread owner user ID */
  ownerId: string;
  /** Message count */
  messageCount?: number;
  /** Member count */
  memberCount?: number;
  /** Is archived */
  archived: boolean;
  /** Is locked */
  locked: boolean;
  /** Created timestamp (unix ms) */
  createdAt: number;
  /** Last message timestamp (unix ms) */
  lastMessageAt?: number;
  /** Raw discord.js thread object */
  raw?: unknown;
}

// =============================================================================
// Messages
// =============================================================================

/**
 * Discord message
 */
export interface DiscordMessage {
  /** Message ID */
  id: string;
  /** Channel ID where message was sent */
  channelId: string;
  /** Guild ID (undefined for DMs) */
  guildId?: string;
  /** Author info */
  author: DiscordUser;
  /** Message content */
  content: string;
  /** Timestamp (unix ms) */
  timestamp: number;
  /** Edit timestamp (unix ms) */
  editedAt?: number;
  /** Message type */
  type: DiscordMessageType;
  /** Embeds */
  embeds: DiscordEmbed[];
  /** Attachments */
  attachments: DiscordAttachment[];
  /** Reactions */
  reactions: DiscordReaction[];
  /** Mentioned users */
  mentions: DiscordUser[];
  /** Mentioned role IDs */
  mentionRoles: string[];
  /** Mentions @everyone */
  mentionEveryone: boolean;
  /** Reply reference (if replying to another message) */
  replyTo?: {
    messageId: string;
    channelId: string;
    guildId?: string;
  };
  /** Thread started by this message */
  thread?: {
    id: string;
    name: string;
  };
  /** Is pinned */
  pinned: boolean;
  /** Is TTS */
  tts: boolean;
  /** Raw discord.js message object */
  raw?: unknown;
}

/**
 * Discord user
 */
export interface DiscordUser {
  /** User ID */
  id: string;
  /** Username */
  username: string;
  /** Discriminator (legacy, may be "0" for new usernames) */
  discriminator: string;
  /** Display name / nickname */
  displayName?: string;
  /** Avatar hash */
  avatar?: string;
  /** Is bot */
  bot: boolean;
  /** Is system user */
  system: boolean;
}

/**
 * Message types
 */
export type DiscordMessageType =
  | "default"
  | "recipient_add"
  | "recipient_remove"
  | "call"
  | "channel_name_change"
  | "channel_icon_change"
  | "pins_add"
  | "guild_member_join"
  | "boost"
  | "boost_tier_1"
  | "boost_tier_2"
  | "boost_tier_3"
  | "channel_follow_add"
  | "guild_discovery_disqualified"
  | "guild_discovery_requalified"
  | "guild_discovery_grace_period_initial_warning"
  | "guild_discovery_grace_period_final_warning"
  | "thread_created"
  | "reply"
  | "chat_input_command"
  | "thread_starter_message"
  | "guild_invite_reminder"
  | "context_menu_command"
  | "auto_moderation_action"
  | "role_subscription_purchase"
  | "interaction_premium_upsell"
  | "stage_start"
  | "stage_end"
  | "stage_speaker"
  | "stage_topic"
  | "guild_application_premium_subscription"
  | "unknown";

/**
 * Discord embed
 */
export interface DiscordEmbed {
  /** Embed type */
  type?: string;
  /** Title */
  title?: string;
  /** Description */
  description?: string;
  /** URL */
  url?: string;
  /** Timestamp (unix ms) */
  timestamp?: number;
  /** Color (decimal) */
  color?: number;
  /** Footer */
  footer?: {
    text: string;
    iconUrl?: string;
  };
  /** Image */
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
  /** Thumbnail */
  thumbnail?: {
    url: string;
    width?: number;
    height?: number;
  };
  /** Video */
  video?: {
    url: string;
    width?: number;
    height?: number;
  };
  /** Author */
  author?: {
    name: string;
    url?: string;
    iconUrl?: string;
  };
  /** Fields */
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

/**
 * Discord attachment
 */
export interface DiscordAttachment {
  /** Attachment ID */
  id: string;
  /** Filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** CDN URL */
  url: string;
  /** Proxy URL */
  proxyUrl: string;
  /** Content type */
  contentType?: string;
  /** Width (for images/videos) */
  width?: number;
  /** Height (for images/videos) */
  height?: number;
  /** Is ephemeral */
  ephemeral?: boolean;
  /** Description/alt text */
  description?: string;
}

/**
 * Discord reaction
 */
export interface DiscordReaction {
  /** Emoji info */
  emoji: {
    /** Custom emoji ID (undefined for unicode) */
    id?: string;
    /** Emoji name (unicode char or custom name) */
    name: string;
    /** Is animated */
    animated?: boolean;
  };
  /** Reaction count */
  count: number;
  /** Did current user react */
  me: boolean;
}

// =============================================================================
// Sync Options & Stats
// =============================================================================

/**
 * Discord sync/import options
 */
export interface DiscordSyncOptions {
  /** Filter to specific guild IDs */
  guilds?: string[];
  /** Filter to specific channel IDs */
  channels?: string[];
  /** Filter by channel type */
  channelTypes?: DiscordChannelType[];
  /** Include threads */
  includeThreads?: boolean;
  /** Include archived threads */
  includeArchivedThreads?: boolean;
  /** Only sync messages after this date */
  since?: Date;
  /** Only sync messages before this date */
  until?: Date;
  /** Max messages per channel for historical sync */
  maxPerChannel?: number;
  /** Include reactions data */
  includeReactions?: boolean;
  /** Enable real-time sync after historical */
  realtime?: boolean;
  /** Timeout for real-time sync in ms */
  realtimeTimeout?: number;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Import/sync statistics
 */
export interface DiscordImportStats {
  messages: number;
  guilds: number;
  channels: number;
  threads: number;
  accounts: number;
  reactions: number;
  skipped: number;
  errors: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

// =============================================================================
// Connection State
// =============================================================================

/**
 * Connection state
 */
export type DiscordConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

/**
 * Connection status
 */
export interface DiscordStatus {
  /** Current connection state */
  state: DiscordConnectionState;
  /** Whether authenticated (has valid session) */
  isAuthenticated: boolean;
  /** Whether session file exists */
  hasSession: boolean;
  /** Connected username */
  username?: string;
  /** Connected user ID */
  userId?: string;
  /** Discriminator */
  discriminator?: string;
  /** Number of guilds */
  guildCount?: number;
  /** Last error message */
  lastError?: string;
}

/**
 * Sync service stats
 */
export interface DiscordSyncStats {
  /** Current mode */
  mode: "idle" | "syncing" | "realtime" | "stopped";
  /** Messages processed in this session */
  messagesProcessed: number;
  /** Channels processed */
  channelsProcessed: number;
  /** Threads processed */
  threadsProcessed: number;
  /** Guilds processed */
  guildsProcessed: number;
  /** Errors encountered */
  errors: number;
  /** Reconnection attempts */
  reconnectAttempts: number;
  /** Last successful sync time */
  lastSync?: Date;
  /** Service start time */
  startedAt?: Date;
}

// =============================================================================
// Events
// =============================================================================

/**
 * Event types emitted by Discord client/service
 */
export type DiscordEventType =
  | "authenticated"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "message"
  | "message_update"
  | "message_delete"
  | "reaction_add"
  | "reaction_remove"
  | "thread_create"
  | "thread_update"
  | "channel_update"
  | "sync"
  | "error";

/**
 * Message event data
 */
export interface MessageEvent {
  /** The message */
  message: DiscordMessage;
  /** Whether this is a new message (vs historical) */
  isNew: boolean;
}

/**
 * Reaction event data
 */
export interface ReactionEvent {
  /** Channel ID */
  channelId: string;
  /** Message ID */
  messageId: string;
  /** User ID who reacted */
  userId: string;
  /** Emoji */
  emoji: DiscordReaction["emoji"];
  /** Is add or remove */
  type: "add" | "remove";
}

/**
 * Sync complete event data
 */
export interface SyncEvent {
  /** Number of messages synced */
  count: number;
  /** Sync mode */
  mode: "historical" | "realtime";
  /** Duration in ms */
  duration: number;
}
