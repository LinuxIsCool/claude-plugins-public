/**
 * WhatsApp Client
 *
 * Wrapper around Baileys providing a clean API for:
 * - QR code authentication
 * - Connection management
 * - Chat and message fetching
 * - Event handling
 */

import { EventEmitter } from "events";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  BaileysEventMap,
  ConnectionState,
  proto,
  WASocket,
} from "@whiskeysockets/baileys";
// @ts-ignore - qrcode-terminal has no types
import qrcode from "qrcode-terminal";
import { useFileAuthState, hasSession, clearSession, getSessionInfo } from "./auth-state";
import type {
  WhatsAppConfig,
  WhatsAppChat,
  WhatsAppMessage,
  WhatsAppMessageType,
  WhatsAppStatus,
  WhatsAppConnectionState,
  QRCodeEvent,
} from "./types";

// Default configuration
const DEFAULT_CONFIG: Required<WhatsAppConfig> = {
  sessionName: "default",
  authStatePath: undefined as unknown as string, // Will use default from auth-state
  qrTimeout: 60000,
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectBackoff: 1000,
  printQRInTerminal: true,
};

/**
 * WhatsApp Client - Baileys wrapper with clean API
 */
export class WhatsAppClient extends EventEmitter {
  private config: Required<WhatsAppConfig>;
  private socket: WASocket | null = null;
  private connectionState: WhatsAppConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private saveCreds: (() => Promise<void>) | null = null;
  private intentionalDisconnect = false; // Track if we initiated disconnect

  constructor(config: WhatsAppConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to WhatsApp
   *
   * If no existing session, will generate QR code for scanning.
   * Emits events: 'qr', 'authenticated', 'connected', 'disconnected', 'error'
   */
  async connect(): Promise<void> {
    if (this.socket) {
      console.log("[whatsapp-client] Already connected or connecting");
      return;
    }

    this.connectionState = "connecting";
    this.intentionalDisconnect = false; // Reset flag on new connection

    try {
      // Load auth state
      const { state, saveCreds } = await useFileAuthState(this.config.sessionName);
      this.saveCreds = saveCreds;

      // Get latest Baileys version info
      const { version } = await fetchLatestBaileysVersion();

      // Create a minimal logger that suppresses most output
      const logger = {
        level: "silent" as const,
        child: () => logger,
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: (...args: unknown[]) => console.warn("[whatsapp]", ...args),
        error: (...args: unknown[]) => console.error("[whatsapp]", ...args),
        fatal: (...args: unknown[]) => console.error("[whatsapp]", ...args),
      };

      // Create socket with recommended settings to reduce 401 errors
      // See: https://github.com/WhiskeySockets/Baileys/issues/2110
      // Note: printQRInTerminal deprecated in Baileys 7.x - we handle QR in connection.update
      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
        },
        generateHighQualityLinkPreview: false,
        logger: logger as any,
        // Stability settings to reduce 401 stream errors
        markOnlineOnConnect: true,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 250,
      }) as unknown as WASocket;

