/**
 * Signal Client
 *
 * Communicates with signal-cli daemon via JSON-RPC.
 * Supports both Unix socket and TCP connections.
 *
 * Usage:
 * 1. Start signal-cli daemon: signal-cli -a +1234567890 daemon --tcp
 * 2. Connect: const client = new SignalClient(); await client.connect();
 */

import { EventEmitter } from "events";
import { createConnection, Socket } from "net";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type {
  SignalConfig,
  SignalContact,
  SignalGroup,
  SignalConversation,
  SignalMessage,
  SignalEnvelope,
  SignalImportOptions,
  SignalEventType,
  SignalEventHandler,
} from "./types";

import { getClaudePath } from "../../../../../lib/paths";

// Path to bundled signal-cli binary
const SIGNAL_CLI_PATH = join(__dirname, "../../../node_modules/signal-sdk/bin/signal-cli");

/**
 * Get the Signal session state path (anchored to repo root)
 */
function getDefaultSessionPath(): string {
  return getClaudePath("messages/signal-state.json");
}
const DEFAULT_TCP_HOST = "localhost";
const DEFAULT_TCP_PORT = 7583;

/**
 * Signal session state (for incremental sync)
 */
interface SignalSessionState {
  phoneNumber: string;
  lastSyncTimestamp?: number;
  conversationPositions: Record<string, number>; // conversationId -> last message timestamp
}

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Load Signal session state from file
 */
