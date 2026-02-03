# Spec: Tmux Voice Control

**Component**: Voice-Driven Terminal Navigation
**Priority**: Medium
**Estimated Effort**: 3-4 hours
**Dependencies**: Voice Daemon (04), Whisper STT (05), tmux

---

## Overview

Implement voice-controlled tmux navigation allowing hands-free control of terminal sessions, windows, and panes. This enables developers to switch contexts, create splits, and navigate their terminal environment using natural voice commands.

## Goals

1. Navigate tmux sessions, windows, and panes by voice
2. Create/destroy windows and panes
3. Execute common tmux commands
4. Support natural language variations
5. Provide audio feedback for actions

## Non-Goals

- Voice-based text input/dictation (separate feature)
- Complex tmux scripting via voice
- Mouse position control
- Custom tmux configurations

---

## Interface Design

### TypeScript Interface

```typescript
// plugins/voice/src/adapters/tmux/control.ts

export interface TmuxControlPort {
  // Connection
  isAvailable(): Promise<boolean>;
  getCurrentSession(): Promise<TmuxSession | null>;

  // Navigation
  selectSession(target: string): Promise<boolean>;
  selectWindow(target: string | number): Promise<boolean>;
  selectPane(target: string | number): Promise<boolean>;

  // Creation/Destruction
  newWindow(name?: string): Promise<TmuxWindow>;
  newPane(direction: "horizontal" | "vertical"): Promise<TmuxPane>;
  killPane(target?: string): Promise<boolean>;
  killWindow(target?: string): Promise<boolean>;

  // Layout
  resizePane(direction: Direction, amount: number): Promise<boolean>;
  zoomPane(): Promise<boolean>;
  rotateWindow(): Promise<boolean>;

  // Commands
  sendKeys(keys: string): Promise<boolean>;
  runCommand(command: string): Promise<string>;
}

export interface TmuxSession {
  id: string;
  name: string;
  windows: TmuxWindow[];
  attached: boolean;
  created: Date;
}

export interface TmuxWindow {
  id: string;
  index: number;
  name: string;
  panes: TmuxPane[];
  active: boolean;
  layout: string;
}

export interface TmuxPane {
  id: string;
  index: number;
  active: boolean;
  width: number;
  height: number;
  currentPath: string;
  currentCommand?: string;
}

type Direction = "up" | "down" | "left" | "right";
```

### Voice Command Interface

```typescript
// plugins/voice/src/voice/tmux-commands.ts

export interface TmuxVoiceCommand {
  patterns: string[];           // Recognition patterns
  intent: TmuxIntent;           // Mapped intent
  slots?: Record<string, SlotType>;  // Named parameters
  examples: string[];           // Training examples
}

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
  | "list_windows";

export interface SlotType {
  type: "number" | "string" | "direction" | "ordinal";
  required: boolean;
  default?: any;
}
```

---

## Implementation Guide

### Voice Command Grammar

