/**
 * Claude Code Logging Adapter
 *
 * Imports messages from the logging plugin's JSONL files.
 * Converts Claude Code events into the universal message format.
 *
 * Source: .claude/logging/YYYY/MM/DD/*.jsonl
 */

import { join } from "path";
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";
import { getClaudePath } from "../../../../lib/paths";

/**
 * Log event from logging plugin
 */
interface LogEvent {
  ts: string;
  type: string;
  session_id: string;
  data: Record<string, unknown>;
}

/**
 * User prompt event
 */
interface UserPromptEvent extends LogEvent {
  type: "UserPromptSubmit";
  data: {
    prompt: string;
    session_id: string;
    transcript_path?: string;
    cwd?: string;
  };
}

/**
 * Assistant response event
 */
interface AssistantResponseEvent extends LogEvent {
  type: "AssistantResponse";
  data: {
    response: string;
    session_id: string;
  };
}

/**
 * Session start event
 */
interface SessionStartEvent extends LogEvent {
  type: "SessionStart";
  data: {
    session_id: string;
    source?: string;
    cwd?: string;
    transcript_path?: string;
  };
}

/**
 * Session end event
 */
interface SessionEndEvent extends LogEvent {
  type: "SessionEnd";
  data: {
    session_id: string;
    reason?: string;
  };
}

/**
 * Subagent spawn/stop event
 */
interface SubagentEvent extends LogEvent {
  type: "SubagentStop";
  data: {
    agent_id: string;
    agent_transcript_path?: string;
    session_id: string;
  };
}

/**
 * Tool use event
 */
interface ToolUseEvent extends LogEvent {
  type: "PreToolUse" | "PostToolUse";
  data: {
    tool_name: string;
    tool_input: Record<string, unknown>;
    tool_use_id: string;
    session_id: string;
    tool_response?: unknown;
  };
}

/**
 * Import statistics
 */
export interface ImportStats {
  sessions: number;
  messages: number;
  events: number;
  skipped: number;
  dateRange: { first: string; last: string } | null;
}

/**
 * Map log event type to message kind
 */
function eventTypeToKind(type: string): number | null {
  switch (type) {
    case "SessionStart":
      return Kind.SessionStart;
    case "SessionEnd":
      return Kind.SessionEnd;
    case "UserPromptSubmit":
      return Kind.UserPrompt;
    case "AssistantResponse":
      return Kind.AssistantResponse;
    case "PreToolUse":
    case "PostToolUse":
      return Kind.ToolUse;
    case "SubagentStop":
      return Kind.SubagentStop;
    default:
      return null;
  }
}

/**
 * Extract content from a log event
 */
function extractContent(event: LogEvent): string | null {
  switch (event.type) {
    case "UserPromptSubmit":
      return (event as UserPromptEvent).data.prompt || null;

    case "AssistantResponse":
      return (event as AssistantResponseEvent).data.response || null;

    case "SessionStart": {
      const data = (event as SessionStartEvent).data;
      return `Session started: ${data.source || "unknown"}`;
    }

    case "SessionEnd": {
      const data = (event as SessionEndEvent).data;
      return `Session ended: ${data.reason || "unknown"}`;
    }

    case "SubagentStop": {
      const data = (event as SubagentEvent).data;
      return `Subagent ${data.agent_id} completed`;
    }

    case "PreToolUse": {
      const data = (event as ToolUseEvent).data;
      return `Tool: ${data.tool_name}\nInput: ${JSON.stringify(data.tool_input, null, 2)}`;
    }

    case "PostToolUse": {
      const data = (event as ToolUseEvent).data;
      const response = data.tool_response
        ? JSON.stringify(data.tool_response).slice(0, 500)
        : "no response";
      return `Tool: ${data.tool_name}\nResponse: ${response}`;
    }

    default:
      return null;
  }
}

/**
 * Determine account ID for event
 */
function getAccountId(event: LogEvent): string {
  switch (event.type) {
    case "UserPromptSubmit":
      return "user";
    case "AssistantResponse":
      return "claude";
    case "SubagentStop": {
      const data = (event as SubagentEvent).data;
      return `agent_${data.agent_id}`;
    }
    default:
      return "system";
  }
}

/**
 * Determine author name for event
 */
function getAuthorName(event: LogEvent): string {
  switch (event.type) {
    case "UserPromptSubmit":
      return "User";
    case "AssistantResponse":
      return "Claude";
    case "SubagentStop": {
      const data = (event as SubagentEvent).data;
      return `Agent ${data.agent_id}`;
    }
    default:
      return "System";
  }
}

/**
 * Scan log directory for JSONL files
 */
function* scanLogFiles(logsDir: string): Generator<{ path: string; date: string }> {
  if (!existsSync(logsDir)) {
    return;
  }

  // Scan year directories
  const years = readdirSync(logsDir).filter((f) =>
    statSync(join(logsDir, f)).isDirectory() && /^\d{4}$/.test(f)
  );

  for (const year of years.sort()) {
    const yearDir = join(logsDir, year);
    const months = readdirSync(yearDir).filter((f) =>
      statSync(join(yearDir, f)).isDirectory() && /^\d{2}$/.test(f)
    );

    for (const month of months.sort()) {
      const monthDir = join(yearDir, month);
      const days = readdirSync(monthDir).filter((f) =>
        statSync(join(monthDir, f)).isDirectory() && /^\d{2}$/.test(f)
      );

      for (const day of days.sort()) {
        const dayDir = join(monthDir, day);
        const files = readdirSync(dayDir).filter((f) => f.endsWith(".jsonl"));

        for (const file of files.sort()) {
          yield {
            path: join(dayDir, file),
            date: `${year}-${month}-${day}`,
          };
        }
      }
    }
  }
}

