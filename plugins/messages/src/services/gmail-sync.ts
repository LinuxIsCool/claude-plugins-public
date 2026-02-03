/**
 * Gmail Sync Service
 *
 * Continuous background sync of Gmail messages using IMAP IDLE.
 * Supports multiple Gmail accounts simultaneously.
 *
 * Usage:
 *   import { GmailSyncService } from "./services/gmail-sync";
 *   const sync = new GmailSyncService();
 *   await sync.start();
 *   // ... later
 *   sync.stop();
 *
 * Architecture:
 * - IMAP IDLE for real-time push notifications (primary)
 * - Polling fallback every 30s if IDLE fails
 * - Gmail requires IDLE restart every 29 minutes
 * - Multi-account: parallel connections to each Gmail account
 */

import { EventEmitter } from "events";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ParsedMail } from "mailparser";
import { MessageStore } from "../core/store";
import { SearchIndex } from "../search/index";
import type { MessageInput, Message } from "../types";
import { Kind } from "../types";
import { getClaudePath } from "../../../../lib/paths";

/**
 * Gmail account configuration
 */
export interface GmailAccount {
  id: string;
  name: string;
  host: string;
  user: string;
  password: string;
}

/**
 * Sync service configuration
 */
export interface GmailSyncConfig {
  /** Accounts to sync. Default: load from env */
  accounts?: GmailAccount[];
  /** Folder to monitor. Default: [Gmail]/All Mail */
  folder?: string;
  /** Polling interval in ms (fallback). Default: 30000 (30s) */
  pollInterval?: number;
  /** IDLE restart interval in ms. Gmail requires 29min max. Default: 25min */
  idleRestartInterval?: number;
  /** Max reconnect attempts before giving up. Default: 10 */
  maxReconnectAttempts?: number;
  /** Backoff base in ms for reconnect. Default: 1000 */
  reconnectBackoff?: number;
}

/**
 * Per-account connection state
 */
interface AccountConnection {
  account: GmailAccount;
  client: ImapFlow | null;
  mode: "idle" | "polling" | "disconnected";
  pollTimer: NodeJS.Timeout | null;
  idleRestartTimer: NodeJS.Timeout | null;
  lastUid: number;
  reconnectAttempts: number;
  seenMessageIds: Set<string>;
}

/**
 * Sync service statistics
 */
export interface GmailSyncStats {
  mode: "running" | "stopped";
  accounts: Array<{
    id: string;
    mode: "idle" | "polling" | "disconnected";
    messagesProcessed: number;
    errors: number;
  }>;
  totalMessagesProcessed: number;
  totalErrors: number;
  lastSync?: Date;
  startedAt?: Date;
}

/**
 * Load Gmail accounts from environment variables
 *
 * Expected format:
 *   IMAP_<PREFIX>_HOST=imap.gmail.com
 *   IMAP_<PREFIX>_USER=email@domain.com
 *   IMAP_<PREFIX>_PASSWORD=app_password
 */
function loadGmailAccountsFromEnv(): GmailAccount[] {
  const accounts: GmailAccount[] = [];
  const seen = new Set<string>();

  // Find all IMAP prefixes in environment
  for (const key of Object.keys(process.env)) {
    const match = key.match(/^IMAP_([A-Z0-9_]+)_HOST$/);
    if (match) {
      const prefix = match[1];
      if (seen.has(prefix)) continue;
      seen.add(prefix);

      const host = process.env[`IMAP_${prefix}_HOST`];
      const user = process.env[`IMAP_${prefix}_USER`];
      const password = process.env[`IMAP_${prefix}_PASSWORD`];

      if (host && user && password) {
        accounts.push({
          id: prefix.toLowerCase(),
          name: user.split("@")[0] || prefix,
          host,
          user,
          password,
        });
      }
    }
  }

  return accounts;
}

/**
 * Create account ID for email storage
 */
function createAccountId(email: string): string {
  return `email_${email.replace(/[@.]/g, "_")}`;
}

/**
 * Create thread ID from Message-ID or UID
 */
function createThreadId(email: string, messageId: string): string {
  const safe = messageId.replace(/[<>@./]/g, "_").substring(0, 50);
  return `email_thread_${email.replace(/[@.]/g, "_")}_${safe}`;
}

/**
 * Gmail Sync Service
 *
 * Provides continuous real-time message sync from Gmail accounts.
 * Emits events: 'message', 'error', 'connected', 'disconnected', 'sync'
 */
export class GmailSyncService extends EventEmitter {
  private config: Required<GmailSyncConfig>;
  private store: MessageStore;
  private searchIndex: SearchIndex;
  private running = false;
  private connections: Map<string, AccountConnection> = new Map();
  private accountStats: Map<string, { processed: number; errors: number }> = new Map();

