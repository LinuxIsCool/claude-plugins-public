#!/usr/bin/env bun
/**
 * Unified Voice Hook
 *
 * Handles all Claude Code hook events for voice integration.
 * Events: SessionStart, Stop, Notification, SubagentStop
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Load .env from project root (cwd passed in hook data)
// This ensures environment variables are available regardless of where Bun was invoked
function loadEnvFile(cwd: string): void {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) return;

  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Only set if not already in environment (existing env takes precedence)
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silently continue if .env can't be loaded
  }
}

// Import voice modules
import { getDefaultTTSFactory, speakAndPlay } from "../src/adapters/tts/index.js";
import { resolveVoiceForSession, resolveVoiceForAgent, normalizeVoiceSettings } from "../src/identity/resolver.js";
import type { TTSOptions } from "../src/ports/tts.js";

// Import personality system
import { getPersonalityManager, TextTransformer } from "../src/personality/index.js";
import type { TransformContext } from "../src/personality/index.js";

// Import queue coordination
import { VoiceQueueClient, VoicePriority } from "../src/coordination/index.js";

// Import settings
import { isVoiceEnabled } from "../src/settings.js";

// Whether to use the queue daemon (can be disabled via env)
const USE_QUEUE = process.env.VOICE_QUEUE_ENABLED !== "0";

/**
 * Map event types to voice priorities
 */
const EVENT_PRIORITIES: Record<string, VoicePriority> = {
  SessionStart: VoicePriority.LOW,
  Stop: VoicePriority.NORMAL,
  SubagentStop: VoicePriority.NORMAL,
  Notification: VoicePriority.HIGH,
};

/**
 * Debug logging - always logs to file, only stderr if DEBUG
 */
const DEBUG = process.env.VOICE_DEBUG === "1";
const LOG_PATH = process.env.VOICE_LOG_PATH || "/tmp/voice-hook.log";
const LOCK_DIR = "/tmp/claude-voice-locks";

// Get unique invocation ID for tracing
const INVOCATION_ID = Math.random().toString(36).slice(2, 8);

