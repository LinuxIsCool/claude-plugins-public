/**
 * Discord Historical Message Importer
 *
 * Bulk imports historical messages from Discord with:
 * - Parallel channel fetching (3 concurrent by default)
 * - Resume capability via checkpoints
 * - Rate limiting (200ms delays between batches)
 * - Support for archived threads
 */

import type { MessageStore } from "../../core/store";
import { createSearchIndex } from "../../search";
import {
  getDiscordClient,
  isDiscordAvailable,
  type DiscordClient,
} from "../../integrations/discord/client";
import type { DiscordMessage } from "../../integrations/discord/types";
import { Kind } from "../../types";
import type { Message, MessageInput } from "../../types";
import { CheckpointManager } from "./checkpoint";
import type {
  DiscordImportOptions,
  DiscordImportStats,
  DiscordCountResult,
  ChannelTask,
} from "./types";

// Default options
const DEFAULTS = {
  concurrentChannels: 3,
  delayBetweenBatches: 200,
  checkpointInterval: 100,
  includeThreads: true,
  includeArchivedThreads: true,
  includeDMs: true,
};

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk array into batches
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Count what would be imported (dry-run mode)
 */
export async function countDiscordHistory(
  options: DiscordImportOptions = {}
): Promise<DiscordCountResult> {
  if (!isDiscordAvailable()) {
    throw new Error("Discord not available. Run authentication first.");
  }

  const client = getDiscordClient();
  await client.connect();

  try {
    const result: DiscordCountResult = {
      guilds: 0,
      channels: 0,
      threads: 0,
      archivedThreads: 0,
      dms: 0,
      estimatedMessages: 0,
      channelList: [],
    };

    // Discover guilds
    const guilds = await client.getGuilds();
    const filteredGuilds = options.guilds
      ? guilds.filter((g) => options.guilds!.includes(g.id))
      : guilds;

    result.guilds = filteredGuilds.length;

    // Process each guild
    for (const guild of filteredGuilds) {
      const channels = await client.getChannels(guild.id);

      for (const channel of channels) {
        if (options.channels && !options.channels.includes(channel.id)) continue;
        if (options.channelTypes && !options.channelTypes.includes(channel.type)) continue;

        result.channels++;
        result.channelList.push({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          guildName: guild.name,
        });

        // Estimate messages from lastMessageAt
        if (channel.lastMessageAt) {
          result.estimatedMessages += 100; // Conservative estimate
        }

        // Count threads
        if (options.includeThreads !== false) {
          const activeThreads = await client.getThreads(channel.id);
          result.threads += activeThreads.length;

          for (const thread of activeThreads) {
            result.channelList.push({
              id: thread.id,
              name: thread.name,
              type: "thread",
              guildName: guild.name,
            });
          }

          // Count archived threads
          if (options.includeArchivedThreads !== false) {
            const archivedThreads = await client.fetchAllArchivedThreads(channel.id);
            result.archivedThreads += archivedThreads.length;

            for (const thread of archivedThreads) {
              result.channelList.push({
                id: thread.id,
                name: thread.name,
                type: "archived_thread",
                guildName: guild.name,
              });
            }
          }
        }
      }
    }

    // Count DMs
    if (options.includeDMs !== false) {
      const dmChannels = await client.getChannels(); // No guildId = DMs
      result.dms = dmChannels.length;

      for (const dm of dmChannels) {
        result.channelList.push({
          id: dm.id,
          name: dm.name,
          type: dm.type,
        });
        result.estimatedMessages += 50; // Conservative estimate
      }
    }

    return result;
  } finally {
    await client.disconnect();
  }
}

/**
 * Import Discord historical messages
 *
 * Main entry point for historical import. Returns an async generator
 * that yields messages as they are imported.
 */