  constructor(config?: GmailSyncConfig) {
    super();

    const accounts = config?.accounts ?? loadGmailAccountsFromEnv();
    if (accounts.length === 0) {
      throw new Error(
        "No Gmail accounts configured. Set IMAP_<PREFIX>_HOST, IMAP_<PREFIX>_USER, IMAP_<PREFIX>_PASSWORD in .env"
      );
    }

    this.config = {
      accounts,
      folder: config?.folder ?? "[Gmail]/All Mail",
      pollInterval: config?.pollInterval ?? 30000,
      idleRestartInterval: config?.idleRestartInterval ?? 25 * 60 * 1000, // 25 min
      maxReconnectAttempts: config?.maxReconnectAttempts ?? 10,
      reconnectBackoff: config?.reconnectBackoff ?? 1000,
    };

    this.store = new MessageStore();
    this.searchIndex = new SearchIndex();

    // Initialize stats
    for (const account of accounts) {
      this.accountStats.set(account.id, { processed: 0, errors: 0 });
    }
  }

  /**
   * Start the sync service for all accounts
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[gmail-sync] Already running");
      return;
    }

    this.running = true;
    console.log(`[gmail-sync] Starting sync for ${this.config.accounts.length} accounts...`);

    // Start all accounts in parallel
    const startPromises = this.config.accounts.map((account) =>
      this.startAccount(account).catch((err) => {
        console.error(`[gmail-sync] Failed to start ${account.id}:`, err.message);
        this.emit("error", { account: account.id, error: err });
      })
    );

    await Promise.all(startPromises);
  }

  /**
   * Stop the sync service
   */
  async stop(): Promise<void> {
    this.running = false;
    console.log("[gmail-sync] Stopping...");

    // Stop all connections
    for (const [accountId, conn] of this.connections) {
      await this.stopAccount(accountId);
    }

    this.connections.clear();
    this.emit("disconnected");
  }

  /**
   * Get sync statistics
   */
  getStats(): GmailSyncStats {
    let totalProcessed = 0;
    let totalErrors = 0;
    const accounts: GmailSyncStats["accounts"] = [];

    for (const [id, stats] of this.accountStats) {
      const conn = this.connections.get(id);
      accounts.push({
        id,
        mode: conn?.mode ?? "disconnected",
        messagesProcessed: stats.processed,
        errors: stats.errors,
      });
      totalProcessed += stats.processed;
      totalErrors += stats.errors;
    }

    return {
      mode: this.running ? "running" : "stopped",
      accounts,
      totalMessagesProcessed: totalProcessed,
      totalErrors: totalErrors,
    };
  }

  // ===========================================================================
  // Account Management
  // ===========================================================================

  private async startAccount(account: GmailAccount): Promise<void> {
    // Ensure account exists in store
    const accountId = createAccountId(account.user);
    await this.store.getOrCreateAccount({
      id: accountId,
      name: account.user,
      identities: [{ platform: "email", handle: account.user }],
    });

    // Create connection state
    const conn: AccountConnection = {
      account,
      client: null,
      mode: "disconnected",
      pollTimer: null,
      idleRestartTimer: null,
      lastUid: 0,
      reconnectAttempts: 0,
      seenMessageIds: new Set(),
    };

    this.connections.set(account.id, conn);

    // Try to connect
    await this.connectAccount(account.id);
  }

  private async stopAccount(accountId: string): Promise<void> {
    const conn = this.connections.get(accountId);
    if (!conn) return;

    // Clear timers
    if (conn.pollTimer) {
      clearInterval(conn.pollTimer);
      conn.pollTimer = null;
    }
    if (conn.idleRestartTimer) {
      clearTimeout(conn.idleRestartTimer);
      conn.idleRestartTimer = null;
    }

    // Disconnect client
    if (conn.client) {
      try {
        await conn.client.logout();
      } catch {
        // Ignore logout errors
      }
      conn.client = null;
    }

    conn.mode = "disconnected";
  }

