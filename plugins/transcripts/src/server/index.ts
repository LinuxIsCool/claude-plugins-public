/**
 * Transcripts MCP Server
 *
 * Exposes transcript functionality as MCP tools.
 * Provides programmatic access to transcription, speaker management, and search.
 */

import { createStore, TranscriptStore } from "../infrastructure/store.js";
import { TranscriptSearchIndex } from "../infrastructure/search.js";
import { transcriptionFactory } from "../adapters/transcription/index.js";
import {
  isMessagesPluginAvailable,
  emitTranscriptToMessages,
} from "../infrastructure/messages-bridge.js";
import {
  isYtDlpAvailable,
  getVideoInfo,
  ingestVideo,
  listChannelVideos,
  listPlaylistVideos,
  batchIngest,
  clearCache as clearYouTubeCache,
  type YouTubeTranscript,
  type IngestOptions,
} from "../adapters/ingestion/youtube.js";
import {
  getYouTubeQueue,
  type YouTubeQueue,
} from "../infrastructure/youtube-queue.js";
import type { TranscriptInput, TID } from "../domain/entities/transcript.js";
import type { SpeakerInput } from "../domain/entities/speaker.js";

// MCP protocol types
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
 * Transcripts MCP Server
 */
export class TranscriptsMCPServer {
  private store: TranscriptStore;
  private searchIndex: TranscriptSearchIndex;
  private youtubeQueue: YouTubeQueue;

