/**
 * Voice Settings
 *
 * Read/write voice enabled state from .claude/voice.local.md
 * Uses YAML frontmatter for persistent settings.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { getClaudePath } from "./lib/paths.js";

/**
 * Get the path to the voice settings file.
 * Uses getClaudePath() to ensure consistent location regardless of cwd.
 */
function getSettingsPath(): string {
  return getClaudePath("voice.local.md");
}

/**
 * Check if voice is enabled via settings file.
 *
 * Reads .claude/voice.local.md and checks `enabled: true/false` in frontmatter.
 * Returns true (voice enabled) if:
 * - File doesn't exist
 * - File is malformed
 * - enabled field is missing
 * - enabled: true
 *
 * Only returns false when explicitly set to `enabled: false`.
 */
export function isVoiceEnabled(): boolean {
  const settingsPath = getSettingsPath();

  if (!existsSync(settingsPath)) {
    return true; // Default: voice enabled
  }

  try {
    const content = readFileSync(settingsPath, "utf-8");

    // Extract YAML frontmatter (between --- markers)
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return true;

    const frontmatter = match[1];

    // Parse enabled field (handles optional YAML comments and whitespace)
    // Matches: "enabled: true", "enabled: false", "enabled: true  # comment"
    const enabledMatch = frontmatter.match(/^enabled:\s*(true|false)(?:\s|#|$)/m);
    if (!enabledMatch) return true;

    return enabledMatch[1] === "true";
  } catch {
    // On any error, default to enabled
    return true;
  }
}

/**
 * Set voice enabled state in settings file.
 *
 * Creates .claude/voice.local.md if it doesn't exist.
 */
export function setVoiceEnabled(enabled: boolean): void {
  const settingsPath = getSettingsPath();

  // Ensure .claude directory exists
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = `---
enabled: ${enabled}
---

# Voice Settings

This file controls whether Claude Code speaks responses.

- \`enabled: true\` - Voice output is ON
- \`enabled: false\` - Voice output is OFF

Use \`/voice:on\` and \`/voice:off\` commands to toggle.
`;

  writeFileSync(settingsPath, content);
}
