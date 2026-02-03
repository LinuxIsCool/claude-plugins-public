/**
 * Discord Adapter
 *
 * Wraps the Discord sync service for daemon integration.
 */

import { BaseAdapter } from "./base-adapter";
import type { PlatformId } from "../types";
import {
  getDiscordSyncService,
  resetDiscordSyncService,
  isDiscordAvailable,
} from "../../services/discord-sync";

export class DiscordAdapter extends BaseAdapter {
  readonly platform: PlatformId = "discord";
  private service: ReturnType<typeof getDiscordSyncService> | null = null;

  private getService() {
    if (!this.service) {
      this.service = getDiscordSyncService();
    }
    return this.service;
  }

  async isAuthenticated(): Promise<boolean> {
    return isDiscordAvailable();
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
let instance: DiscordAdapter | null = null;

export function getDiscordAdapter(): DiscordAdapter {
  if (!instance) {
    instance = new DiscordAdapter();
  }
  return instance;
}

export function resetDiscordAdapter(): void {
  if (instance) {
    instance.stop().catch(() => {});
    instance = null;
  }
  resetDiscordSyncService();
}