  private async connectAccount(accountId: string): Promise<void> {
    const conn = this.connections.get(accountId);
    if (!conn || !this.running) return;

    const { account } = conn;

    try {
      console.log(`[gmail-sync:${accountId}] Connecting to ${account.host}...`);

      // Create IMAP client
      conn.client = new ImapFlow({
        host: account.host,
        port: 993,
        secure: true,
        auth: {
          user: account.user,
          pass: account.password,
        },
        logger: false,
      });

      await conn.client.connect();

      // Get current highest UID for incremental sync
      await conn.client.getMailboxLock(this.config.folder);
      try {
        const status = await conn.client.status(this.config.folder, { uidNext: true });
        conn.lastUid = (status.uidNext ?? 1) - 1;
      } finally {
        conn.client.mailboxClose();
      }

      console.log(`[gmail-sync:${accountId}] Connected, starting at UID ${conn.lastUid}`);

      // Try IDLE mode first
      await this.startIdleMode(accountId);
    } catch (err) {
      console.error(`[gmail-sync:${accountId}] Connection failed:`, err);
      this.accountStats.get(accountId)!.errors++;

      // Try reconnect or fall back to polling
      await this.handleReconnect(accountId);
    }
  }

  // ===========================================================================
  // IDLE Mode (Real-time Push)
  // ===========================================================================

  private async startIdleMode(accountId: string): Promise<void> {
    const conn = this.connections.get(accountId);
    if (!conn || !conn.client || !this.running) return;

    try {
      conn.mode = "idle";
      this.emit("connected", { account: accountId, mode: "idle" });
      console.log(`[gmail-sync:${accountId}] IDLE mode started`);

      // Open mailbox for IDLE
      const lock = await conn.client.getMailboxLock(this.config.folder);

      // Set up EXISTS event handler (new message notification)
      conn.client.on("exists", async (data: { count: number }) => {
        try {
          const count = await this.fetchNewMessages(accountId);
          if (count > 0) {
            this.emit("sync", { account: accountId, count, mode: "idle" });
          }
        } catch (err) {
          console.error(`[gmail-sync:${accountId}] Error fetching new messages:`, err);
          this.accountStats.get(accountId)!.errors++;
          this.emit("error", { account: accountId, error: err });
        }
      });

      // Gmail requires IDLE restart every 29 minutes
      conn.idleRestartTimer = setInterval(async () => {
        if (conn.client && conn.mode === "idle") {
          console.log(`[gmail-sync:${accountId}] Restarting IDLE...`);
          try {
            // Release and re-acquire lock to restart IDLE
            lock.release();
            const newLock = await conn.client.getMailboxLock(this.config.folder);
          } catch (err) {
            console.error(`[gmail-sync:${accountId}] IDLE restart failed:`, err);
            // Fall back to polling
            this.startPollingMode(accountId);
          }
        }
      }, this.config.idleRestartInterval);

      // Initial fetch to catch up
      const initialCount = await this.fetchNewMessages(accountId);
      if (initialCount > 0) {
        console.log(`[gmail-sync:${accountId}] Initial sync: ${initialCount} messages`);
      }
    } catch (err) {
      console.error(`[gmail-sync:${accountId}] IDLE mode failed:`, err);
      // Fall back to polling
      this.startPollingMode(accountId);
    }
  }

  // ===========================================================================
  // Polling Mode (Fallback)
  // ===========================================================================

  private startPollingMode(accountId: string): void {
    const conn = this.connections.get(accountId);
    if (!conn || !this.running) return;

    conn.mode = "polling";
    this.emit("connected", { account: accountId, mode: "polling" });
    console.log(`[gmail-sync:${accountId}] Polling mode started (interval: ${this.config.pollInterval}ms)`);

    const poll = async () => {
      if (!this.running || conn.mode !== "polling") return;

      try {
        const count = await this.fetchNewMessages(accountId);
        if (count > 0) {
          this.emit("sync", { account: accountId, count, mode: "polling" });
        }
      } catch (err) {
        console.error(`[gmail-sync:${accountId}] Poll error:`, err);
        this.accountStats.get(accountId)!.errors++;
        this.emit("error", { account: accountId, error: err });
      }
    };

    // First poll immediately
    poll();

    // Then on interval
    conn.pollTimer = setInterval(poll, this.config.pollInterval);
  }

  // ===========================================================================
  // Message Fetching
  // ===========================================================================

