/**
 * AgentNet File Store
 * File-based storage for social data following Backlog.md patterns
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
	AgentNetConfig,
	AgentProfile,
	Message,
	MessageThread,
	Post,
	PostCreateInput,
	MessageCreateInput,
} from "../types/index.ts";
import { parsePost, parseMessage, parseThread, parseProfile } from "./parser.ts";
import {
	serializePost,
	serializeMessage,
	serializeThread,
	serializeProfile,
} from "./serializer.ts";
import { getClaudePath } from "../../../../lib/paths.ts";

/**
 * Get the social data directory (anchored to repo root)
 */
function getDefaultDataDir(): string {
	return getClaudePath("social");
}

/**
 * Default data dir marker (relative path signals "use default")
 */
const DEFAULT_DATA_DIR = ".claude/social";

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: AgentNetConfig = {
	dataDir: DEFAULT_DATA_DIR,
	defaultVisibility: "public",
	autoPostEvents: ["journal-entry", "task-completed"],
	staleDays: 30,
	maxPostsPerWall: 100,
	enableDMs: true,
	enableReposts: true,
};

/**
 * Directory structure within dataDir:
 * .claude/social/
 * ├── profiles/          # Agent profiles (auto-generated from agents)
 * │   ├── backend-architect.md
 * │   └── systems-thinker.md
 * ├── walls/             # Per-agent posts
 * │   ├── backend-architect/
 * │   │   ├── 2025-12-13-001.md
 * │   │   └── 2025-12-13-002.md
 * │   └── systems-thinker/
 * │       └── 2025-12-13-001.md
 * ├── threads/           # DM threads
 * │   ├── thread-001/
 * │   │   ├── index.md   # Thread metadata
 * │   │   ├── 001.md     # Messages
 * │   │   └── 002.md
 * │   └── thread-002/
 * └── feeds/             # Aggregated feeds (computed/cached)
 *     └── global.json
 */

export class SocialStore {
	private config: AgentNetConfig;
	private rootDir: string;

	constructor(rootDir: string, config?: Partial<AgentNetConfig>) {
		this.rootDir = rootDir;
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.ensureDirectories();
	}

	/**
	 * Get the data directory path (anchored to repo root)
	 */
	get dataDir(): string {
		// Always use repo-root anchored path to prevent data fragmentation
		if (this.config.dataDir === DEFAULT_DATA_DIR) {
			return getDefaultDataDir();
		}
		// Custom path: if absolute, use as-is; if relative, join with rootDir
		if (this.config.dataDir.startsWith("/")) {
			return this.config.dataDir;
		}
		return join(this.rootDir, this.config.dataDir);
	}

	/**
	 * Ensure required directories exist
	 */
	private ensureDirectories(): void {
		const dirs = [
			this.dataDir,
			join(this.dataDir, "profiles"),
			join(this.dataDir, "walls"),
			join(this.dataDir, "threads"),
			join(this.dataDir, "feeds"),
		];

		for (const dir of dirs) {
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
		}
	}

	/**
	 * Generate unique post ID based on date and sequence
	 */
	private generatePostId(authorId: string): string {
		const date = new Date().toISOString().slice(0, 10);
		const wallDir = join(this.dataDir, "walls", authorId);

		if (!existsSync(wallDir)) {
			mkdirSync(wallDir, { recursive: true });
			return `${date}-001`;
		}

		const existing = readdirSync(wallDir)
			.filter((f) => f.startsWith(date) && f.endsWith(".md"))
			.map((f) => {
				const match = f.match(/\d{4}-\d{2}-\d{2}-(\d+)\.md$/);
				return match ? parseInt(match[1], 10) : 0;
			})
			.sort((a, b) => b - a);

		const next = (existing[0] || 0) + 1;
		return `${date}-${String(next).padStart(3, "0")}`;
	}

	/**
	 * Generate unique thread ID
	 */
	private generateThreadId(): string {
		const threadsDir = join(this.dataDir, "threads");
		const existing = existsSync(threadsDir)
			? readdirSync(threadsDir)
					.filter((f) => f.startsWith("thread-"))
					.map((f) => {
						const match = f.match(/thread-(\d+)/);
						return match ? parseInt(match[1], 10) : 0;
					})
					.sort((a, b) => b - a)
			: [];

		const next = (existing[0] || 0) + 1;
		return `thread-${String(next).padStart(3, "0")}`;
	}

	/**
	 * Generate unique message ID within thread
	 */
	private generateMessageId(threadId: string): string {
		const threadDir = join(this.dataDir, "threads", threadId);

		if (!existsSync(threadDir)) {
			return "001";
		}

		const existing = readdirSync(threadDir)
			.filter((f) => f.endsWith(".md") && f !== "index.md")
			.map((f) => {
				const match = f.match(/^(\d+)\.md$/);
				return match ? parseInt(match[1], 10) : 0;
			})
			.sort((a, b) => b - a);

		const next = (existing[0] || 0) + 1;
		return String(next).padStart(3, "0");
	}

