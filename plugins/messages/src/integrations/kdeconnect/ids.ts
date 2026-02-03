/**
 * KDE Connect SMS ID Generation Helpers
 *
 * Shared utilities for generating consistent IDs across adapter and sync service.
 * All IDs use the "sms_" prefix to distinguish from other messaging platforms.
 */

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Create account ID from phone number
 * Format: sms_{normalized_phone}
 *
 * @example createAccountId("+1 (555) 123-4567") => "sms_15551234567"
 */
export function createAccountId(phoneNumber: string): string {
  const normalized = phoneNumber.replace(/[^0-9]/g, "");
  return `sms_${normalized}`;
}

/**
 * Create thread ID from conversation data
 * Format: sms_dm_{normalized_phone} (DM) or sms_group_{thread_id} (group)
 *
 * @param threadId - The Android thread ID
 * @param addresses - Array of phone numbers in the conversation
 *
 * @example createThreadId(123, ["+15551234567"]) => "sms_dm_15551234567"
 * @example createThreadId(456, ["+15551234567", "+15559876543"]) => "sms_group_456"
 */
export function createThreadId(threadId: number, addresses: string[]): string {
  if (addresses.length === 1) {
    // Direct message - use phone number for deterministic ID
    const normalized = addresses[0].replace(/[^0-9]/g, "");
    return `sms_dm_${normalized}`;
  } else {
    // Group message - use Android thread ID
    return `sms_group_${threadId}`;
  }
}

/**
 * Create platform-specific message ID
 * Format: sms_{thread_id}_{message_id}
 *
 * @example createPlatformMessageId(123, 456) => "sms_123_456"
 */
export function createPlatformMessageId(
  threadId: number,
  messageId: number
): string {
  return `sms_${threadId}_${messageId}`;
}

// =============================================================================
// Display Formatting
// =============================================================================

/**
 * Format phone number for display
 * Uses US formatting for 10/11 digit numbers, otherwise returns as-is.
 *
 * @param phoneNumber - Raw phone number
 * @param contactName - Optional contact name (takes precedence if provided)
 *
 * @example formatPhoneDisplay("5551234567") => "(555) 123-4567"
 * @example formatPhoneDisplay("15551234567") => "+1 (555) 123-4567"
 * @example formatPhoneDisplay("+1-555-123-4567", "Alice") => "Alice"
 */
export function formatPhoneDisplay(
  phoneNumber: string,
  contactName?: string
): string {
  if (contactName) return contactName;

  // Format phone number for display (basic US formatting)
  const digits = phoneNumber.replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phoneNumber;
}

// =============================================================================
// Constants
// =============================================================================

/** Account ID for the device owner (self) */
export const SELF_ACCOUNT_ID = "sms_self";
