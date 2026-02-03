/**
 * Signal Sync Service
 *
 * Continuous background sync of Signal messages using:
 * 1. Daemon mode (preferred) - persistent TCP connection to signal-cli daemon
 * 2. CLI polling (fallback) - spawns signal-cli process periodically
 *
 * Usage:
 *   import { SignalSyncService } from "./services/signal-sync";
 *   const sync = new SignalSyncService();
 *   await sync.start();
 *   // ... later
 *   sync.stop();
 */

import { EventEmitter } from "events";
import {
  SignalClient,
  isDaemonRunning,
  loadSessionState,
  saveSessionState,
} from "../integrations/signal/client";
import type {
  SignalEnvelope,
  SignalConversation,
  SignalDataMessage,
  SignalSyncMessage,
} from "../integrations/signal/types";
import { createSignalThreadId } from "../integrations/signal/ids";
import { MessageStore } from "../core/store";
import { SearchIndex } from "../search/index";
import type { MessageInput, Message } from "../types";
import { Kind } from "../types";
import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { getClaudePath } from "../../../../lib/paths";

/**
 * Sync service configuration
 */
export interface SignalSyncConfig {
  /** TCP host for daemon mode. Default: localhost */
  daemonHost?: string;
  /** TCP port for daemon mode. Default: 7583 */
  daemonPort?: number;
  /** Polling interval in ms for CLI mode. Default: 30000 (30s) */
  pollInterval?: number;
  /** Receive timeout for each poll in seconds. Default: 5 */
  receiveTimeout?: number;
  /** Max reconnect attempts before giving up. Default: 10 */
  maxReconnectAttempts?: number;
  /** Backoff base in ms for reconnect. Default: 1000 */
  reconnectBackoff?: number;
  /** Whether to prefer daemon mode. Default: true */
  preferDaemon?: boolean;
  /** Auto-start daemon if not running. Default: true */
  autoStartDaemon?: boolean;
}

/**
 * Sync service statistics
 */
export interface SyncStats {
  mode: "daemon" | "cli" | "stopped";
  messagesProcessed: number;
  errors: number;
  lastSync?: Date;
  startedAt?: Date;
  reconnectAttempts: number;
}

/**
 * Signal-cli path (bundled version from signal-sdk)
 */
function getSignalCliPath(): string {
  return (
    process.env.SIGNAL_CLI_PATH ||
    join(__dirname, "../../node_modules/signal-sdk/bin/signal-cli")
  );
}

/**
 * Create account ID from phone number
 */
function createAccountId(phone: string): string {
  const normalized = phone.replace(/[\s-]/g, "");
  return `signal_${normalized.replace("+", "")}`;
}

/**
 * Create thread ID for conversation
 * Uses centralized ID generation from ids.ts
 */
function createThreadId(conversationId: string, isGroup: boolean): string {
  return createSignalThreadId(conversationId, isGroup);
}

/**
 * Create message ID from timestamp and sender
 */
function createMessageId(timestamp: number, sender: string): string {
  return `signal_live_${timestamp}_${sender.replace(/[+\s-]/g, "")}`;
}

/**
 * Signal Sync Service
 *
 * Provides continuous real-time message sync from Signal.
 * Emits events: 'message', 'error', 'connected', 'disconnected', 'sync'
 */
export class SignalSyncService extends EventEmitter {
  private config: Required<SignalSyncConfig>;
  private store: MessageStore;
  private searchIndex: SearchIndex;
  private client: SignalClient | null = null;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private stats: SyncStats;
  private conversations: Map<string, SignalConversation> = new Map();
  private myPhone: string;
  private myAccountId: string;
  private seenAccounts = new Set<string>();
  private seenThreads = new Set<string>();
  private daemonProcess: ChildProcess | null = null;

  constructor(config?: SignalSyncConfig) {
    super();

    const phone = process.env.SIGNAL_PHONE;
    if (!phone) {
      throw new Error(
        "SIGNAL_PHONE environment variable required for Signal sync"
      );
    }
    this.myPhone = phone;
    this.myAccountId = createAccountId(phone);

    this.config = {
      daemonHost: config?.daemonHost || "localhost",
      daemonPort: config?.daemonPort || 7583,
      pollInterval: config?.pollInterval || 30000,
      receiveTimeout: config?.receiveTimeout || 5,
      preferDaemon: config?.preferDaemon ?? true,
      autoStartDaemon: config?.autoStartDaemon ?? true,
      maxReconnectAttempts: config?.maxReconnectAttempts || 10,
      reconnectBackoff: config?.reconnectBackoff || 1000,
    };

    this.store = new MessageStore();
    this.searchIndex = new SearchIndex();

    this.stats = {
      mode: "stopped",
      messagesProcessed: 0,
      errors: 0,
      reconnectAttempts: 0,
    };
  }

