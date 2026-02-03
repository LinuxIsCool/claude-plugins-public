/**
 * Messages Plugin - Core Type Definitions
 *
 * Content-addressed messages with DID-based identity across all platforms.
 */

// =============================================================================
// Identity Types
// =============================================================================

/**
 * Content Identifier - SHA-256 hash of message content
 * Format: "msg_" + base58(sha256(canonicalized_content))
 */
export type CID = string;

/**
 * Decentralized Identifier
 * Format: "did:key:z..." (Ed25519 multibase-encoded public key)
 */
export type DID = string;

// =============================================================================
// Message Kinds
// =============================================================================

/**
 * Message kind numbers (Nostr-inspired extensible type system)
 *
 * Ranges:
 * - 0-99: Core message types
 * - 100-199: Claude Code events
 * - 200-249: Git events
 * - 1000+: Platform-specific
 */
export const Kind = {
  // Core (0-99)
  AccountMetadata: 0,
  TextMessage: 1,
  LongForm: 2,
  Media: 3,
  Link: 4,
  Reaction: 5,
  Deletion: 6,
  Edit: 7,

  // Claude Code (100-199)
  SessionStart: 100,
  SessionEnd: 101,
  UserPrompt: 102,
  AssistantResponse: 103,
  ToolUse: 104,
  SubagentSpawn: 105,
  SubagentStop: 106,
  PermissionRequest: 107,

  // Git (200-249)
  Commit: 200,
  Branch: 201,
  Tag: 202,
  Merge: 203,

  // Platform-specific (1000+)
  Telegram: 1000,
  WhatsApp: 1001,
  Signal: 1002,
  SMS: 1003,  // KDE Connect SMS
  Email: 1010,
  Discord: 1020,
  Slack: 1021,
  ForumPost: 1030,
  ForumComment: 1031,
  ClaudeWeb: 1040,
} as const;

export type KindValue = (typeof Kind)[keyof typeof Kind];

/**
 * Get kind name from value
 */
export function kindName(kind: number): string {
  for (const [name, value] of Object.entries(Kind)) {
    if (value === kind) return name;
  }
  return `Unknown(${kind})`;
}

// =============================================================================
// Message
// =============================================================================

/**
 * Author information attached to a message
 */
export interface Author {
  did?: DID; // Portable decentralized identifier
  name?: string; // Display name
  handle?: string; // Platform handle (@username, email, etc.)
}

/**
 * References to related entities
 */
export interface MessageRefs {
  thread_id?: string; // Conversation thread
  reply_to?: CID; // Parent message CID
  room_id?: string; // Channel/group context
  mentions?: string[]; // Account IDs mentioned
}

/**
 * Source information for imported messages
 */
export interface MessageSource {
  platform: string; // Origin (telegram, claude-code, email, etc.)
  platform_id?: string; // ID in source system
  url?: string; // Source URL if applicable
  session_id?: string; // Claude session if applicable
  agent_id?: string; // Agent hex ID if applicable
}

/**
 * Core Message structure
 *
 * Every message has a content-addressed ID (CID) derived from:
 * - content
 * - kind
 * - created_at
 * - account_id
 */
export interface Message {
  // === Identity ===
  id: CID; // Content-addressed hash

  // === Authorship ===
  account_id: string; // Local account reference
  author: Author;

  // === Temporal ===
  created_at: number; // Unix timestamp (original)
  imported_at: number; // When we received it

  // === Classification ===
  kind: KindValue | number; // Message type
  visibility?: "public" | "private" | "direct";

  // === Content ===
  content: string; // Body text (may be markdown)
  title?: string; // Optional title

  // === Structure ===
  refs: MessageRefs;

  // === Source ===
  source: MessageSource;

  // === Metadata ===
  tags?: [string, string][]; // Key-value pairs
}

/**
 * Input for creating a new message (id and imported_at are generated)
 */
export type MessageInput = Omit<Message, "id" | "imported_at">;

// =============================================================================
// Account
// =============================================================================

/**
 * Platform identity linked to an account
 */
export interface PlatformIdentity {
  platform: string; // telegram, whatsapp, claude-code, etc.
  handle: string; // @username, phone, email, etc.
  verified?: boolean; // Platform verification status
}

