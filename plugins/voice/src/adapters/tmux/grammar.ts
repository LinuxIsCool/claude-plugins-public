/**
 * Tmux Voice Command Grammar
 *
 * Defines voice command patterns for tmux control.
 * Patterns support slot extraction for parameterized commands.
 */

import type { Direction, SplitDirection } from "../../ports/tmux.js";

/**
 * Slot type for pattern extraction
 */
export interface SlotType {
  /** Slot data type */
  type: "number" | "string" | "direction" | "ordinal" | "split_direction";
  /** Whether the slot is required */
  required: boolean;
  /** Default value if not provided */
  default?: unknown;
}

/**
 * Tmux intent types
 */
export type TmuxIntent =
  | "navigate_session"
  | "navigate_window"
  | "navigate_pane"
  | "create_window"
  | "create_pane"
  | "kill_pane"
  | "kill_window"
  | "zoom_pane"
  | "resize_pane"
  | "next_window"
  | "previous_window"
  | "list_sessions"
  | "list_windows"
  | "rotate_window";

/**
 * Voice command definition
 */
export interface TmuxVoiceCommand {
  /** Recognition patterns with optional {slot} placeholders */
  patterns: string[];
  /** Mapped intent */
  intent: TmuxIntent;
  /** Named parameters extracted from patterns */
  slots?: Record<string, SlotType>;
  /** Example phrases for documentation/training */
  examples: string[];
}

/**
 * Parsed intent result
 */
export interface ParsedIntent {
  intent: TmuxIntent;
  slots: Record<string, unknown>;
  confidence: number;
  pattern: string;
}

/**
 * Ordinal to number mapping
 */
export const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
  "5th": 5,
  "6th": 6,
  "7th": 7,
  "8th": 8,
  "9th": 9,
  "10th": 10,
};

/**
 * Direction synonym mapping
 */
export const DIRECTIONS: Record<string, Direction> = {
  up: "up",
  top: "up",
  above: "up",
  upper: "up",
  down: "down",
  bottom: "down",
  below: "down",
  lower: "down",
  left: "left",
  right: "right",
};

/**
 * Split direction synonym mapping
 */
export const SPLIT_DIRECTIONS: Record<string, SplitDirection> = {
  horizontal: "horizontal",
  horizontally: "horizontal",
  side: "horizontal",
  vertical: "vertical",
  vertically: "vertical",
  below: "vertical",
  under: "vertical",
};

/**
 * Tmux voice commands
 */
export const TMUX_COMMANDS: TmuxVoiceCommand[] = [
  // Session Navigation
  {
    patterns: [
      "switch to session {session}",
      "go to session {session}",
      "session {session}",
      "open session {session}",
    ],
    intent: "navigate_session",
    slots: { session: { type: "string", required: true } },
    examples: ["switch to session main", "go to session dev", "session work"],
  },

  // Window Navigation by Number
  {
    patterns: [
      "window {number}",
      "go to window {number}",
      "switch to window {number}",
      "select window {number}",
      "open window {number}",
    ],
    intent: "navigate_window",
    slots: {
      number: { type: "number", required: true },
    },
    examples: ["window 3", "go to window 1", "switch to window 2"],
  },

  // Window Navigation by Ordinal
  {
    patterns: [
      "{ordinal} window",
      "the {ordinal} window",
      "go to the {ordinal} window",
    ],
    intent: "navigate_window",
    slots: {
      ordinal: { type: "ordinal", required: true },
    },
    examples: ["first window", "second window", "the third window"],
  },

  // Next/Previous Window
  {
    patterns: ["next window", "next", "forward", "go forward"],
    intent: "next_window",
    examples: ["next window", "next", "forward"],
  },
  {
    patterns: [
      "previous window",
      "previous",
      "back",
      "go back",
      "last window",
      "prior window",
    ],
    intent: "previous_window",
    examples: ["previous window", "back", "last window"],
  },

  // Pane Navigation by Direction
  {
    patterns: [
      "pane {direction}",
      "go {direction}",
      "{direction} pane",
      "focus {direction}",
      "move {direction}",
      "switch {direction}",
    ],
    intent: "navigate_pane",
    slots: { direction: { type: "direction", required: true } },
    examples: ["pane left", "go right", "up pane", "focus down", "move left"],
  },

  // Create Window
  {
    patterns: [
      "new window",
      "create window",
      "add window",
      "open new window",
      "new window {name}",
      "create window {name}",
    ],
    intent: "create_window",
    slots: { name: { type: "string", required: false } },
    examples: ["new window", "create window logs", "add window tests"],
  },

  // Create Pane (Split)
  {
    patterns: [
      "split {split_direction}",
      "new pane {split_direction}",
      "{split_direction} split",
      "split pane {split_direction}",
      "split window {split_direction}",
    ],
    intent: "create_pane",
    slots: {
      split_direction: { type: "split_direction", required: true, default: "horizontal" },
    },
    examples: ["split horizontal", "split vertical", "new pane vertical"],
  },

  // Simple split commands
  {
    patterns: ["split", "new pane", "add pane"],
    intent: "create_pane",
    slots: {
      split_direction: { type: "split_direction", required: false, default: "horizontal" },
    },
    examples: ["split", "new pane"],
  },

  // Kill Pane
  {
    patterns: [
      "close pane",
      "kill pane",
      "close this pane",
      "close current pane",
      "remove pane",
      "delete pane",
    ],
    intent: "kill_pane",
    examples: ["close pane", "kill pane"],
  },

  // Kill Window
  {
    patterns: [
      "close window",
      "kill window",
      "close this window",
      "close current window",
      "remove window",
      "delete window",
    ],
    intent: "kill_window",
    examples: ["close window", "kill window"],
  },

  // Zoom
  {
    patterns: [
      "zoom",
      "zoom pane",
      "maximize",
      "fullscreen",
      "toggle zoom",
      "full screen",
      "maximize pane",
      "unzoom",
    ],
    intent: "zoom_pane",
    examples: ["zoom", "maximize", "fullscreen", "toggle zoom"],
  },

  // Resize
  {
    patterns: [
      "resize {direction}",
      "grow {direction}",
      "shrink {direction}",
      "make {direction} bigger",
      "make {direction} smaller",
      "expand {direction}",
    ],
    intent: "resize_pane",
    slots: {
      direction: { type: "direction", required: true },
      amount: { type: "number", required: false, default: 5 },
    },
    examples: ["resize up", "grow right", "shrink left", "expand down"],
  },

  // List/Info
  {
    patterns: [
      "list sessions",
      "show sessions",
      "what sessions",
      "sessions",
      "all sessions",
    ],
    intent: "list_sessions",
    examples: ["list sessions", "show sessions"],
  },
  {
    patterns: [
      "list windows",
      "show windows",
      "what windows",
      "windows",
      "all windows",
    ],
    intent: "list_windows",
    examples: ["list windows", "show windows"],
  },

  // Rotate
  {
    patterns: [
      "rotate",
      "rotate window",
      "rotate layout",
      "rotate panes",
      "swap panes",
    ],
    intent: "rotate_window",
    examples: ["rotate", "rotate window", "rotate layout"],
  },
];

