/**
 * AgentNet Serializer Tests
 * Tests for serializing social data to markdown
 */

import { describe, test, expect } from "bun:test";
import {
	serializeProfile,
	serializePost,
	serializeMessage,
	serializeThread,
} from "../core/serializer.ts";
import {
	parseProfile,
	parsePost,
	parseMessage,
	parseThread,
} from "../core/parser.ts";
import type { AgentProfile, Post, Message, MessageThread } from "../types/index.ts";

describe("serializeProfile", () => {
	test("should serialize profile to markdown", () => {
		const profile: AgentProfile = {
			id: "test-agent",
			name: "Test Agent",
			role: "Testing role",
			description: "Agent description here",
			model: "sonnet",
			source: "project",
			sourcePath: "/path/to/agent.md",
			createdDate: "2025-12-15T10:00:00Z",
		};

		const markdown = serializeProfile(profile);
		expect(markdown).toContain("---");
		expect(markdown).toContain("id: test-agent");
		expect(markdown).toContain("name: Test Agent");
		expect(markdown).toContain("role: Testing role");
		expect(markdown).toContain("model: sonnet");
		expect(markdown).toContain("Agent description here");
	});

	test("should round-trip profile", () => {
		const original: AgentProfile = {
			id: "round-trip-agent",
			name: "Round Trip Agent",
			role: "Testing round trips",
			description: "This is a description.",
			model: "opus",
			source: "plugin",
			createdDate: "2025-12-15T10:00:00Z",
			stats: {
				postCount: 10,
				repostCount: 5,
				messagesSent: 20,
				messagesReceived: 15,
			},
		};

		const markdown = serializeProfile(original);
		const parsed = parseProfile(markdown);

		expect(parsed.id).toBe(original.id);
		expect(parsed.name).toBe(original.name);
		expect(parsed.role).toBe(original.role);
		expect(parsed.description).toBe(original.description);
		expect(parsed.model).toBe(original.model);
		expect(parsed.stats?.postCount).toBe(original.stats?.postCount);
	});

	test("should handle special characters in values", () => {
		const profile: AgentProfile = {
			id: "special-chars",
			name: "Agent: The Special One",
			role: "Handles #tags and @mentions",
			description: "Description with \"quotes\" and 'apostrophes'",
			createdDate: "2025-12-15T10:00:00Z",
		};

		const markdown = serializeProfile(profile);
		const parsed = parseProfile(markdown);

		expect(parsed.name).toBe(profile.name);
		expect(parsed.role).toBe(profile.role);
	});
});

describe("serializePost", () => {
	test("should serialize post to markdown", () => {
		const post: Post = {
			id: "2025-12-15-001",
			type: "original",
			authorId: "test-agent",
			content: "Post content here",
			title: "Post Title",
			visibility: "public",
			createdDate: "2025-12-15T10:00:00Z",
			tags: ["test", "example"],
		};

		const markdown = serializePost(post);
		expect(markdown).toContain("id: 2025-12-15-001");
		expect(markdown).toContain("type: original");
		expect(markdown).toContain("authorId: test-agent");
		expect(markdown).toContain("Post content here");
	});

	test("should round-trip post", () => {
		const original: Post = {
			id: "2025-12-15-002",
			type: "original",
			authorId: "test-agent",
			content: "Multi-line\ncontent\nhere",
			title: "Test Title",
			visibility: "public",
			createdDate: "2025-12-15T10:00:00Z",
			tags: ["one", "two"],
			mentions: ["other-agent"],
		};

		const markdown = serializePost(original);
		const parsed = parsePost(markdown);

		expect(parsed.id).toBe(original.id);
		expect(parsed.authorId).toBe(original.authorId);
		expect(parsed.content).toBe(original.content);
		expect(parsed.tags).toEqual(original.tags);
	});

	test("should serialize repost correctly", () => {
		const repost: Post = {
			id: "2025-12-15-003",
			type: "repost",
			authorId: "reposter",
			content: "Reposted content",
			visibility: "public",
			createdDate: "2025-12-15T11:00:00Z",
			originalPostId: "2025-12-15-001",
			originalAuthorId: "original-author",
			repostComment: "Great post!",
		};

		const markdown = serializePost(repost);
		const parsed = parsePost(markdown);

		expect(parsed.type).toBe("repost");
		expect(parsed.originalPostId).toBe(repost.originalPostId);
		expect(parsed.originalAuthorId).toBe(repost.originalAuthorId);
		expect(parsed.repostComment).toBe(repost.repostComment);
	});
});

describe("serializeMessage", () => {
	test("should serialize message to markdown", () => {
		const message: Message = {
			id: "msg-001",
			threadId: "thread-001",
			authorId: "sender",
			recipientId: "receiver",
			content: "Hello there!",
			title: "Greeting",
			createdDate: "2025-12-15T10:00:00Z",
		};

		const markdown = serializeMessage(message);
		expect(markdown).toContain("id: msg-001");
		expect(markdown).toContain("threadId: thread-001");
		expect(markdown).toContain("authorId: sender");
		expect(markdown).toContain("Hello there!");
	});

	test("should round-trip message", () => {
		const original: Message = {
			id: "msg-002",
			threadId: "thread-002",
			authorId: "agent-a",
			recipientId: "agent-b",
			content: "Message content",
			title: "Subject",
			createdDate: "2025-12-15T10:00:00Z",
			readAt: "2025-12-15T11:00:00Z",
		};

		const markdown = serializeMessage(original);
		const parsed = parseMessage(markdown);

		expect(parsed.id).toBe(original.id);
		expect(parsed.threadId).toBe(original.threadId);
		expect(parsed.authorId).toBe(original.authorId);
		expect(parsed.recipientId).toBe(original.recipientId);
		expect(parsed.content).toBe(original.content);
	});
});

describe("serializeThread", () => {
	test("should serialize thread to markdown", () => {
		const thread: MessageThread = {
			id: "thread-001",
			participants: ["agent-a", "agent-b"],
			title: "Discussion Thread",
			createdDate: "2025-12-15T10:00:00Z",
			lastMessageDate: "2025-12-15T12:00:00Z",
			messageCount: 5,
		};

		const markdown = serializeThread(thread);
		expect(markdown).toContain("id: thread-001");
		expect(markdown).toContain("participants:");
		expect(markdown).toContain("messageCount: 5");
	});

	test("should round-trip thread", () => {
		const original: MessageThread = {
			id: "thread-002",
			participants: ["x", "y", "z"],
			createdDate: "2025-12-15T10:00:00Z",
			messageCount: 10,
			unreadCount: 3,
		};

		const markdown = serializeThread(original);
		const parsed = parseThread(markdown);

		expect(parsed.id).toBe(original.id);
		expect(parsed.participants).toEqual(original.participants);
		expect(parsed.messageCount).toBe(original.messageCount);
		expect(parsed.unreadCount).toBe(original.unreadCount);
	});
});
