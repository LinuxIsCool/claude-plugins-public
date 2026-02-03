/**
 * Health Monitor
 *
 * Periodic health checks for all platforms.
 * Detects silent failures and triggers recovery actions.
 */

import { EventEmitter } from "events";
import type {
  PlatformId,
  HealthCheck,
  HealthReport,
  HealthConfig,
} from "./types";
import { DEFAULT_HEALTH_CONFIG } from "./types";
import type { PlatformManager } from "./platform-manager";
import { getStateManager } from "./state-manager";

/**
 * Health Monitor Events
 */
export interface HealthMonitorEvents {
  healthy: (check: HealthCheck) => void;
  unhealthy: (check: HealthCheck) => void;
  recovered: (platform: PlatformId) => void;
  report: (report: HealthReport) => void;
}

/**
 * Health Monitor
 *
 * Runs periodic health checks and emits events for the orchestrator.
 */
export class HealthMonitor extends EventEmitter {
  private config: HealthConfig;
  private platformManager: PlatformManager;
  private checkInterval: NodeJS.Timeout | null = null;
  private previouslyUnhealthy: Set<PlatformId> = new Set();
  private stateManager = getStateManager();

  constructor(platformManager: PlatformManager, config: Partial<HealthConfig> = {}) {
    super();
    this.platformManager = platformManager;
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    console.log(`[health-monitor] Starting with ${this.config.checkIntervalMs / 1000}s interval`);

    // Run initial check
    this.runChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runChecks();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("[health-monitor] Stopped");
  }

  /**
   * Check health of a specific platform
   */
  async checkPlatform(platform: PlatformId): Promise<HealthCheck> {
    const state = this.platformManager.getPlatformState(platform);
    const now = new Date();
    const issues: string[] = [];
    let healthy = true;

    // Check 1: Connection state
    if (!state || state.status !== "connected") {
      issues.push(`Not connected (status: ${state?.status ?? "unknown"})`);
      healthy = false;
    }

    // Check 2: Activity freshness (only if connected)
    if (state?.status === "connected" && state.lastMessage) {
      const staleness = now.getTime() - state.lastMessage.getTime();
      if (staleness > this.config.staleThresholdMs) {
        const staleMinutes = Math.round(staleness / 60000);
        issues.push(`No activity for ${staleMinutes} minutes`);
        // This is a warning, not necessarily unhealthy
        // Some platforms may legitimately have no messages for a while
      }
    }

    // Check 3: Error rate
    const recentErrors = this.stateManager.getRecentErrorCount(
      platform,
      this.config.errorWindowMs
    );
    if (recentErrors >= this.config.maxErrorsBeforeUnhealthy) {
      issues.push(`High error rate: ${recentErrors} errors in ${this.config.errorWindowMs / 60000} minutes`);
      healthy = false;
    }

    const check: HealthCheck = {
      platform,
      healthy,
      connected: state?.status === "connected",
      lastActivity: state?.lastMessage,
      issues,
      checkedAt: now,
    };

    // Record to state manager
    this.stateManager.recordHealthCheck(platform, healthy, issues);

    return check;
  }

  /**
   * Run health checks on all platforms
   */
  async checkAll(): Promise<HealthReport> {
    const states = this.platformManager.getAllStates();
    const checks: HealthCheck[] = [];

    for (const platform of states.keys()) {
      const check = await this.checkPlatform(platform);
      checks.push(check);
    }

    // Determine overall health
    const unhealthyCount = checks.filter((c) => !c.healthy).length;
    let overall: HealthReport["overall"];
    if (unhealthyCount === 0) {
      overall = "healthy";
    } else if (unhealthyCount === checks.length) {
      overall = "unhealthy";
    } else {
      overall = "degraded";
    }

    return {
      overall,
      platforms: checks,
      checkedAt: new Date(),
    };
  }

  /**
   * Get current health report (cached from last check)
   */
  async getReport(): Promise<HealthReport> {
    return this.checkAll();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async runChecks(): Promise<void> {
    try {
      const report = await this.checkAll();

      // Emit individual platform events
      for (const check of report.platforms) {
        if (check.healthy) {
          // Check if it was previously unhealthy
          if (this.previouslyUnhealthy.has(check.platform)) {
            this.previouslyUnhealthy.delete(check.platform);
            this.emit("recovered", check.platform);
            console.log(`[health-monitor] ${check.platform} recovered`);
          }
          this.emit("healthy", check);
        } else {
          this.previouslyUnhealthy.add(check.platform);
          this.emit("unhealthy", check);
          console.log(`[health-monitor] ${check.platform} unhealthy: ${check.issues.join(", ")}`);
        }
      }

      // Emit overall report
      this.emit("report", report);
    } catch (error) {
      console.error("[health-monitor] Error running checks:", error);
    }
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let monitorInstance: HealthMonitor | null = null;

export function getHealthMonitor(
  platformManager: PlatformManager,
  config?: Partial<HealthConfig>
): HealthMonitor {
  if (!monitorInstance) {
    monitorInstance = new HealthMonitor(platformManager, config);
  }
  return monitorInstance;
}

export function resetHealthMonitor(): void {
  if (monitorInstance) {
    monitorInstance.stop();
    monitorInstance = null;
  }
}
