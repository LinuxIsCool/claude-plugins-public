/**
 * KDE Connect SMS Client
 *
 * Wraps the KDE Connect D-Bus interface for SMS access.
 * Uses gdbus subprocess calls (similar to Signal adapter's signal-cli pattern).
 *
 * D-Bus Service: org.kde.kdeconnect
 * D-Bus Interface: org.kde.kdeconnect.device.conversations
 *
 * Prerequisites:
 * - KDE Connect installed and running (kdeconnectd)
 * - Android device paired with SMS plugin enabled
 */

import { spawn, execSync, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { createInterface, Interface as ReadlineInterface } from "readline";
import type {
  KdeConnectDevice,
  KdeConnectConversation,
  KdeConnectMessage,
  KdeConnectStatus,
} from "./types";

// =============================================================================
// Constants
// =============================================================================

const KDECONNECT_SERVICE = "org.kde.kdeconnect";
const KDECONNECT_PATH = "/modules/kdeconnect";

// =============================================================================
// D-Bus Utilities
// =============================================================================

/**
 * Execute a gdbus call and return the result
 */
async function dbusCall(
  objectPath: string,
  interfaceName: string,
  method: string,
  args: string[] = []
): Promise<string> {
  return new Promise((resolve, reject) => {
    const gdbus = spawn("gdbus", [
      "call",
      "--session",
      "--dest",
      KDECONNECT_SERVICE,
      "--object-path",
      objectPath,
      "--method",
      `${interfaceName}.${method}`,
      ...args,
    ]);

    let stdout = "";
    let stderr = "";

    gdbus.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    gdbus.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    gdbus.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`gdbus call failed: ${stderr || `exit code ${code}`}`));
      } else {
        resolve(stdout.trim());
      }
    });

    gdbus.on("error", (err) => {
      reject(new Error(`Failed to spawn gdbus: ${err.message}`));
    });
  });
}

/**
 * Get a D-Bus property value
 */
async function dbusGetProperty(
  objectPath: string,
  interfaceName: string,
  property: string
): Promise<string> {
  return dbusCall(objectPath, "org.freedesktop.DBus.Properties", "Get", [
    interfaceName,
    property,
  ]);
}

/**
 * Parse GVariant output from gdbus
 * This is a simplified parser for common patterns
 */
function parseGVariant(output: string): unknown {
  // Remove outer parentheses if present (gdbus wraps return values)
  let cleaned = output.trim();
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Handle empty array
  if (cleaned === "@a{sv} {}" || cleaned === "[]" || cleaned === "@as []") {
    return [];
  }

  // Strip trailing comma (GVariant tuple notation)
  if (cleaned.endsWith(",")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Strip GVariant type annotation wrapper <'...'> or <...>
  if (cleaned.startsWith("<") && cleaned.endsWith(">")) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Handle boolean
  if (cleaned === "true") return true;
  if (cleaned === "false") return false;

  // Handle string (single quotes in GVariant)
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    return cleaned.slice(1, -1);
  }

  // Handle array of strings like ['a', 'b', 'c']
  if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
    const inner = cleaned.slice(1, -1).trim();
    if (!inner) return [];

    // Split by comma, handle quoted strings
    const items: string[] = [];
    let current = "";
    let inQuote = false;

    for (const char of inner) {
      if (char === "'" && !inQuote) {
        inQuote = true;
      } else if (char === "'" && inQuote) {
        inQuote = false;
        items.push(current);
        current = "";
      } else if (char === "," && !inQuote) {
        // Skip
      } else if (inQuote) {
        current += char;
      }
    }

    return items;
  }

  // Return as-is for complex types (caller will handle)
  return cleaned;
}

/**
 * Parse activeConversations output
 * Format: ([<(isMultitarget, body, addresses, date, type, read, threadId, uriId, ?, attachments)>, ...])
 *
 * Each entry contains the LAST message in that conversation.
 * - isMultitarget: 1=DM, 3=group
 * - type: 1=inbox (incoming), 2=sent (outgoing)
 */