  /**
   * Start the sync service
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log("[signal-sync] Already running");
      return;
    }

    this.running = true;
    this.stats.startedAt = new Date();
    this.stats.reconnectAttempts = 0;

    // Ensure self account exists
    await this.store.getOrCreateAccount({
      id: this.myAccountId,
      name: "Me (Signal)",
      identities: [{ platform: "signal", handle: this.myPhone }],
    });
    this.seenAccounts.add(this.myAccountId);

    // Check daemon availability BEFORE loading conversations
    // (CLI commands block when daemon is running due to database lock)
    if (this.config.preferDaemon) {
      let daemonAvailable = await isDaemonRunning(
        this.config.daemonHost,
        this.config.daemonPort
      );

      // Auto-start daemon if configured and not running
      if (!daemonAvailable && this.config.autoStartDaemon) {
        console.log("[signal-sync] Starting daemon automatically...");
        daemonAvailable = await this.spawnDaemon();
      }

      if (daemonAvailable) {
        // Skip conversation loading - daemon mode doesn't need it
        // and CLI commands would block anyway
        console.log("[signal-sync] Daemon available, skipping conversation preload");
        await this.startDaemonMode();
        return;
      } else {
        console.log(
          "[signal-sync] Daemon not available, falling back to CLI polling"
        );
      }
    }

    // Load conversations for CLI polling mode (only works when daemon isn't running)
    await this.loadConversations();

    // Start CLI polling
    this.startCliPolling();
  }

  /**
   * Spawn signal-cli daemon process
   */
  private async spawnDaemon(): Promise<boolean> {
    const signalCliPath = getSignalCliPath();
    const port = this.config.daemonPort;

    return new Promise((resolve) => {
      try {
        this.daemonProcess = spawn(signalCliPath, [
          "-a", this.myPhone,
          "daemon",
          "--tcp", `127.0.0.1:${port}`,
        ], {
          stdio: ["ignore", "pipe", "pipe"],
          detached: false,
        });

        // Give daemon time to start and listen
        let started = false;

        this.daemonProcess.stdout?.on("data", (data: Buffer) => {
          const output = data.toString();
          if (output.includes("Listening on") || output.includes("Started")) {
            started = true;
          }
        });

        this.daemonProcess.stderr?.on("data", (data: Buffer) => {
          const output = data.toString();
          // Daemon outputs status to stderr
          if (output.includes("Listening on")) {
            started = true;
          }
        });

        this.daemonProcess.on("error", (err) => {
          console.error("[signal-sync] Failed to start daemon:", err.message);
          this.daemonProcess = null;
          resolve(false);
        });

        this.daemonProcess.on("exit", (code) => {
          if (!started) {
            console.error("[signal-sync] Daemon exited with code:", code);
          }
          this.daemonProcess = null;
        });

        // Wait for daemon to be ready (check every 200ms, timeout 5s)
        let attempts = 0;
        const maxAttempts = 25;
        const checkInterval = setInterval(async () => {
          attempts++;
          const ready = await isDaemonRunning(
            this.config.daemonHost,
            this.config.daemonPort
          );
          if (ready) {
            clearInterval(checkInterval);
            console.log("[signal-sync] Daemon started successfully");
            resolve(true);
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.error("[signal-sync] Daemon failed to start within timeout");
            if (this.daemonProcess) {
              this.daemonProcess.kill();
              this.daemonProcess = null;
            }
            resolve(false);
          }
        }, 200);
      } catch (err) {
        console.error("[signal-sync] Error spawning daemon:", err);
        resolve(false);
      }
    });
  }

  /**
   * Stop the sync service
   * @param keepDaemon If true, don't kill the daemon process (let it run for other clients)
   */
  async stop(keepDaemon = false): Promise<void> {
    this.running = false;
    this.stats.mode = "stopped";

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }

    // Kill daemon if we spawned it (unless keepDaemon is true)
    if (this.daemonProcess && !keepDaemon) {
      console.log("[signal-sync] Stopping daemon process...");
      this.daemonProcess.kill("SIGTERM");
      this.daemonProcess = null;
    }

    this.emit("disconnected");
    console.log("[signal-sync] Stopped");
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Force an immediate sync (useful for manual triggers)
   */
  async syncNow(): Promise<number> {
    if (!this.running) {
      throw new Error("Sync service not running");
    }

    if (this.stats.mode === "daemon" && this.client?.isConnected()) {
      return this.pollDaemon();
    } else {
      return this.pollCli();
    }
  }

