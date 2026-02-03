/**
 * Platform Manager
 *
 * Manages the lifecycle of all platform adapters.
 * Handles startup, shutdown, and recovery with graceful degradation.
 */

import { EventEmitter } from "events";
import type {
  PlatformId,
  PlatformState,
  IPlatformAdapter,
  DaemonConfig,
} from "./types";
import { PLATFORM_PRIORITY, DEFAULT_DAEMON_CONFIG } from "./types";
import {
  getAdapter,
  discoverAuthenticatedPlatforms,
  resetAllAdapters,
} from "./adapters";

/**
 * Platform Manager Events
 */
export interface PlatformManagerEvents {
  "platform:starting": (platform: PlatformId) => void;
  "platform:connected": (platform: PlatformId) => void;
  "platform:disconnected": (platform: PlatformId) => void;
  "platform:error": (platform: PlatformId, error: Error) => void;
  "platform:message": (platform: PlatformId, message: unknown) => void;
  "platform:recovering": (platform: PlatformId, attempt: number) => void;
  "platform:failed": (platform: PlatformId, reason: string) => void;
}

/**
 * Platform Manager
 *
 * Orchestrates platform adapters with fault isolation.
 */
export class PlatformManager extends EventEmitter {
  private adapters: Map<PlatformId, IPlatformAdapter> = new Map();
  private states: Map<PlatformId, PlatformState> = new Map();
  private recoveryTimers: Map<PlatformId, NodeJS.Timeout> = new Map();
  private config: DaemonConfig;

  constructor(config: Partial<DaemonConfig> = {}) {
    super();
    this.config = { ...DEFAULT_DAEMON_CONFIG, ...config };
  }

  /**
   * Discover which platforms have valid authentication
   */
  async discoverPlatforms(): Promise<PlatformId[]> {
    return discoverAuthenticatedPlatforms();
  }

  /**
   * Start all authenticated platforms in priority order
   */
  async startAll(): Promise<void> {
    const platforms = await this.discoverPlatforms();
    console.log(`[platform-manager] Discovered ${platforms.length} authenticated platforms: ${platforms.join(", ")}`);

    for (const platform of platforms) {
      await this.startPlatform(platform);
    }
  }

