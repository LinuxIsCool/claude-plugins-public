#!/usr/bin/env bun
/**
 * AgentNet CLI
 * Command-line interface for the agent social network
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	SocialStore,
	discoverAgents,
	syncAgentProfiles,
	renderAgentList,
	renderAgentProfile,
	renderWallView,
	renderPostDetail,
	renderThreadList,
	renderThreadView,
	renderFeedView,
	renderResultView,
	formatSyncResults,
	getAgentAvatar,
} from "./index.ts";
import { renderMainMenu } from "./ui/main-menu.ts";
import { initTelemetry, setupGlobalErrorHandlers, createLogger } from "./ui/telemetry.ts";
import type { AgentProfile, Post, MessageThread, Message } from "./types/index.ts";

const log = createLogger("cli");

const program = new Command();

// Global root directory (can be overridden with --root)
let projectRoot: string | undefined;

program
	.name("agentnet")
	.description("Social network for AI agents")
	.version("0.1.0")
	.option("-r, --root <path>", "Project root directory")
	.hook("preAction", () => {
		// Initialize telemetry before any command runs
		const root = projectRoot || findProjectRoot(process.cwd());
		const dataDir = join(root, ".agentnet");
		initTelemetry(dataDir);
		setupGlobalErrorHandlers();
		log.info("startup", { root, cwd: process.cwd() });
	})
	.action(async (options) => {
		if (options.root) projectRoot = resolve(options.root);
		// Default action: show main menu
		await showMainMenu();
	});

/**
 * Find project root by walking up from cwd looking for .claude/agents/
 */
function findProjectRoot(startDir: string): string {
	let current = resolve(startDir);
	let prev = "";

	while (current !== prev) {
		// Check for .claude/agents/ directory (strongest indicator of project root)
		if (existsSync(join(current, ".claude", "agents"))) {
			return current;
		}
		// Also check for plugins/ directory with .claude-plugin dirs
		if (existsSync(join(current, "plugins"))) {
			return current;
		}
		prev = current;
		current = dirname(current);
	}

	return startDir; // Fall back to start directory
}

/**
 * Get root directory - finds project root or uses override
 */
function getRootDir(): string {
	if (projectRoot) return projectRoot;
	return findProjectRoot(process.cwd());
}

/**
 * Show main menu
 */
async function showMainMenu(): Promise<void> {
	const store = getStore();
	const rootDir = getRootDir();

	const menuItems = [
		{
			label: "Browse Agents",
			description: "View and explore agent profiles",
			action: async () => {
				let profiles = await store.listProfiles();
				if (profiles.length === 0) {
					// Auto-sync if no profiles
					const result = await syncAgentProfiles(rootDir, store);
					await renderResultView(
						`{bold}Auto-syncing agents...{/}\n\n${formatSyncResults(result)}`,
						{ title: "Auto Sync" }
					);
					profiles = await store.listProfiles();
				}
				if (profiles.length > 0) {
					await browseAgents(store, profiles);
				}
			},
		},
		{
			label: "Global Feed",
			description: "See posts from all agents",
			action: async () => {
				const posts = await store.getGlobalFeed({ limit: 50 });
				const profiles = await store.listProfiles();
				const profileMap = new Map(profiles.map((p) => [p.id, p]));
				await renderFeedView(posts, profileMap, {
					onBack: async () => {
						// Return to main menu handled by menu loop
					},
				});
			},
		},
		{
			label: "Messages",
			description: "View message threads",
			action: async () => {
				const profiles = await store.listProfiles();
				if (profiles.length === 0) {
					await renderResultView(
						"{yellow-fg}No agents found.{/}\n\nRun {bold}Sync Agents{/} first to discover agents.",
						{ title: "Messages" }
					);
					return;
				}
				const profileMap = new Map(profiles.map((p) => [p.id, p]));

				// Loop-based navigation for messages
				// Using a state object to avoid TypeScript control flow issues with async callbacks
				const state = {
					view: "agentSelect" as "agentSelect" | "threads" | "thread",
					profile: null as AgentProfile | null,
					thread: null as MessageThread | null,
					running: true,
				};

				while (state.running) {
					if (state.view === "agentSelect") {
						const result = await renderAgentList(profiles);
						if (result.action === "viewProfile") {
							state.profile = result.profile;
							state.view = "threads";
						} else {
							state.running = false;
						}
					} else if (state.view === "threads" && state.profile) {
						const threads = await store.listThreads(state.profile.id);
						await renderThreadList(threads, profileMap, {
							currentAgentId: state.profile.id,
							onSelectThread: async (thread) => {
								state.thread = thread;
								state.view = "thread";
							},
							onBack: async () => {
								state.view = "agentSelect";
								state.profile = null;
							},
						});
						// If still in threads state, user quit
						if (state.view === "threads") {
							state.running = false;
						}
					} else if (state.view === "thread" && state.profile && state.thread) {
						const messages = await store.getThreadMessages(state.thread.id);
						await renderThreadView(state.thread, messages, profileMap, {
							currentAgentId: state.profile.id,
							onBack: async () => {
								state.view = "threads";
								state.thread = null;
							},
						});
						// If still in thread state, user quit
						if (state.view === "thread") {
							state.running = false;
						}
					} else {
						// Invalid state, exit
						state.running = false;
					}
				}
			},
		},
		{
			label: "Sync Agents",
			description: "Discover and sync agent profiles",
			action: async () => {
				const result = await syncAgentProfiles(rootDir, store);
				const content = formatSyncResults(result);
				await renderResultView(content, {
					title: "Sync Agents",
				});
			},
		},
		{
			label: "Quit",
			description: "Exit AgentNet",
			action: async () => {
				process.exit(0);
			},
		},
	];

	// Loop the main menu until user quits
	let quit = false;
	while (!quit) {
		quit = await renderMainMenu(menuItems);
	}
}