```typescript
// plugins/voice/src/voice/tmux-grammar.ts

export const TMUX_COMMANDS: TmuxVoiceCommand[] = [
  // Session Navigation
  {
    patterns: [
      "switch to session {session}",
      "go to session {session}",
      "session {session}",
    ],
    intent: "navigate_session",
    slots: { session: { type: "string", required: true } },
    examples: [
      "switch to session main",
      "go to session dev",
      "session work",
    ],
  },

  // Window Navigation
  {
    patterns: [
      "window {number}",
      "go to window {number}",
      "switch to window {number}",
      "{ordinal} window",
    ],
    intent: "navigate_window",
    slots: {
      number: { type: "number", required: false },
      ordinal: { type: "ordinal", required: false },
    },
    examples: [
      "window 3",
      "go to window 1",
      "first window",
      "second window",
    ],
  },

  // Next/Previous Window
  {
    patterns: [
      "next window",
      "next",
      "forward",
    ],
    intent: "next_window",
    examples: ["next window", "next"],
  },
  {
    patterns: [
      "previous window",
      "previous",
      "back",
      "last window",
    ],
    intent: "previous_window",
    examples: ["previous window", "back"],
  },

  // Pane Navigation
  {
    patterns: [
      "pane {direction}",
      "go {direction}",
      "{direction} pane",
      "focus {direction}",
    ],
    intent: "navigate_pane",
    slots: { direction: { type: "direction", required: true } },
    examples: [
      "pane left",
      "go right",
      "up pane",
      "focus down",
    ],
  },

  // Create Window
  {
    patterns: [
      "new window",
      "create window",
      "add window",
      "new window {name}",
    ],
    intent: "create_window",
    slots: { name: { type: "string", required: false } },
    examples: [
      "new window",
      "create window logs",
      "add window tests",
    ],
  },

  // Create Pane (Split)
  {
    patterns: [
      "split {direction}",
      "new pane {direction}",
      "split horizontal",
      "split vertical",
      "horizontal split",
      "vertical split",
    ],
    intent: "create_pane",
    slots: { direction: { type: "string", required: true, default: "horizontal" } },
    examples: [
      "split horizontal",
      "split vertical",
      "new pane right",
    ],
  },

  // Kill/Close
  {
    patterns: [
      "close pane",
      "kill pane",
      "close this pane",
    ],
    intent: "kill_pane",
    examples: ["close pane", "kill pane"],
  },
  {
    patterns: [
      "close window",
      "kill window",
      "close this window",
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
    ],
    intent: "zoom_pane",
    examples: ["zoom", "maximize", "fullscreen"],
  },

  // Resize
  {
    patterns: [
      "resize {direction}",
      "grow {direction}",
      "shrink {direction}",
      "make {direction} bigger",
      "make {direction} smaller",
    ],
    intent: "resize_pane",
    slots: {
      direction: { type: "direction", required: true },
      amount: { type: "number", required: false, default: 5 },
    },
    examples: [
      "resize up",
      "grow right",
      "shrink left",
    ],
  },

  // List/Info
  {
    patterns: [
      "list sessions",
      "show sessions",
      "what sessions",
    ],
    intent: "list_sessions",
    examples: ["list sessions", "show sessions"],
  },
  {
    patterns: [
      "list windows",
      "show windows",
      "what windows",
    ],
    intent: "list_windows",
    examples: ["list windows", "show windows"],
  },
];

// Ordinal mapping
export const ORDINALS: Record<string, number> = {
  "first": 1,
  "second": 2,
  "third": 3,
  "fourth": 4,
  "fifth": 5,
  "sixth": 6,
  "seventh": 7,
  "eighth": 8,
  "ninth": 9,
  "tenth": 10,
};

// Direction normalization
export const DIRECTIONS: Record<string, Direction> = {
  "up": "up",
  "top": "up",
  "above": "up",
  "down": "down",
  "bottom": "down",
  "below": "down",
  "left": "left",
  "right": "right",
};
```

### Tmux Control Adapter