	// ===== Profile Operations =====

	/**
	 * List all agent profiles
	 */
	async listProfiles(): Promise<AgentProfile[]> {
		const profilesDir = join(this.dataDir, "profiles");
		if (!existsSync(profilesDir)) return [];

		const files = readdirSync(profilesDir).filter((f) => f.endsWith(".md"));
		const profiles: AgentProfile[] = [];

		for (const file of files) {
			const content = await Bun.file(join(profilesDir, file)).text();
			profiles.push(parseProfile(content));
		}

		return profiles.sort((a, b) => a.id.localeCompare(b.id));
	}

	/**
	 * Get agent profile by ID
	 */
	async getProfile(agentId: string): Promise<AgentProfile | null> {
		const filePath = join(this.dataDir, "profiles", `${agentId}.md`);
		if (!existsSync(filePath)) return null;

		const content = await Bun.file(filePath).text();
		return parseProfile(content);
	}

	/**
	 * Save agent profile
	 */
	async saveProfile(profile: AgentProfile): Promise<void> {
		const filePath = join(this.dataDir, "profiles", `${profile.id}.md`);
		await Bun.write(filePath, serializeProfile(profile));
	}

	// ===== Post Operations =====

	/**
	 * Create a new post
	 */
	async createPost(input: PostCreateInput): Promise<Post> {
		const postId = this.generatePostId(input.authorId);
		const now = new Date().toISOString();

		const post: Post = {
			id: postId,
			type: input.type || "original",
			authorId: input.authorId,
			content: input.content,
			title: input.title,
			visibility: input.visibility || this.config.defaultVisibility,
			createdDate: now,
			validUntil: input.validUntil,
			originalPostId: input.originalPostId,
			originalAuthorId: input.originalAuthorId,
			repostComment: input.repostComment,
			replyToPostId: input.replyToPostId,
			sourceEvent: input.sourceEvent,
			sourceRef: input.sourceRef,
			tags: input.tags,
			mentions: input.mentions,
			repostCount: 0,
			replyCount: 0,
		};

		// Ensure wall directory exists
		const wallDir = join(this.dataDir, "walls", input.authorId);
		if (!existsSync(wallDir)) {
			mkdirSync(wallDir, { recursive: true });
		}

		const filePath = join(wallDir, `${postId}.md`);
		await Bun.write(filePath, serializePost(post));

		// Update profile stats
		const profile = await this.getProfile(input.authorId);
		if (profile) {
			profile.stats = profile.stats || {
				postCount: 0,
				repostCount: 0,
				messagesSent: 0,
				messagesReceived: 0,
			};
			if (post.type === "repost") {
				profile.stats.repostCount++;
			} else {
				profile.stats.postCount++;
			}
			profile.stats.lastActive = now;
			await this.saveProfile(profile);
		}

		return post;
	}

	/**
	 * Get post by ID
	 */
	async getPost(authorId: string, postId: string): Promise<Post | null> {
		const filePath = join(this.dataDir, "walls", authorId, `${postId}.md`);
		if (!existsSync(filePath)) return null;

		const content = await Bun.file(filePath).text();
		return parsePost(content);
	}

	/**
	 * Get all posts from an agent's wall
	 */
	async getWall(
		agentId: string,
		options?: { limit?: number; offset?: number; includeStale?: boolean }
	): Promise<Post[]> {
		const wallDir = join(this.dataDir, "walls", agentId);
		if (!existsSync(wallDir)) return [];

		const files = readdirSync(wallDir)
			.filter((f) => f.endsWith(".md"))
			.sort()
			.reverse(); // Newest first

		const limit = options?.limit || this.config.maxPostsPerWall;
		const offset = options?.offset || 0;
		const sliced = files.slice(offset, offset + limit);

		const posts: Post[] = [];
		for (const file of sliced) {
			const content = await Bun.file(join(wallDir, file)).text();
			const post = parsePost(content);

			// Check staleness
			if (post.validUntil && new Date(post.validUntil) < new Date()) {
				post.isStale = true;
			}

			if (!post.isStale || options?.includeStale) {
				posts.push(post);
			}
		}

		return posts;
	}

	/**
	 * Get global feed (all posts across all agents)
	 */
	async getGlobalFeed(options?: {
		limit?: number;
		agents?: string[];
		includeStale?: boolean;
	}): Promise<Post[]> {
		const wallsDir = join(this.dataDir, "walls");
		if (!existsSync(wallsDir)) return [];

		const agents = options?.agents || readdirSync(wallsDir).filter((f) => {
			const stat = statSync(join(wallsDir, f));
			return stat.isDirectory();
		});

		const allPosts: Post[] = [];
		for (const agentId of agents) {
			const posts = await this.getWall(agentId, {
				limit: options?.limit,
				includeStale: options?.includeStale,
			});
			allPosts.push(...posts);
		}

		// Sort by date descending
		return allPosts
			.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
			.slice(0, options?.limit || 100);
	}