export async function* importDiscordHistory(
  store: MessageStore,
  options: DiscordImportOptions = {}
): AsyncGenerator<Message, DiscordImportStats> {
  if (!isDiscordAvailable()) {
    throw new Error("Discord not available. Run authentication first.");
  }

  const opts = { ...DEFAULTS, ...options };
  const checkpoint = new CheckpointManager();
  const searchIndex = createSearchIndex();
  const startTime = Date.now();
  let resumed = false;

  // Resume from existing checkpoint or create new one
  if (opts.checkpointId) {
    const loaded = await checkpoint.load(opts.checkpointId);
    if (loaded) {
      resumed = true;
      console.log(`[discord-import] Resuming from checkpoint: ${opts.checkpointId}`);
    } else {
      throw new Error(`Checkpoint not found: ${opts.checkpointId}`);
    }
  } else {
    await checkpoint.create(opts);
  }

  const client = getDiscordClient();
  await client.connect();

  // Caches for deduplication
  const seenAccounts = new Set<string>();
  const seenThreads = new Set<string>();
  let myAccountId: string | null = null;
  let myUsername: string | null = null;

  try {
    // Get current user
    const me = client.getMe();
    if (me) {
      myAccountId = `discord_${me.id}`;
      myUsername = me.displayName || me.username;

      // Create self account
      await store.getOrCreateAccount({
        id: myAccountId,
        name: myUsername,
        identities: [{ platform: "discord", handle: `${me.username}#${me.discriminator}` }],
        is_self: true,
      });
      seenAccounts.add(myAccountId);
      checkpoint.incrementAccounts();
    }

    // Phase 1: Discovery
    checkpoint.setPhase("discovery");
    const tasks = await discoverChannels(client, opts, checkpoint);

    console.log(`[discord-import] Discovered ${tasks.length} channels to process`);

    // Phase 2: Import
    checkpoint.setPhase("importing");

    // Process channels in parallel batches
    const batches = chunk(tasks, opts.concurrentChannels);
    let processedChannels = 0;
    let messagesInBatch = 0;

    for (const batch of batches) {
      // Process batch in parallel
      const batchPromises = batch.map(async (task) => {
        const messages: Message[] = [];

        try {
          // Fetch all messages from this channel
          for await (const msg of fetchChannelMessages(client, task, opts, checkpoint)) {
            // Transform to MessageInput
            const input = transformMessage(
              msg,
              task,
              myAccountId,
              myUsername,
              seenAccounts,
              seenThreads,
              store,
              checkpoint
            );

            // Store message (skip thread updates for bulk import)
            const message = await store.createMessage(await input, { skipThreadUpdate: true });

            // Index for search
            searchIndex.index(message);

            // Update checkpoint
            checkpoint.incrementMessages();
            checkpoint.updateDateRange(msg.timestamp);
            messagesInBatch++;

            // Save checkpoint periodically
            if (messagesInBatch % opts.checkpointInterval === 0) {
              await checkpoint.save();
            }

            messages.push(message);
          }

          // Mark channel as complete
          if (task.channelType === "thread") {
            checkpoint.markThreadProcessed(task.channelId, task.isArchivedThread || false);
          } else if (task.channelType === "dm") {
            checkpoint.incrementDMs();
            checkpoint.markChannelProcessed(task.channelId);
          } else {
            checkpoint.markChannelProcessed(task.channelId);
          }
        } catch (error) {
          console.error(`[discord-import] Error fetching ${task.channelName}:`, error);
          checkpoint.incrementErrors();
        }

        return messages;
      });

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Yield all messages from this batch
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          for (const message of result.value) {
            yield message;
          }
        }
      }

      processedChannels += batch.length;

      // Progress callback
      if (opts.onProgress) {
        opts.onProgress({
          phase: "importing",
          channelsTotal: tasks.length,
          channelsCompleted: processedChannels,
          channelsCurrent: batch.map((t) => t.channelName),
          messagesImported: checkpoint.getState()?.stats.messages || 0,
          threadsDiscovered:
            (checkpoint.getState()?.stats.threads || 0) +
            (checkpoint.getState()?.stats.archivedThreads || 0),
          errors: checkpoint.getState()?.stats.errors || 0,
          elapsed: Date.now() - startTime,
        });
      }

      // Rate limit delay between batches
      await sleep(opts.delayBetweenBatches);
    }

    // Phase 3: Finalize
    checkpoint.setPhase("finalizing");
    console.log("[discord-import] Rebuilding thread views...");
    await store.rebuildThreadViews();

    // Mark complete
    await checkpoint.complete();

    // Return final stats
    return checkpoint.getStats(startTime, resumed);
  } finally {
    await checkpoint.cleanup();
    await client.disconnect();
  }
}

/**
 * Discover all channels to process
 */