      // Set up event handlers
      this.setupEventHandlers();
    } catch (error) {
      this.connectionState = "disconnected";
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Disconnect from WhatsApp
   */
  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    // Mark as intentional so we don't clear session on 401 errors
    this.intentionalDisconnect = true;

    try {
      this.socket.end(undefined);
    } catch {
      // Ignore errors during disconnect
    }

    this.socket = null;
    this.connectionState = "disconnected";
    this.emit("disconnected");
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected";
  }

  /**
   * Get current connection status
   */
  getStatus(): WhatsAppStatus {
    const sessionInfo = getSessionInfo(this.config.sessionName);

    return {
      state: this.connectionState,
      isAuthenticated: sessionInfo.exists,
      hasSession: hasSession(this.config.sessionName),
      phoneNumber: sessionInfo.phoneNumber,
    };
  }

  /**
   * Get all chats
   *
   * Note: In newer Baileys versions, chats are received via events.
   * This method returns chats accumulated from the chats.upsert event.
   */
  async getChats(): Promise<WhatsAppChat[]> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    // Chats are populated via events - return what we have accumulated
    // The caller should wait for initial sync to complete
    return this.chatsCache;
  }

  // Cache for chats received via events
  private chatsCache: WhatsAppChat[] = [];

  /**
   * Fetch message history from a chat
   *
   * Note: In newer Baileys, message history comes via messages.upsert events
   * with type "append". Historical fetch is limited.
   */
  async fetchMessageHistory(
    chatId: string,
    _options: { limit?: number; before?: string } = {}
  ): Promise<WhatsAppMessage[]> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    // In newer Baileys versions, historical messages come via events
    // Return cached messages for this chat
    return this.messagesCache.get(chatId) || [];
  }

  // Cache for messages received via events
  private messagesCache: Map<string, WhatsAppMessage[]> = new Map();

  /**
   * Get current user info
   */
  getMe(): { jid: string; name: string; phone: string } | null {
    if (!this.socket?.user) {
      return null;
    }

    const user = this.socket.user;
    const jid = user.id;
    const phone = jid.split(":")[0].split("@")[0];

    return {
      jid,
      name: user.name || phone,
      phone,
    };
  }

  /**
   * Clear session and force re-authentication
   */
  async logout(): Promise<void> {
    await this.disconnect();
    clearSession(this.config.sessionName);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Set up Baileys event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection updates (QR code, connection state)
    this.socket.ev.on("connection.update", (update) => {
      this.handleConnectionUpdate(update);
    });

    // Credential updates (save after auth changes)
    this.socket.ev.on("creds.update", async () => {
      console.log("[whatsapp-client] creds.update event fired, saving credentials...");
      if (this.saveCreds) {
        try {
          await this.saveCreds();
          console.log("[whatsapp-client] Credentials saved successfully");
        } catch (err) {
          console.error("[whatsapp-client] Failed to save credentials:", err);
        }
      } else {
        console.warn("[whatsapp-client] saveCreds not set, cannot save credentials");
      }
    });

    // New messages
    this.socket.ev.on("messages.upsert", (upsert) => {
      this.handleMessagesUpsert(upsert);
    });

    // Chat updates
    this.socket.ev.on("chats.update", (updates) => {
      for (const update of updates) {
        this.emit("chat-update", update);
      }
    });

    // Chats received (initial sync and new chats)
    this.socket.ev.on("chats.upsert", (chats) => {
      this.handleChatsUpsert(chats);
    });
  }

  /**
   * Handle incoming chats (initial sync)
   */
  private handleChatsUpsert(chats: unknown[]): void {
    for (const chat of chats) {
      const waChat = chat as any;
      const id = waChat.id;
      if (!id) continue;

      // Determine chat type from JID
      let type: "dm" | "group" | "broadcast" = "dm";
      if (id.includes("@g.us")) {
        type = "group";
      } else if (id.includes("@broadcast")) {
        type = "broadcast";
      }

      const existingIndex = this.chatsCache.findIndex((c) => c.id === id);
      const chatEntry: WhatsAppChat = {
        id,
        name: waChat.name || waChat.subject || extractPhoneFromJid(id),
        type,
        lastMessageAt: waChat.conversationTimestamp
          ? Number(waChat.conversationTimestamp) * 1000
          : undefined,
        unreadCount: waChat.unreadCount || 0,
        isArchived: waChat.archived || false,
        isMuted: waChat.mute !== undefined,
        raw: waChat,
      };

      if (existingIndex >= 0) {
        this.chatsCache[existingIndex] = chatEntry;
      } else {
        this.chatsCache.push(chatEntry);
      }
    }

    // Sort by last message time
    this.chatsCache.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    // QR code generated
    if (qr) {
      this.connectionState = "qr";

      const qrEvent: QRCodeEvent = {
        qr,
        timestamp: new Date(),
        expiresAt: new Date(Date.now() + this.config.qrTimeout),
      };

      this.emit("qr", qrEvent);

      // Print QR to terminal (Baileys 7.x deprecated printQRInTerminal option)
      if (this.config.printQRInTerminal) {
        qrcode.generate(qr, { small: true });
      }
    }

    // Connection state change
    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

      // If we intentionally disconnected, don't auto-reconnect or clear session
      if (this.intentionalDisconnect) {
        this.connectionState = "disconnected";
        this.emit("disconnected", { statusCode, shouldReconnect: false });
        return;
      }

      // 401 errors are often transient (WhatsApp server issues), not actual logouts
      // Only treat as permanent logout after exhausting reconnect attempts
      // See: https://github.com/WhiskeySockets/Baileys/issues/2110
      const shouldReconnect = this.config.autoReconnect;

      this.connectionState = "disconnected";
      this.emit("disconnected", { statusCode, shouldReconnect });

      if (shouldReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.connectionState = "reconnecting";
        this.emit("reconnecting", { attempt: this.reconnectAttempts });

        // Exponential backoff (longer delays for 401 to let server settle)
        const baseDelay = statusCode === DisconnectReason.loggedOut
          ? this.config.reconnectBackoff * 2
          : this.config.reconnectBackoff;
        const delay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => {
          this.socket = null; // Clear old socket
          this.connect().catch((err) => {
            this.emit("error", err);
          });
        }, Math.min(delay, 60000));
      } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
        // NEVER auto-clear session - credentials should persist like other messaging systems
        // User can manually run whatsapp-logout if they want to re-authenticate
        this.emit("error", new Error("Connection failed after max retries. Try again later or run 'whatsapp-logout' to re-authenticate."));
      }
    } else if (connection === "open") {
      this.connectionState = "connected";
      this.reconnectAttempts = 0;
      this.emit("connected");
      this.emit("authenticated");
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessagesUpsert(upsert: BaileysEventMap["messages.upsert"]): void {
    const { messages, type } = upsert;

    for (const msg of messages) {
      // Skip status updates and protocol messages
      if (!msg.message || msg.key.remoteJid === "status@broadcast") {
        continue;
      }

      const chatId = msg.key.remoteJid!;
      const transformed = this.transformMessage(msg, chatId);

      this.emit("message", {
        message: transformed,
        isNew: type === "notify", // "notify" = new message, "append" = history
      });
    }
  }

  /**
   * Transform Baileys message to our format
   */
  private transformMessage(msg: proto.IWebMessageInfo, chatId: string): WhatsAppMessage {
    const key = msg.key;
    const content = msg.message;

    // Extract text content
    let text: string | undefined;
    let caption: string | undefined;
    let messageType: WhatsAppMessageType = "unknown";

    if (content?.conversation) {
      text = content.conversation;
      messageType = "text";
    } else if (content?.extendedTextMessage?.text) {
      text = content.extendedTextMessage.text;
      messageType = "text";
    } else if (content?.imageMessage) {
      caption = content.imageMessage.caption || undefined;
      messageType = "image";
    } else if (content?.videoMessage) {
      caption = content.videoMessage.caption || undefined;
      messageType = "video";
    } else if (content?.audioMessage) {
      messageType = "audio";
    } else if (content?.documentMessage) {
      caption = content.documentMessage.fileName || undefined;
      messageType = "document";
    } else if (content?.stickerMessage) {
      messageType = "sticker";
    } else if (content?.locationMessage) {
      messageType = "location";
      text = `Location: ${content.locationMessage.degreesLatitude}, ${content.locationMessage.degreesLongitude}`;
    } else if (content?.contactMessage) {
      messageType = "contact";
      text = content.contactMessage.displayName || "Contact";
    } else if (content?.reactionMessage) {
      messageType = "reaction";
      text = content.reactionMessage.text || "";
    }

    // Get sender info
    const fromMe = key.fromMe || false;
    let senderJid = key.participant || key.remoteJid || "";
    if (fromMe && this.socket?.user) {
      senderJid = this.socket.user.id;
    }

    // Get quoted message ID if this is a reply
    let quotedMessageId: string | undefined;
    if (content?.extendedTextMessage?.contextInfo?.stanzaId) {
      quotedMessageId = content.extendedTextMessage.contextInfo.stanzaId;
    }

    return {
      id: key.id || "",
      chatId,
      timestamp: (msg.messageTimestamp as number) * 1000 || Date.now(),
      fromMe,
      senderJid,
      senderName: msg.pushName || extractPhoneFromJid(senderJid),
      text,
      caption,
      messageType,
      quotedMessageId,
      mentions: content?.extendedTextMessage?.contextInfo?.mentionedJid || undefined,
      isForwarded: content?.extendedTextMessage?.contextInfo?.isForwarded || false,
      raw: msg,
    };
  }
}