  private async fetchNewMessages(accountId: string): Promise<number> {
    const conn = this.connections.get(accountId);
    if (!conn || !conn.client) return 0;

    const { account } = conn;
    let processed = 0;

    try {
      const lock = await conn.client.getMailboxLock(this.config.folder);

      try {
        // Search for messages with UID > lastUid
        const uids = await conn.client.search(
          { uid: `${conn.lastUid + 1}:*` },
          { uid: true }
        );

        if (!uids || uids.length === 0) return 0;

        // Fetch each new message
        for (const uid of uids) {
          if (uid <= conn.lastUid) continue; // Skip already processed

          try {
            const msg = await conn.client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
            if (!msg || !msg.source) continue;

            const messageId = msg.envelope?.messageId || `uid_${uid}`;

            // Skip duplicates
            if (conn.seenMessageIds.has(messageId)) continue;
            conn.seenMessageIds.add(messageId);

            // Parse and process
            const parsed = await simpleParser(msg.source);
            const message = await this.processEmail(account, parsed, messageId);

            if (message) {
              processed++;
              this.accountStats.get(accountId)!.processed++;
              this.emit("message", message);
            }

            // Update lastUid
            conn.lastUid = Math.max(conn.lastUid, uid);
          } catch (err) {
            console.error(`[gmail-sync:${accountId}] Failed to process UID ${uid}:`, err);
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      // Connection might be lost
      if (this.running) {
        console.error(`[gmail-sync:${accountId}] Fetch error, reconnecting...`);
        await this.handleReconnect(accountId);
      }
    }

    return processed;
  }

  private async processEmail(
    account: GmailAccount,
    parsed: ParsedMail,
    messageId: string
  ): Promise<Message | null> {
    // Skip if no text content
    const content = parsed.text || parsed.html?.replace(/<[^>]+>/g, " ").trim();
    if (!content) return null;

    // Determine direction and sender
    const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase() || "";
    const isOutgoing = fromAddress === account.user.toLowerCase();

    const accountId = createAccountId(account.user);
    const senderAccountId = isOutgoing ? accountId : createAccountId(fromAddress);

    // Ensure sender account exists
    if (!isOutgoing) {
      await this.store.getOrCreateAccount({
        id: senderAccountId,
        name: parsed.from?.value?.[0]?.name || fromAddress,
        identities: [{ platform: "email", handle: fromAddress }],
      });
    }

    // Determine thread (use conversation with the other party)
    const otherParty = isOutgoing
      ? parsed.to?.value?.[0]?.address || "unknown"
      : fromAddress;
    const threadId = createThreadId(account.user, messageId);

    // Ensure thread exists
    await this.store.getOrCreateThread({
      id: threadId,
      title: parsed.subject || "No Subject",
      type: "dm",
      participants: [accountId],
      source: {
        platform: "email",
        platform_id: messageId,
      },
    });

    // Build message input
    const input: MessageInput = {
      kind: Kind.Email,
      content: content.substring(0, 50000), // Limit content size
      account_id: senderAccountId,
      author: {
        name: parsed.from?.value?.[0]?.name || fromAddress,
        handle: fromAddress,
      },
      created_at: parsed.date || new Date(),
      refs: {
        thread_id: threadId,
        reply_to: parsed.inReplyTo || undefined,
      },
      source: {
        platform: "email",
        platform_id: messageId,
      },
      tags: [
        ["direction", isOutgoing ? "outgoing" : "incoming"],
        ["source", "live"],
        ["account", account.id],
      ],
    };

    // Create message
    const message = await this.store.createMessage(input);

    // Index for search
    this.searchIndex.index(message);

    return message;
  }

  // ===========================================================================
  // Reconnection Logic
  // ===========================================================================

  private async handleReconnect(accountId: string): Promise<void> {
    const conn = this.connections.get(accountId);
    if (!conn || !this.running) return;

    conn.reconnectAttempts++;

    if (conn.reconnectAttempts > this.config.maxReconnectAttempts) {
      console.log(`[gmail-sync:${accountId}] Max reconnect attempts reached, giving up`);
      conn.mode = "disconnected";
      return;
    }

    const backoff = this.config.reconnectBackoff * Math.pow(2, conn.reconnectAttempts - 1);
    console.log(`[gmail-sync:${accountId}] Reconnecting in ${backoff}ms (attempt ${conn.reconnectAttempts})`);

    await new Promise((resolve) => setTimeout(resolve, backoff));

    if (!this.running) return;

    // Clean up old connection
    if (conn.client) {
      try {
        await conn.client.logout();
      } catch {
        // Ignore
      }
      conn.client = null;
    }

    // Clear timers
    if (conn.pollTimer) {
      clearInterval(conn.pollTimer);
      conn.pollTimer = null;
    }
    if (conn.idleRestartTimer) {
      clearTimeout(conn.idleRestartTimer);
      conn.idleRestartTimer = null;
    }

    // Reconnect
    await this.connectAccount(accountId);
  }
}

/**
 * Singleton instance for global access
 */
let syncService: GmailSyncService | null = null;

/**
 * Get or create the global sync service instance
 */
export function getGmailSyncService(config?: GmailSyncConfig): GmailSyncService {
  if (!syncService) {
    syncService = new GmailSyncService(config);
  }
  return syncService;
}

/**
 * Reset the singleton (for testing)
 */
export async function resetGmailSyncService(): Promise<void> {
  if (syncService) {
    await syncService.stop();
    syncService = null;
  }
}