function log(msg: string, alwaysLog: boolean = false): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${INVOCATION_ID}] ${msg}\n`;

  // Always write to log file for diagnostics
  Bun.write(LOG_PATH, logLine, { append: true }).catch(() => {});

  // Only stderr if DEBUG mode
  if (DEBUG || alwaysLog) {
    console.error(`[voice:${INVOCATION_ID}] ${msg}`);
  }
}

/**
 * Lock file mechanism to prevent overlapping voice output
 * Returns true if lock acquired, false if another instance is speaking
 */
async function acquireLock(sessionId: string, event: string): Promise<boolean> {
  const { mkdir, writeFile, readFile, unlink, stat } = await import("fs/promises");

  try {
    await mkdir(LOCK_DIR, { recursive: true });
  } catch {}

  const lockFile = `${LOCK_DIR}/${sessionId}-${event}.lock`;

  try {
    // Check if lock exists and is recent (within 30 seconds)
    const lockStat = await stat(lockFile).catch(() => null);
    if (lockStat) {
      const ageMs = Date.now() - lockStat.mtimeMs;
      if (ageMs < 30000) {
        log(`Lock exists (age: ${ageMs}ms), skipping duplicate ${event}`);
        return false;
      }
      // Stale lock, remove it
      await unlink(lockFile).catch(() => {});
    }

    // Create lock
    await writeFile(lockFile, `${INVOCATION_ID}\n${Date.now()}`);
    log(`Acquired lock for ${event}`);
    return true;
  } catch (e) {
    log(`Failed to acquire lock: ${e}`);
    return true; // Proceed anyway on error
  }
}

async function releaseLock(sessionId: string, event: string): Promise<void> {
  const { unlink } = await import("fs/promises");
  const lockFile = `${LOCK_DIR}/${sessionId}-${event}.lock`;

  try {
    await unlink(lockFile);
    log(`Released lock for ${event}`);
  } catch {}
}

/**
 * Voice event structure for logging
 */
interface VoiceEvent {
  timestamp: string;
  session_id: string;
  event: string;
  text: string;
  text_length: number;
  backend: string;
  voice_id: string;
  voice_source: "session" | "agent" | "model" | "system";
  agent_id?: string;
  duration_ms?: number;
  success: boolean;
  error?: string;
}

/**
 * Log voice event to structured JSONL
 */
async function logVoiceEvent(cwd: string, event: VoiceEvent): Promise<void> {
  try {
    const ts = new Date(event.timestamp);
    const dateDir = `${ts.getFullYear()}/${String(ts.getMonth() + 1).padStart(2, "0")}/${String(ts.getDate()).padStart(2, "0")}`;
    const voiceDir = join(cwd, ".claude", "voice", dateDir);

    // Create directory if needed
    const { mkdir } = await import("fs/promises");
    await mkdir(voiceDir, { recursive: true });

    // Write to daily log file (append mode)
    const dailyLog = join(voiceDir, "events.jsonl");
    const line = JSON.stringify(event) + "\n";
    const { appendFile } = await import("fs/promises");
    await appendFile(dailyLog, line);

    // Also write to global events file for easy searching
    const globalLog = join(cwd, ".claude", "voice", "events.jsonl");
    await appendFile(globalLog, line);

    log(`Logged voice event: ${event.event} -> ${dailyLog}`);
  } catch (e) {
    log(`Failed to log voice event: ${e}`);
  }
}

/**
 * Read JSON from stdin
 */
async function readStdin(): Promise<Record<string, unknown>> {
  try {
    const chunks: Uint8Array[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf-8");
    return JSON.parse(text || "{}");
  } catch (e) {
    log(`Failed to read stdin: ${e}`);
    return {};
  }
}

/**
 * Extract last assistant response from transcript
 *
 * Collects ALL text blocks from the last assistant message and joins them,
 * ensuring we get the complete response rather than just the first block.
 */
function extractResponse(transcriptPath: string): string {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return "";
  }

  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n").reverse();

    for (const line of lines) {
      if (!line.trim()) continue;

      const entry = JSON.parse(line);
      if (entry.type === "assistant") {
        const message = entry.message || {};
        const blocks = message.content || [];

        // Collect ALL text blocks from this message
        const textParts: string[] = [];
        for (const block of blocks) {
          if (block.type === "text") {
            const text = block.text || "";
            // Skip system reminders
            if (!text.startsWith("<system-reminder>")) {
              textParts.push(text.trim());
            }
          }
        }

        // Return combined text if we found any
        if (textParts.length > 0) {
          return textParts.join("\n\n");
        }
      }
    }
  } catch (e) {
    log(`Failed to extract response: ${e}`);
  }

  return "";
}

/**
 * Summarize response for TTS (first 2-3 sentences, max ~100 words)
 */
function summarizeForVoice(text: string): string {
  if (!text) return "";

  // Remove markdown code blocks
  let cleaned = text.replace(/```[\s\S]*?```/g, "(code block)");

  // Remove inline code
  cleaned = cleaned.replace(/`[^`]+`/g, "");

  // Remove markdown tables (header, separator, and data rows)
  // Matches lines that start and end with | or contain |---|
  cleaned = cleaned.replace(/^\|.+\|$/gm, "");  // Table rows
  cleaned = cleaned.replace(/^\s*\|?[-:| ]+\|?\s*$/gm, "");  // Separator rows like |---|---|

  // Remove markdown links, keep text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove markdown formatting
  cleaned = cleaned.replace(/[*_#]+/g, "");

  // Clean up multiple blank lines left by removed content
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Split into sentences
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);

  // Take first sentences, with generous limits to avoid mid-structure truncation
  let result = "";
  let wordCount = 0;
  const maxSentences = 30;
  const maxWords = 500;

  for (let i = 0; i < Math.min(sentences.length, maxSentences); i++) {
    const sentence = sentences[i].trim();
    const words = sentence.split(/\s+/).length;

    if (wordCount + words > maxWords && result) break;

    result += (result ? " " : "") + sentence;
    wordCount += words;
  }

  return result || text.slice(0, 300);
}

/**
 * Get agent info from subagent transcript
 *
 * Extracts the LAST assistant message's full text, concatenating all
 * text blocks from that single message. This avoids capturing intermediate
 * thinking/planning output from earlier messages.
 */
