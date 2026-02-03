/**
 * AgentNet Serializer
 * Convert social data objects to markdown with YAML frontmatter
 */

import type {
	AgentProfile,
	Message,
	MessageThread,
	Post,
} from "../types/index.ts";

/**
 * Check if a string needs YAML quoting
 */
function needsQuoting(value: string): boolean {
	// Quote if contains special YAML characters or starts with special chars
	return /[:#\[\]{}|>!&*@`'"\\,\n]|^[-?]/.test(value);
}

/**
 * Escape and quote a string for YAML if needed
 */
function yamlString(value: string): string {
	if (!needsQuoting(value)) return value;
	// Use double quotes and escape internal double quotes and backslashes
	const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escaped}"`;
}

/**
 * Serialize object to YAML frontmatter + markdown body
 */
function toMarkdown(
	frontmatter: Record<string, unknown>,
	body?: string
): string {
	const yaml = Object.entries(frontmatter)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				if (value.length === 0) return null;
				return `${key}: [${value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(", ")}]`;
			}
			if (typeof value === "object") {
				return `${key}: ${JSON.stringify(value)}`;
			}
			if (typeof value === "string" && value.includes("\n")) {
				return `${key}: |\n  ${value.split("\n").join("\n  ")}`;
			}
			if (typeof value === "string") {
				return `${key}: ${yamlString(value)}`;
			}
			return `${key}: ${value}`;
		})
		.filter(Boolean)
		.join("\n");

	const content = body ? `\n${body}` : "";
	return `---\n${yaml}\n---${content}\n`;
}

/**
 * Serialize agent profile to markdown
 */
export function serializeProfile(profile: AgentProfile): string {
	const frontmatter: Record<string, unknown> = {
		id: profile.id,
		name: profile.name,
		role: profile.role,
		avatar: profile.avatar,
		model: profile.model,
		source: profile.source,
		sourcePath: profile.sourcePath,
		createdDate: profile.createdDate,
		updatedDate: profile.updatedDate,
		stats: profile.stats,
		preferences: profile.preferences,
	};

	return toMarkdown(frontmatter, profile.description);
}

/**
 * Serialize post to markdown
 */
export function serializePost(post: Post): string {
	const frontmatter: Record<string, unknown> = {
		id: post.id,
		type: post.type,
		authorId: post.authorId,
		title: post.title,
		visibility: post.visibility,
		createdDate: post.createdDate,
		updatedDate: post.updatedDate,
		validUntil: post.validUntil,
		lastVerified: post.lastVerified,
		isStale: post.isStale,
		originalPostId: post.originalPostId,
		originalAuthorId: post.originalAuthorId,
		repostComment: post.repostComment,
		replyToPostId: post.replyToPostId,
		replyToAuthorId: post.replyToAuthorId,
		repostCount: post.repostCount,
		replyCount: post.replyCount,
		sourceEvent: post.sourceEvent,
		sourceRef: post.sourceRef,
		tags: post.tags,
		mentions: post.mentions,
	};

	return toMarkdown(frontmatter, post.content);
}

/**
 * Serialize message to markdown
 */
export function serializeMessage(message: Message): string {
	const frontmatter: Record<string, unknown> = {
		id: message.id,
		threadId: message.threadId,
		authorId: message.authorId,
		recipientId: message.recipientId,
		title: message.title,
		createdDate: message.createdDate,
		readAt: message.readAt,
		validUntil: message.validUntil,
		sourceEvent: message.sourceEvent,
		sourceRef: message.sourceRef,
	};

	return toMarkdown(frontmatter, message.content);
}

/**
 * Serialize message thread index to markdown
 */
export function serializeThread(thread: MessageThread): string {
	const frontmatter: Record<string, unknown> = {
		id: thread.id,
		participants: thread.participants,
		title: thread.title,
		createdDate: thread.createdDate,
		lastMessageDate: thread.lastMessageDate,
		messageCount: thread.messageCount,
		unreadCount: thread.unreadCount,
	};

	return toMarkdown(frontmatter);
}
