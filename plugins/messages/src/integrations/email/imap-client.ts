/**
 * IMAP Client
 *
 * Handles connection and message fetching from IMAP servers.
 * Uses imapflow for modern Promise-based IMAP operations.
 *
 * Performance optimizations (from review):
 * - Two-phase fetch: ENVELOPE first (fast) → RFC822 only for new messages
 * - UID range syntax: "1000:1089" instead of comma-separated
 * - Batch sizes: 50 for ENVELOPE, 15 for RFC822
 * - Retry logic with reconnection
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ParsedMail } from "mailparser";

/**
 * IMAP connection configuration
 */
export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: ImapAuth;
}

/**
 * Authentication options
 */
export type ImapAuth =
  | { type: "password"; user: string; pass: string }
  | { type: "oauth2"; user: string; accessToken: string };

/**
 * Mailbox (folder) information
 */
export interface ImapMailbox {
  path: string;
  name: string;
  specialUse?: string; // 'INBOX', 'SENT', 'TRASH', 'DRAFTS', 'ARCHIVE', 'JUNK'
  messages?: number;
  unseen?: number;
}

/**
 * Fetch options for messages
 */
export interface ImapFetchOptions {
  /** Only fetch messages since this date */
  since?: Date;
  /** Maximum messages to fetch per folder */
  limit?: number;
  /** Folders to fetch from (default: all) */
  folders?: string[];
  /** Include sent folder (default: true) */
  includeSent?: boolean;
  /** Already-seen Message-IDs to skip (for deduplication) */
  seenMessageIds?: Set<string>;
}

/**
 * Load IMAP configuration from environment variables
 *
 * Supports multiple naming conventions:
 * - IMAP_HOST or IMAP_SERVER
 * - IMAP_USER or EMAIL_ADDRESS
 * - IMAP_PASSWORD or EMAIL_PASSWORD
 */
export function loadImapConfig(): ImapConfig {
  const host = process.env.IMAP_HOST || process.env.IMAP_SERVER;
  const port = parseInt(process.env.IMAP_PORT || "993", 10);
  const user = process.env.IMAP_USER || process.env.EMAIL_ADDRESS;
  const pass = process.env.IMAP_PASSWORD || process.env.EMAIL_PASSWORD;
  const accessToken = process.env.IMAP_ACCESS_TOKEN;

  if (!host) {
    throw new Error("Missing IMAP_HOST or IMAP_SERVER in environment");
  }

  if (!user) {
    throw new Error("Missing IMAP_USER or EMAIL_ADDRESS in environment");
  }

  // Prefer OAuth2 if access token is provided
  if (accessToken) {
    return {
      host,
      port,
      secure: port === 993,
      auth: { type: "oauth2", user, accessToken },
    };
  }

  if (!pass) {
    throw new Error("Missing IMAP_PASSWORD or EMAIL_PASSWORD in environment");
  }

  return {
    host,
    port,
    secure: port === 993,
    auth: { type: "password", user, pass },
  };
}

/**
 * Common IMAP presets for popular providers
 */
export const IMAP_PRESETS: Record<string, Partial<ImapConfig>> = {
  gmail: { host: "imap.gmail.com", port: 993, secure: true },
  outlook: { host: "outlook.office365.com", port: 993, secure: true },
  yahoo: { host: "imap.mail.yahoo.com", port: 993, secure: true },
  icloud: { host: "imap.mail.me.com", port: 993, secure: true },
  fastmail: { host: "imap.fastmail.com", port: 993, secure: true },
  protonmail: { host: "127.0.0.1", port: 1143, secure: false }, // ProtonMail Bridge
};

/**
 * IMAP Email Client
 *
 * Wraps imapflow with a simpler API focused on message fetching.
 */