async function discoverChannels(
  client: DiscordClient,
  options: DiscordImportOptions,
  checkpoint: CheckpointManager
): Promise<ChannelTask[]> {
  const tasks: ChannelTask[] = [];

  // Discover guilds
  const guilds = await client.getGuilds();
  const filteredGuilds = options.guilds
    ? guilds.filter((g) => options.guilds!.includes(g.id))
    : guilds;

  // Process each guild
  for (const guild of filteredGuilds) {
    // Skip if already processed
    if (checkpoint.isChannelProcessed(guild.id)) continue;

    const channels = await client.getChannels(guild.id);

    for (const channel of channels) {
      // Skip filtered out channels
      if (options.channels && !options.channels.includes(channel.id)) continue;
      if (options.channelTypes && !options.channelTypes.includes(channel.type)) continue;

      // Skip already processed
      if (checkpoint.isChannelProcessed(channel.id)) continue;

      tasks.push({
        channelId: channel.id,
        channelName: channel.name,
        channelType: mapChannelType(channel.type),
        guildId: guild.id,
        guildName: guild.name,
        checkpoint: checkpoint.getChannelCheckpoint(channel.id),
      });

      // Discover threads
      if (options.includeThreads !== false) {
        // Active threads
        const activeThreads = await client.getThreads(channel.id);
        for (const thread of activeThreads) {
          if (checkpoint.isChannelProcessed(thread.id)) continue;

          tasks.push({
            channelId: thread.id,
            channelName: thread.name,
            channelType: "thread",
            guildId: guild.id,
            guildName: guild.name,
            isArchivedThread: false,
            checkpoint: checkpoint.getChannelCheckpoint(thread.id),
          });
        }

        // Archived threads
        if (options.includeArchivedThreads !== false) {
          const archivedThreads = await client.fetchAllArchivedThreads(channel.id);
          for (const thread of archivedThreads) {
            if (checkpoint.isChannelProcessed(thread.id)) continue;

            tasks.push({
              channelId: thread.id,
              channelName: thread.name,
              channelType: "thread",
              guildId: guild.id,
              guildName: guild.name,
              isArchivedThread: true,
              checkpoint: checkpoint.getChannelCheckpoint(thread.id),
            });
          }
        }
      }
    }

    // Mark guild as processed after discovering all its channels
    checkpoint.markGuildProcessed(guild.id);
  }

  // Discover DMs
  if (options.includeDMs !== false) {
    const dmChannels = await client.getChannels(); // No guildId = DMs

    for (const dm of dmChannels) {
      if (checkpoint.isChannelProcessed(dm.id)) continue;

      tasks.push({
        channelId: dm.id,
        channelName: dm.name,
        channelType: "dm",
        checkpoint: checkpoint.getChannelCheckpoint(dm.id),
      });
    }
  }

  return tasks;
}

/**
 * Fetch all messages from a channel with pagination
 */
async function* fetchChannelMessages(
  client: DiscordClient,
  task: ChannelTask,
  options: DiscordImportOptions,
  checkpoint: CheckpointManager
): AsyncGenerator<DiscordMessage> {
  let before = task.checkpoint?.lastMessageId;
  let count = task.checkpoint?.messageCount || 0;
  const maxPerChannel = options.maxPerChannel || Infinity;

  while (count < maxPerChannel) {
    // Fetch batch
    const messages = await client.fetchMessageHistory(task.channelId, {
      limit: Math.min(100, maxPerChannel - count),
      before,
    });

    if (messages.length === 0) break;

    // Capture oldest message ID BEFORE reversing (Discord returns newest first)
    const oldestMessageId = messages[messages.length - 1].id;

    // Process messages (oldest first for chronological order in the batch)
    for (const msg of messages.reverse()) {
      // Apply date filters
      if (options.since && msg.timestamp < options.since.getTime()) {
        // We've gone past our date range - stop
        return;
      }
      if (options.until && msg.timestamp > options.until.getTime()) {
        // Skip messages after until date
        checkpoint.incrementSkipped();
        continue;
      }

      yield msg;
      count++;
    }

    // Update progress checkpoint for this channel
    checkpoint.updateChannelProgress(task.channelId, {
      lastMessageId: oldestMessageId,
      messageCount: count,
    });

    // End of history
    if (messages.length < 100) break;

    // Set cursor for next page
    before = oldestMessageId;
  }
}

/**
 * Transform Discord message to MessageInput
 */
