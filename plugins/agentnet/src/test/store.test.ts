/**
 * AgentNet Store Tests
 * Tests for the SocialStore class
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SocialStore } from "../core/store.ts";
import type { AgentProfile, Post, Message, MessageThread } from "../types/index.ts";

const TEST_ROOT = "/tmp/agentnet-test-store";

describe("SocialStore", () => {
	let store: SocialStore;

	beforeAll(() => {
		// Clean up any previous test data
		if (existsSync(TEST_ROOT)) {
			rmSync(TEST_ROOT, { recursive: true });
		}
		mkdirSync(TEST_ROOT, { recursive: true });
		store = new SocialStore(TEST_ROOT);
	});

	afterAll(() => {
		// Clean up test data
		if (existsSync(TEST_ROOT)) {
			rmSync(TEST_ROOT, { recursive: true });
		}
	});

	describe("Profile Operations", () => {
		test("should save and retrieve a profile", async () => {
			const profile: AgentProfile = {
				id: "test-agent",
				name: "Test Agent",
				role: "Testing role",
				description: "A test agent for testing",
				model: "sonnet",
				source: "project",
				createdDate: new Date().toISOString(),
			};

			await store.saveProfile(profile);
			const retrieved = await store.getProfile("test-agent");

			expect(retrieved).not.toBeNull();
			expect(retrieved?.id).toBe("test-agent");
			expect(retrieved?.name).toBe("Test Agent");
			expect(retrieved?.role).toBe("Testing role");
			expect(retrieved?.model).toBe("sonnet");
		});

		test("should return null for non-existent profile", async () => {
			const profile = await store.getProfile("non-existent");
			expect(profile).toBeNull();
		});

		test("should list all profiles", async () => {
			// Save another profile
			await store.saveProfile({
				id: "test-agent-2",
				name: "Test Agent 2",
				role: "Another testing role",
				source: "plugin",
				createdDate: new Date().toISOString(),
			});

			const profiles = await store.listProfiles();
			expect(profiles.length).toBeGreaterThanOrEqual(2);
			expect(profiles.some((p) => p.id === "test-agent")).toBe(true);
			expect(profiles.some((p) => p.id === "test-agent-2")).toBe(true);
		});
	});

	describe("Post Operations", () => {
		test("should create a post", async () => {
			const post = await store.createPost({
				authorId: "test-agent",
				content: "Hello, world!",
				title: "First Post",
				tags: ["test", "hello"],
			});

			expect(post).toBeDefined();
			expect(post.id).toBeTruthy();
			expect(post.authorId).toBe("test-agent");
			expect(post.content).toBe("Hello, world!");
			expect(post.title).toBe("First Post");
			expect(post.tags).toContain("test");
			expect(post.type).toBe("original");
		});

		test("should get a post by ID", async () => {
			const created = await store.createPost({
				authorId: "test-agent",
				content: "Test content for retrieval",
			});

			const retrieved = await store.getPost("test-agent", created.id);
			expect(retrieved).not.toBeNull();
			expect(retrieved?.content).toBe("Test content for retrieval");
		});

		test("should get agent wall", async () => {
			const posts = await store.getWall("test-agent");
			expect(Array.isArray(posts)).toBe(true);
			expect(posts.length).toBeGreaterThanOrEqual(1);
		});

		test("should create a repost", async () => {
			const original = await store.createPost({
				authorId: "test-agent",
				content: "Original content to repost",
			});

			const repost = await store.createPost({
				authorId: "test-agent-2",
				content: original.content,
				type: "repost",
				originalPostId: original.id,
				originalAuthorId: "test-agent",
				repostComment: "Great post!",
			});

			expect(repost.type).toBe("repost");
			expect(repost.originalPostId).toBe(original.id);
			expect(repost.originalAuthorId).toBe("test-agent");
			expect(repost.repostComment).toBe("Great post!");
		});

		test("should get global feed", async () => {
			const feed = await store.getGlobalFeed({ limit: 10 });
			expect(Array.isArray(feed)).toBe(true);
			expect(feed.length).toBeGreaterThanOrEqual(1);
		});

		test("should filter global feed by agents", async () => {
			const feed = await store.getGlobalFeed({
				agents: ["test-agent"],
				limit: 10,
			});
			expect(Array.isArray(feed)).toBe(true);
			for (const post of feed) {
				expect(post.authorId).toBe("test-agent");
			}
		});
	});

	describe("Message Operations", () => {
		test("should create a message and thread", async () => {
			const message = await store.createMessage({
				authorId: "test-agent",
				recipientId: "test-agent-2",
				content: "Hello, agent 2!",
				title: "Greetings",
			});

			expect(message).toBeDefined();
			expect(message.id).toBeTruthy();
			expect(message.threadId).toBeTruthy();
			expect(message.authorId).toBe("test-agent");
			expect(message.recipientId).toBe("test-agent-2");
			expect(message.content).toBe("Hello, agent 2!");
		});

		test("should get thread by ID", async () => {
			const threads = await store.listThreads("test-agent");
			expect(threads.length).toBeGreaterThanOrEqual(1);

			const thread = await store.getThread(threads[0].id);
			expect(thread).not.toBeNull();
			expect(thread?.participants).toContain("test-agent");
		});

		test("should get thread messages", async () => {
			const threads = await store.listThreads("test-agent");
			const messages = await store.getThreadMessages(threads[0].id);

			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBeGreaterThanOrEqual(1);
		});

		test("should list threads for an agent", async () => {
			const threads = await store.listThreads("test-agent");
			expect(Array.isArray(threads)).toBe(true);
			for (const thread of threads) {
				expect(thread.participants).toContain("test-agent");
			}
		});

		test("should find or create thread between agents", async () => {
			const thread1 = await store.findOrCreateThread("test-agent", "test-agent-2");
			const thread2 = await store.findOrCreateThread("test-agent-2", "test-agent");

			// Should return the same thread regardless of order
			expect(thread1.id).toBe(thread2.id);
		});

		test("should increment message count on new message", async () => {
			const threads = await store.listThreads("test-agent");
			const initialCount = threads[0].messageCount;

			await store.createMessage({
				authorId: "test-agent-2",
				recipientId: "test-agent",
				content: "Reply message",
				threadId: threads[0].id,
			});

			const updatedThread = await store.getThread(threads[0].id);
			expect(updatedThread?.messageCount).toBe(initialCount + 1);
		});
	});

	describe("Stats Updates", () => {
		test("should update post count on profile", async () => {
			const profileBefore = await store.getProfile("test-agent");
			const initialPostCount = profileBefore?.stats?.postCount || 0;

			await store.createPost({
				authorId: "test-agent",
				content: "Post for stats test",
			});

			const profileAfter = await store.getProfile("test-agent");
			expect(profileAfter?.stats?.postCount).toBe(initialPostCount + 1);
		});

		test("should update repost count on profile", async () => {
			const profileBefore = await store.getProfile("test-agent-2");
			const initialRepostCount = profileBefore?.stats?.repostCount || 0;

			await store.createPost({
				authorId: "test-agent-2",
				content: "Reposted content",
				type: "repost",
				originalPostId: "some-post",
				originalAuthorId: "test-agent",
			});

			const profileAfter = await store.getProfile("test-agent-2");
			expect(profileAfter?.stats?.repostCount).toBe(initialRepostCount + 1);
		});

		test("should update message sent/received counts", async () => {
			const senderBefore = await store.getProfile("test-agent");
			const receiverBefore = await store.getProfile("test-agent-2");

			const initialSent = senderBefore?.stats?.messagesSent || 0;
			const initialReceived = receiverBefore?.stats?.messagesReceived || 0;

			await store.createMessage({
				authorId: "test-agent",
				recipientId: "test-agent-2",
				content: "Message for stats test",
			});

			const senderAfter = await store.getProfile("test-agent");
			const receiverAfter = await store.getProfile("test-agent-2");

			expect(senderAfter?.stats?.messagesSent).toBe(initialSent + 1);
			expect(receiverAfter?.stats?.messagesReceived).toBe(initialReceived + 1);
		});
	});
});
