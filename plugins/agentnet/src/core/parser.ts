/**
 * AgentNet Parser
 * Markdown + YAML frontmatter parsing for social content
 */

import matter from "gray-matter";
import type {
	AgentProfile,
	Message,
	MessageThread,
	ParsedSocialMarkdown,
	Post,
} from "../types/index.ts";

/**
 * Parse markdown with YAML frontmatter
 */
export function parseMarkdown(content: string): ParsedSocialMarkdown {
	const parsed = matter(content);
	return {
		frontmatter: parsed.data,
		content: parsed.content.trim(),
	};
}

/**
 * Normalize date values to ISO format
 */
function normalizeDate(value: unknown): string {
	if (!value) return "";
	if (value instanceof Date) {
		return value.toISOString();
	}
	const str = String(value).trim();
	if (!str) return "";
	// Already ISO format
	if (str.match(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/)) {
		return str;
	}
	return str;
}

/**
 * Parse agent profile from markdown
 */
export function parseProfile(content: string): AgentProfile {
	const { frontmatter, content: description } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		name: String(frontmatter.name || frontmatter.id || ""),
		role: String(frontmatter.role || ""),
		description: description || undefined,
		avatar: frontmatter.avatar ? String(frontmatter.avatar) : undefined,
		model: frontmatter.model ? String(frontmatter.model) : undefined,
		source: frontmatter.source as "project" | "plugin" | undefined,
		sourcePath: frontmatter.sourcePath
			? String(frontmatter.sourcePath)
			: undefined,
		createdDate: normalizeDate(frontmatter.createdDate || frontmatter.created_date),
		updatedDate: frontmatter.updatedDate
			? normalizeDate(frontmatter.updatedDate)
			: undefined,
		stats: frontmatter.stats as AgentProfile["stats"],
		preferences: frontmatter.preferences as AgentProfile["preferences"],
	};
}

/**
 * Parse post from markdown
 */
export function parsePost(content: string): Post {
	const { frontmatter, content: body } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		type: (frontmatter.type as Post["type"]) || "original",
		authorId: String(frontmatter.authorId || frontmatter.author_id || ""),
		content: body,
		title: frontmatter.title ? String(frontmatter.title) : undefined,
		visibility: (frontmatter.visibility as Post["visibility"]) || "public",
		createdDate: normalizeDate(frontmatter.createdDate || frontmatter.created_date),
		updatedDate: frontmatter.updatedDate
			? normalizeDate(frontmatter.updatedDate)
			: undefined,
		validUntil: frontmatter.validUntil
			? normalizeDate(frontmatter.validUntil)
			: undefined,
		lastVerified: frontmatter.lastVerified
			? normalizeDate(frontmatter.lastVerified)
			: undefined,
		isStale: frontmatter.isStale === true,
		originalPostId: frontmatter.originalPostId
			? String(frontmatter.originalPostId)
			: undefined,
		originalAuthorId: frontmatter.originalAuthorId
			? String(frontmatter.originalAuthorId)
			: undefined,
		repostComment: frontmatter.repostComment
			? String(frontmatter.repostComment)
			: undefined,
		replyToPostId: frontmatter.replyToPostId
			? String(frontmatter.replyToPostId)
			: undefined,
		replyToAuthorId: frontmatter.replyToAuthorId
			? String(frontmatter.replyToAuthorId)
			: undefined,
		repostCount:
			typeof frontmatter.repostCount === "number"
				? frontmatter.repostCount
				: undefined,
		replyCount:
			typeof frontmatter.replyCount === "number"
				? frontmatter.replyCount
				: undefined,
		sourceEvent: frontmatter.sourceEvent
			? String(frontmatter.sourceEvent)
			: undefined,
		sourceRef: frontmatter.sourceRef
			? String(frontmatter.sourceRef)
			: undefined,
		tags: Array.isArray(frontmatter.tags)
			? frontmatter.tags.map(String)
			: undefined,
		mentions: Array.isArray(frontmatter.mentions)
			? frontmatter.mentions.map(String)
			: undefined,
		rawContent: content,
	};
}

/**
 * Parse message from markdown
 */
export function parseMessage(content: string): Message {
	const { frontmatter, content: body } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		threadId: String(frontmatter.threadId || frontmatter.thread_id || ""),
		authorId: String(frontmatter.authorId || frontmatter.author_id || ""),
		recipientId: String(
			frontmatter.recipientId || frontmatter.recipient_id || ""
		),
		content: body,
		title: frontmatter.title ? String(frontmatter.title) : undefined,
		createdDate: normalizeDate(frontmatter.createdDate || frontmatter.created_date),
		readAt: frontmatter.readAt ? normalizeDate(frontmatter.readAt) : undefined,
		validUntil: frontmatter.validUntil
			? normalizeDate(frontmatter.validUntil)
			: undefined,
		sourceEvent: frontmatter.sourceEvent
			? String(frontmatter.sourceEvent)
			: undefined,
		sourceRef: frontmatter.sourceRef
			? String(frontmatter.sourceRef)
			: undefined,
	};
}

/**
 * Parse message thread index from YAML
 */
export function parseThread(content: string): MessageThread {
	const { frontmatter } = parseMarkdown(content);

	return {
		id: String(frontmatter.id || ""),
		participants: Array.isArray(frontmatter.participants)
			? frontmatter.participants.map(String)
			: [],
		title: frontmatter.title ? String(frontmatter.title) : undefined,
		createdDate: normalizeDate(frontmatter.createdDate || frontmatter.created_date),
		lastMessageDate: frontmatter.lastMessageDate
			? normalizeDate(frontmatter.lastMessageDate)
			: undefined,
		messageCount:
			typeof frontmatter.messageCount === "number"
				? frontmatter.messageCount
				: 0,
		unreadCount:
			typeof frontmatter.unreadCount === "number"
				? frontmatter.unreadCount
				: undefined,
	};
}
