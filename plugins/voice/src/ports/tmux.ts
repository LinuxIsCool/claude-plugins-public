/**
 * Tmux Control Port
 *
 * Interface for tmux terminal multiplexer control. Enables voice-driven
 * navigation of sessions, windows, and panes.
 */

/**
 * Direction for pane navigation and resizing
 */
export type Direction = "up" | "down" | "left" | "right";

/**
 * Split direction for creating new panes
 */
export type SplitDirection = "horizontal" | "vertical";

/**
 * Tmux session information
 */
export interface TmuxSession {
  /** Session ID (e.g., "$0") */
  id: string;
  /** Session name */
  name: string;
  /** List of windows in this session */
  windows: TmuxWindow[];
  /** Whether a client is attached to this session */
  attached: boolean;
  /** Session creation timestamp */
  created: Date;
}

/**
 * Tmux window information
 */
export interface TmuxWindow {
  /** Window ID (e.g., "@0") */
  id: string;
  /** Window index (0-based) */
  index: number;
  /** Window name */
  name: string;
  /** List of panes in this window */
  panes: TmuxPane[];
  /** Whether this window is active */
  active: boolean;
  /** Window layout string */
  layout: string;
}

/**
 * Tmux pane information
 */
export interface TmuxPane {
  /** Pane ID (e.g., "%0") */
  id: string;
  /** Pane index (0-based) */
  index: number;
  /** Whether this pane is active */
  active: boolean;
  /** Pane width in characters */
  width: number;
  /** Pane height in characters */
  height: number;
  /** Current working directory */
  currentPath: string;
  /** Current command running in pane */
  currentCommand?: string;
}

/**
 * Tmux control capabilities
 */
export interface TmuxControlCapabilities {
  /** Whether tmux is installed and available */
  available: boolean;
  /** Tmux version string */
  version?: string;
  /** Custom socket path if configured */
  socketPath?: string;
}

/**
 * Tmux Control Port Interface
 *
 * All tmux control implementations implement this interface.
 */
export interface TmuxControlPort {
  /**
   * Get port name/identifier
   */
  name(): string;

  /**
   * Get port capabilities
   */
  capabilities(): Promise<TmuxControlCapabilities>;

  /**
   * Check if tmux is available and accessible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get the current/attached session
   */
  getCurrentSession(): Promise<TmuxSession | null>;

  // Navigation

  /**
   * Switch to a different session
   * @param target Session name or ID
   */
  selectSession(target: string): Promise<boolean>;

  /**
   * Switch to a different window
   * @param target Window name, index, or ID
   */
  selectWindow(target: string | number): Promise<boolean>;

  /**
   * Switch to a pane by index
   * @param target Pane index or ID
   */
  selectPane(target: string | number): Promise<boolean>;

  /**
   * Navigate to pane in direction
   * @param direction Direction to navigate
   */
  selectPaneDirection(direction: Direction): Promise<boolean>;

  /**
   * Switch to next window
   */
  nextWindow(): Promise<boolean>;

  /**
   * Switch to previous window
   */
  previousWindow(): Promise<boolean>;

  // Creation/Destruction

  /**
   * Create a new window
   * @param name Optional window name
   */
  newWindow(name?: string): Promise<TmuxWindow>;

  /**
   * Create a new pane by splitting
   * @param direction Split direction
   */
  newPane(direction: SplitDirection): Promise<TmuxPane>;

  /**
   * Kill the current pane
   * @param target Optional pane target
   */
  killPane(target?: string): Promise<boolean>;

  /**
   * Kill the current window
   * @param target Optional window target
   */
  killWindow(target?: string): Promise<boolean>;

  // Layout

  /**
   * Resize pane in direction
   * @param direction Direction to resize
   * @param amount Number of cells to resize
   */
  resizePane(direction: Direction, amount: number): Promise<boolean>;

  /**
   * Toggle pane zoom (maximize/restore)
   */
  zoomPane(): Promise<boolean>;

  /**
   * Rotate window layout
   */
  rotateWindow(): Promise<boolean>;

  // Utility

  /**
   * Send keys to current pane
   * @param keys Keys to send
   */
  sendKeys(keys: string): Promise<boolean>;

  /**
   * Run arbitrary tmux command
   * @param command Tmux command string
   */
  runCommand(command: string): Promise<string>;

  // Query

  /**
   * List all sessions
   */
  listSessions(): Promise<TmuxSession[]>;

  /**
   * List windows in current session
   */
  listWindows(): Promise<TmuxWindow[]>;

  /**
   * List panes in current window
   */
  listPanes(): Promise<TmuxPane[]>;
}

/**
 * Factory for creating tmux control instances
 */
export interface TmuxControlFactory {
  /**
   * Create a tmux control instance
   * @param socketPath Optional custom socket path
   */
  create(socketPath?: string): TmuxControlPort;

  /**
   * Get first available tmux control
   */
  getAvailable(): Promise<TmuxControlPort | null>;
}
