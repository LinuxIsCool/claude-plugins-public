/**
 * Tmux Voice Control Adapter
 *
 * Provides voice-controlled tmux navigation.
 *
 * Usage:
 * ```typescript
 * import { createTmuxTranscriptHandler } from "./adapters/tmux";
 *
 * // Create handler for daemon integration
 * const handler = await createTmuxTranscriptHandler();
 *
 * // Register with daemon
 * daemon.registerHandler(handler);
 * ```
 */

import type { TTSPort } from "../../ports/tts.js";
import type { TranscriptHandler } from "../../daemon/types.js";
import { TmuxControlAdapter, createTmuxControl, type TmuxControlConfig } from "./control.js";
import { TmuxVoiceHandler, createTmuxHandler, type TmuxHandlerConfig } from "./handler.js";
import { getDefaultTTSFactory } from "../tts/index.js";

// Re-export types
export type { TmuxControlConfig } from "./control.js";
export type { TmuxHandlerConfig, HandlerResult } from "./handler.js";
export type {
  TmuxVoiceCommand,
  TmuxIntent,
  ParsedIntent,
  SlotType,
} from "./grammar.js";

// Re-export classes and functions
export { TmuxControlAdapter, createTmuxControl } from "./control.js";
export { TmuxVoiceHandler, createTmuxHandler } from "./handler.js";
export {
  parseIntent,
  matchPattern,
  convertSlotValue,
  getAllExamples,
  getCommandsForIntent,
  TMUX_COMMANDS,
  ORDINALS,
  DIRECTIONS,
  SPLIT_DIRECTIONS,
} from "./grammar.js";

/**
 * Configuration for the complete tmux transcript handler
 */
export interface TmuxTranscriptHandlerConfig {
  /** Tmux socket path (optional) */
  socketPath?: string;
  /** TTS adapter for voice feedback (optional, uses default if not provided) */
  tts?: TTSPort;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Enable voice feedback */
  enableFeedback?: boolean;
  /** TTS speech rate for feedback */
  feedbackSpeed?: number;
  /** TTS voice ID for feedback */
  feedbackVoiceId?: string;
}

/**
 * Create a complete tmux transcript handler for daemon integration
 *
 * This is the main factory function for creating a handler that can be
 * registered with the voice daemon.
 *
 * @param config Handler configuration
 * @returns TranscriptHandler for daemon registration
 */
export async function createTmuxTranscriptHandler(
  config: TmuxTranscriptHandlerConfig = {}
): Promise<TranscriptHandler> {
  // Create tmux adapter
  const tmux = createTmuxControl({
    socketPath: config.socketPath,
  });

  // Get TTS adapter (use provided or try to get default)
  let tts: TTSPort | null = config.tts ?? null;
  if (!tts && config.enableFeedback !== false) {
    try {
      const factory = getDefaultTTSFactory();
      tts = await factory.getAvailable();
    } catch {
      // No TTS available, continue without feedback
      console.warn("[tmux] No TTS available for feedback");
    }
  }

  // Create voice handler
  const handler = createTmuxHandler(tmux, tts, {
    minConfidence: config.minConfidence,
    enableFeedback: config.enableFeedback,
    feedbackSpeed: config.feedbackSpeed,
    feedbackVoiceId: config.feedbackVoiceId,
  });

  // Return transcript handler interface
  return {
    name: "tmux",

    async handle(text: string, confidence: number): Promise<boolean> {
      // Check if tmux is available
      if (!(await tmux.isAvailable())) {
        return false;
      }

      // Process the transcript
      const result = await handler.handleTranscript(text);
      return result.handled;
    },
  };
}

/**
 * Quick check if tmux is available on this system
 */
export async function isTmuxAvailable(): Promise<boolean> {
  const tmux = createTmuxControl();
  return tmux.isAvailable();
}
