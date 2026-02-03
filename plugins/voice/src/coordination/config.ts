/**
 * Voice Queue Daemon Configuration
 *
 * Configuration for the multi-agent voice queue system.
 */

import type { VoicePriority, InterruptionPolicy } from "./types.js";

/**
 * Queue daemon configuration
 */
export interface QueueConfig {
  // Queue limits
  maxQueueSize: number;
  maxWaitTimeMs: number;

  // Priority and interruption
  interruptThreshold: VoicePriority;
  interruptionPolicy: InterruptionPolicy;

  // Timing
  speakerTransitionMs: number;
  playbackTimeoutMs: number;

  // IPC
  socketPath: string;
  pidFile: string;
  logFile: string;

  // Client
  connectTimeoutMs: number;
  daemonStartTimeoutMs: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: QueueConfig = {
  // Queue limits
  maxQueueSize: 50,
  maxWaitTimeMs: 30000, // 30 seconds

  // Priority and interruption
  interruptThreshold: 80, // HIGH and above can interrupt
  interruptionPolicy: "requeue_front",

  // Timing
  speakerTransitionMs: 300, // 300ms pause between different speakers
  playbackTimeoutMs: 60000, // 60 seconds max playback time

  // IPC
  socketPath: "/tmp/claude-voice.sock",
  pidFile: "/tmp/claude-voice-daemon.pid",
  logFile: "/tmp/claude-voice-daemon.log",

  // Client
  connectTimeoutMs: 1000, // 1 second to connect
  daemonStartTimeoutMs: 5000, // 5 seconds to start daemon
};

/**
 * Load configuration from environment or use defaults
 */
export function loadConfig(overrides: Partial<QueueConfig> = {}): QueueConfig {
  const config = { ...DEFAULT_CONFIG };

  // Environment overrides
  if (process.env.VOICE_QUEUE_MAX_SIZE) {
    config.maxQueueSize = parseInt(process.env.VOICE_QUEUE_MAX_SIZE, 10);
  }
  if (process.env.VOICE_QUEUE_MAX_WAIT_MS) {
    config.maxWaitTimeMs = parseInt(process.env.VOICE_QUEUE_MAX_WAIT_MS, 10);
  }
  if (process.env.VOICE_QUEUE_SOCKET_PATH) {
    config.socketPath = process.env.VOICE_QUEUE_SOCKET_PATH;
  }
  if (process.env.VOICE_QUEUE_INTERRUPTION_POLICY) {
    config.interruptionPolicy = process.env
      .VOICE_QUEUE_INTERRUPTION_POLICY as InterruptionPolicy;
  }
  if (process.env.VOICE_QUEUE_SPEAKER_TRANSITION_MS) {
    config.speakerTransitionMs = parseInt(
      process.env.VOICE_QUEUE_SPEAKER_TRANSITION_MS,
      10
    );
  }

  // Apply explicit overrides
  return { ...config, ...overrides };
}
