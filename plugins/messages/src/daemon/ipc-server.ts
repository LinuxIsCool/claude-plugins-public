/**
 * IPC Server
 *
 * Unix socket server for daemon control.
 * Accepts commands from the CLI and returns responses.
 */

import { createServer, type Server, type Socket } from "net";
import { existsSync, unlinkSync } from "fs";
import { EventEmitter } from "events";
import type {
  IpcCommand,
  IpcResponse,
} from "./types";
import { PLATFORM_PRIORITY } from "./types";
import type { Orchestrator } from "./orchestrator";

const DEFAULT_SOCKET_PATH = "/tmp/messages-daemon.sock";

/**
 * IPC Server Events
 */
export interface IpcServerEvents {
  listening: () => void;
  connection: (socket: Socket) => void;
  command: (cmd: IpcCommand) => void;
  error: (error: Error) => void;
  close: () => void;
}

/**
 * IPC Server
 *
 * Handles CLI commands via Unix socket.
 */
export class IpcServer extends EventEmitter {
  private server: Server | null = null;
  private socketPath: string;
  private orchestrator: Orchestrator;

  constructor(orchestrator: Orchestrator, socketPath = DEFAULT_SOCKET_PATH) {
    super();
    this.orchestrator = orchestrator;
    this.socketPath = socketPath;
  }

  /**
   * Start listening for connections
   */
  async start(): Promise<void> {
    // Clean up stale socket file
    if (existsSync(this.socketPath)) {
      try {
        unlinkSync(this.socketPath);
      } catch {
        throw new Error(`Cannot remove stale socket: ${this.socketPath}`);
      }
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        console.log(`[ipc-server] Listening on ${this.socketPath}`);
        this.emit("listening");
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        // Clean up socket file
        if (existsSync(this.socketPath)) {
          try {
            unlinkSync(this.socketPath);
          } catch {
            // Ignore cleanup errors
          }
        }

        console.log("[ipc-server] Stopped");
        this.emit("close");
        this.server = null;
        resolve();
      });
    });
  }

  /**
   * Get socket path
   */
  getSocketPath(): string {
    return this.socketPath;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private handleConnection(socket: Socket): void {
    this.emit("connection", socket);
    let buffer = "";

    socket.on("data", async (data) => {
      buffer += data.toString();

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const command = JSON.parse(line) as IpcCommand;
          this.emit("command", command);

          const response = await this.handleCommand(command);
          socket.write(JSON.stringify(response) + "\n");
        } catch (error) {
          const response: IpcResponse = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
          socket.write(JSON.stringify(response) + "\n");
        }
      }
    });

    socket.on("error", (err) => {
      console.error("[ipc-server] Socket error:", err.message);
    });
  }

  private async handleCommand(cmd: IpcCommand): Promise<IpcResponse> {
    console.log(`[ipc-server] Received command: ${cmd.type}`);

    switch (cmd.type) {
      case "status":
        return {
          success: true,
          data: this.orchestrator.getStatusResponse(),
        };

      case "health":
        return {
          success: true,
          data: await this.orchestrator.getHealthReport(),
        };

      case "start":
        try {
          await this.orchestrator.start();
          return { success: true, data: "Daemon started" };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Start failed",
          };
        }

      case "stop":
        try {
          await this.orchestrator.stop();
          return { success: true, data: "Daemon stopped" };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Stop failed",
          };
        }

      case "restart":
        try {
          await this.orchestrator.stop();
          await this.orchestrator.start();
          return { success: true, data: "Daemon restarted" };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Restart failed",
          };
        }

      case "restart-platform":
        if (!cmd.platform) {
          return { success: false, error: "Platform required" };
        }
        if (!PLATFORM_PRIORITY.includes(cmd.platform)) {
          return { success: false, error: `Unknown platform: ${cmd.platform}` };
        }
        try {
          await this.orchestrator.restartPlatform(cmd.platform);
          return { success: true, data: `Platform ${cmd.platform} restarted` };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Restart failed",
          };
        }

      default:
        return { success: false, error: `Unknown command: ${cmd.type}` };
    }
  }
}

// ===========================================================================
// Factory
// ===========================================================================

let serverInstance: IpcServer | null = null;

export function getIpcServer(
  orchestrator: Orchestrator,
  socketPath?: string
): IpcServer {
  if (!serverInstance) {
    serverInstance = new IpcServer(orchestrator, socketPath);
  }
  return serverInstance;
}

export function resetIpcServer(): void {
  if (serverInstance) {
    serverInstance.stop().catch(() => {});
    serverInstance = null;
  }
}

export { DEFAULT_SOCKET_PATH };
