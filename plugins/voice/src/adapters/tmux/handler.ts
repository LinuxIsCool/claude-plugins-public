/**
 * Tmux Voice Handler
 *
 * Handles voice transcripts for tmux control.
 * Parses transcripts into intents and executes tmux commands.
 */

import type { TmuxControlPort, Direction, SplitDirection } from "../../ports/tmux.js";
import type { TTSPort, TTSOptions } from "../../ports/tts.js";
import { parseIntent, type ParsedIntent, type TmuxIntent } from "./grammar.js";

/**
 * Handler configuration
 */
export interface TmuxHandlerConfig {
  /** Minimum confidence threshold for executing commands */
  minConfidence?: number;
  /** TTS speech rate for feedback */
  feedbackSpeed?: number;
  /** Enable TTS feedback */
  enableFeedback?: boolean;
  /** TTS voice ID for feedback */
  feedbackVoiceId?: string;
}

/**
 * Default handler configuration
 */
const DEFAULT_CONFIG: Required<TmuxHandlerConfig> = {
  minConfidence: 0.6,
  feedbackSpeed: 1.2,
  enableFeedback: true,
  feedbackVoiceId: "",
};

/**
 * Handler result
 */
export interface HandlerResult {
  /** Whether the command was handled */
  handled: boolean;
  /** Intent that was matched */
  intent?: TmuxIntent;
  /** Feedback message spoken to user */
  feedback?: string;
  /** Error message if command failed */
  error?: string;
}

/**
 * TmuxVoiceHandler
 *
 * Processes voice transcripts and executes tmux commands.
 */
export class TmuxVoiceHandler {
  private config: Required<TmuxHandlerConfig>;

