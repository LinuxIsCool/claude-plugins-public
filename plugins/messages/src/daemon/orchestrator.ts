/**
 * Orchestrator
 *
 * Central coordinator for the daemon.
 * Wires components together and routes events.
 */

import { EventEmitter } from "events";
import type {
  DaemonState,
  DaemonStatus,
  DaemonConfig,
  PlatformId,
  PlatformState,
  HealthReport,
  StatusResponse,
} from "./types";
import { DEFAULT_DAEMON_CONFIG, PLATFORM_PRIORITY } from "./types";
import { PlatformManager, getPlatformManager, resetPlatformManager } from "./platform-manager";
import { HealthMonitor, getHealthMonitor, resetHealthMonitor } from "./health-monitor";
import { NotificationDispatcher, getNotificationDispatcher } from "./notification-dispatcher";
import { StateManager, getStateManager, resetStateManager } from "./state-manager";

/**
 * Orchestrator Events
 */
export interface OrchestratorEvents {
  started: () => void;
  stopped: () => void;
  "status-changed": (status: DaemonStatus) => void;
  "platform:connected": (platform: PlatformId) => void;
  "platform:disconnected": (platform: PlatformId) => void;
  "platform:error": (platform: PlatformId, error: Error) => void;
}

/**
 * Orchestrator
 *
 * Coordinates all daemon components.
 */
export class Orchestrator extends EventEmitter {
  private config: DaemonConfig;
  private platformManager: PlatformManager;
  private healthMonitor: HealthMonitor;
  private notifications: NotificationDispatcher;
  private stateManager: StateManager;
  private status: DaemonStatus = "stopped";
  private startedAt?: Date;

  constructor(config: Partial<DaemonConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DAEMON_CONFIG, ...config };

    // Initialize components
    this.stateManager = getStateManager(this.config.dbPath || undefined);
    this.platformManager = getPlatformManager(this.config);
    this.healthMonitor = getHealthMonitor(this.platformManager, this.config.health);
    this.notifications = getNotificationDispatcher(this.config.notifications);

    // Wire up event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize and start all platforms
   */
  async start(): Promise<void> {
    if (this.status !== "stopped") {
      console.log("[orchestrator] Already running");
      return;
    }

    console.log("[orchestrator] Starting...");
    this.setStatus("starting");
    this.startedAt = new Date();

    // Record start in state manager
    this.stateManager.recordStart();

    try {
      // Start all authenticated platforms
      await this.platformManager.startAll();

      // Start health monitoring
      this.healthMonitor.start();

      // Determine status based on platform health
      const { healthy, total } = this.platformManager.getHealthyCount();
      if (total === 0) {
        console.log("[orchestrator] No platforms authenticated");
        this.setStatus("stopped");
        return;
      }

      if (healthy === total) {
        this.setStatus("running");
      } else if (healthy > 0) {
        this.setStatus("degraded");
      } else {
        this.setStatus("degraded");
      }

      // Notify user
      await this.notifications.daemonStarted(total);

      console.log(`[orchestrator] Started with ${healthy}/${total} platforms`);
      this.emit("started");
    } catch (error) {
      console.error("[orchestrator] Failed to start:", error);
      this.setStatus("stopped");
      throw error;
    }
  }

  /**
   * Stop all platforms gracefully
   */
  async stop(): Promise<void> {
    if (this.status === "stopped" || this.status === "stopping") {
      return;
    }

    console.log("[orchestrator] Stopping...");
    this.setStatus("stopping");

    try {
      // Stop health monitor first
      this.healthMonitor.stop();

      // Stop all platforms
      await this.platformManager.stopAll();

      // Record clean shutdown
      this.stateManager.recordShutdown(true);

      // Notify user
      await this.notifications.daemonStopped();

      this.setStatus("stopped");
      console.log("[orchestrator] Stopped");
      this.emit("stopped");
    } catch (error) {
      console.error("[orchestrator] Error during stop:", error);
      this.setStatus("stopped");
      throw error;
    }
  }

  /**
   * Restart a specific platform
   */
  async restartPlatform(platform: PlatformId): Promise<void> {
    await this.platformManager.restartPlatform(platform);
  }

