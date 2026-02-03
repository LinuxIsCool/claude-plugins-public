/**
 * Tmux Control Adapter
 *
 * Implements TmuxControlPort by wrapping tmux CLI commands.
 * Provides voice-controlled navigation of sessions, windows, and panes.
 */

import { execSync, spawnSync } from "child_process";
import type {
  TmuxControlPort,
  TmuxControlCapabilities,
  TmuxSession,
  TmuxWindow,
  TmuxPane,
  Direction,
  SplitDirection,
} from "../../ports/tmux.js";

/**
 * Direction to tmux flag mapping
 */
const DIRECTION_FLAGS: Record<Direction, string> = {
  up: "-U",
  down: "-D",
  left: "-L",
  right: "-R",
};

/**
 * Configuration for TmuxControlAdapter
 */
export interface TmuxControlConfig {
  /** Custom tmux socket path */
  socketPath?: string;
  /** Command timeout in milliseconds */
  timeout?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TmuxControlConfig> = {
  socketPath: "",
  timeout: 5000,
};

/**
 * TmuxControlAdapter
 *
 * Wraps tmux CLI commands for voice control.
 */
export class TmuxControlAdapter implements TmuxControlPort {
  private config: Required<TmuxControlConfig>;
  private cachedVersion: string | null = null;