```typescript
// plugins/voice/src/adapters/tmux/control.ts

import { spawn, execSync } from "child_process";
import type {
  TmuxControlPort,
  TmuxSession,
  TmuxWindow,
  TmuxPane,
  Direction
} from "./types.js";

export class TmuxControlAdapter implements TmuxControlPort {
  private socketPath?: string;

  constructor(socketPath?: string) {
    this.socketPath = socketPath;
  }

  private tmux(args: string[]): string {
    const fullArgs = this.socketPath
      ? ["-S", this.socketPath, ...args]
      : args;

    try {
      return execSync(`tmux ${fullArgs.join(" ")}`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
    } catch (err: any) {
      if (err.status === 1) {
        return ""; // No results
      }
      throw err;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync("tmux -V", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentSession(): Promise<TmuxSession | null> {
    try {
      const output = this.tmux([
        "display-message",
        "-p",
        "#{session_id}:#{session_name}:#{session_attached}:#{session_created}"
      ]);

      if (!output) return null;

      const [id, name, attached, created] = output.split(":");

      return {
        id,
        name,
        attached: attached === "1",
        created: new Date(parseInt(created) * 1000),
        windows: await this.getWindows(),
      };
    } catch {
      return null;
    }
  }

  private async getWindows(): Promise<TmuxWindow[]> {
    const output = this.tmux([
      "list-windows",
      "-F",
      "#{window_id}:#{window_index}:#{window_name}:#{window_active}:#{window_layout}"
    ]);

    if (!output) return [];

    const windows: TmuxWindow[] = [];

    for (const line of output.split("\n")) {
      const [id, index, name, active, layout] = line.split(":");
      windows.push({
        id,
        index: parseInt(index),
        name,
        active: active === "1",
        layout,
        panes: await this.getPanes(id),
      });
    }

    return windows;
  }

  private async getPanes(windowId?: string): Promise<TmuxPane[]> {
    const target = windowId ? ["-t", windowId] : [];
    const output = this.tmux([
      "list-panes",
      ...target,
      "-F",
      "#{pane_id}:#{pane_index}:#{pane_active}:#{pane_width}:#{pane_height}:#{pane_current_path}:#{pane_current_command}"
    ]);

    if (!output) return [];

    return output.split("\n").map(line => {
      const [id, index, active, width, height, path, command] = line.split(":");
      return {
        id,
        index: parseInt(index),
        active: active === "1",
        width: parseInt(width),
        height: parseInt(height),
        currentPath: path,
        currentCommand: command || undefined,
      };
    });
  }

  async selectSession(target: string): Promise<boolean> {
    try {
      this.tmux(["switch-client", "-t", target]);
      return true;
    } catch {
      return false;
    }
  }

  async selectWindow(target: string | number): Promise<boolean> {
    try {
      this.tmux(["select-window", "-t", target.toString()]);
      return true;
    } catch {
      return false;
    }
  }

  async selectPane(target: string | number): Promise<boolean> {
    try {
      this.tmux(["select-pane", "-t", target.toString()]);
      return true;
    } catch {
      return false;
    }
  }

  async selectPaneDirection(direction: Direction): Promise<boolean> {
    const flag = {
      up: "-U",
      down: "-D",
      left: "-L",
      right: "-R",
    }[direction];

    try {
      this.tmux(["select-pane", flag]);
      return true;
    } catch {
      return false;
    }
  }

  async newWindow(name?: string): Promise<TmuxWindow> {
    const args = ["new-window"];
    if (name) args.push("-n", name);
    args.push("-P", "-F", "#{window_id}:#{window_index}:#{window_name}");

    const output = this.tmux(args);
    const [id, index, windowName] = output.split(":");

    return {
      id,
      index: parseInt(index),
      name: windowName,
      active: true,
      layout: "",
      panes: [],
    };
  }

  async newPane(direction: "horizontal" | "vertical"): Promise<TmuxPane> {
    const flag = direction === "horizontal" ? "-h" : "-v";

    const output = this.tmux([
      "split-window",
      flag,
      "-P",
      "-F",
      "#{pane_id}:#{pane_index}:#{pane_width}:#{pane_height}:#{pane_current_path}"
    ]);

    const [id, index, width, height, path] = output.split(":");

    return {
      id,
      index: parseInt(index),
      active: true,
      width: parseInt(width),
      height: parseInt(height),
      currentPath: path,
    };
  }

  async killPane(target?: string): Promise<boolean> {
    try {
      const args = ["kill-pane"];
      if (target) args.push("-t", target);
      this.tmux(args);
      return true;
    } catch {
      return false;
    }
  }

  async killWindow(target?: string): Promise<boolean> {
    try {
      const args = ["kill-window"];
      if (target) args.push("-t", target);
      this.tmux(args);
      return true;
    } catch {
      return false;
    }
  }

  async resizePane(direction: Direction, amount: number): Promise<boolean> {
    const flag = {
      up: "-U",
      down: "-D",
      left: "-L",
      right: "-R",
    }[direction];

    try {
      this.tmux(["resize-pane", flag, amount.toString()]);
      return true;
    } catch {
      return false;
    }
  }

  async zoomPane(): Promise<boolean> {
    try {
      this.tmux(["resize-pane", "-Z"]);
      return true;
    } catch {
      return false;
    }
  }

  async rotateWindow(): Promise<boolean> {
    try {
      this.tmux(["rotate-window"]);
      return true;
    } catch {
      return false;
    }
  }

  async nextWindow(): Promise<boolean> {
    try {
      this.tmux(["next-window"]);
      return true;
    } catch {
      return false;
    }
  }

  async previousWindow(): Promise<boolean> {
    try {
      this.tmux(["previous-window"]);
      return true;
    } catch {
      return false;
    }
  }

  async sendKeys(keys: string): Promise<boolean> {
    try {
      this.tmux(["send-keys", keys]);
      return true;
    } catch {
      return false;
    }
  }

  async runCommand(command: string): Promise<string> {
    return this.tmux(command.split(" "));
  }

  async listSessions(): Promise<TmuxSession[]> {
    const output = this.tmux([
      "list-sessions",
      "-F",
      "#{session_id}:#{session_name}:#{session_attached}:#{session_created}"
    ]);

    if (!output) return [];

    return output.split("\n").map(line => {
      const [id, name, attached, created] = line.split(":");
      return {
        id,
        name,
        attached: attached === "1",
        created: new Date(parseInt(created) * 1000),
        windows: [], // Lazy load
      };
    });
  }
}

export function createTmuxControl(socketPath?: string): TmuxControlAdapter {
  return new TmuxControlAdapter(socketPath);
}
```

