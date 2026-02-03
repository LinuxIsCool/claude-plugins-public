/**
 * AgentNet Message View
 * TUI component for viewing and sending messages (DMs)
 */

import { box, list } from "neo-neo-bblessed";
import type { AgentProfile, Message, MessageThread } from "../types/index.ts";
import {
	createScreen,
	formatRelativeTime,
	getAgentAvatar,
	truncate,
} from "./screen.ts";
import { createLogger } from "./telemetry.ts";

const log = createLogger("message-view");

/**
 * Format thread for list display
 */
function formatThreadItem(
	thread: MessageThread,
	currentAgentId: string,
	profiles: Map<string, AgentProfile>
): string {
	const otherParticipants = thread.participants.filter(
		(p) => p !== currentAgentId
	);
	const otherNames = otherParticipants
		.map((p) => {
			const profile = profiles.get(p);
			return profile ? `${getAgentAvatar(profile)} ${profile.name}` : p;
		})
		.join(", ");

	const time = thread.lastMessageDate
		? formatRelativeTime(thread.lastMessageDate)
		: formatRelativeTime(thread.createdDate);

	const unread =
		thread.unreadCount && thread.unreadCount > 0
			? `{red-fg}(${thread.unreadCount} new){/}`
			: "";

	const title = thread.title ? `{gray-fg}${truncate(thread.title, 30)}{/}` : "";

	return `${otherNames} ${unread} {gray-fg}${time}{/} ${title}`;
}

/**
 * Format message for display
 */
function formatMessage(
	message: Message,
	profiles: Map<string, AgentProfile>,
	isOwn: boolean
): string {
	const profile = profiles.get(message.authorId);
	const avatar = profile ? getAgentAvatar(profile) : "🤖";
	const name = profile?.name || message.authorId;
	const time = formatRelativeTime(message.createdDate);
	const readStatus = message.readAt
		? "{green-fg}✓{/}"
		: "{gray-fg}○{/}";

	const align = isOwn ? "{right}" : "";
	const color = isOwn ? "{cyan-fg}" : "{white-fg}";

	return `${align}${avatar} {bold}${name}{/} {gray-fg}${time}{/} ${isOwn ? readStatus : ""}
${color}${message.content}{/}
`;
}

export interface ThreadListOptions {
	currentAgentId: string;
	onSelectThread?: (thread: MessageThread) => Promise<void>;
	onNewThread?: () => Promise<void>;
	onBack?: () => Promise<void>;
}

/**
 * Render thread list TUI
 */
export async function renderThreadList(
	threads: MessageThread[],
	profiles: Map<string, AgentProfile>,
	options: ThreadListOptions
): Promise<void> {
	if (!process.stdout.isTTY) {
		// Plain text fallback
		console.log("=== Message Threads ===\n");
		for (const thread of threads) {
			const others = thread.participants
				.filter((p) => p !== options.currentAgentId)
				.join(", ");
			console.log(`📬 ${others}`);
			console.log(`   ${thread.messageCount} messages`);
			if (thread.lastMessageDate) {
				console.log(`   Last: ${thread.lastMessageDate}`);
			}
			console.log("");
		}
		return;
	}

	if (threads.length === 0) {
		console.log("No message threads yet.");
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "AgentNet - Messages" });
		let resolved = false;

		const safeResolve = () => {
			if (resolved) {
				log.warn("thread-list-double-resolve-prevented");
				return;
			}
			resolved = true;
			log.info("thread-list-resolve");
			screen.destroy();
			resolve();
		};

		const headerBox = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "100%",
			height: 3,
			content: "\n {bold}AgentNet{/} - Message Threads",
			tags: true,
		});

		const listBox = box({
			parent: screen,
			top: 3,
			left: 0,
			width: "100%",
			height: "100%-5",
			border: { type: "line" },
			label: ` Threads (${threads.length}) `,
			style: {
				border: { fg: "cyan" },
			},
		});

		const threadList = list({
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

		threadList.setItems(
			threads.map((t) =>
				formatThreadItem(t, options.currentAgentId, profiles)
			)
		);

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 2,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[↑↓/j/k]{/} Navigate | {cyan-fg}[Enter]{/} Open Thread | {cyan-fg}[N]{/} New Thread | {cyan-fg}[B]{/} Back | {cyan-fg}[q/Esc]{/} Quit",
		});

		screen.key(["enter"], log.wrapKeyHandler("thread-list-enter", async () => {
			if (resolved) return;
			const thread = threads[threadList.selected];
			if (thread && options.onSelectThread) {
				safeResolve();
				await options.onSelectThread(thread);
			}
		}));

		screen.key(["n", "N"], log.wrapKeyHandler("thread-list-n", async () => {
			if (resolved) return;
			if (options.onNewThread) {
				await options.onNewThread();
				screen.render();
			}
		}));

		// B and ESC both go back (call onBack if provided)
		screen.key(["b", "B", "escape"], log.wrapKeyHandler("thread-list-back", async () => {
			if (resolved) return;
			safeResolve();
			if (options.onBack) {
				await options.onBack();
			}
		}));

		// q and C-c quit entirely (don't call onBack)
		screen.key(["q", "C-c"], log.wrapKeyHandler("thread-list-quit", () => {
			if (resolved) return;
			safeResolve();
		}));

		threadList.focus();
		threadList.select(0);
		screen.render();
		log.info("thread-list-rendered", { threadCount: threads.length });
	});
}