  /**
   * Get current daemon state
   */
  getState(): DaemonState {
    const states = this.platformManager.getAllStates();
    const { healthy, total } = this.platformManager.getHealthyCount();

    // Convert Map to Record
    const platformRecord: Record<PlatformId, PlatformState> = {} as Record<PlatformId, PlatformState>;
    for (const [id, state] of states) {
      platformRecord[id] = state;
    }

    return {
      status: this.status,
      pid: process.pid,
      startedAt: this.startedAt,
      platforms: platformRecord,
      healthyPlatforms: healthy,
      totalPlatforms: total,
      uptime: this.startedAt
        ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000)
        : 0,
    };
  }

  /**
   * Get status response for IPC
   */
  getStatusResponse(): StatusResponse {
    const state = this.getState();

    return {
      daemon: {
        status: state.status,
        pid: state.pid,
        uptime: state.uptime,
        startedAt: state.startedAt?.toISOString() ?? "",
      },
      platforms: PLATFORM_PRIORITY
        .filter((p) => state.platforms[p])
        .map((p) => {
          const ps = state.platforms[p];
          return {
            id: p,
            status: ps.status,
            messageCount: ps.messageCount,
            lastMessage: ps.lastMessage?.toISOString(),
            lastError: ps.lastError,
          };
        }),
      summary: {
        healthy: state.healthyPlatforms,
        total: state.totalPlatforms,
      },
    };
  }

  /**
   * Get health report
   */
  async getHealthReport(): Promise<HealthReport> {
    return this.healthMonitor.getReport();
  }

  /**
   * Get current status
   */
  getStatus(): DaemonStatus {
    return this.status;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private setStatus(status: DaemonStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit("status-changed", status);
    }
  }

  private setupEventHandlers(): void {
    // Platform manager events
    this.platformManager.on("platform:connected", async (platform: PlatformId) => {
      console.log(`[orchestrator] Platform connected: ${platform}`);
      this.emit("platform:connected", platform);
      await this.notifications.platformConnected(platform);
      this.updateOverallStatus();
    });

    this.platformManager.on("platform:disconnected", async (platform: PlatformId) => {
      console.log(`[orchestrator] Platform disconnected: ${platform}`);
      this.emit("platform:disconnected", platform);
      await this.notifications.platformDisconnected(platform);
      this.updateOverallStatus();
    });

    this.platformManager.on("platform:error", async (platform: PlatformId, error: Error) => {
      console.error(`[orchestrator] Platform error: ${platform}:`, error.message);
      this.emit("platform:error", platform, error);
      await this.notifications.platformError(platform, error.message);

      // Persist error state
      const state = this.platformManager.getPlatformState(platform);
      if (state) {
        this.stateManager.savePlatformState(platform, state.status, {
          lastError: error.message,
          errorCount: state.errorCount,
          messageCount: state.messageCount,
        });
      }
    });

    this.platformManager.on("platform:message", (platform: PlatformId) => {
      // Update state with message activity
      const state = this.platformManager.getPlatformState(platform);
      if (state) {
        this.stateManager.savePlatformState(platform, state.status, {
          lastMessage: state.lastMessage,
          messageCount: state.messageCount,
        });
      }
    });

    this.platformManager.on("platform:failed", async (platform: PlatformId, reason: string) => {
      console.error(`[orchestrator] Platform failed: ${platform}: ${reason}`);
      await this.notifications.error("Platform Failed", reason, platform);
      this.updateOverallStatus();
    });

    // Health monitor events
    this.healthMonitor.on("recovered", async (platform: PlatformId) => {
      console.log(`[orchestrator] Platform recovered: ${platform}`);
      await this.notifications.platformRecovered(platform);
      this.updateOverallStatus();
    });

    this.healthMonitor.on("unhealthy", async (check) => {
      // Trigger recovery if platform is unhealthy
      if (!check.connected) {
        console.log(`[orchestrator] Triggering recovery for ${check.platform}`);
        // Recovery is already handled by platform manager
      }
    });
  }

  private updateOverallStatus(): void {
    if (this.status === "stopped" || this.status === "stopping" || this.status === "starting") {
      return;
    }

    const { healthy, total } = this.platformManager.getHealthyCount();

    if (total === 0) {
      this.setStatus("stopped");
    } else if (healthy === total) {
      this.setStatus("running");
    } else if (healthy > 0) {
      this.setStatus("degraded");
    } else {
      this.setStatus("degraded");
    }
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let orchestratorInstance: Orchestrator | null = null;

export function getOrchestrator(config?: Partial<DaemonConfig>): Orchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator(config);
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  if (orchestratorInstance) {
    orchestratorInstance.stop().catch(() => {});
    orchestratorInstance = null;
  }
  resetHealthMonitor();
  resetPlatformManager();
  resetStateManager();
}