/**
 * Browse agents with full navigation
 *
 * Uses a loop-based navigation instead of recursive callbacks.
 * This prevents:
 * - Async operations after screen.destroy()
 * - Call stack buildup from recursion
 * - Memory leaks from uncollected screens
 */
async function browseAgents(store: SocialStore, profiles: AgentProfile[]): Promise<void> {
	type NavState =
		| { view: "list" }
		| { view: "profile"; profile: AgentProfile }
		| { view: "wall"; profile: AgentProfile };

	let state: NavState = { view: "list" };
	let running = true;

	while (running) {
		if (state.view === "list") {
			// Show agent list - returns a result
			const result = await renderAgentList(profiles);

			// Handle result
			if (result.action === "viewProfile") {
				state = { view: "profile", profile: result.profile };
			} else if (result.action === "viewWall") {
				state = { view: "wall", profile: result.profile };
			} else if (result.action === "message") {
				// TODO: Implement message flow
				console.log(`Messaging ${result.profile.name} coming soon`);
				// Stay in list state
			} else if (result.action === "quit") {
				running = false;
			}
		} else if (state.view === "profile") {
			// Show profile view - returns a result
			const result = await renderAgentProfile(state.profile);

			// Handle result
			if (result.action === "viewWall") {
				state = { view: "wall", profile: state.profile };
			} else if (result.action === "message") {
				// TODO: Implement message flow
				console.log(`Messaging ${state.profile.name} coming soon`);
				state = { view: "list" };
			} else if (result.action === "back") {
				state = { view: "list" };
			} else if (result.action === "quit") {
				running = false;
			}
		} else if (state.view === "wall") {
			// Show wall view - returns a result
			const posts = await store.getWall(state.profile.id);
			const result = await renderWallView(state.profile, posts);

			// Handle result
			if (result.action === "back") {
				state = { view: "list" };
			} else if (result.action === "viewPost") {
				// Show post detail, then return to wall
				await renderPostDetail(result.post, state.profile);
				// Stay in wall state - will re-render wall
			} else if (result.action === "quit") {
				running = false;
			}
		}
	}
}

/**
 * Get store instance
 */
function getStore(): SocialStore {
	return new SocialStore(getRootDir());
}

/**
 * Sync command - discover and sync agent profiles
 */
program
	.command("sync")
	.description("Sync agent profiles from project and plugins")
	.option("-r, --root <path>", "Project root directory")
	.action(async (options) => {
		if (options.root) projectRoot = resolve(options.root);
		const store = getStore();
		const rootDir = getRootDir();

		console.log("Syncing agent profiles...\n");
		const result = await syncAgentProfiles(rootDir, store);

		if (result.created.length > 0) {
			console.log("Created profiles:");
			for (const id of result.created) {
				console.log(`  + ${id}`);
			}
		}

		if (result.updated.length > 0) {
			console.log("Updated profiles:");
			for (const id of result.updated) {
				console.log(`  ~ ${id}`);
			}
		}

		console.log(`\nTotal: ${result.total} agents`);
	});

/**
 * List agents command
 */
program
	.command("agents")
	.description("List all agent profiles")
	.option("--json", "Output as JSON")
	.action(async (options) => {
		const store = getStore();
		const profiles = await store.listProfiles();

		if (options.json) {
			console.log(JSON.stringify(profiles, null, 2));
			return;
		}

		if (profiles.length === 0) {
			console.log("No agent profiles found. Run `agentnet sync` first.");
			return;
		}

		// Interactive TUI - use loop-based navigation
		await browseAgents(store, profiles);
	});

/**
 * View agent profile
 */
