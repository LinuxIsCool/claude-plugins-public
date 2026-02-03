/**
 * Personality Manager
 *
 * Manages voice personality profiles with CRUD operations
 * and agent-based resolution with fallback chain.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { getClaudePath } from "../lib/paths.js";
import type { VoicePersonality } from "./types.js";
import { DEFAULT_PERSONALITY } from "./types.js";
import { PERSONALITY_PRESETS } from "./presets.js";

/**
 * Get user profiles directory (runtime, writable)
 * Anchored to repo root to prevent data fragmentation
 */
function getUserProfilesDir(): string {
  return getClaudePath("voice/personalities");
}

/**
 * Get the built-in profiles directory (read-only)
 * Works whether running from src/ or compiled dist/
 */
function getBuiltinProfilesDir(): string {
  const url = import.meta.url;
  // Handle file:// URL format
  const filePath = url.startsWith("file://") ? url.slice(7) : url;
  const managerDir = dirname(filePath);
  // profiles/ is a sibling directory to manager.ts
  return join(managerDir, "profiles");
}

/**
 * Sanitize personality ID to prevent path traversal
 */
function sanitizeId(id: string): string {
  return basename(id).replace(/[^a-zA-Z0-9_:-]/g, "");
}

/**
 * Personality Manager
 *
 * Loads and manages voice personality profiles with a fallback chain:
 * 1. User override (.claude/voice/personalities/{id}.json)
 * 2. Built-in agent profile (src/personality/profiles/agents/{type}.json)
 * 3. Default personality (professional preset)
 */
export class PersonalityManager {
  private personalities: Map<string, VoicePersonality> = new Map();
  /** Current working directory (kept for compatibility) */
  readonly cwd: string;
  private userProfilesDir: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    // Use repo-root anchored path to prevent data fragmentation
    this.userProfilesDir = getUserProfilesDir();
    this.loadBuiltinProfiles();
    this.loadUserProfiles();
  }

  /**
   * Load built-in personality profiles from the package
   */
  private loadBuiltinProfiles(): void {
    // Load agent-specific profiles
    const agentsDir = join(getBuiltinProfilesDir(), "agents");
    if (existsSync(agentsDir)) {
      try {
        for (const file of readdirSync(agentsDir)) {
          if (file.endsWith(".json")) {
            try {
              const content = readFileSync(join(agentsDir, file), "utf-8");
              const personality = JSON.parse(content) as VoicePersonality;
              this.personalities.set(personality.id, this.mergeWithDefaults(personality));
            } catch (e) {
              console.error(`Failed to load built-in profile ${file}:`, e);
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read - that's okay
      }
    }
  }

  /**
   * Load user personality profiles from the project
   */
  private loadUserProfiles(): void {
    if (!existsSync(this.userProfilesDir)) {
      return;
    }

    try {
      for (const file of readdirSync(this.userProfilesDir)) {
        if (file.endsWith(".json")) {
          try {
            const content = readFileSync(join(this.userProfilesDir, file), "utf-8");
            const personality = JSON.parse(content) as VoicePersonality;
            // User profiles override built-in profiles
            this.personalities.set(personality.id, this.mergeWithDefaults(personality));
          } catch (e) {
            console.error(`Failed to load user profile ${file}:`, e);
          }
        }
      }
    } catch {
      // Can't read directory - that's okay
    }
  }

  /**
   * Merge a partial personality with defaults
   */
  private mergeWithDefaults(partial: Partial<VoicePersonality>): VoicePersonality {
    return {
      ...DEFAULT_PERSONALITY,
      ...partial,
      style: {
        ...DEFAULT_PERSONALITY.style,
        ...partial.style,
      },
      ttsSettings: {
        ...DEFAULT_PERSONALITY.ttsSettings,
        ...partial.ttsSettings,
      },
      textTransforms: {
        ...DEFAULT_PERSONALITY.textTransforms,
        ...partial.textTransforms,
      },
      emotion: {
        ...DEFAULT_PERSONALITY.emotion,
        ...partial.emotion,
      },
    };
  }

  /**
   * Get personality by ID
   */
  get(id: string): VoicePersonality | undefined {
    const safeId = sanitizeId(id);
    return this.personalities.get(safeId);
  }

  /**
   * Get personality for an agent with fallback chain
   *
   * Resolution order:
   * 1. Exact agent ID match (e.g., "awareness:mentor")
   * 2. Agent type match (strip namespace: "mentor")
   * 3. Default personality
   */
  getForAgent(agentId: string): VoicePersonality {
    // 1. Try exact agent ID
    const exact = this.personalities.get(agentId);
    if (exact) return exact;

    // 2. Try agent type (strip namespace if present)
    // "awareness:mentor" -> "mentor"
    // "exploration:explorer" -> "explorer"
    // "mentor" -> "mentor" (no namespace, still try lookup)
    if (agentId.includes(":")) {
      const agentType = agentId.split(":").pop();
      if (agentType) {
        const byType = this.personalities.get(agentType);
        if (byType) return byType;
      }
    }

    // 3. Fall back to default
    return this.getDefault();
  }

  /**
   * Get default personality
   */
  getDefault(): VoicePersonality {
    // Try to get a saved default first
    const saved = this.personalities.get("default");
    if (saved) return saved;

    // Create from professional preset
    return this.createFromPreset("professional", "default");
  }

  /**
   * Create personality from a preset template
   */
  createFromPreset(presetName: string, id: string): VoicePersonality {
    const preset = PERSONALITY_PRESETS[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    return this.mergeWithDefaults({
      id,
      name: preset.name,
      description: preset.description,
      ...preset.personality,
    });
  }

  /**
   * Save a personality to user profiles
   */
  save(personality: VoicePersonality): void {
    const safeId = sanitizeId(personality.id);
    if (!safeId) {
      throw new Error("Invalid personality ID");
    }

    // Store in memory
    this.personalities.set(safeId, personality);

    // Ensure directory exists
    if (!existsSync(this.userProfilesDir)) {
      mkdirSync(this.userProfilesDir, { recursive: true });
    }

    // Write to file
    const filePath = join(this.userProfilesDir, `${safeId}.json`);
    writeFileSync(filePath, JSON.stringify(personality, null, 2));
  }

  /**
   * Delete a personality
   */
  delete(id: string): boolean {
    const safeId = sanitizeId(id);
    if (!safeId || !this.personalities.has(safeId)) {
      return false;
    }

    // Remove from memory
    this.personalities.delete(safeId);

    // Remove from disk if exists
    const filePath = join(this.userProfilesDir, `${safeId}.json`);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore file deletion errors
      }
    }

    return true;
  }

  /**
   * List all loaded personalities
   */
  list(): VoicePersonality[] {
    return Array.from(this.personalities.values());
  }

  /**
   * Reload profiles from disk
   */
  reload(): void {
    this.personalities.clear();
    this.loadBuiltinProfiles();
    this.loadUserProfiles();
  }
}

/**
 * Singleton instance for convenience
 */
let defaultManager: PersonalityManager | null = null;

/**
 * Get or create the default personality manager
 */
export function getPersonalityManager(cwd?: string): PersonalityManager {
  if (!defaultManager || (cwd && cwd !== defaultManager.cwd)) {
    defaultManager = new PersonalityManager(cwd);
  }
  return defaultManager;
}