function getSubagentInfo(
  transcriptPath: string
): { model: string; summary: string } {
  const result = { model: "", summary: "" };

  if (!transcriptPath || !existsSync(transcriptPath)) {
    return result;
  }

  try {
    const content = readFileSync(transcriptPath, "utf-8");
    const lines = content.trim().split("\n");

    // Find the LAST assistant message by iterating in reverse
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      const entry = JSON.parse(line);

      // Get model from any entry that has it
      if (!result.model) {
        const model = entry.message?.model || "";
        if (model.includes("opus")) result.model = "opus";
        else if (model.includes("sonnet")) result.model = "sonnet";
        else if (model.includes("haiku")) result.model = "haiku";
      }

      // Only process assistant messages
      if (entry.type !== "assistant") continue;

      // Collect ALL text blocks from this single message
      const blocks = entry.message?.content || [];
      const textParts: string[] = [];

      for (const block of blocks) {
        if (block.type === "text") {
          const text = block.text?.trim();
          if (text && !text.startsWith("<system-reminder>")) {
            textParts.push(text);
          }
        }
      }

      // If we found text in this message, use it and stop
      if (textParts.length > 0) {
        // Join all text blocks from this message
        const fullText = textParts.join("\n\n");
        result.summary = summarizeForVoice(fullText);
        break;
      }
    }
  } catch (e) {
    log(`Failed to get subagent info: ${e}`);
  }

  return result;
}

/**
 * Perform actual TTS synthesis and playback.
 * This is called either directly (fallback) or when queue signals play_now.
 */
async function performTTS(
  text: string,
  resolved: Awaited<ReturnType<typeof resolveVoiceForSession>>
): Promise<void> {
  const normalizedSettings = normalizeVoiceSettings(resolved.config.settings);

  const options: Partial<TTSOptions> = {
    voiceId: resolved.config.voiceId,
    ...normalizedSettings,
  };

  await speakAndPlay(text, options, resolved.config.backend);
}

/**
 * Speak text using queue coordination with fallback to direct playback.
 *
 * Flow:
 * 1. Try to connect to queue daemon (auto-starts if not running)
 * 2. Enqueue request and wait for play_now signal
 * 3. Perform TTS when signaled
 * 4. If queue unavailable, fall back to direct playback with file lock
 */
async function speak(
  text: string,
  sessionId: string,
  cwd: string,
  eventType: string,
  agentId?: string
): Promise<void> {
  if (!text) return;

  // Check if voice is enabled via settings file
  if (!isVoiceEnabled()) {
    log(`Voice disabled via settings, skipping speech`);
    return;
  }

  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const priority = EVENT_PRIORITIES[eventType] ?? VoicePriority.NORMAL;

  log(`Speaking: "${text.slice(0, 50)}..." (priority: ${priority})`);

  // Resolve voice configuration first
  const resolved = agentId
    ? await resolveVoiceForAgent(agentId, cwd)
    : await resolveVoiceForSession(sessionId, cwd);

  log(`Voice resolved: ${resolved.source} -> ${resolved.config.backend}:${resolved.config.voiceId}`);

  // Apply personality transformation
  let transformedText = text;
  try {
    const personality = getPersonalityManager(cwd).getForAgent(agentId || "default");
    const transformer = new TextTransformer(personality);
    const context: TransformContext = {
      eventType,
      isGreeting: eventType === "SessionStart",
      isError: eventType === "Notification",
      isSuccess: eventType === "Stop",
    };
    transformedText = transformer.transform(text, context);
    log(`Personality applied: ${personality.id} (${transformedText.length} chars)`);
  } catch (e) {
    log(`Personality transformation failed, using original text: ${e}`);
    // Continue with original text on error
  }

  // Initialize event for logging
  const voiceEvent: VoiceEvent = {
    timestamp,
    session_id: sessionId,
    event: eventType,
    text: transformedText,
    text_length: transformedText.length,
    backend: resolved.config.backend,
    voice_id: resolved.config.voiceId,
    voice_source: resolved.source,
    success: false,
  };

  if (agentId) {
    voiceEvent.agent_id = agentId;
  }

  // Try queue-based playback first
  if (USE_QUEUE) {
    try {
      await speakViaQueue(transformedText, priority, resolved, sessionId, agentId);
      voiceEvent.success = true;
      voiceEvent.duration_ms = Date.now() - startTime;
      log("Speech complete (via queue)");
      await logVoiceEvent(cwd, voiceEvent);
      return;
    } catch (e) {
      log(`Queue unavailable, falling back to direct playback: ${e}`);
      // Fall through to direct playback
    }
  }

  // Fallback: Direct playback with file lock
  const lockKey = agentId || "main";
  const hasLock = await acquireLock(sessionId, `${eventType}-${lockKey}`);
  if (!hasLock) {
    log(`Skipping speech - another instance is already speaking for ${eventType}`);
    return;
  }

  try {
    await performTTS(transformedText, resolved);
    voiceEvent.success = true;
    voiceEvent.duration_ms = Date.now() - startTime;
    log("Speech complete (direct)");
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    voiceEvent.error = errorMsg;
    voiceEvent.duration_ms = Date.now() - startTime;
    log(`Speech failed: ${e}`);
    console.error(`[voice] TTS failed: ${errorMsg}`);
  } finally {
    await releaseLock(sessionId, `${eventType}-${lockKey}`);
  }

  await logVoiceEvent(cwd, voiceEvent);
}

