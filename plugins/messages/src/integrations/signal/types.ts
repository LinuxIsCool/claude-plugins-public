/**
 * Signal Integration Types
 *
 * Type definitions for Signal messaging via signal-sdk.
 * Compatible with signal-cli v0.13.22.
 */

// =============================================================================
// Configuration
// =============================================================================

/**
 * Signal client configuration
 */
export interface SignalConfig {
  /** Phone number in E.164 format (+1234567890) */
  phoneNumber: string;
  /** Path to signal-cli config directory (optional) */
  configPath?: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
}

/**
 * Environment variable configuration
 */
export interface SignalEnvConfig {
  /** SIGNAL_PHONE - Phone number in E.164 format */
  phone?: string;
  /** SIGNAL_CONFIG_PATH - Path to signal-cli config directory */
  configPath?: string;
}

// =============================================================================
// Contacts & Groups
// =============================================================================

/**
 * Signal contact information
 */
export interface SignalContact {
  /** Phone number in E.164 format */
  number: string;
  /** Contact name (from profile or address book) */
  name?: string;
  /** Profile name set by the contact */
  profileName?: string;
  /** Whether contact is blocked */
  blocked?: boolean;
  /** Contact's UUID (stable identifier) */
  uuid?: string;
}

/**
 * Signal group information
 */
export interface SignalGroup {
  /** Group ID (base64 encoded) */
  groupId: string;
  /** Group name/title */
  name: string;
  /** Group description */
  description?: string;
  /** Member phone numbers */
  members: string[];
  /** Admin phone numbers */
  admins?: string[];
  /** Whether the group is a v2 group */
  isV2?: boolean;
  /** Group invite link (if available) */
  inviteLink?: string;
}

/**
 * Represents a Signal conversation (contact or group)
 */
export interface SignalConversation {
  /** Unique identifier (phone number or group ID) */
  id: string;
  /** Display name */
  name: string;
  /** Conversation type */
  type: "dm" | "group";
  /** Last message timestamp */
  lastMessageAt?: Date;
  /** Unread message count (if available) */
  unreadCount?: number;
  /** Raw contact or group data */
  raw?: SignalContact | SignalGroup;
}

// =============================================================================
// Messages
// =============================================================================

/**
 * Signal message envelope (from signal-cli events)
 */
export interface SignalEnvelope {
  /** Sender's phone number */
  source?: string;
  /** Sender's UUID */
  sourceUuid?: string;
  /** Sender's device ID */
  sourceDevice?: number;
  /** Message timestamp (unix millis) */
  timestamp?: number;
  /** Server receive timestamp */
  serverReceivedTimestamp?: number;
  /** Data message content */
  dataMessage?: SignalDataMessage;
  /** Sync message (sent from another device) */
  syncMessage?: SignalSyncMessage;
  /** Receipt message */
  receiptMessage?: SignalReceiptMessage;
  /** Typing indicator */
  typingMessage?: SignalTypingMessage;
}

/**
 * Signal data message content
 */
export interface SignalDataMessage {
  /** Message text */
  message?: string;
  /** Timestamp (unix millis) */
  timestamp?: number;
  /** Expiration timer in seconds */
  expiresInSeconds?: number;
  /** Group info (if group message) */
  groupInfo?: {
    groupId: string;
    type?: string;
  };
  /** Attachments */
  attachments?: SignalAttachment[];
  /** Quote (reply) */
  quote?: SignalQuote;
  /** Reaction */
  reaction?: SignalReaction;
  /** Sticker */
  sticker?: SignalSticker;
  /** Mentions */
  mentions?: SignalMention[];
}

/**
 * Sync message from another device
 */
export interface SignalSyncMessage {
  sentMessage?: {
    destination?: string;
    destinationUuid?: string;
    timestamp?: number;
    message?: string;
    expiresInSeconds?: number;
    groupInfo?: {
      groupId: string;
      type?: string;
    };
    attachments?: SignalAttachment[];
  };
  readMessages?: Array<{
    sender?: string;
    senderUuid?: string;
    timestamp?: number;
  }>;
}

/**
 * Receipt message
 */
export interface SignalReceiptMessage {
  type?: "DELIVERY" | "READ";
  timestamps?: number[];
}

/**
 * Typing indicator
 */
export interface SignalTypingMessage {
  action?: "STARTED" | "STOPPED";
  timestamp?: number;
  groupId?: string;
}

/**
 * Message attachment
 */
export interface SignalAttachment {
  contentType?: string;
  filename?: string;
  size?: number;
  id?: string;
  /** Local file path (after download) */
  storedFilePath?: string;
}

/**
 * Quote/reply reference
 */
export interface SignalQuote {
  id?: number;
  author?: string;
  authorUuid?: string;
  text?: string;
}

/**
 * Message reaction
 */
export interface SignalReaction {
  emoji?: string;
  targetAuthor?: string;
  targetAuthorUuid?: string;
  targetTimestamp?: number;
  isRemove?: boolean;
}

/**
 * Sticker
 */
export interface SignalSticker {
  packId?: string;
  stickerId?: number;
}

/**
 * User mention
 */
export interface SignalMention {
  uuid?: string;
  start?: number;
  length?: number;
}

// =============================================================================
// Adapter Types
// =============================================================================

/**
 * Normalized Signal message for adapter processing
 */
export interface SignalMessage {
  /** Message identifier (timestamp-based) */
  id: string;
  /** Message timestamp */
  date: Date;
  /** Message text content */
  text: string;
  /** Sender's phone number */
  sender: string;
  /** Sender's display name (if available) */
  senderName?: string;
  /** Conversation ID (phone or group ID) */
  conversationId: string;
  /** Whether message is outgoing (sent by us) */
  isOutgoing: boolean;
  /** Reply to message ID (timestamp) */
  replyToId?: string;
  /** Attachments */
  attachments?: SignalAttachment[];
  /** Reaction (if this is a reaction message) */
  reaction?: SignalReaction;
  /** Whether message is from a group */
  isGroup: boolean;
  /** Group ID if group message */
  groupId?: string;
}

// =============================================================================
// Import/Sync Options
// =============================================================================

/**
 * Options for Signal message import
 */
export interface SignalImportOptions {
  /** Filter by specific contacts (phone numbers) */
  contacts?: string[];
  /** Filter by specific groups (group IDs) */
  groups?: string[];
  /** Only import messages after this date */
  since?: Date;
  /** Only import messages before this date */
  until?: Date;
  /** Maximum messages to import per conversation */
  limitPerConversation?: number;
  /** Include attachment metadata (not content) */
  includeAttachments?: boolean;
  /** Enable real-time message listening */
  realtime?: boolean;
  /** Timeout for real-time listening (ms) */
  realtimeTimeout?: number;
}

/**
 * Import statistics
 */
export interface SignalImportStats {
  messages: number;
  accounts: number;
  threads: number;
  skipped: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Signal client event types
 */
export type SignalEventType =
  | "message"
  | "receipt"
  | "typing"
  | "reaction"
  | "sync"
  | "error"
  | "connected"
  | "disconnected";

/**
 * Event handler callback
 */
export type SignalEventHandler<T = unknown> = (data: T) => void;
