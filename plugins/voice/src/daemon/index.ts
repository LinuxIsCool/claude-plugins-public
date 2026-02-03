/**
 * Voice Daemon Module
 *
 * Exports for the voice daemon and its components.
 */

export { VoiceDaemon, createDaemon } from "./daemon.js";
export { loadConfig, createSampleConfig, DEFAULT_CONFIG } from "./config.js";
export { AudioInputStream, createAudioInputStream } from "./audio-input.js";
export type {
  DaemonConfig,
  AudioConfig,
  VADConfig,
  STTConfig,
  DaemonMetaConfig,
  DaemonState,
  DaemonEvent,
} from "./types.js";
