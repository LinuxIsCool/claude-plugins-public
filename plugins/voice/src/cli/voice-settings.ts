#!/usr/bin/env bun
/**
 * Voice Settings CLI
 *
 * CLI for managing voice output settings and viewing status.
 * Called by /voice:on, /voice:off, and /voice:status commands.
 *
 * Usage:
 *   bun voice-settings.ts on     - Enable voice, speak confirmation
 *   bun voice-settings.ts off    - Disable voice, silent
 *   bun voice-settings.ts status - Show comprehensive status
 */

import { isVoiceEnabled, setVoiceEnabled } from "../settings.js";
import { speakAndPlay } from "../adapters/tts/index.js";
import { resolveVoiceForSession, normalizeVoiceSettings } from "../identity/resolver.js";
import { loadEnvFromRepoRoot, getRepoRoot } from "../lib/paths.js";
import {
  getElevenLabsQuota,
  getLocalUsageStats,
  formatDuration,
  formatNumber,
  formatPercent,
  formatResetDate,
} from "../status.js";

// Load environment variables from repo root
loadEnvFromRepoRoot();

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "on":
      await enableVoice();
      break;
    case "off":
      disableVoice();
      break;
    case "status":
      await showStatus();
      break;
    default:
      console.log("Usage: voice-settings.ts <on|off|status>");
      process.exit(1);
  }
}

async function enableVoice(): Promise<void> {
  setVoiceEnabled(true);
  console.log("Voice enabled.");

  // Speak confirmation
  try {
    const cwd = getRepoRoot();
    const resolved = await resolveVoiceForSession("cli", cwd);
    const normalizedSettings = normalizeVoiceSettings(resolved.config.settings);

    await speakAndPlay(
      "Voice enabled.",
      {
        voiceId: resolved.config.voiceId,
        ...normalizedSettings,
      },
      resolved.config.backend
    );
  } catch (e) {
    // If TTS fails, just show text (don't error)
    console.error(`[voice] TTS confirmation failed: ${e}`);
  }
}

function disableVoice(): void {
  setVoiceEnabled(false);
  console.log("Voice disabled.");
  // Silent - no TTS
}

async function showStatus(): Promise<void> {
  const enabled = isVoiceEnabled();
  const cwd = getRepoRoot();
  const apiKey = process.env.ELEVENLABS_API_KEY;

  // Header
  console.log("Voice Status");
  console.log("============\n");

  // Basic state
  console.log(`State: ${enabled ? "enabled" : "disabled"}`);

  // Backend and voice info
  try {
    const resolved = await resolveVoiceForSession("cli", cwd);
    console.log(`Backend: ${resolved.config.backend}`);
    console.log(`Voice ID: ${resolved.config.voiceId}`);
    console.log(`Source: ${resolved.source}`);
  } catch (e) {
    console.log(`Backend: unavailable (${e})`);
  }

  // ElevenLabs quota (if API key available)
  if (apiKey) {
    console.log("\nElevenLabs Quota");
    console.log("----------------");

    try {
      const quota = await getElevenLabsQuota(apiKey);
      const usagePercent = formatPercent(quota.characterCount, quota.characterLimit);

      console.log(`Used: ${formatNumber(quota.characterCount)} / ${formatNumber(quota.characterLimit)} characters (${usagePercent})`);
      console.log(`Resets: ${formatResetDate(quota.nextResetUnix)}`);
      console.log(`Tier: ${quota.tier}`);
      console.log(`Status: ${quota.status}`);
      console.log(`Voice slots: ${quota.voiceSlotsUsed} / ${quota.voiceLimit}`);

      if (quota.canUseInstantCloning) {
        console.log(`Instant cloning: available`);
      }
      if (quota.canUseProfessionalCloning) {
        console.log(`Professional cloning: available`);
      }
    } catch (e) {
      console.log(`Error fetching quota: ${e}`);
    }
  } else {
    console.log("\nElevenLabs Quota: No API key configured");
  }

  // Local usage stats
  console.log("\nLocal Usage (this project)");
  console.log("--------------------------");

  const stats = getLocalUsageStats();

  if (stats.totalCharacters === 0) {
    console.log("No voice events recorded yet.");
  } else {
    console.log(`Total characters: ${formatNumber(stats.totalCharacters)}`);
    console.log(`Audio duration: ${formatDuration(stats.totalDurationMs)}`);

    const totalEvents = stats.eventCounts.sessionStart + stats.eventCounts.stop +
      stats.eventCounts.subagentStop + stats.eventCounts.notification;
    console.log(`Events: ${totalEvents} (Stop: ${stats.eventCounts.stop}, SubagentStop: ${stats.eventCounts.subagentStop}, SessionStart: ${stats.eventCounts.sessionStart}, Notification: ${stats.eventCounts.notification})`);

    const successRate = formatPercent(stats.successCount, stats.successCount + stats.failureCount);
    console.log(`Success rate: ${successRate}`);

    console.log(`Sessions: ${stats.uniqueSessions}`);
    if (stats.uniqueAgents > 0) {
      console.log(`Subagents: ${stats.uniqueAgents}`);
    }

    if (stats.firstEventDate && stats.lastEventDate) {
      const first = new Date(stats.firstEventDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Los_Angeles",
      });
      const last = new Date(stats.lastEventDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/Los_Angeles",
      });
      console.log(`Period: ${first} - ${last}`);
    }
  }
}

main().catch((e) => {
  console.error(`Error: ${e}`);
  process.exit(1);
});