### Intent Handler

```typescript
// plugins/voice/src/voice/tmux-handler.ts

import type { TmuxIntent, TmuxVoiceCommand } from "./tmux-grammar.js";
import type { TmuxControlAdapter } from "../adapters/tmux/control.js";
import type { TTSPort } from "../ports/tts.js";
import { TMUX_COMMANDS, ORDINALS, DIRECTIONS } from "./tmux-grammar.js";

interface ParsedIntent {
  intent: TmuxIntent;
  slots: Record<string, any>;
  confidence: number;
}

export class TmuxVoiceHandler {
  constructor(
    private tmux: TmuxControlAdapter,
    private tts: TTSPort,
  ) {}

  async handleTranscript(transcript: string): Promise<boolean> {
    const parsed = this.parseIntent(transcript);

    if (!parsed || parsed.confidence < 0.6) {
      return false;
    }

    return this.executeIntent(parsed);
  }

  private parseIntent(transcript: string): ParsedIntent | null {
    const normalized = transcript.toLowerCase().trim();

    for (const cmd of TMUX_COMMANDS) {
      for (const pattern of cmd.patterns) {
        const match = this.matchPattern(normalized, pattern, cmd.slots);
        if (match) {
          return {
            intent: cmd.intent,
            slots: match.slots,
            confidence: match.confidence,
          };
        }
      }
    }

    return null;
  }

  private matchPattern(
    input: string,
    pattern: string,
    slotDefs?: Record<string, any>
  ): { slots: Record<string, any>; confidence: number } | null {
    // Convert pattern to regex
    let regexStr = pattern
      .replace(/\{(\w+)\}/g, (_, name) => `(?<${name}>\\w+)`)
      .replace(/\s+/g, "\\s+");

    const regex = new RegExp(`^${regexStr}$`, "i");
    const match = input.match(regex);

    if (!match) return null;

    const slots: Record<string, any> = {};

    // Extract and convert slots
    if (match.groups && slotDefs) {
      for (const [name, value] of Object.entries(match.groups)) {
        if (value) {
          const def = slotDefs[name];
          slots[name] = this.convertSlotValue(value, def?.type);
        }
      }
    }

    return { slots, confidence: 0.9 };
  }

  private convertSlotValue(value: string, type?: string): any {
    switch (type) {
      case "number":
        return parseInt(value, 10);
      case "ordinal":
        return ORDINALS[value.toLowerCase()] ?? parseInt(value, 10);
      case "direction":
        return DIRECTIONS[value.toLowerCase()] ?? value;
      default:
        return value;
    }
  }

  private async executeIntent(parsed: ParsedIntent): Promise<boolean> {
    const { intent, slots } = parsed;

    try {
      switch (intent) {
        case "navigate_session":
          await this.tmux.selectSession(slots.session);
          await this.speak(`Switched to session ${slots.session}`);
          break;

        case "navigate_window":
          const windowNum = slots.number ?? slots.ordinal;
          if (windowNum) {
            await this.tmux.selectWindow(windowNum);
            await this.speak(`Window ${windowNum}`);
          }
          break;

        case "navigate_pane":
          await this.tmux.selectPaneDirection(slots.direction);
          await this.speak(slots.direction);
          break;

        case "next_window":
          await this.tmux.nextWindow();
          await this.speak("Next");
          break;

        case "previous_window":
          await this.tmux.previousWindow();
          await this.speak("Previous");
          break;

        case "create_window":
          await this.tmux.newWindow(slots.name);
          await this.speak(slots.name ? `Created window ${slots.name}` : "New window");
          break;

        case "create_pane":
          const direction = slots.direction?.includes("vertical") ? "vertical" : "horizontal";
          await this.tmux.newPane(direction);
          await this.speak(`Split ${direction}`);
          break;

        case "kill_pane":
          await this.tmux.killPane();
          await this.speak("Pane closed");
          break;

        case "kill_window":
          await this.tmux.killWindow();
          await this.speak("Window closed");
          break;

        case "zoom_pane":
          await this.tmux.zoomPane();
          await this.speak("Zoomed");
          break;

        case "resize_pane":
          await this.tmux.resizePane(slots.direction, slots.amount ?? 5);
          break;

        case "list_sessions":
          const sessions = await this.tmux.listSessions();
          const names = sessions.map(s => s.name).join(", ");
          await this.speak(`Sessions: ${names || "none"}`);
          break;

        case "list_windows":
          const session = await this.tmux.getCurrentSession();
          if (session) {
            const windowNames = session.windows.map(w => w.name).join(", ");
            await this.speak(`Windows: ${windowNames || "none"}`);
          }
          break;

        default:
          return false;
      }

      return true;
    } catch (err) {
      console.error("Tmux command failed:", err);
      await this.speak("Command failed");
      return false;
    }
  }

  private async speak(text: string): Promise<void> {
    try {
      const audio = await this.tts.synthesize(text, {
        speed: 1.2, // Quick feedback
      });
      // Play audio...
    } catch {
      // Silent failure for feedback
    }
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// plugins/voice/specs/09-tmux-voice-control/tests/unit.test.ts

import { TMUX_COMMANDS, ORDINALS, DIRECTIONS } from "../src/tmux-grammar.js";

describe("TmuxVoiceGrammar", () => {
  test("all commands have required fields", () => {
    for (const cmd of TMUX_COMMANDS) {
      expect(cmd.patterns.length).toBeGreaterThan(0);
      expect(cmd.intent).toBeDefined();
      expect(cmd.examples.length).toBeGreaterThan(0);
    }
  });

  test("ordinals map correctly", () => {
    expect(ORDINALS["first"]).toBe(1);
    expect(ORDINALS["second"]).toBe(2);
    expect(ORDINALS["tenth"]).toBe(10);
  });

  test("directions normalize correctly", () => {
    expect(DIRECTIONS["up"]).toBe("up");
    expect(DIRECTIONS["top"]).toBe("up");
    expect(DIRECTIONS["above"]).toBe("up");
    expect(DIRECTIONS["below"]).toBe("down");
  });
});

describe("TmuxControlAdapter", () => {
  test("isAvailable checks tmux installation", async () => {
    const adapter = new TmuxControlAdapter();
    const available = await adapter.isAvailable();
    expect(typeof available).toBe("boolean");
  });
});
```