  constructor(config: TmuxControlConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a tmux command using spawnSync to prevent shell injection
   *
   * @param args Tmux command arguments
   * @returns Command output (stdout)
   */
  private tmux(args: string[]): string {
    const fullArgs = this.config.socketPath
      ? ["-S", this.config.socketPath, ...args]
      : args;

    const result = spawnSync("tmux", fullArgs, {
      encoding: "utf-8",
      timeout: this.config.timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Exit code 1 often means empty result (no sessions, etc.)
    if (result.status === 1) {
      return "";
    }

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const error = new Error(`tmux exited with code ${result.status}: ${result.stderr}`);
      (error as NodeJS.ErrnoException).code = result.status?.toString();
      throw error;
    }

    return (result.stdout || "").trim();
  }

  /**
   * Get port name
   */
  name(): string {
    return "tmux";
  }

  /**
   * Get capabilities
   */
  async capabilities(): Promise<TmuxControlCapabilities> {
    const available = await this.isAvailable();
    return {
      available,
      version: available ? this.cachedVersion ?? undefined : undefined,
      socketPath: this.config.socketPath || undefined,
    };
  }

  /**
   * Check if tmux is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const version = execSync("tmux -V", {
        encoding: "utf-8",
        timeout: this.config.timeout,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      this.cachedVersion = version;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current/attached session
   */
  async getCurrentSession(): Promise<TmuxSession | null> {
    try {
      const output = this.tmux([
        "display-message",
        "-p",
        "#{session_id}\t#{session_name}\t#{session_attached}\t#{session_created}",
      ]);

      if (!output) return null;

      const [id, name, attached, created] = output.split("\t");

      return {
        id,
        name,
        attached: attached === "1",
        created: new Date(parseInt(created, 10) * 1000),
        windows: await this.listWindows(),
      };
    } catch {
      return null;
    }
  }

  // Navigation

  /**
   * Switch to a session by name or ID
   */
  async selectSession(target: string): Promise<boolean> {
    try {
      this.tmux(["switch-client", "-t", target]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Switch to a window by index or name
   */
  async selectWindow(target: string | number): Promise<boolean> {
    try {
      this.tmux(["select-window", "-t", target.toString()]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Select pane by index or ID
   */
  async selectPane(target: string | number): Promise<boolean> {
    try {
      this.tmux(["select-pane", "-t", target.toString()]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Navigate to pane in direction
   */
  async selectPaneDirection(direction: Direction): Promise<boolean> {
    try {
      this.tmux(["select-pane", DIRECTION_FLAGS[direction]]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Switch to next window
   */
  async nextWindow(): Promise<boolean> {
    try {
      this.tmux(["next-window"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Switch to previous window
   */
  async previousWindow(): Promise<boolean> {
    try {
      this.tmux(["previous-window"]);
      return true;
    } catch {
      return false;
    }
  }

  // Creation/Destruction

  /**
   * Create a new window
   */
  async newWindow(name?: string): Promise<TmuxWindow> {
    const args = ["new-window"];
    if (name) args.push("-n", name);
    args.push("-P", "-F", "#{window_id}\t#{window_index}\t#{window_name}");

    const output = this.tmux(args);
    const [id, index, windowName] = output.split("\t");

    return {
      id,
      index: parseInt(index, 10),
      name: windowName,
      active: true,
      layout: "",
      panes: [],
    };
  }

  /**
   * Create a new pane by splitting
   */
  async newPane(direction: SplitDirection): Promise<TmuxPane> {
    const flag = direction === "horizontal" ? "-h" : "-v";

    const output = this.tmux([
      "split-window",
      flag,
      "-P",
      "-F",
      "#{pane_id}\t#{pane_index}\t#{pane_width}\t#{pane_height}\t#{pane_current_path}",
    ]);

    const [id, index, width, height, path] = output.split("\t");

    return {
      id,
      index: parseInt(index, 10),
      active: true,
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      currentPath: path,
    };
  }

  /**
   * Kill a pane
   */
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

  /**
   * Kill a window
   */
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

  // Layout

  /**
   * Resize pane in direction
   */
  async resizePane(direction: Direction, amount: number): Promise<boolean> {
    try {
      this.tmux(["resize-pane", DIRECTION_FLAGS[direction], amount.toString()]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggle pane zoom
   */
  async zoomPane(): Promise<boolean> {
    try {
      this.tmux(["resize-pane", "-Z"]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rotate window layout
   */
  async rotateWindow(): Promise<boolean> {
    try {
      this.tmux(["rotate-window"]);
      return true;
    } catch {
      return false;
    }
  }

  // Utility

  /**
   * Send keys to current pane
   */
  async sendKeys(keys: string): Promise<boolean> {
    try {
      this.tmux(["send-keys", keys]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run arbitrary tmux command
   */
  async runCommand(command: string): Promise<string> {
    return this.tmux(command.split(" "));
  }

  // Query

  /**
   * List all sessions
   */
  async listSessions(): Promise<TmuxSession[]> {
    const output = this.tmux([
      "list-sessions",
      "-F",
      "#{session_id}\t#{session_name}\t#{session_attached}\t#{session_created}",
    ]);

    if (!output) return [];

    return output.split("\n").map((line) => {
      const [id, name, attached, created] = line.split("\t");
      return {
        id,
        name,
        attached: attached === "1",
        created: new Date(parseInt(created, 10) * 1000),
        windows: [], // Lazy load - call listWindows() separately if needed
      };
    });
  }

  /**
   * List windows in current session
   */
  async listWindows(): Promise<TmuxWindow[]> {
    const output = this.tmux([
      "list-windows",
      "-F",
      "#{window_id}\t#{window_index}\t#{window_name}\t#{window_active}\t#{window_layout}",
    ]);

    if (!output) return [];

    return output.split("\n").map((line) => {
      const [id, index, name, active, layout] = line.split("\t");
      return {
        id,
        index: parseInt(index, 10),
        name,
        active: active === "1",
        layout,
        panes: [], // Lazy load - call listPanes() separately if needed
      };
    });
  }

  /**
   * List panes in current window
   */
  async listPanes(): Promise<TmuxPane[]> {
    const output = this.tmux([
      "list-panes",
      "-F",
      "#{pane_id}\t#{pane_index}\t#{pane_active}\t#{pane_width}\t#{pane_height}\t#{pane_current_path}\t#{pane_current_command}",
    ]);

    if (!output) return [];

    return output.split("\n").map((line) => {
      const [id, index, active, width, height, path, command] = line.split("\t");
      return {
        id,
        index: parseInt(index, 10),
        active: active === "1",
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        currentPath: path,
        currentCommand: command || undefined,
      };
    });
  }
}

/**
 * Create a TmuxControlAdapter instance
 */
export function createTmuxControl(config?: TmuxControlConfig): TmuxControlAdapter {
  return new TmuxControlAdapter(config);
}
