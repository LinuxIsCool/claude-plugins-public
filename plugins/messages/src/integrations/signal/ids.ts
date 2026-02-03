/**
 * Signal ID Generation and Conversion Utilities
 *
 * Centralized module for all Signal identifier generation.
 * Ensures consistency between backup imports and live sync.
 *
 * Thread ID Format:
 * - Groups: signal_group_{base64_safe_group_id}
 * - DMs: signal_dm_{normalized_phone}
 *
 * The canonical format uses base64-safe encoding (replacing /+= with _)
 * to match the Signal daemon's native format.
 */

import { Buffer } from "buffer";

// ============================================================================
// Thread ID Generation
// ============================================================================

/**
 * Create a canonical Signal thread ID
 *
 * @param conversationId - For groups: base64 group ID. For DMs: phone number.
 * @param isGroup - Whether this is a group conversation
 * @returns Canonical thread ID (e.g., signal_group_abc123 or signal_dm_12505551234)
 */
export function createSignalThreadId(
  conversationId: string,
  isGroup: boolean
): string {
  if (isGroup) {
    // conversationId should be base64 (from daemon or converted from backup hex)
    return `signal_group_${makeBase64Safe(conversationId)}`;
  }
  // Phone number - normalize (remove + and special chars)
  return `signal_dm_${conversationId.replace(/[+\s-]/g, "")}`;
}

// ============================================================================
// Group ID Format Conversion
// ============================================================================

/**
 * Convert Signal backup hex group_id to base64
 *
 * Signal backup database stores group_id as hex string with prefix:
 *   __signal_group__v2__!07ac4655b...
 *
 * Signal daemon provides the same bytes as base64.
 *
 * @param hexGroupId - Hex-encoded group ID (with or without prefix)
 * @returns Base64-encoded group ID
 */
export function hexToBase64(hexGroupId: string): string {
  // Remove Signal's hex prefix if present
  let hex = hexGroupId;
  if (hex.startsWith("__signal_group__v2__!")) {
    hex = hex.slice("__signal_group__v2__!".length);
  }

  // Remove any whitespace or formatting
  hex = hex.replace(/[\s-]/g, "");

  // Convert hex to bytes then to base64
  const buffer = Buffer.from(hex, "hex");
  return buffer.toString("base64");
}

/**
 * Convert base64 group ID to hex
 *
 * @deprecated This function is LOSSY and should only be used for debugging.
 * The makeBase64Safe() function replaces /, +, and = all with _, making
 * reversal impossible. Use hexToBase64() for the forward direction only.
 *
 * For debugging: compare output with known hex values, don't trust for lookups.
 *
 * @param base64GroupId - Base64-encoded group ID (possibly with safe encoding)
 * @returns Hex-encoded group ID (without prefix) - MAY BE INCORRECT
 */
export function base64ToHex(base64GroupId: string): string {
  // WARNING: This is fundamentally lossy. makeBase64Safe() replaces /+= with _
  // so we cannot know which character _ originally was. This uses heuristics
  // that work for MOST Signal group IDs but may produce wrong results.
  const standard = base64GroupId.replace(/_/g, (_match, offset, str) => {
    // Assume trailing underscores are padding (=)
    // Assume other underscores are / (more common than + in base64)
    if (offset >= str.length - 2) return "=";
    return "/";
  });

  const buffer = Buffer.from(standard, "base64");
  return buffer.toString("hex");
}

/**
 * Make base64 string filesystem/URL-safe
 *
 * Replaces problematic characters with underscores:
 * - / (path separator)
 * - + (URL encoding)
 * - = (padding)
 *
 * @param base64 - Standard base64 string
 * @returns Safe base64 string for use in IDs
 */
export function makeBase64Safe(base64: string): string {
  return base64.replace(/[/+=]/g, "_");
}

// ============================================================================
// Account ID Generation
// ============================================================================

/**
 * Create a Signal account ID from phone number
 *
 * @param phone - Phone number (with or without +)
 * @returns Account ID (e.g., signal_12505551234)
 */
export function createSignalAccountId(phone: string): string {
  const normalized = phone.replace(/[\s-]/g, "").replace("+", "");
  return `signal_${normalized}`;
}

// ============================================================================
// Message ID Generation
// ============================================================================

/**
 * Create a Signal message ID
 *
 * Includes source to distinguish between backup and live sync messages.
 *
 * @param timestamp - Message timestamp in milliseconds
 * @param sender - Sender phone number
 * @param source - "backup" for imported messages, "live" for daemon messages
 * @returns Message ID
 */
export function createSignalMessageId(
  timestamp: number,
  sender: string,
  source: "backup" | "live" = "live"
): string {
  const normalizedSender = sender.replace(/[+\s-]/g, "");
  return `signal_${source}_${timestamp}_${normalizedSender}`;
}

// ============================================================================
// Legacy ID Parsing (for migration)
// ============================================================================

/**
 * Check if thread ID uses old numeric format
 *
 * Legacy format: signal_group_123 (numeric recipient_id)
 * New format: signal_group_abc123def (base64-safe group ID)
 *
 * @param threadId - Thread ID to check
 * @returns true if using legacy numeric format
 */
export function isLegacyNumericGroupId(threadId: string): boolean {
  return /^signal_group_\d+$/.test(threadId);
}

/**
 * Extract numeric recipient_id from old-format thread ID
 *
 * @param threadId - Legacy thread ID (e.g., signal_group_5)
 * @returns Numeric recipient ID, or null if not a legacy ID
 */
export function extractRecipientIdFromThreadId(threadId: string): number | null {
  const match = threadId.match(/^signal_group_(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a string is a valid Signal thread ID
 */
export function isValidSignalThreadId(threadId: string): boolean {
  return threadId.startsWith("signal_group_") || threadId.startsWith("signal_dm_");
}

/**
 * Check if thread ID is for a group conversation
 */
export function isSignalGroupThread(threadId: string): boolean {
  return threadId.startsWith("signal_group_");
}

/**
 * Check if thread ID is for a direct message
 */
export function isSignalDmThread(threadId: string): boolean {
  return threadId.startsWith("signal_dm_");
}