// ===========================================================================
// Helper Functions
// ===========================================================================

/**
 * Extract phone number from JID
 */
function extractPhoneFromJid(jid: string): string {
  if (!jid) return "Unknown";
  // Format: 1234567890@s.whatsapp.net or 1234567890:0@s.whatsapp.net
  const phone = jid.split("@")[0].split(":")[0];
  return phone || "Unknown";
}

// ===========================================================================
// Singleton Instance
// ===========================================================================

let clientInstance: WhatsAppClient | null = null;

/**
 * Get or create WhatsApp client instance
 */
export function getWhatsAppClient(config?: WhatsAppConfig): WhatsAppClient {
  if (!clientInstance) {
    clientInstance = new WhatsAppClient(config);
  }
  return clientInstance;
}

/**
 * Reset the singleton (useful for testing or re-auth)
 */
export function resetWhatsAppClient(): void {
  if (clientInstance) {
    clientInstance.disconnect().catch(() => {});
    clientInstance = null;
  }
}

/**
 * Check if WhatsApp is available (has session)
 */
export function isWhatsAppAvailable(sessionName = "default"): boolean {
  return hasSession(sessionName);
}

/**
 * Get WhatsApp status without connecting
 */
export function getWhatsAppStatus(sessionName = "default"): WhatsAppStatus {
  const sessionInfo = getSessionInfo(sessionName);

  return {
    state: "disconnected",
    isAuthenticated: sessionInfo.exists,
    hasSession: sessionInfo.exists,
    phoneNumber: sessionInfo.phoneNumber,
  };
}
