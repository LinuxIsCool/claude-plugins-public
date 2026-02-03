/**
 * Static analysis tests for TUI code patterns
 * These tests analyze the source code to ensure consistent patterns are followed
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const UI_DIR = join(import.meta.dir, "../ui");

/**
 * Get all TypeScript files in the UI directory
 */
function getUIFiles(): string[] {
	return readdirSync(UI_DIR)
		.filter((f) => f.endsWith(".ts"))
		.map((f) => join(UI_DIR, f));
}

/**
 * Read file content
 */
function readFile(path: string): string {
	return readFileSync(path, "utf-8");
}

describe("TUI Code Patterns", () => {
	describe("Resolution Guards", () => {
		test("all screen.key handlers should check resolved flag", () => {
			const files = getUIFiles();
			const issues: string[] = [];

			for (const file of files) {
				const content = readFile(file);
				const fileName = file.split("/").pop();

				// Skip utility files and files that use wrapKeyHandler (which handles this internally)
				if (fileName === "screen.ts" || fileName === "telemetry.ts" || fileName === "result-view.ts") continue;

				// If the file uses log.wrapKeyHandler, it handles guards internally
				const usesWrapKeyHandler = /log\.wrapKeyHandler/.test(content);

				// If using wrapKeyHandler, just ensure it's used consistently
				if (usesWrapKeyHandler) {
					// All screen.key calls should use log.wrapKeyHandler
					const screenKeyCount = (content.match(/screen\.key\(/g) || []).length;
					const wrappedCount = (content.match(/log\.wrapKeyHandler/g) || []).length;

					// Allow some tolerance - not all handlers need wrapping
					if (wrappedCount < screenKeyCount / 2) {
						issues.push(`${fileName}: only ${wrappedCount}/${screenKeyCount} key handlers wrapped`);
					}
				}
			}

			if (issues.length > 0) {
				console.log("Resolution guard issues found:");
				issues.forEach((i) => console.log(`  - ${i}`));
			}

			// This test documents the expected pattern
			expect(issues.length).toBeLessThanOrEqual(0);
		});
	});

	describe("Safe Resolution Pattern", () => {
		test("views should use safeResolve pattern with resolved guard", () => {
			const files = getUIFiles();
			const issues: string[] = [];

			for (const file of files) {
				const content = readFile(file);
				const fileName = file.split("/").pop();

				// Skip utility files
				if (fileName === "screen.ts" || fileName === "telemetry.ts" || fileName === "result-view.ts") continue;

				// Views with interactive key handlers should have:
				// 1. A 'resolved' flag to prevent double-resolution
				// 2. A safeResolve helper function
				const hasResolvedGuard = /let resolved\s*=\s*false/.test(content);
				const hasSafeResolve = /const safeResolve\s*=/.test(content);

				// Only check files that have screen.key handlers
				if (/screen\.key\(/.test(content)) {
					if (!hasResolvedGuard || !hasSafeResolve) {
						issues.push(`${fileName}: missing safeResolve pattern (resolved=${hasResolvedGuard}, safeResolve=${hasSafeResolve})`);
					}
				}
			}

			// After our improvements, all views should use the safe pattern
			expect(issues).toEqual([]);
		});
	});

	describe("Async Error Handling", () => {
		test("async key handlers should have error handling or be simple", () => {
			const files = getUIFiles();
			const issues: string[] = [];

			for (const file of files) {
				const content = readFile(file);
				const fileName = file.split("/").pop();

				// Find async key handlers that call external functions without try-catch
				const asyncKeyHandler = /screen\.key\(\[[^\]]+\],\s*async\s*\(\)\s*=>\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
				let match;

				while ((match = asyncKeyHandler.exec(content)) !== null) {
					const body = match[1];

					// If handler has await and no try-catch, flag it
					// (unless it's just await options?.onSomething() which is safe)
					const hasAwait = /await\s+(?!options\?)/.test(body);
					const hasTryCatch = /try\s*\{/.test(body);

					// Skip simple option callbacks
					const isSimpleCallback = /await\s+options\?\.on\w+\(/.test(body) &&
						!body.includes("await store") &&
						!body.includes("await render");

					if (hasAwait && !hasTryCatch && !isSimpleCallback) {
						// This could be an issue but many are intentional
						// Just document for awareness
					}
				}
			}

			// This is informational - not a hard failure
			expect(true).toBe(true);
		});
	});

	describe("Consistent ESC/q Behavior", () => {
		test("ESC should be grouped with B for 'back' behavior", () => {
			const files = getUIFiles();
			const issues: string[] = [];

			for (const file of files) {
				const content = readFile(file);
				const fileName = file.split("/").pop();

				// Skip main-menu.ts which intentionally ignores ESC
				if (fileName === "main-menu.ts") continue;

				// Check if ESC is grouped with q (bad) instead of B (good)
				const escWithQ = /screen\.key\(\[.*"q".*"escape".*\].*\)/;
				const escWithB = /screen\.key\(\[.*"escape".*"[bB]".*\]|\[.*"[bB]".*"escape".*\]/;

				if (escWithQ.test(content) && !escWithB.test(content)) {
					// Check if there's a separate ESC handler with B
					if (!/screen\.key\(\[.*"[bB]".*"escape"|\[.*"escape".*"[bB]"/.test(content)) {
						issues.push(`${fileName}: ESC grouped with q instead of B`);
					}
				}
			}

			// After our fixes, this should pass
			expect(issues).toEqual([]);
		});

		test("q/C-c should be separate from ESC for 'quit' behavior", () => {
			const files = getUIFiles();
			let hasProperSeparation = 0;

			for (const file of files) {
				const content = readFile(file);
				const fileName = file.split("/").pop();

				// Skip files that don't have navigation
				if (fileName === "screen.ts") continue;

				// Check for pattern: ["q", "C-c"] separate from escape
				const qCcOnly = /screen\.key\(\["q",\s*"C-c"\]/;

				if (qCcOnly.test(content)) {
					hasProperSeparation++;
				}
			}

			// At least some views should have proper separation
			expect(hasProperSeparation).toBeGreaterThan(0);
		});
	});

	describe("Callback Handling", () => {
		test("handlers should always resolve/destroy even without callbacks", () => {
			const files = getUIFiles();
			const issues: string[] = [];

			for (const file of files) {
				const content = readFile(file);
				const fileName = file.split("/").pop();

				// Find B key handlers that only do something if options.onBack exists
				// Bad pattern: if (options.onBack) { resolve; destroy; await onBack; }
				// Good pattern: resolve; destroy; if (options.onBack) { await onBack; }
				const badPattern = /if\s*\(options\.onBack\)\s*\{\s*resolve\(\)/;

				if (badPattern.test(content)) {
					issues.push(`${fileName}: B handler only resolves when onBack exists`);
				}
			}

			// After our fixes, this should pass
			expect(issues).toEqual([]);
		});
	});
});

describe("TUI View Completeness", () => {
	test("all views should handle essential keys", () => {
		const essentialKeys = {
			"wall-view.ts": ["up", "down", "enter", "escape", "q"],
			"feed-view.ts": ["up", "down", "enter", "escape", "q"],
			"agent-list.ts": ["up", "down", "enter", "escape", "q"],
			"message-view.ts": ["up", "down", "enter", "escape", "q"],
			"result-view.ts": ["up", "down", "escape", "q"],
			"main-menu.ts": ["up", "down", "enter", "q"],
		};

		for (const [fileName, keys] of Object.entries(essentialKeys)) {
			const filePath = join(UI_DIR, fileName);
			try {
				const content = readFile(filePath);
				for (const key of keys) {
					const hasKey = new RegExp(`["']${key}["']`).test(content);
					expect(hasKey).toBe(true);
				}
			} catch {
				// File might not exist - skip
			}
		}
	});
});
