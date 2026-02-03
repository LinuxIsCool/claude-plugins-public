/**
 * KDE Connect SMS Integration Types
 *
 * Type definitions for KDE Connect SMS access via D-Bus.
 * Compatible with KDE Connect's org.kde.kdeconnect.device.conversations interface.
 */

// =============================================================================
// Device Types
// =============================================================================

/**
 * KDE Connect device
 */
export interface KdeConnectDevice {
  /** Device ID (UUID-like string) */
  id: string;
  /** Device name (e.g., "Samsung Galaxy S21") */
  name: string;
  /** Device type */
  type: "phone" | "tablet" | "desktop" | "laptop" | "tv";
  /** Whether device is currently reachable on network */
  isReachable: boolean;
  /** Whether device is paired/trusted */
  isTrusted: boolean;
  /** Whether SMS plugin is available */
  hasSmsPlugin?: boolean;
}

// =============================================================================
// Conversation Types
// =============================================================================

/**
 * SMS conversation (thread)
 */
export interface KdeConnectConversation {
  /** Thread ID from Android */
  threadId: number;
  /** Phone numbers in this conversation (usually 1 for DM, multiple for group) */
  addresses: string[];
  /** Display name for the conversation (contact name or formatted phone) */
  displayName: string;
  /** Whether this is a group conversation (multiple addresses) */
  isMultiTarget: boolean;
  /** Preview of last message */
  lastMessage?: string;
  /** Timestamp of last message (unix ms) */
  lastMessageDate?: number;
  /** Direction of last message: 1=incoming, 2=outgoing */
  lastMessageType?: 1 | 2;
  /** Whether the last message has been read */
  isRead?: boolean;
  /** Estimated message count (may not be exact) */
  messageCount?: number;
}

// =============================================================================
// Message Types
// =============================================================================

/**
 * SMS message
 */
export interface KdeConnectMessage {
  /** Unique message ID from Android */
  id: number;
  /** Thread/conversation ID */
  threadId: number;
  /** Phone number (sender for incoming, recipient for outgoing) */
  address: string;
  /** Message body text */
  body: string;
  /** Timestamp (unix ms) */
  date: number;
  /** Message type: 1 = received (inbox), 2 = sent */
  type: KdeConnectMessageType;
  /** Read status: 0 = unread, 1 = read */
  read: 0 | 1;
  /** Contact name (if available from contacts) */
  contactName?: string;
  /** MMS attachments (if any) */
  attachments?: KdeConnectAttachment[];
}

/**
 * Message direction type (Android SMS database convention)
 */
export type KdeConnectMessageType =
  | 1  // MESSAGE_TYPE_INBOX (received)
  | 2; // MESSAGE_TYPE_SENT

/**
 * MMS attachment info
 */
export interface KdeConnectAttachment {
  /** Part ID */
  partId: number;
  /** MIME type */
  mimeType: string;
  /** Original filename */
  fileName?: string;
  /** File size in bytes */
  size?: number;
}

// =============================================================================
// Status & Configuration
// =============================================================================

/**
 * KDE Connect SMS status
 */
export interface KdeConnectStatus {
  /** Whether KDE Connect daemon is running */
  daemonRunning: boolean;
  /** Whether any device is available */
  hasDevices: boolean;
  /** List of available devices */
  devices: KdeConnectDevice[];
  /** Currently selected/default device */
  selectedDevice?: KdeConnectDevice;
  /** Number of conversations (if device connected) */
  conversationCount?: number;
  /** Last error message */
  error?: string;
}

// =============================================================================
// Import Options & Stats
// =============================================================================

/**
 * SMS import options
 */
export interface KdeConnectImportOptions {
  /** Specific device ID (auto-detect if not provided) */
  deviceId?: string;
  /** Filter to specific thread IDs */
  threadIds?: number[];
  /** Only import messages after this date */
  since?: Date;
  /** Only import messages before this date */
  until?: Date;
  /** Maximum messages to import (no limit if not specified) */
  limit?: number;
  /** Skip already imported messages (based on platform_id) */
  skipExisting?: boolean;
  /** Enable real-time listening after initial import */
  realtime?: boolean;
  /** Polling interval for real-time mode (ms, default 30000) */
  pollInterval?: number;
}

/**
 * Import statistics
 */
export interface KdeConnectImportStats {
  /** Total messages imported */
  messages: number;
  /** Conversations processed */
  conversations: number;
  /** Accounts created (phone numbers) */
  accounts: number;
  /** Messages skipped (already imported or filtered) */
  skipped: number;
  /** Errors encountered */
  errors: number;
  /** Date range of imported messages */
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

// =============================================================================
// Sync Service Types
// =============================================================================

/**
 * Sync service mode
 * - monitoring: Real-time D-Bus signal monitoring active
 * - importing: Historic message import in progress
 * - polling: Fallback polling mode (when D-Bus signals unavailable)
 * - stopped: Service not running
 */
export type KdeConnectSyncMode = "monitoring" | "importing" | "polling" | "stopped";

/**
 * Sync service statistics
 */
export interface KdeConnectSyncStats {
  /** Current mode */
  mode: KdeConnectSyncMode;
  /** Messages processed in this session */
  messagesProcessed: number;
  /** Conversations processed */
  conversationsProcessed: number;
  /** Errors encountered */
  errors: number;
  /** Service start time */
  startedAt?: Date;
  /** Last successful sync time */
  lastSync?: Date;
  /** Number of reconnection attempts (resets on successful reconnect) */
  reconnectAttempts: number;
  /** Currently connected device */
  device?: KdeConnectDevice;
}

// =============================================================================
// D-Bus Response Types (internal)
// =============================================================================

/**
 * Raw D-Bus conversation response
 * Format from org.kde.kdeconnect.device.conversations
 */
export interface DbusConversationResponse {
  /** Thread ID */
  threadId: string;
  /** Addresses array */
  addresses: Array<{ address: string }>;
  /** Whether multi-target (group) */
  isMultitarget: boolean;
}

/**
 * Raw D-Bus message response
 */
export interface DbusMessageResponse {
  /** Unique ID */
  _id: string;
  /** Thread ID */
  thread_id: string;
  /** Phone address */
  address: string;
  /** Message body */
  body: string;
  /** Timestamp in seconds */
  date: string;
  /** Message type (1=inbox, 2=sent) */
  type: string;
  /** Read status */
  read: string;
}
