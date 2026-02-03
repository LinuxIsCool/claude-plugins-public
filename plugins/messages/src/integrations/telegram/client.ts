/**
 * Telegram API Client
 *
 * Handles authentication and API calls to Telegram using MTProto.
 * Uses GramJS (telegram package) for the protocol implementation.
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";

import { getClaudePath } from "../../../../../lib/paths";

/**
 * Get the Telegram session path (anchored to repo root)
 */
function getDefaultSessionPath(): string {
  return getClaudePath("messages/telegram-session.txt");
}

export interface TelegramCredentials {
  apiId: number;
  apiHash: string;
  phone: string;
}

export interface TelegramDialog {
  id: string;
  title: string;
  type: "user" | "group" | "channel";
  unreadCount: number;
  lastMessageDate?: Date;
}

export interface TelegramMessage {
  id: number;
  date: Date;
  text: string;
  fromId: string;
  fromName: string;
  isOutgoing: boolean;
  replyToMsgId?: number;
  mediaType?: string;
}

/**
 * Load credentials from environment variables
 */
export function loadCredentials(): TelegramCredentials {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const phone = process.env.TELEGRAM_PHONE;

  if (!apiId || !apiHash || !phone) {
    throw new Error(
      "Missing Telegram credentials. Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE in .env"
    );
  }

  return {
    apiId: parseInt(apiId, 10),
    apiHash,
    phone,
  };
}

/**
 * Load saved session string
 */
export function loadSession(sessionPath?: string): string {
  const effectivePath = sessionPath ?? getDefaultSessionPath();
  if (existsSync(effectivePath)) {
    return readFileSync(effectivePath, "utf-8").trim();
  }
  return "";
}

/**
 * Save session string for reuse
 */
export function saveSession(session: string, sessionPath?: string): void {
  const effectivePath = sessionPath ?? getDefaultSessionPath();
  const dir = dirname(effectivePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(effectivePath, session, "utf-8");
}

/**
 * Check if we have a valid saved session
 */
export function hasSession(sessionPath?: string): boolean {
  const effectivePath = sessionPath ?? getDefaultSessionPath();
  return existsSync(effectivePath) && loadSession(effectivePath).length > 0;
}

/**
 * Telegram API Client wrapper
 */
export class TelegramApiClient {
  private client: TelegramClient | null = null;
  private credentials: TelegramCredentials;
  private sessionPath: string;

  constructor(sessionPath?: string) {
    this.credentials = loadCredentials();
    this.sessionPath = sessionPath ?? getDefaultSessionPath();
  }

  /**
   * Connect to Telegram (requires existing session)
   */
  async connect(): Promise<void> {
    const sessionString = loadSession(this.sessionPath);
    if (!sessionString) {
      throw new Error(
        "No session found. Run 'bun plugins/messages/src/cli.ts telegram-auth' first."
      );
    }

    const session = new StringSession(sessionString);
    this.client = new TelegramClient(session, this.credentials.apiId, this.credentials.apiHash, {
      connectionRetries: 5,
    });

    await this.client.connect();

    if (!(await this.client.isUserAuthorized())) {
      throw new Error("Session expired. Run 'telegram-auth' again.");
    }
  }

  /**
   * Interactive authentication flow
   */
  async authenticate(
    callbacks: {
      onCodeRequest: () => Promise<string>;
      onPasswordRequest?: () => Promise<string>;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    const session = new StringSession("");
    this.client = new TelegramClient(session, this.credentials.apiId, this.credentials.apiHash, {
      connectionRetries: 5,
    });

    await this.client.start({
      phoneNumber: this.credentials.phone,
      phoneCode: callbacks.onCodeRequest,
      password: callbacks.onPasswordRequest,
      onError: callbacks.onError || ((err) => console.error("Auth error:", err)),
    });

    // Save session for future use
    const sessionString = this.client.session.save() as unknown as string;
    saveSession(sessionString, this.sessionPath);
  }

  /**
   * Get all dialogs (chats)
   */
  async getDialogs(): Promise<TelegramDialog[]> {
    if (!this.client) throw new Error("Not connected");

    const dialogs: TelegramDialog[] = [];

    for await (const dialog of this.client.iterDialogs({})) {
      let type: "user" | "group" | "channel" = "user";

      if (dialog.isGroup) {
        type = "group";
      } else if (dialog.isChannel) {
        type = "channel";
      }

      dialogs.push({
        id: dialog.id?.toString() || "",
        title: dialog.title || "Unknown",
        type,
        unreadCount: dialog.unreadCount || 0,
        lastMessageDate: dialog.date ? new Date(dialog.date * 1000) : undefined,
      });
    }

    return dialogs;
  }

  /**
   * Get messages from a specific chat
   */
  async getMessages(
    dialogId: string,
    options: {
      limit?: number;
      offsetDate?: Date;
      minDate?: Date;
    } = {}
  ): Promise<TelegramMessage[]> {
    if (!this.client) throw new Error("Not connected");

    const { limit = 100, offsetDate, minDate } = options;
    const messages: TelegramMessage[] = [];

    const entity = await this.client.getEntity(dialogId);

    for await (const message of this.client.iterMessages(entity, {
      limit,
      offsetDate: offsetDate ? Math.floor(offsetDate.getTime() / 1000) : undefined,
    })) {
      // Skip if before minDate
      if (minDate && message.date && new Date(message.date * 1000) < minDate) {
        break;
      }

      // Skip non-text messages for now
      if (!message.text) continue;

      // Get sender info
      let fromId = "";
      let fromName = "Unknown";

      if (message.fromId) {
        if (message.fromId instanceof Api.PeerUser) {
          fromId = message.fromId.userId.toString();
          try {
            const sender = await this.client.getEntity(message.fromId);
            if (sender instanceof Api.User) {
              fromName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || sender.username || "Unknown";
            }
          } catch {
            // Ignore entity fetch errors
          }
        } else if (message.fromId instanceof Api.PeerChannel) {
          fromId = message.fromId.channelId.toString();
        }
      }

      messages.push({
        id: message.id,
        date: new Date(message.date * 1000),
        text: message.text,
        fromId,
        fromName,
        isOutgoing: message.out || false,
        replyToMsgId: message.replyTo?.replyToMsgId,
        mediaType: message.media ? message.media.className : undefined,
      });
    }

    return messages;
  }

  /**
   * Get current user info
   */
  async getMe(): Promise<{ id: string; name: string; phone: string }> {
    if (!this.client) throw new Error("Not connected");

    const me = await this.client.getMe();
    if (!(me instanceof Api.User)) {
      throw new Error("Failed to get user info");
    }

    return {
      id: me.id.toString(),
      name: [me.firstName, me.lastName].filter(Boolean).join(" ") || me.username || "Unknown",
      phone: me.phone || "",
    };
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && (this.client.connected ?? false);
  }
}

// Singleton instance
let clientInstance: TelegramApiClient | null = null;

export function getTelegramClient(): TelegramApiClient {
  if (!clientInstance) {
    clientInstance = new TelegramApiClient();
  }
  return clientInstance;
}
