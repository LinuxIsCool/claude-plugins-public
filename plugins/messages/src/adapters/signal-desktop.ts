/**
 * Signal Desktop Adapter
 *
 * Imports messages from Signal Desktop's decrypted SQLite database.
 *
 * Prerequisites:
 * 1. Signal Desktop installed and synced
 * 2. Decrypt the database using sqlcipher:
 *    sqlcipher ~/.var/app/org.signal.Signal/config/Signal/sql/db.sqlite
 *    > PRAGMA key = "x'<key from config.json>'";
 *    > ATTACH DATABASE 'decrypted.sqlite' AS plaintext KEY '';
 *    > SELECT sqlcipher_export('plaintext');
 *
 * Or use the export script: scripts/signal-desktop-export.sh
 */

import Database from "bun:sqlite";
import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import { createSignalThreadId, createSignalAccountId } from "../integrations/signal/ids";
import { getClaudePath } from "../../../../lib/paths";
import { getSyncStateManager } from "../daemon/sync-state";

// Sync state constants
const PLATFORM = "signal";
const SOURCE = "desktop";
const SCOPE = "_global";

/**
 * Default path for decrypted Signal Desktop database
 */
function getDefaultDecryptedDbPath(): string {
  return getClaudePath("messages/signal-desktop/decrypted.sqlite");
}

/**
 * Load the last import watermark (timestamp of latest imported message)
 */
