/**
 * WhatsApp Integration Types
 *
 * Type definitions for WhatsApp messaging via Baileys.
 * Compatible with @whiskeysockets/baileys v6.7.x
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * WhatsApp client configuration
 */
export interface WhatsAppConfig {
  /** Session name for auth state storage (default: "default") */
  sessionName?: string;
  /** Override auth state storage path */
  authStatePath?: string;
  /** QR code timeout in milliseconds (default: 60000) */
  qrTimeout?: number;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectBackoff?: number;
  /** Print QR code to terminal (default: true) */
  printQRInTerminal?: boolean;
}

/**
 * Environment variable configuration
 */
export interface WhatsAppEnvConfig {
  /** WHATSAPP_SESSION - Session name override */
  sessionName?: string;
  /** WHATSAPP_AUTH_PATH - Auth state storage path override */
  authPath?: string;
}

// =============================================================================
// Chats & Contacts
// =============================================================================

/**
 * WhatsApp chat/conversation
 */
export interface WhatsAppChat {
  /** JID (e.g., "1234567890@s.whatsapp.net" or "123456789-1234567890@g.us") */
  id: string;
  /** Display name (contact name or group name) */
  name: string;
  /** Chat type */
  type: "dm" | "group" | "broadcast";
  /** Last message timestamp (unix ms) */
  lastMessageAt?: number;
  /** Unread message count */
  unreadCount?: number;
  /** Whether chat is archived */
  isArchived?: boolean;
  /** Whether chat is muted */
  isMuted?: boolean;
  /** Group participants (for groups only) */
  participants?: string[];
  /** Raw Baileys chat object */
  raw?: unknown;
}

/**
 * WhatsApp contact
 */
export interface WhatsAppContact {
  /** JID */
  id: string;
  /** Contact name from address book */
  name?: string;
  /** Push name set by the contact */
  pushName?: string;
  /** Phone number (without @s.whatsapp.net) */
  phone?: string;
  /** Whether contact is blocked */
  isBlocked?: boolean;
}

// =============================================================================
// Messages
// =============================================================================

/**
 * WhatsApp message
 */
export interface WhatsAppMessage {
  /** Message key ID */
  id: string;
  /** Chat JID where message was sent */
  chatId: string;
  /** Timestamp (unix ms) */
  timestamp: number;
  /** Whether message was sent by us */
  fromMe: boolean;
  /** Sender JID */
  senderJid: string;
  /** Sender display name */
  senderName?: string;
  /** Message text content */
  text?: string;
  /** Media caption (for media messages) */
  caption?: string;
  /** Message type */
  messageType: WhatsAppMessageType;
  /** Media info (if applicable) */
  media?: WhatsAppMedia;
  /** Quoted message ID (for replies) */
  quotedMessageId?: string;
  /** Mentioned JIDs */
  mentions?: string[];
  /** Whether message was forwarded */
  isForwarded?: boolean;
  /** Edit timestamp (if message was edited) */
  editedAt?: number;
  /** Raw Baileys message object */
  raw?: unknown;
}

/**
 * Message types
 */
export type WhatsAppMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "poll"
  | "reaction"
  | "unknown";

/**
 * Media attachment info
 */
export interface WhatsAppMedia {
  /** Media type */
  type: "image" | "video" | "audio" | "document" | "sticker";
  /** MIME type */
  mimeType?: string;
  /** Original filename */
  filename?: string;
  /** File size in bytes */
  size?: number;
  /** Duration in seconds (for audio/video) */
  duration?: number;
  /** Whether media has been downloaded */
  downloaded?: boolean;
  /** Local file path (if downloaded) */
  localPath?: string;
}

// =============================================================================
// Sync Options & Stats
// =============================================================================

/**
 * WhatsApp sync/import options
 */
export interface WhatsAppSyncOptions {
  /** Filter to specific chat JIDs */
  chats?: string[];
  /** Filter by chat type */
  chatTypes?: ("dm" | "group" | "broadcast")[];
  /** Only sync messages after this date */
  since?: Date;
  /** Only sync messages before this date */
  until?: Date;
  /** Max messages per chat for historical sync */
  maxPerChat?: number;
  /** Download media attachments */
  includeMedia?: boolean;
  /** Skip archived chats */
  skipArchived?: boolean;
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
export interface WhatsAppImportStats {
  messages: number;
  chats: number;
  accounts: number;
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
export type WhatsAppConnectionState =
  | "disconnected"
  | "connecting"
  | "qr"
  | "connected"
  | "reconnecting";

/**
 * Connection status
 */
export interface WhatsAppStatus {
  /** Current connection state */
  state: WhatsAppConnectionState;
  /** Whether authenticated (has valid session) */
  isAuthenticated: boolean;
  /** Whether session file exists */
  hasSession: boolean;
  /** Connected phone number (if authenticated) */
  phoneNumber?: string;
  /** Last error message */
  lastError?: string;
  /** QR code data (when state is "qr") */
  qrCode?: string;
}

/**
 * Sync service stats
 */
export interface WhatsAppSyncStats {
  /** Current mode */
  mode: "idle" | "syncing" | "realtime" | "stopped";
  /** Messages processed in this session */
  messagesProcessed: number;
  /** Chats processed */
  chatsProcessed: number;
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
 * Event types emitted by WhatsApp client/service
 */
export type WhatsAppEventType =
  | "qr"
  | "authenticated"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "message"
  | "chat-update"
  | "sync"
  | "error";

/**
 * QR code event data
 */
export interface QRCodeEvent {
  /** QR code string data */
  qr: string;
  /** Generation timestamp */
  timestamp: Date;
  /** Expiry timestamp */
  expiresAt: Date;
}

/**
 * Message event data
 */
export interface MessageEvent {
  /** The message */
  message: WhatsAppMessage;
  /** Whether this is a new message (vs historical) */
  isNew: boolean;
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
