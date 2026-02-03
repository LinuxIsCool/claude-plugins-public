/**
 * Base Adapter
 *
 * Abstract base class for platform adapters.
 * Wraps existing sync services with a consistent API for the daemon.
 */

import { EventEmitter } from "events";
import type { PlatformId, PlatformStats, IPlatformAdapter } from "../types";

/**
 * Abstract base class for platform adapters
 *
 * Subclasses wrap existing sync services (signal-sync, whatsapp-sync, etc.)
 * and forward their events to the daemon infrastructure.
 */
export abstract class BaseAdapter extends EventEmitter implements IPlatformAdapter {
  abstract readonly platform: PlatformId;

  protected _connected = false;
  protected _messageCount = 0;
  protected _errorCount = 0;
  protected _lastMessage?: Date;
  protected _lastError?: Date;

  /**
   * Check if the platform has valid authentication
   */
  abstract isAuthenticated(): Promise<boolean>;

  /**
   * Start the sync service
   */
  abstract start(): Promise<void>;

  /**
   * Stop the sync service
   */
  abstract stop(): Promise<void>;

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Get current statistics
   */
  getStats(): PlatformStats {
    return {
      messageCount: this._messageCount,
      errorCount: this._errorCount,
      lastMessage: this._lastMessage,
      lastError: this._lastError,
      isConnected: this._connected,
    };
  }

  /**
   * Forward events from the underlying sync service
   * Call this in subclass start() after setting up the service
   */
  protected forwardEvents(service: EventEmitter): void {
    service.on("message", (msg) => {
      this._messageCount++;
      this._lastMessage = new Date();
      this.emit("message", msg);
    });

    service.on("connected", () => {
      this._connected = true;
      this.emit("connected");
    });

    service.on("disconnected", () => {
      this._connected = false;
      this.emit("disconnected");
    });

    service.on("error", (err) => {
      this._errorCount++;
      this._lastError = new Date();
      this.emit("error", err);
    });

    // Some services emit 'sync' for batch operations
    service.on("sync", (data) => {
      this.emit("sync", data);
    });
  }

  /**
   * Reset statistics (useful after recovery)
   */
  protected resetStats(): void {
    this._messageCount = 0;
    this._errorCount = 0;
    this._lastMessage = undefined;
    this._lastError = undefined;
  }
}
