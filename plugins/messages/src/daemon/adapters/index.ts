/**
 * Adapter Registry
 *
 * Central registry for platform adapters.
 * Provides factory functions and platform discovery.
 */

import type { PlatformId, IPlatformAdapter } from "../types";
import { PLATFORM_PRIORITY } from "../types";

import { getSignalAdapter, resetSignalAdapter, SignalAdapter } from "./signal-adapter";
import { getWhatsAppAdapter, resetWhatsAppAdapter, WhatsAppAdapter } from "./whatsapp-adapter";
import { getDiscordAdapter, resetDiscordAdapter, DiscordAdapter } from "./discord-adapter";
import { getTelegramAdapter, resetTelegramAdapter, TelegramAdapter } from "./telegram-adapter";
import { getGmailAdapter, resetGmailAdapter, GmailAdapter } from "./gmail-adapter";

// Re-export adapters
export {
  SignalAdapter,
  WhatsAppAdapter,
  DiscordAdapter,
  TelegramAdapter,
  GmailAdapter,
};

// Re-export factories
export {
  getSignalAdapter,
  getWhatsAppAdapter,
  getDiscordAdapter,
  getTelegramAdapter,
  getGmailAdapter,
};

/**
 * Get adapter factory for a platform
 */
export function getAdapterFactory(platform: PlatformId): () => IPlatformAdapter {
  switch (platform) {
    case "signal":
      return getSignalAdapter;
    case "whatsapp":
      return getWhatsAppAdapter;
    case "discord":
      return getDiscordAdapter;
    case "telegram":
      return getTelegramAdapter;
    case "gmail":
      return getGmailAdapter;
  }
}

/**
 * Get adapter instance for a platform
 */
export function getAdapter(platform: PlatformId): IPlatformAdapter {
  return getAdapterFactory(platform)();
}

/**
 * Discover which platforms have valid authentication
 */
export async function discoverAuthenticatedPlatforms(): Promise<PlatformId[]> {
  const authenticated: PlatformId[] = [];

  for (const platform of PLATFORM_PRIORITY) {
    try {
      const adapter = getAdapter(platform);
      const isAuth = await adapter.isAuthenticated();
      if (isAuth) {
        authenticated.push(platform);
        console.log(`[adapters] ${platform}: authenticated`);
      } else {
        console.log(`[adapters] ${platform}: not authenticated`);
      }
    } catch (error) {
      // Platform check failed, skip it
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[adapters] ${platform}: error - ${msg}`);
    }
  }

  return authenticated;
}

/**
 * Reset all adapters (for testing)
 */
export function resetAllAdapters(): void {
  resetSignalAdapter();
  resetWhatsAppAdapter();
  resetDiscordAdapter();
  resetTelegramAdapter();
  resetGmailAdapter();
}
