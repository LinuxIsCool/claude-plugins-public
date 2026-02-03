/**
 * Claude Web Adapter
 *
 * Imports messages from Claude Web data exports (ZIP download from claude.ai).
 * Export format: data-YYYY-MM-DD-HH-mm-ss-batch-XXXX.zip containing:
 * - conversations.json: Array of conversations with chat_messages
 * - users.json: User account information
 * - projects.json: Project data
 * - memories.json: User memories
 */

import type { MessageStore } from "../core/store";
import type { Message, MessageInput } from "../types";
import { Kind } from "../types";

// =============================================================================
// Claude Web Export Types
// =============================================================================

/**
 * Content block types in Claude Web messages
 */
interface ContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  text?: string;
  thinking?: string;
  name?: string; // For tool_use
  input?: Record<string, unknown>; // For tool_use
  tool_use_id?: string; // For tool_result
  content?: string | ContentBlock[]; // For tool_result
}

/**
 * Attachment in Claude Web messages
 */
interface ClaudeWebAttachment {
  file_name?: string;
  file_type?: string;
  file_size?: number;
  extracted_content?: string;
}

/**
 * File reference in Claude Web messages
 */
interface ClaudeWebFile {
  file_name?: string;
  file_type?: string;
}

/**
 * Individual message in a Claude Web conversation
 */
interface ClaudeWebMessage {
  uuid: string;
  text: string;
  content: ContentBlock[];
  sender: "human" | "assistant";
  created_at: string;
  updated_at: string;
  attachments: ClaudeWebAttachment[];
  files: ClaudeWebFile[];
}

/**
 * Claude Web conversation structure
 */
interface ClaudeWebConversation {
  uuid: string;
  name: string;
  summary: string;
  created_at: string;
  updated_at: string;
  account: { uuid: string };
  chat_messages: ClaudeWebMessage[];
}

/**
 * Import options for Claude Web
 */
export interface ClaudeWebImportOptions {
  /** Filter messages created after this date */
  since?: Date;
  /** Filter messages created before this date */
  until?: Date;
  /** Include [THINKING] blocks in content (default: true) */
  includeThinking?: boolean;
  /** Include tool_use/tool_result blocks (default: false) */
  includeTools?: boolean;
}

/**
 * Import statistics
 */
export interface ImportStats {
  conversations: number;
  messages: number;
  accounts: number;
  skipped: number;
  dateRange: {
    earliest?: Date;
    latest?: Date;
  };
}

// =============================================================================
// Content Extraction
// =============================================================================

/**
 * Extract text content from Claude Web content blocks
 *
 * Adapted from reference code at:
 * /home/user/Workspace/sandbox/personal-digital/claude_web/models.py
 */
function extractTextFromContentBlocks(
  contentBlocks: ContentBlock[],
  options: { includeThinking?: boolean; includeTools?: boolean } = {}
): string {
  const { includeThinking = true, includeTools = false } = options;

  if (!contentBlocks || contentBlocks.length === 0) {
    return "";
  }

  const textParts: string[] = [];

  for (const block of contentBlocks) {
    const blockType = block.type || "";

    if (blockType === "text" && block.text) {
      textParts.push(block.text);
    } else if (blockType === "thinking" && block.thinking && includeThinking) {
      textParts.push(`[THINKING] ${block.thinking}`);
    } else if (blockType === "tool_use" && includeTools) {
      const toolInfo = `[TOOL: ${block.name}] ${JSON.stringify(block.input, null, 2)}`;
      textParts.push(toolInfo);
    } else if (blockType === "tool_result" && includeTools) {
      const resultContent =
        typeof block.content === "string"
          ? block.content
          : Array.isArray(block.content)
            ? extractTextFromContentBlocks(block.content, options)
            : "";
      if (resultContent) {
        textParts.push(`[TOOL_RESULT] ${resultContent}`);
      }
    } else if (block.text) {
      // Fallback for blocks with text but unknown type
      textParts.push(block.text);
    }
  }

  return textParts.join("\n\n");
}

/**
 * Get content from a message, preferring content blocks over text field
 */
function getMessageContent(
  msg: ClaudeWebMessage,
  options: { includeThinking?: boolean; includeTools?: boolean } = {}
): string {
  // Try content blocks first (more structured)
  if (msg.content && msg.content.length > 0) {
    const extracted = extractTextFromContentBlocks(msg.content, options);
    if (extracted.trim()) {
      return extracted;
    }
  }

  // Fallback to text field
  return msg.text || "";
}

// =============================================================================
// Import Functions
// =============================================================================

/**
 * Import messages from a Claude Web conversations.json file
 */
