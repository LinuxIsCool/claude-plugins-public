/**
 * Daemon Types
 *
 * Type definitions for the messages sync daemon.
 * Designed for platform isolation, health monitoring, and graceful degradation.
 */

import type { EventEmitter } from "events";

// =============================================================================
// Platform Identification
// =============================================================================

/**
 * Supported messaging platforms
 */
export type PlatformId = "signal" | "whatsapp" | "discord" | "telegram" | "gmail";

/**
 * Platform priority order for startup sequence
 * Higher priority = start first, most reliable
 */
export const PLATFORM_PRIORITY: readonly PlatformId[] = [
  "signal",
  "whatsapp",
  "discord",
  "telegram",
  "gmail",
] as const;

// =============================================================================
// Status Types
// =============================================================================

/**
 * Individual platform lifecycle states
 */
export type PlatformStatus =
  | "stopped" // Not running
  | "starting" // Initializing connection
  | "connected" // Active and healthy
  | "disconnected" // Lost connection, will retry
  | "error" // Failed, needs intervention
  | "recovering"; // Attempting recovery

/**
 * Daemon-level states
 */
export type DaemonStatus =
  | "stopped" // Not running
  | "starting" // Initializing
  | "running" // Healthy operation
  | "stopping" // Graceful shutdown
  | "degraded"; // Some platforms failed

// =============================================================================
// State Interfaces
// =============================================================================

/**
 * Per-platform runtime state
 */
export interface PlatformState {
  id: PlatformId;
  status: PlatformStatus;
  lastConnected?: Date;
  lastMessage?: Date;
  lastError?: string;
  errorCount: number;
  messageCount: number;
  reconnectAttempts: number;
}

/**
 * Aggregate daemon state
 */
export interface DaemonState {
  status: DaemonStatus;
  pid: number;
  startedAt?: Date;
  platforms: Record<PlatformId, PlatformState>;
  healthyPlatforms: number;
  totalPlatforms: number;
  uptime: number; // seconds
}

/**
 * Serializable state for persistence
 */
export interface PersistedPlatformState {
  platform: PlatformId;
  status: PlatformStatus;
  last_connected: number | null;
  last_message: number | null;
  last_error: string | null;
  error_count: number;
  message_count: number;
  updated_at: number;
}

// =============================================================================
// Health Monitoring
// =============================================================================

/**
 * Health check result for a single platform
 */
export interface HealthCheck {
  platform: PlatformId;
  healthy: boolean;
  connected: boolean;
  latencyMs?: number;
  lastActivity?: Date;
  issues: string[];
  checkedAt: Date;
}

/**
 * Aggregate health report
 */
export interface HealthReport {
  overall: "healthy" | "degraded" | "unhealthy";
  platforms: HealthCheck[];
  checkedAt: Date;
}

/**
 * Health monitor configuration
 */
export interface HealthConfig {
  checkIntervalMs: number; // How often to check (default: 60000)
  staleThresholdMs: number; // When to consider activity stale (default: 300000)
  maxErrorsBeforeUnhealthy: number; // Error threshold (default: 3)
  errorWindowMs: number; // Window for counting errors (default: 300000)
}

export const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  checkIntervalMs: 60_000, // 1 minute
  staleThresholdMs: 300_000, // 5 minutes
  maxErrorsBeforeUnhealthy: 3,
  errorWindowMs: 300_000, // 5 minutes
};

// =============================================================================
// IPC Protocol
// =============================================================================

/**
 * Commands the CLI can send to the daemon
 */
export type IpcCommandType =
  | "status"
  | "health"
  | "start"
  | "stop"
  | "restart"
  | "restart-platform";

export interface IpcCommand {
  type: IpcCommandType;
  platform?: PlatformId;
}

export interface IpcResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Status response structure
 */
export interface StatusResponse {
  daemon: {
    status: DaemonStatus;
    pid: number;
    uptime: number;
    startedAt: string;
  };
  platforms: {
    id: PlatformId;
    status: PlatformStatus;
    messageCount: number;
    lastMessage?: string;
    lastError?: string;
  }[];
  summary: {
    healthy: number;
    total: number;
  };
}

// =============================================================================
// Notifications
// =============================================================================

export type NotificationLevel = "info" | "warning" | "error";

export interface NotificationPayload {
  level: NotificationLevel;
  title: string;
  body: string;
  platform?: PlatformId;
  timestamp: Date;
}

// =============================================================================
// Adapter Interface
// =============================================================================

/**
 * Statistics from a platform adapter
 */
export interface PlatformStats {
  messageCount: number;
  errorCount: number;
  lastMessage?: Date;
  lastError?: Date;
  isConnected: boolean;
}

/**
 * Events emitted by platform adapters
 */
export interface AdapterEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  message: (message: unknown) => void;
}

/**
 * Platform adapter interface
 * Wraps existing sync services with a consistent API
 */
export interface IPlatformAdapter extends EventEmitter {
  readonly platform: PlatformId;

  isAuthenticated(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isConnected(): boolean;
  getStats(): PlatformStats;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  socketPath: string;
  dbPath: string;
  logPath: string;
  pidPath: string;
  health: HealthConfig;
  notifications: {
    desktop: boolean;
    file: boolean;
  };
  recovery: {
    maxAttempts: number;
    backoffMs: number[];
  };
}

export const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  socketPath: "/tmp/messages-daemon.sock",
  dbPath: "", // Set at runtime via getClaudePath
  logPath: "", // Set at runtime via getClaudePath
  pidPath: "/tmp/messages-daemon.pid",
  health: DEFAULT_HEALTH_CONFIG,
  notifications: {
    desktop: true,
    file: true,
  },
  recovery: {
    maxAttempts: 5,
    backoffMs: [10_000, 30_000, 60_000, 120_000, 300_000],
  },
};