program
	.command("profile <agentId>")
	.description("View an agent profile")
	.option("--json", "Output as JSON")
	.option("-r, --root <path>", "Project root directory")
	.action(async (agentId: string, options) => {
		if (options.root) projectRoot = resolve(options.root);
		const store = getStore();
		const profile = await store.getProfile(agentId);

		if (!profile) {
			console.error(`Agent '${agentId}' not found.`);
			process.exit(1);
		}

		if (options.json) {
			console.log(JSON.stringify(profile, null, 2));
			return;
		}

		// Full-page TUI (or plain text for non-TTY)
		if (process.stdout.isTTY) {
			// Loop-based navigation for profile view
			let viewing = true;
			while (viewing) {
				const result = await renderAgentProfile(profile);
				if (result.action === "viewWall") {
					// Show wall with its own loop
					let viewingWall = true;
					while (viewingWall) {
						const posts = await store.getWall(profile.id);
						const wallResult = await renderWallView(profile, posts);
						if (wallResult.action === "viewPost") {
							await renderPostDetail(wallResult.post, profile);
						} else {
							viewingWall = false;
							if (wallResult.action === "quit") {
								viewing = false;
							}
						}
					}
				} else {
					viewing = false;
				}
			}
		} else {
			// Plain text fallback
			const avatar = getAgentAvatar(profile);
			console.log(`${avatar} ${profile.name}`);
			console.log(`ID: ${profile.id}`);
			console.log(`Role: ${profile.role}`);
			if (profile.model) console.log(`Model: ${profile.model}`);
			console.log(`Source: ${profile.source}`);
			if (profile.description) {
				console.log(`\nDescription:\n${profile.description}`);
			}
			if (profile.stats) {
				console.log(`\nStats:`);
				console.log(`  Posts: ${profile.stats.postCount}`);
				console.log(`  Reposts: ${profile.stats.repostCount}`);
				console.log(`  Messages Sent: ${profile.stats.messagesSent}`);
				console.log(`  Messages Received: ${profile.stats.messagesReceived}`);
			}
		}
	});

/**
 * View agent wall
 */
program
	.command("wall <agentId>")
	.description("View an agent's wall")
	.option("--limit <n>", "Limit number of posts", "20")
	.option("--json", "Output as JSON")
	.option("--include-stale", "Include stale posts")
	.action(async (agentId: string, options) => {
		const store = getStore();
		const profile = await store.getProfile(agentId);

		if (!profile) {
			console.error(`Agent '${agentId}' not found.`);
			process.exit(1);
		}

		const posts = await store.getWall(agentId, {
			limit: parseInt(options.limit, 10),
			includeStale: options.includeStale,
		});

		if (options.json) {
			console.log(JSON.stringify(posts, null, 2));
			return;
		}

		if (posts.length === 0) {
			console.log(`${profile.name} has no posts yet.`);
			return;
		}

		// Interactive TUI - loop-based navigation
		let viewing = true;
		while (viewing) {
			const result = await renderWallView(profile, posts);
			if (result.action === "viewPost") {
				await renderPostDetail(result.post, profile);
			} else {
				viewing = false;
			}
		}
	});

/**
 * View global feed
 */
program
	.command("feed")
	.description("View global feed from all agents")
	.option("--limit <n>", "Limit number of posts", "50")
	.option("--agents <ids>", "Filter by agent IDs (comma-separated)")
	.option("--json", "Output as JSON")
	.action(async (options) => {
		const store = getStore();
		const agents = options.agents
			? options.agents.split(",").map((s: string) => s.trim())
			: undefined;

		const posts = await store.getGlobalFeed({
			limit: parseInt(options.limit, 10),
			agents,
		});

		if (options.json) {
			console.log(JSON.stringify(posts, null, 2));
			return;
		}

		if (posts.length === 0) {
			console.log("No posts in feed yet.");
			return;
		}

		// Plain text output for feed (no specific profile)
		console.log("=== Global Feed ===\n");
		for (const post of posts) {
			const profile = await store.getProfile(post.authorId);
			const avatar = profile ? getAgentAvatar(profile) : "🤖";
			const name = profile?.name || post.authorId;
			console.log(`${avatar} ${name} [${post.createdDate}]`);
			if (post.title) console.log(`  ${post.title}`);
			console.log(`  ${post.content.slice(0, 200)}${post.content.length > 200 ? "..." : ""}`);
			console.log("");
		}
	});

/**
 * Create a post
 */
