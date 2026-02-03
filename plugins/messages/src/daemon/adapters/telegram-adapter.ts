/**
 * Telegram Adapter
 *
 * Wraps the Telegram sync service for daemon integration.
 */

import { BaseAdapter } from "./base-adapter";
import type { PlatformId } from "../types";
import {
  getTelegramSyncService,
  resetTelegramSyncService,
} from "../../services/telegram-sync";
import { hasSession, loadCredentials } from "../../integrations/telegram/client";

/**
 * Check if Telegram authentication is available
 * Requires: session file exists AND env credentials are set
 */
export function isTelegramAvailable(): boolean {
  try {
    // Check credentials first (throws if missing)
    loadCredentials();
    // Check for valid session file
    return hasSession();
  } catch {
    return false;
  }
}

export class TelegramAdapter extends BaseAdapter {
  readonly platform: PlatformId = "telegram";
  private service: ReturnType<typeof getTelegramSyncService> | null = null;

  private getService() {
    if (!this.service) {
      this.service = getTelegramSyncService();
    }
    return this.service;
  }

  async isAuthenticated(): Promise<boolean> {
    return isTelegramAvailable();
  }

  async start(): Promise<void> {
    if (this._connected) {
      return;
    }

    const service = this.getService();

    // Forward events before starting
    this.forwardEvents(service);

    // Start the sync service
    await service.start();
    this._connected = true;
    this.emit("connected");
  }

  async stop(): Promise<void> {
    if (!this._connected || !this.service) {
      return;
    }

    await this.service.stop();
    this._connected = false;
    this.emit("disconnected");
  }
}

// Factory
let instance: TelegramAdapter | null = null;

export function getTelegramAdapter(): TelegramAdapter {
  if (!instance) {
    instance = new TelegramAdapter();
  }
  return instance;
}

export function resetTelegramAdapter(): void {
  if (instance) {
    instance.stop().catch(() => {});
    instance = null;
  }
  resetTelegramSyncService();
}
