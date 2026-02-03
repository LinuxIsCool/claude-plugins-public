/**
 * WhatsApp Auth State Persistence
 *
 * Uses Baileys' official useMultiFileAuthState with proper path resolution.
 * Sessions are stored in .claude/messages/whatsapp-auth/
 *
 * This is a thin wrapper around the official implementation to:
 * - Use lib/paths.ts for consistent path resolution
 * - Provide helper functions for session management
 */

import { join } from "path";
import { existsSync, readFileSync, readdirSync, rmSync } from "fs";
import { getClaudePath } from "../../../../../lib/paths";
import {
  useMultiFileAuthState,
  BufferJSON,
} from "@whiskeysockets/baileys";
import type { AuthenticationCreds, AuthenticationState } from "@whiskeysockets/baileys";

/**
 * Get the auth state directory path
 */
export function getAuthStatePath(sessionName = "default"): string {
  return getClaudePath(`messages/whatsapp-auth/${sessionName}`);
}

/**
 * Check if a session exists
 */
export function hasSession(sessionName = "default"): boolean {
  const authPath = getAuthStatePath(sessionName);
  const credsPath = join(authPath, "creds.json");
  return existsSync(credsPath);
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
 * Create file-based auth state for Baileys using official implementation
 *
 * This wraps Baileys' useMultiFileAuthState with proper path resolution.
 *
 * @param sessionName - Session identifier (default: "default")
 * @returns AuthenticationState object for use with makeWASocket
 */
export async function useFileAuthState(
  sessionName = "default"
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const authPath = getAuthStatePath(sessionName);

  // Use the official Baileys implementation
  return useMultiFileAuthState(authPath);
}

/**
 * Get session info (phone number, etc.) from saved credentials
 */
export function getSessionInfo(sessionName = "default"): {
  exists: boolean;
  phoneNumber?: string;
  platform?: string;
  registered?: boolean;
} {
  const authPath = getAuthStatePath(sessionName);
  const credsPath = join(authPath, "creds.json");

  if (!existsSync(credsPath)) {
    return { exists: false };
  }

  try {
    const data = readFileSync(credsPath, "utf-8");
    const creds = JSON.parse(data, BufferJSON.reviver) as AuthenticationCreds;

    return {
      exists: true,
      phoneNumber: creds.me?.id?.split(":")[0]?.split("@")[0],
      platform: creds.platform,
      registered: creds.registered,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * List all files in a session directory (useful for debugging)
 */
export function listSessionFiles(sessionName = "default"): string[] {
  const authPath = getAuthStatePath(sessionName);

  if (!existsSync(authPath)) {
    return [];
  }

  try {
    return readdirSync(authPath);
  } catch {
    return [];
  }
}
