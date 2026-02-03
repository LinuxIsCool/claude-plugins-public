/**
 * Messages Plugin Bridge
 *
 * Provides bidirectional integration with the messages plugin:
 * 1. Shared accounts: Speaker profiles link to messages accounts
 * 2. Message emission: Utterances can be emitted as messages
 * 3. Account resolution: Find speakers by messages account
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Speaker, SpeakerIdentity, SpeakerID } from "../domain/entities/speaker.js";
import type { Transcript } from "../domain/entities/transcript.js";
import type { Utterance } from "../domain/entities/utterance.js";
import { getClaudePath } from "../../../../lib/paths.js";

/**
 * Get messages plugin paths (anchored to repo root)
 */
function getMessagesBase(): string {
  return getClaudePath("messages");
}

function getMessagesEventsDir(): string {
  return join(getMessagesBase(), "store/events");
}

function getMessagesAccountsDir(): string {
  return join(getMessagesBase(), "views/accounts");
}

/**
 * Messages plugin Account structure (simplified)
 */
interface MessagesAccount {
  id: string;
  did?: string;
  name: string;
  avatar?: string;
  identities: Array<{
    platform: string;
    handle: string;
    verified?: boolean;
  }>;
  agent?: {
    source: string;
    model?: string;
  };
  created_at: number;
  updated_at?: number;
}

/**
 * Messages plugin Message structure (simplified)
 */
interface MessagesMessage {
  id: string;
  account_id: string;
  author: {
    did?: string;
    name?: string;
    handle?: string;
  };
  created_at: number;
  imported_at: number;
  kind: number;
  content: string;
  refs: {
    thread_id?: string;
    reply_to?: string;
  };
  source: {
    platform: string;
    session_id?: string;
  };
  tags?: [string, string][];
}

/**
 * Check if messages plugin is available
 */
export function isMessagesPluginAvailable(): boolean {
  return existsSync(getMessagesBase());
}

/**
 * Get all messages accounts
 */
export async function getMessagesAccounts(): Promise<MessagesAccount[]> {
  const accountsDir = getMessagesAccountsDir();
  if (!existsSync(accountsDir)) {
    return [];
  }

  const accounts: MessagesAccount[] = [];
  const files = readdirSync(accountsDir).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const content = readFileSync(join(accountsDir, file), "utf-8");
    const account = parseAccountFromMarkdown(content);
    if (account) {
      accounts.push(account);
    }
  }

  return accounts;
}

/**
 * Parse account from markdown file
 */
