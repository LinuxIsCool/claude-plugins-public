/**
 * IPC Client
 *
 * Client library for communicating with the daemon.
 * Used by the CLI to send commands and receive responses.
 */

import { createConnection, type Socket } from "net";
import { existsSync } from "fs";
import type {
  IpcCommand,
  IpcResponse,
  StatusResponse,
  HealthReport,
  PlatformId,
} from "./types";
import { DEFAULT_SOCKET_PATH } from "./ipc-server";

/**
 * Connection timeout in milliseconds
 */
const CONNECT_TIMEOUT = 5000;

/**
 * Response timeout in milliseconds
 */
const RESPONSE_TIMEOUT = 30000;

/**
 * IPC Client
 *
 * Communicates with the daemon via Unix socket.
 */
export class IpcClient {
  private socketPath: string;

  constructor(socketPath = DEFAULT_SOCKET_PATH) {
    this.socketPath = socketPath;
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return existsSync(this.socketPath);
  }

  /**
   * Send a command to the daemon
   */
  async send(command: IpcCommand): Promise<IpcResponse> {
    if (!this.isRunning()) {
      return {
        success: false,
        error: "Daemon is not running",
      };
    }

    return new Promise((resolve) => {
      let socket: Socket | null = null;
      let buffer = "";
      let resolved = false;

      const cleanup = () => {
        if (socket) {
          socket.destroy();
          socket = null;
        }
      };

      const done = (response: IpcResponse) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(response);
      };

      // Connection timeout
      const connectTimeout = setTimeout(() => {
        done({ success: false, error: "Connection timeout" });
      }, CONNECT_TIMEOUT);

      // Response timeout
      const responseTimeout = setTimeout(() => {
        done({ success: false, error: "Response timeout" });
      }, RESPONSE_TIMEOUT);

      try {
        socket = createConnection(this.socketPath, () => {
          clearTimeout(connectTimeout);

          // Send command
          socket!.write(JSON.stringify(command) + "\n");
        });

        socket.on("data", (data) => {
          buffer += data.toString();

          // Look for complete response
          const newlineIdx = buffer.indexOf("\n");
          if (newlineIdx !== -1) {
            clearTimeout(responseTimeout);
            const line = buffer.slice(0, newlineIdx);
            try {
              const response = JSON.parse(line) as IpcResponse;
              done(response);
            } catch {
              done({ success: false, error: "Invalid response from daemon" });
            }
          }
        });

        socket.on("error", (err) => {
          clearTimeout(connectTimeout);
          clearTimeout(responseTimeout);
          done({
            success: false,
            error: `Connection error: ${err.message}`,
          });
        });

        socket.on("close", () => {
          clearTimeout(connectTimeout);
          clearTimeout(responseTimeout);
          if (!resolved) {
            done({ success: false, error: "Connection closed unexpectedly" });
          }
        });
      } catch (error) {
        clearTimeout(connectTimeout);
        clearTimeout(responseTimeout);
        done({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Get daemon status
   */
  async status(): Promise<StatusResponse | null> {
    const response = await this.send({ type: "status" });
    if (response.success && response.data) {
      return response.data as StatusResponse;
    }
    return null;
  }

  /**
   * Get health report
   */
  async health(): Promise<HealthReport | null> {
    const response = await this.send({ type: "health" });
    if (response.success && response.data) {
      return response.data as HealthReport;
    }
    return null;
  }

  /**
   * Start the daemon
   */
  async start(): Promise<IpcResponse> {
    return this.send({ type: "start" });
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<IpcResponse> {
    return this.send({ type: "stop" });
  }

  /**
   * Restart the daemon
   */
  async restart(): Promise<IpcResponse> {
    return this.send({ type: "restart" });
  }

  /**
   * Restart a specific platform
   */
  async restartPlatform(platform: PlatformId): Promise<IpcResponse> {
    return this.send({ type: "restart-platform", platform });
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let clientInstance: IpcClient | null = null;

export function getIpcClient(socketPath?: string): IpcClient {
  if (!clientInstance) {
    clientInstance = new IpcClient(socketPath);
  }
  return clientInstance;
}

export function resetIpcClient(): void {
  clientInstance = null;
}