/**
 * Claude agent metadata (for agent accounts)
 */
export interface AgentMetadata {
  source: "project" | "plugin"; // Where agent is defined
  source_path?: string; // Path to agent definition
  model?: string; // opus, sonnet, haiku
}

/**
 * Account statistics
 */
export interface AccountStats {
  message_count: number;
  thread_count?: number;
  last_active?: number;
}

/**
 * Account - Identity across platforms
 *
 * Accounts decouple identity from platforms, allowing a single
 * person/agent to be recognized across Telegram, email, Claude Code, etc.
 */
export interface Account {
  id: string; // Local unique ID
  did?: DID; // Portable decentralized identifier

  // Display
  name: string; // Primary display name
  avatar?: string; // Emoji or image path

  // Platform links
  identities: PlatformIdentity[];

  // Claude-specific
  agent?: AgentMetadata;

  // Identity flags
  is_self?: boolean; // True if this account represents the user

  // Metadata
  created_at: number;
  updated_at?: number;
  stats?: AccountStats;
}

/**
 * Input for creating a new account
 */
export type AccountInput = Omit<Account, "created_at" | "updated_at" | "stats">;

// =============================================================================
// Thread
// =============================================================================

/**
 * Thread source information
 */
export interface ThreadSource {
  platform: string;
  platform_id?: string;
  room_id?: string;
}

/**
 * Thread - Conversation container
 *
 * Groups messages into conversations. Can represent DMs, group chats,
 * channels, or topic threads.
 */
export interface Thread {
  id: string;
  title?: string;

  // Participants
  participants: string[]; // Account IDs
  type: "dm" | "group" | "channel" | "topic";

  // Source
  source: ThreadSource;

  // Metadata
  created_at: number;
  last_message_at?: number;
  message_count: number;

  // State
  pinned_messages?: CID[];
  muted?: boolean;
}

/**
 * Input for creating a new thread
 */
export type ThreadInput = Omit<Thread, "created_at" | "last_message_at" | "message_count">;

// =============================================================================
// Events (for event sourcing)
// =============================================================================

/**
 * Event types for the append-only log
 */
export type EventType =
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "account.created"
  | "account.updated"
  | "thread.created"
  | "thread.updated";

/**
 * Base event structure
 */
export interface Event<T extends EventType = EventType, D = unknown> {
  ts: string; // ISO 8601 timestamp
  op: T; // Event type
  data: D; // Event payload
}

/**
 * Message created event
 */
export interface MessageCreatedEvent extends Event<"message.created", Message> {
  op: "message.created";
}

/**
 * Account created event
 */
export interface AccountCreatedEvent extends Event<"account.created", Account> {
  op: "account.created";
}

/**
 * Thread created event
 */
export interface ThreadCreatedEvent extends Event<"thread.created", Thread> {
  op: "thread.created";
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Filter options for listing messages
 */
export interface MessageFilter {
  kinds?: number[];
  accounts?: string[];
  threads?: string[];
  platforms?: string[];
  since?: number; // Unix timestamp
  until?: number; // Unix timestamp
  tags?: [string, string][];
  limit?: number;
  offset?: number;
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  message: Message;
  score: number;
  highlights?: string[];
}

/**
 * Contact priority with outbound weighting
 *
 * Prioritizes contacts based on how often YOU message THEM (outbound),
 * with secondary factors for long-term volume and recency.
 */
export interface ContactPriority {
  // Identity (normalized for cross-platform)
  normalized_name: string;
  display_name: string;
  account_ids: string[];
  platforms: string[];

  // Outbound metrics (you → them)
  outbound_messages: number;
  outbound_threads: number;

  // Inbound metrics (them → you)
  inbound_messages: number;

  // Totals
  total_messages: number;
  total_threads: number;

  // Temporal
  first_contact: number;
  last_contact: number;
  days_since_last: number;

  // Computed score
  priority_score: number;
}

/**
 * Timeline options
 */
export interface TimelineOptions {
  since?: number;
  until?: number;
  platforms?: string[];
  limit?: number;
}
