/**
 * Email Adapter
 *
 * Imports messages from .eml files (directory scan) or .mbox archives.
 * Supports RFC 5256 threading via In-Reply-To and References headers.
 * Stores attachments to disk.
 */

import { simpleParser } from "mailparser";
import type { ParsedMail, Attachment } from "mailparser";
import { existsSync, readdirSync, statSync, mkdirSync, readFileSync } from "fs";
import { join, extname, basename } from "path";
import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { getMessagesBasePath } from "../config";
import {
  extractMetadata,
  extractContent,
  buildThreadId,
  buildAuthor,
  emailToMessageInput,
  isOutgoing,
  createAccountId,
  sanitizeFilename,
  type EmailParseContext,
} from "../integrations/email/parser";

/**
 * Import options for email adapter
 */
export interface EmailImportOptions {
  /** Path to .eml directory or .mbox file */
  source: string;
  /** User's email address (for identifying sent messages) */
  userEmail: string;
  /** Only import messages after this date */
  since?: Date;
  /** Only import messages before this date */
  until?: Date;
  /** Save attachments to disk (default: true) */
  includeAttachments?: boolean;
  /** Base path for message storage */
  basePath?: string;
}

/**
 * Import statistics
 */
export interface EmailImportStats {
  messages: number;
  threads: number;
  accounts: number;
  attachments: number;
  skipped: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

/**
 * Attachment metadata for tags
 */
interface AttachmentMeta {
  filename: string;
  size: number;
  path: string;
}

// =============================================================================
// File Scanning
// =============================================================================

/**
 * Recursively scan directory for .eml files
 */
function* scanEmlFiles(dirPath: string): Generator<string> {
  if (!existsSync(dirPath)) return;

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Recurse into subdirectories
      yield* scanEmlFiles(fullPath);
    } else if (entry.toLowerCase().endsWith(".eml")) {
      yield fullPath;
    }
  }
}

/**
 * Parse a single .eml file
 */
