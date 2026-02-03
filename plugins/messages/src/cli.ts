#!/usr/bin/env bun
/**
 * Messages CLI
 *
 * Command-line interface for the Messages plugin.
 *
 * Usage:
 *   bun plugins/messages/src/cli.ts <command> [options]
 *
 * Commands:
 *   import telegram -f <file>   Import Telegram export
 *   import logs                 Import Claude Code logs
 *   search <query>              Search messages
 *   recent                      Show recent messages
 *   thread <id>                 Show thread messages
 *   threads                     List threads
 *   accounts                    List accounts
 *   stats                       Show statistics
 */

// Load .env from repo root BEFORE any other imports that might read env vars
import { loadEnvFromRepoRoot } from "../../../lib/paths";
loadEnvFromRepoRoot();

import { parseArgs } from "util";
import { createStore } from "./core/store";
import { createSearchIndex } from "./search";
import { getSearchDbPath, getMessagesBasePath } from "./config";
import { getClaudePath } from "../../../lib/paths";
import { importTelegramExport, countTelegramExport } from "./adapters/telegram";
import { importLogging, countLoggingEvents, getDefaultLogsDir } from "./adapters/logging";
import {
  importClaudeWeb,
  countClaudeWebExport,
  extractConversationsFromZip,
} from "./adapters/claude-web";
import {
  importTelegramApi,
  countTelegramApi,
  isTelegramApiAvailable,
} from "./adapters/telegram-api";
import {
  importEmail,
  countEmail,
  getUserEmail,
} from "./adapters/email";
import {
  importEmailImap,
  countImapMessages,
  listImapFolders,
  isImapAvailable,
  getImapStatus,
} from "./adapters/email-imap";
import {
  TelegramApiClient,
  hasSession,
} from "./integrations/telegram/client";
import {
  getSignalConnectionStatus,
  isSignalAvailable,
  isSignalDaemonRunning,
  countSignalMessages,
  importSignal,
  listSignalConversations,
  countSignalBackupMessages,
  importSignalBackup,
  repairSignalAccounts,
  backfillSignalThreadNames,
  migrateSignalThreadIds,
} from "./adapters/signal";
import {
  isSignalDesktopAvailable,
  getSignalDesktopStatus,
  countSignalDesktopMessages,
  importSignalDesktop,
  loadSignalDesktopWatermark,
} from "./adapters/signal-desktop";
import { SignalSyncService, getSignalSyncService } from "./services/signal-sync";
import { GmailSyncService, getGmailSyncService } from "./services/gmail-sync";
import { TelegramSyncService, getTelegramSyncService } from "./services/telegram-sync";
import {
  getWhatsAppSyncService,
  resetWhatsAppSyncService,
  isWhatsAppAvailable,
} from "./services/whatsapp-sync";
import {
  getWhatsAppStatus,
  importWhatsApp,
  countWhatsAppMessages,
} from "./adapters/whatsapp";
import { getWhatsAppClient, resetWhatsAppClient } from "./integrations/whatsapp/client";
import { clearSession as clearWhatsAppSession } from "./integrations/whatsapp/auth-state";
import {
  getDiscordSyncService,
  resetDiscordSyncService,
  isDiscordAvailable,
} from "./services/discord-sync";
import {
  getDiscordClient,
  getDiscordStatus,
  getDiscordTokenFromEnv,
  resetDiscordClient,
} from "./integrations/discord/client";
import { clearSession as clearDiscordSession } from "./integrations/discord/auth-state";
import {
  importDiscordHistory,
  countDiscordHistory,
  CheckpointManager as DiscordCheckpointManager,
  type DiscordImportStats,
} from "./adapters/discord-import";
import { kindName, type Message } from "./types";
import {
  getKdeConnectStatus,
  isKdeConnectAvailable,
  countKdeConnectMessages,
  importKdeConnect,
} from "./adapters/kdeconnect";
import { createEntityStore, createExtractor } from "./entities";
import { createAnalytics } from "./analytics";
import { createOllamaEmbedder, createEmbeddingStore } from "./embeddings";
import {
  MessagesDaemon,
  getIpcClient,
  type PlatformId,
} from "./daemon";

// Parse command line arguments
const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    file: { type: "string", short: "f" },
    limit: { type: "string", short: "l" },
    platform: { type: "string", short: "p" },
    since: { type: "string", short: "s" },
    email: { type: "string", multiple: true },
    "dry-run": { type: "boolean" },
    "include-tools": { type: "boolean" },
    "include-system": { type: "boolean" },
    "include-thinking": { type: "boolean" },
    realtime: { type: "boolean" },
    "my-name": { type: "string" },  // For WhatsApp export: your name as it appears in exports
    "checkpoint-id": { type: "string" },  // For discord-history: resume from checkpoint
    full: { type: "boolean" },  // For signal-desktop: skip watermark and do full import
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

const [command, ...args] = positionals;

// Initialize store and search
const store = createStore();
const search = createSearchIndex();

// Help text
function showHelp(): void {
  console.log(`
Messages CLI - Universal messaging backbone

Usage:
  bun plugins/messages/src/cli.ts <command> [options]

Commands:
  telegram-auth               Authenticate with Telegram (one-time setup)
  whatsapp-auth               Authenticate with WhatsApp via QR code (one-time)
  whatsapp-status             Check WhatsApp connection status
  whatsapp-live               Start continuous live WhatsApp sync (all chats)
  whatsapp-logout             Clear WhatsApp session and force re-authentication
  discord-auth                Authenticate with Discord (paste user token)
  discord-status              Check Discord connection status
  discord-live                Start continuous live Discord sync (all servers/DMs)
  discord-history             Import ALL historical Discord messages (guilds/DMs/threads)
  discord-logout              Clear Discord session and force re-authentication
  sms-status                  Check KDE Connect SMS status and devices
  import sms                  Import SMS messages from KDE Connect
  signal-status               Check Signal daemon status and configuration
  signal-sync                 Sync messages from Signal (requires daemon)
  signal-live                 Start continuous live Signal sync (background)
  signal-backup -f <path>     Import Signal Android backup (decrypted database)
  signal-desktop              Import from Signal Desktop (auto-detects database)
  signal-repair -f <path>     Repair Signal account resolution (fix signal_unknown)
  signal-backfill -f <path>   Backfill Signal thread names from backup database
  gmail-live                  Start continuous live Gmail sync (multi-account)
  telegram-live               Start continuous live Telegram sync (all chats)
  email-sync                  Sync emails from IMAP server (Gmail, Outlook, etc.)
  import telegram -f <file>   Import Telegram JSON export
  import telegram-api         Import from Telegram API (requires auth)
  import signal               Import from Signal (alias for signal-sync)
  import whatsapp             Import from WhatsApp (sync + wait for messages)
  import whatsapp-export -f   Import WhatsApp chat export (.txt files)
  import logs                 Import Claude Code logs
  import claude-web -f <zip>  Import Claude Web data export
  import email -f <path>      Import emails (.eml directory or .mbox file)
  search <query>              Search messages
  recent [-l N]               Show recent messages
  thread <id>                 Show thread messages
  threads                     List all threads
  accounts                    List all accounts
  stats                       Show statistics
  rebuild-views               Rebuild thread views from event store
  rebuild-search              Rebuild search index from event store
  extract-entities            Extract entities from messages (people, dates, keywords)
  migrate-directions          Backfill direction column for existing messages
  migrate-telegram-directions Fix direction tags for existing Telegram messages
  analytics                   Thread/contact priority analysis (network analysis, recency scoring)

Embeddings:
  embed [--dry-run]           Generate vector embeddings for semantic search
  embed-stats                 Show embedding statistics
  semantic-search <query>     Search using semantic similarity

Daemon:
  daemon status               Show daemon and platform status
  daemon start                Start the daemon (or use systemd)
  daemon stop                 Stop the daemon
  daemon health               Show detailed health report
  daemon restart              Restart the daemon
  daemon restart-platform <p> Restart a specific platform (signal, whatsapp, discord)

Options:
  -f, --file <path>           File path for import
  -l, --limit <n>             Limit results (default: 20)
  -p, --platform <name>       Filter by platform
  -s, --since <days|date>     Filter to messages since N days ago or date
  --dry-run                   Preview import without saving
  --include-tools             Include tool use events (logs/claude-web)
  --include-system            Include system events (logs import)
  --include-thinking          Include thinking blocks (claude-web, default: true)
  --realtime                  Continue listening for new messages (signal-sync)
  --full                      Skip watermark and do full import (signal-desktop)
  -h, --help                  Show this help

Examples:
  # Check Signal daemon status
  bun plugins/messages/src/cli.ts signal-status

  # Sync messages from Signal
  bun plugins/messages/src/cli.ts signal-sync

  # Sync Signal messages and continue listening
  bun plugins/messages/src/cli.ts signal-sync --realtime

  # Start continuous live Signal sync (runs until Ctrl+C)
  bun plugins/messages/src/cli.ts signal-live

  # Import Signal Android backup (historical messages)
  bun plugins/messages/src/cli.ts signal-backup -f ~/signal-backup/decrypted/database.sqlite

  # Authenticate with Telegram (one-time)
  bun plugins/messages/src/cli.ts telegram-auth

  # Authenticate with WhatsApp (scan QR code once)
  bun plugins/messages/src/cli.ts whatsapp-auth

  # Check WhatsApp connection status
  bun plugins/messages/src/cli.ts whatsapp-status

  # Start continuous live WhatsApp sync (runs until Ctrl+C)
  bun plugins/messages/src/cli.ts whatsapp-live

  # Authenticate with Discord (paste your user token)
  bun plugins/messages/src/cli.ts discord-auth

  # Check Discord connection status
  bun plugins/messages/src/cli.ts discord-status

  # Start continuous live Discord sync (runs until Ctrl+C)
  bun plugins/messages/src/cli.ts discord-live

  # Check KDE Connect SMS status
  bun plugins/messages/src/cli.ts sms-status

  # Import SMS messages from KDE Connect (dry run)
  bun plugins/messages/src/cli.ts import sms --dry-run

  # Import SMS messages from KDE Connect
  bun plugins/messages/src/cli.ts import sms

  # Import from Telegram API (last 30 days)
  bun plugins/messages/src/cli.ts import telegram-api

  # Import Telegram JSON export
  bun plugins/messages/src/cli.ts import telegram -f ~/Downloads/result.json

  # Import Claude Code logs
  bun plugins/messages/src/cli.ts import logs

  # Import Claude Web data (last 30 days)
  bun plugins/messages/src/cli.ts import claude-web -f ~/Downloads/data-*.zip -s 30

  # Import emails from .eml directory
  bun plugins/messages/src/cli.ts import email -f ~/Mail/Archive/

  # Import emails from .mbox file
  bun plugins/messages/src/cli.ts import email -f ~/Downloads/gmail-export.mbox

  # Sync emails from IMAP (last 30 days)
  bun plugins/messages/src/cli.ts email-sync

  # Sync emails from IMAP (last 7 days)
  bun plugins/messages/src/cli.ts email-sync -s 7

  # Search messages
  bun plugins/messages/src/cli.ts search "authentication"

  # Show recent Claude Code prompts
  bun plugins/messages/src/cli.ts recent -p claude-code -l 10
`);
}

// Format date for display
function formatDate(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

// Truncate text
function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "..." : clean;
}

