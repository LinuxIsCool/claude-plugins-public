/**
 * Voice Identity Resolver
 *
 * Resolves voice configuration for a given session/agent using a layered approach:
 * 1. Session Override (statusline) - ephemeral per-session voice
 * 2. Agent Profile (agentnet)    - persistent agent voice
 * 3. Model Default              - opus/sonnet/haiku fallback
 * 4. System Default             - global fallback voice
 */

import { existsSync, readFileSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

/**
 * Sanitize session/agent ID to prevent path traversal attacks
 */
function sanitizeId(id: string): string {
  // Remove any path components and special characters
  return basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Voice configuration for an agent/session
 */
export interface VoiceConfig {
  backend: string;
  voiceId: string;
  settings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
  };
}

/**
 * Layered voice configuration
 */
export interface ResolvedVoice {
  config: VoiceConfig;
  source: "session" | "agent" | "model" | "system";
  agentId?: string;
  model?: string;
}

/**
 * Model-based default voices
 */
export const MODEL_VOICE_DEFAULTS: Record<string, VoiceConfig> = {
  opus: {
    backend: "elevenlabs",
    voiceId: "pNInz6obpgDQGcFmaJgB",  // Adam - deep, authoritative
    settings: { stability: 0.5, similarityBoost: 0.75 },
  },
  sonnet: {
    backend: "elevenlabs",
    voiceId: "21m00Tcm4TlvDq8ikWAM",  // Rachel - professional
    settings: { stability: 0.6, similarityBoost: 0.75 },
  },
  haiku: {
    backend: "elevenlabs",
    voiceId: "MF3mGyEYCl7XYWbV9V6O",  // Elli - young, quick
    settings: { stability: 0.7, similarityBoost: 0.8 },
  },
};

/**
 * Agent-specific voice overrides
 */
export const AGENT_VOICE_DEFAULTS: Record<string, Partial<VoiceConfig>> = {
  "archivist": { voiceId: "ErXwobaYiN019PkySvjV" },      // Antoni - warm
  "librarian": { voiceId: "AZnzlk1XvdvUeBnXmlld" },     // Domi - conversational
  "systems-thinker": { voiceId: "D38z5RcWu1voky8WS1ja" }, // Fin - Irish
  "backend-architect": { voiceId: "TxGEqnHWrfWFTfGW9XjX" }, // Josh - deep
  "process-cartographer": { voiceId: "VR6AewLTigWG4xSOukaG" }, // Arnold - strong
};

/**
 * System default voice (fallback for everything)
 * Note: Use getSystemDefaultVoice() to get the appropriate default
 * based on available API keys
 */
export const SYSTEM_DEFAULT_VOICE: VoiceConfig = {
  backend: "pyttsx3",
  voiceId: "",  // Use system default
  settings: { speed: 1.0 },
};

/**
 * Get the system default voice, preferring ElevenLabs if API key is available
 */
export function getSystemDefaultVoice(): VoiceConfig {
  // If ElevenLabs key is available, use it as default
  if (process.env.ELEVENLABS_API_KEY) {
    return {
      backend: "elevenlabs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",  // Rachel - professional
      settings: { stability: 0.6, similarityBoost: 0.75 },
    };
  }
  // Fall back to local pyttsx3
  return SYSTEM_DEFAULT_VOICE;
}

/**
 * Try to read session-level voice override from statusline
 */
async function getSessionVoiceOverride(
  sessionId: string,
  cwd: string
): Promise<VoiceConfig | null> {
  // Sanitize session ID to prevent path traversal
  const safeSessionId = sanitizeId(sessionId);
  if (!safeSessionId) return null;

  // Check statusline registry for session-level voice override
  const instancesDir = join(cwd, ".claude", "statusline", "instances");
  const voiceFile = join(instancesDir, "voices", `${safeSessionId}.json`);

  if (existsSync(voiceFile)) {
    try {
      const data = JSON.parse(readFileSync(voiceFile, "utf-8"));
      return data as VoiceConfig;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Parse voice config from YAML content safely
 * Uses simple key-value extraction that handles indentation
 */
function parseVoiceFromYaml(content: string): VoiceConfig | null {
  // Look for voice section with proper YAML indentation handling
  // Match "voice:" followed by indented content
  const voiceBlockMatch = content.match(
    /^voice:\s*$/m
  );
  if (!voiceBlockMatch) return null;

  const voiceStart = voiceBlockMatch.index! + voiceBlockMatch[0].length;
  const restContent = content.slice(voiceStart);

  // Extract values from indented lines (2+ spaces)
  const lines = restContent.split("\n");
  let backend: string | null = null;
  let voiceId: string | null = null;

  for (const line of lines) {
    // Stop at unindented line (new top-level key)
    if (line.match(/^\S/) && line.trim()) break;

    const backendMatch = line.match(/^\s+backend:\s*["']?([^"'\n\s]+)/);
    if (backendMatch) backend = backendMatch[1];

    const voiceIdMatch = line.match(/^\s+voice_id:\s*["']?([^"'\n\s]+)/);
    if (voiceIdMatch) voiceId = voiceIdMatch[1];
  }

  if (backend && voiceId) {
    return { backend, voiceId };
  }
  return null;
}

/**
 * Try to read agent voice from agentnet profile
 */
async function getAgentVoice(
  agentId: string,
  cwd: string
): Promise<VoiceConfig | null> {
  // Sanitize agent ID to prevent path traversal
  const safeAgentId = sanitizeId(agentId);
  if (!safeAgentId) return null;

  // Check agentnet profiles
  const profilePath = join(cwd, ".claude", "social", "profiles", `${safeAgentId}.yaml`);

  if (existsSync(profilePath)) {
    try {
      const content = readFileSync(profilePath, "utf-8");
      const parsed = parseVoiceFromYaml(content);
      if (parsed) return parsed;
    } catch {
      // Fall through to defaults
    }
  }

  // Check built-in agent defaults (use original ID for lookup)
  if (agentId in AGENT_VOICE_DEFAULTS) {
    const override = AGENT_VOICE_DEFAULTS[agentId];
    return {
      backend: override.backend || "elevenlabs",
      voiceId: override.voiceId || "",
      settings: override.settings,
    };
  }

  return null;
}

/**
 * Detect model from session (via statusline registry)
 */
async function getSessionModel(
  sessionId: string,
  cwd: string
): Promise<string | null> {
  const registryPath = join(cwd, ".claude", "statusline", "instances", "registry.json");

  if (existsSync(registryPath)) {
    try {
      const data = JSON.parse(readFileSync(registryPath, "utf-8"));
      const session = data[sessionId];
      if (session?.model) {
        // Extract model name from full model ID
        const model = session.model;
        if (model.includes("opus")) return "opus";
        if (model.includes("sonnet")) return "sonnet";
        if (model.includes("haiku")) return "haiku";
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Detect agent from session (via statusline registry)
 */
async function getSessionAgent(
  sessionId: string,
  cwd: string
): Promise<string | null> {
  const registryPath = join(cwd, ".claude", "statusline", "instances", "registry.json");

  if (existsSync(registryPath)) {
    try {
      const data = JSON.parse(readFileSync(registryPath, "utf-8"));
      const session = data[sessionId];
      // Look for agent type in session data
      if (session?.subagentType) {
        return session.subagentType;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Resolve voice configuration for a session
 *
 * @param sessionId Claude session ID
 * @param cwd Current working directory
 * @returns Resolved voice configuration with source
 */
export async function resolveVoiceForSession(
  sessionId: string,
  cwd: string
): Promise<ResolvedVoice> {
  // 1. Check session-level override
  const sessionVoice = await getSessionVoiceOverride(sessionId, cwd);
  if (sessionVoice) {
    return {
      config: sessionVoice,
      source: "session",
    };
  }

  // 2. Check agent-specific voice
  const agentId = await getSessionAgent(sessionId, cwd);
  if (agentId) {
    const agentVoice = await getAgentVoice(agentId, cwd);
    if (agentVoice) {
      return {
        config: agentVoice,
        source: "agent",
        agentId,
      };
    }
  }

  // 3. Check model-based default
  const model = await getSessionModel(sessionId, cwd);
  if (model && model in MODEL_VOICE_DEFAULTS) {
    return {
      config: MODEL_VOICE_DEFAULTS[model],
      source: "model",
      model,
    };
  }

  // 4. Fall back to system default (dynamic based on available API keys)
  return {
    config: getSystemDefaultVoice(),
    source: "system",
  };
}

/**
 * Resolve voice configuration for an agent directly
 */
export async function resolveVoiceForAgent(
  agentId: string,
  cwd: string
): Promise<ResolvedVoice> {
  // Check agent-specific voice
  const agentVoice = await getAgentVoice(agentId, cwd);
  if (agentVoice) {
    return {
      config: agentVoice,
      source: "agent",
      agentId,
    };
  }

  // Fall back to system default (dynamic based on available API keys)
  return {
    config: getSystemDefaultVoice(),
    source: "system",
    agentId,
  };
}

/**
 * Set session-level voice override
 */
export async function setSessionVoiceOverride(
  sessionId: string,
  cwd: string,
  voice: VoiceConfig
): Promise<void> {
  // Sanitize session ID to prevent path traversal
  const safeSessionId = sanitizeId(sessionId);
  if (!safeSessionId) {
    throw new Error("Invalid session ID");
  }

  const instancesDir = join(cwd, ".claude", "statusline", "instances");
  const voicesDir = join(instancesDir, "voices");

  // Ensure directory exists
  const { mkdir, writeFile } = await import("fs/promises");
  await mkdir(voicesDir, { recursive: true });

  // Write voice config
  const voiceFile = join(voicesDir, `${safeSessionId}.json`);
  await writeFile(voiceFile, JSON.stringify(voice, null, 2));
}

/**
 * Clamp a value to a valid range
 */
export function clampVoiceSetting(
  value: number | undefined,
  min: number,
  max: number,
  defaultValue?: number
): number | undefined {
  if (value === undefined) return defaultValue;
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate and normalize voice settings
 */
export function normalizeVoiceSettings(
  settings?: VoiceConfig["settings"]
): VoiceConfig["settings"] {
  if (!settings) return undefined;

  return {
    stability: clampVoiceSetting(settings.stability, 0, 1),
    similarityBoost: clampVoiceSetting(settings.similarityBoost, 0, 1),
    style: clampVoiceSetting(settings.style, 0, 1),
    speed: clampVoiceSetting(settings.speed, 0.5, 2.0, 1.0),
  };
}