  constructor(
    private tmux: TmuxControlPort,
    private tts: TTSPort | null = null,
    config: TmuxHandlerConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle a voice transcript
   *
   * @param transcript Raw transcript text
   * @returns Handler result
   */
  async handleTranscript(transcript: string): Promise<HandlerResult> {
    // Parse intent from transcript
    const parsed = parseIntent(transcript);

    if (!parsed || parsed.confidence < this.config.minConfidence) {
      return { handled: false };
    }

    // Execute the intent
    return this.executeIntent(parsed);
  }

  /**
   * Execute a parsed intent
   */
  private async executeIntent(parsed: ParsedIntent): Promise<HandlerResult> {
    const { intent, slots } = parsed;

    try {
      switch (intent) {
        case "navigate_session": {
          const session = slots.session as string;
          const success = await this.tmux.selectSession(session);
          if (success) {
            await this.speak(`Session ${session}`);
            return { handled: true, intent, feedback: `Session ${session}` };
          }
          return { handled: false, intent, error: `Session "${session}" not found` };
        }

        case "navigate_window": {
          // Direct numbers use tmux's displayed index, ordinals are 1-based human counting
          // Ordinals need adjustment: "first window" = ordinal 1 → tmux index 0
          const directNum = slots.number as number | undefined;
          const ordinal = slots.ordinal as number | undefined;
          const windowIndex = directNum ?? (ordinal !== undefined ? ordinal - 1 : undefined);

          if (windowIndex !== undefined) {
            const success = await this.tmux.selectWindow(windowIndex);
            if (success) {
              const displayNum = ordinal ?? directNum;
              await this.speak(`Window ${displayNum}`);
              return { handled: true, intent, feedback: `Window ${displayNum}` };
            }
            return { handled: false, intent, error: `Window not found` };
          }
          return { handled: false, intent, error: "No window number specified" };
        }

        case "navigate_pane": {
          const direction = slots.direction as Direction;
          const success = await this.tmux.selectPaneDirection(direction);
          if (success) {
            await this.speak(direction);
            return { handled: true, intent, feedback: direction };
          }
          return { handled: false, intent, error: `No pane ${direction}` };
        }

        case "next_window": {
          const success = await this.tmux.nextWindow();
          if (success) {
            await this.speak("Next");
            return { handled: true, intent, feedback: "Next" };
          }
          return { handled: false, intent, error: "No next window" };
        }

        case "previous_window": {
          const success = await this.tmux.previousWindow();
          if (success) {
            await this.speak("Previous");
            return { handled: true, intent, feedback: "Previous" };
          }
          return { handled: false, intent, error: "No previous window" };
        }

        case "create_window": {
          const name = slots.name as string | undefined;
          const window = await this.tmux.newWindow(name);
          const feedback = name ? `Created window ${name}` : "New window";
          await this.speak(feedback);
          return { handled: true, intent, feedback };
        }

        case "create_pane": {
          const direction = (slots.split_direction ?? "horizontal") as SplitDirection;
          await this.tmux.newPane(direction);
          const feedback = `Split ${direction}`;
          await this.speak(feedback);
          return { handled: true, intent, feedback };
        }

        case "kill_pane": {
          const success = await this.tmux.killPane();
          if (success) {
            await this.speak("Pane closed");
            return { handled: true, intent, feedback: "Pane closed" };
          }
          return { handled: false, intent, error: "Cannot close pane" };
        }

        case "kill_window": {
          const success = await this.tmux.killWindow();
          if (success) {
            await this.speak("Window closed");
            return { handled: true, intent, feedback: "Window closed" };
          }
          return { handled: false, intent, error: "Cannot close window" };
        }

        case "zoom_pane": {
          const success = await this.tmux.zoomPane();
          if (success) {
            await this.speak("Zoomed");
            return { handled: true, intent, feedback: "Zoomed" };
          }
          return { handled: false, intent, error: "Cannot zoom pane" };
        }

        case "resize_pane": {
          const direction = slots.direction as Direction;
          const amount = (slots.amount as number) ?? 5;
          const success = await this.tmux.resizePane(direction, amount);
          if (success) {
            // No feedback for resize - visual is enough
            return { handled: true, intent };
          }
          return { handled: false, intent, error: "Cannot resize pane" };
        }

        case "list_sessions": {
          const sessions = await this.tmux.listSessions();
          if (sessions.length === 0) {
            await this.speak("No sessions");
            return { handled: true, intent, feedback: "No sessions" };
          }
          const names = sessions.map((s) => s.name).join(", ");
          const feedback = `Sessions: ${names}`;
          await this.speak(feedback);
          return { handled: true, intent, feedback };
        }

        case "list_windows": {
          const windows = await this.tmux.listWindows();
          if (windows.length === 0) {
            await this.speak("No windows");
            return { handled: true, intent, feedback: "No windows" };
          }
          const names = windows.map((w) => w.name).join(", ");
          const feedback = `Windows: ${names}`;
          await this.speak(feedback);
          return { handled: true, intent, feedback };
        }

        case "rotate_window": {
          const success = await this.tmux.rotateWindow();
          if (success) {
            await this.speak("Rotated");
            return { handled: true, intent, feedback: "Rotated" };
          }
          return { handled: false, intent, error: "Cannot rotate window" };
        }

        default:
          return { handled: false, error: `Unknown intent: ${intent}` };
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Command failed";
      console.error("[tmux-handler] Command failed:", err);
      await this.speak("Command failed");
      return { handled: false, intent, error };
    }
  }

  /**
   * Speak feedback to user
   */
  private async speak(text: string): Promise<void> {
    if (!this.config.enableFeedback || !this.tts) {
      return;
    }

    try {
      const options: TTSOptions = {
        voiceId: this.config.feedbackVoiceId,
        speed: this.config.feedbackSpeed,
      };

      const result = await this.tts.synthesize(text, options);
      await this.tts.play(result.audio);
    } catch {
      // Silent failure for feedback - don't interrupt workflow
    }
  }
}

/**
 * Create a TmuxVoiceHandler instance
 */
export function createTmuxHandler(
  tmux: TmuxControlPort,
  tts?: TTSPort | null,
  config?: TmuxHandlerConfig
): TmuxVoiceHandler {
  return new TmuxVoiceHandler(tmux, tts ?? null, config);
}
