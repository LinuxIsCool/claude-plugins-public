/**
 * WhatsApp Text Export Importer
 *
 * Parses WhatsApp's "Export Chat" .txt files and imports messages.
 *
 * Supported formats:
 * - iOS: [1/14/26, 9:30:15 AM] Sender Name: Message content
 * - Android: 14/01/2026, 09:30:15 - Sender Name: Message content
 * - Android alt: 1/14/26, 9:30 AM - Sender Name: Message content
 */

import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import { createInterface } from "readline";
import { basename, join } from "path";
import { createStore } from "../core/store";
import { createSearchIndex } from "../search";
import { Kind } from "../types";
import type { Message, MessageInput } from "../types";
import type { MessageStore } from "../core/store";

export interface WhatsAppExportStats {
  files: number;
  messages: number;
  chats: number;
  skipped: number;
  errors: number;
}

export interface WhatsAppExportOptions {
  /** Your phone number (to identify outgoing messages) */
  myPhoneNumber?: string;
  /** Your name as it appears in exports (to identify outgoing messages) */
  myName?: string;
  /** Store instance (uses default if not provided) */
  store?: MessageStore;
}

// Regex patterns for different WhatsApp export formats
const PATTERNS = [
  // iOS format: [1/14/26, 9:30:15 AM] Sender: Message
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\]\s+([^:]+):\s*(.*)$/i,
  // Android format: 14/01/2026, 09:30:15 - Sender: Message
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+-\s+([^:]+):\s*(.*)$/,
  // Android alt format: 1/14/26, 9:30 AM - Sender: Message
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+-\s+([^:]+):\s*(.*)$/i,
];

// System message patterns to skip
const SYSTEM_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /created group/i,
  /added you/i,
  /changed the subject/i,
  /changed this group/i,
  /left$/i,
  /removed$/i,
  /joined using this group/i,
  /changed the group description/i,
  /deleted this message/i,
  /message was deleted/i,
  /<media omitted>/i,
  /^\u200e/,  // Left-to-right mark (system messages)
];

interface ParsedLine {
  date: string;
  time: string;
  sender: string;
  content: string;
}

/**
 * Parse a line from WhatsApp export
 */
function parseLine(line: string): ParsedLine | null {
  for (const pattern of PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return {
        date: match[1],
        time: match[2],
        sender: match[3].trim(),
        content: match[4],
      };
    }
  }
  return null;
}

/**
 * Check if a message is a system message
 */
function isSystemMessage(content: string, sender: string): boolean {
  // Check content patterns
  for (const pattern of SYSTEM_PATTERNS) {
    if (pattern.test(content)) return true;
  }
  // System messages sometimes have empty sender
  if (!sender || sender.trim() === "") return true;
  return false;
}

/**
 * Parse date and time strings to timestamp
 */
function parseTimestamp(dateStr: string, timeStr: string): number {
  // Parse date (handles both M/D/YY and D/M/YYYY formats)
  const dateParts = dateStr.split("/").map((p) => parseInt(p, 10));
  let year: number, month: number, day: number;

  if (dateParts[2] > 100) {
    // Format: D/M/YYYY or M/D/YYYY (4-digit year)
    year = dateParts[2];
  } else {
    // Format: M/D/YY or D/M/YY (2-digit year)
    year = dateParts[2] + 2000;
  }

  // Assume M/D format for US exports (most common)
  // TODO: Could make this configurable
  month = dateParts[0];
  day = dateParts[1];

  // Parse time
  const isPM = /pm/i.test(timeStr);
  const isAM = /am/i.test(timeStr);
  const timeParts = timeStr.replace(/\s*(am|pm)/i, "").split(":").map((p) => parseInt(p, 10));

  let hours = timeParts[0];
  const minutes = timeParts[1];
  const seconds = timeParts[2] || 0;

  // Convert 12-hour to 24-hour
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return date.getTime();
}

/**
 * Extract chat name from filename
 * WhatsApp exports are typically named: "WhatsApp Chat with John Doe.txt"
 */
function extractChatName(filename: string): string {
  const base = basename(filename, ".txt");
  // Remove "WhatsApp Chat with " prefix if present
  const match = base.match(/^WhatsApp Chat with (.+)$/i);
  if (match) return match[1];
  // Remove "_chat" or " chat" suffix
  return base.replace(/[_\s]chat$/i, "");
}

/**
 * Import a single WhatsApp export file
 */