### Integration Tests

```typescript
// plugins/voice/specs/09-tmux-voice-control/tests/integration.test.ts

describe("Tmux Voice Control Integration", () => {
  let adapter: TmuxControlAdapter;

  beforeAll(() => {
    adapter = new TmuxControlAdapter();
  });

  test("lists current sessions", async () => {
    if (!(await adapter.isAvailable())) {
      return; // Skip if tmux not available
    }

    const sessions = await adapter.listSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test("gets current session info", async () => {
    if (!(await adapter.isAvailable())) {
      return;
    }

    const session = await adapter.getCurrentSession();
    // May be null if not in tmux
    if (session) {
      expect(session).toHaveProperty("name");
      expect(session).toHaveProperty("windows");
    }
  });
});

describe("Voice Command Parsing", () => {
  let handler: TmuxVoiceHandler;

  beforeAll(() => {
    const tmux = new TmuxControlAdapter();
    const tts = createMockTTS();
    handler = new TmuxVoiceHandler(tmux, tts);
  });

  test("parses window navigation", () => {
    const testCases = [
      { input: "window 3", expected: { intent: "navigate_window", slots: { number: 3 } } },
      { input: "go to window 1", expected: { intent: "navigate_window", slots: { number: 1 } } },
      { input: "first window", expected: { intent: "navigate_window", slots: { ordinal: 1 } } },
    ];

    for (const tc of testCases) {
      const parsed = handler.parseIntent(tc.input);
      expect(parsed?.intent).toBe(tc.expected.intent);
    }
  });

  test("parses pane navigation", () => {
    const parsed = handler.parseIntent("pane left");
    expect(parsed?.intent).toBe("navigate_pane");
    expect(parsed?.slots.direction).toBe("left");
  });

  test("parses split commands", () => {
    const parsed = handler.parseIntent("split horizontal");
    expect(parsed?.intent).toBe("create_pane");
  });
});
```

