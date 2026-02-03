/**
 * Voice Status Module
 *
 * Provides comprehensive status information including:
 * - ElevenLabs API quota and subscription info
 * - Local usage statistics from event logs
 */

import { existsSync, readFileSync } from "fs";
import { getClaudePath } from "./lib/paths.js";

/**
 * ElevenLabs subscription info from API
 */
export interface ElevenLabsQuota {
  characterCount: number;
  characterLimit: number;
  nextResetUnix: number;
  tier: string;
  status: string;
  voiceSlotsUsed: number;
  voiceLimit: number;
  canUseInstantCloning: boolean;
  canUseProfessionalCloning: boolean;
}

/**
 * Local usage statistics computed from event logs
 */
export interface LocalUsageStats {
  totalCharacters: number;
  totalDurationMs: number;
  eventCounts: {
    sessionStart: number;
    stop: number;
    subagentStop: number;
    notification: number;
  };
  successCount: number;
  failureCount: number;
  uniqueSessions: number;
  uniqueAgents: number;
  voiceUsage: Record<string, number>;  // voice_id -> character count
  firstEventDate: string | null;
  lastEventDate: string | null;
}

/**
 * Voice event from log file
 */
interface VoiceEvent {
  timestamp: string;
  session_id: string;
  event: string;
  text: string;
  text_length: number;
  backend: string;
  voice_id: string;
  voice_source: string;
  agent_id?: string;
  duration_ms?: number;
  success: boolean;
  error?: string;
}

/**
 * Fetch ElevenLabs subscription info from API
 */
export async function getElevenLabsQuota(apiKey: string): Promise<ElevenLabsQuota> {
  const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  const data = await response.json() as {
    character_count: number;
    character_limit: number;
    next_character_count_reset_unix: number;
    tier: string;
    status: string;
    voice_slots_used: number;
    voice_limit: number;
    can_use_instant_voice_cloning: boolean;
    can_use_professional_voice_cloning: boolean;
  };

  return {
    characterCount: data.character_count,
    characterLimit: data.character_limit,
    nextResetUnix: data.next_character_count_reset_unix,
    tier: data.tier,
    status: data.status,
    voiceSlotsUsed: data.voice_slots_used,
    voiceLimit: data.voice_limit,
    canUseInstantCloning: data.can_use_instant_voice_cloning,
    canUseProfessionalCloning: data.can_use_professional_voice_cloning,
  };
}

/**
 * Compute local usage statistics from event logs
 */
export function getLocalUsageStats(): LocalUsageStats {
  const stats: LocalUsageStats = {
    totalCharacters: 0,
    totalDurationMs: 0,
    eventCounts: {
      sessionStart: 0,
      stop: 0,
      subagentStop: 0,
      notification: 0,
    },
    successCount: 0,
    failureCount: 0,
    uniqueSessions: 0,
    uniqueAgents: 0,
    voiceUsage: {},
    firstEventDate: null,
    lastEventDate: null,
  };

  const eventsPath = getClaudePath("voice/events.jsonl");
  if (!existsSync(eventsPath)) {
    return stats;
  }

  try {
    const content = readFileSync(eventsPath, "utf-8");
    const lines = content.trim().split("\n").filter(line => line.trim());

    const sessions = new Set<string>();
    const agents = new Set<string>();

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as VoiceEvent;

        // Track dates
        if (!stats.firstEventDate || event.timestamp < stats.firstEventDate) {
          stats.firstEventDate = event.timestamp;
        }
        if (!stats.lastEventDate || event.timestamp > stats.lastEventDate) {
          stats.lastEventDate = event.timestamp;
        }

        // Count characters and duration
        stats.totalCharacters += event.text_length || 0;
        stats.totalDurationMs += event.duration_ms || 0;

        // Count events by type
        switch (event.event) {
          case "SessionStart":
            stats.eventCounts.sessionStart++;
            break;
          case "Stop":
            stats.eventCounts.stop++;
            break;
          case "SubagentStop":
            stats.eventCounts.subagentStop++;
            break;
          case "Notification":
            stats.eventCounts.notification++;
            break;
        }

        // Count success/failure
        if (event.success) {
          stats.successCount++;
        } else {
          stats.failureCount++;
        }

        // Track unique sessions and agents
        if (event.session_id) {
          sessions.add(event.session_id);
        }
        if (event.agent_id) {
          agents.add(event.agent_id);
        }

        // Track voice usage
        if (event.voice_id) {
          stats.voiceUsage[event.voice_id] = (stats.voiceUsage[event.voice_id] || 0) + (event.text_length || 0);
        }
      } catch {
        // Skip malformed lines
      }
    }

    stats.uniqueSessions = sessions.size;
    stats.uniqueAgents = agents.size;
  } catch {
    // Return empty stats on error
  }

  return stats;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format number with commas
 */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format percentage
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

/**
 * Format Unix timestamp to readable date
 */
export function formatResetDate(unix: number): string {
  const date = new Date(unix * 1000);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });

  if (diffDays <= 0) {
    return `${formatted} (today)`;
  } else if (diffDays === 1) {
    return `${formatted} (tomorrow)`;
  } else {
    return `${formatted} (${diffDays} days)`;
  }
}
