/**
 * Telegram Adapter
 *
 * Imports messages from Telegram JSON exports.
 * Telegram Desktop: Settings → Advanced → Export Telegram Data → JSON
 *
 * Export format: result.json contains an array of chats, each with messages.
 */

import type { MessageStore } from "../core/store";
import type { Message, MessageInput, Account, Thread } from "../types";
import { Kind } from "../types";

/**
 * Telegram export message format
 */
interface TelegramMessage {
  id: number;
  type: string;
  date: string;
  date_unixtime?: string;
  from: string;
  from_id: string;
  text: string | TelegramTextEntity[];
  reply_to_message_id?: number;
  forwarded_from?: string;
  media_type?: string;
  file?: string;
  photo?: string;
  sticker_emoji?: string;
}

/**
 * Telegram text entity (for formatted text)
 */
interface TelegramTextEntity {
  type: string;
  text: string;
  href?: string;
}

/**
 * Telegram chat export format
 */
interface TelegramChat {
  name: string;
  type: string;
  id: number;
  messages: TelegramMessage[];
}

/**
 * Personal information in export (if "Account Information" was selected)
 */
interface TelegramPersonalInfo {
  user_id: number;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  username?: string;
}

/**
 * Telegram full export (result.json)
 */
interface TelegramExport {
  chats?: {
    list: TelegramChat[];
  };
  // Personal info (if exported with "Account Information")
  personal_information?: TelegramPersonalInfo;
  // Single chat export format
  name?: string;
  type?: string;
  id?: number;
  messages?: TelegramMessage[];
}

/**
 * Import options
 */
export interface TelegramImportOptions {
  /** User's Telegram ID (auto-detected from export or TELEGRAM_USER_ID env if not provided) */
  userId?: string;
}

/**
 * Import statistics
 */
export interface ImportStats {
  messages: number;
  accounts: number;
  threads: number;
  skipped: number;
  outgoing: number;
  incoming: number;
  userIdSource?: "export" | "env" | "none";
}

/**
 * Extract text content from Telegram message
 */
function extractText(text: string | TelegramTextEntity[]): string {
  if (typeof text === "string") {
    return text;
  }

  if (Array.isArray(text)) {
    return text
      .map((entity) => {
        if (typeof entity === "string") return entity;
        if (entity.type === "link" && entity.href) {
          return `[${entity.text}](${entity.href})`;
        }
        return entity.text;
      })
      .join("");
  }

  return "";
}

/**
 * Parse Telegram user ID
 */
function parseUserId(fromId: string): string {
  // fromId format: "user123456789" or "channel123456789"
  return fromId.replace(/^(user|channel)/, "");
}

/**
 * Detect user's Telegram ID from export data, options, or environment
 */
function detectUserId(
  data: TelegramExport,
  options?: TelegramImportOptions
): { userId: string | null; source: "export" | "env" | "option" | "none" } {
  // 1. Options take precedence
  if (options?.userId) {
    return { userId: options.userId, source: "option" };
  }

  // 2. Try to get from export's personal_information
  if (data.personal_information?.user_id) {
    return { userId: String(data.personal_information.user_id), source: "export" };
  }

  // 3. Fall back to environment variable
  const envUserId = process.env.TELEGRAM_USER_ID;
  if (envUserId) {
    return { userId: envUserId, source: "env" };
  }

  // 4. No user ID available - can't determine direction
  return { userId: null, source: "none" };
}

/**
 * Import messages from a Telegram export file
 */