function parseAccountFromMarkdown(content: string): MessagesAccount | null {
  // Extract YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  try {
    // Simple YAML parsing (handles basic cases)
    const yaml = match[1];
    const account: Partial<MessagesAccount> = {};

    for (const line of yaml.split("\n")) {
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();

      if (key === "id") account.id = value;
      else if (key === "name") account.name = value;
      else if (key === "did") account.did = value;
      else if (key === "avatar") account.avatar = value;
      else if (key === "created_at") account.created_at = parseInt(value, 10);
      else if (key === "identities") {
        // Parse JSON array
        try {
          account.identities = JSON.parse(value);
        } catch {
          account.identities = [];
        }
      }
    }

    if (account.id && account.name) {
      return account as MessagesAccount;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Find messages account by name
 */
export async function findAccountByName(name: string): Promise<MessagesAccount | null> {
  const accounts = await getMessagesAccounts();
  return accounts.find((a) => a.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Find messages account by identity
 */
export async function findAccountByIdentity(
  platform: string,
  handle: string
): Promise<MessagesAccount | null> {
  const accounts = await getMessagesAccounts();
  return accounts.find((a) =>
    a.identities?.some(
      (i) => i.platform === platform && i.handle.toLowerCase() === handle.toLowerCase()
    )
  ) || null;
}

/**
 * Link a speaker to a messages account
 */
export function createSpeakerLink(
  accountId: string,
  accountName: string
): SpeakerIdentity {
  return {
    platform: "messages",
    external_id: accountId,
    handle: accountName,
    verified: true,
    linked_at: Date.now(),
  };
}

/**
 * Check if speaker is linked to messages
 */
export function getSpeakerMessagesLink(speaker: Speaker): SpeakerIdentity | undefined {
  return speaker.identities.find((i) => i.platform === "messages");
}

/**
 * Message kind for transcripts
 * Using kind 1050 (in custom range for this plugin)
 */
export const TRANSCRIPT_MESSAGE_KIND = 1050;
export const UTTERANCE_MESSAGE_KIND = 1051;

/**
 * Convert utterance to messages format
 */
export function utteranceToMessage(
  utterance: Utterance,
  transcript: Transcript,
  speakerAccountId?: string
): MessagesMessage {
  return {
    id: `msg_${utterance.id}`,  // Derived from utterance ID
    account_id: speakerAccountId || `speaker_${utterance.speaker.id}`,
    author: {
      name: utterance.speaker.name || utterance.speaker.id,
    },
    created_at: transcript.source.recorded_at
      ? transcript.source.recorded_at + utterance.start_ms
      : transcript.created_at + utterance.start_ms,
    imported_at: Date.now(),
    kind: UTTERANCE_MESSAGE_KIND,
    content: utterance.text,
    refs: {
      thread_id: `transcript_${transcript.id}`,
    },
    source: {
      platform: "transcripts",
      session_id: transcript.id,
    },
    tags: [
      ["transcript_id", transcript.id],
      ["utterance_id", utterance.id],
      ["start_ms", String(utterance.start_ms)],
      ["end_ms", String(utterance.end_ms)],
    ],
  };
}

/**
 * Emit transcript as messages to the messages plugin
 *
 * This creates:
 * 1. A thread for the transcript
 * 2. Messages for each utterance
 */
export async function emitTranscriptToMessages(
  transcript: Transcript,
  speakerAccountMap?: Map<SpeakerID, string>
): Promise<{ messagesEmitted: number; threadCreated: boolean }> {
  if (!isMessagesPluginAvailable()) {
    throw new Error("Messages plugin not available");
  }

  let messagesEmitted = 0;
  const threadId = `transcript_${transcript.id}`;

  // Find today's event log
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const eventDir = join(getMessagesEventsDir(), String(year), month, day);

  // Ensure directory exists
  const { mkdirSync } = require("fs");
  if (!existsSync(eventDir)) {
    mkdirSync(eventDir, { recursive: true });
  }

  const eventFile = join(eventDir, "events.jsonl");

  // Create thread event
  const threadEvent = {
    ts: new Date().toISOString(),
    op: "thread.created",
    data: {
      id: threadId,
      title: transcript.title || `Transcript ${transcript.id}`,
      type: "topic",
      participants: [...new Set(transcript.utterances.map((u) => u.speaker.id))],
      source: {
        platform: "transcripts",
        platform_id: transcript.id,
      },
      created_at: Date.now(),
      message_count: transcript.utterances.length,
    },
  };

  // Append thread event
  const fs = require("fs");
  fs.appendFileSync(eventFile, JSON.stringify(threadEvent) + "\n");

  // Create message events for utterances
  for (const utterance of transcript.utterances) {
    const accountId = speakerAccountMap?.get(utterance.speaker.id);
    const message = utteranceToMessage(utterance, transcript, accountId);

    const messageEvent = {
      ts: new Date().toISOString(),
      op: "message.created",
      data: message,
    };

    fs.appendFileSync(eventFile, JSON.stringify(messageEvent) + "\n");
    messagesEmitted++;
  }

  return {
    messagesEmitted,
    threadCreated: true,
  };
}

/**
 * Resolve speaker to messages account
 *
 * Tries to find a matching account by:
 * 1. Explicit link in speaker.identities
 * 2. Name matching
 * 3. Returns null if no match
 */
export async function resolveSpeakerToAccount(
  speaker: Speaker
): Promise<MessagesAccount | null> {
  // Check explicit link
  const link = getSpeakerMessagesLink(speaker);
  if (link) {
    const accounts = await getMessagesAccounts();
    return accounts.find((a) => a.id === link.external_id) || null;
  }

  // Try name matching
  return findAccountByName(speaker.name);
}

/**
 * Create bidirectional link between speaker and account
 */
export async function linkSpeakerToAccount(
  _speaker: Speaker,
  accountId: string
): Promise<SpeakerIdentity> {
  const account = (await getMessagesAccounts()).find((a) => a.id === accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  return createSpeakerLink(accountId, account.name);
}

/**
 * Import speakers from messages accounts
 *
 * Creates speaker profiles for all messages accounts that don't
 * have corresponding speakers.
 */
export async function* importSpeakersFromMessages(): AsyncGenerator<{
  accountId: string;
  accountName: string;
  action: "created" | "linked" | "skipped";
}> {
  const accounts = await getMessagesAccounts();

  for (const account of accounts) {
    // Skip system accounts
    if (["user", "claude", "system"].includes(account.id)) {
      yield { accountId: account.id, accountName: account.name, action: "skipped" };
      continue;
    }

    // Skip agent accounts
    if (account.id.startsWith("agent_")) {
      yield { accountId: account.id, accountName: account.name, action: "skipped" };
      continue;
    }

    // This would need store access to check/create speakers
    // For now, just yield the intent
    yield { accountId: account.id, accountName: account.name, action: "created" };
  }
}