  // ===========================================================================
  // Daemon Mode
  // ===========================================================================

  private async startDaemonMode(): Promise<void> {
    try {
      this.client = new SignalClient();
      await this.client.connect(this.config.daemonHost, this.config.daemonPort);

      this.stats.mode = "daemon";
      console.log("[signal-sync] Connected to daemon");
      this.emit("connected", { mode: "daemon" });

      // Set up message handler
      this.client.on("message", (envelope: SignalEnvelope) => {
        this.handleEnvelope(envelope).catch((err) => {
          console.error("[signal-sync] Error handling message:", err);
          this.stats.errors++;
          this.emit("error", err);
        });
      });

      // Handle disconnection
      this.client.on("disconnected", () => {
        console.log("[signal-sync] Daemon disconnected");
        this.handleDisconnect();
      });

      this.client.on("error", (err) => {
        console.error("[signal-sync] Daemon error:", err);
        this.stats.errors++;
        this.emit("error", err);
      });

      // TCP daemon mode streams messages via events automatically
      // No polling needed - messages arrive via the "message" event handler above
      console.log("[signal-sync] Listening for messages via TCP stream");
    } catch (err) {
      console.error("[signal-sync] Failed to connect to daemon:", err);
      this.stats.errors++;

      // Fall back to CLI polling
      console.log("[signal-sync] Falling back to CLI polling");
      this.startCliPolling();
    }
  }

  private startDaemonPolling(): void {
    const poll = async () => {
      if (!this.running || !this.client?.isConnected()) {
        return;
      }

      try {
        const count = await this.pollDaemon();
        if (count > 0) {
          this.emit("sync", { count, mode: "daemon" });
        }
      } catch (err) {
        console.error("[signal-sync] Daemon poll error:", err);
        this.stats.errors++;
      }

      // Schedule next poll
      if (this.running && this.client?.isConnected()) {
        this.pollTimer = setTimeout(poll, this.config.pollInterval);
      }
    };

    // Start first poll immediately
    poll();
  }

  private async pollDaemon(): Promise<number> {
    if (!this.client?.isConnected()) {
      return 0;
    }

    const envelopes = await this.client.receive(this.config.receiveTimeout, 100);
    let processed = 0;

    for (const envelope of envelopes) {
      try {
        const messages = await this.handleEnvelope(envelope);
        processed += messages.length;
      } catch (err) {
        console.error("[signal-sync] Error processing envelope:", err);
        this.stats.errors++;
      }
    }

    if (processed > 0) {
      this.stats.lastSync = new Date();
    }

    return processed;
  }

  // ===========================================================================
  // CLI Polling Mode
  // ===========================================================================

  private startCliPolling(): void {
    this.stats.mode = "cli";
    console.log(
      `[signal-sync] Starting CLI polling (interval: ${this.config.pollInterval}ms)`
    );
    this.emit("connected", { mode: "cli" });

    const poll = async () => {
      if (!this.running) {
        return;
      }

      try {
        const count = await this.pollCli();
        if (count > 0) {
          this.emit("sync", { count, mode: "cli" });
        }
      } catch (err) {
        console.error("[signal-sync] CLI poll error:", err);
        this.stats.errors++;
        this.emit("error", err);
      }
    };

    // First poll immediately
    poll();

    // Then on interval
    this.pollTimer = setInterval(poll, this.config.pollInterval);
  }

  private async pollCli(): Promise<number> {
    const envelopes = await this.receiveViaCli();
    let processed = 0;

    for (const envelope of envelopes) {
      try {
        const messages = await this.handleEnvelope(envelope);
        processed += messages.length;
      } catch (err) {
        console.error("[signal-sync] Error processing envelope:", err);
        this.stats.errors++;
      }
    }

    if (processed > 0) {
      this.stats.lastSync = new Date();
    }

    return processed;
  }