  /**
   * Start a specific platform
   */
  async startPlatform(platform: PlatformId): Promise<void> {
    // Initialize state if needed
    if (!this.states.has(platform)) {
      this.states.set(platform, this.createInitialState(platform));
    }

    const state = this.states.get(platform)!;

    // Skip if already connected or starting
    if (state.status === "connected" || state.status === "starting") {
      return;
    }

    // Get or create adapter
    let adapter = this.adapters.get(platform);
    if (!adapter) {
      adapter = getAdapter(platform);
      this.adapters.set(platform, adapter);
      this.setupAdapterListeners(platform, adapter);
    }

    // Update state
    state.status = "starting";
    this.emit("platform:starting", platform);

    try {
      await adapter.start();
      state.status = "connected";
      state.lastConnected = new Date();
      state.reconnectAttempts = 0;
      this.emit("platform:connected", platform);
      console.log(`[platform-manager] ${platform} connected`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.status = "error";
      state.lastError = err.message;
      state.errorCount++;
      this.emit("platform:error", platform, err);
      console.error(`[platform-manager] ${platform} failed to start:`, err.message);

      // Schedule recovery
      this.scheduleRecovery(platform);
    }
  }

  /**
   * Stop a specific platform
   */
  async stopPlatform(platform: PlatformId): Promise<void> {
    // Cancel any pending recovery
    this.cancelRecovery(platform);

    const adapter = this.adapters.get(platform);
    if (!adapter) {
      return;
    }

    const state = this.states.get(platform);
    if (state) {
      state.status = "stopped";
    }

    try {
      await adapter.stop();
      console.log(`[platform-manager] ${platform} stopped`);
    } catch (error) {
      console.error(`[platform-manager] Error stopping ${platform}:`, error);
    }

    this.emit("platform:disconnected", platform);
  }

  /**
   * Stop all platforms
   */
  async stopAll(): Promise<void> {
    // Stop in reverse priority order
    const platforms = [...this.adapters.keys()].sort((a, b) => {
      const aIdx = PLATFORM_PRIORITY.indexOf(a);
      const bIdx = PLATFORM_PRIORITY.indexOf(b);
      return bIdx - aIdx; // Reverse order
    });

    for (const platform of platforms) {
      await this.stopPlatform(platform);
    }

    // Clear all state
    this.adapters.clear();
    this.states.clear();
  }

  /**
   * Restart a specific platform
   */
  async restartPlatform(platform: PlatformId): Promise<void> {
    await this.stopPlatform(platform);

    // Brief delay before restart
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.startPlatform(platform);
  }

  /**
   * Get state for a platform
   */
  getPlatformState(platform: PlatformId): PlatformState | undefined {
    return this.states.get(platform);
  }

  /**
   * Get all platform states
   */
  getAllStates(): Map<PlatformId, PlatformState> {
    return new Map(this.states);
  }

  /**
   * Get active (connected) platforms
   */
  getActivePlatforms(): PlatformId[] {
    return [...this.states.entries()]
      .filter(([_, state]) => state.status === "connected")
      .map(([platform]) => platform);
  }

  /**
   * Get count of healthy platforms
   */
  getHealthyCount(): { healthy: number; total: number } {
    const total = this.states.size;
    const healthy = this.getActivePlatforms().length;
    return { healthy, total };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private createInitialState(platform: PlatformId): PlatformState {
    return {
      id: platform,
      status: "stopped",
      errorCount: 0,
      messageCount: 0,
      reconnectAttempts: 0,
    };
  }

  private setupAdapterListeners(platform: PlatformId, adapter: IPlatformAdapter): void {
    adapter.on("connected", () => {
      const state = this.states.get(platform);
      if (state) {
        state.status = "connected";
        state.lastConnected = new Date();
        state.reconnectAttempts = 0;
      }
      this.emit("platform:connected", platform);
    });

    adapter.on("disconnected", () => {
      const state = this.states.get(platform);
      if (state && state.status !== "stopped") {
        state.status = "disconnected";
        this.emit("platform:disconnected", platform);
        this.scheduleRecovery(platform);
      }
    });

    adapter.on("error", (error: Error) => {
      const state = this.states.get(platform);
      if (state) {
        state.status = "error";
        state.lastError = error.message;
        state.errorCount++;
      }
      this.emit("platform:error", platform, error);
    });

    adapter.on("message", (message: unknown) => {
      const state = this.states.get(platform);
      if (state) {
        state.messageCount++;
        state.lastMessage = new Date();
      }
      this.emit("platform:message", platform, message);
    });
  }

  private scheduleRecovery(platform: PlatformId): void {
    // Cancel existing recovery timer
    this.cancelRecovery(platform);

    const state = this.states.get(platform);
    if (!state) return;

    const attempt = state.reconnectAttempts;
    const { maxAttempts, backoffMs } = this.config.recovery;

    if (attempt >= maxAttempts) {
      state.status = "error";
      this.emit("platform:failed", platform, `Max recovery attempts (${maxAttempts}) exceeded`);
      console.log(`[platform-manager] ${platform} failed after ${maxAttempts} recovery attempts`);
      return;
    }

    // Get backoff delay
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    state.status = "recovering";
    state.reconnectAttempts++;

    this.emit("platform:recovering", platform, state.reconnectAttempts);
    console.log(`[platform-manager] ${platform} recovery attempt ${state.reconnectAttempts} in ${delay / 1000}s`);

    const timer = setTimeout(async () => {
      this.recoveryTimers.delete(platform);

      try {
        const adapter = this.adapters.get(platform);
        if (adapter) {
          // Stop first to clean up
          await adapter.stop().catch(() => {});
          // Then try to start again
          await adapter.start();
        }
      } catch (error) {
        console.error(`[platform-manager] ${platform} recovery failed:`, error);
        // Schedule next recovery attempt
        this.scheduleRecovery(platform);
      }
    }, delay);

    this.recoveryTimers.set(platform, timer);
  }

  private cancelRecovery(platform: PlatformId): void {
    const timer = this.recoveryTimers.get(platform);
    if (timer) {
      clearTimeout(timer);
      this.recoveryTimers.delete(platform);
    }
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let managerInstance: PlatformManager | null = null;

export function getPlatformManager(config?: Partial<DaemonConfig>): PlatformManager {
  if (!managerInstance) {
    managerInstance = new PlatformManager(config);
  }
  return managerInstance;
}

export function resetPlatformManager(): void {
  if (managerInstance) {
    managerInstance.stopAll().catch(() => {});
    managerInstance = null;
  }
  resetAllAdapters();
}
