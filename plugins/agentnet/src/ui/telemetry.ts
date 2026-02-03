/**
 * AgentNet TUI Telemetry
 * Logging and error tracking for TUI reliability
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	component: string;
	event: string;
	data?: Record<string, unknown>;
	error?: {
		message: string;
		stack?: string;
	};
}

// Configuration
const config = {
	enabled: process.env.AGENTNET_TELEMETRY !== "false",
	logLevel: (process.env.AGENTNET_LOG_LEVEL || "info") as LogLevel,
	logToFile: process.env.AGENTNET_LOG_FILE !== "false",
	logToConsole: process.env.AGENTNET_LOG_CONSOLE === "true",
};

// Log level priority
const levelPriority: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

// In-memory buffer for recent logs (useful for crash diagnostics)
const recentLogs: LogEntry[] = [];
const MAX_RECENT_LOGS = 100;

// Log file path
let logFilePath: string | null = null;

/**
 * Initialize telemetry with a data directory
 */
export function initTelemetry(dataDir: string): void {
	if (!config.enabled) return;

	const logsDir = join(dataDir, "logs");
	if (!existsSync(logsDir)) {
		mkdirSync(logsDir, { recursive: true });
	}

	const date = new Date().toISOString().split("T")[0];
	logFilePath = join(logsDir, `tui-${date}.log`);
}

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
	return levelPriority[level] >= levelPriority[config.logLevel];
}

/**
 * Format a log entry for file output
 */
function formatLogEntry(entry: LogEntry): string {
	const parts = [
		entry.timestamp,
		entry.level.toUpperCase().padEnd(5),
		`[${entry.component}]`,
		entry.event,
	];

	if (entry.data && Object.keys(entry.data).length > 0) {
		parts.push(JSON.stringify(entry.data));
	}

	if (entry.error) {
		parts.push(`ERROR: ${entry.error.message}`);
		if (entry.error.stack) {
			parts.push(`\n${entry.error.stack}`);
		}
	}

	return parts.join(" ");
}

/**
 * Write a log entry
 */
function writeLog(entry: LogEntry): void {
	// Add to recent logs buffer
	recentLogs.push(entry);
	if (recentLogs.length > MAX_RECENT_LOGS) {
		recentLogs.shift();
	}

	// Write to file
	if (config.logToFile && logFilePath) {
		try {
			appendFileSync(logFilePath, formatLogEntry(entry) + "\n");
		} catch {
			// Silently fail - don't crash the TUI due to logging
		}
	}

	// Write to console (only in debug mode)
	if (config.logToConsole) {
		const formatted = formatLogEntry(entry);
		if (entry.level === "error") {
			console.error(formatted);
		} else if (entry.level === "warn") {
			console.warn(formatted);
		} else {
			console.log(formatted);
		}
	}
}

/**
 * Create a logger for a specific component
 */
export function createLogger(component: string) {
	return {
		debug(event: string, data?: Record<string, unknown>): void {
			if (!config.enabled || !shouldLog("debug")) return;
			writeLog({
				timestamp: new Date().toISOString(),
				level: "debug",
				component,
				event,
				data,
			});
		},

		info(event: string, data?: Record<string, unknown>): void {
			if (!config.enabled || !shouldLog("info")) return;
			writeLog({
				timestamp: new Date().toISOString(),
				level: "info",
				component,
				event,
				data,
			});
		},

		warn(event: string, data?: Record<string, unknown>): void {
			if (!config.enabled || !shouldLog("warn")) return;
			writeLog({
				timestamp: new Date().toISOString(),
				level: "warn",
				component,
				event,
				data,
			});
		},

		error(event: string, error?: Error, data?: Record<string, unknown>): void {
			if (!config.enabled || !shouldLog("error")) return;
			writeLog({
				timestamp: new Date().toISOString(),
				level: "error",
				component,
				event,
				data,
				error: error
					? {
							message: error.message,
							stack: error.stack,
						}
					: undefined,
			});
		},

		/**
		 * Wrap a function with error logging
		 */
		wrap<T extends (...args: unknown[]) => unknown>(
			event: string,
			fn: T,
			data?: Record<string, unknown>
		): T {
			return ((...args: unknown[]) => {
				try {
					const result = fn(...args);
					// Handle async functions
					if (result instanceof Promise) {
						return result.catch((err) => {
							this.error(event, err instanceof Error ? err : new Error(String(err)), data);
							throw err;
						});
					}
					return result;
				} catch (err) {
					this.error(event, err instanceof Error ? err : new Error(String(err)), data);
					throw err;
				}
			}) as T;
		},

		/**
		 * Wrap a key handler with error catching (doesn't re-throw)
		 */
		wrapKeyHandler(
			key: string,
			fn: () => void,
			data?: Record<string, unknown>
		): () => void {
			return () => {
				try {
					this.debug(`key:${key}`, data);
					fn();
				} catch (err) {
					this.error(
						`key:${key}:crash`,
						err instanceof Error ? err : new Error(String(err)),
						data
					);
					// Don't re-throw - prevent crash
				}
			};
		},
	};
}

/**
 * Get recent logs (useful for crash reports)
 */
export function getRecentLogs(): LogEntry[] {
	return [...recentLogs];
}

/**
 * Export recent logs as a string (for crash reports)
 */
export function exportRecentLogs(): string {
	return recentLogs.map(formatLogEntry).join("\n");
}

/**
 * Track a TUI event
 */
export function trackEvent(
	component: string,
	event: string,
	data?: Record<string, unknown>
): void {
	const logger = createLogger(component);
	logger.info(event, data);
}

/**
 * Track a navigation event
 */
export function trackNavigation(
	from: string,
	to: string,
	trigger: string
): void {
	trackEvent("navigation", "navigate", { from, to, trigger });
}

/**
 * Track a render event
 */
export function trackRender(component: string, durationMs?: number): void {
	trackEvent(component, "render", durationMs ? { durationMs } : undefined);
}

/**
 * Global error handler for TUI
 */
export function setupGlobalErrorHandlers(): void {
	const logger = createLogger("global");

	process.on("uncaughtException", (err) => {
		logger.error("uncaughtException", err, {
			recentLogs: recentLogs.slice(-10).map((l) => `${l.component}:${l.event}`),
		});

		// Don't exit for known blessed bugs
		if (
			err instanceof TypeError &&
			err.message.includes("TypeError is not a constructor")
		) {
			return;
		}

		// For other errors, log and potentially exit
		console.error("Fatal error:", err.message);
		console.error("Recent activity:", exportRecentLogs().split("\n").slice(-20).join("\n"));
	});

	process.on("unhandledRejection", (reason) => {
		const error =
			reason instanceof Error ? reason : new Error(String(reason));
		logger.error("unhandledRejection", error);
	});
}

// Default export for convenience
export default {
	init: initTelemetry,
	createLogger,
	getRecentLogs,
	exportRecentLogs,
	trackEvent,
	trackNavigation,
	trackRender,
	setupGlobalErrorHandlers,
};
