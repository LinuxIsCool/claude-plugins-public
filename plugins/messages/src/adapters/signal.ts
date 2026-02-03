/**
 * Signal Adapter
 *
 * Imports messages from Signal via signal-cli.
 * Uses command-line mode for message sync (not daemon mode).
 *
 * Prerequisites:
 * 1. signal-cli linked to account
 * 2. SIGNAL_PHONE environment variable set
 * 3. SIGNAL_CLI_PATH (optional) - path to Java signal-cli
 */

import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import { getSearchDbPath } from "../config";
import {
  SignalClient,
  isDaemonRunning,
  getSignalStatus,
} from "../integrations/signal/client";
import type {
  SignalConversation,
  SignalEnvelope,
  SignalImportOptions,
  SignalImportStats,
  SignalDataMessage,
  SignalSyncMessage,
} from "../integrations/signal/types";
import {
  createSignalThreadId,
  createSignalAccountId,
  hexToBase64,
  makeBase64Safe,
  isLegacyNumericGroupId,
  extractRecipientIdFromThreadId,
} from "../integrations/signal/ids";
import { spawn } from "child_process";
import Database from "bun:sqlite";

/**
 * Default TCP port for signal-cli daemon
 */
const DEFAULT_TCP_PORT = 7583;
const DEFAULT_TCP_HOST = "localhost";

/**
 * Get signal-cli path (prefer Java version for reliability)
 */
function getSignalCliPath(): string {
  return process.env.SIGNAL_CLI_PATH ||
    "/home/user/Workspace/claude-plugins/signal-cli-0.13.22/bin/signal-cli";
}

/**
 * Run signal-cli receive command (CLI mode, not daemon)
 * Returns parsed JSON output
 */
async function receiveViaCli(
  phone: string,
  timeout = 10
): Promise<SignalEnvelope[]> {
  return new Promise((resolve, reject) => {
    const cliPath = getSignalCliPath();
    const args = ["-a", phone, "--output=json", "receive", "-t", String(timeout)];

    const proc = spawn(cliPath, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        // Exit code 0 with empty stdout is normal (no new messages)
        if (code === 0) {
          resolve([]);
          return;
        }
        reject(new Error(`signal-cli receive failed: ${stderr}`));
        return;
      }

      const envelopes: SignalEnvelope[] = [];

      // signal-cli receive outputs one JSON object per line (not an array)
      const lines = stdout.trim().split("\n").filter(Boolean);

      for (const line of lines) {
        // Skip INFO/WARN/DEBUG lines from signal-cli
        if (line.startsWith("INFO") || line.startsWith("WARN") || line.startsWith("DEBUG")) {
          continue;
        }

        try {
          const parsed = JSON.parse(line);
          if (parsed.envelope) {
            envelopes.push(parsed.envelope);
          }
        } catch {
          // Skip non-JSON lines
        }
      }

      resolve(envelopes);
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn signal-cli: ${err.message}`));
    });
  });
}

/**
 * Run signal-cli listContacts command (CLI mode)
 */
async function listContactsViaCli(phone: string): Promise<SignalConversation[]> {
  return new Promise((resolve, reject) => {
    const cliPath = getSignalCliPath();
    const args = ["-a", phone, "--output=json", "listContacts"];

    const proc = spawn(cliPath, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`signal-cli listContacts failed: ${stderr}`));
        return;
      }

      const conversations: SignalConversation[] = [];

      try {
        // signal-cli outputs JSON array on a single line
        const contacts = JSON.parse(stdout.trim());
        if (Array.isArray(contacts)) {
          for (const contact of contacts) {
            if (contact.number) {
              // Get display name from contact name, profile, or fall back to number
              const displayName = contact.name ||
                (contact.profile?.givenName && contact.profile?.familyName
                  ? `${contact.profile.givenName} ${contact.profile.familyName}`
                  : contact.profile?.givenName) ||
                contact.number;
              conversations.push({
                id: contact.number,
                name: displayName,
                type: "dm",
                raw: contact,
              });
            }
          }
        }
      } catch {
        // Try line-by-line as fallback
        const lines = stdout.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const contact = JSON.parse(line);
            if (contact.number) {
              conversations.push({
                id: contact.number,
                name: contact.name || contact.number,
                type: "dm",
                raw: contact,
              });
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      resolve(conversations);
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn signal-cli: ${err.message}`));
    });
  });
}

/**
 * Run signal-cli listGroups command (CLI mode)
 */