// Main command handler
async function main(): Promise<void> {
  if (values.help || !command) {
    showHelp();
    return;
  }

  const limit = values.limit ? parseInt(values.limit, 10) : 20;

  switch (command) {
    case "telegram-auth": {
      console.log("Telegram Authentication");
      console.log("=======================\n");

      // Check for credentials
      if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH || !process.env.TELEGRAM_PHONE) {
        console.error("Error: Missing Telegram credentials in .env");
        console.error("Required: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE");
        process.exit(1);
      }

      if (hasSession()) {
        console.log("You already have a saved session.");
        console.log(`To re-authenticate, delete ${getClaudePath("messages/telegram-session.txt")} first.`);
        return;
      }

      console.log(`Phone: ${process.env.TELEGRAM_PHONE}`);
      console.log("\nConnecting to Telegram...");
      console.log("A verification code will be sent to your Telegram app.\n");

      const client = new TelegramApiClient();

      // Dynamic import for input module
      const input = await import("input");

      try {
        await client.authenticate({
          onCodeRequest: async () => {
            return await input.text("Enter the code from Telegram: ");
          },
          onPasswordRequest: async () => {
            return await input.text("Enter your 2FA password (if enabled): ");
          },
          onError: (err) => {
            console.error("Authentication error:", err.message);
          },
        });

        console.log("\n✓ Successfully authenticated!");
        console.log("Session saved. You can now run: import telegram-api");
      } catch (error) {
        console.error("\nAuthentication failed:", error);
        process.exit(1);
      }
      break;
    }

    case "whatsapp-auth": {
      console.log("WhatsApp Authentication");
      console.log("=======================\n");

      // Check if already authenticated
      if (isWhatsAppAvailable()) {
        const status = getWhatsAppStatus();
        console.log("You already have a saved WhatsApp session.");
        if (status.phoneNumber) {
          console.log(`Phone: ${status.phoneNumber}`);
        }
        console.log("\nTo re-authenticate, run: whatsapp-logout");
        return;
      }

      console.log("This will open a QR code for you to scan with WhatsApp on your phone.");
      console.log("Open WhatsApp > Settings > Linked Devices > Link a Device\n");
      console.log("Waiting for QR code...\n");
      console.log("NOTE: QR codes refresh frequently. Keep scanning until connection succeeds.\n");

      try {
        // Create client with auto-reconnect enabled
        // The client will handle reconnects automatically (stream errors are normal)
        const client = getWhatsAppClient({
          printQRInTerminal: true,
          autoReconnect: true,
          maxReconnectAttempts: 20,  // More attempts during auth
          reconnectBackoff: 2000,    // 2 second initial backoff
        });

        // Set up event handlers
        client.on("qr", ({ expiresAt }) => {
          const seconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
          console.log(`\n[QR] Scan the QR code above (expires in ${seconds}s)`);
        });

        client.on("authenticated", () => {
          console.log("\n✓ QR code scanned successfully!");
        });

        client.on("reconnecting", ({ attempt }) => {
          if (attempt <= 3) {
            console.log(`[connect] Reconnecting (attempt ${attempt})...`);
          }
        });

        await client.connect();

        // Wait for stable connection (multiple connection cycles may occur)
        const maxWaitTime = 300000; // 5 minutes total
        const startTime = Date.now();

        await new Promise<void>((resolve, reject) => {
          const checkConnection = () => {
            if (Date.now() - startTime > maxWaitTime) {
              reject(new Error("Connection timeout after 5 minutes - please try again"));
              return;
            }

            if (client.isConnected()) {
              // Give a moment for credentials to settle
              setTimeout(() => {
                if (client.isConnected()) {
                  resolve();
                } else {
                  // Connection dropped, keep waiting
                  setTimeout(checkConnection, 1000);
                }
              }, 2000);
            } else {
              // Not connected yet, check again
              setTimeout(checkConnection, 1000);
            }
          };

          client.once("connected", () => {
            // Wait a moment to ensure connection is stable
            setTimeout(checkConnection, 1000);
          });

          client.on("error", (err) => {
            // Only reject on fatal errors, not transient ones
            const errorMsg = err.message || "";
            if (errorMsg.includes("logged out") || errorMsg.includes("banned")) {
              reject(err);
            }
            // Otherwise keep trying (stream errors are transient)
          });

          // Start checking if already connected
          if (client.isConnected()) {
            checkConnection();
          }
        });

        const me = client.getMe();
        if (me) {
          console.log(`\n✓ Successfully authenticated!`);
          console.log(`Phone: ${me.phone}`);
          console.log(`Name: ${me.name}`);
        }

        // Wait for all credentials and app state keys to be synced
        // WhatsApp requires full key exchange before session is stable
        console.log("\nSaving session (waiting for full key sync - this takes ~15 seconds)...");
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Check what was saved
        const { listSessionFiles } = await import("./integrations/whatsapp/auth-state");
        const files = listSessionFiles();
        console.log(`Session saved (${files.length} credential files).`);
        console.log("\nYou can now run: whatsapp-live");

        // Disconnect cleanly
        await client.disconnect();
      } catch (error) {
        console.error("\nAuthentication failed:", error);
        resetWhatsAppClient();
        process.exit(1);
      }
      break;
    }

    case "whatsapp-status": {
      console.log("WhatsApp Status");
      console.log("===============\n");

      const status = getWhatsAppStatus();

      console.log("Configuration:");
      console.log(`  Session: ${status.hasSession ? "✓ exists" : "✗ not found"}`);
      console.log(`  Phone: ${status.phoneNumber || "(not authenticated)"}`);
      console.log(`  State: ${status.state}`);

      if (!status.hasSession) {
        console.log("\nTo get started:");
        console.log("  1. Run: whatsapp-auth");
        console.log("  2. Scan the QR code with your phone");
        console.log("  3. Run: whatsapp-live");
      } else {
        console.log("\n✓ WhatsApp is ready! You can run: whatsapp-live");
      }
      break;
    }

    case "whatsapp-live": {
      console.log("WhatsApp Live Sync");
      console.log("==================\n");

      // Check if we have a session - if not, show QR code
      const needsAuth = !isWhatsAppAvailable();
      if (needsAuth) {
        console.log("No saved session found. Scan QR code to authenticate.\n");
        console.log("Open WhatsApp > Settings > Linked Devices > Link a Device\n");
        // Reset any stale singleton state
        resetWhatsAppSyncService();
      } else {
        const status = getWhatsAppStatus();
        if (status.phoneNumber) {
          console.log(`Phone: ${status.phoneNumber}`);
        }
      }
      console.log("Starting continuous sync service...\n");
      console.log("Press Ctrl+C to stop.\n");

      try {
        // Always enable QR printing - if session is invalid, we'll need to re-auth
        const syncService = getWhatsAppSyncService({
          printQRInTerminal: true,  // Always ready for QR if needed
          autoReconnect: true,
          maxReconnectAttempts: 50,  // Keep trying to reconnect
        });

        // Set up event handlers
        syncService.on("connected", () => {
          console.log("[whatsapp-live] Connected to WhatsApp");
        });

        syncService.on("message", (message) => {
          const date = formatDate(message.created_at);
          const preview = truncate(message.content, 60);
          const direction = message.tags?.find((t: [string, string]) => t[0] === "direction")?.[1] || "?";
          const arrow = direction === "outgoing" ? "→" : "←";
          console.log(`[${date}] ${arrow} ${message.author.name}: ${preview}`);
        });

        syncService.on("sync", ({ count, mode }: { count: number; mode: string }) => {
          if (count > 0) {
            console.log(`[whatsapp-live] Synced ${count} messages (${mode})`);
          }
        });

        syncService.on("error", (err: Error) => {
          console.error(`[whatsapp-live] Error: ${err.message}`);
        });

        syncService.on("disconnected", () => {
          console.log("[whatsapp-live] Disconnected");
        });

        syncService.on("reconnecting", ({ attempt }: { attempt: number }) => {
          console.log(`[whatsapp-live] Reconnecting (attempt ${attempt})...`);
        });

        // Start the sync
        await syncService.start();

        // Keep running until interrupted
        await new Promise<void>((resolve) => {
          process.on("SIGINT", async () => {
            console.log("\n[whatsapp-live] Stopping...");
            await syncService.stop();
            const stats = syncService.getStats();
            console.log(`\nFinal stats:`);
            console.log(`  Messages processed: ${stats.messagesProcessed}`);
            console.log(`  Chats processed: ${stats.chatsProcessed}`);
            console.log(`  Errors: ${stats.errors}`);
            if (stats.lastSync) {
              console.log(`  Last sync: ${stats.lastSync.toISOString()}`);
            }
            resolve();
          });
        });
      } catch (error) {
        console.error("\nError starting sync:", error);
        process.exit(1);
      }
      break;
    }

    case "whatsapp-logout": {
      console.log("WhatsApp Logout");
      console.log("===============\n");

      if (!isWhatsAppAvailable()) {
        console.log("No WhatsApp session found.");
        return;
      }

      const status = getWhatsAppStatus();
      if (status.phoneNumber) {
        console.log(`Current session: ${status.phoneNumber}`);
      }

      console.log("Clearing session...");

      // Clear the session
      clearWhatsAppSession();
      resetWhatsAppClient();

      console.log("✓ Session cleared. Run 'whatsapp-auth' to re-authenticate.");
      break;
    }

    case "discord-auth": {
      console.log("Discord Authentication");
      console.log("======================\n");

      // Check if already authenticated via saved session
      const status = getDiscordStatus();
      if (status.hasSession) {
        console.log("You already have a saved Discord session.");
        if (status.username) {
          console.log(`User: ${status.username}#${status.discriminator}`);
        }
        console.log("\nTo re-authenticate, run: discord-logout");
        return;
      }

      // Check for token in environment variable
      const envToken = getDiscordTokenFromEnv();
      let token: string;

      if (envToken) {
        console.log("Found DISCORD_TOKEN in environment.");
        console.log("Validating token...\n");
        token = envToken;
      } else {
        console.log("To authenticate with Discord, you need your user token.");
        console.log("\n⚠️  WARNING: Using a self-bot violates Discord's Terms of Service.");
        console.log("   Your account could be banned. Use at your own risk.\n");
        console.log("To get your token:");
        console.log("  1. Open Discord in your browser (not the app)");
        console.log("  2. Open Developer Tools (F12)");
        console.log("  3. Go to Network tab");
        console.log("  4. Filter by 'api' or refresh the page");
        console.log("  5. Look for any request to discord.com/api");
        console.log("  6. Find the 'Authorization' header in the request headers");
        console.log("  7. Copy the token value (starts with your user ID encoded)\n");
        console.log("💡 Tip: Add DISCORD_TOKEN to your .env file to skip this prompt.\n");

        // Read token from stdin
        process.stdout.write("Paste your Discord token: ");
        const response = await new Promise<string>((resolve) => {
          let input = "";
          process.stdin.setEncoding("utf8");
          process.stdin.on("data", (chunk) => {
            input += chunk;
            if (input.includes("\n")) {
              resolve(input.trim());
            }
          });
          process.stdin.resume();
        });

        token = response.trim();
        if (!token) {
          console.error("\nNo token provided.");
          process.exit(1);
        }

        console.log("\nValidating token...");
      }

      try {
        const client = getDiscordClient();
        const authState = await client.authenticate(token);

        console.log(`✓ Successfully authenticated!`);
        console.log(`User: ${authState.username}#${authState.discriminator}`);
        console.log(`ID: ${authState.userId}`);
        console.log("\nYou can now run: discord-live");
      } catch (error) {
        console.error("\nAuthentication failed:", error);
        resetDiscordClient();
        process.exit(1);
      }
      break;
    }

    case "discord-status": {
      console.log("Discord Status");
      console.log("==============\n");

      const statusInfo = getDiscordStatus();
      const hasEnvToken = !!getDiscordTokenFromEnv();

      console.log("Configuration:");
      console.log(`  Session: ${statusInfo.hasSession ? "✓ saved" : "✗ not found"}`);
      console.log(`  Env Token: ${hasEnvToken ? "✓ DISCORD_TOKEN set" : "✗ not set"}`);
      if (statusInfo.username) {
        console.log(`  User: ${statusInfo.username}#${statusInfo.discriminator}`);
      }
      console.log(`  State: ${statusInfo.state}`);

      if (!statusInfo.hasSession && !hasEnvToken) {
        console.log("\nTo get started:");
        console.log("  Option 1: Add DISCORD_TOKEN to your .env file");
        console.log("  Option 2: Run: discord-auth (interactive)");
        console.log("\nThen run: discord-live");
      } else {
        console.log("\n✓ Discord is ready! You can run: discord-live");
      }
      break;
    }

    case "discord-live": {
      console.log("Discord Live Sync");
      console.log("=================\n");

      // Check if we have a session or env token
      if (!isDiscordAvailable()) {
        console.log("No authentication found.");
        console.log("Either run 'discord-auth' or set DISCORD_TOKEN in .env\n");
        process.exit(1);
      }

      const liveStatus = getDiscordStatus();
      if (liveStatus.hasSession && liveStatus.username) {
        console.log(`User: ${liveStatus.username}#${liveStatus.discriminator}`);
      } else if (getDiscordTokenFromEnv()) {
        console.log("Using DISCORD_TOKEN from environment");
      }
      console.log("Starting continuous sync service...\n");
      console.log("Press Ctrl+C to stop.\n");

      try {
        const syncService = getDiscordSyncService();

        // Set up event handlers
        syncService.on("connected", () => {
          console.log("[discord-live] Connected to Discord");
          const stats = syncService.getStats();
          console.log(`[discord-live] Watching ${stats.guildsProcessed} servers`);
        });

        syncService.on("message", (message) => {
          const date = formatDate(message.created_at);
          const preview = truncate(message.content, 60);
          const direction = message.tags?.find((t: [string, string]) => t[0] === "direction")?.[1] || "?";
          const arrow = direction === "outgoing" ? "→" : "←";
          console.log(`[${date}] ${arrow} ${message.author.name}: ${preview}`);
        });

        syncService.on("sync", ({ count, mode }: { count: number; mode: string }) => {
          if (count > 0) {
            console.log(`[discord-live] Synced ${count} messages (${mode})`);
          }
        });

        syncService.on("error", (err: Error) => {
          console.error(`[discord-live] Error: ${err.message}`);
        });

        syncService.on("disconnected", () => {
          console.log("[discord-live] Disconnected");
        });

        syncService.on("reconnecting", ({ attempt }: { attempt: number }) => {
          console.log(`[discord-live] Reconnecting (attempt ${attempt})...`);
        });

        // Start the sync
        await syncService.start();

        // Keep running until interrupted
        await new Promise<void>((resolve) => {
          process.on("SIGINT", async () => {
            console.log("\n[discord-live] Stopping...");
            await syncService.stop();
            const stats = syncService.getStats();
            console.log(`\nFinal stats:`);
            console.log(`  Messages processed: ${stats.messagesProcessed}`);
            console.log(`  Channels processed: ${stats.channelsProcessed}`);
            console.log(`  Threads processed: ${stats.threadsProcessed}`);
            console.log(`  Guilds processed: ${stats.guildsProcessed}`);
            console.log(`  Errors: ${stats.errors}`);
            if (stats.lastSync) {
              console.log(`  Last sync: ${stats.lastSync.toISOString()}`);
            }
            resolve();
          });
        });
      } catch (error) {
        console.error("\nError starting sync:", error);
        process.exit(1);
      }
      break;
    }

    case "discord-logout": {
      console.log("Discord Logout");
      console.log("==============\n");

      if (!isDiscordAvailable()) {
        console.log("No Discord session found.");
        return;
      }

      const status = getDiscordStatus();
      if (status.username) {
        console.log(`Current session: ${status.username}#${status.discriminator}`);
      }

      console.log("Clearing session...");

      // Clear the session
      clearDiscordSession();
      resetDiscordClient();
      resetDiscordSyncService();

      console.log("✓ Session cleared. Run 'discord-auth' to re-authenticate.");
      break;
    }

    case "discord-history": {
      console.log("Discord Historical Import");
      console.log("=========================\n");

      if (!isDiscordAvailable()) {
        console.log("Discord is not authenticated.");
        if (getDiscordTokenFromEnv()) {
          console.log("  DISCORD_TOKEN found in environment but connection failed.");
        } else {
          console.log("  Option 1: Set DISCORD_TOKEN in .env");
          console.log("  Option 2: Run: discord-auth (interactive)");
        }
        process.exit(1);
      }

      const sinceDays = values.since ? parseInt(values.since, 10) : undefined;
      const sinceDate = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : undefined;

      // Check for resume
      const checkpointMgr = new DiscordCheckpointManager();
      const resumable = await checkpointMgr.findResumable();

      if (resumable && !values["checkpoint-id"]) {
        console.log(`Found incomplete import: ${resumable}`);
        console.log("To resume: bun plugins/messages/src/cli.ts discord-history --checkpoint-id " + resumable);
        console.log("To start fresh: delete checkpoint file first\n");
      }

      // Dry run mode
      if (values["dry-run"]) {
        console.log("Counting channels and messages (dry run)...\n");

        try {
          const counts = await countDiscordHistory({
            since: sinceDate,
            includeArchivedThreads: true,
          });

          console.log("Discord History Summary:");
          console.log(`  Guilds: ${counts.guilds}`);
          console.log(`  Channels: ${counts.channels}`);
          console.log(`  Active Threads: ${counts.threads}`);
          console.log(`  Archived Threads: ${counts.archivedThreads}`);
          console.log(`  DM Channels: ${counts.dms}`);
          console.log(`  Estimated Messages: ~${counts.estimatedMessages.toLocaleString()}`);
          console.log();
          console.log("To import, run without --dry-run");
        } catch (error) {
          console.error("Error counting:", error);
          process.exit(1);
        }
        break;
      }

      // Full import
      console.log("Starting historical import...");
      console.log("  Parallelism: 3 concurrent channels");
      console.log("  Rate limit: 200ms between batches");
      console.log("  Checkpoints: enabled (resume on interrupt)");
      if (sinceDate) {
        console.log(`  Since: ${sinceDate.toLocaleDateString()}`);
      }
      console.log();

      const startTime = Date.now();
      let imported = 0;
      let lastProgress = 0;

      try {
        const generator = importDiscordHistory(store, {
          since: sinceDate,
          includeThreads: true,
          includeArchivedThreads: true,
          includeDMs: true,
          checkpointId: values["checkpoint-id"],
          onProgress: (progress) => {
            // Update progress every second
            const now = Date.now();
            if (now - lastProgress > 1000) {
              lastProgress = now;
              const elapsed = Math.floor((now - startTime) / 1000);
              const rate = imported > 0 ? Math.floor(imported / elapsed) : 0;
              process.stdout.write(
                `\r[${progress.phase}] ${progress.channelsCompleted}/${progress.channelsTotal} channels | ` +
                `${imported.toLocaleString()} messages | ${rate}/sec | ${elapsed}s`
              );
            }
          },
        });

        for await (const message of generator) {
          search.index(message);
          imported++;
        }

        const result = generator.return ? await generator.return(undefined as never) : null;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`\n\n✓ Import complete!`);
        console.log(`  Messages: ${imported.toLocaleString()}`);
        console.log(`  Duration: ${elapsed}s`);

        // Type guard: DiscordImportStats has 'guilds', Message does not
        if (result?.value && "guilds" in result.value) {
          const s = result.value as DiscordImportStats;
          console.log(`  Guilds: ${s.guilds}`);
          console.log(`  Channels: ${s.channels}`);
          console.log(`  Threads: ${s.threads} active, ${s.archivedThreads} archived`);
          console.log(`  DMs: ${s.dms}`);
          console.log(`  Errors: ${s.errors}`);
          if (s.dateRange.earliest && s.dateRange.latest) {
            console.log(`  Date range: ${s.dateRange.earliest.toLocaleDateString()} - ${s.dateRange.latest.toLocaleDateString()}`);
          }
        }
      } catch (error) {
        console.error("\n\nError during import:", error);
        console.log("\nImport was checkpointed. Run the same command to resume.");
        process.exit(1);
      }
      break;
    }

    case "sms-status": {
      console.log("KDE Connect SMS Status");
      console.log("======================\n");

      try {
        const status = await getKdeConnectStatus();

        console.log("Configuration:");
        console.log(`  Daemon Running: ${status.daemonRunning ? "✓ yes" : "✗ no"}`);
        console.log(`  Devices Found: ${status.devices.length}`);
        console.log();

        if (!status.daemonRunning) {
          console.log("To get started:");
          console.log("  1. Install KDE Connect: sudo apt install kdeconnect");
          console.log("  2. Pair your Android phone via KDE Connect");
          console.log("  3. Enable SMS plugin in KDE Connect on your phone");
          console.log();
        } else if (status.devices.length === 0) {
          console.log("No devices found. To pair a device:");
          console.log("  1. Install KDE Connect on your Android phone");
          console.log("  2. Open KDE Connect on both devices");
          console.log("  3. Tap 'Pair' on your phone");
          console.log();
        } else {
          console.log("Available devices:\n");
          for (const device of status.devices) {
            const reachable = device.isReachable ? "✓ connected" : "✗ offline";
            const trusted = device.isTrusted ? "✓ paired" : "✗ not paired";
            const sms = device.hasSmsPlugin ? "✓ SMS" : "✗ no SMS";
            console.log(`  ${device.name} (${device.id})`);
            console.log(`    ${reachable}, ${trusted}, ${sms}`);
          }
          console.log();

          if (status.selectedDevice) {
            console.log(`Selected device: ${status.selectedDevice.name}`);
            if (status.conversationCount !== undefined) {
              console.log(`Conversations: ${status.conversationCount}`);
            }
            console.log();
            console.log("✓ KDE Connect is ready! You can now run: import sms");
          } else {
            console.log("No paired + reachable device with SMS plugin found.");
            console.log("Ensure your phone is:");
            console.log("  - Paired with this computer");
            console.log("  - Connected to the same network");
            console.log("  - SMS plugin enabled in KDE Connect app");
          }
        }
      } catch (error) {
        console.error("Error checking KDE Connect status:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-status": {
      console.log("Signal Status");
      console.log("=============\n");

      try {
        const status = await getSignalConnectionStatus();

        console.log(`Configuration:`);
        console.log(`  Phone Number: ${status.phone || "(not set)"}`);
        console.log(`  signal-cli Binary: ${status.binaryExists ? "✓ installed" : "✗ not found"}`);
        console.log(`  Daemon Running: ${status.daemonRunning ? "✓ yes" : "✗ no"}`);
        console.log();

        if (!status.configured) {
          console.log("To configure Signal:");
          console.log("  1. Set SIGNAL_PHONE environment variable (e.g., +1234567890)");
          console.log("  2. Link device: npx signal-sdk connect");
          console.log("     (or: signal-cli -a YOUR_PHONE link)");
          console.log("  3. Start daemon: signal-cli -a YOUR_PHONE daemon --tcp");
          console.log();
        } else if (!status.daemonRunning) {
          console.log("To start the Signal daemon:");
          console.log(`  signal-cli -a ${status.phone} daemon --tcp`);
          console.log();
          console.log("Or use the bundled binary:");
          const binPath = "node_modules/signal-sdk/bin/signal-cli";
          console.log(`  ${binPath} -a ${status.phone} daemon --tcp`);
          console.log();
        } else {
          console.log("✓ Signal is ready! You can now run: signal-sync");

          // Show conversations
          console.log("\nAvailable conversations:");
          const conversations = await listSignalConversations();
          for (const conv of conversations.slice(0, 10)) {
            console.log(`  [${conv.type}] ${conv.name} (${conv.id})`);
          }
          if (conversations.length > 10) {
            console.log(`  ... and ${conversations.length - 10} more`);
          }
        }
      } catch (error) {
        console.error("Error checking Signal status:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-sync": {
      console.log("Signal Sync");
      console.log("===========\n");

      // Check configuration
      const phone = process.env.SIGNAL_PHONE;
      if (!phone) {
        console.error("Error: Signal not configured.");
        console.log("Set SIGNAL_PHONE environment variable first.");
        process.exit(1);
      }

      console.log(`Phone: ${phone}`);

      // Parse since option (days)
      let sinceDate: Date | undefined;
      if (values.since) {
        const daysAgo = parseInt(values.since, 10);
        if (!isNaN(daysAgo)) {
          sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        } else {
          sinceDate = new Date(values.since);
          if (isNaN(sinceDate.getTime())) {
            console.error(`Error: Invalid date or days value: ${values.since}`);
            process.exit(1);
          }
        }
      }

      if (values["dry-run"]) {
        console.log("\nCounting Signal conversations...");
        try {
          const counts = await countSignalMessages({
            since: sinceDate,
          });
          console.log(`
Signal Summary:
  Conversations: ${counts.conversations}
  Estimated messages: ${counts.estimatedMessages}

Conversations:`);
          for (const conv of counts.conversationDetails.slice(0, 20)) {
            console.log(`  [${conv.type}] ${conv.name}`);
          }
          if (counts.conversationDetails.length > 20) {
            console.log(`  ... and ${counts.conversationDetails.length - 20} more`);
          }
        } catch (error) {
          console.error("Error:", error);
          process.exit(1);
        }
        return;
      }

      console.log("\nReceiving messages from Signal...");
      if (values.realtime) {
        console.log("(Listening for new messages, press Ctrl+C to stop)");
      }

      let imported = 0;
      try {
        const generator = importSignal(store, {
          since: sinceDate,
          realtime: values.realtime,
          realtimeTimeout: values.realtime ? 300000 : undefined, // 5 minutes if realtime
        });

        for await (const message of generator) {
          search.index(message);
          imported++;
          const date = formatDate(message.created_at);
          const preview = truncate(message.content, 50);
          console.log(`[${date}] ${message.author.name}: ${preview}`);
        }

        console.log(`\nDone! Imported ${imported} messages.`);
      } catch (error) {
        console.error("\nError during sync:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-live": {
      console.log("Signal Live Sync");
      console.log("================\n");

      // Check configuration
      const phone = process.env.SIGNAL_PHONE;
      if (!phone) {
        console.error("Error: Signal not configured.");
        console.log("Set SIGNAL_PHONE environment variable first.");
        process.exit(1);
      }

      console.log(`Phone: ${phone}`);
      console.log("Starting continuous sync service...\n");
      console.log("Press Ctrl+C to stop.\n");

      try {
        const syncService = getSignalSyncService({
          pollInterval: 30000, // 30 seconds
          preferDaemon: true,
        });

        // Set up event handlers
        syncService.on("connected", ({ mode }) => {
          console.log(`[signal-live] Connected (mode: ${mode})`);
        });

        syncService.on("message", (message) => {
          const date = formatDate(message.created_at);
          const preview = truncate(message.content, 60);
          const direction = message.tags?.find((t: [string, string]) => t[0] === "direction")?.[1] || "?";
          const arrow = direction === "outgoing" ? "→" : "←";
          console.log(`[${date}] ${arrow} ${message.author.name}: ${preview}`);
        });

        syncService.on("sync", ({ count, mode }) => {
          if (count > 0) {
            console.log(`[signal-live] Synced ${count} messages (${mode})`);
          }
        });

        syncService.on("error", (err: Error) => {
          console.error(`[signal-live] Error: ${err.message}`);
        });

        syncService.on("disconnected", () => {
          console.log("[signal-live] Disconnected");
        });

        // Start the sync
        await syncService.start();

        // Keep running until interrupted
        await new Promise<void>((resolve) => {
          process.on("SIGINT", async () => {
            console.log("\n[signal-live] Stopping...");
            await syncService.stop();
            const stats = syncService.getStats();
            console.log(`\nFinal stats:`);
            console.log(`  Messages processed: ${stats.messagesProcessed}`);
            console.log(`  Errors: ${stats.errors}`);
            if (stats.lastSync) {
              console.log(`  Last sync: ${stats.lastSync.toISOString()}`);
            }
            resolve();
          });
        });
      } catch (error) {
        console.error("\nError starting sync:", error);
        process.exit(1);
      }
      break;
    }

    case "gmail-live": {
      console.log("Gmail Live Sync");
      console.log("===============\n");

      try {
        const syncService = getGmailSyncService({
          pollInterval: 30000, // 30 seconds fallback
          idleRestartInterval: 25 * 60 * 1000, // 25 minutes
        });

        const stats = syncService.getStats();
        console.log(`Accounts configured: ${stats.accounts.length}`);
        for (const acc of stats.accounts) {
          console.log(`  - ${acc.id}`);
        }
        console.log("\nStarting continuous sync service...");
        console.log("Press Ctrl+C to stop.\n");

        // Set up event handlers
        syncService.on("connected", ({ account, mode }: { account: string; mode: string }) => {
          console.log(`[gmail-live:${account}] Connected (mode: ${mode})`);
        });

        syncService.on("message", (message) => {
          const date = formatDate(message.created_at);
          const preview = truncate(message.content, 60);
          const direction = message.tags?.find((t: [string, string]) => t[0] === "direction")?.[1] || "?";
          const arrow = direction === "outgoing" ? "→" : "←";
          const account = message.tags?.find((t: [string, string]) => t[0] === "account")?.[1] || "?";
          console.log(`[${date}] [${account}] ${arrow} ${message.author.name}: ${preview}`);
        });

        syncService.on("sync", ({ account, count, mode }: { account: string; count: number; mode: string }) => {
          if (count > 0) {
            console.log(`[gmail-live:${account}] Synced ${count} messages (${mode})`);
          }
        });

        syncService.on("error", ({ account, error }: { account: string; error: Error }) => {
          console.error(`[gmail-live:${account}] Error: ${error.message}`);
        });

        syncService.on("disconnected", () => {
          console.log("[gmail-live] Disconnected");
        });

        // Start the sync
        await syncService.start();

        // Keep running until interrupted
        await new Promise<void>((resolve) => {
          process.on("SIGINT", async () => {
            console.log("\n[gmail-live] Stopping...");
            await syncService.stop();
            const finalStats = syncService.getStats();
            console.log(`\nFinal stats:`);
            console.log(`  Total messages processed: ${finalStats.totalMessagesProcessed}`);
            console.log(`  Total errors: ${finalStats.totalErrors}`);
            for (const acc of finalStats.accounts) {
              console.log(`  ${acc.id}: ${acc.messagesProcessed} messages, ${acc.errors} errors`);
            }
            resolve();
          });
        });
      } catch (error) {
        console.error("\nError starting sync:", error);
        process.exit(1);
      }
      break;
    }

    case "telegram-live": {
      console.log("Telegram Live Sync");
      console.log("==================\n");

      try {
        const syncService = getTelegramSyncService();

        console.log("Starting continuous sync service...");
        console.log("Monitoring: DMs, Groups, Channels");
        console.log("Press Ctrl+C to stop.\n");

        // Set up event handlers
        syncService.on("connected", ({ mode }: { mode: string }) => {
          const stats = syncService.getStats();
          console.log(`[telegram-live] Connected (mode: ${mode})`);
          console.log(`[telegram-live] Loaded ${stats.dialogsLoaded} dialogs`);
        });

        syncService.on("message", (message) => {
          const date = formatDate(message.created_at);
          const preview = truncate(message.content, 60);
          const direction = message.tags?.find((t: [string, string]) => t[0] === "direction")?.[1] || "?";
          const chatType = message.tags?.find((t: [string, string]) => t[0] === "chat_type")?.[1] || "?";
          const arrow = direction === "outgoing" ? "→" : "←";
          const typeIcon = chatType === "group" ? "👥" : chatType === "channel" ? "📢" : "💬";
          console.log(`[${date}] ${typeIcon} ${arrow} ${message.author.name}: ${preview}`);
        });

        syncService.on("sync", ({ count, mode }: { count: number; mode: string }) => {
          // Individual message events already logged above
        });

        syncService.on("error", (err: Error) => {
          console.error(`[telegram-live] Error: ${err.message}`);
        });

        syncService.on("disconnected", () => {
          console.log("[telegram-live] Disconnected");
        });

        // Start the sync
        await syncService.start();

        // Keep running until interrupted
        await new Promise<void>((resolve) => {
          process.on("SIGINT", async () => {
            console.log("\n[telegram-live] Stopping...");
            await syncService.stop();
            const finalStats = syncService.getStats();
            console.log(`\nFinal stats:`);
            console.log(`  Messages processed: ${finalStats.messagesProcessed}`);
            console.log(`  Dialogs loaded: ${finalStats.dialogsLoaded}`);
            console.log(`  Errors: ${finalStats.errors}`);
            if (finalStats.lastSync) {
              console.log(`  Last sync: ${finalStats.lastSync.toISOString()}`);
            }
            resolve();
          });
        });
      } catch (error) {
        console.error("\nError starting sync:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-backup": {
      console.log("Signal Backup Import");
      console.log("====================\n");

      if (!values.file) {
        console.error("Error: --file/-f required for Signal backup import");
        console.error("Provide the path to decrypted database.sqlite");
        console.error("\nTo decrypt a Signal Android backup:");
        console.error("  1. Export backup from Signal Android app");
        console.error("  2. Transfer to this machine");
        console.error("  3. Decrypt with signal_for_android_decryption:");
        console.error("     python3 decrypt_backup.py -p 'PASSPHRASE' backup.backup output_dir/");
        console.error("  4. Import: signal-backup -f output_dir/database.sqlite");
        process.exit(1);
      }

      const dbPath = values.file.startsWith("~")
        ? values.file.replace("~", process.env.HOME || "")
        : values.file;

      // Parse since option (days or date)
      let sinceDate: Date | undefined;
      if (values.since) {
        const daysAgo = parseInt(values.since, 10);
        if (!isNaN(daysAgo)) {
          sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        } else {
          sinceDate = new Date(values.since);
          if (isNaN(sinceDate.getTime())) {
            console.error(`Error: Invalid date or days value: ${values.since}`);
            process.exit(1);
          }
        }
      }

      if (values["dry-run"]) {
        console.log("Counting messages in Signal backup...");
        try {
          const counts = await countSignalBackupMessages({
            databasePath: dbPath,
            since: sinceDate,
          });
          console.log(`
Signal Backup Summary:
  Total Messages: ${counts.totalMessages.toLocaleString()}
  Readable Messages: ${counts.readableMessages.toLocaleString()}
  Threads: ${counts.threads.toLocaleString()}
  Recipients: ${counts.recipients.toLocaleString()}
  Date Range: ${counts.dateRange.earliest?.toISOString().slice(0, 10) || "N/A"} to ${counts.dateRange.latest?.toISOString().slice(0, 10) || "N/A"}
${sinceDate ? `\n  (Will import messages since ${sinceDate.toISOString().slice(0, 10)})` : ""}
`);
        } catch (error) {
          console.error("Error:", error);
          process.exit(1);
        }
        return;
      }

      console.log(`Importing from ${dbPath}...`);
      if (sinceDate) {
        console.log(`  Filtering to messages since ${sinceDate.toISOString().slice(0, 10)}`);
      }

      let imported = 0;
      try {
        const generator = importSignalBackup(store, {
          databasePath: dbPath,
          since: sinceDate,
          onProgress: (current, total) => {
            process.stdout.write(`\rImported ${current.toLocaleString()} / ${total.toLocaleString()} messages...`);
          },
        });

        for await (const message of generator) {
          search.index(message);
          imported++;
        }

        console.log(`\nDone! Imported ${imported.toLocaleString()} messages.`);
      } catch (error) {
        console.error("\nError during import:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-desktop": {
      console.log("Signal Desktop Import");
      console.log("=====================\n");

      // Check if database is available
      const status = getSignalDesktopStatus(values.file);
      if (!status.available) {
        console.error("Error: Signal Desktop database not found");
        console.error(`Expected at: ${status.path}`);
        console.error("\nTo export your Signal Desktop database:");
        console.error("  1. Ensure Signal Desktop is installed and synced");
        console.error("  2. Run: ./scripts/signal-desktop-export.sh");
        console.error("  Or manually export using sqlcipher");
        process.exit(1);
      }

      // Parse since option
      let sinceDate: Date | undefined;
      if (values.since) {
        const daysAgo = parseInt(values.since, 10);
        if (!isNaN(daysAgo)) {
          sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        } else {
          sinceDate = new Date(values.since);
          if (isNaN(sinceDate.getTime())) {
            console.error(`Error: Invalid date or days value: ${values.since}`);
            process.exit(1);
          }
        }
      }

      if (values["dry-run"]) {
        console.log("Counting messages in Signal Desktop database...\n");
        const counts = countSignalDesktopMessages({
          databasePath: values.file,
          since: sinceDate,
        });
        console.log(`Signal Desktop Summary:
  Database: ${status.path}
  Total Messages: ${counts.totalMessages.toLocaleString()}
  Readable Messages: ${counts.readableMessages.toLocaleString()}
  Conversations: ${counts.conversations.toLocaleString()}
  Date Range: ${counts.dateRange.earliest?.toISOString().slice(0, 10) || "N/A"} to ${counts.dateRange.latest?.toISOString().slice(0, 10) || "N/A"}
${sinceDate ? `\n  (Will import messages since ${sinceDate.toISOString().slice(0, 10)})` : ""}
`);
        return;
      }

      console.log(`Database: ${status.path}`);
      console.log(`Messages: ${status.messageCount?.toLocaleString()}`);
      console.log(`Conversations: ${status.conversationCount?.toLocaleString()}`);
      if (sinceDate) {
        console.log(`Filtering to messages since: ${sinceDate.toISOString().slice(0, 10)}`);
      }

      // Show watermark status
      const watermark = loadSignalDesktopWatermark();
      if (values.full) {
        console.log(`Mode: Full import (--full flag, ignoring watermark)`);
      } else if (watermark) {
        console.log(`Mode: Incremental (resuming from ${watermark.toISOString()})`);
      } else {
        console.log(`Mode: Full import (no previous watermark)`);
      }
      console.log("");

      let imported = 0;
      try {
        const generator = importSignalDesktop(store, {
          databasePath: values.file,
          since: sinceDate,
          skipWatermark: values.full,
          onProgress: (current, total) => {
            process.stdout.write(`\rImported ${current.toLocaleString()} / ${total.toLocaleString()} messages...`);
          },
        });

        for await (const message of generator) {
          search.index(message);
          imported++;
        }

        console.log(`\nDone! Imported ${imported.toLocaleString()} messages.`);
      } catch (error) {
        console.error("\nError during import:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-repair": {
      console.log("Signal Account Repair");
      console.log("=====================\n");

      if (!values.file) {
        console.error("Error: --file/-f required for Signal repair");
        console.error("Provide the path to the same decrypted database.sqlite used for import");
        process.exit(1);
      }

      const dbPath = values.file.startsWith("~")
        ? values.file.replace("~", process.env.HOME || "")
        : values.file;

      if (values["dry-run"]) {
        console.log("Analyzing accounts that need repair...\n");
        try {
          const result = await repairSignalAccounts({
            databasePath: dbPath,
            searchDbPath: getSearchDbPath(),
            dryRun: true,
          });
          console.log(`
Summary:
  Messages scanned: ${result.messagesScanned.toLocaleString()}
  Messages to update: ${result.messagesUpdated.toLocaleString()}
  Unique accounts: ${result.accountsMapped.toLocaleString()}

Run without --dry-run to apply these changes.`);
        } catch (error) {
          console.error("Error:", error);
          process.exit(1);
        }
        return;
      }

      console.log(`Repairing Signal accounts using ${dbPath}...\n`);

      try {
        const result = await repairSignalAccounts({
          databasePath: dbPath,
          searchDbPath: getSearchDbPath(),
          dryRun: false,
          onProgress: (current, total) => {
            process.stdout.write(`\rUpdating ${current.toLocaleString()} / ${total.toLocaleString()} messages...`);
          },
        });
        console.log(`\n
Done!
  Messages scanned: ${result.messagesScanned.toLocaleString()}
  Messages updated: ${result.messagesUpdated.toLocaleString()}
  Unique accounts: ${result.accountsMapped.toLocaleString()}
`);
      } catch (error) {
        console.error("\nError during repair:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-backfill": {
      console.log("Signal Thread Name Backfill");
      console.log("===========================\n");

      if (!values.file) {
        console.error("Error: --file/-f required for Signal backfill");
        console.error("Provide the path to the decrypted database.sqlite from Signal backup");
        process.exit(1);
      }

      const dbPath = values.file.startsWith("~")
        ? values.file.replace("~", process.env.HOME || "")
        : values.file;

      if (values["dry-run"]) {
        console.log("Analyzing thread names...\n");
        try {
          const result = await backfillSignalThreadNames({
            databasePath: dbPath,
            searchDbPath: getSearchDbPath(),
            dryRun: true,
          });
          console.log(`
Summary:
  Threads scanned: ${result.threadsScanned.toLocaleString()}
  Groups found: ${result.groupsFound.toLocaleString()}
  Contacts found: ${result.contactsFound.toLocaleString()}

Run without --dry-run to apply these updates.`);
        } catch (error) {
          console.error("Error:", error);
          process.exit(1);
        }
        return;
      }

      console.log(`Backfilling thread names from ${dbPath}...\n`);

      try {
        const result = await backfillSignalThreadNames({
          databasePath: dbPath,
          searchDbPath: getSearchDbPath(),
          dryRun: false,
          onProgress: (current, total) => {
            process.stdout.write(`\rUpdating ${current.toLocaleString()} / ${total.toLocaleString()} threads...`);
          },
        });
        console.log(`\n
Done!
  Threads updated: ${result.threadsUpdated.toLocaleString()}
  Groups: ${result.groupsFound.toLocaleString()}
  Contacts: ${result.contactsFound.toLocaleString()}
`);
      } catch (error) {
        console.error("\nError during backfill:", error);
        process.exit(1);
      }
      break;
    }

    case "signal-migrate-threads": {
      console.log("Signal Thread ID Migration");
      console.log("==========================\n");

      if (!values.file) {
        console.error("Error: --file/-f required for Signal migration");
        console.log("\nUsage: bun cli.ts signal-migrate-threads -f <path-to-database.sqlite> [--dry-run]");
        console.log("\nThe database.sqlite should be from a decrypted Signal Android backup.");
        process.exit(1);
      }

      const dbPath = values.file.startsWith("~")
        ? values.file.replace("~", process.env.HOME || "")
        : values.file;
      const dryRun = values["dry-run"] ?? false;

      console.log(`Backup database: ${dbPath}`);
      console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "APPLY CHANGES"}\n`);

      try {
        const result = await migrateSignalThreadIds({
          databasePath: dbPath,
          searchDbPath: getSearchDbPath(),
          dryRun,
          onProgress: (current, total) => {
            process.stdout.write(`\rMigrating ${current.toLocaleString()} / ${total.toLocaleString()} threads...`);
          },
        });

        if (!dryRun) {
          console.log(`\n
Done!
  Threads scanned: ${result.threadsScanned.toLocaleString()}
  Threads needing migration: ${result.threadsNeedingMigration.toLocaleString()}
  Threads migrated: ${result.threadsMigrated.toLocaleString()}
  Threads skipped: ${result.threadsSkipped.toLocaleString()}
  Errors: ${result.errors.length}
`);
        } else {
          console.log(`\n
Preview complete!
  Threads that would be migrated: ${result.threadsNeedingMigration.toLocaleString()}

Run without --dry-run to apply the migration.
`);
        }

        if (result.errors.length > 0) {
          console.log("Errors encountered:");
          for (const err of result.errors.slice(0, 10)) {
            console.log(`  - ${err}`);
          }
          if (result.errors.length > 10) {
            console.log(`  ... and ${result.errors.length - 10} more`);
          }
        }
      } catch (error) {
        console.error("\nError during migration:", error);
        process.exit(1);
      }
      break;
    }

    case "email-sync": {
      console.log("Email IMAP Sync");
      console.log("===============\n");

      // Check configuration
      const imapStatus = getImapStatus();
      if (!imapStatus.configured) {
        console.error("Error: IMAP not configured.");
        console.log("\nRequired environment variables:");
        console.log("  IMAP_HOST=imap.gmail.com");
        console.log("  IMAP_USER=you@gmail.com (or use EMAIL_ADDRESS)");
        console.log("  IMAP_PASSWORD=your-app-password");
        console.log("\nFor Gmail:");
        console.log("  1. Enable 2FA on your Google account");
        console.log("  2. Generate an App Password: https://myaccount.google.com/apppasswords");
        console.log("  3. Use the App Password as IMAP_PASSWORD");
        console.log("\nCommon IMAP hosts:");
        console.log("  Gmail:    imap.gmail.com");
        console.log("  Outlook:  outlook.office365.com");
        console.log("  Yahoo:    imap.mail.yahoo.com");
        console.log("  iCloud:   imap.mail.me.com");
        process.exit(1);
      }

      console.log(`Host: ${imapStatus.host}`);
      console.log(`User: ${imapStatus.user}`);
      console.log(`Auth: ${imapStatus.authType}`);
      console.log();

      // Parse since option (days)
      const daysBack = values.since ? parseInt(values.since, 10) : 30;
      if (isNaN(daysBack)) {
        console.error(`Error: Invalid days value: ${values.since}`);
        process.exit(1);
      }
      const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      if (values["dry-run"]) {
        console.log("Connecting and counting messages...");
        try {
          const counts = await countImapMessages({ since: sinceDate });
          console.log(`
IMAP Summary:
  Folders: ${counts.folders}
  Estimated messages: ${counts.estimatedMessages}

Folder breakdown:`);
          for (const folder of counts.folderDetails.slice(0, 20)) {
            console.log(`  ${folder.path}: ${folder.messages} messages`);
          }
          if (counts.folderDetails.length > 20) {
            console.log(`  ... and ${counts.folderDetails.length - 20} more folders`);
          }
        } catch (error) {
          console.error("Error:", error);
          process.exit(1);
        }
        return;
      }

      console.log(`Syncing emails from last ${daysBack} days...`);

      let imported = 0;
      try {
        const generator = importEmailImap(store, { since: sinceDate });

        for await (const message of generator) {
          search.index(message);
          imported++;
          if (imported % 50 === 0) {
            process.stdout.write(`\rImported ${imported} messages...`);
          }
        }

        console.log(`\nDone! Imported ${imported} messages.`);
      } catch (error) {
        console.error("\nError during sync:", error);
        process.exit(1);
      }
      break;
    }

    case "import": {
      const [source] = args;

      if (source === "telegram") {
        if (!values.file) {
          console.error("Error: --file/-f required for Telegram import");
          process.exit(1);
        }

        if (values["dry-run"]) {
          console.log("Counting Telegram export...");
          const counts = await countTelegramExport(values.file);
          console.log(`
Telegram Export Summary:
  Chats: ${counts.chats}
  Messages: ${counts.messages}
  Participants: ${counts.participants.size}

Participants: ${Array.from(counts.participants).join(", ")}
`);
          return;
        }

        console.log(`Importing from ${values.file}...`);
        let imported = 0;
        const generator = importTelegramExport(values.file, store);

        for await (const message of generator) {
          search.index(message);
          imported++;
          if (imported % 100 === 0) {
            process.stdout.write(`\rImported ${imported} messages...`);
          }
        }

        console.log(`\nDone! Imported ${imported} messages.`);

      } else if (source === "logs") {
        const logsDir = getDefaultLogsDir();

        if (values["dry-run"]) {
          console.log("Counting Claude Code logs...");
          const counts = await countLoggingEvents(logsDir);
          console.log(`
Claude Code Logs Summary:
  Files: ${counts.files}
  Events: ${counts.events}
  Sessions: ${counts.sessions.size}
  Date Range: ${counts.dateRange?.first} to ${counts.dateRange?.last}

Event Types:`);
          for (const [type, count] of counts.eventTypes) {
            console.log(`  ${type}: ${count}`);
          }
          return;
        }

        console.log(`Importing from ${logsDir}...`);
        let imported = 0;
        const generator = importLogging(logsDir, store, {
          includeToolUse: values["include-tools"],
          includeSystemEvents: values["include-system"],
        });

        for await (const message of generator) {
          search.index(message);
          imported++;
          if (imported % 100 === 0) {
            process.stdout.write(`\rImported ${imported} messages...`);
          }
        }

        console.log(`\nDone! Imported ${imported} messages.`);

      } else if (source === "claude-web") {
        if (!values.file) {
          console.error("Error: --file/-f required for Claude Web import");
          console.error("Provide the path to the data-*.zip file downloaded from claude.ai");
          process.exit(1);
        }

        // Parse since option (days or date)
        let sinceDate: Date | undefined;
        if (values.since) {
          const daysAgo = parseInt(values.since, 10);
          if (!isNaN(daysAgo)) {
            // Treat as number of days ago
            sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          } else {
            // Try to parse as date
            sinceDate = new Date(values.since);
            if (isNaN(sinceDate.getTime())) {
              console.error(`Error: Invalid date or days value: ${values.since}`);
              process.exit(1);
            }
          }
        }

        // Extract conversations.json from ZIP
        console.log("Extracting conversations.json from ZIP...");
        let conversationsPath: string;
        try {
          conversationsPath = await extractConversationsFromZip(values.file);
        } catch (error) {
          console.error("Error extracting ZIP:", error);
          process.exit(1);
        }

        const importOptions = {
          since: sinceDate,
          includeThinking: values["include-thinking"] !== false, // default true
          includeTools: values["include-tools"] || false,
        };

        if (values["dry-run"]) {
          console.log("Counting Claude Web messages...");
          const counts = await countClaudeWebExport(conversationsPath, importOptions);
          console.log(`
Claude Web Export Summary:
  Conversations: ${counts.conversations}
  Total Messages: ${counts.messages}
    Human: ${counts.humanMessages}
    Assistant: ${counts.assistantMessages}
  Date Range: ${counts.dateRange.earliest?.toISOString().slice(0, 10) || "N/A"} to ${counts.dateRange.latest?.toISOString().slice(0, 10) || "N/A"}
${sinceDate ? `\n  (Filtered to messages since ${sinceDate.toISOString().slice(0, 10)})` : ""}
`);
          return;
        }

        console.log(`Importing from Claude Web export...`);
        if (sinceDate) {
          console.log(`  Filtering to messages since ${sinceDate.toISOString().slice(0, 10)}`);
        }

        let imported = 0;
        const generator = importClaudeWeb(conversationsPath, store, importOptions);

        for await (const message of generator) {
          search.index(message);
          imported++;
          if (imported % 100 === 0) {
            process.stdout.write(`\rImported ${imported} messages...`);
          }
        }

        console.log(`\nDone! Imported ${imported} messages.`);

      } else if (source === "telegram-api") {
        // Check for session
        if (!isTelegramApiAvailable()) {
          console.error("Error: No Telegram session found.");
          console.error("Run 'telegram-auth' first to authenticate.");
          process.exit(1);
        }

        // Parse since option (days)
        const daysBack = values.since ? parseInt(values.since, 10) : 30;
        if (isNaN(daysBack)) {
          console.error(`Error: Invalid days value: ${values.since}`);
          process.exit(1);
        }

        if (values["dry-run"]) {
          console.log("Counting Telegram chats...");
          try {
            const counts = await countTelegramApi({ daysBack });
            console.log(`
Telegram API Summary:
  Chats available: ${counts.dialogs}
  Estimated messages: ${counts.estimatedMessages}

Chats:`);
            for (const d of counts.dialogList.slice(0, 20)) {
              console.log(`  [${d.type}] ${d.title}`);
            }
            if (counts.dialogList.length > 20) {
              console.log(`  ... and ${counts.dialogList.length - 20} more`);
            }
          } catch (error) {
            console.error("Error:", error);
            process.exit(1);
          }
          return;
        }

        console.log(`Importing from Telegram API (last ${daysBack} days)...`);

        let imported = 0;
        try {
          const generator = importTelegramApi(store, { daysBack });

          for await (const message of generator) {
            search.index(message);
            imported++;
            if (imported % 50 === 0) {
              process.stdout.write(`\rImported ${imported} messages...`);
            }
          }

          console.log(`\nDone! Imported ${imported} messages.`);
        } catch (error) {
          console.error("\nError during import:", error);
          process.exit(1);
        }

      } else if (source === "email") {
        if (!values.file) {
          console.error("Error: --file/-f required for email import");
          console.error("Provide the path to .eml directory or .mbox file");
          process.exit(1);
        }

        const userEmail = getUserEmail();
        if (!userEmail) {
          console.error("Error: EMAIL_ADDRESS environment variable required");
          console.error("Set your email address in .env: EMAIL_ADDRESS=you@example.com");
          process.exit(1);
        }

        // Parse since option (days or date)
        let sinceDate: Date | undefined;
        if (values.since) {
          const daysAgo = parseInt(values.since, 10);
          if (!isNaN(daysAgo)) {
            sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          } else {
            sinceDate = new Date(values.since);
            if (isNaN(sinceDate.getTime())) {
              console.error(`Error: Invalid date or days value: ${values.since}`);
              process.exit(1);
            }
          }
        }

        if (values["dry-run"]) {
          console.log("Counting emails...");
          try {
            const counts = await countEmail({
              source: values.file,
              userEmail,
              since: sinceDate,
            });
            console.log(`
Email Import Summary:
  Messages: ${counts.messages}
  Threads: ${counts.threads}
  Accounts: ${counts.accounts.size}
  Attachments: ${counts.attachments}
  Date Range: ${counts.dateRange.earliest?.toISOString().slice(0, 10) || "N/A"} to ${counts.dateRange.latest?.toISOString().slice(0, 10) || "N/A"}
${sinceDate ? `\n  (Filtered to messages since ${sinceDate.toISOString().slice(0, 10)})` : ""}
`);
          } catch (error) {
            console.error("Error:", error);
            process.exit(1);
          }
          return;
        }

        console.log(`Importing emails from ${values.file}...`);
        console.log(`  User email: ${userEmail}`);
        if (sinceDate) {
          console.log(`  Filtering to messages since ${sinceDate.toISOString().slice(0, 10)}`);
        }

        let imported = 0;
        try {
          const generator = importEmail(store, {
            source: values.file,
            userEmail,
            since: sinceDate,
            includeAttachments: true,
          });

          for await (const message of generator) {
            search.index(message);
            imported++;
            if (imported % 100 === 0) {
              process.stdout.write(`\rImported ${imported} messages...`);
            }
          }

          console.log(`\nDone! Imported ${imported} messages.`);
        } catch (error) {
          console.error("\nError during import:", error);
          process.exit(1);
        }

      } else if (source === "signal") {
        // Alias for signal-sync
        const status = await getSignalConnectionStatus();
        if (!status.configured) {
          console.error("Error: Signal not configured.");
          console.log("Set SIGNAL_PHONE environment variable first.");
          process.exit(1);
        }

        if (!status.daemonRunning) {
          console.error("Error: Signal daemon not running.");
          console.log(`Start it with: signal-cli -a ${status.phone} daemon --tcp`);
          process.exit(1);
        }

        // Parse since option (days)
        let sinceDate: Date | undefined;
        if (values.since) {
          const daysAgo = parseInt(values.since, 10);
          if (!isNaN(daysAgo)) {
            sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          } else {
            sinceDate = new Date(values.since);
            if (isNaN(sinceDate.getTime())) {
              console.error(`Error: Invalid date or days value: ${values.since}`);
              process.exit(1);
            }
          }
        }

        if (values["dry-run"]) {
          console.log("Counting Signal conversations...");
          try {
            const counts = await countSignalMessages({ since: sinceDate });
            console.log(`
Signal Summary:
  Conversations: ${counts.conversations}
  Estimated messages: ${counts.estimatedMessages}
`);
          } catch (error) {
            console.error("Error:", error);
            process.exit(1);
          }
          return;
        }

        console.log(`Importing from Signal...`);

        let imported = 0;
        try {
          const generator = importSignal(store, {
            since: sinceDate,
            realtime: values.realtime,
          });

          for await (const message of generator) {
            search.index(message);
            imported++;
            if (imported % 10 === 0) {
              process.stdout.write(`\rImported ${imported} messages...`);
            }
          }

          console.log(`\nDone! Imported ${imported} messages.`);
        } catch (error) {
          console.error("\nError during import:", error);
          process.exit(1);
        }

      } else if (source === "whatsapp") {
        // Import from WhatsApp via Baileys
        if (!isWhatsAppAvailable()) {
          console.error("Error: No WhatsApp session found.");
          console.error("Run 'whatsapp-auth' first to authenticate via QR code.");
          process.exit(1);
        }

        // Parse since option (days)
        let sinceDate: Date | undefined;
        if (values.since) {
          const daysAgo = parseInt(values.since, 10);
          if (!isNaN(daysAgo)) {
            sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          } else {
            sinceDate = new Date(values.since);
            if (isNaN(sinceDate.getTime())) {
              console.error(`Error: Invalid date or days value: ${values.since}`);
              process.exit(1);
            }
          }
        }

        // Dry run - show chat count
        if (values["dry-run"]) {
          console.log("Counting WhatsApp chats...");
          try {
            const counts = await countWhatsAppMessages({
              since: sinceDate,
            });
            console.log(`
WhatsApp Summary:
  Chats: ${counts.chats}
  Estimated Messages: ${counts.estimatedMessages}

Chat Details:`);
            for (const chat of counts.chatDetails.slice(0, 20)) {
              console.log(`  - [${chat.type}] ${chat.name}`);
            }
            if (counts.chatDetails.length > 20) {
              console.log(`  ... and ${counts.chatDetails.length - 20} more`);
            }
          } catch (error) {
            console.error("Error counting chats:", error);
            process.exit(1);
          }
          return;
        }

        // Timeout for import (default 30s for one-shot import)
        const timeout = values.realtime ? Infinity : 30000;

        console.log(`Importing from WhatsApp${sinceDate ? ` (since ${sinceDate.toLocaleDateString()})` : ""}...`);
        if (!values.realtime) {
          console.log("Waiting 30 seconds for messages (use --realtime to continue listening)...\n");
        }

        try {
          const generator = importWhatsApp(store, {
            since: sinceDate,
            realtime: values.realtime,
            realtimeTimeout: timeout,
          });

          let imported = 0;
          for await (const message of generator) {
            imported++;
            search.index(message);
            if (imported % 10 === 0) {
              process.stdout.write(`\rImported ${imported} messages...`);
            }
          }

          console.log(`\nDone! Imported ${imported} messages.`);
        } catch (error) {
          console.error("\nError during import:", error);
          process.exit(1);
        }

      } else if (source === "whatsapp-export") {
        // Import from WhatsApp text export files
        if (!values.file) {
          console.error("Error: --file/-f required for WhatsApp export import");
          console.error("Provide path to a .txt file or directory containing exported chats");
          process.exit(1);
        }

        const { importWhatsAppExports } = await import("./importers/whatsapp-export");

        console.log(`Importing WhatsApp exports from ${values.file}...`);

        try {
          const generator = importWhatsAppExports(values.file, {
            myName: values["my-name"],
            store,
          });

          let imported = 0;
          for await (const message of generator) {
            search.index(message);
            imported++;
            if (imported % 100 === 0) {
              process.stdout.write(`\rImported ${imported} messages...`);
            }
          }

          console.log(`\nDone! Imported ${imported} messages.`);
        } catch (error) {
          console.error("\nError during import:", error);
          process.exit(1);
        }

      } else if (source === "sms") {
        // Import from KDE Connect SMS
        console.log("Checking KDE Connect status...");

        if (!isKdeConnectAvailable()) {
          console.error("Error: KDE Connect is not available");
          console.error("Make sure kdeconnectd is running and a device is paired");
          process.exit(1);
        }

        const status = await getKdeConnectStatus();
        if (!status.selectedDevice) {
          console.error("Error: No KDE Connect device available");
          console.error("Ensure a device is paired, reachable, and has SMS plugin enabled");
          process.exit(1);
        }

        console.log(`Using device: ${status.selectedDevice.name}`);

        // Parse --since option
        let sinceDate: Date | undefined;
        if (values.since) {
          sinceDate = new Date(String(values.since));
          if (isNaN(sinceDate.getTime())) {
            console.error(`Invalid date: ${values.since}`);
            process.exit(1);
          }
        }

        // Dry run - show conversation count
        if (values["dry-run"]) {
          console.log("Counting SMS conversations...");
          try {
            const counts = await countKdeConnectMessages({
              since: sinceDate,
            });
            console.log(`
SMS Summary:
  Conversations: ${counts.conversations}
  Estimated Messages: ${counts.estimatedMessages}

Conversation Details:`);
            for (const conv of counts.conversationDetails.slice(0, 20)) {
              console.log(`  - [${conv.threadId}] ${conv.displayName} (${conv.addresses.join(", ")})`);
            }
            if (counts.conversationDetails.length > 20) {
              console.log(`  ... and ${counts.conversationDetails.length - 20} more`);
            }
          } catch (error) {
            console.error("Error counting conversations:", error);
            process.exit(1);
          }
          return;
        }

        console.log(`Importing SMS${sinceDate ? ` (since ${sinceDate.toLocaleDateString()})` : ""}...`);

        try {
          const generator = importKdeConnect(store, {
            since: sinceDate,
          });

          let imported = 0;
          for await (const message of generator) {
            imported++;
            search.index(message);
            if (imported % 10 === 0) {
              process.stdout.write(`\rImported ${imported} messages...`);
            }
          }

          console.log(`\nDone! Imported ${imported} messages.`);
        } catch (error) {
          console.error("\nError during import:", error);
          process.exit(1);
        }

      } else {
        console.error(`Unknown import source: ${source}`);
        console.error("Available: telegram, telegram-api, signal, whatsapp, whatsapp-export, sms, logs, claude-web, email");
        process.exit(1);
      }
      break;
    }

    case "search": {
      const query = args.join(" ");
      if (!query) {
        console.error("Error: search query required");
        process.exit(1);
      }

      console.log(`Searching for: "${query}"\n`);
      const results = search.search(query, {
        limit,
        platforms: values.platform ? [values.platform] : undefined,
      });

      if (results.length === 0) {
        console.log("No results found.");
        return;
      }

      for (const result of results) {
        const msg = result.message;
        const date = formatDate(msg.created_at);
        const kind = kindName(msg.kind as number);
        const content = truncate(msg.content, 100);

        console.log(`[${date}] ${msg.source.platform} | ${kind}`);
        console.log(`  ${msg.author.name}: ${content}`);
        console.log(`  Score: ${result.score.toFixed(2)} | ID: ${msg.id}`);
        console.log();
      }

      console.log(`Found ${results.length} results.`);
      break;
    }

    case "recent": {
      console.log("Recent messages:\n");
      const messages = search.recent(limit);

      if (messages.length === 0) {
        console.log("No messages found. Try importing some first.");
        return;
      }

      for (const msg of messages) {
        const date = formatDate(msg.created_at);
        const content = truncate(msg.content, 100);

        console.log(`[${date}] ${msg.source.platform}`);
        console.log(`  ${msg.author.name}: ${content}`);
        console.log();
      }
      break;
    }

    case "thread": {
      const [threadId] = args;
      if (!threadId) {
        console.error("Error: thread ID required");
        process.exit(1);
      }

      console.log(`Thread: ${threadId}\n`);
      const messages = search.getThreadMessages(threadId, limit);

      if (messages.length === 0) {
        console.log("No messages found in this thread.");
        return;
      }

      for (const msg of messages) {
        const date = formatDate(msg.created_at);
        const content = truncate(msg.content, 200);

        console.log(`[${date}] ${msg.author.name}:`);
        console.log(`  ${content}`);
        console.log();
      }

      console.log(`Showing ${messages.length} messages.`);
      break;
    }

    case "threads": {
      console.log("Threads:\n");
      let count = 0;

      for await (const thread of store.listThreads(limit)) {
        count++;
        console.log(`${thread.id}`);
        console.log(`  Title: ${thread.title || "(untitled)"}`);
        console.log(`  Type: ${thread.type} | Platform: ${thread.source.platform}`);
        console.log(`  Messages: ${thread.message_count}`);
        console.log();
      }

      if (count === 0) {
        console.log("No threads found. Try importing some messages first.");
      }
      break;
    }

    case "accounts": {
      console.log("Accounts:\n");
      let count = 0;

      for await (const account of store.listAccounts(limit)) {
        count++;

        const platforms = account.identities.map((i) => i.platform).join(", ");
        console.log(`${account.id}: ${account.name}`);
        console.log(`  Platforms: ${platforms}`);
        if (account.did) {
          console.log(`  DID: ${account.did}`);
        }
        console.log();
      }

      if (count === 0) {
        console.log("No accounts found. Try importing some messages first.");
      }
      break;
    }

    case "stats": {
      const stats = search.stats();

      console.log(`
Messages Statistics
==================
Total Messages: ${stats.total}

By Kind:`);
      for (const [kind, count] of Object.entries(stats.byKind)) {
        console.log(`  ${kind}: ${count}`);
      }

      console.log(`
By Platform:`);
      for (const [platform, count] of Object.entries(stats.byPlatform)) {
        console.log(`  ${platform}: ${count}`);
      }

      if (stats.dateRange) {
        console.log(`
Date Range:
  First: ${formatDate(stats.dateRange.first)}
  Last: ${formatDate(stats.dateRange.last)}
`);
      }
      break;
    }

    case "rebuild-views": {
      console.log("Rebuilding Thread Views");
      console.log("=======================\n");
      console.log("Scanning events and computing accurate stats...");

      const result = await store.rebuildThreadViews();

      console.log(`
Done!
  Threads updated: ${result.threads}
  Messages processed: ${result.messages}
  Orphan threads created: ${result.orphans}
`);
      break;
    }

    case "rebuild-search": {
      console.log("Rebuilding Search Index");
      console.log("=======================\n");
      console.log("Scanning events and indexing messages...\n");

      let indexed = 0;
      let skipped = 0;
      let errors = 0;
      const startTime = Date.now();
      const seenIds = new Set<string>();

      // Get existing message count for comparison
      const beforeStats = search.stats();
      console.log(`Before: ${beforeStats.total.toLocaleString()} messages in search index\n`);

      for await (const event of store.getAllEvents()) {
        if (event.op === "message.created" && event.data) {
          const message = event.data as Message;

          // Skip duplicates (same message can appear multiple times in event store)
          if (seenIds.has(message.id)) {
            skipped++;
            continue;
          }
          seenIds.add(message.id);

          try {
            search.index(message);
            indexed++;

            // Progress every 10K messages
            if (indexed % 10000 === 0) {
              const elapsed = (Date.now() - startTime) / 1000;
              const rate = indexed / elapsed;
              console.log(`  Indexed: ${indexed.toLocaleString()} (${rate.toFixed(0)} msg/sec)`);
            }
          } catch (err) {
            errors++;
            if (errors <= 5) {
              console.error(`  Error indexing ${message.id}: ${err}`);
            }
          }
        }
      }

      const totalTime = (Date.now() - startTime) / 1000;
      const afterStats = search.stats();

      console.log(`
Done!
  Messages indexed: ${indexed.toLocaleString()}
  Duplicates skipped: ${skipped.toLocaleString()}
  Errors: ${errors}
  Time: ${totalTime.toFixed(1)}s (${(indexed / totalTime).toFixed(0)} msg/sec)

Search index:
  Before: ${beforeStats.total.toLocaleString()} messages
  After: ${afterStats.total.toLocaleString()} messages
  By platform:`);

      for (const [platform, count] of Object.entries(afterStats.byPlatform)) {
        console.log(`    ${platform}: ${count.toLocaleString()}`);
      }
      break;
    }

    case "extract-entities": {
      console.log("Entity Extraction");
      console.log("=================\n");

      const entityStore = createEntityStore();
      const extractor = createExtractor("haiku");

      try {
        // Check if Claude is available
        const claudeAvailable = await extractor.isAvailable();
        if (!claudeAvailable) {
          throw new Error("Claude CLI not found. Entity extraction requires the 'claude' command.");
        }

      // Get all message IDs from search index
      const allStats = search.stats();
      console.log(`Total messages in store: ${allStats.total.toLocaleString()}`);

      // Get entity store stats
      const entityStats = entityStore.getStats();
      console.log(`Already processed: ${entityStats.processed_messages.toLocaleString()}`);

      // Get all message IDs via recent (we need a way to get all IDs)
      const allMessageIds: string[] = [];
      const batchSize = 1000;
      let offset = 0;

      // Collect message IDs from search index
      console.log("\nCollecting message IDs...");
      const messagesFromSearch = search.recent(allStats.total);
      for (const msg of messagesFromSearch) {
        allMessageIds.push(msg.id);
      }

      // Find unextracted messages
      const unextracted = entityStore.getUnextractedFromList(allMessageIds);
      console.log(`Pending extraction: ${unextracted.length.toLocaleString()}`);

      if (unextracted.length === 0) {
        console.log("\nAll messages have been processed!");
        console.log(`\nEntity Statistics:`);
        console.log(`  Total entities: ${entityStats.total_entities.toLocaleString()}`);
        console.log(`  Total mentions: ${entityStats.total_mentions.toLocaleString()}`);
        console.log(`  By type:`);
        for (const [type, count] of Object.entries(entityStats.by_type)) {
          if (count > 0) console.log(`    ${type}: ${count.toLocaleString()}`);
        }
        break;
      }

      if (values["dry-run"]) {
        console.log(`\nDry run - would process ${unextracted.length.toLocaleString()} messages.`);
        const batchCount = Math.ceil(unextracted.length / 10);
        const estimatedMinutes = Math.ceil(batchCount * 3 / 60); // ~3s per batch
        console.log(`Estimated time: ${estimatedMinutes} minutes (${batchCount} batches)`);
        break;
      }

      // Apply limit if specified
      const processLimit = values.limit ? parseInt(values.limit, 10) : unextracted.length;
      const toProcess = unextracted.slice(0, processLimit);
      console.log(`\nProcessing ${toProcess.length.toLocaleString()} messages...`);
      console.log(`Using: claude -p (headless mode, zero API cost)\n`);

      let processed = 0;
      let totalEntities = 0;
      let errors = 0;
      const extractionBatchSize = 10;

      // Process in batches
      for (let i = 0; i < toProcess.length; i += extractionBatchSize) {
        const batchIds = toProcess.slice(i, Math.min(i + extractionBatchSize, toProcess.length));

        // Get full message data for batch using getByIds
        const rawMessages = search.getByIds(batchIds);
        const batchMessages = rawMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          author: msg.author.name || "Unknown",
          timestamp: msg.created_at,
        }));

        if (batchMessages.length === 0) {
          processed += batchIds.length;
          continue;
        }

        try {
          // Extract entities
          const results = await extractor.extractBatch(batchMessages);

          // Store results in transaction
          entityStore.transaction(() => {
            for (const result of results) {
              const timestamp = Date.now();

              // Store each entity
              for (const entity of result.entities) {
                const entityId = entityStore.upsertEntity(
                  entity.type,
                  entity.text, // Use raw text as normalized name for now
                  entity.confidence,
                  timestamp
                );

                entityStore.addMention({
                  entity_id: entityId,
                  message_id: result.message_id,
                  text: entity.text,
                  confidence: entity.confidence,
                });

                totalEntities++;
              }

              // Mark as processed
              entityStore.markExtracted({
                message_id: result.message_id,
                extracted_at: timestamp,
                extractor: extractor.getIdentifier(),
                entity_count: result.entities.length,
                processing_time_ms: result.processing_time_ms,
              });
            }
          });

          processed += results.length;
          process.stdout.write(
            `\rProcessed ${processed.toLocaleString()}/${toProcess.length.toLocaleString()} messages (${totalEntities.toLocaleString()} entities)...`
          );
        } catch (error) {
          errors++;
          processed += batchMessages.length;
          // Continue with next batch
        }
      }

      console.log(`\n\nDone!`);
      console.log(`  Processed: ${processed.toLocaleString()} messages`);
      console.log(`  Extracted: ${totalEntities.toLocaleString()} entities`);
      if (errors > 0) {
        console.log(`  Errors: ${errors} batches failed`);
      }

      // Show updated stats
      const finalStats = entityStore.getStats();
      console.log(`\nEntity Statistics:`);
      console.log(`  Total entities: ${finalStats.total_entities.toLocaleString()}`);
      console.log(`  By type:`);
      for (const [type, count] of Object.entries(finalStats.by_type)) {
        if (count > 0) console.log(`    ${type}: ${count.toLocaleString()}`);
      }
      } finally {
        entityStore.close();
      }
      break;
    }

    case "migrate-directions": {
      console.log("Migrate Directions");
      console.log("==================\n");
      console.log("Backfilling direction column from message tags...\n");

      // Open DB directly for migration
      const { Database } = await import("bun:sqlite");
      const db = new Database(getSearchDbPath());

      // Ensure direction column exists
      try {
        db.run(`ALTER TABLE messages_meta ADD COLUMN direction TEXT`);
        console.log("Added direction column.");
      } catch {
        // Column already exists
      }

      // Get messages without direction set
      const rows = db
        .query(
          `SELECT id, data FROM messages_meta
           WHERE direction IS NULL`
        )
        .all() as { id: string; data: string }[];

      console.log(`Found ${rows.length.toLocaleString()} messages without direction set.`);

      if (rows.length === 0) {
        console.log("No migration needed.");
        db.close();
        break;
      }

      if (values["dry-run"]) {
        // Count how many have direction in tags
        let withDirection = 0;
        for (const row of rows) {
          const msg = JSON.parse(row.data) as { tags?: [string, string][] };
          const dirTag = msg.tags?.find(([k]) => k === "direction");
          if (dirTag) withDirection++;
        }
        console.log(`${withDirection.toLocaleString()} have direction in tags.`);
        console.log("Run without --dry-run to apply migration.");
        db.close();
        break;
      }

      // Prepare update statement
      const updateStmt = db.prepare(
        `UPDATE messages_meta SET direction = ? WHERE id = ?`
      );

      let updated = 0;
      let outgoing = 0;
      let incoming = 0;

      const transaction = db.transaction(() => {
        for (const row of rows) {
          const msg = JSON.parse(row.data) as { tags?: [string, string][] };
          const dirTag = msg.tags?.find(([k]) => k === "direction");

          if (dirTag) {
            updateStmt.run(dirTag[1], row.id);
            updated++;
            if (dirTag[1] === "outgoing") outgoing++;
            if (dirTag[1] === "incoming") incoming++;
          }

          if (updated % 5000 === 0 && updated > 0) {
            process.stdout.write(
              `\rUpdated ${updated.toLocaleString()} messages...`
            );
          }
        }
      });

      transaction();

      console.log(`\n\nDone!`);
      console.log(`  Updated: ${updated.toLocaleString()} messages`);
      console.log(`  Outgoing: ${outgoing.toLocaleString()}`);
      console.log(`  Incoming: ${incoming.toLocaleString()}`);
      console.log(
        `  No direction: ${(rows.length - updated).toLocaleString()} (legacy imports)`
      );

      db.close();
      break;
    }

    case "analytics": {
      const [subcommand] = args;

      // Default DB path for search index (contains messages_meta)
      const analytics = createAnalytics(getSearchDbPath());

      try {
        if (!subcommand || subcommand === "summary") {
          // Overview summary
          console.log("Message Analytics Summary");
          console.log("=========================\n");

          const summary = analytics.getSummary();
          console.log(`Total Messages: ${summary.total_messages.toLocaleString()}`);
          console.log(`Total Threads: ${summary.total_threads.toLocaleString()}`);
          console.log(`Total Accounts: ${summary.total_accounts.toLocaleString()}`);
          console.log(`\nPlatforms:`);
          for (const [platform, count] of Object.entries(summary.platforms)) {
            console.log(`  ${platform}: ${count.toLocaleString()}`);
          }
          if (summary.date_range.first && summary.date_range.last) {
            console.log(`\nDate Range:`);
            console.log(`  First: ${formatDate(summary.date_range.first)}`);
            console.log(`  Last: ${formatDate(summary.date_range.last)}`);
          }

        } else if (subcommand === "threads" || subcommand === "priority") {
          // Thread priorities
          console.log("Thread Priority Analysis");
          console.log("========================\n");

          const priorities = analytics.getThreadPrioritiesV2({
            limit,
            platform: values.platform,
          });

          console.log(`Top ${priorities.length} priority threads:\n`);
          console.log(`${"Priority".padEnd(10)} ${"Platform".padEnd(10)} ${"Out".padEnd(5)} ${"In".padEnd(5)} ${"7d".padEnd(5)} ${"Total".padEnd(7)} ${"Last".padEnd(10)} Name / Thread ID`);
          console.log("-".repeat(120));

          for (const thread of priorities) {
            const priority = thread.priority_score.toFixed(1).padEnd(10);
            const platform = thread.platform.slice(0, 8).padEnd(10);
            const outbound = thread.outbound_messages.toString().padEnd(5);
            const inbound = thread.inbound_messages.toString().padEnd(5);
            const msgs7d = thread.messages_7d.toString().padEnd(5);
            const total = thread.total_messages.toString().padEnd(7);
            const daysAgo = Math.round(thread.days_since_last);
            const lastActive = (daysAgo === 0 ? "today" : `${daysAgo}d ago`).padEnd(10);
            const displayName = thread.title || thread.thread_id;

            console.log(`${priority} ${platform} ${outbound} ${inbound} ${msgs7d} ${total} ${lastActive} ${truncate(displayName, 50)}`);
          }

          console.log(`\nScoring: outbound/sqrt(N) + reciprocity + decay(0.5^days/7) + activity + volume`);

        } else if (subcommand === "emails") {
          // Email priorities with content signals
          console.log("Email Priority Analysis");
          console.log("=======================\n");

          const emails = analytics.getEmailPriorities({ limit });

          console.log(`Top ${emails.length} priority emails:\n`);
          console.log(`${"Priority".padEnd(10)} ${"Signals".padEnd(10)} ${"Msgs".padEnd(6)} ${"Last".padEnd(10)} Subject`);
          console.log("-".repeat(120));

          for (const email of emails) {
            const priority = email.priority_score.toFixed(1).padEnd(10);
            // Build signal indicators
            const signals = [
              email.has_financial ? "$" : "",
              email.has_urgency ? "!" : "",
              email.has_question ? "?" : "",
            ].filter(Boolean).join("") || "-";
            const msgs = email.message_count.toString().padEnd(6);
            const daysAgo = Math.round(email.days_since_last);
            const lastActive = (daysAgo === 0 ? "today" : `${daysAgo}d ago`).padEnd(10);

            console.log(`${priority} ${signals.padEnd(10)} ${msgs} ${lastActive} ${truncate(email.title, 65)}`);
          }

          console.log(`\nSignals: $ = financial/bill, ! = urgent, ? = question`);
          console.log(`Scoring: (base + keyword_bonus) × decay(0.5^days/2)`);

        } else if (subcommand === "overview" || subcommand === "all") {
          // All-platform priority overview
          const platformLimit = Math.min(limit, 20);

          // Signal threads
          console.log("Signal Threads");
          console.log("==============\n");
          console.log(`${"Priority".padEnd(10)} ${"Out".padEnd(6)} ${"In".padEnd(6)} ${"7d".padEnd(5)} ${"Last".padEnd(8)} Name`);
          console.log("-".repeat(90));

          const signalThreads = analytics.getThreadPrioritiesV2({ limit: platformLimit, platform: "signal" });
          for (const t of signalThreads) {
            const priority = t.priority_score.toFixed(0).padEnd(10);
            const out = t.outbound_messages.toString().padEnd(6);
            const inb = t.inbound_messages.toString().padEnd(6);
            const msgs7d = t.messages_7d.toString().padEnd(5);
            const daysAgo = Math.round(t.days_since_last);
            const last = (daysAgo === 0 ? "today" : `${daysAgo}d`).padEnd(8);
            console.log(`${priority} ${out} ${inb} ${msgs7d} ${last} ${truncate(t.title || t.thread_id, 45)}`);
          }

          // Telegram threads
          console.log("\n\nTelegram Threads");
          console.log("================\n");
          console.log(`${"Priority".padEnd(10)} ${"Out".padEnd(6)} ${"In".padEnd(6)} ${"7d".padEnd(5)} ${"Last".padEnd(8)} Name`);
          console.log("-".repeat(90));

          const telegramThreads = analytics.getThreadPrioritiesV2({ limit: platformLimit, platform: "telegram" });
          for (const t of telegramThreads) {
            const priority = t.priority_score.toFixed(0).padEnd(10);
            const out = t.outbound_messages.toString().padEnd(6);
            const inb = t.inbound_messages.toString().padEnd(6);
            const msgs7d = t.messages_7d.toString().padEnd(5);
            const daysAgo = Math.round(t.days_since_last);
            const last = (daysAgo === 0 ? "today" : `${daysAgo}d`).padEnd(8);
            console.log(`${priority} ${out} ${inb} ${msgs7d} ${last} ${truncate(t.title || t.thread_id, 45)}`);
          }

          // Email threads
          console.log("\n\nEmail Threads");
          console.log("=============\n");
          console.log(`${"Priority".padEnd(10)} ${"Signals".padEnd(8)} ${"Msgs".padEnd(6)} ${"Last".padEnd(8)} Subject`);
          console.log("-".repeat(90));

          const emailThreads = analytics.getEmailPriorities({ limit: platformLimit });
          for (const e of emailThreads) {
            const priority = e.priority_score.toFixed(0).padEnd(10);
            const signals = [
              e.has_financial ? "$" : "",
              e.has_urgency ? "!" : "",
              e.has_question ? "?" : "",
            ].filter(Boolean).join("") || "-";
            const msgs = e.message_count.toString().padEnd(6);
            const daysAgo = Math.round(e.days_since_last);
            const last = (daysAgo === 0 ? "today" : `${daysAgo}d`).padEnd(8);
            console.log(`${priority} ${signals.padEnd(8)} ${msgs} ${last} ${truncate(e.title, 50)}`);
          }

          console.log("\n\nScoring:");
          console.log("  Chat: outbound/sqrt(N) + reciprocity + decay(0.5^days/7) + activity + volume");
          console.log("  Email: (base + keyword_bonus) × decay(0.5^days/2)");
          console.log("  Signals: $ = financial, ! = urgent, ? = question");

        } else if (subcommand === "contacts") {
          // Contact statistics
          console.log("Contact Analysis");
          console.log("================\n");

          const contacts = analytics.getContactStats({
            limit,
            platform: values.platform,
          });

          console.log(`Top ${contacts.length} contacts by message volume:\n`);
          console.log(`${"Messages".padEnd(10)} ${"Threads".padEnd(10)} ${"Avg/Thread".padEnd(12)} ${"Last Active".padEnd(14)} Account ID`);
          console.log("-".repeat(100));

          for (const contact of contacts) {
            const msgs = contact.total_messages.toString().padEnd(10);
            const threads = contact.thread_count.toString().padEnd(10);
            const avg = contact.avg_messages_per_thread.toFixed(1).padEnd(12);
            const daysAgo = Math.round(contact.days_since_last);
            const lastActive = daysAgo === 0 ? "today" : `${daysAgo}d ago`;

            console.log(`${msgs} ${threads} ${avg} ${lastActive.padEnd(14)} ${truncate(contact.account_id, 45)}`);
          }

        } else if (subcommand === "accounts" || subcommand === "people") {
          // Account priorities
          console.log("Account Priority Analysis");
          console.log("=========================\n");

          const priorities = analytics.getAccountPriorities({
            limit,
            platform: values.platform,
          });

          console.log(`Top ${priorities.length} priority accounts:\n`);
          console.log(`${"Priority".padEnd(10)} ${"7d".padEnd(6)} ${"30d".padEnd(6)} ${"Total".padEnd(8)} ${"Threads".padEnd(8)} ${"Last Active".padEnd(12)} Account ID`);
          console.log("-".repeat(110));

          for (const account of priorities) {
            const priority = account.priority_score.toFixed(1).padEnd(10);
            const msgs7d = account.messages_7d.toString().padEnd(6);
            const msgs30d = account.messages_30d.toString().padEnd(6);
            const total = account.total_messages.toString().padEnd(8);
            const threads = account.thread_count.toString().padEnd(8);
            const daysAgo = Math.round(account.days_since_last);
            const lastActive = daysAgo === 0 ? "today" : `${daysAgo}d ago`;

            console.log(`${priority} ${msgs7d} ${msgs30d} ${total} ${threads} ${lastActive.padEnd(12)} ${truncate(account.account_id, 45)}`);
          }

          console.log(`\nScoring: recency (50/days) + activity (3×7d_msgs) + volume (20×log10(total))`);

        } else if (subcommand === "contact-priorities" || subcommand === "inner-circle") {
          // Contact priorities with outbound message weighting
          console.log("Contact Priority Analysis (Outbound-Weighted)");
          console.log("=============================================\n");

          // Build exclusion patterns for self (the user)
          const selfPatterns = [
            "ygg",
            "shawn anderson",
            "me", // Signal uses "Me" for outgoing messages
            process.env.USER?.toLowerCase() || "",
          ].filter(Boolean);

          const priorities = analytics.getContactPriorities({
            limit,
            excludeSelf: selfPatterns,
          });

          console.log(`Top ${priorities.length} contacts by outbound-weighted priority:\n`);
          console.log(`${"Priority".padEnd(10)} ${"Out".padEnd(6)} ${"In".padEnd(6)} ${"Total".padEnd(8)} ${"Threads".padEnd(8)} ${"Platforms".padEnd(12)} Name`);
          console.log("-".repeat(120));

          for (const contact of priorities) {
            const priority = contact.priority_score.toFixed(1).padEnd(10);
            const out = contact.outbound_messages.toString().padEnd(6);
            const inbound = contact.inbound_messages.toString().padEnd(6);
            const total = contact.total_messages.toString().padEnd(8);
            const threads = contact.thread_count.toString().padEnd(8);
            const platforms = contact.platforms.join(",").slice(0, 11).padEnd(12);

            console.log(`${priority} ${out} ${inbound} ${total} ${threads} ${platforms} ${contact.display_name.slice(0, 40)}`);
          }

          console.log(`\nScoring: outbound (50×out) + volume (20×log10(total)) + recency (10/days) + diversity (10×threads)`);
          console.log(`Key insight: Messages YOU send indicate priority; inbound might be group noise.`);

        } else if (subcommand === "network") {
          // Network degree analysis
          console.log("Network Analysis");
          console.log("================\n");

          console.log("Thread Network (by unique participants):\n");
          const threadNetwork = analytics.getThreadNetworkDegree(Math.ceil(limit / 2));
          console.log(`${"Degree".padEnd(8)} ${"Messages".padEnd(10)} ${"Last Active".padEnd(14)} Thread ID`);
          console.log("-".repeat(90));

          for (const node of threadNetwork) {
            const degree = node.degree.toString().padEnd(8);
            const msgs = node.messages.toString().padEnd(10);
            const daysAgo = Math.round((Date.now() - node.last_active) / 86400000);
            const lastActive = daysAgo === 0 ? "today" : `${daysAgo}d ago`;

            console.log(`${degree} ${msgs} ${lastActive.padEnd(14)} ${truncate(node.id, 50)}`);
          }

          console.log("\n\nAccount Network (by thread participation):\n");
          const accountNetwork = analytics.getAccountNetworkDegree(Math.ceil(limit / 2));
          console.log(`${"Threads".padEnd(10)} ${"Messages".padEnd(10)} ${"Last Active".padEnd(14)} Account ID`);
          console.log("-".repeat(90));

          for (const node of accountNetwork) {
            const threads = node.degree.toString().padEnd(10);
            const msgs = node.messages.toString().padEnd(10);
            const daysAgo = Math.round((Date.now() - node.last_active) / 86400000);
            const lastActive = daysAgo === 0 ? "today" : `${daysAgo}d ago`;

            console.log(`${threads} ${msgs} ${lastActive.padEnd(14)} ${truncate(node.id, 45)}`);
          }

        } else if (subcommand === "activity") {
          // Activity patterns
          console.log("Activity Patterns");
          console.log("=================\n");

          const patterns = analytics.getActivityPatterns();

          // Build hour × day grid
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
          let maxCount = 0;

          for (const p of patterns) {
            grid[p.day_of_week][p.hour] = p.message_count;
            if (p.message_count > maxCount) maxCount = p.message_count;
          }

          // Display heatmap
          console.log("Messages by hour and day of week:\n");
          console.log("     " + Array.from({ length: 24 }, (_, i) => i.toString().padStart(2)).join(" "));
          console.log("     " + "-".repeat(72));

          for (let d = 0; d < 7; d++) {
            const row = grid[d].map(c => {
              if (c === 0) return " .";
              const intensity = Math.ceil((c / maxCount) * 4);
              const chars = [" .", " ░", " ▒", " ▓", " █"];
              return chars[intensity] || " █";
            }).join("");
            console.log(`${days[d].padStart(3)} |${row}`);
          }

          console.log("\n(. = no activity, ░▒▓█ = increasing activity)");

        } else if (subcommand === "volume") {
          // Volume over time
          console.log("Message Volume Over Time");
          console.log("========================\n");

          const daysBack = values.since ? parseInt(values.since, 10) : 30;
          const volume = analytics.getVolumeOverTime(daysBack);

          if (volume.length === 0) {
            console.log("No messages in this time period.");
            break;
          }

          // Find max for scaling
          const maxVol = Math.max(...volume.map(v => v.count));
          const barWidth = 50;

          console.log(`Daily message volume (last ${daysBack} days):\n`);

          for (const v of volume) {
            const barLen = Math.round((v.count / maxVol) * barWidth);
            const bar = "█".repeat(barLen);
            console.log(`${v.date} │${bar} ${v.count}`);
          }

          const total = volume.reduce((sum, v) => sum + v.count, 0);
          const avg = Math.round(total / volume.length);
          console.log(`\nTotal: ${total.toLocaleString()} | Average: ${avg}/day`);

        } else if (subcommand === "thread") {
          // Thread details
          const threadId = args[1];
          if (!threadId) {
            console.error("Error: thread ID required");
            console.error("Usage: analytics thread <thread_id>");
            process.exit(1);
          }

          const details = analytics.getThreadDetails(threadId, limit);
          if (!details) {
            console.error(`Thread not found: ${threadId}`);
            process.exit(1);
          }

          console.log("Thread Details");
          console.log("==============\n");
          console.log(`Thread ID: ${threadId}`);
          console.log(`Total Messages: ${details.stats.total_messages.toLocaleString()}`);
          console.log(`Unique Accounts: ${details.stats.unique_accounts}`);
          console.log(`First Message: ${formatDate(details.stats.first_message)}`);
          console.log(`Last Message: ${formatDate(details.stats.last_message)}`);

          console.log(`\nRecent Messages:\n`);
          for (const msg of details.recent_messages) {
            const date = formatDate(msg.created_at);
            console.log(`[${date}] ${msg.author}:`);
            console.log(`  ${truncate(msg.content, 150)}`);
            console.log();
          }

        } else {
          console.error(`Unknown analytics subcommand: ${subcommand}`);
          console.log(`
Available subcommands:
  analytics                   Show overall summary
  analytics summary           Show overall summary
  analytics threads           Priority ranking of threads (alias: priority)
  analytics accounts          Priority ranking of accounts/contacts (alias: people)
  analytics contacts          Contact analysis by message volume
  analytics contact-priorities Outbound-weighted contact priorities (alias: inner-circle)
  analytics network           Network degree analysis
  analytics activity          Activity heatmap by hour/day
  analytics volume [-s N]     Message volume over time (default: 30 days)
  analytics thread <id>       Detailed thread information

Options:
  -l, --limit <n>             Limit results (default: 20)
  -p, --platform <name>       Filter by platform
  -s, --since <days>          Days back for volume chart
`);
          process.exit(1);
        }
      } finally {
        analytics.close();
      }
      break;
    }

    case "embed": {
      console.log("Generate Embeddings");
      console.log("===================\n");

      const embedder = createOllamaEmbedder();
      const embeddingStore = createEmbeddingStore();

      try {
        // Check Ollama availability
        const status = await embedder.isAvailable();
        if (!status.available) {
          console.error(`Error: Ollama not available - ${status.error || "unknown"}`);
          console.error("\nTo install Ollama:");
          console.error("  curl -fsSL https://ollama.com/install.sh | sh");
          console.error("\nThen pull the model:");
          console.error("  ollama pull nomic-embed-text");
          process.exit(1);
        }

        if (!status.modelLoaded) {
          console.error(`Error: Model ${embedder.getModel()} not loaded`);
          console.error("\nTo load the model:");
          console.error("  ollama pull nomic-embed-text");
          process.exit(1);
        }

        console.log(`Model: ${embedder.getModel()} (${embedder.getDimensions()} dimensions)`);

        // Get all message IDs
        const allIds = search.getAllIds();
        console.log(`Total messages: ${allIds.length.toLocaleString()}`);

        // Find unembedded messages
        const unembeddedIds = embeddingStore.getUnembeddedIds(allIds);
        console.log(`Already embedded: ${(allIds.length - unembeddedIds.length).toLocaleString()}`);
        console.log(`Need embedding: ${unembeddedIds.length.toLocaleString()}`);

        if (values["dry-run"]) {
          console.log("\n[Dry run - no embeddings generated]");
          break;
        }

        if (unembeddedIds.length === 0) {
          console.log("\nAll messages are already embedded.");
          break;
        }

        console.log(`\nGenerating embeddings...`);
        const startTime = Date.now();
        let completed = 0;
        let errors = 0;

        // Process in batches (save every 10 for resumability)
        const saveBatchSize = 10;
        const batchEmbeddings: Array<{ id: string; embedding: Float32Array; model: string }> = [];

        for (const id of unembeddedIds) {
          const messages = search.getMessagesForEmbedding([id]);
          if (messages.length === 0) continue;

          const { text } = messages[0];
          try {
            const result = await embedder.embed(text);
            batchEmbeddings.push({ id, embedding: result.embedding, model: result.model });
            completed++;
          } catch (error) {
            errors++;
            console.error(`\nError embedding ${id}: ${error}`);
          }

          // Save batch periodically
          if (batchEmbeddings.length >= saveBatchSize) {
            embeddingStore.storeBatch(batchEmbeddings);
            batchEmbeddings.length = 0;
          }

          // Progress update
          const total = unembeddedIds.length;
          const pct = ((completed + errors) / total * 100).toFixed(1);
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = completed / elapsed;
          const eta = rate > 0 ? (total - completed - errors) / rate : 0;
          process.stdout.write(
            `\rProgress: ${(completed + errors).toLocaleString()} / ${total.toLocaleString()} (${pct}%) - ${rate.toFixed(1)}/s - ETA: ${formatDuration(eta)}`
          );
        }

        // Save any remaining
        if (batchEmbeddings.length > 0) {
          embeddingStore.storeBatch(batchEmbeddings);
        }

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`\n\nComplete!`);
        console.log(`  Embedded: ${completed.toLocaleString()}`);
        console.log(`  Errors: ${errors.toLocaleString()}`);
        console.log(`  Time: ${formatDuration(totalTime)}`);
        console.log(`  Rate: ${(completed / totalTime).toFixed(1)} messages/sec`);

        const stats = embeddingStore.stats();
        console.log(`  Storage: ${(stats.sizeBytes / 1024 / 1024).toFixed(1)} MB`);
      } finally {
        embeddingStore.close();
      }
      break;
    }

    case "embed-stats": {
      console.log("Embedding Statistics");
      console.log("====================\n");

      const embeddingStore = createEmbeddingStore();
      try {
        const stats = embeddingStore.stats();
        const allIds = search.getAllIds();

        console.log(`Total embeddings: ${stats.total.toLocaleString()}`);
        console.log(`Total messages: ${allIds.length.toLocaleString()}`);
        console.log(`Coverage: ${((stats.total / allIds.length) * 100).toFixed(1)}%`);
        console.log(`Dimensions: ${stats.dimensions || "N/A"}`);
        console.log(`Storage: ${(stats.sizeBytes / 1024 / 1024).toFixed(1)} MB`);

        if (Object.keys(stats.byModel).length > 0) {
          console.log(`\nBy model:`);
          for (const [model, count] of Object.entries(stats.byModel)) {
            console.log(`  ${model}: ${count.toLocaleString()}`);
          }
        }
      } finally {
        embeddingStore.close();
      }
      break;
    }

    case "semantic-search": {
      const query = args.join(" ");
      if (!query) {
        console.error("Error: Search query required");
        console.error("Usage: semantic-search <query>");
        process.exit(1);
      }

      console.log(`Semantic search: "${query}"\n`);

      try {
        const results = await search.semanticSearch(query, {
          limit,
          platforms: values.platform ? [values.platform] : undefined,
          since: values.since ? Date.parse(values.since) : undefined,
        });

        if (results.length === 0) {
          console.log("No results found.");
          console.log("\nTip: Run 'embed' first to generate embeddings.");
          break;
        }

        console.log(`Found ${results.length} results:\n`);

        for (const { message, score } of results) {
          const date = new Date(message.created_at).toLocaleString();
          const similarity = (score * 100).toFixed(1);
          console.log(`[${similarity}%] ${message.author.name || "Unknown"} (${date})`);
          console.log(`  ${message.content.slice(0, 150)}${message.content.length > 150 ? "..." : ""}`);
          console.log();
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Ollama")) {
          console.error(`Error: ${error.message}`);
          console.error("\nMake sure Ollama is running:");
          console.error("  ollama serve");
          process.exit(1);
        }
        throw error;
      }
      break;
    }

    case "migrate-telegram-directions": {
      console.log("Migrate Telegram Directions");
      console.log("===========================\n");

      // Get user's Telegram ID
      let myUserId = process.env.TELEGRAM_USER_ID;

      // If not in env, try to get from API session
      if (!myUserId && hasSession()) {
        try {
          console.log("Fetching user ID from Telegram API session...");
          const client = new TelegramApiClient();
          await client.connect();
          const me = await client.getMe();
          myUserId = me.id;
          await client.disconnect();
          console.log(`User ID from API: ${myUserId}`);
        } catch (e) {
          console.warn("Could not get user ID from API session:", e);
        }
      }

      if (!myUserId) {
        console.error("Error: Cannot determine your Telegram user ID.");
        console.error("\nTo fix this, either:");
        console.error("  1. Set TELEGRAM_USER_ID environment variable");
        console.error("  2. Run telegram-auth to create an API session");
        console.error("  3. Re-export Telegram data with 'Account Information' selected");
        process.exit(1);
      }

      const myAccountId = `tg_${myUserId}`;
      console.log(`Your Telegram account ID: ${myAccountId}\n`);

      // Open DB directly for migration
      const { Database } = await import("bun:sqlite");
      const db = new Database(getSearchDbPath());

      // Ensure direction column exists
      try {
        db.run(`ALTER TABLE messages_meta ADD COLUMN direction TEXT`);
        console.log("Added direction column.");
      } catch {
        // Column already exists
      }

      // Get all Telegram messages without direction set
      const rows = db
        .query(
          `SELECT id, account_id, data FROM messages_meta
           WHERE platform = 'telegram' AND direction IS NULL`
        )
        .all() as { id: string; account_id: string; data: string }[];

      console.log(`Found ${rows.length.toLocaleString()} Telegram messages without direction.\n`);

      if (rows.length === 0) {
        console.log("No migration needed.");
        db.close();
        break;
      }

      if (values["dry-run"]) {
        // Count outgoing vs incoming
        let outgoing = 0;
        let incoming = 0;
        for (const row of rows) {
          if (row.account_id === myAccountId) {
            outgoing++;
          } else {
            incoming++;
          }
        }
        console.log("Dry run - would update:");
        console.log(`  Outgoing: ${outgoing.toLocaleString()}`);
        console.log(`  Incoming: ${incoming.toLocaleString()}`);
        console.log("\nRun without --dry-run to apply migration.");
        db.close();
        break;
      }

      // Prepare update statements
      const updateDirectionStmt = db.prepare(
        `UPDATE messages_meta SET direction = ? WHERE id = ?`
      );
      const updateDataStmt = db.prepare(
        `UPDATE messages_meta SET data = ? WHERE id = ?`
      );

      let updated = 0;
      let outgoing = 0;
      let incoming = 0;

      const transaction = db.transaction(() => {
        for (const row of rows) {
          const isOutgoing = row.account_id === myAccountId;
          const direction = isOutgoing ? "outgoing" : "incoming";

          // Update direction column
          updateDirectionStmt.run(direction, row.id);

          // Also update the data JSON to include direction tag
          const msg = JSON.parse(row.data) as { tags?: [string, string][] };
          const existingTags = msg.tags || [];
          const hasDirectionTag = existingTags.some(([k]) => k === "direction");

          if (!hasDirectionTag) {
            msg.tags = [["direction", direction], ...existingTags];
            updateDataStmt.run(JSON.stringify(msg), row.id);
          }

          updated++;
          if (isOutgoing) outgoing++;
          else incoming++;

          if (updated % 1000 === 0) {
            process.stdout.write(
              `\rUpdated ${updated.toLocaleString()} messages...`
            );
          }
        }
      });

      transaction();

      console.log(`\n\nDone!`);
      console.log(`  Updated: ${updated.toLocaleString()} messages`);
      console.log(`  Outgoing: ${outgoing.toLocaleString()}`);
      console.log(`  Incoming: ${incoming.toLocaleString()}`);

      db.close();
      break;
    }

    case "repair-signal-direction": {
      console.log("Repair Signal Direction Tags");
      console.log("============================\n");
      console.log("This fixes direction tagging based on author name:");
      console.log("  - author.name === 'Me' → direction: 'outgoing'");
      console.log("  - author.name !== 'Me' → direction: 'incoming'\n");

      const searchIndex = createSearchIndex(getSearchDbPath());
      const result = searchIndex.repairSignalDirection();
      searchIndex.close();

      console.log("Done!");
      console.log(`  Fixed: ${result.fixed.toLocaleString()} messages`);
      console.log(`  Already correct: ${result.alreadyCorrect.toLocaleString()} messages`);
      break;
    }

    case "repair-email-direction": {
      console.log("Repair Email Direction Tags");
      console.log("===========================\n");

      // Get email addresses from --email flags or environment
      const myEmails: string[] = [...(values.email || [])];

      // Also check environment
      const envEmails = process.env.MY_EMAILS?.split(",").map(e => e.trim()).filter(Boolean);
      if (envEmails) myEmails.push(...envEmails);

      if (myEmails.length === 0) {
        console.error("Error: No email addresses provided.");
        console.error("\nUsage:");
        console.error("  messages repair-email-direction --email you@example.com --email you@work.com");
        console.error("\nOr set MY_EMAILS environment variable (comma-separated):");
        console.error("  export MY_EMAILS='you@example.com,you@work.com'");
        process.exit(1);
      }

      console.log("Your email addresses:");
      for (const email of myEmails) {
        console.log(`  - ${email}`);
      }
      console.log("");

      const searchIndex2 = createSearchIndex(getSearchDbPath());
      const result2 = searchIndex2.repairEmailDirection(myEmails);
      searchIndex2.close();

      console.log("Done!");
      console.log(`  Fixed: ${result2.fixed.toLocaleString()} messages`);
      console.log(`  Outgoing (from you): ${result2.outgoing.toLocaleString()}`);
      console.log(`  Incoming: ${result2.incoming.toLocaleString()}`);
      break;
    }

    case "daemon": {
      const subcommand = args[0];
      const client = getIpcClient();

      if (!subcommand || subcommand === "status") {
        if (!client.isRunning()) {
          console.log("Daemon Status: STOPPED");
          console.log("\nThe daemon is not running.");
          console.log("Start with: messages daemon start");
          break;
        }

        const status = await client.status();
        if (!status) {
          console.error("Failed to get status from daemon");
          process.exit(1);
        }

        console.log("Daemon Status");
        console.log("=============\n");
        console.log(`Status: ${status.daemon.status.toUpperCase()}`);
        console.log(`PID: ${status.daemon.pid}`);
        console.log(`Uptime: ${formatDuration(status.daemon.uptime)}`);
        console.log(`Started: ${status.daemon.startedAt}`);
        console.log("");

        console.log("Platforms:");
        for (const platform of status.platforms) {
          const statusIcon =
            platform.status === "connected" ? "\u2713" :
            platform.status === "error" ? "\u2717" :
            platform.status === "recovering" ? "\u21BB" : "\u2022";
          console.log(`  ${statusIcon} ${platform.id}: ${platform.status}`);
          if (platform.messageCount > 0) {
            console.log(`      Messages: ${platform.messageCount.toLocaleString()}`);
          }
          if (platform.lastMessage) {
            console.log(`      Last: ${platform.lastMessage}`);
          }
          if (platform.lastError) {
            console.log(`      Error: ${platform.lastError}`);
          }
        }
        console.log("");
        console.log(`Summary: ${status.summary.healthy}/${status.summary.total} platforms healthy`);

      } else if (subcommand === "start") {
        if (client.isRunning()) {
          console.log("Daemon is already running.");
          console.log("Use 'daemon status' to check status.");
          break;
        }

        console.log("Starting daemon...");
        console.log("(Use systemd for production: systemctl --user start messages-daemon)\n");

        const daemon = new MessagesDaemon();
        await daemon.start();

      } else if (subcommand === "stop") {
        if (!client.isRunning()) {
          console.log("Daemon is not running.");
          break;
        }

        console.log("Stopping daemon...");
        const response = await client.stop();
        if (response.success) {
          console.log("Daemon stopped.");
        } else {
          console.error(`Failed to stop: ${response.error}`);
          process.exit(1);
        }

      } else if (subcommand === "restart") {
        if (!client.isRunning()) {
          console.log("Daemon is not running. Starting...");
          const daemon = new MessagesDaemon();
          await daemon.start();
        } else {
          console.log("Restarting daemon...");
          const response = await client.restart();
          if (response.success) {
            console.log("Daemon restarted.");
          } else {
            console.error(`Failed to restart: ${response.error}`);
            process.exit(1);
          }
        }

      } else if (subcommand === "health") {
        if (!client.isRunning()) {
          console.log("Daemon is not running.");
          break;
        }

        const health = await client.health();
        if (!health) {
          console.error("Failed to get health from daemon");
          process.exit(1);
        }

        console.log("Health Report");
        console.log("=============\n");
        console.log(`Overall: ${health.overall.toUpperCase()}`);
        console.log(`Checked: ${health.checkedAt}`);
        console.log("");

        for (const check of health.platforms) {
          const icon = check.healthy ? "\u2713" : "\u2717";
          console.log(`${icon} ${check.platform}:`);
          console.log(`    Connected: ${check.connected}`);
          if (check.lastActivity) {
            console.log(`    Last Activity: ${check.lastActivity}`);
          }
          if (check.issues.length > 0) {
            console.log(`    Issues:`);
            for (const issue of check.issues) {
              console.log(`      - ${issue}`);
            }
          }
        }

      } else if (subcommand === "restart-platform") {
        const platform = args[1] as PlatformId;
        if (!platform) {
          console.error("Usage: daemon restart-platform <platform>");
          console.error("Platforms: signal, whatsapp, discord, telegram, gmail");
          process.exit(1);
        }

        if (!client.isRunning()) {
          console.log("Daemon is not running.");
          break;
        }

        console.log(`Restarting ${platform}...`);
        const response = await client.restartPlatform(platform);
        if (response.success) {
          console.log(`Platform ${platform} restarted.`);
        } else {
          console.error(`Failed to restart: ${response.error}`);
          process.exit(1);
        }

      } else {
        console.error(`Unknown daemon subcommand: ${subcommand}`);
        console.log(`
Available subcommands:
  daemon status               Show daemon and platform status
  daemon start                Start the daemon
  daemon stop                 Stop the daemon
  daemon restart              Restart the daemon
  daemon health               Show detailed health report
  daemon restart-platform <p> Restart a specific platform
`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// Helper to format duration in human-readable form
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Run
main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
