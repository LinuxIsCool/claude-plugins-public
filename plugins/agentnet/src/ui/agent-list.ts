/**
 * AgentNet Agent List View
 * TUI component for browsing agent profiles
 */

import { box, list } from "neo-neo-bblessed";
import type { AgentProfile } from "../types/index.ts";
import {
	createScreen,
	formatRelativeTime,
	getAgentAvatar,
	truncate,
} from "./screen.ts";
import { createLogger } from "./telemetry.ts";

const log = createLogger("agent-list");

/**
 * Format agent list item for display
 */
function formatAgentItem(profile: AgentProfile, selected = false): string {
	const avatar = getAgentAvatar(profile);
	const name = truncate(profile.name || profile.id, 20);
	const role = truncate(profile.role || "Agent", 30);
	const model = profile.model
		? `{magenta-fg}[${profile.model}]{/}`
		: "";
	const source = profile.source === "plugin"
		? "{cyan-fg}(plugin){/}"
		: "{green-fg}(project){/}";
	const lastActive = profile.stats?.lastActive
		? `{gray-fg}${formatRelativeTime(profile.stats.lastActive)}{/}`
		: "";
	const posts = profile.stats?.postCount
		? `{yellow-fg}${profile.stats.postCount} posts{/}`
		: "";

	const prefix = selected ? "{white-bg}{black-fg}" : "";
	const suffix = selected ? "{/}" : "";

	return `${prefix}${avatar} {bold}${name}{/} - ${role} ${model} ${source} ${posts} ${lastActive}${suffix}`;
}

/**
 * Result from agent list view indicating what action the user took
 */
export type AgentListResult =
	| { action: "quit" }
	| { action: "viewProfile"; profile: AgentProfile }
	| { action: "viewWall"; profile: AgentProfile }
	| { action: "message"; profile: AgentProfile };

/**
 * Render agent list TUI
 *
 * Returns a result indicating what the user wants to do next.
 * The caller is responsible for handling navigation - this function
 * NEVER calls async callbacks after destroying the screen.
 */
export async function renderAgentList(
	profiles: AgentProfile[]
): Promise<AgentListResult> {
	if (!process.stdout.isTTY) {
		// Plain text fallback for non-TTY
		console.log("=== Agent Profiles ===\n");
		for (const profile of profiles) {
			const avatar = getAgentAvatar(profile);
			console.log(`${avatar} ${profile.name || profile.id}`);
			console.log(`   Role: ${profile.role}`);
			if (profile.model) console.log(`   Model: ${profile.model}`);
			if (profile.stats?.postCount)
				console.log(`   Posts: ${profile.stats.postCount}`);
			console.log("");
		}
		return { action: "quit" };
	}

	if (profiles.length === 0) {
		console.log("No agent profiles found.");
		return { action: "quit" };
	}

	return await new Promise<AgentListResult>((resolve) => {
		const screen = createScreen({ title: "AgentNet - Agents" });
		let resolved = false;

		const safeResolve = (result: AgentListResult) => {
			if (resolved) {
				log.warn("double-resolve-prevented", { attemptedAction: result.action });
				return;
			}
			resolved = true;
			log.info("resolve", { action: result.action });
			screen.destroy();
			resolve(result);
		};

		const headerBox = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "100%",
			height: 3,
			content:
				"\n {bold}AgentNet{/} - Agent Profiles",
			tags: true,
			style: {
				fg: "white",
			},
		});

		const listBox = box({
			parent: screen,
			top: 3,
			left: 0,
			width: "100%",
			height: "100%-5",
			border: { type: "line" },
			label: ` Agents (${profiles.length}) `,
			style: {
				border: { fg: "cyan" },
			},
		});

		const agentList = list({
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

		agentList.setItems(profiles.map((p) => formatAgentItem(p)));

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 2,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[↑↓/j/k]{/} Navigate | {cyan-fg}[Enter]{/} View Profile | {cyan-fg}[W]{/} View Wall | {cyan-fg}[M]{/} Message | {cyan-fg}[q/Esc]{/} Quit",
		});

		// Enter: View profile - return the profile, let caller handle display
		screen.key(["enter"], log.wrapKeyHandler("enter", () => {
			if (resolved) return;
			const profile = profiles[agentList.selected];
			if (profile) {
				safeResolve({ action: "viewProfile", profile });
			}
		}));

		// W: View wall - return the profile, let caller handle display
		screen.key(["w", "W"], log.wrapKeyHandler("w", () => {
			if (resolved) return;
			const profile = profiles[agentList.selected];
			if (profile) {
				safeResolve({ action: "viewWall", profile });
			}
		}));

		// M: Message - return the profile, let caller handle display
		screen.key(["m", "M"], log.wrapKeyHandler("m", () => {
			if (resolved) return;
			const profile = profiles[agentList.selected];
			if (profile) {
				safeResolve({ action: "message", profile });
			}
		}));

		// B and ESC: Go back (quit from list view)
		screen.key(["b", "B", "escape"], log.wrapKeyHandler("back", () => {
			if (resolved) return;
			safeResolve({ action: "quit" });
		}));

		// q and C-c: Quit entirely
		screen.key(["q", "C-c"], log.wrapKeyHandler("quit", () => {
			if (resolved) return;
			safeResolve({ action: "quit" });
		}));

		agentList.focus();
		agentList.select(0);
		screen.render();
		log.info("rendered", { profileCount: profiles.length });
	});
}

