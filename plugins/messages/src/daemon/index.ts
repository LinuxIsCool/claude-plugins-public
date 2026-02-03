/**
 * Messages Daemon
 *
 * Always-on messaging sync daemon that manages all platforms.
 *
 * Usage:
 *   import { MessagesDaemon, getIpcClient } from "./daemon";
 *
 *   // Start daemon directly
 *   const daemon = new MessagesDaemon();
 *   await daemon.start();
 *
 *   // Or control via IPC client
 *   const client = getIpcClient();
 *   const status = await client.status();
 */

// Main daemon
export { MessagesDaemon } from "./daemon";

// IPC for CLI
export { IpcClient, getIpcClient, resetIpcClient } from "./ipc-client";
export { IpcServer, getIpcServer, resetIpcServer, DEFAULT_SOCKET_PATH } from "./ipc-server";

// Core components
export { Orchestrator, getOrchestrator, resetOrchestrator } from "./orchestrator";
export { PlatformManager, getPlatformManager, resetPlatformManager } from "./platform-manager";
export { HealthMonitor, getHealthMonitor, resetHealthMonitor } from "./health-monitor";
export { NotificationDispatcher, getNotificationDispatcher } from "./notification-dispatcher";
export { StateManager, getStateManager, getDaemonDbPath, getDaemonLogPath } from "./state-manager";

// Adapters
export * from "./adapters";

// Types
export * from "./types";
