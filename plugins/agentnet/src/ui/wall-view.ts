/**
 * AgentNet Wall View
 * TUI component for viewing an agent's wall (posts)
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
import { createLogger } from "./telemetry.ts";

const log = createLogger("wall-view");

/**
 * Format post for list display
 */
function formatPostItem(post: Post, maxWidth = 80): string {
	const icon = getPostTypeIcon(post.type);
	const time = formatRelativeTime(post.createdDate);
	const staleness = getStalenessIndicator(post);
	const title = post.title ? `{bold}${truncate(post.title, 40)}{/}` : "";
	const preview = truncate(
		post.content.replace(/\n/g, " ").trim(),
		maxWidth - 30
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

	return `${icon} {gray-fg}${time}{/} ${staleness}${titlePart}${preview}${metaStr}`;
}

/**
 * Result from wall view indicating what action the user took
 */
export type WallViewResult =
	| { action: "back" }
	| { action: "quit" }
	| { action: "viewPost"; post: Post };

/**
 * Render wall view TUI
 *
 * Returns a result indicating what the user wants to do next.
 * The caller is responsible for handling navigation - this function
 * NEVER calls async callbacks after destroying the screen.
 */
export async function renderWallView(
	profile: AgentProfile,
	posts: Post[]
): Promise<WallViewResult> {
	if (!process.stdout.isTTY) {
		// Plain text fallback
		const avatar = getAgentAvatar(profile);
		console.log(`=== ${avatar} ${profile.name}'s Wall ===\n`);
		for (const post of posts) {
			const icon = getPostTypeIcon(post.type);
			console.log(`${icon} [${post.createdDate}]`);
			if (post.title) console.log(`   ${post.title}`);
			console.log(`   ${post.content.slice(0, 200)}`);
			console.log("");
		}
		return { action: "quit" };
	}

	if (posts.length === 0) {
		console.log(`${profile.name} has no posts yet.`);
		return { action: "back" };
	}

	// Return result indicating user's action
	// CRITICAL: We NEVER call async callbacks after screen.destroy()
	// The caller handles navigation based on the returned result
	return await new Promise<WallViewResult>((resolve) => {
		const screen = createScreen({
			title: `AgentNet - ${profile.name}'s Wall`,
		});

		const avatar = getAgentAvatar(profile);
		const headerBox = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "100%",
			height: 3,
			content: `\n ${avatar} {bold}${profile.name}{/} - ${profile.role}`,
			tags: true,
		});

		const listBox = box({
			parent: screen,
			top: 3,
			left: 0,
			width: "100%",
			height: "100%-5",
			border: { type: "line" },
			label: ` Wall (${posts.length} posts) `,
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

		postList.setItems(posts.map((p) => formatPostItem(p)));

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 2,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[↑↓/j/k]{/} Navigate | {cyan-fg}[Enter]{/} View Post | {cyan-fg}[B/Esc]{/} Back | {cyan-fg}[q]{/} Quit",
		});

		let resolved = false; // Prevent double-resolve

		const safeResolve = (result: WallViewResult) => {
			if (resolved) {
				log.warn("double-resolve-prevented", { attemptedAction: result.action });
				return;
			}
			resolved = true;
			log.info("resolve", { action: result.action });
			screen.destroy();
			resolve(result);
		};

		// Enter: View post detail - return the post, let caller handle display
		screen.key(["enter"], log.wrapKeyHandler("enter", () => {
			if (resolved) return;
			const post = posts[postList.selected];
			if (post) {
				safeResolve({ action: "viewPost", post });
			}
		}));

		// B and ESC: Go back to previous view
		screen.key(["b", "B", "escape"], log.wrapKeyHandler("back", () => {
			if (resolved) return;
			safeResolve({ action: "back" });
		}));

		// q and C-c: Quit entirely
		screen.key(["q", "C-c"], log.wrapKeyHandler("quit", () => {
			if (resolved) return;
			safeResolve({ action: "quit" });
		}));

		postList.focus();
		postList.select(0);  // Start with first item selected
		screen.render();
		log.info("rendered", { postCount: posts.length, profile: profile.name });
	});
}

/**
 * Render post detail popup
 */
export async function renderPostDetail(
	post: Post,
	author?: AgentProfile,
	parentScreen?: ReturnType<typeof createScreen>
): Promise<void> {
	const screen = parentScreen || createScreen({ title: "Post Detail" });

	await new Promise<void>((resolve) => {
		const popup = box({
			parent: screen,
			top: "center",
			left: "center",
			width: "80%",
			height: "80%",
			border: { type: "line" },
			label: ` ${getPostTypeIcon(post.type)} Post `,
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			style: {
				border: { fg: "cyan" },
			},
		});

		const avatar = author ? getAgentAvatar(author) : "🤖";
		const authorName = author?.name || post.authorId;
		const staleness = getStalenessIndicator(post);

		let repostInfo = "";
		if (post.type === "repost" && post.originalAuthorId) {
			repostInfo = `\n {gray-fg}🔄 Reposted from {bold}${post.originalAuthorId}{/}{/}`;
			if (post.repostComment) {
				repostInfo += `\n {italic}"${post.repostComment}"{/}`;
			}
		}

		let replyInfo = "";
		if (post.type === "reply" && post.replyToAuthorId) {
			replyInfo = `\n {gray-fg}💬 Replying to {bold}${post.replyToAuthorId}{/}{/}`;
		}

		const tags = post.tags?.length
			? `\n {yellow-fg}Tags: ${post.tags.map((t) => `#${t}`).join(" ")}{/}`
			: "";

		const mentions = post.mentions?.length
			? `\n {cyan-fg}Mentions: ${post.mentions.map((m) => `@${m}`).join(" ")}{/}`
			: "";

		const source = post.sourceEvent
			? `\n {gray-fg}Source: ${post.sourceEvent}${post.sourceRef ? ` (${post.sourceRef})` : ""}{/}`
			: "";

		const validity = post.validUntil
			? `\n {gray-fg}Valid until: ${post.validUntil}{/}`
			: "";

		const content = `
 ${avatar} {bold}${authorName}{/} ${staleness}
 {gray-fg}${formatRelativeTime(post.createdDate)}{/}
${repostInfo}${replyInfo}

 ${post.title ? `{bold}${post.title}{/}\n\n ` : ""}${post.content}
${tags}${mentions}${source}${validity}

 {gray-fg}─────────────────────────────────{/}
 🔄 ${post.repostCount || 0} reposts  💬 ${post.replyCount || 0} replies
`;

		popup.setContent(content);

		const closePopup = () => {
			resolve(); // Resolve FIRST to prevent race condition
			popup.destroy();
			if (!parentScreen) {
				screen.destroy();
			}
		};

		popup.key(["escape", "q", "enter"], closePopup);
		popup.focus();
		screen.render();
	});
}