/**
 * Parse events from a JSONL file
 */
function* parseLogFile(filePath: string): Generator<LogEvent> {
  const content = readFileSync(filePath, "utf-8");

  for (const line of content.trim().split("\n")) {
    if (!line) continue;

    try {
      yield JSON.parse(line) as LogEvent;
    } catch {
      // Skip malformed lines
    }
  }
}

/**
 * Import messages from Claude Code logs
 *
 * @param logsDir Path to .claude/logging directory
 * @param store Message store instance
 * @param options Import options
 */
export async function* importLogging(
  logsDir: string,
  store: MessageStore,
  options: {
    since?: Date;
    until?: Date;
    includeToolUse?: boolean;
    includeSystemEvents?: boolean;
  } = {}
): AsyncGenerator<Message, ImportStats> {
  const stats: ImportStats = {
    sessions: 0,
    messages: 0,
    events: 0,
    skipped: 0,
    dateRange: null,
  };

  const seenSessions = new Set<string>();
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  // Ensure accounts exist
  await store.getOrCreateAccount({
    id: "user",
    name: "User",
    identities: [{ platform: "claude-code", handle: "user" }],
  });

  await store.getOrCreateAccount({
    id: "claude",
    name: "Claude",
    identities: [{ platform: "claude-code", handle: "claude" }],
    agent: {
      source: "project",
      model: "opus",
    },
  });

  await store.getOrCreateAccount({
    id: "system",
    name: "System",
    identities: [{ platform: "claude-code", handle: "system" }],
  });

  for (const { path, date } of scanLogFiles(logsDir)) {
    // Apply date filters
    if (options.since) {
      const fileDate = new Date(date);
      if (fileDate < options.since) continue;
    }
    if (options.until) {
      const fileDate = new Date(date);
      if (fileDate > options.until) continue;
    }

    // Track date range
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;

    for (const event of parseLogFile(path)) {
      stats.events++;

      // Track sessions
      if (event.type === "SessionStart" && !seenSessions.has(event.session_id)) {
        seenSessions.add(event.session_id);
        stats.sessions++;

        // Create thread for session
        await store.getOrCreateThread({
          id: `cc_${event.session_id.slice(0, 8)}`,
          title: `Claude Code Session ${event.session_id.slice(0, 8)}`,
          type: "topic",
          participants: ["user", "claude"],
          source: {
            platform: "claude-code",
            platform_id: event.session_id,
          },
        });
      }

      // Map event type to kind
      const kind = eventTypeToKind(event.type);
      if (kind === null) {
        stats.skipped++;
        continue;
      }

      // Filter based on options
      if (kind === Kind.ToolUse && !options.includeToolUse) {
        stats.skipped++;
        continue;
      }

      if (
        (kind === Kind.SessionStart || kind === Kind.SessionEnd) &&
        !options.includeSystemEvents
      ) {
        stats.skipped++;
        continue;
      }

      // Extract content
      const content = extractContent(event);
      if (!content) {
        stats.skipped++;
        continue;
      }

      // Build message input
      const accountId = getAccountId(event);
      const authorName = getAuthorName(event);

      // Create agent account if needed
      if (accountId.startsWith("agent_") && accountId !== "agent_") {
        const agentId = accountId.replace("agent_", "");
        await store.getOrCreateAccount({
          id: accountId,
          name: `Agent ${agentId}`,
          identities: [{ platform: "claude-code", handle: agentId }],
          agent: {
            source: "project",
          },
        });
      }

      const input: MessageInput = {
        kind,
        content,
        account_id: accountId,
        author: {
          name: authorName,
        },
        created_at: new Date(event.ts).getTime(),
        refs: {
          thread_id: `cc_${event.session_id.slice(0, 8)}`,
        },
        source: {
          platform: "claude-code",
          session_id: event.session_id,
          agent_id:
            event.type === "SubagentStop"
              ? (event as SubagentEvent).data.agent_id
              : undefined,
        },
        tags: [["event_type", event.type]],
      };

      const message = await store.createMessage(input);
      stats.messages++;

      yield message;
    }
  }

  stats.dateRange = firstDate && lastDate ? { first: firstDate, last: lastDate } : null;

  return stats;
}

/**
 * Count events in logging directory without importing
 */
export async function countLoggingEvents(logsDir: string): Promise<{
  files: number;
  events: number;
  sessions: Set<string>;
  eventTypes: Map<string, number>;
  dateRange: { first: string; last: string } | null;
}> {
  const sessions = new Set<string>();
  const eventTypes = new Map<string, number>();
  let files = 0;
  let events = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const { path, date } of scanLogFiles(logsDir)) {
    files++;

    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;

    for (const event of parseLogFile(path)) {
      events++;
      sessions.add(event.session_id);

      const count = eventTypes.get(event.type) || 0;
      eventTypes.set(event.type, count + 1);
    }
  }

  return {
    files,
    events,
    sessions,
    eventTypes,
    dateRange: firstDate && lastDate ? { first: firstDate, last: lastDate } : null,
  };
}

/**
 * Get default logging directory (anchored to repo root)
 */
export function getDefaultLogsDir(): string {
  return getClaudePath("logging");
}