export function loadSignalDesktopWatermark(): Date | null {
  try {
    const syncState = getSyncStateManager();
    const id = syncState.buildId(PLATFORM, SOURCE, SCOPE);
    const timestamp = syncState.getTimestamp(id);
    return timestamp ? new Date(timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Save the import watermark
 */
export function saveSignalDesktopWatermark(timestamp: Date): void {
  try {
    const syncState = getSyncStateManager();
    syncState.setTimestamp(PLATFORM, SOURCE, SCOPE, timestamp);
  } catch (err) {
    console.warn("[signal-desktop] Failed to save watermark:", err);
  }
}

/**
 * Clear the import watermark (for full re-import)
 */
export function clearSignalDesktopWatermark(): void {
  try {
    const syncState = getSyncStateManager();
    const id = syncState.buildId(PLATFORM, SOURCE, SCOPE);
    syncState.deleteWatermark(id);
  } catch {
    // Ignore errors
  }
}

/**
 * Options for Signal Desktop import
 */
export interface SignalDesktopImportOptions {
  /** Path to decrypted database.sqlite */
  databasePath?: string;
  /** Import only messages after this date */
  since?: Date;
  /** Import only messages before this date */
  until?: Date;
  /** Dry run - just count messages */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
  /** Skip watermark auto-resume (forces full import) */
  skipWatermark?: boolean;
}

/**
 * Stats from Signal Desktop import
 */
export interface SignalDesktopStats {
  messages: number;
  accounts: number;
  threads: number;
  skipped: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

/**
 * Check if Signal Desktop database is available
 */
export function isSignalDesktopAvailable(dbPath?: string): boolean {
  const path = dbPath || getDefaultDecryptedDbPath();
  try {
    const db = new Database(path, { readonly: true });
    const result = db.query("SELECT COUNT(*) as c FROM messages").get() as { c: number };
    db.close();
    return result.c > 0;
  } catch {
    return false;
  }
}

/**
 * Get Signal Desktop database info
 */
export function getSignalDesktopStatus(dbPath?: string): {
  available: boolean;
  path: string;
  messageCount?: number;
  conversationCount?: number;
  dateRange?: { earliest?: Date; latest?: Date };
} {
  const path = dbPath || getDefaultDecryptedDbPath();
  try {
    const db = new Database(path, { readonly: true });

    const msgCount = db.query("SELECT COUNT(*) as c FROM messages").get() as { c: number };
    const convCount = db.query("SELECT COUNT(*) as c FROM conversations").get() as { c: number };
    const dateResult = db.query(`
      SELECT MIN(sent_at) as min_ts, MAX(sent_at) as max_ts
      FROM messages WHERE sent_at > 0
    `).get() as { min_ts: number; max_ts: number };

    db.close();

    return {
      available: true,
      path,
      messageCount: msgCount.c,
      conversationCount: convCount.c,
      dateRange: {
        earliest: dateResult.min_ts ? new Date(dateResult.min_ts) : undefined,
        latest: dateResult.max_ts ? new Date(dateResult.max_ts) : undefined,
      },
    };
  } catch {
    return { available: false, path };
  }
}

/**
 * Count messages in Signal Desktop database (dry run)
 */
export function countSignalDesktopMessages(options: SignalDesktopImportOptions = {}): {
  totalMessages: number;
  readableMessages: number;
  conversations: number;
  dateRange: { earliest?: Date; latest?: Date };
} {
  const dbPath = options.databasePath || getDefaultDecryptedDbPath();
  const db = new Database(dbPath, { readonly: true });

  try {
    // Build date filter
    let dateFilter = "";
    const params: number[] = [];
    if (options.since) {
      dateFilter += " AND sent_at >= ?";
      params.push(options.since.getTime());
    }
    if (options.until) {
      dateFilter += " AND sent_at <= ?";
      params.push(options.until.getTime());
    }

    const totalResult = db.query("SELECT COUNT(*) as c FROM messages").get() as { c: number };
    const readableResult = db.query(`
      SELECT COUNT(*) as c FROM messages
      WHERE body IS NOT NULL AND body != '' ${dateFilter}
    `).get(...params) as { c: number };
    const convResult = db.query("SELECT COUNT(*) as c FROM conversations").get() as { c: number };
    const dateResult = db.query(`
      SELECT MIN(sent_at) as min_ts, MAX(sent_at) as max_ts
      FROM messages WHERE sent_at > 0 ${dateFilter}
    `).get(...params) as { min_ts: number; max_ts: number };

    return {
      totalMessages: totalResult.c,
      readableMessages: readableResult.c,
      conversations: convResult.c,
      dateRange: {
        earliest: dateResult.min_ts ? new Date(dateResult.min_ts) : undefined,
        latest: dateResult.max_ts ? new Date(dateResult.max_ts) : undefined,
      },
    };
  } finally {
    db.close();
  }
}

/**
 * Import messages from Signal Desktop
 */
export async function* importSignalDesktop(
  store: MessageStore,
  options: SignalDesktopImportOptions = {}
): AsyncGenerator<Message, SignalDesktopStats> {
  // Auto-resume from watermark if since not explicitly provided
  let effectiveSince = options.since;
  if (!effectiveSince && !options.skipWatermark) {
    const watermark = loadSignalDesktopWatermark();
    if (watermark) {
      console.log(`[signal-desktop] Resuming from watermark: ${watermark.toISOString()}`);
      effectiveSince = watermark;
    }
  }

  const stats: SignalDesktopStats = {
    messages: 0,
    accounts: 0,
    threads: 0,
    skipped: 0,
    dateRange: {},
  };

  const dbPath = options.databasePath || getDefaultDecryptedDbPath();
  const db = new Database(dbPath, { readonly: true });

  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  try {
    // Build conversation lookup: id -> { name, type, e164, serviceId, groupId }
    const conversations = new Map<string, {
      name: string;
      type: "private" | "group";
      e164?: string;
      serviceId?: string;
      groupId?: string;
    }>();

    const convRows = db.query(`
      SELECT id, name, type, e164, serviceId, groupId, profileName, profileFullName
      FROM conversations
    `).all() as Array<{
      id: string;
      name: string | null;
      type: string;
      e164: string | null;
      serviceId: string | null;
      groupId: string | null;
      profileName: string | null;
      profileFullName: string | null;
    }>;

    for (const c of convRows) {
      const displayName = c.name || c.profileFullName || c.profileName || c.e164 || `Conv ${c.id.slice(0, 8)}`;
      conversations.set(c.id, {
        name: displayName,
        type: c.type === "group" ? "group" : "private",
        e164: c.e164 || undefined,
        serviceId: c.serviceId || undefined,
        groupId: c.groupId || undefined,
      });
    }

    // Find our own account (the one with type=private and no name but has e164)
    // Signal Desktop stores the user's own conversation as "Note to Self"
    let myServiceId: string | undefined;
    let myPhone: string | undefined;

    // Try to find from env first
    myPhone = process.env.SIGNAL_PHONE;

    // If not in env, try to detect from conversations
    if (!myPhone) {
      for (const [, conv] of conversations) {
        if (conv.type === "private" && conv.e164 && conv.name === "Note to Self") {
          myPhone = conv.e164;
          myServiceId = conv.serviceId;
          break;
        }
      }
    }

    // Fallback: use first private conversation with our message type=outgoing
    if (!myPhone) {
      const firstOutgoing = db.query(`
        SELECT c.e164, c.serviceId
        FROM messages m
        JOIN conversations c ON m.conversationId = c.id
        WHERE m.type = 'outgoing' AND c.e164 IS NOT NULL
        LIMIT 1
      `).get() as { e164: string; serviceId: string } | null;

      if (firstOutgoing) {
        // Note: This gets the recipient of an outgoing message, not ourselves
        // We need a different approach - look at sourceServiceId of incoming messages
        const incomingSource = db.query(`
          SELECT sourceServiceId
          FROM messages
          WHERE type = 'outgoing' AND sourceServiceId IS NOT NULL
          LIMIT 1
        `).get() as { sourceServiceId: string } | null;

        if (incomingSource) {
          myServiceId = incomingSource.sourceServiceId;
        }
      }
    }

    const myAccountId = myPhone
      ? createSignalAccountId(myPhone)
      : myServiceId
      ? `signal_desktop_${myServiceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`
      : "signal_desktop_self";

    // Create self account
    await store.getOrCreateAccount({
      id: myAccountId,
      name: "Me (Signal)",
      identities: myPhone
        ? [{ platform: "signal", handle: myPhone }]
        : myServiceId
        ? [{ platform: "signal", handle: myServiceId }]
        : [],
    });
    seenAccounts.add(myAccountId);
    stats.accounts++;

    // Build date filter
    let dateFilter = "";
    const dateParams: number[] = [];
    if (effectiveSince) {
      dateFilter += " AND sent_at >= ?";
      dateParams.push(effectiveSince.getTime());
    }
    if (options.until) {
      dateFilter += " AND sent_at <= ?";
      dateParams.push(options.until.getTime());
    }

    // Count total for progress
    const countResult = db.query(`
      SELECT COUNT(*) as c FROM messages
      WHERE body IS NOT NULL AND body != '' ${dateFilter}
    `).get(...dateParams) as { c: number };
    const totalCount = countResult.c;

    // Query messages
    const messageQuery = db.query(`
      SELECT id, sent_at, received_at, type, body, conversationId, sourceServiceId, source
      FROM messages
      WHERE body IS NOT NULL AND body != '' ${dateFilter}
      ORDER BY sent_at ASC
    `);

    let processed = 0;
    for (const row of messageQuery.iterate(...dateParams) as Iterable<{
      id: string;
      sent_at: number;
      received_at: number | null;
      type: string;
      body: string;
      conversationId: string;
      sourceServiceId: string | null;
      source: string | null;
    }>) {
      processed++;

      // Progress callback
      if (options.onProgress && processed % 500 === 0) {
        options.onProgress(processed, totalCount);
      }

      // Skip empty messages
      if (!row.body?.trim()) {
        stats.skipped++;
        continue;
      }

      const msgDate = new Date(row.sent_at);

      // Track date range
      if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = msgDate;
      }
      if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
        stats.dateRange.latest = msgDate;
      }

      // Determine if outgoing
      const isOutgoing = row.type === "outgoing";

      // Get conversation info
      const conv = conversations.get(row.conversationId);
      const isGroup = conv?.type === "group";

      // Determine sender
      let senderAccountId: string;
      let senderName: string;
      let senderHandle: string;

      if (isOutgoing) {
        senderAccountId = myAccountId;
        senderName = "Me";
        senderHandle = myPhone || myServiceId || "self";
      } else {
        // Incoming message - sender is from sourceServiceId or source (phone)
        if (row.source) {
          senderAccountId = createSignalAccountId(row.source);
          senderHandle = row.source;
          // Try to find name from conversation if it's a DM
          senderName = (!isGroup && conv?.name) || row.source;
        } else if (row.sourceServiceId) {
          const cleanId = row.sourceServiceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
          senderAccountId = `signal_desktop_${cleanId}`;
          senderHandle = row.sourceServiceId;
          // For group messages, we don't have easy access to sender name
          senderName = `User ${cleanId.slice(0, 8)}`;
        } else {
          // Fallback
          senderAccountId = `signal_desktop_unknown_${row.conversationId.slice(0, 8)}`;
          senderHandle = "unknown";
          senderName = conv?.name || "Unknown";
        }
      }

      // Create sender account if not seen
      if (!seenAccounts.has(senderAccountId)) {
        await store.getOrCreateAccount({
          id: senderAccountId,
          name: senderName,
          identities: [{ platform: "signal", handle: senderHandle }],
        });
        seenAccounts.add(senderAccountId);
        stats.accounts++;
      }

      // Create thread ID
      // For DMs, use the phone number if available; for groups, use groupId
      let threadId: string;
      if (isGroup && conv?.groupId) {
        threadId = createSignalThreadId(conv.groupId, true);
      } else if (conv?.e164) {
        threadId = createSignalThreadId(conv.e164, false);
      } else {
        // Fallback to conversation ID
        threadId = `signal_desktop_${row.conversationId.replace(/-/g, "").slice(0, 16)}`;
      }

      // Create thread if not seen
      if (!seenThreads.has(threadId)) {
        await store.getOrCreateThread({
          id: threadId,
          title: conv?.name || `Thread ${row.conversationId.slice(0, 8)}`,
          type: isGroup ? "group" : "dm",
          participants: [myAccountId],
          source: {
            platform: "signal",
            platform_id: row.conversationId,
          },
        });
        seenThreads.add(threadId);
        stats.threads++;
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.Signal,
        content: row.body,
        account_id: senderAccountId,
        author: {
          name: senderName,
          handle: senderHandle,
        },
        created_at: row.sent_at,
        refs: {
          thread_id: threadId,
        },
        source: {
          platform: "signal",
          platform_id: `desktop_${row.id}`,
        },
        tags: isOutgoing
          ? [["direction", "outgoing"], ["source", "desktop"]]
          : [["direction", "incoming"], ["source", "desktop"]],
      };

      // Create message (skip thread updates for bulk import)
      const message = await store.createMessage(input, { skipThreadUpdate: true });
      stats.messages++;

      yield message;
    }

    // Rebuild thread views
    await store.rebuildThreadViews();

    // Final progress callback
    if (options.onProgress) {
      options.onProgress(totalCount, totalCount);
    }

    // Save watermark for next incremental import
    if (stats.dateRange.latest && !options.skipWatermark) {
      saveSignalDesktopWatermark(stats.dateRange.latest);
      console.log(`[signal-desktop] Saved watermark: ${stats.dateRange.latest.toISOString()}`);
    }

    return stats;
  } finally {
    db.close();
  }
}