/**
 * Speak via the queue daemon.
 * Connects, enqueues, waits for play signal, then performs TTS.
 */
async function speakViaQueue(
  text: string,
  priority: VoicePriority,
  resolved: Awaited<ReturnType<typeof resolveVoiceForSession>>,
  sessionId?: string,
  agentId?: string
): Promise<void> {
  const client = new VoiceQueueClient();

  try {
    // Connect with auto-start
    await client.connect({ autoStart: true });

    // Enqueue request
    const queueId = await client.enqueue({
      text,
      priority,
      voiceConfig: {
        backend: resolved.config.backend,
        voiceId: resolved.config.voiceId,
        settings: resolved.config.settings,
      },
      sessionId,
      agentId,
    });

    log(`Enqueued: ${queueId}`);

    // Wait for play signal (daemon says it's our turn)
    const item = await client.waitForPlaySignal(30000);
    log(`Play signal received for: ${item.id}`);

    // Perform TTS
    const startTime = Date.now();
    try {
      await performTTS(text, resolved);
      const durationMs = Date.now() - startTime;
      await client.reportComplete(queueId, durationMs);
    } catch (error) {
      await client.reportFailed(
        queueId,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  } finally {
    client.disconnect();
  }
}

/**
 * Handle SessionStart event
 */
async function handleSessionStart(
  data: Record<string, unknown>,
  cwd: string
): Promise<void> {
  const sessionId = data.session_id as string;

  log(`SessionStart: ${sessionId}`);
  await speak("Ready.", sessionId, cwd, "SessionStart");
}

/**
 * Handle Stop event
 */
async function handleStop(
  data: Record<string, unknown>,
  cwd: string
): Promise<void> {
  const sessionId = data.session_id as string;
  const transcriptPath = data.transcript_path as string;

  log(`Stop: ${sessionId}`);

  // Extract and summarize response
  const response = extractResponse(transcriptPath);
  const summary = summarizeForVoice(response);

  if (summary) {
    await speak(summary, sessionId, cwd, "Stop");
  }
}

/**
 * Handle Notification event
 */
async function handleNotification(
  data: Record<string, unknown>,
  cwd: string
): Promise<void> {
  const sessionId = data.session_id as string;
  const message = (data.message as string) || "I need your attention.";

  log(`Notification: ${sessionId} - ${message}`);
  await speak(message, sessionId, cwd, "Notification");
}

/**
 * Handle SubagentStop event
 */
async function handleSubagentStop(
  data: Record<string, unknown>,
  cwd: string
): Promise<void> {
  const sessionId = data.session_id as string;
  const agentId = data.agent_id as string;
  const agentTranscriptPath = data.agent_transcript_path as string;

  log(`SubagentStop: ${agentId}`);

  // Get subagent info
  const info = getSubagentInfo(agentTranscriptPath);

  if (info.summary) {
    // Use agent-specific voice, pass agentId for voice resolution
    await speak(info.summary, sessionId, cwd, "SubagentStop", agentId);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const event = process.argv[2];
  if (!event) {
    console.error("Usage: voice-hook.ts <event>");
    process.exit(1);
  }

  log(`Event: ${event}`);

  // Read input data
  const data = await readStdin();
  log(`Data keys: ${Object.keys(data).join(", ")}`);

  // Load environment from project .env (cwd from hook data)
  // Resolve relative paths against current process directory
  const cwdRaw = (data.cwd as string) || ".";
  const cwd = cwdRaw.startsWith("/") ? cwdRaw : join(process.cwd(), cwdRaw);
  loadEnvFile(cwd);
  log(`Loaded .env from: ${cwd}`);

  // Handle event
  switch (event) {
    case "SessionStart":
      await handleSessionStart(data, cwd);
      break;
    case "Stop":
      await handleStop(data, cwd);
      break;
    case "Notification":
      await handleNotification(data, cwd);
      break;
    case "SubagentStop":
      await handleSubagentStop(data, cwd);
      break;
    default:
      log(`Unknown event: ${event}`);
  }
}

// Run
main().catch((e) => {
  log(`Fatal error: ${e}`);
  process.exit(0); // Don't fail the hook
});
