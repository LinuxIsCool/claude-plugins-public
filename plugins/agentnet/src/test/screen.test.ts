/**
 * AgentNet Screen Utility Tests
 * Tests for TUI helper functions
 */

import { describe, test, expect } from "bun:test";
import {
	formatDate,
	formatRelativeTime,
	truncate,
	getAgentAvatar,
	getPostTypeIcon,
	getVisibilityIcon,
	getStalenessIndicator,
} from "../ui/screen.ts";

describe("formatDate", () => {
	test("should format ISO date string", () => {
		const result = formatDate("2025-12-15T10:30:00Z");
		expect(result).toContain("Dec");
		expect(result).toContain("15");
	});

	test("should format Date object", () => {
		const date = new Date("2025-12-15T10:30:00Z");
		const result = formatDate(date);
		expect(result).toContain("Dec");
		expect(result).toContain("15");
	});
});

describe("formatRelativeTime", () => {
	test("should show 'just now' for recent times", () => {
		const now = new Date();
		const result = formatRelativeTime(now);
		expect(result).toBe("just now");
	});

	test("should show minutes for times under an hour", () => {
		const date = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
		const result = formatRelativeTime(date);
		expect(result).toContain("m ago");
	});

	test("should show hours for times under a day", () => {
		const date = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
		const result = formatRelativeTime(date);
		expect(result).toContain("h ago");
	});

	test("should show days for times under a week", () => {
		const date = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
		const result = formatRelativeTime(date);
		expect(result).toContain("d ago");
	});
});

describe("truncate", () => {
	test("should not truncate short strings", () => {
		const result = truncate("Hello", 10);
		expect(result).toBe("Hello");
	});

	test("should truncate long strings with ellipsis", () => {
		const result = truncate("Hello World", 8);
		expect(result.length).toBe(8);
		expect(result).toContain("…");
	});

	test("should handle exact length strings", () => {
		const result = truncate("Hello", 5);
		expect(result).toBe("Hello");
	});
});

describe("getAgentAvatar", () => {
	test("should return custom avatar if provided", () => {
		const result = getAgentAvatar({ avatar: "🎯" });
		expect(result).toBe("🎯");
	});

	test("should return model-based avatar for opus", () => {
		const result = getAgentAvatar({ model: "opus" });
		expect(result).toBe("🎭");
	});

	test("should return model-based avatar for sonnet", () => {
		const result = getAgentAvatar({ model: "sonnet" });
		expect(result).toBe("🎵");
	});

	test("should return model-based avatar for haiku", () => {
		const result = getAgentAvatar({ model: "haiku" });
		expect(result).toBe("🌸");
	});

	test("should return role-based avatar for architect", () => {
		const result = getAgentAvatar({ role: "Backend Architect" });
		expect(result).toBe("🏗");
	});

	test("should return role-based avatar for thinker", () => {
		const result = getAgentAvatar({ role: "Systems Thinker" });
		expect(result).toBe("🧠");
	});

	test("should return role-based avatar for librarian", () => {
		const result = getAgentAvatar({ role: "Knowledge Librarian" });
		expect(result).toBe("📖");
	});

	test("should return default robot for unknown", () => {
		const result = getAgentAvatar({});
		expect(result).toBe("🤖");
	});
});

describe("getPostTypeIcon", () => {
	test("should return correct icon for original", () => {
		expect(getPostTypeIcon("original")).toBe("📝");
	});

	test("should return correct icon for repost", () => {
		expect(getPostTypeIcon("repost")).toBe("🔄");
	});

	test("should return correct icon for reply", () => {
		expect(getPostTypeIcon("reply")).toBe("💬");
	});

	test("should return default icon for unknown type", () => {
		expect(getPostTypeIcon("unknown")).toBe("📄");
	});
});

describe("getVisibilityIcon", () => {
	test("should return correct icon for public", () => {
		expect(getVisibilityIcon("public")).toBe("🌐");
	});

	test("should return correct icon for followers", () => {
		expect(getVisibilityIcon("followers")).toBe("👥");
	});

	test("should return correct icon for mentioned", () => {
		expect(getVisibilityIcon("mentioned")).toBe("📫");
	});

	test("should return correct icon for private", () => {
		expect(getVisibilityIcon("private")).toBe("🔒");
	});

	test("should return default icon for unknown visibility", () => {
		expect(getVisibilityIcon("unknown")).toBe("📄");
	});
});

describe("getStalenessIndicator", () => {
	test("should return STALE for stale posts", () => {
		const result = getStalenessIndicator({ isStale: true });
		expect(result).toContain("STALE");
	});

	test("should return countdown for posts expiring soon", () => {
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + 3); // 3 days from now
		const result = getStalenessIndicator({ validUntil: futureDate.toISOString() });
		expect(result).toContain("d");
	});

	test("should return empty for posts without expiry", () => {
		const result = getStalenessIndicator({});
		expect(result).toBe("");
	});

	test("should return empty for posts with far future expiry", () => {
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
		const result = getStalenessIndicator({ validUntil: futureDate.toISOString() });
		expect(result).toBe("");
	});
});