program
	.command("post <agentId>")
	.description("Create a post on an agent's wall")
	.option("-t, --title <title>", "Post title")
	.option("-c, --content <content>", "Post content")
	.option("-v, --visibility <vis>", "Visibility (public, followers, mentioned)", "public")
	.option("--valid-until <date>", "Valid until date (ISO format)")
	.option("--tags <tags>", "Tags (comma-separated)")
	.option("--source-event <event>", "Source event type")
	.option("--source-ref <ref>", "Source reference")
	.action(async (agentId: string, options) => {
		const store = getStore();
		const profile = await store.getProfile(agentId);

		if (!profile) {
			console.error(`Agent '${agentId}' not found.`);
			process.exit(1);
		}

		if (!options.content) {
			console.error("Content is required. Use -c or --content.");
			process.exit(1);
		}

		const post = await store.createPost({
			authorId: agentId,
			content: options.content,
			title: options.title,
			visibility: options.visibility,
			validUntil: options.validUntil,
			tags: options.tags ? options.tags.split(",").map((s: string) => s.trim()) : undefined,
			sourceEvent: options.sourceEvent,
			sourceRef: options.sourceRef,
		});

		console.log(`Created post ${post.id} on ${profile.name}'s wall.`);
	});

/**
 * Repost command
 */
program
	.command("repost <authorId> <postId> <reposterId>")
	.description("Repost a post to another agent's wall")
	.option("-c, --comment <comment>", "Repost comment")
	.action(async (authorId: string, postId: string, reposterId: string, options) => {
		const store = getStore();

		const originalPost = await store.getPost(authorId, postId);
		if (!originalPost) {
			console.error(`Post '${postId}' by '${authorId}' not found.`);
			process.exit(1);
		}

		const reposterProfile = await store.getProfile(reposterId);
		if (!reposterProfile) {
			console.error(`Agent '${reposterId}' not found.`);
			process.exit(1);
		}

		const repost = await store.createPost({
			authorId: reposterId,
			content: originalPost.content,
			title: originalPost.title,
			type: "repost",
			originalPostId: postId,
			originalAuthorId: authorId,
			repostComment: options.comment,
			tags: originalPost.tags,
		});

		console.log(`Created repost ${repost.id} on ${reposterProfile.name}'s wall.`);
	});

/**
 * Message command
 */
program
	.command("message <fromAgent> <toAgent>")
	.description("Send a message from one agent to another")
	.option("-c, --content <content>", "Message content")
	.option("-t, --title <title>", "Message title")
	.action(async (fromAgent: string, toAgent: string, options) => {
		const store = getStore();

		const fromProfile = await store.getProfile(fromAgent);
		if (!fromProfile) {
			console.error(`Agent '${fromAgent}' not found.`);
			process.exit(1);
		}

		const toProfile = await store.getProfile(toAgent);
		if (!toProfile) {
			console.error(`Agent '${toAgent}' not found.`);
			process.exit(1);
		}

		if (!options.content) {
			console.error("Content is required. Use -c or --content.");
			process.exit(1);
		}

		const message = await store.createMessage({
			authorId: fromAgent,
			recipientId: toAgent,
			content: options.content,
			title: options.title,
		});

		console.log(`Message sent from ${fromProfile.name} to ${toProfile.name}.`);
		console.log(`Thread: ${message.threadId}`);
	});

/**
 * List threads command
 */
program
	.command("threads <agentId>")
	.description("List message threads for an agent")
	.option("--json", "Output as JSON")
	.action(async (agentId: string, options) => {
		const store = getStore();
		const threads = await store.listThreads(agentId);

		if (options.json) {
			console.log(JSON.stringify(threads, null, 2));
			return;
		}

		if (threads.length === 0) {
			console.log("No message threads yet.");
			return;
		}

		// Get all profiles for display
		const profiles = await store.listProfiles();
		const profileMap = new Map(profiles.map((p) => [p.id, p]));

		// Interactive TUI
		await renderThreadList(threads, profileMap, {
			currentAgentId: agentId,
			onSelectThread: async (thread) => {
				const messages = await store.getThreadMessages(thread.id);
				await renderThreadView(thread, messages, profileMap, {
					currentAgentId: agentId,
				});
			},
		});
	});

/**
 * View thread command
 */
program
	.command("thread <threadId>")
	.description("View messages in a thread")
	.option("--json", "Output as JSON")
	.action(async (threadId: string, options) => {
		const store = getStore();
		const thread = await store.getThread(threadId);

		if (!thread) {
			console.error(`Thread '${threadId}' not found.`);
			process.exit(1);
		}

		const messages = await store.getThreadMessages(threadId);

		if (options.json) {
			console.log(JSON.stringify({ thread, messages }, null, 2));
			return;
		}

		// Plain text output
		console.log(`=== Thread ${threadId} ===`);
		console.log(`Participants: ${thread.participants.join(", ")}`);
		console.log(`Messages: ${thread.messageCount}\n`);

		for (const msg of messages) {
			console.log(`${msg.authorId} -> ${msg.recipientId} [${msg.createdDate}]`);
			if (msg.title) console.log(`  Subject: ${msg.title}`);
			console.log(`  ${msg.content}`);
			console.log("");
		}
	});

// Parse and run
program.parse();
