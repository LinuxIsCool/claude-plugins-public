/**
 * AgentNet Screen Utilities
 * TUI screen management following Backlog.md patterns
 */

import { screen } from "neo-neo-bblessed";

// Global error handler to suppress blessed's buggy TypeError
// The issue is in blessed's EventEmitter._emit which does:
//   if (type === "error") { throw new args[0](); }
// This expects args[0] to be an Error constructor, but Node passes Error instances
process.on("uncaughtException", (err) => {
	// Suppress the specific blessed TypeError bug
	if (
		err instanceof TypeError &&
		err.message.includes("TypeError is not a constructor")
	) {
		// Silently ignore this specific blessed bug
		return;
	}
	// Log other errors but don't crash for TUI resilience
	console.error("Uncaught exception:", err);
});

// Also handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
	// Suppress blessed's buggy TypeError in promise rejections too
	if (
		reason instanceof TypeError &&
		String(reason.message).includes("TypeError is not a constructor")
	) {
		return;
	}
	console.error("Unhandled rejection:", reason);
});

export interface ScreenOptions {
	title?: string;
	smartCSR?: boolean;
	fullUnicode?: boolean;
}

/**
 * Create a blessed screen instance
 * Includes error handling to prevent blessed's TypeError bug
 */
export function createScreen(options?: ScreenOptions): ReturnType<typeof screen> {
	const s = screen({
		title: options?.title || "AgentNet",
		// Note: smartCSR can cause "ZwQ" artifacts in some terminals
		// Set to false by default for better compatibility
		smartCSR: options?.smartCSR ?? false,
		fullUnicode: options?.fullUnicode ?? true,
		// Disable cursor to prevent artifacts
		cursor: {
			artificial: true,
			shape: "block",
			blink: false,
		},
		// Don't dump screen on exit (can cause artifacts)
		dump: undefined,
		// Use alternate buffer
		altScreen: true,
	});

	// Prevent "ZwQ" artifact from jsbterm mouse mode
	// The blessed library sends '\x1b[0~ZwQ\x1b\\' when disabling jsbterm mouse
	// which displays as "ZwQ" in terminals that don't recognize this sequence
	if (s.program) {
		// Patch _write to filter out the jsbterm escape sequence
		const originalWrite = s.program._write.bind(s.program);
		s.program._write = function(data: string) {
			// Filter out the jsbterm mouse disable sequence
			if (data && data.includes('ZwQ')) {
				data = data.replace(/\x1b\[0~ZwQ\x1b\\/g, '');
				data = data.replace(/\x1b\[0~ZwLMRK\+1Q\x1b\\/g, '');
				if (!data) return;
			}
			return originalWrite(data);
		};
		s.program.clear();
	}

	// Add error handlers to prevent blessed's internal TypeError bug
	// When errors are emitted, blessed tries to do `new args[0]()` which fails
	// if args[0] is an Error instance instead of an Error constructor

	// Handler for screen errors
	s.on("error", () => {
		// Silently ignore - blessed's error handling is buggy
	});

	// Handler for program errors (the underlying terminal interface)
	if (s.program) {
		s.program.on("error", () => {
			// Silently ignore
		});

		// Add handlers to input/output streams which can emit errors on close
		if (s.program.input && typeof s.program.input.on === "function") {
			s.program.input.on("error", () => {
				// Silently ignore stream errors
			});
		}
		if (s.program.output && typeof s.program.output.on === "function") {
			s.program.output.on("error", () => {
				// Silently ignore stream errors
			});
		}
	}

	return s;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string | Date): string {
	const d = typeof date === "string" ? new Date(date) : date;
	const now = new Date();
	const diff = now.getTime() - d.getTime();

	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return formatDate(d);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Get emoji avatar for agent based on model or role
 * Note: Avoid emojis with variation selectors (U+FE0F) as they cause terminal rendering issues
 * Safe: 🎭🎵🌸🤖📚📖🧠🎓🧭🔭 (single codepoint)
 * Unsafe: 🏛️🗺️🖥️ (have variation selectors, cause "ZwQ" rendering bugs)
 */
export function getAgentAvatar(profile: {
	avatar?: string;
	model?: string;
	role?: string;
}): string {
	if (profile.avatar) return profile.avatar;

	// Default avatars based on model
	if (profile.model) {
		switch (profile.model.toLowerCase()) {
			case "opus":
				return "🎭";
			case "sonnet":
				return "🎵";
			case "haiku":
				return "🌸";
		}
	}

	// Default avatars based on role keywords
	// Using safe emojis (no variation selectors)
	const role = (profile.role || "").toLowerCase();
	if (role.includes("architect")) return "🏗"; // construction, not 🏛️
	if (role.includes("thinker") || role.includes("systems")) return "🧠";
	if (role.includes("archivist") || role.includes("archive")) return "📚";
	if (role.includes("librarian")) return "📖";
	if (role.includes("validator")) return "✓";
	if (role.includes("mentor")) return "🎓";
	if (role.includes("cartographer") || role.includes("map")) return "🧭"; // compass, not 🗺️
	if (role.includes("navigator")) return "🧭";
	if (role.includes("explorer")) return "🔭";
	if (role.includes("curator")) return "🎨";
	if (role.includes("engineer")) return "🔧";
	if (role.includes("style")) return "✨";
	if (role.includes("interface")) return "💻";
	if (role.includes("backend")) return "⚙";

	return "🤖";
}

/**
 * Get status indicator for post type
 */
export function getPostTypeIcon(type: string): string {
	switch (type) {
		case "original":
			return "📝";
		case "repost":
			return "🔄";
		case "reply":
			return "💬";
		default:
			return "📄";
	}
}

/**
 * Get visibility icon
 */
export function getVisibilityIcon(visibility: string): string {
	switch (visibility) {
		case "public":
			return "🌐";
		case "followers":
			return "👥";
		case "mentioned":
			return "📫";
		case "private":
			return "🔒";
		default:
			return "📄";
	}
}

/**
 * Get staleness indicator
 */
export function getStalenessIndicator(post: {
	isStale?: boolean;
	validUntil?: string;
}): string {
	if (post.isStale) return "{red-fg}⚠ STALE{/}";
	if (post.validUntil) {
		const validDate = new Date(post.validUntil);
		const now = new Date();
		const daysLeft = Math.ceil(
			(validDate.getTime() - now.getTime()) / 86400000
		);
		if (daysLeft <= 7) return `{yellow-fg}⏰ ${daysLeft}d{/}`;
	}
	return "";
}
