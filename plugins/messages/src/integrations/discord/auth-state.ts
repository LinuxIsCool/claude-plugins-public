/**
 * Discord Auth State Persistence
 *
 * Stores Discord user tokens securely for self-bot authentication.
 * Sessions are stored in .claude/messages/discord-auth/
 *
 * This module provides:
 * - Token storage and retrieval
 * - Session management (check, clear)
 * - Path resolution using lib/paths.ts
 */

import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { getClaudePath } from "../../../../../lib/paths";

/**
 * Auth state stored in session file
 */
export interface DiscordAuthState {
  /** User token */
  token: string;
  /** User ID */
  userId: string;
  /** Username */
  username: string;
  /** Discriminator */
  discriminator: string;
  /** Created timestamp */
  createdAt: number;
  /** Last validated timestamp */
  lastValidated?: number;
}

/**
 * Get the auth state directory path
 */
export function getAuthStatePath(sessionName = "default"): string {
  return getClaudePath(`messages/discord-auth/${sessionName}`);
}

/**
 * Get the session file path
 */
function getSessionFilePath(sessionName = "default"): string {
  return join(getAuthStatePath(sessionName), "session.json");
}

/**
 * Check if a session exists
 */
export function hasSession(sessionName = "default"): boolean {
  const sessionPath = getSessionFilePath(sessionName);
  return existsSync(sessionPath);
}

/**
 * Clear session (delete all auth files)
 */
export function clearSession(sessionName = "default"): void {
  const authPath = getAuthStatePath(sessionName);

  if (!existsSync(authPath)) {
    return;
  }

  // Delete the entire directory and its contents
  rmSync(authPath, { recursive: true, force: true });
}

/**
 * Save auth state to session file
 */
export async function saveAuthState(
  sessionName: string,
  state: DiscordAuthState
): Promise<void> {
  const authPath = getAuthStatePath(sessionName);
  const sessionPath = getSessionFilePath(sessionName);

  // Create directory if it doesn't exist
  if (!existsSync(authPath)) {
    mkdirSync(authPath, { recursive: true });
  }

  // Write session data
  writeFileSync(sessionPath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Load auth state from session file
 */
export async function loadAuthState(
  sessionName = "default"
): Promise<DiscordAuthState | null> {
  const sessionPath = getSessionFilePath(sessionName);

  if (!existsSync(sessionPath)) {
    return null;
  }

  try {
    const data = readFileSync(sessionPath, "utf-8");
    return JSON.parse(data) as DiscordAuthState;
  } catch {
    return null;
  }
}

/**
 * Get session info without loading full state
 */
export function getSessionInfo(sessionName = "default"): {
  exists: boolean;
  username?: string;
  userId?: string;
  discriminator?: string;
  createdAt?: number;
} {
  const sessionPath = getSessionFilePath(sessionName);

  if (!existsSync(sessionPath)) {
    return { exists: false };
  }

  try {
    const data = readFileSync(sessionPath, "utf-8");
    const state = JSON.parse(data) as DiscordAuthState;

    return {
      exists: true,
      username: state.username,
      userId: state.userId,
      discriminator: state.discriminator,
      createdAt: state.createdAt,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Update last validated timestamp
 */
export async function updateLastValidated(sessionName = "default"): Promise<void> {
  const state = await loadAuthState(sessionName);
  if (state) {
    state.lastValidated = Date.now();
    await saveAuthState(sessionName, state);
  }
}
