/**
 * AgentNet MCP Tools
 * Tool definitions for MCP server integration
 */

import { z } from "zod";
import { SocialStore, syncAgentProfiles } from "../index.ts";
import type { PostCreateInput, MessageCreateInput } from "../types/index.ts";

/**
 * Get store instance for MCP tools
 */
function getStore(rootDir?: string): SocialStore {
	return new SocialStore(rootDir || process.cwd());
}

/**
 * Tool schemas
 */
export const toolSchemas = {
	// Agent operations
	agentnet_sync: z.object({
		rootDir: z.string().optional().describe("Root directory to scan for agents"),
	}),

	agentnet_list_agents: z.object({
		limit: z.number().optional().describe("Maximum number of agents to return"),
	}),

	agentnet_get_profile: z.object({
		agentId: z.string().describe("Agent ID to retrieve"),
	}),

	// Post operations
	agentnet_create_post: z.object({
		authorId: z.string().describe("Author agent ID"),
		content: z.string().describe("Post content (markdown)"),
		title: z.string().optional().describe("Post title"),
		visibility: z.enum(["public", "followers", "mentioned"]).optional().describe("Post visibility"),
		validUntil: z.string().optional().describe("Valid until date (ISO format)"),
		tags: z.array(z.string()).optional().describe("Tags for the post"),
		mentions: z.array(z.string()).optional().describe("Agent IDs mentioned"),
		sourceEvent: z.string().optional().describe("Source event type"),
		sourceRef: z.string().optional().describe("Source reference"),
	}),

	agentnet_get_wall: z.object({
		agentId: z.string().describe("Agent ID whose wall to retrieve"),
		limit: z.number().optional().describe("Maximum number of posts"),
		includeStale: z.boolean().optional().describe("Include stale posts"),
	}),

	agentnet_get_post: z.object({
		authorId: z.string().describe("Author agent ID"),
		postId: z.string().describe("Post ID"),
	}),

	agentnet_get_feed: z.object({
		limit: z.number().optional().describe("Maximum number of posts"),
		agents: z.array(z.string()).optional().describe("Filter by agent IDs"),
		includeStale: z.boolean().optional().describe("Include stale posts"),
	}),

	agentnet_repost: z.object({
		originalAuthorId: z.string().describe("Original post author ID"),
		originalPostId: z.string().describe("Original post ID"),
		reposterId: z.string().describe("Agent ID doing the repost"),
		comment: z.string().optional().describe("Comment on the repost"),
	}),

	// Message operations
	agentnet_send_message: z.object({
		authorId: z.string().describe("Sender agent ID"),
		recipientId: z.string().describe("Recipient agent ID"),
		content: z.string().describe("Message content"),
		title: z.string().optional().describe("Message title/subject"),
		threadId: z.string().optional().describe("Existing thread ID (creates new if not provided)"),
	}),

	agentnet_list_threads: z.object({
		agentId: z.string().describe("Agent ID to list threads for"),
	}),

	agentnet_get_thread: z.object({
		threadId: z.string().describe("Thread ID to retrieve"),
	}),

	agentnet_get_thread_messages: z.object({
		threadId: z.string().describe("Thread ID to retrieve messages from"),
	}),
};

/**
 * Tool handlers
 */
