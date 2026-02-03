/**
 * WhatsApp Adapter
 *
 * Wraps the WhatsApp sync service for daemon integration.
 */

import { BaseAdapter } from "./base-adapter";
import type { PlatformId } from "../types";
import {
  getWhatsAppSyncService,
  resetWhatsAppSyncService,
  isWhatsAppAvailable,
} from "../../services/whatsapp-sync";

export class WhatsAppAdapter extends BaseAdapter {
  readonly platform: PlatformId = "whatsapp";
  private service: ReturnType<typeof getWhatsAppSyncService> | null = null;

  private getService() {
    if (!this.service) {
      this.service = getWhatsAppSyncService();
    }
    return this.service;
  }

  async isAuthenticated(): Promise<boolean> {
    return isWhatsAppAvailable();
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
let instance: WhatsAppAdapter | null = null;

export function getWhatsAppAdapter(): WhatsAppAdapter {
  if (!instance) {
    instance = new WhatsAppAdapter();
  }
  return instance;
}

export function resetWhatsAppAdapter(): void {
  if (instance) {
    instance.stop().catch(() => {});
    instance = null;
  }
  resetWhatsAppSyncService();
}