export async function* importClaudeWeb(
  filePath: string,
  store: MessageStore,
  options: ClaudeWebImportOptions = {}
): AsyncGenerator<Message, ImportStats> {
  const { since, until, includeThinking = true, includeTools = false } = options;

  // Calculate date range for filtering (default: all time)
  const sinceTimestamp = since?.getTime() ?? 0;
  const untilTimestamp = until?.getTime() ?? Date.now();

  const file = Bun.file(filePath);
  const conversations: ClaudeWebConversation[] = await file.json();

  const stats: ImportStats = {
    conversations: 0,
    messages: 0,
    accounts: 0,
    skipped: 0,
    dateRange: {},
  };

  // Create base accounts
  const seenAccounts = new Set<string>();

  await store.getOrCreateAccount({
    id: "cw_user",
    name: "User",
    identities: [{ platform: "claude-web", handle: "user" }],
  });
  seenAccounts.add("cw_user");
  stats.accounts++;

  await store.getOrCreateAccount({
    id: "cw_claude",
    name: "Claude",
    identities: [{ platform: "claude-web", handle: "claude" }],
    agent: { source: "project", model: "claude" },
  });
  seenAccounts.add("cw_claude");
  stats.accounts++;

  // Process each conversation
  for (const conversation of conversations) {
    // Skip conversations with no messages
    if (!conversation.chat_messages || conversation.chat_messages.length === 0) {
      continue;
    }

    // Check if any messages fall within date range
    const conversationHasValidMessages = conversation.chat_messages.some((msg) => {
      const msgTime = new Date(msg.created_at).getTime();
      return msgTime >= sinceTimestamp && msgTime <= untilTimestamp;
    });

    if (!conversationHasValidMessages) {
      continue;
    }

    // Create thread for this conversation
    const threadId = `cw_${conversation.uuid.slice(0, 8)}`;

    await store.getOrCreateThread({
      id: threadId,
      title: conversation.name || "Untitled Conversation",
      type: "topic",
      participants: ["cw_user", "cw_claude"],
      source: {
        platform: "claude-web",
        platform_id: conversation.uuid,
      },
    });
    stats.conversations++;

    // Process messages in this conversation
    for (const msg of conversation.chat_messages) {
      const msgTimestamp = new Date(msg.created_at).getTime();

      // Apply date filter
      if (msgTimestamp < sinceTimestamp || msgTimestamp > untilTimestamp) {
        stats.skipped++;
        continue;
      }

      // Extract content
      const content = getMessageContent(msg, { includeThinking, includeTools });
      if (!content.trim()) {
        stats.skipped++;
        continue;
      }

      // Track date range
      const msgDate = new Date(msg.created_at);
      if (!stats.dateRange.earliest || msgDate < stats.dateRange.earliest) {
        stats.dateRange.earliest = msgDate;
      }
      if (!stats.dateRange.latest || msgDate > stats.dateRange.latest) {
        stats.dateRange.latest = msgDate;
      }

      // Determine account based on sender
      const accountId = msg.sender === "human" ? "cw_user" : "cw_claude";
      const authorName = msg.sender === "human" ? "User" : "Claude";

      // Build tags
      const tags: [string, string][] = [["sender", msg.sender]];

      // Add attachment info if present
      if (msg.attachments && msg.attachments.length > 0) {
        const attachmentNames = msg.attachments
          .map((a) => a.file_name)
          .filter(Boolean)
          .join(", ");
        if (attachmentNames) {
          tags.push(["attachments", attachmentNames]);
        }
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.ClaudeWeb,
        content,
        account_id: accountId,
        author: {
          name: authorName,
        },
        created_at: msgTimestamp,
        refs: {
          thread_id: threadId,
        },
        source: {
          platform: "claude-web",
          platform_id: msg.uuid,
        },
        tags: tags.length > 0 ? tags : undefined,
      };

      // Create message
      const message = await store.createMessage(input);
      stats.messages++;

      yield message;
    }
  }

  return stats;
}

/**
 * Count messages in a Claude Web export without importing
 * Useful for dry-run preview
 */
export async function countClaudeWebExport(
  filePath: string,
  options: ClaudeWebImportOptions = {}
): Promise<{
  conversations: number;
  messages: number;
  humanMessages: number;
  assistantMessages: number;
  dateRange: { earliest?: Date; latest?: Date };
}> {
  const { since, until, includeThinking = true, includeTools = false } = options;

  const sinceTimestamp = since?.getTime() ?? 0;
  const untilTimestamp = until?.getTime() ?? Date.now();

  const file = Bun.file(filePath);
  const conversations: ClaudeWebConversation[] = await file.json();

  let conversationCount = 0;
  let messageCount = 0;
  let humanMessages = 0;
  let assistantMessages = 0;
  let earliest: Date | undefined;
  let latest: Date | undefined;

  for (const conversation of conversations) {
    if (!conversation.chat_messages || conversation.chat_messages.length === 0) {
      continue;
    }

    let conversationHasMessages = false;

    for (const msg of conversation.chat_messages) {
      const msgTimestamp = new Date(msg.created_at).getTime();

      // Apply date filter
      if (msgTimestamp < sinceTimestamp || msgTimestamp > untilTimestamp) {
        continue;
      }

      // Check if message has content
      const content = getMessageContent(msg, { includeThinking, includeTools });
      if (!content.trim()) {
        continue;
      }

      conversationHasMessages = true;
      messageCount++;

      if (msg.sender === "human") {
        humanMessages++;
      } else {
        assistantMessages++;
      }

      // Track date range
      const msgDate = new Date(msg.created_at);
      if (!earliest || msgDate < earliest) {
        earliest = msgDate;
      }
      if (!latest || msgDate > latest) {
        latest = msgDate;
      }
    }

    if (conversationHasMessages) {
      conversationCount++;
    }
  }

  return {
    conversations: conversationCount,
    messages: messageCount,
    humanMessages,
    assistantMessages,
    dateRange: { earliest, latest },
  };
}

/**
 * Extract conversations.json from a Claude Web export ZIP file
 * Returns path to extracted file
 */
export async function extractConversationsFromZip(zipPath: string): Promise<string> {
  const { $ } = await import("bun");
  const path = await import("path");
  const os = await import("os");

  // Create temp directory for extraction
  const tempDir = path.join(os.tmpdir(), `claude-web-import-${Date.now()}`);
  await $`mkdir -p ${tempDir}`;

  // Extract only conversations.json
  await $`unzip -o ${zipPath} conversations.json -d ${tempDir}`;

  const conversationsPath = path.join(tempDir, "conversations.json");

  // Verify extraction
  const file = Bun.file(conversationsPath);
  if (!(await file.exists())) {
    throw new Error(`Failed to extract conversations.json from ${zipPath}`);
  }

  return conversationsPath;
}
