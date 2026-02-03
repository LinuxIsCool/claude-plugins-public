/**
 * Signal Adapter
 *
 * Wraps the Signal sync service for daemon integration.
 */

import { BaseAdapter } from "./base-adapter";
import type { PlatformId } from "../types";
import {
  getSignalSyncService,
  resetSignalSyncService,
} from "../../services/signal-sync";
import { isSignalAvailable } from "../../adapters/signal";

export class SignalAdapter extends BaseAdapter {
  readonly platform: PlatformId = "signal";
  private service: ReturnType<typeof getSignalSyncService> | null = null;

  private getService() {
    if (!this.service) {
      this.service = getSignalSyncService();
    }
    return this.service;
  }

  async isAuthenticated(): Promise<boolean> {
    return isSignalAvailable();
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
let instance: SignalAdapter | null = null;

export function getSignalAdapter(): SignalAdapter {
  if (!instance) {
    instance = new SignalAdapter();
  }
  return instance;
}

export function resetSignalAdapter(): void {
  if (instance) {
    instance.stop().catch(() => {});
    instance = null;
  }
  resetSignalSyncService();
}