async function parseEmlFile(filePath: string): Promise<ParsedMail> {
  let content: Buffer;
  try {
    content = readFileSync(filePath);
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error}`);
  }
  return simpleParser(content);
}

/**
 * Parse .mbox file into iterator of emails
 *
 * MBOX format: Messages separated by lines starting with "From "
 * (with a space after "From")
 *
 * Uses streaming to handle large files without loading all into memory.
 */
async function* parseMboxFile(filePath: string): AsyncGenerator<ParsedMail> {
  const { createReadStream } = await import("fs");
  const { createInterface } = await import("readline");

  const fileStream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity, // Handle \r\n properly
  });

  let currentMessage: string[] = [];
  let inMessage = false;

  for await (const line of rl) {
    // Check for mbox separator: line starting with "From " followed by email/timestamp
    // Pattern: "From sender@example.com Fri Dec 13 12:34:56 2024"
    if (line.startsWith("From ") && line.length > 5 && /^From \S+/.test(line)) {
      // If we have a previous message, yield it
      if (inMessage && currentMessage.length > 0) {
        try {
          const messageText = currentMessage.join("\n");
          // Unescape "From " lines within message body
          const unescaped = messageText.replace(/^>From /gm, "From ");
          const parsed = await simpleParser(Buffer.from(unescaped));
          yield parsed;
        } catch (error) {
          console.warn(`Failed to parse mbox message: ${error}`);
        }
      }
      // Start new message
      currentMessage = [];
      inMessage = true;
    } else if (inMessage) {
      currentMessage.push(line);
    }
  }

  // Don't forget the last message
  if (inMessage && currentMessage.length > 0) {
    try {
      const messageText = currentMessage.join("\n");
      const unescaped = messageText.replace(/^>From /gm, "From ");
      const parsed = await simpleParser(Buffer.from(unescaped));
      yield parsed;
    } catch (error) {
      console.warn(`Failed to parse mbox message: ${error}`);
    }
  }
}

// =============================================================================
// Attachment Handling
// =============================================================================

/**
 * Save attachments to disk
 *
 * Storage path: {basePath}/attachments/{messageCid}/{filename}
 */
async function saveAttachments(
  attachments: Attachment[],
  messageCid: string,
  basePath: string
): Promise<AttachmentMeta[]> {
  if (!attachments || attachments.length === 0) return [];

  const attachDir = join(basePath, "attachments", messageCid);

  // Create directory if needed
  if (!existsSync(attachDir)) {
    mkdirSync(attachDir, { recursive: true });
  }

  const saved: AttachmentMeta[] = [];

  for (const att of attachments) {
    // Skip inline images and content without filename
    if (!att.filename || !att.content) continue;

    const safeFilename = sanitizeFilename(att.filename);
    const filePath = join(attachDir, safeFilename);

    try {
      await Bun.write(filePath, att.content);

      saved.push({
        filename: safeFilename, // Use sanitized filename for consistency
        size: att.size || att.content.length,
        path: filePath,
      });
    } catch (error) {
      console.warn(`Failed to save attachment ${att.filename}: ${error}`);
    }
  }

  return saved;
}

// =============================================================================
// Count Function (Dry Run)
// =============================================================================

/**
 * Count emails without importing (for --dry-run)
 */
export async function countEmail(options: Omit<EmailImportOptions, "basePath">): Promise<{
  messages: number;
  threads: number;
  accounts: Set<string>;
  attachments: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}> {
  const { source, userEmail, since, until } = options;

  let messageCount = 0;
  let attachmentCount = 0;
  const accounts = new Set<string>();
  const threads = new Set<string>();
  let earliest: Date | undefined;
  let latest: Date | undefined;

  // Threading state
  const messageIdToThread = new Map<string, string>();
  const subjectToThread = new Map<string, string>();

  const stat = statSync(source);

  let emailIterator: AsyncGenerator<ParsedMail> | Generator<string>;

  if (stat.isDirectory()) {
    // Process .eml files
    for (const filePath of scanEmlFiles(source)) {
      try {
        const parsed = await parseEmlFile(filePath);
        processEmail(parsed);
      } catch (error) {
        // Skip malformed files
      }
    }
  } else if (source.toLowerCase().endsWith(".mbox")) {
    // Process .mbox archive
    for await (const parsed of parseMboxFile(source)) {
      processEmail(parsed);
    }
  } else {
    throw new Error(`Invalid email source: ${source} (must be .eml directory or .mbox file)`);
  }

  function processEmail(parsed: ParsedMail): void {
    const metadata = extractMetadata(parsed);

    // Date filtering
    if (since && metadata.date < since) return;
    if (until && metadata.date > until) return;

    messageCount++;

    // Track date range
    if (!earliest || metadata.date < earliest) earliest = metadata.date;
    if (!latest || metadata.date > latest) latest = metadata.date;

    // Track accounts
    accounts.add(createAccountId(metadata.from.address));
    for (const to of metadata.to) {
      accounts.add(createAccountId(to.address));
    }

    // Track threads
    const threadId = buildThreadId(metadata, messageIdToThread, subjectToThread);
    threads.add(threadId);

    // Count attachments
    if (parsed.attachments) {
      attachmentCount += parsed.attachments.filter((a) => a.filename).length;
    }
  }

  return {
    messages: messageCount,
    threads: threads.size,
    accounts,
    attachments: attachmentCount,
    dateRange: { earliest, latest },
  };
}

// =============================================================================
// Main Import Function
// =============================================================================

/**
 * Import emails from .eml directory or .mbox archive
 */
export async function* importEmail(
  store: MessageStore,
  options: EmailImportOptions
): AsyncGenerator<Message, EmailImportStats> {
  const {
    source,
    userEmail,
    since,
    until,
    includeAttachments = true,
    basePath = getMessagesBasePath(),
  } = options;

  const stats: EmailImportStats = {
    messages: 0,
    threads: 0,
    accounts: 0,
    attachments: 0,
    skipped: 0,
    dateRange: {},
  };

  // Track seen entities
  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();

  // Threading state
  const messageIdToThread = new Map<string, string>();
  const subjectToThread = new Map<string, string>();

  // Context for parsing
  const context: EmailParseContext = {
    myAddress: userEmail,
  };

  // Create user account
  const userAccountId = createAccountId(userEmail);
  await store.getOrCreateAccount({
    id: userAccountId,
    name: userEmail.split("@")[0],
    identities: [{ platform: "email", handle: userEmail }],
  });
  seenAccounts.add(userAccountId);
  stats.accounts++;

  // Detect source type
  const stat = statSync(source);

  if (stat.isDirectory()) {
    // Process .eml files
    for (const filePath of scanEmlFiles(source)) {
      try {
        const parsed = await parseEmlFile(filePath);
        const message = await processEmail(parsed, basename(filePath));
        if (message) yield message;
      } catch (error) {
        console.warn(`Failed to parse ${filePath}: ${error}`);
        stats.skipped++;
      }
    }
  } else if (source.toLowerCase().endsWith(".mbox")) {
    // Process .mbox archive
    let index = 0;
    for await (const parsed of parseMboxFile(source)) {
      index++;
      try {
        const message = await processEmail(parsed, `mbox_${index}`);
        if (message) yield message;
      } catch (error) {
        console.warn(`Failed to process mbox message ${index}: ${error}`);
        stats.skipped++;
      }
    }
  } else {
    throw new Error(`Invalid email source: ${source} (must be .eml directory or .mbox file)`);
  }

  /**
   * Process a single email
   */
  async function processEmail(parsed: ParsedMail, sourceFile: string): Promise<Message | null> {
    const metadata = extractMetadata(parsed);

    // Date filtering
    if (since && metadata.date < since) {
      stats.skipped++;
      return null;
    }
    if (until && metadata.date > until) {
      stats.skipped++;
      return null;
    }

    // Skip empty content
    const content = extractContent(parsed);
    if (!content.trim()) {
      stats.skipped++;
      return null;
    }

    // Track date range
    if (!stats.dateRange.earliest || metadata.date < stats.dateRange.earliest) {
      stats.dateRange.earliest = metadata.date;
    }
    if (!stats.dateRange.latest || metadata.date > stats.dateRange.latest) {
      stats.dateRange.latest = metadata.date;
    }

    // Determine if outgoing
    const outgoing = isOutgoing(metadata.from.address, userEmail);

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
      // Collect participants
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

    // Build message input
    const input = emailToMessageInput(parsed, context, threadId, senderAccountId);

    // Create message (generates CID)
    const message = await store.createMessage(input);
    stats.messages++;

    // Save attachments after we have the CID
    if (includeAttachments && parsed.attachments && parsed.attachments.length > 0) {
      const savedAttachments = await saveAttachments(parsed.attachments, message.id, basePath);

      if (savedAttachments.length > 0) {
        // Update message tags with attachment info
        const attachmentTags: [string, string][] = savedAttachments.map((att) => [
          "attachment",
          `${att.filename}|${att.size}|${att.path}`,
        ]);

        // Merge with existing tags
        const existingTags = message.tags || [];
        message.tags = [...existingTags, ...attachmentTags];

        stats.attachments += savedAttachments.length;
      }
    }

    return message;
  }

  return stats;
}

/**
 * Get user email from environment
 */
export function getUserEmail(): string | undefined {
  return process.env.EMAIL_ADDRESS;
}
