/**
 * Notification Dispatcher
 *
 * Sends desktop notifications (D-Bus/notify-send) and logs to file.
 * Provides visibility into daemon health and platform events.
 */

import { spawn } from "child_process";
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from "fs";
import { join } from "path";
import type { NotificationPayload, NotificationLevel, PlatformId } from "./types";
import { getDaemonLogPath } from "./state-manager";

/**
 * Icons for notification levels
 */
const LEVEL_ICONS: Record<NotificationLevel, string> = {
  info: "dialog-information",
  warning: "dialog-warning",
  error: "dialog-error",
};

/**
 * Urgency levels for notify-send
 */
const LEVEL_URGENCY: Record<NotificationLevel, string> = {
  info: "low",
  warning: "normal",
  error: "critical",
};

/**
 * Max log file size before rotation (10MB)
 */
const MAX_LOG_SIZE = 10 * 1024 * 1024;

/**
 * Notification Dispatcher Configuration
 */
export interface NotificationConfig {
  desktop: boolean;
  file: boolean;
  logPath?: string;
}

const DEFAULT_CONFIG: NotificationConfig = {
  desktop: true,
  file: true,
};

/**
 * Notification Dispatcher
 *
 * Sends notifications via desktop and file logging.
 */
export class NotificationDispatcher {
  private config: NotificationConfig;
  private logPath: string;
  private recentNotifications: Map<string, Date> = new Map();
  private readonly DEDUPE_WINDOW_MS = 60_000; // 1 minute

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logPath = config.logPath ?? getDaemonLogPath();

    // Ensure log directory exists
    const dir = join(this.logPath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Send a notification
   */
  async notify(payload: NotificationPayload): Promise<void> {
    // Check for duplicate
    const key = this.getDedupeKey(payload);
    if (this.isDuplicate(key)) {
      return;
    }
    this.recentNotifications.set(key, new Date());

    // Clean old entries periodically
    this.cleanupDedupeCache();

    // Send via configured channels
    const promises: Promise<void>[] = [];

    if (this.config.desktop) {
      promises.push(this.sendDesktop(payload));
    }

    if (this.config.file) {
      promises.push(this.logToFile(payload));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Convenience methods for common notifications
   */
  async info(title: string, body: string, platform?: PlatformId): Promise<void> {
    await this.notify({ level: "info", title, body, platform, timestamp: new Date() });
  }

  async warning(title: string, body: string, platform?: PlatformId): Promise<void> {
    await this.notify({ level: "warning", title, body, platform, timestamp: new Date() });
  }

  async error(title: string, body: string, platform?: PlatformId): Promise<void> {
    await this.notify({ level: "error", title, body, platform, timestamp: new Date() });
  }

  /**
   * Notify about platform connection
   */
  async platformConnected(platform: PlatformId): Promise<void> {
    await this.info("Platform Connected", `${platform} is now connected`, platform);
  }

  /**
   * Notify about platform disconnection
   */
  async platformDisconnected(platform: PlatformId): Promise<void> {
    await this.warning("Platform Disconnected", `${platform} has disconnected`, platform);
  }

  /**
   * Notify about platform error
   */
  async platformError(platform: PlatformId, error: string): Promise<void> {
    await this.error("Platform Error", `${platform}: ${error}`, platform);
  }

  /**
   * Notify about platform recovery
   */
  async platformRecovered(platform: PlatformId): Promise<void> {
    await this.info("Platform Recovered", `${platform} has recovered`, platform);
  }

  /**
   * Notify about daemon start
   */
  async daemonStarted(platformCount: number): Promise<void> {
    await this.info(
      "Messages Daemon Started",
      `Syncing ${platformCount} platform${platformCount !== 1 ? "s" : ""}`
    );
  }

  /**
   * Notify about daemon stop
   */
  async daemonStopped(): Promise<void> {
    await this.info("Messages Daemon Stopped", "Sync service has stopped");
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async sendDesktop(payload: NotificationPayload): Promise<void> {
    return new Promise((resolve) => {
      try {
        const icon = LEVEL_ICONS[payload.level];
        const urgency = LEVEL_URGENCY[payload.level];

        // Format title with platform prefix if applicable
        const title = payload.platform
          ? `[${payload.platform}] ${payload.title}`
          : payload.title;

        const args = [
          "--urgency", urgency,
          "--icon", icon,
          "--app-name", "messages-daemon",
          title,
          payload.body,
        ];

        const proc = spawn("notify-send", args, {
          stdio: "ignore",
          detached: true,
        });

        proc.on("error", () => {
          // notify-send not available - silently ignore
        });

        // Don't wait for completion, just fire and forget
        proc.unref();
      } catch {
        // notify-send not installed - silently ignore
      }
      resolve();
    });
  }

  private async logToFile(payload: NotificationPayload): Promise<void> {
    try {
      // Rotate log if needed
      this.rotateLogIfNeeded();

      const entry = {
        timestamp: payload.timestamp.toISOString(),
        level: payload.level,
        title: payload.title,
        body: payload.body,
        platform: payload.platform,
      };

      appendFileSync(this.logPath, JSON.stringify(entry) + "\n");
    } catch (error) {
      // Log to stderr as fallback
      console.error("[notification-dispatcher] Failed to write log:", error);
    }
  }

  private rotateLogIfNeeded(): void {
    try {
      if (!existsSync(this.logPath)) {
        return;
      }

      const stats = statSync(this.logPath);
      if (stats.size > MAX_LOG_SIZE) {
        // Simple rotation: rename current to .old
        const oldPath = this.logPath + ".old";
        renameSync(this.logPath, oldPath);
      }
    } catch {
      // Ignore rotation errors
    }
  }

  private getDedupeKey(payload: NotificationPayload): string {
    return `${payload.level}:${payload.title}:${payload.platform ?? ""}`;
  }

  private isDuplicate(key: string): boolean {
    const lastSent = this.recentNotifications.get(key);
    if (!lastSent) return false;

    const elapsed = Date.now() - lastSent.getTime();
    return elapsed < this.DEDUPE_WINDOW_MS;
  }

  private cleanupDedupeCache(): void {
    const now = Date.now();
    for (const [key, date] of this.recentNotifications.entries()) {
      if (now - date.getTime() > this.DEDUPE_WINDOW_MS) {
        this.recentNotifications.delete(key);
      }
    }
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let dispatcherInstance: NotificationDispatcher | null = null;

export function getNotificationDispatcher(
  config?: Partial<NotificationConfig>
): NotificationDispatcher {
  if (!dispatcherInstance) {
    dispatcherInstance = new NotificationDispatcher(config);
  }
  return dispatcherInstance;
}

export function resetNotificationDispatcher(): void {
  dispatcherInstance = null;
}