export async function* importTelegramExport(
  filePath: string,
  store: MessageStore,
  options?: TelegramImportOptions
): AsyncGenerator<Message, ImportStats> {
  const file = Bun.file(filePath);
  const data: TelegramExport = await file.json();

  const stats: ImportStats = {
    messages: 0,
    accounts: 0,
    threads: 0,
    skipped: 0,
    outgoing: 0,
    incoming: 0,
  };

  // Detect user ID for direction tagging
  const { userId: myUserId, source: userIdSource } = detectUserId(data, options);
  stats.userIdSource = userIdSource === "option" ? "env" : userIdSource; // Normalize option to env for stats

  if (!myUserId) {
    console.warn(
      "⚠️  No user ID available - direction tags will not be set.\n" +
      "   To enable direction detection:\n" +
      "   1. Re-export with 'Account Information' selected, OR\n" +
      "   2. Set TELEGRAM_USER_ID environment variable"
    );
  } else {
    console.log(`✓ User ID detected (source: ${userIdSource}): ${myUserId}`);
  }

  // Handle both full export and single chat export formats
  const chats: TelegramChat[] = [];

  if (data.chats?.list) {
    chats.push(...data.chats.list);
  } else if (data.messages && data.name) {
    // Single chat export
    chats.push({
      name: data.name,
      type: data.type || "personal_chat",
      id: data.id || 0,
      messages: data.messages,
    });
  }

  const seenAccounts = new Set<string>();

  // Create self account if we know user ID
  const myAccountId = myUserId ? `tg_${myUserId}` : null;
  if (myAccountId && data.personal_information) {
    const info = data.personal_information;
    const selfName = [info.first_name, info.last_name].filter(Boolean).join(" ") || info.username || "Me";
    await store.getOrCreateAccount({
      id: myAccountId,
      name: selfName,
      identities: [
        {
          platform: "telegram",
          handle: info.username || info.phone_number || selfName,
        },
      ],
      is_self: true,
    });
    seenAccounts.add(myAccountId);
    stats.accounts++;
  }

  for (const chat of chats) {
    // Create thread for this chat
    const threadId = `tg_${chat.id}`;
    const threadType =
      chat.type === "personal_chat"
        ? "dm"
        : chat.type === "private_group"
        ? "group"
        : "channel";

    await store.getOrCreateThread({
      id: threadId,
      title: chat.name,
      type: threadType,
      participants: [],
      source: {
        platform: "telegram",
        platform_id: String(chat.id),
      },
    });
    stats.threads++;

    // Process messages
    for (const msg of chat.messages) {
      // Skip non-message types
      if (msg.type !== "message") {
        stats.skipped++;
        continue;
      }

      // Extract content
      const content = extractText(msg.text);
      if (!content.trim()) {
        stats.skipped++;
        continue;
      }

      // Parse account
      const rawUserId = parseUserId(msg.from_id);
      const accountId = `tg_${rawUserId}`;

      // Determine if this is an outgoing message
      const isOutgoing = myUserId ? rawUserId === myUserId : false;

      // Create account if needed
      if (!seenAccounts.has(accountId)) {
        await store.getOrCreateAccount({
          id: accountId,
          name: msg.from,
          identities: [
            {
              platform: "telegram",
              handle: msg.from,
            },
          ],
          is_self: isOutgoing,
        });
        seenAccounts.add(accountId);
        stats.accounts++;
      }

      // Parse timestamp
      const createdAt = msg.date_unixtime
        ? parseInt(msg.date_unixtime, 10) * 1000
        : new Date(msg.date).getTime();

      // Build tags array with direction (if we know user ID)
      const tags: [string, string][] = [];
      if (myUserId) {
        tags.push(["direction", isOutgoing ? "outgoing" : "incoming"]);
        if (isOutgoing) {
          stats.outgoing++;
        } else {
          stats.incoming++;
        }
      }
      if (msg.forwarded_from) {
        tags.push(["forwarded_from", msg.forwarded_from]);
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.Telegram,
        content,
        account_id: accountId,
        author: {
          name: msg.from,
          handle: msg.from,
        },
        created_at: createdAt,
        refs: {
          thread_id: threadId,
          reply_to: msg.reply_to_message_id
            ? `tg_reply_${msg.reply_to_message_id}`
            : undefined,
        },
        source: {
          platform: "telegram",
          platform_id: String(msg.id),
        },
        tags: tags.length > 0 ? tags : undefined,
      };

      // Create message
      const message = await store.createMessage(input);
      stats.messages++;

      yield message;
    }
  }

  return stats;
}

/**
 * Count messages in a Telegram export without importing
 */
export async function countTelegramExport(filePath: string): Promise<{
  chats: number;
  messages: number;
  participants: Set<string>;
}> {
  const file = Bun.file(filePath);
  const data: TelegramExport = await file.json();

  const participants = new Set<string>();
  let chatCount = 0;
  let messageCount = 0;

  const chats: TelegramChat[] = [];
  if (data.chats?.list) {
    chats.push(...data.chats.list);
  } else if (data.messages) {
    chats.push({
      name: data.name || "Unknown",
      type: data.type || "personal_chat",
      id: data.id || 0,
      messages: data.messages,
    });
  }

  for (const chat of chats) {
    chatCount++;
    for (const msg of chat.messages) {
      if (msg.type === "message" && extractText(msg.text).trim()) {
        messageCount++;
        participants.add(msg.from);
      }
    }
  }

  return { chats: chatCount, messages: messageCount, participants };
}
