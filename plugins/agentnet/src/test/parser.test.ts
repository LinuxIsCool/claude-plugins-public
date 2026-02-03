/**
 * AgentNet Parser Tests
 * Tests for parsing markdown with YAML frontmatter
 */

import { describe, test, expect } from "bun:test";
import {
	parseMarkdown,
	parseProfile,
	parsePost,
	parseMessage,
	parseThread,
} from "../core/parser.ts";

describe("parseMarkdown", () => {
	test("should parse frontmatter and content", () => {
		const input = `---
title: Test
value: 123
---
This is the body content.`;

		const result = parseMarkdown(input);
		expect(result.frontmatter.title).toBe("Test");
		expect(result.frontmatter.value).toBe(123);
		expect(result.content).toBe("This is the body content.");
	});

	test("should handle empty content", () => {
		const input = `---
id: test
---`;

		const result = parseMarkdown(input);
		expect(result.frontmatter.id).toBe("test");
		expect(result.content).toBe("");
	});

	test("should handle multi-line content", () => {
		const input = `---
title: Test
---
Line 1
Line 2
Line 3`;

		const result = parseMarkdown(input);
		expect(result.content).toContain("Line 1");
		expect(result.content).toContain("Line 2");
		expect(result.content).toContain("Line 3");
	});
});

describe("parseProfile", () => {
	test("should parse agent profile", () => {
		const input = `---
id: test-agent
name: Test Agent
role: Testing role
model: sonnet
source: project
sourcePath: /path/to/agent.md
createdDate: 2025-12-15T10:00:00Z
stats:
  postCount: 5
  repostCount: 2
  messagesSent: 10
  messagesReceived: 8
---
This is the agent description.
It spans multiple lines.`;

		const profile = parseProfile(input);
		expect(profile.id).toBe("test-agent");
		expect(profile.name).toBe("Test Agent");
		expect(profile.role).toBe("Testing role");
		expect(profile.model).toBe("sonnet");
		expect(profile.source).toBe("project");
		expect(profile.description).toContain("agent description");
		expect(profile.stats?.postCount).toBe(5);
	});

	test("should handle missing optional fields", () => {
		const input = `---
id: minimal-agent
name: Minimal
role: Minimal role
---`;

		const profile = parseProfile(input);
		expect(profile.id).toBe("minimal-agent");
		expect(profile.name).toBe("Minimal");
		expect(profile.model).toBeUndefined();
		expect(profile.avatar).toBeUndefined();
	});

	test("should normalize date formats", () => {
		const input = `---
id: date-test
name: Date Test
role: Test
createdDate: 2025-12-15
---`;

		const profile = parseProfile(input);
		// gray-matter converts dates to full ISO format
		expect(profile.createdDate).toContain("2025-12-15");
	});
});

describe("parsePost", () => {
	test("should parse original post", () => {
		const input = `---
id: 2025-12-15-001
type: original
authorId: test-agent
title: Test Post
visibility: public
createdDate: 2025-12-15T10:00:00Z
tags: ["test", "hello"]
---
This is the post content.`;

		const post = parsePost(input);
		expect(post.id).toBe("2025-12-15-001");
		expect(post.type).toBe("original");
		expect(post.authorId).toBe("test-agent");
		expect(post.title).toBe("Test Post");
		expect(post.visibility).toBe("public");
		expect(post.content).toBe("This is the post content.");
		expect(post.tags).toContain("test");
	});

	test("should parse repost", () => {
		const input = `---
id: 2025-12-15-002
type: repost
authorId: other-agent
originalPostId: 2025-12-15-001
originalAuthorId: test-agent
repostComment: Great insight!
createdDate: 2025-12-15T11:00:00Z
---
Original content here.`;

		const post = parsePost(input);
		expect(post.type).toBe("repost");
		expect(post.originalPostId).toBe("2025-12-15-001");
		expect(post.originalAuthorId).toBe("test-agent");
		expect(post.repostComment).toBe("Great insight!");
	});

	test("should parse reply", () => {
		const input = `---
id: 2025-12-15-003
type: reply
authorId: other-agent
replyToPostId: 2025-12-15-001
replyToAuthorId: test-agent
createdDate: 2025-12-15T12:00:00Z
---
This is my reply.`;

		const post = parsePost(input);
		expect(post.type).toBe("reply");
		expect(post.replyToPostId).toBe("2025-12-15-001");
		expect(post.replyToAuthorId).toBe("test-agent");
	});

	test("should handle staleness", () => {
		const input = `---
id: stale-post
type: original
authorId: test-agent
validUntil: 2020-01-01T00:00:00Z
isStale: true
createdDate: 2019-12-01T00:00:00Z
---
Old content.`;

		const post = parsePost(input);
		expect(post.isStale).toBe(true);
		// gray-matter normalizes dates to full ISO format
		expect(post.validUntil).toContain("2020-01-01");
	});

	test("should handle snake_case fallback for authorId", () => {
		const input = `---
id: snake-case-test
type: original
author_id: test-agent
created_date: 2025-12-15T10:00:00Z
---
Content.`;

		const post = parsePost(input);
		expect(post.authorId).toBe("test-agent");
	});
});

describe("parseMessage", () => {
	test("should parse message", () => {
		const input = `---
id: "001"
threadId: thread-001
authorId: sender-agent
recipientId: receiver-agent
title: Subject Line
createdDate: 2025-12-15T10:00:00Z
---
This is the message content.`;

		const message = parseMessage(input);
		expect(message.id).toBe("001");
		expect(message.threadId).toBe("thread-001");
		expect(message.authorId).toBe("sender-agent");
		expect(message.recipientId).toBe("receiver-agent");
		expect(message.title).toBe("Subject Line");
		expect(message.content).toBe("This is the message content.");
	});

	test("should handle read status", () => {
		const input = `---
id: "002"
threadId: thread-001
authorId: sender-agent
recipientId: receiver-agent
createdDate: 2025-12-15T10:00:00Z
readAt: 2025-12-15T11:00:00Z
---
Read message.`;

		const message = parseMessage(input);
		// gray-matter normalizes dates to full ISO format
		expect(message.readAt).toContain("2025-12-15T11:00:00");
	});
});

describe("parseThread", () => {
	test("should parse thread index", () => {
		const input = `---
id: thread-001
participants: ["agent-a", "agent-b"]
title: Discussion
createdDate: 2025-12-15T10:00:00Z
lastMessageDate: 2025-12-15T12:00:00Z
messageCount: 5
unreadCount: 2
---`;

		const thread = parseThread(input);
		expect(thread.id).toBe("thread-001");
		expect(thread.participants).toContain("agent-a");
		expect(thread.participants).toContain("agent-b");
		expect(thread.title).toBe("Discussion");
		expect(thread.messageCount).toBe(5);
		expect(thread.unreadCount).toBe(2);
	});

	test("should handle missing optional fields", () => {
		const input = `---
id: thread-002
participants: ["agent-x", "agent-y"]
createdDate: 2025-12-15T10:00:00Z
messageCount: 0
---`;

		const thread = parseThread(input);
		expect(thread.id).toBe("thread-002");
		expect(thread.title).toBeUndefined();
		expect(thread.lastMessageDate).toBeUndefined();
		expect(thread.unreadCount).toBeUndefined();
	});
});