### E2E Tests

```typescript
// plugins/voice/specs/09-tmux-voice-control/tests/e2e.test.ts

describe("End-to-End Voice Control", () => {
  // These tests require a running tmux session

  test("voice command creates and navigates windows", async () => {
    const handler = createTmuxVoiceHandler();

    // Create window
    await handler.handleTranscript("new window test");

    // Navigate to window 1
    await handler.handleTranscript("window 1");

    // Go back
    await handler.handleTranscript("next window");

    // Clean up
    await handler.handleTranscript("close window");
  });
});
```

---

## Command Reference

| Voice Command | tmux Equivalent | Notes |
|--------------|-----------------|-------|
| "window 3" | `select-window -t 3` | Direct window number |
| "next window" | `next-window` | Cycle forward |
| "previous window" | `previous-window` | Cycle backward |
| "pane left" | `select-pane -L` | Direction navigation |
| "split horizontal" | `split-window -h` | New pane right |
| "split vertical" | `split-window -v` | New pane below |
| "zoom" | `resize-pane -Z` | Toggle zoom |
| "close pane" | `kill-pane` | Current pane |
| "new window logs" | `new-window -n logs` | Named window |
| "session main" | `switch-client -t main` | Session switch |

---

## Success Criteria

1. [ ] Recognizes 90%+ of documented voice commands
2. [ ] Executes tmux commands correctly
3. [ ] Provides audio feedback within 200ms
4. [ ] Handles ambiguous input gracefully
5. [ ] Works with existing tmux sessions
6. [ ] Supports custom socket paths

---

## Deliverables

```
plugins/voice/specs/09-tmux-voice-control/
├── SPEC.md
├── src/
│   ├── control.ts           # Tmux adapter
│   ├── tmux-grammar.ts      # Voice command grammar
│   ├── tmux-handler.ts      # Intent handler
│   └── types.ts             # TypeScript interfaces
├── tests/
│   ├── unit.test.ts
│   ├── integration.test.ts
│   └── e2e.test.ts
└── README.md
```
