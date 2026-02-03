/**
 * Voice Daemon Configuration
 *
 * Loads and validates daemon configuration from YAML file.
 * Provides sensible defaults for all options.
 */

import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { parse as parseYAML } from "yaml";
import type { DaemonConfig, AudioConfig, VADConfig, STTConfig, DaemonMetaConfig } from "./types.js";

/**
 * Default audio configuration
 */
const DEFAULT_AUDIO: AudioConfig = {
  device: "default",
  sampleRate: 16000,
  channels: 1,
  chunkSize: 512, // ~32ms at 16kHz
};

/**
 * Default VAD configuration
 */
const DEFAULT_VAD: VADConfig = {
  backend: "silero",
  threshold: 0.5,
  minSpeechDurationMs: 250,
  minSilenceDurationMs: 1000,
  speechPadMs: 300,
};

/**
 * Default STT configuration
 */
const DEFAULT_STT: STTConfig = {
  backend: "whisper",
  model: "small",
  language: "en",
};

/**
 * Default daemon metadata
 */
const DEFAULT_DAEMON_META: DaemonMetaConfig = {
  logLevel: "info",
  maxSpeechDuration: 30, // seconds
};

/**
 * Default configuration file paths (in priority order)
 */
const CONFIG_PATHS = [
  join(process.cwd(), "daemon.yaml"),
  join(homedir(), ".config", "claude-voice", "daemon.yaml"),
];

/**
 * Complete default configuration
 */
export const DEFAULT_CONFIG: DaemonConfig = {
  audio: DEFAULT_AUDIO,
  vad: DEFAULT_VAD,
  stt: DEFAULT_STT,
  daemon: DEFAULT_DAEMON_META,
};

/**
 * Deep merge objects (simple implementation)
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === "object" &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === "object" &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[typeof key];
      } else {
        result[key] = source[key] as T[typeof key];
      }
    }
  }

  return result;
}

/**
 * Find the first existing config file
 */
function findConfigFile(): string | null {
  for (const path of CONFIG_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Validate configuration values
 */
function validateConfig(config: DaemonConfig): void {
  // Audio validation
  if (config.audio.sampleRate < 8000 || config.audio.sampleRate > 48000) {
    throw new Error(`Invalid sample rate: ${config.audio.sampleRate}. Must be 8000-48000.`);
  }
  if (config.audio.channels < 1 || config.audio.channels > 2) {
    throw new Error(`Invalid channels: ${config.audio.channels}. Must be 1 or 2.`);
  }
  if (config.audio.chunkSize < 128 || config.audio.chunkSize > 4096) {
    throw new Error(`Invalid chunk size: ${config.audio.chunkSize}. Must be 128-4096.`);
  }

  // VAD validation
  if (config.vad.threshold !== undefined && (config.vad.threshold < 0 || config.vad.threshold > 1)) {
    throw new Error(`Invalid VAD threshold: ${config.vad.threshold}. Must be 0-1.`);
  }

  // STT validation
  if (config.stt.backend !== "whisper") {
    throw new Error(`Invalid STT backend: ${config.stt.backend}. Only "whisper" is supported.`);
  }

  // Daemon validation
  if (config.daemon.maxSpeechDuration < 1 || config.daemon.maxSpeechDuration > 300) {
    throw new Error(`Invalid max speech duration: ${config.daemon.maxSpeechDuration}. Must be 1-300 seconds.`);
  }
}

/**
 * Load daemon configuration from file or defaults
 *
 * @param configPath Optional explicit path to config file
 * @returns Complete daemon configuration
 * @throws Error if config file is invalid or missing required fields
 */
export async function loadConfig(configPath?: string): Promise<DaemonConfig> {
  // Determine config file path
  const path = configPath || findConfigFile();

  if (!path) {
    console.log("[daemon:config] No config file found, using defaults");
    return DEFAULT_CONFIG;
  }

  console.log(`[daemon:config] Loading config from: ${path}`);

  try {
    // Read and parse YAML
    const content = await Bun.file(path).text();
    const parsed = parseYAML(content) as Partial<DaemonConfig>;

    // Merge with defaults
    const config: DaemonConfig = {
      audio: deepMerge(DEFAULT_AUDIO, parsed.audio || {}),
      vad: deepMerge(DEFAULT_VAD, parsed.vad || {}),
      stt: deepMerge(DEFAULT_STT, parsed.stt || {}),
      daemon: deepMerge(DEFAULT_DAEMON_META, parsed.daemon || {}),
    };

    // Validate
    validateConfig(config);

    return config;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid")) {
      throw error; // Re-throw validation errors
    }
    throw new Error(`Failed to load config from ${path}: ${error}`);
  }
}

/**
 * Create a sample configuration file content
 */
export function createSampleConfig(): string {
  return `# Voice Daemon Configuration
# Copy this file to ~/.config/claude-voice/daemon.yaml

audio:
  device: "default"          # Audio device name or "default"
  sample_rate: 16000         # Sample rate in Hz
  channels: 1                # Number of channels (1=mono)
  chunk_size: 512            # Samples per chunk (~32ms at 16kHz)

vad:
  backend: "silero"          # VAD backend (only "silero" supported)
  threshold: 0.5             # Speech probability threshold (0-1)
  min_speech_duration_ms: 250   # Minimum speech to trigger (ms)
  min_silence_duration_ms: 1000 # Silence before end of speech (ms)
  speech_pad_ms: 300         # Padding around speech (ms)

stt:
  backend: "whisper"         # STT backend (only "whisper" supported)
  model: "small"             # Model size: tiny, base, small, medium, large-v3
  language: "en"             # Language code or empty for auto-detect

daemon:
  log_level: "info"          # Logging: debug, info, warn, error
  max_speech_duration: 30    # Max speech duration in seconds
`;
}
