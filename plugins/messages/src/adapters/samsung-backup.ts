/**
 * Samsung SMS Backup Adapter
 *
 * Imports SMS messages from Samsung/Android backup files (.ab format).
 * These are zlib-compressed JSON arrays extracted from Android backups.
 *
 * Backup file location after extraction:
 *   apps/com.android.providers.telephony/d_f/*_sms_backup
 *
 * Each backup file contains up to 1000 messages in JSON format:
 *   {
 *     "self_phone": "+1234567890",  // Owner's phone number
 *     "address": "+0987654321",     // Contact's phone number
 *     "body": "Message content",
 *     "date": "1689284111058",      // Unix timestamp in ms
 *     "date_sent": "1689284110000", // Sent timestamp (0 for outgoing)
 *     "status": "-1",
 *     "type": "1",                  // 1=incoming, 2=outgoing
 *     "recipients": ["..."],
 *     "read": "1"
 *   }
 */

import * as zlib from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import {
  createAccountId,
  createThreadId,
  createPlatformMessageId,
  formatPhoneDisplay,
  SELF_ACCOUNT_ID,
} from "../integrations/kdeconnect/ids";

// =============================================================================
// Types
// =============================================================================

export interface SamsungSmsMessage {
  self_phone: string;
  address: string;
  body: string;
  date: string;
  date_sent: string;
  status: string;
  type: string; // "1" = incoming, "2" = outgoing
  recipients: string[];
  read: string;
}

export interface SamsungBackupImportOptions {
  /** Path to extracted backup directory or individual backup file */
  path: string;
  /** Only import messages after this date */
  since?: Date;
  /** Only import messages before this date */
  until?: Date;
  /** Specific phone numbers to filter */
  addresses?: string[];
}

