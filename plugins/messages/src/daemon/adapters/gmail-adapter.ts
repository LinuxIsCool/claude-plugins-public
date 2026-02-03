/**
 * Gmail Adapter
 *
 * Wraps the Gmail sync service for daemon integration.
 */

import { BaseAdapter } from "./base-adapter";
import type { PlatformId } from "../types";
import {
  getGmailSyncService,
  resetGmailSyncService,
} from "../../services/gmail-sync";

/**
 * Check if Gmail authentication is available
 * Requires: At least one IMAP_*_HOST, IMAP_*_USER, IMAP_*_PASSWORD set in env
 */
export function isGmailAvailable(): boolean {
  try {
    // Check for any IMAP account configuration
    const seen = new Set<string>();

    for (const key of Object.keys(process.env)) {
      const match = key.match(/^IMAP_([A-Z0-9_]+)_HOST$/);
      if (match) {
        const prefix = match[1];
        if (seen.has(prefix)) continue;
        seen.add(prefix);

        const host = process.env[`IMAP_${prefix}_HOST`];
        const user = process.env[`IMAP_${prefix}_USER`];
        const password = process.env[`IMAP_${prefix}_PASSWORD`];

        // If we find at least one complete account config, return true
        if (host && user && password) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

export class GmailAdapter extends BaseAdapter {
  readonly platform: PlatformId = "gmail";
  private service: ReturnType<typeof getGmailSyncService> | null = null;

  private getService() {
    if (!this.service) {
      this.service = getGmailSyncService();
    }
    return this.service;
  }

  async isAuthenticated(): Promise<boolean> {
    return isGmailAvailable();
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
let instance: GmailAdapter | null = null;

export function getGmailAdapter(): GmailAdapter {
  if (!instance) {
    instance = new GmailAdapter();
  }
  return instance;
}

export function resetGmailAdapter(): void {
  if (instance) {
    instance.stop().catch(() => {});
    instance = null;
  }
  resetGmailSyncService();
}