export interface ThreadViewOptions {
	currentAgentId: string;
	onSendMessage?: (content: string) => Promise<void>;
	onBack?: () => Promise<void>;
}

/**
 * Render thread view TUI
 */
export async function renderThreadView(
	thread: MessageThread,
	messages: Message[],
	profiles: Map<string, AgentProfile>,
	options: ThreadViewOptions
): Promise<void> {
	if (!process.stdout.isTTY) {
		// Plain text fallback
		const others = thread.participants
			.filter((p) => p !== options.currentAgentId)
			.join(", ");
		console.log(`=== Thread with ${others} ===\n`);
		for (const msg of messages) {
			const profile = profiles.get(msg.authorId);
			const name = profile?.name || msg.authorId;
			console.log(`${name} [${msg.createdDate}]:`);
			console.log(`  ${msg.content}`);
			console.log("");
		}
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "AgentNet - Thread" });
		let resolved = false;

		const safeResolve = () => {
			if (resolved) {
				log.warn("thread-view-double-resolve-prevented");
				return;
			}
			resolved = true;
			log.info("thread-view-resolve");
			screen.destroy();
			resolve();
		};

		const otherParticipants = thread.participants.filter(
			(p) => p !== options.currentAgentId
		);
		const otherNames = otherParticipants
			.map((p) => {
				const profile = profiles.get(p);
				return profile
					? `${getAgentAvatar(profile)} ${profile.name}`
					: p;
			})
			.join(", ");

		const headerBox = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "100%",
			height: 3,
			content: `\n {bold}Thread with{/} ${otherNames}`,
			tags: true,
		});

		const messageBox = box({
			parent: screen,
			top: 3,
			left: 0,
			width: "100%",
			height: "100%-7",
			border: { type: "line" },
			label: ` Messages (${messages.length}) `,
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			style: {
				border: { fg: "cyan" },
			},
		});

		const messageContent = messages
			.map((m) =>
				formatMessage(m, profiles, m.authorId === options.currentAgentId)
			)
			.join("\n");

		messageBox.setContent(messageContent);
		messageBox.setScrollPerc(100); // Scroll to bottom

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 4,
			width: "100%",
			tags: true,
			content:
				"\n {cyan-fg}[↑↓/j/k]{/} Scroll | {cyan-fg}[B]{/} Back | {cyan-fg}[q/Esc]{/} Quit\n {gray-fg}(Message composition coming soon){/}",
		});

		screen.key(["up", "k"], log.wrapKeyHandler("thread-view-up/k", () => {
			if (resolved) return;
			messageBox.scroll(-1);
			screen.render();
		}));

		screen.key(["down", "j"], log.wrapKeyHandler("thread-view-down/j", () => {
			if (resolved) return;
			messageBox.scroll(1);
			screen.render();
		}));

		screen.key(["pageup"], log.wrapKeyHandler("thread-view-pageup", () => {
			if (resolved) return;
			messageBox.scroll(-10);
			screen.render();
		}));

		screen.key(["pagedown"], log.wrapKeyHandler("thread-view-pagedown", () => {
			if (resolved) return;
			messageBox.scroll(10);
			screen.render();
		}));

		// B and ESC both go back (call onBack if provided)
		screen.key(["b", "B", "escape"], log.wrapKeyHandler("thread-view-back", async () => {
			if (resolved) return;
			safeResolve();
			if (options.onBack) {
				await options.onBack();
			}
		}));

		// q and C-c quit entirely (don't call onBack)
		screen.key(["q", "C-c"], log.wrapKeyHandler("thread-view-quit", () => {
			if (resolved) return;
			safeResolve();
		}));

		messageBox.focus();
		screen.render();
		log.info("thread-view-rendered", { messageCount: messages.length, threadId: thread.id });
	});
}
