/**
 * Voice Queue Coordination
 *
 * Multi-agent voice coordination system.
 * Provides priority-based queuing for voice output from multiple Claude instances.
 */

// Types
export {
  VoicePriority,
  generateQueueId,
  type VoiceConfig,
  type QueueItem,
  type EnqueueRequest,
  type QueueStats,
  type InterruptionPolicy,
  type ClientMessage,
  type DaemonMessage,
  type QueueEvent,
  type ConnectionState,
} from "./types.js";

// Configuration
export { loadConfig, DEFAULT_CONFIG, type QueueConfig } from "./config.js";

// Queue Manager (for testing and direct use)
export { QueueManager } from "./queue-manager.js";

// Client (main API for hooks)
export { VoiceQueueClient, queuedSpeak } from "./client.js";

// Launcher (daemon management)
export {
  isDaemonRunning,
  startDaemon,
  stopDaemon,
  ensureDaemonRunning,
} from "./launcher.js";

// Daemon (for direct instantiation)
export { VoiceQueueDaemon } from "./daemon.js";

// IPC Server (for custom daemon implementations)
export { IPCServer } from "./ipc-server.js";