export async function* importWhatsAppExportFile(
  filePath: string,
  options: WhatsAppExportOptions = {}
): AsyncGenerator<Message, { messages: number; skipped: number }> {
  const store = options.store || createStore();
  const searchIndex = createSearchIndex();

  const chatName = extractChatName(filePath);
  const threadId = `whatsapp_export_${chatName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;

  // Create thread
  await store.getOrCreateThread({
    id: threadId,
    title: chatName,
    type: "dm", // Could be group, but we can't tell from export
    participants: [],
    source: {
      platform: "whatsapp",
      platform_id: `export_${chatName}`,
    },
  });

  // Track seen accounts
  const seenAccounts = new Set<string>();
  let messages = 0;
  let skipped = 0;

  // For multi-line messages
  let pendingMessage: ParsedLine | null = null;

  const fileStream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    const parsed = parseLine(line);

    if (parsed) {
      // Process pending message first
      if (pendingMessage) {
        const msg = await processMessage(pendingMessage);
        if (msg) {
          yield msg;
          messages++;
        } else {
          skipped++;
        }
      }
      pendingMessage = parsed;
    } else if (pendingMessage && line.trim()) {
      // Continuation of previous message (multi-line)
      pendingMessage.content += "\n" + line;
    }
  }

  // Process final pending message
  if (pendingMessage) {
    const msg = await processMessage(pendingMessage);
    if (msg) {
      yield msg;
      messages++;
    } else {
      skipped++;
    }
  }

  return { messages, skipped };

  // Helper to process a parsed message
  async function processMessage(parsed: ParsedLine): Promise<Message | null> {
    // Skip system messages
    if (isSystemMessage(parsed.content, parsed.sender)) {
      return null;
    }

    // Skip empty content
    if (!parsed.content.trim()) {
      return null;
    }

    const timestamp = parseTimestamp(parsed.date, parsed.time);

    // Determine if outgoing
    const isOutgoing = Boolean(
      (options.myName && parsed.sender === options.myName) ||
      (options.myPhoneNumber && parsed.sender.includes(options.myPhoneNumber))
    );

    // Create account ID
    const accountId = `whatsapp_${parsed.sender.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;

    // Create account if needed
    if (!seenAccounts.has(accountId)) {
      await store.getOrCreateAccount({
        id: accountId,
        name: parsed.sender,
        identities: [{ platform: "whatsapp", handle: parsed.sender }],
        is_self: isOutgoing,
      });
      seenAccounts.add(accountId);
    }

    // Build message
    const input: MessageInput = {
      kind: Kind.WhatsApp,
      content: parsed.content,
      account_id: accountId,
      author: {
        name: parsed.sender,
        handle: parsed.sender,
      },
      created_at: timestamp,
      refs: {
        thread_id: threadId,
      },
      source: {
        platform: "whatsapp",
        platform_id: `export_${timestamp}_${accountId}`,
      },
      tags: [["direction", isOutgoing ? "outgoing" : "incoming"]],
    };

    const message = await store.createMessage(input);
    searchIndex.index(message);
    return message;
  }
}

/**
 * Import all WhatsApp export files from a directory
 */
export async function* importWhatsAppExports(
  pathOrDir: string,
  options: WhatsAppExportOptions = {}
): AsyncGenerator<Message, WhatsAppExportStats> {
  const stats: WhatsAppExportStats = {
    files: 0,
    messages: 0,
    chats: 0,
    skipped: 0,
    errors: 0,
  };

  if (!existsSync(pathOrDir)) {
    throw new Error(`Path does not exist: ${pathOrDir}`);
  }

  const isDir = statSync(pathOrDir).isDirectory();
  const files: string[] = [];

  if (isDir) {
    // Find all .txt files in directory
    const entries = readdirSync(pathOrDir);
    for (const entry of entries) {
      if (entry.endsWith(".txt")) {
        files.push(join(pathOrDir, entry));
      }
    }
  } else {
    files.push(pathOrDir);
  }

  if (files.length === 0) {
    throw new Error(`No .txt files found in: ${pathOrDir}`);
  }

  console.log(`[whatsapp-export] Found ${files.length} export file(s)`);

  for (const file of files) {
    stats.files++;
    stats.chats++;
    console.log(`[whatsapp-export] Importing: ${basename(file)}`);

    try {
      const generator = importWhatsAppExportFile(file, options);
      let result = await generator.next();

      while (!result.done) {
        yield result.value;
        result = await generator.next();
      }

      stats.messages += result.value.messages;
      stats.skipped += result.value.skipped;
      console.log(
        `[whatsapp-export] Imported ${result.value.messages} messages (${result.value.skipped} skipped)`
      );
    } catch (error) {
      stats.errors++;
      console.error(`[whatsapp-export] Error importing ${basename(file)}:`, error);
    }
  }

  console.log(
    `[whatsapp-export] Complete: ${stats.messages} messages from ${stats.chats} chats`
  );

  return stats;
}