	// ===== Message Operations =====

	/**
	 * Create a new message
	 */
	async createMessage(input: MessageCreateInput): Promise<Message> {
		const now = new Date().toISOString();
		let threadId = input.threadId;

		// Create new thread if not provided
		if (!threadId) {
			threadId = this.generateThreadId();
			const thread: MessageThread = {
				id: threadId,
				participants: [input.authorId, input.recipientId].sort(),
				createdDate: now,
				lastMessageDate: now,
				messageCount: 0,
			};
			await this.saveThread(thread);
		}

		const messageId = this.generateMessageId(threadId);
		const message: Message = {
			id: messageId,
			threadId,
			authorId: input.authorId,
			recipientId: input.recipientId,
			content: input.content,
			title: input.title,
			createdDate: now,
			validUntil: input.validUntil,
			sourceEvent: input.sourceEvent,
			sourceRef: input.sourceRef,
		};

		// Ensure thread directory exists
		const threadDir = join(this.dataDir, "threads", threadId);
		if (!existsSync(threadDir)) {
			mkdirSync(threadDir, { recursive: true });
		}

		const filePath = join(threadDir, `${messageId}.md`);
		await Bun.write(filePath, serializeMessage(message));

		// Update thread metadata
		const thread = await this.getThread(threadId);
		if (thread) {
			thread.lastMessageDate = now;
			thread.messageCount++;
			await this.saveThread(thread);
		}

		// Update profile stats
		const senderProfile = await this.getProfile(input.authorId);
		if (senderProfile) {
			senderProfile.stats = senderProfile.stats || {
				postCount: 0,
				repostCount: 0,
				messagesSent: 0,
				messagesReceived: 0,
			};
			senderProfile.stats.messagesSent++;
			senderProfile.stats.lastActive = now;
			await this.saveProfile(senderProfile);
		}

		const recipientProfile = await this.getProfile(input.recipientId);
		if (recipientProfile) {
			recipientProfile.stats = recipientProfile.stats || {
				postCount: 0,
				repostCount: 0,
				messagesSent: 0,
				messagesReceived: 0,
			};
			recipientProfile.stats.messagesReceived++;
			await this.saveProfile(recipientProfile);
		}

		return message;
	}

	/**
	 * Get thread by ID
	 */
	async getThread(threadId: string): Promise<MessageThread | null> {
		const filePath = join(this.dataDir, "threads", threadId, "index.md");
		if (!existsSync(filePath)) return null;

		const content = await Bun.file(filePath).text();
		return parseThread(content);
	}

	/**
	 * Save thread metadata
	 */
	async saveThread(thread: MessageThread): Promise<void> {
		const threadDir = join(this.dataDir, "threads", thread.id);
		if (!existsSync(threadDir)) {
			mkdirSync(threadDir, { recursive: true });
		}
		const filePath = join(threadDir, "index.md");
		await Bun.write(filePath, serializeThread(thread));
	}

	/**
	 * Get messages in a thread
	 */
	async getThreadMessages(threadId: string): Promise<Message[]> {
		const threadDir = join(this.dataDir, "threads", threadId);
		if (!existsSync(threadDir)) return [];

		const files = readdirSync(threadDir)
			.filter((f) => f.endsWith(".md") && f !== "index.md")
			.sort();

		const messages: Message[] = [];
		for (const file of files) {
			const content = await Bun.file(join(threadDir, file)).text();
			messages.push(parseMessage(content));
		}

		return messages;
	}

	/**
	 * List all threads for an agent
	 */
	async listThreads(agentId: string): Promise<MessageThread[]> {
		const threadsDir = join(this.dataDir, "threads");
		if (!existsSync(threadsDir)) return [];

		const threadDirs = readdirSync(threadsDir).filter((f) =>
			statSync(join(threadsDir, f)).isDirectory()
		);

		const threads: MessageThread[] = [];
		for (const dir of threadDirs) {
			const thread = await this.getThread(dir);
			if (thread && thread.participants.includes(agentId)) {
				threads.push(thread);
			}
		}

		return threads.sort(
			(a, b) =>
				new Date(b.lastMessageDate || b.createdDate).getTime() -
				new Date(a.lastMessageDate || a.createdDate).getTime()
		);
	}

	/**
	 * Find or create thread between two agents
	 */
	async findOrCreateThread(
		agent1: string,
		agent2: string
	): Promise<MessageThread> {
		const participants = [agent1, agent2].sort();
		const threads = await this.listThreads(agent1);

		const existing = threads.find(
			(t) =>
				t.participants.length === 2 &&
				t.participants[0] === participants[0] &&
				t.participants[1] === participants[1]
		);

		if (existing) return existing;

		const threadId = this.generateThreadId();
		const thread: MessageThread = {
			id: threadId,
			participants,
			createdDate: new Date().toISOString(),
			messageCount: 0,
		};

		await this.saveThread(thread);
		return thread;
	}
}