export class ImapEmailClient {
  private client: ImapFlow | null = null;
  private config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    const authConfig =
      this.config.auth.type === "oauth2"
        ? { user: this.config.auth.user, accessToken: this.config.auth.accessToken }
        : { user: this.config.auth.user, pass: this.config.auth.pass };

    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: authConfig,
      logger: false, // Quiet mode
    });

    await this.client.connect();
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * List all mailboxes (folders)
   */
  async listMailboxes(): Promise<ImapMailbox[]> {
    if (!this.client) throw new Error("Not connected");

    const mailboxes = await this.client.list();
    const result: ImapMailbox[] = [];

    for (const mb of mailboxes) {
      // Get status for each mailbox
      let messages: number | undefined;
      let unseen: number | undefined;

      try {
        const status = await this.client.status(mb.path, {
          messages: true,
          unseen: true,
        });
        messages = status.messages;
        unseen = status.unseen;
      } catch {
        // Some folders may not support status
      }

      result.push({
        path: mb.path,
        name: mb.path.split(mb.delimiter || "/").pop() || mb.path,
        specialUse: mb.specialUse || undefined,
        messages,
        unseen,
      });
    }

    return result;
  }

  /**
   * Fetch messages from a folder using two-phase approach
   *
   * Phase 1: Fast ENVELOPE fetch to get Message-IDs (batched, 50 at a time)
   * Phase 2: Full RFC822 fetch only for NEW messages not in seenMessageIds
   *
   * This is ~10-50x faster than fetching full RFC822 for all messages.
   */
  async *fetchMessages(
    folder: string,
    options: { since?: Date; limit?: number; seenMessageIds?: Set<string> } = {}
  ): AsyncGenerator<{ parsed: ParsedMail; uid: number; folder: string; messageId: string }> {
    if (!this.client) throw new Error("Not connected");

    const { since, limit, seenMessageIds = new Set() } = options;

    // Acquire mailbox lock
    const lock = await this.client.getMailboxLock(folder);

    try {
      // Build search criteria
      const searchCriteria: Record<string, unknown> = {};
      if (since) {
        searchCriteria.since = since;
      }

      // Search for message UIDs
      let searchResult: number[] | false;
      if (Object.keys(searchCriteria).length > 0) {
        searchResult = await this.client.search(searchCriteria, { uid: true });
      } else {
        searchResult = await this.client.search({ all: true }, { uid: true });
      }

      // Handle empty results
      let uids: number[] = searchResult === false ? [] : searchResult;

      if (uids.length === 0) {
        return;
      }

      // Apply limit (most recent first)
      if (limit && uids.length > limit) {
        uids = uids.slice(-limit);
      }

      console.log(`  [${folder}] ${uids.length} messages`);

      // ═══════════════════════════════════════════════════════════════════════
      // Phase 1: Fast ENVELOPE fetch to get Message-IDs for deduplication
      // ═══════════════════════════════════════════════════════════════════════
      const ENVELOPE_BATCH = 50; // ENVELOPE is fast, can batch more
      const newMessages: Array<{ uid: number; messageId: string }> = [];

      for (let i = 0; i < uids.length; i += ENVELOPE_BATCH) {
        const batch = uids.slice(i, i + ENVELOPE_BATCH);
        // Use UID range syntax: "1000:1049" instead of comma-separated
        const minUid = Math.min(...batch);
        const maxUid = Math.max(...batch);
        const uidRange = `${minUid}:${maxUid}`;

        try {
          for await (const msg of this.client.fetch(uidRange, { envelope: true }, { uid: true })) {
            const messageId = msg.envelope?.messageId || `uid_${msg.uid}`;
            if (!seenMessageIds.has(messageId)) {
              newMessages.push({ uid: msg.uid, messageId });
            }
          }
        } catch {
          // Fallback: fetch individually if batch fails (some folders don't support range)
          for (const uid of batch) {
            try {
              const msg = await this.client.fetchOne(String(uid), { envelope: true }, { uid: true });
              if (msg) {
                const messageId = msg.envelope?.messageId || `uid_${uid}`;
                if (!seenMessageIds.has(messageId)) {
                  newMessages.push({ uid, messageId });
                }
              }
            } catch {
              // Skip problematic messages
            }
          }
        }
      }

      const skipped = uids.length - newMessages.length;
      if (skipped > 0) {
        console.log(`  [${folder}] ↳ ${skipped} duplicates skipped`);
      }

      if (newMessages.length === 0) {
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Phase 2: Full RFC822 fetch only for genuinely new messages
      // ═══════════════════════════════════════════════════════════════════════
      console.log(`  [${folder}] ↳ Fetching ${newMessages.length} new...`);

      let fetched = 0;
      const MAX_RETRIES = 2;

      for (const { uid, messageId } of newMessages) {
        let success = false;

        for (let retry = 0; retry < MAX_RETRIES && !success; retry++) {
          try {
            const message = await this.client.fetchOne(String(uid), { source: true }, { uid: true });
            if (message && message.source) {
              const parsed = await simpleParser(message.source);
              yield { parsed, uid, folder, messageId };
              fetched++;
              success = true;

              // Progress update every 10 messages
              if (fetched % 10 === 0) {
                process.stdout.write(`\r  [${folder}] ↳ ${fetched}/${newMessages.length}...`);
              }
            }
          } catch {
            if (retry < MAX_RETRIES - 1) {
              // Brief pause before retry
              await new Promise((r) => setTimeout(r, 500));
            }
          }
        }
      }

      if (fetched > 0) {
        console.log(`\r  [${folder}] ↳ ${fetched} fetched                `);
      }
    } finally {
      lock.release();
    }
  }

  /**
   * Fetch messages from multiple folders
   *
   * Tracks seen Message-IDs across folders to avoid duplicates
   * (Gmail shows same message in INBOX and [Gmail]/All Mail).
   */
  async *fetchFromFolders(
    options: ImapFetchOptions = {}
  ): AsyncGenerator<{ parsed: ParsedMail; uid: number; folder: string; messageId: string }> {
    if (!this.client) throw new Error("Not connected");

    const { since, limit, folders, includeSent = true, seenMessageIds = new Set() } = options;

    // Track Message-IDs across all folders for cross-folder deduplication
    const allSeenIds = new Set(seenMessageIds);

    // Get folder list
    let targetFolders: string[];

    if (folders && folders.length > 0) {
      targetFolders = folders;
    } else {
      // Get all folders
      const allMailboxes = await this.listMailboxes();

      // Filter to main folders (skip trash, drafts, junk)
      targetFolders = allMailboxes
        .filter((mb) => {
          const special = mb.specialUse?.toUpperCase();
          // Skip trash, drafts, junk
          if (special === "\\TRASH" || special === "\\DRAFTS" || special === "\\JUNK") {
            return false;
          }
          // Include sent if requested
          if (special === "\\SENT" && !includeSent) {
            return false;
          }
          return true;
        })
        .map((mb) => mb.path);
    }

    // Fetch from each folder
    for (const folder of targetFolders) {
      try {
        for await (const message of this.fetchMessages(folder, { since, limit, seenMessageIds: allSeenIds })) {
          // Track this Message-ID for cross-folder dedup
          allSeenIds.add(message.messageId);
          yield message;
        }
      } catch (error) {
        console.warn(`Failed to fetch from folder "${folder}": ${error}`);
      }
    }
  }

  /**
   * Get user email address (from config)
   */
  getUserEmail(): string {
    return this.config.auth.user;
  }
}

/**
 * Create client from environment configuration
 */
export function createImapClient(): ImapEmailClient {
  const config = loadImapConfig();
  return new ImapEmailClient(config);
}

/**
 * Check if IMAP is configured
 */
export function isImapConfigured(): boolean {
  const host = process.env.IMAP_HOST || process.env.IMAP_SERVER;
  const pass = process.env.IMAP_PASSWORD || process.env.EMAIL_PASSWORD || process.env.IMAP_ACCESS_TOKEN;
  return !!host && !!pass;
}