async function listGroupsViaCli(phone: string): Promise<SignalConversation[]> {
  return new Promise((resolve, reject) => {
    const cliPath = getSignalCliPath();
    const args = ["-a", phone, "--output=json", "listGroups"];

    const proc = spawn(cliPath, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`signal-cli listGroups failed: ${stderr}`));
        return;
      }

      const conversations: SignalConversation[] = [];

      try {
        // signal-cli outputs JSON array on a single line
        const groups = JSON.parse(stdout.trim());
        if (Array.isArray(groups)) {
          for (const group of groups) {
            if (group.id) {
              conversations.push({
                id: group.id,
                name: group.name || "Unknown Group",
                type: "group",
                raw: group,
              });
            }
          }
        }
      } catch {
        // Try line-by-line as fallback
        const lines = stdout.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const group = JSON.parse(line);
            if (group.id) {
              conversations.push({
                id: group.id,
                name: group.name || "Unknown Group",
                type: "group",
                raw: group,
              });
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      resolve(conversations);
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn signal-cli: ${err.message}`));
    });
  });
}

/**
 * Check if Signal import is available
 */
export function isSignalAvailable(): boolean {
  const status = getSignalStatus();
  return status.configured && status.signalCliBinaryExists;
}

/**
 * Check if Signal daemon is running
 */
export async function isSignalDaemonRunning(
  host = DEFAULT_TCP_HOST,
  port = DEFAULT_TCP_PORT
): Promise<boolean> {
  return isDaemonRunning(host, port);
}

/**
 * Get Signal configuration and daemon status
 */
export async function getSignalConnectionStatus(): Promise<{
  configured: boolean;
  phone?: string;
  daemonRunning: boolean;
  binaryExists: boolean;
}> {
  const status = getSignalStatus();
  const daemonRunning = await isDaemonRunning();

  return {
    configured: status.configured,
    phone: status.phone,
    daemonRunning,
    binaryExists: status.signalCliBinaryExists,
  };
}

/**
 * Create account ID from phone number
 */
function createAccountId(phone: string): string {
  // Normalize phone number: remove spaces, dashes
  const normalized = phone.replace(/[\s-]/g, "");
  return `signal_${normalized.replace("+", "")}`;
}

/**
 * Create thread ID for conversation
 * Uses centralized ID generation from ids.ts
 */
function createThreadId(conversationId: string, isGroup: boolean): string {
  return createSignalThreadId(conversationId, isGroup);
}

/**
 * Create message ID from timestamp
 */
function createMessageId(timestamp: number, sender: string): string {
  return `signal_${timestamp}_${sender.replace(/[+\s-]/g, "")}`;
}

/**
 * Extract messages from envelope
 */
function extractMessagesFromEnvelope(
  envelope: SignalEnvelope,
  myPhoneNumber: string
): Array<{
  text: string;
  timestamp: number;
  sender: string;
  isOutgoing: boolean;
  isGroup: boolean;
  groupId?: string;
  recipient?: string;
  replyToTimestamp?: number;
}> {
  const messages: Array<{
    text: string;
    timestamp: number;
    sender: string;
    isOutgoing: boolean;
    isGroup: boolean;
    groupId?: string;
    recipient?: string;
    replyToTimestamp?: number;
  }> = [];

  // Regular incoming message
  if (envelope.dataMessage?.message) {
    const dm = envelope.dataMessage;
    messages.push({
      text: dm.message!, // Checked above
      timestamp: dm.timestamp || envelope.timestamp || Date.now(),
      sender: envelope.source || "",
      isOutgoing: false,
      isGroup: !!dm.groupInfo,
      groupId: dm.groupInfo?.groupId,
      replyToTimestamp: dm.quote?.id,
    });
  }

  // Sync message (sent from another device)
  if (envelope.syncMessage?.sentMessage?.message) {
    const sm = envelope.syncMessage.sentMessage;
    messages.push({
      text: sm.message!, // Checked above
      timestamp: sm.timestamp || Date.now(),
      sender: myPhoneNumber,
      isOutgoing: true,
      isGroup: !!sm.groupInfo,
      groupId: sm.groupInfo?.groupId,
      recipient: sm.destination,
    });
  }

  return messages;
}

/**
 * Count estimated messages (dry run) - Uses CLI mode
 */
export async function countSignalMessages(
  options: SignalImportOptions = {}
): Promise<{
  conversations: number;
  estimatedMessages: number;
  conversationDetails: Array<{ id: string; name: string; type: string }>;
}> {
  const phone = process.env.SIGNAL_PHONE;
  if (!phone) {
    throw new Error("SIGNAL_PHONE environment variable not set");
  }

  // Get contacts and groups via CLI
  const [contacts, groups] = await Promise.all([
    listContactsViaCli(phone),
    listGroupsViaCli(phone),
  ]);

  const conversations = [...contacts, ...groups];

  // Filter conversations based on options
  let filtered = conversations;
  if (options.contacts?.length) {
    filtered = filtered.filter(
      (c) => c.type === "dm" && options.contacts!.includes(c.id)
    );
  }
  if (options.groups?.length) {
    filtered = filtered.filter(
      (c) => c.type === "group" && options.groups!.includes(c.id)
    );
  }

  // We can't easily count messages without receiving them,
  // so return conversation count as estimate
  return {
    conversations: filtered.length,
    estimatedMessages: filtered.length * 50, // Rough estimate
    conversationDetails: filtered.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
  };
}

/**
 * Import messages from Signal using CLI mode
 *
 * Note: signal-cli's receive command returns messages from the server queue,
 * not historical messages. This means we can only get:
 * 1. New incoming messages since last sync
 * 2. Messages sent from other devices (via sync)
 *
 * For historical messages, you would need to export from Signal app.
 */
export async function* importSignal(
  store: MessageStore,
  options: SignalImportOptions = {}
): AsyncGenerator<Message, SignalImportStats> {
  const stats: SignalImportStats = {
    messages: 0,
    accounts: 0,
    threads: 0,
    skipped: 0,
    dateRange: {},
  };

  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  const myPhone = process.env.SIGNAL_PHONE;
  if (!myPhone) {
    throw new Error("SIGNAL_PHONE environment variable not set");
  }

  const myAccountId = createAccountId(myPhone);

  // Create self account
  await store.getOrCreateAccount({
    id: myAccountId,
    name: "Me (Signal)",
    identities: [{ platform: "signal", handle: myPhone }],
  });
  seenAccounts.add(myAccountId);
  stats.accounts++;

  // Get conversations for context via CLI
  const [contacts, groups] = await Promise.all([
    listContactsViaCli(myPhone),
    listGroupsViaCli(myPhone),
  ]);
  const conversations = [...contacts, ...groups];

  // Filter based on options
  const filteredConversations = conversations.filter((c) => {
    if (options.contacts?.length && c.type === "dm") {
      return options.contacts.includes(c.id);
    }
    if (options.groups?.length && c.type === "group") {
      return options.groups.includes(c.id);
    }
    // If no filters, include all
    return !options.contacts?.length && !options.groups?.length;
  });

  // Create threads for each conversation
  for (const conv of filteredConversations) {
    const threadId = createThreadId(conv.id, conv.type === "group");

    if (!seenThreads.has(threadId)) {
      await store.getOrCreateThread({
        id: threadId,
        title: conv.name,
        type: conv.type === "group" ? "group" : "dm",
        participants: [myAccountId],
        source: {
          platform: "signal",
          platform_id: conv.id,
        },
      });
      seenThreads.add(threadId);
      stats.threads++;
    }
  }

  // Receive messages via CLI (not daemon)
  const receiveTimeout = options.realtimeTimeout
    ? Math.ceil(options.realtimeTimeout / 1000)
    : 10;

  const envelopes = await receiveViaCli(myPhone, receiveTimeout);

  for (const envelope of envelopes) {
    const extractedMessages = extractMessagesFromEnvelope(envelope, myPhone);

    for (const msg of extractedMessages) {
      // Skip empty messages
      if (!msg.text.trim()) {
        stats.skipped++;
        continue;
      }

      // Date filtering
      const msgDate = new Date(msg.timestamp);
      if (options.since && msgDate < options.since) {
        stats.skipped++;
        continue;
      }
      if (options.until && msgDate > options.until) {
        stats.skipped++;
        continue;
      }

      // Track date range
      if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = msgDate;
      }
      if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
        stats.dateRange.latest = msgDate;
      }

      // Get or create sender account
      const senderAccountId = createAccountId(msg.sender);
      if (!seenAccounts.has(senderAccountId)) {
        // Try to find contact name
        const contact = conversations.find(
          (c) => c.type === "dm" && c.id === msg.sender
        );

        await store.getOrCreateAccount({
          id: senderAccountId,
          name: contact?.name || msg.sender,
          identities: [{ platform: "signal", handle: msg.sender }],
        });
        seenAccounts.add(senderAccountId);
        stats.accounts++;
      }

      // Determine thread
      const conversationId = msg.isGroup
        ? msg.groupId!
        : msg.isOutgoing
        ? msg.recipient!
        : msg.sender;
      const threadId = createThreadId(conversationId, msg.isGroup);

      // Ensure thread exists
      if (!seenThreads.has(threadId)) {
        const conv = conversations.find((c) => c.id === conversationId);
        await store.getOrCreateThread({
          id: threadId,
          title: conv?.name || conversationId,
          type: msg.isGroup ? "group" : "dm",
          participants: [myAccountId],
          source: {
            platform: "signal",
            platform_id: conversationId,
          },
        });
        seenThreads.add(threadId);
        stats.threads++;
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.Signal,
        content: msg.text,
        account_id: senderAccountId,
        author: {
          name: msg.sender,
          handle: msg.sender,
        },
        created_at: msg.timestamp,
        refs: {
          thread_id: threadId,
          reply_to: msg.replyToTimestamp
            ? createMessageId(msg.replyToTimestamp, "unknown")
            : undefined,
        },
        source: {
          platform: "signal",
          platform_id: createMessageId(msg.timestamp, msg.sender),
        },
        tags: msg.isOutgoing ? [["direction", "outgoing"]] : [["direction", "incoming"]],
      };

      // Create message
      const message = await store.createMessage(input);
      stats.messages++;

      yield message;
    }
  }

  // If realtime mode, continue polling
  if (options.realtime) {
    const timeout = options.realtimeTimeout || 60000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const newEnvelopes = await receiveViaCli(myPhone, 5);

      for (const envelope of newEnvelopes) {
        const extractedMessages = extractMessagesFromEnvelope(envelope, myPhone);

        for (const msg of extractedMessages) {
          if (!msg.text.trim()) {
            stats.skipped++;
            continue;
          }

          const msgDate = new Date(msg.timestamp);

          // Track date range
          if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
            stats.dateRange.earliest = msgDate;
          }
          if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
            stats.dateRange.latest = msgDate;
          }

          const senderAccountId = createAccountId(msg.sender);
          if (!seenAccounts.has(senderAccountId)) {
            const contact = conversations.find(
              (c) => c.type === "dm" && c.id === msg.sender
            );

            await store.getOrCreateAccount({
              id: senderAccountId,
              name: contact?.name || msg.sender,
              identities: [{ platform: "signal", handle: msg.sender }],
            });
            seenAccounts.add(senderAccountId);
            stats.accounts++;
          }

          const conversationId = msg.isGroup
            ? msg.groupId!
            : msg.isOutgoing
            ? msg.recipient!
            : msg.sender;
          const threadId = createThreadId(conversationId, msg.isGroup);

          if (!seenThreads.has(threadId)) {
            const conv = conversations.find((c) => c.id === conversationId);
            await store.getOrCreateThread({
              id: threadId,
              title: conv?.name || conversationId,
              type: msg.isGroup ? "group" : "dm",
              participants: [myAccountId],
              source: {
                platform: "signal",
                platform_id: conversationId,
              },
            });
            seenThreads.add(threadId);
            stats.threads++;
          }

          const input: MessageInput = {
            kind: Kind.Signal,
            content: msg.text,
            account_id: senderAccountId,
            author: {
              name: msg.sender,
              handle: msg.sender,
            },
            created_at: msg.timestamp,
            refs: {
              thread_id: threadId,
            },
            source: {
              platform: "signal",
              platform_id: createMessageId(msg.timestamp, msg.sender),
            },
            tags: msg.isOutgoing
              ? [["direction", "outgoing"]]
              : [["direction", "incoming"]],
          };

          const message = await store.createMessage(input);
          stats.messages++;

          yield message;
        }
      }
    }
  }

  return stats;
}

/**
 * List Signal conversations (for UI selection) - Uses CLI mode
 */
export async function listSignalConversations(): Promise<SignalConversation[]> {
  const phone = process.env.SIGNAL_PHONE;
  if (!phone) {
    throw new Error("SIGNAL_PHONE environment variable not set");
  }

  const [contacts, groups] = await Promise.all([
    listContactsViaCli(phone),
    listGroupsViaCli(phone),
  ]);

  return [...contacts, ...groups];
}

/**
 * Options for importing Signal Android backup
 */
export interface SignalBackupImportOptions {
  /** Path to decrypted database.sqlite */
  databasePath: string;
  /** Path to attachments directory (optional) */
  attachmentsPath?: string;
  /** Import only messages after this date */
  since?: Date;
  /** Import only messages before this date */
  until?: Date;
  /** Dry run - just count messages */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Stats from Signal backup import
 */
export interface SignalBackupStats {
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
 * Count messages in Signal backup (dry run)
 */
export async function countSignalBackupMessages(
  options: SignalBackupImportOptions
): Promise<{
  totalMessages: number;
  readableMessages: number;
  threads: number;
  recipients: number;
  dateRange: { earliest?: Date; latest?: Date };
}> {
  const db = new Database(options.databasePath, { readonly: true });

  try {
    // Count total messages
    const totalResult = db.query("SELECT COUNT(*) as count FROM message").get() as { count: number };

    // Count messages with readable body
    const readableResult = db.query(`
      SELECT COUNT(*) as count FROM message
      WHERE body IS NOT NULL AND body != '' AND body NOT LIKE 'Ci%'
    `).get() as { count: number };

    // Count threads
    const threadResult = db.query("SELECT COUNT(*) as count FROM thread").get() as { count: number };

    // Count recipients
    const recipientResult = db.query("SELECT COUNT(*) as count FROM recipient").get() as { count: number };

    // Get date range
    const dateResult = db.query(`
      SELECT MIN(date_sent) as min_ts, MAX(date_sent) as max_ts
      FROM message WHERE date_sent > 0
    `).get() as { min_ts: number; max_ts: number };

    return {
      totalMessages: totalResult.count,
      readableMessages: readableResult.count,
      threads: threadResult.count,
      recipients: recipientResult.count,
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
 * Import messages from decrypted Signal Android backup
 *
 * Requires:
 * 1. Decrypt backup using signal_for_android_decryption or similar tool
 * 2. Pass path to decrypted database.sqlite
 *
 * See: https://github.com/mossblaser/signal_for_android_decryption
 */
export async function* importSignalBackup(
  store: MessageStore,
  options: SignalBackupImportOptions
): AsyncGenerator<Message, SignalBackupStats> {
  const stats: SignalBackupStats = {
    messages: 0,
    accounts: 0,
    threads: 0,
    skipped: 0,
    dateRange: {},
  };

  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  const db = new Database(options.databasePath, { readonly: true });

  try {
    // Build recipient lookup (id -> info) with better identification
    // Priority: phone > profile name > system name > aci > recipient_id
    const recipients = new Map<number, {
      name: string;
      phone?: string;
      groupId?: string;
      aci?: string;
      isSelf?: boolean;
    }>();

    const recipientRows = db.query(`
      SELECT _id, type, system_joined_name, e164, group_id, aci,
             profile_given_name, profile_family_name, profile_joined_name
      FROM recipient
    `).all() as Array<{
      _id: number;
      type: number;
      system_joined_name: string | null;
      e164: string | null;
      group_id: string | null;
      aci: string | null;
      profile_given_name: string | null;
      profile_family_name: string | null;
      profile_joined_name: string | null;
    }>;

    // First pass: find self recipient and build lookup
    let selfRecipientId: number | null = null;
    let selfPhone: string | null = null;

    for (const r of recipientRows) {
      // Detect self: type=0 typically means self, or check for local user pattern
      const isSelf = r.type === 0 || r._id === 1 || r._id === 2;

      // Build display name - prefer contact name, then profile, then phone
      const name = r.system_joined_name ||
        r.profile_joined_name ||
        (r.profile_given_name && r.profile_family_name
          ? `${r.profile_given_name} ${r.profile_family_name}`.trim()
          : r.profile_given_name) ||
        r.e164 ||
        (r.aci ? `User ${r.aci.slice(0, 8)}` : `Recipient ${r._id}`);

      recipients.set(r._id, {
        name: name.trim(),
        phone: r.e164 || undefined,
        groupId: r.group_id || undefined,
        aci: r.aci || undefined,
        isSelf,
      });

      // Track self for later
      if (isSelf && r.e164) {
        selfRecipientId = r._id;
        selfPhone = r.e164;
      }
    }

    // Build thread lookup (id -> info)
    // Join with groups table to get actual group names
    const threads = new Map<number, { title: string; isGroup: boolean; recipientId: number; groupId: string | null }>();
    const threadRows = db.query(`
      SELECT t._id, t.recipient_id, r.system_joined_name, r.e164, r.group_id,
             r.profile_given_name, r.profile_family_name, r.profile_joined_name,
             g.title as group_title
      FROM thread t
      LEFT JOIN recipient r ON t.recipient_id = r._id
      LEFT JOIN groups g ON r.group_id = g.group_id
    `).all() as Array<{
      _id: number;
      recipient_id: number;
      system_joined_name: string | null;
      e164: string | null;
      group_id: string | null;
      profile_given_name: string | null;
      profile_family_name: string | null;
      profile_joined_name: string | null;
      group_title: string | null;
    }>;

    for (const t of threadRows) {
      const isGroup = !!t.group_id;
      // For groups, prioritize the group title from the groups table
      const title = isGroup
        ? (t.group_title || t.system_joined_name || "Unknown Group")
        : (t.system_joined_name ||
           t.profile_joined_name ||
           (t.profile_given_name && t.profile_family_name
             ? `${t.profile_given_name} ${t.profile_family_name}`.trim()
             : t.profile_given_name) ||
           t.e164 ||
           `Thread ${t._id}`);
      threads.set(t._id, {
        title,
        isGroup,
        recipientId: t.recipient_id,
        groupId: t.group_id,
      });
    }

    // Determine user's phone: prefer backup data, then env, error if neither
    const myPhone = selfPhone || process.env.SIGNAL_PHONE;
    if (!myPhone) {
      throw new Error(
        "Could not determine your Signal phone number. " +
        "Set SIGNAL_PHONE environment variable (e.g., +12505551234)"
      );
    }
    const myAccountId = createAccountId(myPhone);

    // Create self account
    await store.getOrCreateAccount({
      id: myAccountId,
      name: "Me (Signal)",
      identities: [{ platform: "signal", handle: myPhone }],
    });
    seenAccounts.add(myAccountId);
    stats.accounts++;

    // Build date filter clause
    let dateFilter = "";
    const dateParams: number[] = [];
    if (options.since) {
      dateFilter += " AND date_sent >= ?";
      dateParams.push(options.since.getTime());
    }
    if (options.until) {
      dateFilter += " AND date_sent <= ?";
      dateParams.push(options.until.getTime());
    }

    // Count total for progress
    const countResult = db.query(`
      SELECT COUNT(*) as count FROM message
      WHERE body IS NOT NULL AND body != '' AND body NOT LIKE 'Ci%' ${dateFilter}
    `).get(...dateParams) as { count: number };
    const totalCount = countResult.count;

    // Query messages with readable body
    const messageQuery = db.query(`
      SELECT m._id, m.date_sent, m.thread_id, m.from_recipient_id, m.body, m.type,
             m.quote_id, m.quote_body
      FROM message m
      WHERE m.body IS NOT NULL AND m.body != '' AND m.body NOT LIKE 'Ci%' ${dateFilter}
      ORDER BY m.date_sent ASC
    `);

    let processed = 0;
    for (const row of messageQuery.iterate(...dateParams) as Iterable<{
      _id: number;
      date_sent: number;
      thread_id: number;
      from_recipient_id: number;
      body: string;
      type: number;
      quote_id: number | null;
      quote_body: string | null;
    }>) {
      processed++;

      // Progress callback
      if (options.onProgress && processed % 100 === 0) {
        options.onProgress(processed, totalCount);
      }

      // Skip if no content
      if (!row.body?.trim()) {
        stats.skipped++;
        continue;
      }

      const msgDate = new Date(row.date_sent);

      // Track date range
      if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = msgDate;
      }
      if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
        stats.dateRange.latest = msgDate;
      }

      // Determine if outgoing by checking from_recipient_id
      // If the message is FROM self, it's outgoing. This is more reliable than type bit patterns.
      // Self recipient is typically _id=2 with your phone number
      const isFromSelf = row.from_recipient_id === selfRecipientId;
      const isOutgoing = isFromSelf;

      // Get sender info - use phone, aci, or name-based ID
      const sender = recipients.get(row.from_recipient_id);
      let senderAccountId: string;
      let senderHandle: string;

      if (isOutgoing) {
        // Outgoing messages use our account
        senderAccountId = myAccountId;
        senderHandle = myPhone;
      } else if (sender?.phone) {
        // Prefer phone number for stable ID
        senderAccountId = createAccountId(sender.phone);
        senderHandle = sender.phone;
      } else if (sender?.aci) {
        // Use ACI (UUID) for recipients without phone
        senderAccountId = `signal_aci_${sender.aci.replace(/-/g, "").slice(0, 16)}`;
        senderHandle = sender.aci;
      } else {
        // Fall back to recipient ID with name in ID for traceability
        const safeName = (sender?.name || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
        senderAccountId = `signal_${safeName}_${row.from_recipient_id}`;
        senderHandle = `recipient_${row.from_recipient_id}`;
      }

      // Create sender account if not seen
      if (!seenAccounts.has(senderAccountId)) {
        await store.getOrCreateAccount({
          id: senderAccountId,
          name: sender?.name || senderHandle,
          identities: [{ platform: "signal", handle: senderHandle }],
        });
        seenAccounts.add(senderAccountId);
        stats.accounts++;
      }

      // Get thread info - use recipient's phone for DM thread ID (not sender)
      const thread = threads.get(row.thread_id);
      const threadRecipient = thread ? recipients.get(thread.recipientId) : null;
      const threadPhone = threadRecipient?.phone || (thread ? `unknown_${thread.recipientId}` : `thread_${row.thread_id}`);
      // Use canonical base64 group ID for groups (matches live sync format)
      const threadId = thread?.isGroup && thread.groupId
        ? createThreadId(hexToBase64(thread.groupId), true)
        : createThreadId(threadPhone, false);

      // Create thread if not seen
      if (!seenThreads.has(threadId)) {
        await store.getOrCreateThread({
          id: threadId,
          title: thread?.title || `Thread ${row.thread_id}`,
          type: thread?.isGroup ? "group" : "dm",
          participants: [myAccountId],
          source: {
            platform: "signal",
            platform_id: `backup_thread_${row.thread_id}`,
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
          name: isOutgoing ? "Me" : (sender?.name || senderHandle),
          handle: senderHandle,
        },
        created_at: row.date_sent,
        refs: {
          thread_id: threadId,
          reply_to: row.quote_id ? `signal_backup_${row.quote_id}` : undefined,
        },
        source: {
          platform: "signal",
          platform_id: `backup_${row._id}`,
        },
        tags: isOutgoing
          ? [["direction", "outgoing"], ["source", "backup"]]
          : [["direction", "incoming"], ["source", "backup"]],
      };

      // Create message (skip thread updates for bulk import - rebuild at end)
      const message = await store.createMessage(input, { skipThreadUpdate: true });
      stats.messages++;

      yield message;
    }

    // Rebuild thread views with accurate counts
    await store.rebuildThreadViews();

    // Final progress callback
    if (options.onProgress) {
      options.onProgress(totalCount, totalCount);
    }

    return stats;
  } finally {
    db.close();
  }
}

/**
 * Repair Signal account resolution in existing data
 *
 * Fixes messages that were imported with incorrect account_id
 * (e.g., signal_unknown when SIGNAL_PHONE wasn't set)
 */
export interface SignalRepairOptions {
  /** Path to decrypted database.sqlite */
  databasePath: string;
  /** Path to search index database */
  searchDbPath?: string;
  /** Your Signal phone number (auto-detected from backup if not provided) */
  myPhone?: string;
  /** Dry run - just report what would change */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

export interface SignalRepairStats {
  messagesScanned: number;
  messagesUpdated: number;
  accountsMapped: number;
  errors: number;
}

export async function repairSignalAccounts(
  options: SignalRepairOptions
): Promise<SignalRepairStats> {
  const stats: SignalRepairStats = {
    messagesScanned: 0,
    messagesUpdated: 0,
    accountsMapped: 0,
    errors: 0,
  };

  const backupDb = new Database(options.databasePath, { readonly: true });
  const searchDbPath = options.searchDbPath || getSearchDbPath();
  const searchDb = new Database(searchDbPath);

  try {
    // Build recipient lookup from backup
    const recipients = new Map<number, {
      name: string;
      phone?: string;
      aci?: string;
    }>();

    const recipientRows = backupDb.query(`
      SELECT _id, type, system_joined_name, e164, aci,
             profile_given_name, profile_family_name, profile_joined_name
      FROM recipient
    `).all() as Array<{
      _id: number;
      type: number;
      system_joined_name: string | null;
      e164: string | null;
      aci: string | null;
      profile_given_name: string | null;
      profile_family_name: string | null;
      profile_joined_name: string | null;
    }>;

    let selfPhone: string | null = null;
    let selfRecipientId: number | null = null;

    for (const r of recipientRows) {
      // Self recipient: type=0 with a phone number, or _id=1 or 2
      const isSelf = (r.type === 0 && r.e164) || r._id === 1 || r._id === 2;
      const name = r.system_joined_name ||
        r.profile_joined_name ||
        (r.profile_given_name && r.profile_family_name
          ? `${r.profile_given_name} ${r.profile_family_name}`.trim()
          : r.profile_given_name) ||
        r.e164 ||
        (r.aci ? `User ${r.aci.slice(0, 8)}` : `Recipient ${r._id}`);

      recipients.set(r._id, {
        name: name.trim(),
        phone: r.e164 || undefined,
        aci: r.aci || undefined,
      });

      // Track self recipient - prefer the one with a phone number
      if (isSelf && r.e164 && !selfRecipientId) {
        selfPhone = r.e164;
        selfRecipientId = r._id;
      }
    }

    // Determine user's phone
    const myPhone = options.myPhone || selfPhone;
    if (!myPhone || !selfRecipientId) {
      throw new Error(
        "Could not determine your Signal phone number. " +
        "Provide myPhone option or set SIGNAL_PHONE environment variable"
      );
    }
    const myAccountId = createAccountId(myPhone);

    console.log(`Self recipient ID: ${selfRecipientId}, phone: ${myPhone}`);

    // Build message_id -> backup row mapping
    // Messages have source.platform_id = "backup_{row_id}"
    const backupMessages = new Map<string, {
      fromRecipientId: number;
    }>();

    const messageRows = backupDb.query(`
      SELECT _id, from_recipient_id
      FROM message
      WHERE body IS NOT NULL AND body != '' AND body NOT LIKE 'Ci%'
    `).all() as Array<{
      _id: number;
      from_recipient_id: number;
    }>;

    for (const m of messageRows) {
      backupMessages.set(`backup_${m._id}`, {
        fromRecipientId: m.from_recipient_id,
      });
    }

    console.log(`Loaded ${recipients.size} recipients and ${backupMessages.size} messages from backup`);
    console.log(`Self phone: ${myPhone} -> account: ${myAccountId}`);

    // Query all Signal messages from search index
    const searchMessages = searchDb.query(`
      SELECT id, account_id, data FROM messages_meta
      WHERE platform = 'signal'
    `).all() as Array<{ id: string; account_id: string; data: string }>;

    console.log(`Found ${searchMessages.length} Signal messages in search index`);

    // Prepare update statement
    const updateStmt = searchDb.prepare(`
      UPDATE messages_meta SET account_id = ?, data = ?
      WHERE id = ?
    `);

    const updateFts = searchDb.prepare(`
      UPDATE messages_fts SET author_name = ?
      WHERE id = ?
    `);

    // Process each message
    const updates: Array<{ id: string; newAccountId: string; newData: string; newAuthor: string }> = [];

    for (const msg of searchMessages) {
      stats.messagesScanned++;

      // Parse message data
      const msgData = JSON.parse(msg.data);
      const platformId = msgData.source?.platform_id;

      if (!platformId || !backupMessages.has(platformId)) {
        continue;
      }

      const backupInfo = backupMessages.get(platformId)!;
      const recipient = recipients.get(backupInfo.fromRecipientId);

      // Calculate correct account_id based on from_recipient_id
      // If from_recipient_id matches self, it's an outgoing message (we sent it)
      // Otherwise, from_recipient_id is the actual sender
      let correctAccountId: string;
      let correctHandle: string;
      let correctName: string;

      const isFromSelf = backupInfo.fromRecipientId === selfRecipientId;

      if (isFromSelf) {
        correctAccountId = myAccountId;
        correctHandle = myPhone;
        correctName = "Me";
      } else if (recipient?.phone) {
        correctAccountId = createAccountId(recipient.phone);
        correctHandle = recipient.phone;
        correctName = recipient.name;
      } else if (recipient?.aci) {
        correctAccountId = `signal_aci_${recipient.aci.replace(/-/g, "").slice(0, 16)}`;
        correctHandle = recipient.aci;
        correctName = recipient.name;
      } else {
        const safeName = (recipient?.name || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
        correctAccountId = `signal_${safeName}_${backupInfo.fromRecipientId}`;
        correctHandle = `recipient_${backupInfo.fromRecipientId}`;
        correctName = recipient?.name || "Unknown";
      }

      // Determine correct direction based on whether message is from self
      const correctDirection = isFromSelf ? "outgoing" : "incoming";

      // Check if update needed (account_id mismatch OR direction mismatch)
      const currentTags = msgData.tags as Array<[string, string]> || [];
      const currentDirection = currentTags.find(t => t[0] === "direction")?.[1];
      const needsUpdate = msg.account_id !== correctAccountId || currentDirection !== correctDirection;

      if (needsUpdate) {
        // Update message data
        msgData.account_id = correctAccountId;
        msgData.author = {
          name: correctName,
          handle: correctHandle,
        };

        // Update direction tag
        const newTags = currentTags.filter(t => t[0] !== "direction");
        newTags.unshift(["direction", correctDirection]);
        msgData.tags = newTags;

        updates.push({
          id: msg.id,
          newAccountId: correctAccountId,
          newData: JSON.stringify(msgData),
          newAuthor: correctName,
        });
      }
    }

    console.log(`Found ${updates.length} messages needing update`);

    if (options.dryRun) {
      // Show sample of what would change
      console.log("\nSample updates (first 10):");
      for (const u of updates.slice(0, 10)) {
        const oldId = searchMessages.find(m => m.id === u.id)?.account_id;
        console.log(`  ${oldId} -> ${u.newAccountId} (${u.newAuthor})`);
      }

      // Count by new account
      const byAccount = new Map<string, number>();
      for (const u of updates) {
        byAccount.set(u.newAccountId, (byAccount.get(u.newAccountId) || 0) + 1);
      }
      console.log("\nUpdates by account:");
      const sorted = [...byAccount.entries()].sort((a, b) => b[1] - a[1]);
      for (const [account, count] of sorted.slice(0, 20)) {
        console.log(`  ${count.toString().padStart(6)} -> ${account}`);
      }

      stats.messagesUpdated = updates.length;
      stats.accountsMapped = byAccount.size;
    } else {
      // Apply updates in transaction
      const applyUpdates = searchDb.transaction(() => {
        for (const u of updates) {
          updateStmt.run(u.newAccountId, u.newData, u.id);
          updateFts.run(u.newAuthor, u.id);
          stats.messagesUpdated++;

          if (options.onProgress && stats.messagesUpdated % 1000 === 0) {
            options.onProgress(stats.messagesUpdated, updates.length);
          }
        }
      });

      applyUpdates();

      // Count unique accounts created
      const uniqueAccounts = new Set(updates.map(u => u.newAccountId));
      stats.accountsMapped = uniqueAccounts.size;
    }

    return stats;
  } finally {
    backupDb.close();
    searchDb.close();
  }
}

/**
 * Backfill Signal thread names from backup database
 *
 * Updates the threads table in the search index with correct names from
 * the Signal backup database. This fixes threads that were imported with
 * incorrect names (e.g., "Unknown Group" instead of actual group names).
 */
export interface SignalBackfillOptions {
  /** Path to decrypted database.sqlite */
  databasePath: string;
  /** Path to search index database */
  searchDbPath?: string;
  /** Dry run - just report what would change */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

export interface SignalBackfillStats {
  threadsScanned: number;
  threadsUpdated: number;
  groupsFound: number;
  contactsFound: number;
}

export async function backfillSignalThreadNames(
  options: SignalBackfillOptions
): Promise<SignalBackfillStats> {
  const stats: SignalBackfillStats = {
    threadsScanned: 0,
    threadsUpdated: 0,
    groupsFound: 0,
    contactsFound: 0,
  };

  const backupDb = new Database(options.databasePath, { readonly: true });
  const searchDbPath = options.searchDbPath || getSearchDbPath();
  const searchDb = new Database(searchDbPath);

  try {
    // Ensure threads table exists (migration)
    searchDb.run(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT,
        type TEXT,
        platform TEXT NOT NULL,
        is_group INTEGER DEFAULT 0,
        participant_count INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);

    // Query thread info from backup with group names and member counts
    const threadRows = backupDb.query(`
      SELECT t._id, t.recipient_id, r.system_joined_name, r.e164, r.group_id,
             r.profile_given_name, r.profile_family_name, r.profile_joined_name,
             g.title as group_title,
             (SELECT COUNT(*) FROM group_membership gm WHERE gm.group_id = r.group_id) as member_count
      FROM thread t
      LEFT JOIN recipient r ON t.recipient_id = r._id
      LEFT JOIN groups g ON r.group_id = g.group_id
    `).all() as Array<{
      _id: number;
      recipient_id: number;
      system_joined_name: string | null;
      e164: string | null;
      group_id: string | null;
      profile_given_name: string | null;
      profile_family_name: string | null;
      profile_joined_name: string | null;
      group_title: string | null;
      member_count: number | null;
    }>;

    // Build updates
    const updates: Array<{
      threadId: string;
      title: string;
      isGroup: boolean;
      participantCount: number;
    }> = [];

    for (const t of threadRows) {
      stats.threadsScanned++;

      const isGroup = !!t.group_id;

      // Determine title
      const title = isGroup
        ? (t.group_title || t.system_joined_name || "Unknown Group")
        : (t.system_joined_name ||
           t.profile_joined_name ||
           (t.profile_given_name && t.profile_family_name
             ? `${t.profile_given_name} ${t.profile_family_name}`.trim()
             : t.profile_given_name) ||
           t.e164 ||
           `Thread ${t._id}`);

      // Participant count: use member_count for groups, 1 for DMs
      const participantCount = isGroup ? (t.member_count || 0) : 1;

      if (isGroup) stats.groupsFound++;
      else stats.contactsFound++;

      // Generate thread ID using canonical base64 format (matches live sync)
      // - Groups: signal_group_{base64_safe_group_id}
      // - DMs: signal_dm_{phone} or signal_dm_dm_{thread_id}
      let threadId: string;
      if (isGroup && t.group_id) {
        threadId = createThreadId(hexToBase64(t.group_id), true);
      } else if (t.e164) {
        threadId = createThreadId(t.e164, false);
      } else {
        // Fallback for contacts without phone numbers
        threadId = `signal_dm_dm_${t._id}`;
      }

      updates.push({
        threadId,
        title: title.trim(),
        isGroup,
        participantCount,
      });
    }

    console.log(`Found ${updates.length} threads in backup (${stats.groupsFound} groups, ${stats.contactsFound} contacts)`);

    if (options.dryRun) {
      // Show sample
      console.log("\nSample thread names (first 20):");
      for (const u of updates.slice(0, 20)) {
        const typeLabel = u.isGroup ? `[G:${u.participantCount}]` : "[C]";
        console.log(`  ${typeLabel} ${u.threadId} -> "${u.title}"`);
      }
      stats.threadsUpdated = updates.length;
    } else {
      // Apply updates with participant counts
      const now = Date.now();
      const stmt = searchDb.prepare(`
        INSERT INTO threads (id, title, type, platform, is_group, participant_count, created_at, updated_at)
        VALUES (?, ?, ?, 'signal', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          type = excluded.type,
          is_group = excluded.is_group,
          participant_count = excluded.participant_count,
          updated_at = excluded.updated_at
      `);

      const applyUpdates = searchDb.transaction(() => {
        for (const u of updates) {
          stmt.run(
            u.threadId,
            u.title,
            u.isGroup ? "group" : "dm",
            u.isGroup ? 1 : 0,
            u.participantCount,
            now,
            now
          );
          stats.threadsUpdated++;

          if (options.onProgress && stats.threadsUpdated % 100 === 0) {
            options.onProgress(stats.threadsUpdated, updates.length);
          }
        }
      });

      applyUpdates();

      if (options.onProgress) {
        options.onProgress(updates.length, updates.length);
      }
    }

    return stats;
  } finally {
    backupDb.close();
    searchDb.close();
  }
}

// ============================================================================
// Thread ID Migration
// ============================================================================

/**
 * Options for Signal thread ID migration
 */
export interface SignalThreadMigrationOptions {
  /** Path to decrypted Signal backup database.sqlite */
  databasePath: string;
  /** Path to search index database (defaults to config) */
  searchDbPath?: string;
  /** Dry run - report what would change without modifying */
  dryRun?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Statistics from Signal thread ID migration
 */
export interface SignalThreadMigrationStats {
  threadsScanned: number;
  threadsNeedingMigration: number;
  threadsMigrated: number;
  threadsSkipped: number;
  errors: string[];
  mappings: Array<{ oldId: string; newId: string; title: string }>;
}

/**
 * Migrate Signal group thread IDs from legacy numeric format to canonical base64 format
 *
 * Problem: Backup import previously used signal_group_{recipient_id} (numeric)
 *          Live sync uses signal_group_{base64_group_id}
 *          Same groups got different thread IDs.
 *
 * Solution: Convert all numeric group IDs to base64 format using the backup database
 *           to look up the actual group_id for each recipient_id.
 *
 * This only updates the search index. Event store is preserved (append-only).
 *
 * @example
 * ```typescript
 * const stats = await migrateSignalThreadIds({
 *   databasePath: "/path/to/database.sqlite",
 *   dryRun: true,  // Preview first
 * });
 * ```
 */
export async function migrateSignalThreadIds(
  options: SignalThreadMigrationOptions
): Promise<SignalThreadMigrationStats> {
  const stats: SignalThreadMigrationStats = {
    threadsScanned: 0,
    threadsNeedingMigration: 0,
    threadsMigrated: 0,
    threadsSkipped: 0,
    errors: [],
    mappings: [],
  };

  const backupDb = new Database(options.databasePath, { readonly: true });
  const searchDbPath = options.searchDbPath || getSearchDbPath();
  const searchDb = new Database(searchDbPath);

  try {
    // Step 1: Build recipient_id → group_id mapping from backup
    console.log("Loading group mappings from backup database...");

    const groupRows = backupDb.query(`
      SELECT r._id as recipient_id, r.group_id, g.title as group_title
      FROM recipient r
      LEFT JOIN groups g ON r.group_id = g.group_id
      WHERE r.group_id IS NOT NULL AND r.group_id != ''
    `).all() as Array<{
      recipient_id: number;
      group_id: string;
      group_title: string | null;
    }>;

    // Map: recipient_id → { base64GroupId, title }
    const recipientToGroup = new Map<number, { base64GroupId: string; title: string }>();

    for (const row of groupRows) {
      try {
        const base64GroupId = hexToBase64(row.group_id);
        recipientToGroup.set(row.recipient_id, {
          base64GroupId,
          title: row.group_title || "Unknown Group",
        });
      } catch (err) {
        stats.errors.push(`Failed to convert group_id for recipient ${row.recipient_id}: ${err}`);
      }
    }

    console.log(`Loaded ${recipientToGroup.size} group mappings from backup`);

    // Step 2: Find threads with legacy numeric IDs in search index
    console.log("Scanning search index for legacy thread IDs...");

    const threadRows = searchDb.query(`
      SELECT id, title, type, platform
      FROM threads
      WHERE platform = 'signal' AND id LIKE 'signal_group_%'
    `).all() as Array<{
      id: string;
      title: string;
      type: string;
      platform: string;
    }>;

    // Build migration plan
    const migrations: Array<{ oldId: string; newId: string; title: string }> = [];

    for (const thread of threadRows) {
      stats.threadsScanned++;

      // Only migrate legacy numeric format
      if (!isLegacyNumericGroupId(thread.id)) {
        continue;
      }

      const recipientId = extractRecipientIdFromThreadId(thread.id);
      if (recipientId === null) {
        stats.errors.push(`Failed to extract recipient_id from thread: ${thread.id}`);
        continue;
      }

      const groupInfo = recipientToGroup.get(recipientId);
      if (!groupInfo) {
        stats.errors.push(`No group mapping found for recipient_id ${recipientId} (thread: ${thread.id})`);
        stats.threadsSkipped++;
        continue;
      }

      const newThreadId = createThreadId(groupInfo.base64GroupId, true);

      migrations.push({
        oldId: thread.id,
        newId: newThreadId,
        title: groupInfo.title,
      });

      stats.mappings.push({
        oldId: thread.id,
        newId: newThreadId,
        title: groupInfo.title,
      });
    }

    stats.threadsNeedingMigration = migrations.length;
    console.log(`Found ${migrations.length} threads needing migration`);

    if (migrations.length === 0) {
      console.log("No migration needed - all threads already using canonical format");
      return stats;
    }

    // Step 3: Preview (dry run) or apply migrations
    if (options.dryRun) {
      console.log("\nMigration Preview:");
      for (const m of migrations.slice(0, 30)) {
        console.log(`  ${m.oldId} → ${m.newId}`);
        console.log(`    "${m.title}"`);
      }
      if (migrations.length > 30) {
        console.log(`  ... and ${migrations.length - 30} more`);
      }
      return stats;
    }

    // Step 4: Apply migrations in transaction
    console.log("\nApplying migrations...");

    const migrate = searchDb.transaction(() => {
      for (let i = 0; i < migrations.length; i++) {
        const m = migrations[i];

        try {
          // Check if new thread ID already exists (from live sync)
          const existingNew = searchDb.query(
            `SELECT id FROM threads WHERE id = ?`
          ).get(m.newId) as { id: string } | null;

          if (existingNew) {
            // New thread exists - merge messages and delete old thread
            searchDb.run(
              `UPDATE messages_meta SET thread_id = ? WHERE thread_id = ?`,
              [m.newId, m.oldId]
            );
            searchDb.run(`DELETE FROM threads WHERE id = ?`, [m.oldId]);
          } else {
            // Rename thread and update messages
            searchDb.run(
              `UPDATE threads SET id = ? WHERE id = ?`,
              [m.newId, m.oldId]
            );
            searchDb.run(
              `UPDATE messages_meta SET thread_id = ? WHERE thread_id = ?`,
              [m.newId, m.oldId]
            );
          }

          stats.threadsMigrated++;

          if (options.onProgress && i % 10 === 0) {
            options.onProgress(i, migrations.length);
          }
        } catch (err) {
          stats.errors.push(`Failed to migrate ${m.oldId}: ${err}`);
        }
      }
    });

    migrate();

    if (options.onProgress) {
      options.onProgress(migrations.length, migrations.length);
    }

    console.log(`\nMigration complete:`);
    console.log(`  Threads migrated: ${stats.threadsMigrated}`);
    console.log(`  Threads skipped: ${stats.threadsSkipped}`);
    if (stats.errors.length > 0) {
      console.log(`  Errors: ${stats.errors.length}`);
    }

    return stats;
  } finally {
    backupDb.close();
    searchDb.close();
  }
}
