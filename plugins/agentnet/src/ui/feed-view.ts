/**
 * AgentNet Feed View
 * TUI component for viewing the global feed
 */

import { box, list } from "neo-neo-bblessed";
import type { AgentProfile, Post } from "../types/index.ts";
import {
	createScreen,
	formatRelativeTime,
	getAgentAvatar,
	getPostTypeIcon,
	getStalenessIndicator,
	truncate,
} from "./screen.ts";
import { renderPostDetail } from "./wall-view.ts";
import { createLogger } from "./telemetry.ts";

const log = createLogger("feed-view");

/**
 * Format post for feed list display
 */
function formatFeedItem(
	post: Post,
	profiles: Map<string, AgentProfile>,
	maxWidth = 80
): string {
	const profile = profiles.get(post.authorId);
	const avatar = profile ? getAgentAvatar(profile) : "🤖";
	const name = profile?.name || post.authorId;
	const icon = getPostTypeIcon(post.type);
	const time = formatRelativeTime(post.createdDate);
	const staleness = getStalenessIndicator(post);
	const title = post.title ? `{bold}${truncate(post.title, 35)}{/}` : "";
	const preview = truncate(
		post.content.replace(/\n/g, " ").trim(),
		maxWidth - 40
	);

	const meta: string[] = [];
	if (post.repostCount && post.repostCount > 0) {
		meta.push(`{green-fg}🔄${post.repostCount}{/}`);
	}
	if (post.replyCount && post.replyCount > 0) {
		meta.push(`{blue-fg}💬${post.replyCount}{/}`);
	}
	if (post.tags?.length) {
		meta.push(`{yellow-fg}#${post.tags[0]}{/}`);
	}

	const metaStr = meta.length > 0 ? ` ${meta.join(" ")}` : "";
	const titlePart = title ? `${title} - ` : "";

	return `${avatar} {cyan-fg}${truncate(name, 15)}{/} ${icon} {gray-fg}${time}{/} ${staleness}${titlePart}${preview}${metaStr}`;
}

export interface FeedViewOptions {
	onViewPost?: (post: Post, author?: AgentProfile) => Promise<void>;
	onBack?: () => Promise<void>;
}

/**
 * Render global feed TUI
 */
export async function renderFeedView(
	posts: Post[],
	profiles: Map<string, AgentProfile>,
	options?: FeedViewOptions
): Promise<void> {
	if (!process.stdout.isTTY) {
		// Plain text fallback
		console.log("=== Global Feed ===\n");
		for (const post of posts) {
			const profile = profiles.get(post.authorId);
			const avatar = profile ? getAgentAvatar(profile) : "🤖";
			const name = profile?.name || post.authorId;
			console.log(`${avatar} ${name} [${post.createdDate}]`);
			if (post.title) console.log(`   ${post.title}`);
			console.log(`   ${post.content.slice(0, 200)}`);
			console.log("");
		}
		return;
	}

	if (posts.length === 0) {
		console.log("No posts in feed yet.");
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "AgentNet - Global Feed" });
		let resolved = false;

		const safeResolve = () => {
			if (resolved) {
				log.warn("double-resolve-prevented");
				return;
			}
			resolved = true;
			log.info("resolve");
			screen.destroy();
			resolve();
		};

		const headerBox = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "100%",
			height: 3,
			content: "\n {bold}AgentNet{/} - Global Feed",
			tags: true,
		});

		const listBox = box({
			parent: screen,
			top: 3,
			left: 0,
			width: "100%",
			height: "100%-5",
			border: { type: "line" },
			label: ` Feed (${posts.length} posts) `,
			style: {
				border: { fg: "cyan" },
			},
		});

		const postList = list({
			parent: listBox,
			top: 0,
			left: 1,
			width: "100%-4",
			height: "100%-2",
			keys: true,     // Enable built-in key handling
			vi: true,       // Enable j/k navigation
			keyable: true,  // Register with screen for keypress events
			mouse: true,
			scrollable: true,
			tags: true,
			style: {
				selected: { bg: "blue", fg: "white" },
			},
		});

		postList.setItems(posts.map((p) => formatFeedItem(p, profiles)));

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 2,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[↑↓/j/k]{/} Navigate | {cyan-fg}[Enter]{/} View Post | {cyan-fg}[B]{/} Back | {cyan-fg}[q/Esc]{/} Quit",
		});

		screen.key(["enter"], log.wrapKeyHandler("enter", async () => {
			if (resolved) return;
			const post = posts[postList.selected];
			if (post) {
				const author = profiles.get(post.authorId);
				if (options?.onViewPost) {
					await options.onViewPost(post, author);
					screen.render();
				} else {
					await renderPostDetail(post, author, screen);
					postList.focus();
					screen.render();
				}
			}
		}));

		// B and ESC both go back (call onBack if provided)
		screen.key(["b", "B", "escape"], log.wrapKeyHandler("back", async () => {
			if (resolved) return;
			safeResolve();
			if (options?.onBack) {
				await options.onBack();
			}
		}));

		// q and C-c quit entirely (don't call onBack)
		screen.key(["q", "C-c"], log.wrapKeyHandler("quit", () => {
			if (resolved) return;
			safeResolve();
		}));

		postList.focus();
		postList.select(0);
		screen.render();
		log.info("rendered", { postCount: posts.length });
	});
}
