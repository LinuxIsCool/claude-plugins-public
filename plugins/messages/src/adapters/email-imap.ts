/**
 * Email IMAP Adapter
 *
 * Imports messages directly from IMAP servers (Gmail, Outlook, etc.).
 * Uses shared parser.ts utilities for message conversion.
 */

import type { MessageStore } from "../core/store";
import { getMessagesBasePath } from "../config";
import type { Message } from "../types";
import {
  ImapEmailClient,
  createImapClient,
  isImapConfigured,
  type ImapFetchOptions,
  type ImapMailbox,
} from "../integrations/email/imap-client";
import {
  extractMetadata,
  buildThreadId,
  emailToMessageInput,
  createAccountId,
  type EmailParseContext,
} from "../integrations/email/parser";

/**
 * Import options for IMAP adapter
 */
export interface ImapImportOptions extends ImapFetchOptions {
  /** Base path for message storage (attachments) */
  basePath?: string;
  /** Save attachments to disk (default: false for IMAP to avoid large downloads) */
  includeAttachments?: boolean;
}

/**
 * Import statistics
 */
export interface ImapImportStats {
  messages: number;
  threads: number;
  accounts: number;
  folders: number;
  skipped: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

/**
 * Check if IMAP import is available
 */
export function isImapAvailable(): boolean {
  return isImapConfigured();
}

/**
 * Get IMAP configuration status
 */
export function getImapStatus(): {
  configured: boolean;
  host?: string;
  user?: string;
  authType?: "password" | "oauth2";
} {
  const host = process.env.IMAP_HOST || process.env.IMAP_SERVER;
  const user = process.env.IMAP_USER || process.env.EMAIL_ADDRESS;
  const hasPassword = !!(process.env.IMAP_PASSWORD || process.env.EMAIL_PASSWORD);
  const hasToken = !!process.env.IMAP_ACCESS_TOKEN;

  return {
    configured: !!host && (hasPassword || hasToken),
    host,
    user,
    authType: hasToken ? "oauth2" : hasPassword ? "password" : undefined,
  };
}

/**
 * List available IMAP folders
 */
export async function listImapFolders(): Promise<ImapMailbox[]> {
  const client = createImapClient();
  await client.connect();

  try {
    return await client.listMailboxes();
  } finally {
    await client.disconnect();
  }
}

/**
 * Count messages that would be imported (dry run)
 */
export async function countImapMessages(
  options: ImapFetchOptions = {}
): Promise<{
  folders: number;
  estimatedMessages: number;
  folderDetails: Array<{ path: string; messages: number }>;
}> {
  const client = createImapClient();
  await client.connect();

  try {
    const mailboxes = await client.listMailboxes();

    // Filter folders based on options
    let targetFolders = mailboxes;
    if (options.folders && options.folders.length > 0) {
      targetFolders = mailboxes.filter((mb) => options.folders!.includes(mb.path));
    } else {
      // Default: skip trash, drafts, junk
      targetFolders = mailboxes.filter((mb) => {
        const special = mb.specialUse?.toUpperCase();
        return special !== "\\TRASH" && special !== "\\DRAFTS" && special !== "\\JUNK";
      });
    }

    const folderDetails = targetFolders
      .filter((mb) => mb.messages && mb.messages > 0)
      .map((mb) => ({
        path: mb.path,
        messages: mb.messages || 0,
      }));

    const estimatedMessages = folderDetails.reduce((sum, f) => sum + f.messages, 0);

    return {
      folders: folderDetails.length,
      estimatedMessages,
      folderDetails,
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Import emails from IMAP server
 */
export async function* importEmailImap(
  store: MessageStore,
  options: ImapImportOptions = {}
): AsyncGenerator<Message, ImapImportStats> {
  const { basePath = getMessagesBasePath() } = options;

  const stats: ImapImportStats = {
    messages: 0,
    threads: 0,
    accounts: 0,
    folders: 0,
    skipped: 0,
    dateRange: {},
  };

  // Track seen entities
  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();
  const seenFolders = new Set<string>();

  // Threading state
  const messageIdToThread = new Map<string, string>();
  const subjectToThread = new Map<string, string>();

  // Create client
  const client = createImapClient();
  await client.connect();

  try {
    const userEmail = client.getUserEmail();
    const userAccountId = createAccountId(userEmail);

    // Create user account
    await store.getOrCreateAccount({
      id: userAccountId,
      name: userEmail.split("@")[0],
      identities: [{ platform: "email", handle: userEmail }],
    });
    seenAccounts.add(userAccountId);
    stats.accounts++;

    // Extract inbox name from email domain (e.g., "company" from "user@company.com")
    const emailDomain = userEmail.split("@")[1] || "";
    const inboxName = emailDomain.split(".")[0]; // Remove TLD

    // Context for parsing
    const context: EmailParseContext = {
      myAddress: userEmail,
      inbox: inboxName,
    };

    // Fetch messages from all requested folders
    for await (const { parsed, uid, folder } of client.fetchFromFolders(options)) {
      // Track folder
      if (!seenFolders.has(folder)) {
        seenFolders.add(folder);
        stats.folders++;
      }

      // Extract metadata
      const metadata = extractMetadata(parsed);

      // Skip empty content
      const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
      const html = typeof parsed.html === "string" ? parsed.html.trim() : "";
      if (!text && !html) {
        stats.skipped++;
        continue;
      }

      // Track date range
      if (!stats.dateRange.earliest || metadata.date < stats.dateRange.earliest) {
        stats.dateRange.earliest = metadata.date;
      }
      if (!stats.dateRange.latest || metadata.date > stats.dateRange.latest) {
        stats.dateRange.latest = metadata.date;
      }

      // Get or create sender account
      const senderAccountId = createAccountId(metadata.from.address);
      if (!seenAccounts.has(senderAccountId)) {
        await store.getOrCreateAccount({
          id: senderAccountId,
          name: metadata.from.name || metadata.from.address.split("@")[0],
          identities: [{ platform: "email", handle: metadata.from.address }],
        });
        seenAccounts.add(senderAccountId);
        stats.accounts++;
      }

      // Get or create recipient accounts
      for (const to of metadata.to) {
        const toAccountId = createAccountId(to.address);
        if (!seenAccounts.has(toAccountId)) {
          await store.getOrCreateAccount({
            id: toAccountId,
            name: to.name || to.address.split("@")[0],
            identities: [{ platform: "email", handle: to.address }],
          });
          seenAccounts.add(toAccountId);
          stats.accounts++;
        }
      }

      // Build thread ID
      const threadId = buildThreadId(metadata, messageIdToThread, subjectToThread);

      // Get or create thread
      if (!seenThreads.has(threadId)) {
        const participants = new Set<string>();
        participants.add(senderAccountId);
        for (const to of metadata.to) {
          participants.add(createAccountId(to.address));
        }

        await store.getOrCreateThread({
          id: threadId,
          title: metadata.subject,
          type: metadata.to.length > 1 ? "group" : "dm",
          participants: Array.from(participants),
          source: {
            platform: "email",
            platform_id: threadId,
          },
        });
        seenThreads.add(threadId);
        stats.threads++;
      }

      // Build message input with folder context
      const contextWithFolder: EmailParseContext = {
        ...context,
        folder,
      };

      const input = emailToMessageInput(parsed, contextWithFolder, threadId, senderAccountId);

      // Create message
      const message = await store.createMessage(input);
      stats.messages++;

      yield message;
    }
  } finally {
    await client.disconnect();
  }

  return stats;
}