function parseActiveConversations(output: string): Array<{
  threadId: number;
  body: string;
  addresses: string[];
  date: number;
  isRead: boolean;
  isMultitarget: boolean;
  type: 1 | 2;  // 1=incoming, 2=outgoing
}> {
  const conversations: Array<{
    threadId: number;
    body: string;
    addresses: string[];
    date: number;
    isRead: boolean;
    isMultitarget: boolean;
    type: 1 | 2;
  }> = [];

  // Match each conversation tuple: <(...)>
  // Use regex to find the key fields
  // Groups: 1=isMultitarget, 2=body, 3=addresses, 4=date, 5=type, 6=read, 7=threadId
  const tuplePattern = /<\((\d+),\s*'([^']*)',\s*\[([^\]]*)\],\s*int64\s+(\d+),\s*(\d+),\s*(\d+),\s*int64\s+(\d+)/g;

  let match;
  while ((match = tuplePattern.exec(output)) !== null) {
    const [, isMultitargetStr, body, addressesStr, dateStr, typeStr, readStr, threadIdStr] = match;

    // Parse addresses like "('+16507979790',)"
    const addresses: string[] = [];
    const addrPattern = /'\+?(\d+)'/g;
    let addrMatch;
    while ((addrMatch = addrPattern.exec(addressesStr)) !== null) {
      addresses.push(addrMatch[1]);
    }

    conversations.push({
      threadId: parseInt(threadIdStr, 10),
      body: body || "",
      addresses,
      date: parseInt(dateStr, 10),
      isRead: readStr === "1",
      isMultitarget: isMultitargetStr === "3",
      type: parseInt(typeStr, 10) as 1 | 2,
    });
  }

  return conversations;
}

// =============================================================================
// Signal Parsing
// =============================================================================

/**
 * Parse conversationUpdated D-Bus signal from gdbus monitor output
 *
 * Expected format (multi-line):
 * /modules/kdeconnect/devices/{id}: org.kde.kdeconnect.device.conversations.conversationUpdated (
 *   <@a{sv} {
 *     'threadId': <int64 123>,
 *     'body': <'Message text'>,
 *     'addresses': <@as ['+16505551234']>,
 *     'date': <int64 1736887200000>,
 *     'type': <int32 1>,
 *     'read': <int32 0>,
 *     ...
 *   }>,
 * )
 */
function parseConversationUpdatedSignal(buffer: string): KdeConnectMessage | null {
  // Check if this is a conversationUpdated signal
  if (!buffer.includes("conversationUpdated")) return null;

  // Extract fields using regex
  const idMatch = buffer.match(/'_id':\s*<'?(\d+)'?>/);
  const threadIdMatch = buffer.match(/'thread_id':\s*<'?(\d+)'?>/) ||
                        buffer.match(/'threadId':\s*<int64\s+(\d+)>/);
  const bodyMatch = buffer.match(/'body':\s*<'([^']*)'/);
  const addressMatch = buffer.match(/'address':\s*<'([^']+)'>/);
  const dateMatch = buffer.match(/'date':\s*<int64\s+(\d+)>/);
  const typeMatch = buffer.match(/'type':\s*<(?:int32\s+)?(\d+)>/);
  const readMatch = buffer.match(/'read':\s*<(?:int32\s+)?(\d+)>/);

  // Need at least threadId and body
  if (!threadIdMatch || !bodyMatch) return null;

  return {
    id: idMatch ? parseInt(idMatch[1], 10) : Date.now(),
    threadId: parseInt(threadIdMatch[1], 10),
    body: bodyMatch[1],
    address: addressMatch ? addressMatch[1] : "",
    date: dateMatch ? parseInt(dateMatch[1], 10) : Date.now(),
    type: typeMatch ? (parseInt(typeMatch[1], 10) as 1 | 2) : 1,
    read: readMatch ? (parseInt(readMatch[1], 10) as 0 | 1) : 0,
  };
}

/**
 * Parse message batch from conversationUpdated signal
 * The signal may contain multiple messages in an array
 */
function parseMessageBatch(buffer: string): KdeConnectMessage[] {
  const messages: KdeConnectMessage[] = [];

  // The signal contains messages in a format like:
  // {'_id': <'123'>, 'thread_id': <'456'>, 'address': <'+1...'>, 'body': <'text'>, ...}
  // Find all message dictionaries
  const dictPattern = /\{[^{}]*'_id':[^{}]*'body':[^{}]*\}/g;
  const matches = buffer.match(dictPattern);

  if (matches) {
    for (const match of matches) {
      const msg = parseConversationUpdatedSignal(match);
      if (msg) {
        messages.push(msg);
      }
    }
  }

  // If no structured messages found, try parsing as single message
  if (messages.length === 0) {
    const single = parseConversationUpdatedSignal(buffer);
    if (single) {
      messages.push(single);
    }
  }

  return messages;
}