export function loadSessionState(path?: string): SignalSessionState | null {
  const effectivePath = path ?? getDefaultSessionPath();
  if (existsSync(effectivePath)) {
    try {
      return JSON.parse(readFileSync(effectivePath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Save Signal session state to file
 */
export function saveSessionState(state: SignalSessionState, path?: string): void {
  const effectivePath = path ?? getDefaultSessionPath();
  const dir = dirname(effectivePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(effectivePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Check if Signal daemon is likely running
 */
export async function isDaemonRunning(host = DEFAULT_TCP_HOST, port = DEFAULT_TCP_PORT): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Get Signal configuration status
 */
export function getSignalStatus(): {
  configured: boolean;
  phone?: string;
  hasDaemon: boolean;
  signalCliBinaryPath: string;
  signalCliBinaryExists: boolean;
} {
  const phone = process.env.SIGNAL_PHONE;

  return {
    configured: !!phone,
    phone,
    hasDaemon: false, // Will be checked asynchronously
    signalCliBinaryPath: SIGNAL_CLI_PATH,
    signalCliBinaryExists: existsSync(SIGNAL_CLI_PATH),
  };
}

/**
 * Signal Client - Communicates with signal-cli daemon via JSON-RPC
 */
export class SignalClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: SignalConfig;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }>();
  private buffer = "";
  private _connected = false;
  private sessionState: SignalSessionState;
  private sessionPath: string;

  constructor(config?: Partial<SignalConfig>, sessionPath?: string) {
    super();
    const effectiveSessionPath = sessionPath ?? getDefaultSessionPath();

    // Load config from environment or provided config
    const phone = config?.phoneNumber || process.env.SIGNAL_PHONE;
    if (!phone) {
      throw new Error(
        "Signal phone number required. Set SIGNAL_PHONE environment variable or provide phoneNumber in config."
      );
    }

    this.config = {
      phoneNumber: phone,
      configPath: config?.configPath || process.env.SIGNAL_CONFIG_PATH,
      timeout: config?.timeout || 30000,
    };

    this.sessionPath = effectiveSessionPath;

    // Load or initialize session state
    const existingState = loadSessionState(effectiveSessionPath);
    this.sessionState = existingState || {
      phoneNumber: this.config.phoneNumber,
      conversationPositions: {},
    };
  }

  /**
   * Connect to signal-cli daemon via TCP
   */
  async connect(host = DEFAULT_TCP_HOST, port = DEFAULT_TCP_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ host, port }, () => {
        this._connected = true;
        this.emit("connected");
        resolve();
      });

      this.socket.on("data", (data) => this.handleData(data));

      this.socket.on("error", (err) => {
        this._connected = false;
        this.emit("error", err);
        if (!this._connected) {
          reject(new Error(`Failed to connect to signal-cli daemon at ${host}:${port}: ${err.message}`));
        }
      });

      this.socket.on("close", () => {
        this._connected = false;
        this.emit("disconnected");
      });

      this.socket.setTimeout(this.config.timeout || 30000);
    });
  }

  /**
   * Handle incoming data from socket
   */
  private handleData(data: Buffer | string): void {
    this.buffer += typeof data === "string" ? data : data.toString();

    // Process complete JSON-RPC messages (newline-delimited)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);

        // Check if it's a response to a request
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const pending = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
        // Otherwise it's a notification/event
        else if (message.method) {
          this.handleNotification(message);
        }
      } catch (err) {
        this.emit("error", new Error(`Failed to parse JSON-RPC message: ${line}`));
      }
    }
  }

  /**
   * Handle JSON-RPC notifications (incoming messages, etc.)
   */
  private handleNotification(message: { method: string; params?: unknown }): void {
    switch (message.method) {
      case "receive":
        this.emit("message", message.params);
        break;
      default:
        this.emit("notification", message);
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.socket || !this._connected) {
      throw new Error("Not connected to signal-cli daemon");
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      this.socket!.write(JSON.stringify(request) + "\n");

      // Timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, this.config.timeout || 30000);
    });
  }

  /**
   * Get phone number
   */
  getPhoneNumber(): string {
    return this.config.phoneNumber;
  }

  /**
   * List all contacts
   * Note: When daemon started with -a <phone>, account is already bound
   */
  async listContacts(): Promise<SignalContact[]> {
    const result = await this.request<{
      name?: string;
      number?: string;
      uuid?: string;
      profileName?: string;
      blocked?: boolean;
    }[]>("listContacts");

    return (result || []).map((c) => ({
      number: c.number || "",
      name: c.name,
      profileName: c.profileName,
      blocked: c.blocked,
      uuid: c.uuid,
    }));
  }

  /**
   * List all groups
   * Note: When daemon started with -a <phone>, account is already bound
   */
  async listGroups(): Promise<SignalGroup[]> {
    const result = await this.request<{
      id?: string;
      name?: string;
      description?: string;
      members?: string[];
      admins?: string[];
      groupInviteLink?: string;
      isBlocked?: boolean;
      revision?: number;
    }[]>("listGroups");

    return (result || []).map((g) => ({
      groupId: g.id || "",
      name: g.name || "Unknown Group",
      description: g.description,
      members: g.members || [],
      admins: g.admins,
      isV2: g.revision !== undefined,
      inviteLink: g.groupInviteLink,
    }));
  }

  /**
   * Get all conversations (contacts + groups)
   */
  async getConversations(): Promise<SignalConversation[]> {
    const [contacts, groups] = await Promise.all([
      this.listContacts(),
      this.listGroups(),
    ]);

    const conversations: SignalConversation[] = [];

    // Add contacts as DM conversations
    for (const contact of contacts) {
      if (!contact.blocked && contact.number) {
        conversations.push({
          id: contact.number,
          name: contact.name || contact.profileName || contact.number,
          type: "dm",
          raw: contact,
        });
      }
    }

    // Add groups
    for (const group of groups) {
      conversations.push({
        id: group.groupId,
        name: group.name,
        type: "group",
        raw: group,
      });
    }

    return conversations;
  }

  /**
   * Receive messages (blocking - returns when messages are received)
   * Note: When daemon started with -a <phone>, account is already bound
   */
  async receive(timeout = 5, maxMessages = 100): Promise<SignalEnvelope[]> {
    const result = await this.request<SignalEnvelope[]>("receive", {
      timeout,
      maxMessages,
    });

    return result || [];
  }

  /**
   * Send a message
   * Note: When daemon started with -a <phone>, account is already bound
   */
  async sendMessage(
    recipient: string,
    message: string,
    options?: {
      attachments?: string[];
      groupId?: string;
    }
  ): Promise<void> {
    const params: Record<string, unknown> = {
      message,
    };

    if (options?.groupId) {
      params.groupId = options.groupId;
    } else {
      params.recipient = [recipient];
    }

    if (options?.attachments) {
      params.attachment = options.attachments;
    }

    await this.request("send", params);
  }

  /**
   * Get user status (check if number is registered on Signal)
   * Note: When daemon started with -a <phone>, account is already bound
   */
  async getUserStatus(numbers: string[]): Promise<Array<{ number: string; isRegistered: boolean }>> {
    const result = await this.request<Array<{ number: string; isRegistered: boolean }>>(
      "getUserStatus",
      {
        recipient: numbers,
      }
    );

    return result || [];
  }

  /**
   * Update session state after sync
   */
  updateSyncPosition(conversationId: string, timestamp: number): void {
    this.sessionState.conversationPositions[conversationId] = timestamp;
    this.sessionState.lastSyncTimestamp = Date.now();
    saveSessionState(this.sessionState, this.sessionPath);
  }

  /**
   * Get last sync position for a conversation
   */
  getSyncPosition(conversationId: string): number | undefined {
    return this.sessionState.conversationPositions[conversationId];
  }

  /**
   * Get last overall sync timestamp
   */
  getLastSyncTimestamp(): number | undefined {
    return this.sessionState.lastSyncTimestamp;
  }

  /**
   * Disconnect from daemon
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this._connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected;
  }
}

// Singleton instance
let clientInstance: SignalClient | null = null;

export function getSignalClient(): SignalClient {
  if (!clientInstance) {
    clientInstance = new SignalClient();
  }
  return clientInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetSignalClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}
