/**
 * AgentNet Main Menu
 * Interactive TUI menu for navigating the social network
 */

import { box, list } from "neo-neo-bblessed";
import { createScreen } from "./screen.ts";
import { createLogger } from "./telemetry.ts";

const log = createLogger("main-menu");

export interface MenuItem {
	label: string;
	description: string;
	icon?: string;
	action: () => Promise<void>;
}

// Menu item icons
const MENU_ICONS: Record<string, string> = {
	"Browse Agents": "👥",
	"Global Feed": "📰",
	Messages: "💬",
	"Sync Agents": "🔄",
	Quit: "🚪",
};

/**
 * Render main menu TUI
 * @returns true if user wants to quit, false if action completed (show menu again)
 */
export async function renderMainMenu(items: MenuItem[]): Promise<boolean> {
	if (!process.stdout.isTTY) {
		console.log("AgentNet - Social Network for AI Agents\n");
		console.log("Run with a subcommand or in a terminal for interactive mode.");
		console.log("\nCommands:");
		for (const item of items) {
			const icon = item.icon || MENU_ICONS[item.label] || "•";
			console.log(`  ${icon} ${item.label.padEnd(18)} ${item.description}`);
		}
		return true; // Exit in non-TTY mode
	}

	return await new Promise<boolean>((resolve) => {
		const screen = createScreen({ title: "AgentNet" });
		let resolved = false;

		const safeResolve = (quit: boolean) => {
			if (resolved) {
				log.warn("double-resolve-prevented", { attemptedQuit: quit });
				return;
			}
			resolved = true;
			log.info("resolve", { quit });
			screen.destroy();
			resolve(quit);
		};

		// Centered container for header
		const headerBox = box({
			parent: screen,
			top: 1,
			left: "center",
			width: 52,
			height: 9,
			tags: true,
			content: `{bold}{cyan-fg}╭──────────────────────────────────────────────────╮
│                                                  │
│      █████╗  ██████╗ ███████╗███╗   ██╗████████╗ │
│     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝ │
│     ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║    │
│     ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║    │
│     ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║    │
│     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝    │
╰──────────────────────────────────────────────────╯{/}{/}`,
		});

		// Subtitle below header
		const subtitleBox = box({
			parent: screen,
			top: 10,
			left: "center",
			width: 40,
			height: 1,
			tags: true,
			align: "center",
			content: "{gray-fg}Social Network for AI Agents{/}",
		});

		// Menu container
		const menuBox = box({
			parent: screen,
			top: 13,
			left: "center",
			width: 52,
			height: items.length + 4,
			border: { type: "line" },
			label: " {bold}Main Menu{/} ",
			tags: true,
			style: {
				border: { fg: "cyan" },
			},
		});

		const menuList = list({
			parent: menuBox,
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			keys: true,     // Enable built-in key handling
			vi: true,       // Enable j/k navigation
			keyable: true,  // Register with screen for keypress events
			mouse: true,
			tags: true,
			style: {
				selected: { bg: "blue", fg: "white", bold: true },
			},
		});

		// Format menu items with consistent columns
		const labelWidth = 16;
		menuList.setItems(
			items.map((item, i) => {
				const icon = item.icon || MENU_ICONS[item.label] || "•";
				const num = `{yellow-fg}${i + 1}{/}`;
				const label = item.label.padEnd(labelWidth);
				return ` ${num}  ${icon}  {bold}${label}{/} {gray-fg}${item.description}{/}`;
			})
		);

		// Footer with keyboard shortcuts
		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: "center",
			height: 1,
			width: 70,
			tags: true,
			align: "center",
			content:
				"{cyan-fg}↑↓/j/k{/} Navigate  {cyan-fg}Enter{/} Select  {cyan-fg}1-9{/} Quick  {cyan-fg}q{/} Quit",
		});

		// Quick select with number keys
		for (let i = 1; i <= Math.min(9, items.length); i++) {
			const itemIndex = i - 1;
			screen.key([String(i)], log.wrapKeyHandler(`num-${i}`, async () => {
				if (resolved) return;
				const item = items[itemIndex];
				if (item) {
					resolved = true;
					log.info("action-selected", { index: itemIndex, label: item.label });
					screen.destroy();
					try {
						await item.action();
					} catch (err) {
						log.error("action-error", err instanceof Error ? err : new Error(String(err)), { index: itemIndex });
					}
					resolve(false); // Return to menu after action
				}
			}));
		}

		screen.key(["enter"], log.wrapKeyHandler("enter", async () => {
			if (resolved) return;
			const item = items[menuList.selected];
			if (item) {
				resolved = true;
				log.info("action-selected", { index: menuList.selected, label: item.label });
				screen.destroy();
				try {
					await item.action();
				} catch (err) {
					log.error("action-error", err instanceof Error ? err : new Error(String(err)), { index: menuList.selected });
				}
				resolve(false); // Return to menu after action
			}
		}));

		// Only q and Ctrl-C quit - ESC does nothing in main menu
		screen.key(["q", "C-c"], log.wrapKeyHandler("quit", () => {
			if (resolved) return;
			safeResolve(true);
		}));

		// ESC in main menu does nothing (you're already at the top level)
		screen.key(["escape"], log.wrapKeyHandler("escape", () => {
			// Intentionally empty - ESC should not quit from main menu
		}));

		menuList.focus();
		menuList.select(0);
		screen.render();
		log.info("rendered", { itemCount: items.length });
	});
}
