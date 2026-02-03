/**
 * Voice Daemon Types
 *
 * Type definitions for the voice daemon configuration and state.
 */

import type { VADOptions } from "../ports/vad.js";
import type { STTOptions } from "../ports/stt.js";

/**
 * Audio capture configuration
 */
export interface AudioConfig {
  /** Audio device name or "default" */
  device: string;
  /** Sample rate in Hz. Default: 16000 */
  sampleRate: number;
  /** Number of channels. Default: 1 (mono) */
  channels: number;
  /** Chunk size in samples. Default: 512 (~32ms at 16kHz) */
  chunkSize: number;
}

/**
 * VAD-specific configuration extending the port options
 */
export interface VADConfig extends VADOptions {
  /** VAD backend to use. Default: "silero" */
  backend: "silero";
}

/**
 * STT-specific configuration extending the port options
 */
export interface STTConfig extends STTOptions {
  /** STT backend to use. Default: "whisper" */
  backend: "whisper";
  /** Whisper model size. Default: "small" */
  model?: "tiny" | "base" | "small" | "medium" | "large-v3" | "turbo";
}

/**
 * Daemon metadata configuration
 */
export interface DaemonMetaConfig {
  /** Logging level */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Maximum speech duration before timeout (seconds) */
  maxSpeechDuration: number;
}

/**
 * Complete daemon configuration
 */
export interface DaemonConfig {
  audio: AudioConfig;
  vad: VADConfig;
  stt: STTConfig;
  daemon: DaemonMetaConfig;
}

/**
 * Daemon state machine states
 */
export type DaemonState =
  | "initializing"
  | "listening"      // Waiting for speech (VAD monitoring)
  | "capturing"      // Speech detected, buffering audio
  | "transcribing"   // Processing captured audio
  | "error"
  | "shutdown";

/**
 * Daemon lifecycle events
 */
export type DaemonEvent =
  | { type: "state_change"; from: DaemonState; to: DaemonState }
  | { type: "speech_start"; timestampMs: number }
  | { type: "speech_end"; durationMs: number }
  | { type: "transcript"; text: string; confidence: number }
  | { type: "error"; error: Error }
  | { type: "shutdown" };

/**
 * Transcript handler interface
 *
 * Handlers are called when a transcript is received from STT.
 * Return true to indicate the transcript was handled (stops chain).
 */
export interface TranscriptHandler {
  /** Handler name for logging */
  name: string;

  /**
   * Handle a transcript
   *
   * @param text Transcribed text
   * @param confidence Confidence score (0-1)
   * @returns True if handled, false to continue to next handler
   */
  handle(text: string, confidence: number): Promise<boolean>;
}