// =============================================================================
// KDE Connect Client
// =============================================================================

/**
 * KDE Connect SMS Client
 *
 * Provides access to SMS messages via KDE Connect D-Bus interface.
 * Emits events: 'conversationUpdated', 'error', 'monitorStarted', 'monitorStopped'
 */
export class KdeConnectClient extends EventEmitter {
  private selectedDeviceId: string | null = null;
  private monitorProcess: ChildProcess | null = null;
  private monitorReadline: ReadlineInterface | null = null;
  private signalBuffer: string = "";
  private messageBuffers: Map<number, KdeConnectMessage[]> = new Map();

  constructor() {
    super();
  }

  // ===========================================================================
  // Device Management
  // ===========================================================================

  /**
   * Check if KDE Connect daemon is running
   */
  isDaemonRunning(): boolean {
    try {
      execSync("gdbus introspect --session --dest org.kde.kdeconnect --object-path /modules/kdeconnect", {
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of all devices (paired and unpaired)
   */
  async getDevices(): Promise<KdeConnectDevice[]> {
    try {
      // Get device IDs
      const result = await dbusCall(
        KDECONNECT_PATH,
        "org.kde.kdeconnect.daemon",
        "devices"
      );

      const deviceIds = parseGVariant(result) as string[];
      if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
        return [];
      }

      // Get details for each device
      const devices: KdeConnectDevice[] = [];
      for (const id of deviceIds) {
        try {
          const device = await this.getDevice(id);
          if (device) {
            devices.push(device);
          }
        } catch (err) {
          // Skip devices that fail to query
          console.warn(`[kdeconnect] Failed to get device ${id}:`, err);
        }
      }

      return devices;
    } catch (err) {
      console.error("[kdeconnect] Failed to get devices:", err);
      return [];
    }
  }

  /**
   * Get details for a specific device
   */
  async getDevice(deviceId: string): Promise<KdeConnectDevice | null> {
    const devicePath = `${KDECONNECT_PATH}/devices/${deviceId}`;
    const deviceInterface = "org.kde.kdeconnect.device";

    try {
      // Get device properties
      const [nameResult, typeResult, reachableResult, trustedResult, pluginsResult] = await Promise.all([
        dbusGetProperty(devicePath, deviceInterface, "name"),
        dbusGetProperty(devicePath, deviceInterface, "type"),
        dbusGetProperty(devicePath, deviceInterface, "isReachable"),
        dbusGetProperty(devicePath, deviceInterface, "isTrusted"),
        dbusGetProperty(devicePath, deviceInterface, "supportedPlugins"),
      ]);

      // Check if SMS plugin is in supportedPlugins list
      const supportedPlugins = parseGVariant(pluginsResult);
      const hasSmsPlugin = Array.isArray(supportedPlugins) &&
        supportedPlugins.includes("kdeconnect_sms");

      return {
        id: deviceId,
        name: String(parseGVariant(nameResult)),
        type: String(parseGVariant(typeResult)) as KdeConnectDevice["type"],
        isReachable: parseGVariant(reachableResult) === true || reachableResult.includes("true"),
        isTrusted: parseGVariant(trustedResult) === true || trustedResult.includes("true"),
        hasSmsPlugin,
      };
    } catch (err) {
      console.error(`[kdeconnect] Failed to get device ${deviceId}:`, err);
      return null;
    }
  }

  /**
   * Get default device (first reachable + trusted device with SMS plugin)
   */
  async getDefaultDevice(): Promise<KdeConnectDevice | null> {
    const devices = await this.getDevices();

    // Prefer device with SMS plugin that is reachable and trusted
    const smsDevice = devices.find(
      (d) => d.isReachable && d.isTrusted && d.hasSmsPlugin
    );
    if (smsDevice) return smsDevice;

    // Fallback to any reachable + trusted device
    return devices.find((d) => d.isReachable && d.isTrusted) || null;
  }

  /**
   * Select device for subsequent operations
   */
  selectDevice(deviceId: string): void {
    this.selectedDeviceId = deviceId;
  }

  /**
   * Get currently selected device ID
   */
  getSelectedDeviceId(): string | null {
    return this.selectedDeviceId;
  }

  // ===========================================================================
  // D-Bus Signal Monitoring
  // ===========================================================================

  /**
   * Start monitoring D-Bus signals for conversation updates
   * Spawns `gdbus monitor` subprocess to receive real-time message notifications
   */
  startSignalMonitor(deviceId?: string): void {
    if (this.monitorProcess) {
      console.log("[kdeconnect] Signal monitor already running");
      return;
    }

    const id = deviceId || this.selectedDeviceId;
    if (!id) {
      throw new Error("No device selected for signal monitoring");
    }

    const devicePath = `${KDECONNECT_PATH}/devices/${id}`;

    console.log(`[kdeconnect] Starting D-Bus signal monitor for ${id}`);

    this.monitorProcess = spawn("gdbus", [
      "monitor",
      "--session",
      "--dest",
      KDECONNECT_SERVICE,
      "--object-path",
      devicePath,
    ]);

    // Use readline for line-by-line parsing
    this.monitorReadline = createInterface({
      input: this.monitorProcess.stdout!,
      crlfDelay: Infinity,
    });

    // Buffer for multi-line signal output
    this.signalBuffer = "";

    this.monitorReadline.on("line", (line) => {
      this.handleSignalLine(line);
    });

    this.monitorProcess.stderr?.on("data", (data) => {
      const stderr = data.toString().trim();
      if (stderr) {
        console.error("[kdeconnect] Monitor stderr:", stderr);
      }
    });

    this.monitorProcess.on("close", (code) => {
      console.log(`[kdeconnect] Signal monitor exited with code ${code}`);
      this.monitorProcess = null;
      this.monitorReadline = null;
      this.emit("monitorStopped", { code });
    });

    this.monitorProcess.on("error", (err) => {
      console.error("[kdeconnect] Monitor process error:", err);
      this.emit("error", err);
    });

    this.emit("monitorStarted", { deviceId: id });
  }

  /**
   * Stop the D-Bus signal monitor
   * Properly cleans up readline, process, and buffers
   */
  stopSignalMonitor(): void {
    // Close readline FIRST (before killing process to avoid race)
    if (this.monitorReadline) {
      this.monitorReadline.close();
      this.monitorReadline = null;
    }
    if (this.monitorProcess) {
      console.log("[kdeconnect] Stopping signal monitor");
      this.monitorProcess.kill();
      this.monitorProcess = null;
    }
    this.signalBuffer = "";
    // Clear message buffers to prevent stale data on restart
    this.messageBuffers.clear();
  }

  /**
   * Check if signal monitor is running
   */
  isMonitorRunning(): boolean {
    return this.monitorProcess !== null;
  }

  /**
   * Handle a line of output from gdbus monitor
   * Buffers multi-line signals and emits events when complete
   */
  private handleSignalLine(line: string): void {
    // Start of a new signal
    if (line.includes("org.kde.kdeconnect.device.conversations.conversationUpdated")) {
      this.signalBuffer = line;
    } else if (this.signalBuffer) {
      // Continue buffering
      this.signalBuffer += "\n" + line;
    }

    // Check if signal is complete (ends with closing paren)
    if (this.signalBuffer && line.trim() === ")") {
      this.processSignalBuffer();
      this.signalBuffer = "";
    }
  }

  /**
   * Process a complete signal buffer
   */
  private processSignalBuffer(): void {
    const messages = parseMessageBatch(this.signalBuffer);

    if (messages.length > 0) {
      // Group by threadId
      const byThread = new Map<number, KdeConnectMessage[]>();
      for (const msg of messages) {
        const existing = byThread.get(msg.threadId) || [];
        existing.push(msg);
        byThread.set(msg.threadId, existing);
      }

      // Emit event for each thread and update buffers
      for (const [threadId, msgs] of byThread) {
        // Add to message buffer
        const existing = this.messageBuffers.get(threadId) || [];
        this.messageBuffers.set(threadId, [...existing, ...msgs]);

        // Emit event
        this.emit("conversationUpdated", { threadId, messages: msgs });
        console.log(`[kdeconnect] Received ${msgs.length} message(s) for thread ${threadId}`);
      }
    }
  }

  /**
   * Wait for messages from a specific thread
   * Used by getMessages() to wait for signal response after requestConversation()
   */
  waitForMessages(threadId: number, timeoutMs: number = 10000): Promise<KdeConnectMessage[]> {
    return new Promise((resolve) => {
      // Check if messages already in buffer
      const buffered = this.messageBuffers.get(threadId);
      if (buffered && buffered.length > 0) {
        this.messageBuffers.delete(threadId);
        resolve(buffered);
        return;
      }

      // Flag to prevent double resolution (fixes memory leak)
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.off("conversationUpdated", handler);
        }
      };

      const timeout = setTimeout(() => {
        cleanup();
        // Return whatever is in the buffer, even if empty
        const messages = this.messageBuffers.get(threadId) || [];
        this.messageBuffers.delete(threadId);
        if (messages.length > 0) {
          resolve(messages);
        } else {
          // Not necessarily an error - some threads may have no messages
          console.warn(`[kdeconnect] Timeout waiting for thread ${threadId} (may have no messages)`);
          resolve([]);
        }
      }, timeoutMs);

      const handler = (data: { threadId: number; messages: KdeConnectMessage[] }) => {
        if (data.threadId === threadId) {
          cleanup();
          // Get all buffered messages for this thread
          const allMessages = this.messageBuffers.get(threadId) || data.messages;
          this.messageBuffers.delete(threadId);
          resolve(allMessages);
        }
      };

      this.on("conversationUpdated", handler);
    });
  }

  /**
   * Clear message buffer for a thread
   */
  clearMessageBuffer(threadId: number): void {
    this.messageBuffers.delete(threadId);
  }

  /**
   * Clear all message buffers
   */
  clearAllMessageBuffers(): void {
    this.messageBuffers.clear();
  }

  // ===========================================================================
  // Conversation Access
  // ===========================================================================

  /**
   * Request all conversations from device
   * This triggers the device to send conversation data
   */
  async requestAllConversations(deviceId?: string): Promise<void> {
    const id = deviceId || this.selectedDeviceId;
    if (!id) throw new Error("No device selected");

    const conversationsPath = `${KDECONNECT_PATH}/devices/${id}`;
    await dbusCall(
      conversationsPath,
      "org.kde.kdeconnect.device.conversations",
      "requestAllConversationThreads"
    );

    // Give the device time to wake up and respond (phone may be asleep)
    // This is critical - phones need 10-15 seconds to fully respond
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  /**
   * Get active conversations with metadata
   * Returns the LAST message from each conversation
   */
  async getActiveConversations(deviceId?: string): Promise<Array<{
    threadId: number;
    body: string;
    addresses: string[];
    date: number;
    isRead: boolean;
    isMultitarget: boolean;
    type: 1 | 2;  // 1=incoming, 2=outgoing
  }>> {
    const id = deviceId || this.selectedDeviceId;
    if (!id) throw new Error("No device selected");

    const conversationsPath = `${KDECONNECT_PATH}/devices/${id}`;

    try {
      const result = await dbusCall(
        conversationsPath,
        "org.kde.kdeconnect.device.conversations",
        "activeConversations"
      );

      return parseActiveConversations(result);
    } catch (err) {
      console.error("[kdeconnect] Failed to get active conversations:", err);
      return [];
    }
  }

  /**
   * Request messages for a specific conversation
   * @param threadId - The conversation thread ID
   * @param start - Start index (0 for beginning)
   * @param end - End index (-1 for all messages)
   */
  async requestConversation(
    threadId: number,
    start: number = 0,
    end: number = -1,
    deviceId?: string
  ): Promise<void> {
    const id = deviceId || this.selectedDeviceId;
    if (!id) throw new Error("No device selected");

    const conversationsPath = `${KDECONNECT_PATH}/devices/${id}`;
    // Pass arguments without type annotations - gdbus infers from method signature
    // Use "--" separator before potentially negative numbers
    await dbusCall(
      conversationsPath,
      "org.kde.kdeconnect.device.conversations",
      "requestConversation",
      [String(threadId), String(start), "--", String(end)]
    );

    // Give the device time to respond (3s should be enough per conversation)
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  /**
   * Get messages from a conversation via D-Bus signal monitoring
   *
   * Flow:
   * 1. Ensure signal monitor is running
   * 2. Clear buffer for this thread
   * 3. Call requestConversation() to trigger device to send messages
   * 4. Wait for conversationUpdated signal with messages
   * 5. Apply filters (since/limit) and return
   */
  async getMessages(
    threadId: number,
    deviceId?: string,
    options: { since?: Date; limit?: number; timeout?: number } = {}
  ): Promise<KdeConnectMessage[]> {
    const id = deviceId || this.selectedDeviceId;
    if (!id) throw new Error("No device selected");

    try {
      // Ensure signal monitor is running
      if (!this.isMonitorRunning()) {
        this.startSignalMonitor(id);
        // Give monitor time to establish connection
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Clear any stale data for this thread
      this.clearMessageBuffer(threadId);

      // Request conversation - this triggers the device to send messages via signal
      await this.requestConversation(threadId, 0, -1, id);

      // Wait for messages to arrive via signal
      const timeout = options.timeout || 10000;
      let messages = await this.waitForMessages(threadId, timeout);

      // Apply filters
      if (options.since) {
        const sinceTs = options.since.getTime();
        messages = messages.filter((m) => m.date >= sinceTs);
      }

      if (options.limit && messages.length > options.limit) {
        messages = messages.slice(0, options.limit);
      }

      return messages;
    } catch (err) {
      console.error(`[kdeconnect] Failed to get messages for thread ${threadId}:`, err);
      return [];
    }
  }

  /**
   * Get conversation metadata
   */
  async getConversation(
    threadId: number,
    deviceId?: string
  ): Promise<KdeConnectConversation | null> {
    const id = deviceId || this.selectedDeviceId;
    if (!id) throw new Error("No device selected");

    const conversationsPath = `${KDECONNECT_PATH}/devices/${id}`;

    try {
      // Request conversation data first
      await this.requestConversation(threadId, 0, -1, id);

      // Try to get first message to extract metadata
      const result = await dbusCall(
        conversationsPath,
        "org.kde.kdeconnect.device.conversations",
        "getFirstFromConversation",
        [String(threadId)]
      );

      // Parse the response (GVariant dict)
      // This is a simplified parse - real impl would need full GVariant parser
      const parsed = result;

      // Extract address from response
      const addressMatch = parsed.match(/'address':\s*<'([^']+)'>/);
      const address = addressMatch ? addressMatch[1] : `thread_${threadId}`;

      return {
        threadId,
        addresses: [address],
        displayName: address,
        isMultiTarget: false,
        lastMessageDate: Date.now(),
      };
    } catch (err) {
      console.error(`[kdeconnect] Failed to get conversation ${threadId}:`, err);
      return null;
    }
  }

  // ===========================================================================
  // Send SMS
  // ===========================================================================

  /**
   * Send an SMS message via kdeconnect-cli
   */
  async sendSms(
    phoneNumber: string,
    message: string,
    deviceId?: string
  ): Promise<void> {
    const id = deviceId || this.selectedDeviceId;
    if (!id) throw new Error("No device selected");

    return new Promise((resolve, reject) => {
      const proc = spawn("kdeconnect-cli", [
        "-d",
        id,
        "--send-sms",
        message,
        "--destination",
        phoneNumber,
      ]);

      let stderr = "";

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to send SMS: ${stderr || `exit code ${code}`}`));
        } else {
          resolve();
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn kdeconnect-cli: ${err.message}`));
      });
    });
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  /**
   * Get overall KDE Connect SMS status
   */
  async getStatus(): Promise<KdeConnectStatus> {
    const daemonRunning = this.isDaemonRunning();

    if (!daemonRunning) {
      return {
        daemonRunning: false,
        hasDevices: false,
        devices: [],
        error: "KDE Connect daemon not running. Start kdeconnectd first.",
      };
    }

    const devices = await this.getDevices();
    const defaultDevice = await this.getDefaultDevice();

    // Count conversations if device available
    let conversationCount: number | undefined;
    if (defaultDevice) {
      try {
        this.selectDevice(defaultDevice.id);
        await this.requestAllConversations();
        const convIds = await this.getActiveConversations();
        conversationCount = convIds.length;
      } catch {
        // Ignore conversation count errors
      }
    }

    return {
      daemonRunning: true,
      hasDevices: devices.length > 0,
      devices,
      selectedDevice: defaultDevice || undefined,
      conversationCount,
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let clientInstance: KdeConnectClient | null = null;

/**
 * Get or create KDE Connect client instance
 */
export function getKdeConnectClient(): KdeConnectClient {
  if (!clientInstance) {
    clientInstance = new KdeConnectClient();
  }
  return clientInstance;
}

/**
 * Reset client instance (for testing)
 */
export function resetKdeConnectClient(): void {
  clientInstance = null;
}

/**
 * Check if KDE Connect is available (daemon running + device available)
 */
export function isKdeConnectAvailable(): boolean {
  const client = getKdeConnectClient();
  return client.isDaemonRunning();
}

/**
 * Get KDE Connect status without creating persistent client
 */
export async function getKdeConnectStatus(): Promise<KdeConnectStatus> {
  const client = getKdeConnectClient();
  return client.getStatus();
}