/**
 * Convert slot value to appropriate type
 */
export function convertSlotValue(
  value: string,
  type?: SlotType["type"]
): unknown {
  const normalized = value.toLowerCase().trim();

  switch (type) {
    case "number": {
      const num = parseInt(normalized, 10);
      return isNaN(num) ? ORDINALS[normalized] ?? null : num;
    }
    case "ordinal": {
      const ordinal = ORDINALS[normalized];
      if (ordinal !== undefined) return ordinal;
      const num = parseInt(normalized, 10);
      return isNaN(num) ? null : num;
    }
    case "direction":
      return DIRECTIONS[normalized] ?? null;
    case "split_direction":
      return SPLIT_DIRECTIONS[normalized] ?? null;
    default:
      return value;
  }
}

/**
 * Match a pattern against input text
 *
 * @param input Normalized input text
 * @param pattern Pattern with {slot} placeholders
 * @param slotDefs Slot definitions
 * @returns Match result or null
 */
export function matchPattern(
  input: string,
  pattern: string,
  slotDefs?: Record<string, SlotType>
): { slots: Record<string, unknown>; confidence: number } | null {
  // Convert pattern to regex
  // {slot} becomes a capturing group with type-appropriate matching:
  // - "string" type uses .+ for multi-word capture (session names, window names)
  // - Other types use \S+ for single-word capture (numbers, directions)
  let regexStr = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, (char) =>
      char === "{" || char === "}" ? char : `\\${char}`
    )
    .replace(/\{(\w+)\}/g, (_, name) => {
      const slotType = slotDefs?.[name]?.type;
      // Use greedy match for string slots (multi-word names), single-word for others
      return slotType === "string" ? `(?<${name}>.+)` : `(?<${name}>\\S+)`;
    })
    .replace(/\s+/g, "\\s+");

  const regex = new RegExp(`^${regexStr}$`, "i");
  const match = input.match(regex);

  if (!match) return null;

  const slots: Record<string, unknown> = {};

  // Extract and convert slots
  if (match.groups && slotDefs) {
    for (const [name, value] of Object.entries(match.groups)) {
      if (value) {
        const def = slotDefs[name];
        const converted = convertSlotValue(value, def?.type);
        if (converted === null && def?.required) {
          // Required slot with invalid value
          return null;
        }
        slots[name] = converted ?? def?.default;
      }
    }
  }

  // Apply defaults for missing slots
  if (slotDefs) {
    for (const [name, def] of Object.entries(slotDefs)) {
      if (!(name in slots) && def.default !== undefined) {
        slots[name] = def.default;
      }
    }
  }

  return { slots, confidence: 0.9 };
}

/**
 * Parse transcript into intent
 *
 * @param transcript Raw transcript text
 * @returns Parsed intent or null
 */
export function parseIntent(transcript: string): ParsedIntent | null {
  const normalized = transcript.toLowerCase().trim();

  for (const cmd of TMUX_COMMANDS) {
    for (const pattern of cmd.patterns) {
      const match = matchPattern(normalized, pattern, cmd.slots);
      if (match) {
        return {
          intent: cmd.intent,
          slots: match.slots,
          confidence: match.confidence,
          pattern,
        };
      }
    }
  }

  return null;
}

/**
 * Get all example phrases for documentation
 */
export function getAllExamples(): string[] {
  return TMUX_COMMANDS.flatMap((cmd) => cmd.examples);
}

/**
 * Get commands for a specific intent
 */
export function getCommandsForIntent(intent: TmuxIntent): TmuxVoiceCommand[] {
  return TMUX_COMMANDS.filter((cmd) => cmd.intent === intent);
}