  private async receiveViaCli(): Promise<SignalEnvelope[]> {
    return new Promise((resolve, reject) => {
      const cliPath = getSignalCliPath();
      const args = [
        "-a",
        this.myPhone,
        "--output=json",
        "receive",
        "-t",
        String(this.config.receiveTimeout),
      ];

      const proc = spawn(cliPath, args);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        // Exit code 0 with empty stdout is normal (no new messages)
        if (code !== 0 && !stdout) {
          if (code === 0) {
            resolve([]);
            return;
          }
          reject(new Error(`signal-cli receive failed: ${stderr}`));
          return;
        }

        const envelopes: SignalEnvelope[] = [];
        const lines = stdout.trim().split("\n").filter(Boolean);

        for (const line of lines) {
          if (
            line.startsWith("INFO") ||
            line.startsWith("WARN") ||
            line.startsWith("DEBUG")
          ) {
            continue;
          }

          try {
            const parsed = JSON.parse(line);
            if (parsed.envelope) {
              envelopes.push(parsed.envelope);
            }
          } catch {
            // Skip non-JSON lines
          }
        }

        resolve(envelopes);
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn signal-cli: ${err.message}`));
      });
    });
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private async handleEnvelope(envelope: SignalEnvelope): Promise<Message[]> {
    const messages: Message[] = [];

    // Extract messages from envelope
    const extracted = this.extractMessagesFromEnvelope(envelope);

    for (const msg of extracted) {
      // Skip empty messages
      if (!msg.text?.trim()) {
        continue;
      }

      // Get or create sender account
      const senderAccountId = msg.isOutgoing
        ? this.myAccountId
        : createAccountId(msg.sender);

      if (!this.seenAccounts.has(senderAccountId)) {
        const conv = this.conversations.get(msg.sender);
        await this.store.getOrCreateAccount({
          id: senderAccountId,
          name: conv?.name || msg.sender,
          identities: [{ platform: "signal", handle: msg.sender }],
        });
        this.seenAccounts.add(senderAccountId);
      }

      // Determine thread
      const conversationId = msg.isGroup
        ? msg.groupId!
        : msg.isOutgoing
        ? msg.recipient!
        : msg.sender;
      const threadId = createThreadId(conversationId, msg.isGroup);

      // Ensure thread exists
      if (!this.seenThreads.has(threadId)) {
        const conv = this.conversations.get(conversationId);
        await this.store.getOrCreateThread({
          id: threadId,
          title: conv?.name || conversationId,
          type: msg.isGroup ? "group" : "dm",
          participants: [this.myAccountId],
          source: {
            platform: "signal",
            platform_id: conversationId,
          },
        });
        this.seenThreads.add(threadId);
      }

      // Build message input
      const input: MessageInput = {
        kind: Kind.Signal,
        content: msg.text,
        account_id: senderAccountId,
        author: {
          name: msg.isOutgoing
            ? "Me"
            : this.conversations.get(msg.sender)?.name || msg.sender,
          handle: msg.sender,
        },
        created_at: msg.timestamp,
        refs: {
          thread_id: threadId,
          reply_to: msg.replyToTimestamp
            ? createMessageId(msg.replyToTimestamp, "unknown")
            : undefined,
        },
        source: {
          platform: "signal",
          platform_id: createMessageId(msg.timestamp, msg.sender),
        },
        tags: msg.isOutgoing
          ? [["direction", "outgoing"], ["source", "live"]]
          : [["direction", "incoming"], ["source", "live"]],
      };

      // Create message
      const message = await this.store.createMessage(input);

      // Index for search
      this.searchIndex.index(message);

      messages.push(message);
      this.stats.messagesProcessed++;

      // Emit message event
      this.emit("message", message);
    }

    return messages;
  }

  private extractMessagesFromEnvelope(
    envelope: SignalEnvelope
  ): Array<{
    text: string;
    timestamp: number;
    sender: string;
    isOutgoing: boolean;
    isGroup: boolean;
    groupId?: string;
    recipient?: string;
    replyToTimestamp?: number;
  }> {
    const messages: Array<{
      text: string;
      timestamp: number;
      sender: string;
      isOutgoing: boolean;
      isGroup: boolean;
      groupId?: string;
      recipient?: string;
      replyToTimestamp?: number;
    }> = [];

    // Regular incoming message
    if (envelope.dataMessage?.message) {
      const dm = envelope.dataMessage;
      messages.push({
        text: dm.message!,
        timestamp: dm.timestamp || envelope.timestamp || Date.now(),
        sender: envelope.source || "",
        isOutgoing: false,
        isGroup: !!dm.groupInfo,
        groupId: dm.groupInfo?.groupId,
        replyToTimestamp: dm.quote?.id,
      });
    }

    // Sync message (sent from another device)
    if (envelope.syncMessage?.sentMessage?.message) {
      const sm = envelope.syncMessage.sentMessage;
      messages.push({
        text: sm.message!,
        timestamp: sm.timestamp || Date.now(),
        sender: this.myPhone,
        isOutgoing: true,
        isGroup: !!sm.groupInfo,
        groupId: sm.groupInfo?.groupId,
        recipient: sm.destination,
      });
    }

    return messages;
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  private async loadConversations(): Promise<void> {
    try {
      const [contacts, groups] = await Promise.all([
        this.listContactsViaCli(),
        this.listGroupsViaCli(),
      ]);

      for (const conv of [...contacts, ...groups]) {
        this.conversations.set(conv.id, conv);
      }

      console.log(`[signal-sync] Loaded ${this.conversations.size} conversations`);
    } catch (err) {
      console.error("[signal-sync] Failed to load conversations:", err);
    }
  }

  private async listContactsViaCli(): Promise<SignalConversation[]> {
    return new Promise((resolve, reject) => {
      const cliPath = getSignalCliPath();
      const args = ["-a", this.myPhone, "--output=json", "listContacts"];

      const proc = spawn(cliPath, args);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0 && !stdout) {
          reject(new Error(`signal-cli listContacts failed: ${stderr}`));
          return;
        }

        const conversations: SignalConversation[] = [];

        try {
          const contacts = JSON.parse(stdout.trim());
          if (Array.isArray(contacts)) {
            for (const contact of contacts) {
              if (contact.number) {
                const displayName =
                  contact.name ||
                  (contact.profile?.givenName && contact.profile?.familyName
                    ? `${contact.profile.givenName} ${contact.profile.familyName}`
                    : contact.profile?.givenName) ||
                  contact.number;
                conversations.push({
                  id: contact.number,
                  name: displayName,
                  type: "dm",
                  raw: contact,
                });
              }
            }
          }
        } catch {
          // Try line-by-line fallback
          const lines = stdout.trim().split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const contact = JSON.parse(line);
              if (contact.number) {
                conversations.push({
                  id: contact.number,
                  name: contact.name || contact.number,
                  type: "dm",
                  raw: contact,
                });
              }
            } catch {
              // Skip
            }
          }
        }

        resolve(conversations);
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn signal-cli: ${err.message}`));
      });
    });
  }

  private async listGroupsViaCli(): Promise<SignalConversation[]> {
    return new Promise((resolve, reject) => {
      const cliPath = getSignalCliPath();
      const args = ["-a", this.myPhone, "--output=json", "listGroups"];

      const proc = spawn(cliPath, args);
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0 && !stdout) {
          reject(new Error(`signal-cli listGroups failed: ${stderr}`));
          return;
        }

        const conversations: SignalConversation[] = [];

        try {
          const groups = JSON.parse(stdout.trim());
          if (Array.isArray(groups)) {
            for (const group of groups) {
              if (group.id) {
                conversations.push({
                  id: group.id,
                  name: group.name || "Unknown Group",
                  type: "group",
                  raw: group,
                });
              }
            }
          }
        } catch {
          // Line-by-line fallback
          const lines = stdout.trim().split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const group = JSON.parse(line);
              if (group.id) {
                conversations.push({
                  id: group.id,
                  name: group.name || "Unknown Group",
                  type: "group",
                  raw: group,
                });
              }
            } catch {
              // Skip
            }
          }
        }

        resolve(conversations);
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn signal-cli: ${err.message}`));
      });
    });
  }

  private async handleDisconnect(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.stats.reconnectAttempts++;

    if (this.stats.reconnectAttempts > this.config.maxReconnectAttempts) {
      console.log(
        "[signal-sync] Max reconnect attempts reached, falling back to CLI"
      );
      this.startCliPolling();
      return;
    }

    const backoff =
      this.config.reconnectBackoff * Math.pow(2, this.stats.reconnectAttempts - 1);
    console.log(
      `[signal-sync] Reconnecting in ${backoff}ms (attempt ${this.stats.reconnectAttempts})`
    );

    await new Promise((resolve) => setTimeout(resolve, backoff));

    if (!this.running) {
      return;
    }

    try {
      const daemonAvailable = await isDaemonRunning(
        this.config.daemonHost,
        this.config.daemonPort
      );

      if (daemonAvailable) {
        await this.startDaemonMode();
      } else {
        console.log("[signal-sync] Daemon not available, using CLI polling");
        this.startCliPolling();
      }
    } catch (err) {
      console.error("[signal-sync] Reconnect failed:", err);
      this.handleDisconnect();
    }
  }
}

/**
 * Singleton instance for global access
 */
let syncService: SignalSyncService | null = null;

/**
 * Get or create the global sync service instance
 */
export function getSignalSyncService(
  config?: SignalSyncConfig
): SignalSyncService {
  if (!syncService) {
    syncService = new SignalSyncService(config);
  }
  return syncService;
}

/**
 * Reset the singleton (for testing)
 */
export async function resetSignalSyncService(): Promise<void> {
  if (syncService) {
    await syncService.stop();
    syncService = null;
  }
}
