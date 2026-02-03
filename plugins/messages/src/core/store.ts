/**
 * Message Store
 *
 * Append-only event log with content-addressed storage.
 * Follows patterns from logging plugin (JSONL events + markdown content).
 *
 * Storage structure:
 * .claude/messages/
 * ├── store/
 * │   ├── events/              # Append-only JSONL (source of truth)
 * │   │   └── YYYY/MM/DD/
 * │   │       └── events.jsonl
 * │   └── content/             # Content-addressed markdown files
 * │       └── XX/              # First 2 chars of CID (after prefix)
 * │           └── {cid}.md
 * ├── views/                   # Materialized projections
 * │   ├── threads/
 * │   ├── accounts/
 * │   └── timeline/
 * └── search/
 *     └── index.db             # SQLite FTS5
 */

import { join } from "path";
import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, statSync } from "fs";
import { generateCID } from "./cid";
import { getMessagesBasePath } from "../config";
import type {
  Message,
  MessageInput,
  MessageFilter,
  Account,
  AccountInput,
  Thread,
  ThreadInput,
  Event,
  MessageCreatedEvent,
  AccountCreatedEvent,
  ThreadCreatedEvent,
} from "../types";

/**
 * Message Store - Core data access layer
 */
export class MessageStore {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? getMessagesBasePath();
    this.ensureDirectories();
  }

  // ===========================================================================
  // Directory Management
  // ===========================================================================

  private ensureDirectories(): void {
    const dirs = [
      "store/events",
      "store/content",
      "views/threads",
      "views/accounts",
      "views/timeline",
      "search",
    ];

    for (const dir of dirs) {
      const path = join(this.basePath, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    }
  }

  /**
   * Get path for today's event log
   */
  private getEventLogPath(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const dir = join(this.basePath, "store/events", String(year), month, day);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return join(dir, "events.jsonl");
  }

  /**
   * Get path for a content file
   */
  private getContentPath(cid: string): string {
    // Use characters after "msg_" prefix for directory
    const prefix = cid.slice(4, 6);
    const dir = join(this.basePath, "store/content", prefix);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return join(dir, `${cid}.md`);
  }

  // ===========================================================================
  // Event Log
  // ===========================================================================

  /**
   * Append an event to the log
   */
  private appendEvent(event: Event): void {
    const path = this.getEventLogPath();
    appendFileSync(path, JSON.stringify(event) + "\n");
  }

  /**
   * Iterate over all events (for rebuilding views)
   */
  async *getAllEvents(): AsyncGenerator<Event> {
    const eventsDir = join(this.basePath, "store/events");

    if (!existsSync(eventsDir)) {
      return;
    }

    // Scan year directories
    const years = readdirSync(eventsDir).filter((f) =>
      statSync(join(eventsDir, f)).isDirectory()
    );

    for (const year of years.sort()) {
      const yearDir = join(eventsDir, year);
      const months = readdirSync(yearDir).filter((f) =>
        statSync(join(yearDir, f)).isDirectory()
      );

      for (const month of months.sort()) {
        const monthDir = join(yearDir, month);
        const days = readdirSync(monthDir).filter((f) =>
          statSync(join(monthDir, f)).isDirectory()
        );

        for (const day of days.sort()) {
          const eventFile = join(monthDir, day, "events.jsonl");

          if (existsSync(eventFile)) {
            const content = readFileSync(eventFile, "utf-8");

            for (const line of content.trim().split("\n")) {
              if (line) {
                yield JSON.parse(line) as Event;
              }
            }
          }
        }
      }
    }
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  /**
   * Create a new message
   *
   * Write order: content file first, then event log.
   * This ensures that if crash occurs after content write, we have the content
   * and can detect missing event on next scan. Event without content is harder to recover.
   */
  async createMessage(input: MessageInput, options?: { skipThreadUpdate?: boolean }): Promise<Message> {
    const id = generateCID(input);

    const message: Message = {
      ...input,
      id,
      imported_at: Date.now(),
    };

    // Write content file first (recoverable if event write fails)
    await this.writeContentFile(message);

    // Then append to event log (source of truth)
    const event: MessageCreatedEvent = {
      ts: new Date().toISOString(),
      op: "message.created",
      data: message,
    };
    this.appendEvent(event);

    // Update thread stats (skip for bulk imports - use rebuildThreadViews instead)
    if (!options?.skipThreadUpdate && message.refs.thread_id) {
      void this.updateThreadStats(message.refs.thread_id, message.created_at);
    }

    return message;
  }

  /**
   * Write message as markdown content file
   */
  private async writeContentFile(message: Message): Promise<void> {
    const path = this.getContentPath(message.id);

    // Build YAML frontmatter
    const frontmatter: Record<string, unknown> = {
      id: message.id,
      kind: message.kind,
      account_id: message.account_id,
      created_at: message.created_at,
      imported_at: message.imported_at,
    };

    if (message.author.did) frontmatter.author_did = message.author.did;
    if (message.author.name) frontmatter.author_name = message.author.name;
    if (message.title) frontmatter.title = message.title;
    if (message.visibility) frontmatter.visibility = message.visibility;

    if (message.refs.thread_id) frontmatter.thread_id = message.refs.thread_id;
    if (message.refs.reply_to) frontmatter.reply_to = message.refs.reply_to;
    if (message.refs.room_id) frontmatter.room_id = message.refs.room_id;

    frontmatter.platform = message.source.platform;
    if (message.source.platform_id) frontmatter.platform_id = message.source.platform_id;
    if (message.source.session_id) frontmatter.session_id = message.source.session_id;
    if (message.source.agent_id) frontmatter.agent_id = message.source.agent_id;

    if (message.tags && message.tags.length > 0) {
      frontmatter.tags = message.tags;
    }

    // Format YAML
    const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
      if (typeof value === "string") {
        // Quote strings that might need it
        if (value.includes(":") || value.includes("#") || value.includes("\n")) {
          return `${key}: "${value.replace(/"/g, '\\"')}"`;
        }
        return `${key}: ${value}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    });

    const content = `---
${yamlLines.join("\n")}
---

${message.content}
`;

    await Bun.write(path, content);
  }

  /**
   * Parse message from markdown content file
   *
   * Uses hand-rolled YAML parser matching the pattern in updateThreadStats().
   * The format is controlled by writeContentFile(), so we know exactly what to expect:
   * - Flat key-value pairs
   * - Values are plain strings, numbers, or JSON-serialized arrays/objects
   * - Content body follows the second `---` delimiter
   */
  private parseContentFile(path: string): Message | null {
    try {
      const content = readFileSync(path, "utf-8");

      // Extract frontmatter and body
      // Format: ---\n{frontmatter}\n---\n\n{body}
      const match = content.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
      if (!match) return null;

      const [, frontmatterText, body] = match;
      const lines = frontmatterText.split("\n");

      // Parse frontmatter line-by-line
      const fm: Record<string, unknown> = {};
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();

          // Try JSON parse for numbers, arrays, objects
          // Falls back to string on parse failure
          try {
            fm[key] = JSON.parse(value);
          } catch {
            fm[key] = value;
          }
        }
      }

      // Validate required fields exist and have correct types
      // Return null to trigger fallback to event scan if validation fails
      if (typeof fm.id !== "string" || !fm.id) return null;
      if (typeof fm.account_id !== "string" || !fm.account_id) return null;
      if (typeof fm.kind !== "number") return null;
      if (typeof fm.created_at !== "number" || Number.isNaN(fm.created_at)) return null;
      if (typeof fm.imported_at !== "number" || Number.isNaN(fm.imported_at)) return null;
      if (typeof fm.platform !== "string" || !fm.platform) return null;

      // Reconstruct Message object from validated frontmatter
      const message: Message = {
        // Identity
        id: fm.id as string,

        // Authorship
        account_id: fm.account_id as string,
        author: {
          did: fm.author_did as string | undefined,
          name: fm.author_name as string | undefined,
          handle: fm.author_handle as string | undefined,
        },

        // Temporal
        created_at: fm.created_at as number,
        imported_at: fm.imported_at as number,

        // Classification
        kind: fm.kind as number,
        visibility: fm.visibility as "public" | "private" | "direct" | undefined,

        // Content
        content: body.trimEnd(),
        title: fm.title as string | undefined,

        // Structure (refs)
        refs: {
          thread_id: fm.thread_id as string | undefined,
          reply_to: fm.reply_to as string | undefined,
          room_id: fm.room_id as string | undefined,
          mentions: fm.mentions as string[] | undefined,
        },

        // Source
        source: {
          platform: fm.platform as string,
          platform_id: fm.platform_id as string | undefined,
          url: fm.url as string | undefined,
          session_id: fm.session_id as string | undefined,
          agent_id: fm.agent_id as string | undefined,
        },

        // Metadata
        tags: fm.tags as [string, string][] | undefined,
      };

      return message;
    } catch (error) {
      // Parse failed - caller will fallback to event scan
      console.warn(`Failed to parse content file ${path}:`, error);
      return null;
    }
  }

  /**
   * Get a message by CID
   *
   * Primary path: Parse content file directly (O(1))
   * Fallback path: Scan event log (O(n)) if content file missing or malformed
   */
  async getMessage(id: string): Promise<Message | null> {
    const path = this.getContentPath(id);

    if (existsSync(path)) {
      // Try parsing content file directly (fast path)
      const message = this.parseContentFile(path);
      if (message) return message;

      // Parse failed - warn and fall through to event scan
      console.warn(`Content file exists but failed to parse: ${path}`);
    }

    // Fallback: scan events (for recovery or if content file missing)
    for await (const event of this.getAllEvents()) {
      if (event.op === "message.created" && (event as MessageCreatedEvent).data.id === id) {
        return (event as MessageCreatedEvent).data;
      }
    }

    return null;
  }

  /**
   * List messages with optional filtering
   */
  async *listMessages(filter?: MessageFilter): AsyncGenerator<Message> {
    let count = 0;
    const limit = filter?.limit ?? Infinity;
    const offset = filter?.offset ?? 0;
    let skipped = 0;

    for await (const event of this.getAllEvents()) {
      if (event.op !== "message.created") continue;

      const message = (event as MessageCreatedEvent).data;

      // Apply filters
      if (filter?.kinds && !filter.kinds.includes(message.kind as number)) continue;
      if (filter?.accounts && !filter.accounts.includes(message.account_id)) continue;
      if (filter?.threads && message.refs.thread_id && !filter.threads.includes(message.refs.thread_id)) continue;
      if (filter?.platforms && !filter.platforms.includes(message.source.platform)) continue;
      if (filter?.since && message.created_at < filter.since) continue;
      if (filter?.until && message.created_at > filter.until) continue;

      // Handle offset
      if (skipped < offset) {
        skipped++;
        continue;
      }

      // Check limit
      if (count >= limit) break;

      yield message;
      count++;
    }
  }

  // ===========================================================================
  // Accounts
  // ===========================================================================

  /**
   * Create a new account
   */
  async createAccount(input: AccountInput): Promise<Account> {
    const account: Account = {
      ...input,
      created_at: Date.now(),
      stats: {
        message_count: 0,
      },
    };

    // Append to event log
    const event: AccountCreatedEvent = {
      ts: new Date().toISOString(),
      op: "account.created",
      data: account,
    };
    this.appendEvent(event);

    // Write account view file (fire and forget - views are derived)
    void this.writeAccountFile(account);

    return account;
  }

  /**
   * Write account to views
   */
  private async writeAccountFile(account: Account): Promise<void> {
    const path = join(this.basePath, "views/accounts", `${account.id}.md`);

    const frontmatter: Record<string, unknown> = {
      id: account.id,
      name: account.name,
      created_at: account.created_at,
    };

    if (account.did) frontmatter.did = account.did;
    if (account.avatar) frontmatter.avatar = account.avatar;
    if (account.identities.length > 0) frontmatter.identities = account.identities;
    if (account.agent) frontmatter.agent = account.agent;

    const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
      if (typeof value === "string") return `${key}: ${value}`;
      return `${key}: ${JSON.stringify(value)}`;
    });

    const content = `---
${yamlLines.join("\n")}
---

# ${account.name}

${account.identities.map((i) => `- ${i.platform}: ${i.handle}`).join("\n")}
`;

    await Bun.write(path, content);
  }

  /**
   * Get an account by ID
   */
  async getAccount(id: string): Promise<Account | null> {
    for await (const event of this.getAllEvents()) {
      if (event.op === "account.created" && (event as AccountCreatedEvent).data.id === id) {
        return (event as AccountCreatedEvent).data;
      }
    }
    return null;
  }

  /**
   * Get or create an account
   */
  async getOrCreateAccount(input: AccountInput): Promise<Account> {
    const existing = await this.getAccount(input.id);
    if (existing) return existing;
    return this.createAccount(input);
  }

  /**
   * List all accounts
   */
  async *listAccounts(limit?: number): AsyncGenerator<Account> {
    const seen = new Set<string>();
    let count = 0;
    const maxCount = limit ?? Infinity;

    for await (const event of this.getAllEvents()) {
      if (event.op === "account.created") {
        const account = (event as AccountCreatedEvent).data;
        if (!seen.has(account.id)) {
          seen.add(account.id);
          yield account;
          count++;
          if (count >= maxCount) return;
        }
      }
    }
  }

  // ===========================================================================
  // Threads
  // ===========================================================================

  /**
   * Create a new thread
   */
  async createThread(input: ThreadInput): Promise<Thread> {
    const thread: Thread = {
      ...input,
      created_at: Date.now(),
      message_count: 0,
    };

    // Append to event log
    const event: ThreadCreatedEvent = {
      ts: new Date().toISOString(),
      op: "thread.created",
      data: thread,
    };
    this.appendEvent(event);

    // Write thread view file (fire and forget - views are derived)
    void this.writeThreadFile(thread);

    return thread;
  }

  /**
   * Write thread to views
   */
  private async writeThreadFile(thread: Thread): Promise<void> {
    const path = join(this.basePath, "views/threads", `${thread.id}.md`);

    const frontmatter: Record<string, unknown> = {
      id: thread.id,
      type: thread.type,
      platform: thread.source.platform,
      created_at: thread.created_at,
      message_count: thread.message_count,
    };

    if (thread.title) frontmatter.title = thread.title;
    if (thread.participants.length > 0) frontmatter.participants = thread.participants;
    if (thread.last_message_at) frontmatter.last_message_at = thread.last_message_at;

    const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
      if (typeof value === "string") return `${key}: ${value}`;
      return `${key}: ${JSON.stringify(value)}`;
    });

    const content = `---
${yamlLines.join("\n")}
---

# ${thread.title || `Thread ${thread.id}`}

Type: ${thread.type}
Platform: ${thread.source.platform}
Messages: ${thread.message_count}
`;

    await Bun.write(path, content);
  }

  /**
   * Update thread stats when a message is added
   * Reads current view, increments count, rewrites
   */
  async updateThreadStats(threadId: string, messageTimestamp: number): Promise<void> {
    const viewPath = join(this.basePath, "views/threads", `${threadId}.md`);

    // Read existing view file
    const file = Bun.file(viewPath);
    if (!(await file.exists())) {
      // Thread view doesn't exist yet - will be created when thread is created
      return;
    }

    const content = await file.text();

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return;

    const frontmatterLines = frontmatterMatch[1].split("\n");
    const frontmatter: Record<string, string | number | string[]> = {};

    for (const line of frontmatterLines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        // Try to parse JSON for arrays/numbers
        try {
          frontmatter[key] = JSON.parse(value);
        } catch {
          frontmatter[key] = value;
        }
      }
    }

    // Update stats
    const currentCount = (frontmatter.message_count as number) || 0;
    frontmatter.message_count = currentCount + 1;

    const currentLast = frontmatter.last_message_at as number | undefined;
    if (!currentLast || messageTimestamp > currentLast) {
      frontmatter.last_message_at = messageTimestamp;
    }

    // Rebuild thread object for writeThreadFile
    const thread: Thread = {
      id: threadId,
      type: (frontmatter.type as "dm" | "group" | "channel" | "room") || "dm",
      title: frontmatter.title as string | undefined,
      participants: (frontmatter.participants as string[]) || [],
      source: {
        platform: frontmatter.platform as string,
        platform_id: frontmatter.platform_id as string | undefined,
      },
      created_at: frontmatter.created_at as number,
      message_count: frontmatter.message_count as number,
      last_message_at: frontmatter.last_message_at as number | undefined,
    };

    await this.writeThreadFile(thread);
  }

  /**
   * Rebuild all thread views from event store
   * Scans all messages, computes accurate stats, rewrites view files
   * Also creates views for orphan thread IDs (referenced in messages but no thread.created event)
   */
  async rebuildThreadViews(): Promise<{ threads: number; messages: number; orphans: number }> {
    // Collect thread stats from events
    const threadStats = new Map<string, { count: number; lastMessage?: number; firstMessage?: number }>();
    const threads = new Map<string, Thread>();
    let messageCount = 0;

    for await (const event of this.getAllEvents()) {
      if (event.op === "thread.created") {
        const thread = (event as ThreadCreatedEvent).data;
        threads.set(thread.id, { ...thread, message_count: 0 });
        if (!threadStats.has(thread.id)) {
          threadStats.set(thread.id, { count: 0 });
        }
      } else if (event.op === "message.created") {
        const message = (event as MessageCreatedEvent).data;
        messageCount++;
        if (message.refs.thread_id) {
          const stats = threadStats.get(message.refs.thread_id) || { count: 0 };
          stats.count++;
          if (!stats.lastMessage || message.created_at > stats.lastMessage) {
            stats.lastMessage = message.created_at;
          }
          if (!stats.firstMessage || message.created_at < stats.firstMessage) {
            stats.firstMessage = message.created_at;
          }
          threadStats.set(message.refs.thread_id, stats);
        }
      }
    }

    let orphanCount = 0;

    // Update threads with computed stats and write files
    for (const [threadId, stats] of threadStats) {
      let thread = threads.get(threadId);

      // Create synthetic thread for orphan thread IDs (messages exist but no thread.created event)
      if (!thread && stats.count > 0) {
        orphanCount++;
        // Infer platform and type from thread ID
        const isSignal = threadId.startsWith("signal_");
        const isTelegram = threadId.startsWith("telegram_");
        const isGroup = threadId.includes("_group_");
        const platform = isSignal ? "signal" : isTelegram ? "telegram" : "unknown";

        thread = {
          id: threadId,
          type: isGroup ? "group" : "dm",
          title: threadId.replace(/^(signal|telegram)_(dm|group)_/, ""),
          participants: [],
          source: { platform, platform_id: threadId },
          created_at: stats.firstMessage || Date.now(),
          message_count: 0,
        };
        threads.set(threadId, thread);
      }

      if (thread) {
        thread.message_count = stats.count;
        if (stats.lastMessage) {
          thread.last_message_at = stats.lastMessage;
        }
        await this.writeThreadFile(thread);
      }
    }

    return { threads: threads.size, messages: messageCount, orphans: orphanCount };
  }

  /**
   * Get a thread by ID
   */
  async getThread(id: string): Promise<Thread | null> {
    for await (const event of this.getAllEvents()) {
      if (event.op === "thread.created" && (event as ThreadCreatedEvent).data.id === id) {
        return (event as ThreadCreatedEvent).data;
      }
    }
    return null;
  }

  /**
   * Get or create a thread
   */
  async getOrCreateThread(input: ThreadInput): Promise<Thread> {
    const existing = await this.getThread(input.id);
    if (existing) return existing;
    return this.createThread(input);
  }

  /**
   * List all threads
   */
  async *listThreads(limit?: number): AsyncGenerator<Thread> {
    const seen = new Set<string>();
    let count = 0;
    const maxCount = limit ?? Infinity;

    for await (const event of this.getAllEvents()) {
      if (event.op === "thread.created") {
        const thread = (event as ThreadCreatedEvent).data;
        if (!seen.has(thread.id)) {
          seen.add(thread.id);
          yield thread;
          count++;
          if (count >= maxCount) return;
        }
      }
    }
  }

  /**
   * Get messages in a thread
   */
  async *getThreadMessages(threadId: string): AsyncGenerator<Message> {
    for await (const message of this.listMessages({ threads: [threadId] })) {
      yield message;
    }
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    messageCount: number;
    accountCount: number;
    threadCount: number;
    platforms: string[];
    dateRange: { first: number; last: number } | null;
  }> {
    let messageCount = 0;
    let accountCount = 0;
    let threadCount = 0;
    const platforms = new Set<string>();
    let first: number | null = null;
    let last: number | null = null;

    for await (const event of this.getAllEvents()) {
      if (event.op === "message.created") {
        messageCount++;
        const msg = (event as MessageCreatedEvent).data;
        platforms.add(msg.source.platform);

        if (first === null || msg.created_at < first) first = msg.created_at;
        if (last === null || msg.created_at > last) last = msg.created_at;
      } else if (event.op === "account.created") {
        accountCount++;
      } else if (event.op === "thread.created") {
        threadCount++;
      }
    }

    return {
      messageCount,
      accountCount,
      threadCount,
      platforms: Array.from(platforms),
      dateRange: first !== null && last !== null ? { first, last } : null,
    };
  }
}

/**
 * Create a message store instance
 */
export function createStore(basePath?: string): MessageStore {
  return new MessageStore(basePath);
}