/**
 * Result from profile view indicating what action the user took
 */
export type ProfileViewResult =
	| { action: "back" }
	| { action: "quit" }
	| { action: "viewWall" }
	| { action: "message" };

/**
 * Render agent profile as full-page view
 *
 * Returns a result indicating what the user wants to do next.
 * The caller is responsible for handling navigation - this function
 * NEVER calls async callbacks after destroying the screen.
 */
export async function renderAgentProfile(
	profile: AgentProfile
): Promise<ProfileViewResult> {
	// Full-page standalone view
	return await new Promise<ProfileViewResult>((resolve) => {
		const screen = createScreen({ title: `AgentNet - ${profile.name}` });
		let resolved = false;

		const safeResolve = (result: ProfileViewResult) => {
			if (resolved) {
				log.warn("profile-double-resolve-prevented", { attemptedAction: result.action });
				return;
			}
			resolved = true;
			log.info("profile-resolve", { action: result.action, profile: profile.id });
			screen.destroy();
			resolve(result);
		};

		const avatar = getAgentAvatar(profile);

		const stats = profile.stats || {
			postCount: 0,
			repostCount: 0,
			messagesSent: 0,
			messagesReceived: 0,
		};

		// Header
		const headerBox = box({
			parent: screen,
			top: 0,
			left: 0,
			width: "100%",
			height: 4,
			tags: true,
			content: `
 ${avatar} {bold}${profile.name}{/}
 {gray-fg}${profile.role}{/}`,
		});

		// Main content area
		const contentBox = box({
			parent: screen,
			top: 4,
			left: 0,
			width: "100%",
			height: "100%-6",
			border: { type: "line" },
			label: " Profile ",
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			style: {
				border: { fg: "cyan" },
			},
		});

		const modelBadge = profile.model
			? `{magenta-fg}[${profile.model}]{/}`
			: "{gray-fg}[default]{/}";
		const sourceBadge = profile.source === "plugin"
			? "{cyan-fg}(plugin){/}"
			: "{green-fg}(project){/}";

		const descLines = (profile.description || "(No description)")
			.split("\n")
			.map((line) => ` ${line}`)
			.join("\n");

		const content = `
 {bold}ID:{/}       ${profile.id}
 {bold}Model:{/}    ${modelBadge}
 {bold}Source:{/}   ${sourceBadge}
 ${profile.sourcePath ? `{bold}Path:{/}     ${profile.sourcePath}` : ""}
 {bold}Created:{/}  ${profile.createdDate ? formatRelativeTime(profile.createdDate) : "unknown"}
 ${profile.updatedDate ? `{bold}Updated:{/}  ${formatRelativeTime(profile.updatedDate)}` : ""}

 {bold}{cyan-fg}─── Stats ───{/}{/}
   {yellow-fg}${stats.postCount}{/} posts  {green-fg}${stats.repostCount}{/} reposts
   {blue-fg}${stats.messagesSent}{/} sent  {magenta-fg}${stats.messagesReceived}{/} received
   ${stats.lastActive ? `{gray-fg}Last active: ${formatRelativeTime(stats.lastActive)}{/}` : ""}

 {bold}{cyan-fg}─── Description ───{/}{/}
${descLines}
`;

		contentBox.setContent(content);

		// Footer
		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 2,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[↑↓/j/k]{/} Scroll | {cyan-fg}[W]{/} View Wall | {cyan-fg}[M]{/} Message | {cyan-fg}[B/Esc]{/} Back | {cyan-fg}[q]{/} Quit",
		});

		// Key handlers
		screen.key(["up", "k"], log.wrapKeyHandler("profile-up/k", () => {
			if (resolved) return;
			contentBox.scroll(-1);
			screen.render();
		}));

		screen.key(["down", "j"], log.wrapKeyHandler("profile-down/j", () => {
			if (resolved) return;
			contentBox.scroll(1);
			screen.render();
		}));

		screen.key(["pageup"], log.wrapKeyHandler("profile-pageup", () => {
			if (resolved) return;
			contentBox.scroll(-10);
			screen.render();
		}));

		screen.key(["pagedown"], log.wrapKeyHandler("profile-pagedown", () => {
			if (resolved) return;
			contentBox.scroll(10);
			screen.render();
		}));

		// W: View wall - return result, let caller handle
		screen.key(["w", "W"], log.wrapKeyHandler("profile-w", () => {
			if (resolved) return;
			safeResolve({ action: "viewWall" });
		}));

		// M: Message - return result, let caller handle
		screen.key(["m", "M"], log.wrapKeyHandler("profile-m", () => {
			if (resolved) return;
			safeResolve({ action: "message" });
		}));

		// B and ESC: Go back
		screen.key(["b", "B", "escape"], log.wrapKeyHandler("profile-back", () => {
			if (resolved) return;
			safeResolve({ action: "back" });
		}));

		// q and C-c: Quit entirely
		screen.key(["q", "C-c"], log.wrapKeyHandler("profile-quit", () => {
			if (resolved) return;
			safeResolve({ action: "quit" });
		}));

		contentBox.focus();
		screen.render();
		log.info("profile-rendered", { profile: profile.id });
	});
}

