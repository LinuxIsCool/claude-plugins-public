/**
 * Messages MCP Server
 *
 * Exposes message store functionality as MCP tools.
 * Provides programmatic access to messages, search, and import.
 */

import { createStore, MessageStore } from "../core/store";
import { createSearchIndex, SearchIndex } from "../search";
import { createAnalytics, MessageAnalytics } from "../analytics";
import { importLogging, countLoggingEvents, getDefaultLogsDir } from "../adapters/logging";
import { importTelegramExport, countTelegramExport } from "../adapters/telegram";
import {
  importSignal,
  countSignalMessages,
  getSignalConnectionStatus,
  listSignalConversations,
  countSignalBackupMessages,
  importSignalBackup,
} from "../adapters/signal";
import { Kind, kindName } from "../types";
import type { Message, MessageInput, MessageFilter } from "../types";

// MCP server implementation using stdio
// This follows the Model Context Protocol specification

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP Server for Messages plugin
 */
export class MessagesMCPServer {
  private store: MessageStore;
  private search: SearchIndex;

  constructor() {
    this.store = createStore();
    this.search = createSearchIndex();
  }

  /**
   * Handle MCP request
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      let result: unknown;

      switch (method) {
        case "initialize":
          result = this.handleInitialize();
          break;

        case "tools/list":
          result = this.handleToolsList();
          break;

        case "tools/call":
          result = await this.handleToolCall(params as { name: string; arguments: Record<string, unknown> });
          break;

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }

      return { jsonrpc: "2.0", id, result };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize() {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "messages",
        version: "0.1.0",
      },
    };
  }

  /**
   * List available tools
   */
  private handleToolsList() {
    return {
      tools: [
        {
          name: "messages_search",
          description: "Search messages by content using full-text search",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              limit: { type: "number", description: "Max results (default 20)" },
              platforms: {
                type: "array",
                items: { type: "string" },
                description: "Filter by platform (telegram, claude-code, etc.)",
              },
              kinds: {
                type: "array",
                items: { type: "number" },
                description: "Filter by message kind",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "messages_recent",
          description: "Get recent messages across all platforms",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max results (default 20)" },
              platform: { type: "string", description: "Filter by platform" },
            },
          },
        },
        {
          name: "messages_thread",
          description: "Get messages from a specific thread/conversation",
          inputSchema: {
            type: "object",
            properties: {
              thread_id: { type: "string", description: "Thread ID" },
              limit: { type: "number", description: "Max results (default 50)" },
            },
            required: ["thread_id"],
          },
        },
        {
          name: "messages_stats",
          description: "Get statistics about indexed messages",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "messages_import_logs",
          description: "Import messages from Claude Code logging plugin",
          inputSchema: {
            type: "object",
            properties: {
              include_tool_use: {
                type: "boolean",
                description: "Include tool use events (default false)",
              },
              include_system: {
                type: "boolean",
                description: "Include session start/end (default false)",
              },
              dry_run: {
                type: "boolean",
                description: "Count messages without importing",
              },
            },
          },
        },
        {
          name: "messages_import_telegram",
          description: "Import messages from a Telegram export file",
          inputSchema: {
            type: "object",
            properties: {
              file_path: { type: "string", description: "Path to Telegram export JSON" },
              dry_run: {
                type: "boolean",
                description: "Count messages without importing",
              },
            },
            required: ["file_path"],
          },
        },
        {
          name: "messages_threads_list",
          description: "List all conversation threads",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max results (default 50)" },
            },
          },
        },
        {
          name: "messages_accounts_list",
          description: "List all accounts/identities",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max results (default 50)" },
            },
          },
        },
        {
          name: "messages_import_signal",
          description: "Import messages from Signal via signal-cli daemon. Requires signal-cli daemon running.",
          inputSchema: {
            type: "object",
            properties: {
              dry_run: {
                type: "boolean",
                description: "Check status and list conversations without importing",
              },
              realtime: {
                type: "boolean",
                description: "Continue listening for new messages",
              },
              timeout: {
                type: "number",
                description: "Realtime listen timeout in seconds (default 60)",
              },
            },
          },
        },
        {
          name: "messages_signal_status",
          description: "Check Signal configuration and daemon status",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "messages_import_signal_backup",
          description:
            "Import historical messages from a decrypted Signal Android backup database. " +
            "Use this for bulk historical imports after decrypting a .backup file with signal_for_android_decryption.",
          inputSchema: {
            type: "object",
            properties: {
              database_path: {
                type: "string",
                description: "Path to decrypted database.sqlite from Signal backup",
              },
              dry_run: {
                type: "boolean",
                description: "Count messages without importing (recommended first)",
              },
              since: {
                type: "string",
                description: "Only import messages after this date (ISO 8601 format)",
              },
            },
            required: ["database_path"],
          },
        },
        {
          name: "messages_contact_priorities",
          description:
            "Get contact priorities with outbound message weighting. " +
            "Ranks contacts by how often YOU message THEM (outbound), which indicates priority. " +
            "Aggregates across platforms by normalized name for cross-platform identity.",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Max results (default 50)",
              },
              exclude_self: {
                type: "array",
                items: { type: "string" },
                description: "Names/patterns to exclude as self (e.g., ['ygg', 'velkan'])",
              },
            },
          },
        },
      ],
    };
  }

  /**
   * Handle tool call
   */
  private async handleToolCall(params: { name: string; arguments: Record<string, unknown> }) {
    const { name, arguments: args } = params;

    switch (name) {
      case "messages_search":
        return this.toolSearch(args);

      case "messages_recent":
        return this.toolRecent(args);

      case "messages_thread":
        return this.toolThread(args);

      case "messages_stats":
        return this.toolStats();

      case "messages_import_logs":
        return this.toolImportLogs(args);

      case "messages_import_telegram":
        return this.toolImportTelegram(args);

      case "messages_threads_list":
        return this.toolThreadsList(args);

      case "messages_accounts_list":
        return this.toolAccountsList(args);

      case "messages_import_signal":
        return this.toolImportSignal(args);

      case "messages_signal_status":
        return this.toolSignalStatus();

      case "messages_import_signal_backup":
        return this.toolImportSignalBackup(args);

      case "messages_contact_priorities":
        return this.toolContactPriorities(args);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Search messages
   */
  private toolSearch(args: Record<string, unknown>) {
    const query = args.query as string;
    const limit = (args.limit as number) || 20;
    const platforms = args.platforms as string[] | undefined;
    const kinds = args.kinds as number[] | undefined;

    const results = this.search.search(query, { limit, platforms, kinds });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: results.length,
              results: results.map((r) => ({
                score: r.score.toFixed(2),
                kind: kindName(r.message.kind as number),
                platform: r.message.source.platform,
                author: r.message.author.name,
                date: new Date(r.message.created_at).toISOString(),
                content: r.message.content.slice(0, 200) + (r.message.content.length > 200 ? "..." : ""),
                id: r.message.id,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get recent messages
   */
  private toolRecent(args: Record<string, unknown>) {
    const limit = (args.limit as number) || 20;
    const messages = this.search.recent(limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: messages.length,
              messages: messages.map((m) => ({
                kind: kindName(m.kind as number),
                platform: m.source.platform,
                author: m.author.name,
                date: new Date(m.created_at).toISOString(),
                content: m.content.slice(0, 200) + (m.content.length > 200 ? "..." : ""),
                id: m.id,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get thread messages
   */
  private toolThread(args: Record<string, unknown>) {
    const threadId = args.thread_id as string;
    const limit = (args.limit as number) || 50;

    const messages = this.search.getThreadMessages(threadId, limit);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              thread_id: threadId,
              count: messages.length,
              messages: messages.map((m) => ({
                author: m.author.name,
                date: new Date(m.created_at).toISOString(),
                content: m.content.slice(0, 300) + (m.content.length > 300 ? "..." : ""),
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get statistics
   */
  private toolStats() {
    const stats = this.search.stats();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              total_messages: stats.total,
              by_kind: stats.byKind,
              by_platform: stats.byPlatform,
              date_range: stats.dateRange
                ? {
                    first: new Date(stats.dateRange.first).toISOString(),
                    last: new Date(stats.dateRange.last).toISOString(),
                  }
                : null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Import from logging plugin
   */
  private async toolImportLogs(args: Record<string, unknown>) {
    const logsDir = getDefaultLogsDir();
    const dryRun = args.dry_run as boolean;

    if (dryRun) {
      const counts = await countLoggingEvents(logsDir);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dry_run: true,
                files: counts.files,
                events: counts.events,
                sessions: counts.sessions.size,
                event_types: Object.fromEntries(counts.eventTypes),
                date_range: counts.dateRange,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let imported = 0;
    const generator = importLogging(logsDir, this.store, {
      includeToolUse: args.include_tool_use as boolean,
      includeSystemEvents: args.include_system as boolean,
    });

    for await (const message of generator) {
      this.search.index(message);
      imported++;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ imported, source: "claude-code-logging" }, null, 2),
        },
      ],
    };
  }

  /**
   * Import from Telegram
   */
  private async toolImportTelegram(args: Record<string, unknown>) {
    const filePath = args.file_path as string;
    const dryRun = args.dry_run as boolean;

    if (dryRun) {
      const counts = await countTelegramExport(filePath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dry_run: true,
                chats: counts.chats,
                messages: counts.messages,
                participants: Array.from(counts.participants),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let imported = 0;
    const generator = importTelegramExport(filePath, this.store);

    for await (const message of generator) {
      this.search.index(message);
      imported++;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ imported, source: "telegram" }, null, 2),
        },
      ],
    };
  }

  /**
   * List threads
   */
  private async toolThreadsList(args: Record<string, unknown>) {
    const limit = (args.limit as number) || 50;
    const threads: Array<{
      id: string;
      title?: string;
      type: string;
      platform: string;
      message_count: number;
    }> = [];

    let count = 0;
    for await (const thread of this.store.listThreads()) {
      if (count++ >= limit) break;
      threads.push({
        id: thread.id,
        title: thread.title,
        type: thread.type,
        platform: thread.source.platform,
        message_count: thread.message_count,
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: threads.length, threads }, null, 2),
        },
      ],
    };
  }

  /**
   * List accounts
   */
  private async toolAccountsList(args: Record<string, unknown>) {
    const limit = (args.limit as number) || 50;
    const accounts: Array<{
      id: string;
      name: string;
      platforms: string[];
    }> = [];

    let count = 0;
    for await (const account of this.store.listAccounts()) {
      if (count++ >= limit) break;
      accounts.push({
        id: account.id,
        name: account.name,
        platforms: account.identities.map((i) => i.platform),
      });
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: accounts.length, accounts }, null, 2),
        },
      ],
    };
  }

  /**
   * Import from Signal
   */
  private async toolImportSignal(args: Record<string, unknown>) {
    const dryRun = args.dry_run as boolean;
    const realtime = args.realtime as boolean;
    const timeout = (args.timeout as number) || 60;

    // Check status first
    const status = await getSignalConnectionStatus();

    if (!status.configured) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Signal not configured",
                help: "Set SIGNAL_PHONE environment variable (e.g., +1234567890)",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (!status.daemonRunning) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Signal daemon not running",
                help: `Start it with: signal-cli -a ${status.phone} daemon --tcp`,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    if (dryRun) {
      const counts = await countSignalMessages();
      const conversations = await listSignalConversations();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dry_run: true,
                status: "ready",
                phone: status.phone,
                conversations: counts.conversations,
                estimated_messages: counts.estimatedMessages,
                conversation_list: conversations.slice(0, 20).map((c) => ({
                  id: c.id,
                  name: c.name,
                  type: c.type,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let imported = 0;
    const generator = importSignal(this.store, {
      realtime,
      realtimeTimeout: realtime ? timeout * 1000 : undefined,
    });

    for await (const message of generator) {
      this.search.index(message);
      imported++;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              imported,
              source: "signal",
              phone: status.phone,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Check Signal status
   */
  private async toolSignalStatus() {
    const status = await getSignalConnectionStatus();

    let conversations: Array<{ id: string; name: string; type: string }> = [];
    if (status.daemonRunning) {
      try {
        const convList = await listSignalConversations();
        conversations = convList.slice(0, 10).map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));
      } catch {
        // Ignore errors listing conversations
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              configured: status.configured,
              phone: status.phone || null,
              daemon_running: status.daemonRunning,
              binary_exists: status.binaryExists,
              ready: status.configured && status.daemonRunning,
              conversations: conversations.length > 0 ? conversations : undefined,
              help: !status.configured
                ? "Set SIGNAL_PHONE environment variable"
                : !status.daemonRunning
                ? `Start daemon with: signal-cli -a ${status.phone} daemon --tcp`
                : "Ready to sync",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Import from Signal Android backup
   */
  private async toolImportSignalBackup(args: Record<string, unknown>) {
    const databasePath = args.database_path as string;
    const dryRun = args.dry_run as boolean;
    const sinceStr = args.since as string | undefined;

    // Expand ~ in path
    const expandedPath = databasePath.replace(/^~/, process.env.HOME || "");

    // Check if file exists
    const file = Bun.file(expandedPath);
    if (!(await file.exists())) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: "Database file not found",
                path: expandedPath,
                help: "Decrypt Signal backup first with: python3 decrypt_backup.py -p 'PASSPHRASE' backup.backup output/",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const options = {
      databasePath: expandedPath,
      since: sinceStr ? new Date(sinceStr) : undefined,
      dryRun,
    };

    if (dryRun) {
      const counts = await countSignalBackupMessages(options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                dry_run: true,
                total_messages: counts.totalMessages,
                readable_messages: counts.readableMessages,
                threads: counts.threads,
                recipients: counts.recipients,
                date_range: counts.dateRange.earliest
                  ? {
                      earliest: counts.dateRange.earliest.toISOString(),
                      latest: counts.dateRange.latest?.toISOString(),
                    }
                  : null,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    let imported = 0;
    const generator = importSignalBackup(this.store, options);
    let stats: { totalMessages: number; readableMessages: number; threads: number } | undefined;

    for await (const message of generator) {
      this.search.index(message);
      imported++;
    }

    // Get final return value
    const finalResult = await generator.return(undefined);
    if (finalResult.value) {
      stats = finalResult.value;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              imported,
              source: "signal-backup",
              database: expandedPath,
              stats: stats
                ? {
                    total_in_backup: stats.totalMessages,
                    readable: stats.readableMessages,
                    threads: stats.threads,
                  }
                : undefined,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  /**
   * Get contact priorities with outbound weighting
   */
  private toolContactPriorities(args: Record<string, unknown>) {
    const limit = (args.limit as number) || 50;
    const excludeSelf = (args.exclude_self as string[]) || [
      "ygg",
      "shawn anderson",
      "me", // Signal uses "Me" for outgoing messages
      process.env.USER?.toLowerCase() || "",
    ].filter(Boolean);

    const analytics = createAnalytics();

    try {
      const priorities = analytics.getContactPriorities({
        limit,
        excludeSelf,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: priorities.length,
                scoring_formula:
                  "outbound(50×out) + volume(20×log10(total)) + recency(10/days) + diversity(10×threads)",
                insight:
                  "Contacts ranked by how often YOU message THEM - outbound indicates priority",
                contacts: priorities.map((c) => ({
                  name: c.display_name,
                  normalized: c.normalized_name,
                  platforms: c.platforms,
                  outbound: c.outbound_messages,
                  inbound: c.inbound_messages,
                  total: c.total_messages,
                  threads: c.thread_count,
                  days_since_last: c.days_since_last,
                  priority_score: c.priority_score,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    } finally {
      analytics.close();
    }
  }

  /**
   * Run the server (stdio)
   */
  async run(): Promise<void> {
    const reader = Bun.stdin.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Read from stdin
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          try {
            const request = JSON.parse(line) as MCPRequest;
            const response = await this.handleRequest(request);
            console.log(JSON.stringify(response));
          } catch (error) {
            console.error("Parse error:", error);
          }
        }
      }
    }
  }
}

// Run if executed directly
if (import.meta.main) {
  const server = new MessagesMCPServer();
  server.run().catch(console.error);
}
