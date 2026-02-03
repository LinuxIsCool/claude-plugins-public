/**
 * Email Parser Utilities
 *
 * Shared parsing logic for email adapters (file-based and future IMAP).
 * Converts parsed email to MessageInput format.
 */

import { createHash } from "crypto";
import type { ParsedMail, AddressObject } from "mailparser";
import type { MessageInput, Author } from "../../types";
import { Kind } from "../../types";

/**
 * Context for parsing emails
 */
export interface EmailParseContext {
  myAddress: string; // User's email address from .env
  folder?: string; // Source folder (for IMAP)
  inbox?: string; // Receiving inbox identifier (e.g., "company", "personal")
}

/**
 * Extracted email metadata for threading
 */
export interface EmailMetadata {
  messageId: string;
  inReplyTo?: string;
  references: string[];
  subject: string;
  from: { name?: string; address: string };
  to: Array<{ name?: string; address: string }>;
  cc?: Array<{ name?: string; address: string }>;
  date: Date;
}

/**
 * Extract metadata from parsed email
 */
export function extractMetadata(parsed: ParsedMail): EmailMetadata {
  const fromAddr = getFirstAddress(parsed.from);

  return {
    messageId: parsed.messageId || `generated_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    inReplyTo: parsed.inReplyTo || undefined,
    references: parseReferences(parsed.references),
    subject: parsed.subject || "(No Subject)",
    from: fromAddr || { address: "unknown@unknown.local" },
    to: getAllAddresses(parsed.to),
    cc: parsed.cc ? getAllAddresses(parsed.cc) : undefined,
    date: parsed.date || new Date(),
  };
}

/**
 * Extract first address from AddressObject
 */
function getFirstAddress(addr: AddressObject | undefined): { name?: string; address: string } | undefined {
  if (!addr?.value?.length) return undefined;
  const first = addr.value[0];
  return {
    name: first.name || undefined,
    address: first.address || "unknown@unknown.local",
  };
}

/**
 * Get all addresses from AddressObject
 */
function getAllAddresses(addr: AddressObject | AddressObject[] | undefined): Array<{ name?: string; address: string }> {
  if (!addr) return [];

  const objects = Array.isArray(addr) ? addr : [addr];
  const result: Array<{ name?: string; address: string }> = [];

  for (const obj of objects) {
    if (obj?.value) {
      for (const entry of obj.value) {
        if (entry.address) {
          result.push({
            name: entry.name || undefined,
            address: entry.address,
          });
        }
      }
    }
  }

  return result;
}

/**
 * Parse References header into array of message IDs
 */
function parseReferences(refs: string | string[] | undefined): string[] {
  if (!refs) return [];
  if (Array.isArray(refs)) return refs;
  // References header is space-separated
  return refs.split(/\s+/).filter(Boolean);
}

/**
 * Extract plain text content from email
 * Prefers text/plain, falls back to stripped HTML
 */
export function extractContent(parsed: ParsedMail): string {
  // Prefer plain text
  if (parsed.text) {
    return parsed.text.trim();
  }

  // Fallback: strip HTML
  if (parsed.html) {
    return stripHtml(parsed.html);
  }

  return "";
}

/**
 * Strip HTML tags and clean up content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize subject for threading (strip Re:, Fwd:, etc.)
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(Re|Fwd|Fw|RE|FWD|FW):\s*/gi, "")
    .replace(/^\[.*?\]\s*/g, "") // Remove [list-name] prefixes
    .trim()
    .toLowerCase();
}

/**
 * Check if email is outgoing (sent by user)
 */
export function isOutgoing(fromAddress: string, myAddress: string): boolean {
  return fromAddress.toLowerCase() === myAddress.toLowerCase();
}

/**
 * Create account ID from email address
 */
export function createAccountId(email: string): string {
  // Normalize: lowercase, replace @ and . with _
  return `email_${email.toLowerCase().replace(/[@.]/g, "_")}`;
}

/**
 * Build thread ID using RFC 5256-inspired algorithm
 *
 * Priority:
 * 1. In-Reply-To → use parent's thread
 * 2. References → use first reference's thread
 * 3. Subject + Participants → fallback to normalized subject hash (includes participants to avoid collision)
 * 4. New thread → use Message-ID
 *
 * Note: Subject-based threading includes participant hash to prevent grouping
 * unrelated emails that happen to have the same subject.
 */
export function buildThreadId(
  metadata: EmailMetadata,
  messageIdToThread: Map<string, string>,
  subjectToThread: Map<string, string>
): string {
  // 1. Check In-Reply-To
  if (metadata.inReplyTo && messageIdToThread.has(metadata.inReplyTo)) {
    const threadId = messageIdToThread.get(metadata.inReplyTo)!;
    messageIdToThread.set(metadata.messageId, threadId);
    return threadId;
  }

  // 2. Check References (oldest first - the thread root)
  for (const refId of metadata.references) {
    if (messageIdToThread.has(refId)) {
      const threadId = messageIdToThread.get(refId)!;
      messageIdToThread.set(metadata.messageId, threadId);
      return threadId;
    }
  }

  // 3. Subject + Participants based fallback
  // Include participants to avoid grouping unrelated emails with same subject
  const normalizedSubject = normalizeSubject(metadata.subject);
  const participantKey = getParticipantKey(metadata);
  const subjectKey = normalizedSubject ? `${normalizedSubject}::${participantKey}` : "";

  if (subjectKey && subjectToThread.has(subjectKey)) {
    const threadId = subjectToThread.get(subjectKey)!;
    messageIdToThread.set(metadata.messageId, threadId);
    return threadId;
  }

  // 4. Create new thread from root message ID
  const threadRoot = metadata.references[0] || metadata.messageId;
  const hash = createHash("sha256").update(threadRoot).digest("hex").slice(0, 12);
  const threadId = `email_${hash}`;

  messageIdToThread.set(metadata.messageId, threadId);
  if (subjectKey) {
    subjectToThread.set(subjectKey, threadId);
  }

  return threadId;
}

/**
 * Create a participant key for subject-based threading
 * Combines sorted participant emails to identify the conversation
 */
function getParticipantKey(metadata: EmailMetadata): string {
  const participants = new Set<string>();
  participants.add(metadata.from.address.toLowerCase());
  for (const to of metadata.to) {
    participants.add(to.address.toLowerCase());
  }
  // Sort for consistency regardless of who is sender/receiver
  return Array.from(participants).sort().join(",");
}

/**
 * Build author object for message
 */
export function buildAuthor(metadata: EmailMetadata): Author {
  return {
    name: metadata.from.name || metadata.from.address.split("@")[0],
    handle: metadata.from.address,
  };
}

/**
 * Convert parsed email to MessageInput
 */
export function emailToMessageInput(
  parsed: ParsedMail,
  context: EmailParseContext,
  threadId: string,
  accountId: string
): MessageInput {
  const metadata = extractMetadata(parsed);
  const content = extractContent(parsed);

  const tags: [string, string][] = [];

  // Add subject as tag
  if (metadata.subject && metadata.subject !== "(No Subject)") {
    tags.push(["subject", metadata.subject]);
  }

  // Add folder if provided
  if (context.folder) {
    tags.push(["folder", context.folder]);
  }

  // Add CC recipients
  if (metadata.cc && metadata.cc.length > 0) {
    tags.push(["cc", metadata.cc.map((c) => c.address).join(", ")]);
  }

  // Add inbox identifier for filtering by receiving account
  if (context.inbox) {
    tags.push(["inbox", context.inbox]);
  }

  return {
    kind: Kind.Email,
    content,
    title: metadata.subject !== "(No Subject)" ? metadata.subject : undefined,
    account_id: accountId,
    author: buildAuthor(metadata),
    created_at: metadata.date.getTime(),
    refs: {
      thread_id: threadId,
      reply_to: metadata.inReplyTo || undefined,
    },
    source: {
      platform: "email",
      platform_id: metadata.messageId,
    },
    tags: tags.length > 0 ? tags : undefined,
  };
}

/**
 * Sanitize filename for safe storage
 * Note: Does NOT truncate - filesystem limits are 255 chars,
 * and truncation would violate CLAUDE.md guidelines about data loss.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[\/\\]/g, "_") // No directory separators
    .replace(/^\.+/g, "_") // No hidden files
    .replace(/[<>:"|?*]/g, "_"); // Windows-unsafe chars
}