async function transformMessage(
  msg: DiscordMessage,
  task: ChannelTask,
  myAccountId: string | null,
  myUsername: string | null,
  seenAccounts: Set<string>,
  seenThreads: Set<string>,
  store: MessageStore,
  checkpoint: CheckpointManager
): Promise<MessageInput> {
  // Build content from message + embeds + attachments (preserve ALL data)
  const contentParts: string[] = [];

  // Primary text content
  if (msg.content) {
    contentParts.push(msg.content);
  }

  // Embed content (process ALL embeds, not just first)
  if (msg.embeds.length > 0) {
    for (const embed of msg.embeds) {
      const embedParts = [
        embed.title,
        embed.description,
        embed.fields?.map((f) => `**${f.name}**: ${f.value}`).join("\n"),
      ].filter(Boolean);
      if (embedParts.length > 0) {
        contentParts.push(embedParts.join("\n\n"));
      }
    }
  }

  // Attachment info (always include, never truncate)
  if (msg.attachments.length > 0) {
    contentParts.push(msg.attachments.map((a) => `[${a.filename}](${a.url})`).join("\n"));
  }

  // Default content for empty messages
  const content = contentParts.length > 0 ? contentParts.join("\n\n---\n\n") : `[${msg.type} message]`;

  // Determine sender
  const senderAccountId = `discord_${msg.author.id}`;
  const isOutgoing = senderAccountId === myAccountId;

  // Create sender account if needed
  if (!seenAccounts.has(senderAccountId)) {
    await store.getOrCreateAccount({
      id: senderAccountId,
      name: msg.author.displayName || msg.author.username,
      identities: [
        {
          platform: "discord",
          handle: `${msg.author.username}#${msg.author.discriminator}`,
        },
      ],
    });
    seenAccounts.add(senderAccountId);
    checkpoint.incrementAccounts();
  }

  // Create thread if needed
  const threadId = createThreadId(task);
  if (!seenThreads.has(threadId)) {
    await store.getOrCreateThread({
      id: threadId,
      title: task.channelName,
      type: task.channelType === "dm" ? "dm" : task.channelType === "thread" ? "topic" : "group",
      participants: [myAccountId!],
      source: {
        platform: "discord",
        platform_id: task.channelId,
        room_id: task.guildId,
      },
    });
    seenThreads.add(threadId);
  }

  // Build tags
  const tags: [string, string][] = [
    ["direction", isOutgoing ? "outgoing" : "incoming"],
    ["message_type", msg.type],
  ];

  if (task.guildId) {
    tags.push(["guild_id", task.guildId]);
  }
  tags.push(["channel_id", task.channelId]);

  if (msg.pinned) {
    tags.push(["pinned", "true"]);
  }
  if (msg.embeds.length > 0) {
    tags.push(["has_embed", "true"]);
  }
  if (msg.attachments.length > 0) {
    tags.push(["attachments", msg.attachments.length.toString()]);
  }
  for (const reaction of msg.reactions) {
    tags.push(["reaction", `${reaction.emoji.name}:${reaction.count}`]);
  }

  return {
    kind: Kind.Discord,
    content,
    account_id: senderAccountId,
    author: {
      name: isOutgoing ? myUsername || "Me" : msg.author.displayName || msg.author.username,
      handle: `${msg.author.username}#${msg.author.discriminator}`,
    },
    created_at: msg.timestamp,
    refs: {
      thread_id: threadId,
      reply_to: msg.replyTo?.messageId ? `discord_msg_${msg.replyTo.messageId}` : undefined,
      room_id: task.guildId,
      mentions: msg.mentions.map((m) => `discord_${m.id}`),
    },
    source: {
      platform: "discord",
      platform_id: msg.id,
      url: buildMessageUrl(msg, task),
    },
    tags,
  };
}

/**
 * Create thread ID from task
 */
function createThreadId(task: ChannelTask): string {
  if (task.channelType === "thread") {
    return `discord_thread_${task.channelId}`;
  }
  if (task.channelType === "dm") {
    return `discord_dm_${task.channelId}`;
  }
  return `discord_channel_${task.channelId}`;
}

/**
 * Build message URL
 */
function buildMessageUrl(msg: DiscordMessage, task: ChannelTask): string {
  if (task.guildId) {
    return `https://discord.com/channels/${task.guildId}/${task.channelId}/${msg.id}`;
  }
  return `https://discord.com/channels/@me/${task.channelId}/${msg.id}`;
}

/**
 * Map channel type to simplified type
 */
function mapChannelType(type: string): "text" | "dm" | "thread" | "forum" {
  switch (type) {
    case "dm":
    case "group_dm":
      return "dm";
    case "public_thread":
    case "private_thread":
    case "announcement_thread":
      return "thread";
    case "forum":
      return "forum";
    default:
      return "text";
  }
}
