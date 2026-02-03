/**
 * Telegram API Adapter
 *
 * Imports messages directly from Telegram using the MTProto API.
 * Requires authentication via telegram-auth command first.
 */

import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import {
  TelegramApiClient,
  getTelegramClient,
  hasSession,
  type TelegramDialog,
  type TelegramMessage,
} from "../integrations/telegram/client";

/**
 * Import options
 */
export interface TelegramApiImportOptions {
  /** Only import messages from the last N days */
  daysBack?: number;
  /** Maximum messages per chat */
  maxPerChat?: number;
  /** Filter to specific chat types */
  chatTypes?: ("user" | "group" | "channel")[];
  /** Specific dialog IDs to import (if not set, imports all) */
  dialogIds?: string[];
}

/**
 * Import statistics
 */
export interface ImportStats {
  dialogs: number;
  messages: number;
  accounts: number;
  skipped: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

/**
 * Check if Telegram API is available (has valid session)
 */
export function isTelegramApiAvailable(): boolean {
  return hasSession();
}

/**
 * Count messages that would be imported without actually importing
 */
export async function countTelegramApi(
  options: TelegramApiImportOptions = {}
): Promise<{
  dialogs: number;
  estimatedMessages: number;
  dialogList: { id: string; title: string; type: string }[];
}> {
  const client = getTelegramClient();
  await client.connect();

  try {
    const { chatTypes = ["user", "group", "channel"], dialogIds } = options;
    const dialogs = await client.getDialogs();

    // Filter dialogs
    const filtered = dialogs.filter((d) => {
      if (!chatTypes.includes(d.type)) return false;
      if (dialogIds && !dialogIds.includes(d.id)) return false;
      return true;
    });

    return {
      dialogs: filtered.length,
      estimatedMessages: filtered.length * 50, // Rough estimate
      dialogList: filtered.map((d) => ({ id: d.id, title: d.title, type: d.type })),
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Import messages from Telegram API
 */
export async function* importTelegramApi(
  store: MessageStore,
  options: TelegramApiImportOptions = {}
): AsyncGenerator<Message, ImportStats> {
  const {
    daysBack = 30,
    maxPerChat = 500,
    chatTypes = ["user", "group", "channel"],
    dialogIds,
  } = options;

  const client = getTelegramClient();
  await client.connect();

  const stats: ImportStats = {
    dialogs: 0,
    messages: 0,
    accounts: 0,
    skipped: 0,
    dateRange: {},
  };

  const seenAccounts = new Set<string>();
  const minDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  try {
    // Get current user for identifying outgoing messages
    const me = await client.getMe();
    const myAccountId = `tg_${me.id}`;

    // Create account for current user
    await store.getOrCreateAccount({
      id: myAccountId,
      name: me.name,
      identities: [{ platform: "telegram", handle: me.phone || me.name }],
    });
    seenAccounts.add(myAccountId);
    stats.accounts++;

    // Get all dialogs
    const dialogs = await client.getDialogs();

    // Filter dialogs
    const filteredDialogs = dialogs.filter((d) => {
      if (!chatTypes.includes(d.type)) return false;
      if (dialogIds && !dialogIds.includes(d.id)) return false;
      // Always include user DMs regardless of last message date
      // User DMs are high-value 1-on-1 relationships that should never be filtered
      if (d.type === "user") return true;
      // For groups/channels, skip dialogs with no recent activity
      if (d.lastMessageDate && d.lastMessageDate < minDate) return false;
      return true;
    });

    console.log(`Found ${filteredDialogs.length} chats to import from`);

    // Process each dialog
    for (const dialog of filteredDialogs) {
      const threadId = `tg_${dialog.id}`;

      // Create thread
      await store.getOrCreateThread({
        id: threadId,
        title: dialog.title,
        type: dialog.type === "user" ? "dm" : dialog.type === "group" ? "group" : "channel",
        participants: [],
        source: {
          platform: "telegram",
          platform_id: dialog.id,
        },
      });
      stats.dialogs++;

      // Get messages from this dialog
      let messages: TelegramMessage[];
      try {
        messages = await client.getMessages(dialog.id, {
          limit: maxPerChat,
          minDate,
        });
      } catch (error) {
        console.warn(`Failed to fetch messages from "${dialog.title}": ${error}`);
        continue;
      }

      // Process messages
      for (const msg of messages) {
        // Skip empty messages
        if (!msg.text.trim()) {
          stats.skipped++;
          continue;
        }

        // Track date range
        if (!stats.dateRange.earliest || msg.date < stats.dateRange.earliest) {
          stats.dateRange.earliest = msg.date;
        }
        if (!stats.dateRange.latest || msg.date > stats.dateRange.latest) {
          stats.dateRange.latest = msg.date;
        }

        // Determine account
        let accountId: string;
        let authorName: string;

        if (msg.isOutgoing) {
          accountId = myAccountId;
          authorName = me.name;
        } else {
          accountId = msg.fromId ? `tg_${msg.fromId}` : `tg_unknown_${dialog.id}`;
          authorName = msg.fromName;

          // Create account if needed
          if (!seenAccounts.has(accountId)) {
            await store.getOrCreateAccount({
              id: accountId,
              name: authorName,
              identities: [{ platform: "telegram", handle: authorName }],
            });
            seenAccounts.add(accountId);
            stats.accounts++;
          }
        }

        // Build message input with direction tags
        const tags: [string, string][] = [
          ["direction", msg.isOutgoing ? "outgoing" : "incoming"],
        ];
        if (msg.mediaType) {
          tags.push(["media_type", msg.mediaType]);
        }

        const input: MessageInput = {
          kind: Kind.Telegram,
          content: msg.text,
          account_id: accountId,
          author: {
            name: authorName,
          },
          created_at: msg.date.getTime(),
          refs: {
            thread_id: threadId,
            reply_to: msg.replyToMsgId ? `tg_reply_${msg.replyToMsgId}` : undefined,
          },
          source: {
            platform: "telegram",
            platform_id: String(msg.id),
          },
          tags,
        };

        // Create message
        const message = await store.createMessage(input);
        stats.messages++;

        yield message;
      }
    }
  } finally {
    await client.disconnect();
  }

  return stats;
}