export interface SamsungBackupImportStats {
  messages: number;
  conversations: number;
  accounts: number;
  skipped: number;
  errors: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

// =============================================================================
// File Discovery
// =============================================================================

/**
 * Find SMS backup files in an extracted Android backup directory
 */
export function findSmsBackupFiles(basePath: string): string[] {
  const files: string[] = [];

  // Check if basePath is a single file
  if (fs.statSync(basePath).isFile()) {
    return [basePath];
  }

  // Look for Samsung telephony backup structure
  const telephonyPath = path.join(
    basePath,
    "apps/com.android.providers.telephony/d_f"
  );

  if (fs.existsSync(telephonyPath)) {
    const entries = fs.readdirSync(telephonyPath);
    for (const entry of entries) {
      if (entry.endsWith("_sms_backup")) {
        files.push(path.join(telephonyPath, entry));
      }
    }
  }

  // Also check if basePath itself is the d_f directory
  if (basePath.endsWith("d_f") || basePath.includes("telephony")) {
    const entries = fs.readdirSync(basePath);
    for (const entry of entries) {
      if (entry.endsWith("_sms_backup")) {
        files.push(path.join(basePath, entry));
      }
    }
  }

  return files.sort();
}

/**
 * Parse a single Samsung SMS backup file
 */
export function parseSmsBackupFile(filePath: string): SamsungSmsMessage[] {
  const compressed = fs.readFileSync(filePath);
  const decompressed = zlib.inflateSync(compressed);
  return JSON.parse(decompressed.toString("utf-8"));
}

// =============================================================================
// Import
// =============================================================================

/**
 * Count messages without importing (dry run)
 */
export async function countSamsungBackupMessages(
  options: SamsungBackupImportOptions
): Promise<{
  files: number;
  messages: number;
  uniqueAddresses: number;
  dateRange: { earliest?: Date; latest?: Date };
}> {
  const files = findSmsBackupFiles(options.path);
  let totalMessages = 0;
  const addresses = new Set<string>();
  let earliest: Date | undefined;
  let latest: Date | undefined;

  for (const file of files) {
    const messages = parseSmsBackupFile(file);
    for (const msg of messages) {
      // Apply date filters
      const msgDate = new Date(parseInt(msg.date, 10));
      if (options.since && msgDate < options.since) continue;
      if (options.until && msgDate > options.until) continue;

      // Apply address filter
      if (options.addresses?.length) {
        const normalized = normalizePhone(msg.address);
        if (!options.addresses.some((a) => normalizePhone(a) === normalized)) {
          continue;
        }
      }

      totalMessages++;
      addresses.add(msg.address);

      if (!earliest || msgDate < earliest) earliest = msgDate;
      if (!latest || msgDate > latest) latest = msgDate;
    }
  }

  return {
    files: files.length,
    messages: totalMessages,
    uniqueAddresses: addresses.size,
    dateRange: { earliest, latest },
  };
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  // Remove all non-digits except leading +
  const digits = phone.replace(/[^\d+]/g, "");
  // Ensure it starts with +
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Import SMS messages from Samsung backup files
 *
 * Yields messages as they are imported, returns final statistics.
 */
export async function* importSamsungBackup(
  store: MessageStore,
  options: SamsungBackupImportOptions
): AsyncGenerator<Message, SamsungBackupImportStats> {
  const stats: SamsungBackupImportStats = {
    messages: 0,
    conversations: 0,
    accounts: 0,
    skipped: 0,
    errors: 0,
    dateRange: {},
  };

  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  // Find all backup files
  const files = findSmsBackupFiles(options.path);
  if (files.length === 0) {
    console.error(`[samsung-backup] No SMS backup files found in ${options.path}`);
    return stats;
  }

  console.log(`[samsung-backup] Found ${files.length} backup files`);

  // Ensure self account exists
  if (!seenAccounts.has(SELF_ACCOUNT_ID)) {
    await store.getOrCreateAccount({
      id: SELF_ACCOUNT_ID,
      name: "Me (SMS)",
      identities: [{ platform: "sms", handle: "self" }],
      is_self: true,
    });
    seenAccounts.add(SELF_ACCOUNT_ID);
    stats.accounts++;
  }

  // Process each backup file
  for (const file of files) {
    const fileName = path.basename(file);
    console.log(`[samsung-backup] Processing ${fileName}...`);

    let messages: SamsungSmsMessage[];
    try {
      messages = parseSmsBackupFile(file);
    } catch (err) {
      console.error(`[samsung-backup] Failed to parse ${fileName}:`, err);
      stats.errors++;
      continue;
    }

    // Process each message
    for (const msg of messages) {
      try {
        const msgDate = new Date(parseInt(msg.date, 10));

        // Apply date filters
        if (options.since && msgDate < options.since) {
          stats.skipped++;
          continue;
        }
        if (options.until && msgDate > options.until) {
          stats.skipped++;
          continue;
        }

        // Apply address filter
        if (options.addresses?.length) {
          const normalized = normalizePhone(msg.address);
          if (!options.addresses.some((a) => normalizePhone(a) === normalized)) {
            stats.skipped++;
            continue;
          }
        }

        // Track date range
        if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
          stats.dateRange.earliest = msgDate;
        }
        if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
          stats.dateRange.latest = msgDate;
        }

        // Normalize phone number
        const address = normalizePhone(msg.address);

        // Create thread
        // Use address hash as thread ID (consistent with KDE Connect adapter)
        const threadId = createThreadId(0, [address]);

        if (!seenThreads.has(threadId)) {
          await store.getOrCreateThread({
            id: threadId,
            title: formatPhoneDisplay(address),
            type: "dm",
            participants: [SELF_ACCOUNT_ID],
            source: {
              platform: "sms",
              platform_id: `samsung:${address}`,
            },
          });
          seenThreads.add(threadId);
          stats.conversations++;
        }

        // Create account for contact
        const accountId = createAccountId(address);
        if (!seenAccounts.has(accountId)) {
          await store.getOrCreateAccount({
            id: accountId,
            name: formatPhoneDisplay(address),
            identities: [{ platform: "sms", handle: address }],
          });
          seenAccounts.add(accountId);
          stats.accounts++;
        }

        // Determine direction
        const isOutgoing = msg.type === "2";

        // Create unique message ID from timestamp and address
        const platformMsgId = createPlatformMessageId(
          parseInt(msg.date, 10),
          parseInt(msg.date, 10)
        );

        // Build message input
        const input: MessageInput = {
          kind: Kind.SMS,
          content: msg.body,
          account_id: isOutgoing ? SELF_ACCOUNT_ID : accountId,
          author: {
            name: isOutgoing ? "Me" : formatPhoneDisplay(address),
            handle: address,
          },
          created_at: parseInt(msg.date, 10),
          refs: {
            thread_id: threadId,
          },
          source: {
            platform: "sms",
            platform_id: platformMsgId,
          },
          tags: [
            ["direction", isOutgoing ? "outgoing" : "incoming"],
            ["message_type", "sms"],
            ["phone_number", address],
          ],
        };

        // Store message
        const message = await store.createMessage(input);
        stats.messages++;
        yield message;

        // Progress logging
        if (stats.messages % 500 === 0) {
          console.log(`[samsung-backup] Imported ${stats.messages} messages...`);
        }
      } catch (err) {
        console.error(`[samsung-backup] Failed to import message:`, err);
        stats.errors++;
      }
    }
  }

  console.log(
    `[samsung-backup] Import complete: ${stats.messages} messages ` +
      `from ${stats.conversations} conversations`
  );

  return stats;
}