export const toolHandlers = {
	agentnet_sync: async (args: z.infer<typeof toolSchemas.agentnet_sync>) => {
		const rootDir = args.rootDir || process.cwd();
		const store = getStore(rootDir);
		const result = await syncAgentProfiles(rootDir, store);
		return {
			success: true,
			created: result.created,
			updated: result.updated,
			total: result.total,
		};
	},

	agentnet_list_agents: async (args: z.infer<typeof toolSchemas.agentnet_list_agents>) => {
		const store = getStore();
		const profiles = await store.listProfiles();
		const limited = args.limit ? profiles.slice(0, args.limit) : profiles;
		return {
			agents: limited.map((p) => ({
				id: p.id,
				name: p.name,
				role: p.role,
				model: p.model,
				source: p.source,
				postCount: p.stats?.postCount || 0,
				lastActive: p.stats?.lastActive,
			})),
			total: profiles.length,
		};
	},

	agentnet_get_profile: async (args: z.infer<typeof toolSchemas.agentnet_get_profile>) => {
		const store = getStore();
		const profile = await store.getProfile(args.agentId);
		if (!profile) {
			return { error: `Agent '${args.agentId}' not found` };
		}
		return { profile };
	},

	agentnet_create_post: async (args: z.infer<typeof toolSchemas.agentnet_create_post>) => {
		const store = getStore();
		const profile = await store.getProfile(args.authorId);
		if (!profile) {
			return { error: `Agent '${args.authorId}' not found` };
		}

		const input: PostCreateInput = {
			authorId: args.authorId,
			content: args.content,
			title: args.title,
			visibility: args.visibility,
			validUntil: args.validUntil,
			tags: args.tags,
			mentions: args.mentions,
			sourceEvent: args.sourceEvent,
			sourceRef: args.sourceRef,
		};

		const post = await store.createPost(input);
		return {
			success: true,
			post: {
				id: post.id,
				authorId: post.authorId,
				title: post.title,
				createdDate: post.createdDate,
			},
		};
	},

	agentnet_get_wall: async (args: z.infer<typeof toolSchemas.agentnet_get_wall>) => {
		const store = getStore();
		const posts = await store.getWall(args.agentId, {
			limit: args.limit,
			includeStale: args.includeStale,
		});
		return {
			agentId: args.agentId,
			posts: posts.map((p) => ({
				id: p.id,
				type: p.type,
				title: p.title,
				content: p.content.slice(0, 500),
				createdDate: p.createdDate,
				isStale: p.isStale,
				repostCount: p.repostCount,
				replyCount: p.replyCount,
			})),
			total: posts.length,
		};
	},

	agentnet_get_post: async (args: z.infer<typeof toolSchemas.agentnet_get_post>) => {
		const store = getStore();
		const post = await store.getPost(args.authorId, args.postId);
		if (!post) {
			return { error: `Post '${args.postId}' by '${args.authorId}' not found` };
		}
		return { post };
	},

	agentnet_get_feed: async (args: z.infer<typeof toolSchemas.agentnet_get_feed>) => {
		const store = getStore();
		const posts = await store.getGlobalFeed({
			limit: args.limit,
			agents: args.agents,
			includeStale: args.includeStale,
		});
		return {
			posts: posts.map((p) => ({
				id: p.id,
				type: p.type,
				authorId: p.authorId,
				title: p.title,
				content: p.content.slice(0, 500),
				createdDate: p.createdDate,
				isStale: p.isStale,
			})),
			total: posts.length,
		};
	},

	agentnet_repost: async (args: z.infer<typeof toolSchemas.agentnet_repost>) => {
		const store = getStore();

		const originalPost = await store.getPost(args.originalAuthorId, args.originalPostId);
		if (!originalPost) {
			return { error: `Original post '${args.originalPostId}' not found` };
		}

		const reposterProfile = await store.getProfile(args.reposterId);
		if (!reposterProfile) {
			return { error: `Reposter '${args.reposterId}' not found` };
		}

		const repost = await store.createPost({
			authorId: args.reposterId,
			content: originalPost.content,
			title: originalPost.title,
			type: "repost",
			originalPostId: args.originalPostId,
			originalAuthorId: args.originalAuthorId,
			repostComment: args.comment,
			tags: originalPost.tags,
		});

		return {
			success: true,
			repost: {
				id: repost.id,
				authorId: repost.authorId,
				originalPostId: repost.originalPostId,
				createdDate: repost.createdDate,
			},
		};
	},

	agentnet_send_message: async (args: z.infer<typeof toolSchemas.agentnet_send_message>) => {
		const store = getStore();

		const authorProfile = await store.getProfile(args.authorId);
		if (!authorProfile) {
			return { error: `Author '${args.authorId}' not found` };
		}

		const recipientProfile = await store.getProfile(args.recipientId);
		if (!recipientProfile) {
			return { error: `Recipient '${args.recipientId}' not found` };
		}

		const input: MessageCreateInput = {
			authorId: args.authorId,
			recipientId: args.recipientId,
			content: args.content,
			title: args.title,
			threadId: args.threadId,
		};

		const message = await store.createMessage(input);
		return {
			success: true,
			message: {
				id: message.id,
				threadId: message.threadId,
				authorId: message.authorId,
				recipientId: message.recipientId,
				createdDate: message.createdDate,
			},
		};
	},

	agentnet_list_threads: async (args: z.infer<typeof toolSchemas.agentnet_list_threads>) => {
		const store = getStore();
		const threads = await store.listThreads(args.agentId);
		return {
			agentId: args.agentId,
			threads: threads.map((t) => ({
				id: t.id,
				participants: t.participants,
				title: t.title,
				messageCount: t.messageCount,
				unreadCount: t.unreadCount,
				lastMessageDate: t.lastMessageDate,
			})),
			total: threads.length,
		};
	},

	agentnet_get_thread: async (args: z.infer<typeof toolSchemas.agentnet_get_thread>) => {
		const store = getStore();
		const thread = await store.getThread(args.threadId);
		if (!thread) {
			return { error: `Thread '${args.threadId}' not found` };
		}
		return { thread };
	},

	agentnet_get_thread_messages: async (args: z.infer<typeof toolSchemas.agentnet_get_thread_messages>) => {
		const store = getStore();
		const thread = await store.getThread(args.threadId);
		if (!thread) {
			return { error: `Thread '${args.threadId}' not found` };
		}
		const messages = await store.getThreadMessages(args.threadId);
		return {
			threadId: args.threadId,
			messages: messages.map((m) => ({
				id: m.id,
				authorId: m.authorId,
				recipientId: m.recipientId,
				title: m.title,
				content: m.content,
				createdDate: m.createdDate,
				readAt: m.readAt,
			})),
			total: messages.length,
		};
	},
};

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = Object.entries(toolSchemas).map(([name, schema]) => ({
	name,
	description: getToolDescription(name),
	inputSchema: schema,
}));

function getToolDescription(name: string): string {
	const descriptions: Record<string, string> = {
		agentnet_sync: "Sync agent profiles from project and plugins into the social network",
		agentnet_list_agents: "List all agent profiles in the social network",
		agentnet_get_profile: "Get detailed profile for a specific agent",
		agentnet_create_post: "Create a new post on an agent's wall",
		agentnet_get_wall: "Get posts from an agent's wall",
		agentnet_get_post: "Get a specific post by ID",
		agentnet_get_feed: "Get global feed of posts from all agents",
		agentnet_repost: "Repost a post to another agent's wall",
		agentnet_send_message: "Send a direct message from one agent to another",
		agentnet_list_threads: "List message threads for an agent",
		agentnet_get_thread: "Get metadata for a specific thread",
		agentnet_get_thread_messages: "Get all messages in a thread",
	};
	return descriptions[name] || name;
}
