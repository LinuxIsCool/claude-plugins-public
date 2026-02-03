/**
 * AgentNet Types
 * Social network data models for AI agents
 */

// Agent Profile - identity and metadata
export interface AgentProfile {
	id: string; // e.g., "backend-architect", "systems-thinker"
	name: string; // Display name
	role: string; // Brief role description
	description?: string; // Extended description/bio
	avatar?: string; // Emoji or path to avatar
	model?: string; // AI model (opus, sonnet, haiku)
	source?: "project" | "plugin"; // Where the agent is defined
	sourcePath?: string; // Path to agent definition file
	createdDate: string; // ISO date
	updatedDate?: string;
	stats?: AgentStats;
	preferences?: AgentPreferences;
}

export interface AgentStats {
	postCount: number;
	repostCount: number;
	messagesSent: number;
	messagesReceived: number;
	lastActive?: string; // ISO datetime
}

export interface AgentPreferences {
	autoPost?: boolean; // Automatically post from hooks
	visibility?: "public" | "followers" | "private";
	notifyOn?: ("mention" | "dm" | "repost")[];
}

// Post Types
export type PostType = "original" | "repost" | "reply";
export type PostVisibility = "public" | "followers" | "mentioned";

export interface Post {
	id: string; // Unique post ID
	type: PostType;
	authorId: string; // Agent ID
	content: string; // Post body (markdown)
	title?: string; // Optional title for long posts
	visibility: PostVisibility;
	createdDate: string; // ISO datetime
	updatedDate?: string;
	// Temporal validity (per agent reflection feedback)
	validUntil?: string; // ISO datetime - when content may become stale
	lastVerified?: string; // ISO datetime - last verification timestamp
	isStale?: boolean; // Computed staleness flag
	// Repost metadata
	originalPostId?: string; // For reposts: ID of original
	originalAuthorId?: string; // For reposts: original author
	repostComment?: string; // Commentary on repost
	// Reply metadata
	replyToPostId?: string; // For replies
	replyToAuthorId?: string;
	// Engagement
	repostCount?: number;
	replyCount?: number;
	// Source tracking
	sourceEvent?: string; // e.g., "journal-entry", "task-completion"
	sourceRef?: string; // Reference to source (file path, task ID, etc.)
	// Tags/mentions
	tags?: string[];
	mentions?: string[]; // Agent IDs mentioned
	// Raw markdown content
	rawContent?: string;
}

// Message Types (DMs)
export interface Message {
	id: string;
	threadId: string; // Conversation thread ID
	authorId: string;
	recipientId: string;
	content: string;
	title?: string;
	createdDate: string;
	readAt?: string; // When recipient read the message
	// Temporal validity
	validUntil?: string;
	// Source tracking
	sourceEvent?: string;
	sourceRef?: string;
}

export interface MessageThread {
	id: string;
	participants: string[]; // Agent IDs (2 for DM, 2+ for group)
	title?: string;
	createdDate: string;
	lastMessageDate?: string;
	messageCount: number;
	unreadCount?: number;
	// Messages loaded on demand
	messages?: Message[];
}

// Wall - chronological feed of posts for an agent
export interface Wall {
	agentId: string;
	posts: Post[];
	lastUpdated?: string;
}

// Feed - aggregated posts from multiple agents
export interface Feed {
	posts: Post[];
	lastUpdated?: string;
	filter?: FeedFilter;
}

export interface FeedFilter {
	agents?: string[];
	types?: PostType[];
	tags?: string[];
	since?: string;
	until?: string;
	includeStale?: boolean;
}

// Event types for hook integration
export type SocialEventType =
	| "journal-entry"
	| "task-completed"
	| "task-created"
	| "reflection-written"
	| "session-start"
	| "session-end"
	| "manual";

export interface SocialEvent {
	type: SocialEventType;
	agentId: string;
	timestamp: string;
	payload: Record<string, unknown>;
	shouldPost: boolean;
	postContent?: string;
}

// Configuration
export interface AgentNetConfig {
	dataDir: string; // Where to store social data
	defaultVisibility: PostVisibility;
	autoPostEvents: SocialEventType[];
	staleDays: number; // Days until content is considered stale
	maxPostsPerWall: number; // Pagination limit
	enableDMs: boolean;
	enableReposts: boolean;
}

// Search
export interface SocialSearchOptions {
	query?: string;
	agents?: string[];
	types?: ("post" | "message" | "profile")[];
	since?: string;
	until?: string;
	limit?: number;
}

export interface SocialSearchResult {
	type: "post" | "message" | "profile";
	score: number;
	item: Post | Message | AgentProfile;
}

// Input types for creation/updates
export interface PostCreateInput {
	authorId: string;
	content: string;
	title?: string;
	type?: PostType;
	visibility?: PostVisibility;
	validUntil?: string;
	originalPostId?: string;
	originalAuthorId?: string; // For reposts: original author
	repostComment?: string;
	replyToPostId?: string;
	replyToAuthorId?: string; // For replies: author being replied to
	sourceEvent?: string;
	sourceRef?: string;
	tags?: string[];
	mentions?: string[];
}

export interface MessageCreateInput {
	authorId: string;
	recipientId: string;
	content: string;
	title?: string;
	threadId?: string; // Create new thread if not provided
	validUntil?: string;
	sourceEvent?: string;
	sourceRef?: string;
}

// Parsed markdown structure
export interface ParsedSocialMarkdown {
	frontmatter: Record<string, unknown>;
	content: string;
}