  constructor() {
    this.store = createStore();
    this.searchIndex = new TranscriptSearchIndex();
    this.youtubeQueue = getYouTubeQueue();
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
        name: "transcripts",
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
          name: "transcripts_transcribe",
          description: "Transcribe an audio or video file",
          inputSchema: {
            type: "object",
            properties: {
              file_path: { type: "string", description: "Path to audio/video file" },
              title: { type: "string", description: "Optional title for the transcript" },
              backend: {
                type: "string",
                description: "Transcription backend (whisper, whisper-api)",
                enum: transcriptionFactory.list(),
              },
              language: { type: "string", description: "Language code (e.g., 'en', 'es')" },
              model: { type: "string", description: "Model to use (e.g., 'base', 'large-v3')" },
            },
            required: ["file_path"],
          },
        },
        {
          name: "transcripts_list",
          description: "List all transcripts",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max results (default 20)" },
            },
          },
        },
        {
          name: "transcripts_get",
          description: "Get a transcript by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Transcript ID (tx_...)" },
            },
            required: ["id"],
          },
        },
        {
          name: "transcripts_speakers_list",
          description: "List all speakers in the database",
          inputSchema: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Max results (default 50)" },
            },
          },
        },
        {
          name: "transcripts_speaker_create",
          description: "Create a new speaker profile",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Speaker name" },
              aliases: {
                type: "array",
                items: { type: "string" },
                description: "Alternative names",
              },
              description: { type: "string", description: "Description of the speaker" },
            },
            required: ["name"],
          },
        },
        {
          name: "transcripts_speaker_get",
          description: "Get a speaker by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Speaker ID (spk_...)" },
            },
            required: ["id"],
          },
        },
        {
          name: "transcripts_stats",
          description: "Get statistics about the transcript store",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_emit_to_messages",
          description: "Emit a transcript to the messages plugin",
          inputSchema: {
            type: "object",
            properties: {
              transcript_id: { type: "string", description: "Transcript ID to emit" },
            },
            required: ["transcript_id"],
          },
        },
        {
          name: "transcripts_backends_list",
          description: "List available transcription backends",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_search",
          description: "Full-text search across transcript utterances using FTS5",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query (supports AND, OR, NOT, \"phrase\", prefix*)",
              },
              speakers: {
                type: "array",
                items: { type: "string" },
                description: "Filter by speaker IDs",
              },
              transcripts: {
                type: "array",
                items: { type: "string" },
                description: "Filter by transcript IDs",
              },
              limit: { type: "number", description: "Max results (default 20)" },
              offset: { type: "number", description: "Pagination offset" },
              highlights: {
                type: "boolean",
                description: "Include highlighted snippets (default true)",
              },
              grouped: {
                type: "boolean",
                description: "Group results by transcript (default false)",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "transcripts_search_stats",
          description: "Get statistics about the search index",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_rebuild_index",
          description: "Rebuild the FTS5 search index from all stored transcripts",
          inputSchema: {
            type: "object",
            properties: {
              clear: {
                type: "boolean",
                description: "Clear existing index before rebuilding (default true)",
              },
            },
          },
        },
        // YouTube ingestion tools
        {
          name: "transcripts_youtube_info",
          description: "Get information about a YouTube video without downloading",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "YouTube video URL or ID" },
            },
            required: ["url"],
          },
        },
        {
          name: "transcripts_youtube_ingest",
          description: "Ingest a YouTube video (download captions or transcribe with Whisper)",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "YouTube video URL or ID" },
              mode: {
                type: "string",
                enum: ["auto", "captions", "whisper"],
                description: "Ingestion mode: auto (try captions, fallback to whisper), captions (only use YouTube captions), whisper (always transcribe audio)",
              },
              language: { type: "string", description: "Language code (default: en)" },
              whisper_model: { type: "string", description: "Whisper model if using whisper mode (e.g., base, large-v3)" },
              save: { type: "boolean", description: "Save to transcript store (default: true)" },
            },
            required: ["url"],
          },
        },
        {
          name: "transcripts_youtube_channel",
          description: "List videos from a YouTube channel",
          inputSchema: {
            type: "object",
            properties: {
              channel: { type: "string", description: "Channel URL or @handle" },
              limit: { type: "number", description: "Max videos to return (default: 50)" },
            },
            required: ["channel"],
          },
        },
        {
          name: "transcripts_youtube_playlist",
          description: "List videos from a YouTube playlist",
          inputSchema: {
            type: "object",
            properties: {
              playlist_url: { type: "string", description: "YouTube playlist URL" },
              limit: { type: "number", description: "Max videos to return (default: 100)" },
            },
            required: ["playlist_url"],
          },
        },
        {
          name: "transcripts_youtube_batch",
          description: "Ingest multiple YouTube videos",
          inputSchema: {
            type: "object",
            properties: {
              video_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of YouTube video IDs or URLs",
              },
              mode: {
                type: "string",
                enum: ["auto", "captions", "whisper"],
                description: "Ingestion mode for all videos",
              },
              language: { type: "string", description: "Language code (default: en)" },
              save: { type: "boolean", description: "Save to transcript store (default: true)" },
            },
            required: ["video_ids"],
          },
        },
        {
          name: "transcripts_youtube_clear_cache",
          description: "Clear YouTube download cache",
          inputSchema: {
            type: "object",
            properties: {
              video_id: { type: "string", description: "Clear cache for specific video (optional, clears all if not provided)" },
            },
          },
        },
        // YouTube Queue tools
        {
          name: "transcripts_queue_subscribe",
          description: "Subscribe to a YouTube channel for automatic transcript ingestion. Videos are queued and processed respecting rate limits.",
          inputSchema: {
            type: "object",
            properties: {
              channel: { type: "string", description: "Channel URL or @handle (e.g., @IndyDevDan or https://youtube.com/@IndyDevDan)" },
              name: { type: "string", description: "Display name for the channel" },
              priority: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "Processing priority (default: medium)",
              },
            },
            required: ["channel"],
          },
        },
        {
          name: "transcripts_queue_unsubscribe",
          description: "Unsubscribe from a YouTube channel",
          inputSchema: {
            type: "object",
            properties: {
              channel_id: { type: "string", description: "Channel ID to unsubscribe" },
            },
            required: ["channel_id"],
          },
        },
        {
          name: "transcripts_queue_channels",
          description: "List all subscribed YouTube channels",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_queue_status",
          description: "Get the current status of the YouTube ingestion queue",
          inputSchema: {
            type: "object",
            properties: {
              show_pending: { type: "boolean", description: "Include list of pending videos" },
              limit: { type: "number", description: "Max pending videos to show (default: 10)" },
            },
          },
        },
        {
          name: "transcripts_queue_process",
          description: "Process pending videos in the queue. Respects rate limits and backs off automatically.",
          inputSchema: {
            type: "object",
            properties: {
              batch_size: { type: "number", description: "Number of videos to process (default: 5)" },
              mode: {
                type: "string",
                enum: ["auto", "captions", "whisper"],
                description: "Ingestion mode (default: auto)",
              },
            },
          },
        },
        {
          name: "transcripts_queue_retry_failed",
          description: "Reset failed videos to pending status for retry",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_queue_clear_rate_limit",
          description: "Manually clear rate limit status (use with caution)",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_queue_check_new",
          description: "Check subscribed channels for new videos and add them to the queue",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "transcripts_queue_reconcile",
          description: "Sync queue with cache - mark already-cached videos as completed. Use after direct ingestVideo calls.",
          inputSchema: {
            type: "object",
            properties: {},
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
      case "transcripts_transcribe":
        return this.toolTranscribe(args);

      case "transcripts_list":
        return this.toolList(args);

      case "transcripts_get":
        return this.toolGet(args);

      case "transcripts_speakers_list":
        return this.toolSpeakersList(args);

      case "transcripts_speaker_create":
        return this.toolSpeakerCreate(args);

      case "transcripts_speaker_get":
        return this.toolSpeakerGet(args);

      case "transcripts_stats":
        return this.toolStats();

      case "transcripts_emit_to_messages":
        return this.toolEmitToMessages(args);

      case "transcripts_backends_list":
        return this.toolBackendsList();

      case "transcripts_search":
        return this.toolSearch(args);

      case "transcripts_search_stats":
        return this.toolSearchStats();

      case "transcripts_rebuild_index":
        return this.toolRebuildIndex(args);

      // YouTube tools
      case "transcripts_youtube_info":
        return this.toolYouTubeInfo(args);

      case "transcripts_youtube_ingest":
        return this.toolYouTubeIngest(args);

      case "transcripts_youtube_channel":
        return this.toolYouTubeChannel(args);

      case "transcripts_youtube_playlist":
        return this.toolYouTubePlaylist(args);

      case "transcripts_youtube_batch":
        return this.toolYouTubeBatch(args);

      case "transcripts_youtube_clear_cache":
        return this.toolYouTubeClearCache(args);

      // Queue tools
      case "transcripts_queue_subscribe":
        return this.toolQueueSubscribe(args);

      case "transcripts_queue_unsubscribe":
        return this.toolQueueUnsubscribe(args);

      case "transcripts_queue_channels":
        return this.toolQueueChannels();

      case "transcripts_queue_status":
        return this.toolQueueStatus(args);

      case "transcripts_queue_process":
        return this.toolQueueProcess(args);

      case "transcripts_queue_retry_failed":
        return this.toolQueueRetryFailed();

      case "transcripts_queue_clear_rate_limit":
        return this.toolQueueClearRateLimit();

      case "transcripts_queue_check_new":
        return this.toolQueueCheckNew();

      case "transcripts_queue_reconcile":
        return this.toolQueueReconcile();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Transcribe audio file
   */
  private async toolTranscribe(args: Record<string, unknown>) {
    const filePath = args.file_path as string;
    const title = args.title as string | undefined;
    const backendName = (args.backend as string) || "whisper";
    const language = args.language as string | undefined;
    const model = args.model as string | undefined;

    // Get backend
    const backend = transcriptionFactory.create(backendName);

    // Check availability
    const available = await backend.isAvailable();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Backend ${backendName} is not available. Check installation/configuration.`,
            }, null, 2),
          },
        ],
      };
    }

    // Transcribe
    const result = await backend.transcribe(
      { type: "file", path: filePath },
      { language, model }
    );

    // Get file stats
    const fs = require("fs");
    const stats = fs.statSync(filePath);
    const path = require("path");

    // Create transcript
    const input: TranscriptInput = {
      title: title || path.basename(filePath),
      source: {
        mode: "file",
        path: filePath,
        filename: path.basename(filePath),
        type: "audio",
        audio: {
          format: path.extname(filePath).slice(1) as any,
          duration_ms: result.duration_ms,
          file_size_bytes: stats.size,
        },
      },
      utterances: result.utterances.map((u, i) => ({
        ...u,
        index: i,
      })),
      processing: {
        backend: backendName,
        model: result.model,
        language: result.language,
        duration_ms: result.processing_time_ms,
      },
      status: "complete",
    };

    const transcript = await this.store.createTranscript(input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: transcript.id,
            title: transcript.title,
            utterance_count: transcript.utterances.length,
            duration_ms: result.duration_ms,
            language: result.language,
            processing_time_ms: result.processing_time_ms,
            model: result.model,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * List transcripts
   */
  private async toolList(args: Record<string, unknown>) {
    const limit = (args.limit as number) || 20;
    const transcripts = [];

    for await (const t of this.store.listTranscripts(limit)) {
      transcripts.push(t);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: transcripts.length, transcripts }, null, 2),
        },
      ],
    };
  }

  /**
   * Get transcript
   */
  private async toolGet(args: Record<string, unknown>) {
    const id = args.id as string;
    const transcript = await this.store.getTranscript(id);

    if (!transcript) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Transcript ${id} not found` }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: transcript.id,
            title: transcript.title,
            status: transcript.status,
            speaker_count: new Set(transcript.utterances.map((u) => u.speaker.id)).size,
            utterance_count: transcript.utterances.length,
            duration_ms: transcript.source.audio.duration_ms,
            created_at: new Date(transcript.created_at).toISOString(),
            utterances: transcript.utterances.slice(0, 10).map((u) => ({
              speaker: u.speaker.name,
              start: formatTime(u.start_ms),
              text: u.text.slice(0, 100) + (u.text.length > 100 ? "..." : ""),
            })),
            more_utterances: transcript.utterances.length > 10
              ? transcript.utterances.length - 10
              : 0,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * List speakers
   */
  private async toolSpeakersList(args: Record<string, unknown>) {
    const limit = (args.limit as number) || 50;
    const speakers = [];

    for await (const s of this.store.listSpeakers(limit)) {
      speakers.push(s);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: speakers.length, speakers }, null, 2),
        },
      ],
    };
  }

  /**
   * Create speaker
   */
  private async toolSpeakerCreate(args: Record<string, unknown>) {
    const input: SpeakerInput = {
      name: args.name as string,
      aliases: args.aliases as string[] | undefined,
      description: args.description as string | undefined,
      fingerprints: [],
      identities: [],
      facts: [],
    };

    const speaker = await this.store.createSpeaker(input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: speaker.id,
            name: speaker.name,
            created_at: new Date(speaker.created_at).toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Get speaker
   */
  private async toolSpeakerGet(args: Record<string, unknown>) {
    const id = args.id as string;
    const speaker = await this.store.getSpeaker(id);

    if (!speaker) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Speaker ${id} not found` }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            id: speaker.id,
            name: speaker.name,
            aliases: speaker.aliases,
            description: speaker.description,
            has_fingerprint: speaker.fingerprints.length > 0,
            linked_platforms: speaker.identities.map((i) => i.platform),
            facts: speaker.facts,
            stats: speaker.stats,
            created_at: new Date(speaker.created_at).toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Get stats
   */
  private async toolStats() {
    const stats = await this.store.getStats();
    const messagesAvailable = isMessagesPluginAvailable();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ...stats,
            total_duration: formatTime(stats.totalDurationMs),
            messages_plugin_available: messagesAvailable,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Emit transcript to messages
   */
  private async toolEmitToMessages(args: Record<string, unknown>) {
    const transcriptId = args.transcript_id as string;

    if (!isMessagesPluginAvailable()) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Messages plugin not available" }, null, 2),
          },
        ],
      };
    }

    const transcript = await this.store.getTranscript(transcriptId);
    if (!transcript) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Transcript ${transcriptId} not found` }, null, 2),
          },
        ],
      };
    }

    const result = await emitTranscriptToMessages(transcript);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            transcript_id: transcriptId,
            messages_emitted: result.messagesEmitted,
            thread_created: result.threadCreated,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * List backends
   */
  private toolBackendsList() {
    const backends = transcriptionFactory.list();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            backends,
            default: "whisper",
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Full-text search across utterances
   */
  private toolSearch(args: Record<string, unknown>) {
    const query = args.query as string;
    const speakers = args.speakers as string[] | undefined;
    const transcripts = args.transcripts as TID[] | undefined;
    const limit = (args.limit as number) ?? 20;
    const offset = (args.offset as number) ?? 0;
    const highlights = (args.highlights as boolean) ?? true;
    const grouped = (args.grouped as boolean) ?? false;

    const options = {
      limit,
      offset,
      speakers,
      transcripts,
    };

    try {
      if (grouped) {
        // Return results grouped by transcript
        const results = this.searchIndex.searchGrouped(query, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query,
                grouped: true,
                transcript_count: results.length,
                results: results.map((r) => ({
                  transcript_id: r.transcript_id,
                  title: r.title,
                  match_count: r.matches.length,
                  total_score: r.total_score,
                  matches: r.matches.slice(0, 5).map((m) => ({
                    utterance_id: m.utterance_id,
                    speaker: m.speaker_name,
                    text: m.text.slice(0, 200) + (m.text.length > 200 ? "..." : ""),
                    time: formatTime(m.start_ms),
                    score: m.score,
                  })),
                  more_matches: r.matches.length > 5 ? r.matches.length - 5 : 0,
                })),
              }, null, 2),
            },
          ],
        };
      }

      if (highlights) {
        // Return results with highlighted snippets
        const results = this.searchIndex.searchWithHighlights(query, options);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query,
                count: results.length,
                results: results.map((r) => ({
                  transcript_id: r.transcript_id,
                  utterance_id: r.utterance_id,
                  speaker: r.speaker_name,
                  highlight: r.highlight,
                  full_text: r.text.length > 300 ? r.text.slice(0, 300) + "..." : r.text,
                  time: formatTime(r.start_ms),
                  duration: formatTime(r.end_ms - r.start_ms),
                  score: r.score,
                })),
              }, null, 2),
            },
          ],
        };
      }

      // Plain search
      const results = this.searchIndex.search(query, options);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query,
              count: results.length,
              results: results.map((r) => ({
                transcript_id: r.transcript_id,
                utterance_id: r.utterance_id,
                speaker: r.speaker_name,
                text: r.text.slice(0, 200) + (r.text.length > 200 ? "..." : ""),
                time: formatTime(r.start_ms),
                score: r.score,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
              hint: "FTS5 query syntax: use AND/OR/NOT, \"phrases\", prefix* wildcards",
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Get search index statistics
   */
  private toolSearchStats() {
    const stats = this.searchIndex.stats();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            transcripts_indexed: stats.transcripts,
            utterances_indexed: stats.utterances,
            unique_speakers: stats.speakers,
            date_range: stats.dateRange
              ? {
                  first: new Date(stats.dateRange.first).toISOString(),
                  last: new Date(stats.dateRange.last).toISOString(),
                }
              : null,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Rebuild the search index from all stored transcripts
   */
  private async toolRebuildIndex(args: Record<string, unknown>) {
    const clear = (args.clear as boolean) ?? true;

    if (clear) {
      this.searchIndex.clear();
    }

    let indexed = 0;
    const errors: string[] = [];

    for await (const summary of this.store.listTranscripts()) {
      try {
        const transcript = await this.store.getTranscript(summary.id);
        if (transcript) {
          this.searchIndex.index(transcript);
          indexed++;
        }
      } catch (error) {
        errors.push(`${summary.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            indexed,
            cleared: clear,
            errors: errors.length > 0 ? errors : undefined,
            stats: this.searchIndex.stats(),
          }, null, 2),
        },
      ],
    };
  }

  // =========================================================================
  // YouTube Tools
  // =========================================================================

  /**
   * Get YouTube video info
   */
  private async toolYouTubeInfo(args: Record<string, unknown>) {
    const url = args.url as string;

    // Check yt-dlp availability
    const available = await isYtDlpAvailable();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "yt-dlp is not available. Please install it: pip install yt-dlp",
            }, null, 2),
          },
        ],
      };
    }

    try {
      const info = await getVideoInfo(url);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: info.id,
              title: info.title,
              channel: info.channel,
              channel_id: info.channel_id,
              duration: formatTime(info.duration_seconds * 1000),
              duration_seconds: info.duration_seconds,
              upload_date: info.upload_date,
              view_count: info.view_count,
              has_captions: info.has_captions,
              caption_languages: info.caption_languages.slice(0, 10),
              url: info.url,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to get video info: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Ingest YouTube video
   */
  private async toolYouTubeIngest(args: Record<string, unknown>) {
    const url = args.url as string;
    const mode = (args.mode as IngestOptions["mode"]) || "auto";
    const language = args.language as string | undefined;
    const whisperModel = args.whisper_model as string | undefined;
    const save = args.save !== false; // Default true

    // Check yt-dlp availability
    const available = await isYtDlpAvailable();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "yt-dlp is not available. Please install it: pip install yt-dlp",
            }, null, 2),
          },
        ],
      };
    }

    try {
      const result = await ingestVideo(url, {
        mode,
        language,
        whisper_model: whisperModel,
      });

      // Save to store if requested
      let transcriptId: string | undefined;
      if (save) {
        const input: TranscriptInput = {
          title: result.video.title,
          source: {
            mode: "url",
            url: result.video.url,
            type: "video",
            audio: {
              format: "unknown",
              duration_ms: result.video.duration_seconds * 1000,
            },
            platform: {
              name: "youtube",
              url: result.video.url,
              platform_id: result.video.id,
              channel: result.video.channel,
            },
          },
          utterances: result.captions.map((c, i) => ({
            index: i,
            speaker: { id: "spk_unknown", name: result.video.channel },
            start_ms: c.start_ms,
            end_ms: c.end_ms,
            text: c.text,
            confidence: result.source === "whisper" ? 0.9 : 0.95,
          })),
          processing: {
            backend: result.source === "whisper" ? "whisper" : "youtube-captions",
            model: result.source === "whisper" ? (whisperModel || "base") : undefined,
            language: result.language,
            duration_ms: 0,
          },
          status: "complete",
        };

        const transcript = await this.store.createTranscript(input);
        transcriptId = transcript.id;

        // Index for search
        this.searchIndex.index(transcript);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              video_id: result.video.id,
              title: result.video.title,
              channel: result.video.channel,
              duration: formatTime(result.video.duration_seconds * 1000),
              source: result.source,
              language: result.language,
              caption_count: result.captions.length,
              saved: save,
              transcript_id: transcriptId,
              sample: result.captions.slice(0, 5).map(c => ({
                time: formatTime(c.start_ms),
                text: c.text.slice(0, 100) + (c.text.length > 100 ? "..." : ""),
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to ingest video: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * List videos from YouTube channel
   */
  private async toolYouTubeChannel(args: Record<string, unknown>) {
    const channel = args.channel as string;
    const limit = (args.limit as number) || 50;

    // Check yt-dlp availability
    const available = await isYtDlpAvailable();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "yt-dlp is not available. Please install it: pip install yt-dlp",
            }, null, 2),
          },
        ],
      };
    }

    try {
      const videos = await listChannelVideos(channel, { limit });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              channel,
              video_count: videos.length,
              videos: videos.map(v => ({
                id: v.id,
                title: v.title,
                duration: formatTime(v.duration_seconds * 1000),
                upload_date: v.upload_date,
                views: v.view_count,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to list channel videos: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * List videos from YouTube playlist
   */
  private async toolYouTubePlaylist(args: Record<string, unknown>) {
    const playlistUrl = args.playlist_url as string;
    const limit = (args.limit as number) || 100;

    // Check yt-dlp availability
    const available = await isYtDlpAvailable();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "yt-dlp is not available. Please install it: pip install yt-dlp",
            }, null, 2),
          },
        ],
      };
    }

    try {
      const videos = await listPlaylistVideos(playlistUrl, { limit });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              playlist_url: playlistUrl,
              video_count: videos.length,
              videos: videos.map(v => ({
                id: v.id,
                title: v.title,
                duration: formatTime(v.duration_seconds * 1000),
                upload_date: v.upload_date,
                views: v.view_count,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to list playlist videos: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Batch ingest YouTube videos
   */
  private async toolYouTubeBatch(args: Record<string, unknown>) {
    const videoIds = args.video_ids as string[];
    const mode = (args.mode as IngestOptions["mode"]) || "auto";
    const language = args.language as string | undefined;
    const save = args.save !== false;

    // Check yt-dlp availability
    const available = await isYtDlpAvailable();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "yt-dlp is not available. Please install it: pip install yt-dlp",
            }, null, 2),
          },
        ],
      };
    }

    const results: Array<{
      id: string;
      title?: string;
      transcript_id?: string;
      error?: string;
    }> = [];

    for await (const { id, result, error } of batchIngest(videoIds, { mode, language })) {
      if (error) {
        results.push({ id, error });
        continue;
      }

      if (!result) {
        results.push({ id, error: "No result returned" });
        continue;
      }

      let transcriptId: string | undefined;
      if (save) {
        const input: TranscriptInput = {
          title: result.video.title,
          source: {
            mode: "url",
            url: result.video.url,
            type: "video",
            audio: {
              format: "unknown",
              duration_ms: result.video.duration_seconds * 1000,
            },
            platform: {
              name: "youtube",
              url: result.video.url,
              platform_id: result.video.id,
              channel: result.video.channel,
            },
          },
          utterances: result.captions.map((c, i) => ({
            index: i,
            speaker: { id: "spk_unknown", name: result.video.channel },
            start_ms: c.start_ms,
            end_ms: c.end_ms,
            text: c.text,
            confidence: result.source === "whisper" ? 0.9 : 0.95,
          })),
          processing: {
            backend: result.source === "whisper" ? "whisper" : "youtube-captions",
            language: result.language,
            duration_ms: 0,
          },
          status: "complete",
        };

        const transcript = await this.store.createTranscript(input);
        transcriptId = transcript.id;
        this.searchIndex.index(transcript);
      }

      results.push({
        id,
        title: result.video.title,
        transcript_id: transcriptId,
      });
    }

    const succeeded = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total: videoIds.length,
            succeeded,
            failed,
            saved: save,
            results,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Clear YouTube cache
   */
  private toolYouTubeClearCache(args: Record<string, unknown>) {
    const videoId = args.video_id as string | undefined;

    try {
      const cleared = clearYouTubeCache(videoId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cleared,
              video_id: videoId || "all",
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  // =========================================================================
  // Queue Tools
  // =========================================================================

  /**
   * Subscribe to a YouTube channel
   */
  private async toolQueueSubscribe(args: Record<string, unknown>) {
    const channel = args.channel as string;
    const name = args.name as string | undefined;
    const priority = args.priority as "high" | "medium" | "low" | undefined;

    try {
      const result = await this.youtubeQueue.subscribe(channel, { name, priority });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subscribed: true,
              channel: {
                id: result.channel.id,
                name: result.channel.name,
                url: result.channel.url,
                priority: result.channel.priority,
                video_count: result.channel.video_count,
              },
              videos_queued: result.videosQueued,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to subscribe: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Unsubscribe from a YouTube channel
   */
  private toolQueueUnsubscribe(args: Record<string, unknown>) {
    const channelId = args.channel_id as string;

    const removed = this.youtubeQueue.unsubscribe(channelId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            unsubscribed: removed,
            channel_id: channelId,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * List subscribed channels
   */
  private toolQueueChannels() {
    const channels = this.youtubeQueue.listChannels();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            count: channels.length,
            channels: channels.map(c => ({
              id: c.id,
              name: c.name,
              url: c.url,
              priority: c.priority,
              video_count: c.video_count,
              ingested_count: c.ingested_count,
              last_checked: c.last_checked ? new Date(c.last_checked).toISOString() : null,
            })),
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Get queue status
   */
  private toolQueueStatus(args: Record<string, unknown>) {
    const showPending = args.show_pending as boolean | undefined;
    const limit = (args.limit as number) || 10;

    const status = this.youtubeQueue.getStatus();

    const result: Record<string, unknown> = {
      processing_enabled: status.state.processing_enabled,
      rate_limited: status.state.is_rate_limited,
      rate_limit_until: status.state.rate_limit_until
        ? new Date(status.state.rate_limit_until).toISOString()
        : null,
      backoff_minutes: status.state.backoff_minutes,
      last_successful_ingest: status.state.last_successful_ingest
        ? new Date(status.state.last_successful_ingest).toISOString()
        : null,
      channels: status.channels,
      queue: status.queue,
      can_process: status.canProcess,
    };

    if (showPending) {
      const pending = this.youtubeQueue.getQueueItems({ status: "pending", limit });
      result.pending_videos = pending.map(v => ({
        id: v.id,
        title: v.title,
        channel_id: v.channel_id,
        upload_date: v.upload_date,
      }));
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Process queue
   */
  private async toolQueueProcess(args: Record<string, unknown>) {
    const batchSize = (args.batch_size as number) || 5;
    const mode = (args.mode as IngestOptions["mode"]) || "auto";

    try {
      const result = await this.youtubeQueue.processQueue({ mode }, batchSize);

      // Save successful transcripts to store
      for (const video of result.videos) {
        if (video.status === "completed") {
          // The ingestVideo call in processQueue already saves via store
          // but we need to trigger search indexing if not already done
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              processed: result.processed,
              succeeded: result.succeeded,
              failed: result.failed,
              rate_limited: result.rate_limited,
              videos: result.videos,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to process queue: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Retry failed videos
   */
  private toolQueueRetryFailed() {
    const count = this.youtubeQueue.retryFailed();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reset_to_pending: count,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Clear rate limit
   */
  private toolQueueClearRateLimit() {
    this.youtubeQueue.clearRateLimit();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            cleared: true,
            message: "Rate limit cleared. Processing can resume.",
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Check for new videos on subscribed channels
   */
  private async toolQueueCheckNew() {
    try {
      const results = await this.youtubeQueue.checkForNewVideos();

      const totalNew = results.reduce((sum, r) => sum + r.newVideos, 0);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              channels_checked: results.length,
              new_videos_found: totalNew,
              details: results.filter(r => r.newVideos > 0),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Failed to check for new videos: ${error instanceof Error ? error.message : String(error)}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  /**
   * Reconcile queue with cache
   */
  private toolQueueReconcile() {
    const result = this.youtubeQueue.reconcileWithCache();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            reconciled: result.reconciled,
            message: result.reconciled > 0
              ? `Marked ${result.reconciled} cached videos as completed`
              : "No cached videos found that weren't already marked complete",
            videos: result.videos.slice(0, 20),
            more: result.videos.length > 20 ? result.videos.length - 20 : 0,
          }, null, 2),
        },
      ],
    };
  }

  /**
   * Run the server
   */
  async run(): Promise<void> {
    const reader = Bun.stdin.stream().getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

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

/**
 * Format milliseconds as time string
 */
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Run if executed directly
if (import.meta.main) {
  const server = new TranscriptsMCPServer();
  server.run().catch(console.error);
}
