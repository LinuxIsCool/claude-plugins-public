/**
 * AgentNet Result View
 * TUI component for displaying operation results
 */

import { box } from "neo-neo-bblessed";
import { createScreen } from "./screen.ts";

export interface ResultViewOptions {
	title?: string;
	onDismiss?: () => Promise<void>;
}

/**
 * Render a result/notification screen that waits for keypress
 */
export async function renderResultView(
	content: string,
	options?: ResultViewOptions
): Promise<void> {
	if (!process.stdout.isTTY) {
		// Plain text fallback
		console.log(content);
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: options?.title || "AgentNet" });

		const contentBox = box({
			parent: screen,
			top: 2,
			left: 2,
			width: "100%-4",
			height: "100%-5",
			border: { type: "line" },
			label: options?.title ? ` ${options.title} ` : " Result ",
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			style: {
				border: { fg: "cyan" },
			},
			content: content,
		});

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 2,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[↑↓]{/} Scroll | {cyan-fg}[Enter/Esc/q]{/} Continue",
		});

		const dismiss = async () => {
			resolve();
			screen.destroy();
			if (options?.onDismiss) {
				await options.onDismiss();
			}
		};

		screen.key(["up", "k"], () => {
			if (!contentBox.focused) return;
			contentBox.scroll(-1);
			screen.render();
		});

		screen.key(["down", "j"], () => {
			if (!contentBox.focused) return;
			contentBox.scroll(1);
			screen.render();
		});

		screen.key(["enter", "escape", "q", "C-c"], () => {
			if (!contentBox.focused) return; // Focus guard
			dismiss();
		});

		contentBox.focus();
		screen.render();
	});
}

/**
 * Format sync results for display
 */
export function formatSyncResults(result: {
	created: string[];
	updated: string[];
	total: number;
}): string {
	const lines: string[] = [];

	lines.push("{bold}Sync Complete{/}\n");

	if (result.created.length > 0) {
		lines.push("{green-fg}Created profiles:{/}");
		for (const id of result.created) {
			lines.push(`  {green-fg}+{/} ${id}`);
		}
		lines.push("");
	}

	if (result.updated.length > 0) {
		lines.push("{yellow-fg}Updated profiles:{/}");
		for (const id of result.updated) {
			lines.push(`  {yellow-fg}~{/} ${id}`);
		}
		lines.push("");
	}

	if (result.created.length === 0 && result.updated.length === 0) {
		lines.push("{gray-fg}No changes detected.{/}\n");
	}

	lines.push(`{cyan-fg}Total agents:{/} ${result.total}`);

	return lines.join("\n");
}
