#!/usr/bin/env bun
/**
 * Get contact names for Signal accounts
 */

import { Database } from "bun:sqlite";
import { homedir } from "os";
import { getSearchDbPath } from "../config";

const backupDb = new Database(`${homedir()}/signal-backup/decrypted/database.sqlite`, { readonly: true });
const searchDb = new Database(getSearchDbPath(), { readonly: true });

// Get all recipients with names (treat empty strings as NULL)
const recipients = backupDb.query(`
  SELECT _id, e164, aci,
    COALESCE(
      NULLIF(system_joined_name, ''),
      NULLIF(profile_joined_name, ''),
      CASE WHEN NULLIF(profile_given_name, '') IS NOT NULL
        THEN TRIM(COALESCE(profile_given_name, '') || ' ' || COALESCE(profile_family_name, ''))
        ELSE NULL END,
      NULLIF(nickname_joined_name, ''),
      e164
    ) as name
  FROM recipient
`).all() as Array<{ _id: number; e164: string | null; aci: string | null; name: string | null }>;

// Build lookup by recipient_id
const recipientIdToName = new Map<number, string>();
for (const r of recipients) {
  if (r.name) recipientIdToName.set(r._id, r.name.trim());
}

// Get messages mapping
const msgToRecipient = new Map<string, number>();
const msgRows = backupDb.query(`
  SELECT _id, from_recipient_id FROM message
  WHERE body IS NOT NULL AND body != ''
`).all() as Array<{ _id: number; from_recipient_id: number }>;

for (const m of msgRows) {
  msgToRecipient.set(`backup_${m._id}`, m.from_recipient_id);
}

// Map account_id -> recipient_id from search index
const accountToRecipients = new Map<string, Set<number>>();
const searchMsgs = searchDb.query(`
  SELECT account_id, data FROM messages_meta WHERE platform = 'signal'
`).all() as Array<{ account_id: string; data: string }>;

for (const m of searchMsgs) {
  try {
    const data = JSON.parse(m.data);
    const platformId = data.source?.platform_id;
    if (platformId && msgToRecipient.has(platformId)) {
      const recipientId = msgToRecipient.get(platformId)!;
      if (!accountToRecipients.has(m.account_id)) {
        accountToRecipients.set(m.account_id, new Set());
      }
      accountToRecipients.get(m.account_id)!.add(recipientId);
    }
  } catch {}
}

// Build account_id -> name map
const accountToName = new Map<string, string>();
for (const [accountId, recipientIds] of accountToRecipients) {
  for (const rid of recipientIds) {
    const name = recipientIdToName.get(rid);
    if (name) {
      accountToName.set(accountId, name);
      break;
    }
  }
}

// Get priority accounts
const now = Date.now();
const accounts = searchDb.query(`
  WITH account_stats AS (
    SELECT
      account_id,
      COUNT(*) as total,
      COUNT(DISTINCT thread_id) as threads,
      MAX(created_at) as last_active,
      (${now} - MAX(created_at)) / 86400000.0 as days_ago,
      COUNT(CASE WHEN created_at > ${now - 7 * 86400000} THEN 1 END) as msgs_7d,
      COUNT(CASE WHEN created_at > ${now - 30 * 86400000} THEN 1 END) as msgs_30d
    FROM messages_meta
    WHERE platform = 'signal'
      AND account_id != 'signal_12507970950'
    GROUP BY account_id
  )
  SELECT
    account_id,
    total,
    threads,
    days_ago,
    msgs_7d,
    msgs_30d,
    (50.0 / (days_ago + 1)) + (msgs_7d * 3) + (20 * LOG(total + 1) / LOG(10)) as priority
  FROM account_stats
  ORDER BY priority DESC
  LIMIT 20
`).all() as Array<{
  account_id: string;
  total: number;
  threads: number;
  days_ago: number;
  msgs_7d: number;
  msgs_30d: number;
  priority: number;
}>;

console.log("Top 20 Priority Signal Contacts:\n");
console.log("Priority  7d   30d   Total  Threads  Last      Name");
console.log("-".repeat(85));

for (const a of accounts) {
  const name = accountToName.get(a.account_id) || "?";
  const priority = a.priority.toFixed(1).padStart(7);
  const msgs7d = a.msgs_7d.toString().padStart(4);
  const msgs30d = a.msgs_30d.toString().padStart(5);
  const total = a.total.toString().padStart(6);
  const threads = a.threads.toString().padStart(7);
  const daysAgo = Math.round(a.days_ago);
  const lastActive = (daysAgo === 0 ? "today" : daysAgo + "d ago").padStart(9);

  console.log(`${priority} ${msgs7d} ${msgs30d} ${total} ${threads} ${lastActive}  ${name}`);
}

backupDb.close();
searchDb.close();
